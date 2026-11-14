import type { StreamApi } from './client';

/** One event from the cluster's watch stream. */
export interface WatchEvent {
  type: string;
  object?: Record<string, unknown>;
}

export interface WatchOptions {
  /** Collection path, e.g. `/api/v1/namespaces/default/pods`. */
  path: string;
  /** Extra query parameters; `watch` is added here. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Called once the stream is established, before any event. */
  onOpen?: () => void;
  onEvent: (event: WatchEvent) => void;
  signal: AbortSignal;
  /** Called when the server ends the stream by itself or after an ERROR event. */
  onEnd?: (reason?: string) => void;
}

/**
 * Read a collection's watch stream until it ends or the signal aborts.
 *
 * Kubernetes answers `?watch=true` with newline-delimited JSON over an ordinary chunked
 * response, so no WebSocket is involved: the BFF already pipes the body.
 *
 * Partial lines are buffered. A chunk boundary lands wherever the network decides, and parsing
 * half a JSON object is the classic way a live view silently stops updating.
 */
export async function watchCollection(client: StreamApi, options: WatchOptions): Promise<void> {
  const response = await client.stream(options.path, {
    query: { ...options.query, watch: 'true' },
    signal: options.signal,
  });
  const body = response.body;
  if (!body) {
    options.onEnd?.('the watch response has no body');
    return;
  }

  // The handshake is done: a list with no changes yet is still a live view.
  options.onOpen?.();

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let endReason: string | undefined;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (!line) continue;
        try {
          const event = JSON.parse(line) as WatchEvent;
          if (event.type === 'ERROR') {
            endReason = String((event.object?.['message'] as string | undefined) ?? 'the watch reported an error');
          }
          options.onEvent(event);
        } catch {
          endReason = 'malformed watch event';
          break;
        }
      }
      if (endReason) break;
    }
  } finally {
    reader.cancel().catch(() => {
      // Cancelling an already-closed stream is not an error worth reporting.
    });
  }

  if (!options.signal.aborted) options.onEnd?.(endReason);
}

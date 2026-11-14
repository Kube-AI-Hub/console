import type { StreamApi } from './client';

/**
 * Container logs, read as a stream.
 *
 * The kube log subresource is a plain HTTP GET whose body is the log text. With
 * `follow=true` kube-apiserver keeps the response open and appends lines as the
 * container writes them, so this is an HTTP chunked stream — no WebSocket, no
 * `EventSource` (which cannot carry the `Authorization` header the BFF needs).
 *
 * `EventSource` is not an option for a second reason too: the BFF forwards the
 * bearer token the browser sends, and only `fetch` can set that header.
 */

/** How one container's log is addressed. */
export interface PodLogTarget {
  /** Member cluster id; `host` (or an empty string) is the cluster the BFF itself talks to. */
  cluster: string;
  namespace: string;
  pod: string;
  /** Defaults to the pod's only container upstream; required when the pod has several. */
  container?: string;
}

export interface PodLogOptions extends PodLogTarget {
  /**
   * Lines to read from the end of the log — only honoured when `follow` is false.
   *
   * The follow path never sends it: see the note inside `openPodLogStream`.
   */
  tailLines?: number;
  /** Keep the response open and yield new lines as the container writes them. */
  follow?: boolean;
  /** Prefix each line with its RFC3339 timestamp (kube's `timestamps=true`). */
  timestamps?: boolean;
  /** Aborting has the same effect as calling `close()`. */
  signal?: AbortSignal;
}

/** A running log read. */
export interface PodLogStream extends AsyncIterable<string> {
  /** Stop reading and release the connection. Idempotent. */
  close(): void;
}

/** Lines read when `tailLines` is not given and `follow` is off. */
export const DEFAULT_TAIL_LINES = 200;

/**
 * Path of the log subresource, addressed through the BFF.
 *
 * The app reads pods from `/api/v1` (the kube endpoint ks-apiserver forwards),
 * not from kapis: kapis's resources endpoint is a list/detail proxy and does not
 * expose the `log` subresource at all.
 */
export function podLogPath(target: PodLogTarget): string {
  const clusterSegment =
    target.cluster && target.cluster !== 'host' ? `clusters/${encodeURIComponent(target.cluster)}/` : '';
  return `/api/v1/${clusterSegment}namespaces/${encodeURIComponent(target.namespace)}/pods/${encodeURIComponent(
    target.pod,
  )}/log`;
}

/**
 * Open one container's log as an async iterable of lines.
 *
 * The caller owns the lifetime: iterate to consume, `close()` to stop. Every
 * line is yielded without its trailing newline; blank lines are skipped because
 * they carry nothing and would render as empty rows.
 *
 * ### Why `follow` never sends `tailLines`
 *
 * Measured against B200 (ks-apiserver v3.4.1, k8s v1.37.0, 2026-11-14): the
 * upstream buffers its response and flushes only when the buffered bytes reach
 * ~4 KiB. `follow=true` with a small `tailLines` therefore produces no response
 * headers at all until more log lines arrive — the read hangs forever on a quiet
 * container. Concretely, on the same pod: `tailLines=20` (3771-byte body) +
 * `follow` never answered; `tailLines=25` (4735-byte body) + `follow` answered
 * in 30 ms and streamed. A bare `follow=true` replays the current log file and
 * then follows; if the history is already large enough it always answers.
 *
 * So the follow path asks for the whole history and the UI trims to the last
 * 1000 lines. That trades bandwidth on a very long log for a stream that starts
 * at all. When the upstream is fixed, `tailLines` can be re-added here and only
 * this function changes.
 */
export function openPodLogStream(client: StreamApi, options: PodLogOptions): PodLogStream {
  const controller = new AbortController();
  const external = options.signal;
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const query: Record<string, string> = {};
  if (options.container) query['container'] = options.container;
  if (options.timestamps) query['timestamps'] = 'true';
  if (options.follow) {
    query['follow'] = 'true';
  } else {
    query['tailLines'] = String(options.tailLines ?? DEFAULT_TAIL_LINES);
  }

  const path = podLogPath(options);

  async function* lines(): AsyncGenerator<string, void, void> {
    let response: Response;
    try {
      response = await client.stream(path, { query, signal: controller.signal });
    } catch (cause) {
      // A deliberate close is not a failure: the caller aborted, so there is
      // nothing to report and the iterator ends cleanly.
      if (controller.signal.aborted) return;
      throw cause;
    }

    const body = response.body;
    if (!body) {
      // An environment without streaming bodies (very old browser, or a test
      // double). Read what arrived in one go; the line splitting is identical.
      const text = await response.text();
      for (const line of text.split('\n')) {
        const trimmed = line.replace(/\r$/, '');
        if (trimmed.length > 0) yield trimmed;
      }
      return;
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch (cause) {
          if (controller.signal.aborted) return;
          throw cause;
        }
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        let newline = buffer.indexOf('\n');
        while (newline >= 0) {
          const line = buffer.slice(0, newline).replace(/\r$/, '');
          buffer = buffer.slice(newline + 1);
          if (line.length > 0) yield line;
          newline = buffer.indexOf('\n');
        }
      }
      buffer += decoder.decode();
      const tail = buffer.replace(/\r$/, '');
      if (tail.length > 0) yield tail;
    } finally {
      try {
        await reader.cancel();
      } catch {
        // The stream is already closed or errored; cancelling again is a no-op
        // that some polyfills reject instead of ignoring.
      }
    }
  }

  return {
    [Symbol.asyncIterator]() {
      return lines();
    },
    close() {
      controller.abort();
    },
  };
}

/**
 * The same read as a bare async iterable, when the caller has no use for
 * `close()` and aborts through the signal instead.
 */
export function streamPodLogs(client: StreamApi, options: PodLogOptions): AsyncIterable<string> {
  return openPodLogStream(client, options);
}

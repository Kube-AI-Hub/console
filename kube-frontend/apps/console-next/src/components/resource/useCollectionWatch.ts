import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { watchCollection, type StreamApi, type WatchEvent } from '@kube-ai-hub/api-client';

/**
 * Keep a list fresh by watching the collection instead of polling.
 *
 * A change only invalidates the list query; the query refetches with the page's own parameters.
 * Rebuilding rows from watch objects would duplicate the list's sorting, paging and mapping.
 */
export interface UseCollectionWatchOptions {
  /** Off by default: a live view holds a connection open, so the reader opts in. */
  enabled: boolean;
  /** Collection path, relative to the BFF. */
  path: string;
  /** Extra query parameters (selectors, field selectors). */
  query?: Record<string, string | number | boolean | undefined>;
  /**
   * Queries to invalidate when something changes.
   *
   * Compared by value, not identity: pages pass an array literal, and using its identity as an
   * effect dependency tore the connection down and re-opened it on every render.
   */
  queryKey: readonly unknown[];
  /** The app's streaming client; injected so tests do not open sockets. */
  client: StreamApi;
  /** Delay before reopening after a clean end; doubles after a failure, capped at 30s. */
  retryDelayMs?: number;
}

export type CollectionWatchState = 'off' | 'connecting' | 'live' | 'error';

export function useCollectionWatch(options: UseCollectionWatchOptions): CollectionWatchState {
  const queryClient = useQueryClient();
  const [state, setState] = React.useState<CollectionWatchState>(options.enabled ? 'connecting' : 'off');
  const { enabled, path, client } = options;
  const queryKey = JSON.stringify(options.queryKey);
  const watchQuery = JSON.stringify(options.query ?? null);
  const retryDelayMs = options.retryDelayMs ?? 1_000;

  React.useEffect(() => {
    if (!enabled) {
      setState('off');
      return undefined;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let delay = retryDelayMs;

    const start = async (): Promise<void> => {
      setState('connecting');
      try {
        await watchCollection(client, {
          path,
          ...(watchQuery === 'null' ? {} : { query: JSON.parse(watchQuery) as Record<string, string> }),
          signal: controller.signal,
          onOpen: () => {
            if (!cancelled) setState('live');
          },
          onEvent: (event: WatchEvent) => {
            if (event.type === 'ADDED' || event.type === 'MODIFIED' || event.type === 'DELETED') {
              if (!cancelled) setState('live');
              void queryClient.invalidateQueries({ queryKey: JSON.parse(queryKey) as unknown[] });
            }
          },
          onEnd: () => {
            if (cancelled) return;
            // A watch ends on its own after the server timeout; reconnecting is normal.
            delay = retryDelayMs;
            timer = setTimeout(() => void start(), delay);
          },
        });
      } catch {
        if (cancelled || controller.signal.aborted) return;
        setState('error');
        delay = Math.min(delay * 2, 30_000);
        timer = setTimeout(() => void start(), delay);
      }
    };

    void start();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller.abort();
    };
  }, [client, enabled, path, queryKey, watchQuery, retryDelayMs, queryClient]);

  return state;
}

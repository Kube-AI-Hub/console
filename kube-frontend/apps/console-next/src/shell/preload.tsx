import * as React from 'react';

/**
 * Warm the components several areas share, instead of waiting for each page to
 * ask for them.
 *
 * The YAML editor is 137 KB gzip of CodeMirror and every resource that can be
 * edited by YAML opens it — configuration, workloads, routes, CRDs. Loading it on
 * demand meant paying a cold start at the *first* "edit YAML" of every session,
 * on whichever page the reader happened to reach first. That cost landed exactly
 * when the reader was already waiting, so the chunk is fetched while the workbench
 * is idle instead (DEC-CORE-KUBE_FRONTEND-04, revised).
 *
 * The rule for what belongs here: a component used by two or more areas, or
 * guaranteed to be needed soon after landing. Everything else stays lazy — page
 * chunks in particular must not be preloaded, or every area's JavaScript arrives
 * on the first screen.
 */

/**
 * Modules to warm. Each entry is imported by its own `import()` so the bundler
 * keeps it a separate chunk: warming one must not pull in a page.
 */
const WARM = {
  /** The YAML editing surface: CodeMirror and its parsers. */
  editor: () => import('@kube-ai-hub/ui/editor'),
} as const;

type WarmKey = keyof typeof WARM;

/** Keys already requested; warming twice is a wasted request. */
const started = new Set<WarmKey>();

/** Resolved when the warm-up has finished, for tests and for callers that care. */
const done = new Map<WarmKey, Promise<void>>();

export function warmChunk(key: WarmKey): Promise<void> {
  const existing = done.get(key);
  if (existing) return existing;
  started.add(key);
  const work = WARM[key]()
    .then(() => undefined)
    .catch(() => undefined);
  done.set(key, work);
  return work;
}

/** Warm every shared chunk. Idempotent. */
export function warmSharedChunks(): Promise<void> {
  return Promise.all(Object.keys(WARM).map((key) => warmChunk(key as WarmKey))).then(() => undefined);
}

/** Whether a chunk has already been requested (used by tests and diagnostics). */
export function isWarmed(key: WarmKey): boolean {
  return started.has(key);
}

/** Test hook: forget what has been warmed. */
export function resetWarmState(): void {
  started.clear();
  done.clear();
}

/**
 * Run `warmSharedChunks` once the browser is idle.
 *
 * `requestIdleCallback` keeps the warm-up off the critical path: the shell and
 * the first list can paint and fetch before the editor arrives. Browsers without
 * it fall back to a short timeout — waiting for "load" would put the request
 * behind the very requests the reader is waiting on.
 */
export function scheduleWarmup(options: { timeoutMs?: number } = {}): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const timeout = options.timeoutMs ?? 1500;

  const run = (): void => {
    void warmSharedChunks();
  };

  const idle = (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number })
    .requestIdleCallback;
  if (typeof idle === 'function') {
    const handle = idle(run, { timeout });
    return () => {
      const cancel = (window as Window & { cancelIdleCallback?: (handle: number) => void }).cancelIdleCallback;
      if (typeof cancel === 'function') cancel(handle);
    };
  }

  const timer = window.setTimeout(run, 0);
  return () => window.clearTimeout(timer);
}

/**
 * Warms shared chunks on mount. Mounted by the root layout for authenticated
 * pages: the login screen has no use for an editor.
 */
export function SharedChunkWarmer(): React.ReactElement | null {
  React.useEffect(() => scheduleWarmup(), []);
  return null;
}

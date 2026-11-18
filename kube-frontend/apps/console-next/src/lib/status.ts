/**
 * Translating the status values the API returns.
 *
 * One table, because the same concept shows up on more than one page: a claim is
 * `Bound` on the storage list, on the storage detail and (for a volume) on the
 * persistent-volume list. Two copies of the mapping drift — one translates, the other
 * shows the raw enum, and a reader sees `已绑定` in one place and `Bound` in another for
 * the same thing.
 *
 * A value with no entry is returned unchanged rather than guessed at: an untranslated
 * status is visibly an API value, while a wrong label is a lie.
 */
const STATUS_LOCALE_KEYS: Record<string, string> = {
  // PersistentVolumeClaim / volume phases.
  Bound: 'storage.status.bound',
  Pending: 'storage.status.pending',
  Lost: 'storage.status.lost',
  Ready: 'storage.status.ready',
  Resizing: 'storage.status.resizing',
  FileSystemResizePending: 'storage.status.resizePending',
  // PersistentVolume phases without a claim equivalent.
  Available: 'phase.available',
  Released: 'phase.released',
  // Pod / Job phases.
  Running: 'phase.running',
  Succeeded: 'phase.succeeded',
  Failed: 'phase.failed',
  Unknown: 'phase.unknown',
  /*
   * The pod list's four states arrive lowercased from the client (`running`, `waiting`,
   * `completed`, `error`) while the API spells phases capitalized. Both spellings map to the
   * same labels, so the cluster pods list cannot read "running" while the project page reads
   * 「运行中」 (guide pitfall 52).
   */
  running: 'workloads.status.running',
  waiting: 'workloads.filter.status.waiting',
  completed: 'workloads.filter.status.completed',
  error: 'workloads.filter.status.error',
  /*
   * The rest of the workload vocabulary (`WORKLOAD_STATUS` in the api-client): a deployment that
   * is stopped or rolling out must not print the raw enum on the cluster list while the project
   * list prints 「已停止」/「更新中」 — found by the breakpoint/theme sweep, 2026-11-19.
   */
  updating: 'workloads.status.updating',
  stopped: 'workloads.status.stopped',
  terminating: 'workloads.status.terminating',
};

/** The translated label for an API status value, or the value itself. */
export function statusLabel(t: (key: never) => string, status: string): string {
  const key = STATUS_LOCALE_KEYS[status]
    ?? STATUS_LOCALE_KEYS[status.charAt(0).toUpperCase() + status.slice(1)]
    ?? STATUS_LOCALE_KEYS[status.toLowerCase()];
  return key ? t(key as never) : status;
}

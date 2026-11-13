/**
 * The cluster a reader was last in.
 *
 * The old console stores this in `localStorage[`${username}-cluster`]` and uses it when a
 * cluster-scoped URL has to be built without one (the header's 集群管理 entry, for
 * example). Keying on the user matters: this is a shared browser more often than not, and
 * one administrator's last cluster is not another's.
 *
 * A missing or unreadable value is not an error — it just means "no preference yet", and
 * the caller falls back to whatever the route says.
 */
const PREFIX = 'kube-frontend:last-cluster';

export function lastClusterKey(username: string): string {
  return `${PREFIX}:${username || 'anonymous'}`;
}

export function readLastCluster(username: string): string {
  try {
    return window.localStorage.getItem(lastClusterKey(username)) ?? '';
  } catch {
    // Private mode / storage disabled: the preference simply does not survive.
    return '';
  }
}

export function rememberLastCluster(username: string, cluster: string): void {
  try {
    window.localStorage.setItem(lastClusterKey(username), cluster);
  } catch {
    // Ignored for the same reason.
  }
}

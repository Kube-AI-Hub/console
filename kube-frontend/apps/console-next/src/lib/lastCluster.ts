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
/** Alias the switcher showed for that cluster, so a reload keeps the same label. */
const ALIAS_PREFIX = 'kube-frontend:cluster-alias';

export function lastClusterKey(username: string): string {
  return `${PREFIX}:${username || 'anonymous'}`;
}

function aliasKey(username: string, cluster: string): string {
  return `${ALIAS_PREFIX}:${username || 'anonymous'}:${cluster}`;
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

/**
 * The alias the switcher last showed for a cluster.
 *
 * The switcher's own label is the alias when the cluster has one, and the cluster list is
 * fetched when the dialog opens — a page reload would otherwise show the raw object name
 * until the reader opened the switcher. The alias is a display fact about a cluster, so it
 * is remembered next to the cluster it belongs to rather than re-read on every page load.
 */
export function readClusterAlias(username: string, cluster: string): string {
  try {
    return window.localStorage.getItem(aliasKey(username, cluster)) ?? '';
  } catch {
    return '';
  }
}

export function rememberClusterAlias(username: string, cluster: string, alias: string): void {
  try {
    if (alias) window.localStorage.setItem(aliasKey(username, cluster), alias);
    else window.localStorage.removeItem(aliasKey(username, cluster));
  } catch {
    // Ignored for the same reason.
  }
}

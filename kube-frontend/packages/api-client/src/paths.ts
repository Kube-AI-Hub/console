/**
 * Where a member-cluster segment goes in a ks-apiserver path.
 *
 * Measured on the A100 deployment (two clusters: `host` and `xc`):
 *
 *   /apis/clusters/xc/apps/v1/namespaces/default/deployments     200
 *   /apis/apps/v1/clusters/xc/namespaces/default/deployments     404
 *   /kapis/clusters/xc/resources.kubesphere.io/v1alpha3/nodes    200
 *   /kapis/resources.kubesphere.io/v1alpha3/clusters/xc/nodes    404
 *
 * So the segment belongs **immediately after the API root** (`/kapis`, `/apis`), before the
 * group -- not after the group/version, which is where this app originally put it. A single-
 * cluster install never showed it: every read went to the host cluster, where the segment is
 * omitted entirely. On a deployment with a member cluster, every cluster-scoped read of that
 * member answered 404.
 *
 * `prefix` is the whole API prefix as the app builds it today (`/kapis/<group>/<version>`,
 * `/apis/<group>/<version>`, or `/api/v1`). The host cluster keeps its original path: `host` is
 * the cluster the apiserver already runs in, and `clusters/host/...` is not the same request.
 *
 * `/api/v1` (the core group) has no cluster-scoped form on this deployment -- `/api/v1/clusters/
 * xc/nodes` answers 404 -- so core resources of a member cluster have to go through the kapis
 * resources proxy instead. That is a separate fix; this helper leaves `/api/v1` untouched rather
 * than inventing a path that does not exist.
 */
export function clusterScoped(prefix: string, cluster: string | undefined, rest: string): string {
  if (!cluster || cluster === 'host') return `${prefix}/${rest}`;
  const match = /^(\/(?:kapis|apis))\/(.*)$/.exec(prefix);
  if (!match) return `${prefix}/${rest}`;
  return `${match[1]}/clusters/${encodeURIComponent(cluster)}/${match[2]}/${rest}`;
}

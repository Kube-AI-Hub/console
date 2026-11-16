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

/**
 * A core-group (`/api/v1/...`) read, routed to the right cluster.
 *
 * The core group has no member-cluster form: `/api/v1/clusters/xc/nodes` answers 404. The generic
 * kapis resources proxy does accept the same shape with a cluster segment, and answers 200 for
 * core resources of a member cluster (measured:
 * `/kapis/clusters/xc/resources.kubesphere.io/v1alpha3/namespaces/default/secrets`). So a member
 * read is rewritten onto that proxy rather than left to fail.
 *
 * `rest` is the part after `/api/v1/`, e.g. `namespaces/default/secrets` or `nodes`.
 */
export function corePath(cluster: string | undefined, rest: string): string {
  if (!cluster || cluster === 'host') return `/api/v1/${rest}`;
  return clusterScoped('/kapis/resources.kubesphere.io/v1alpha3', cluster, rest);
}

/**
 * A core-group (`/api/v1/...`) **write**, which only the host cluster supports.
 *
 * Measured on A100: `POST /kapis/.../configmaps` → 405, `POST /api/v1/.../configmaps` → 201. So writes
 * have to use the core group, and the core group has no member-cluster form. Before this guard the
 * console silently wrote to the **host** cluster while the reader was looking at a member: two
 * ConfigMaps created from `xc`'s page appeared on `host`.
 *
 * Refusing is the only honest option: writing to a cluster the reader did not choose is worse than
 * saying the operation is unavailable here.
 */
export function coreWritePath(cluster: string | undefined, rest: string): string {
  if (cluster && cluster !== 'host') {
    throw new Error('该资源暂不支持在成员集群上从控制台写入：ks-apiserver 的 core 组没有成员集群形态，写入会落到主集群。');
  }
  return `/api/v1/${rest}`;
}

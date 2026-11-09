/**
 * Upstream configuration.
 *
 * Read from the environment so the same build runs against any cluster. The
 * token is not read from disk or hardcoded: the browser sends it, and this
 * process only forwards it, so the BFF holds no long-lived credential.
 */
export interface UpstreamConfig {
  /** ks-apiserver origin, e.g. https://agentplatform.phanthy.com */
  baseUrl: string;
  /** Segment inserted by kapis: `/kapis/resources.kubesphere.io/v1alpha3`. */
  apiPrefix: string;
  /** Skip TLS verification for self-signed cluster certificates. */
  insecure?: boolean;
  /** Where `/api/ai/manifest` reads its page list from, when set. */
  manifestPath?: string;
  /**
   * `kapis` (default) or `kube`.
   *
   * `kube` exists for the development harness only: it lets the app be driven
   * end to end against `kubectl proxy` when no KubeSphere JWT is available. The
   * product contract is kapis; anything shipped sets or leaves this at `kapis`.
   */
  mode?: 'kapis' | 'kube';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): UpstreamConfig {
  const baseUrl = env['KS_API_URL'] ?? 'http://127.0.0.1:30880';
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiPrefix: env['KS_API_PREFIX'] ?? '/kapis/resources.kubesphere.io/v1alpha3',
    insecure: env['KS_API_INSECURE'] === '1',
    mode: env['KS_API_MODE'] === 'kube' ? 'kube' : 'kapis',
    ...(env['AI_MANIFEST_PATH'] === undefined ? {} : { manifestPath: env['AI_MANIFEST_PATH'] }),
  };
}

/** Path a resource lives at, per ks-apiserver's multi-cluster convention. */
export function resourcePath(config: UpstreamConfig, cluster: string, namespace: string, resource: string): string {
  // `clusters/<id>` is how kapis addresses a member cluster; the default host
  // cluster has no prefix. Console shows the cluster in the URL, so the BFF
  // takes it as a parameter rather than inferring it.
  const clusterSegment = cluster === 'host' ? '' : `clusters/${encodeURIComponent(cluster)}/`;
  return `${config.apiPrefix}/${clusterSegment}namespaces/${encodeURIComponent(namespace)}/${resource}`;
}

/**
 * Same resource, addressed through kube-apiserver instead of kapis.
 *
 * Used by the development harness to prove the app renders real objects when a
 * KubeSphere JWT is not available: `kubectl proxy` speaks plain kube API with the
 * operator's own credentials. It is not a product path — kapis is the contract —
 * and the response shape is close enough that the mapping code is exercised.
 */
export function kubeResourcePath(cluster: string, namespace: string, resource: string): string {
  const clusterSegment = cluster === 'host' ? '' : `clusters/${encodeURIComponent(cluster)}/`;
  return `/api/v1/${clusterSegment}namespaces/${encodeURIComponent(namespace)}/${resource}`;
}

import type { Client } from './client';
import { ApiError } from './errors';
import { clusterScoped } from './paths';

/**
 * Authorization questions answered by ks-apiserver.
 *
 * The console needs one kind of look-before-you-leap answer: may this reader create a
 * Service or an Ingress in this project? Rendering a create button that can only fail
 * with a 403 makes the reader fill a form to learn they were never allowed; asking
 * the authorization API first lets the page disable the entry and say why.
 *
 * Why not kube-apiserver's SelfSubjectAccessReview directly: on this deployment the
 * /apis proxy evaluates the request as ks-apiserver's service account (cluster-admin),
 * so every answer is "allowed". ks-apiserver exposes /kapis/iam.../selfsubjectaccessreviews,
 * which runs the same Authorizer with the request user. Older ks-apiserver builds lack
 * that route; the client falls back to the kube API so an upgrade is not required in lockstep.
 */
export interface AccessQuery {
  /** Which cluster the question is about; a member cluster is answered by that cluster, not the host. */
  cluster?: string;
  verb: 'create' | 'update' | 'delete' | 'get' | 'list';
  /** Plural resource name, e.g. `services`. */
  resource: string;
  /** API group; omitted for the core group. */
  group?: string;
  namespace?: string;
  /** Object name for verbs that act on one object. */
  name?: string;
}

interface KubeReview {
  status?: { allowed?: boolean; reason?: string };
}

interface KsReview {
  allowed?: boolean;
  reason?: string;
}

export function accessReviewApi(client: Client) {
  return {
    /**
     * Whether the current identity may perform `verb` on `resource`.
     *
     * The review is a `POST` because the question is the request body. A malformed
     * or missing answer is treated as `false`; callers that need to fail open decide
     * that themselves — this function only reports what the server said.
     */
    async allowed(params: AccessQuery & { signal?: AbortSignal }): Promise<boolean> {
      const path =
        params.cluster && params.cluster !== 'host'
          ? '/kapis/clusters/' + encodeURIComponent(params.cluster) + '/iam.kubesphere.io/v1alpha2/selfsubjectaccessreviews'
          : '/kapis/iam.kubesphere.io/v1alpha2/selfsubjectaccessreviews';
      try {
        const review = await client.request<KsReview>(path, {
          method: 'POST',
          body: {
            verb: params.verb,
            resource: params.resource,
            ...(params.group ? { group: params.group } : {}),
            ...(params.namespace ? { namespace: params.namespace } : {}),
            ...(params.name ? { name: params.name } : {}),
          },
          ...(params.signal ? { signal: params.signal } : {}),
        });
        return review?.allowed === true;
      } catch (error) {
        // go-restful reports an unknown webservice route as 500 "no matches for ...",
        // not 404; treat both (and explicit 404/405) as "old backend, use the fallback".
        const routeMissing =
          error instanceof ApiError &&
          (error.status === 404 || error.status === 405 || (error.status === 500 && /no matches for iam\.kubesphere\.io/.test(error.message)));
        if (!routeMissing) throw error;
      }
      // Older ks-apiserver: no IAM review route. Keep the previous transport so the
      // console does not hard-fail before the backend is upgraded.
      const review = await client.request<KubeReview>(
        clusterScoped('/apis/authorization.k8s.io/v1', params.cluster, 'selfsubjectaccessreviews'),
        {
          method: 'POST',
          body: {
            apiVersion: 'authorization.k8s.io/v1',
            kind: 'SelfSubjectAccessReview',
            spec: {
              resourceAttributes: {
                verb: params.verb,
                resource: params.resource,
                ...(params.group ? { group: params.group } : {}),
                ...(params.namespace ? { namespace: params.namespace } : {}),
                ...(params.name ? { name: params.name } : {}),
              },
            },
          },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      return review?.status?.allowed === true;
    },
  };
}

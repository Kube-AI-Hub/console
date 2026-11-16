import type { Client } from './client';

/**
 * Authorization questions answered by the cluster itself.
 *
 * The console needs one kind of look-before-you-leap answer: may this reader create a
 * Service or an Ingress in this project? Rendering a create button that can only fail
 * with a 403 makes the reader fill a form to learn they were never allowed; asking
 * the authorization API first lets the page disable the entry and say why.
 *
 * There is no client-side permission model to consult instead: the platform's role
 * bindings are the source of truth, and `SelfSubjectAccessReview` evaluates them with
 * the same request the write will use.
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

export function accessReviewApi(client: Client) {
  return {
    /**
     * Whether the current identity may perform `verb` on `resource`.
     *
     * The review is a `POST` because `SelfSubjectAccessReview` is a create-only
     * resource: the request is the question, and `status.allowed` is the answer.
     * A malformed or missing `status` is treated as `false`; callers that need to
     * fail open (a broken permission check must not block a permitted write) decide
     * that themselves — this function only reports what the cluster said.
     */
    async allowed(params: AccessQuery & { signal?: AbortSignal }): Promise<boolean> {
      const review = await client.request<{ status?: { allowed?: boolean; reason?: string } }>(
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
import { clusterScoped } from './paths';

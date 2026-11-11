import type { Client } from './client';
import { baseOf, metadataAnnotations, resourceApi, type KubeObject, type ResourceBase } from './resources';

/**
 * ServiceAccount resources.
 *
 * The resource itself is a plain namespaced collection (old console:
 * `stores/serviceAccount.js`, which only sets `module = 'serviceaccounts'`).
 * What makes the page more than a table is the project role: KubeSphere keeps it
 * in the `iam.kubesphere.io/role` annotation, and the choices come from the
 * `iam.kubesphere.io` role list of the same namespace
 * (`components/Inputs/RoleSelect` → `RoleStore.fetchList`).
 */

/** Annotation KubeSphere reads the project role from. */
export const ROLE_ANNOTATION = 'iam.kubesphere.io/role';

export interface ServiceAccountSummary extends ResourceBase {
  /** The project role from `iam.kubesphere.io/role`, or `''` when none was assigned. */
  role: string;
  /** Names of the token Secrets the account mounts (`secret` in the old list). */
  secrets: string[];
}

export interface ServiceAccountDetail extends ServiceAccountSummary {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  /** Resolved service-account secrets as the API reports them (name, namespace). */
  secretRefs: Array<{ name: string; namespace?: string }>;
  raw: KubeServiceAccount;
}

export interface KubeServiceAccount extends KubeObject {
  secrets?: Array<{ name: string; namespace?: string }>;
  imagePullSecrets?: Array<{ name: string }>;
  automountServiceAccountToken?: boolean;
}

export function toServiceAccountSummary(item: KubeServiceAccount): ServiceAccountSummary {
  const annotations = item.metadata?.annotations ?? {};
  return {
    ...baseOf(item),
    role: annotations[ROLE_ANNOTATION] ?? '',
    // Only the token secrets the controller bound; `imagePullSecrets` is a
    // different relationship and the old list does not show it.
    secrets: (item.secrets ?? []).map((ref) => ref.name),
  };
}

export function toServiceAccountDetail(item: KubeServiceAccount): ServiceAccountDetail {
  const summary = toServiceAccountSummary(item);
  return {
    ...summary,
    labels: item.metadata?.labels ?? {},
    annotations: item.metadata?.annotations ?? {},
    secretRefs: item.secrets ?? [],
    raw: item,
  };
}

export interface ServiceAccountInput {
  name: string;
  namespace: string;
  alias?: string;
  description?: string;
  /** Project role; omitted when the reader picks none. */
  role?: string;
}

/** Build the object to POST; matches `FORM_TEMPLATES.serviceaccounts`. */
export function toKubeServiceAccount(input: ServiceAccountInput): KubeServiceAccount {
  const annotations = metadataAnnotations(input);
  if (input.role?.trim()) annotations[ROLE_ANNOTATION] = input.role.trim();
  return {
    apiVersion: 'v1',
    kind: 'ServiceAccount',
    metadata: {
      name: input.name,
      namespace: input.namespace,
      ...(Object.keys(annotations).length ? { annotations } : {}),
    },
  };
}

/** One project role the role picker offers. */
export interface ProjectRole {
  name: string;
  /** i18n key the old console translated (`role.description`), e.g. `PROJECT_VIEWER_DESC`. */
  descriptionKey: string;
}

interface KubeRole extends KubeObject {
  /** KubeSphere role templates carry their copy here. */
  description?: string;
}

/** Label that marks a KubeSphere role *template*, which nobody assigns directly. */
export const ROLE_TEMPLATE_LABEL = 'iam.kubesphere.io/role-template';

/**
 * Query parameters the role list needs.
 *
 * `annotation=kubesphere.io/creator` is what the old `RoleStore.fetchList` sends
 * (`console/src/stores/role.js:94`), and it is load-bearing: without it the
 * endpoint returns KubeSphere's `role-template-*` aggregate templates too —
 * 27 roles for a three-role project — none of which a person should assign. The
 * label check below then drops any template that slipped through (custom roles
 * carry no creator annotation).
 */
export function serviceAccountsApi(client: Client) {
  const api = resourceApi<KubeServiceAccount, ServiceAccountSummary, ServiceAccountDetail>(client, {
    resource: 'serviceaccounts',
    toSummary: toServiceAccountSummary,
    toDetail: toServiceAccountDetail,
  });

  return {
    ...api,

    /**
     * Project roles available to assign.
     *
     * Read from kapis `iam.kubesphere.io/v1alpha2` — the same endpoint the old
     * role picker uses — not from RBAC `Role` objects: KubeSphere's roles carry
     * display metadata only in this envelope.
     */
    async roles(params: { cluster: string; namespace: string; signal?: AbortSignal }): Promise<ProjectRole[]> {
      const clusterSegment = params.cluster && params.cluster !== 'host' ? `clusters/${encodeURIComponent(params.cluster)}/` : '';
      const body = await client.request<{ items?: KubeRole[] }>(
        `/kapis/iam.kubesphere.io/v1alpha2/${clusterSegment}namespaces/${encodeURIComponent(params.namespace)}/roles`,
        {
          query: { limit: -1, sortBy: 'createTime', annotation: 'kubesphere.io/creator' },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      return (body.items ?? [])
        .filter((role) => role.metadata?.name)
        // A role template is a building block, never an assignable project role.
        .filter((role) => !(role.metadata?.labels ?? {})[ROLE_TEMPLATE_LABEL])
        .map((role) => ({
          name: role.metadata?.name ?? '',
          descriptionKey: role.description ?? '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    /**
     * Assign or clear the project role.
     *
     * A merge patch with an empty string rather than `null`: the old console's
     * role picker always submits the annotation (clearing it resets the field to
     * `''` in `handleChange`), and KubeSphere treats an empty value as "no
     * role" while removing the key would also work but makes the diff bigger.
     */
    async setRole(params: { cluster: string; namespace: string; name: string; role: string }): Promise<void> {
      await api.patch({
        cluster: params.cluster,
        namespace: params.namespace,
        name: params.name,
        body: { metadata: { annotations: { [ROLE_ANNOTATION]: params.role } } },
      });
    },
  };
}

export type ServiceAccountsApi = ReturnType<typeof serviceAccountsApi>;

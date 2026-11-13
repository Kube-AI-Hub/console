import type { Client } from './client';
import { baseOf, resourceApi, type KubeObject, type ResourceBase } from './resources';
import { collectionPath } from './resources';

/**
 * Project access: roles and members.
 *
 * These live under the IAM kapis group (`iam.kubesphere.io/v1alpha2`), not the
 * generic resources proxy — the same reason alerting needed its own prefix.
 *
 * A member is a user reference projected into the namespace, so its "role" is an
 * annotation rather than a field, and a role's "description" is also an annotation.
 * Both are read here once so the page and the tests agree on where they come from.
 */

export type IamKind = 'roles' | 'members';

/** IAM group prefix. */
export const KAPIS_IAM = '/kapis/iam.kubesphere.io/v1alpha2';
/** Native RBAC group: the only path that keeps a role's `rules` on create. */
const KAPIS_RBAC = '/apis/rbac.authorization.k8s.io/v1';

interface KubeIam extends KubeObject {
  rules?: Array<Record<string, unknown>>;
}

export interface RoleSummary extends ResourceBase {
  kind: 'roles';
  /** Number of policy rules the role grants. */
  ruleCount: number;
  /**
   * Whether the platform manages the role.
   *
   * Templated roles (`role-template-*`) are building blocks of the platform, not
   * something a project admin assigns; the old console hides their edit/delete
   * actions for the same reason.
   */
  system: boolean;
  /** Annotations: 编辑信息 edits them in place. */
  annotations: Record<string, string>;
}

export interface RoleRule {
  /** API groups the rule covers, joined for display (`*` stays `*`). */
  apiGroups: string;
  /** Resources, joined. */
  resources: string;
  /** Verbs, joined. */
  verbs: string;
}

export interface RoleDetail extends RoleSummary {
  rules: RoleRule[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  raw: KubeIam;
}

export interface MemberSummary extends ResourceBase {
  kind: 'members';
  /** Username, which is also the object name. */
  username: string;
  /** Project role from `iam.kubesphere.io/role`. */
  role: string;
  /** Whether the projected user is still active (`status.state === 'Active'`). */
  active: boolean;
  /** `iam.kubesphere.io/last-password-change-time`, the closest thing to a login. */
  lastActive: string;
}

export interface MemberDetail extends MemberSummary {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  raw: KubeIam;
}

/** `role-template-*` roles are platform building blocks, not assignable roles. */
export function isTemplateRole(name: string): boolean {
  return name.startsWith('role-template-');
}

function join(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(', ');
  return value === undefined || value === null ? '' : String(value);
}

export function toRoleRule(rule: Record<string, unknown>): RoleRule {
  return {
    apiGroups: join(rule['apiGroups']) || '',
    resources: join(rule['resources']) || '',
    verbs: join(rule['verbs']) || '',
  };
}

export function toRoleSummary(item: KubeIam): RoleSummary {
  const rules = (item.rules ?? []) as unknown[];
  return {
    ...baseOf(item),
    kind: 'roles',
    ruleCount: rules.length,
    system: isTemplateRole(item.metadata?.name ?? ''),
    annotations: item.metadata?.annotations ?? {},
  };
}

export function toRoleDetail(item: KubeIam): RoleDetail {
  return {
    ...toRoleSummary(item),
    rules: ((item.rules ?? []) as Array<Record<string, unknown>>).map(toRoleRule),
    labels: item.metadata?.labels ?? {},
    annotations: item.metadata?.annotations ?? {},
    raw: item,
  };
}

export function toMemberSummary(item: KubeIam): MemberSummary {
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  const status = (item.status ?? {}) as Record<string, unknown>;
  return {
    ...baseOf(item),
    kind: 'members',
    username: item.metadata?.name ?? '',
    role: annotations['iam.kubesphere.io/role'] ?? '',
    active: status['state'] === undefined ? true : String(status['state']) === 'Active',
    lastActive: annotations['iam.kubesphere.io/last-password-change-time'] ?? '',
  };
}

export function toMemberDetail(item: KubeIam): MemberDetail {
  return {
    ...toMemberSummary(item),
    labels: item.metadata?.labels ?? {},
    annotations: item.metadata?.annotations ?? {},
    raw: item,
  };
}

export function rolesApi(client: Client) {
  const api = resourceApi<KubeIam, RoleSummary, RoleDetail>(client, {
    resource: 'roles',
    kapisPrefix: KAPIS_IAM,
    toSummary: toRoleSummary,
    toDetail: toRoleDetail,
  });
  return {
    ...api,
    kind: 'roles' as const,
    /**
     * Role writes go to the **IAM** aggregate, not to `rbac.authorization.k8s.io`.
     *
     * KubeSphere's roles are `rbac.authorization.k8s.io/v1` objects served through
     * its IAM API; the console only ever has permission on that path, and the
     * platform adds its own filtering (templated roles are rejected upstream). The
     * generic `resourceApi` writes to `/apis/<group>` derived from a static table,
     * which does not contain `roles`, so writes are routed here explicitly.
     */
    patchRole(params: { cluster: string; namespace: string; name: string; body: unknown }): Promise<RoleDetail> {
      return client
        .request<KubeIam>(
          `${iamPath(params.cluster, params.namespace, 'roles')}/${encodeURIComponent(params.name)}`,
          { method: 'PATCH', contentType: 'application/merge-patch+json', body: params.body },
        )
        .then(toRoleDetail);
    },
    removeRole(params: { cluster: string; namespace: string; name: string }): Promise<void> {
      return client
        .request<void>(`${iamPath(params.cluster, params.namespace, 'roles')}/${encodeURIComponent(params.name)}`, {
          method: 'DELETE',
        })
        .then(() => undefined);
    },
  };
}

/** IAM collection URL for one resource. */
export function iamPath(cluster: string, namespace: string, resource: string): string {
  const clusterSegment = cluster && cluster !== 'host' ? `clusters/${encodeURIComponent(cluster)}/` : '';
  const namespaceSegment = namespace ? `namespaces/${encodeURIComponent(namespace)}/` : '';
  return `${KAPIS_IAM}/${clusterSegment}${namespaceSegment}${resource}`;
}

/**
 * Invite, re-role and remove project members.
 *
 * The API shapes were probed on the live cluster and are not the usual kube ones:
 *  - POST takes a **JSON array** of members (`[{username, roleRef}]`) — sending one object
 *    answers `cannot unmarshal object into Go value of type []v1alpha2.Member`;
 *  - PUT /members/<username> sets a member's role;
 *  - DELETE /members/<username> removes it.
 *
 * The write lives here rather than in a generic resource API because all three verbs differ
 * from those of the collection's siblings.
 */
export function membersWriteApi(client: Client) {
  const collection = (cluster: string, namespace: string) => iamPath(cluster, namespace, 'members');
  return {
    /** One entry per invited user; a single invite is an array of one. */
    async invite(params: { cluster: string; namespace: string; username: string; roleRef: string }): Promise<void> {
      await client.request(collection(params.cluster, params.namespace), {
        method: 'POST',
        body: [{ username: params.username, roleRef: params.roleRef }],
      });
    },

    async updateRole(params: { cluster: string; namespace: string; username: string; roleRef: string }): Promise<void> {
      await client.request(`${collection(params.cluster, params.namespace)}/${encodeURIComponent(params.username)}`, {
        method: 'PUT',
        body: { username: params.username, roleRef: params.roleRef },
      });
    },

    async remove(params: { cluster: string; namespace: string; username: string }): Promise<void> {
      await client.request(`${collection(params.cluster, params.namespace)}/${encodeURIComponent(params.username)}`, {
        method: 'DELETE',
      });
    },
  };
}

/**
 * One cluster member: an account bound to a cluster role.
 *
 * KubeSphere exposes cluster members through the IAM aggregate (the same shape as project
 * members, one scope up): role from `iam.kubesphere.io/clusterrole`, state from
 * `status.state`, last sign-in from `status.lastLoginTime`.
 */
export interface ClusterMemberSummary extends ResourceBase {
  username: string;
  /** `cluster-admin` / `cluster-regular` / a custom cluster role. */
  role: string;
  /** `Active` / `Disabled` — a member with no reported state has never been disabled. */
  status: string;
  lastLogin: string;
}

export function clusterMembersApi(client: Client) {
  return {
    async list(params: { cluster: string; signal?: AbortSignal }): Promise<{ items: ClusterMemberSummary[] }> {
      const body = await client.request<{ items?: KubeIam[] }>(`${KAPIS_IAM}/clustermembers`, {
        query: { limit: -1 },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      const items = (body?.items ?? []).map((item) => {
        const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
        const status = (item.status ?? {}) as Record<string, unknown>;
        return {
          ...baseOf(item),
          username: item.metadata?.name ?? '',
          role: annotations['iam.kubesphere.io/clusterrole'] ?? '',
          status: status['state'] === undefined ? 'Active' : String(status['state']),
          lastLogin: String(status['lastLoginTime'] ?? annotations['iam.kubesphere.io/last-login-time'] ?? ''),
        };
      });
      return { items };
    },
  };
}

export function membersApi(client: Client) {
  return {
    ...resourceApi<KubeIam, MemberSummary, MemberDetail>(client, {
      resource: 'members',
      kapisPrefix: KAPIS_IAM,
      toSummary: toMemberSummary,
      toDetail: toMemberDetail,
    }),
    kind: 'members' as const,
  };
}

/** Project (namespace) basic information, as the 基本信息 page shows it. */
export interface ProjectInfo extends ResourceBase {
  /** The workspace this project belongs to (`kubesphere.io/workspace`). */
  workspace: string;
  /** `Active` / `Terminating`. */
  status: string;
  /** Hard limits from the project's ResourceQuota, when one exists. */
  quota: Array<{ resource: string; hard: string; used: string }>;
  /** Name of the quota object, so the edit dialog updates it instead of adding one. */
  quotaName: string;
  /** `spec.hard` as stored, keyed by resource. */
  quotaHard: Record<string, string>;
}

/**
 * `kubesphere.io/workspace` also carries the project name on some objects
 * (`kubesphere.io/namespace`), so do not mistake the annotation for the workspace.
 */
export function toProjectInfo(item: KubeIam, quotas: KubeIam[] = []): ProjectInfo {
  const labels = (item.metadata?.labels ?? {}) as Record<string, string>;
  const base = baseOf(item);
  const quota = quotas.flatMap((quotaItem) => {
    const spec = (quotaItem as unknown as { spec?: { hard?: Record<string, string> } }).spec?.hard ?? {};
    const status = (quotaItem as unknown as { status?: { hard?: Record<string, string>; used?: Record<string, string> } }).status ?? {};
    return Object.keys(spec).map((resource) => ({
      resource,
      hard: String(status.hard?.[resource] ?? spec[resource] ?? ''),
      used: String(status.used?.[resource] ?? '0'),
    }));
  });
  return {
    ...base,
    workspace: labels['kubesphere.io/workspace'] ?? '',
    status: String((item.status as Record<string, unknown> | undefined)?.['phase'] ?? ''),
    quota,
    quotaName: quotas[0]?.metadata?.name ?? '',
    quotaHard: ((quotas[0] as unknown as { spec?: { hard?: Record<string, string> } })?.spec?.hard) ?? {},
  };
}

/**
 * The quota resources the console offers for editing.
 *
 * A short, fixed list rather than "whatever the cluster supports": these are the
 * ones a project administrator reasons about, and they map to ResourceQuota keys the
 * apiserver accepts. `count/pods` etc. are separate keys, not an alias for `pods`.
 */
export const QUOTA_RESOURCES = [
  'requests.cpu',
  'requests.memory',
  'limits.cpu',
  'limits.memory',
  'pods',
  'count/deployments.apps',
  'count/services',
  'count/persistentvolumeclaims',
  'persistentvolumeclaims',
  'requests.storage',
] as const;

export type QuotaResource = (typeof QUOTA_RESOURCES)[number];

/** One resource quota object for a project. */
export interface ProjectQuota {
  name: string;
  /** `spec.hard` as typed by an administrator. */
  hard: Record<string, string>;
}

interface KubeQuota extends KubeObject {
  spec?: { hard?: Record<string, string> };
  status?: { hard?: Record<string, string>; used?: Record<string, string> };
}

/**
 * Apply a quota to a project.
 *
 * A ResourceQuota is a core object, so it is written through `/api/v1`. The object
 * name is fixed (`<project>-quota` is what the platform uses, but any existing one
 * is reused) — creating a second quota in the same namespace would leave two
 * competing limits and Kubernetes would enforce the intersection.
 *
 * Empty values are **removed** from the spec rather than stored as "": an empty
 * quantity is rejected, and a missing key is how Kubernetes expresses "unlimited".
 */
export function projectQuotaApi(client: Client) {
  return {
    async remove(params: { namespace: string; name: string }): Promise<void> {
      await client.request<void>(`/api/v1/namespaces/${encodeURIComponent(params.namespace)}/resourcequotas/${encodeURIComponent(params.name)}`, {
        method: 'DELETE',
      });
    },

    async apply(params: { namespace: string; name: string; resource: string; hard: Record<string, string> }): Promise<ProjectQuota> {
      const existing = await client
        .request<KubeQuota>(`/api/v1/namespaces/${encodeURIComponent(params.namespace)}/resourcequotas/${encodeURIComponent(params.name)}`)
        .catch(() => undefined);

      const clean: Record<string, string> = {};
      for (const [key, value] of Object.entries(params.hard)) {
        const trimmed = String(value ?? '').trim();
        if (trimmed) clean[key] = trimmed;
      }

      if (!existing) {
        const created = await client.request<KubeQuota>(`/api/v1/namespaces/${encodeURIComponent(params.namespace)}/resourcequotas`, {
          method: 'POST',
          body: {
            apiVersion: 'v1',
            kind: 'ResourceQuota',
            metadata: { name: params.name, namespace: params.namespace },
            spec: { hard: clean },
          },
        });
        return { name: created?.metadata?.name ?? params.name, hard: clean };
      }

      await client.request<KubeQuota>(
        `/api/v1/namespaces/${encodeURIComponent(params.namespace)}/resourcequotas/${encodeURIComponent(params.name)}`,
        {
          method: 'PATCH',
          contentType: 'application/merge-patch+json',
          body: { spec: { hard: clean } },
        },
      );
      return { name: params.name, hard: clean };
    },

    /** The project's quota objects; the page edits the first one. */
    async list(params: { namespace: string }): Promise<ProjectQuota[]> {
      const body = await client
        .request<{ items?: KubeQuota[] }>(`/api/v1/namespaces/${encodeURIComponent(params.namespace)}/resourcequotas`)
        .catch(() => undefined);
      return (body?.items ?? []).map((item) => ({
        name: item.metadata?.name ?? '',
        hard: item.spec?.hard ?? {},
      }));
    },
  };
}

/**
 * Project network isolation.
 *
 * KubeSphere records the project-level switch as an annotation on the namespace
 * (`kubesphere.io/network-isolate`), not as an object of its own — so the switch and
 * the policy list are two different reads, and the page shows them together because
 * an administrator reasons about them together.
 */
export const NETWORK_ISOLATE_ANNOTATION = 'kubesphere.io/network-isolate';

/** One NetworkPolicy row. */
export interface NetworkPolicySummary extends ResourceBase {
  /** `Ingress` / `Egress` / both, as the object declares them. */
  policyTypes: string[];
  /** The pod selector, rendered as `k=v, k2=v2`. */
  podSelector: string;
  /** Number of ingress rules. */
  ingressRules: number;
  /** Number of egress rules. */
  egressRules: number;
}

interface KubePolicy extends KubeObject {
  spec?: Record<string, unknown>;
}

function selectorText(selector: unknown): string {
  const labels = ((selector as Record<string, unknown> | undefined)?.['matchLabels'] ?? {}) as Record<string, string>;
  const entries = Object.entries(labels);
  return entries.length === 0 ? '*' : entries.map(([key, value]) => `${key}=${value}`).join(', ');
}

export function toNetworkPolicySummary(item: KubePolicy): NetworkPolicySummary {
  const spec = (item.spec ?? {}) as Record<string, unknown>;
  const types = (spec['policyTypes'] ?? []) as string[];
  return {
    ...baseOf(item),
    policyTypes: types,
    podSelector: selectorText(spec['podSelector']),
    ingressRules: ((spec['ingress'] ?? []) as unknown[]).length,
    egressRules: ((spec['egress'] ?? []) as unknown[]).length,
  };
}

/** What a policy may allow or deny. */
export const POLICY_DIRECTIONS = ['Ingress', 'Egress'] as const;

export type PolicyDirection = (typeof POLICY_DIRECTIONS)[number];

/**
 * Create a NetworkPolicy.
 *
 * The editor offers one rule per direction: "allow traffic from pods matching label X"
 * (ingress) or "allow traffic to pods matching label X" (egress). That covers the
 * scenario administrators actually build here — isolate a project, then admit one
 * neighbour — and anything more elaborate is better written in YAML.
 *
 * An empty selector means "all pods", which Kubernetes spells `{}`; omitting it
 * entirely would select nothing and silently protect no one.
 */
export function networkPoliciesWriteApi(client: Client) {
  const path = (namespace: string, name?: string) =>
    `/apis/networking.k8s.io/v1/namespaces/${encodeURIComponent(namespace)}/networkpolicies${name ? `/${encodeURIComponent(name)}` : ''}`;
  return {
    async create(params: {
      namespace: string;
      name: string;
      podSelector: string;
      direction: PolicyDirection;
      peerSelector: string;
    }): Promise<NetworkPolicySummary> {
      const spec: Record<string, unknown> = {
        podSelector: toSelector(params.podSelector),
        policyTypes: [params.direction],
      };
      if (params.peerSelector.trim()) {
        /*
         * A peer is an **object wrapping** a selector, not the selector itself:
         * `from: [{ podSelector: { matchLabels: … } }]`. Sending
         * `from: [{ matchLabels: … }]` is rejected with
         * `spec.ingress[0].from[0]: Required value: must specify a peer` (422) —
         * verified against the live cluster.
         */
        const peer = { podSelector: toSelector(params.peerSelector) };
        if (params.direction === 'Ingress') spec['ingress'] = [{ from: [peer] }];
        else spec['egress'] = [{ to: [peer] }];
      }
      const item = await client.request<KubePolicy>(path(params.namespace), {
        method: 'POST',
        body: {
          apiVersion: 'networking.k8s.io/v1',
          kind: 'NetworkPolicy',
          metadata: { name: params.name, namespace: params.namespace },
          spec,
        },
      });
      return toNetworkPolicySummary(item ?? {});
    },

    async remove(params: { namespace: string; name: string }): Promise<void> {
      await client.request<void>(path(params.namespace, params.name), { method: 'DELETE' });
    },
  };
}

/** `k=v, k2=v2` → `{ matchLabels: { k: v, k2: v2 } }`; empty → `{}` (all pods). */
export function toSelector(text: string): Record<string, unknown> {
  const labels: Record<string, string> = {};
  for (const part of text.split(',')) {
    const [key, value] = part.split('=').map((piece) => piece.trim());
    if (key && value) labels[key] = value;
  }
  return Object.keys(labels).length > 0 ? { matchLabels: labels } : {};
}

export function networkPoliciesApi(client: Client) {
  return {
    ...resourceApi<KubePolicy, NetworkPolicySummary, NetworkPolicySummary>(client, {
      resource: 'networkpolicies',
      toSummary: toNetworkPolicySummary,
      toDetail: toNetworkPolicySummary,
    }),
    kind: 'networkpolicies' as const,
  };
}

/** Read and flip the project's isolation switch. */
export function networkIsolationApi(client: Client) {
  const nsPath = (namespace: string) => `/kapis/resources.kubesphere.io/v1alpha3/namespaces/${encodeURIComponent(namespace)}`;
  return {
    async get(params: { namespace: string; signal?: AbortSignal }): Promise<boolean> {
      const item = await client.request<KubeIam>(nsPath(params.namespace), params.signal ? { signal: params.signal } : {});
      return String(item?.metadata?.annotations?.[NETWORK_ISOLATE_ANNOTATION] ?? '') === 'true';
    },
    /**
     * Flip the switch.
     *
     * The namespace is a core object and is written with a merge patch on the one
     * annotation: a PUT would replace the whole namespace and could drop labels an
     * administrator set elsewhere.
     */
    async set(params: { namespace: string; enabled: boolean }): Promise<boolean> {
      await client.request<KubeIam>(`/api/v1/namespaces/${encodeURIComponent(params.namespace)}`, {
        method: 'PATCH',
        contentType: 'application/merge-patch+json',
        body: { metadata: { annotations: { [NETWORK_ISOLATE_ANNOTATION]: String(params.enabled) } } },
      });
      return params.enabled;
    },
  };
}

export function projectInfoApi(client: Client) {
  return {
    /** One project's namespace object plus its ResourceQuota, in one call each. */
    async get(params: { cluster: string; namespace: string; signal?: AbortSignal }): Promise<ProjectInfo> {
      const signal = params.signal ? { signal: params.signal } : {};
      /*
       * A project is a namespace. It is read from the resources proxy (the same place
       * the project list comes from), not from IAM: `namespaces` is a core resource
       * and the IAM group 404s on it.
       */
      const [item, quotaBody] = await Promise.all([
        client.request<KubeIam>(
          `/kapis/resources.kubesphere.io/v1alpha3/namespaces/${encodeURIComponent(params.namespace)}`,
          signal,
        ),
        /*
         * Quotas live in the core group and are frequently absent: a project with no
         * ResourceQuota is the normal case on this cluster, and the page renders an
         * explicit "no quota" section rather than failing the whole view.
         */
        client
          .request<{ items?: KubeIam[] }>(`/api/v1/namespaces/${encodeURIComponent(params.namespace)}/resourcequotas`, signal)
          .then((body) => body?.items ?? [])
          .catch(() => [] as KubeIam[]),
      ]);
      return toProjectInfo(item ?? {}, quotaBody);
    },
  };
}

export type RolesApi = ReturnType<typeof rolesApi>;
export type MembersApi = ReturnType<typeof membersApi>;

/**
 * Write a project role's permission rules.
 *
 * Project roles are namespaced Roles served by IAM; like their cluster-wide
 * counterparts the IAM layer drops `rules` on create, so the rules are written against
 * native RBAC. The project's own role objects live in the project namespace.
 */
/**
 * A LimitRange row: the defaults a project forces on pods that do not set their own.
 *
 * Read from the core API (`/api/v1`), which is where the object lives; the resources proxy
 * does not serve it.
 */
export interface LimitRangeSummary {
  name: string;
  /** One entry per `spec.limits[]` item: type plus the resources it constrains. */
  limits: Array<{ type: string; resource: string; min: string; max: string; defaultLimit: string; defaultRequest: string }>;
}

export function limitRangesApi(client: Client) {
  return {
    async list(params: { namespace: string; signal?: AbortSignal }): Promise<LimitRangeSummary[]> {
      const body = await client.request<{ items?: Array<Record<string, unknown>> }>(
        `/api/v1/namespaces/${encodeURIComponent(params.namespace)}/limitranges`,
        { ...(params.signal ? { signal: params.signal } : {}) },
      );
      return (body?.items ?? []).map((item) => {
        const metadata = (item['metadata'] ?? {}) as Record<string, unknown>;
        const spec = (item['spec'] ?? {}) as Record<string, unknown>;
        const limits = ((spec['limits'] ?? []) as Array<Record<string, unknown>>).flatMap((entry) => {
          const type = String(entry['type'] ?? '');
          const buckets: Array<[string, string]> = [
            ['min', 'min'],
            ['max', 'max'],
            ['default', 'defaultLimit'],
            ['defaultRequest', 'defaultRequest'],
          ];
          const out: Array<{ type: string; resource: string; min: string; max: string; defaultLimit: string; defaultRequest: string }> = [];
          const seen = new Set<string>();
          for (const [source] of buckets) {
            const values = (entry[source] ?? {}) as Record<string, unknown>;
            for (const resource of Object.keys(values)) seen.add(resource);
          }
          for (const resource of seen) {
            const pick = (source: string) => String((((entry[source] ?? {}) as Record<string, unknown>)[resource]) ?? '');
            out.push({ type, resource, min: pick('min'), max: pick('max'), defaultLimit: pick('default'), defaultRequest: pick('defaultRequest') });
          }
          return out;
        });
        return { name: String(metadata['name'] ?? ''), limits };
      });
    },
  };
}

export function projectRolesWriteApi(client: Client) {
  const path = (namespace: string, name: string) =>
    `/apis/rbac.authorization.k8s.io/v1/namespaces/${encodeURIComponent(namespace)}/roles/${encodeURIComponent(name)}`;
  return {
    /**
     * Create a project role, optionally from a template's rules.
     *
     * Written to the **native RBAC group**, because the IAM aggregate accepts the create
     * but drops `rules` on the floor: measured, a role POSTed through kapis comes back
     * with `rules: null` and `managedFields` showing `f:rules: {}`. The same object created
     * at /apis/rbac.authorization.k8s.io keeps the rules, and kapis reads it back fine —
     * so the write goes where it is honoured and the read keeps using kapis.
     */
    async createRole(params: {
      namespace: string;
      name: string;
      alias: string;
      description: string;
      rules: Array<{ apiGroups: string[]; resources: string[]; verbs: string[] }>;
    }): Promise<void> {
      const annotations: Record<string, string> = {};
      if (params.alias.trim()) annotations['kubesphere.io/alias-name'] = params.alias.trim();
      if (params.description.trim()) annotations['kubesphere.io/description'] = params.description.trim();
      await client.request(collectionPath('', params.namespace, 'roles', KAPIS_RBAC), {
        method: 'POST',
        body: {
          apiVersion: 'rbac.authorization.k8s.io/v1',
          kind: 'Role',
          metadata: {
            name: params.name.trim(),
            namespace: params.namespace,
            ...(Object.keys(annotations).length ? { annotations } : {}),
          },
          rules: params.rules,
        },
      });
    },

    /** Read a project role's rules in the shape the editor uses (one line per rule). */
    async rules(params: { namespace: string; name: string }): Promise<Array<{ apiGroups: string; resources: string; verbs: string }>> {
      const item = await client.request<KubeIam>(path(params.namespace, params.name));
      return ((item?.rules ?? []) as Array<Record<string, unknown>>).map(toRoleRule);
    },

    /**
     * Replace the rules.
     *
     * A Role's `rules` is an array, and a merge patch on an array replaces it, so the
     * whole list is sent. The object is read first for `resourceVersion`: a PUT with a
     * stale one is rejected with 409, which is the only guard against overwriting a
     * concurrent change.
     */
    async setRules(params: {
      namespace: string;
      name: string;
      rules: Array<{ apiGroups: string; resources: string; verbs: string }>;
    }): Promise<void> {
      const current = await client.request<KubeIam>(path(params.namespace, params.name));
      const rules = params.rules
        .filter((rule) => rule.verbs.trim() && rule.resources.trim())
        .map((rule) => ({
          // The core group is `['']`, never `[]` — the apiserver rejects an empty list.
          apiGroups: splitCsv(rule.apiGroups).length > 0 ? splitCsv(rule.apiGroups) : [''],
          resources: splitCsv(rule.resources),
          verbs: splitCsv(rule.verbs),
        }));
      await client.request<KubeIam>(path(params.namespace, params.name), {
        method: 'PUT',
        body: { ...current, rules },
      });
    },
  };
}

/** `a, b` → `['a', 'b']`; blank stays an empty list. */
function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Project log collection.
 *
 * KubeSphere stores this as a **label on the project's namespace**:
 * `logging.kubesphere.io/logsidecar-injection` — `enabled` means a log sidecar is
 * injected into the project's pods. The old console's page is nothing more than that
 * switch, so the whole feature is one label read and one merge patch.
 *
 * A label, not an annotation, and not a CR: reading it from anywhere else would produce
 * a page that disagrees with what the injector actually looks at.
 */
export const LOG_COLLECTION_LABEL = 'logging.kubesphere.io/logsidecar-injection';

export interface LogCollectionState {
  /** True only when the label is exactly `enabled`. */
  enabled: boolean;
  /** The raw label value, for the "never configured" case. */
  raw: string;
  /** Whether a log backend exists on this cluster, from the cluster's configz. */
  supported: boolean;
}

export function logCollectionApi(client: Client) {
  const nsPath = (namespace: string) => `/kapis/resources.kubesphere.io/v1alpha3/namespaces/${encodeURIComponent(namespace)}`;

  return {
    async get(params: { namespace: string; cluster: string; signal?: AbortSignal }): Promise<LogCollectionState> {
      const signal = params.signal ? { signal: params.signal } : {};
      const [namespace, cluster] = await Promise.all([
        client.request<KubeIam>(nsPath(params.namespace), signal),
        // A cluster without the logging module cannot honour the switch, and offering it
        // would let a reader enable something that does nothing.
        client
          .request<{ status?: { configz?: Record<string, boolean> } }>(
            `/kapis/cluster.kubesphere.io/v1alpha1/clusters/${encodeURIComponent(params.cluster)}`,
            signal,
          )
          .catch(() => undefined),
      ]);
      const raw = String((namespace?.metadata?.labels ?? {})[LOG_COLLECTION_LABEL] ?? '');
      return {
        enabled: raw === 'enabled',
        raw,
        supported: cluster?.status?.configz?.['logging'] !== false,
      };
    },

    /**
     * Turn collection on or off.
     *
     * A merge patch on the one label: a PUT would replace the namespace and could drop
     * the project's other labels — including the workspace label that says which
     * enterprise space the project belongs to.
     */
    async setEnabled(params: { namespace: string; enabled: boolean }): Promise<void> {
      await client.request(`/api/v1/namespaces/${encodeURIComponent(params.namespace)}`, {
        method: 'PATCH',
        contentType: 'application/merge-patch+json',
        body: { metadata: { labels: { [LOG_COLLECTION_LABEL]: params.enabled ? 'enabled' : 'disabled' } } },
      });
    },
  };
}

export type LogCollectionApi = ReturnType<typeof logCollectionApi>;


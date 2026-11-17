import type { Client } from './client';
import { clusterScoped, corePath } from './paths';
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
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
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
  /**
   * Last sign-in. The old mapper read `status.lastLoginTime`; the password-change
   * annotation is only a fallback so a never-signed-in account is not labelled
   * with a password event.
   */
  lastLogin: string;
  /** Same clock as `lastLogin`, kept for callers that still read `lastActive`. */
  lastActive: string;
  email: string;
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
  const status = ((item.status ?? item['status'] ?? {}) as Record<string, unknown>);
  const spec = ((item.spec ?? item['spec'] ?? {}) as Record<string, unknown>);
  const lastLogin = String(status['lastLoginTime'] ?? annotations['iam.kubesphere.io/last-login-time'] ?? '');
  return {
    ...baseOf(item),
    kind: 'members',
    username: item.metadata?.name ?? '',
    role: annotations['iam.kubesphere.io/role'] ?? '',
    active: status['state'] === undefined ? true : String(status['state']) === 'Active',
    lastLogin,
    lastActive: lastLogin || (annotations['iam.kubesphere.io/last-password-change-time'] ?? ''),
    email: String(spec['email'] ?? annotations['email'] ?? ''),
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
  const namespaceSegment = namespace ? `namespaces/${encodeURIComponent(namespace)}/` : '';
  // `clusters/<id>` goes before the group: see `clusterScoped`.
  return clusterScoped(KAPIS_IAM, cluster, `${namespaceSegment}${resource}`);
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

    async removeMany(params: { cluster: string; namespace: string; usernames: string[] }): Promise<void> {
      for (const username of params.usernames) {
        await client.request(`${collection(params.cluster, params.namespace)}/${encodeURIComponent(username)}`, {
          method: 'DELETE',
        });
      }
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

/**
 * Cluster members — the cluster-scope counterpart of the project member list.
 *
 * The write shape is the platform's, not Kubernetes': `clustermembers` is a KubeSphere
 * aggregate whose collection takes an **array** of `{username, roleRef}` on POST (one
 * call can add several members), while a single member is updated by PUT on its own path.
 * All four verbs were probed against the live iam API (2026-11-16) and are recorded in
 * design/kube-frontend/cluster-management/cluster-members.md.
 */
export interface ClusterMemberInvite {
  username: string;
  /** A cluster role name, e.g. `cluster-viewer` / `cluster-admin`. */
  roleRef: string;
}

/** One assignable cluster role. */
export interface ClusterRoleOption {
  name: string;
  /** `kubesphere.io/alias-name`, falling back to the object name. */
  alias: string;
  description: string;
}

export function clusterMembersApi(client: Client) {
  return {
    /**
     * Cluster roles a member may be given.
     *
     * Only KubeSphere's own cluster-scope roles are offered: the collection also returns
     * ~200 add-on roles (`istiod-*`, `kiali-*`, `edgemesh-agent`, …) that exist to bind
     * controllers, not people. On this deployment the preset roles carry no `role` label,
     * so the filter is the naming convention KubeSphere uses for them (`cluster-*`), and
     * the annotation `iam.kubesphere.io/aggregation-roles` is used as a second signal.
     */
    async roles(params: { signal?: AbortSignal } = {}): Promise<ClusterRoleOption[]> {
      const body = await client.request<{ items?: KubeIam[] }>(`${KAPIS_IAM}/clusterroles`, {
        query: { limit: -1 },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (body?.items ?? [])
        .map((item) => {
          const metadata = item.metadata ?? {};
          const annotations = (metadata.annotations ?? {}) as Record<string, string>;
          const name = metadata.name ?? '';
          return {
            name,
            alias: annotations['kubesphere.io/alias-name'] ?? name,
            description: annotations['kubesphere.io/description'] ?? '',
            preset: name.startsWith('cluster-') || Boolean(annotations['iam.kubesphere.io/aggregation-roles']),
          };
        })
        .filter((role) => role.preset && role.name)
        .map(({ name, alias, description }) => ({ name, alias, description }));
    },

    /** Add one or more members in a single call (the collection takes an array). */
    async invite(params: { members: ClusterMemberInvite[] }): Promise<void> {
      await client.request(`${KAPIS_IAM}/clustermembers`, {
        method: 'POST',
        body: params.members,
      });
    },

    /** Change one member's cluster role. */
    async changeRole(params: ClusterMemberInvite): Promise<void> {
      await client.request(`${KAPIS_IAM}/clustermembers/${encodeURIComponent(params.username)}`, {
        method: 'PUT',
        body: { username: params.username, roleRef: params.roleRef },
      });
    },

    /** Remove one member's cluster role binding. */
    async remove(params: { username: string }): Promise<void> {
      await client.request(`${KAPIS_IAM}/clustermembers/${encodeURIComponent(params.username)}`, {
        method: 'DELETE',
      });
    },

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
  /** Namespace labels as Kubernetes stores them (the project's metadata). */
  labels: Record<string, string>;
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
    // Labels are needed by the cluster-scope detail (the project console reads the same
    // object but only for its workspace); keeping them on the summary costs nothing.
    labels,
  };
}

/**
 * The quota resources the console offers for editing.
 *
 * A short, fixed list rather than "whatever the cluster supports": these are the
 * ones a project administrator reasons about, and they map to ResourceQuota keys the
 * apiserver accepts. `count/pods` etc. are separate keys, not an alias for `pods`.
 */
/**
 * The project resource-quota keys the form offers.
 *
 * This list is the old console's `QUOTAS_MAP` (`src/utils/constants.js`), not a subset of it: the
 * migration originally carried only ten of its fifteen entries, so an administrator could not set
 * limits on statefulsets, daemonsets, jobs, cronjobs, ingresses, secrets or configmaps at all --
 * a silent capability loss, because a missing field just does not appear in the form.
 *
 * `pods` and `persistentvolumeclaims` are the canonical Kubernetes names; the old console spelled
 * the first `count/pods` (an accepted alias) and used `persistentvolumeclaims` for volumes.
 */
export const QUOTA_RESOURCES = [
  'requests.cpu',
  'requests.memory',
  'limits.cpu',
  'limits.memory',
  'pods',
  'count/deployments.apps',
  'count/statefulsets.apps',
  'count/daemonsets.apps',
  'count/jobs.batch',
  'count/cronjobs.batch',
  'count/services',
  'count/ingresses.extensions',
  'count/secrets',
  'count/configmaps',
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

    /**
     * The project's quota objects; the page edits the first one.
     *
     * A member cluster has no readable quota path (core group has no member form, and the kapis
     * proxy does not serve `resourcequotas` -- both measured on A100), so the read fails there and
     * the page shows an empty quota section instead of the host's numbers.
     */
    async list(params: { cluster?: string; namespace: string }): Promise<ProjectQuota[]> {
      const body = await client
        .request<{ items?: KubeQuota[] }>(corePath(params.cluster, `namespaces/${encodeURIComponent(params.namespace)}/resourcequotas`))
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

/** Everything the policy detail page shows. */
export interface NetworkPolicyDetail extends NetworkPolicySummary {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  /** The object as stored, for the YAML editor. */
  raw: KubeObject;
}

export function toNetworkPolicyDetail(item: KubePolicy): NetworkPolicyDetail {
  return {
    ...toNetworkPolicySummary(item),
    labels: item.metadata?.labels ?? {},
    annotations: item.metadata?.annotations ?? {},
    raw: item,
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
    /** Accepts a built manifest: the wizard's rule editor owns the shape. */
    async create(body: KubeObject): Promise<NetworkPolicySummary> {
      const namespace = String((body.metadata?.namespace ?? ''));
      const item = await client.request<KubePolicy>(path(namespace), { method: 'POST', body });
      return toNetworkPolicySummary(item ?? {});
    },

    /** Kept for callers that only need one peer; it builds the same manifest. */
    async createSimple(params: {
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
      return this.create({
        apiVersion: 'networking.k8s.io/v1',
        kind: 'NetworkPolicy',
        metadata: { name: params.name, namespace: params.namespace },
        spec,
      } as KubeObject);
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

/** One peer of a rule: pods by label, a namespace, or an address range. */
export type PolicyPeerKind = 'pod' | 'namespace' | 'ipBlock';

export interface PolicyPeerInput {
  kind: PolicyPeerKind;
  /** `k=v, k2=v2` for pods, the namespace name, or a CIDR for ipBlock. */
  value: string;
}

export interface PolicyPortInput {
  protocol: 'TCP' | 'UDP' | 'SCTP';
  /** A number, a range (`80-90`), or empty for every port. */
  port: string;
}

export interface PolicyRuleInput {
  peer: PolicyPeerInput;
  port?: PolicyPortInput;
}

export interface PolicyCreateInput {
  namespace: string;
  name: string;
  description?: string;
  /** `k=v, k2=v2`; empty selects every pod in the namespace. */
  podSelector?: string;
  ingress: PolicyRuleInput[];
  egress: PolicyRuleInput[];
}

/**
 * Build the NetworkPolicy a rule set describes.
 *
 * A peer is always an object wrapping a selector: `from: [{ podSelector: … }]`. A namespace
 * peer wraps `namespaceSelector` with the project's `kubernetes.io/metadata.name` label — that
 * label is set by Kubernetes itself, so the rule survives a rename of anything else.
 * `policyTypes` is derived from which rule lists are non-empty: a policy that names a type with no
 * rules for it would deny all traffic in that direction, which is the opposite of a whitelist.
 */
export function networkPolicyManifest(input: PolicyCreateInput): KubeObject {
  const toPeer = (peer: PolicyPeerInput): Record<string, unknown> => {
    const value = peer.value.trim();
    if (peer.kind === 'namespace') return { namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': value } } };
    if (peer.kind === 'ipBlock') return { ipBlock: { cidr: value } };
    return { podSelector: toSelector(value) };
  };
  const toPorts = (port: PolicyPortInput | undefined): Record<string, unknown>[] | undefined => {
    const value = (port?.port ?? '').trim();
    if (!value) return undefined;
    const [from, to] = value.split('-').map((piece) => piece.trim());
    const body: Record<string, unknown> = { protocol: port?.protocol ?? 'TCP' };
    if (from) body['port'] = /^[0-9]+$/.test(from) ? Number(from) : from;
    if (to) body['endPort'] = Number(to);
    return [body];
  };
  const spec: Record<string, unknown> = { podSelector: toSelector(input.podSelector ?? '') };
  const policyTypes: string[] = [];
  if (input.ingress.length > 0) {
    policyTypes.push('Ingress');
    spec['ingress'] = input.ingress.map((rule) => {
      const ports = toPorts(rule.port);
      return { from: [toPeer(rule.peer)], ...(ports ? { ports } : {}) };
    });
  }
  if (input.egress.length > 0) {
    policyTypes.push('Egress');
    spec['egress'] = input.egress.map((rule) => {
      const ports = toPorts(rule.port);
      return { to: [toPeer(rule.peer)], ...(ports ? { ports } : {}) };
    });
  }
  spec['policyTypes'] = policyTypes;
  const description = (input.description ?? '').trim();
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: {
      name: input.name,
      namespace: input.namespace,
      ...(description ? { annotations: { 'kubesphere.io/description': description } } : {}),
    },
    spec,
  } as KubeObject;
}

export function networkPoliciesApi(client: Client) {
  return {
    ...resourceApi<KubePolicy, NetworkPolicySummary, NetworkPolicyDetail>(client, {
      resource: 'networkpolicies',
      toSummary: toNetworkPolicySummary,
      toDetail: toNetworkPolicyDetail,
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
          clusterScoped('/kapis/resources.kubesphere.io/v1alpha3', params.cluster, `namespaces/${encodeURIComponent(params.namespace)}`),
          signal,
        ),
        /*
         * Quotas live in the core group and are frequently absent: a project with no
         * ResourceQuota is the normal case on this cluster, and the page renders an
         * explicit "no quota" section rather than failing the whole view.
         */
        /*
         * A member cluster has no readable quota path: the core group has no member form and the
         * kapis resources proxy does not serve `resourcequotas` (both measured on A100). Asking the
         * member therefore fails, and the page falls back to its "no quota" section -- which is
         * weaker than we want (unavailable reads as empty) but never shows another cluster's numbers.
         * Distinguishing the two is a follow-up: the page needs a third state.
         */
        client
          .request<{ items?: KubeIam[] }>(corePath(params.cluster, `namespaces/${encodeURIComponent(params.namespace)}/resourcequotas`), signal)
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

/**
 * Cluster log collection, read from the logging operator's own CRs.
 *
 * Four lists decide whether logs reach storage: the collector (FluentBit), its config, the
 * inputs (which sources are tailed) and the outputs (where records go). The IAM aggregate has
 * no summary for this, so the page reads the CRs directly — `/apis/logging.kubesphere.io`.
 */
export interface LoggingCollector {
  name: string;
  namespace: string;
  image: string;
  configName: string;
  /** `status.conditions` reduced to a single word when the operator reports one. */
  ready: string;
}

export interface LoggingInput {
  name: string;
  /** The plugin key in `spec` (systemd, tail, …). */
  plugin: string;
  tag: string;
}

export interface LoggingOutput {
  name: string;
  plugin: string;
  /** Host/endpoint the plugin writes to, when it has one. */
  host: string;
  /** `match` / `matchRegex`: which records this output receives. */
  match: string;
}

const LOGGING_API = '/apis/logging.kubesphere.io/v1alpha2';

export function clusterLoggingApi(client: Client) {
  const list = async <T,>(resource: string, signal: AbortSignal | undefined, toItem: (raw: Record<string, unknown>) => T): Promise<T[]> => {
    const body = await client.request<{ items?: Array<Record<string, unknown>> }>(`${LOGGING_API}/${resource}`, {
      ...(signal ? { signal } : {}),
    });
    return (body?.items ?? []).map(toItem);
  };
  return {
    async collectors(params: { signal?: AbortSignal }): Promise<LoggingCollector[]> {
      return list('fluentbits', params.signal, (item) => {
        const metadata = (item['metadata'] ?? {}) as Record<string, unknown>;
        const spec = (item['spec'] ?? {}) as Record<string, unknown>;
        const status = (item['status'] ?? {}) as Record<string, unknown>;
        const conditions = (status['conditions'] ?? []) as Array<Record<string, unknown>>;
        const readyCondition = conditions.find((condition) => String(condition['type'] ?? '') === 'Ready') ?? conditions[0];
        return {
          name: String(metadata['name'] ?? ''),
          namespace: String(metadata['namespace'] ?? ''),
          image: String(spec['image'] ?? ''),
          configName: String(spec['fluentBitConfigName'] ?? ''),
          ready: readyCondition ? String(readyCondition['type'] ?? '') : '',
        };
      });
    },

    /**
     * The collector's pods, by state.
     *
     * The FluentBit CR reports an empty `status` on this cluster (measured), so "is log
     * collection actually running" has to be answered by the pods the collector owns — the
     * same signal an operator would check with kubectl.
     */
    async podStats(params: { namespace: string; signal?: AbortSignal }): Promise<{ total: number; running: number }> {
      const body = await client.request<{ items?: Array<Record<string, unknown>> }>(
        `/api/v1/namespaces/${encodeURIComponent(params.namespace)}/pods`,
        {
          query: { labelSelector: 'app.kubernetes.io/name=fluent-bit' },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      const items = body?.items ?? [];
      const running = items.filter((item) => String(((item['status'] ?? {}) as Record<string, unknown>)['phase'] ?? '') === 'Running').length;
      return { total: items.length, running };
    },

    async inputs(params: { signal?: AbortSignal }): Promise<LoggingInput[]> {
      return list('inputs', params.signal, (item) => {
        const metadata = (item['metadata'] ?? {}) as Record<string, unknown>;
        const spec = (item['spec'] ?? {}) as Record<string, unknown>;
        const plugin = Object.keys(spec)[0] ?? '';
        const pluginSpec = (spec[plugin] ?? {}) as Record<string, unknown>;
        return {
          name: String(metadata['name'] ?? ''),
          plugin,
          tag: String(pluginSpec['tag'] ?? ''),
        };
      });
    },

    async outputs(params: { signal?: AbortSignal }): Promise<LoggingOutput[]> {
      return list('outputs', params.signal, (item) => {
        const metadata = (item['metadata'] ?? {}) as Record<string, unknown>;
        const spec = (item['spec'] ?? {}) as Record<string, unknown>;
        const plugin = Object.keys(spec).find((key) => key !== 'match' && key !== 'matchRegex') ?? '';
        const pluginSpec = (spec[plugin] ?? {}) as Record<string, unknown>;
        return {
          name: String(metadata['name'] ?? ''),
          plugin,
          host: String(pluginSpec['host'] ?? pluginSpec['endpoint'] ?? ''),
          match: String(spec['match'] ?? spec['matchRegex'] ?? ''),
        };
      });
    },
  };
}

export function limitRangesApi(client: Client) {
  return {
    async list(params: { cluster?: string; namespace: string; signal?: AbortSignal }): Promise<LimitRangeSummary[]> {
      const body = await client.request<{ items?: Array<Record<string, unknown>> }>(
        corePath(params.cluster, `namespaces/${encodeURIComponent(params.namespace)}/limitranges`),
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


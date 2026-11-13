import type { Client } from './client';
import { baseOf, resourceApi, type KubeObject, type ResourceBase } from './resources';
import { KAPIS_IAM } from './iam';

/**
 * Platform-level access control: users, platform roles and workspaces.
 *
 * Three different sources, one page shape (a list with a few columns), which is why
 * they share a page and take a descriptor:
 * - users and cluster roles are IAM objects (`iam.kubesphere.io`);
 * - a workspace is served by the resources proxy, not IAM.
 *
 * Getting the source wrong is silent — an IAM path for workspaces answers 404, and a
 * resources path for users answers "resource is not supported" — so each kind names
 * its own reader here.
 */

export type AccessKind = 'users' | 'clusterroles' | 'workspaces';

export interface UserSummary extends ResourceBase {
  kind: 'users';
  username: string;
  /** `Active` / `Disabled`, from the user's status. */
  status: string;
  /** Platform role, from `iam.kubesphere.io/platform-role` or `globalrole`. */
  platformRole: string;
  /** Last sign-in, when the platform recorded one. */
  lastLogin: string;
  email: string;
}

export interface ClusterRoleSummary extends ResourceBase {
  kind: 'clusterroles';
  ruleCount: number;
  /** `role-template-*` roles are building blocks the platform owns. */
  system: boolean;
}

export interface WorkspaceSummary extends ResourceBase {
  kind: 'workspaces';
  status: string;
  /** `Cluster` / `Multi-cluster` — the old console's 集群 column. */
  clusters: string;
  memberCount: number;
}

interface KubeAccess extends KubeObject {
  rules?: unknown[];
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

/** Platform-role annotation keys, in the order the platform writes them. */
const PLATFORM_ROLE_KEYS = ['iam.kubesphere.io/platform-role', 'iam.kubesphere.io/globalrole'];

export function platformRoleOf(item: KubeAccess): string {
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  for (const key of PLATFORM_ROLE_KEYS) {
    if (annotations[key]) return annotations[key];
  }
  return '';
}

export function toUserSummary(item: KubeAccess): UserSummary {
  const status = (item.status ?? {}) as Record<string, unknown>;
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  return {
    ...baseOf(item),
    kind: 'users',
    username: item.metadata?.name ?? '',
    // A user with no reported state has not been disabled; calling it "Disabled"
    // would be a claim the platform never made.
    status: status['state'] === undefined ? 'Active' : String(status['state']),
    platformRole: platformRoleOf(item),
    lastLogin: annotations['iam.kubesphere.io/last-login-time'] ?? '',
    email: annotations['email'] ?? '',
  };
}

export function toClusterRoleSummary(item: KubeAccess): ClusterRoleSummary {
  return {
    ...baseOf(item),
    kind: 'clusterroles',
    ruleCount: (item.rules ?? []).length,
    system: (item.metadata?.name ?? '').startsWith('role-template-'),
  };
}

export function toWorkspaceSummary(item: KubeAccess): WorkspaceSummary {
  const spec = (item.spec ?? {}) as Record<string, unknown>;
  const clusters = (spec['clusters'] ?? []) as unknown[];
  return {
    ...baseOf(item),
    kind: 'workspaces',
    status: String((item.status as Record<string, unknown> | undefined)?.['phase'] ?? ''),
    // The old console shows the cluster association; with no clusters listed the
    // workspace is the host cluster's, which it calls "Cluster".
    clusters: clusters.length === 0 ? 'Cluster' : `Multi-cluster (${clusters.length})`,
    memberCount: Number((item.status as Record<string, unknown> | undefined)?.['members'] ?? 0),
  };
}

export function usersApi(client: Client) {
  return {
    ...resourceApi<KubeAccess, UserSummary, UserSummary>(client, {
      resource: 'users',
      kapisPrefix: KAPIS_IAM,
      toSummary: toUserSummary,
      toDetail: toUserSummary,
    }),
    kind: 'users' as const,
  };
}

export function clusterRolesApi(client: Client) {
  return {
    ...resourceApi<KubeAccess, ClusterRoleSummary, ClusterRoleSummary>(client, {
      resource: 'clusterroles',
      kapisPrefix: KAPIS_IAM,
      toSummary: toClusterRoleSummary,
      toDetail: toClusterRoleSummary,
    }),
    kind: 'clusterroles' as const,
  };
}

/**
 * Workspaces are **read** from the resources proxy but **written** to the tenant
 * kapis group.
 *
 * Verified against the live cluster: `POST /apis/tenant.kubesphere.io/.../workspaces`
 * answers 404 (the group is not served there), while
 * `POST /kapis/tenant.kubesphere.io/v1alpha2/workspaces` answers 200 and the object
 * appears in the list. A **PUT** edits it (a merge PATCH answers 500), so edits
 * re-read for `resourceVersion` and send the whole object.
 */
export const KAPIS_TENANT = '/kapis/tenant.kubesphere.io/v1alpha2';

/**
 * One platform user, plus the sign-in history the old console shows on its detail page.
 *
 * The user object carries `status.state` (Active/Disabled) and `status.lastLoginTime`; the
 * history is a separate collection under the same user (`/loginrecords`), created by the
 * apiserver on each sign-in. Reading both here keeps the page to two calls.
 */
export interface UserDetail extends UserSummary {
  /** `status.state` — absent means the platform never disabled the account. */
  state: string;
  /** `status.lastLoginTime` (the authoritative one; the annotation is only a fallback). */
  lastLoginTime: string;
  description: string;
  createdAt: string;
}

export interface LoginRecord {
  /** Object name, unique per sign-in. */
  name: string;
  time: string;
  provider: string;
  reason: string;
}

export function userDetailApi(client: Client) {
  const path = (name: string) => `${KAPIS_IAM}/users/${encodeURIComponent(name)}`;
  return {
    async get(params: { name: string; signal?: AbortSignal }): Promise<UserDetail> {
      const item = await client.request<KubeAccess>(path(params.name), {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      const status = (item.status ?? {}) as Record<string, unknown>;
      const summary = toUserSummary(item);
      return {
        ...summary,
        state: String(status['state'] ?? 'Active'),
        lastLoginTime: String(status['lastLoginTime'] ?? summary.lastLogin),
        description: ((item.metadata?.annotations ?? {}) as Record<string, string>)['kubesphere.io/description'] ?? '',
        createdAt: item.metadata?.creationTimestamp ?? '',
      };
    },

    /** The last few sign-ins; the endpoint pages, so a small limit keeps the page quick. */
    async loginRecords(params: { name: string; limit?: number; signal?: AbortSignal }): Promise<LoginRecord[]> {
      const body = await client.request<{ items?: KubeAccess[] }>(`${path(params.name)}/loginrecords`, {
        query: { limit: params.limit ?? 10, sortBy: 'createTime', ascending: false },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (body?.items ?? []).map((item) => {
        const spec = (item.spec ?? {}) as Record<string, unknown>;
        return {
          name: item.metadata?.name ?? '',
          time: item.metadata?.creationTimestamp ?? '',
          provider: String(spec['provider'] ?? ''),
          reason: String(spec['reason'] ?? ''),
        };
      });
    },
  };
}

export function workspacesWriteApi(client: Client) {
  const path = (name?: string) => `${KAPIS_TENANT}/workspaces${name ? `/${encodeURIComponent(name)}` : ''}`;
  return {
    async create(params: { name: string; alias?: string; description?: string }): Promise<WorkspaceSummary> {
      const annotations: Record<string, string> = {};
      if (params.alias) annotations['kubesphere.io/alias-name'] = params.alias;
      if (params.description) annotations['kubesphere.io/description'] = params.description;
      const item = await client.request<KubeAccess>(path(), {
        method: 'POST',
        body: {
          apiVersion: 'tenant.kubesphere.io/v1alpha2',
          kind: 'Workspace',
          metadata: { name: params.name, ...(Object.keys(annotations).length ? { annotations } : {}) },
          spec: {},
        },
      });
      return toWorkspaceSummary(item ?? {});
    },

    async update(params: { name: string; alias?: string; description?: string }): Promise<WorkspaceSummary> {
      const current = await client.request<KubeAccess>(path(params.name));
      const annotations: Record<string, string> = { ...(current?.metadata?.annotations ?? {}) };
      if (params.alias !== undefined) annotations['kubesphere.io/alias-name'] = params.alias;
      if (params.description !== undefined) annotations['kubesphere.io/description'] = params.description;
      const item = await client.request<KubeAccess>(path(params.name), {
        method: 'PUT',
        body: { ...current, metadata: { ...current?.metadata, annotations } },
      });
      return toWorkspaceSummary(item ?? {});
    },

    async remove(params: { name: string }): Promise<void> {
      await client.request<void>(path(params.name), { method: 'DELETE' });
    },
  };
}

/**
 * Read workspaces from the tenant API, the same endpoint they are written to.
 *
 * The resources proxy (`resources.kubesphere.io/.../workspaces`) is what this used to
 * read, and on one cluster version it does not see a workspace created through the
 * tenant API at all — measured against a live cluster: 2 entries from the proxy against
 * 3 from tenant, with the newly created one missing only in the proxy. Reading and
 * writing the same store avoids depending on how the proxy caches.
 *
 * KubeSphere's own list parameters (`page`, `limit`, `sortBy`, `ascending`, `name`) are
 * served by this endpoint too, so pagination and search behave the same.
 */
/**
 * One workspace, as its detail page shows it.
 *
 * Read from the tenant API (the same store it is written to), and its projects from the
 * resources proxy filtered by the `kubesphere.io/workspace` label — that label is the only
 * thing that ties a namespace to a workspace.
 */
export interface WorkspaceDetail {
  name: string;
  alias: string;
  description: string;
  creator: string;
  createdAt: string;
  /** `spec.template.spec.manager`, the account that administers the workspace. */
  manager: string;
  /** Clusters the workspace is placed on, from `spec.placement.clusters`. */
  clusters: string[];
}

export interface WorkspaceProject {
  name: string;
  alias: string;
  status: string;
  createdAt: string;
  creator: string;
}

export function workspaceDetailApi(client: Client) {
  const path = (name: string) => `${KAPIS_TENANT}/workspaces/${encodeURIComponent(name)}`;
  return {
    async get(params: { name: string; signal?: AbortSignal }): Promise<WorkspaceDetail> {
      const item = await client.request<KubeAccess>(path(params.name), {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      const spec = (item.spec ?? {}) as Record<string, unknown>;
      const template = (spec['template'] ?? {}) as Record<string, unknown>;
      const templateSpec = (template['spec'] ?? {}) as Record<string, unknown>;
      const placement = (spec['placement'] ?? {}) as Record<string, unknown>;
      const clusters = ((placement['clusters'] ?? []) as Array<Record<string, unknown>>)
        .map((entry) => String(entry['name'] ?? ''))
        .filter(Boolean);
      const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
      return {
        name: item.metadata?.name ?? '',
        alias: annotations['kubesphere.io/alias-name'] ?? '',
        description: annotations['kubesphere.io/description'] ?? '',
        creator: ((item.metadata?.annotations ?? {}) as Record<string, string>)['kubesphere.io/creator'] ?? '',
        createdAt: item.metadata?.creationTimestamp ?? '',
        manager: String(templateSpec['manager'] ?? ''),
        clusters,
      };
    },

    /** The workspace's projects (namespaces carrying its label). */
    async projects(params: { name: string; signal?: AbortSignal }): Promise<WorkspaceProject[]> {
      const body = await client.request<{ items?: KubeAccess[] }>(`/kapis/resources.kubesphere.io/v1alpha3/namespaces`, {
        query: { labelSelector: `kubesphere.io/workspace=${params.name}`, limit: -1 },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (body?.items ?? []).map((item) => {
        const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
        return {
          name: item.metadata?.name ?? '',
          alias: annotations['kubesphere.io/alias-name'] ?? '',
          status: String((item.status ?? {})['phase'] ?? ''),
          createdAt: item.metadata?.creationTimestamp ?? '',
          creator: ((item.metadata?.annotations ?? {}) as Record<string, string>)['kubesphere.io/creator'] ?? '',
        };
      });
    },
  };
}

export function workspacesApi(client: Client) {
  return {
    async list(params: {
      cluster: string;
      namespace: string;
      page: number;
      pageSize: number;
      sortBy?: string;
      order?: string;
      keyword?: string;
      signal?: AbortSignal;
    }): Promise<{ items: WorkspaceSummary[]; total: number }> {
      const query = new URLSearchParams({ page: String(params.page), limit: String(params.pageSize) });
      if (params.sortBy) query.set('sortBy', params.sortBy);
      if (params.order) query.set('ascending', String(params.order === 'asc'));
      if (params.keyword?.trim()) query.set('name', params.keyword.trim());
      const body = await client.request<{ items?: KubeAccess[]; totalItems?: number }>(
        `/kapis/tenant.kubesphere.io/v1alpha2/workspaces?${query.toString()}`,
        params.signal ? { signal: params.signal } : {},
      );
      const items = (body?.items ?? []).map(toWorkspaceSummary);
      return { items, total: body?.totalItems ?? items.length };
    },
    kind: 'workspaces' as const,
  };
}

/* ------------------------------------------------------------------ *
 * Platform settings: the platform's own configuration.
 * ------------------------------------------------------------------ */

/**
 * Platform console configuration.
 *
 * The old console's 平台信息 page reads `kubesphere-config` (a ConfigMap in
 * `kubesphere-system`) and shows the title, description and console URL. Those values
 * live inside one YAML document under `kubesphere.yaml`, so they are extracted here
 * rather than in the page: one place knows the config's shape.
 */
export interface PlatformInfo {
  title: string;
  description: string;
  /** The address the console is served on. */
  consoleUrl: string;
}

export const PLATFORM_CONFIG_MAP = 'kubesphere-config';
export const PLATFORM_NAMESPACE = 'kubesphere-system';

/**
 * Read one scalar out of a section of the config YAML.
 *
 * Only a handful of flat keys under `console:` are needed. A YAML parser for three
 * strings is not worth the dependency, so this walks indentation instead — which is
 * auditable, and safe because it stops at the first line that leaves the section.
 */
export function configScalar(yaml: string, section: string, key: string): string {
  const lines = yaml.split('\n');
  let inSection = false;
  let sectionIndent = 0;
  const pattern = new RegExp(`^${key}:\\s*(.+)$`);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    if (!inSection) {
      if (trimmed === `${section}:`) {
        inSection = true;
        sectionIndent = indent;
      }
      continue;
    }
    // A line at or above the section's indent ends it.
    if (indent <= sectionIndent) return '';
    const match = pattern.exec(trimmed);
    if (match?.[1]) return match[1].trim().replace(/^['"]|['"]$/g, '');
  }
  return '';
}

interface KubeConfigMap extends KubeObject {
  data?: Record<string, string>;
}

export function toPlatformInfo(item: KubeConfigMap): PlatformInfo {
  const yaml = item.data?.['kubesphere.yaml'] ?? '';
  return {
    title: configScalar(yaml, 'console', 'title'),
    description: configScalar(yaml, 'console', 'desc'),
    consoleUrl: configScalar(yaml, 'console', 'url'),
  };
}

export function platformInfoApi(client: Client) {
  return {
    /**
     * The platform ConfigMap is read through the core group: the resources proxy
     * answers 500 for it (it is not a KubeSphere resource), while `/api/v1` serves it.
     */
    async get(params: { signal?: AbortSignal } = {}): Promise<PlatformInfo> {
      const item = await client.request<KubeConfigMap>(
        `/api/v1/namespaces/${PLATFORM_NAMESPACE}/configmaps/${PLATFORM_CONFIG_MAP}`,
        params.signal ? { signal: params.signal } : {},
      );
      return toPlatformInfo(item ?? {});
    },
  };
}

/** The notification channels the platform can be configured with. */
export const NOTIFICATION_CHANNELS = ['mail', 'dingtalk', 'wecom', 'slack', 'webhook'] as const;

export type NotificationChannelKey = (typeof NOTIFICATION_CHANNELS)[number];

/**
 * Whether a channel is configured.
 *
 * The platform stores channel credentials as Secrets in `kubesphere-monitoring-system`
 * named `<channel>s` (`mails`, `slacks`, `webhooks`) via KubeSphere's notification
 * manager. Presence is the only thing this page reports — the contents are secrets and
 * stay unread.
 */
export interface NotificationChannel {
  key: NotificationChannelKey;
  configured: boolean;
}

export function toNotificationChannels(existingSecretNames: readonly string[]): NotificationChannel[] {
  return NOTIFICATION_CHANNELS.map((key) => ({
    key,
    configured: existingSecretNames.includes(`${key}s`),
  }));
}

/** The platform roles an administrator assigns, in rising order of privilege. */
export const ASSIGNABLE_PLATFORM_ROLES = ['platform-regular', 'platform-self-provisioner', 'platform-admin'] as const;

export type AssignablePlatformRole = (typeof ASSIGNABLE_PLATFORM_ROLES)[number];

/**
 * Users are written through IAM, like they are read.
 *
 * The platform role is an annotation, not a field — writing it anywhere else leaves a
 * user who can sign in but can do nothing, which reads as a console bug rather than a
 * permissions one.
 */
/**
 * One cluster role, with its rules.
 *
 * Read from the IAM aggregate (the same path the list uses); the rules are what the role
 * actually grants, and the old console's detail page is essentially this table.
 */
export interface ClusterRoleDetail extends ClusterRoleSummary {
  rules: Array<{ apiGroups: string; resources: string; verbs: string }>;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

export function clusterRoleDetailApi(client: Client) {
  return {
    async get(params: { name: string; signal?: AbortSignal }): Promise<ClusterRoleDetail> {
      const item = await client.request<KubeAccess>(`${KAPIS_IAM}/clusterroles/${encodeURIComponent(params.name)}`, {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      const summary = toClusterRoleSummary(item);
      return {
        ...summary,
        rules: ((item.rules ?? []) as Array<Record<string, unknown>>).map((rule) => ({
          apiGroups: Array.isArray(rule['apiGroups']) ? (rule['apiGroups'] as string[]).join(', ') : '',
          resources: Array.isArray(rule['resources']) ? (rule['resources'] as string[]).join(', ') : '',
          verbs: Array.isArray(rule['verbs']) ? (rule['verbs'] as string[]).join(', ') : '',
        })),
        labels: (item.metadata?.labels ?? {}) as Record<string, string>,
        annotations: (item.metadata?.annotations ?? {}) as Record<string, string>,
      };
    },
  };
}

export function usersWriteApi(client: Client) {
  return {
    async create(params: {
      name: string;
      email: string;
      password: string;
      platformRole: AssignablePlatformRole;
    }): Promise<UserSummary> {
      const item = await client.request<KubeAccess>(`${KAPIS_IAM}/users`, {
        method: 'POST',
        body: {
          apiVersion: 'iam.kubesphere.io/v1alpha2',
          kind: 'User',
          metadata: {
            name: params.name,
            annotations: { 'iam.kubesphere.io/platform-role': params.platformRole },
          },
          spec: {
            email: params.email,
            // The platform hashes this on the server; sending it in plain text is how
            // the console's own API expects it.
            password: params.password,
          },
        },
      });
      return toUserSummary(item ?? {});
    },

    async remove(params: { name: string }): Promise<void> {
      await client.request<void>(`${KAPIS_IAM}/users/${encodeURIComponent(params.name)}`, { method: 'DELETE' });
    },

    /**
     * Enable or disable a user account.
     *
     * Not a merge patch: the IAM users endpoint answers **405** to PATCH (verified
     * against the live cluster), so the whole object is PUT with `status.state` set —
     * the same shape the old console sends. The object is read first because a PUT with
     * a stale `resourceVersion` is rejected with 409; without the read, a second toggle
     * would fail.
     */
    async setActive(params: { name: string; active: boolean }): Promise<UserSummary> {
      const path = `${KAPIS_IAM}/users/${encodeURIComponent(params.name)}`;
      const current = await client.request<KubeAccess>(path);
      const updated = await client.request<KubeAccess>(path, {
        method: 'PUT',
        body: {
          ...current,
          status: { ...((current?.status ?? {}) as Record<string, unknown>), state: params.active ? 'Active' : 'Disabled' },
        },
      });
      return toUserSummary(updated ?? {});
    },

    /**
     * Change a user's platform role.
     *
     * A **PUT**, not a merge patch: the IAM users endpoint answers 405 to PATCH
     * (verified against the live cluster), so the whole object is replaced with the
     * edited annotation. The current object is read first for its `resourceVersion` —
     * a PUT carrying a stale one is rejected with 409, which is the only protection
     * against overwriting a concurrent change.
     */
    async setPlatformRole(params: { name: string; platformRole: AssignablePlatformRole }): Promise<UserSummary> {
      const current = await client.request<KubeAccess>(`${KAPIS_IAM}/users/${encodeURIComponent(params.name)}`);
      const updated = await client.request<KubeAccess>(`${KAPIS_IAM}/users/${encodeURIComponent(params.name)}`, {
        method: 'PUT',
        body: {
          ...current,
          metadata: {
            ...current?.metadata,
            annotations: {
              ...(current?.metadata?.annotations ?? {}),
              'iam.kubesphere.io/platform-role': params.platformRole,
            },
          },
        },
      });
      return toUserSummary(updated ?? {});
    },
  };
}

/**
 * Password rules the platform enforces on creation.
 *
 * Checked here so a weak password is refused with an explanation instead of a generic
 * 400 from the apiserver.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'too-short';
  if (!/[A-Za-z]/.test(password)) return 'no-letter';
  if (!/[0-9]/.test(password)) return 'no-digit';
  return null;
}

/**
 * A rule as the role editor presents it.
 *
 * One line per rule: which verbs on which resources in which API groups. Verbs are a
 * fixed set the platform understands, so the editor offers them as flags rather than
 * free text — a typo in `verbs` is accepted by the apiserver and silently grants
 * nothing.
 */
export const ROLE_VERBS = ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'] as const;

export type RoleVerb = (typeof ROLE_VERBS)[number];

export interface EditableRule {
  apiGroups: string;
  resources: string;
  verbs: RoleVerb[];
}

interface KubeClusterRole extends KubeObject {
  rules?: Array<Record<string, unknown>>;
}

/**
 * Cluster roles are **read** through IAM but **written** to native RBAC.
 *
 * Verified against the live cluster: a POST to `iam.kubesphere.io/.../clusterroles`
 * answers 200, but the object it creates comes back with `rules: null` — the IAM layer
 * consumes the rule list and never stores it. A role with no rules grants nothing, and
 * nothing in the response says so. The native endpoint stores the rules correctly, so
 * writes go there.
 */
export const RBAC_CLUSTERROLES = '/apis/rbac.authorization.k8s.io/v1/clusterroles';

export function clusterRolesWriteApi(client: Client) {
  const path = (name?: string) => `${RBAC_CLUSTERROLES}${name ? `/${encodeURIComponent(name)}` : ''}`;
  return {
    async create(params: { name: string; alias?: string; description?: string; rules: EditableRule[] }): Promise<ClusterRoleSummary> {
      const annotations: Record<string, string> = {};
      if (params.alias) annotations['kubesphere.io/alias-name'] = params.alias;
      if (params.description) annotations['kubesphere.io/description'] = params.description;
      const item = await client.request<KubeClusterRole>(path(), {
        method: 'POST',
        body: {
          apiVersion: 'rbac.authorization.k8s.io/v1',
          kind: 'ClusterRole',
          metadata: { name: params.name, ...(Object.keys(annotations).length ? { annotations } : {}) },
          rules: toKubeRules(params.rules),
        },
      });
      return toClusterRoleSummary(item ?? {});
    },

    /** Rules are replaced wholesale: a merge patch on an array replaces it anyway. */
    async update(params: { name: string; alias?: string; description?: string; rules: EditableRule[] }): Promise<ClusterRoleSummary> {
      const current = await client.request<KubeClusterRole>(path(params.name));
      const annotations: Record<string, string> = { ...(current?.metadata?.annotations ?? {}) };
      if (params.alias !== undefined) annotations['kubesphere.io/alias-name'] = params.alias;
      if (params.description !== undefined) annotations['kubesphere.io/description'] = params.description;
      const item = await client.request<KubeClusterRole>(path(params.name), {
        method: 'PUT',
        body: {
          ...current,
          metadata: { ...current?.metadata, annotations },
          rules: toKubeRules(params.rules),
        },
      });
      return toClusterRoleSummary(item ?? {});
    },

    async remove(params: { name: string }): Promise<void> {
      await client.request<void>(path(params.name), { method: 'DELETE' });
    },

    /** Read one role's rules in the editable shape. */
    async rules(params: { name: string }): Promise<EditableRule[]> {
      const item = await client.request<KubeClusterRole>(path(params.name));
      return ((item?.rules ?? []) as Array<Record<string, unknown>>).map((rule) => ({
        apiGroups: displayList(rule['apiGroups']),
        resources: displayList(rule['resources']),
        verbs: (Array.isArray(rule['verbs']) ? (rule['verbs'] as string[]) : []).filter((verb): verb is RoleVerb =>
          (ROLE_VERBS as readonly string[]).includes(verb),
        ),
      }));
    },
  };
}

/** Join a string list for display; `''` stays `''` (the core group). */
function displayList(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(', ');
  return value === undefined || value === null ? '' : String(value);
}

function toKubeRules(rules: EditableRule[]): Array<Record<string, unknown>> {
  return rules
    .filter((rule) => rule.verbs.length > 0)
    .map((rule) => ({
      /*
       * The core group is spelled `['']`, never `[]`: the apiserver rejects an empty
       * list with `rules[0].apiGroups: Required value: resource rules must supply at
       * least one api group` (422). An administrator leaving the field blank means
       * "core group", so the blank has to become that one empty string.
       */
      apiGroups: splitList(rule.apiGroups).length > 0 ? splitList(rule.apiGroups) : [''],
      resources: splitList(rule.resources),
      verbs: rule.verbs,
    }));
}

/** `a, b` → `['a', 'b']`. */
function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

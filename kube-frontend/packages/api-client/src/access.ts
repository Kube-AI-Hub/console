import type { Client } from './client';
import { ApiError } from './errors';
import { baseOf, resourceApi, type KubeObject, type ResourceBase } from './resources';
import { KAPIS_IAM } from './iam';

/** Read-only aggregate over every resource kind (the console's own gateway). */
const KAPIS_RESOURCES = '/kapis/resources.kubesphere.io/v1alpha3';

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
    // The old mapper read `status.lastLoginTime`. The annotation is written on
    // password changes too, so using it first made "never signed in" look like a
    // recent login. Status is the sign-in clock; the annotation is only a fallback.
    lastLogin: String(status['lastLoginTime'] ?? annotations['iam.kubesphere.io/last-login-time'] ?? ''),
    /*
     * `spec.email` first, the annotation as a fallback.
     *
     * Every write path in this console — create, admin edit, personal settings — sets
     * `spec.email`, which is also what the old console's mapper read. Reading the annotation
     * first meant the 邮箱 column stayed empty (or stale) no matter what the account's real
     * address was, which reads as "this user has no email" rather than "we looked in the
     * wrong place".
     */
    email: String(((item.spec ?? {}) as Record<string, unknown>)['email'] ?? annotations['email'] ?? ''),
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

/** One cluster role with its raw rules, for the cluster-scoped detail page. */
export interface ClusterRoleScopedDetail extends ClusterRoleSummary {
  rules: Array<Record<string, unknown>>;
  annotations: Record<string, string>;
}

/** A user bound to a cluster role (through a ClusterRoleBinding). */
export interface ClusterRoleScopedUser {
  username: string;
  status: string;
  lastLogin: string;
}

/**
 * Cluster roles **in a cluster scope**.
 *
 * The platform page always reads the host cluster. A cluster console can address a member
 * cluster too; IAM is reached through the kapis cluster prefix there
 * (`/kapis/clusters/<c>/iam…`), the same pattern as the other member-cluster reads.
 */
export function clusterRolesForClusterApi(client: Client) {
  const base = (cluster: string): string =>
    cluster === 'host' ? KAPIS_IAM : '/kapis/clusters/' + encodeURIComponent(cluster) + '/iam.kubesphere.io/v1alpha2';
  return {
    async list(params: { cluster: string; signal?: AbortSignal }): Promise<ClusterRoleSummary[]> {
      const body = await client.request<{ items?: KubeAccess[] }>(base(params.cluster) + '/clusterroles', {
        query: { limit: -1 },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (body?.items ?? []).map(toClusterRoleSummary);
    },
    async get(params: { cluster: string; name: string; signal?: AbortSignal }): Promise<ClusterRoleScopedDetail> {
      const item = await client.request<KubeAccess>(base(params.cluster) + '/clusterroles/' + encodeURIComponent(params.name), {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return {
        ...toClusterRoleSummary(item),
        rules: (item.rules ?? []) as Array<Record<string, unknown>>,
        annotations: (item.metadata?.annotations ?? {}) as Record<string, string>,
      };
    },
    /**
     * Users bound to this role.
     *
     * The IAM aggregate filters users by `?clusterrole=<name>`; it walks the role bindings
     * server-side. An empty list means the role is granted to no user (or only to groups /
     * service accounts, which this tab does not list).
     */
    async users(params: { cluster: string; name: string; signal?: AbortSignal }): Promise<ClusterRoleScopedUser[]> {
      const body = await client.request<{ items?: KubeAccess[] }>(base(params.cluster) + '/users', {
        query: { clusterrole: params.name, limit: -1 },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (body?.items ?? []).map((item) => ({
        username: item.metadata?.name ?? '',
        status: String((item.status as Record<string, unknown> | undefined)?.['state'] ?? ''),
        lastLogin: String((item.status as Record<string, unknown> | undefined)?.['lastLoginTime'] ?? ''),
      }));
    },
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
  /** Client address the apiserver recorded; empty when the object has no `spec.sourceIP`. */
  sourceIP: string;
  /**
   * `spec.success`. `undefined` means the object did not say; that is not the same as
   * a failed sign-in, and the page must not paint it as one.
   */
  success?: boolean;
}

/** One page of `/users/<name>/loginrecords`. */
export interface LoginRecordsPage {
  items: LoginRecord[];
  /** `totalItems` from the collection; a missing field falls back to this page's length. */
  total: number;
}

/**
 * Accounts the old console refused to edit, disable, delete or reset.
 *
 * Matches `presetUsers` in `console/server/config.yaml`. The signed-in account is
 * protected separately via `isProtectedPlatformUser`'s second argument: operating on
 * yourself is the same class of lock-out as operating on `admin`.
 */
export const PRESET_PLATFORM_USERS = ['admin', 'sonarqube'] as const;

/** True when the row must not offer enable / disable / edit / delete / reset password. */
export function isProtectedPlatformUser(name: string, currentUsername?: string): boolean {
  if (!name) return true;
  if ((PRESET_PLATFORM_USERS as readonly string[]).includes(name)) return true;
  return Boolean(currentUsername) && name === currentUsername;
}

/** Map one LoginRecord object. Missing success stays undefined; missing IP stays empty. */
export function toLoginRecord(item: KubeAccess): LoginRecord {
  const spec = (item.spec ?? {}) as Record<string, unknown>;
  const success = spec['success'];
  return {
    name: item.metadata?.name ?? '',
    time: item.metadata?.creationTimestamp ?? '',
    provider: String(spec['provider'] ?? ''),
    reason: String(spec['reason'] ?? ''),
    sourceIP: String(spec['sourceIP'] ?? ''),
    ...(typeof success === 'boolean' ? { success } : {}),
  };
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
      const spec = (item.spec ?? {}) as Record<string, unknown>;
      // The list row reads the email annotation, but the object's authoritative email is
      // `spec.email` (the console writes edits there). Preferring the spec field is what makes
      // the edit dialog open on the real value instead of an empty box.
      const email = String(spec['email'] ?? summary.email ?? '');
      return {
        ...summary,
        email,
        state: String(status['state'] ?? 'Active'),
        lastLoginTime: String(status['lastLoginTime'] ?? summary.lastLogin),
        description: ((item.metadata?.annotations ?? {}) as Record<string, string>)['kubesphere.io/description'] ?? '',
        createdAt: item.metadata?.creationTimestamp ?? '',
      };
    },

    /**
     * Sign-in history, server-paged.
     *
     * The old console's login-history tab sent `page` / `limit` / `sortBy=createTime` and
     * rendered `totalItems`. A fixed `limit: 10` with no total hid every record past the
     * first page and could not tell a short history from a truncated one.
     */
    async loginRecords(params: {
      name: string;
      page?: number;
      limit?: number;
      signal?: AbortSignal;
    }): Promise<LoginRecordsPage> {
      const limit = params.limit ?? 10;
      const page = params.page ?? 1;
      const body = await client.request<{ items?: KubeAccess[]; totalItems?: number }>(
        `${path(params.name)}/loginrecords`,
        {
          query: { page, limit, sortBy: 'createTime', ascending: false },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      const items = (body?.items ?? []).map(toLoginRecord);
      return {
        items,
        total: typeof body?.totalItems === 'number' ? body.totalItems : items.length,
      };
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

/**
 * One cluster visible to a workspace, from the tenant aggregate.
 *
 * The endpoint returns the cluster **objects** (not names): provider, Kubernetes version,
 * node count and the Ready condition are what a workspace manager needs to tell apart the
 * clusters their projects can land on. The workspace object's own `spec.placement.clusters`
 * is only a name list, so it cannot answer "is it ready".
 */
export interface WorkspaceClusterSummary {
  name: string;
  /** `kubesphere.io/alias-name`; empty falls back to the name in the UI. */
  alias: string;
  description: string;
  /** `spec.provider`, e.g. `kube-ai-hub`. */
  provider: string;
  /** `status.kubernetesVersion`, e.g. `v1.28.15`. */
  kubernetesVersion: string;
  /** `status.nodeCount`; absent when the cluster never reported it. */
  nodeCount?: number;
  /** True only when the Ready condition's status is `True`; a missing condition is not ready. */
  ready: boolean;
  /** `cluster.kubesphere.io/visibility` label: `public` / `private`. */
  visibility: string;
  /** `status.configz.devops`; false when the cluster does not report the module. */
  devopsEnabled: boolean;
}

/** Map one raw cluster object to the view model, keeping "missing" distinct from 0/false. */
export function toWorkspaceClusterSummary(item: KubeAccess): WorkspaceClusterSummary {
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  const labels = (item.metadata?.labels ?? {}) as Record<string, string>;
  const spec = (item.spec ?? {}) as Record<string, unknown>;
  const status = (item.status ?? {}) as Record<string, unknown>;
  const conditions = Array.isArray(status['conditions']) ? (status['conditions'] as Array<Record<string, unknown>>) : [];
  const readyCondition = conditions.find((condition) => String(condition['type'] ?? '') === 'Ready');
  const nodeCount = typeof status['nodeCount'] === 'number' && Number.isFinite(status['nodeCount']) ? status['nodeCount'] : undefined;
  const configz = (status['configz'] ?? {}) as Record<string, unknown>;
  return {
    name: item.metadata?.name ?? '',
    alias: annotations['kubesphere.io/alias-name'] ?? '',
    description: annotations['kubesphere.io/description'] ?? '',
    provider: String(spec['provider'] ?? ''),
    kubernetesVersion: String(status['kubernetesVersion'] ?? ''),
    ...(nodeCount === undefined ? {} : { nodeCount }),
    ready: String(readyCondition?.['status'] ?? '') === 'True',
    visibility: labels['cluster.kubesphere.io/visibility'] ?? '',
    devopsEnabled: configz['devops'] === true,
  };
}

export interface WorkspaceProject {
  name: string;
  alias: string;
  status: string;
  createdAt: string;
  creator: string;
}

/**
 * One workspace member: an account bound to a workspace role.
 *
 * Same shape as cluster and project members, one scope up. Read from the IAM aggregate; the
 * tenant path has no members endpoint (it answers 404), which is why this lives here.
 */
export interface WorkspaceMemberSummary {
  username: string;
  /** `iam.kubesphere.io/workspacerole`. */
  role: string;
  status: string;
  lastLogin: string;
  email: string;
}

/** A project or DevOps project this workspace member can reach. */
export interface WorkspaceMemberResource {
  name: string;
  alias: string;
  createdAt: string;
  cluster: string;
}

export function toWorkspaceMemberSummary(item: KubeAccess): WorkspaceMemberSummary {
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  const status = (item.status ?? {}) as Record<string, unknown>;
  const spec = (item.spec ?? {}) as Record<string, unknown>;
  return {
    username: item.metadata?.name ?? '',
    role: annotations['iam.kubesphere.io/workspacerole'] ?? '',
    status: status['state'] === undefined ? 'Active' : String(status['state']),
    lastLogin: String(status['lastLoginTime'] ?? annotations['iam.kubesphere.io/last-login-time'] ?? ''),
    email: String(spec['email'] ?? annotations['email'] ?? ''),
  };
}

function tenantMemberCollection(
  workspace: string,
  username: string,
  kind: 'namespaces' | 'devops',
  cluster?: string,
): string {
  const clusterSeg = cluster ? `/klusters/${encodeURIComponent(cluster)}` : '';
  return `${KAPIS_TENANT}/workspaces/${encodeURIComponent(workspace)}${clusterSeg}/workspacemembers/${encodeURIComponent(username)}/${kind}`;
}

function toMemberResources(body: { items?: KubeAccess[] } | undefined, cluster: string): WorkspaceMemberResource[] {
  return (body?.items ?? []).map((item) => {
    const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
    return {
      name: item.metadata?.name ?? '',
      alias: annotations['kubesphere.io/alias-name'] ?? '',
      createdAt: item.metadata?.creationTimestamp ?? '',
      cluster,
    };
  });
}

export function workspaceMembersApi(client: Client) {
  const path = (workspace: string, username?: string) =>
    `${KAPIS_IAM}/workspaces/${encodeURIComponent(workspace)}/workspacemembers${username ? `/${encodeURIComponent(username)}` : ''}`;

  async function readCollection(
    params: { workspace: string; username: string; kind: 'namespaces' | 'devops'; cluster?: string; signal?: AbortSignal },
  ): Promise<WorkspaceMemberResource[]> {
    try {
      const body = await client.request<{ items?: KubeAccess[] }>(
        tenantMemberCollection(params.workspace, params.username, params.kind, params.cluster),
        {
          query: { limit: -1, sortBy: 'createTime' },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      return toMemberResources(body, params.cluster ?? '');
    } catch (error) {
      // DevOps is gated in the old console (`ksModule: devops`). A missing CRD or
      // tenant path answers 404; that is "not enabled", not a page-level failure.
      if (error instanceof ApiError && error.isNotFound) return [];
      throw error;
    }
  }

  return {
    async invite(params: { workspace: string; username: string; roleRef: string }): Promise<void> {
      // The binding endpoint validates the role but not whether the account exists.
      const user = await client.request<KubeAccess>(`${KAPIS_IAM}/users/${encodeURIComponent(params.username)}`);
      if (user?.metadata?.name !== params.username) throw new Error('User account does not exist');
      await client.request(path(params.workspace), {
        method: 'POST',
        body: [{ username: params.username, roleRef: params.roleRef }],
      });
    },
    async updateRole(params: { workspace: string; username: string; roleRef: string }): Promise<void> {
      await client.request(path(params.workspace, params.username), {
        method: 'PUT',
        body: { username: params.username, roleRef: params.roleRef },
      });
    },
    async remove(params: { workspace: string; username: string }): Promise<void> {
      await client.request(path(params.workspace, params.username), { method: 'DELETE' });
    },
    async removeMany(params: { workspace: string; usernames: string[] }): Promise<void> {
      for (const username of params.usernames) {
        await client.request(path(params.workspace, username), { method: 'DELETE' });
      }
    },
    async get(params: { workspace: string; username: string; signal?: AbortSignal }): Promise<WorkspaceMemberSummary> {
      const item = await client.request<KubeAccess>(path(params.workspace, params.username), {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return toWorkspaceMemberSummary(item ?? {});
    },
    async list(params: { workspace: string; signal?: AbortSignal }): Promise<WorkspaceMemberSummary[]> {
      const body = await client.request<{ items?: KubeAccess[] }>(
        path(params.workspace),
        { query: { limit: -1 }, ...(params.signal ? { signal: params.signal } : {}) },
      );
      return (body?.items ?? []).map(toWorkspaceMemberSummary);
    },
    async memberProjects(params: {
      workspace: string;
      username: string;
      cluster?: string;
      signal?: AbortSignal;
    }): Promise<WorkspaceMemberResource[]> {
      return readCollection({ ...params, kind: 'namespaces' });
    },
    /**
     * Roles this member holds in each project they can reach.
     *
     * One role-binding request per project: the binding is namespaced and there is no aggregated
     * "roles of this user in this workspace" route on the deployments we run. Capped so a workspace
     * with hundreds of projects cannot turn the detail page into a stampede.
     */
    async memberProjectRoles(params: {
      workspace: string;
      username: string;
      cluster?: string;
      signal?: AbortSignal;
    }): Promise<Record<string, string[]>> {
      const projects = await readCollection({ ...params, kind: 'namespaces' });
      const names = projects.map((project) => project.name).filter(Boolean).slice(0, 60);
      const entries = await Promise.all(
        names.map(async (namespace) => {
          try {
            const body = await client.request<{ items?: KubeRoleBinding[] }>(
              `${KAPIS_RESOURCES}/namespaces/${encodeURIComponent(namespace)}/rolebindings`,
              { query: { limit: -1 }, ...(params.signal ? { signal: params.signal } : {}) },
            );
            return [namespace, rolesForUser(body?.items ?? [], params.username)] as const;
          } catch {
            // A project the member cannot read is not an error on this page: it simply has no role.
            return [namespace, []] as const;
          }
        }),
      );
      return Object.fromEntries(entries);
    },
    async memberDevops(params: {
      workspace: string;
      username: string;
      cluster?: string;
      signal?: AbortSignal;
    }): Promise<WorkspaceMemberResource[]> {
      return readCollection({ ...params, kind: 'devops' });
    },
  };
}

export interface WorkspaceRoleSummary {
  name: string;
  alias: string;
  ruleCount: number;
  createdAt: string;
  /** `kubesphere.io/creator`; platform-maintained roles are `system` and read-only. */
  creator: string;
}

/** One workspace role, including the templates it aggregates. */
export interface WorkspaceRoleDetail extends WorkspaceRoleSummary {
  description: string;
  /** `iam.kubesphere.io/aggregation-roles` parsed; the server turns these into rules. */
  aggregationRoles: string[];
  /** All annotations, for the shared edit-info dialog (merge preserves untouched keys). */
  annotations: Record<string, string>;
}

export interface WorkspaceRoleTemplate {
  name: string;
  alias: string;
  description: string;
  ruleCount: number;
}

const WORKSPACE_ROLE_AGGREGATION = 'iam.kubesphere.io/aggregation-roles';

function workspaceRolePath(workspace: string, name?: string): string {
  return `${KAPIS_IAM}/workspaces/${encodeURIComponent(workspace)}/workspaceroles${name ? `/${encodeURIComponent(name)}` : ''}`;
}

function workspaceRoleFrom(item: KubeAccess): WorkspaceRoleDetail {
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  let aggregationRoles: string[] = [];
  try {
    const parsed: unknown = JSON.parse(annotations[WORKSPACE_ROLE_AGGREGATION] ?? '[]');
    if (Array.isArray(parsed)) aggregationRoles = parsed.map(String);
  } catch {
    // A malformed annotation is an object condition; the role still exists.
    aggregationRoles = [];
  }
  return {
    name: item.metadata?.name ?? '',
    alias: annotations['kubesphere.io/alias-name'] ?? '',
    description: annotations['kubesphere.io/description'] ?? '',
    ruleCount: (item.rules ?? []).length,
    aggregationRoles,
    createdAt: item.metadata?.creationTimestamp ?? '',
    creator: annotations['kubesphere.io/creator'] ?? '',
    annotations,
  };
}

export function workspaceRolesApi(client: Client) {
  return {
    async list(params: { workspace: string; signal?: AbortSignal }): Promise<WorkspaceRoleSummary[]> {
      const body = await client.request<{ items?: KubeAccess[] }>(workspaceRolePath(params.workspace), {
        query: { limit: -1 },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (body?.items ?? []).map(workspaceRoleFrom);
    },

    /** One role with its aggregation templates. */
    async get(params: { workspace: string; name: string; signal?: AbortSignal }): Promise<WorkspaceRoleDetail> {
      const item = await client.request<KubeAccess>(workspaceRolePath(params.workspace, params.name), {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return workspaceRoleFrom(item);
    },

    /**
     * The platform's workspace-role templates.
     *
     * They live in the same collection, marked by `iam.kubesphere.io/role-template`; the
     * 19 templates this list holds are what a custom workspace role may aggregate.
     */
    async templates(params: { workspace: string; signal?: AbortSignal }): Promise<WorkspaceRoleTemplate[]> {
      const body = await client.request<{ items?: KubeAccess[] }>(workspaceRolePath(params.workspace), {
        query: { limit: -1, labelSelector: 'iam.kubesphere.io/role-template' },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (body?.items ?? []).map((item) => {
        const summary = workspaceRoleFrom(item);
        return { name: summary.name, alias: summary.alias, description: summary.description, ruleCount: summary.ruleCount };
      });
    },
  };
}

export function workspaceRolesWriteApi(client: Client) {
  return {
    /**
     * Create a workspace role from template names.
     *
     * The object carries **rules: []** and an aggregation-roles annotation: ks-apiserver
     * aggregates the templates' rules into `rules`. Writing rules directly would diverge
     * from what the built-in roles do and would stop tracking template updates.
     */
    async create(params: {
      workspace: string;
      name: string;
      alias: string;
      description: string;
      templates: string[];
    }): Promise<WorkspaceRoleDetail> {
      const annotations: Record<string, string> = {
        [WORKSPACE_ROLE_AGGREGATION]: JSON.stringify(params.templates),
      };
      if (params.alias.trim()) annotations['kubesphere.io/alias-name'] = params.alias.trim();
      if (params.description.trim()) annotations['kubesphere.io/description'] = params.description.trim();
      const item = await client.request<KubeAccess>(workspaceRolePath(params.workspace), {
        method: 'POST',
        body: {
          apiVersion: 'iam.kubesphere.io/v1alpha2',
          kind: 'WorkspaceRole',
          metadata: { name: params.name, annotations },
          rules: [],
        },
      });
      return workspaceRoleFrom(item);
    },

    /** Replace alias/description only; removed annotations are sent as null. */
    async updateInfo(params: { workspace: string; name: string; annotations: Record<string, string> }): Promise<void> {
      const current = await client.request<KubeAccess>(workspaceRolePath(params.workspace, params.name));
      const existing = (current.metadata?.annotations ?? {}) as Record<string, string>;
      const patch: Record<string, string | null> = {};
      for (const key of Object.keys(existing)) {
        if (!(key in params.annotations)) patch[key] = null;
      }
      for (const [key, value] of Object.entries(params.annotations)) {
        if (existing[key] !== value) patch[key] = value;
      }
      if (Object.keys(patch).length === 0) return;
      await client.request(workspaceRolePath(params.workspace, params.name), {
        method: 'PATCH',
        contentType: 'application/merge-patch+json',
        body: { metadata: { annotations: patch } },
      });
    },

    /** Replace the aggregated templates (the old "编辑权限"). */
    async setTemplates(params: { workspace: string; name: string; templates: string[] }): Promise<void> {
      await client.request(workspaceRolePath(params.workspace, params.name), {
        method: 'PATCH',
        contentType: 'application/merge-patch+json',
        body: { metadata: { annotations: { [WORKSPACE_ROLE_AGGREGATION]: JSON.stringify(params.templates) } } },
      });
    },

    async remove(params: { workspace: string; name: string }): Promise<void> {
      await client.request<void>(workspaceRolePath(params.workspace, params.name), { method: 'DELETE' });
    },
  };
}

const GROUP_PARENT_LABEL = 'iam.kubesphere.io/group-parent';
const GROUP_REF_LABEL = 'iam.kubesphere.io/group-ref';
const USER_REF_LABEL = 'iam.kubesphere.io/user-ref';
const WORKSPACE_LABEL = 'kubesphere.io/workspace';
const ALIAS_ANN = 'kubesphere.io/alias-name';
const DESC_ANN = 'kubesphere.io/description';
const WORKSPACE_ROLE_ANN = 'kubesphere.io/workspace-role';

export interface WorkspaceGroupSummary {
  /** Object name; generated from `generateName` and used in bindings. */
  name: string;
  /** Display name the old department form stored as `metadata.generateName`. */
  generateName: string;
  /** Alias, else generateName, else object name. */
  displayName: string;
  alias: string;
  description: string;
  /** Parent group's object name; empty means the workspace root. */
  parent: string;
  workspaceRole: string;
  memberCount: number;
  createdAt: string;
}

export interface WorkspaceGroupNode {
  group: WorkspaceGroupSummary;
  children: WorkspaceGroupNode[];
}

export interface WorkspaceGroupMember {
  username: string;
}

interface KubeGroupBinding {
  metadata?: { name?: string };
  groupRef?: { name?: string };
  users?: string[];
}

interface KubeRoleBinding {
  metadata?: { name?: string; labels?: Record<string, string> };
  subjects?: Array<{ kind?: string; name?: string }>;
  roleRef?: { name?: string; kind?: string };
}

function generateNameOf(item: KubeAccess): string {
  return String((item.metadata as { generateName?: string } | undefined)?.generateName ?? '');
}

export function toWorkspaceGroupSummary(item: KubeAccess, memberCount = 0): WorkspaceGroupSummary {
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  const labels = (item.metadata?.labels ?? {}) as Record<string, string>;
  const name = item.metadata?.name ?? '';
  const generateName = generateNameOf(item);
  const alias = annotations[ALIAS_ANN] ?? '';
  return {
    name,
    generateName,
    displayName: alias || generateName || name,
    alias,
    description: annotations[DESC_ANN] ?? '',
    parent: labels[GROUP_PARENT_LABEL] ?? '',
    workspaceRole: annotations[WORKSPACE_ROLE_ANN] ?? '',
    memberCount,
    createdAt: item.metadata?.creationTimestamp ?? '',
  };
}

/**
 * Build the department tree from the parent label.
 *
 * A missing, self, or unknown parent becomes a root. Cycles are broken by
 * attaching the leftover nodes as extra roots rather than dropping them: a
 * corrupt label should still leave the group visible.
 */
export function workspaceGroupForest(groups: WorkspaceGroupSummary[]): WorkspaceGroupNode[] {
  const byName = new Map(groups.map((group) => [group.name, group]));
  const children = new Map<string, WorkspaceGroupSummary[]>();
  const roots: WorkspaceGroupSummary[] = [];
  for (const group of groups) {
    const parent = group.parent && byName.has(group.parent) && group.parent !== group.name ? group.parent : '';
    if (!parent) {
      roots.push(group);
      continue;
    }
    const list = children.get(parent) ?? [];
    list.push(group);
    children.set(parent, list);
  }
  const assigned = new Set<string>();
  const walk = (group: WorkspaceGroupSummary, ancestors: Set<string>): WorkspaceGroupNode => {
    assigned.add(group.name);
    const next = new Set(ancestors);
    next.add(group.name);
    return {
      group,
      children: (children.get(group.name) ?? [])
        .filter((child) => !ancestors.has(child.name))
        .map((child) => walk(child, next)),
    };
  };
  const forest = roots.map((group) => walk(group, new Set()));
  for (const group of groups) {
    if (!assigned.has(group.name)) forest.push(walk(group, new Set()));
  }
  return forest;
}

function memberCounts(bindings: KubeGroupBinding[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const binding of bindings) {
    const group = binding.groupRef?.name ?? '';
    if (!group) continue;
    counts.set(group, (counts.get(group) ?? 0) + (binding.users ?? []).length);
  }
  return counts;
}

function workspaceRoleBindingBody(groupName: string, role: string): Record<string, unknown> {
  return {
    kind: 'WorkspaceRoleBinding',
    apiVersion: 'iam.kubesphere.io/v1alpha2',
    subjects: [{ kind: 'Group', apiGroup: 'rbac.authorization.k8s.io', name: groupName }],
    roleRef: { apiGroup: 'iam.kubesphere.io/v1alpha2', kind: 'WorkspaceRole', name: role },
  };
}

/**
 * The roles a user holds in one namespace, read from its role bindings.
 *
 * KubeSphere binds project roles as ordinary namespaced `RoleBinding`s whose subjects carry the
 * user name, so "which role does this member have in this project" is a filter, not a new endpoint.
 */
export function rolesForUser(bindings: KubeRoleBinding[], username: string): string[] {
  const roles = new Set<string>();
  for (const binding of bindings) {
    const subjects = binding.subjects ?? [];
    if (!subjects.some((subject) => subject?.name === username)) continue;
    const role = binding.roleRef?.name;
    if (role) roles.add(role);
  }
  return [...roles].sort();
}

export function workspaceGroupsApi(client: Client) {
  const groupsPath = (workspace: string, name?: string) =>
    `${KAPIS_IAM}/workspaces/${encodeURIComponent(workspace)}/groups${name ? `/${encodeURIComponent(name)}` : ''}`;
  const bindingsPath = (workspace: string, name?: string) =>
    `${KAPIS_IAM}/workspaces/${encodeURIComponent(workspace)}/groupbindings${name ? `/${encodeURIComponent(name)}` : ''}`;
  const roleBindingsPath = (workspace: string, name?: string) =>
    `${KAPIS_IAM}/workspaces/${encodeURIComponent(workspace)}/workspacerolebindings${name ? `/${encodeURIComponent(name)}` : ''}`;

  async function ignore(kind: 'notfound' | 'conflict', run: () => Promise<unknown>): Promise<void> {
    try {
      await run();
    } catch (error) {
      if (error instanceof ApiError && (kind === 'notfound' ? error.isNotFound : error.isConflict)) return;
      throw error;
    }
  }

  async function listBindings(workspace: string, signal?: AbortSignal): Promise<KubeGroupBinding[]> {
    const body = await client.request<{ items?: KubeGroupBinding[] }>(bindingsPath(workspace), {
      query: { limit: -1 },
      ...(signal ? { signal } : {}),
    });
    return body?.items ?? [];
  }

  async function roleBindingsForGroup(workspace: string, group: string): Promise<KubeRoleBinding[]> {
    const labelled = await client.request<{ items?: KubeRoleBinding[] }>(roleBindingsPath(workspace), {
      query: { limit: -1, labelSelector: `${GROUP_REF_LABEL}=${group}` },
    }).catch(() => ({ items: [] as KubeRoleBinding[] }));
    if (labelled?.items?.length) return labelled.items;
    const body = await client.request<{ items?: KubeRoleBinding[] }>(roleBindingsPath(workspace), {
      query: { limit: -1 },
    });
    return (body?.items ?? []).filter((item) =>
      (item.subjects ?? []).some((subject) => subject.kind === 'Group' && subject.name === group),
    );
  }

  return {
    async list(params: { workspace: string; signal?: AbortSignal }): Promise<WorkspaceGroupSummary[]> {
      const [groupsBody, bindings] = await Promise.all([
        client.request<{ items?: KubeAccess[] }>(groupsPath(params.workspace), {
          query: { limit: -1 },
          ...(params.signal ? { signal: params.signal } : {}),
        }),
        listBindings(params.workspace, params.signal),
      ]);
      const counts = memberCounts(bindings);
      return (groupsBody?.items ?? []).map((item) =>
        toWorkspaceGroupSummary(item, counts.get(item.metadata?.name ?? '') ?? 0),
      );
    },

    async members(params: { workspace: string; group: string; signal?: AbortSignal }): Promise<WorkspaceGroupMember[]> {
      const users = new Set<string>();
      for (const binding of await listBindings(params.workspace, params.signal)) {
        if ((binding.groupRef?.name ?? '') !== params.group) continue;
        for (const user of binding.users ?? []) {
          if (user) users.add(user);
        }
      }
      return [...users].sort().map((username) => ({ username }));
    },

    async create(params: {
      workspace: string;
      generateName: string;
      alias: string;
      parent: string;
      workspaceRole: string;
    }): Promise<WorkspaceGroupSummary> {
      const generateName = params.generateName.trim();
      const alias = params.alias.trim();
      const parent = params.parent.trim();
      const workspaceRole = params.workspaceRole.trim();
      const annotations: Record<string, string> = {};
      if (alias) annotations[ALIAS_ANN] = alias;
      if (workspaceRole) annotations[WORKSPACE_ROLE_ANN] = workspaceRole;
      const labels: Record<string, string> = { [WORKSPACE_LABEL]: params.workspace };
      if (parent) labels[GROUP_PARENT_LABEL] = parent;
      const created = await client.request<KubeAccess>(groupsPath(params.workspace), {
        method: 'POST',
        body: {
          apiVersion: 'iam.kubesphere.io/v1alpha2',
          kind: 'Group',
          metadata: { generateName, labels, ...(Object.keys(annotations).length ? { annotations } : {}) },
        },
      });
      const name = created?.metadata?.name ?? '';
      if (!name) throw new Error('Group create returned no object name');
      if (workspaceRole) {
        await ignore('conflict', () =>
          client.request(roleBindingsPath(params.workspace), {
            method: 'POST',
            body: [workspaceRoleBindingBody(name, workspaceRole)],
          }),
        );
      }
      return toWorkspaceGroupSummary(created, 0);
    },

    async update(params: {
      workspace: string;
      name: string;
      alias: string;
      parent: string;
      workspaceRole: string;
    }): Promise<void> {
      const current = await client.request<KubeAccess>(groupsPath(params.workspace, params.name));
      const previousRole = toWorkspaceGroupSummary(current).workspaceRole;
      const alias = params.alias.trim();
      const parent = params.parent.trim();
      const workspaceRole = params.workspaceRole.trim();
      const annotations = { ...((current.metadata?.annotations ?? {}) as Record<string, string>) };
      annotations[ALIAS_ANN] = alias;
      annotations[WORKSPACE_ROLE_ANN] = workspaceRole;
      const labels = { ...((current.metadata?.labels ?? {}) as Record<string, string>) };
      if (parent) labels[GROUP_PARENT_LABEL] = parent;
      else delete labels[GROUP_PARENT_LABEL];
      await client.request(groupsPath(params.workspace, params.name), {
        method: 'PATCH',
        contentType: 'application/merge-patch+json',
        body: {
          metadata: {
            labels: parent ? labels : { ...labels, [GROUP_PARENT_LABEL]: null },
            annotations,
          },
        },
      });
      if (workspaceRole === previousRole) return;
      for (const binding of await roleBindingsForGroup(params.workspace, params.name)) {
        const bindingName = binding.metadata?.name ?? '';
        if (bindingName) await ignore('notfound', () => client.request(roleBindingsPath(params.workspace, bindingName), { method: 'DELETE' }));
      }
      if (workspaceRole) {
        await ignore('conflict', () =>
          client.request(roleBindingsPath(params.workspace), {
            method: 'POST',
            body: [workspaceRoleBindingBody(params.name, workspaceRole)],
          }),
        );
      }
    },

    async remove(params: { workspace: string; name: string }): Promise<void> {
      for (const binding of await listBindings(params.workspace)) {
        if ((binding.groupRef?.name ?? '') !== params.name) continue;
        const bindingName = binding.metadata?.name ?? '';
        if (bindingName) await ignore('notfound', () => client.request(bindingsPath(params.workspace, bindingName), { method: 'DELETE' }));
      }
      for (const binding of await roleBindingsForGroup(params.workspace, params.name)) {
        const bindingName = binding.metadata?.name ?? '';
        if (bindingName) await ignore('notfound', () => client.request(roleBindingsPath(params.workspace, bindingName), { method: 'DELETE' }));
      }
      await ignore('notfound', () => client.request(groupsPath(params.workspace, params.name), { method: 'DELETE' }));
    },

    async addMembers(params: { workspace: string; group: string; usernames: string[] }): Promise<void> {
      for (const username of params.usernames) {
        const user = await client.request<KubeAccess>(`${KAPIS_IAM}/users/${encodeURIComponent(username)}`);
        if (user?.metadata?.name !== username) throw new Error('User account does not exist');
      }
      await client.request(bindingsPath(params.workspace), {
        method: 'POST',
        body: params.usernames.map((userName) => ({ userName, groupName: params.group })),
      });
    },

    async removeMember(params: { workspace: string; group: string; username: string }): Promise<void> {
      const labelled = await client.request<{ items?: KubeGroupBinding[] }>(bindingsPath(params.workspace), {
        query: {
          limit: -1,
          labelSelector: `${GROUP_REF_LABEL}=${params.group},${USER_REF_LABEL}=${params.username}`,
        },
      });
      const found = labelled?.items?.length
        ? labelled.items
        : (await listBindings(params.workspace)).filter(
            (binding) => (binding.groupRef?.name ?? '') === params.group && (binding.users ?? []).includes(params.username),
          );
      for (const binding of found) {
        const bindingName = binding.metadata?.name ?? '';
        if (bindingName) await ignore('notfound', () => client.request(bindingsPath(params.workspace, bindingName), { method: 'DELETE' }));
      }
    },
  };
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

    /**
     * The clusters this workspace can use.
     *
     * Read from the tenant aggregate, not from `spec.placement.clusters`: the aggregate
     * is what the platform uses for visibility, and it carries the cluster objects
     * (provider/version/node count/Ready) the overview's cluster cards show. A workspace
     * with no authorized cluster answers an empty list, which is a fact, not an error.
     */
    async clusters(params: { name: string; signal?: AbortSignal }): Promise<WorkspaceClusterSummary[]> {
      const body = await client.request<{ items?: KubeAccess[] }>(`${path(params.name)}/clusters`, {
        query: { limit: -1 },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (body?.items ?? []).map(toWorkspaceClusterSummary);
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

/** Who a platform role is granted to: one subject per role binding. */
export interface RoleSubject {
  /** `User` / `Group` / `ServiceAccount`. */
  kind: string;
  name: string;
  /** Only meaningful for a ServiceAccount subject. */
  namespace: string;
  /** The binding that grants it, so two bindings for one subject stay distinguishable. */
  binding: string;
}

export function roleBindingsApi(client: Client) {
  return {
    /**
     * Subjects of every cluster role binding that points at `role`.
     *
     * There is no per-role subjects endpoint: the binding list is small (142 on B200) and
     * filtering it client-side is what the old console does too. Reading it as one request also
     * means the page cannot show a role as unused because a second page of bindings was missed.
     */
    async subjectsOf(params: { role: string; signal?: AbortSignal }): Promise<RoleSubject[]> {
      const body = await client.request<{ items?: Array<Record<string, unknown>> }>(
        '/apis/rbac.authorization.k8s.io/v1/clusterrolebindings',
        { query: { limit: 500 }, ...(params.signal ? { signal: params.signal } : {}) },
      );
      const out: RoleSubject[] = [];
      for (const item of body?.items ?? []) {
        const roleRef = (item['roleRef'] ?? {}) as Record<string, unknown>;
        if (String(roleRef['name'] ?? '') !== params.role) continue;
        const metadata = (item['metadata'] ?? {}) as Record<string, unknown>;
        const binding = String(metadata['name'] ?? '');
        for (const subject of ((item['subjects'] ?? []) as Array<Record<string, unknown>>)) {
          out.push({
            kind: String(subject['kind'] ?? ''),
            name: String(subject['name'] ?? ''),
            namespace: String(subject['namespace'] ?? ''),
            binding,
          });
        }
      }
      return out;
    },
  };
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
      description?: string;
    }): Promise<UserSummary> {
      const annotations: Record<string, string> = {
        'iam.kubesphere.io/platform-role': params.platformRole,
        // First sign-in must set a password of their own. The old create action
        // always wrote this; omitting it lets the initial password live forever.
        'iam.kubesphere.io/uninitialized': 'true',
      };
      if (params.description) annotations['kubesphere.io/description'] = params.description;
      const item = await client.request<KubeAccess>(`${KAPIS_IAM}/users`, {
        method: 'POST',
        body: {
          apiVersion: 'iam.kubesphere.io/v1alpha2',
          kind: 'User',
          metadata: {
            name: params.name,
            annotations,
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
    /**
     * Edit a user's email and description.
     *
     * Same PUT shape as the other user writes (the IAM endpoint answers 405 to PATCH), and the
     * object is read first so the update carries a current `resourceVersion` instead of a stale
     * one. Only these two fields are touched: everything else on the object belongs to the
     * platform.
     */
    async updateUser(params: { name: string; email: string; description: string }): Promise<UserSummary> {
      const path = `${KAPIS_IAM}/users/${encodeURIComponent(params.name)}`;
      const current = await client.request<KubeAccess>(path);
      const updated = await client.request<KubeAccess>(path, {
        method: 'PUT',
        body: {
          ...current,
          spec: { ...((current?.spec ?? {}) as Record<string, unknown>), email: params.email },
          metadata: {
            ...current?.metadata,
            annotations: {
              ...((current?.metadata?.annotations ?? {}) as Record<string, string>),
              'kubesphere.io/description': params.description,
            },
          },
        },
      });
      return toUserSummary(updated ?? {});
    },

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
     * Administrator reset of another account's password.
     *
     * Same `/password` endpoint as personal settings, but the body is **only**
     * `{ password }`. Sending `currentPassword` is the self-service shape; for another
     * user the apiserver treats that field as *their* current password and answers
     * 400 `incorrect old password`. Verified: `{ password }` returns 200, after which
     * the new value signs in and the old one does not.
     */
    async resetPassword(params: { name: string; password: string }): Promise<void> {
      await client.request<void>(`${KAPIS_IAM}/users/${encodeURIComponent(params.name)}/password`, {
        method: 'PUT',
        body: { password: params.password },
      });
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
 * The signed-in account's own settings.
 *
 * Separate from `usersWriteApi` because these two writes are the ones a user performs on
 * *their own* object: an administrator creating any account is a different authority than
 * a regular user changing their own email. Both were verified against the live cluster as
 * `platform-regular` — no platform role is needed, which is the whole point of a personal
 * settings dialog.
 */
export function userSettingsApi(client: Client) {
  const path = (name: string) => `${KAPIS_IAM}/users/${encodeURIComponent(name)}`;
  return {
    /**
     * Change the email on one's own account.
     *
     * A whole-object PUT, because the IAM users endpoint answers **405** to PATCH (the same
     * finding as `setActive`). The object is read first for a current `resourceVersion` —
     * a stale one is rejected with 409 — and everything except `spec.email` is sent back
     * untouched: dropping the `platform-role` annotation in a PUT would silently demote the
     * account, which is a far worse outcome than the edit failing.
     */
    async updateProfile(params: { name: string; email: string }): Promise<UserSummary> {
      const current = await client.request<KubeAccess>(path(params.name));
      const updated = await client.request<KubeAccess>(path(params.name), {
        method: 'PUT',
        body: {
          ...current,
          spec: { ...((current?.spec ?? {}) as Record<string, unknown>), email: params.email },
        },
      });
      return toUserSummary(updated ?? {});
    },

    /**
     * Change one's own password.
     *
     * Its own endpoint (`/users/<name>/password`), and the only write in the console that
     * the platform authorises by knowing the **current** password rather than by a role
     * binding. It answers `200 {"message":"success"}`; a wrong current password is a **400
     * with a plain-text body** (`incorrect old password`), and a password that breaks the
     * platform rule is a 422 whose body is the whole admission regex — neither is fit to
     * show a reader, so the caller phrases both.
     *
     * The session survives this call: verified that the same token still answers
     * `/api/session/me` with 200 afterwards. Whoever calls this must sign out explicitly,
     * or "changed my password" leaves the old session usable.
     */
    async changePassword(params: { name: string; currentPassword: string; password: string }): Promise<void> {
      await client.request<void>(`${path(params.name)}/password`, {
        method: 'PUT',
        body: { currentPassword: params.currentPassword, password: params.password },
      });
    },
  };
}

/**
 * Password rules the platform enforces.
 *
 * Checked here so a weak password is refused with a sentence instead of the apiserver's
 * 422, whose body is the entire admission regex:
 * `spec.password in body should match '^(.*[a-z].*[A-Z].*[0-9].*)$|...'`.
 *
 * The rule is the platform's, not this console's: the User CRD requires 8–64 **bytes** and
 * **all three** of a lowercase letter, an uppercase letter and a digit. Two of those were
 * missing here until the personal-settings dialog needed the same rule — without them the
 * create-user form accepted `abcdefgh1` (no upper-case letter) and a long passphrase, both
 * of which the server rejects with a 422.
 */
/**
 * The special characters the platform's own PASSWORD_DESC names, plus space.
 *
 * Kept as a character class rather than `[^A-Za-z0-9]` so the rule matches the sentence the
 * reader is shown: a password whose only "special" character is an emoji satisfies the looser
 * test and not the copy, and a rule that disagrees with its own explanation is how the old
 * console ended up promising a special character it never checked for.
 */
const PASSWORD_SPECIAL = /[~!@#$%^&*()\-_=+\\|[\]{};:'",<.>/? ]/;

/** Which of the platform's password requirements a value meets. */
export interface PasswordChecks {
  /** 8 characters or more, and no more than 64 bytes. */
  length: boolean;
  /** Has both an upper-case and a lower-case letter. */
  letterCase: boolean;
  digit: boolean;
  special: boolean;
}

/**
 * The requirements, item by item, for the strength panel.
 *
 * Separate from `passwordProblem` so the panel can tick each item as it is met instead of
 * waiting for the whole password to be judged: "which one am I still missing" is the question
 * a reader has while typing.
 */
export function passwordChecks(password: string): PasswordChecks {
  return {
    length: password.length >= 8 && new TextEncoder().encode(password).length <= 64,
    letterCase: /[a-z]/.test(password) && /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
    special: PASSWORD_SPECIAL.test(password),
  };
}

/**
 * The first unmet requirement, as a code the caller turns into a sentence.
 *
 * The console is **stricter than the apiserver** on purpose. The User CRD requires 8–64 bytes
 * plus lower case, upper case and a digit; the platform's own `PASSWORD_DESC` promises a
 * special character as well, and the old console printed that promise while validating against
 * a pattern that did not include it — the copy was lying. Here the copy is the rule.
 *
 * That means an account can still be created through the API with a password this form would
 * refuse. The console is the only place the rule is enforced, which is the trade this makes:
 * a stronger default for everyone who uses the UI, not a guarantee about the cluster.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'too-short';
  // Measured in bytes, because that is what the CRD measures: a 30-character passphrase in
  // Chinese is 90 bytes and is rejected with "may not be more than 64 bytes".
  if (new TextEncoder().encode(password).length > 64) return 'too-long';
  if (!/[A-Za-z]/.test(password)) return 'no-letter';
  if (!/[a-z]/.test(password)) return 'no-lower';
  if (!/[A-Z]/.test(password)) return 'no-upper';
  if (!/[0-9]/.test(password)) return 'no-digit';
  if (!PASSWORD_SPECIAL.test(password)) return 'no-special';
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

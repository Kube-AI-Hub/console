import type { Client } from './client';

/**
 * 应用商店（openpitrix）.
 *
 * KubeSphere's store is served from its own API group (`/kapis/openpitrix.io/v1`), and it is
 * **not** a Kubernetes object collection: the fields are snake_case (`category_id`,
 * `app_total`, `create_time`) and paging uses `page` / `limit` with a `total` count. That is
 * why this client does its own mapping instead of reusing `resourceApi`.
 *
 * The migration plan recorded the store as "openpitrix module off, not migrating". The flag
 * actually reads `true` and every one of these endpoints answers 200, so the pages were
 * buildable all along; what was missing was the menu — which is exactly the kind of thing
 * the module flag does gate.
 */
const OPENPITRIX = '/kapis/openpitrix.io/v1';

/** A store category. `locale` arrives as a JSON string, e.g. `{"zh-CN":{"name":"…"}}`. */
export interface StoreCategory {
  id: string;
  name: string;
  description: string;
  appTotal: number;
  createdAt: string;
}

export interface StoreApp {
  id: string;
  name: string;
  description: string;
  categoryIds: string[];
  workspace: string;
  status: string;
  createdAt: string;
}

/** One published version of a store app. */
export interface StoreAppVersion {
  /** `version_id`; the identifier the file/readme endpoints take. */
  id: string;
  appId: string;
  /** Human version label, e.g. `1.6.8 [5.7.31]`. */
  name: string;
  /** `active` today; the field is free-form, so the page shows it verbatim. */
  status: string;
  active: boolean;
  createdAt: string;
  statusTime: string;
  packageName: string;
  home: string;
  icon: string;
  /** Parsed from the JSON-encoded `maintainers` string. */
  maintainers: string[];
  /** Parsed from the JSON-encoded `sources` string. */
  sources: string[];
}

/** One app plus the fields only the detail endpoint returns. */
export interface StoreAppDetail extends StoreApp {
  /** `latest_app_version.icon`; empty when the chart did not declare one. */
  icon: string;
  categories: Array<{ id: string; name: string }>;
  home: string;
  isv: string;
  statusTime: string;
  /** `app_version_types`, e.g. `helm`. Versions do not carry their own type. */
  versionTypes: string;
  clusterTotal: number;
  latestVersion: StoreAppVersion | null;
}

/** The chart files of one version, as base64 by path. */
export interface StoreAppFiles {
  versionId: string;
  files: Record<string, string>;
}

export interface StoreReview {
  id: string;
  appId: string;
  appName: string;
  status: string;
  reviewer: string;
  createdAt: string;
}

interface RawCategory {
  category_id?: string;
  name?: string;
  description?: string;
  locale?: string;
  app_total?: number;
  create_time?: string;
}

interface RawApp {
  app_id?: string;
  name?: string;
  description?: string;
  category_id?: string;
  category_ids?: string[];
  workspace?: string;
  status?: string;
  create_time?: string;
}

interface RawVersion {
  version_id?: string;
  app_id?: string;
  name?: string;
  status?: string;
  active?: boolean;
  create_time?: string;
  status_time?: string;
  package_name?: string;
  home?: string;
  icon?: string;
  maintainers?: string;
  sources?: string;
}

interface RawAppDetail extends RawApp {
  category_set?: RawCategory[];
  latest_app_version?: RawVersion;
  home?: string;
  isv?: string;
  status_time?: string;
  app_version_types?: string;
  cluster_total?: number;
}

interface RawReview {
  review_id?: string;
  app_id?: string;
  app_name?: string;
  status?: string;
  reviewer?: string;
  create_time?: string;
}

/** The default locale name out of `locale`, which is a JSON string rather than an object. */
function localeName(locale: string | undefined, fallback: string): string {
  if (!locale) return fallback;
  try {
    const parsed = JSON.parse(locale) as Record<string, { name?: string }>;
    for (const key of ['zh-CN', 'zh', 'en']) {
      const name = parsed[key]?.name;
      if (name) return name;
    }
    const first = Object.values(parsed)[0]?.name;
    if (first) return first;
  } catch {
    // A malformed locale is not worth failing a page over; the raw name still shows.
  }
  return fallback;
}

export function toStoreCategory(item: RawCategory): StoreCategory {
  const rawName = item.name ?? '';
  return {
    id: item.category_id ?? '',
    name: localeName(item.locale, rawName),
    description: item.description ?? '',
    appTotal: Number(item.app_total ?? 0),
    createdAt: item.create_time ?? '',
  };
}

export function toStoreApp(item: RawApp): StoreApp {
  return {
    id: item.app_id ?? '',
    name: item.name ?? '',
    description: item.description ?? '',
    categoryIds: item.category_ids ?? (item.category_id ? [item.category_id] : []),
    workspace: item.workspace ?? '',
    status: item.status ?? '',
    createdAt: item.create_time ?? '',
  };
}

/** Parse a JSON-encoded array field; openpitrix stores these as strings. */
function parseStringArray(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
  } catch {
    return [];
  }
}

/** Maintainers are objects ({name,email}); keep a readable "name <email>" label. */
function parseMaintainers(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        const record = entry as { name?: string; email?: string };
        return record.name ? (record.email ? `${record.name} <${record.email}>` : record.name) : '';
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function toStoreAppVersion(item: RawVersion): StoreAppVersion {
  return {
    id: item.version_id ?? '',
    appId: item.app_id ?? '',
    name: item.name ?? '',
    status: item.status ?? '',
    active: item.active === true,
    createdAt: item.create_time ?? '',
    statusTime: item.status_time ?? '',
    packageName: item.package_name ?? '',
    home: item.home ?? '',
    icon: item.icon ?? '',
    maintainers: parseMaintainers(item.maintainers),
    sources: parseStringArray(item.sources),
  };
}

export function toStoreAppDetail(item: RawAppDetail): StoreAppDetail {
  const latestVersion = item.latest_app_version ? toStoreAppVersion(item.latest_app_version) : null;
  const base = toStoreApp(item);
  return {
    ...base,
    icon: latestVersion?.icon ?? '',
    categories: (item.category_set ?? []).map((category) => ({
      id: category.category_id ?? '',
      name: category.name ?? '',
    })),
    home: item.home ?? '',
    isv: item.isv ?? '',
    statusTime: item.status_time ?? '',
    versionTypes: item.app_version_types ?? '',
    clusterTotal: Number(item.cluster_total ?? 0),
    latestVersion,
  };
}

/**
 * Decode one base64 chart file.
 *
 * The files endpoint returns every chart file base64-encoded, including README.md. Only the
 * text is needed here, and a malformed entry must not take the page down, so failures decode
 * to an empty string rather than throwing.
 */
export function decodeStoreFile(content: string | undefined): string {
  if (!content) return '';
  try {
    const binary = globalThis.atob(content);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

export function toStoreReview(item: RawReview): StoreReview {
  return {
    id: item.review_id ?? '',
    appId: item.app_id ?? '',
    appName: item.app_name ?? '',
    status: item.status ?? '',
    reviewer: item.reviewer ?? '',
    createdAt: item.create_time ?? '',
  };
}

interface ListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryId?: string;
  status?: string;
  signal?: AbortSignal;
}

async function listRaw<T>(client: Client, path: string, query: ListQuery): Promise<{ items: T[]; total: number }> {
  const response = await client.request<{ items?: T[]; total?: number; total_count?: number }>(path, {
    query: {
      page: query.page ?? 1,
      limit: query.pageSize ?? 10,
      ...(query.keyword?.trim() ? { keyword: query.keyword.trim() } : {}),
      ...(query.categoryId ? { category_id: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      // `noLimit` is how the store asks for everything at once; the categories filter needs it.
      ...(query.pageSize === -1 ? { noLimit: true } : {}),
    },
    ...(query.signal ? { signal: query.signal } : {}),
  });
  return { items: response?.items ?? [], total: response?.total ?? response?.total_count ?? response?.items?.length ?? 0 };
}

export function storeCategoriesApi(client: Client) {
  return {
    async list(query: ListQuery = {}): Promise<{ items: StoreCategory[]; total: number }> {
      const { items, total } = await listRaw<RawCategory>(client, `${OPENPITRIX}/categories`, query);
      return { items: items.map(toStoreCategory), total };
    },
  };
}

export function storeAppsApi(client: Client) {
  return {
    async list(query: ListQuery = {}): Promise<{ items: StoreApp[]; total: number }> {
      const { items, total } = await listRaw<RawApp>(client, `${OPENPITRIX}/apps`, query);
      return { items: items.map(toStoreApp), total };
    },

    /** One app; the detail endpoint adds categories, the latest version and the app icon. */
    async get(params: { appId: string; signal?: AbortSignal }): Promise<StoreAppDetail> {
      const body = await client.request<RawAppDetail>(`${OPENPITRIX}/apps/${encodeURIComponent(params.appId)}`, {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return toStoreAppDetail(body ?? {});
    },

    /**
     * Every version of one app, newest first.
     *
     * The store returns them in creation order; the page's table is a release history, so the
     * newest release is shown first. The versions endpoint has the `total_count` envelope.
     */
    async versions(params: { appId: string; signal?: AbortSignal }): Promise<StoreAppVersion[]> {
      const body = await client.request<{ items?: RawVersion[] }>(
        `${OPENPITRIX}/apps/${encodeURIComponent(params.appId)}/versions`,
        {
          query: { page: 1, limit: 100 },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      return (body?.items ?? [])
        .map(toStoreAppVersion)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    /** One version's chart files, decoded lazily into README text. */
    async readme(params: { appId: string; versionId: string; signal?: AbortSignal }): Promise<string> {
      const body = await client.request<{ files?: Record<string, string> }>(
        `${OPENPITRIX}/apps/${encodeURIComponent(params.appId)}/versions/${encodeURIComponent(params.versionId)}/files`,
        {
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      return decodeStoreFile(body?.files?.['README.md']);
    },
  };
}

export function storeReviewsApi(client: Client) {
  return {
    async list(query: ListQuery = {}): Promise<{ items: StoreReview[]; total: number }> {
      const { items, total } = await listRaw<RawReview>(client, `${OPENPITRIX}/reviews`, query);
      return { items: items.map(toStoreReview), total };
    },
  };
}

/**
 * 企业空间应用仓库（写）.
 *
 * Creating a repository is a server-side fetch of its `index.yaml`: an unreachable URL is
 * answered with 400 and the reason, which is the only honest way to tell a typo from a network
 * problem. Deleting takes the `repo_id` the list returns.
 */
export function workspaceReposApi(client: Client) {
  const base = (workspace: string) => `${OPENPITRIX}/workspaces/${encodeURIComponent(workspace)}/repos`;
  return {
    async create(params: { workspace: string; name: string; url: string; description?: string | undefined; credentialId?: string | undefined }): Promise<{ repoId: string }> {
      const body = await client.request<{ repo_id?: string }>(base(params.workspace), {
        method: 'POST',
        body: {
          name: params.name,
          url: params.url,
          ...(params.description ? { description: params.description } : {}),
          ...(params.credentialId ? { credential_id: params.credentialId } : {}),
        },
      });
      return { repoId: body?.repo_id ?? '' };
    },
    async remove(params: { workspace: string; repoId: string }): Promise<void> {
      await client.request<void>(`${base(params.workspace)}/${encodeURIComponent(params.repoId)}`, { method: 'DELETE' });
    },
  };
}
/** A release installed from the store, as a project's applications list reports it. */
export interface StoreApplication {
  /** The Helm release name — what the install dialog asked the user for. */
  releaseName: string;
  /** Release object id; the delete endpoint takes this, not the release name. */
  id: string;
  appId: string;
  versionId: string;
  status: string;
  description: string;
  workspace: string;
  namespace: string;
}

interface RawApplication {
  name?: string;
  cluster?: {
    name?: string;
    cluster_id?: string;
    app_id?: string;
    version_id?: string;
    status?: string;
    description?: string;
    zone?: string;
  };
}

function toStoreApplication(item: RawApplication): StoreApplication {
  const cluster = item.cluster ?? {};
  return {
    releaseName: cluster.name ?? '',
    id: cluster.cluster_id ?? '',
    appId: cluster.app_id ?? '',
    versionId: cluster.version_id ?? '',
    status: cluster.status ?? '',
    description: cluster.description ?? '',
    workspace: '',
    namespace: cluster.zone ?? '',
  };
}

/**
 * 商店应用到项目里的安装（写）.
 *
 * Installing is a project-scoped operation: the openpitrix handler creates a HelmRelease in
 * the namespace and there is no workspace-level create route (the workspace applications
 * collection is read-only). The request body is the old console's deploy body — app, version,
 * release name — and the release becomes listable through the project's applications.
 *
 * Deleting takes the release object id (`cluster.cluster_id` in the list), NOT the release
 * name; deleting by name answers 200 without removing anything.
 */
export function workspaceApplicationsApi(client: Client) {
  const base = (workspace: string, namespace: string) =>
    `${OPENPITRIX}/workspaces/${encodeURIComponent(workspace)}/namespaces/${encodeURIComponent(namespace)}/applications`;
  return {
    async list(params: { workspace: string; namespace: string; signal?: AbortSignal }): Promise<StoreApplication[]> {
      const body = await client.request<{ items?: RawApplication[] }>(base(params.workspace, params.namespace), {
        query: { limit: -1 },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (body?.items ?? []).map(toStoreApplication);
    },
    async create(params: {
      workspace: string;
      namespace: string;
      appId: string;
      versionId: string;
      name: string;
      description?: string | undefined;
    }): Promise<void> {
      await client.request<void>(base(params.workspace, params.namespace), {
        method: 'POST',
        body: {
          app_id: params.appId,
          version_id: params.versionId,
          name: params.name,
          ...(params.description ? { description: params.description } : {}),
        },
      });
    },
    async remove(params: { workspace: string; namespace: string; id: string }): Promise<void> {
      await client.request<void>(`${base(params.workspace, params.namespace)}/${encodeURIComponent(params.id)}`, {
        method: 'DELETE',
      });
    },
  };
}

/** A tenant workspace; the install target's workspace step. */
export function storeWorkspacesApi(client: Client) {
  return {
    async list(params: { signal?: AbortSignal } = {}): Promise<{ name: string; alias: string }[]> {
      const body = await client.request<{ items?: { metadata?: { name?: string; annotations?: Record<string, string> } }[] }>(
        '/kapis/tenant.kubesphere.io/v1alpha2/workspaces',
        { query: { limit: -1 }, ...(params.signal ? { signal: params.signal } : {}) },
      );
      return (body?.items ?? []).map((item) => ({
        name: item.metadata?.name ?? '',
        alias: item.metadata?.annotations?.['kubesphere.io/alias-name'] ?? '',
      })).filter((item) => item.name);
    },
  };
}

/** The projects (namespaces) of one workspace; the install target's project step. */
export function storeWorkspaceProjectsApi(client: Client) {
  return {
    async list(params: { workspace: string; signal?: AbortSignal }): Promise<{ name: string; alias: string }[]> {
      const body = await client.request<{ items?: { metadata?: { name?: string; annotations?: Record<string, string> } }[] }>(
        `/kapis/tenant.kubesphere.io/v1alpha2/workspaces/${encodeURIComponent(params.workspace)}/namespaces`,
        { query: { limit: -1 }, ...(params.signal ? { signal: params.signal } : {}) },
      );
      return (body?.items ?? []).map((item) => ({
        name: item.metadata?.name ?? '',
        alias: item.metadata?.annotations?.['kubesphere.io/alias-name'] ?? '',
      })).filter((item) => item.name);
    },
  };
}

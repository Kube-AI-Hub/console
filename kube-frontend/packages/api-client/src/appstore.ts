import type { Client } from './client';
import { clusterScoped } from './paths';

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
  /**
   * Comma-separated `keywords`, split.
   *
   * The old console showed them as tags. This deployment's detail response has no
   * `keywords` field at all (probed), so the array is usually empty and the page renders
   * no tag row rather than an empty one.
   */
  keywords: string[];
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
  keywords?: string;
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
    keywords: (item.keywords ?? '')
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean),
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

    /**
     * One version's chart files, decoded to text.
     *
     * The install dialog starts from the chart's own `values.yaml` so the reader edits real
     * defaults instead of an empty box, and uses `values.schema.json` (when the chart ships
     * one) to decide whether a form view is even possible. Every entry is base64; a broken
     * one decodes to an empty string rather than failing the dialog.
     */
    async files(params: { appId: string; versionId: string; signal?: AbortSignal }): Promise<Record<string, string>> {
      const body = await client.request<{ files?: Record<string, string> }>(
        `${OPENPITRIX}/apps/${encodeURIComponent(params.appId)}/versions/${encodeURIComponent(params.versionId)}/files`,
        {
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      const files = body?.files ?? {};
      const decoded: Record<string, string> = {};
      for (const [path, content] of Object.entries(files)) {
        decoded[path] = decodeStoreFile(content);
      }
      return decoded;
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
export interface WorkspaceRepo {
  /** `repo_id`; the id every write endpoint takes (not the display name). */
  id: string;
  name: string;
  url: string;
  description: string;
  /** `successful` / `failed` / `syncing`; the index state, shown verbatim. */
  status: string;
  /** Last index attempt; zero time until the first one lands. */
  statusTime: string;
  createdAt: string;
  /** `creator` annotation the handler copies out. */
  creator: string;
  /** JSON string; only s3 repositories carry access keys. */
  credential: string;
  /** e.g. `3600s`. */
  syncPeriod: string;
}

interface RawWorkspaceRepo {
  repo_id?: string;
  name?: string;
  url?: string;
  description?: string;
  status?: string;
  status_time?: string;
  create_time?: string;
  creator?: string;
  credential?: string;
  sync_period?: string;
}

export function toWorkspaceRepo(item: RawWorkspaceRepo): WorkspaceRepo {
  return {
    id: item.repo_id ?? '',
    name: item.name ?? '',
    url: item.url ?? '',
    description: item.description ?? '',
    status: item.status ?? '',
    statusTime: item.status_time ?? '',
    createdAt: item.create_time ?? '',
    creator: item.creator ?? '',
    credential: item.credential ?? '',
    syncPeriod: item.sync_period ?? '',
  };
}

/** One index attempt of a repository (the old console's repo detail 「事件」页签). */
export interface RepoEvent {
  id: string;
  createdAt: string;
  status: string;
  message: string;
}

interface RawRepoEvent {
  repo_id?: string;
  create_time?: string;
  status?: string;
  /** The handler's human sentence; absent on older responses. */
  result?: string;
  message?: string;
}

export function toRepoEvent(item: RawRepoEvent, index: number): RepoEvent {
  return {
    // The events response has no id of its own; the timestamp plus index is stable
    // within one response and never collides across a page.
    id: `${item.create_time ?? ''}#${index}`,
    createdAt: item.create_time ?? '',
    status: item.status ?? '',
    message: item.result ?? item.message ?? '',
  };
}

/**
 * 企业空间应用仓库（读写 + 索引事件）.
 *
 * Creating a repository is a server-side fetch of its `index.yaml`: an unreachable URL is
 * answered with 400 and the reason, which is the only honest way to tell a typo from a network
 * problem. Editing is a `PATCH` of the changed fields only. `index` re-syncs the repository
 * (the old console's 「同步」) and answers `{message:"success"}`; the sync itself is
 * asynchronous, so the caller re-reads the list rather than assuming it finished.
 *
 * Every endpoint is workspace-scoped; `repoId` is the `repo_id` from the list. The
 * underlying object is a **cluster-scoped** `HelmRepo` in `application.kubesphere.io/v1alpha1`
 * associated to the workspace by the `kubesphere.io/workspace` label — `/apis/.../namespaces/<ws>/helmrepos`
 * answers 404, which is why reads and writes both go through this kapis group.
 */
export function workspaceReposApi(client: Client) {
  const base = (workspace: string) => `${OPENPITRIX}/workspaces/${encodeURIComponent(workspace)}/repos`;
  return {
    async list(params: { workspace: string; keyword?: string | undefined; signal?: AbortSignal | undefined }): Promise<{ items: WorkspaceRepo[]; total: number }> {
      const body = await client.request<{ items?: RawWorkspaceRepo[]; total_count?: number; total?: number }>(base(params.workspace), {
        query: {
          limit: -1,
          ...(params.keyword?.trim() ? { keyword: params.keyword.trim() } : {}),
        },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      const items = (body?.items ?? []).map(toWorkspaceRepo);
      return { items, total: body?.total_count ?? body?.total ?? items.length };
    },
    async get(params: { workspace: string; repoId: string; signal?: AbortSignal | undefined }): Promise<WorkspaceRepo> {
      const body = await client.request<RawWorkspaceRepo>(`${base(params.workspace)}/${encodeURIComponent(params.repoId)}`, {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return toWorkspaceRepo(body ?? {});
    },
    async create(params: {
      workspace: string;
      name: string;
      url: string;
      description?: string | undefined;
      credential?: string | undefined;
      syncPeriod?: string | undefined;
    }): Promise<{ repoId: string }> {
      const body = await client.request<{ repo_id?: string }>(base(params.workspace), {
        method: 'POST',
        body: {
          name: params.name,
          url: params.url,
          // `app_default_status` is what the old console sends: apps indexed from a
          // workspace repository are published to that workspace immediately.
          app_default_status: 'active',
          ...(params.description ? { description: params.description } : {}),
          ...(params.credential ? { credential: params.credential } : {}),
          ...(params.syncPeriod ? { sync_period: params.syncPeriod } : {}),
        },
      });
      return { repoId: body?.repo_id ?? '' };
    },
    /** PATCH: only the fields passed are sent, so an edit cannot clear the rest. */
    async update(params: {
      workspace: string;
      repoId: string;
      name?: string | undefined;
      url?: string | undefined;
      description?: string | undefined;
      credential?: string | undefined;
      syncPeriod?: string | undefined;
    }): Promise<void> {
      await client.request<void>(`${base(params.workspace)}/${encodeURIComponent(params.repoId)}`, {
        method: 'PATCH',
        body: {
          ...(params.name !== undefined ? { name: params.name } : {}),
          ...(params.url !== undefined ? { url: params.url } : {}),
          ...(params.description !== undefined ? { description: params.description } : {}),
          ...(params.credential !== undefined ? { credential: params.credential } : {}),
          ...(params.syncPeriod !== undefined ? { sync_period: params.syncPeriod } : {}),
        },
      });
    },
    async remove(params: { workspace: string; repoId: string }): Promise<void> {
      await client.request<void>(`${base(params.workspace)}/${encodeURIComponent(params.repoId)}`, { method: 'DELETE' });
    },
    /** Re-sync the repository's `index.yaml` (the old console's 「同步」/索引刷新). */
    async index(params: { workspace: string; repoId: string }): Promise<void> {
      await client.request<void>(`${base(params.workspace)}/${encodeURIComponent(params.repoId)}/action`, {
        method: 'POST',
        body: { action: 'index' },
      });
    },
    async events(params: { workspace: string; repoId: string; signal?: AbortSignal | undefined }): Promise<{ items: RepoEvent[]; total: number }> {
      const body = await client.request<{ items?: RawRepoEvent[]; total_count?: number }>(
        `${base(params.workspace)}/${encodeURIComponent(params.repoId)}/events`,
        { ...(params.signal ? { signal: params.signal } : {}) },
      );
      const items = (body?.items ?? []).map(toRepoEvent);
      return { items, total: body?.total_count ?? items.length };
    },
    /**
     * Ask the server whether `index.yaml` is readable at that URL without creating anything.
     *
     * The answer is the create handler's own validation, so a 200 here means the create
     * will also succeed. The same call with a bad URL is what produces the 400 reason the
     * dialog shows — this is the pre-flight version of it.
     */
    async validate(params: {
      workspace: string;
      name: string;
      url: string;
      description?: string | undefined;
      credential?: string | undefined;
      syncPeriod?: string | undefined;
    }): Promise<void> {
      await client.request<void>(`${base(params.workspace)}?validate=true`, {
        method: 'POST',
        body: {
          name: params.name,
          url: params.url,
          ...(params.description ? { description: params.description } : {}),
          ...(params.credential ? { credential: params.credential } : {}),
          ...(params.syncPeriod ? { sync_period: params.syncPeriod } : {}),
        },
      });
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
    runtime_id?: string;
    owner?: string;
    create_time?: string;
    status_time?: string;
  };
  app?: { app_id?: string; name?: string; chart_name?: string };
  version?: { app_id?: string; version_id?: string; name?: string };
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
 * A release as the workspace-wide aggregate reports it.
 *
 * `GET /kapis/openpitrix.io/v1/workspaces/<ws>/applications` answers every release of every
 * project in the workspace. It carries no paging envelope of its own beyond `total_count`
 * and ignores `keyword` (measured), so the installed-apps list filters client-side and says
 * so; the page must not draw a pager the server cannot honour.
 */
export interface InstalledRelease {
  /** Release object id (`cluster.cluster_id`, `rls-…`); the delete endpoint takes this. */
  id: string;
  /** Release name the user chose at install time. */
  name: string;
  status: string;
  description: string;
  appId: string;
  /** `app.name` as the aggregate spells it; the chart name when the app row is absent. */
  appName: string;
  versionId: string;
  versionName: string;
  /** Project (namespace) the release lives in. */
  project: string;
  /** Cluster the release was created in (`runtime_id`, e.g. `default`). */
  cluster: string;
  owner: string;
  createdAt: string;
  statusTime: string;
  /** The workspace the release belongs to (the aggregate is already scoped to it). */
  workspace: string;
}

export function toInstalledRelease(item: RawApplication, workspace: string): InstalledRelease {
  const cluster = item.cluster ?? {};
  const app = item.app ?? {};
  const version = item.version ?? {};
  return {
    id: cluster.cluster_id ?? '',
    name: cluster.name ?? '',
    status: cluster.status ?? '',
    description: cluster.description ?? '',
    appId: cluster.app_id ?? app.app_id ?? '',
    appName: app.name ?? app.chart_name ?? '',
    versionId: cluster.version_id ?? version.version_id ?? '',
    versionName: version.name ?? '',
    project: cluster.zone ?? '',
    // OpenPitrix's runtime id (`default` on this deployment). It is **not** a KubeSphere cluster
    // name -- see `resources()`, which must be given the console cluster instead.
    cluster: cluster.runtime_id ?? '',
    owner: cluster.owner ?? '',
    createdAt: cluster.create_time ?? '',
    statusTime: cluster.status_time ?? '',
    // The aggregate is workspace-scoped; the caller already knows which workspace.
    workspace,
  };
}

/** The HelmRelease custom resource behind one release. */
export interface HelmRelease {
  name: string;
  /** `active` / `creating` / `failed` / `deleting` … — `status.state`. */
  state: string;
  chartName: string;
  chartVersion: string;
  /** Chart app version, e.g. `v0.11.0`. */
  chartAppVer: string;
  /** Decoded `spec.values`: the YAML the install dialog submitted. */
  values: string;
  /** `spec.version`; increments on upgrade. */
  revision: number;
  labels: Record<string, string>;
  /** Deploy history, newest first. */
  deployHistory: Array<{ state: string; deployTime: string }>;
  lastUpdate: string;
  raw: Record<string, unknown>;
}

interface RawHelmRelease {
  metadata?: { name?: string; labels?: Record<string, string>; creationTimestamp?: string };
  spec?: {
    appId?: string;
    appVerId?: string;
    chartName?: string;
    chartVersion?: string;
    chartAppVer?: string;
    description?: string;
    name?: string;
    repoId?: string;
    /** base64 of the submitted YAML. */
    values?: string;
    version?: number;
  };
  status?: {
    state?: string;
    lastUpdate?: string;
    deployStatus?: Array<{ state?: string; deployTime?: string }>;
  };
}

/** Decode the base64 `spec.values` blob; a malformed one decodes to empty, never throws. */
export function decodeHelmValues(encoded: string | undefined): string {
  if (!encoded) return '';
  try {
    const binary = globalThis.atob(encoded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

export function toHelmRelease(item: RawHelmRelease): HelmRelease {
  const spec = item.spec ?? {};
  const status = item.status ?? {};
  return {
    name: item.metadata?.name ?? spec.name ?? '',
    state: status.state ?? '',
    chartName: spec.chartName ?? '',
    chartVersion: spec.chartVersion ?? '',
    chartAppVer: spec.chartAppVer ?? '',
    values: decodeHelmValues(spec.values),
    revision: Number(spec.version ?? 0),
    labels: item.metadata?.labels ?? {},
    deployHistory: (status.deployStatus ?? [])
      .map((entry) => ({ state: entry.state ?? '', deployTime: entry.deployTime ?? '' }))
      .sort((a, b) => b.deployTime.localeCompare(a.deployTime)),
    lastUpdate: status.lastUpdate ?? '',
    raw: item as Record<string, unknown>,
  };
}

/** One project resource a release owns, as the release detail lists it. */
export interface ReleaseResource {
  kind: string;
  name: string;
  /** Short status sentence: replicas for a workload, type for a Service. */
  detail: string;
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
      /**
       * The chart values, as a **YAML string**.
       *
       * The handler's `conf` field is a Go `string`, so sending an object is rejected with
       * `json: cannot unmarshal object into Go struct field CreateClusterRequest.conf of type
       * string`. An empty/absent value installs the chart's own defaults.
       */
      values?: string | undefined;
    }): Promise<void> {
      await client.request<void>(base(params.workspace, params.namespace), {
        method: 'POST',
        body: {
          app_id: params.appId,
          version_id: params.versionId,
          name: params.name,
          ...(params.description ? { description: params.description } : {}),
          ...(params.values?.trim() ? { conf: params.values } : {}),
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

/* -------------------------------------------------------------------------- */
/* 企业空间已安装应用（跨项目汇总 + 详情 + 卸载）                                 */
/* -------------------------------------------------------------------------- */

const HELM_RELEASES = '/apis/application.kubesphere.io/v1alpha1/helmreleases';
const KAPIS_RESOURCES = '/kapis/resources.kubesphere.io/v1alpha3';

/** The kinds a release's resources tab groups by (the old console's 资源状态页签). */
const RELEASE_RESOURCE_KINDS = ['deployments', 'statefulsets', 'daemonsets', 'services', 'ingresses'] as const;

interface KubeItem {
  metadata?: { name?: string };
  kind?: string;
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

function resourceSummary(kind: string, item: KubeItem): ReleaseResource {
  const spec = item.spec ?? {};
  const status = item.status ?? {};
  const name = item.metadata?.name ?? '';
  if (kind === 'services') {
    return { kind, name, detail: String(spec['type'] ?? 'ClusterIP') };
  }
  if (kind === 'ingresses') {
    const ingress = (status['loadBalancer'] as { ingress?: Array<{ ip?: string }> } | undefined)?.ingress?.[0]?.ip;
    return { kind, name, detail: ingress ?? '-' };
  }
  const ready = status['readyReplicas'];
  const replicas = spec['replicas'];
  return { kind, name, detail: `${ready === undefined ? '-' : String(ready)} / ${replicas === undefined ? '-' : String(replicas)}` };
}

/**
 * 已安装应用（HelmRelease）的读写.
 *
 * The list is the workspace-wide aggregate `GET /workspaces/<ws>/applications`: it answers
 * every release of every project in the workspace and is **read-only**. It has no server-side
 * paging beyond `total_count` and ignores `keyword` (measured: passing it changes nothing),
 * so the page filters client-side over the aggregate and does not render a pager.
 *
 * Uninstalling is project-scoped and takes the release **object id** (`cluster.cluster_id`,
 * `rls-…`), not the release name — deleting by name answers 200 and removes nothing.
 *
 * The object behind a release is a cluster-scoped `HelmRelease` CRD: `spec.values` is
 * base64-encoded YAML and `status.deployStatus` keeps the created→active history.
 */
export function installedReleasesApi(client: Client) {
  const aggregate = (workspace: string) => `${OPENPITRIX}/workspaces/${encodeURIComponent(workspace)}/applications`;
  const projectBase = (workspace: string, namespace: string) =>
    `${OPENPITRIX}/workspaces/${encodeURIComponent(workspace)}/namespaces/${encodeURIComponent(namespace)}/applications`;

  return {
    async list(params: { workspace: string; signal?: AbortSignal | undefined }): Promise<{ items: InstalledRelease[]; total: number }> {
      const body = await client.request<{ items?: RawApplication[]; total_count?: number }>(aggregate(params.workspace), {
        query: { limit: -1 },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      const items = (body?.items ?? []).map((item) => toInstalledRelease(item, params.workspace));
      return { items, total: body?.total_count ?? items.length };
    },

    /**
     * The releases installed in **one project**.
     *
     * The project-scoped collection answers the same row shape as the workspace aggregate but
     * only for that namespace — the old console's project 应用 list used exactly this endpoint.
     * Keep it separate from `list`: the aggregate is the workspace view (no namespace segment),
     * and filtering the aggregate client-side would show a different total than the server.
     */
    async listProject(params: {
      workspace: string;
      namespace: string;
      signal?: AbortSignal | undefined;
    }): Promise<{ items: InstalledRelease[]; total: number }> {
      const body = await client.request<{ items?: RawApplication[]; total_count?: number }>(
        projectBase(params.workspace, params.namespace),
        { query: { limit: -1 }, ...(params.signal ? { signal: params.signal } : {}) },
      );
      const items = (body?.items ?? []).map((item) => toInstalledRelease(item, params.workspace));
      return { items, total: body?.total_count ?? items.length };
    },

    /** One release: the aggregate row (project/version/app) plus its HelmRelease resource. */
    async get(params: { workspace: string; releaseId: string; signal?: AbortSignal | undefined }): Promise<{ release: InstalledRelease | null; helmRelease: HelmRelease | null }> {
      const { items } = await this.list({ workspace: params.workspace, ...(params.signal ? { signal: params.signal } : {}) });
      const release = items.find((item) => item.id === params.releaseId) ?? null;
      let helmRelease: HelmRelease | null = null;
      try {
        const raw = await client.request<RawHelmRelease>(`${HELM_RELEASES}/${encodeURIComponent(params.releaseId)}`, {
          ...(params.signal ? { signal: params.signal } : {}),
        });
        helmRelease = raw ? toHelmRelease(raw) : null;
      } catch {
        // The aggregate row is the release; the custom resource is extra detail. A release
        // whose CRD is already gone (mid-uninstall) must still render its row rather than
        // turning the page into an error.
        helmRelease = null;
      }
      return { release, helmRelease };
    },

    async remove(params: { workspace: string; namespace: string; id: string }): Promise<void> {
      await client.request<void>(`${projectBase(params.workspace, params.namespace)}/${encodeURIComponent(params.id)}`, {
        method: 'DELETE',
      });
    },

    /**
     * The project resources a release owns.
     *
     * KubeSphere stamps `app.kubesphere.io/instance: <release name>` on everything a chart
     * creates, which is the selector the old console's 资源状态 tab used. Read through the
     * generic kapis resources proxy with an explicit `labelSelector` — the paged helper has
     * no selector parameter, and filtering client-side after paging would show a partial set.
     */
    async resources(params: { cluster: string; namespace: string; releaseName: string; signal?: AbortSignal | undefined }): Promise<ReleaseResource[]> {
      const selector = `app.kubesphere.io/instance=${params.releaseName}`;
      const collections = await Promise.all(
        RELEASE_RESOURCE_KINDS.map(async (kind) => {
          const body = await client.request<{ items?: KubeItem[] }>(
            clusterScoped(KAPIS_RESOURCES, params.cluster, `namespaces/${encodeURIComponent(params.namespace)}/${kind}`),
            {
              query: { labelSelector: selector, limit: -1 },
              ...(params.signal ? { signal: params.signal } : {}),
            },
          );
          return (body?.items ?? []).map((item) => resourceSummary(kind, item));
        }),
      );
      return collections.flat();
    },
  };
}

/* -------------------------------------------------------------------------- */
/* 企业空间应用模板（上传 / 版本 / 发布）                                        */
/* -------------------------------------------------------------------------- */

/** A workspace app template, with the fields the list and detail need. */
export interface AppTemplate {
  id: string;
  name: string;
  description: string;
  status: string;
  /** `helm`; the package type of the template's versions. */
  versionTypes: string;
  latestVersionName: string;
  categories: Array<{ id: string; name: string }>;
  createdAt: string;
  updatedAt: string;
  statusTime: string;
  owner: string;
  /** How many releases of this template exist across the workspace. */
  instanceTotal: number;
  home: string;
  icon: string;
}

interface RawAppTemplate extends RawApp {
  latest_app_version?: RawVersion;
  category_set?: RawCategory[];
  app_version_types?: string;
  update_time?: string;
  status_time?: string;
  owner?: string;
  cluster_total?: number;
  home?: string;
}

export function toAppTemplate(item: RawAppTemplate): AppTemplate {
  const latest = item.latest_app_version ?? {};
  return {
    id: item.app_id ?? '',
    name: item.name ?? '',
    description: item.description ?? '',
    status: item.status ?? '',
    versionTypes: item.app_version_types ?? '',
    latestVersionName: latest.name ?? '',
    categories: (item.category_set ?? []).map((category) => ({
      id: category.category_id ?? '',
      name: category.name ?? '',
    })),
    createdAt: item.create_time ?? '',
    updatedAt: item.update_time ?? item.status_time ?? '',
    statusTime: item.status_time ?? '',
    owner: item.owner ?? '',
    instanceTotal: Number(item.cluster_total ?? 0),
    home: item.home ?? '',
    icon: latest.icon ?? '',
  };
}

/** A version of a template, with the review state machine's fields. */
export interface AppTemplateVersion {
  id: string;
  name: string;
  status: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  statusTime: string;
  packageName: string;
  active: boolean;
}

export function toAppTemplateVersion(item: RawVersion): AppTemplateVersion {
  const withOwner = item as RawVersion & { owner?: string; update_time?: string };
  return {
    id: item.version_id ?? '',
    name: item.name ?? '',
    status: item.status ?? '',
    owner: withOwner.owner ?? '',
    createdAt: item.create_time ?? '',
    updatedAt: withOwner.update_time ?? item.status_time ?? '',
    statusTime: item.status_time ?? '',
    packageName: item.package_name ?? '',
    active: item.active === true,
  };
}

/**
 * Version status → the one action the reader may take (the old console's `STATUS_TO_ACTION`).
 *
 * Copied from the old console's `configs/openpitrix/version.js` because no endpoint advertises
 * the state machine; the transitions were verified against the live API
 * (draft→submit→submitted, submitted→cancel→draft).
 */
/**
 * The one review transition each version status allows.
 *
 * `labelKey` points at the locale keys the page already ships (`appRepos.apps.action.*`);
 * an earlier revision pointed at an `appTemplates.action.*` namespace that does not exist,
 * so the button rendered its raw key instead of 提交审核 / 撤销提交 (caught by
 * TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-02).
 */
export const VERSION_STATUS_ACTION: Readonly<Record<string, { action: string; labelKey: string } | undefined>> = {
  draft: { action: 'submit', labelKey: 'appRepos.apps.action.submit' },
  rejected: { action: 'submit', labelKey: 'appRepos.apps.action.resubmit' },
  submitted: { action: 'cancel', labelKey: 'appRepos.apps.action.cancel' },
  passed: { action: 'release', labelKey: 'appRepos.apps.action.release' },
  active: { action: 'suspend', labelKey: 'appRepos.apps.action.suspend' },
  suspended: { action: 'recover', labelKey: 'appRepos.apps.action.recover' },
};

/** Versions that may be deleted (`CAN_DELETE_STATUS` in the old console). */
export const VERSION_DELETABLE: readonly string[] = ['draft', 'rejected', 'passed', 'suspended'];

/**
 * 企业空间应用模板（读写）.
 *
 * A workspace's own app templates — the old console's 「应用」区域: upload a Helm chart,
 * manage its versions, submit a version for review, release it. Every endpoint is
 * workspace-scoped and takes the `app_id` / `version_id` the list returns.
 *
 * Package upload takes the chart as **base64** in `version_package` (create) or `package`
 * (new version of an existing template); `?validate=true` answers the chart's own metadata
 * (`name`, `version_name`, `description`) without creating anything.
 */
export function appTemplatesApi(client: Client) {
  const base = (workspace: string) => `${OPENPITRIX}/workspaces/${encodeURIComponent(workspace)}/apps`;
  const appPath = (workspace: string, appId: string) => `${base(workspace)}/${encodeURIComponent(appId)}`;

  return {
    async list(params: { workspace: string; signal?: AbortSignal | undefined }): Promise<{ items: AppTemplate[]; total: number }> {
      const body = await client.request<{ items?: RawAppTemplate[]; total_count?: number }>(base(params.workspace), {
        query: { limit: -1 },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      const items = (body?.items ?? []).map(toAppTemplate);
      return { items, total: body?.total_count ?? items.length };
    },

    async get(params: { workspace: string; appId: string; signal?: AbortSignal | undefined }): Promise<AppTemplate> {
      const body = await client.request<RawAppTemplate>(appPath(params.workspace, params.appId), {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return toAppTemplate(body ?? {});
    },

    async versions(params: { workspace: string; appId: string; signal?: AbortSignal | undefined }): Promise<AppTemplateVersion[]> {
      const body = await client.request<{ items?: RawVersion[] }>(`${appPath(params.workspace, params.appId)}/versions`, {
        query: { limit: -1 },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (body?.items ?? []).map(toAppTemplateVersion).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    /** Read a chart package back as base64 — the round trip an upload test needs. */
    async packageOf(params: { workspace: string; appId: string; versionId: string; signal?: AbortSignal | undefined }): Promise<string> {
      const body = await client.request<{ package?: string }>(
        `${appPath(params.workspace, params.appId)}/versions/${encodeURIComponent(params.versionId)}/package`,
        { ...(params.signal ? { signal: params.signal } : {}) },
      );
      return body?.package ?? '';
    },

    /** Validate a chart package without creating anything. */
    async validatePackage(params: { workspace: string; packageBase64: string; signal?: AbortSignal | undefined }): Promise<{ name: string; versionName: string; description: string }> {
      const body = await client.request<{ name?: string; version_name?: string; description?: string }>(
        `${base(params.workspace)}?validate=true`,
        {
          method: 'POST',
          body: { version_type: 'helm', version_package: params.packageBase64 },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      return { name: body?.name ?? '', versionName: body?.version_name ?? '', description: body?.description ?? '' };
    },

    async create(params: { workspace: string; name: string; packageBase64: string; description?: string | undefined }): Promise<{ appId: string; versionId: string }> {
      const body = await client.request<{ app_id?: string; version_id?: string }>(base(params.workspace), {
        method: 'POST',
        body: {
          name: params.name,
          version_type: 'helm',
          version_package: params.packageBase64,
          ...(params.description ? { description: params.description } : {}),
        },
      });
      return { appId: body?.app_id ?? '', versionId: body?.version_id ?? '' };
    },

    async addVersion(params: { workspace: string; appId: string; packageBase64: string }): Promise<{ versionId: string }> {
      const body = await client.request<{ version_id?: string }>(`${appPath(params.workspace, params.appId)}/versions`, {
        method: 'POST',
        body: { version_type: 'helm', package: params.packageBase64 },
      });
      return { versionId: body?.version_id ?? '' };
    },

    async deleteVersion(params: { workspace: string; appId: string; versionId: string }): Promise<void> {
      await client.request<void>(`${appPath(params.workspace, params.appId)}/versions/${encodeURIComponent(params.versionId)}`, {
        method: 'DELETE',
      });
    },

    /**
     * Move a version through its review state machine.
     *
     * `action` is one of `submit` / `cancel` / `release` / `suspend` / `recover`
     * (see `VERSION_STATUS_ACTION`). The app-level `action` endpoint answers
     * `500 action not support` for a draft, so the version endpoint is the one to use.
     */
    async versionAction(params: { workspace: string; appId: string; versionId: string; action: string }): Promise<void> {
      await client.request<void>(`${appPath(params.workspace, params.appId)}/versions/${encodeURIComponent(params.versionId)}/action`, {
        method: 'POST',
        body: { action: params.action },
      });
    },

    async update(params: { workspace: string; appId: string; name?: string | undefined; description?: string | undefined }): Promise<void> {
      await client.request<void>(appPath(params.workspace, params.appId), {
        method: 'PATCH',
        body: {
          ...(params.name !== undefined ? { name: params.name } : {}),
          ...(params.description !== undefined ? { description: params.description } : {}),
        },
      });
    },

    /** Delete a template. The server refuses while versions remain, so delete them first. */
    async remove(params: { workspace: string; appId: string }): Promise<void> {
      await client.request<void>(appPath(params.workspace, params.appId), { method: 'DELETE' });
    },
  };
}

/** Releases of one template, workspace-wide (the template detail's 应用实例 tab). */
export function appTemplateInstancesApi(client: Client) {
  const aggregate = (workspace: string) => `${OPENPITRIX}/workspaces/${encodeURIComponent(workspace)}/applications`;
  return {
    async list(params: { workspace: string; appId: string; signal?: AbortSignal | undefined }): Promise<InstalledRelease[]> {
      const body = await client.request<{ items?: RawApplication[] }>(aggregate(params.workspace), {
        query: { limit: -1 },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (body?.items ?? [])
        .map((item) => toInstalledRelease(item, params.workspace))
        .filter((release) => !params.appId || release.appId === params.appId);
    },
  };
}


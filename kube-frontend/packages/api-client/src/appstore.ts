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

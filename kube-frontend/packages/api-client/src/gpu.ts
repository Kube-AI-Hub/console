import type { Client } from './client';

/**
 * The GPU extension, as served by ks-apiserver's `gpu.kubesphere.io` API group.
 *
 * One physical card per item. The data is written by the HAMi device plugin
 * (register annotation) and summarised by `gpu-agent` into `hami.io/node-gpu-info`;
 * the API only reads that summary. The page therefore renders `health` as the
 * verdict it is and never re-derives it from allocatable capacity or XID state.
 *
 * There is **no per-card detail endpoint**: `GET /gpus/<uuid>` answers 404. The old
 * console fetched a single card with
 * `GET /gpus?conditions=nodeName=<node>,uuid=<uuid>`; the cluster-wide form
 * `GET /gpus?uuid=<uuid>` answers the same item (with `nodeName`/`nodeIP` attached)
 * and needs one parameter, so that is what `get()` uses.
 */
export const KAPIS_GPU = '/kapis/gpu.kubesphere.io/v1alpha1';

/** Fields the API actually sends; the mapper below turns them into a view type. */
interface RawGpuDevice {
  index?: number;
  uuid?: string;
  /** The card model; the API calls it `type`. */
  type?: string;
  health?: boolean;
  /** MiB. */
  gpuMemoryTotal?: number;
  /** MiB. */
  gpuMemoryUsed?: number;
  /** Percent of the card's compute capacity. */
  gpuCoreTotal?: number;
  gpuCoreUsed?: number;
  vgpuTotal?: number;
  vgpuUsed?: number;
  numa?: number;
  /** `nvidia`, `cambricon`, `huawei`, … */
  deviceVendor?: string;
  mode?: string;
  nodeName?: string;
  nodeIP?: string;
}

/** One physical GPU, flattened for display. */
export interface GpuDevice {
  index: number;
  uuid: string;
  /** Card model, e.g. `B200`. */
  model: string;
  /** `nvidia`, `cambricon`, … */
  vendor: string;
  /** `false` means the device plugin has taken the card out of the schedulable pool. */
  health: boolean;
  /** MiB. */
  memoryTotalMiB: number;
  /** MiB. */
  memoryUsedMiB: number;
  /** Percent. */
  coreTotal: number;
  coreUsed: number;
  vgpuTotal: number;
  vgpuUsed: number;
  numa: number | undefined;
  mode: string;
  node: string;
  nodeIP: string;
}

/** Sort fields the listing endpoint accepts. */
export type GpuSortKey = 'nodeName' | 'index' | 'uuid' | 'deviceVendor' | 'type' | 'health';

export interface GpuListParams {
  /**
   * Member cluster id.
   *
   * Kept for symmetry with the other cluster APIs but deliberately not turned into a
   * path segment: the GPU extension is registered on the cluster's own ks-apiserver,
   * and the old console also strips `cluster` from this request. Only `host` has been
   * verified; see the design doc's known pitfalls.
   */
  cluster: string;
  /** Prefix match, server-side. */
  nodeName?: string;
  uuid?: string;
  deviceVendor?: string;
  type?: string;
  status?: 'healthy' | 'unhealthy';
  page?: number;
  /** `-1` returns everything, which is how the page counts rows. */
  limit?: number;
  sortBy?: GpuSortKey;
  ascending?: boolean;
  signal?: AbortSignal;
}

export interface GpuListResult {
  items: GpuDevice[];
  total: number;
}

/** Card count for one vendor/model pair, from the stats endpoint. */
export interface GpuModelCount {
  vendor: string;
  model: string;
  count: number;
}

/**
 * Cluster-wide card totals.
 *
 * The endpoint answers a flat map: `{ total, healthy, "nvidia-B200": 15, … }`. The
 * overview block needs `total`/`healthy`; the per-model keys become `byModel`.
 */
export interface GpuStats {
  total: number;
  healthy: number;
  byModel: GpuModelCount[];
}

/** Path of the collection. See `GpuListParams.cluster` for why there is no cluster segment. */
export function gpuPath(): string {
  return `${KAPIS_GPU}/gpus`;
}

/** Flatten one API item; a missing `health` is treated as unhealthy, never as healthy. */
export function toGpuDevice(raw: RawGpuDevice): GpuDevice {
  return {
    index: Number(raw.index ?? 0),
    uuid: String(raw.uuid ?? ''),
    model: String(raw.type ?? ''),
    vendor: String(raw.deviceVendor ?? ''),
    // The register annotation omits `health` when it is false (omitempty), so the
    // absent case must read as false — the reverse mistake is how a failed card
    // used to render green.
    health: raw.health === true,
    memoryTotalMiB: Number(raw.gpuMemoryTotal ?? 0),
    memoryUsedMiB: Number(raw.gpuMemoryUsed ?? 0),
    coreTotal: Number(raw.gpuCoreTotal ?? 0),
    coreUsed: Number(raw.gpuCoreUsed ?? 0),
    vgpuTotal: Number(raw.vgpuTotal ?? 0),
    vgpuUsed: Number(raw.vgpuUsed ?? 0),
    ...(typeof raw.numa === 'number' ? { numa: raw.numa } : {}),
    mode: String(raw.mode ?? ''),
    node: String(raw.nodeName ?? ''),
    nodeIP: String(raw.nodeIP ?? ''),
  } as GpuDevice;
}

/** Turn the flat stats map into totals plus per-model counts. */
export function toGpuStats(body: Record<string, unknown> | undefined): GpuStats {
  const record = body ?? {};
  const byModel: GpuModelCount[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (key === 'total' || key === 'healthy') continue;
    const count = Number(value);
    if (!Number.isFinite(count)) continue;
    const dash = key.indexOf('-');
    byModel.push(
      dash < 0
        ? { vendor: '', model: key, count }
        : { vendor: key.slice(0, dash), model: key.slice(dash + 1) || '-', count },
    );
  }
  byModel.sort((a, b) => a.vendor.localeCompare(b.vendor) || a.model.localeCompare(b.model));
  return {
    total: Number(record['total'] ?? 0),
    healthy: Number(record['healthy'] ?? 0),
    byModel,
  };
}

export function gpusApi(client: Client) {
  async function list(params: GpuListParams): Promise<GpuListResult> {
    const query: Record<string, string | number | boolean | undefined> = {
      nodeName: params.nodeName,
      uuid: params.uuid,
      deviceVendor: params.deviceVendor,
      type: params.type,
      status: params.status,
      page: params.page,
      limit: params.limit,
      sortBy: params.sortBy,
      ascending: params.ascending,
    };
    const body = await client.request<{ items?: RawGpuDevice[]; totalItems?: number }>(gpuPath(), {
      query,
      ...(params.signal ? { signal: params.signal } : {}),
    });
    const items = (body?.items ?? []).map(toGpuDevice);
    return { items, total: Number(body?.totalItems ?? items.length) };
  }

  return {
    list,
    async setMode(params: { cluster: string; node: string; mode: string; params: Record<string, string> }): Promise<{ success: boolean; prevMode: string; newMode: string; message: string }> {
      if (params.cluster !== 'host' && params.cluster !== '') throw new Error('GPU mode writes are only verified for the host cluster');
      if (!params.node || !params.mode) throw new Error('A node and mode are required');
      const body = await client.request<{ success: boolean; prevMode: string; newMode: string; message: string }>(
        `${KAPIS_GPU}/device-plugins/gpu/mode`, {
          method: 'PUT', query: { nodeName: params.node }, body: { mode: params.mode, params: params.params },
        });
      if (body?.success !== true) throw new Error(body?.message || 'GPU mode signal was not accepted');
      return body;
    },
    /**
     * One card, or `null` when the UUID is no longer reported (the card was removed).
     *
     * `null`, not `undefined`: TanStack Query treats a query function that resolves
     * `undefined` as a mistake and turns it into an error, so "no such card" would
     * render as "failed to load" instead of the explicit not-found message.
     */
    async get(params: { cluster: string; uuid: string; signal?: AbortSignal }): Promise<GpuDevice | null> {
      const result = await list({
        cluster: params.cluster,
        uuid: params.uuid,
        limit: -1,
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return result.items[0] ?? null;
    },
    async stats(params: { cluster: string; signal?: AbortSignal }): Promise<GpuStats> {
      const body = await client.request<Record<string, unknown>>(`${gpuPath()}/stats`, {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return toGpuStats(body);
    },
  };
}

export type GpusApi = ReturnType<typeof gpusApi>;

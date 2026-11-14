import { useQuery } from '@tanstack/react-query';
import { ApiError, KAPIS_RESOURCES, type ResourceListParams, type ResourceListResult } from '@kube-ai-hub/api-client';
import { api } from '@/api';

/**
 * Cluster-scoped reads for volume snapshots and their classes.
 *
 * Nothing here goes through `storageApi`: the project storage module maps a
 * snapshot's class from `spec.storageClassName`, which is the claim field, and it
 * has no reader for VolumeSnapshotClass at all. The cluster pages therefore read
 * the kapis collection directly and map only the columns they show.
 *
 * Both collections are served by the generic kapis resources proxy, the same one
 * the cluster claim page uses: it answers `page`/`limit`/`sortBy`/`ascending`/`name`
 * and reports `totalItems`, which is what keeps a twenty-row page honest about how
 * many objects exist.
 */

/** One row of the cluster-wide volume snapshot list. */
export interface VolumeSnapshotRow {
  name: string;
  namespace: string;
  /** `Ready` / `Pending` / `Error`, from `status.readyToUse` and `status.error`. */
  status: string;
  /** `status.restoreSize`, the size of the restored claim. */
  capacity: string;
  /** `spec.volumeSnapshotClassName`; empty when the default class was used. */
  snapshotClass: string;
  createdAt: string;
}

/** One row of the cluster snapshot class list. */
export interface VolumeSnapshotClassRow {
  name: string;
  /** The CSI driver that creates the snapshots, at `driver` (not under `spec`). */
  driver: string;
  /** `Delete` / `Retain`. */
  deletionPolicy: string;
  /** How many driver parameters the class carries. */
  parameterCount: number;
  createdAt: string;
}

interface RawSnapshot {
  metadata?: { name?: string; namespace?: string; creationTimestamp?: string };
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

interface RawSnapshotClass {
  metadata?: { name?: string; creationTimestamp?: string };
  driver?: string;
  deletionPolicy?: string;
  parameters?: Record<string, unknown>;
}

/**
 * The kapis prefix for one cluster.
 *
 * `host` is the cluster the BFF itself talks to and has no prefix; a member
 * cluster is addressed as `clusters/<id>/`, which is the same convention the
 * api-client's resource paths use.
 */
function clusterPrefix(cluster: string): string {
  return cluster && cluster !== 'host' ? 'clusters/' + encodeURIComponent(cluster) + '/' : '';
}

function collectionUrl(cluster: string, resource: string): string {
  return KAPIS_RESOURCES + '/' + clusterPrefix(cluster) + resource;
}

/**
 * Snapshot readiness.
 *
 * `readyToUse` is the only success bit the API reports; an `error` object means
 * the snapshot will never become usable, so it is its own state rather than
 * "still pending". Anything else is in flight.
 */
export function snapshotStatusOf(item: RawSnapshot): string {
  if (item.status?.['readyToUse'] === true) return 'Ready';
  const error = item.status?.['error'] as Record<string, unknown> | undefined;
  if (error && (error['message'] || error['code'])) return 'Error';
  return 'Pending';
}

export function toVolumeSnapshotRow(item: RawSnapshot): VolumeSnapshotRow {
  return {
    name: item.metadata?.name ?? '',
    namespace: item.metadata?.namespace ?? '',
    status: snapshotStatusOf(item),
    capacity: String(item.status?.['restoreSize'] ?? ''),
    snapshotClass: String(item.spec?.['volumeSnapshotClassName'] ?? ''),
    createdAt: item.metadata?.creationTimestamp ?? '',
  };
}

export function toVolumeSnapshotClassRow(item: RawSnapshotClass): VolumeSnapshotClassRow {
  return {
    name: item.metadata?.name ?? '',
    driver: String(item.driver ?? ''),
    // Kubernetes requires this field on a class; an empty value means the object
    // is not a well-formed VolumeSnapshotClass, so it stays visible as empty.
    deletionPolicy: String(item.deletionPolicy ?? ''),
    parameterCount: Object.keys(item.parameters ?? {}).length,
    createdAt: item.metadata?.creationTimestamp ?? '',
  };
}

interface ListBody<TItem> {
  items?: TItem[];
  totalItems?: number;
  total_count?: number;
}

async function listCollection<TItem, TRow>(
  params: Omit<ResourceListParams, 'signal'>,
  resource: string,
  toRow: (item: TItem) => TRow,
  signal: AbortSignal,
): Promise<ResourceListResult<TRow>> {
  const body = await api.request<ListBody<TItem>>(collectionUrl(params.cluster, resource), {
    query: {
      page: params.page,
      limit: params.pageSize,
      ...(params.sortBy ? { sortBy: params.sortBy } : {}),
      ...(params.order ? { ascending: params.order === 'asc' } : {}),
      ...(params.keyword?.trim() ? { name: params.keyword.trim() } : {}),
    },
    signal,
  });
  const items = (body?.items ?? []).map(toRow);
  return {
    items,
    total: body?.totalItems ?? body?.total_count ?? items.length,
    page: params.page,
    pageSize: params.pageSize,
  };
}

/**
 * Whether the CSI snapshot API group exists on this cluster.
 *
 * The question is answered by discovery, not by trying the list: a cluster
 * without the snapshot controller has no `snapshot.storage.k8s.io` group, and the
 * page must say exactly that instead of rendering an empty table that reads as
 * "no snapshots exist". Only a 404 means "not installed"; a 403 is a permission
 * problem and must surface as one.
 */
export function useSnapshotCrd(cluster: string) {
  return useQuery({
    queryKey: ['snapshot-crd', cluster],
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }): Promise<boolean> => {
      try {
        await api.request('/apis/snapshot.storage.k8s.io/v1', { signal });
        return true;
      } catch (cause) {
        if (cause instanceof ApiError && cause.isNotFound) return false;
        throw cause;
      }
    },
    retry: false,
  });
}

/** One page of the cluster-wide snapshot list, across every project. */
export function useClusterVolumeSnapshots(
  params: Omit<ResourceListParams, 'signal'>,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['cluster-volume-snapshots', params.cluster, params.page, params.pageSize, params.sortBy, params.order, params.keyword],
    enabled,
    queryFn: ({ signal }) => listCollection<RawSnapshot, VolumeSnapshotRow>(params, 'volumesnapshots', toVolumeSnapshotRow, signal),
  });
}

/** One page of the cluster's VolumeSnapshotClass collection. */
export function useVolumeSnapshotClasses(
  params: Omit<ResourceListParams, 'signal'>,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['volume-snapshot-classes', params.cluster, params.page, params.pageSize, params.sortBy, params.order, params.keyword],
    enabled,
    queryFn: ({ signal }) => listCollection<RawSnapshotClass, VolumeSnapshotClassRow>(params, 'volumesnapshotclasses', toVolumeSnapshotClassRow, signal),
  });
}

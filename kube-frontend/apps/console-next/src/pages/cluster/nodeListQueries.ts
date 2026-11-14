import { useQuery } from '@tanstack/react-query';
import { nodeListApi, type NodeListParams, type NodeSummary, type NodeMetricValues } from '@kube-ai-hub/api-client';
import { api } from '@/api';

export function hasPendingMode(node: NodeSummary, now = Date.now()): boolean {
  const desiredTime = Date.parse(node.gpuModeDesired?.timestamp ?? node.gpuModeStatus?.timestamp ?? '');
  if (!Number.isFinite(desiredTime) || now - desiredTime > 300_000) return false;
  return node.gpuModeStatus?.status === 'in_progress' ||
    Boolean(node.gpuModeDesired && (!node.gpuModeStatus || Date.parse(node.gpuModeStatus.timestamp) < desiredTime));
}

export function useNodesList(params: NodeListParams) {
  return useQuery({
    queryKey: ['node-list', params.cluster, params.page, params.pageSize, params.sortBy, params.order,
      params.keyword, params.status, params.role, params.deviceVendors, params.xpuModel],
    queryFn: ({ signal }) => nodeListApi(api).list({ ...params, signal }),
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === params.cluster ? previous : undefined,
    refetchInterval: (query) => query.state.data?.items.some((node) => hasPendingMode(node)) ? 3000 : false,
    retry: false,
  });
}

export function useNodesStats(cluster: string) {
  const stats = useQuery({ queryKey: ['node-list-stats', cluster], queryFn: ({ signal }) => nodeListApi(api).stats({ cluster, signal }), retry: false });
  const controlPlane = useQuery({ queryKey: ['node-list-control-plane', cluster], queryFn: ({ signal }) => nodeListApi(api).controlPlaneCount({ cluster, signal }), retry: false });
  return { stats, controlPlane };
}

export function useNodesMetrics(cluster: string, names: string[]) {
  return useQuery({
    queryKey: ['node-list-metrics', cluster, names], enabled: names.length > 0, retry: false, staleTime: 30_000,
    queryFn: ({ signal }) => nodeListApi(api).metrics({ cluster, names, signal }),
  });
}

export function useNodesTime(cluster: string) {
  return useQuery({ queryKey: ['node-list-time', cluster], retry: false, staleTime: 30_000,
    queryFn: ({ signal }) => nodeListApi(api).timeMetrics({ cluster, signal }) });
}

export function timeOffsets(values: Record<string, NodeMetricValues>): Record<string, { offset: number | undefined; synced: boolean | undefined }> {
  const times = Object.values(values).map((entry) => entry.node_time_seconds).filter((value): value is number => value !== undefined && Number.isFinite(value)).sort((a, b) => a - b);
  const middle = Math.floor(times.length / 2);
  const median = times.length === 0 ? undefined : times.length % 2 ? times[middle]! : (times[middle - 1]! + times[middle]!) / 2;
  return Object.fromEntries(Object.entries(values).map(([name, entry]) => [name, {
    offset: median === undefined || entry.node_time_seconds === undefined ? undefined : Math.round(entry.node_time_seconds - median),
    synced: entry.node_timex_sync_status === 1 ? true : entry.node_timex_sync_status === 0 ? false : undefined,
  }]));
}

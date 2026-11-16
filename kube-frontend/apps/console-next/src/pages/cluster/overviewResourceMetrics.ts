import type { ClusterUsage, MetricSeries } from '@kube-ai-hub/api-client';
import type { IconName } from '@kube-ai-hub/ui';
import type { LocaleKey } from '@kube-ai-hub/locales';

export const OVERVIEW_WINDOWS = [
  { key: '1h', ms: 3_600_000, step: '60s', gap: 150_000 },
  { key: '6h', ms: 21_600_000, step: '5m', gap: 750_000 },
  { key: '24h', ms: 86_400_000, step: '15m', gap: 2_250_000 },
] as const;
export type OverviewWindow = (typeof OVERVIEW_WINDOWS)[number]['key'];
export const OVERVIEW_RESOURCES = [
  { key: 'gpu-memory', label: 'node.list.gpuMemory', icon: 'memory', used: 'gpuMemoryUsedBytes', total: 'gpuMemoryTotalBytes', unit: 'bytes', metric: 'cluster_gpu_memory_usage', capacity: 'cluster_gpu_memory_total', gpu: true },
  { key: 'gpu', label: 'cluster.overview.gpuCards', icon: 'gpu', used: 'gpuUsed', total: 'gpuTotal', allocated: 'gpuAllocated', unit: 'cards', metric: 'cluster_gpu_usage', capacity: 'cluster_gpu_total', gpu: true },
  { key: 'cpu', label: 'cluster.overview.cpu', icon: 'cpu', used: 'cpuUsedCores', total: 'cpuTotalCores', allocated: 'cpuAllocatedCores', unit: 'number', metric: 'cluster_cpu_usage', capacity: 'cluster_cpu_total' },
  { key: 'memory', label: 'cluster.overview.memory', icon: 'memory', used: 'memoryUsedBytes', total: 'memoryTotalBytes', allocated: 'memoryAllocatedBytes', unit: 'bytes', metric: 'cluster_memory_usage_wo_cache', capacity: 'cluster_memory_total' },
  { key: 'pods', label: 'cluster.overview.pods', icon: 'pod', used: 'podRunning', total: 'podCapacity', unit: 'number', metric: 'cluster_pod_running_count', capacity: 'cluster_pod_quota' },
  { key: 'disk', label: 'cluster.overview.disk', icon: 'storage', used: 'diskUsedBytes', total: 'diskTotalBytes', unit: 'bytes', metric: 'cluster_disk_size_usage', capacity: 'cluster_disk_size_capacity' },
  { key: 'nodes', label: 'cluster.overview.nodes', icon: 'nodes', used: 'nodeReady', total: 'nodeTotal', unit: 'number', metric: 'cluster_node_online', capacity: 'cluster_node_total', health: true },
] as const satisfies ReadonlyArray<{
  key: string; label: LocaleKey; icon: IconName; used: keyof ClusterUsage; total: keyof ClusterUsage;
  allocated?: keyof ClusterUsage; unit: string; metric: string; capacity: string; gpu?: boolean; health?: boolean;
}>;
export type OverviewResource = (typeof OVERVIEW_RESOURCES)[number]['key'];

export function overviewRatio(used: number | undefined, total: number | undefined): number | undefined {
  if (used === undefined || total === undefined || !Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return undefined;
  return used / total;
}

export function overviewRatioPoints(series: MetricSeries[], metric: string, capacity: string): MetricSeries['points'] {
  const totals = new Map(series.find((entry) => entry.name === capacity)?.points.map((point) => [point.at, point.value]));
  return (series.find((entry) => entry.name === metric)?.points ?? []).flatMap((point) => {
    const ratio = overviewRatio(point.value, totals.get(point.at));
    return ratio === undefined ? [] : [{ at: point.at, value: ratio * 100 }];
  });
}

export function formatOverviewValue(value: number | undefined, unit: string, cards: string): string {
  if (value === undefined || !Number.isFinite(value)) return '-';
  if (unit === 'bytes') {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    let amount = value;
    let index = 0;
    while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index += 1; }
    return value === 0 ? '0' : amount.toFixed(index >= 2 ? 1 : 0) + units[index];
  }
  const number = String(Math.round(value * 100) / 100);
  return unit === 'cards' ? `${number} ${cards}` : number;
}

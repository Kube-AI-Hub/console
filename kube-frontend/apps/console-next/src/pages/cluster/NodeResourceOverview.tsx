import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { nodeInsightsApi, type NodeDetail } from '@kube-ai-hub/api-client';
import { StatisticsGroup, type StatisticItem } from '@kube-ai-hub/ui';
import { api } from '@/api';
import { useT } from '@/i18n';
import { formatBytes } from '@/lib/quantity';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { NodeTrendPanel } from './NodeTrendPanel';
import { NodeTotalsPanel } from './NodeTotalsPanel';
import { NodeAllocationPanel } from './NodeAllocationPanel';
import { NodeHealthPanel } from './NodeHealthPanel';

export function NodeResourceOverview({ node, cluster }: { node: NodeDetail; cluster: string }): React.ReactElement {
  const t = useT();
  const gpu = Boolean(node.gpuVendor && node.gpuVendor.toLowerCase() !== 'cpu');
  const query = useQuery({
    queryKey: ['node-insights', cluster, node.name],
    queryFn: ({ signal }) => nodeInsightsApi(api).instant({ cluster, node: node.name, signal }),
    retry: false, staleTime: 15_000,
  });
  const data = query.data ?? {};
  const resources = [
    { key: 'cpu', label: t('cluster.column.cpuUsage'), ratio: data.node_cpu_utilisation, used: data.node_cpu_usage, total: data.node_cpu_total, unit: t('node.list.cores') },
    { key: 'memory', label: t('cluster.column.memoryUsage'), ratio: data.node_memory_utilisation, used: data.node_memory_usage_wo_cache, total: data.node_memory_total, unit: 'bytes' },
    ...(gpu ? [
      { key: 'gpu', label: t('node.list.gpu'), ratio: data.node_gpu_utilisation, used: data.node_gpu_usage, total: data.node_gpu_total, unit: t('node.list.cards') },
      { key: 'gpuMemory', label: t('node.list.gpuMemory'), ratio: data.node_gpu_memory_utilisation, used: data.node_gpu_memory_usage, total: data.node_gpu_memory_total, unit: 'bytes' },
    ] : []),
    { key: 'pods', label: t('cluster.workloads.pods.title'),
      ratio: data.node_pod_quota && data.node_pod_running_count !== undefined ? data.node_pod_running_count / data.node_pod_quota : undefined,
      used: data.node_pod_running_count, total: data.node_pod_quota, unit: '' },
    { key: 'disk', label: t('node.trend.disk'), ratio: data.node_disk_size_utilisation, used: data.node_disk_size_usage, total: data.node_disk_size_capacity, unit: 'bytes' },
  ];
  const summary: StatisticItem[] = resources.map((resource) => {
    const known = resource.ratio !== undefined && resource.total !== undefined && resource.total > 0;
    const absolute = (number: number) => resource.unit === 'bytes' ? formatBytes(String(number)) :
      `${Number.isInteger(number) ? number : number.toFixed(2)} ${resource.unit}`.trim();
    const description = resource.used !== undefined && resource.total !== undefined && resource.total > 0 ?
      `${absolute(resource.used)} / ${absolute(resource.total)}` : '-';
    return {
      key: resource.key, label: resource.label, value: known ? `${Math.round(resource.ratio! * 100)}%` : '-',
      description: resource.key === 'gpu' && data.node_gpu_allocated !== undefined ?
        `${description} · ${t('node.list.allocated', { value: `${data.node_gpu_allocated} ${t('node.list.cards')}` })}` : description,
      state: query.isPending ? 'loading' : query.isError ? 'error' : known ? 'ready' : 'unknown',
      tone: known && resource.ratio! >= .9 ? 'warning' : 'neutral',
    };
  });
  return <div className="flex flex-col gap-4">
    {/*
      * Totals before usage, the way the old console reads: how big is this machine,
      * then how full is it. Reversing them made a heterogeneous node look like a
      * percentage chart with no context.
      */}
    <NodeTotalsPanel node={node} {...(data ? { usage: data } : {})} />
    <StatisticsGroup items={summary} unknownLabel={t('node.list.unknown')} className="grid grid-cols-2 gap-x-4 xl:grid-cols-3"
      data-ai-id="node-detail:usage" aria-busy={query.isFetching} />
    {query.isError ? <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="node-detail:usage-retry" /> : null}
    <NodeTrendPanel cluster={cluster} node={node.name} gpu={gpu} />
    <NodeHealthPanel node={node} cluster={cluster} />
    <NodeAllocationPanel node={node} />
  </div>;
}

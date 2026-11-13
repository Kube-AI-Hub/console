import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { nodeUsageApi, type NodeUsage } from '@kube-ai-hub/api-client';
import { AiSurface, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

/**
 * 节点用量.
 *
 * Nodes ranked by how busy they are. The old console puts this under 集群监控 as a
 * ranking rather than a list of every attribute: the question is "which node is hot",
 * and a table sorted by name makes that the reader's job.
 *
 * The percentages come from the monitoring API as fractions; the api-client mapper
 * multiplies them, so a page cannot show `0.06%` for a node that is 6% busy.
 */
export interface NodeUsagePageProps {
  cluster: string;
}

type SortKey = 'cpu' | 'memory' | 'disk' | 'pods' | 'name';

export function NodeUsagePage({ cluster }: NodeUsagePageProps): React.ReactElement {
  const t = useT();
  // Default to the busiest node first: that is the question this page answers.
  const list = useResourceListState<SortKey>({ defaultSortBy: 'cpu', defaultOrder: 'desc', resetOn: [cluster] });

  const usage = useQuery({
    queryKey: ['node-usage-ranking', cluster],
    queryFn: ({ signal }) => nodeUsageApi(apiClient).list({ cluster, signal }),
    staleTime: 30_000,
    retry: false,
  });

  const all = usage.data ?? [];
  const keyword = list.search.trim().toLowerCase();
  const filtered = keyword ? all.filter((row) => row.name.toLowerCase().includes(keyword)) : all;

  const rows = React.useMemo(() => {
    const items = [...filtered];
    const direction = list.order === 'asc' ? 1 : -1;
    const key = list.sortBy as SortKey;
    if (key === 'name') return items.sort((a, b) => a.name.localeCompare(b.name) * direction);
    return items.sort((a, b) => ((a[key] as number) - (b[key] as number)) * direction);
  }, [filtered, list.sortBy, list.order]);

  const schema = React.useMemo<ListSchema<NodeUsage>>(
    () => ({
      title: t('cluster.nodeUsage.title'),
      description: t('cluster.nodeUsage.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'node-usage:search' },
      sortableKeys: ['name', 'cpu', 'memory', 'disk', 'pods'],
      sortAiPrefix: 'node-usage',
      sort: { key: list.sortBy, order: list.order },
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row: NodeUsage) => <span className="truncate font-medium text-ai-fg">{row.name}</span>,
        },
        {
          key: 'cpu',
          title: t('cluster.nodeUsage.cpu'),
          width: 140,
          render: (row: NodeUsage) => <UtilisationCell percent={row.cpu} aiId={`node-usage:cpu:${row.name}`} />,
        },
        {
          key: 'memory',
          title: t('cluster.nodeUsage.memory'),
          width: 140,
          hideBelow: 'md',
          render: (row: NodeUsage) => <UtilisationCell percent={row.memory} aiId={`node-usage:memory:${row.name}`} />,
        },
        {
          key: 'disk',
          title: t('cluster.nodeUsage.disk'),
          width: 140,
          hideBelow: 'lg',
          render: (row: NodeUsage) => <UtilisationCell percent={row.disk} aiId={`node-usage:disk:${row.name}`} />,
        },
        {
          key: 'pods',
          title: t('cluster.nodeUsage.pods'),
          width: 110,
          hideBelow: 'lg',
          render: (row: NodeUsage) => (
            <span className="tabular-nums text-ai-fg-secondary" data-ai-id={`node-usage:pods:${row.name}`}>
              {row.pods}
            </span>
          ),
        },
      ],
      empty: { title: t('cluster.nodeUsage.emptyTitle'), description: t('cluster.nodeUsage.emptyDescription') },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: 1, pageSize: Math.max(rows.length, 10), total: rows.length },
    }),
    [list.sortBy, list.order, rows.length, t],
  );

  const state = usage.isPending ? 'loading' : usage.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="node-usage:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={usage.error} onRetry={() => void usage.refetch()} retryAiId="node-usage:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="node-usage:surface" state={state} className="min-w-0">
      <ResourceList
        schema={schema}
        rows={rows}
        loading={state === 'loading'}
        searchValue={list.keyword}
        onSearchChange={list.setKeyword}
        onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
          if (next) list.setSort(next);
        }}
      />
    </AiSurface>
  );
}

/**
 * A utilisation percentage with a bar.
 *
 * The number and the bar carry the same value: colour alone is not readable for
 * everyone, and a bar alone cannot be compared across rows precisely.
 */
function UtilisationCell({ percent, aiId }: { percent: number; aiId: string }): React.ReactElement {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <span className="flex items-center gap-2" data-ai-id={aiId}>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ai-border">
        <span className="block h-full rounded-full bg-ai-accent" style={{ width: `${Math.round(clamped)}%` }} />
      </span>
      <span className="tabular-nums text-ai-fg-secondary">{Math.round(clamped)}%</span>
    </span>
  );
}

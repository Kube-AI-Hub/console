import * as React from 'react';
import { actionProps } from '@kube-ai-hub/ai-surface';
import {
  AiSurface,
  Button,
  ResourceList,
  Tabs,
  TabsContent,
  type ListSchema,
  type SortOrder,
} from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { useClusterProjectIndex } from './useClusterProjectIndex';
import { useListRefresh } from '@/components/resource/useListRefresh';
import {
  RESOURCE_RANGES,
  toPodRows,
  toWorkloadRows,
  usePodUsage,
  useReplicaSetOwners,
  type ResourceRangeKey,
  type ResourceUsageRow,
} from './resourceMonitorQueries';

/**
 * 应用资源监控.
 *
 * Two rankings over the same window: workloads (Deployment/StatefulSet/DaemonSet and
 * bare pods) and pods. The old console answers "what is using this cluster" only
 * per project; a cluster operator needs the same answer across projects, with the
 * project named on each row.
 *
 * The table is ranked, not paged through in name order: CPU descending is the
 * default, so the first page is the top ten by CPU. Memory and name are the other
 * sort keys, and the range selector changes the window the averages are taken over.
 *
 * The workload tab aggregates pods: the monitoring API has no cluster-wide workload
 * collection, and a Deployment's pods name their ReplicaSet rather than the
 * Deployment, so one ReplicaSet read resolves that hop (see resourceMonitorQueries).
 */
export interface ResourceMonitorPageProps {
  cluster: string;
}

const AI_ID = 'cluster-resource-monitor';
const PAGE_SIZE = 10;

type Tab = 'workloads' | 'pods';
type SortKey = 'name' | 'cpu' | 'memory';

/** The project-console page that owns each row kind, for the name link. */
const OBJECT_PAGES: Record<string, string> = {
  Deployment: 'deployments',
  StatefulSet: 'statefulsets',
  DaemonSet: 'daemonsets',
  Pod: 'pods',
};

function objectHref(params: {
  kind: string;
  workspace: string;
  cluster: string;
  namespace: string;
  name: string;
}): string | undefined {
  const page = OBJECT_PAGES[params.kind];
  if (!page) return undefined;
  return (
    '/kube-frontend/' +
    encodeURIComponent(params.workspace) +
    '/clusters/' +
    encodeURIComponent(params.cluster) +
    '/projects/' +
    encodeURIComponent(params.namespace) +
    '/' +
    page +
    '/' +
    encodeURIComponent(params.name)
  );
}

/**
 * CPU in the old console's shape: cores when at least one core, millicores below.
 *
 * A fixed two-decimal core value would print `0.00` for every idle workload, hiding
 * the difference between "almost nothing" and "a few millicores".
 */
function formatCpu(cores: number, coreUnit: string): string {
  if (cores > 0 && cores < 1) return Math.round(cores * 1000) + ' m';
  return cores.toFixed(2) + ' ' + coreUnit;
}

/** Bytes with the binary prefixes the monitoring values use. */
function formatBytes(bytes: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = Math.max(0, bytes);
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return value.toFixed(index === 0 ? 0 : 2) + ' ' + units[index];
}

export function ResourceMonitorPage({ cluster }: ResourceMonitorPageProps): React.ReactElement {
  const t = useT();
  const [tab, setTab] = React.useState<Tab>('workloads');
  const [rangeKey, setRangeKey] = React.useState<ResourceRangeKey>('1h');
  const list = useResourceListState<SortKey>({
    defaultSortBy: 'cpu',
    defaultOrder: 'desc',
    resetOn: [cluster, tab, rangeKey],
  });
  const workspaceOf = useClusterProjectIndex(cluster);
  const usage = usePodUsage(cluster, rangeKey);
  // The ReplicaSet hop is only needed by the workload tab; the pod tab renders the
  // metrics as they arrive.
  const owners = useReplicaSetOwners(cluster, tab === 'workloads');

  // One control for the page: the workload tab needs the ReplicaSet hop as well, so the source
  // is the union of both reads.
  const listRefresh = useListRefresh('cluster-resource-monitor', {
    isFetching: usage.isFetching || owners.isFetching,
    refetch: () => {
      void usage.refetch();
      void owners.refetch();
    },
  });
  const allRows = React.useMemo(() => {
    const pods = usage.data ?? [];
    return tab === 'workloads' ? toWorkloadRows(pods, owners.data ?? new Map()) : toPodRows(pods);
  }, [owners.data, tab, usage.data]);

  const sorted = React.useMemo(() => {
    const keyword = list.search.trim().toLowerCase();
    const filtered = keyword
      ? allRows.filter(
          (row) => row.name.toLowerCase().includes(keyword) || row.namespace.toLowerCase().includes(keyword),
        )
      : allRows;
    const direction = list.order === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (list.sortBy === 'name') return a.name.localeCompare(b.name) * direction;
      return ((a[list.sortBy] as number) - (b[list.sortBy] as number)) * direction;
    });
  }, [allRows, list.order, list.search, list.sortBy]);

  const pageRows = sorted.slice((list.page - 1) * PAGE_SIZE, list.page * PAGE_SIZE);
  const loading = usage.isPending || (tab === 'workloads' && owners.isPending);
  const state = loading ? 'loading' : usage.isError ? 'error' : allRows.length === 0 ? 'empty' : 'ready';

  const nameCell = (row: ResourceUsageRow) => {
    const detail = objectHref({
      kind: row.kind,
      workspace: workspaceOf.get(row.namespace) ?? 'public',
      cluster,
      namespace: row.namespace,
      name: row.name,
    });
    return (
      <span className="flex min-w-0 flex-col">
        {detail ? (
          <a href={detail} className="truncate font-medium text-ai-accent hover:underline">
            {row.name}
          </a>
        ) : (
          <span className="truncate font-medium text-ai-fg">{row.name}</span>
        )}
        <span className="truncate text-[11px] text-ai-fg-muted">{row.kind}</span>
      </span>
    );
  };

  const schema: ListSchema<ResourceUsageRow> = {
    title: tab === 'workloads' ? t('cluster.resourceMonitor.workloadsTitle') : t('cluster.resourceMonitor.podsTitle'),
    description: '',
    refresh: listRefresh.refresh,
    rowKey: (row) => row.key,
    rowAttributes: (row) => ({ 'data-ai-row': row.key }),
    search: { placeholder: t('cluster.searchPlaceholder'), aiId: AI_ID + ':search' },
    sortableKeys: ['name', 'cpu', 'memory'],
    sortAiPrefix: AI_ID,
    sort: { key: list.sortBy, order: list.order },
    columns: [
      {
        key: 'name',
        title: t('cluster.column.name'),
        render: (row) => nameCell(row),
      },
      {
        key: 'namespace',
        title: t('cluster.workloads.column.project'),
        width: 180,
        hideBelow: 'md',
        render: (row) => <span className="truncate text-ai-fg-secondary">{row.namespace || '-'}</span>,
      },
      {
        key: 'cpu',
        title: t('cluster.resourceMonitor.cpu'),
        width: 140,
        render: (row) => (
          <span className="tabular-nums text-ai-fg-secondary" data-ai-id={AI_ID + ':cpu:' + row.key}>
            {formatCpu(row.cpu, t('cluster.resourceMonitor.cores'))}
          </span>
        ),
      },
      {
        key: 'memory',
        title: t('cluster.resourceMonitor.memory'),
        width: 140,
        render: (row) => (
          <span className="tabular-nums text-ai-fg-secondary" data-ai-id={AI_ID + ':memory:' + row.key}>
            {formatBytes(row.memory)}
          </span>
        ),
      },
    ],
    empty: { title: t('common.empty'), description: t('cluster.resourceMonitor.emptyHint') },
    labels: {
      ...listRefresh.emptyLabels,
      selectAll: t('table.selectAll'),
      selectRow: (index) => t('table.selectRow', { index }),
      moreActions: t('table.moreActions'),
      previous: t('table.previous'),
      next: t('table.next'),
      selected: (count) => t('table.selectedCount', { count }),
    },
    pagination: { page: list.page, pageSize: PAGE_SIZE, total: sorted.length },
  };

  if (usage.isError) {
    return (
      <AiSurface as="section" aiId="cluster-resource-monitor:surface" state="error" className="min-w-0">
        <div className="rounded-ai-md border border-ai-line bg-ai-surface-2 p-6" data-ai-id="cluster-resource-monitor:unavailable">
          <h2 className="text-sm font-medium text-ai-fg">{t('cluster.resourceMonitor.unavailableTitle')}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-ai-fg-muted">{t('cluster.resourceMonitor.unavailableHint')}</p>
          <Button
            className="mt-3"
            size="sm"
            variant="secondary"
            {...actionProps(AI_ID + ':retry')}
            onClick={() => void usage.refetch()}
          >
            {t('common.retry')}
          </Button>
        </div>
      </AiSurface>
    );
  }

  if (state === 'empty') {
    return (
      <AiSurface as="section" aiId="cluster-resource-monitor:surface" state="empty" className="min-w-0">
        <div className="rounded-ai-md border border-ai-line bg-ai-surface-2 p-6" data-ai-id="cluster-resource-monitor:empty">
          <h2 className="text-sm font-medium text-ai-fg">{t('cluster.resourceMonitor.empty')}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-ai-fg-muted">{t('cluster.resourceMonitor.emptyHint')}</p>
        </div>
      </AiSurface>
    );
  }

  const tabs = [
    {
      value: 'workloads',
      label: t('cluster.resourceMonitor.workloadsTab'),
      aiId: AI_ID + ':tab:workloads:trigger',
    },
    {
      value: 'pods',
      label: t('cluster.resourceMonitor.podsTab'),
      aiId: AI_ID + ':tab:pods:trigger',
    },
  ];

  return (
    <AiSurface as="section" aiId="cluster-resource-monitor:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{t('cluster.resourceMonitor.title')}</h1>
        <p className="text-xs text-ai-fg-muted">{t('cluster.resourceMonitor.description')}</p>
      </header>

      {/* The window is the one control that changes both tabs, so it sits above them. */}
      <div className="flex flex-wrap gap-1" {...actionProps(AI_ID + ':range')}>
        {RESOURCE_RANGES.map((entry) => (
          <Button
            key={entry.key}
            size="sm"
            variant={entry.key === rangeKey ? 'primary' : 'secondary'}
            aria-pressed={entry.key === rangeKey}
            {...actionProps(AI_ID + ':range:' + entry.key)}
            onClick={() => setRangeKey(entry.key)}
          >
            {t(('cluster.monitor.range.' + entry.key) as never)}
          </Button>
        ))}
      </div>

      <Tabs
        value={tab}
        onValueChange={(next) => {
          setTab(next as Tab);
          list.setPage(1);
        }}
        items={tabs}
      >
        <TabsContent value="workloads">
          <div data-ai-id="cluster-resource-monitor:tab:workloads" className="pt-2">
            <ResourceList
              schema={schema}
              onRefresh={listRefresh.onRefresh}
              rows={pageRows}
              loading={loading}
              searchValue={list.keyword}
              onSearchChange={list.setKeyword}
              onPageChange={list.setPage}
              onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
                if (next) list.setSort(next);
              }}
            />
          </div>
        </TabsContent>
        <TabsContent value="pods">
          <div data-ai-id="cluster-resource-monitor:tab:pods" className="pt-2">
            <ResourceList
              schema={schema}
              onRefresh={listRefresh.onRefresh}
              rows={pageRows}
              loading={loading}
              searchValue={list.keyword}
              onSearchChange={list.setKeyword}
              onPageChange={list.setPage}
              onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
                if (next) list.setSort(next);
              }}
            />
          </div>
        </TabsContent>
      </Tabs>
    </AiSurface>
  );
}

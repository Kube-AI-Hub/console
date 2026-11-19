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
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { TimeRangePicker, presetRange, type TimeRange } from '@kube-ai-hub/ui/charts';
import { useClusterProjectIndex } from './useClusterProjectIndex';
import { useListRefresh } from '@/components/resource/useListRefresh';
import {
  toPodRows,
  toWorkloadRows,
  usePodUsage,
  useReplicaSetOwners,
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
/** Page sizes the old console offered (`PAGESIZE_OPTION`): 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;
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
  /* The window is a `TimeRange`: any preset, or a fixed span for a review. */
  const [range, setRange] = React.useState<TimeRange>(() => presetRange('1h'));
  const rangeKey = range.kind === 'relative' ? range.key : 'custom';
  const list = useResourceListState<SortKey>({
    defaultSortBy: 'cpu',
    defaultOrder: 'desc',
    defaultPageSize: PAGE_SIZE,
    resetOn: [cluster, tab, rangeKey],
  });
  const workspaceOf = useClusterProjectIndex(cluster);
  const usage = usePodUsage(cluster, range);
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
          <a href={detail} className="truncate font-medium text-ai-link hover:underline">
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
    // Third click of the header cycle returns to the page's default order;
    // a server list must send a sort key, so "off" cannot be absent.
    sortFallback: list.sortFallback,
    sortAiPrefix: AI_ID,
    sort: { key: list.sortBy, order: list.order },
    columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'cluster-resource-monitor:columns' },
    columns: [
      {
        key: 'name',
        title: t('cluster.column.name'),
        /* Pinned: the row's identity, kept in place while the other columns scroll. */
        width: 220,
        pin: 'start',
        render: (row) => nameCell(row),
      },
      {
        key: 'namespace',
        hideable: true,
        title: t('cluster.workloads.column.project'),
        width: 180,
        hideBelow: 'md',
        render: (row) => <span className="truncate text-ai-fg-secondary">{row.namespace || '-'}</span>,
      },
      {
        key: 'cpu',
        hideable: true,
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
        hideable: true,
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
      ...listRefresh.emptyLabels, ...listRefresh.filterLabels,
      selectAll: t('table.selectAll'),
      selectRow: (index) => t('table.selectRow', { index }),
      moreActions: t('table.moreActions'),
      previous: t('table.previous'),
      next: t('table.next'),
      selected: (count) => t('table.selectedCount', { count }),
    },
    pagination: { page: list.page, pageSize: list.pageSize, pageSizeOptions: [...PAGE_SIZES], total: sorted.length },

  };

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('cluster-resource-monitor', columnKeys);

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
      <div className="flex flex-wrap items-center gap-2" {...actionProps(AI_ID + ':range')}>
        <TimeRangePicker
          value={range}
          onChange={(next) => {
            setRange(next);
            // The pod list is a current-value read keyed by the window; a new window
            // is a new question, so it starts at page one.
            list.setPage(1);
          }}
          presets={[
            { key: '1h', ms: 3_600_000, label: t('cluster.monitor.range.1h') },
            { key: '6h', ms: 21_600_000, label: t('cluster.monitor.range.6h') },
            { key: '24h', ms: 86_400_000, label: t('cluster.monitor.range.24h') },
            { key: '7d', ms: 604_800_000, label: t('cluster.monitor.range.7d') },
          ]}
          labels={{
            placeholder: t('cluster.monitor.range.1h'),
            custom: t('cluster.monitor.rangeCustom'),
            rangePlaceholder: t('cluster.monitor.rangePlaceholder'),
            step: t('cluster.monitor.step'),
            stepHint: t('cluster.monitor.stepHint'),
            stepOptions: [],
            cancel: t('common.cancel'),
            confirm: t('common.confirm'),
            invalid: t('cluster.monitor.rangeInvalid'),
          }}
          aiId={AI_ID + ':range'}
        />
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
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
              schema={schema}
              onRefresh={listRefresh.onRefresh}
              rows={pageRows}
              loading={loading}
              refreshing={listRefresh.refreshing}
              searchValue={list.keyword}
              onSearchChange={list.setKeyword}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
              onSortChange={(next: { key: string; order: SortOrder }) => {
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
              onPageSizeChange={list.setPageSize}
              onSortChange={(next: { key: string; order: SortOrder }) => {
                if (next) list.setSort(next);
              }}
            />
          </div>
        </TabsContent>
      </Tabs>
    </AiSurface>
  );
}

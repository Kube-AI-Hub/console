import * as React from 'react';
import { type MetricSeries } from '@kube-ai-hub/api-client';
import { useListRefresh } from '@/components/resource/useListRefresh';
import { actionProps } from '@kube-ai-hub/ai-surface';
import {
  AiSurface,
  Badge,
  Button,
  Empty,
  ResourceList,
  Skeleton,
  Tabs,
  TabsContent,
  type ListSchema,
} from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { formatTimestamp } from '@/lib/time';
import { statusLabel } from '@/lib/status';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import {
  PERFORMANCE_METRICS,
  formatBytes,
  formatMetricValue,
  usageBarClass,
  usagePercent,
  useJuiceFSPerformance,
  useJuiceFSPersistentVolumes,
  useJuiceFSSummary,
  useJuiceFSVolumes,
  type JuiceFSVolumeRow,
  type PerformanceRange,
} from './juicefsQueries';

/**
 * JuiceFS 共享存储.
 *
 * Three tabs, matching the three questions an operator asks of shared storage:
 * which volumes exist and are they healthy (volumes), how full is each one
 * (usage), and why is a model load slow (performance). This is the cluster
 * console's storage group, mirroring the old console's Storage/JuiceFS page.
 *
 * The volume inventory comes from the platform's JuiceFS API, which joins each
 * PV with the client's statfs numbers; performance comes from the monitoring
 * API's juicefs_* series. Both are documented in design/.../juicefs.md.
 */
export interface JuiceFSStoragePageProps {
  cluster: string;
}

const AI_ID = 'cluster-juicefs';

type Tab = 'volumes' | 'usage' | 'performance';

const RANGE_KEYS: Array<{ key: PerformanceRange; labelKey: 'cluster.juicefs.range.1h' | 'cluster.juicefs.range.6h' | 'cluster.juicefs.range.24h' }> = [
  { key: '1h', labelKey: 'cluster.juicefs.range.1h' },
  { key: '6h', labelKey: 'cluster.juicefs.range.6h' },
  { key: '24h', labelKey: 'cluster.juicefs.range.24h' },
];

export function JuiceFSStoragePage({ cluster }: JuiceFSStoragePageProps): React.ReactElement {
  const t = useT();
  const [tab, setTab] = React.useState<Tab>('volumes');
  const [range, setRange] = React.useState<PerformanceRange>('1h');

  const volumes = useJuiceFSVolumes(cluster);
  const summary = useJuiceFSSummary(cluster);
  const pvIndex = useJuiceFSPersistentVolumes(cluster);
  /*
   * Assume metrics are on until the summary says otherwise: waiting for the
   * summary before asking would serialize two independent reads, and the query is
   * simply wrong-but-harmless on the off chance the flag is off (the tab then
   * renders the explanation instead of the table).
   */
  const metricsEnabled = summary.data?.metricsEnabled ?? true;
  const performance = useJuiceFSPerformance(cluster, range, tab === 'performance' && metricsEnabled);

  const rows = React.useMemo<JuiceFSVolumeRow[]>(() => {
    return (volumes.data ?? []).map((volume) => {
      const pv = pvIndex.data?.get(volume.name);
      return { ...volume, phase: pv?.phase ?? '', createdAt: pv?.createdAt ?? '' };
    });
  }, [volumes.data, pvIndex.data]);

  const performanceSeries = performance.data ?? [];
  const seriesByName = React.useMemo(() => {
    const map = new Map<string, MetricSeries>();
    for (const series of performanceSeries) map.set(series.name, series);
    return map;
  }, [performanceSeries]);

  const active = React.useMemo(() => {
    if (tab === 'volumes') {
      return {
        pending: volumes.isPending || pvIndex.isPending,
        error: volumes.error ?? pvIndex.error,
        empty: rows.length === 0,
        retry: () => {
          void volumes.refetch();
          void pvIndex.refetch();
        },
      };
    }
    if (tab === 'usage') {
      return {
        pending: volumes.isPending || summary.isPending,
        error: volumes.error ?? summary.error,
        empty: rows.length === 0,
        retry: () => {
          void volumes.refetch();
          void summary.refetch();
        },
      };
    }
    return {
      pending: metricsEnabled && performance.isPending,
      error: performance.error,
      empty: !metricsEnabled || performanceSeries.length === 0,
      retry: () => void performance.refetch(),
    };
  }, [tab, volumes, pvIndex, summary, performance, metricsEnabled, rows.length, performanceSeries.length]);

  const state = active.pending ? 'loading' : active.error ? 'error' : active.empty ? 'empty' : 'ready';

  const tabs = [
    { value: 'volumes', label: t('cluster.juicefs.tab.volumes'), aiId: 'cluster-juicefs:tab:volumes' },
    { value: 'usage', label: t('cluster.juicefs.tab.usage'), aiId: 'cluster-juicefs:tab:usage' },
    { value: 'performance', label: t('cluster.juicefs.tab.performance'), aiId: 'cluster-juicefs:tab:performance' },
  ];
  const listRefresh = useListRefresh('cluster-juicefs', volumes);

  const schema = React.useMemo<ListSchema<JuiceFSVolumeRow>>(
    () => ({
      rowKey: 'name',
      refresh: listRefresh.refresh,
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      columns: [
        {
          key: 'name',
          title: t('storage.column.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col" {...actionProps(AI_ID + ':volume:' + row.name)}>
              <span className="truncate font-medium text-ai-fg">{row.name}</span>
              <span className="truncate font-mono text-[11px] text-ai-fg-muted">{row.path || '-'}</span>
            </span>
          ),
        },
        {
          key: 'status',
          title: t('storage.column.status'),
          width: 130,
          render: (row) =>
            row.phase ? (
              <Badge tone={phaseTone(row.phase)}>{statusLabel(t, row.phase)}</Badge>
            ) : (
              <span className="text-ai-fg-muted">-</span>
            ),
        },
        {
          key: 'capacity',
          title: t('storage.column.capacity'),
          width: 150,
          render: (row) => (
            <span className="flex items-center gap-1.5">
              <span className="tabular-nums text-ai-fg-secondary">
                {row.capacityBytes > 0 ? formatBytes(row.capacityBytes) : '-'}
              </span>
              {row.quotaDrift ? <Badge tone="warning">{t('cluster.juicefs.quotaDrift')}</Badge> : null}
            </span>
          ),
        },
        {
          key: 'used',
          title: t('cluster.juicefs.column.used'),
          width: 150,
          render: (row) => {
            const percent = usagePercent(row.usedBytes, row.capacityBytes);
            return (
              <span className="flex items-baseline gap-1.5 tabular-nums text-ai-fg-secondary">
                {formatBytes(row.usedBytes)}
                <span className="text-[11px] text-ai-fg-muted">{percent.toFixed(1) + '%'}</span>
              </span>
            );
          },
        },
        {
          key: 'nodes',
          title: t('cluster.juicefs.column.mountedNodes'),
          width: 120,
          hideBelow: 'md',
          render: (row) => (
            <span
              className="tabular-nums text-ai-fg-secondary"
              title={row.mountedNodes.length > 0 ? row.mountedNodes.join(', ') : t('cluster.juicefs.notMounted')}
            >
              {row.mountedNodes.length}
            </span>
          ),
        },
        {
          key: 'createTime',
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      empty: { title: t('cluster.juicefs.volumesEmpty.title'), description: t('cluster.juicefs.volumesEmpty.description') },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
    }),
    [t, volumes.isFetching],
  );

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId={AI_ID + ':surface'} state="error" className="min-w-0">
        <ResourceErrorPanel error={active.error} onRetry={active.retry} retryAiId={AI_ID + ':retry'} />
      </AiSurface>
    );
  }

  return (
    <AiSurface
      as="section"
      aiId={AI_ID + ':surface'}
      state={state}
      className="flex min-w-0 flex-col gap-4"
      data-ai-id="cluster-juicefs:body"
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{t('cluster.juicefs.title')}</h1>
        <p className="text-xs text-ai-fg-muted">{t('cluster.juicefs.description')}</p>
      </header>

      <Tabs value={tab} onValueChange={(next) => setTab(next as Tab)} items={tabs}>
        <TabsContent value="volumes">
          <div data-ai-id="cluster-juicefs:volumes" className="pt-3">
            {state === 'loading' ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <ResourceList schema={schema} onRefresh={listRefresh.onRefresh} rows={rows} loading={false} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="usage">
          <UsageTab rows={rows} summary={summary.data} state={state} />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceTab
            range={range}
            onRangeChange={setRange}
            metricsEnabled={metricsEnabled}
            seriesByName={seriesByName}
            state={state}
          />
        </TabsContent>
      </Tabs>
    </AiSurface>
  );
}

/** Status → badge tone: a bound volume is healthy, anything else wants a look. */
function phaseTone(phase: string): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
  if (phase === 'Bound') return 'success';
  if (phase === 'Available') return 'info';
  if (phase === 'Released') return 'warning';
  if (phase === 'Failed') return 'danger';
  return 'neutral';
}

/* ---------------- 用量 ---------------- */

function UsageTab({
  rows,
  summary,
  state,
}: {
  rows: JuiceFSVolumeRow[];
  summary:
    | { volumeCount: number; capacityBytes: number; usedBytes: number; maxUsageRatio: number; metricsEnabled: boolean; storageNodes: string[] }
    | undefined;
  state: string;
}): React.ReactElement {
  const t = useT();

  if (state === 'loading') {
    return (
      <div data-ai-id="cluster-juicefs:usage" className="flex flex-col gap-3 pt-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div data-ai-id="cluster-juicefs:usage" className="pt-3">
        <Empty title={t('cluster.juicefs.volumesEmpty.title')} description={t('cluster.juicefs.volumesEmpty.description')} />
      </div>
    );
  }

  const sorted = [...rows].sort(
    (left, right) => usagePercent(right.usedBytes, right.capacityBytes) - usagePercent(left.usedBytes, left.capacityBytes),
  );
  const capacity = summary?.capacityBytes ?? rows.reduce((total, row) => total + row.capacityBytes, 0);
  const used = summary?.usedBytes ?? rows.reduce((total, row) => total + row.usedBytes, 0);
  const maxUsage = summary ? summary.maxUsageRatio * 100 : usagePercent(used, capacity);
  const storageNodes = summary?.storageNodes ?? [];

  const drifting = rows.filter((row) => row.quotaDrift);
  const nested = rows.filter((row) => row.parent);

  return (
    <div data-ai-id="cluster-juicefs:usage" className="flex flex-col gap-4 pt-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label={t('cluster.juicefs.card.volumes')} value={String(summary?.volumeCount ?? rows.length)} />
        <SummaryCard label={t('cluster.juicefs.card.capacity')} value={formatBytes(capacity)} />
        <SummaryCard label={t('cluster.juicefs.card.used')} value={formatBytes(used)} />
        <SummaryCard label={t('cluster.juicefs.card.maxUsage')} value={maxUsage.toFixed(1) + '%'} />
      </div>

      {storageNodes.length > 0 ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id="cluster-juicefs:storage-nodes">
          {t('cluster.juicefs.storageNodes') + ': ' + storageNodes.join(', ')}
        </p>
      ) : null}

      {drifting.length > 0 ? (
        <p data-ai-id="cluster-juicefs:hint:quota-drift" className="rounded-ai-md border border-ai-warning/40 px-3 py-2 text-xs text-ai-fg-secondary">
          {t('cluster.juicefs.quotaDriftHint', { volumes: drifting.map((row) => row.path || row.name).join(', ') })}
        </p>
      ) : null}

      {nested.length > 0 ? (
        <p data-ai-id="cluster-juicefs:hint:nested" className="rounded-ai-md border border-ai-line px-3 py-2 text-xs text-ai-fg-secondary">
          {t('cluster.juicefs.nestedHint')}
        </p>
      ) : null}

      <section className="rounded-ai-md border border-ai-line p-4">
        <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('cluster.juicefs.usageByVolume')}</h2>
        <div className="flex flex-col gap-4">
          {sorted.map((row) => {
            const percent = usagePercent(row.usedBytes, row.capacityBytes);
            return (
              <div key={row.name} className="flex flex-col gap-1" data-ai-id={AI_ID + ':usage:' + row.name}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-mono text-ai-fg">{row.path || row.name}</span>
                    <span className="truncate text-[11px] text-ai-fg-muted">
                      {row.claimNamespace + '/' + row.claimName}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-ai-fg-secondary">
                    {formatBytes(row.usedBytes) + ' / ' + formatBytes(row.capacityBytes)}
                    <span className="ml-2 text-ai-fg">{percent.toFixed(1) + '%'}</span>
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-ai-pill bg-ai-surface-3">
                  <div
                    className={'h-full rounded-ai-pill ' + usageBarClass(percent)}
                    style={{ width: Math.max(percent, 1) + '%' }}
                  />
                </div>
                {row.inodes > 0 ? (
                  <span className="text-[11px] text-ai-fg-muted">
                    {t('cluster.juicefs.inodes') + ': ' + row.inodesUsed + ' / ' + row.inodes}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex flex-col gap-1 rounded-ai-md border border-ai-line p-3">
      <span className="text-[11px] text-ai-fg-muted">{label}</span>
      <span className="text-base font-semibold tabular-nums text-ai-fg">{value}</span>
    </div>
  );
}

/* ---------------- 性能 ---------------- */

function PerformanceTab({
  range,
  onRangeChange,
  metricsEnabled,
  seriesByName,
  state,
}: {
  range: PerformanceRange;
  onRangeChange: (next: PerformanceRange) => void;
  metricsEnabled: boolean;
  seriesByName: Map<string, MetricSeries>;
  state: string;
}): React.ReactElement {
  const t = useT();

  const rangeButtons = RANGE_KEYS.map((entry) => (
    <Button
      key={entry.key}
      size="sm"
      variant={range === entry.key ? 'secondary' : 'ghost'}
      aria-pressed={range === entry.key}
      data-ai-id={AI_ID + ':range:' + entry.key}
      onClick={() => onRangeChange(entry.key)}
    >
      {t(entry.labelKey)}
    </Button>
  ));

  if (!metricsEnabled) {
    return (
      <div data-ai-id="cluster-juicefs:performance" className="flex flex-col gap-3 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">{rangeButtons}</div>
        <Empty title={t('cluster.juicefs.performanceEmpty.title')} description={t('cluster.juicefs.metricsOffHint')} />
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div data-ai-id="cluster-juicefs:performance" className="flex flex-col gap-3 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">{rangeButtons}</div>
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  const stats = PERFORMANCE_METRICS.map((descriptor) => ({
    descriptor,
    series: seriesByName.get(descriptor.metric),
  })).filter((entry): entry is { descriptor: (typeof PERFORMANCE_METRICS)[number]; series: MetricSeries } => {
    return entry.series !== undefined && entry.series.points.length > 0;
  });

  if (stats.length === 0) {
    return (
      <div data-ai-id="cluster-juicefs:performance" className="flex flex-col gap-3 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">{rangeButtons}</div>
        <Empty
          title={t('cluster.juicefs.performanceEmpty.title')}
          description={t('cluster.juicefs.performanceEmpty.description')}
        />
      </div>
    );
  }

  const throughputIsZero = ['juicefs_read_bytes', 'juicefs_written_bytes'].every((metric) => {
    const series = seriesByName.get(metric);
    if (!series) return true;
    return series.points.every((point) => point.value === 0);
  });

  return (
    <div data-ai-id="cluster-juicefs:performance" className="flex flex-col gap-3 pt-3">
      <div className="flex flex-wrap items-center gap-1.5">{rangeButtons}</div>

      <div className="overflow-x-auto rounded-ai-md border border-ai-line">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-ai-line text-left text-ai-fg-muted">
              <th className="px-3 py-2 font-medium">{t('cluster.juicefs.metric')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('cluster.juicefs.latest')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('cluster.juicefs.average')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('cluster.juicefs.max')}</th>
              <th className="px-3 py-2 font-medium">{t('cluster.juicefs.trend')}</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(({ descriptor, series }) => {
              const values = series.points.map((point) => point.value);
              return (
                <tr key={descriptor.metric} className="border-b border-ai-line last:border-b-0" data-ai-id={AI_ID + ':metric:' + descriptor.metric}>
                  <td className="px-3 py-2 text-ai-fg-secondary">{t(descriptor.labelKey)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ai-fg">
                    {formatMetricValue(descriptor.kind, values[values.length - 1] ?? 0, t)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ai-fg-secondary">
                    {formatMetricValue(descriptor.kind, average(values), t)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ai-fg-secondary">
                    {formatMetricValue(descriptor.kind, Math.max(...values), t)}
                  </td>
                  <td className="px-3 py-2">
                    <Sparkline values={values} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {throughputIsZero ? (
        <p data-ai-id="cluster-juicefs:no-traffic" className="text-xs text-ai-fg-muted">
          {t('cluster.juicefs.noTraffic')}
        </p>
      ) : null}
    </div>
  );
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * A 96x24 trend line.
 *
 * ai-kit ships no charting library and one sparkline is not worth adding one;
 * the same trade the cluster monitor page makes for its four trends.
 */
function Sparkline({ values }: { values: number[] }): React.ReactElement {
  const width = 96;
  const height = 24;
  if (values.length < 2) return <span className="text-ai-fg-muted">-</span>;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  let path = '';
  for (let index = 0; index < values.length; index += 1) {
    const x = (index * step).toFixed(1);
    const y = (height - 2 - (((values[index] ?? min) - min) / span) * (height - 4)).toFixed(1);
    path += (index === 0 ? 'M' : 'L') + x + ',' + y + ' ';
  }

  return (
    <svg width={width} height={height} viewBox={'0 0 ' + width + ' ' + height} className="text-ai-accent" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
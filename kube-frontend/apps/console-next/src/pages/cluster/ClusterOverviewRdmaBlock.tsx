import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MetricSeries } from '@kube-ai-hub/api-client';
import { rdmaPortsApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Button, TREND_SERIES_COLORS, type TrendSeries } from '@kube-ai-hub/ui';
import { TimeSeriesChart } from '@kube-ai-hub/ui/charts';
import type { LocaleKey } from '@kube-ai-hub/locales';
import { api as apiClient } from '@/api';
import { useT } from '@/i18n';
import { formatBytesPerSecond } from './monitorFormat';

/**
 * RDMA 状态: the old overview's tabbed block, restored.
 *
 * The old console put four metrics in one block — health, port status, throughput and
 * errors — each a tab with its own curve, plus a list of nodes whose ports are down.
 * The first version of this page kept only four numbers and a link, which read as
 * "RDMA is a footnote" while the block is the only place a fabric fault shows up.
 *
 * Every tab plots from the overview's single range query (the series are already in
 * memory); only the port inventory is its own read, because it is an inventory, not a
 * metric.
 */

export interface RdmaTabSpec {
  key: 'health' | 'ports' | 'throughput' | 'errors';
  labelKey: LocaleKey;
  /** Series plotted for this tab, in legend order. */
  lines: Array<{ metric: string; labelKey: LocaleKey; scale?: number }>;
  kind: 'percent' | 'count' | 'rate';
}

export const RDMA_TABS: readonly RdmaTabSpec[] = [
  {
    key: 'health',
    labelKey: 'cluster.monitor.rdmaHealth',
    lines: [{ metric: 'cluster_ib_health', labelKey: 'cluster.monitor.series.health', scale: 100 }],
    kind: 'percent',
  },
  {
    key: 'ports',
    labelKey: 'cluster.monitor.rdmaPorts',
    lines: [
      { metric: 'cluster_ib_port_up', labelKey: 'cluster.monitor.series.portUp' },
      { metric: 'cluster_ib_port_total', labelKey: 'cluster.monitor.series.portTotal' },
    ],
    kind: 'count',
  },
  {
    key: 'throughput',
    labelKey: 'cluster.monitor.resource.rdmaThroughput',
    lines: [
      { metric: 'cluster_ib_tx_bytes', labelKey: 'cluster.monitor.series.tx' },
      { metric: 'cluster_ib_rx_bytes', labelKey: 'cluster.monitor.series.rx' },
    ],
    kind: 'rate',
  },
  {
    key: 'errors',
    labelKey: 'cluster.monitor.overview.rdmaErrorsTab',
    lines: [
      { metric: 'cluster_ib_rx_errors', labelKey: 'cluster.monitor.series.rxErrors' },
      { metric: 'cluster_ib_retrans', labelKey: 'cluster.monitor.series.retrans' },
    ],
    kind: 'count',
  },
];

/** Every metric the block reads, so the overview can ask for them in one query. */
export const RDMA_BLOCK_METRICS = Array.from(
  new Set(RDMA_TABS.flatMap((tab) => tab.lines.map((line) => line.metric))),
);

function formatValue(value: number, kind: RdmaTabSpec['kind']): string {
  if (kind === 'percent') {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
  }
  if (kind === 'rate') return `${formatBytesPerSecond(value)}/s`;
  return String(Math.round(value));
}

function toSeries(
  t: ReturnType<typeof useT>,
  tab: RdmaTabSpec,
  seriesByName: Map<string, MetricSeries>,
): TrendSeries[] {
  const out: TrendSeries[] = [];
  for (const line of tab.lines) {
    const series = seriesByName.get(line.metric);
    if (!series) continue;
    const scale = line.scale ?? 1;
    const points = series.points
      .filter((point) => Number.isFinite(point.value) && Number.isFinite(point.at))
      .map((point) => ({ at: point.at, value: point.value * scale }));
    if (points.length === 0) continue;
    out.push({ key: line.metric, label: t(line.labelKey), points });
  }
  return out;
}

/** Nodes whose ports are not all healthy, worst first. */
export function abnormalNodes(ports: Array<{ node: string; healthy: boolean }>): Array<{ node: string; down: number; total: number }> {
  const byNode = new Map<string, { node: string; down: number; total: number }>();
  for (const port of ports) {
    const entry = byNode.get(port.node) ?? { node: port.node, down: 0, total: 0 };
    entry.total += 1;
    if (!port.healthy) entry.down += 1;
    byNode.set(port.node, entry);
  }
  return [...byNode.values()].filter((entry) => entry.down > 0).sort((a, b) => b.down - a.down);
}

export function ClusterOverviewRdmaBlock({
  cluster,
  seriesByName,
  start,
  end,
  refreshing = false,
}: {
  cluster: string;
  seriesByName: Map<string, MetricSeries>;
  start: number;
  end: number;
  /**
   * A reader-initiated refresh is in flight.
   *
   * The block reads the series its tab already fetched, so it has no query of its
   * own to report one — the tab passes its manual-refresh signal down. Without it the
   * block's curve changed with no feedback while every neighbouring card veiled,
   * which read as "this one did not refresh".
   */
  refreshing?: boolean;
}): React.ReactElement {
  const t = useT();
  const [selected, setSelected] = React.useState<RdmaTabSpec['key']>('health');
  const tab = RDMA_TABS.find((entry) => entry.key === selected) ?? RDMA_TABS[0]!;

  /*
   * The port inventory is a different question from the metrics: it says *which node*
   * to look at. A failed read hides the sentence rather than claiming "all healthy" —
   * a cluster without the RDMA collector answers 404, and "no data" is not "fine".
   */
  const inventory = useQuery({
    queryKey: ['cluster-monitor', 'rdma-ports', cluster],
    queryFn: ({ signal }) => rdmaPortsApi(apiClient).list({ cluster, signal }),
    staleTime: 30_000,
    retry: false,
  });

  const lines = toSeries(t, tab, seriesByName);
  const latest = lines.map((line) => ({ key: line.key, label: line.label, value: line.points[line.points.length - 1]?.value }));
  const empty = lines.length === 0;

  return (
    <section className="flex flex-col gap-3" data-ai-id="cluster-monitor:overview:rdma">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-ai-fg-secondary">{t('cluster.monitor.overview.rdma')}</h2>
        <p className="text-xs text-ai-fg-muted">{t('cluster.monitor.overview.rdmaHint')}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <ul className="flex flex-col gap-0.5 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-1.5" data-ai-id="cluster-monitor:overview:rdma:tabs">
          {RDMA_TABS.map((entry) => {
            const entryLines = toSeries(t, entry, seriesByName);
            const active = entry.key === selected;
            return (
              <li key={entry.key}>
                <Button
                  variant="ghost"
                  size="sm"
                  block
                  aria-pressed={active}
                  className={
                    'justify-between gap-2 px-2 text-left' +
                    (active ? ' border-l-2 border-l-ai-accent bg-ai-accent/10 text-ai-fg' : '')
                  }
                  data-ai-state={entryLines.length > 0 ? 'ready' : 'empty'}
                  {...actionProps(`cluster-monitor:overview:rdma:tab:${entry.key}`)}
                  onClick={() => setSelected(entry.key)}
                >
                  <span className="min-w-0 truncate text-xs text-ai-fg-secondary">{t(entry.labelKey)}</span>
                  <span
                    className="shrink-0 text-xs font-medium tabular-nums text-ai-fg"
                    data-ai-id={`cluster-monitor:overview:rdma:tab:${entry.key}:value`}
                  >
                    {entryLines.length === 0
                      ? '-'
                      : entryLines.map((line) => formatValue(line.points[line.points.length - 1]!.value, entry.kind)).join(' / ')}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>

        <section
          className="flex min-w-0 flex-col gap-2 rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4"
          data-ai-id="cluster-monitor:overview:rdma:chart"
          data-ai-state={empty ? 'empty' : 'ready'}
          aria-label={t(tab.labelKey)}
        >
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium text-ai-fg">{t(tab.labelKey)}</h3>
            <span className="text-xs tabular-nums text-ai-fg-muted" data-ai-id="cluster-monitor:overview:rdma:chart:now">
              {latest.length === 0 ? '-' : latest.map((line) => formatValue(line.value ?? 0, tab.kind)).join(' / ')}
            </span>
          </div>
          {inventory.isSuccess ? (
            <RdmaInventoryNote ports={inventory.data} />
          ) : inventory.isError ? (
            <p className="text-xs text-ai-fg-muted" data-ai-id="cluster-monitor:overview:rdma:inventory-unavailable">
              {t('cluster.monitor.rdmaInventoryUnavailable')}
            </p>
          ) : null}
          {empty ? (
            <div className="flex flex-col gap-1 py-10" data-ai-id="cluster-monitor:overview:rdma:chart:empty">
              <p className="text-sm text-ai-fg-secondary">{t('cluster.monitor.empty')}</p>
              <p className="text-xs text-ai-fg-muted">{t('cluster.monitor.emptyHint')}</p>
            </div>
          ) : (
            <>
              <TimeSeriesChart
                series={lines.map((line) => ({ ...line, smooth: true }))}
                start={start}
                end={end}
                label={t(tab.labelKey)}
                emptyText={t('cluster.monitor.empty')}
                height={160}
                formatValue={(value) => formatValue(value, tab.kind)}
                refreshing={refreshing}
                refreshingLabel={t('cluster.monitor.refreshing')}
                data-ai-id="cluster-monitor:overview:rdma:chart:plot"
              />
              <div className="flex flex-wrap items-center gap-3 text-xs" data-ai-id="cluster-monitor:overview:rdma:chart:legend">
                {latest.map((line, index) => (
                  <span key={line.key} className="flex items-center gap-1.5" data-ai-id={`cluster-monitor:overview:rdma:legend:${line.key}`}>
                    <i className="size-2 rounded-full" style={{ background: TREND_SERIES_COLORS[index % TREND_SERIES_COLORS.length] }} />
                    <span className="text-ai-fg-secondary">{line.label}</span>
                    <span className="tabular-nums text-ai-fg-muted">{line.value === undefined ? '-' : formatValue(line.value, tab.kind)}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}

/** "All ports healthy" or the nodes that are not. */
function RdmaInventoryNote({ ports }: { ports: Array<{ node: string; healthy: boolean }> }): React.ReactElement {
  const t = useT();
  const abnormal = abnormalNodes(ports);
  if (abnormal.length === 0) {
    return (
      <p className="text-xs text-ai-fg-muted" data-ai-id="cluster-monitor:overview:rdma:no-abnormal">
        {t('cluster.monitor.rdmaNoAbnormalNodes')}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1" data-ai-id="cluster-monitor:overview:rdma:abnormal">
      <p className="text-xs font-medium text-ai-warning">{t('cluster.monitor.rdmaAbnormalNodes')}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ai-fg-secondary">
        {abnormal.map((entry) => (
          <li key={entry.node} className="flex items-center gap-2" data-ai-id={`cluster-monitor:overview:rdma:abnormal:${entry.node}`}>
            <span className="tabular-nums">{entry.node}</span>
            <span className="text-ai-fg-muted">{t('cluster.monitor.rdmaAbnormalPorts').replace('{down}', String(entry.down)).replace('{total}', String(entry.total))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

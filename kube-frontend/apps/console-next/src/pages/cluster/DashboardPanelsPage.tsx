import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { clusterDashboardsApi, promqlApi, type PromqlSeries } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Button, Skeleton, TrendChart } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

/**
 * 自定义监控仪表板（只读面板）. 
 *
 * The old console opens a Grafana-style editor here. Editing is out of scope, but the panels
 * themselves are just documents: `spec.panels[]` holds `row` separators, `singlestat` tiles and
 * `graph` series, each with `targets[].expr` PromQL. Rendering them read-only is what makes a
 * dashboard useful at all — without it the page could only show that a dashboard exists.
 *
 * Two deliberate limits, both stated on the page rather than hidden:
 * - the expressions run against the **host** cluster's Prometheus (see `promqlApi`), because
 *   that is the only evaluator this deployment exposes;
 * - a panel whose expression fails shows its own error, not a blank tile: one broken PromQL
 *   line must not take the rest of the dashboard down.
 */
export interface DashboardPanelsPageProps {
  cluster: string;
  name: string;
}

interface PanelTarget {
  expr?: string;
  legendFormat?: string;
}

interface DashboardPanel {
  id?: number;
  type?: string;
  title?: string;
  format?: string;
  decimals?: number;
  targets?: PanelTarget[];
}

const WINDOWS = [
  { key: '1h', ms: 60 * 60 * 1000, step: '60s' },
  { key: '6h', ms: 6 * 60 * 60 * 1000, step: '5m' },
  { key: '24h', ms: 24 * 60 * 60 * 1000, step: '15m' },
  { key: '7d', ms: 7 * 24 * 60 * 60 * 1000, step: '2h' },
] as const;

type WindowKey = (typeof WINDOWS)[number]['key'];

function panelsOf(raw: Record<string, unknown> | null | undefined): DashboardPanel[] {
  const spec = (raw?.['spec'] ?? {}) as Record<string, unknown>;
  const panels = Array.isArray(spec['panels']) ? (spec['panels'] as DashboardPanel[]) : [];
  return panels.filter((panel) => panel && typeof panel === 'object');
}

/** Grafana `format` values that mean a byte count, so the number is shown in binary units. */
function isBytes(format: string | undefined): boolean {
  return Boolean(format && /bytes|bits/i.test(format));
}

function formatSingle(value: number, panel: DashboardPanel): string {
  const decimals = typeof panel.decimals === 'number' && panel.decimals >= 0 ? panel.decimals : 2;
  if (isBytes(panel.format)) {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    let scaled = Math.abs(value);
    let unit = 0;
    while (scaled >= 1024 && unit < units.length - 1) {
      scaled /= 1024;
      unit += 1;
    }
    return `${value < 0 ? '-' : ''}${scaled.toFixed(decimals)} ${units[unit]}`;
  }
  return value.toFixed(decimals);
}

export function DashboardPanelsPage({ cluster, name }: DashboardPanelsPageProps): React.ReactElement {
  const t = useT();
  const [windowKey, setWindowKey] = React.useState<WindowKey>('1h');
  const window = WINDOWS.find((entry) => entry.key === windowKey) ?? WINDOWS[0];

  /* Resolved once per window change, never inside a query key: `Date.now()` there refetches forever. */
  const [range, setRange] = React.useState(() => {
    const end = Math.floor(Date.now() / 1000) * 1000;
    return { start: end - WINDOWS[0].ms, end };
  });
  React.useEffect(() => {
    const end = Math.floor(Date.now() / 1000) * 1000;
    setRange({ start: end - window.ms, end });
  }, [window.ms, windowKey]);

  const dashboard = useQuery({
    queryKey: ['cluster-dashboard', cluster, name],
    queryFn: ({ signal }) => clusterDashboardsApi(apiClient).get({ name, signal }),
    retry: false,
  });

  const panels = React.useMemo(() => panelsOf(dashboard.data), [dashboard.data]);
  const state = dashboard.isPending ? 'loading' : dashboard.isError ? 'error' : 'ready';
  const title = String(((dashboard.data?.['spec'] ?? {}) as Record<string, unknown>)['title'] ?? '') || name;

  return (
    <AiSurface as="section" aiId="dashboard-panels:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <Link
            to="/kube-frontend/clusters/$cluster/custom-monitoring"
            params={{ cluster }}
            className="inline-flex items-center text-xs text-ai-link hover:underline"
            {...actionProps('dashboard-panels:back')}
          >
            ← {t('customMonitoring.title')}
          </Link>
          <h1 className="text-lg font-semibold text-ai-fg" data-ai-id="dashboard-panels:title">
            {title}
          </h1>
          <p className="text-xs text-ai-fg-muted" data-ai-id="dashboard-panels:readonly-note">
            {t('customMonitoring.panelsReadOnly')}
          </p>
        </div>
        <div className="flex flex-wrap gap-1" {...actionProps('dashboard-panels:range')}>
          {WINDOWS.map((entry) => (
            <Button
              key={entry.key}
              size="sm"
              variant={entry.key === windowKey ? 'primary' : 'secondary'}
              aria-pressed={entry.key === windowKey}
              {...actionProps(`dashboard-panels:range:${entry.key}`)}
              onClick={() => setWindowKey(entry.key)}
            >
              {t(`cluster.monitor.range.${entry.key}`)}
            </Button>
          ))}
        </div>
      </div>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={dashboard.error} onRetry={() => void dashboard.refetch()} retryAiId="dashboard-panels:retry" />
      ) : null}

      {state === 'ready' && panels.length === 0 ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id="dashboard-panels:empty">
          {t('customMonitoring.panelsEmpty')}
        </p>
      ) : null}

      {state === 'ready' && panels.length > 0 ? (
        <div className="flex flex-col gap-3">
          {panels.map((panel, index) => (
            <PanelView
              key={`${panel.id ?? index}-${panel.title ?? ''}`}
              panel={panel}
              index={index}
              start={range.start}
              end={range.end}
              step={window.step}
            />
          ))}
        </div>
      ) : null}
    </AiSurface>
  );
}

/** One panel: a section heading, a single value, or a set of lines. */
function PanelView({
  panel,
  index,
  start,
  end,
  step,
}: {
  panel: DashboardPanel;
  index: number;
  start: number;
  end: number;
  step: string;
}): React.ReactElement {
  const t = useT();
  const type = String(panel.type ?? '');
  const exprs = (panel.targets ?? []).map((target) => String(target.expr ?? '').trim()).filter(Boolean);

  // `row` is layout, not data: the old console draws it as a heading between panels.
  if (type === 'row') {
    return (
      <h2 className="mt-2 text-sm font-medium text-ai-fg" data-ai-id={`dashboard-panels:row:${index}`}>
        {panel.title || '-'}
      </h2>
    );
  }

  return (
    <section
      className="rounded-lg border border-ai-border bg-ai-surface p-4"
      {...actionProps(`dashboard-panels:panel:${index}`)}
      data-ai-panel-type={type}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-ai-fg">{panel.title || '-'}</h2>
        <span className="text-[11px] text-ai-fg-muted">{type || '-'}</span>
      </div>
      {exprs.length === 0 ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id={`dashboard-panels:panel:${index}:no-expr`}>
          {t('customMonitoring.panelNoExpression')}
        </p>
      ) : type === 'singlestat' ? (
        <SingleStatPanel panel={panel} expr={exprs[0] as string} index={index} />
      ) : (
        <GraphPanel exprs={exprs} index={index} start={start} end={end} step={step} />
      )}
    </section>
  );
}

function SingleStatPanel({ panel, expr, index }: { panel: DashboardPanel; expr: string; index: number }): React.ReactElement {
  const t = useT();
  const query = useQuery({
    queryKey: ['dashboard-panel-stat', expr],
    queryFn: ({ signal }) => promqlApi(apiClient).instant({ query: expr, signal }),
    staleTime: 30_000,
    retry: false,
  });

  if (query.isPending) return <Skeleton className="h-10 w-32" />;
  if (query.isError) {
    return (
      <p className="text-xs text-ai-danger" data-ai-id={`dashboard-panels:panel:${index}:error`}>
        {t('customMonitoring.panelQueryFailed')}
      </p>
    );
  }
  const series = query.data ?? [];
  if (series.length === 0) {
    return (
      <p className="text-xs text-ai-fg-muted" data-ai-id={`dashboard-panels:panel:${index}:empty`}>
        {t('customMonitoring.panelNoData')}
      </p>
    );
  }
  const first = series[0];
  const value = first?.points[first.points.length - 1]?.value ?? 0;
  return (
    <p className="text-2xl font-semibold tabular-nums text-ai-fg" data-ai-id={`dashboard-panels:panel:${index}:value`}>
      {formatSingle(value, panel)}
    </p>
  );
}

function GraphPanel({
  exprs,
  index,
  start,
  end,
  step,
}: {
  exprs: string[];
  index: number;
  start: number;
  end: number;
  step: string;
}): React.ReactElement {
  const t = useT();
  const query = useQuery({
    queryKey: ['dashboard-panel-graph', exprs.join('|'), start, end, step],
    queryFn: async ({ signal }) => {
      const all: PromqlSeries[] = [];
      for (const expr of exprs) {
        const series = await promqlApi(apiClient).range({ query: expr, start, end, step, signal });
        all.push(...series);
      }
      return all;
    },
    staleTime: 60_000,
    retry: false,
  });

  if (query.isPending) return <Skeleton className="h-24 w-full" />;
  if (query.isError) {
    return (
      <p className="text-xs text-ai-danger" data-ai-id={`dashboard-panels:panel:${index}:error`}>
        {t('customMonitoring.panelQueryFailed')}
      </p>
    );
  }
  const series = query.data ?? [];
  if (series.length === 0) {
    return (
      <p className="text-xs text-ai-fg-muted" data-ai-id={`dashboard-panels:panel:${index}:empty`}>
        {t('customMonitoring.panelNoData')}
      </p>
    );
  }
  /*
   * Several series are summed per timestamp rather than drawn as separate lines: the migrated
   * chart component takes one line, and summing is what a single dashboard tile usually means.
   * The label count is printed so a reader knows how many series were folded in.
   */
  const byTime = new Map<number, number>();
  for (const item of series) {
    for (const point of item.points) byTime.set(point.at, (byTime.get(point.at) ?? 0) + point.value);
  }
  const points = [...byTime.entries()].map(([at, value]) => ({ at, value })).sort((a, b) => a.at - b.at);
  return (
    <div data-ai-id={`dashboard-panels:panel:${index}:chart`}>
      <TrendChart points={points} start={start} end={end} label={`${series.length} series`} emptyText="-" data-ai-id={`dashboard-panels:panel:${index}:line`} />
      <p className="mt-1 text-[11px] text-ai-fg-muted">{t('customMonitoring.panelSeriesNote', { count: series.length })}</p>
    </div>
  );
}

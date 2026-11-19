import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { promqlApi } from '@kube-ai-hub/api-client';
import {
  AiSurface,
  Button,
  Modal,
  Skeleton,
  TREND_SERIES_COLORS,
  type TrendPoint,
  type TrendSeries,
} from '@kube-ai-hub/ui';
import { TimeSeriesChart } from '@kube-ai-hub/ui/charts';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage } from '@/components/resource/ResourceErrorPanel';

/**
 * 查看规则指标数据.
 *
 * The old console opened a chart for a rule's expression (the small "view metric data"
 * button next to each rule on the policy detail). The replacement reads the same thing
 * the old one did: the expression evaluated over the recent window, through the
 * apiserver's Prometheus proxy — named-metric kapis cannot evaluate arbitrary PromQL.
 *
 * There is no fabricated y-axis unit: a rule's expression may be cores, bytes, a ratio
 * or a count, and the expression itself is the only authority. The value is printed raw,
 * and an expression that returns no series says so instead of drawing a flat zero.
 */
export interface RuleMetricDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: { name: string; expression: string; summary?: string } | null;
}

/** One hour at a 60s step: enough shape to read a threshold crossing, cheap to evaluate. */
const WINDOW_MS = 60 * 60 * 1000;
const STEP = '60s';

/** Label set → a short legend name. Falls back to the rule name for a bare series. */
function seriesLabel(labels: Record<string, string>, fallback: string): string {
  const name = labels['node'] || labels['instance'] || labels['pod'] || labels['job'] || labels['namespace'] || '';
  return name || Object.entries(labels).map(([key, value]) => `${key}=${value}`).join(', ') || fallback;
}

export function RuleMetricDialog({ open, onOpenChange, rule }: RuleMetricDialogProps): React.ReactElement {
  const t = useT();
  // The window is fixed when the dialog opens: a live-shifting [now-1h, now] would
  // re-request on every render for a chart the reader is looking at.
  const [range, setRange] = React.useState<{ start: number; end: number }>({ start: 0, end: 0 });
  React.useEffect(() => {
    if (!open) return;
    const end = Date.now();
    setRange({ start: end - WINDOW_MS, end });
  }, [open, rule?.expression]);

  const enabled = open && range.end > range.start && Boolean(rule?.expression);
  const query = useQuery({
    enabled,
    queryKey: ['rule-metric', rule?.expression, range.start, range.end],
    queryFn: ({ signal }) =>
      promqlApi(apiClient).range({
        query: rule?.expression ?? '',
        start: range.start,
        end: range.end,
        step: STEP,
        signal,
      }),
  });

  const series: TrendSeries[] = (query.data ?? []).map((entry, index) => ({
    key: `${index}:${JSON.stringify(entry.labels)}`,
    label: seriesLabel(entry.labels, rule?.name ?? ''),
    points: entry.points as TrendPoint[],
    color: TREND_SERIES_COLORS[index % TREND_SERIES_COLORS.length],
  }));
  const state = !enabled || query.isPending ? 'loading' : query.isError ? 'error' : series.length === 0 ? 'empty' : 'ready';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={`${t('monitoring.ruleGroups.metric.title')} · ${rule?.name ?? ''}`}
    >
      <div className="flex flex-col gap-3" data-ai-id="alertingrules:metric">
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-ai-fg-secondary">{rule?.summary || t('monitoring.ruleGroups.noDescription')}</span>
          <code className="block whitespace-pre-wrap break-all rounded-ai-sm bg-ai-surface-2 p-2 font-mono text-[11px] text-ai-fg-muted" data-ai-id="alertingrules:metric:expr">
            {rule?.expression || '-'}
          </code>
        </div>

        <AiSurface as="section" aiId="alertingrules:metric:chart" state={state} className="flex min-h-44 flex-col gap-2">
          {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
          {state === 'error' ? (
            <div className="flex flex-col gap-2 text-xs" role="alert" data-ai-id="alertingrules:metric:error">
              <p className="text-ai-danger">{errorMessage(t, query.error)}</p>
              <Button size="sm" variant="secondary" {...actionProps('alertingrules:metric:retry')} onClick={() => void query.refetch()}>
                {t('common.retry')}
              </Button>
            </div>
          ) : null}
          {state === 'empty' ? (
            <p className="py-6 text-sm text-ai-fg-muted" data-ai-id="alertingrules:metric:empty">
              {t('monitoring.ruleGroups.metric.empty')}
            </p>
          ) : null}
          {state === 'ready' ? (
            <React.Fragment>
              <TimeSeriesChart
                series={series.map((entry) => ({ ...entry, smooth: true }))}
                start={range.start}
                end={range.end}
                label={rule?.name ?? ''}
                emptyText={t('monitoring.ruleGroups.metric.empty')}
                height={180}
                data-ai-id="alertingrules:metric:trend"
              />
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ai-fg-muted" data-ai-id="alertingrules:metric:legend">
                {series.map((entry) => (
                  <li key={entry.key} className="flex items-center gap-1">
                    <span className="size-2 rounded-full" style={{ background: entry.color }} aria-hidden="true" />
                    {entry.label}
                  </li>
                ))}
              </ul>
            </React.Fragment>
          ) : null}
        </AiSurface>

        <p className="text-[11px] text-ai-fg-muted">{t('monitoring.ruleGroups.metric.hint')}</p>

        <div className="flex justify-end">
          <Button size="sm" variant="secondary" {...actionProps('alertingrules:metric:close')} onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { namespaceUsageApi, type ProjectUsage, type UsageRange } from '@kube-ai-hub/api-client';
import { AiSurface, Button, Skeleton } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

/**
 * 资源消费（账单）.
 *
 * The metering aggregate answers at namespace (project) level. This page shows the current
 * window's CPU / memory / storage / GPU use per project, sorted by CPU. If the module is not
 * installed the page says so explicitly instead of rendering an empty table — "no data" and
 * "not measured" are different statements. [N-03]
 */
export interface ClusterBillPageProps {
  cluster: string;
}

const RANGES: Array<{ key: UsageRange; labelKey: 'bill.range.1h' | 'bill.range.6h' | 'bill.range.24h' }> = [
  { key: '1h', labelKey: 'bill.range.1h' },
  { key: '6h', labelKey: 'bill.range.6h' },
  { key: '24h', labelKey: 'bill.range.24h' },
];

export function formatBytesValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let scaled = value;
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  return (scaled < 10 ? scaled.toFixed(1) : Math.round(scaled).toString()) + ' ' + units[unit];
}

export function ClusterBillPage({ cluster }: ClusterBillPageProps): React.ReactElement {
  const t = useT();
  const [range, setRange] = React.useState<UsageRange>('1h');
  const query = useQuery({
    queryKey: ['cluster-bill', cluster, range],
    queryFn: ({ signal }) => namespaceUsageApi(apiClient).query({ cluster, range, signal }),
  });

  const result = query.data;
  const rows = React.useMemo(
    () => (result?.available ? [...result.rows].sort((a, b) => b.cpuCores - a.cpuCores) : []),
    [result],
  );

  const state = query.isPending ? 'loading' : query.isError ? 'error' : result && !result.available ? 'unavailable' : rows.length === 0 ? 'empty' : 'ready';

  return (
    <AiSurface as="section" aiId="cluster-bill:surface" state={state === 'unavailable' ? 'empty' : state} className="min-w-0 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ai-fg">{t('bill.title')}</h2>
          <p className="mt-1 text-xs text-ai-fg-muted">{t('bill.description')}</p>
        </div>
        <div className="flex items-center gap-1 rounded-ai-md border border-ai-line p-0.5" role="group" aria-label={t('bill.range.label')}>
          {RANGES.map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant={range === item.key ? 'secondary' : 'ghost'}
              aria-pressed={range === item.key}
              {...actionProps('cluster-bill:range:' + item.key)}
              onClick={() => setRange(item.key)}
            >
              {t(item.labelKey)}
            </Button>
          ))}
        </div>
      </header>

      {state === 'error' ? (
        <div className="mt-4">
          <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="cluster-bill:retry" />
        </div>
      ) : null}

      {state === 'unavailable' ? (
        <div className="mt-4 rounded-ai-md border border-ai-line bg-ai-surface-2 p-6" data-ai-id="cluster-bill:unavailable">
          <p className="text-sm font-medium text-ai-fg">{t('bill.unavailable.title')}</p>
          <p className="mt-1 text-xs text-ai-fg-muted">{t('bill.unavailable.description')}</p>
          {result && !result.available && result.reason ? (
            <p className="mt-2 break-all font-mono text-[11px] text-ai-fg-muted">{result.reason}</p>
          ) : null}
          <Button className="mt-3" size="sm" variant="secondary" {...actionProps('cluster-bill:retry')} onClick={() => void query.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {state === 'loading' ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {state === 'empty' ? (
        <p className="mt-6 text-xs text-ai-fg-muted" data-ai-id="cluster-bill:empty">
          {t('bill.empty')}
        </p>
      ) : null}

      {state === 'ready' ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-xs" data-ai-id="cluster-bill:table">
            <thead>
              <tr className="border-b border-ai-line text-left text-ai-fg-muted">
                <th className="py-2 pr-3 font-medium">{t('bill.column.project')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('bill.column.cpu')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('bill.column.memory')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('bill.column.storage')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('bill.column.gpu')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: ProjectUsage) => (
                <tr key={row.namespace} className="border-b border-ai-line/60" data-ai-row={row.namespace} data-ai-id={'cluster-bill:row:' + row.namespace}>
                  <td className="py-2 pr-3 font-mono text-ai-fg">{row.namespace}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-ai-fg-secondary">{row.cpuCores.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-ai-fg-secondary">{formatBytesValue(row.memoryBytes)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-ai-fg-secondary">{formatBytesValue(row.pvcBytes)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-ai-fg-secondary">{row.gpuCards.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-ai-fg-muted">{t('bill.windowHint', { range: t(range === '1h' ? 'bill.range.1h' : range === '6h' ? 'bill.range.6h' : 'bill.range.24h') })}</p>
        </div>
      ) : null}
    </AiSurface>
  );
}

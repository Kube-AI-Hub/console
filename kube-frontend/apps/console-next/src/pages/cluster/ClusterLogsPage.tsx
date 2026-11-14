import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { logSearchApi } from '@kube-ai-hub/api-client';
import { AiSurface, Input, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 容器日志查询（集群作用域）：老 console 工具箱里的「容器日志查询」。
 *
 * Backend is the tenant API's Elasticsearch index, so results are paged and the time window is
 * explicit. Windows are presets rather than a picker: the toolbox answers 'what happened in the
 * last hour', and a free-range picker is a different component with its own validation.
 */
export interface ClusterLogsPageProps {
  cluster: string;
}

const PAGE_SIZE = 50;

const WINDOWS = [
  { key: '1h', seconds: 3600 },
  { key: '6h', seconds: 6 * 3600 },
  { key: '24h', seconds: 24 * 3600 },
  { key: '7d', seconds: 7 * 24 * 3600 },
] as const;

export function ClusterLogsPage({ cluster: _cluster }: ClusterLogsPageProps): React.ReactElement {
  const t = useT();
  const [namespace, setNamespace] = React.useState('');
  const [pod, setPod] = React.useState('');
  const [container, setContainer] = React.useState('');
  const [keyword, setKeyword] = React.useState('');
  const [windowKey, setWindowKey] = React.useState<string>('1h');
  const [page, setPage] = React.useState(0);

  const windowSeconds = WINDOWS.find((entry) => entry.key === windowKey)?.seconds ?? 3600;
  const query = useQuery({
    queryKey: ['cluster-logs', namespace, pod, container, keyword, windowKey, page],
    queryFn: ({ signal }) => {
      const endTime = Math.floor(Date.now() / 1000);
      return logSearchApi(apiClient).search({
        ...(namespace ? { namespace } : {}),
        ...(pod ? { pod } : {}),
        ...(container ? { container } : {}),
        ...(keyword ? { keyword } : {}),
        startTime: endTime - windowSeconds,
        endTime,
        from: page * PAGE_SIZE,
        size: PAGE_SIZE,
        signal,
      });
    },
  });

  const interval = windowSeconds <= 3600 ? '5m' : windowSeconds <= 6 * 3600 ? '30m' : windowSeconds <= 24 * 3600 ? '1h' : '6h';
  const histogram = useQuery({
    queryKey: ['cluster-logs-histogram', namespace, pod, container, keyword, windowKey],
    queryFn: ({ signal }) => {
      const endTime = Math.floor(Date.now() / 1000);
      return logSearchApi(apiClient).histogram({
        ...(namespace ? { namespace } : {}),
        ...(pod ? { pod } : {}),
        ...(container ? { container } : {}),
        ...(keyword ? { keyword } : {}),
        startTime: endTime - windowSeconds,
        endTime,
        interval,
        signal,
      });
    },
  });
  const statistics = useQuery({
    queryKey: ['cluster-logs-statistics', windowKey],
    queryFn: ({ signal }) => {
      const endTime = Math.floor(Date.now() / 1000);
      return logSearchApi(apiClient).statistics({ startTime: endTime - windowSeconds, endTime, signal });
    },
  });
  const peak = Math.max(1, ...(histogram.data?.buckets ?? []).map((bucket) => bucket.count));

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const records = query.data?.records ?? [];

  return (
    <AiSurface as="section" aiId="cluster-logs:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{t('search.logs.title')}</h1>
        <p className="text-xs text-ai-fg-muted">{t('search.logs.description')}</p>
      </header>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-ai-fg-muted">
          <span>{t('search.field.namespace')}</span>
          <Input id="cluster-logs:namespace" value={namespace} onChange={(event) => { setNamespace(event.target.value); setPage(0); }} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ai-fg-muted">
          <span>{t('search.field.pod')}</span>
          <Input id="cluster-logs:pod" value={pod} onChange={(event) => { setPod(event.target.value); setPage(0); }} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ai-fg-muted">
          <span>{t('search.field.container')}</span>
          <Input id="cluster-logs:container" value={container} onChange={(event) => { setContainer(event.target.value); setPage(0); }} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ai-fg-muted">
          <span>{t('search.field.keyword')}</span>
          <Input id="cluster-logs:keyword" value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(0); }} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ai-fg-muted">
          <span>{t('search.field.window')}</span>
          <select
            className="h-9 rounded-ai-md border border-ai-line bg-ai-bg px-2 text-xs text-ai-fg"
            value={windowKey}
            onChange={(event) => { setWindowKey(event.target.value); setPage(0); }}
            data-ai-id="cluster-logs:window"
          >
            {WINDOWS.map((entry) => (
              <option key={entry.key} value={entry.key}>{t(`search.window.${entry.key}`)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-1" data-ai-id="cluster-logs:histogram">
        <div className="flex items-end gap-[2px]" style={{ height: 48 }}>
          {(histogram.data?.buckets ?? []).map((bucket) => (
            <div
              key={bucket.time}
              title={`${new Date(bucket.time).toLocaleString()} · ${bucket.count}`}
              className="flex-1 rounded-sm bg-ai-accent/60"
              style={{ height: `${Math.max(2, Math.round((bucket.count / peak) * 46))}px` }}
            />
          ))}
        </div>
        {statistics.data ? (
          <p className="text-[11px] text-ai-fg-muted" data-ai-id="cluster-logs:statistics">
            {t('search.stat.containers', { count: statistics.data.containers })} ·{' '}
            {t('search.stat.logs', { count: statistics.data.logs })}
          </p>
        ) : null}
      </div>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="cluster-logs:retry" />
      ) : null}
      {state === 'ready' && records.length === 0 ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id="cluster-logs:empty">{t('search.logs.empty')}</p>
      ) : null}

      {records.length > 0 ? (
        <div className="flex flex-col gap-1 font-mono text-[11px]" data-ai-id="cluster-logs:list">
          {records.map((record, index) => (
            <div key={`${record.time}-${index}`} className="flex gap-2 border-b border-ai-line/50 py-1" data-ai-row={String(index)}>
              <span className="shrink-0 tabular-nums text-ai-fg-muted">{formatTimestamp(record.time)}</span>
              <span className="shrink-0 text-ai-fg-muted">{[record.namespace, record.pod, record.container].filter(Boolean).join('/')}</span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-all text-ai-fg-secondary">{record.log}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between text-xs text-ai-fg-muted">
        <span data-ai-id="cluster-logs:total">{t('search.total', { count: total })}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-ai-md border border-ai-line px-2 py-1 disabled:opacity-40"
            data-ai-id="cluster-logs:prev"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            {t('table.previous')}
          </button>
          <span data-ai-id="cluster-logs:page">{page + 1} / {pages}</span>
          <button
            type="button"
            className="rounded-ai-md border border-ai-line px-2 py-1 disabled:opacity-40"
            data-ai-id="cluster-logs:next"
            disabled={page + 1 >= pages}
            onClick={() => setPage((current) => current + 1)}
          >
            {t('table.next')}
          </button>
        </div>
      </div>
    </AiSurface>
  );
}
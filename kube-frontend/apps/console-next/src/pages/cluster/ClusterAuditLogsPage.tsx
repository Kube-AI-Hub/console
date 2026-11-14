import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditSearchApi, type AuditRecord } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Input, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 审计日志查询（集群作用域）：老 console 工具箱里的「审计日志查询」。
 *
 * Filters are the ones the audit index supports server-side: verb, resource, user, response
 * code, workspace and namespace. Time windows are presets for the same reason as the log page.
 */
export interface ClusterAuditLogsPageProps {
  cluster: string;
}

const PAGE_SIZE = 50;

const WINDOWS = [
  { key: '1h', seconds: 3600 },
  { key: '6h', seconds: 6 * 3600 },
  { key: '24h', seconds: 24 * 3600 },
  { key: '7d', seconds: 7 * 24 * 3600 },
] as const;

export function ClusterAuditLogsPage({ cluster: _cluster }: ClusterAuditLogsPageProps): React.ReactElement {
  const t = useT();
  const [verb, setVerb] = React.useState('');
  const [resource, setResource] = React.useState('');
  const [user, setUser] = React.useState('');
  const [workspace, setWorkspace] = React.useState('');
  const [windowKey, setWindowKey] = React.useState<string>('1h');
  const [page, setPage] = React.useState(0);

  const windowSeconds = WINDOWS.find((entry) => entry.key === windowKey)?.seconds ?? 3600;
  const query = useQuery({
    queryKey: ['cluster-audits', verb, resource, user, workspace, windowKey, page],
    queryFn: ({ signal }) => {
      const endTime = Math.floor(Date.now() / 1000);
      return auditSearchApi(apiClient).search({
        ...(verb ? { verb } : {}),
        ...(resource ? { resource } : {}),
        ...(user ? { user } : {}),
        ...(workspace ? { workspace } : {}),
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
    queryKey: ['cluster-audit-histogram', verb, resource, user, workspace, windowKey],
    queryFn: ({ signal }) => {
      const endTime = Math.floor(Date.now() / 1000);
      return auditSearchApi(apiClient).histogram({
        ...(verb ? { verb } : {}),
        ...(resource ? { resource } : {}),
        ...(user ? { user } : {}),
        ...(workspace ? { workspace } : {}),
        startTime: endTime - windowSeconds,
        endTime,
        interval,
        signal,
      });
    },
  });
  const statistics = useQuery({
    queryKey: ['cluster-audit-statistics', windowKey],
    queryFn: ({ signal }) => {
      const endTime = Math.floor(Date.now() / 1000);
      return auditSearchApi(apiClient).statistics({ startTime: endTime - windowSeconds, endTime, signal });
    },
  });
  const peak = Math.max(1, ...(histogram.data?.buckets ?? []).map((bucket) => bucket.count));

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const records = query.data?.records ?? [];

  return (
    <AiSurface as="section" aiId="cluster-audit-logs:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{t('search.audit.title')}</h1>
        <p className="text-xs text-ai-fg-muted">{t('search.audit.description')}</p>
      </header>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-ai-fg-muted">
          <span>{t('search.field.verb')}</span>
          <Input id="cluster-audit-logs:verb" value={verb} onChange={(event) => { setVerb(event.target.value); setPage(0); }} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ai-fg-muted">
          <span>{t('search.field.resource')}</span>
          <Input id="cluster-audit-logs:resource" value={resource} onChange={(event) => { setResource(event.target.value); setPage(0); }} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ai-fg-muted">
          <span>{t('search.field.user')}</span>
          <Input id="cluster-audit-logs:user" value={user} onChange={(event) => { setUser(event.target.value); setPage(0); }} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ai-fg-muted">
          <span>{t('search.field.workspace')}</span>
          <Input id="cluster-audit-logs:workspace" value={workspace} onChange={(event) => { setWorkspace(event.target.value); setPage(0); }} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ai-fg-muted">
          <span>{t('search.field.window')}</span>
          <select
            className="h-9 rounded-ai-md border border-ai-line bg-ai-bg px-2 text-xs text-ai-fg"
            value={windowKey}
            onChange={(event) => { setWindowKey(event.target.value); setPage(0); }}
            data-ai-id="cluster-audit-logs:window"
          >
            {WINDOWS.map((entry) => (
              <option key={entry.key} value={entry.key}>{t(`search.window.${entry.key}`)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-1" data-ai-id="cluster-audit-logs:histogram">
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
          <p className="text-[11px] text-ai-fg-muted" data-ai-id="cluster-audit-logs:statistics">
            {t('search.stat.resources', { count: statistics.data.resources })} ·{' '}
            {t('search.stat.events', { count: statistics.data.events })}
          </p>
        ) : null}
      </div>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="cluster-audit-logs:retry" />
      ) : null}
      {state === 'ready' && records.length === 0 ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id="cluster-audit-logs:empty">{t('search.audit.empty')}</p>
      ) : null}

      {records.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]" data-ai-id="cluster-audit-logs:list">
            <thead>
              <tr className="text-ai-fg-muted">
                <th className="pb-2 pr-3 font-medium">{t('search.column.time')}</th>
                <th className="pb-2 pr-3 font-medium">{t('search.field.verb')}</th>
                <th className="pb-2 pr-3 font-medium">{t('search.field.user')}</th>
                <th className="pb-2 pr-3 font-medium">{t('search.field.resource')}</th>
                <th className="pb-2 pr-3 font-medium">{t('search.column.status')}</th>
                <th className="pb-2 font-medium">{t('search.column.uri')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record: AuditRecord, index: number) => (
                <tr key={`${record.time}-${index}`} className="border-t border-ai-line" data-ai-row={String(index)}>
                  <td className="py-1.5 pr-3 tabular-nums text-ai-fg-muted">{formatTimestamp(record.time)}</td>
                  <td className="py-1.5 pr-3 text-ai-fg-secondary">{record.verb || '-'}</td>
                  <td className="py-1.5 pr-3 text-ai-fg-secondary">{record.user || '-'}</td>
                  <td className="py-1.5 pr-3 font-mono text-ai-fg-muted">{[record.resource, record.namespace].filter(Boolean).join(' · ') || '-'}</td>
                  <td className="py-1.5 pr-3">
                    <Badge tone={record.status.startsWith('2') ? 'success' : 'warning'}>{record.status || '-'}</Badge>
                  </td>
                  <td className="py-1.5 font-mono text-ai-fg-muted">{record.uri || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="flex items-center justify-between text-xs text-ai-fg-muted">
        <span data-ai-id="cluster-audit-logs:total">{t('search.total', { count: total })}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-ai-md border border-ai-line px-2 py-1 disabled:opacity-40"
            data-ai-id="cluster-audit-logs:prev"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            {t('table.previous')}
          </button>
          <span data-ai-id="cluster-audit-logs:page">{page + 1} / {pages}</span>
          <button
            type="button"
            className="rounded-ai-md border border-ai-line px-2 py-1 disabled:opacity-40"
            data-ai-id="cluster-audit-logs:next"
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
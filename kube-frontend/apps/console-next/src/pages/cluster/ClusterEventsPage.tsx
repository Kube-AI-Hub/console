import * as React from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { eventSearchApi, type EventQueryFilters, type EventRecord } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Input, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 资源事件查询（集群作用域）.
 *
 * The page an operator opens when something is wrong and all they know is a namespace, a
 * reason or a keyword. It reads `tenant.kubesphere.io/v1alpha2/events`, which answers the two
 * questions the core events collection cannot: how many events fall in a window (a real total)
 * and which ones match a filter (server-side).
 *
 * The histogram and the list are fetched with the **same filters**, so the bars always describe
 * the rows below them; a histogram of everything above a filtered list would be a lie. The
 * histogram covers the last twelve hours, matching the old console's 最近 12 小时 card, while the
 * list is paged over the whole history the API retains.
 */
export interface ClusterEventsPageProps {
  cluster: string;
}

const PAGE_SIZE = 20;
const HISTOGRAM_HOURS = 12;
const HISTOGRAM_INTERVAL = '30m';
const BUCKET_MS = 30 * 60 * 1000;

type FilterKey = 'message' | 'namespace' | 'kind' | 'name' | 'reason' | 'type';

/** The filter inputs, in the order the old console offered them. */
const FILTERS: Array<{ key: FilterKey; labelKey: string; placeholderKey: string }> = [
  { key: 'message', labelKey: 'cluster.events.filter.message', placeholderKey: 'cluster.events.filter.messageHint' },
  { key: 'namespace', labelKey: 'cluster.events.filter.project', placeholderKey: 'cluster.events.filter.projectHint' },
  { key: 'kind', labelKey: 'cluster.events.filter.kind', placeholderKey: 'cluster.events.filter.kindHint' },
  { key: 'name', labelKey: 'cluster.events.filter.name', placeholderKey: 'cluster.events.filter.nameHint' },
  { key: 'reason', labelKey: 'cluster.events.filter.reason', placeholderKey: 'cluster.events.filter.reasonHint' },
];

export function ClusterEventsPage({ cluster: _cluster }: ClusterEventsPageProps): React.ReactElement {
  const t = useT();
  const [filters, setFilters] = React.useState<EventQueryFilters>({});
  const [draft, setDraft] = React.useState<Record<FilterKey, string>>({
    message: '',
    namespace: '',
    kind: '',
    name: '',
    reason: '',
    type: '',
  });
  const [page, setPage] = React.useState(1);
  /*
   * A histogram bucket the reader clicked. Selecting one narrows the **list** to that bucket's
   * window; the histogram stays at twelve hours with the bar highlighted, because drilling the
   * histogram into a thirty-minute slice yields a chart of one or two bars — the old console does
   * that, and it reads as a rendering bug rather than as a zoom.
   */
  const [selected, setSelected] = React.useState<{ start: number; end: number } | null>(null);
  /*
   * Real-time mode: the old console has a start/stop control that re-reads continuously. Each tick
   * bumps a revision, which is part of both query keys, so both the bars and the rows move forward
   * together instead of the bars freezing while the list advances.
   */
  const [realTime, setRealTime] = React.useState(false);
  const [revision, setRevision] = React.useState(0);

  /*
   * The window is resolved once per render of this page, not inside the query key: a
   * `Date.now()` in the key would change on every paint and refetch forever.
   */
  const [window, setWindow] = React.useState(() => {
    const end = Math.floor(Date.now() / 1000) * 1000;
    return { start: end - HISTOGRAM_HOURS * 60 * 60 * 1000, end };
  });

  React.useEffect(() => {
    if (!realTime) return;
    const timer = globalThis.setInterval(() => {
      const end = Math.floor(Date.now() / 1000) * 1000;
      setWindow({ start: end - HISTOGRAM_HOURS * 60 * 60 * 1000, end });
      setPage(1);
      setRevision((previous) => previous + 1);
    }, 5_000);
    return () => globalThis.clearInterval(timer);
  }, [realTime]);

  const histogram = useQuery({
    queryKey: ['cluster-events-histogram', window.start, window.end, filters, revision],
    queryFn: ({ signal }) =>
      eventSearchApi(apiClient).histogram({
        start: window.start,
        end: window.end,
        interval: HISTOGRAM_INTERVAL,
        filters,
        signal,
      }),
    staleTime: 60_000,
    retry: false,
  });

  const records = useQuery({
    queryKey: ['cluster-events-records', filters, page, selected?.start ?? 0, selected?.end ?? 0, revision],
    queryFn: ({ signal }) =>
      eventSearchApi(apiClient).query({
        from: (page - 1) * PAGE_SIZE,
        size: PAGE_SIZE,
        filters,
        ...(selected ? { start: selected.start, end: selected.end } : {}),
        signal,
      }),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const total = records.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows: EventRecord[] = records.data?.records ?? [];
  const state = records.isPending ? 'loading' : records.isError ? 'error' : 'ready';

  const applyFilters = (): void => {
    const next: EventQueryFilters = {};
    for (const { key } of FILTERS) {
      const value = draft[key].trim();
      if (value) next[key] = value;
    }
    if (draft.type) next.type = draft.type;
    setFilters(next);
    setPage(1);
    const end = Math.floor(Date.now() / 1000) * 1000;
    setWindow({ start: end - HISTOGRAM_HOURS * 60 * 60 * 1000, end });
  };

  const selectBucket = (time: number): void => {
    // Clicking the selected bar again clears the selection, so the control has an inverse.
    setSelected((previous) => (previous?.start === time ? null : { start: time, end: time + BUCKET_MS }));
    setPage(1);
  };

  const resetFilters = (): void => {
    setDraft({ message: '', namespace: '', kind: '', name: '', reason: '', type: '' });
    setFilters({});
    setPage(1);
  };

  const peak = Math.max(1, ...(histogram.data?.buckets ?? []).map((bucket) => bucket.count));

  return (
    <AiSurface as="section" aiId="cluster-events:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{t('cluster.events.title')}</h1>
        <p className="text-xs text-ai-fg-muted">{t('cluster.events.description')}</p>
      </header>

      {/* 最近 12 小时的事件计数：与下方列表使用同一组过滤条件。 */}
      <section className="rounded-lg border border-ai-border bg-ai-surface p-3" {...actionProps('cluster-events:histogram')}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-medium text-ai-fg-secondary">{t('cluster.events.histogramTitle')}</h2>
          <span className="text-xs tabular-nums text-ai-fg-muted" data-ai-id="cluster-events:histogram:total">
            {t('cluster.events.histogramTotal', { count: histogram.data?.total ?? 0 })}
          </span>
        </div>
        {histogram.isPending ? <Skeleton className="mt-2 h-16 w-full" /> : null}
        {histogram.isError ? (
          <p className="mt-2 text-xs text-ai-fg-muted" data-ai-id="cluster-events:histogram:error">
            {t('cluster.events.histogramUnavailable')}
          </p>
        ) : null}
        {!histogram.isPending && !histogram.isError ? (
          (histogram.data?.buckets ?? []).length === 0 ? (
            <p className="mt-2 text-xs text-ai-fg-muted" data-ai-id="cluster-events:histogram:empty">
              {t('cluster.events.histogramEmpty')}
            </p>
          ) : (
            <ol className="mt-2 flex items-end gap-0.5" data-ai-id="cluster-events:histogram:bars">
              {(histogram.data?.buckets ?? []).map((bucket) => (
                <li key={bucket.time} className="flex h-16 min-w-0 flex-1 items-end">
                  <Button
                    variant="ghost"
                    className={`block h-16 w-full rounded-t p-0 transition-colors ${
                      selected?.start === bucket.time ? 'bg-ai-accent' : 'bg-ai-accent/60 hover:bg-ai-accent/80'
                    }`}
                    style={{ height: `${Math.max(6, Math.round((bucket.count / peak) * 100))}%` }}
                    title={`${formatTimestamp(new Date(bucket.time).toISOString())} · ${bucket.count}`}
                    aria-pressed={selected?.start === bucket.time}
                    {...actionProps(`cluster-events:bucket:${bucket.time}`)}
                    data-ai-bucket={bucket.time}
                    data-ai-count={bucket.count}
                    onClick={() => selectBucket(bucket.time)}
                  />
                </li>
              ))}
            </ol>
          )
        ) : null}
      </section>

      <div className="flex flex-wrap items-end gap-2">
        {FILTERS.map((filter) => (
          <label key={filter.key} className="flex min-w-0 flex-col gap-1 text-xs text-ai-fg-muted">
            <span>{t(filter.labelKey as never)}</span>
            <Input
              id={`cluster-events:filter:${filter.key}`}
              {...actionProps(`cluster-events:filter:${filter.key}`)}
              value={draft[filter.key]}
              placeholder={t(filter.placeholderKey as never)}
              onChange={(event) => setDraft((previous) => ({ ...previous, [filter.key]: event.target.value }))}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-xs text-ai-fg-muted">
          <span>{t('cluster.events.type')}</span>
          <select
            className="h-8 rounded-ai-md border border-ai-line bg-ai-bg px-2 text-xs text-ai-fg"
            value={draft.type}
            onChange={(event) => setDraft((previous) => ({ ...previous, type: event.target.value }))}
            data-ai-id="cluster-events:filter:type"
          >
            <option value="">{t('cluster.events.typeAll')}</option>
            <option value="Warning">{t('cluster.events.typeWarning')}</option>
            <option value="Normal">{t('cluster.events.typeNormal')}</option>
          </select>
        </label>
        <Button size="sm" {...actionProps('cluster-events:search')} onClick={applyFilters}>
          {t('cluster.events.searchAction')}
        </Button>
        <Button size="sm" variant="secondary" {...actionProps('cluster-events:reset')} onClick={resetFilters}>
          {t('cluster.events.resetAction')}
        </Button>
        <Button
          size="sm"
          variant={realTime ? 'primary' : 'secondary'}
          aria-pressed={realTime}
          {...actionProps('cluster-events:real-time')}
          onClick={() => setRealTime((previous) => !previous)}
        >
          {realTime ? t('cluster.events.realTimeOn') : t('cluster.events.realTimeOff')}
        </Button>
      </div>

      {selected ? (
        <div className="flex flex-wrap items-center gap-2 text-xs" data-ai-id="cluster-events:selected-range">
          <span className="text-ai-fg-muted">{t('cluster.events.selectedRange')}</span>
          <span className="tabular-nums text-ai-fg">
            {formatTimestamp(new Date(selected.start).toISOString())} – {formatTimestamp(new Date(selected.end).toISOString())}
          </span>
          <Button size="sm" variant="secondary" {...actionProps('cluster-events:selected-clear')} onClick={() => setSelected(null)}>
            {t('cluster.events.selectedClear')}
          </Button>
        </div>
      ) : null}

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={records.error} onRetry={() => void records.refetch()} retryAiId="cluster-events:retry" />
      ) : null}

      {state === 'ready' && rows.length === 0 ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id="cluster-events:empty">
          {t('cluster.events.emptyDescription')}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <React.Fragment>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" data-ai-id="cluster-events:list">
              <thead>
                <tr className="text-left text-ai-fg-muted">
                  <th className="whitespace-nowrap px-2 py-1.5 font-medium">{t('cluster.events.column.time')}</th>
                  <th className="whitespace-nowrap px-2 py-1.5 font-medium">{t('cluster.events.column.type')}</th>
                  <th className="whitespace-nowrap px-2 py-1.5 font-medium">{t('cluster.events.column.project')}</th>
                  <th className="whitespace-nowrap px-2 py-1.5 font-medium">{t('cluster.events.column.object')}</th>
                  <th className="whitespace-nowrap px-2 py-1.5 font-medium">{t('cluster.events.column.reason')}</th>
                  <th className="px-2 py-1.5 font-medium">{t('cluster.events.column.message')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((event, index) => (
                  <tr key={`${event.timestamp}-${event.reason}-${index}`} className="border-t border-ai-line align-top" data-ai-row={String(index)}>
                    <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-ai-fg-muted">
                      {event.lastTimestamp ? formatTimestamp(event.lastTimestamp) : '-'}
                    </td>
                    <td className="px-2 py-1.5">
                      <Badge tone={event.type === 'Warning' ? 'warning' : 'neutral'}>{event.type || '-'}</Badge>
                    </td>
                    <td className="px-2 py-1.5 text-ai-fg-secondary">{event.namespace || '-'}</td>
                    <td className="px-2 py-1.5">
                      <span className="text-ai-fg-muted">{event.objectKind || '-'}</span>
                      <span className="mx-1 text-ai-fg-muted">/</span>
                      <span className="text-ai-fg">{event.objectName || '-'}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-medium text-ai-fg">{event.reason || '-'}</td>
                    <td className="px-2 py-1.5 text-ai-fg-secondary">
                      {event.message || '-'}
                      {event.count > 1 ? <span className="ml-1 text-ai-fg-muted">x{event.count}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </React.Fragment>
      ) : null}

      {state === 'ready' ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ai-fg-muted">
          <span data-ai-id="cluster-events:total">{t('cluster.events.totalNote', { count: total })}</span>
          <span className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            {...actionProps('cluster-events:previous')}
            onClick={() => setPage((previous) => Math.max(1, previous - 1))}
          >
            {t('table.previous')}
          </Button>
          <span className="tabular-nums" data-ai-id="cluster-events:page">
            {page} / {pageCount}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= pageCount}
            {...actionProps('cluster-events:next')}
            onClick={() => setPage((previous) => Math.min(pageCount, previous + 1))}
          >
            {t('table.next')}
          </Button>
          </span>
        </div>
      ) : null}
    </AiSurface>
  );
}

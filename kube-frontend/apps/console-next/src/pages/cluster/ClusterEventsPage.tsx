import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { clusterEventsApi, type ClusterEvent } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Input, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 资源事件查询（集群作用域）.
 *
 * The old console hides this in the cluster toolbox; it is the page an operator opens when
 * something is wrong and they only know a namespace, a reason or a keyword.
 *
 * The list is a **recent window** of the event collection, not the whole history: the apiserver
 * pages that collection and ages events out, so 'all events ever' is not a question the API can
 * answer either. The keyword filter therefore narrows the loaded window, and the page says so.
 *
 * Deliberately not built on `ResourceList`: that component owns pagination and row keys, and
 * events have neither a unique name nor a total count. A plain list keeps the window semantics
 * honest instead of faking pages.
 */
export interface ClusterEventsPageProps {
  cluster: string;
}

const WINDOW = 200;

export function ClusterEventsPage({ cluster: _cluster }: ClusterEventsPageProps): React.ReactElement {
  const t = useT();
  const [type, setType] = React.useState<'' | 'Normal' | 'Warning'>('');
  const [keyword, setKeyword] = React.useState('');

  const query = useQuery({
    queryKey: ['cluster-events', type],
    queryFn: ({ signal }) => clusterEventsApi(apiClient).list({ type, limit: WINDOW, signal }),
  });

  const all = query.data ?? [];
  const needle = keyword.trim().toLowerCase();
  const rows = React.useMemo(() => {
    if (!needle) return all;
    return all.filter((event) =>
      [event.reason, event.message, event.namespace, event.objectName].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    );
  }, [all, needle]);

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';

  return (
    <AiSurface as="section" aiId="cluster-events:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{t('cluster.events.title')}</h1>
        <p className="text-xs text-ai-fg-muted">{t('cluster.events.description')}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-ai-fg-muted">
          <span>{t('cluster.events.type')}</span>
          <select
            className="h-8 rounded-ai-md border border-ai-line bg-ai-bg px-2 text-xs text-ai-fg"
            value={type}
            onChange={(event) => setType(event.target.value as '' | 'Normal' | 'Warning')}
            data-ai-id="cluster-events:filter:type"
          >
            <option value="">{t('cluster.events.typeAll')}</option>
            <option value="Warning">{t('cluster.events.typeWarning')}</option>
            <option value="Normal">{t('cluster.events.typeNormal')}</option>
          </select>
        </label>
        <Input
          id="cluster-events:search"
          value={keyword}
          placeholder={t('cluster.events.searchPlaceholder')}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </div>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="cluster-events:retry" />
      ) : null}

      {state === 'ready' && rows.length === 0 ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id="cluster-events:empty">
          {t('cluster.events.emptyDescription')}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="flex flex-col divide-y divide-ai-line" data-ai-id="cluster-events:list">
          {rows.map((event: ClusterEvent, index: number) => (
            <li key={`${event.reason}-${event.lastSeen}-${index}`} className="flex flex-col gap-1 py-2" data-ai-row={String(index)}>
              <span className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone={event.type === 'Warning' ? 'warning' : 'neutral'}>{event.type || '-'}</Badge>
                <span className="font-medium text-ai-fg">{event.reason || '-'}</span>
                <span className="font-mono text-[11px] text-ai-fg-muted">
                  {[event.objectKind, event.namespace, event.objectName].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="line-clamp-2 text-xs text-ai-fg-secondary">{event.message || '-'}</span>
              <span className="text-[11px] text-ai-fg-muted">
                {[formatTimestamp(event.lastSeen), event.count > 1 ? `x${event.count}` : '', event.source]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {all.length >= WINDOW ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id="cluster-events:window">
          {t('cluster.events.windowNote', { count: WINDOW })}
        </p>
      ) : null}
    </AiSurface>
  );
}
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { strategiesApi, type StrategyStatus, type StrategySummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 灰度发布 (canary releases).
 *
 * The old console's project console lists servicemesh `Strategy` objects as cards; this
 * page lists them as rows with the four facts an operator scans first: name, type,
 * target service and the controller's verdict. It is read-only: creating a release is a
 * multi-step wizard (versions, traffic split, match rules) and the rest of this round is
 * read work; the API and the empty state are the deliverable here.
 *
 * The object has no `phase`: progress lives in `status.conditions` (`Complete`,
 * `Failed`), so the status column is derived — see `strategyStatusOf` in the api-client
 * module, which is unit-tested rather than re-derived here.
 */
export interface CanaryReleasesPageProps {
  cluster: string;
  namespace: string;
}

/** Status → badge tone; an unknown status must not read as healthy. */
const STATUS_TONES: Record<StrategyStatus, 'success' | 'danger' | 'warning' | 'neutral'> = {
  completed: 'success',
  failed: 'danger',
  progressing: 'warning',
  unknown: 'neutral',
};

const STATUS_KEYS = {
  completed: 'grayRelease.status.completed',
  failed: 'grayRelease.status.failed',
  progressing: 'grayRelease.status.progressing',
  unknown: 'grayRelease.status.unknown',
} as const;

/** `spec.type` → locale key; an unrecognised type is shown verbatim. */
const TYPE_KEYS: Record<string, 'grayRelease.type.canary' | 'grayRelease.type.bluegreen' | 'grayRelease.type.mirror'> = {
  Canary: 'grayRelease.type.canary',
  Bluegreen: 'grayRelease.type.bluegreen',
  Mirror: 'grayRelease.type.mirror',
};

export function CanaryReleasesPage({ cluster, namespace }: CanaryReleasesPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'name', defaultOrder: 'asc', resetOn: [cluster, namespace] });

  const query = useQuery({
    queryKey: ['strategies', cluster, namespace],
    queryFn: ({ signal }) => strategiesApi(apiClient).list({ cluster, namespace, signal }),
    // The cleanup may have removed the last one while the tab sat open; refresh when
    // the reader comes back rather than keeping a stale empty list.
    refetchOnWindowFocus: true,
  });

  const all = query.data?.items ?? [];
  const keyword = list.search.trim().toLowerCase();
  const filtered = keyword
    ? all.filter(
        (row) =>
          row.name.toLowerCase().includes(keyword) ||
          row.alias.toLowerCase().includes(keyword) ||
          row.targetService.toLowerCase().includes(keyword),
      )
    : all;

  const rows = React.useMemo(() => {
    const items = [...filtered];
    const direction = list.order === 'asc' ? 1 : -1;
    return items.sort((a, b) =>
      list.sortBy === 'createTime' ? a.createdAt.localeCompare(b.createdAt) * direction : a.name.localeCompare(b.name) * direction,
    );
  }, [filtered, list.sortBy, list.order]);

  const schema = React.useMemo<ListSchema<StrategySummary>>(
    () => ({
      title: t('grayRelease.title'),
      description: t('grayRelease.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('grayRelease.search'), aiId: 'grayrelease:search' },
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: 'grayrelease',
      sort: { key: list.sortBy, order: list.order },
      columns: [
        {
          key: 'name',
          title: t('grayRelease.column.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-ai-fg">{row.alias || row.name}</span>
              <span className="truncate text-[11px] text-ai-fg-muted">
                {row.alias ? row.name : formatTimestamp(row.createdAt)}
              </span>
            </span>
          ),
        },
        {
          key: 'type',
          title: t('grayRelease.column.type'),
          width: 150,
          render: (row) => {
            const key = TYPE_KEYS[row.type];
            return (
              <Badge tone={row.type === 'Canary' ? 'info' : 'neutral'}>{key ? t(key) : row.type}</Badge>
            );
          },
        },
        {
          key: 'targetService',
          title: t('grayRelease.column.targetService'),
          width: 200,
          render: (row) => (
            <span className="truncate font-mono text-[11px] text-ai-fg-secondary">{row.targetService || '-'}</span>
          ),
        },
        {
          key: 'status',
          title: t('grayRelease.column.status'),
          width: 120,
          render: (row) => (
            // The condition message is the "why" behind a failed or progressing badge;
            // a title keeps it reachable without a detail page.
            <span title={row.statusDetail || undefined}>
              <Badge tone={STATUS_TONES[row.status]}>{t(STATUS_KEYS[row.status])}</Badge>
            </span>
          ),
        },
      ],
      rowActions: [],
      empty: { title: t('grayRelease.emptyTitle'), description: t('grayRelease.emptyDescription') },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: 1, pageSize: Math.max(rows.length, 1), total: rows.length },
    }),
    [list.sortBy, list.order, rows.length, t],
  );

  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="grayrelease:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="grayrelease:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="grayrelease:surface" state={state} className="min-w-0">
      {/* Literal handle for the list body: the page contract looks for one on the
          page element itself, and an agent should be able to target the table
          separately from the surface it sits in. */}
      <div data-ai-id="grayrelease:list" className="min-w-0">
        <ResourceList
          schema={schema}
          rows={rows}
          loading={query.isFetching}
          searchValue={list.keyword}
          onSearchChange={list.setKeyword}
          onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
            if (next) list.setSort(next);
          }}
        />
      </div>
    </AiSurface>
  );
}

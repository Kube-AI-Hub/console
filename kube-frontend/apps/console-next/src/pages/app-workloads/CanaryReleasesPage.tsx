import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { strategiesApi, type StrategySummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { CreateGrayReleaseDialog } from './CreateGrayReleaseDialog';
import { useListRefresh } from '@/components/resource/useListRefresh';
import { STATUS_TONES, statusText, typeText } from './canary/labels';
import { useStrategyPermission } from './canary/useStrategyPermission';

/**
 * 灰度发布 (canary releases).
 *
 * The old console's project console listed servicemesh `Strategy` objects as cards with
 * metrics, and opened a full-screen detail modal. This page lists the same objects as
 * rows — name, type, target service, versions and the controller's verdict — and each
 * name opens its own detail route, where traffic, match rules and conditions live.
 *
 * The object has no `phase`: progress lives in `status.conditions` (`Complete`,
 * `Failed`), so the status column is derived — see `strategyStatusOf` in the api-client
 * module, which is unit-tested rather than re-derived here.
 */
export interface CanaryReleasesPageProps {
  workspace: string;
  cluster: string;
  namespace: string;
}

export function CanaryReleasesPage({ workspace, cluster, namespace }: CanaryReleasesPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'name', defaultOrder: 'asc', resetOn: [cluster, namespace] });
  const [creating, setCreating] = React.useState(false);
  const [created, setCreated] = React.useState('');
  const createPermission = useStrategyPermission('create', cluster, namespace);

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
          row.targetService.toLowerCase().includes(keyword) ||
          row.versionOrder.join(' ').toLowerCase().includes(keyword),
      )
    : all;

  const rows = React.useMemo(() => {
    const items = [...filtered];
    const direction = list.order === 'asc' ? 1 : -1;
    return items.sort((a, b) =>
      list.sortBy === 'createTime' ? a.createdAt.localeCompare(b.createdAt) * direction : a.name.localeCompare(b.name) * direction,
    );
  }, [filtered, list.sortBy, list.order]);
  const listRefresh = useListRefresh('grayrelease', query);

  const schema = React.useMemo<ListSchema<StrategySummary>>(
    () => ({
      title: t('grayRelease.title'),
      refresh: listRefresh.refresh,
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
              <Link
                to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/grayrelease/$name"
                params={{ workspace, cluster, namespace, name: row.name }}
                data-ai-id={'grayrelease:open:' + row.name}
                className="truncate font-medium text-ai-accent hover:underline"
              >
                {row.alias || row.name}
              </Link>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.alias ? row.name : formatTimestamp(row.createdAt)}</span>
            </span>
          ),
        },
        {
          key: 'type',
          title: t('grayRelease.column.type'),
          width: 150,
          render: (row) => <Badge tone={row.type === 'Canary' ? 'info' : 'neutral'}>{typeText(t, row.type)}</Badge>,
        },
        {
          key: 'targetService',
          title: t('grayRelease.column.targetService'),
          width: 180,
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-secondary">{row.targetService || '-'}</span>,
        },
        {
          key: 'versions',
          title: t('grayRelease.column.versions'),
          width: 150,
          hideBelow: 'lg',
          render: (row) => {
            // Every version may or may not carry an explicit weight; a row without one
            // prints nothing for that version instead of inventing 0%.
            const weights = row.versionOrder
              .map((version) => (row.weights[version] === undefined ? '' : String(row.weights[version]) + '%'))
              .filter(Boolean);
            return (
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-mono text-[11px] text-ai-fg-secondary">{row.versionOrder.join(' / ') || '-'}</span>
                {weights.length > 0 ? <span className="truncate text-[11px] text-ai-fg-muted">{weights.join(' / ')}</span> : null}
              </span>
            );
          },
        },
        {
          key: 'status',
          title: t('grayRelease.column.status'),
          width: 120,
          render: (row) => (
            // The condition message is the "why" behind a failed or progressing badge.
            <span title={row.statusDetail || undefined}>
              <Badge tone={STATUS_TONES[row.status]}>{statusText(t, row.status)}</Badge>
            </span>
          ),
        },
        {
          key: 'createdAt',
          title: t('grayRelease.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      primaryAction: {
        key: 'create',
        label: t('grayRelease.create.action'),
        aiId: 'grayrelease:create',
        disabled: createPermission.denied,
        disabledHint: createPermission.denied ? t('grayRelease.permission.createDenied') : undefined,
      },
      // Delete lives on the detail, matching the old console (the card had no actions).
      rowActions: [],
      empty: { title: t('grayRelease.emptyTitle'), description: t('grayRelease.emptyDescription') },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: 1, pageSize: Math.max(rows.length, 1), total: rows.length },
    }),
    [cluster, createPermission.denied, list.sortBy, list.order, namespace, rows.length, t, workspace],
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
      {/* Literal handle for the list body: the page contract looks for one on the page
          element itself, and an agent should be able to target the table separately from
          the surface it sits in. */}
      <div data-ai-id="grayrelease:list" className="min-w-0">
        <ResourceList
          schema={schema}
          onRefresh={listRefresh.onRefresh}
          rows={rows}
          loading={query.isFetching}
          searchValue={list.keyword}
          onSearchChange={list.setKeyword}
          onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
            if (next) list.setSort(next);
          }}
          onAction={(action) => {
            // The primary action arrives without a row: it belongs to the page.
            if (action === 'create') {
              setCreated('');
              setCreating(true);
            }
          }}
        />
      </div>

      {created ? (
        <p role="status" className="text-xs text-ai-success" data-ai-id="grayrelease:created">
          {t('grayRelease.create.created', { name: created })}
        </p>
      ) : null}

      <CreateGrayReleaseDialog
        open={creating}
        onOpenChange={setCreating}
        cluster={cluster}
        namespace={namespace}
        onCreated={(name) => setCreated(name)}
      />
    </AiSurface>
  );
}

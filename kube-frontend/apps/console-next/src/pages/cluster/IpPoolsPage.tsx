import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ipPoolsApi, type IpPoolSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 集群 Pod IP 池.
 *
 * The old console's cluster navigation has this page under 网络, and the migration plan
 * had recorded it as "network module off, not migrating". That was wrong in a way worth
 * keeping in mind: `configz.network` gates the *menu*, while the `network.kubesphere.io`
 * group is served and `ippools` reads back fine. A module flag is not evidence that an API
 * is absent — the probe is.
 *
 * The columns answer the operator's question: how much of this segment is handed out, to
 * which workspace, and is it the pool new pods draw from by default.
 */
export interface IpPoolsPageProps {
  cluster: string;
}

const PAGE_SIZE = 10;

export function IpPoolsPage({ cluster }: IpPoolsPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<'name' | 'createTime'>({ defaultSortBy: 'createTime', defaultOrder: 'desc', resetOn: [cluster] });

  const query = useQuery({
    queryKey: ['ip-pools', cluster, list.page, list.sortBy, list.order, list.search],
    queryFn: ({ signal }) =>
      ipPoolsApi(apiClient).list({
        cluster,
        namespace: '',
        page: list.page,
        pageSize: PAGE_SIZE,
        sortBy: list.sortBy,
        order: list.order,
        keyword: list.search,
        signal,
      }),
  });

  const rows = (query.data?.items ?? []) as IpPoolSummary[];
  const total = query.data?.total ?? 0;
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  const schema = React.useMemo<ListSchema<IpPoolSummary>>(
    () => ({
      title: t('cluster.network.ipPools.title'),
      description: t('cluster.network.ipPools.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'ip-pools:search' },
      sortableKeys: ['name', 'createTime'],
      sortAiPrefix: 'ip-pools',
      sort: { key: list.sortBy, order: list.order },
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => (
            <span className="flex min-w-0 items-center gap-2">
              <a
                href={`/kube-frontend/clusters/${encodeURIComponent(cluster)}/ippools/${encodeURIComponent(row.name)}`}
                className="truncate font-medium text-ai-accent hover:underline"
                {...actionProps(`ip-pools:name:${row.name}`)}
              >
                {row.alias || row.name}
              </a>
              {row.isDefault ? <Badge tone="info">{t('cluster.network.ipPools.default')}</Badge> : null}
              {row.disabled ? <Badge tone="neutral">{t('cluster.network.ipPools.disabled')}</Badge> : null}
            </span>
          ),
        },
        {
          key: 'cidr',
          title: t('cluster.network.ipPools.cidr'),
          width: 180,
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-secondary">{row.cidr || '-'}</span>,
        },
        {
          key: 'used',
          title: t('cluster.network.ipPools.usage'),
          width: 150,
          render: (row) => (
            <span className="tabular-nums text-ai-fg-secondary">
              {/* Capacity is absent until the controller syncs a pool; showing `0 / 0`
                  would read as "full" rather than "unknown". */}
              {row.capacity > 0 ? `${row.used} / ${row.capacity}` : row.used > 0 ? String(row.used) : '-'}
            </span>
          ),
        },
        {
          key: 'workspace',
          title: t('cluster.column.workspace'),
          width: 160,
          hideBelow: 'md',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.workspace || '-'}</span>,
        },
        {
          key: 'createTime',
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'lg',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      empty: { title: t('cluster.network.ipPools.empty'), description: t('cluster.network.ipPools.emptyDescription') },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page: list.page, pageSize: PAGE_SIZE, total },
    }),
    [cluster, list, t, total],
  );

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="ip-pools:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="ip-pools:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="ip-pools:surface" state={state} className="min-w-0">
      <ResourceList
        schema={schema}
        rows={rows}
        loading={state === 'loading'}
        searchValue={list.search}
        onSearchChange={list.setKeyword}
        onPageChange={list.setPage}
        onSortChange={(next: { key: string; order: SortOrder } | undefined) => {
          if (next) list.setSort(next);
        }}
      />
    </AiSurface>
  );
}

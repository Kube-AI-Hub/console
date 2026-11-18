import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  devopsApi,
  workspaceDetailApi,
  type DevopsProjectSummary,
} from '@kube-ai-hub/api-client';
import { AiSurface, Badge, ResourceList, Skeleton, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useListRefresh } from '@/components/resource/useListRefresh';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { useResourceListState } from '@/components/resource/useResourceListState';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { formatTimestamp } from '@/lib/time';

/**
 * 企业空间 · DevOps 工程.
 *
 * The workspace manager's question is "which DevOps projects belong to my workspace, and
 * which cluster are they on". Projects are cluster-scoped CRDs, so a workspace list has to
 * pick the clusters first and then ask each one's **workspace aggregate**
 * (`/kapis/…/workspaces/<ws>/devops`) — the aggregate filters server-side, which is what
 * the old console's workspace page did with its cluster selector.
 *
 * Only clusters that report `configz.devops` are queried: a cluster without the module
 * answers 404, and turning that into an error would make a normal install look broken.
 * One cluster failing does not hide the others; every cluster failing is an error.
 *
 * The page is a list + entry (decision N-07): create/edit/delete stay on the cluster
 * DevOps pages, and each row links to its project's cluster-scoped detail, where those
 * actions live with the cluster context they need.
 */
export interface WorkspaceDevopsPageProps {
  workspace: string;
}

type SortKey = 'name' | 'cluster' | 'createTime';

interface WorkspaceDevopsRow {
  name: string;
  alias: string;
  description: string;
  cluster: string;
  syncStatus: string;
  createdAt: string;
  creator: string;
}

/** Page sizes the old console offered: 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;

const SYNC_LABEL: Record<string, { key: 'workspace.devops.sync.successful' | 'workspace.devops.sync.pending' | 'workspace.devops.sync.failed'; tone: 'success' | 'warning' | 'danger' }> = {
  successful: { key: 'workspace.devops.sync.successful', tone: 'success' },
  pending: { key: 'workspace.devops.sync.pending', tone: 'warning' },
  failed: { key: 'workspace.devops.sync.failed', tone: 'danger' },
};

export function WorkspaceDevopsPage({ workspace }: WorkspaceDevopsPageProps): React.ReactElement {
  const t = useT();
  const list = useResourceListState<SortKey>({ defaultSortBy: 'name', defaultOrder: 'asc', resetOn: [workspace] });

  const clusters = useQuery({
    queryKey: ['workspace-clusters', workspace],
    queryFn: ({ signal }) => workspaceDetailApi(apiClient).clusters({ name: workspace, signal }),
  });
  // A cluster without devops answers 404 for the aggregate; asking it would turn a
  // normal single-module install into a page-level error.
  const candidates = React.useMemo(
    () => (clusters.data ?? []).filter((cluster) => cluster.ready && cluster.devopsEnabled),
    [clusters.data],
  );
  const candidateKey = candidates.map((cluster) => cluster.name).join(',');

  const projects = useQuery({
    enabled: clusters.isSuccess && candidates.length > 0,
    queryKey: ['workspace-devops', workspace, candidateKey],
    queryFn: async ({ signal }): Promise<{ rows: WorkspaceDevopsRow[]; failed: string[] }> => {
      const settled = await Promise.allSettled(
        candidates.map(async (cluster): Promise<WorkspaceDevopsRow[]> => {
          const items = await devopsApi(apiClient).projects({ workspace, cluster: cluster.name, signal });
          return items.map((item: DevopsProjectSummary) => ({
            name: item.name,
            alias: item.alias,
            description: item.description,
            cluster: cluster.name,
            syncStatus: item.syncStatus,
            createdAt: item.createdAt,
            creator: item.creator,
          }));
        }),
      );
      const rows: WorkspaceDevopsRow[] = [];
      const failed: string[] = [];
      settled.forEach((result, index) => {
        if (result.status === 'fulfilled') rows.push(...result.value);
        else {
          const cluster = candidates[index];
          if (cluster) failed.push(cluster.name);
        }
      });
      if (candidates.length > 0 && failed.length === candidates.length) {
        throw new Error(t('workspace.devops.allFailed'));
      }
      return { rows, failed };
    },
  });

  const allRows = projects.data?.rows ?? [];
  const failedClusters = projects.data?.failed ?? [];
  const needle = list.search.trim().toLowerCase();
  const rows = React.useMemo(() => {
    const filtered = needle
      ? allRows.filter((row) =>
          [row.name, row.alias, row.description, row.cluster].some((value) => value.toLowerCase().includes(needle)),
        )
      : allRows;
    const direction = list.order === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (list.sortBy === 'cluster') return a.cluster.localeCompare(b.cluster) * direction || a.name.localeCompare(b.name);
      if (list.sortBy === 'createTime') return a.createdAt.localeCompare(b.createdAt) * direction;
      return (a.alias || a.name).localeCompare(b.alias || b.name) * direction;
    });
  }, [allRows, list.order, list.sortBy, needle]);
  const pageRows = rows.slice((list.page - 1) * list.pageSize, list.page * list.pageSize);

  const refresh = React.useCallback(() => {
    void clusters.refetch();
    void projects.refetch();
  }, [clusters, projects]);
  const listRefresh = useListRefresh('workspace-devops', { isFetching: clusters.isFetching || projects.isFetching, refetch: refresh });

  const schema = React.useMemo<ListSchema<WorkspaceDevopsRow>>(
    () => ({
      title: t('workspace.devops.title'),
      description: t('workspace.devops.description'),
      refresh: listRefresh.refresh,
      rowKey: (row) => `${row.cluster}/${row.name}`,
      rowAttributes: (row) => ({ 'data-ai-row': `${row.cluster}/${row.name}` }),
      search: { placeholder: t('workspace.devops.searchPlaceholder'), aiId: 'workspace-devops:search' },
      sortableKeys: ['name', 'cluster', 'createTime'],
      // Third click of the header cycle returns to the page's default order;
      // a server list must send a sort key, so "off" cannot be absent.
      sortFallback: list.sortFallback,
      sortAiPrefix: 'workspace-devops',
      sort: { key: list.sortBy, order: list.order },
      columnVisibility: {
        label: t('node.list.columns'),
        resetLabel: t('node.list.resetColumns'),
        aiId: 'workspace-devops:columns',
      },
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          width: 260,
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <Link
                to="/kube-frontend/clusters/$cluster/devops/$name"
                params={{ cluster: row.cluster, name: row.name }}
                className="truncate font-medium text-ai-link hover:underline"
                data-ai-id={`workspace-devops:link:${row.cluster}:${row.name}`}
              >
                {row.alias || row.name}
              </Link>
              {row.alias ? <span className="truncate font-mono text-[11px] text-ai-fg-muted">{row.name}</span> : null}
              <span className="truncate text-[11px] text-ai-fg-muted">{row.description || '-'}</span>
            </span>
          ),
        },
        {
          key: 'cluster',
          hideable: true,
          title: t('workspace.devops.column.cluster'),
          width: 140,
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.cluster}</span>,
        },
        {
          key: 'syncStatus',
          hideable: true,
          title: t('workspace.devops.column.sync'),
          width: 110,
          hideBelow: 'md',
          render: (row) => {
            const label = SYNC_LABEL[row.syncStatus];
            if (!label) return <span className="text-ai-fg-muted">-</span>;
            return <Badge tone={label.tone}>{t(label.key)}</Badge>;
          },
        },
        {
          key: 'creator',
          hideable: true,
          title: t('workspace.field.creator'),
          width: 130,
          hideBelow: 'xl',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.creator || '-'}</span>,
        },
        {
          key: 'createTime',
          hideable: true,
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => (
            <span className="whitespace-nowrap tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>
          ),
        },
      ],
      empty: {
        title: t('workspace.devops.emptyTitle'),
        description: t('workspace.devops.emptyHint'),
      },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
        range: (from, to, total) => t('table.range', { from, to, total }),
      },
      pagination: { page: list.page, pageSize: list.pageSize, pageSizeOptions: [...PAGE_SIZES], total: rows.length },
    }),
    [list.page, list.pageSize, list.sortBy, list.order, listRefresh, rows.length, t],
  );
  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('workspace-devops', columnKeys);

  if (clusters.isError) {
    return (
      <AiSurface as="section" aiId="workspace-devops:surface" state="error" className="min-w-0">
        <ResourceErrorPanel
          error={clusters.error}
          onRetry={() => void clusters.refetch()}
          retryAiId="workspace-devops:retry"
        />
      </AiSurface>
    );
  }
  if (projects.isError) {
    return (
      <AiSurface as="section" aiId="workspace-devops:surface" state="error" className="min-w-0">
        <ResourceErrorPanel
          error={projects.error}
          onRetry={() => void projects.refetch()}
          retryAiId="workspace-devops:retry"
        />
      </AiSurface>
    );
  }

  const noDevopsClusters = clusters.isSuccess && candidates.length === 0;
  const loading = clusters.isPending || (candidates.length > 0 && projects.isPending);
  const state = loading ? 'loading' : noDevopsClusters ? 'empty' : pageRows.length === 0 ? 'empty' : 'ready';

  return (
    <AiSurface as="section" aiId="workspace-devops:surface" state={state} className="flex min-w-0 flex-col gap-3">
      {loading ? <Skeleton className="h-40 w-full" /> : null}

      {!loading && noDevopsClusters ? (
        <div className="flex flex-col gap-1 rounded-lg border border-ai-border bg-ai-surface p-4 text-xs" data-ai-id="workspace-devops:empty-no-devops">
          <p className="text-sm font-medium text-ai-fg">{t('workspace.devops.noDevopsTitle')}</p>
          <p className="text-ai-fg-muted">{t('workspace.devops.noDevopsHint')}</p>
        </div>
      ) : null}

      {!loading && !noDevopsClusters ? (
        <React.Fragment>
          {failedClusters.length > 0 ? (
            <p className="text-xs text-ai-warning" role="status" data-ai-id="workspace-devops:partial">
              {t('workspace.devops.partial', { clusters: failedClusters.join(', ') })}
            </p>
          ) : null}
          <ResourceList
            {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
            onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
            schema={schema}
            onRefresh={listRefresh.onRefresh}
            rows={pageRows}
            loading={false}
            searchValue={list.keyword}
            onSearchChange={list.setKeyword}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            onSortChange={(next: { key: string; order: SortOrder }) => {
              if (next) list.setSort(next);
            }}
          />
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}

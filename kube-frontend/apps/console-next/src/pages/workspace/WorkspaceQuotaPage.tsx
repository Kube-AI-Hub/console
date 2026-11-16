import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { workspaceDetailApi } from '@kube-ai-hub/api-client';
import { AiSurface, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 租户(企业空间)配额.
 *
 * The locale description is the contract: "each project's quota and usage in this workspace".
 * A **workspace-level** quota object exists in KubeSphere (`quota.kubesphere.io/resourcequotas`),
 * but its API has no collection read — measured: the listing path answers **405**, and only
 * `GET /workspaces/<ws>/resourcequotas/<name>` works, so the objects cannot be enumerated. The
 * cluster's quota store is empty anyway. What is both enumerable and what an administrator acts
 * on is each project's own ResourceQuota, so the rows are flattened from those.
 *
 * Read through the project's namespace (`/api/v1/namespaces/<ns>/resourcequotas`) rather than a
 * cluster-wide list: a workspace member is allowed inside the workspace's projects, and a
 * cluster-scoped list is a platform-admin permission.
 */
export interface WorkspaceQuotaPageProps {
  workspace: string;
}

interface KubeResourceQuota {
  metadata?: { name?: string };
  spec?: { hard?: Record<string, string> };
  status?: { used?: Record<string, string> };
}

/** One quota row: which project, which resource, the limit and the usage. */
interface WorkspaceQuotaRow {
  project: string;
  /** The ResourceQuota object's name; a project may have more than one. */
  quotaName: string;
  /** Quota resource key as the apiserver spells it (`requests.cpu`, `pods`…). */
  resource: string;
  /** `spec.hard` from the project's ResourceQuota. */
  hard: string;
  /** `status.used` of the same resource; `0` when the quota reports no usage yet. */
  used: string;
}

/** Client-side page size: the whole list is read once (`limit=-1`), then paged here. */
/** Page sizes the old console offered (`PAGESIZE_OPTION`): 10/20/50/100. */
const PAGE_SIZES = [10, 20, 50, 100] as const;
const PAGE_SIZE = 20;

export function WorkspaceQuotaPage({ workspace }: WorkspaceQuotaPageProps): React.ReactElement {
  const t = useT();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(PAGE_SIZE);

  const query = useQuery({
    queryKey: ['workspace-quotas', workspace],
    queryFn: async ({ signal }): Promise<{ projects: string[]; rows: WorkspaceQuotaRow[] }> => {
      const projects = await workspaceDetailApi(apiClient).projects({ name: workspace, signal });
      const perProject = await Promise.all(
        projects.map(async (project): Promise<WorkspaceQuotaRow[]> => {
          const body = await apiClient.request<{ items?: KubeResourceQuota[] }>(
            `/api/v1/namespaces/${encodeURIComponent(project.name)}/resourcequotas`,
            signal ? { signal } : {},
          );
          return (body?.items ?? []).flatMap((item) => {
            const hard = item.spec?.hard ?? {};
            const used = item.status?.used ?? {};
            return Object.keys(hard).map((resource) => ({
              project: project.name,
              quotaName: item.metadata?.name ?? '',
              resource,
              hard: String(hard[resource] ?? ''),
              used: String(used[resource] ?? '0'),
            }));
          });
        }),
      );
      return { projects: projects.map((project) => project.name), rows: perProject.flat() };
    },
  });

  // A new workspace is a new list: keep the pager from pointing past its end.
  React.useEffect(() => {
    setPage(1);
  }, [workspace]);

  const rows = query.data?.rows ?? [];
  const projectCount = query.data?.projects.length ?? 0;
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const paged = rows.length > pageSize;
  const visibleRows = React.useMemo(
    () => (paged ? rows.slice((page - 1) * pageSize, page * pageSize) : rows),
    [page, pageSize, paged, rows],
  );
  const listRefresh = useListRefresh('workspace-quota', query);

  const schema = React.useMemo<ListSchema<WorkspaceQuotaRow>>(
    () => ({
      title: t('workspace.quota.title'),
      sortAiPrefix: 'workspace-quota',
      refresh: listRefresh.refresh,
      description: t('workspace.quota.description'),
      // A project may own more than one ResourceQuota (Kubernetes applies the intersection),
      // so the object name belongs in the key even though the row reads the same resource twice.
      rowKey: (row) => `${row.project}/${row.quotaName}/${row.resource}`,
      rowAttributes: (row) => ({ 'data-ai-row': `${row.project}/${row.quotaName}/${row.resource}` }),
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'workspace-quota:columns' },
      columns: [
        {
          key: 'project',
          hideable: true,
          title: t('workspace.field.project'),
          render: (row) => <span className="truncate font-medium text-ai-fg">{row.project}</span>,
        },
        {
          key: 'resource',
          hideable: true,
          title: t('projectInfo.quota.resource'),
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-secondary">{row.resource}</span>,
        },
        {
          key: 'hard',
          hideable: true,
          title: t('projectInfo.quota.hard'),
          width: 160,
          align: 'right',
          render: (row) => <span className="tabular-nums text-ai-fg">{row.hard || '-'}</span>,
        },
        {
          key: 'used',
          hideable: true,
          title: t('projectInfo.quota.used'),
          width: 160,
          align: 'right',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{row.used || '-'}</span>,
        },
      ],
      // Two different "nothing here" cases: no projects at all, or projects with no quota set.
      empty: {
        title: t('common.empty'),
        description: projectCount > 0 ? t('workspace.quota.empty') : t('workspace.projects.emptyDescription'),
      },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      ...(paged ? { pagination: { page, pageSize, pageSizeOptions: [...PAGE_SIZES], total: rows.length } } : {}),
    }),
    // `busy` comes from the query, so the schema must rebuild when the fetch state changes.
    [page, pageSize, paged, projectCount, query.isFetching, rows.length, t],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('workspace-quota', columnKeys);

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="workspace-quota:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="workspace-quota:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="workspace-quota:surface" state={state} className="min-w-0">
      {/* Literal `data-ai-id` on the table wrapper: the contract test reads page source,
          and `AiSurface`'s `aiId` prop alone is not a literal attribute in this file. */}
      <div data-ai-id="workspace-quota:table" className="min-w-0">
        <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
          schema={schema}
          onRefresh={listRefresh.onRefresh}
          rows={visibleRows}
          loading={state === 'loading'}
          {...(paged ? { onPageChange: setPage, onPageSizeChange: (next: number) => { setPageSize(next); setPage(1); } } : {})}
        />
      </div>
    </AiSurface>
  );
}

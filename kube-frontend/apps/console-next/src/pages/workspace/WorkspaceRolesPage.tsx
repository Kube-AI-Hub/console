import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AiSurface, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 企业空间角色.
 *
 * Workspace roles are the workspace-scoped half of KubeSphere's RBAC: they are what a
 * `workspacemembers` entry points at (see the members page), so listing them here closes the
 * question "which role can I grant inside this workspace".
 *
 * Read from the workspace-scoped IAM collection rather than the platform-wide
 * `/workspaceroles?limit=-1`: the latter returns every workspace's roles and would need
 * client-side filtering on a label the page should not have to know about.
 *
 * Read-only. The role editor writes rules through the native RBAC endpoint, which is a
 * separate feature; a create button whose write silently drops the rules is worse than none.
 */
export interface WorkspaceRolesPageProps {
  workspace: string;
}

interface KubeWorkspaceRole {
  metadata?: {
    name?: string;
    creationTimestamp?: string;
    annotations?: Record<string, string>;
  };
  rules?: unknown[];
}

interface WorkspaceRoleRow {
  /** Object name — the identity a member's role annotation refers to. */
  name: string;
  /** `kubesphere.io/alias-name`, the label the old console showed first. */
  alias: string;
  ruleCount: number;
  createdAt: string;
}

/** Client-side page size: the whole collection is read once (`limit=-1`), then paged here. */
const PAGE_SIZE = 20;

export function WorkspaceRolesPage({ workspace }: WorkspaceRolesPageProps): React.ReactElement {
  const t = useT();
  const [page, setPage] = React.useState(1);

  const query = useQuery({
    queryKey: ['workspace-roles', workspace],
    queryFn: async ({ signal }): Promise<WorkspaceRoleRow[]> => {
      const body = await apiClient.request<{ items?: KubeWorkspaceRole[] }>(
        `/kapis/iam.kubesphere.io/v1alpha2/workspaces/${encodeURIComponent(workspace)}/workspaceroles`,
        { query: { limit: -1 }, ...(signal ? { signal } : {}) },
      );
      return (body?.items ?? []).map((item) => ({
        name: item.metadata?.name ?? '',
        alias: item.metadata?.annotations?.['kubesphere.io/alias-name'] ?? '',
        ruleCount: (item.rules ?? []).length,
        createdAt: item.metadata?.creationTimestamp ?? '',
      }));
    },
  });

  // A new workspace is a new list: keep the pager from pointing past its end.
  React.useEffect(() => {
    setPage(1);
  }, [workspace]);

  const rows = query.data ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const paged = rows.length > PAGE_SIZE;
  const visibleRows = React.useMemo(
    () => (paged ? rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : rows),
    [page, paged, rows],
  );

  const schema = React.useMemo<ListSchema<WorkspaceRoleRow>>(
    () => ({
      title: t('workspace.roles.title'),
      description: t('workspace.roles.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      columns: [
        {
          key: 'name',
          title: t('workspace.field.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-ai-fg">{row.alias || row.name}</span>
              {row.alias ? <span className="truncate font-mono text-[11px] text-ai-fg-muted">{row.name}</span> : null}
            </span>
          ),
        },
        {
          key: 'ruleCount',
          title: t('platform.column.ruleCount'),
          width: 120,
          align: 'right',
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.ruleCount}</span>,
        },
        {
          key: 'createdAt',
          title: t('workspace.field.createdAt'),
          width: 180,
          hideBelow: 'lg',
          render: (row) => (
            <span className="tabular-nums text-ai-fg-muted">{row.createdAt ? formatTimestamp(row.createdAt) : '-'}</span>
          ),
        },
      ],
      empty: { title: t('common.empty'), description: t('settings.roles.emptyDescription') },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      ...(paged ? { pagination: { page, pageSize: PAGE_SIZE, total: rows.length } } : {}),
    }),
    [page, paged, rows.length, t],
  );

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="workspace-roles:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="workspace-roles:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="workspace-roles:surface" state={state} className="min-w-0">
      {/* Literal `data-ai-id` on the table wrapper: the contract test reads page source,
          and `AiSurface`'s `aiId` prop alone is not a literal attribute in this file. */}
      <div data-ai-id="workspace-roles:table" className="min-w-0">
        <ResourceList
          schema={schema}
          rows={visibleRows}
          loading={state === 'loading'}
          {...(paged ? { onPageChange: setPage } : {})}
        />
      </div>
    </AiSurface>
  );
}

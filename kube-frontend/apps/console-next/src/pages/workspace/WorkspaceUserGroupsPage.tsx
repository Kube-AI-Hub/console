import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AiSurface, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

/**
 * 企业空间用户组.
 *
 * A KubeSphere Group is a cluster-scoped IAM object carrying a workspace label; whoever
 * belongs to it is not on the group but in a `GroupBinding` (`groupRef.name` + `users`).
 * The page therefore reads two collections and joins them: members are counted from the
 * bindings, which is the only place the relation exists.
 *
 * Both reads are workspace-scoped. The tenant API has no groups at all, and the global
 * `/groups` path would need the label filter the workspace path already applies.
 *
 * The IAM Group type itself has no description field — only `metadata.generateName` (the
 * display name the old console shows) and the `kubesphere.io/alias-name` annotation — so
 * the description column reads the platform's usual `kubesphere.io/description` annotation
 * and stays `-` when an object does not carry one. Reporting a field the API never returns
 * as if it were set would be a lie the page cannot back up.
 */
export interface WorkspaceUserGroupsPageProps {
  workspace: string;
}

interface KubeGroup {
  metadata?: {
    name?: string;
    generateName?: string;
    creationTimestamp?: string;
    annotations?: Record<string, string>;
  };
}

interface KubeGroupBinding {
  groupRef?: { name?: string };
  users?: string[];
}

interface WorkspaceUserGroupRow {
  /** Object name. */
  name: string;
  /** Human name: alias, else the group's `generateName`, which KubeSphere uses as display name. */
  displayName: string;
  /** Number of users bound to this group in the workspace. */
  memberCount: number;
  description: string;
}

/** Client-side page size: both collections are read once (`limit=-1`), then paged here. */
const PAGE_SIZE = 20;

export function WorkspaceUserGroupsPage({ workspace }: WorkspaceUserGroupsPageProps): React.ReactElement {
  const t = useT();
  const [page, setPage] = React.useState(1);

  const query = useQuery({
    queryKey: ['workspace-user-groups', workspace],
    queryFn: async ({ signal }): Promise<WorkspaceUserGroupRow[]> => {
      const base = `/kapis/iam.kubesphere.io/v1alpha2/workspaces/${encodeURIComponent(workspace)}`;
      const [groupsBody, bindingsBody] = await Promise.all([
        apiClient.request<{ items?: KubeGroup[] }>(`${base}/groups`, {
          query: { limit: -1 },
          ...(signal ? { signal } : {}),
        }),
        apiClient.request<{ items?: KubeGroupBinding[] }>(`${base}/groupbindings`, {
          query: { limit: -1 },
          ...(signal ? { signal } : {}),
        }),
      ]);

      // One group may have several bindings (one per grant); sum every binding that names it.
      const members = new Map<string, number>();
      for (const binding of bindingsBody?.items ?? []) {
        const group = binding.groupRef?.name ?? '';
        if (!group) continue;
        members.set(group, (members.get(group) ?? 0) + (binding.users ?? []).length);
      }

      return (groupsBody?.items ?? []).map((group) => {
        const name = group.metadata?.name ?? '';
        const annotations = group.metadata?.annotations ?? {};
        const generateName = group.metadata?.generateName ?? '';
        return {
          name,
          displayName: annotations['kubesphere.io/alias-name'] || generateName || name,
          memberCount: members.get(name) ?? 0,
          description: annotations['kubesphere.io/description'] ?? '',
        };
      });
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

  const schema = React.useMemo<ListSchema<WorkspaceUserGroupRow>>(
    () => ({
      title: t('workspace.userGroups.title'),
      description: t('workspace.userGroups.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      columns: [
        {
          key: 'displayName',
          title: t('workspace.field.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-ai-fg">{row.displayName}</span>
              {row.displayName !== row.name ? (
                <span className="truncate font-mono text-[11px] text-ai-fg-muted">{row.name}</span>
              ) : null}
            </span>
          ),
        },
        {
          key: 'memberCount',
          title: t('workspace.overview.members'),
          width: 120,
          align: 'right',
          render: (row) => <span className="tabular-nums text-ai-fg-secondary">{row.memberCount}</span>,
        },
        {
          key: 'description',
          title: t('common.description'),
          hideBelow: 'lg',
          render: (row) => (
            <span className="truncate text-ai-fg-muted" title={row.description}>
              {row.description || '-'}
            </span>
          ),
        },
      ],
      empty: { title: t('common.empty') },
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
      <AiSurface as="section" aiId="workspace-user-groups:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="workspace-user-groups:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="workspace-user-groups:surface" state={state} className="min-w-0">
      {/* Literal `data-ai-id` on the table wrapper: the contract test reads page source,
          and `AiSurface`'s `aiId` prop alone is not a literal attribute in this file. */}
      <div data-ai-id="workspace-user-groups:table" className="min-w-0">
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

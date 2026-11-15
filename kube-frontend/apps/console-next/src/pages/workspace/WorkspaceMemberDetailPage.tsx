import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { workspaceDetailApi, workspaceMembersApi, type WorkspaceMemberResource } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, AiSurface, Badge, ResourceList, Skeleton, Tabs, TabsContent, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { formatTimestamp } from '@/lib/time';
import { useAuth } from '@/shell/AuthProvider';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 租户(企业空间)成员详情.
 *
 * The list answers who is bound here. This page answers which projects (and DevOps
 * projects, when the module exists) that binding can reach, plus the same identity
 * fields the old detail showed: workspace, workspace role, email.
 */
export interface WorkspaceMemberDetailPageProps {
  workspace: string;
  name: string;
}

type Tab = 'projects' | 'devops';

function memberStatusLabel(status: string, active: string, disabled: string): string {
  if (status === 'Active') return active;
  if (status === 'Disabled') return disabled;
  return status || '-';
}

function MemberResourceTable({
  workspace,
  cluster,
  kind,
  rows,
  loading,
  description,
  emptyTitle,
}: {
  workspace: string;
  cluster: string;
  kind: Tab;
  rows: WorkspaceMemberResource[];
  loading: boolean;
  description: string;
  emptyTitle: string;
}): React.ReactElement {
  const t = useT();
  // The rows come from four queries that live in the page, so the table cannot refetch them
  // directly; it invalidates every query instead, which is what a reader means by "refresh".
  const queryClient = useQueryClient();
  const listRefresh = useListRefresh(`workspace-member-${kind}`, {
    // No busy state: the schema is memoised without the loading flag, so a busy value captured on
    // the first render would freeze the button in the disabled state (a trap hit twice already).
    // The table keeps its own row-level loading feedback instead.
    isFetching: false,
    refetch: () => queryClient.invalidateQueries(),
  });
  const schema = React.useMemo<ListSchema<WorkspaceMemberResource>>(
    () => ({
      description,
      refresh: listRefresh.refresh,
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      columns: [
        {
          key: 'name',
          title: t('workspace.field.name'),
          render: (row) =>
            kind === 'projects' && cluster ? (
              <a
                href={`/kube-frontend/${encodeURIComponent(workspace)}/clusters/${encodeURIComponent(cluster)}/projects/${encodeURIComponent(row.name)}/overview`}
                className="truncate font-medium text-ai-accent hover:underline"
                {...actionProps(`workspace-member-${kind}:name:${row.name}`)}
              >
                {row.alias || row.name}
              </a>
            ) : (
              <span className="truncate font-medium text-ai-fg">{row.alias || row.name}</span>
            ),
        },
        {
          key: 'createdAt',
          title: t('workspace.field.createdAt'),
          width: 180,
          hideBelow: 'md',
          render: (row) => (
            <span className="tabular-nums text-ai-fg-muted">{row.createdAt ? formatTimestamp(row.createdAt) : '-'}</span>
          ),
        },
      ],
      empty: { title: emptyTitle },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
    }),
    [t, description, emptyTitle, kind, workspace, cluster],
  );
  return (
    <div data-ai-id={`workspace-member-detail:${kind}`}>
      <ResourceList schema={schema} rows={rows} loading={loading} onRefresh={listRefresh.onRefresh} />
    </div>
  );
}

export function WorkspaceMemberDetailPage({ workspace, name }: WorkspaceMemberDetailPageProps): React.ReactElement {
  const t = useT();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<Tab>('projects');
  const [removing, setRemoving] = React.useState(false);
  const members = workspaceMembersApi(apiClient);
  const self = Boolean(user?.name) && user?.name === name;

  const detail = useQuery({
    queryKey: ['workspace-member', workspace, name],
    queryFn: ({ signal }) => members.get({ workspace, username: name, signal }),
  });
  const workspaceQuery = useQuery({
    queryKey: ['workspace-detail', workspace],
    queryFn: ({ signal }) => workspaceDetailApi(apiClient).get({ name: workspace, signal }),
  });
  const cluster = workspaceQuery.data?.clusters[0] ?? '';
  const projects = useQuery({
    queryKey: ['workspace-member-projects', workspace, name, cluster],
    queryFn: ({ signal }) =>
      cluster
        ? members.memberProjects({ workspace, username: name, cluster, signal })
        : members.memberProjects({ workspace, username: name, signal }),
  });
  const devops = useQuery({
    queryKey: ['workspace-member-devops', workspace, name, cluster],
    enabled: tab === 'devops',
    queryFn: ({ signal }) =>
      cluster
        ? members.memberDevops({ workspace, username: name, cluster, signal })
        : members.memberDevops({ workspace, username: name, signal }),
  });
  const remove = useMutation({
    mutationFn: () => members.remove({ workspace, username: name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace-members', workspace] });
      setRemoving(false);
    },
  });

  const account = detail.data;
  const state = detail.isPending ? 'loading' : detail.isError ? 'error' : 'ready';

  return (
    <AiSurface as="section" aiId="workspace-member-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            to="/kube-frontend/workspaces/$workspace/members"
            params={{ workspace }}
            className="text-sm text-ai-accent hover:underline"
            {...actionProps('workspace-member-detail:back')}
          >
            ← {t('workspace.members.back')}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-ai-fg">{account?.username || name}</h1>
            {account ? (
              <Badge tone={account.status === 'Active' ? 'success' : 'warning'}>
                {memberStatusLabel(account.status, t('platform.status.active'), t('platform.status.disabled'))}
              </Badge>
            ) : null}
          </div>
        </div>
        {account && !self ? (
          <AiButton aiId="workspace-member-detail:remove" size="sm" variant="danger" onClick={() => { remove.reset(); setRemoving(true); }}>
            {t('settings.members.remove')}
          </AiButton>
        ) : null}
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={detail.error} onRetry={() => void detail.refetch()} retryAiId="workspace-member-detail:retry" />
      ) : null}

      {account ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="workspace-member-detail:basic">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workspace.overview.basic')}</h2>
            <dl className="grid grid-cols-[minmax(8rem,12rem)_1fr] gap-x-6 gap-y-2 text-sm">
              <DefinitionRow label={t('platform.workspaces.title')} value={workspace} />
              <DefinitionRow label={t('workspace.field.workspaceRole')} value={account.role || '-'} />
              <DefinitionRow label={t('platform.user.email')} value={account.email || '-'} />
              <DefinitionRow
                label={t('workspace.field.lastLogin')}
                value={account.lastLogin ? formatTimestamp(account.lastLogin) : t('platform.column.notLoginYet')}
              />
            </dl>
          </section>

          <Tabs
            value={tab}
            onValueChange={(next) => setTab(next as Tab)}
            items={[
              {
                value: 'projects',
                label: t('workspace.members.projects'),
                aiId: 'workspace-member-detail:tab:projects',
                ...(projects.data ? { count: projects.data.length } : {}),
              },
              {
                value: 'devops',
                label: t('workspace.members.devops'),
                aiId: 'workspace-member-detail:tab:devops',
                ...(devops.data ? { count: devops.data.length } : {}),
              },
            ]}
          >
            <TabsContent value="projects" className="pt-4">
              {projects.isError ? (
                <ResourceErrorPanel error={projects.error} onRetry={() => void projects.refetch()} retryAiId="workspace-member-detail:projects-retry" />
              ) : (
                <MemberResourceTable
                  workspace={workspace}
                  cluster={cluster || 'host'}
                  kind="projects"
                  rows={projects.data ?? []}
                  loading={projects.isPending}
                  description={t('workspace.members.projectsDescription')}
                  emptyTitle={t('workspace.members.projectsEmpty')}
                />
              )}
            </TabsContent>
            <TabsContent value="devops" className="pt-4">
              {devops.isError ? (
                <ResourceErrorPanel error={devops.error} onRetry={() => void devops.refetch()} retryAiId="workspace-member-detail:devops-retry" />
              ) : (
                <MemberResourceTable
                  workspace={workspace}
                  cluster={cluster || 'host'}
                  kind="devops"
                  rows={devops.data ?? []}
                  loading={devops.isPending}
                  description={t('workspace.members.devopsDescription')}
                  emptyTitle={t('workspace.members.devopsEmpty')}
                />
              )}
            </TabsContent>
          </Tabs>
        </React.Fragment>
      ) : null}

      {removing ? (
        <DeleteDialog
          open
          names={[name]}
          resource="workspace-members"
          noun={t('workspace.field.member')}
          title={t('settings.members.remove')}
          confirmLabel={t('settings.members.remove')}
          pending={remove.isPending}
          {...(remove.error ? { error: errorMessage(t, remove.error) } : {})}
          onOpenChange={(open) => {
            if (!open && !remove.isPending) setRemoving(false);
          }}
          onConfirm={async () => {
            try {
              await remove.mutateAsync();
              await navigate({ to: '/kube-frontend/workspaces/$workspace/members', params: { workspace } });
            } catch {
              /* Error stays in the confirmation. */
            }
          }}
        />
      ) : null}
    </AiSurface>
  );
}

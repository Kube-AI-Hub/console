import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  workspaceGroupForest,
  workspaceGroupsApi,
  type WorkspaceGroupMember,
  type WorkspaceGroupNode,
  type WorkspaceGroupSummary,
} from '@kube-ai-hub/api-client';
import {
  AiButton,
  AiSurface,
  Empty,
  Button,
  Modal,
  ResourceForm,
  ResourceList,
  cn,
  type FormSchema,
  type ListSchema,
} from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { GROUP_PARENT_ROOT, WorkspaceUserGroupDialog } from './WorkspaceUserGroupDialog';
import { useListRefresh } from '@/components/resource/useListRefresh';
import { useCollectionWatch } from '@/components/resource/useCollectionWatch';

/**
 * 租户(企业空间)用户组.
 *
 * Old console's department page is a tree plus the members of the selected node.
 * Groups are IAM objects labelled by workspace; parent is `iam.kubesphere.io/group-parent`;
 * membership lives on GroupBinding, not on the Group. The page therefore reads two
 * collections, builds the tree client-side, and writes groups / bindings / the group's
 * workspace-role binding through workspaceGroupsApi.
 *
 * Project and DevOps role arrays from the old SET_DEPARTMENTS modal stay out: those
 * are cross-scope grants, not group membership.
 */
export interface WorkspaceUserGroupsPageProps {
  workspace: string;
}

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; group: WorkspaceGroupSummary }
  | { kind: 'delete'; group: WorkspaceGroupSummary }
  | { kind: 'add-member'; group: WorkspaceGroupSummary }
  | { kind: 'remove-member'; group: WorkspaceGroupSummary; username: string };

function listLabels(t: ReturnType<typeof useT>) {
  return {
    selectAll: t('table.selectAll'),
    selectRow: (index: number) => t('table.selectRow', { index }),
    moreActions: t('table.moreActions'),
    previous: t('table.previous'),
    next: t('table.next'),
    selected: (count: number) => t('table.selectedCount', { count }),
  };
}

function GroupTree({
  workspace,
  nodes,
  selected,
  onSelect,
}: {
  workspace: string;
  nodes: WorkspaceGroupNode[];
  selected: string;
  onSelect: (name: string) => void;
}): React.ReactElement {
  const render = (items: WorkspaceGroupNode[], depth: number): React.ReactNode =>
    items.map((node) => (
      <div key={node.group.name}>
        <Button
          variant="ghost"
          data-ai-id={`workspace-user-groups:tree-node:${node.group.name}`}
          data-ai-row={node.group.name}
          data-ai-generate-name={node.group.generateName || node.group.displayName}
          data-ai-depth={String(depth)}
          style={{ paddingLeft: 8 + depth * 16 }}
          className={cn(
            'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
            selected === node.group.name ? 'bg-ai-accent/10 text-ai-fg' : 'text-ai-fg-secondary hover:bg-ai-fill',
          )}
          onClick={() => onSelect(node.group.name)}
        >
          <span className="min-w-0 truncate font-medium">{node.group.displayName}</span>
          <span className="ml-auto tabular-nums text-[11px] text-ai-fg-muted">{node.group.memberCount}</span>
        </Button>
        {render(node.children, depth + 1)}
      </div>
    ));

  return (
    <nav data-ai-id="workspace-user-groups:tree" aria-label={workspace} className="min-h-[16rem] min-w-0">
      <div className="truncate px-2 py-1 text-xs text-ai-fg-muted">{workspace}</div>
      {render(nodes, 0)}
    </nav>
  );
}

export function WorkspaceUserGroupsPage({ workspace }: WorkspaceUserGroupsPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const groupsApi = workspaceGroupsApi(apiClient);
  const [selected, setSelected] = React.useState('');
  const [keyword, setKeyword] = React.useState('');
  const [dialog, setDialog] = React.useState<Dialog | null>(null);

  React.useEffect(() => {
    setSelected('');
    setKeyword('');
    setDialog(null);
  }, [workspace]);

  const groupsQuery = useQuery({
    queryKey: ['workspace-user-groups', workspace],
    queryFn: ({ signal }) => groupsApi.list({ workspace, signal }),
  });
  const groups = groupsQuery.data ?? [];
  const forest = React.useMemo(() => workspaceGroupForest(groups), [groups]);
  const selectedGroup = groups.find((group) => group.name === selected);

  React.useEffect(() => {
    if (selected && groups.some((group) => group.name === selected)) return;
    setSelected(groups[0]?.name ?? '');
  }, [groups, selected]);

  /*
   * Live refresh (re-inclusion N-27 / DEC-19).
   *
   * Two watches, not one: the tree's nodes come from the `groups` collection while its
   * member counts come from `groupbindings`. Watching only bindings (the decision's first
   * wording) would miss a group created/renamed/deleted from another console — the tree
   * would stay stale while claiming to be live. Both only invalidate the queries; the tree
   * is assembled client-side from the collections, so merging events would produce a tree
   * the next read disagrees with.
   *
   * The **native** cluster-scoped collection is watched, not the kapis workspace aggregate
   * the page reads. Probed 2026-11-17: `/kapis/.../workspaces/<ws>/groups?watch=true`
   * answers `content-type: application/json` with a plain list and closes — the page would
   * say "live" and never update. `/apis/iam.kubesphere.io/v1alpha2/groups?watch=true`
   * streams `ADDED` events. The watch is cluster-wide and only invalidates this workspace's
   * queries, so a change in another workspace costs one refetch, not a wrong row.
   *
   * `groupbindings` is deliberately **not** watched: on this deployment its native watch
   * does not deliver events (20s probe: no response head, no event; the collection is a
   * virtual one served by ks-apiserver). Member-count changes made elsewhere therefore need
   * the manual refresh; the page keeps it visible. Watching a collection that never speaks
   * would be worse than not watching it — the page would claim to be live.
   */
  const groupsWatch = useCollectionWatch({
    enabled: true,
    path: '/apis/iam.kubesphere.io/v1alpha2/groups',
    queryKey: ['workspace-user-groups', workspace],
    client: apiClient,
  });
  /*
   * A watch reports "live" only once its first event arrives (the HTTP response headers
   * are not flushed before that); before that it is "connecting".
   */
  const liveState = groupsWatch;

  const membersQuery = useQuery({
    queryKey: ['workspace-user-groups', workspace, 'members', selected],
    queryFn: ({ signal }) => groupsApi.members({ workspace, group: selected, signal }),
    enabled: Boolean(selected),
  });
  const memberRows = React.useMemo(() => {
    const rows = membersQuery.data ?? [];
    const needle = keyword.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => row.username.toLowerCase().includes(needle));
  }, [keyword, membersQuery.data]);
  const showMemberSearch = Boolean(keyword.trim()) || (membersQuery.data?.length ?? 0) > 0;

  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['workspace-user-groups', workspace] });
  };

  const writeGroup = useMutation({
    mutationFn: async (input: { generateName: string; alias: string; parent: string; workspaceRole: string }) => {
      if (dialog?.kind === 'edit') {
        await groupsApi.update({ workspace, name: dialog.group.name, ...input });
        return dialog.group;
      }
      return groupsApi.create({ workspace, ...input });
    },
    onSuccess: async (created) => {
      await invalidate();
      setSelected(created.name);
      setDialog(null);
    },
  });
  const removeGroup = useMutation({
    mutationFn: (name: string) => groupsApi.remove({ workspace, name }),
    onSuccess: async (_result, name) => {
      queryClient.setQueryData<WorkspaceGroupSummary[]>(['workspace-user-groups', workspace], (prev) =>
        (prev ?? []).filter((group) => group.name !== name),
      );
      await invalidate();
      setDialog(null);
    },
  });
  const addMembers = useMutation({
    mutationFn: (input: { group: string; username: string }) =>
      groupsApi.addMembers({ workspace, group: input.group, usernames: [input.username] }),
    onSuccess: async () => {
      await invalidate();
      setDialog(null);
    },
  });
  const removeMember = useMutation({
    mutationFn: (input: { group: string; username: string }) => groupsApi.removeMember({ workspace, ...input }),
    onSuccess: async () => {
      await invalidate();
      setDialog(null);
    },
  });

  const state = groupsQuery.isPending ? 'loading' : groupsQuery.isError ? 'error' : groups.length === 0 ? 'empty' : 'ready';
  const hasChildren = React.useCallback(
    (name: string) => groups.some((group) => group.parent === name),
    [groups],
  );

  // The member table and the tree read separate queries; the table's refresh re-reads both so the
  // two halves of the page cannot disagree.
  const listRefresh = useListRefresh('workspace-user-groups', {
    isFetching: membersQuery.isFetching,
    refetch: () => {
      void membersQuery.refetch();
      void groupsQuery.refetch();
    },
  });

  const memberSchema = React.useMemo<ListSchema<WorkspaceGroupMember>>(
    () => ({
      refresh: listRefresh.refresh,
      ...(showMemberSearch
        ? { search: { placeholder: t('workspace.userGroups.search'), aiId: 'workspace-user-groups:search' } }
        : {}),
      rowActions: [{ key: 'remove-member', label: t('workspace.userGroups.removeMember'), tone: 'danger' }],
      rowKey: 'username',
      rowAttributes: (row) => ({ 'data-ai-row': row.username }),
      columns: [
        // Single-column table: a column chooser here would have nothing to hide, so none is
        // wired. The group tree above is not a ListSchema table at all.
        {
          key: 'username',
          title: t('workspace.field.member'),
          /* Pinned: the row's identity, kept in place while the other columns scroll. */
          width: 220,
          pin: 'start',
          render: (row) => <span className="truncate font-medium text-ai-fg">{row.username}</span>,
        },
      ],
      empty: { title: t('workspace.userGroups.membersEmpty') },
      labels: listLabels(t),
    }),
    // `busy` comes from the query, so the schema must rebuild when the fetch state changes.
    [membersQuery.isFetching, showMemberSearch, t],
  );

  const addMemberSchema = React.useMemo<FormSchema>(
    () => ({
      fields: [
        {
          key: 'username',
          label: t('settings.members.user'),
          type: 'text',
          required: true,
          hint: t('settings.members.userHint'),
          rules: [{ validate: (value) => (String(value ?? '').trim() ? null : t('workspace.userGroups.error.user')) }],
        },
      ],
      submit: { label: t('common.confirm') },
    }),
    [t],
  );

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="workspace-user-groups:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={groupsQuery.error} onRetry={() => void groupsQuery.refetch()} retryAiId="workspace-user-groups:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="workspace-user-groups:surface" state={state} className="min-w-0">
      <div data-ai-id="workspace-user-groups:table" className="flex min-w-0 flex-col gap-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ai-fg">{t('workspace.userGroups.title')}</h2>
            <p className="text-xs text-ai-fg-muted">{t('workspace.userGroups.description')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              data-ai-id="workspace-user-groups:live-state"
              data-ai-state={liveState}
              title={t('workspace.userGroups.liveHint')}
              className={`self-center text-[11px] ${liveState === 'error' ? 'text-ai-warning' : 'text-ai-fg-muted'}`}
            >
              {liveState === 'live'
                ? t('workspace.userGroups.liveOn')
                : liveState === 'error'
                  ? t('workspace.userGroups.liveOff')
                  : t('workspace.userGroups.liveConnecting')}
            </span>
            {/* A distinct handle from the member table's `workspace-user-groups:refresh`: two
                controls with one id make every strict locator (and the AI surface manifest)
                ambiguous — found by the V-4 serial E2E, 2026-11-19. */}
            <AiButton aiId="workspace-user-groups:refresh-tree" size="sm" variant="secondary" onClick={() => void groupsQuery.refetch()}>
              {t('common.refresh')}
            </AiButton>
            <AiButton aiId="workspace-user-groups:create" size="sm" variant="primary" onClick={() => setDialog({ kind: 'create' })}>
              {t('workspace.userGroups.create')}
            </AiButton>
          </div>
        </header>

        {state === 'empty' || state === 'loading' ? (
          <Empty
            title={state === 'loading' ? t('common.loading') : t('workspace.userGroups.empty')}
            description={state === 'loading' ? undefined : t('workspace.userGroups.emptyDescription')}
          />
        ) : (
          <div className="grid min-h-[24rem] grid-cols-1 gap-4 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
            <div className="rounded-lg border border-ai-border bg-ai-surface p-2">
              <GroupTree workspace={workspace} nodes={forest} selected={selected} onSelect={setSelected} />
            </div>
            <div className="min-w-0">
              {selectedGroup ? (
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium text-ai-fg">{selectedGroup.displayName}</h3>
                      {selectedGroup.displayName !== selectedGroup.name ? (
                        <p className="truncate font-mono text-[11px] text-ai-fg-muted">{selectedGroup.name}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AiButton
                        aiId="workspace-user-groups:add-member"
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          addMembers.reset();
                          setDialog({ kind: 'add-member', group: selectedGroup });
                        }}
                      >
                        {t('workspace.userGroups.addMember')}
                      </AiButton>
                      <AiButton
                        aiId="workspace-user-groups:edit"
                        size="sm"
                        variant="secondary"
                        onClick={() => setDialog({ kind: 'edit', group: selectedGroup })}
                      >
                        {t('workspace.userGroups.edit')}
                      </AiButton>
                      <AiButton
                        aiId="workspace-user-groups:delete"
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          removeGroup.reset();
                          setDialog({ kind: 'delete', group: selectedGroup });
                        }}
                      >
                        {t('workspace.userGroups.delete')}
                      </AiButton>
                    </div>
                  </div>
                  {membersQuery.isError ? (
                    <ResourceErrorPanel
                      error={membersQuery.error}
                      onRetry={() => void membersQuery.refetch()}
                      retryAiId="workspace-user-groups:members-retry"
                    />
                  ) : (
                    <ResourceList
                      onRefresh={listRefresh.onRefresh}
                      schema={memberSchema}
                      rows={memberRows}
                      loading={membersQuery.isPending} refreshing={membersQuery.isFetching && !membersQuery.isPending}
                      {...(showMemberSearch ? { searchValue: keyword, onSearchChange: setKeyword } : {})}
                      onAction={(key, row) => {
                        if (key === 'remove-member' && row) {
                          removeMember.reset();
                          setDialog({ kind: 'remove-member', group: selectedGroup, username: row.username });
                        }
                      }}
                    />
                  )}
                </div>
              ) : (
                <Empty title={t('workspace.userGroups.selectGroup')} />
              )}
            </div>
          </div>
        )}
      </div>

      {dialog?.kind === 'create' || dialog?.kind === 'edit' ? (
        <WorkspaceUserGroupDialog
          key={`${workspace}:${dialog.kind === 'edit' ? dialog.group.name : 'create'}`}
          workspace={workspace}
          groups={groups}
          defaultParent={dialog.kind === 'create' ? selected || GROUP_PARENT_ROOT : GROUP_PARENT_ROOT}
          pending={writeGroup.isPending}
          {...(dialog.kind === 'edit' ? { group: dialog.group } : {})}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          onSubmit={(input) => writeGroup.mutateAsync(input)}
        />
      ) : null}

      {dialog?.kind === 'add-member' ? (
        <Modal
          open
          onOpenChange={(open) => {
            if (!addMembers.isPending) setDialog(open ? dialog : null);
          }}
          title={t('workspace.userGroups.addMember')}
          description={t('workspace.userGroups.addMemberDescription')}
        >
          <div data-ai-id="workspace-user-groups:member-dialog">
            <ResourceForm
              schema={addMemberSchema}
              defaultValues={{ username: '' }}
              submitting={addMembers.isPending}
              onCancel={() => setDialog(null)}
              onSubmit={async (values) => {
                await addMembers.mutateAsync({
                  group: dialog.group.name,
                  username: String(values['username'] ?? '').trim(),
                });
              }}
            />
          </div>
        </Modal>
      ) : null}

      {dialog?.kind === 'delete' ? (
        <DeleteDialog
          open
          names={[dialog.group.generateName || dialog.group.displayName]}
          resource="workspace-user-groups"
          noun={t('workspace.userGroups.title')}
          title={t('workspace.userGroups.delete')}
          confirmLabel={t('workspace.userGroups.delete')}
          pending={removeGroup.isPending}
          {...(removeGroup.error || hasChildren(dialog.group.name)
            ? {
                error: hasChildren(dialog.group.name)
                  ? t('workspace.userGroups.error.hasChildren')
                  : errorMessage(t, removeGroup.error),
              }
            : {})}
          onOpenChange={(open) => {
            if (!open && !removeGroup.isPending) setDialog(null);
          }}
          onConfirm={async () => {
            if (hasChildren(dialog.group.name)) return;
            try {
              await removeGroup.mutateAsync(dialog.group.name);
            } catch {
              /* Error stays in the confirmation. */
            }
          }}
        />
      ) : null}

      {dialog?.kind === 'remove-member' ? (
        <DeleteDialog
          open
          names={[dialog.username]}
          resource="workspace-user-groups"
          noun={t('workspace.field.member')}
          title={t('workspace.userGroups.removeMember')}
          confirmLabel={t('workspace.userGroups.removeMember')}
          pending={removeMember.isPending}
          {...(removeMember.error ? { error: errorMessage(t, removeMember.error) } : {})}
          onOpenChange={(open) => {
            if (!open && !removeMember.isPending) setDialog(null);
          }}
          onConfirm={async () => {
            try {
              await removeMember.mutateAsync({ group: dialog.group.name, username: dialog.username });
            } catch {
              /* Error stays in the confirmation. */
            }
          }}
        />
      ) : null}
    </AiSurface>
  );
}

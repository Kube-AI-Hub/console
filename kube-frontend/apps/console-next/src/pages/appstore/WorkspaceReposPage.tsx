import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AiSurface, Badge, Button, Input, Modal, ResourceList, Textarea, type ListSchema } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { workspaceReposApi } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 企业空间应用仓库.
 *
 * The workspace's Helm repositories, read from openpitrix's workspace-scoped collection
 * (/kapis/openpitrix.io/v1/workspaces/<ws>/repos). A repository belongs to a workspace, which is
 * why this page lives in the workspace console and the platform store pages only manage the
 * store's own apps and categories.
 *
 * Creating one is a server-side fetch of its `index.yaml`: an unreachable URL comes back as 400
 * with the reason, so the dialog shows that reason instead of pretending the form was invalid.
 */
export interface WorkspaceReposPageProps {
  workspace: string;
}

interface RawRepo {
  repo_id?: string;
  name?: string;
  url?: string;
  status?: string;
  create_time?: string;
  /** Some openpitrix versions expose the package type on the repo; this one does not. */
  type?: string;
  repo_type?: string;
}

interface RepoRow {
  id: string;
  name: string;
  url: string;
  type: string;
  status: string;
  createdAt: string;
}

export function WorkspaceReposPage({ workspace }: WorkspaceReposPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['workspace-repos', workspace],
    queryFn: async ({ signal }): Promise<RepoRow[]> => {
      const body = await apiClient.request<{ items?: RawRepo[] }>(
        `/kapis/openpitrix.io/v1/workspaces/${encodeURIComponent(workspace)}/repos`,
        { query: { limit: -1 }, ...(signal ? { signal } : {}) },
      );
      return (body?.items ?? []).map((item) => ({
        id: item.repo_id ?? item.name ?? '',
        name: item.name ?? '',
        url: item.url ?? '',
        type: item.type ?? item.repo_type ?? '',
        status: item.status ?? '',
        createdAt: item.create_time ?? '',
      }));
    },
  });

  const [creating, setCreating] = React.useState(false);
  const [removing, setRemoving] = React.useState<RepoRow | null>(null);
  const [name, setName] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [formError, setFormError] = React.useState('');

  const create = useMutation({
    mutationFn: () => workspaceReposApi(apiClient).create({ workspace, name: name.trim(), url: url.trim(), description: description.trim() || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-repos', workspace] });
      setCreating(false);
      setName(''); setUrl(''); setDescription(''); setFormError('');
    },
  });
  const remove = useMutation({
    mutationFn: (repoId: string) => workspaceReposApi(apiClient).remove({ workspace, repoId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-repos', workspace] });
      setRemoving(null);
    },
  });

  const rows = query.data ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const listRefresh = useListRefresh('workspace-repos', query);

  const schema = React.useMemo<ListSchema<RepoRow>>(
    () => ({
      title: t('appRepos.repos.title'),
      refresh: listRefresh.refresh,
      description: t('appRepos.repos.description'),
      rowKey: 'id',
      rowAttributes: (row) => ({ 'data-ai-row': row.id }),
      primaryAction: { key: 'create', label: t('appRepos.repos.create'), aiId: 'workspace-repos:create' },
      rowActions: [
        { key: 'remove', label: t('common.delete'), aiId: 'workspace-repos:delete', tone: 'danger' as const },
      ],
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => <span className="truncate font-medium text-ai-fg">{row.name || '-'}</span>,
        },
        {
          key: 'url',
          title: t('appRepos.repos.column.url'),
          hideBelow: 'md',
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-secondary">{row.url || '-'}</span>,
        },
        {
          key: 'type',
          title: t('appRepos.repos.column.type'),
          width: 100,
          hideBelow: 'lg',
          render: (row) => <span className="text-ai-fg-secondary">{row.type || '-'}</span>,
        },
        {
          key: 'status',
          title: t('cluster.column.status'),
          width: 130,
          render: (row) => (
            <Badge tone={row.status === 'successful' || row.status === 'active' ? 'success' : 'warning'}>
              {row.status || '-'}
            </Badge>
          ),
        },
        {
          key: 'createdAt',
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{row.createdAt ? formatTimestamp(row.createdAt) : '-'}</span>,
        },
      ],
      empty: { title: t('appRepos.repos.emptyTitle'), description: t('appRepos.repos.emptyDescription') },
      labels: {
        ...listRefresh.emptyLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
    }),
    [query.isFetching, t],
  );

  const submitCreate = async () => {
    setFormError('');
    if (!name.trim() || !url.trim()) {
      setFormError(t('appRepos.repos.createRequired'));
      return;
    }
    try {
      await create.mutateAsync();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="workspace-repos:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="workspace-repos:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="workspace-repos:surface" state={state} className="min-w-0">
      {/* Literal data-ai-id on the table wrapper: the action contract scans page source. */}
      <div data-ai-id="workspace-repos:table">
        <ResourceList
          schema={schema}
          rows={rows}
          loading={query.isPending}
          onRefresh={listRefresh.onRefresh}
          onAction={(action, row) => {
            if (action === 'create') setCreating(true);
            if (action === 'remove' && row) setRemoving(row as RepoRow);
          }}
        />
      </div>

      <Modal
        open={creating}
        onOpenChange={(open) => { if (!create.isPending) setCreating(open); }}
        title={t('appRepos.repos.createTitle')}
        description={t('appRepos.repos.createDescription')}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={create.isPending} onClick={() => setCreating(false)}>{t('common.cancel')}</Button>
            <Button {...actionProps('workspace-repos:create:submit')} disabled={create.isPending} onClick={() => void submitCreate()}>
              {t('common.confirm')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ai-fg-muted">{t('cluster.column.name')}</span>
            <Input data-ai-id="workspace-repos:create:name" value={name} disabled={create.isPending} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ai-fg-muted">{t('appRepos.repos.column.url')}</span>
            <Input data-ai-id="workspace-repos:create:url" value={url} disabled={create.isPending}
              placeholder="https://charts.example.com/stable" onChange={(event) => setUrl(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ai-fg-muted">{t('projectInfo.field.description')}</span>
            <Textarea data-ai-id="workspace-repos:create:description" value={description} disabled={create.isPending} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <MutationAlert error={create.error} />
          {formError ? <p role="alert" data-ai-id="workspace-repos:create:error" className="text-sm text-ai-danger">{formError}</p> : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(removing)}
        onOpenChange={(open) => { if (!remove.isPending && !open) setRemoving(null); }}
        title={t('appRepos.repos.removeTitle')}
        description={removing ? t('appRepos.repos.removeDescription', { name: removing.name }) : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={remove.isPending} onClick={() => setRemoving(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" {...actionProps('workspace-repos:delete:confirm')} disabled={remove.isPending}
              onClick={() => { if (removing) void remove.mutateAsync(removing.id).catch(() => undefined); }}>
              {t('common.delete')}
            </Button>
          </div>
        }
      >
        <MutationAlert error={remove.error} />
        {remove.error ? <p role="alert" data-ai-id="workspace-repos:delete:error" className="text-sm text-ai-danger">{t('appRepos.repos.removeFailed')}</p> : null}
      </Modal>
    </AiSurface>
  );
}

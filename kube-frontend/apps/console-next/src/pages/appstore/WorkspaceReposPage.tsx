import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { accessReviewApi, workspaceReposApi, type WorkspaceRepo } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Input, Modal, ResourceList, Select, Textarea, type ListSchema } from '@kube-ai-hub/ui';
import { useColumnVisibility } from '@/components/resource/useColumnVisibility';
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
 * The write surface mirrors the old console's 仓库 list: add, edit, delete, and 同步索引. Creating
 * or saving is a server-side fetch of the repository's `index.yaml`: an unreachable URL comes back
 * as 400 with the reason, so the dialog shows that reason instead of pretending the form was
 * invalid. The index sync itself is asynchronous — `action: index` only starts it — so the page
 * refetches the row and lets the status say whether it worked.
 *
 * `repo_id` (not the display name) is the id every write takes. The object behind the row is a
 * cluster-scoped HelmRepo in application.kubesphere.io/v1alpha1 that is associated to the
 * workspace by a label, which is why the permission probe asks about `helmrepos` and not about
 * anything namespaced.
 */
export interface WorkspaceReposPageProps {
  workspace: string;
}

const SYNC_PERIOD_PATTERN = /^(\d+)(s|m|h)$/;
const PROTOCOLS = [
  { value: 'https', label: 'https://' },
  { value: 'http', label: 'http://' },
  { value: 's3', label: 's3://' },
];

/** Split `https://host/path` into the protocol select's value and the rest. */
function splitUrl(url: string): { protocol: string; rest: string } {
  const match = /^([a-z0-9]+):\/\/([\s\S]*)$/i.exec(url);
  if (!match) return { protocol: 'https', rest: url };
  return { protocol: (match[1] ?? 'https').toLowerCase(), rest: match[2] ?? '' };
}

/** `3600s` → 3600; returns null for anything the server would reject. */
function syncPeriodSeconds(value: string): number | null {
  const match = SYNC_PERIOD_PATTERN.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(amount)) return null;
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 3600;
  return amount;
}

interface RepoForm {
  name: string;
  protocol: string;
  url: string;
  syncPeriod: string;
  description: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function emptyForm(): RepoForm {
  return { name: '', protocol: 'https', url: '', syncPeriod: '0s', description: '', accessKeyId: '', secretAccessKey: '' };
}

function formFromRepo(repo: WorkspaceRepo): RepoForm {
  const { protocol, rest } = splitUrl(repo.url);
  let accessKeyId = '';
  let secretAccessKey = '';
  try {
    const parsed = JSON.parse(repo.credential || '{}') as { accessKeyID?: string; secretAccessKey?: string };
    accessKeyId = parsed.accessKeyID ?? '';
    secretAccessKey = parsed.secretAccessKey ?? '';
  } catch {
    // A malformed credential blob is not worth failing the dialog over: the fields stay empty
    // and saving without touching them keeps the stored value (the PATCH only sends what changed).
  }
  return {
    name: repo.name,
    protocol,
    url: rest,
    syncPeriod: repo.syncPeriod || '0s',
    description: repo.description,
    accessKeyId,
    secretAccessKey,
  };
}

export function WorkspaceReposPage({ workspace }: WorkspaceReposPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = React.useState('');
  const [editing, setEditing] = React.useState<WorkspaceRepo | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [removing, setRemoving] = React.useState<WorkspaceRepo | null>(null);
  const [form, setForm] = React.useState<RepoForm>(emptyForm());
  const [formError, setFormError] = React.useState('');
  const [syncError, setSyncError] = React.useState('');

  const query = useQuery({
    queryKey: ['workspace-repos', workspace],
    queryFn: ({ signal }) => workspaceReposApi(apiClient).list({ workspace, signal }),
  });

  /*
   * Whether this reader may manage repositories at all.
   *
   * The old console gated the whole region on `app-repos`. The equivalent question here is the
   * authorization API's: may this identity create HelmRepos? It fails **open** — a broken
   * permission probe must not hide controls the reader is allowed to use — so only an explicit
   * `false` hides the writes, and the page then says why instead of showing buttons that 403.
   */
  const canWrite = useQuery({
    queryKey: ['workspace-repos-can-write'],
    staleTime: 60_000,
    retry: false,
    queryFn: ({ signal }) => accessReviewApi(apiClient).allowed({ verb: 'create', resource: 'helmrepos', group: 'application.kubesphere.io', signal }),
  });
  const writeBlocked = canWrite.data === false;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['workspace-repos', workspace] });

  const save = useMutation({
    mutationFn: async (payload: { repo: WorkspaceRepo | null; values: RepoForm }) => {
      /*
       * Accept both "charts.example.com/stable" and a full "https://charts.example.com/stable".
       *
       * The protocol select only exists to save typing; prepending it to a value that already
       * carries a scheme produced "https://https://…" and the server answered 400 with the
       * index.yaml fetch error, which read like a broken repository instead of a form quirk.
       */
      const raw = payload.values.url.trim();
      const hasScheme = /^[a-z0-9]+:\/\//i.test(raw);
      const url = hasScheme ? raw : `${payload.values.protocol}://${raw}`;
      const credential =
        payload.values.protocol === 's3'
          ? JSON.stringify({ accessKeyID: payload.values.accessKeyId, secretAccessKey: payload.values.secretAccessKey })
          : undefined;
      if (payload.repo) {
        await workspaceReposApi(apiClient).update({
          workspace,
          repoId: payload.repo.id,
          name: payload.values.name.trim(),
          url,
          description: payload.values.description.trim(),
          syncPeriod: payload.values.syncPeriod.trim(),
          ...(credential ? { credential } : {}),
        });
        return;
      }
      await workspaceReposApi(apiClient).create({
        workspace,
        name: payload.values.name.trim(),
        url,
        description: payload.values.description.trim() || undefined,
        syncPeriod: payload.values.syncPeriod.trim(),
        ...(credential ? { credential } : {}),
      });
    },
    onSuccess: async () => {
      await invalidate();
      setCreating(false);
      setEditing(null);
      setForm(emptyForm());
      setFormError('');
    },
  });

  const remove = useMutation({
    mutationFn: (repoId: string) => workspaceReposApi(apiClient).remove({ workspace, repoId }),
    onSuccess: async () => {
      await invalidate();
      setRemoving(null);
    },
  });

  const sync = useMutation({
    mutationFn: (repoId: string) => workspaceReposApi(apiClient).index({ workspace, repoId }),
    onSuccess: async () => {
      // The sync runs in the controller; re-reading now shows the in-flight status and the
      // reader can refresh again rather than being told a lie about completion.
      await invalidate();
      setSyncError('');
    },
    onError: (cause) => {
      setSyncError(cause instanceof Error ? cause.message : String(cause));
    },
  });

  const openCreate = () => {
    setForm(emptyForm());
    setFormError('');
    save.reset();
    setCreating(true);
  };

  const openEdit = (repo: WorkspaceRepo) => {
    setForm(formFromRepo(repo));
    setFormError('');
    save.reset();
    setEditing(repo);
  };

  const submitForm = async () => {
    setFormError('');
    if (!form.name.trim()) {
      setFormError(t('appRepos.repos.createRequired'));
      return;
    }
    if (!form.url.trim()) {
      setFormError(t('appRepos.repos.urlRequired'));
      return;
    }
    const seconds = syncPeriodSeconds(form.syncPeriod);
    if (seconds === null || (seconds !== 0 && (seconds < 180 || seconds > 86400))) {
      setFormError(t('appRepos.repos.field.syncPeriodInvalid'));
      return;
    }
    try {
      await save.mutateAsync({ repo: editing, values: form });
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const rows = query.data?.items ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const listRefresh = useListRefresh('workspace-repos', query);
  const needle = keyword.trim().toLowerCase();
  const visibleRows = needle ? rows.filter((row) => row.name.toLowerCase().includes(needle)) : rows;

  const schema = React.useMemo<ListSchema<WorkspaceRepo>>(
    () => ({
      title: t('appRepos.repos.title'),
      refresh: listRefresh.refresh,
      description: t('appRepos.repos.description'),
      rowKey: 'id',
      rowAttributes: (row) => ({ 'data-ai-row': row.id }),
      primaryAction: {
        key: 'create',
        label: t('appRepos.repos.create'),
        aiId: 'workspace-repos:create',
        disabled: writeBlocked,
        ...(writeBlocked ? { disabledHint: t('appRepos.repos.noPermission') } : {}),
      },
      search: { placeholder: t('appRepos.repos.searchPlaceholder'), aiId: 'workspace-repos:search' },
      rowActions: [
        {
          key: 'edit',
          label: t('appRepos.repos.edit'),
          aiId: 'workspace-repos:edit',
          visible: () => !writeBlocked,
        },
        {
          key: 'index',
          label: t('appRepos.repos.index'),
          aiId: 'workspace-repos:index',
          visible: () => !writeBlocked,
        },
        { key: 'remove', label: t('common.delete'), aiId: 'workspace-repos:delete', tone: 'danger' as const, visible: () => !writeBlocked },
      ],
      columnVisibility: { label: t('node.list.columns'), resetLabel: t('node.list.resetColumns'), aiId: 'workspace-repos:columns' },
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          /* Pinned: the row's identity, kept in place while the other columns scroll. */
          width: 220,
          pin: 'start',
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <Link
                to="/kube-frontend/workspaces/$workspace/repos/$repoId"
                params={{ workspace, repoId: row.id }}
                className="truncate font-medium text-ai-link hover:underline"
                data-ai-id={`workspace-repos:name:${row.id}`}
              >
                {row.name || '-'}
              </Link>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.description || '-'}</span>
            </span>
          ),
        },
        {
          key: 'url',
          hideable: true,
          title: t('appRepos.repos.column.url'),
          hideBelow: 'md',
          render: (row) => <span className="truncate font-mono text-[11px] text-ai-fg-secondary">{row.url || '-'}</span>,
        },
        {
          key: 'type',
          hideable: true,
          title: t('appRepos.repos.column.type'),
          width: 100,
          hideBelow: 'lg',
          render: (row) => <span className="text-ai-fg-secondary">{row.credential && row.credential !== '{}' ? 's3' : '-'}</span>,
        },
        {
          key: 'status',
          hideable: true,
          title: t('cluster.column.status'),
          width: 130,
          render: (row) => (
            <Badge tone={row.status === 'successful' || row.status === 'active' ? 'success' : 'warning'}>
              {row.status || '-'}
            </Badge>
          ),
        },
        {
          key: 'creator',
          hideable: true,
          title: t('appRepos.repos.column.creator'),
          width: 140,
          hideBelow: 'xl',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.creator || '-'}</span>,
        },
        {
          key: 'createdAt',
          hideable: true,
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{row.createdAt ? formatTimestamp(row.createdAt) : '-'}</span>,
        },
      ],
      empty: { title: t('appRepos.repos.emptyTitle'), description: t('appRepos.repos.emptyDescription') },
      labels: {
        ...listRefresh.emptyLabels, ...listRefresh.filterLabels,
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
    }),
    [query.isFetching, t, writeBlocked, listRefresh, workspace],
  );

  const columnKeys = React.useMemo(() => schema.columns.map((column) => column.key), [schema]);
  const columnVisibility = useColumnVisibility('workspace-repos', columnKeys);

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="workspace-repos:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="workspace-repos:retry" />
      </AiSurface>
    );
  }

  const dialogOpen = creating || Boolean(editing);

  return (
    <AiSurface as="section" aiId="workspace-repos:surface" state={state} className="min-w-0">
      {/* Literal data-ai-id on the table wrapper: the action contract scans page source. */}
      <div data-ai-id="workspace-repos:table">
        <ResourceList
        {...(columnVisibility.visibleColumnKeys ? { visibleColumnKeys: columnVisibility.visibleColumnKeys } : {})}
        onVisibleColumnsChange={columnVisibility.setVisibleColumnKeys}
          schema={schema}
          rows={visibleRows}
          loading={query.isPending} refreshing={query.isFetching && !query.isPending}
          searchValue={keyword}
          onSearchChange={(value) => setKeyword(value)}
          onRefresh={listRefresh.onRefresh}
          onAction={(action, row) => {
            if (action === 'create') openCreate();
            if (action === 'edit' && row) openEdit(row as WorkspaceRepo);
            if (action === 'index' && row) sync.mutate((row as WorkspaceRepo).id);
            if (action === 'remove' && row) {
              remove.reset();
              setRemoving(row as WorkspaceRepo);
            }
          }}
        />
      </div>

      {syncError ? (
        <p role="alert" data-ai-id="workspace-repos:index-error" className="mt-2 text-xs text-ai-danger">
          {t('appRepos.repos.indexFailed', { reason: syncError })}
        </p>
      ) : null}

      <Modal
        open={dialogOpen}
        onOpenChange={(open) => {
          if (save.isPending) return;
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        title={editing ? t('appRepos.repos.editTitle') : t('appRepos.repos.createTitle')}
        description={editing ? t('appRepos.repos.editDescription') : t('appRepos.repos.createDescription')}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              disabled={save.isPending}
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button {...actionProps('workspace-repos:create:submit')} disabled={save.isPending} onClick={() => void submitForm()}>
              {t('common.confirm')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ai-fg-muted">{t('cluster.column.name')}</span>
            <Input
              data-ai-id="workspace-repos:create:name"
              value={form.name}
              disabled={save.isPending}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-ai-fg-muted">{t('appRepos.repos.field.url')}</span>
            <div className="flex items-start gap-2">
              <Select
                value={form.protocol}
                options={PROTOCOLS}
                data-ai-id="workspace-repos:create:protocol"
                onValueChange={(value) => setForm((current) => ({ ...current, protocol: value }))}
              />
              <Input
                data-ai-id="workspace-repos:create:url"
                value={form.url}
                disabled={save.isPending}
                placeholder="charts.example.com/stable"
                onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
              />
            </div>
            <span className="text-[11px] text-ai-fg-muted">{t('appRepos.repos.field.urlHint')}</span>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ai-fg-muted">{t('appRepos.repos.field.syncPeriod')}</span>
            <Input
              data-ai-id="workspace-repos:create:sync-period"
              value={form.syncPeriod}
              disabled={save.isPending}
              onChange={(event) => setForm((current) => ({ ...current, syncPeriod: event.target.value }))}
            />
            <span className="text-[11px] text-ai-fg-muted">{t('appRepos.repos.field.syncPeriodHint')}</span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ai-fg-muted">{t('appRepos.repos.column.description')}</span>
            <Textarea
              data-ai-id="workspace-repos:create:description"
              value={form.description}
              disabled={save.isPending}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
          {form.protocol === 's3' ? (
            <div className="flex flex-col gap-2 rounded-ai-md border border-ai-line p-3">
              <span className="text-xs text-ai-fg-muted">{t('appRepos.repos.field.credentialHint')}</span>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ai-fg-muted">{t('appRepos.repos.field.accessKeyId')}</span>
                <Input
                  data-ai-id="workspace-repos:create:access-key-id"
                  value={form.accessKeyId}
                  disabled={save.isPending}
                  onChange={(event) => setForm((current) => ({ ...current, accessKeyId: event.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ai-fg-muted">{t('appRepos.repos.field.secretAccessKey')}</span>
                <Input
                  type="password"
                  data-ai-id="workspace-repos:create:secret-access-key"
                  value={form.secretAccessKey}
                  disabled={save.isPending}
                  onChange={(event) => setForm((current) => ({ ...current, secretAccessKey: event.target.value }))}
                />
              </label>
            </div>
          ) : null}
          <MutationAlert error={save.error} />
          {formError ? (
            <p role="alert" data-ai-id="workspace-repos:create:error" className="text-sm text-ai-danger">
              {formError}
            </p>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!remove.isPending && !open) setRemoving(null);
        }}
        title={t('appRepos.repos.removeTitle')}
        description={removing ? t('appRepos.repos.removeDescription', { name: removing.name }) : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={remove.isPending} onClick={() => setRemoving(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              {...actionProps('workspace-repos:delete:confirm')}
              disabled={remove.isPending}
              onClick={() => {
                if (removing) void remove.mutateAsync(removing.id).catch(() => undefined);
              }}
            >
              {t('common.delete')}
            </Button>
          </div>
        }
      >
        <MutationAlert error={remove.error} />
        {remove.error ? (
          <p role="alert" data-ai-id="workspace-repos:delete:error" className="text-sm text-ai-danger">
            {t('appRepos.repos.removeFailed')}
          </p>
        ) : null}
      </Modal>
    </AiSurface>
  );
}

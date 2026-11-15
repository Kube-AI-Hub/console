import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { accessReviewApi, appTemplatesApi, type AppTemplate } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Input, Modal, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { useListRefresh } from '@/components/resource/useListRefresh';

/**
 * 企业空间应用（模板）.
 *
 * The workspace's own app templates — the old console's `APP_TEMPLATE` list at `/:workspace/apps`.
 * A template is created by uploading a Helm chart; its versions then go through the review state
 * machine (draft → submitted → passed → active) before they can be released into the store.
 *
 * Columns follow the old list (名称 / 状态 / 最新版本 / 更新时间) and keep the 版本类型 column the
 * earlier migration added, because the package type is a real field (`app_version_types`) that
 * the detail page needs to name. The old list's name cell carried the description underneath,
 * which is kept.
 *
 * Uploading is the one write here: the chart package is sent base64 to `?validate=true` first, so
 * the dialog can show the parsed template name and version before anything is created; the create
 * call then sends the same package with the chosen name. A chart the server cannot parse comes
 * back as its own message rather than a fabricated success.
 */
export interface WorkspaceAppsPageProps {
  workspace: string;
}

const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export function WorkspaceAppsPage({ workspace }: WorkspaceAppsPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = React.useState(false);
  const [name, setName] = React.useState('');
  const [packageBase64, setPackageBase64] = React.useState('');
  const [fileName, setFileName] = React.useState('');
  const [parsed, setParsed] = React.useState<{ name: string; versionName: string } | null>(null);
  const [formError, setFormError] = React.useState('');

  const query = useQuery({
    queryKey: ['workspace-app-templates', workspace],
    queryFn: ({ signal }) => appTemplatesApi(apiClient).list({ workspace, signal }),
  });

  const canWrite = useQuery({
    queryKey: ['workspace-app-templates-can-write'],
    staleTime: 60_000,
    retry: false,
    queryFn: ({ signal }) => accessReviewApi(apiClient).allowed({ verb: 'create', resource: 'helmapplications', group: 'application.kubesphere.io', signal }),
  });
  const writeBlocked = canWrite.data === false;

  const create = useMutation({
    mutationFn: async (payload: { name: string; packageBase64: string }) => {
      const validated = await appTemplatesApi(apiClient).validatePackage({ workspace, packageBase64: payload.packageBase64 });
      setParsed({ name: validated.name, versionName: validated.versionName });
      return appTemplatesApi(apiClient).create({
        workspace,
        name: payload.name,
        packageBase64: payload.packageBase64,
        description: validated.description || undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace-app-templates', workspace] });
      setUploading(false);
      setName('');
      setPackageBase64('');
      setFileName('');
      setParsed(null);
      setFormError('');
    },
  });

  const rows = query.data?.items ?? [];
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const listRefresh = useListRefresh('workspace-apps', query);

  const schema = React.useMemo<ListSchema<AppTemplate>>(
    () => ({
      title: t('appRepos.apps.title'),
      refresh: listRefresh.refresh,
      description: t('appRepos.apps.description'),
      rowKey: 'id',
      rowAttributes: (row) => ({ 'data-ai-row': row.id }),
      primaryAction: {
        key: 'create',
        label: t('appRepos.apps.create'),
        aiId: 'workspace-apps:create',
        disabled: writeBlocked,
        ...(writeBlocked ? { disabledHint: t('appRepos.repos.noPermission') } : {}),
      },
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <Link
                to="/kube-frontend/workspaces/$workspace/apps/$appId"
                params={{ workspace, appId: row.id }}
                className="truncate font-medium text-ai-accent hover:underline"
                data-ai-id={`workspace-apps:name:${row.id}`}
              >
                {row.name || row.id}
              </Link>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.description || '-'}</span>
            </span>
          ),
        },
        {
          key: 'status',
          title: t('cluster.column.status'),
          width: 120,
          render: (row) => (
            <Badge tone={row.status === 'active' ? 'success' : row.status === 'draft' ? 'neutral' : 'warning'}>{row.status || '-'}</Badge>
          ),
        },
        {
          key: 'latestVersionName',
          title: t('appRepos.apps.column.latestVersion'),
          width: 170,
          hideBelow: 'md',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.latestVersionName || '-'}</span>,
        },
        {
          key: 'versionTypes',
          title: t('appRepos.apps.column.versionType'),
          width: 130,
          hideBelow: 'lg',
          render: (row) => <span className="text-ai-fg-secondary">{row.versionTypes || '-'}</span>,
        },
        {
          key: 'updatedAt',
          title: t('appRepos.apps.column.updateTime'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{row.updatedAt ? formatTimestamp(row.updatedAt) : '-'}</span>,
        },
        {
          key: 'createdAt',
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'xl',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{row.createdAt ? formatTimestamp(row.createdAt) : '-'}</span>,
        },
      ],
      empty: { title: t('appRepos.apps.emptyTitle'), description: t('appRepos.apps.emptyDescription') },
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
    [query.isFetching, t, listRefresh, workspace, writeBlocked],
  );

  const submitUpload = async () => {
    setFormError('');
    if (!name.trim()) {
      setFormError(t('appRepos.repos.createRequired'));
      return;
    }
    if (!packageBase64) {
      setFormError(t('appRepos.apps.createFileHint'));
      return;
    }
    try {
      await create.mutateAsync({ name: name.trim(), packageBase64 });
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="workspace-apps:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="workspace-apps:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="workspace-apps:surface" state={state} className="min-w-0">
      {/* Literal data-ai-id on the table wrapper: the action contract scans page source, and
          AiSurface's aiId prop is not a literal attribute in this file. */}
      <div data-ai-id="workspace-apps:table">
        <ResourceList
          schema={schema}
          rows={rows}
          loading={query.isPending}
          onRefresh={listRefresh.onRefresh}
          onAction={(action) => {
            if (action === 'create') {
              create.reset();
              setFormError('');
              setParsed(null);
              setUploading(true);
            }
          }}
        />
      </div>

      <Modal
        open={uploading}
        onOpenChange={(open) => {
          if (!create.isPending) setUploading(open);
        }}
        title={t('appRepos.apps.createTitle')}
        description={t('appRepos.apps.createDescription')}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={create.isPending} onClick={() => setUploading(false)}>
              {t('common.cancel')}
            </Button>
            <Button {...actionProps('workspace-apps:create:submit')} disabled={create.isPending} onClick={() => void submitUpload()}>
              {t('common.confirm')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ai-fg-muted">{t('appRepos.apps.createName')}</span>
            <Input
              data-ai-id="workspace-apps:create:name"
              value={name}
              disabled={create.isPending}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ai-fg-muted">{t('appRepos.apps.createFile')}</span>
            <input
              type="file"
              accept=".tgz,.tar.gz,application/gzip"
              data-ai-id="workspace-apps:create:file"
              disabled={create.isPending}
              className="text-xs text-ai-fg-secondary"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setParsed(null);
                setFormError('');
                if (!file) {
                  setPackageBase64('');
                  setFileName('');
                  return;
                }
                if (!/\.(tgz|tar\.gz)$/i.test(file.name)) {
                  setFormError(t('appRepos.apps.createFileHint'));
                  setPackageBase64('');
                  return;
                }
                if (file.size > MAX_PACKAGE_BYTES) {
                  setFormError(t('appRepos.apps.createFileHint'));
                  setPackageBase64('');
                  return;
                }
                setFileName(file.name);
                void readAsBase64(file)
                  .then((base64) => setPackageBase64(base64))
                  .catch(() => setFormError(t('appRepos.apps.createFailed')));
              }}
            />
            <span className="text-[11px] text-ai-fg-muted">{fileName || t('appRepos.apps.createFileHint')}</span>
          </label>
          {parsed ? (
            <p className="text-[11px] text-ai-fg-muted" data-ai-id="workspace-apps:create:parsed">
              {t('appRepos.apps.createValidated', { name: parsed.name, version: parsed.versionName })}
            </p>
          ) : null}
          <MutationAlert error={create.error} />
          {formError ? (
            <p role="alert" data-ai-id="workspace-apps:create:error" className="text-sm text-ai-danger">
              {formError}
            </p>
          ) : null}
        </div>
      </Modal>
    </AiSurface>
  );
}

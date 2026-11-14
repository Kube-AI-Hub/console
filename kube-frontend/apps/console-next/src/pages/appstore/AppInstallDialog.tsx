import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  storeWorkspacesApi,
  storeWorkspaceProjectsApi,
  workspaceApplicationsApi,
  type StoreAppVersion,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Button, Input, Modal, Select } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage } from '@/components/resource/ResourceErrorPanel';

/**
 * 从商店安装应用 — workspace → project → version → release name.
 *
 * Installing is a project operation, not a workspace one: the openpitrix handler creates a
 * HelmRelease in a namespace and has no workspace-level create route. The dialog therefore
 * asks for the workspace first (it narrows the project list) and then the project it installs
 * into. The release name is checked against the project's existing releases before the write,
 * because the server's own duplicate answer arrives as an opaque 500.
 *
 * The request is asynchronous beyond creation: a 200 means the release object exists, not that
 * the chart is healthy. The success panel says 'submitted' for that reason.
 */
export interface AppInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
  appName: string;
  versions: StoreAppVersion[];
  defaultVersionId?: string | undefined;
}

const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const NAME_MAX = 32;

function defaultName(appName: string): string {
  const slug = (appName || 'app')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);
  return `${slug || 'app'}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AppInstallDialog({
  open,
  onOpenChange,
  appId,
  appName,
  versions,
  defaultVersionId,
}: AppInstallDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [workspace, setWorkspace] = React.useState('');
  const [project, setProject] = React.useState('');
  const [versionId, setVersionId] = React.useState('');
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [installed, setInstalled] = React.useState<{ name: string; workspace: string } | null>(null);

  const workspaces = useQuery({
    enabled: open,
    queryKey: ['store-install-workspaces'],
    queryFn: ({ signal }) => storeWorkspacesApi(apiClient).list({ signal }),
  });

  const projects = useQuery({
    enabled: open && Boolean(workspace),
    queryKey: ['store-install-projects', workspace],
    queryFn: ({ signal }) => storeWorkspaceProjectsApi(apiClient).list({ workspace, signal }),
  });

  const applications = useQuery({
    enabled: open && Boolean(workspace) && Boolean(project),
    queryKey: ['store-install-applications', workspace, project],
    queryFn: ({ signal }) => workspaceApplicationsApi(apiClient).list({ workspace, namespace: project, signal }),
  });

  React.useEffect(() => {
    if (!open) return;
    setWorkspace('');
    setProject('');
    setVersionId(defaultVersionId ?? versions[0]?.id ?? '');
    setName(defaultName(appName));
    setError(null);
    setInstalled(null);
    // Reset once per open; appName/versions are stable while the dialog is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!workspace) {
      const first = workspaces.data?.[0]?.name;
      if (first) setWorkspace(first);
    }
  }, [workspaces.data, workspace]);

  React.useEffect(() => {
    if (!project) {
      const first = projects.data?.[0]?.name;
      if (first) setProject(first);
    }
  }, [projects.data, project]);

  const create = useMutation({
    mutationFn: () =>
      workspaceApplicationsApi(apiClient).create({
        workspace,
        namespace: project,
        appId,
        versionId,
        name: name.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['store-install-applications', workspace, project] });
      setInstalled({ name: name.trim(), workspace });
    },
  });

  const submit = (): void => {
    const trimmed = name.trim();
    if (!NAME_PATTERN.test(trimmed) || trimmed.length > NAME_MAX) {
      setError(t('store.detail.install.error.name'));
      return;
    }
    if (!project) {
      setError(t('store.detail.install.error.project'));
      return;
    }
    if (!versionId) {
      setError(t('store.detail.install.error.version'));
      return;
    }
    if ((applications.data ?? []).some((application) => application.releaseName === trimmed)) {
      setError(t('store.detail.install.error.duplicate'));
      return;
    }
    setError(null);
    create.mutate();
  };

  const workspaceOptions = (workspaces.data ?? []).map((item) => ({
    value: item.name,
    label: item.alias ? `${item.alias} (${item.name})` : item.name,
  }));
  const projectOptions = (projects.data ?? []).map((item) => ({
    value: item.name,
    label: item.alias ? `${item.alias} (${item.name})` : item.name,
  }));
  const versionOptions = versions.map((version) => ({
    value: version.id,
    label: version.name || version.id,
  }));

  const serverError = create.error ? errorMessage(t, create.error) : null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('store.detail.install.title')}
      description={t('store.detail.install.description')}
      footer={
        <div className="flex items-center justify-end gap-2">
          {installed ? (
            <Button variant="secondary" {...actionProps('app-detail:install-close')} onClick={() => onOpenChange(false)}>
              {t('common.close')}
            </Button>
          ) : (
            <>
              <Button variant="secondary" {...actionProps('app-detail:install-cancel')} onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                loading={create.isPending}
                {...actionProps('app-detail:install-submit')}
                onClick={submit}
              >
                {t('common.confirm')}
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-ai-id="app-detail:install-dialog">
        {installed ? (
          <div className="flex flex-col gap-2" data-ai-id="app-detail:install-success">
            <p className="text-sm text-ai-fg">{t('store.detail.install.success', { name: installed.name })}</p>
            <p className="text-[11px] text-ai-fg-muted">{t('store.detail.install.successHint')}</p>
            <Link
              to="/kube-frontend/workspaces/$workspace/apps"
              params={{ workspace: installed.workspace }}
              className="text-sm text-ai-accent hover:underline"
              data-ai-id="app-detail:install-success-link"
              onClick={() => onOpenChange(false)}
            >
              {t('store.detail.install.viewApps')}
            </Link>
          </div>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-install-workspace">
              {t('store.detail.install.workspace')}
              <Select
                id="ai-field-install-workspace"
                value={workspace}
                options={workspaceOptions}
                placeholder={t('store.detail.install.workspace')}
                data-ai-id="app-detail:install-workspace"
                onValueChange={(value) => {
                  setWorkspace(value);
                  setProject('');
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-install-project">
              {t('store.detail.install.project')}
              <Select
                id="ai-field-install-project"
                value={project}
                options={projectOptions}
                placeholder={
                  projects.isPending
                    ? t('common.loading')
                    : projectOptions.length === 0
                      ? t('store.detail.install.noProjects')
                      : t('store.detail.install.project')
                }
                disabled={projectOptions.length === 0}
                data-ai-id="app-detail:install-project"
                onValueChange={setProject}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-install-version">
              {t('store.detail.install.version')}
              <Select
                id="ai-field-install-version"
                value={versionId}
                options={versionOptions}
                placeholder={versionOptions.length === 0 ? t('store.detail.install.noVersions') : t('store.detail.install.version')}
                disabled={versionOptions.length === 0}
                data-ai-id="app-detail:install-version"
                onValueChange={setVersionId}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-install-name">
              {t('store.detail.install.name')}
              <Input
                id="ai-field-install-name"
                value={name}
                maxLength={NAME_MAX}
                data-ai-id="app-detail:install-name"
                onChange={(event) => setName(event.target.value)}
              />
              <span className="text-[11px] text-ai-fg-muted">{t('store.detail.install.nameHint')}</span>
            </label>
            {error ?? serverError ? (
              <p className="text-xs text-ai-danger" data-ai-id="app-detail:install-error">
                {error ?? serverError}
              </p>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}

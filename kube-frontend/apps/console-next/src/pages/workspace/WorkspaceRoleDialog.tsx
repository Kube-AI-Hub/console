import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Input, Modal, Skeleton, Textarea } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { workspaceRolesApi, type WorkspaceRoleDetail } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage } from '@/components/resource/ResourceErrorPanel';

/**
 * 企业空间角色：创建 / 编辑权限.
 *
 * A custom workspace role is a set of template names, not hand-written rules: the platform
 * aggregates them server-side through the iam.kubesphere.io/aggregation-roles annotation.
 * The dialog therefore offers the workspace templates as checkboxes; writing rules here
 * would diverge from the built-in roles and stop tracking template updates.
 */
export interface WorkspaceRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'permissions';
  workspace: string;
  /** Required for permissions; undefined for create. */
  role?: WorkspaceRoleDetail;
  pending?: boolean;
  error?: unknown;
  onSubmit: (input: { name: string; alias: string; description: string; templates: string[] }) => void | Promise<void>;
}

const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export function WorkspaceRoleDialog({
  open,
  onOpenChange,
  mode,
  workspace,
  role,
  pending = false,
  error,
  onSubmit,
}: WorkspaceRoleDialogProps): React.ReactElement {
  const t = useT();
  const [name, setName] = React.useState('');
  const [alias, setAlias] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selected, setSelected] = React.useState<string[]>([]);
  const [validation, setValidation] = React.useState<string | null>(null);

  const templates = useQuery({
    queryKey: ['workspace-role-templates', workspace],
    queryFn: ({ signal }) => workspaceRolesApi(apiClient).templates({ workspace, signal }),
    enabled: open,
    staleTime: 60_000,
  });

  React.useEffect(() => {
    if (!open) return;
    setName('');
    setAlias(role?.alias ?? '');
    setDescription(role?.description ?? '');
    setSelected(role?.aggregationRoles ?? []);
    setValidation(null);
  }, [open, role]);

  const toggle = (template: string): void => {
    setSelected((current) => (current.includes(template) ? current.filter((item) => item !== template) : [...current, template]));
  };

  const submit = (): void => {
    const trimmed = name.trim();
    if (mode === 'create' && !NAME_PATTERN.test(trimmed)) return setValidation(t('workspace.roles.error.name'));
    if (selected.length === 0) return setValidation(t('workspace.roles.error.templates'));
    setValidation(null);
    void onSubmit({ name: trimmed, alias: alias.trim(), description: description.trim(), templates: selected });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={mode === 'create' ? t('workspace.roles.create') : t('settings.roles.permissions')}
      description={mode === 'create' ? t('workspace.roles.createDescription') : role?.name}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" loading={pending} {...actionProps('workspace-roles:submit')} onClick={submit}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-ai-id="workspace-roles:dialog">
        {mode === 'create' ? (
          <>
            <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
              {t('workspace.field.name')}
              <Input value={name} placeholder="developer" {...actionProps('workspace-roles:name')} onChange={(event) => setName(event.target.value)} />
              <span className="text-[11px] text-ai-fg-muted">{t('workspace.userGroups.nameHint')}</span>
            </label>
            <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
              {t('workspace.field.alias')}
              <Input value={alias} {...actionProps('workspace-roles:alias')} onChange={(event) => setAlias(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
              {t('settings.roles.fieldDescription')}
              <Textarea value={description} rows={2} {...actionProps('workspace-roles:description')} onChange={(event) => setDescription(event.target.value)} />
            </label>
          </>
        ) : null}

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-ai-fg">{t('workspace.roles.templates')}</span>
          <span className="text-[11px] text-ai-fg-muted">{t('workspace.roles.templatesHint')}</span>
          {templates.isPending ? <Skeleton className="h-40 w-full" /> : null}
          {templates.isError ? (
            <p className="text-xs text-ai-danger" role="alert">
              {errorMessage(t, templates.error)}
            </p>
          ) : null}
          {templates.data ? (
            <div className="max-h-72 overflow-y-auto rounded-ai-md border border-ai-line p-2" data-ai-id="workspace-roles:templates">
              {templates.data.map((template) => (
                <label key={template.name} className="flex items-start gap-2 rounded-ai-sm px-1 py-1.5 text-xs text-ai-fg-secondary hover:bg-ai-surface-2">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selected.includes(template.name)}
                    data-ai-id={'workspace-roles:template:' + template.name}
                    onChange={() => toggle(template.name)}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-ai-fg">{template.alias || template.name}</span>
                    <span className="truncate font-mono text-[10px] text-ai-fg-muted">
                      {template.name} · {t('settings.roles.rules')} {template.ruleCount}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}
        </div>

        {validation ? (
          <p className="text-xs text-ai-danger" role="alert" data-ai-id="workspace-roles:error">
            {validation}
          </p>
        ) : null}
        {error ? (
          <p className="text-xs text-ai-danger" role="alert">
            {errorMessage(t, error)}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

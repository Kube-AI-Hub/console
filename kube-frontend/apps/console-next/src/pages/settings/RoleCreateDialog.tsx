import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectRolesWriteApi, rolesApi, type RoleSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Button, Input, Modal, Select, Textarea } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage } from '@/components/resource/ResourceErrorPanel';

/**
 * 创建项目角色 — copy a template's rules into a new role.
 *
 * A project role is not written from scratch: the platform ships `role-template-*` roles and
 * the old console's create dialog asks which one to start from. The template's rules are
 * fetched and written with the new role, so the result is immediately usable.
 *
 * The create goes to the native RBAC group (see `createRole`): through the IAM aggregate the
 * object is created but its `rules` come back null.
 */
export interface RoleCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: string;
  namespace: string;
}

const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export function RoleCreateDialog({ open, onOpenChange, cluster, namespace }: RoleCreateDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [name, setName] = React.useState('');
  const [alias, setAlias] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [template, setTemplate] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const roles = useQuery({
    enabled: open,
    queryKey: ['settings', 'templates', cluster, namespace],
    queryFn: ({ signal }) => rolesApi(apiClient).list({ cluster, namespace, page: 1, pageSize: 200, signal }),
  });

  React.useEffect(() => {
    if (!open) return;
    setName('');
    setAlias('');
    setDescription('');
    setTemplate('');
    setError(null);
  }, [open]);

  const templates = (roles.data?.items ?? []).filter((role: RoleSummary) => role.system);
  const options = templates.map((role) => ({
    value: role.name,
    label: `${role.alias || role.name} (${role.ruleCount})`,
  }));

  const create = useMutation({
    mutationFn: async () => {
      const write = projectRolesWriteApi(apiClient);
      const templateRules = await write.rules({ namespace, name: template });
      const rules = templateRules
        .map((rule) => ({
          apiGroups: rule.apiGroups ? rule.apiGroups.split(',').map((entry) => entry.trim()) : [''],
          resources: rule.resources.split(',').map((entry) => entry.trim()).filter(Boolean),
          verbs: rule.verbs.split(',').map((entry) => entry.trim()).filter(Boolean),
        }))
        // The apiserver rejects rules with no verbs or resources; a template line like that
        // would otherwise make the whole create fail with a message about rules.
        .filter((rule) => rule.verbs.length > 0 && rule.resources.length > 0);
      await write.createRole({ namespace, name, alias, description, rules });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings', 'roles'] });
      onOpenChange(false);
    },
  });

  const submit = (): void => {
    if (!NAME_PATTERN.test(name.trim())) {
      setError(t('settings.roles.error.name'));
      return;
    }
    if (!template) {
      setError(t('settings.roles.error.template'));
      return;
    }
    setError(null);
    create.mutate();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('settings.roles.createTitle')}
      description={t('settings.roles.createDescription')}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} {...actionProps('settings:role-create-cancel')}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" loading={create.isPending} {...actionProps('settings:role-create-submit')} onClick={submit}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-ai-id="settings:role-create-dialog">
        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-role-name">
          {t('settings.roles.column.name')}
          <Input
            id="ai-field-role-name"
            value={name}
            placeholder="developer"
            {...actionProps('settings:role-create-name')}
            onChange={(event) => setName(event.target.value)}
          />
          <span className="text-[11px] text-ai-fg-muted">{t('settings.roles.nameHint')}</span>
        </label>

        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
          {t('settings.roles.template')}
          <div {...actionProps('settings:role-create-template')}>
            <Select
              value={template}
              options={options}
              placeholder={t('settings.roles.selectTemplate')}
              searchable
              aria-label={t('settings.roles.template')}
              onValueChange={setTemplate}
            />
          </div>
          <span className="text-[11px] text-ai-fg-muted">{t('settings.roles.templateHint')}</span>
        </label>

        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-role-alias">
          {t('settings.roles.fieldAlias')}
          <Input
            id="ai-field-role-alias"
            value={alias}
            {...actionProps('settings:role-create-alias')}
            onChange={(event) => setAlias(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-role-description">
          {t('settings.roles.fieldDescription')}
          <Textarea
            id="ai-field-role-description"
            value={description}
            rows={2}
            {...actionProps('settings:role-create-description')}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        {error ? (
          <p className="text-xs text-ai-danger" role="alert" data-ai-id="settings:role-create-error">
            {error}
          </p>
        ) : null}
        {create.isError ? (
          <p className="text-xs text-ai-danger" role="alert">
            {errorMessage(t, create.error)}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
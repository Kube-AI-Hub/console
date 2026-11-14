import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Modal, Textarea } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { clusterRolesWriteApi, ROLE_VERBS, type EditableRule, type RoleVerb } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { MutationAlert } from '@/components/resource/ResourceErrorPanel';

/**
 * 创建 / 编辑平台角色.
 *
 * The rules are a list, not one line: a role that grants "read pods" and "manage
 * deployments" is the normal shape, and the old console's editor adds and removes rule
 * rows. The YAML path stays available for anything the form cannot express.
 *
 * Verbs are checkboxes over the verbs Kubernetes actually understands. Free text here is
 * a trap: a misspelled verb is accepted by the apiserver and grants nothing.
 *
 * Editing loads the role's current rules. Without that read, saving an edit would replace
 * whatever the role had with the form's default rule — the write path is RBAC, which
 * replaces the whole list.
 */
export interface RoleEditorDialogProps {
  open: boolean;
  /** Present when editing; absent when creating. */
  role?: { name: string; alias: string; description: string } | undefined;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_RULE: EditableRule = { apiGroups: '', resources: 'pods', verbs: ['get', 'list'] };

export function RoleEditorDialog({ open, role, onOpenChange }: RoleEditorDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const write = clusterRolesWriteApi(apiClient);
  const editing = Boolean(role);

  const current = useQuery({
    queryKey: ['platform', 'clusterrole-rules', role?.name],
    enabled: open && editing,
    queryFn: () => write.rules({ name: role?.name ?? '' }),
  });

  const [name, setName] = React.useState('');
  const [alias, setAlias] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [rules, setRules] = React.useState<EditableRule[]>([EMPTY_RULE]);
  const [error, setError] = React.useState('');

  // Seed the form every time it opens, and once the role's rules arrive.
  React.useEffect(() => {
    if (!open) return;
    setName(role?.name ?? '');
    setAlias(role?.alias ?? '');
    setDescription(role?.description ?? '');
    setError('');
    setRules(editing ? [] : [{ ...EMPTY_RULE }]);
  }, [open, role?.name, role?.alias, role?.description, editing]);

  React.useEffect(() => {
    if (!open || !editing) return;
    if (current.data && current.data.length > 0) setRules(current.data.map((rule) => ({ ...rule })));
    else if (current.data && current.data.length === 0) setRules([{ ...EMPTY_RULE }]);
  }, [open, editing, current.data]);

  const save = useMutation({
    mutationFn: (input: { name: string; alias: string; description: string; rules: EditableRule[] }) =>
      editing
        ? write.update({ name: input.name, alias: input.alias, description: input.description, rules: input.rules })
        : write.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform', 'clusterroles'] });
    },
  });

  if (!open) return <></>;

  const patchRule = (index: number, patch: Partial<EditableRule>) => {
    setRules((previous) => previous.map((rule, at) => (at === index ? { ...rule, ...patch } : rule)));
  };
  const toggleVerb = (index: number, verb: RoleVerb) => {
    setRules((previous) => previous.map((rule, at) => {
      if (at !== index) return rule;
      const has = rule.verbs.includes(verb);
      return { ...rule, verbs: has ? rule.verbs.filter((entry) => entry !== verb) : [...rule.verbs, verb] };
    }));
  };

  const submit = async () => {
    setError('');
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t('platform.roles.nameRequired'));
      return;
    }
    if (!editing && trimmedName.startsWith('role-template-')) {
      setError(t('platform.roles.nameReserved'));
      return;
    }
    if (!/^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/.test(trimmedName)) {
      setError(t('platform.users.field.nameInvalid'));
      return;
    }
    const usable = rules.filter((rule) => rule.verbs.length > 0 && rule.resources.trim().length > 0);
    if (usable.length === 0) {
      setError(t('platform.roles.rulesRequired'));
      return;
    }
    try {
      await save.mutateAsync({ name: trimmedName, alias: alias.trim(), description: description.trim(), rules: usable });
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={editing ? t('platform.roles.edit') : t('platform.roles.create')}
      description={editing ? role?.name : t('platform.roles.createHint')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>{t('common.cancel')}</Button>
          <Button {...actionProps('role-editor:submit')} disabled={save.isPending} onClick={() => void submit()}>
            {save.isPending ? t('common.cancel') : t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ai-fg-muted">{t('platform.column.name')}</span>
          <Input data-ai-id="role-editor:name" value={name} disabled={editing} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ai-fg-muted">{t('platform.roles.alias')}</span>
          <Input data-ai-id="role-editor:alias" value={alias} onChange={(event) => setAlias(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ai-fg-muted">{t('projectInfo.field.description')}</span>
          <Textarea data-ai-id="role-editor:description" value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>

        <div className="flex items-center justify-between gap-2 pt-2">
          <h3 className="text-sm font-medium text-ai-fg">{t('platform.roles.rules')}</h3>
          <Button variant="secondary" size="sm" {...actionProps('role-editor:rule-add')}
            onClick={() => setRules((previous) => [...previous, { ...EMPTY_RULE, verbs: [] }])}>
            {t('platform.roles.addRule')}
          </Button>
        </div>

        {rules.map((rule, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-ai-md border border-ai-line p-3" data-ai-id={`role-editor:rule:${index}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-ai-fg-muted">{t('platform.roles.rule', { index: index + 1 })}</span>
              <Button variant="ghost" size="sm" {...actionProps(`role-editor:rule-remove:${index}`)}
                disabled={rules.length <= 1}
                onClick={() => setRules((previous) => previous.filter((_, at) => at !== index))}>
                {t('common.delete')}
              </Button>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ai-fg-muted">{t('platform.roles.apiGroups')}</span>
              <Input data-ai-id={`role-editor:rule:${index}:groups`} value={rule.apiGroups}
                placeholder={t('platform.roles.apiGroupsHint')} onChange={(event) => patchRule(index, { apiGroups: event.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ai-fg-muted">{t('platform.roles.resources')}</span>
              <Input data-ai-id={`role-editor:rule:${index}:resources`} value={rule.resources}
                placeholder={t('platform.roles.resourcesHint')} onChange={(event) => patchRule(index, { resources: event.target.value })} />
            </label>
            <div className="flex flex-wrap gap-2" data-ai-id={`role-editor:rule:${index}:verbs`}>
              {ROLE_VERBS.map((verb) => (
                <label key={verb} className="inline-flex min-h-6 items-center gap-1 text-sm text-ai-fg">
                  <input type="checkbox" checked={rule.verbs.includes(verb)} data-ai-id={`role-editor:rule:${index}:verb:${verb}`}
                    onChange={() => toggleVerb(index, verb)} />
                  {verb}
                </label>
              ))}
            </div>
          </div>
        ))}

        <MutationAlert error={save.error} />
        {error ? <p role="alert" data-ai-id="role-editor:error" className="text-sm text-ai-danger">{error}</p> : null}
      </div>
    </Modal>
  );
}

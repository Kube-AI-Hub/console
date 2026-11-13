import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, ResourceForm, type FormSchema } from '@kube-ai-hub/ui';
import { clusterRolesWriteApi, ROLE_VERBS, type EditableRule, type RoleVerb } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';

/**
 * 创建 / 编辑平台角色.
 *
 * Name, alias, description and one rule line. The old console's editor lets an
 * administrator add many rules with a resource picker; one line covers the common
 * case ("read pods", "manage deployments in apps") and the YAML path remains open for
 * anything more elaborate.
 *
 * Verbs are checkboxes over the verbs Kubernetes actually understands. Free text here
 * is a trap: a misspelled verb is accepted by the apiserver and grants nothing.
 */
export interface RoleEditorDialogProps {
  open: boolean;
  /** Present when editing; absent when creating. */
  role?: { name: string; alias: string; description: string } | undefined;
  onOpenChange: (open: boolean) => void;
}

/**
 * Verb presets.
 *
 * A select of whole verb sets rather than per-verb checkboxes: the common roles are
 * "read", "write" and "manage", and naming them is easier to get right than
 * assembling the same list by hand each time.
 */
const VERB_PRESETS: Array<{ value: string; label: string; verbs: RoleVerb[] }> = [
  { value: 'read', label: 'get, list, watch', verbs: ['get', 'list', 'watch'] },
  { value: 'write', label: 'get, list, watch, create, update, patch', verbs: ['get', 'list', 'watch', 'create', 'update', 'patch'] },
  { value: 'manage', label: 'all verbs', verbs: [...ROLE_VERBS] },
];

export function RoleEditorDialog({ open, role, onOpenChange }: RoleEditorDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const write = clusterRolesWriteApi(apiClient);
  const editing = Boolean(role);

  const initialRules = React.useMemo<EditableRule[]>(() => [{ apiGroups: '', resources: 'pods', verbs: ['get', 'list'] }], []);

  const save = useMutation({
    mutationFn: (input: { name: string; alias: string; description: string; rules: EditableRule[] }) =>
      editing
        ? write.update({ name: input.name, alias: input.alias, description: input.description, rules: input.rules })
        : write.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform', 'clusterroles'] });
    },
  });

  const schema = React.useMemo<FormSchema>(
    () => ({
      title: editing ? t('platform.roles.edit') : t('platform.roles.create'),
      submit: { label: t('common.confirm'), cancelLabel: t('common.cancel') },
      fields: [
        {
          key: 'name',
          label: t('platform.column.name'),
          type: 'text',
          required: true,
          hint: t('platform.roles.nameHint'),
          disabled: editing,
          rules: [
            {
              validate: (value) => {
                const name = String(value ?? '').trim();
                if (!name) return null;
                // `role-template-*` belongs to the platform; a user-defined role must
                // not squat on that prefix.
                if (name.startsWith('role-template-')) return t('platform.roles.nameReserved');
                return /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/.test(name) ? null : t('platform.users.field.nameInvalid');
              },
            },
          ],
        },
        { key: 'alias', label: t('platform.roles.alias'), type: 'text' },
        { key: 'description', label: t('projectInfo.field.description'), type: 'textarea' },
        {
          /*
           * A select over the verbs Kubernetes understands, not free text: a misspelled
           * verb is accepted by the apiserver while granting nothing.
           *
           * `checkbox` in this form is a single boolean (verified: seven options
           * rendered one box), and `tags` starts empty regardless of `defaultValues` —
           * both silently produced a role with no rules.
           */
          key: 'verbs',
          label: t('platform.roles.verbs'),
          type: 'select',
          required: true,
          options: VERB_PRESETS,
          hint: t('platform.roles.verbsHint', { verbs: ROLE_VERBS.join(' / ') }),
        },
        {
          key: 'apiGroups',
          label: t('platform.roles.apiGroups'),
          type: 'text',
          hint: t('platform.roles.apiGroupsHint'),
        },
        {
          key: 'resources',
          label: t('platform.roles.resources'),
          type: 'text',
          required: true,
          hint: t('platform.roles.resourcesHint'),
        },
      ],
    }),
    [editing, t],
  );

  if (!open) return <></>;

  const defaults: Record<string, unknown> = {
    name: role?.name ?? '',
    alias: role?.alias ?? '',
    description: role?.description ?? '',
    verbs: 'read',
    apiGroups: initialRules[0]?.apiGroups ?? '',
    resources: initialRules[0]?.resources ?? '',
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={editing ? t('platform.roles.edit') : t('platform.roles.create')}
      description={editing ? role?.name : t('platform.roles.createHint')}
    >
      <ResourceForm
        schema={schema}
        defaultValues={defaults}
        submitting={save.isPending}
        onCancel={() => onOpenChange(false)}
        onSubmit={async (raw) => {
          const values = raw as Record<string, unknown>;
          const preset = VERB_PRESETS.find((entry) => entry.value === String(values['verbs'] ?? ''));
          const verbs = (preset?.verbs ?? []).filter((verb): verb is RoleVerb => (ROLE_VERBS as readonly string[]).includes(verb));
          await save.mutateAsync({
            name: String(values['name'] ?? '').trim(),
            alias: String(values['alias'] ?? '').trim(),
            description: String(values['description'] ?? '').trim(),
            rules: [
              {
                apiGroups: String(values['apiGroups'] ?? '').trim(),
                resources: String(values['resources'] ?? '').trim(),
                verbs,
              },
            ],
          });
          onOpenChange(false);
        }}
      />
    </Modal>
  );
}

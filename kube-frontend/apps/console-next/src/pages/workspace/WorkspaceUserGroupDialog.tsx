import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { workspaceRolesApi, type WorkspaceGroupSummary } from '@kube-ai-hub/api-client';
import { Modal, ResourceForm, type FormSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

/** Sentinel: Radix Select refuses an empty string, and root is a real choice. */
export const GROUP_PARENT_ROOT = '__root__';

const NAME_RE = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export function WorkspaceUserGroupDialog({
  workspace,
  group,
  groups,
  defaultParent,
  pending,
  onOpenChange,
  onSubmit,
}: {
  workspace: string;
  group?: WorkspaceGroupSummary;
  groups: WorkspaceGroupSummary[];
  defaultParent: string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { generateName: string; alias: string; parent: string; workspaceRole: string }) => Promise<unknown>;
}): React.ReactElement {
  const t = useT();
  const editing = group !== undefined;
  const roles = useQuery({
    queryKey: ['workspace-roles', workspace],
    queryFn: ({ signal }) => workspaceRolesApi(api).list({ workspace, signal }),
  });
  const roleOptions = (roles.data ?? []).map((role) => ({ value: role.name, label: role.alias || role.name }));
  const parentOptions = React.useMemo(() => {
    const blocked = new Set<string>();
    if (group) {
      blocked.add(group.name);
      const byParent = new Map<string, string[]>();
      for (const item of groups) {
        const list = byParent.get(item.parent) ?? [];
        list.push(item.name);
        byParent.set(item.parent, list);
      }
      const walk = (name: string): void => {
        for (const child of byParent.get(name) ?? []) {
          if (blocked.has(child)) continue;
          blocked.add(child);
          walk(child);
        }
      };
      walk(group.name);
    }
    return [
      { value: GROUP_PARENT_ROOT, label: t('workspace.userGroups.parentRoot') },
      ...groups
        .filter((item) => !blocked.has(item.name))
        .map((item) => ({ value: item.name, label: item.displayName })),
    ];
  }, [group, groups, t]);

  const schema: FormSchema = {
    fields: [
      {
        key: 'generateName',
        label: t('workspace.field.name'),
        type: 'text',
        required: true,
        disabled: editing,
        hint: t('workspace.userGroups.nameHint'),
        rules: [
          {
            validate: (value) => {
              const name = String(value ?? '').trim();
              if (!NAME_RE.test(name)) return t('workspace.userGroups.error.name');
              if (
                !editing &&
                groups.some((item) => item.generateName === name || item.displayName === name)
              ) {
                return t('workspace.userGroups.error.duplicate');
              }
              return null;
            },
          },
        ],
      },
      { key: 'alias', label: t('workspace.field.alias'), type: 'text' },
      {
        key: 'parent',
        label: t('workspace.userGroups.parent'),
        type: 'select',
        options: parentOptions,
      },
      {
        key: 'workspaceRole',
        label: t('workspace.field.workspaceRole'),
        type: 'select',
        required: true,
        options: roleOptions,
        placeholder: t('workspace.members.selectRole'),
        rules: [
          {
            validate: (value) =>
              roleOptions.some((option) => option.value === value) ? null : t('workspace.userGroups.error.role'),
          },
        ],
      },
    ],
    submit: { label: t('common.confirm') },
  };

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!pending) onOpenChange(open);
      }}
      title={editing ? t('workspace.userGroups.edit') : t('workspace.userGroups.create')}
      description={t(editing ? 'workspace.userGroups.editDescription' : 'workspace.userGroups.createDescription')}
    >
      <div data-ai-id="workspace-user-groups:dialog" aria-busy={roles.isFetching || pending}>
        {roles.isError ? (
          <ResourceErrorPanel error={roles.error} onRetry={() => void roles.refetch()} retryAiId="workspace-user-groups:roles-retry" />
        ) : roles.isPending ? (
          <p role="status">{t('common.loading')}</p>
        ) : roleOptions.length === 0 ? (
          <p role="status">{t('workspace.members.noRoles')}</p>
        ) : (
          <ResourceForm
            schema={schema}
            defaultValues={{
              generateName: group?.generateName ?? '',
              alias: group?.alias ?? '',
              parent: group?.parent || defaultParent || GROUP_PARENT_ROOT,
              workspaceRole: group?.workspaceRole ?? '',
            }}
            submitting={pending}
            onCancel={() => onOpenChange(false)}
            onSubmit={async (values) => {
              const parent = String(values['parent'] ?? '');
              await onSubmit({
                generateName: String(values['generateName'] ?? '').trim(),
                alias: String(values['alias'] ?? '').trim(),
                parent: parent === GROUP_PARENT_ROOT ? '' : parent,
                workspaceRole: String(values['workspaceRole'] ?? '').trim(),
              });
            }}
          />
        )}
      </div>
    </Modal>
  );
}

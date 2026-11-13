import * as React from 'react';
import { Modal, ResourceForm, type FormSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';

/**
 * 创建 / 编辑企业空间.
 *
 * Name, alias and description. A workspace is a namespace-level grouping; quotas and
 * members are assigned after it exists, which keeps this dialog to what the object
 * actually needs.
 */
export interface WorkspaceEditorDialogProps {
  open: boolean;
  /** Present when editing; absent when creating. */
  workspace?: { name: string; alias: string; description: string } | undefined;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { name: string; alias: string; description: string }) => void | Promise<void>;
}

export function WorkspaceEditorDialog({ open, workspace, pending, onOpenChange, onSubmit }: WorkspaceEditorDialogProps): React.ReactElement {
  const t = useT();
  const editing = Boolean(workspace);

  const schema = React.useMemo<FormSchema>(
    () => ({
      title: editing ? t('platform.workspaces.edit') : t('platform.workspaces.create'),
      submit: { label: t('common.confirm'), cancelLabel: t('common.cancel') },
      fields: [
        {
          key: 'name',
          label: t('platform.column.name'),
          type: 'text',
          required: true,
          // The name is the object's identity; renaming a workspace would break every
          // project tagged with it, so the field is locked when editing.
          disabled: editing,
          hint: t('platform.users.field.nameHint'),
          rules: [
            {
              validate: (value) => {
                const name = String(value ?? '').trim();
                if (!name) return null;
                return /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/.test(name) ? null : t('platform.users.field.nameInvalid');
              },
            },
          ],
        },
        { key: 'alias', label: t('platform.roles.alias'), type: 'text' },
        { key: 'description', label: t('projectInfo.field.description'), type: 'textarea' },
      ],
    }),
    [editing, t],
  );

  if (!open) return <></>;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={editing ? t('platform.workspaces.edit') : t('platform.workspaces.create')}
      {...(editing && workspace ? { description: workspace.name } : {})}
    >
      <ResourceForm
        schema={schema}
        defaultValues={{ name: workspace?.name ?? '', alias: workspace?.alias ?? '', description: workspace?.description ?? '' }}
        submitting={pending ?? false}
        onCancel={() => onOpenChange(false)}
        onSubmit={async (raw) => {
          const values = raw as Record<string, unknown>;
          await onSubmit({
            name: String(values['name'] ?? '').trim(),
            alias: String(values['alias'] ?? '').trim(),
            description: String(values['description'] ?? '').trim(),
          });
        }}
      />
    </Modal>
  );
}

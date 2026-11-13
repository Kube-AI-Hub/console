import * as React from 'react';
import { Modal, ResourceForm, type FormSchema } from '@kube-ai-hub/ui';
import { ASSIGNABLE_PLATFORM_ROLES, type AssignablePlatformRole } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';

/** 修改平台角色: one select, because that is the whole change. */
export interface UserRoleDialogProps {
  open: boolean;
  name: string;
  current: string;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (role: AssignablePlatformRole) => void | Promise<void>;
}

export function UserRoleDialog({ open, name, current, pending, onOpenChange, onSubmit }: UserRoleDialogProps): React.ReactElement {
  const t = useT();

  const schema = React.useMemo<FormSchema>(
    () => ({
      title: t('platform.users.changeRole'),
      submit: { label: t('common.confirm'), cancelLabel: t('common.cancel') },
      fields: [
        {
          key: 'platformRole',
          label: t('platform.users.field.platformRole'),
          type: 'select',
          required: true,
          options: ASSIGNABLE_PLATFORM_ROLES.map((role) => ({ value: role, label: t(`platform.role.${role}` as never) })),
          hint: t('platform.users.roleHint'),
        },
      ],
    }),
    [t],
  );

  if (!open) return <></>;

  // Only offer the assignable roles; a user carrying a non-assignable one (an
  // internal identity, say) starts unselected so the change is deliberate.
  const initial = (ASSIGNABLE_PLATFORM_ROLES as readonly string[]).includes(current) ? current : 'platform-regular';

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="sm" title={t('platform.users.changeRole')} description={name}>
      <ResourceForm
        schema={schema}
        defaultValues={{ platformRole: initial }}
        submitting={pending ?? false}
        onCancel={() => onOpenChange(false)}
        onSubmit={async (raw) => {
          await onSubmit(String((raw as Record<string, unknown>)['platformRole']) as AssignablePlatformRole);
        }}
      />
    </Modal>
  );
}

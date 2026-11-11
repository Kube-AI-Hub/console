import * as React from 'react';
import { AiSurface, Button, Modal, Select, type SelectOption } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';
import { useProjectRoles } from './queries';

/**
 * "Change role" for a ServiceAccount.
 *
 * The old console has a dedicated modal for this (`Modals/ModifyServiceAccountRole`)
 * rather than a field in the edit-information dialog, because the role is the one
 * annotation that decides what the account can do. Keeping it separate keeps the
 * change deliberate and keeps the description text on screen.
 *
 * Options are the target project's roles, read from the KubeSphere role list; they
 * are **not** filtered to templates because the old role picker is not either
 * (its `RoleStore.fetchList` returns what the project offers).
 */
export interface ServiceAccountRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: string;
  namespace: string;
  name: string;
  /** Current role, `''` when none. */
  role: string;
  pending?: boolean;
  onSubmit: (role: string) => void | Promise<void>;
}

export function ServiceAccountRoleDialog({
  open,
  onOpenChange,
  cluster,
  namespace,
  name,
  role: initialRole,
  pending = false,
  onSubmit,
}: ServiceAccountRoleDialogProps): React.ReactElement {
  const t = useT();
  const [role, setRole] = React.useState(initialRole);
  const roles = useProjectRoles({ cluster, namespace, enabled: open });

  React.useEffect(() => {
    if (open) setRole(initialRole);
  }, [open, initialRole]);

  const options: SelectOption[] = [
    { value: '', label: t('serviceaccounts.role.none') },
    ...(roles.data ?? []).map((item) => ({ value: item.name, label: item.name })),
  ];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('serviceaccounts.action.changeRole')}
      description={t('serviceaccounts.role.description', { name })}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" disabled={pending} {...actionProps('serviceaccounts:role-submit')} onClick={() => void onSubmit(role)}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ai-fg-secondary">{t('serviceaccounts.field.role')}</span>
        <AiSurface as="div" aiId="serviceaccounts:role-select" state="ready" className="contents">
          <Select
            value={role}
            options={options}
            searchable
            placeholder={t('serviceaccounts.field.rolePlaceholder')}
            emptyText={roles.isPending ? t('common.loading') : t('serviceaccounts.role.empty')}
            aria-label={t('serviceaccounts.field.role')}
            onValueChange={setRole}
          />
        </AiSurface>
        <span className="text-[11px] text-ai-fg-muted">{t('serviceaccounts.field.roleHint')}</span>
        {roles.isError ? (
          <span role="alert" className="text-[11px] text-ai-danger">
            {t('serviceaccounts.role.loadFailed')}
          </span>
        ) : null}
      </label>
    </Modal>
  );
}

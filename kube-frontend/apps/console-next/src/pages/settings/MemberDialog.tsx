import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rolesApi, type MemberSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Button, Input, Modal, Select } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage } from '@/components/resource/ResourceErrorPanel';

/**
 * 邀请成员 / 修改成员角色.
 *
 * One dialog for both because they are the same decision — who, and with which project
 * role — and differ only in whether the user may be changed. Rows of the old console's
 * 成员 list offered 修改角色 and 删除; inviting is the page's primary action.
 *
 * The role list comes from the project's own roles, minus the `role-template-*` building
 * blocks: the API rejects assigning those, so offering them would be offering an error.
 */
export interface MemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: string;
  namespace: string;
  /** Present when re-roling an existing member. */
  member?: MemberSummary | undefined;
  onInvite: (input: { username: string; roleRef: string }) => Promise<unknown>;
  onUpdateRole: (input: { username: string; roleRef: string }) => Promise<unknown>;
}

export function MemberDialog({
  open,
  onOpenChange,
  cluster,
  namespace,
  member,
  onInvite,
  onUpdateRole,
}: MemberDialogProps): React.ReactElement {
  const t = useT();
  const editing = member !== undefined;
  const [username, setUsername] = React.useState('');
  const [roleRef, setRoleRef] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const roles = useQuery({
    enabled: open,
    queryKey: ['settings', 'assignable-roles', cluster, namespace],
    queryFn: ({ signal }) =>
      rolesApi(apiClient).list({ cluster, namespace, page: 1, pageSize: 100, signal }),
  });

  React.useEffect(() => {
    if (!open) return;
    setUsername(member?.username ?? '');
    setRoleRef(member?.role ?? '');
    setError(null);
  }, [open, member?.username, member?.role]);

  const options = React.useMemo(
    () =>
      (roles.data?.items ?? [])
        .filter((role) => !role.system)
        .map((role) => ({ value: role.name, label: role.alias || role.name })),
    [roles.data],
  );

  const submit = async (): Promise<void> => {
    const name = username.trim();
    if (!name) {
      setError(t('settings.members.error.user'));
      return;
    }
    if (!roleRef) {
      setError(t('settings.members.error.role'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (editing) await onUpdateRole({ username: name, roleRef });
      else await onInvite({ username: name, roleRef });
      onOpenChange(false);
    } catch (cause) {
      setError(errorMessage(t, cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('settings.members.editTitle') : t('settings.members.inviteTitle')}
      description={editing ? t('settings.members.editDescription') : t('settings.members.inviteDescription')}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} {...actionProps('settings:member-cancel')}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" loading={submitting} {...actionProps('settings:member-submit')} onClick={() => void submit()}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-ai-id="settings:member-dialog">
        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-member-username">
          {t('settings.members.user')}
          <Input
            id="ai-field-member-username"
            value={username}
            disabled={editing}
            placeholder="ui-test"
            {...actionProps('settings:member-username')}
            onChange={(event) => setUsername(event.target.value)}
          />
          <span className="text-[11px] text-ai-fg-muted">{t('settings.members.userHint')}</span>
        </label>

        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
          {t('settings.column.role')}
          <div {...actionProps('settings:member-role')}>
            <Select
              value={roleRef}
              options={options}
              placeholder={t('settings.members.selectRole')}
              aria-label={t('settings.column.role')}
              onValueChange={setRoleRef}
            />
          </div>
        </label>

        {error ? (
          <p className="text-xs text-ai-danger" role="alert" data-ai-id="settings:member-error">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { workspaceRolesApi, type WorkspaceMemberSummary } from '@kube-ai-hub/api-client';
import { Modal, ResourceForm, type FormSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

export function WorkspaceMemberDialog({ workspace, member, pending, onOpenChange, onSubmit }: {
  workspace: string;
  member?: WorkspaceMemberSummary;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { username: string; roleRef: string }) => Promise<unknown>;
}): React.ReactElement {
  const t = useT();
  const roles = useQuery({
    queryKey: ['workspace-roles', workspace],
    queryFn: ({ signal }) => workspaceRolesApi(api).list({ workspace, signal }),
  });
  const options = (roles.data ?? []).map((role) => ({ value: role.name, label: role.alias || role.name }));
  const schema: FormSchema = {
    fields: [
      { key: 'username', label: t('settings.members.user'), type: 'text', required: true,
        disabled: Boolean(member), hint: t('settings.members.userHint'),
        rules: [{ validate: (value) => String(value ?? '').trim() ? null : t('settings.members.error.user') }] },
      { key: 'roleRef', label: t('workspace.field.role'), type: 'select', required: true,
        options, placeholder: t('workspace.members.selectRole'),
        rules: [{ validate: (value) => options.some((option) => option.value === value) ? null : t('workspace.members.error.role') }] },
    ],
    submit: { label: t('common.confirm') },
  };
  return <Modal open onOpenChange={(open) => { if (!pending) onOpenChange(open); }}
    title={member ? t('settings.members.editTitle') : t('settings.members.inviteTitle')}
    description={t(member ? 'workspace.members.editDescription' : 'workspace.members.inviteDescription')}>
    <div data-ai-id="workspace-members:dialog" aria-busy={roles.isFetching || pending}>
      {roles.isError ? <ResourceErrorPanel error={roles.error} onRetry={() => void roles.refetch()} retryAiId="workspace-members:roles-retry" /> :
        roles.isPending ? <p role="status">{t('common.loading')}</p> :
          options.length === 0 ? <p role="status">{t('workspace.members.noRoles')}</p> :
            <ResourceForm schema={schema} defaultValues={{ username: member?.username ?? '', roleRef: member?.role ?? '' }}
              submitting={pending} onCancel={() => onOpenChange(false)}
              onSubmit={async (values) => {
                await onSubmit({ username: String(values['username']).trim(), roleRef: String(values['roleRef']) });
              }} />}
    </div>
  </Modal>;
}

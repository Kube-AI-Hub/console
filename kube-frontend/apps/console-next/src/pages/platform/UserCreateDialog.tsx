import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, ResourceForm, type FormSchema } from '@kube-ai-hub/ui';
import { ApiError, ASSIGNABLE_PLATFORM_ROLES, passwordProblem, usersWriteApi, type AssignablePlatformRole } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { passwordProblemMessage } from '@/lib/password';
import { PASSWORD_FIELD_TYPE, registerPasswordField } from '@/components/password/registerPasswordField';

// Teach the form schema the password field type before this dialog renders it.
registerPasswordField();

/**
 * 创建用户.
 *
 * Four fields, because that is what the platform needs: a name, an email, a password
 * and a platform role. Everything else (workspace memberships, quotas) is assigned
 * after the account exists.
 *
 * The password is validated here rather than letting the apiserver answer 400: the
 * platform's rule is short and stable, and "password too short" is more useful than a
 * generic rejection.
 */
export interface UserCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserCreateDialog({ open, onOpenChange }: UserCreateDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: (input: {
      name: string;
      email: string;
      password: string;
      platformRole: AssignablePlatformRole;
      description?: string;
    }) => usersWriteApi(apiClient).create(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['platform', 'users'] }),
  });

  const schema = React.useMemo<FormSchema>(
    () => ({
      title: t('platform.users.create'),
      submit: { label: t('common.confirm'), cancelLabel: t('common.cancel') },
      fields: [
        {
          key: 'name',
          label: t('platform.users.field.name'),
          type: 'text',
          required: true,
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
        {
          key: 'email',
          label: t('platform.users.field.email'),
          type: 'text',
          required: true,
          rules: [
            {
              validate: (value) => {
                const email = String(value ?? '').trim();
                if (!email) return null;
                return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? null : t('platform.users.field.emailInvalid');
              },
            },
          ],
        },
        {
          key: 'password',
          label: t('platform.users.field.password'),
          type: PASSWORD_FIELD_TYPE,
          required: true,
          hint: t('platform.users.field.passwordHint'),
          rules: [
            {
              validate: (value) => {
                const password = String(value ?? '');
                if (!password) return null;
                // One rule, one wording: the personal-settings dialog asks the same question.
                return passwordProblemMessage(t, passwordProblem(password));
              },
            },
          ],
        },
        {
          key: 'platformRole',
          label: t('platform.users.field.platformRole'),
          type: 'select',
          required: true,
          options: ASSIGNABLE_PLATFORM_ROLES.map((role) => ({ value: role, label: t(`platform.role.${role}` as never) })),
        },
        {
          key: 'description',
          label: t('platform.user.description'),
          type: 'textarea',
        },
      ],
    }),
    [t],
  );

  if (!open) return <></>;

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="md" title={t('platform.users.create')}>
      <ResourceForm
        schema={schema}
        defaultValues={{ platformRole: 'platform-regular' }}
        submitting={create.isPending}
        onCancel={() => onOpenChange(false)}
        /*
         * A taken name comes back as 409 with the message "Conflict", which says
         * nothing about what to change. The form has no locales, so the sentence is
         * supplied here.
         */
        describeError={(error) => {
          if (!(error instanceof ApiError)) return error instanceof Error ? error.message : t('error.unknown');
          /*
           * A conflict can be about the name *or* the email — IAM enforces both. Keep
           * the upstream sentence when it says which; fall back to a generic one only
           * when the message is the bare "Conflict" that a proxy adds.
           */
          if (error.isConflict && !/already exists|已被占用|已存在/i.test(error.message)) {
            return t('platform.users.create.conflict');
          }
          return error.message;
        }}
        onSubmit={async (raw) => {
          const values = raw as Record<string, unknown>;
          const description = String(values['description'] ?? '').trim();
          await create.mutateAsync({
            name: String(values['name'] ?? '').trim(),
            email: String(values['email'] ?? '').trim(),
            password: String(values['password'] ?? ''),
            platformRole: String(values['platformRole'] ?? 'platform-regular') as AssignablePlatformRole,
            ...(description ? { description } : {}),
          });
          onOpenChange(false);
        }}
      />
    </Modal>
  );
}

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, passwordProblem, userDetailApi } from '@kube-ai-hub/api-client';
import { AiButton, Input, InputPassword, Modal, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { PasswordStrength } from '@/components/password/PasswordStrength';
import { passwordProblemMessage } from '@/lib/password';

/**
 * Administrator reset of another account's password.
 *
 * Personal settings require the current password because that write is authorised by
 * knowing it. This dialog is the other path: an administrator sets a new value with
 * `{ password }` only. The email is shown so the operator can confirm the account;
 * it is not editable here.
 */
export interface UserResetPasswordDialogProps {
  name: string;
  pending: boolean;
  error?: unknown;
  onCancel: () => void;
  onSubmit: (password: string) => void;
}

export function UserResetPasswordDialog({
  name,
  pending,
  error,
  onCancel,
  onSubmit,
}: UserResetPasswordDialogProps): React.ReactElement {
  const t = useT();
  const query = useQuery({
    queryKey: ['user-detail', name],
    queryFn: ({ signal }) => userDetailApi(apiClient).get({ name, signal }),
  });

  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [touched, setTouched] = React.useState(false);

  const mismatch = confirm !== '' && confirm !== password;
  const rule = passwordProblemMessage(t, password ? passwordProblem(password) : 'too-short');
  const blocked = !password || Boolean(rule) || confirm !== password;

  const errorText = React.useMemo(() => {
    if (!error) return null;
    if (error instanceof ApiError) return error.message;
    return error instanceof Error ? error.message : t('error.unknown');
  }, [error, t]);

  return (
    <Modal
      open
      onOpenChange={(next) => !next && onCancel()}
      title={t('platform.user.resetTitle')}
      description={t('platform.user.resetDescription')}
      footer={
        <React.Fragment>
          <AiButton aiId="user-reset:cancel" variant="ghost" size="sm" onClick={onCancel}>
            {t('common.cancel')}
          </AiButton>
          <AiButton
            aiId="user-reset:submit"
            variant="primary"
            size="sm"
            disabled={pending || !query.data}
            onClick={() => {
              setTouched(true);
              if (blocked) return;
              void Promise.resolve(onSubmit(password)).catch(() => undefined);
            }}
          >
            {t('common.save')}
          </AiButton>
        </React.Fragment>
      }
    >
      {query.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ai-fg-muted">{t('platform.user.email')}</span>
            <Input id="user-reset:email" value={query.data?.email ?? ''} disabled readOnly />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ai-fg-muted">{t('userSettings.password.new')}</span>
            <InputPassword
              id="user-reset:password"
              value={password}
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
            />
            <PasswordStrength password={password} scope="user-reset" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ai-fg-muted">{t('userSettings.password.confirm')}</span>
            <InputPassword
              id="user-reset:confirm"
              value={confirm}
              autoComplete="new-password"
              onChange={(event) => setConfirm(event.target.value)}
            />
          </label>
          {touched && password && rule ? (
            <p className="text-xs text-ai-danger" data-ai-id="user-reset:error">
              {rule}
            </p>
          ) : null}
          {touched && mismatch ? (
            <p className="text-xs text-ai-danger" data-ai-id="user-reset:mismatch">
              {t('platform.user.reset.mismatch')}
            </p>
          ) : null}
          {errorText ? (
            <p className="text-xs text-ai-danger" data-ai-id="user-reset:api-error">
              {errorText}
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

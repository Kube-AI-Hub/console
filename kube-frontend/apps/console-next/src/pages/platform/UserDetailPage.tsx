import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { isProtectedPlatformUser, userDetailApi } from '@kube-ai-hub/api-client';
import { AiButton, AiSurface, Badge, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel, MutationAlert } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';
import { useAuth } from '@/shell/AuthProvider';
import { LoginHistoryPanel } from './LoginHistoryPanel';
import { UserResetPasswordDialog } from './UserResetPasswordDialog';
import { useResetUserPassword } from './queries';

/**
 * 用户详情.
 *
 * Two questions the list cannot answer: which roles this account holds, and whether it is
 * actually signing in — the latter matters because a disabled account and an account nobody
 * uses look identical in a status column.
 *
 * The sign-in history is the old console's login-history tab: a paged table of time,
 * success, source IP and reason. Resetting the password is the administrator path that
 * does not ask for the current one; preset accounts and the signed-in user have no such
 * button, matching the old `showEdit` guard.
 */
export interface UserDetailPageProps {}

export function UserDetailPage(_props: UserDetailPageProps): React.ReactElement {
  const t = useT();
  const { name } = useParams({ from: '/kube-frontend/access/users/$name' });
  const { user } = useAuth();
  const api = userDetailApi(apiClient);
  const protectedUser = isProtectedPlatformUser(name, user?.name);
  const resetPassword = useResetUserPassword();
  const [resetting, setResetting] = React.useState(false);

  const detail = useQuery({
    queryKey: ['user-detail', name],
    queryFn: ({ signal }) => api.get({ name, signal }),
  });

  const state = detail.isPending ? 'loading' : detail.isError ? 'error' : 'ready';
  const account = detail.data;

  return (
    <AiSurface as="section" aiId="user-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Link to="/kube-frontend/access/users" className="text-sm text-ai-accent hover:underline">
            ← {t('platform.users.title')}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-ai-fg">{account?.username || name}</h1>
            {account ? (
              <Badge tone={account.state === 'Active' ? 'success' : 'danger'}>{account.state}</Badge>
            ) : null}
          </div>
        </div>
        {account && !protectedUser ? (
          <AiButton aiId="user-detail:reset" size="sm" variant="secondary" onClick={() => setResetting(true)}>
            {t('platform.users.resetPassword')}
          </AiButton>
        ) : null}
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={detail.error} onRetry={() => void detail.refetch()} retryAiId="user-detail:retry" />
      ) : null}

      {account ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="user-detail:basic">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('platform.user.detail.basic')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow label={t('platform.column.username')} value={account.username} />
              <DefinitionRow label={t('platform.user.email')} value={account.email || '-'} />
              <DefinitionRow label={t('platform.user.platformRole')} value={account.platformRole || '-'} />
              <DefinitionRow label={t('platform.column.status')} value={account.state} />
              <DefinitionRow label={t('platform.user.createdAt')} value={formatTimestamp(account.createdAt)} />
              <DefinitionRow label={t('platform.user.lastLogin')} value={account.lastLoginTime ? formatTimestamp(account.lastLoginTime) : t('platform.column.notLoginYet')} />
            </dl>
            <dl className="mt-2 grid grid-cols-1 gap-y-2 text-sm">
              <DefinitionRow label={t('platform.user.description')} value={account.description || '-'} />
            </dl>
          </section>

          <LoginHistoryPanel name={name} />
        </React.Fragment>
      ) : null}

      <MutationAlert error={resetPassword.error} />

      {resetting ? (
        <UserResetPasswordDialog
          name={name}
          pending={resetPassword.isPending}
          {...(resetPassword.error ? { error: resetPassword.error } : {})}
          onCancel={() => {
            setResetting(false);
            resetPassword.reset();
          }}
          onSubmit={async (password) => {
            await resetPassword.mutateAsync({ name, password });
            setResetting(false);
          }}
        />
      ) : null}
    </AiSurface>
  );
}

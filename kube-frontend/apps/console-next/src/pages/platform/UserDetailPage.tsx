import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { userDetailApi } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';

/**
 * 用户详情.
 *
 * Two questions the list cannot answer: which roles this account holds, and whether it is
 * actually signing in — the latter matters because a disabled account and an account nobody
 * uses look identical in a status column.
 *
 * The sign-in history comes from the platform's own `loginrecords` collection, which the
 * apiserver writes on each sign-in; it is not derived from timestamps we guess at.
 */
export interface UserDetailPageProps {}

export function UserDetailPage(_props: UserDetailPageProps): React.ReactElement {
  const t = useT();
  const { name } = useParams({ from: '/kube-frontend/access/users/$name' });
  const api = userDetailApi(apiClient);

  const detail = useQuery({
    queryKey: ['user-detail', name],
    queryFn: ({ signal }) => api.get({ name, signal }),
  });
  const records = useQuery({
    queryKey: ['user-login-records', name],
    queryFn: ({ signal }) => api.loginRecords({ name, limit: 10, signal }),
  });

  const state = detail.isPending ? 'loading' : detail.isError ? 'error' : 'ready';
  const user = detail.data;

  return (
    <AiSurface as="section" aiId="user-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link to="/kube-frontend/access/users" className="text-sm text-ai-accent hover:underline">
          ← {t('platform.users.title')}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-ai-fg">{user?.username || name}</h1>
          {user ? (
            <Badge tone={user.state === 'Active' ? 'success' : 'danger'}>{user.state}</Badge>
          ) : null}
        </div>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={detail.error} onRetry={() => void detail.refetch()} retryAiId="user-detail:retry" />
      ) : null}

      {user ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="user-detail:basic">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('platform.user.detail.basic')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow label={t('platform.column.username')} value={user.username} />
              <DefinitionRow label={t('platform.user.email')} value={user.email || '-'} />
              <DefinitionRow label={t('platform.user.platformRole')} value={user.platformRole || '-'} />
              <DefinitionRow label={t('platform.column.status')} value={user.state} />
              <DefinitionRow label={t('platform.user.createdAt')} value={formatTimestamp(user.createdAt)} />
              <DefinitionRow label={t('platform.user.lastLogin')} value={user.lastLoginTime ? formatTimestamp(user.lastLoginTime) : '-'} />
            </dl>
            <dl className="mt-2 grid grid-cols-1 gap-y-2 text-sm">
              <DefinitionRow label={t('platform.user.description')} value={user.description || '-'} />
            </dl>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="user-detail:logins">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('platform.user.detail.logins')}</h2>
            {records.isPending ? <Skeleton className="h-20 w-full" /> : null}
            {records.isError ? (
              <p className="text-xs text-ai-fg-muted">{t('platform.user.detail.loginsUnavailable')}</p>
            ) : null}
            {records.data && records.data.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('platform.user.detail.noLogins')}</p>
            ) : null}
            {records.data && records.data.length > 0 ? (
              <ul className="flex flex-col divide-y divide-ai-line text-sm" data-ai-id="user-detail:login-list">
                {records.data.map((record) => (
                  <li key={record.name} className="flex items-center justify-between gap-3 py-2" data-ai-row={record.name}>
                    <span className="tabular-nums text-ai-fg-secondary">{formatTimestamp(record.time)}</span>
                    <span className="text-xs text-ai-fg-muted">{[record.provider, record.reason].filter(Boolean).join(' · ') || '-'}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}
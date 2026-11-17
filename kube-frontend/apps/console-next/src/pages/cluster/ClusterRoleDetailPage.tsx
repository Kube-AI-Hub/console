import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { clusterRolesForClusterApi } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Button, Skeleton, cn } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 集群角色详情（规则 / 已授权用户）.
 *
 * Two tabs, as in the old cluster console. Rules are rendered one row per (apiGroups,
 * resources, verbs) triple rather than as raw YAML: the detail page answers "what can
 * this role do", so the fields are columns. [N-06]
 */
export interface ClusterRoleDetailPageProps {
  cluster: string;
  name: string;
}

type Tab = 'rules' | 'users';

export function ClusterRoleDetailPage({ cluster, name }: ClusterRoleDetailPageProps): React.ReactElement {
  const t = useT();
  const [tab, setTab] = React.useState<Tab>('rules');
  const role = useQuery({
    queryKey: ['cluster-role', cluster, name],
    queryFn: ({ signal }) => clusterRolesForClusterApi(apiClient).get({ cluster, name, signal }),
  });
  const users = useQuery({
    queryKey: ['cluster-role-users', cluster, name],
    queryFn: ({ signal }) => clusterRolesForClusterApi(apiClient).users({ cluster, name, signal }),
  });

  const state = role.isPending ? 'loading' : role.isError ? 'error' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="cluster-role-detail:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={role.error} onRetry={() => void role.refetch()} retryAiId="cluster-role-detail:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="cluster-role-detail:surface" state={state} className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link className="text-xs text-ai-fg-muted hover:underline" to="/kube-frontend/clusters/$cluster/roles" params={{ cluster }}>
            {t('cluster.roles.title')}
          </Link>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-ai-fg">
            <span className="truncate">{role.data?.alias || name}</span>
            {role.data?.system ? <Badge tone="neutral">{t('cluster.roles.systemBadge')}</Badge> : null}
          </h2>
          <p className="mt-1 font-mono text-xs text-ai-fg-muted">{name}</p>
          {role.data?.alias ? <p className="mt-1 text-xs text-ai-fg-secondary">{role.data.alias}</p> : null}
        </div>
        <dl className="flex gap-6 text-xs">
          <div>
            <dt className="text-ai-fg-muted">{t('platform.column.ruleCount')}</dt>
            <dd className="mt-0.5 tabular-nums text-ai-fg">{role.data?.ruleCount ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-ai-fg-muted">{t('workspace.field.createdAt')}</dt>
            <dd className="mt-0.5 tabular-nums text-ai-fg">{role.data?.createdAt ? formatTimestamp(role.data.createdAt) : '-'}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-5 flex gap-1 border-b border-ai-line" role="tablist">
        <Button
          size="sm"
          variant="ghost"
          role="tab"
          aria-selected={tab === 'rules'}
          className={cn('rounded-none border-b-2', tab === 'rules' ? 'border-ai-accent text-ai-accent' : 'border-transparent')}
          {...actionProps('cluster-role-detail:tab:rules')}
          onClick={() => setTab('rules')}
        >
          {t('cluster.roles.tab.rules')} ({role.data?.ruleCount ?? 0})
        </Button>
        <Button
          size="sm"
          variant="ghost"
          role="tab"
          aria-selected={tab === 'users'}
          className={cn('rounded-none border-b-2', tab === 'users' ? 'border-ai-accent text-ai-accent' : 'border-transparent')}
          {...actionProps('cluster-role-detail:tab:users')}
          onClick={() => setTab('users')}
        >
          {t('cluster.roles.tab.users')} ({users.data?.length ?? 0})
        </Button>
      </div>

      {state === 'loading' ? <Skeleton className="mt-4 h-24 w-full" /> : null}

      {state === 'ready' && tab === 'rules' ? (
        role.data && role.data.rules.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-xs" data-ai-id="cluster-role-detail:rules">
              <thead>
                <tr className="border-b border-ai-line text-left text-ai-fg-muted">
                  <th className="py-2 pr-3 font-medium">{t('cluster.roles.column.apiGroups')}</th>
                  <th className="py-2 pr-3 font-medium">{t('cluster.roles.column.resources')}</th>
                  <th className="py-2 pr-3 font-medium">{t('cluster.roles.column.verbs')}</th>
                </tr>
              </thead>
              <tbody>
                {role.data.rules.map((rule, index) => (
                  <tr key={index} className="border-b border-ai-line/60" data-ai-id={'cluster-role-detail:rule:' + index}>
                    <td className="py-2 pr-3 font-mono text-ai-fg-secondary">{String((rule['apiGroups'] as string[] | undefined)?.join(', ') || '-')}</td>
                    <td className="py-2 pr-3 font-mono text-ai-fg-secondary">
                      {String((rule['resources'] as string[] | undefined)?.join(', ') || (rule['nonResourceURLs'] as string[] | undefined)?.join(', ') || '-')}
                    </td>
                    <td className="py-2 pr-3 font-mono text-ai-fg-secondary">{String((rule['verbs'] as string[] | undefined)?.join(', ') || '-')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-6 text-xs text-ai-fg-muted" data-ai-id="cluster-role-detail:rules-empty">
            {t('cluster.roles.rulesEmpty')}
          </p>
        )
      ) : null}

      {state === 'ready' && tab === 'users' ? (
        users.isPending ? <Skeleton className="mt-4 h-24 w-full" /> : null
      ) : null}
      {state === 'ready' && tab === 'users' && users.isError ? (
        <ResourceErrorPanel error={users.error} onRetry={() => void users.refetch()} retryAiId="cluster-role-detail:users-retry" />
      ) : null}
      {state === 'ready' && tab === 'users' && users.data ? (
        users.data.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-xs" data-ai-id="cluster-role-detail:users">
              <thead>
                <tr className="border-b border-ai-line text-left text-ai-fg-muted">
                  <th className="py-2 pr-3 font-medium">{t('platform.column.username')}</th>
                  <th className="py-2 pr-3 font-medium">{t('platform.column.status')}</th>
                  <th className="py-2 pr-3 font-medium">{t('platform.column.lastLogin')}</th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((user) => (
                  <tr key={user.username} className="border-b border-ai-line/60" data-ai-row={user.username} data-ai-id={'cluster-role-detail:user:' + user.username}>
                    <td className="py-2 pr-3 font-mono text-ai-fg">{user.username}</td>
                    <td className="py-2 pr-3 text-ai-fg-secondary">{user.status || '-'}</td>
                    <td className="py-2 pr-3 tabular-nums text-ai-fg-secondary">{user.lastLogin ? formatTimestamp(user.lastLogin) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-6 text-xs text-ai-fg-muted" data-ai-id="cluster-role-detail:users-empty">
            {t('cluster.roles.usersEmpty')}
          </p>
        )
      ) : null}
    </AiSurface>
  );
}

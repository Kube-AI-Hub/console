import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { clusterRoleDetailApi, roleBindingsApi, type RoleSubject } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';

/**
 * 平台角色详情.
 *
 * A platform role is a bundle of rules; the list shows how many, this shows which. The old
 * console's page is that table plus the users it was granted to — the second half needs a
 * role-binding scan across the platform and is not migrated here, so the page shows the
 * rules and says what a role with no rules means.
 *
 * Template roles (`role-template-*`) are the platform's building blocks: their rules are
 * readable but not editable, which the badge states.
 */
export interface ClusterRoleDetailPageProps {}

export function ClusterRoleDetailPage(_props: ClusterRoleDetailPageProps): React.ReactElement {
  const t = useT();
  const { name } = useParams({ from: '/kube-frontend/access/clusterroles/$name' });

  const query = useQuery({
    queryKey: ['clusterrole-detail', name],
    queryFn: ({ signal }) => clusterRoleDetailApi(apiClient).get({ name, signal }),
  });

  const subjects = useQuery({
    queryKey: ['clusterrole-subjects', name],
    queryFn: ({ signal }) => roleBindingsApi(apiClient).subjectsOf({ role: name, signal }),
  });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const role = query.data;

  return (
    <AiSurface as="section" aiId="clusterrole-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link to="/kube-frontend/access/clusterroles" className="text-sm text-ai-link hover:underline">
          ← {t('platform.roles.title')}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-ai-fg">{role?.alias || name}</h1>
          {role?.system ? <Badge tone="neutral">{t('settings.roles.templateBadge')}</Badge> : null}
        </div>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="clusterrole-detail:retry" />
      ) : null}

      {role ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="clusterrole-detail:basic">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('platform.user.detail.basic')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow label={t('platform.column.name')} value={role.name} />
              <DefinitionRow label={t('platform.roles.alias')} value={role.alias || '-'} />
              <DefinitionRow label={t('platform.roles.ruleCount')} value={String(role.ruleCount)} />
              <DefinitionRow label={t('platform.column.createdAt')} value={formatTimestamp(role.createdAt)} />
            </dl>
            <dl className="mt-2 grid grid-cols-1 gap-y-2 text-sm">
              <DefinitionRow label={t('platform.user.description')} value={role.description || '-'} />
            </dl>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="clusterrole-detail:subjects">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">
              {t('platform.roles.subjects')} ({subjects.data?.length ?? 0})
            </h2>
            {subjects.isPending ? <Skeleton className="h-16 w-full" /> : null}
            {subjects.isError ? (
              <p className="text-xs text-ai-fg-muted">{t('platform.roles.subjectsUnavailable')}</p>
            ) : null}
            {subjects.data && subjects.data.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('platform.roles.noSubjects')}</p>
            ) : null}
            {subjects.data && subjects.data.length > 0 ? (
              <ul className="flex flex-col divide-y divide-ai-line text-xs" data-ai-id="clusterrole-detail:subject-list">
                {subjects.data.map((subject: RoleSubject) => (
                  <li key={`${subject.binding}/${subject.kind}/${subject.name}`} className="flex items-center justify-between gap-3 py-1.5" data-ai-row={`${subject.kind}/${subject.name}`}>
                    <span className="font-mono text-ai-fg-secondary">{subject.name}</span>
                    <span className="text-ai-fg-muted">
                      {subject.kind}
                      {subject.namespace ? ` · ${subject.namespace}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="clusterrole-detail:rules">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">
              {t('settings.roles.rules')} ({role.rules.length})
            </h2>
            {role.rules.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('settings.roles.noRules')}</p>
            ) : (
              <table className="w-full border-collapse text-xs" data-ai-id="clusterrole-detail:rule-table">
                <thead>
                  <tr className="border-b border-ai-line text-ai-fg-muted">
                    <th scope="col" className="px-2 py-2 text-left font-medium">{t('settings.roles.ruleApiGroups')}</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">{t('settings.roles.ruleResources')}</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">{t('settings.roles.ruleVerbs')}</th>
                  </tr>
                </thead>
                <tbody>
                  {role.rules.map((rule, index) => (
                    <tr key={`${rule.resources}-${index}`} className="border-b border-ai-line" data-ai-row={String(index)}>
                      <td className="px-2 py-2 font-mono text-[11px] text-ai-fg-secondary">{rule.apiGroups || '-'}</td>
                      <td className="px-2 py-2 font-mono text-[11px] text-ai-fg-secondary">{rule.resources || '-'}</td>
                      <td className="px-2 py-2 font-mono text-[11px] text-ai-fg-secondary">{rule.verbs || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}
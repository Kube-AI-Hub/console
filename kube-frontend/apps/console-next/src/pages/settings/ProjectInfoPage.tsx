import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { membersApi, projectInfoApi, rolesApi, serviceAccountsApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, AiSurface, Badge, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { QuotaEditDialog } from './QuotaEditDialog';
import { formatTimestamp } from '@/lib/time';
import { DefinitionRow as Row } from '@/components/resource/DefinitionRow';

/**
 * 项目基本信息.
 *
 * The old console's 基本信息 page is three blocks: the project's own attributes, its
 * resource quota, and the default container quota. This page renders the first two;
 * the default container quota is a LimitRange the platform writes, and editing any of
 * them is a form workflow (see the PRD's 明确不做).
 *
 * The quota block states plainly when a project has no ResourceQuota — that is the
 * common case and a blank block would read as a loading failure.
 */
/**
 * One project count.
 *
 * A failed read shows `-`, never 0: the card's job is to be a fact, and "could not read"
 * must not look like "there are none".
 */
function StatCard({
  label,
  aiId,
  pending,
  failed,
  total,
}: {
  label: string;
  aiId: string;
  pending: boolean;
  failed: boolean;
  total: number | undefined;
}): React.ReactElement {
  return (
    <div className="rounded-ai-md border border-ai-line p-3">
      <span className="block text-[11px] text-ai-fg-muted">{label}</span>
      <span className="mt-1 block text-base font-semibold tabular-nums text-ai-fg" data-ai-id={aiId}>
        {pending ? <Skeleton className="h-5 w-10" /> : failed || total === undefined ? '-' : total}
      </span>
    </div>
  );
}

export interface ProjectInfoPageProps {
  cluster: string;
  namespace: string;
}

export function ProjectInfoPage({ cluster, namespace }: ProjectInfoPageProps): React.ReactElement {
  const t = useT();
  const query = useQuery({
    queryKey: ['project-info', cluster, namespace],
    queryFn: ({ signal }) => projectInfoApi(apiClient).get({ cluster, namespace, signal }),
  });

  /*
   * The three counts the old console's 基本信息 page puts beside the attributes.
   *
   * Each is its own read with `pageSize: 1`: the number needed is the server's `totalItems`,
   * not a page of rows, and an unreadable list must render `-` rather than 0 — "no members"
   * and "we could not count the members" are different facts.
   */
  const memberCount = useQuery({
    queryKey: ['project-stat-members', cluster, namespace],
    queryFn: ({ signal }) => membersApi(apiClient).list({ cluster, namespace, page: 1, pageSize: 1, signal }),
    retry: false,
  });
  const roleCount = useQuery({
    queryKey: ['project-stat-roles', cluster, namespace],
    queryFn: ({ signal }) => rolesApi(apiClient).list({ cluster, namespace, page: 1, pageSize: 1, signal }),
    retry: false,
  });
  const serviceAccountCount = useQuery({
    queryKey: ['project-stat-serviceaccounts', cluster, namespace],
    queryFn: ({ signal }) => serviceAccountsApi(apiClient).list({ cluster, namespace, page: 1, pageSize: 1, signal }),
    retry: false,
  });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const info = query.data;
  const [editingQuota, setEditingQuota] = React.useState(false);

  return (
    <AiSurface as="section" aiId="project-info:surface" state={state} className="flex min-w-0 flex-col gap-4">
      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="project-info:retry" />
      ) : null}

      {info ? (
        <>
          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="project-info:attributes">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-ai-fg">{t('projectInfo.attributes')}</h2>
              {info.status ? (
                <Badge tone={info.status === 'Active' ? 'success' : 'warning'}>{info.status}</Badge>
              ) : null}
            </div>
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
              <Row label={t('projectInfo.field.name')} value={info.name} aiId="project-info:name" />
              <Row label={t('projectInfo.field.alias')} value={info.alias || '-'} />
              <Row label={t('projectInfo.field.workspace')} value={info.workspace || '-'} />
              <Row label={t('projectInfo.field.description')} value={info.description || '-'} />
              <Row label={t('projectInfo.field.creator')} value={info.creator || '-'} />
              <Row label={t('projectInfo.field.createdAt')} value={formatTimestamp(info.createdAt)} />
            </dl>
          </section>

          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="settings-baseinfo:stats">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('settings.baseInfo.stats')}</h2>
            {/* Plain boxes rather than a <dl>: the attributes block above is already a
                definition list, and the existing base-info assertions read every `dt` on the
                page — a second label list here would quietly change that list. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard
                label={t('settings.baseInfo.statMembers')}
                aiId="settings-baseinfo:stat:members"
                pending={memberCount.isPending}
                failed={memberCount.isError}
                total={memberCount.data?.total}
              />
              <StatCard
                label={t('settings.baseInfo.statRoles')}
                aiId="settings-baseinfo:stat:roles"
                pending={roleCount.isPending}
                failed={roleCount.isError}
                total={roleCount.data?.total}
              />
              <StatCard
                label={t('settings.baseInfo.statServiceAccounts')}
                aiId="settings-baseinfo:stat:serviceaccounts"
                pending={serviceAccountCount.isPending}
                failed={serviceAccountCount.isError}
                total={serviceAccountCount.data?.total}
              />
            </div>
          </section>

          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="project-info:quota">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-ai-fg">{t('projectInfo.quota')}</h2>
              <AiButton aiId="project-info:edit-quota" size="sm" variant="secondary" onClick={() => setEditingQuota(true)}>
                {t('projectInfo.quota.edit')}
              </AiButton>
            </div>
            {info.quotaUnavailable ? (
              <p className="text-xs text-ai-fg-muted" data-ai-id="project-info:quota-unavailable">
                {t('projectInfo.quota.unavailable')}
              </p>
            ) : info.quota.length === 0 ? (
              <p className="text-xs text-ai-fg-muted" data-ai-id="project-info:quota-empty">
                {t('projectInfo.quota.empty')}
              </p>
            ) : (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-ai-line text-ai-fg-muted">
                    <th scope="col" className="px-2 py-2 text-left font-medium">{t('projectInfo.quota.resource')}</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">{t('projectInfo.quota.hard')}</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">{t('projectInfo.quota.used')}</th>
                  </tr>
                </thead>
                <tbody>
                  {info.quota.map((row) => (
                    <tr key={row.resource} className="border-b border-ai-line" data-ai-row={row.resource}>
                      <td className="px-2 py-2 font-mono text-[11px] text-ai-fg-secondary">{row.resource}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-ai-fg-secondary">{row.hard}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-ai-fg-muted">{row.used}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <p className="text-[11px] text-ai-fg-faint" {...actionProps('project-info:hint')}>
            {t('projectInfo.editHint')}
          </p>

          <QuotaEditDialog
            open={editingQuota}
            namespace={namespace}
            quota={info.quota.length > 0 ? { name: info.quotaName, hard: info.quotaHard } : undefined}
            onOpenChange={setEditingQuota}
          />
        </>
      ) : null}
    </AiSurface>
  );
}


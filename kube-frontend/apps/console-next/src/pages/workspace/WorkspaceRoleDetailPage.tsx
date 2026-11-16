import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { AiSurface, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';

/**
 * 企业空间角色详情.
 *
 * The rule bundle behind one WorkspaceRole: what the role grants (apiGroups/resources/verbs)
 * and how many workspace members currently hold it. The list page answers "which roles are
 * there and how big are they"; this answers "what exactly does this one allow, and who has it".
 *
 * Read from the workspace-scoped IAM collection. The role object's `rules[]` is the
 * authority: the page does not recompute rules from `aggregation-roles` (those are templates
 * the platform aggregates, and the aggregated result is already what `rules` carries).
 *
 * The member count is a client-side filter over `workspacemembers`: the binding stores the
 * role as the annotation `iam.kubesphere.io/workspacerole`, and there is no per-role member
 * endpoint, so the members collection is read once and counted here — the same choice the
 * platform role detail makes for role bindings.
 *
 * Read-only: role editing (rules) needs the RBAC write path and is not migrated.
 *
 * Both reads go through `apiClient.request` directly instead of extending `api-client`: the
 * shared IAM/token barrel is under parallel change, and these two calls are the only readers
 * of this shape. When the dust settles they belong in `packages/api-client` (see design).
 */
export interface WorkspaceRoleDetailPageProps {
  workspace: string;
  /** Role object name (the route's `$name`). */
  name: string;
}

interface KubeWorkspaceRoleDetail {
  metadata?: {
    name?: string;
    creationTimestamp?: string;
    annotations?: Record<string, string>;
  };
  rules?: Array<Record<string, unknown>>;
}

interface KubeWorkspaceMember {
  metadata?: {
    name?: string;
    annotations?: Record<string, string>;
  };
}

/** One rule, as the table shows it: every list joined for one cell. */
interface RoleRuleRow {
  apiGroups: string;
  resources: string;
  verbs: string;
}

function joinList(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(', ');
  return value === undefined || value === null ? '' : String(value);
}

export function WorkspaceRoleDetailPage({ workspace, name }: WorkspaceRoleDetailPageProps): React.ReactElement {
  const t = useT();

  const roleQuery = useQuery({
    queryKey: ['workspace-role-detail', workspace, name],
    queryFn: async ({ signal }): Promise<{
      name: string;
      alias: string;
      description: string;
      creator: string;
      createdAt: string;
      rules: RoleRuleRow[];
    }> => {
      const body = await apiClient.request<KubeWorkspaceRoleDetail>(
        `/kapis/iam.kubesphere.io/v1alpha2/workspaces/${encodeURIComponent(workspace)}/workspaceroles/${encodeURIComponent(name)}`,
        signal ? { signal } : {},
      );
      const annotations = body?.metadata?.annotations ?? {};
      return {
        name: body?.metadata?.name ?? name,
        alias: annotations['kubesphere.io/alias-name'] ?? '',
        description: annotations['kubesphere.io/description'] ?? '',
        creator: annotations['kubesphere.io/creator'] ?? '',
        createdAt: body?.metadata?.creationTimestamp ?? '',
        rules: (body?.rules ?? []).map((rule) => ({
          apiGroups: joinList(rule['apiGroups']),
          resources: joinList(rule['resources']),
          verbs: joinList(rule['verbs']),
        })),
      };
    },
  });

  /**
   * Members holding this role.
   *
   * A failure here must not fail the page: the role's rules are still readable and are the
   * reason the reader opened it. The section says the member data is unavailable instead.
   */
  const membersQuery = useQuery({
    queryKey: ['workspace-role-members', workspace, name],
    queryFn: async ({ signal }): Promise<string[]> => {
      const body = await apiClient.request<{ items?: KubeWorkspaceMember[] }>(
        `/kapis/iam.kubesphere.io/v1alpha2/workspaces/${encodeURIComponent(workspace)}/workspacemembers`,
        { query: { limit: -1 }, ...(signal ? { signal } : {}) },
      );
      return (body?.items ?? [])
        .filter((item) => (item.metadata?.annotations ?? {})['iam.kubesphere.io/workspacerole'] === name)
        .map((item) => item.metadata?.name ?? '')
        .filter(Boolean);
    },
  });

  const role = roleQuery.data;
  const state = roleQuery.isPending ? 'loading' : roleQuery.isError ? 'error' : 'ready';

  return (
    <AiSurface as="section" aiId="workspace-role-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link
          to="/kube-frontend/workspaces/$workspace/roles"
          params={{ workspace }}
          className="text-sm text-ai-link hover:underline"
          data-ai-id="workspace-role-detail:back"
        >
          ← {t('workspace.roles.title')}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-ai-fg" data-ai-id="workspace-role-detail:title">
            {role?.alias || role?.name || name}
          </h1>
          {role?.alias ? <span className="font-mono text-[11px] text-ai-fg-muted">{role.name}</span> : null}
        </div>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel
          error={roleQuery.error}
          onRetry={() => void roleQuery.refetch()}
          retryAiId="workspace-role-detail:retry"
        />
      ) : null}

      {role ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="workspace-role-detail:basic">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workspace.detail.basic')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow label={t('workspace.detail.name')} value={role.name} aiId="workspace-role-detail:name" />
              <DefinitionRow label={t('workspace.detail.alias')} value={role.alias} aiId="workspace-role-detail:alias" />
              <DefinitionRow label={t('workspace.detail.creator')} value={role.creator} aiId="workspace-role-detail:creator" />
              <DefinitionRow
                label={t('workspace.detail.createdAt')}
                value={role.createdAt ? formatTimestamp(role.createdAt) : ''}
                aiId="workspace-role-detail:created-at"
              />
            </dl>
            <dl className="mt-2 grid grid-cols-1 gap-y-2 text-sm">
              <DefinitionRow label={t('workspace.detail.description')} value={role.description} aiId="workspace-role-detail:description" />
            </dl>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="workspace-role-detail:members">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">
              {t('platform.roles.subjects')}{' '}
              <span className="tabular-nums text-ai-fg-muted" data-ai-id="workspace-role-detail:member-count">
                {membersQuery.data?.length ?? 0}
              </span>
            </h2>
            {membersQuery.isPending ? <Skeleton className="h-10 w-full" /> : null}
            {membersQuery.isError ? (
              <p className="text-xs text-ai-fg-muted">{t('workspace.detail.membersUnavailable')}</p>
            ) : null}
            {membersQuery.data && membersQuery.data.length === 0 ? (
              // "this workspace has no members" would be wrong here: the space has members,
              // this role simply has none of them. Say what is actually empty.
              <p className="text-xs text-ai-fg-muted">{t('platform.roles.noSubjects')}</p>
            ) : null}
            {membersQuery.data && membersQuery.data.length > 0 ? (
              <ul className="flex flex-col divide-y divide-ai-line text-xs" data-ai-id="workspace-role-detail:member-list">
                {membersQuery.data.map((username) => (
                  <li key={username} className="py-1.5 font-mono text-ai-fg-secondary" data-ai-row={username}>
                    {username}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="workspace-role-detail:rules">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">
              {t('settings.roles.rules')}{' '}
              <span className="tabular-nums text-ai-fg-muted" data-ai-id="workspace-role-detail:rule-count">
                {role.rules.length}
              </span>
            </h2>
            {role.rules.length === 0 ? (
              <p className="text-xs text-ai-fg-muted" data-ai-id="workspace-role-detail:empty-rules">
                {t('settings.roles.noRules')}
              </p>
            ) : (
              <table className="w-full border-collapse text-xs" data-ai-id="workspace-role-detail:rule-table">
                <thead>
                  <tr className="border-b border-ai-line text-ai-fg-muted">
                    <th scope="col" className="px-2 py-2 text-left font-medium">
                      {t('settings.roles.ruleApiGroups')}
                    </th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">
                      {t('settings.roles.ruleResources')}
                    </th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">
                      {t('settings.roles.ruleVerbs')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {role.rules.map((rule, index) => (
                    <tr key={`${index}-${rule.resources}`} className="border-b border-ai-line" data-ai-row={String(index)}>
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

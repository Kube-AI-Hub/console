import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { rolesApi, type RoleDetail, type RoleRule } from '@kube-ai-hub/api-client';
import { AiSurface, Button, Skeleton, cn } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';

/**
 * 项目角色详情.
 *
 * Two tabs, as the old console's `/projects/:namespace/roles/:name`:
 * - 权限规则: what the role grants, read from the role object itself;
 * - 已授权用户: the subjects its RoleBindings point at.
 *
 * The old console's second tab read `users?role=<name>`, which only covers user subjects.
 * RoleBindings are the authority: they also carry ServiceAccounts and Groups, and they are
 * the object an administrator actually edits. Reading them directly means this page cannot
 * report "no authorized users" for a role that a ServiceAccount holds.
 *
 * Read-only, deliberately: the role/rules editors and the binding mutations are separate
 * features (and the cluster currently rejects writes through a broken webhook), so this page
 * is a place to read what is granted, not to change it.
 */
export interface RoleDetailPageProps {
  workspace: string;
  cluster: string;
  namespace: string;
  /** Role object name from the route. */
  name: string;
}

interface KubeRoleBinding {
  metadata?: { name?: string; namespace?: string };
  roleRef?: { kind?: string; name?: string };
  subjects?: Array<{ kind?: string; name?: string; namespace?: string }>;
}

/** One authorized subject, with the binding that grants the role to it. */
interface RoleSubjectRow {
  kind: string;
  name: string;
  namespace: string;
  /** The binding object that carries this subject, kept for a stable row key. */
  binding: string;
}

type RoleTab = 'rules' | 'users';

const TAB_LABEL_KEYS: Record<RoleTab, 'settings.roles.rules' | 'platform.roles.subjects'> = {
  rules: 'settings.roles.rules',
  users: 'platform.roles.subjects',
};

export function RoleDetailPage({ workspace, cluster, namespace, name }: RoleDetailPageProps): React.ReactElement {
  const t = useT();
  const [activeTab, setActiveTab] = React.useState<RoleTab>('rules');

  const roleQuery = useQuery({
    queryKey: ['project-role-detail', cluster, namespace, name],
    queryFn: ({ signal }) => rolesApi(apiClient).get({ cluster, namespace, name, signal }),
  });

  /**
   * The role's bindings.
   *
   * Read from the native RBAC group, not IAM: RoleBindings are `rbac.authorization.k8s.io`
   * objects, and ks-apiserver forwards the namespaced path. There is no per-role endpoint,
   * so the namespace's bindings are listed once and filtered on `roleRef.name` — the same
   * shape the platform role detail uses one scope up.
   *
   * A failure here must not fail the page: the rules tab is still valid, and the users tab
   * says the authorization data is unavailable instead of pretending the role is unbound.
   */
  const bindingsQuery = useQuery({
    queryKey: ['project-role-bindings', cluster, namespace, name],
    queryFn: async ({ signal }): Promise<RoleSubjectRow[]> => {
      const path = `/apis/rbac.authorization.k8s.io/v1/namespaces/${encodeURIComponent(namespace)}/rolebindings`;
      const body = await apiClient.request<{ items?: KubeRoleBinding[] }>(path, signal ? { signal } : {});
      const rows: RoleSubjectRow[] = [];
      for (const binding of body?.items ?? []) {
        if (binding.roleRef?.name !== name) continue;
        const bindingName = binding.metadata?.name ?? '';
        for (const subject of binding.subjects ?? []) {
          const subjectName = subject.name ?? '';
          if (!subjectName) continue;
          rows.push({
            kind: subject.kind ?? '',
            name: subjectName,
            namespace: subject.namespace ?? '',
            binding: bindingName,
          });
        }
      }
      return rows;
    },
  });

  const role: RoleDetail | undefined = roleQuery.data;
  const state = roleQuery.isPending ? 'loading' : roleQuery.isError ? 'error' : 'ready';
  const subjects = bindingsQuery.data ?? [];

  return (
    <AiSurface as="section" aiId="project-role-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link
          to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/roles"
          params={{ workspace, cluster, namespace }}
          className="text-sm text-ai-link hover:underline"
          data-ai-id="project-role-detail:back"
        >
          ← {t('settings.roles.title')}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-ai-fg" data-ai-id="project-role-detail:title">
            {role?.alias || role?.name || name}
          </h1>
          {role?.alias ? <span className="font-mono text-[11px] text-ai-fg-muted">{role.name}</span> : null}
        </div>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={roleQuery.error} onRetry={() => void roleQuery.refetch()} retryAiId="project-role-detail:retry" />
      ) : null}

      {role ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="project-role-detail:basic">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('projectInfo.attributes')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow label={t('projectInfo.field.name')} value={role.name} aiId="project-role-detail:name" />
              <DefinitionRow label={t('projectInfo.field.alias')} value={role.alias} aiId="project-role-detail:alias" />
              <DefinitionRow label={t('projectInfo.field.creator')} value={role.creator} aiId="project-role-detail:creator" />
              <DefinitionRow
                label={t('projectInfo.field.createdAt')}
                value={role.createdAt ? formatTimestamp(role.createdAt) : ''}
                aiId="project-role-detail:created-at"
              />
            </dl>
            <dl className="mt-2 grid grid-cols-1 gap-y-2 text-sm">
              <DefinitionRow
                label={t('projectInfo.field.description')}
                value={role.description}
                aiId="project-role-detail:description"
              />
            </dl>
          </section>

          <div role="tablist" aria-label={t('settings.roles.title')} className="flex flex-wrap gap-1 border-b border-ai-line">
            {(['rules', 'users'] as const).map((tab) => {
              const selected = tab === activeTab;
              return (
                <Button
                  key={tab}
                  role="tab"
                  size="sm"
                  variant="ghost"
                  aria-selected={selected}
                  data-ai-id={`project-role-detail:tab:${tab}`}
                  className={cn(
                    'rounded-none border-b-2 px-3',
                    selected ? 'border-ai-accent text-ai-accent' : 'border-transparent text-ai-fg-muted',
                  )}
                  onClick={() => setActiveTab(tab)}
                >
                  {t(TAB_LABEL_KEYS[tab])}
                  <span className="ml-1 tabular-nums text-[11px] text-ai-fg-faint">
                    {tab === 'rules' ? (role.rules ?? []).length : subjects.length}
                  </span>
                </Button>
              );
            })}
          </div>

          {activeTab === 'rules' ? <RulesTable rules={role.rules ?? []} /> : (
            <UsersTable
              subjects={subjects}
              pending={bindingsQuery.isPending}
              failed={bindingsQuery.isError}
              onRetry={() => void bindingsQuery.refetch()}
            />
          )}
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}

/** 规则 tab: one row per rule, the three dimensions the Role object carries. */
function RulesTable({ rules }: { rules: RoleRule[] }): React.ReactElement {
  const t = useT();
  return (
    <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="project-role-detail:rules">
      <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('settings.roles.rules')}</h2>
      {rules.length === 0 ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id="project-role-detail:empty-rules">
          {t('settings.roles.noRules')}
        </p>
      ) : (
        <table className="w-full border-collapse text-xs" data-ai-id="project-role-detail:rule-table">
          <thead>
            <tr className="border-b border-ai-line text-ai-fg-muted">
              <th scope="col" className="px-2 py-2 text-left font-medium">{t('settings.roles.ruleApiGroups')}</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">{t('settings.roles.ruleResources')}</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">{t('settings.roles.ruleVerbs')}</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, index) => (
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
  );
}

/** 已授权用户 tab: one row per subject of every binding that points at this role. */
function UsersTable({
  subjects,
  pending,
  failed,
  onRetry,
}: {
  subjects: RoleSubjectRow[];
  pending: boolean;
  failed: boolean;
  onRetry: () => void;
}): React.ReactElement {
  const t = useT();
  return (
    <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="project-role-detail:users">
      <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('platform.roles.subjects')}</h2>
      {pending ? <Skeleton className="h-16 w-full" /> : null}
      {failed ? (
        <div className="flex flex-col items-start gap-2" data-ai-id="project-role-detail:users-unavailable">
          <p className="text-xs text-ai-fg-muted">{t('platform.roles.subjectsUnavailable')}</p>
          <Button size="sm" variant="secondary" data-ai-id="project-role-detail:users-retry" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}
      {!pending && !failed && subjects.length === 0 ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id="project-role-detail:users-empty">
          {t('platform.roles.noSubjects')}
        </p>
      ) : null}
      {!pending && !failed && subjects.length > 0 ? (
        <table className="w-full border-collapse text-xs" data-ai-id="project-role-detail:user-table">
          <thead>
            <tr className="border-b border-ai-line text-ai-fg-muted">
              <th scope="col" className="px-2 py-2 text-left font-medium">{t('cluster.customResources.kind')}</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">{t('projectInfo.field.name')}</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">{t('cluster.logCollections.namespace')}</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject) => (
              <tr key={`${subject.binding}/${subject.kind}/${subject.name}`} className="border-b border-ai-line" data-ai-row={`${subject.kind}/${subject.name}`}>
                <td className="px-2 py-2 text-ai-fg-secondary">{subject.kind || '-'}</td>
                <td className="px-2 py-2 font-mono text-[11px]">
                  {subject.kind === 'User' ? (
                    // Only a User has a detail page in this console; a ServiceAccount or
                    // Group subject is shown as text rather than linking to a 404.
                    <Link
                      to="/kube-frontend/access/users/$name"
                      params={{ name: subject.name }}
                      className="text-ai-link hover:underline"
                      data-ai-id={`project-role-detail:user:${subject.name}`}
                    >
                      {subject.name}
                    </Link>
                  ) : (
                    <span className="text-ai-fg-secondary" data-ai-id={`project-role-detail:user:${subject.name}`}>
                      {subject.name}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-ai-fg-muted">{subject.namespace || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

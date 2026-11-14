import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ApiError } from '@kube-ai-hub/api-client';
import { AiButton, AiSurface, Button, Skeleton, cn } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel, errorMessage } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';

/**
 * DevOps 工程详情（骨架）.
 *
 * Basic information plus the three project-scoped collections the old console put on tabs.
 * The devops project is a cluster-scoped CRD, so the basic read needs no workspace; the
 * member/role/credential endpoints resolve the project by name under their own API groups
 * (IAM for the first two, the devops group for credentials).
 *
 * Every tab is an independent read on purpose: this cluster currently has no devops project,
 * and even when one exists an unreadable collection must not hide the others. A tab that
 * cannot be read says why and offers a retry; it never renders an empty table to imply
 * 'there is nothing'.
 */
export interface DevopsProjectDetailPageProps {
  cluster: string;
  name: string;
}

type DevopsTab = 'members' | 'roles' | 'credentials';

const TAB_LABEL_KEYS: Record<DevopsTab, 'devops.detail.members' | 'devops.detail.roles' | 'devops.detail.credentials'> = {
  members: 'devops.detail.members',
  roles: 'devops.detail.roles',
  credentials: 'devops.detail.credentials',
};

const MEMBERS_PATH = (name: string) => `/kapis/iam.kubesphere.io/v1alpha2/devops/${encodeURIComponent(name)}/members`;
const ROLES_PATH = (name: string) => `/kapis/iam.kubesphere.io/v1alpha2/devops/${encodeURIComponent(name)}/roles`;
const CREDENTIALS_PATH = (name: string) => `/kapis/devops.kubesphere.io/v1alpha3/devops/${encodeURIComponent(name)}/credentials`;

interface KubeMeta {
  name?: string;
  creationTimestamp?: string;
  annotations?: Record<string, string>;
  labels?: Record<string, string>;
}

interface KubeDevopsProject {
  metadata?: KubeMeta;
}

interface KubeCollectionItem {
  metadata?: KubeMeta;
  rules?: unknown[];
  type?: string;
  kind?: string;
}

async function listCollection(path: string, signal: AbortSignal | undefined): Promise<KubeCollectionItem[]> {
  const body = await apiClient.request<{ items?: KubeCollectionItem[] }>(path, {
    query: { limit: -1 },
    ...(signal ? { signal } : {}),
  });
  return body?.items ?? [];
}

export function DevopsProjectDetailPage({ cluster, name }: DevopsProjectDetailPageProps): React.ReactElement {
  const t = useT();
  const [activeTab, setActiveTab] = React.useState<DevopsTab>('members');

  const project = useQuery({
    queryKey: ['devops-project', name],
    queryFn: async ({ signal }): Promise<KubeDevopsProject> => {
      return apiClient.request<KubeDevopsProject>(`/apis/devops.kubesphere.io/v1alpha3/devopsprojects/${encodeURIComponent(name)}`, {
        ...(signal ? { signal } : {}),
      });
    },
  });
  const members = useQuery({
    queryKey: ['devops-members', name],
    queryFn: ({ signal }) => listCollection(MEMBERS_PATH(name), signal),
    retry: false,
  });
  const roles = useQuery({
    queryKey: ['devops-roles', name],
    queryFn: ({ signal }) => listCollection(ROLES_PATH(name), signal),
    retry: false,
  });
  const credentials = useQuery({
    queryKey: ['devops-credentials', name],
    queryFn: ({ signal }) => listCollection(CREDENTIALS_PATH(name), signal),
    retry: false,
  });

  const meta = project.data?.metadata ?? {};
  const annotations = meta.annotations ?? {};
  const missing = project.error instanceof ApiError && project.error.isNotFound;
  const state = project.isPending ? 'loading' : project.isError ? 'error' : 'ready';

  return (
    <AiSurface as="section" aiId="devops-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link
          to="/kube-frontend/clusters/$cluster/devops"
          params={{ cluster }}
          className="text-sm text-ai-accent hover:underline"
          data-ai-id="devops-detail:back"
        >
          ← {t('devops.list.title')}
        </Link>
        <h1 className="text-lg font-semibold text-ai-fg" data-ai-id="devops-detail:title">
          {meta.name || name}
        </h1>
        <p className="text-xs text-ai-fg-muted">{t('devops.list.description')}</p>
      </header>

      {state === 'loading' ? <Skeleton className="h-32 w-full" /> : null}
      {missing ? (
        <div className="rounded-ai-md border border-ai-line p-8" data-ai-id="devops-detail:not-found">
          <p className="text-sm font-medium text-ai-fg">{t('error.notFound')}</p>
          <p className="mt-1 text-xs text-ai-fg-muted">{errorMessage(t, project.error)}</p>
        </div>
      ) : null}
      {state === 'error' && !missing ? (
        <ResourceErrorPanel error={project.error} onRetry={() => void project.refetch()} retryAiId="devops-detail:retry" />
      ) : null}

      {!missing && project.data ? (
        <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="devops-detail:basic">
          <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workspace.detail.basic')}</h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <DefinitionRow label={t('cluster.column.name')} value={meta.name || name} aiId="devops-detail:name" />
            <DefinitionRow
              label={t('projectInfo.field.workspace')}
              value={meta.labels?.['kubesphere.io/workspace'] ?? ''}
              aiId="devops-detail:workspace"
            />
            <DefinitionRow label={t('workspace.detail.creator')} value={annotations['kubesphere.io/creator'] ?? ''} aiId="devops-detail:creator" />
            <DefinitionRow
              label={t('cluster.column.createdAt')}
              value={meta.creationTimestamp ? formatTimestamp(meta.creationTimestamp) : ''}
              aiId="devops-detail:created-at"
            />
          </dl>
          <dl className="mt-2 grid grid-cols-1 gap-y-2 text-sm">
            <DefinitionRow
              label={t('projectInfo.field.description')}
              value={annotations['kubesphere.io/description'] ?? ''}
              aiId="devops-detail:description"
            />
          </dl>
        </section>
      ) : null}

      <div role="tablist" aria-label={t('devops.list.title')} className="flex flex-wrap gap-1 border-b border-ai-line">
        {(['members', 'roles', 'credentials'] as const).map((tab) => {
          const selected = tab === activeTab;
          return (
            <Button
              key={tab}
              role="tab"
              size="sm"
              variant="ghost"
              aria-selected={selected}
              data-ai-id={`devops-detail:tab:${tab}`}
              className={cn(
                'rounded-none border-b-2 px-3',
                selected ? 'border-ai-accent text-ai-accent' : 'border-transparent text-ai-fg-muted',
              )}
              onClick={() => setActiveTab(tab)}
            >
              {t(TAB_LABEL_KEYS[tab])}
            </Button>
          );
        })}
      </div>

      {activeTab === 'members' ? (
        <CollectionPanel
          tab="members"
          query={members}
          emptyKey="devops.detail.membersEmpty"
          columns={[t('workspace.field.member'), t('workspace.field.role')]}
          rows={members.data ?? []}
          renderRow={(item) => ({
            key: item.metadata?.name ?? '',
            name: item.metadata?.name ?? '',
            cells: [
              item.metadata?.name ?? '-',
              (item.metadata?.annotations ?? {})['iam.kubesphere.io/devopsrole'] || '-',
            ],
          })}
        />
      ) : null}
      {activeTab === 'roles' ? (
        <CollectionPanel
          tab="roles"
          query={roles}
          emptyKey="devops.detail.rolesEmpty"
          columns={[t('cluster.column.name'), t('platform.column.ruleCount')]}
          rows={roles.data ?? []}
          renderRow={(item) => ({
            key: item.metadata?.name ?? '',
            name: item.metadata?.name ?? '',
            cells: [
              (item.metadata?.annotations ?? {})['kubesphere.io/alias-name'] || item.metadata?.name || '-',
              String((item.rules ?? []).length),
            ],
          })}
        />
      ) : null}
      {activeTab === 'credentials' ? (
        <CollectionPanel
          tab="credentials"
          query={credentials}
          emptyKey="devops.detail.credentialsEmpty"
          columns={[t('cluster.column.name'), t('cluster.customResources.kind'), t('cluster.column.createdAt')]}
          rows={credentials.data ?? []}
          renderRow={(item) => ({
            key: item.metadata?.name ?? '',
            name: item.metadata?.name ?? '',
            cells: [
              item.metadata?.name ?? '-',
              item.type || item.kind || '-',
              item.metadata?.creationTimestamp ? formatTimestamp(item.metadata.creationTimestamp) : '-',
            ],
          })}
        />
      ) : null}
    </AiSurface>
  );
}

/**
 * One tab panel: loading, failure with reason+retry, empty copy, or the rows.
 *
 * The failure state is its own branch (not the list's empty state) because a 403/404 on
 * members must not read as "this project has no members".
 */
function CollectionPanel({
  tab,
  query,
  emptyKey,
  columns,
  rows,
  renderRow,
}: {
  tab: DevopsTab;
  query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => void };
  emptyKey: 'devops.detail.membersEmpty' | 'devops.detail.rolesEmpty' | 'devops.detail.credentialsEmpty';
  columns: string[];
  rows: unknown[];
  renderRow: (item: KubeCollectionItem) => { key: string; name: string; cells: string[] };
}): React.ReactElement {
  const t = useT();
  const rendered = (rows as KubeCollectionItem[]).map(renderRow);
  return (
    <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id={`devops-detail:${tab}`}>
      {query.isPending ? <Skeleton className="h-16 w-full" /> : null}
      {query.isError ? (
        <div className="flex flex-col items-start gap-2" data-ai-id={`devops-detail:${tab}-error`}>
          <p className="text-xs text-ai-fg-muted">{errorMessage(t, query.error)}</p>
          <AiButton aiId={`devops-detail:${tab}-retry`} size="sm" variant="secondary" onClick={() => query.refetch()}>
            {t('common.retry')}
          </AiButton>
        </div>
      ) : null}
      {!query.isPending && !query.isError && rendered.length === 0 ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id={`devops-detail:${tab}-empty`}>
          {t(emptyKey)}
        </p>
      ) : null}
      {!query.isPending && !query.isError && rendered.length > 0 ? (
        <table className="w-full border-collapse text-xs" data-ai-id={`devops-detail:${tab}-table`}>
          <thead>
            <tr className="border-b border-ai-line text-ai-fg-muted">
              {columns.map((column) => (
                <th key={column} scope="col" className="px-2 py-2 text-left font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rendered.map((row) => (
              <tr key={row.key} className="border-b border-ai-line" data-ai-row={row.name}>
                {row.cells.map((cell, index) => (
                  <td key={`${row.key}-${index}`} className="px-2 py-2 font-mono text-[11px] text-ai-fg-secondary">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

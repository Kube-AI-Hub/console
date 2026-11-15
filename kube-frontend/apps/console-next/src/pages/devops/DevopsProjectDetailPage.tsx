import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  ApiError,
  devopsApi,
  devopsCollectionsApi,
  devopsProjectNamespace,
  type CdApplicationSummary,
  type CodeRepositorySummary,
  type CredentialKind,
  type CredentialRow,
  type DevopsProjectSummary,
  type MemberRow,
  type PipelineDraft,
  type PipelineRow,
  type RoleRow,
} from '@kube-ai-hub/api-client';
import {
  AiButton,
  AiSurface,
  Badge,
  Button,
  Input,
  Select,
  Skeleton,
  Tabs,
  TabsContent,
  cn,
  type SelectOption,
  type TabItem,
} from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';
import { useAuth } from '@/shell/AuthProvider';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel, errorMessage } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { formatTimestamp } from '@/lib/time';
import { healthBand, healthTone } from './format';
import {
  CdAllowlistDialog,
  CodeRepoFormDialog,
  CredentialFormDialog,
  MemberInviteDialog,
  MemberRoleDialog,
  PipelineFormDialog,
} from './components/DevopsDialogs';

/**
 * DevOps 工程详情.
 *
 * Seven tabs, in the old console's order (devopsNavs: management → pipelines → cd →
 * code-repo → members → roles → credentials), with the default tab being 基本信息 —
 * the old index route redirected to base-info. The tab list is data, not JSX, so the
 * order and the labels live in one place.
 *
 * Every tab is an independent read on purpose: an unreadable collection must not hide the
 * others, and a tab that cannot be read says why and offers a retry instead of rendering an
 * empty table that would read as "there is nothing".
 *
 * The three pipeline collections are namespaced and read the project's
 * status.adminNamespace (falling back to the project name); members, roles and credentials
 * resolve the project by name under their own API groups.
 */
export interface DevopsProjectDetailPageProps {
  cluster: string;
  name: string;
}

type DevopsTab = 'base-info' | 'pipelines' | 'cd' | 'code-repo' | 'members' | 'roles' | 'credentials';

/** Tab order follows the old console's devopsNavs. */
const TAB_ORDER: readonly DevopsTab[] = [
  'base-info',
  'pipelines',
  'cd',
  'code-repo',
  'members',
  'roles',
  'credentials',
];

const TAB_LABEL_KEYS: Record<DevopsTab, string> = {
  'base-info': 'devops.tab.baseInfo',
  pipelines: 'devops.detail.pipelines',
  cd: 'devops.detail.cd',
  'code-repo': 'devops.detail.codeRepos',
  members: 'devops.detail.members',
  roles: 'devops.detail.roles',
  credentials: 'devops.detail.credentials',
};

const PAGE_SIZES = [10, 20, 50];

/** The pipeline type filter, matching the old console's KIND filter. */
const PIPELINE_TYPE_VALUES = ['pipeline', 'multi-branch-pipeline'];

export function DevopsProjectDetailPage({ cluster, name }: DevopsProjectDetailPageProps): React.ReactElement {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tab, setTab] = React.useState<DevopsTab>('base-info');
  const [editingProject, setEditingProject] = React.useState(false);
  const [deletingProject, setDeletingProject] = React.useState(false);
  const [editingAllowlist, setEditingAllowlist] = React.useState(false);

  /* ---- pipeline list state (server-side paging, search and filter) ---- */
  const [keyword, setKeyword] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [pipelineForm, setPipelineForm] = React.useState<{ mode: 'create' | 'edit' | 'copy'; row: PipelineRow | null } | null>(
    null,
  );
  const [deletingPipeline, setDeletingPipeline] = React.useState<PipelineRow | null>(null);
  const [runNotice, setRunNotice] = React.useState('');

  /* The signed-in user: the server refuses role/removal changes on yourself, so the row
   * shows that rule instead of an action that can only fail (old console: 不能操作自己). */
  const { user } = useAuth();
  const currentUsername = user?.name ?? '';

  /* ---- credential / member / code-repo dialog state ---- */
  const [credentialForm, setCredentialForm] = React.useState<{ editing: CredentialRow | null } | null>(null);
  const [deletingCredential, setDeletingCredential] = React.useState<CredentialRow | null>(null);
  const [inviting, setInviting] = React.useState(false);
  const [changingRole, setChangingRole] = React.useState<MemberRow | null>(null);
  const [removingMember, setRemovingMember] = React.useState<MemberRow | null>(null);
  const [codeRepoForm, setCodeRepoForm] = React.useState(false);
  const [deletingCodeRepo, setDeletingCodeRepo] = React.useState<CodeRepositorySummary | null>(null);

  const project = useQuery({
    queryKey: ['devops-project', name],
    queryFn: ({ signal }) => devopsApi(apiClient).project({ name, signal }),
    retry: false,
  });

  const namespace = project.data ? devopsProjectNamespace(project.data.raw, name) : name;

  const members = useQuery({
    queryKey: ['devops-members', name],
    queryFn: ({ signal }) => devopsApi(apiClient).members({ project: name, signal }),
    retry: false,
  });
  const roles = useQuery({
    queryKey: ['devops-roles', name],
    queryFn: ({ signal }) => devopsApi(apiClient).roles({ project: name, signal }),
    retry: false,
  });
  const pipelines = useQuery({
    queryKey: ['devops-pipelines', name, page, pageSize, search, typeFilter],
    queryFn: ({ signal }) =>
      devopsApi(apiClient).pipelines({
        project: name,
        page,
        limit: pageSize,
        ...(search ? { name: search } : {}),
        ...(typeFilter ? { type: typeFilter } : {}),
        signal,
      }),
    retry: false,
    enabled: tab === 'pipelines',
  });
  const cdApplications = useQuery({
    queryKey: ['devops-cd', namespace],
    queryFn: ({ signal }) => devopsCollectionsApi(apiClient).cdApplications({ cluster, namespace, signal }),
    retry: false,
    enabled: tab === 'cd',
  });
  const codeRepositories = useQuery({
    queryKey: ['devops-code-repos', namespace],
    queryFn: ({ signal }) => devopsCollectionsApi(apiClient).codeRepositories({ cluster, namespace, signal }),
    retry: false,
    enabled: tab === 'code-repo',
  });
  const credentials = useQuery({
    queryKey: ['devops-credentials', namespace],
    queryFn: ({ signal }) => devopsApi(apiClient).credentials({ namespace, signal }),
    retry: false,
    enabled: tab === 'credentials',
  });

  const invalidateProject = () => queryClient.invalidateQueries({ queryKey: ['devops-project', name] });
  const invalidatePipelines = () => queryClient.invalidateQueries({ queryKey: ['devops-pipelines', name] });
  const invalidateCredentials = () => queryClient.invalidateQueries({ queryKey: ['devops-credentials', namespace] });
  const invalidateMembers = () => queryClient.invalidateQueries({ queryKey: ['devops-members', name] });
  const invalidateCodeRepos = () => queryClient.invalidateQueries({ queryKey: ['devops-code-repos', namespace] });

  /** Every write reports the server message in the dialog that started it. */
  const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

  const saveProject = useMutation({
    mutationFn: (input: { alias: string; description: string }) =>
      devopsApi(apiClient).updateProject({
        name,
        alias: input.alias,
        description: input.description,
        current: project.data?.raw ?? {},
      }),
    onSuccess: async () => {
      await invalidateProject();
      setEditingProject(false);
    },
  });

  const deleteProject = useMutation({
    mutationFn: () => devopsApi(apiClient).deleteProject(name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['devops-projects'] });
      setDeletingProject(false);
      void navigate({ to: '/kube-frontend/clusters/$cluster/devops', params: { cluster } });
    },
  });

  const saveAllowlist = useMutation({
    mutationFn: (next: { sourceRepos: string[]; destinations: { name: string; namespace: string; server: string }[] }) => {
      const current = JSON.parse(JSON.stringify(project.data?.raw ?? {})) as Record<string, unknown>;
      const spec = (current.spec ?? {}) as Record<string, unknown>;
      spec.argo = { sourceRepos: next.sourceRepos, destinations: next.destinations };
      current.spec = spec;
      return apiClient.request<unknown>('/apis/devops.kubesphere.io/v1alpha3/devopsprojects/' + encodeURIComponent(name), {
        method: 'PUT',
        body: current,
      });
    },
    onSuccess: async () => {
      await invalidateProject();
      setEditingAllowlist(false);
    },
  });

  const savePipeline = useMutation({
    mutationFn: (draft: PipelineDraft) => {
      const mode = pipelineForm?.mode ?? 'create';
      if (mode === 'edit' && pipelineForm?.row) {
        return devopsApi(apiClient).updatePipeline({
          project: name,
          name: pipelineForm.row.name,
          alias: draft.alias,
          description: draft.description,
          jenkinsfile: draft.jenkinsfile,
          current: pipelineForm.row.raw,
        });
      }
      return devopsApi(apiClient).createPipeline(name, draft);
    },
    onSuccess: async () => {
      await invalidatePipelines();
      setPipelineForm(null);
    },
  });

  const removePipeline = useMutation({
    mutationFn: (row: PipelineRow) => devopsApi(apiClient).deletePipeline(name, row.name),
    onSuccess: async () => {
      await invalidatePipelines();
      setDeletingPipeline(null);
    },
  });

  /**
   * Trigger a run.
   *
   * The request chain is verifiable here: the PipelineRun object is created and the list is
   * re-read. Whether Jenkins actually executes it is a controller concern, so the page shows
   * the object's own `status.message` after the refresh instead of claiming success.
   */
  const runPipeline = useMutation({
    mutationFn: (row: PipelineRow) =>
      devopsApi(apiClient).runPipeline({ namespace, pipeline: row.name }),
    onSuccess: async (created, requested) => {
      await invalidatePipelines();
      const createdName = ((created.metadata ?? {}) as { name?: string }).name ?? '';
      setRunNotice(t('devops.pipeline.runRequested', { name: createdName || requested.name }));
    },
    onError: (cause) => setRunNotice(messageOf(cause)),
  });

  const saveCredential = useMutation({
    mutationFn: (draft: { name: string; kind: CredentialKind; description: string; fields: Record<string, string> }) => {
      if (credentialForm?.editing) {
        return devopsApi(apiClient).updateCredential({
          project: name,
          name: credentialForm.editing.name,
          kind: draft.kind,
          fields: draft.fields,
          description: draft.description,
          current: credentialForm.editing.raw,
        });
      }
      return devopsApi(apiClient).createCredential(name, draft, namespace);
    },
    onSuccess: async () => {
      await invalidateCredentials();
      setCredentialForm(null);
    },
  });

  const removeCredential = useMutation({
    mutationFn: (row: CredentialRow) => devopsApi(apiClient).deleteCredential(name, row.name),
    onSuccess: async () => {
      await invalidateCredentials();
      setDeletingCredential(null);
    },
  });

  const invite = useMutation({
    mutationFn: (draft: { username: string; roleRef: string }) =>
      devopsApi(apiClient).inviteMembers(name, [draft]),
    onSuccess: async () => {
      await invalidateMembers();
      setInviting(false);
    },
  });

  const changeRole = useMutation({
    mutationFn: (input: { username: string; roleRef: string }) =>
      devopsApi(apiClient).changeMemberRole(name, input.username, input.roleRef),
    onSuccess: async () => {
      await invalidateMembers();
      setChangingRole(null);
    },
  });

  const removeMember = useMutation({
    mutationFn: (member: MemberRow) => devopsApi(apiClient).removeMember(name, member.name),
    onSuccess: async () => {
      await invalidateMembers();
      setRemovingMember(null);
    },
  });

  const createCodeRepo = useMutation({
    mutationFn: (draft: { name: string; provider: string; url: string; secretName: string; description: string }) =>
      devopsApi(apiClient).createCodeRepository(namespace, draft),
    onSuccess: async () => {
      await invalidateCodeRepos();
      setCodeRepoForm(false);
    },
  });

  const removeCodeRepo = useMutation({
    mutationFn: (row: CodeRepositorySummary) => devopsApi(apiClient).deleteCodeRepository(namespace, row.name),
    onSuccess: async () => {
      await invalidateCodeRepos();
      setDeletingCodeRepo(null);
    },
  });

  const missing = project.error instanceof ApiError && project.error.isNotFound;
  const state = project.isPending ? 'loading' : project.isError ? 'error' : 'ready';

  const tabItems: TabItem[] = TAB_ORDER.map((entry) => ({
    value: entry,
    label: t(TAB_LABEL_KEYS[entry] as 'devops.tab.baseInfo'),
    aiId: 'devops-detail:tab:' + entry,
    ...(entry === 'members' && members.data ? { count: members.data.length } : {}),
    ...(entry === 'roles' && roles.data ? { count: roles.data.length } : {}),
  }));

  const typeOptions: SelectOption[] = PIPELINE_TYPE_VALUES.map((value) => ({
    value,
    label: value === 'pipeline' ? t('devops.pipeline.kind.pipeline') : t('devops.pipeline.kind.multiBranch'),
  }));

  const pipelineRows = pipelines.data?.items ?? [];
  const pipelineTotal = pipelines.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(pipelineTotal / pageSize));

  return (
    <AiSurface as="section" aiId="devops-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            to="/kube-frontend/clusters/$cluster/devops"
            params={{ cluster }}
            className="text-sm text-ai-accent hover:underline"
            data-ai-id="devops-detail:back"
          >
            {'← ' + t('devops.list.title')}
          </Link>
          <h1 className="text-lg font-semibold text-ai-fg" data-ai-id="devops-detail:title">
            {project.data?.alias || project.data?.name || name}
          </h1>
          <p className="text-xs text-ai-fg-muted" data-ai-id="devops-detail:description">
            {project.data?.description || t('devops.detail.noDescription')}
          </p>
        </div>
        {project.data ? (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" {...actionProps('devops-detail:edit')} onClick={() => setEditingProject(true)}>
              {t('devops.detail.editProject')}
            </Button>
            <Button size="sm" variant="danger" {...actionProps('devops-detail:delete')} onClick={() => setDeletingProject(true)}>
              {t('common.delete')}
            </Button>
          </div>
        ) : null}
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

      {project.data ? (
        <Tabs items={tabItems} value={tab} onValueChange={(value) => setTab(value as DevopsTab)}>
          <TabsContent value="base-info" className="pt-4">
            <BaseInfoPanel
              project={project.data}
              namespace={namespace}
              memberCount={members.data?.length}
              roleCount={roles.data?.length}
              onEditAllowlist={() => setEditingAllowlist(true)}
            />
          </TabsContent>

          <TabsContent value="pipelines" className="pt-4">
            <section className="flex flex-col gap-3 rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="devops-detail:pipelines">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    value={keyword}
                    placeholder={t('devops.pipeline.searchPlaceholder')}
                    aria-label={t('devops.pipeline.searchPlaceholder')}
                    className="w-56"
                    {...actionProps('devops-detail:pipelines-search')}
                    onChange={(event) => {
                      setKeyword(event.target.value);
                      setPage(1);
                      setSearch(event.target.value.trim());
                    }}
                  />
                  <Select
                    value={typeFilter || 'all'}
                    options={[{ value: 'all', label: t('devops.pipeline.allTypes') }, ...typeOptions]}
                    onValueChange={(value) => {
                      setTypeFilter(value === 'all' ? '' : value);
                      setPage(1);
                    }}
                    placeholder={t('devops.pipeline.type')}
                    data-ai-id="devops-detail:pipelines-type"
                  />
                </div>
                <Button size="sm" {...actionProps('devops-detail:pipelines-create')} onClick={() => setPipelineForm({ mode: 'create', row: null })}>
                  {t('devops.pipeline.createTitle')}
                </Button>
              </div>

              {runNotice ? (
                <p className="text-xs text-ai-fg-secondary" data-ai-id="devops-detail:pipelines-notice">
                  {runNotice}
                </p>
              ) : null}

              {pipelines.isPending ? <Skeleton className="h-16 w-full" /> : null}
              {pipelines.isError ? (
                <div className="flex flex-col items-start gap-2" data-ai-id="devops-detail:pipelines-error">
                  <p className="text-xs text-ai-fg-muted">{errorMessage(t, pipelines.error)}</p>
                  <AiButton aiId="devops-detail:pipelines-retry" size="sm" variant="secondary" onClick={() => void pipelines.refetch()}>
                    {t('common.retry')}
                  </AiButton>
                </div>
              ) : null}
              {!pipelines.isPending && !pipelines.isError && pipelineRows.length === 0 ? (
                <p className="text-xs text-ai-fg-muted" data-ai-id="devops-detail:pipelines-empty">
                  {search || typeFilter ? t('devops.pipeline.noMatch') : t('devops.detail.pipelinesEmpty')}
                </p>
              ) : null}

              {!pipelines.isPending && !pipelines.isError && pipelineRows.length > 0 ? (
                <>
                  <table className="w-full border-collapse text-xs" data-ai-id="devops-detail:pipelines-table">
                    <thead>
                      <tr className="border-b border-ai-line text-ai-fg-muted">
                        <th scope="col" className="px-2 py-2 text-left font-medium">{t('devops.field.name')}</th>
                        <th scope="col" className="px-2 py-2 text-left font-medium">{t('devops.pipeline.health')}</th>
                        <th scope="col" className="px-2 py-2 text-left font-medium">{t('devops.pipeline.type')}</th>
                        <th scope="col" className="px-2 py-2 text-left font-medium">{t('devops.pipeline.branchCount')}</th>
                        <th scope="col" className="px-2 py-2 text-left font-medium">{t('devops.pipeline.prCount')}</th>
                        <th scope="col" className="px-2 py-2 text-right font-medium">{t('table.moreActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pipelineRows.map((row) => {
                        const band = healthBand(row.health);
                        return (
                          <tr key={row.name} className="border-b border-ai-line" data-ai-row={row.name}>
                            <td className="px-2 py-2">
                              <Link
                                to="/kube-frontend/clusters/$cluster/devops/$name/pipelines/$pipeline"
                                params={{ cluster, name, pipeline: row.name }}
                                className="font-medium text-ai-accent hover:underline"
                                data-ai-id={'devops-detail:pipeline:' + row.name}
                              >
                                {row.alias || row.name}
                              </Link>
                            </td>
                            <td className="px-2 py-2">
                              <Badge tone={healthTone(band)} data-ai-id={'devops-detail:pipeline-health:' + row.name}>
                                {t(('devops.pipeline.health.' + band) as 'devops.pipeline.health.healthy')}
                              </Badge>
                            </td>
                            <td className="px-2 py-2 text-ai-fg-secondary">
                              {row.type === 'multi-branch-pipeline'
                                ? t('devops.pipeline.kind.multiBranch')
                                : t('devops.pipeline.kind.pipeline')}
                            </td>
                            <td className="px-2 py-2 tabular-nums text-ai-fg-secondary">
                              {typeof row.branchCount === 'number' && (row.type === 'multi-branch-pipeline' || row.branchCount !== 0)
                                ? row.branchCount
                                : '-'}
                            </td>
                            <td className="px-2 py-2 tabular-nums text-ai-fg-secondary">
                              {typeof row.pullRequestCount === 'number' ? row.pullRequestCount : '-'}
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  {...actionProps('devops-detail:pipeline-run:' + row.name)}
                                  onClick={() => runPipeline.mutate(row)}
                                >
                                  {t('devops.pipeline.run')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  {...actionProps('devops-detail:pipeline-edit:' + row.name)}
                                  onClick={() => setPipelineForm({ mode: 'edit', row })}
                                >
                                  {t('common.edit')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  {...actionProps('devops-detail:pipeline-copy:' + row.name)}
                                  onClick={() => setPipelineForm({ mode: 'copy', row })}
                                >
                                  {t('devops.pipeline.copy')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  {...actionProps('devops-detail:pipeline-delete:' + row.name)}
                                  onClick={() => setDeletingPipeline(row)}
                                >
                                  {t('common.delete')}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ai-fg-muted">
                    <span data-ai-id="devops-detail:pipelines-total">{t('devops.pipeline.total', { total: pipelineTotal })}</span>
                    <div className="flex items-center gap-2">
                      <Select
                        value={String(pageSize)}
                        options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
                        onValueChange={(value) => {
                          setPageSize(Number(value));
                          setPage(1);
                        }}
                        placeholder={t('devops.pipeline.pageSize')}
                        data-ai-id="devops-detail:pipelines-page-size"
                      />
                      <Button size="sm" variant="ghost" disabled={page <= 1} {...actionProps('devops-detail:pipelines-prev')} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                        {t('table.previous')}
                      </Button>
                      <span data-ai-id="devops-detail:pipelines-page">{page + ' / ' + pageCount}</span>
                      <Button size="sm" variant="ghost" disabled={page >= pageCount} {...actionProps('devops-detail:pipelines-next')} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>
                        {t('table.next')}
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </section>
          </TabsContent>

          <TabsContent value="cd" className="pt-4">
            <CollectionPanel
              tab="cd"
              query={cdApplications}
              emptyKey="devops.detail.cdEmpty"
              columns={[
                t('devops.field.name'),
                t('devops.detail.healthStatus'),
                t('devops.detail.syncStatus'),
                t('devops.detail.cdDestination'),
              ]}
              rows={cdApplications.data ?? []}
              renderRow={(item: CdApplicationSummary) => ({
                key: item.name,
                name: item.name,
                cells: [item.alias || item.name, item.healthStatus || '-', item.syncStatus || '-', item.destination || '-'],
              })}
            />
          </TabsContent>

          <TabsContent value="code-repo" className="pt-4">
            <section className="flex flex-col gap-3 rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="devops-detail:code-repo">
              <div className="flex justify-end">
                <Button size="sm" {...actionProps('devops-detail:coderepo-create')} onClick={() => setCodeRepoForm(true)}>
                  {t('devops.codeRepo.createTitle')}
                </Button>
              </div>
              <CollectionPanel
                tab="code-repo"
                query={codeRepositories}
                emptyKey="devops.detail.codeReposEmpty"
                columns={[
                  t('devops.field.name'),
                  t('devops.detail.repoProvider'),
                  t('devops.detail.repoURL'),
                  t('devops.codeRepo.secret'),
                  t('table.moreActions'),
                ]}
                rows={codeRepositories.data ?? []}
                renderRow={(item: CodeRepositorySummary) => ({
                  key: item.name,
                  name: item.name,
                  cells: [
                    item.alias || item.name,
                    item.provider || '-',
                    item.url || '-',
                    item.secretName || '-',
                    <Button
                      key={item.name}
                      size="sm"
                      variant="ghost"
                      {...actionProps('devops-detail:coderepo-delete:' + item.name)}
                      onClick={() => setDeletingCodeRepo(item)}
                    >
                      {t('common.delete')}
                    </Button>,
                  ],
                })}
              />
            </section>
          </TabsContent>

          <TabsContent value="members" className="pt-4">
            <section className="flex flex-col gap-3 rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="devops-detail:members">
              <div className="flex justify-end">
                <Button size="sm" {...actionProps('devops-detail:members-invite')} onClick={() => setInviting(true)}>
                  {t('devops.member.invite')}
                </Button>
              </div>
              <CollectionPanel
                tab="members"
                query={members}
                emptyKey="devops.detail.membersEmpty"
                columns={[
                  t('devops.member.username'),
                  t('devops.member.role'),
                  t('devops.member.state'),
                  t('devops.member.lastLogin'),
                  t('table.moreActions'),
                ]}
                rows={members.data ?? []}
                renderRow={(item: MemberRow) => ({
                  key: item.name,
                  name: item.name,
                  cells: [
                    item.name,
                    item.role || '-',
                    item.state || '-',
                    item.lastLoginTime ? formatTimestamp(item.lastLoginTime) : t('devops.member.neverLoggedIn'),
                    item.name === currentUsername ? (
                      <span key={item.name} className="flex justify-end text-xs text-ai-fg-muted" data-ai-id="devops-detail:member-self">
                        {t('devops.member.selfProtected')}
                      </span>
                    ) : (
                      <div key={item.name} className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          {...actionProps('devops-detail:member-role:' + item.name)}
                          onClick={() => setChangingRole(item)}
                        >
                          {t('devops.member.changeRole')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          {...actionProps('devops-detail:member-remove:' + item.name)}
                          onClick={() => setRemovingMember(item)}
                        >
                          {t('devops.member.remove')}
                        </Button>
                      </div>
                    ),
                  ],
                })}
              />
            </section>
          </TabsContent>

          <TabsContent value="roles" className="pt-4">
            <CollectionPanel
              tab="roles"
              query={roles}
              emptyKey="devops.detail.rolesEmpty"
              columns={[
                t('devops.field.name'),
                t('resource.field.alias'),
                t('devops.role.module'),
                t('devops.role.kind'),
                t('cluster.column.createdAt'),
              ]}
              rows={roles.data ?? []}
              renderRow={(item: RoleRow) => ({
                key: item.name,
                name: item.name,
                cells: [
                  item.name,
                  item.alias || '-',
                  item.description || '-',
                  item.preset ? t('devops.role.preset') : item.template ? t('devops.role.template') : t('devops.role.custom'),
                  item.createdAt ? formatTimestamp(item.createdAt) : '-',
                ],
              })}
            />
          </TabsContent>

          <TabsContent value="credentials" className="pt-4">
            <section className="flex flex-col gap-3 rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="devops-detail:credentials">
              <div className="flex justify-end">
                <Button size="sm" {...actionProps('devops-detail:credentials-create')} onClick={() => setCredentialForm({ editing: null })}>
                  {t('devops.credential.createTitle')}
                </Button>
              </div>
              <CollectionPanel
                tab="credentials"
                query={credentials}
                emptyKey="devops.detail.credentialsEmpty"
                columns={[
                  t('devops.field.name'),
                  t('devops.credential.kind.label'),
                  t('devops.credential.username'),
                  t('devops.credential.syncStatus'),
                  t('resource.field.description'),
                  t('table.moreActions'),
                ]}
                rows={credentials.data ?? []}
                renderRow={(item: CredentialRow) => ({
                  key: item.name,
                  name: item.name,
                  cells: [
                    item.name,
                    item.kind
                      ? t(('devops.credential.kind.' + credentialKindKey(item.kind)) as 'devops.credential.kind.usernamePassword')
                      : item.secretType || '-',
                    item.username || '-',
                    item.syncStatus || '-',
                    item.description || '-',
                    <div key={item.name} className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        {...actionProps('devops-detail:credential-edit:' + item.name)}
                        onClick={() => setCredentialForm({ editing: item })}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        {...actionProps('devops-detail:credential-delete:' + item.name)}
                        onClick={() => setDeletingCredential(item)}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>,
                  ],
                })}
              />
            </section>
          </TabsContent>
        </Tabs>
      ) : null}

      {project.data ? (
        <>
          <EditInfoDialog
            open={editingProject}
            onOpenChange={setEditingProject}
            resource="devops-detail"
            name={project.data.name}
            alias={project.data.alias}
            description={project.data.description}
            annotations={(project.data.raw.metadata?.annotations ?? {}) as Record<string, string>}
            pending={saveProject.isPending}
            onSubmit={(annotations) =>
              saveProject.mutate({
                alias: annotations['kubesphere.io/alias-name'] ?? '',
                description: annotations['kubesphere.io/description'] ?? '',
              })
            }
          />
          <DeleteDialog
            open={deletingProject}
            onOpenChange={setDeletingProject}
            names={[project.data.name]}
            resource="devops-detail"
            noun={t('devops.title')}
            pending={deleteProject.isPending}
            {...(deleteProject.error ? { error: messageOf(deleteProject.error) } : {})}
            onConfirm={() => deleteProject.mutate()}
          />
          <CdAllowlistDialog
            open={editingAllowlist}
            onOpenChange={setEditingAllowlist}
            project={project.data}
            pending={saveAllowlist.isPending}
            {...(saveAllowlist.error ? { error: messageOf(saveAllowlist.error) } : {})}
            onSubmit={(next) => saveAllowlist.mutate(next)}
          />
        </>
      ) : null}

      <PipelineFormDialog
        open={pipelineForm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPipelineForm(null);
            savePipeline.reset();
          }
        }}
        editing={pipelineForm?.mode === 'edit' ? pipelineForm.row : null}
        copyFrom={pipelineForm?.mode === 'copy' ? pipelineForm.row : null}
        pending={savePipeline.isPending}
        {...(savePipeline.error ? { error: messageOf(savePipeline.error) } : {})}
        credentialOptions={(credentials.data ?? [])
          .filter((row) => row.kind === 'username_password' || row.kind === 'ssh')
          .map((row) => ({ value: row.name, label: row.name }))}
        onSubmit={(draft) => savePipeline.mutate(draft)}
      />

      <DeleteDialog
        open={deletingPipeline !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingPipeline(null);
        }}
        names={deletingPipeline ? [deletingPipeline.name] : []}
        resource="devops-detail"
        noun={t('devops.detail.pipelines')}
        pending={removePipeline.isPending}
        {...(removePipeline.error ? { error: messageOf(removePipeline.error) } : {})}
        onConfirm={() => {
          if (deletingPipeline) removePipeline.mutate(deletingPipeline);
        }}
      />

      <CredentialFormDialog
        open={credentialForm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCredentialForm(null);
            saveCredential.reset();
          }
        }}
        editing={
          credentialForm?.editing
            ? {
                name: credentialForm.editing.name,
                kind: credentialForm.editing.kind || 'username_password',
                description: credentialForm.editing.description,
                username: credentialForm.editing.username,
              }
            : null
        }
        pending={saveCredential.isPending}
        {...(saveCredential.error ? { error: messageOf(saveCredential.error) } : {})}
        onSubmit={(draft) => saveCredential.mutate(draft)}
      />

      <DeleteDialog
        open={deletingCredential !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingCredential(null);
        }}
        names={deletingCredential ? [deletingCredential.name] : []}
        resource="devops-detail"
        noun={t('devops.detail.credentials')}
        pending={removeCredential.isPending}
        {...(removeCredential.error ? { error: messageOf(removeCredential.error) } : {})}
        onConfirm={() => {
          if (deletingCredential) removeCredential.mutate(deletingCredential);
        }}
      />

      <MemberInviteDialog
        open={inviting}
        onOpenChange={(open) => {
          setInviting(open);
          if (!open) invite.reset();
        }}
        roles={roles.data ?? []}
        pending={invite.isPending}
        {...(invite.error ? { error: messageOf(invite.error) } : {})}
        onSubmit={(draft) => invite.mutate(draft)}
      />

      <MemberRoleDialog
        open={changingRole !== null}
        onOpenChange={(open) => {
          if (!open) {
            setChangingRole(null);
            changeRole.reset();
          }
        }}
        member={changingRole?.name ?? ''}
        currentRole={changingRole?.role ?? ''}
        roles={roles.data ?? []}
        pending={changeRole.isPending}
        {...(changeRole.error ? { error: messageOf(changeRole.error) } : {})}
        onSubmit={(roleRef) => {
          if (changingRole) changeRole.mutate({ username: changingRole.name, roleRef });
        }}
      />

      <DeleteDialog
        open={removingMember !== null}
        onOpenChange={(open) => {
          if (!open) setRemovingMember(null);
        }}
        names={removingMember ? [removingMember.name] : []}
        resource="devops-detail"
        noun={t('devops.detail.members')}
        title={t('devops.member.removeTitle')}
        confirmLabel={t('devops.member.remove')}
        pending={removeMember.isPending}
        {...(removeMember.error ? { error: messageOf(removeMember.error) } : {})}
        onConfirm={() => {
          if (removingMember) removeMember.mutate(removingMember);
        }}
      />

      <CodeRepoFormDialog
        open={codeRepoForm}
        onOpenChange={(open) => {
          setCodeRepoForm(open);
          if (!open) createCodeRepo.reset();
        }}
        pending={createCodeRepo.isPending}
        {...(createCodeRepo.error ? { error: messageOf(createCodeRepo.error) } : {})}
        onSubmit={(draft) => createCodeRepo.mutate(draft)}
      />

      <DeleteDialog
        open={deletingCodeRepo !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingCodeRepo(null);
        }}
        names={deletingCodeRepo ? [deletingCodeRepo.name] : []}
        resource="devops-detail"
        noun={t('devops.detail.codeRepos')}
        pending={removeCodeRepo.isPending}
        {...(removeCodeRepo.error ? { error: messageOf(removeCodeRepo.error) } : {})}
        onConfirm={() => {
          if (deletingCodeRepo) removeCodeRepo.mutate(deletingCodeRepo);
        }}
      />
    </AiSurface>
  );
}

/** The credential kind's key suffix, so the label lookup cannot drift. */
function credentialKindKey(kind: CredentialKind): string {
  switch (kind) {
    case 'username_password':
      return 'usernamePassword';
    case 'ssh':
      return 'ssh';
    case 'secret_text':
      return 'secretText';
    default:
      return 'kubeconfig';
  }
}

/* --------------------------------------------------------------- panels -- */

/** 基本信息: the attribute block, the two counts and the CD allow-list. */
function BaseInfoPanel({
  project,
  namespace,
  memberCount,
  roleCount,
  onEditAllowlist,
}: {
  project: DevopsProjectSummary;
  namespace: string;
  memberCount: number | undefined;
  roleCount: number | undefined;
  onEditAllowlist: () => void;
}): React.ReactElement {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="devops-detail:basic">
        <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('devops.tab.baseInfo')}</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <DefinitionRow label={t('devops.field.name')} value={project.name} aiId="devops-detail:name" />
          <DefinitionRow label={t('resource.field.alias')} value={project.alias} aiId="devops-detail:alias" />
          <DefinitionRow label={t('projectInfo.field.workspace')} value={project.workspace} aiId="devops-detail:workspace" />
          <DefinitionRow label={t('workspace.detail.creator')} value={project.creator} aiId="devops-detail:creator" />
          <DefinitionRow
            label={t('cluster.column.createdAt')}
            value={project.createdAt ? formatTimestamp(project.createdAt) : ''}
            aiId="devops-detail:created-at"
          />
          <DefinitionRow label={t('devops.detail.namespace')} value={namespace} aiId="devops-detail:namespace" />
          <DefinitionRow
            label={t('devops.detail.syncStatus')}
            value={project.syncStatus || '-'}
            aiId="devops-detail:sync-status"
          />
          <DefinitionRow
            label={t('devops.detail.placementCluster')}
            value={project.placementCluster || '-'}
            aiId="devops-detail:placement"
          />
        </dl>
        <dl className="mt-2 grid grid-cols-1 gap-y-2 text-sm">
          <DefinitionRow
            label={t('resource.field.description')}
            value={project.description}
            aiId="devops-detail:description-row"
          />
        </dl>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:max-w-md">
          <DefinitionRow
            label={t('devops.detail.members')}
            value={typeof memberCount === 'number' ? String(memberCount) : '-'}
            aiId="devops-detail:member-count"
          />
          <DefinitionRow
            label={t('devops.detail.roles')}
            value={typeof roleCount === 'number' ? String(roleCount) : '-'}
            aiId="devops-detail:role-count"
          />
        </dl>
      </section>

      <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="devops-detail:allowlist">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-ai-fg">{t('devops.cd.allowlistTitle')}</h2>
          <Button size="sm" variant="secondary" {...actionProps('devops-detail:allowlist-edit')} onClick={onEditAllowlist}>
            {t('devops.cd.editAllowlist')}
          </Button>
        </div>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <DefinitionRow
            label={t('devops.cd.sourceRepos')}
            value={project.sourceRepos.length > 0 ? project.sourceRepos.join(', ') : t('devops.cd.notSelected')}
            aiId="devops-detail:allowlist-repos"
          />
          <DefinitionRow
            label={t('devops.cd.destinations')}
            value={
              project.destinations.length > 0
                ? project.destinations.map((entry) => entry.name + '/' + entry.namespace).join(', ')
                : t('devops.cd.notSelected')
            }
            aiId="devops-detail:allowlist-destinations"
          />
        </dl>
      </section>
    </div>
  );
}

/**
 * One collection tab: loading, failure with reason and retry, empty copy, or the rows.
 *
 * The failure state is its own branch (not the list's empty state) because a 403/404 on
 * members must not read as "this project has no members".
 */
function CollectionPanel<T>({
  tab,
  query,
  emptyKey,
  columns,
  rows,
  renderRow,
}: {
  tab: string;
  query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => void };
  emptyKey: string;
  columns: string[];
  rows: T[];
  renderRow: (item: T) => { key: string; name: string; cells: React.ReactNode[] };
}): React.ReactElement {
  const t = useT();
  const rendered = rows.map(renderRow);
  return (
    <div className="flex flex-col gap-2" data-ai-id={'devops-detail:' + tab + '-panel'}>
      {query.isPending ? <Skeleton className="h-16 w-full" /> : null}
      {query.isError ? (
        <div className="flex flex-col items-start gap-2" data-ai-id={'devops-detail:' + tab + '-error'}>
          <p className="text-xs text-ai-fg-muted">{errorMessage(t, query.error)}</p>
          <AiButton aiId={'devops-detail:' + tab + '-retry'} size="sm" variant="secondary" onClick={() => query.refetch()}>
            {t('common.retry')}
          </AiButton>
        </div>
      ) : null}
      {!query.isPending && !query.isError && rendered.length === 0 ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id={'devops-detail:' + tab + '-empty'}>
          {t(emptyKey as 'devops.detail.membersEmpty')}
        </p>
      ) : null}
      {!query.isPending && !query.isError && rendered.length > 0 ? (
        <table className="w-full border-collapse text-xs" data-ai-id={'devops-detail:' + tab + '-table'}>
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
              <tr key={row.key} className={cn('border-b border-ai-line')} data-ai-row={row.name}>
                {row.cells.map((cell, index) => (
                  <td key={row.key + '-' + index} className="px-2 py-2 text-ai-fg-secondary">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

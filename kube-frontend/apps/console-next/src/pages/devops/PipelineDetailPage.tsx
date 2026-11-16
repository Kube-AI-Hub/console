import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import {
  ApiError,
  devopsApi,
  devopsCollectionsApi,
  devopsProjectNamespace,
  type DevopsProjectSummary,
  type PipelineDraft,
  type PipelineRunSummary,
} from '@kube-ai-hub/api-client';
import {
  AiButton,
  AiSurface,
  Badge,
  Button,
  FormField,
  Input,
  Select,
  Skeleton,
  Tabs,
  TabsContent,
  Textarea,
  type TabItem,
} from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel, errorMessage } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { formatTimestamp } from '@/lib/time';
import { formatDuration, healthBand, RUN_STATUS_KEYS, RUN_STATUS_TONES, shortCommit } from './format';
import { PipelineFormDialog } from './components/DevopsDialogs';

/**
 * 流水线详情.
 *
 * Three things the old console put on this page, kept apart because they fail apart:
 *
 * 1. **属性** — type, sync status, health, validation, creator, creation time, namespace.
 *    Health and validation are `-` when Jenkins has never reported them; the old
 *    console defaulted them to 100 / success, which made an unsynced pipeline look healthy.
 * 2. **运行记录** — the PipelineRun table. The old console's columns and their order are
 *    kept (状态 / 编号 / 提交 / 分支 / 最近消息 / 耗时 / 更新时间 / 操作). The branch column is
 *    hidden for a single-branch pipeline and for a branch-scoped view, exactly like the old
 *    table.
 * 3. **流水线配置** — the Jenkinsfile, read from `spec.pipeline.jenkinsfile` and saved through
 *    the dedicated PUT `…/pipelines/<p>/jenkinsfile?mode=raw` (a whole-object PUT silently
 *    leaves the field unchanged on this installation).
 *
 * The run detail is a view of this page selected by `?run=<objectName>` rather than a
 * child route: the run list and the run detail share every query, and a separate route
 * would re-read the pipeline and the project just to render one row's log.
 */
export interface PipelineDetailPageProps {
  cluster: string;
  /** DevOps project name from the URL. */
  devops: string;
  pipeline: string;
}

/** The tab values; the config tab is last because the run history is the main task. */
const TABS: readonly ('runs' | 'config')[] = ['runs', 'config'];

export function PipelineDetailPage({ cluster, devops, pipeline }: PipelineDetailPageProps): React.ReactElement {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false }) as { run?: string };

  const [tab, setTab] = React.useState<'runs' | 'config'>('runs');
  const [editing, setEditing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [runBranch, setRunBranch] = React.useState('');
  const [runParameters, setRunParameters] = React.useState<Record<string, string>>({});
  const [notice, setNotice] = React.useState('');
  const [jenkinsfileDraft, setJenkinsfileDraft] = React.useState<string | null>(null);

  const project = useQuery({
    queryKey: ['devops-project', devops],
    queryFn: ({ signal }): Promise<DevopsProjectSummary> => devopsApi(apiClient).project({ name: devops, signal }),
    retry: false,
  });
  const namespace = project.data ? devopsProjectNamespace(project.data.raw, devops) : devops;

  const detail = useQuery({
    queryKey: ['devops-pipeline', devops, pipeline],
    queryFn: ({ signal }) => devopsApi(apiClient).pipeline({ project: devops, name: pipeline, signal }),
    retry: false,
  });

  const runs = useQuery({
    queryKey: ['devops-pipeline-runs', namespace, pipeline],
    queryFn: ({ signal }) => devopsCollectionsApi(apiClient).pipelineRuns({ cluster, namespace, pipeline, signal }),
    retry: false,
  });

  const selectedRun = runs.data?.find((row) => row.name === search.run) ?? null;

  const log = useQuery({
    queryKey: ['devops-pipeline-run-log', devops, pipeline, selectedRun?.runId ?? ''],
    queryFn: ({ signal }) =>
      devopsApi(apiClient).runLog({
        project: devops,
        pipeline,
        runId: selectedRun?.runId ?? '',
        ...(selectedRun?.branch ? { branch: selectedRun.branch } : {}),
        signal,
      }),
    retry: false,
    enabled: selectedRun !== null && Boolean(selectedRun.runId),
  });

  const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));
  const invalidateRuns = () => queryClient.invalidateQueries({ queryKey: ['devops-pipeline-runs', namespace, pipeline] });

  const save = useMutation({
    mutationFn: (draft: PipelineDraft) =>
      devopsApi(apiClient).updatePipeline({
        project: devops,
        name: pipeline,
        alias: draft.alias,
        description: draft.description,
        jenkinsfile: draft.jenkinsfile,
        current: detail.data?.raw ?? {},
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['devops-pipeline', devops, pipeline] });
      await queryClient.invalidateQueries({ queryKey: ['devops-pipelines', devops] });
      setJenkinsfileDraft(null);
      setEditing(false);
    },
  });

  const saveJenkinsfile = useMutation({
    mutationFn: (jenkinsfile: string) =>
      devopsApi(apiClient).saveJenkinsfile({ project: devops, name: pipeline, jenkinsfile }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['devops-pipeline', devops, pipeline] });
      setJenkinsfileDraft(null);
    },
  });

  const remove = useMutation({
    mutationFn: () => devopsApi(apiClient).deletePipeline(devops, pipeline),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['devops-pipelines', devops] });
      setDeleting(false);
      void navigate({ to: '/kube-frontend/clusters/$cluster/devops/$name', params: { cluster, name: devops } });
    },
  });

  /**
   * Trigger a run.
   *
   * The PipelineRun object is created and the list re-read; the run's own
   * `status.message` is what tells the reader whether Jenkins accepted it. Claiming
   * "started" here would be a lie on an installation whose controller cannot reach Jenkins.
   */
  const run = useMutation({
    mutationFn: () =>
      devopsApi(apiClient).runPipeline({
        namespace,
        pipeline,
        ...(runBranch ? { branch: runBranch } : {}),
        parameters: Object.entries(runParameters).map(([name, value]) => ({ name, value })),
      }),
    onSuccess: async (created) => {
      await invalidateRuns();
      const createdName = ((created.metadata ?? {}) as { name?: string }).name ?? '';
      setRunning(false);
      setNotice(t('devops.pipeline.runRequested', { name: createdName || pipeline }));
    },
    onError: (cause) => setNotice(messageOf(cause)),
  });

  const replay = useMutation({
    mutationFn: (row: PipelineRunSummary) =>
      devopsApi(apiClient).runPipeline({
        namespace,
        pipeline,
        ...(row.branch ? { branch: row.branch } : {}),
        parameters: row.parameters,
      }),
    onSuccess: async (created) => {
      await invalidateRuns();
      const createdName = ((created.metadata ?? {}) as { name?: string }).name ?? '';
      setNotice(t('devops.pipeline.runRequested', { name: createdName || pipeline }));
    },
    onError: (cause) => setNotice(messageOf(cause)),
  });

  const missing = detail.error instanceof ApiError && detail.error.isNotFound;
  const state = detail.isPending ? 'loading' : detail.isError ? 'error' : 'ready';

  const tabItems: TabItem[] = TABS.map((entry) => ({
    value: entry,
    label: entry === 'runs' ? t('devops.pipeline.runs') : t('devops.pipeline.config'),
    aiId: 'pipeline-detail:tab:' + entry,
  }));

  const row = detail.data;
  const band = healthBand(row?.health);
  const runRows = runs.data ?? [];
  const isMultiBranch = row?.type === 'multi-branch-pipeline';
  const branchOptions = (row?.branchNames ?? []).map((branch) => ({ value: branch, label: branch }));
  const jenkinsfile = jenkinsfileDraft ?? row?.jenkinsfile ?? '';

  return (
    <AiSurface as="section" aiId="pipeline-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            to="/kube-frontend/clusters/$cluster/devops/$name"
            params={{ cluster, name: devops }}
            className="text-sm text-ai-link hover:underline"
            data-ai-id="pipeline-detail:back"
          >
            {'← ' + devops}
          </Link>
          <h1 className="text-lg font-semibold text-ai-fg" data-ai-id="pipeline-detail:title">
            {row?.alias || row?.name || pipeline}
          </h1>
          <p className="text-xs text-ai-fg-muted">{t('devops.pipeline.subtitle')}</p>
        </div>
        {row ? (
          <div className="flex items-center gap-2">
            <Button size="sm" {...actionProps('pipeline-detail:run')} onClick={() => setRunning(true)}>
              {t('devops.pipeline.run')}
            </Button>
            <Button size="sm" variant="secondary" {...actionProps('pipeline-detail:edit')} onClick={() => setEditing(true)}>
              {t('common.edit')}
            </Button>
            <Button size="sm" variant="danger" {...actionProps('pipeline-detail:delete')} onClick={() => setDeleting(true)}>
              {t('common.delete')}
            </Button>
          </div>
        ) : null}
      </header>

      {state === 'loading' ? <Skeleton className="h-32 w-full" /> : null}
      {missing ? (
        <div className="rounded-ai-md border border-ai-line p-8" data-ai-id="pipeline-detail:not-found">
          <p className="text-sm font-medium text-ai-fg">{t('error.notFound')}</p>
          <p className="mt-1 text-xs text-ai-fg-muted">{errorMessage(t, detail.error)}</p>
        </div>
      ) : null}
      {state === 'error' && !missing ? (
        <ResourceErrorPanel error={detail.error} onRetry={() => void detail.refetch()} retryAiId="pipeline-detail:retry" />
      ) : null}

      {notice ? (
        <p className="text-xs text-ai-fg-secondary" data-ai-id="pipeline-detail:notice">
          {notice}
        </p>
      ) : null}

      {row ? (
        <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="pipeline-detail:basic">
          <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('devops.tab.baseInfo')}</h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <DefinitionRow label={t('devops.field.name')} value={row.name} aiId="pipeline-detail:name" />
            <DefinitionRow
              label={t('devops.pipeline.type')}
              value={isMultiBranch ? t('devops.pipeline.kind.multiBranch') : t('devops.pipeline.kind.pipeline')}
              aiId="pipeline-detail:type"
            />
            <DefinitionRow label={t('devops.detail.syncStatus')} value={row.syncStatus || '-'} aiId="pipeline-detail:sync-status" />
            <DefinitionRow
              label={t('devops.pipeline.health')}
              value={t(('devops.pipeline.health.' + band) as 'devops.pipeline.health.healthy')}
              aiId="pipeline-detail:health"
            />
            <DefinitionRow
              label={t('devops.pipeline.validate')}
              value={
                row.validated === undefined
                  ? '-'
                  : row.validated
                    ? t('devops.pipeline.valid')
                    : t('devops.pipeline.invalid')
              }
              aiId="pipeline-detail:validate"
            />
            <DefinitionRow label={t('workspace.detail.creator')} value={row.creator} aiId="pipeline-detail:creator" />
            <DefinitionRow
              label={t('cluster.column.createdAt')}
              value={row.createdAt ? formatTimestamp(row.createdAt) : '-'}
              aiId="pipeline-detail:created-at"
            />
            <DefinitionRow label={t('devops.detail.namespace')} value={namespace} aiId="pipeline-detail:namespace" />
          </dl>
          <dl className="mt-2 grid grid-cols-1 gap-y-2 text-sm">
            <DefinitionRow label={t('resource.field.description')} value={row.description} aiId="pipeline-detail:description" />
          </dl>
        </section>
      ) : null}

      {row ? (
        <Tabs items={tabItems} value={tab} onValueChange={(value) => setTab(value === 'config' ? 'config' : 'runs')}>
          <TabsContent value="runs" className="pt-4">
            <section className="flex flex-col gap-3 rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="pipeline-detail:runs">
              <h2 className="text-sm font-medium text-ai-fg">
                {t('devops.pipeline.runs') + (runs.data ? ' (' + runRows.length + ')' : '')}
              </h2>
              {runs.isPending ? <Skeleton className="h-16 w-full" /> : null}
              {runs.isError ? (
                <div className="flex flex-col items-start gap-2" data-ai-id="pipeline-detail:runs-error">
                  <p className="text-xs text-ai-fg-muted">{errorMessage(t, runs.error)}</p>
                  <AiButton aiId="pipeline-detail:runs-retry" size="sm" variant="secondary" onClick={() => void runs.refetch()}>
                    {t('common.retry')}
                  </AiButton>
                </div>
              ) : null}
              {!runs.isPending && !runs.isError && runRows.length === 0 ? (
                <p className="text-xs text-ai-fg-muted" data-ai-id="pipeline-detail:runs-empty">
                  {t('devops.pipeline.runsEmpty')}
                </p>
              ) : null}
              {!runs.isPending && !runs.isError && runRows.length > 0 ? (
                <table className="w-full border-collapse text-xs" data-ai-id="pipeline-detail:runs-table">
                  <thead>
                    <tr className="border-b border-ai-line text-ai-fg-muted">
                      <th scope="col" className="px-2 py-2 text-left font-medium">{t('devops.pipeline.column.status')}</th>
                      <th scope="col" className="px-2 py-2 text-left font-medium">{t('devops.pipeline.column.runId')}</th>
                      <th scope="col" className="px-2 py-2 text-left font-medium">{t('devops.pipeline.column.commit')}</th>
                      {isMultiBranch ? (
                        <th scope="col" className="px-2 py-2 text-left font-medium">{t('devops.pipeline.column.branch')}</th>
                      ) : null}
                      <th scope="col" className="px-2 py-2 text-left font-medium">{t('devops.pipeline.column.message')}</th>
                      <th scope="col" className="px-2 py-2 text-left font-medium">{t('devops.pipeline.column.duration')}</th>
                      <th scope="col" className="px-2 py-2 text-left font-medium">{t('devops.pipeline.column.startTime')}</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">{t('table.moreActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runRows.map((entry) => (
                      <tr key={entry.name} className="border-b border-ai-line" data-ai-row={entry.name}>
                        <td className="px-2 py-2">
                          <Badge tone={RUN_STATUS_TONES[entry.status]} data-ai-id={'pipeline-detail:run-status:' + entry.name}>
                            {t(RUN_STATUS_KEYS[entry.status] as 'devops.pipeline.state.queued')}
                          </Badge>
                        </td>
                        <td className="px-2 py-2">
                          <Link
                            to="/kube-frontend/clusters/$cluster/devops/$name/pipelines/$pipeline"
                            params={{ cluster, name: devops, pipeline }}
                            search={{ run: entry.name }}
                            className="font-mono text-[11px] text-ai-link hover:underline"
                            data-ai-id={'pipeline-detail:run-link:' + entry.name}
                          >
                            {entry.runId || '-'}
                          </Link>
                        </td>
                        <td className="px-2 py-2 font-mono text-[11px] text-ai-fg-secondary">{shortCommit(entry.commitId)}</td>
                        {isMultiBranch ? (
                          <td className="px-2 py-2 text-ai-fg-secondary">{entry.branch || '-'}</td>
                        ) : null}
                        <td className="px-2 py-2 text-ai-fg-secondary">{entry.cause || entry.message || '-'}</td>
                        <td className="px-2 py-2 tabular-nums text-ai-fg-secondary">{formatDuration(entry.durationMillis)}</td>
                        <td className="px-2 py-2 tabular-nums text-ai-fg-secondary">
                          {entry.startTime ? formatTimestamp(entry.startTime) : '-'}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              {...actionProps('pipeline-detail:run-replay:' + entry.name)}
                              onClick={() => replay.mutate(entry)}
                            >
                              {t('devops.pipeline.replay')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </section>

            {selectedRun ? (
              <section className="mt-4 flex flex-col gap-3 rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="pipeline-detail:run-detail">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-ai-fg">{t('devops.pipeline.runDetail')}</h2>
                  <Link
                    to="/kube-frontend/clusters/$cluster/devops/$name/pipelines/$pipeline"
                    params={{ cluster, name: devops, pipeline }}
                    search={{}}
                    className="text-xs text-ai-link hover:underline"
                    data-ai-id="pipeline-detail:run-close"
                  >
                    {t('common.close')}
                  </Link>
                </div>
                <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                  <DefinitionRow label={t('devops.pipeline.column.runId')} value={selectedRun.runId || '-'} aiId="pipeline-detail:run-id" />
                  <DefinitionRow
                    label={t('devops.pipeline.column.status')}
                    value={t(RUN_STATUS_KEYS[selectedRun.status] as 'devops.pipeline.state.queued')}
                    aiId="pipeline-detail:run-status"
                  />
                  <DefinitionRow label={t('devops.pipeline.runPhase')} value={selectedRun.phase || '-'} aiId="pipeline-detail:run-phase" />
                  <DefinitionRow
                    label={t('devops.pipeline.column.startTime')}
                    value={selectedRun.startTime ? formatTimestamp(selectedRun.startTime) : '-'}
                    aiId="pipeline-detail:run-start"
                  />
                  <DefinitionRow
                    label={t('devops.pipeline.column.duration')}
                    value={formatDuration(selectedRun.durationMillis)}
                    aiId="pipeline-detail:run-duration"
                  />
                  <DefinitionRow
                    label={t('devops.pipeline.column.commit')}
                    value={selectedRun.commitId || '-'}
                    aiId="pipeline-detail:run-commit"
                  />
                </dl>
                {selectedRun.message ? (
                  <p className="text-xs text-ai-danger" data-ai-id="pipeline-detail:run-message">
                    {selectedRun.message}
                  </p>
                ) : null}
                <div>
                  <h3 className="mb-2 text-xs font-medium text-ai-fg-secondary">{t('devops.pipeline.runLog')}</h3>
                  {log.isPending ? <Skeleton className="h-16 w-full" /> : null}
                  {log.isError ? (
                    <div className="flex flex-col items-start gap-2" data-ai-id="pipeline-detail:run-log-error">
                      <p className="text-xs text-ai-fg-muted">{errorMessage(t, log.error)}</p>
                      <AiButton aiId="pipeline-detail:run-log-retry" size="sm" variant="secondary" onClick={() => void log.refetch()}>
                        {t('common.retry')}
                      </AiButton>
                    </div>
                  ) : null}
                  {!log.isPending && !log.isError ? (
                    <pre
                      className="max-h-80 overflow-auto rounded-ai-sm bg-ai-surface-2 p-2 font-mono text-[11px] text-ai-fg-secondary"
                      data-ai-id="pipeline-detail:run-log"
                    >
                      {typeof log.data === 'string' && log.data ? log.data : t('devops.pipeline.runLogEmpty')}
                    </pre>
                  ) : null}
                </div>
              </section>
            ) : null}
          </TabsContent>

          <TabsContent value="config" className="pt-4">
            <section className="flex flex-col gap-3 rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="pipeline-detail:config">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-ai-fg">{t('devops.pipeline.config')}</h2>
                <div className="flex items-center gap-2">
                  {jenkinsfileDraft !== null ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      {...actionProps('pipeline-detail:config-reset')}
                      onClick={() => setJenkinsfileDraft(null)}
                    >
                      {t('common.cancel')}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    disabled={jenkinsfileDraft === null || saveJenkinsfile.isPending}
                    loading={saveJenkinsfile.isPending}
                    {...actionProps('pipeline-detail:config-save')}
                    onClick={() => {
                      if (jenkinsfileDraft !== null) saveJenkinsfile.mutate(jenkinsfileDraft);
                    }}
                  >
                    {t('common.save')}
                  </Button>
                </div>
              </div>
              {isMultiBranch ? (
                <p className="text-xs text-ai-fg-muted" data-ai-id="pipeline-detail:config-multibranch">
                  {t('devops.pipeline.multiBranchScript', { path: 'Jenkinsfile' })}
                </p>
              ) : (
                <FormField htmlFor="pipeline-detail-jenkinsfile" label={t('devops.pipeline.jenkinsfile')}>
                  <Textarea
                    id="pipeline-detail-jenkinsfile"
                    value={jenkinsfile}
                    rows={18}
                    className="font-mono text-[11px]"
                    {...actionProps('pipeline-detail:config-editor')}
                    onChange={(event) => setJenkinsfileDraft(event.target.value)}
                  />
                </FormField>
              )}
              {saveJenkinsfile.error ? (
                <p className="text-xs text-ai-danger" data-ai-id="pipeline-detail:config-error">
                  {messageOf(saveJenkinsfile.error)}
                </p>
              ) : null}
            </section>
          </TabsContent>
        </Tabs>
      ) : null}

      <PipelineFormDialog
        open={editing}
        onOpenChange={(open) => {
          setEditing(open);
          if (!open) save.reset();
        }}
        editing={row ?? null}
        pending={save.isPending}
        {...(save.error ? { error: messageOf(save.error) } : {})}
        credentialOptions={[]}
        onSubmit={(draft) => save.mutate(draft)}
      />

      <DeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        names={[pipeline]}
        resource="pipeline-detail"
        noun={t('devops.detail.pipelines')}
        pending={remove.isPending}
        {...(remove.error ? { error: messageOf(remove.error) } : {})}
        onConfirm={() => remove.mutate()}
      />

      {/*
        The run dialog: a branch picker only when Jenkins reports branches, and one input per
        declared parameter. A single-branch pipeline with no parameters runs immediately from
        the header button, which is why this dialog is rendered only when something is
        choosable.
      */}
      {running ? (
        <div className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="pipeline-detail:run-form">
          <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('devops.pipeline.runTitle')}</h2>
          <div className="flex flex-col gap-3">
            {branchOptions.length > 0 ? (
              <FormField htmlFor="pipeline-run-branch" label={t('devops.pipeline.column.branch')}>
                <Select
                  value={runBranch}
                  options={branchOptions}
                  onValueChange={setRunBranch}
                  placeholder={t('devops.pipeline.branchPlaceholder')}
                  data-ai-id="pipeline-detail:run-branch"
                />
              </FormField>
            ) : null}
            {(row?.parameters ?? []).map((parameter) => (
              <FormField key={parameter.name} htmlFor={'pipeline-run-' + parameter.name} label={parameter.name} hint={parameter.description}>
                <Input
                  id={'pipeline-run-' + parameter.name}
                  value={runParameters[parameter.name] ?? parameter.defaultValue}
                  {...actionProps('pipeline-detail:run-param:' + parameter.name)}
                  onChange={(event) => setRunParameters({ ...runParameters, [parameter.name]: event.target.value })}
                />
              </FormField>
            ))}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" disabled={run.isPending} onClick={() => setRunning(false)}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" disabled={run.isPending} loading={run.isPending} {...actionProps('pipeline-detail:run-submit')} onClick={() => run.mutate()}>
                {t('devops.pipeline.run')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AiSurface>
  );
}

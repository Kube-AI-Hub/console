import * as React from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { ApiError, imageBuilderTriggerLink } from '@kube-ai-hub/api-client';
import {
  AiSurface,
  Badge,
  Button,
  Icon,
  Notify,
  Skeleton,
  Tabs,
  TabsContent,
  type TabItem,
} from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';
import { ResourceErrorPanel, errorMessage } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { YamlDialog } from '@/components/resource/YamlDialog';
import { toYaml } from '@/components/resource/yaml';
import { formatTimestamp } from '@/lib/time';
import { builderStatusKey, kindKey, statusTone } from './format';
import { ImageBuilderConfigDialog } from './ImageBuilderConfigDialog';
import {
  BuildRecordsPanel,
  EnvironmentPanel,
  EventsPanel,
  ImageArtifactsPanel,
  ResourceStatusPanel,
  downloadArtifact,
} from './panels';
import {
  useBuilderRuns,
  useDeleteBuilder,
  useImageBuilder,
  usePatchBuilderInfo,
  useS2iJob,
  useUpdateBuilder,
} from './queries';

/**
 * 镜像构建器详情.
 *
 * The page keeps the old console's five tabs and its operations in the old order
 * (运行 / 编辑信息 / 编辑 YAML / 删除). The side attributes stay in one definition list
 * rather than moving into the tabs because they answer "what is this builder" before
 * the reader picks a tab.
 *
 * Tabs are in-page state, like every other detail page in this app: the whole page
 * shares one builder/runs/job read, so a tab switch is a render, not a refetch.
 */
export interface ImageBuilderDetailPageProps {
  workspace: string;
  cluster: string;
  namespace: string;
  name: string;
}

type DetailTab = 'records' | 'resource-status' | 'image-artifacts' | 'environment' | 'events';

const TAB_ORDER: DetailTab[] = ['records', 'resource-status', 'image-artifacts', 'environment', 'events'];

const TAB_LABEL_KEYS: Record<DetailTab, string> = {
  records: 'devopsProject.s2ibuilder.tab.records',
  'resource-status': 'devopsProject.s2ibuilder.tab.resourceStatus',
  'image-artifacts': 'devopsProject.s2ibuilder.tab.imageArtifacts',
  environment: 'devopsProject.s2ibuilder.tab.environment',
  events: 'devopsProject.s2ibuilder.tab.events',
};

type Dialog = 'none' | 'run' | 'editInfo' | 'editYaml' | 'delete';

export function ImageBuilderDetailPage({ workspace, cluster, namespace, name }: ImageBuilderDetailPageProps): React.ReactElement {
  const t = useT();
  const navigate = useNavigate();
  const query = useImageBuilder({ cluster, namespace, name });
  // One run is enough to find the newest run and its job; the records tab pages on its own.
  const latest = useBuilderRuns({ cluster, namespace, builderName: name, page: 1, pageSize: 1 });
  const latestRun = latest.data?.items[0] ?? null;
  const job = useS2iJob({ cluster, namespace, jobName: latestRun?.jobName ?? '' });
  const patchInfo = usePatchBuilderInfo({ cluster, namespace });
  const updateYaml = useUpdateBuilder({ cluster, namespace, name });
  const remove = useDeleteBuilder({ cluster, namespace });
  const [tab, setTab] = React.useState<DetailTab>('records');
  const [dialog, setDialog] = React.useState<Dialog>('none');

  const builder = query.data;
  const missing = query.error instanceof ApiError && query.error.isNotFound;
  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';

  const listHref = '/kube-frontend/' + workspace + '/clusters/' + cluster + '/projects/' + namespace + '/s2ibuilder';

  const tabItems: TabItem[] = TAB_ORDER.map((entry) => ({
    value: entry,
    label: t(TAB_LABEL_KEYS[entry] as 'devopsProject.s2ibuilder.tab.records'),
    aiId: 'image-builder-detail:tab:' + entry,
  }));

  const copyTrigger = (): void => {
    if (!builder) return;
    const link = imageBuilderTriggerLink(builder.namespace, builder.name, builder.config.secretCode ?? '');
    void navigator.clipboard.writeText(link).then(() => {
      Notify.success({ content: t('devopsProject.s2ibuilder.copied') });
    });
  };

  const jobProps = {
    cluster,
    namespace,
    job: job.data,
    // The job query is disabled while the run has no `kubernetesJobName`. A disabled
    // TanStack query stays `pending` forever, which would render a skeleton instead of the
    // "controller has not created a Job" notice — the notice is the whole point here.
    jobLoading: Boolean(latestRun?.jobName) && job.isPending,
    jobError: job.error,
    hasRun: Boolean(latestRun),
    onRetry: () => void job.refetch(),
  };

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="image-builder-detail:surface" state="error" className="flex min-w-0 flex-col gap-4">
        {missing ? (
          <div className="flex flex-col items-start gap-2 rounded-ai-md border border-ai-line p-8" data-ai-id="image-builder-detail:not-found">
            <p className="text-sm font-medium text-ai-fg">{t('error.notFound')}</p>
            <p className="text-xs text-ai-fg-muted">{errorMessage(t, query.error)}</p>
            <Link to={listHref} className="text-xs text-ai-link hover:underline" data-ai-id="image-builder-detail:back-to-list">
              {'← ' + t('devopsProject.s2ibuilder.title')}
            </Link>
          </div>
        ) : (
          <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="image-builder-detail:retry" />
        )}
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="image-builder-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <div>
        <Link to={listHref} className="inline-flex items-center gap-1 text-xs text-ai-link hover:underline" data-ai-id="image-builder-detail:back">
          <Icon name="chevron-left" size={12} />
          {t('devopsProject.s2ibuilder.title')}
        </Link>
      </div>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}

      {builder ? (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold text-ai-fg" data-ai-id="image-builder-detail:title">
                  {builder.displayName || builder.name}
                </h1>
                <Badge tone={statusTone(builder.status)} data-ai-id="image-builder-detail:status">
                  {t(builderStatusKey(builder.status))}
                </Badge>
                <Badge tone="neutral" data-ai-id="image-builder-detail:kind">
                  {t(kindKey(builder.kind))}
                </Badge>
              </div>
              {builder.displayName ? <p className="text-xs text-ai-fg-muted">{builder.name}</p> : null}
              {builder.description ? <p className="text-xs text-ai-fg-muted">{builder.description}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {/* The old order: run first, then edit, YAML, delete. */}
              <Button size="sm" {...actionProps('image-builder-detail:run')} onClick={() => setDialog('run')}>
                {t('devopsProject.s2ibuilder.detail.run')}
              </Button>
              <Button size="sm" variant="secondary" {...actionProps('image-builder-detail:edit-info')} onClick={() => setDialog('editInfo')}>
                {t('resource.action.editInfo')}
              </Button>
              <Button size="sm" variant="ghost" {...actionProps('image-builder-detail:edit-yaml')} onClick={() => setDialog('editYaml')}>
                {t('resource.action.editYaml')}
              </Button>
              <Button size="sm" variant="danger" {...actionProps('image-builder-detail:delete')} onClick={() => setDialog('delete')}>
                {t('common.delete')}
              </Button>
            </div>
          </header>

          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="image-builder-detail:attributes">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('resource.attributes')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow label={t('resource.field.name')} value={builder.name} aiId="image-builder-detail:name" />
              <DefinitionRow label={t('resource.field.project')} value={builder.namespace || namespace} aiId="image-builder-detail:project" />
              <DefinitionRow label={t('devopsProject.s2ibuilder.detail.type')} value={t(kindKey(builder.kind))} aiId="image-builder-detail:type" />
              <DefinitionRow
                label={t('devopsProject.s2ibuilder.detail.builderImage')}
                value={builder.baseImage || '-'}
                aiId="image-builder-detail:builder-image"
              />
              <DefinitionRow
                label={t('devopsProject.s2ibuilder.detail.imageName')}
                value={builder.outputImage || '-'}
                aiId="image-builder-detail:image-name"
              />
              <DefinitionRow
                label={t('devopsProject.s2ibuilder.detail.pullPolicy')}
                value={builder.pullPolicy || '-'}
                aiId="image-builder-detail:pull-policy"
              />
              <DefinitionRow
                label={t('devopsProject.s2ibuilder.detail.repository')}
                value={
                  builder.isBinary ? (
                    <span className="flex flex-col gap-1" data-ai-id="image-builder-detail:binary">
                      <span className="break-all font-mono text-[11px]">{builder.sourceUrl || '-'}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={builder.status !== 'successful' || !builder.sourceUrl}
                        {...actionProps('image-builder-detail:download-artifact')}
                        onClick={() => {
                          if (builder.sourceUrl) downloadArtifact(builder.sourceUrl);
                        }}
                      >
                        <Icon name="download" size={12} />
                        {t('devopsProject.s2ibuilder.records.download')}
                      </Button>
                    </span>
                  ) : (
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="break-all font-mono text-[11px]" data-ai-id="image-builder-detail:source-url">
                        {builder.sourceUrl || '-'}
                      </span>
                      {builder.revisionId ? <Badge tone="neutral">{builder.revisionId}</Badge> : null}
                    </span>
                  )
                }
                aiId="image-builder-detail:repository"
              />
              <DefinitionRow label={t('devopsProject.s2ibuilder.detail.createdAt')} value={formatTimestamp(builder.createdAt)} aiId="image-builder-detail:created-at" />
              <DefinitionRow label={t('devopsProject.s2ibuilder.detail.creator')} value={builder.creator || '-'} aiId="image-builder-detail:creator" />
            </dl>
            <dl className="mt-2 grid grid-cols-1 gap-y-2 text-sm">
              <DefinitionRow
                label={t('devopsProject.s2ibuilder.detail.trigger')}
                value={
                  <span className="flex min-w-0 items-center gap-2" data-ai-id="image-builder-detail:trigger">
                    <span className="break-all font-mono text-[11px]">
                      {imageBuilderTriggerLink(builder.namespace, builder.name, builder.config.secretCode ?? '')}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t('devopsProject.s2ibuilder.detail.copyTrigger')}
                      {...actionProps('image-builder-detail:trigger-copy')}
                      onClick={copyTrigger}
                    >
                      <Icon name="copy" size={14} />
                    </Button>
                  </span>
                }
                aiId="image-builder-detail:trigger-value"
              />
            </dl>
          </section>

          <Tabs items={tabItems} value={tab} onValueChange={(value) => setTab(value as DetailTab)}>
            <TabsContent value="records">
              <BuildRecordsPanel cluster={cluster} namespace={namespace} builder={builder} latestRun={latestRun} />
            </TabsContent>
            <TabsContent value="resource-status">
              <ResourceStatusPanel {...jobProps} />
            </TabsContent>
            <TabsContent value="image-artifacts">
              <ImageArtifactsPanel cluster={cluster} namespace={namespace} builder={builder} />
            </TabsContent>
            <TabsContent value="environment">
              <EnvironmentPanel {...jobProps} />
            </TabsContent>
            <TabsContent value="events">
              <EventsPanel {...jobProps} />
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      {builder ? (
        <>
          <ImageBuilderConfigDialog
            open={dialog === 'run'}
            onOpenChange={(open) => setDialog(open ? 'run' : 'none')}
            cluster={cluster}
            namespace={namespace}
            builder={builder}
            onSaved={() => {
              void query.refetch();
              void latest.refetch();
            }}
          />
          <EditInfoDialog
            open={dialog === 'editInfo'}
            onOpenChange={(open) => setDialog(open ? 'editInfo' : 'none')}
            resource="image-builder"
            name={builder.name}
            alias={builder.alias}
            description={builder.description}
            annotations={builder.annotations}
            pending={patchInfo.isPending}
            onSubmit={async (annotations) => {
              await patchInfo.mutateAsync({ name: builder.name, annotations });
              setDialog('none');
            }}
          />
          <YamlDialog
            open={dialog === 'editYaml'}
            onOpenChange={(open) => setDialog(open ? 'editYaml' : 'none')}
            initialYaml={toYaml(builder.raw as unknown as Record<string, unknown>)}
            lockName={builder.name}
            title={t('resource.action.editYaml')}
            submitLabel={t('common.confirm')}
            pending={updateYaml.isPending}
            onSubmit={async (object) => {
              await updateYaml.mutateAsync(object as unknown as Record<string, unknown>);
              setDialog('none');
            }}
          />
          <DeleteDialog
            open={dialog === 'delete'}
            onOpenChange={(open) => setDialog(open ? 'delete' : 'none')}
            names={[builder.name]}
            resource="image-builder"
            noun={t('devopsProject.s2ibuilder.title')}
            pending={remove.isPending}
            onConfirm={async () => {
              await remove.mutateAsync(builder.name);
              setDialog('none');
              void navigate({ href: listHref });
            }}
          />
        </>
      ) : null}

    </AiSurface>
  );
}


import * as React from 'react';
import { Alert, Badge, Button, Icon, Notify, Pagination, Skeleton, Tooltip } from '@kube-ai-hub/ui';
import {
  downloadS2iBinary,
  type ImageBuilderDetail,
  type S2iJobDetail,
  type S2iRunSummary,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';
import { currentToken } from '@/api';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import {
  formatSize,
  runMessageKey,
  runStatusKey,
  statusTone,
} from './format';
import {
  useBuilderRuns,
  useEnvSources,
  useJobEvents,
  useJobPods,
  useRunLog,
} from './queries';

/**
 * The panels behind the detail page's five tabs.
 *
 * The old console had one component per tab; the data dependency is what shapes them:
 * 资源状态 / 环境变量 / 事件 all read the **Job of the last run**, while 构建记录 /
 * 镜像制品 read the runs themselves. Keeping the job-derived panels together makes the
 * "there is no job yet" state explicit in one place instead of three silent tables.
 */

const RUN_PAGE_SIZE = 10;

/* ------------------------------------------------------------------ */
/* 构建记录                                                             */
/* ------------------------------------------------------------------ */

export interface BuildRecordsPanelProps {
  cluster: string;
  namespace: string;
  builder: ImageBuilderDetail;
  /** The newest run, already fetched by the detail page (null when there is none). */
  latestRun: S2iRunSummary | null;
}

export function BuildRecordsPanel({ cluster, namespace, builder, latestRun }: BuildRecordsPanelProps): React.ReactElement {
  const t = useT();
  const [page, setPage] = React.useState(1);
  const runs = useBuilderRuns({
    cluster,
    namespace,
    builderName: builder.name,
    page,
    pageSize: RUN_PAGE_SIZE,
  });
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const isBinary = builder.kind === 'b2i';
  const source = latestRun
    ? {
        builderImage: latestRun.builderImage || builder.config.builderImage || '',
        sourceUrl: latestRun.sourceUrl || (isBinary ? builder.config.sourceUrl ?? '' : builder.config.sourceUrl ?? ''),
        revisionId: latestRun.revisionId || builder.config.revisionId || 'master',
        binaryName: latestRun.binaryName,
        binarySize: latestRun.binarySize,
      }
    : null;

  return (
    <div className="flex flex-col gap-4" data-ai-id="image-builder-detail:records">
      <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="image-builder-detail:last-environment">
        <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('devopsProject.s2ibuilder.records.lastEnvironment')}</h2>
        {!latestRun ? (
          <p className="text-xs text-ai-fg-muted" data-ai-id="image-builder-detail:last-environment-empty">
            {t('devopsProject.s2ibuilder.records.lastEnvironmentEmpty')}
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow
                label={t('devopsProject.s2ibuilder.records.builderImage')}
                value={source?.builderImage || '-'}
                aiId="image-builder-detail:last-builder-image"
              />
              {isBinary ? (
                <>
                  <DefinitionRow
                    label={t('devopsProject.s2ibuilder.records.binaryFile')}
                    value={source?.binaryName || '-'}
                    aiId="image-builder-detail:last-binary-name"
                  />
                  <DefinitionRow
                    label={t('devopsProject.s2ibuilder.records.binarySize')}
                    value={formatSize(source?.binarySize)}
                    aiId="image-builder-detail:last-binary-size"
                  />
                </>
              ) : (
                <>
                  <DefinitionRow
                    label={t('devopsProject.s2ibuilder.records.sourceUrl')}
                    value={source?.sourceUrl || '-'}
                    aiId="image-builder-detail:last-source-url"
                  />
                  <DefinitionRow
                    label={t('devopsProject.s2ibuilder.records.branch')}
                    value={source?.revisionId || '-'}
                    aiId="image-builder-detail:last-branch"
                  />
                </>
              )}
            </dl>
            {!source?.builderImage && !source?.sourceUrl && !source?.binaryName ? (
              <p className="mt-2 text-[11px] text-ai-fg-muted" data-ai-id="image-builder-detail:last-environment-unreported">
                {t('devopsProject.s2ibuilder.records.environmentUnreported')}
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="image-builder-detail:runs">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-ai-fg">
            {t('devopsProject.s2ibuilder.records.runRecords') + (runs.data ? ' (' + runs.data.total + ')' : '')}
          </h2>
          <Button
            size="sm"
            variant="ghost"
            {...actionProps('image-builder-detail:runs-refresh')}
            onClick={() => void runs.refetch()}
          >
            {t('common.refresh')}
          </Button>
        </div>
        {runs.isPending ? <Skeleton className="h-16 w-full" /> : null}
        {runs.isError ? (
          <div data-ai-id="image-builder-detail:runs-error">
            <ResourceErrorPanel error={runs.error} onRetry={() => void runs.refetch()} retryAiId="image-builder-detail:runs-retry" />
          </div>
        ) : null}
        {!runs.isPending && !runs.isError && (runs.data?.items.length ?? 0) === 0 ? (
          <p className="text-xs text-ai-fg-muted" data-ai-id="image-builder-detail:runs-empty">
            {t('devopsProject.s2ibuilder.records.runsEmpty')}
          </p>
        ) : null}
        {!runs.isPending && !runs.isError && (runs.data?.items.length ?? 0) > 0 ? (
          <table className="w-full border-collapse text-xs" data-ai-id="image-builder-detail:runs-table">
            <thead>
              <tr className="border-b border-ai-line text-ai-fg-muted">
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.records.serial')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.records.status')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.records.image')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.records.startTime')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.records.message')}</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">{t('devopsProject.s2ibuilder.records.log')}</th>
              </tr>
            </thead>
            <tbody>
              {runs.data?.items.map((run, index) => {
                const serial = (runs.data?.total ?? 0) - (page - 1) * RUN_PAGE_SIZE - index;
                const isOpen = expanded === run.name;
                return (
                  <React.Fragment key={run.name}>
                    <tr className="border-b border-ai-line" data-ai-row={run.name}>
                      <td className="px-2 py-2 tabular-nums text-ai-fg-secondary">#{serial}</td>
                      <td className="px-2 py-2">
                        <Badge tone={statusTone(run.status)} data-ai-id={'image-builder-detail:run-status:' + run.name}>
                          {t(runStatusKey(run.status))}
                        </Badge>
                      </td>
                      <td className="max-w-56 truncate px-2 py-2 font-mono text-[11px] text-ai-fg-secondary" title={run.imageName}>
                        {run.imageName || '-'}
                      </td>
                      <td className="px-2 py-2 tabular-nums text-ai-fg-secondary">
                        {run.startTime ? formatTimestamp(run.startTime) : '-'}
                      </td>
                      <td className="px-2 py-2 text-ai-fg-secondary">
                        {t(runMessageKey(run.status), { name: run.imageName || builder.name })}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-expanded={isOpen}
                          {...actionProps('image-builder-detail:run-log-toggle:' + run.name)}
                          onClick={() => setExpanded(isOpen ? null : run.name)}
                        >
                          {isOpen ? t('devopsProject.s2ibuilder.records.logCollapse') : t('devopsProject.s2ibuilder.records.logExpand')}
                        </Button>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className="border-b border-ai-line" data-ai-id={'image-builder-detail:run-log-row:' + run.name}>
                        <td colSpan={6} className="px-2 py-3">
                          <RunLog run={run} cluster={cluster} />
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        ) : null}
        {(runs.data?.total ?? 0) > RUN_PAGE_SIZE ? (
          <div className="mt-3 flex justify-end">
            <Pagination
              aiPrefix="image-builder-detail:runs"
              page={page}
              pageSize={RUN_PAGE_SIZE}
              total={runs.data?.total ?? 0}
              onChange={setPage}
              labels={{
                previous: t('table.previous'),
                next: t('table.next'),
                range: (from, to, total) => t('table.range', { from, to, total }),
              }}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function RunLog({ run, cluster }: { run: S2iRunSummary; cluster: string }): React.ReactElement {
  const t = useT();
  const [open, setOpen] = React.useState(true);
  const log = useRunLog({
    cluster,
    logURL: run.logURL,
    enabled: open && Boolean(run.logURL),
    poll: run.status === 'building' || run.status === '',
  });

  if (!run.logURL) {
    return (
      <Alert tone="info" data-ai-id={'image-builder-detail:run-log-unavailable:' + run.name}>
        {t('devopsProject.s2ibuilder.records.logUnavailable')}
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-ai-id={'image-builder-detail:run-log:' + run.name}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ai-fg-muted">{t('devopsProject.s2ibuilder.records.logHint')}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => void log.refetch()}>
            {t('common.refresh')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen((current) => !current)}>
            {open ? t('devopsProject.s2ibuilder.records.logPause') : t('devopsProject.s2ibuilder.records.logResume')}
          </Button>
        </div>
      </div>
      {log.isPending ? <Skeleton className="h-16 w-full" /> : null}
      {log.isError ? (
        <div data-ai-id={'image-builder-detail:run-log-error:' + run.name}>
          <ResourceErrorPanel error={log.error} onRetry={() => void log.refetch()} retryAiId="image-builder-detail:run-log-retry" />
        </div>
      ) : null}
      {!log.isPending && !log.isError ? (
        <pre
          className="max-h-72 overflow-auto rounded-ai-sm bg-ai-surface-2 p-2 font-mono text-[11px] text-ai-fg-secondary"
          data-ai-id={'image-builder-detail:run-log-content:' + run.name}
        >
          {typeof log.data === 'string' && log.data ? log.data : t('devopsProject.s2ibuilder.records.logEmpty')}
        </pre>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 镜像制品                                                             */
/* ------------------------------------------------------------------ */

export function ImageArtifactsPanel({ cluster, namespace, builder }: { cluster: string; namespace: string; builder: ImageBuilderDetail }): React.ReactElement {
  const t = useT();
  const [page, setPage] = React.useState(1);
  // A separate, wide page: artifacts are filtered by a status the server cannot filter on,
  // so the successful runs have to be collected before they can be paged.
  const runs = useBuilderRuns({ cluster, namespace, builderName: builder.name, page: 1, pageSize: 1000 });
  const successful = (runs.data?.items ?? []).filter((run) => run.status === 'successful');
  const pageItems = successful.slice((page - 1) * RUN_PAGE_SIZE, page * RUN_PAGE_SIZE);

  return (
    <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="image-builder-detail:artifacts">
      {runs.isPending ? <Skeleton className="h-16 w-full" /> : null}
      {runs.isError ? (
        <ResourceErrorPanel error={runs.error} onRetry={() => void runs.refetch()} retryAiId="image-builder-detail:artifacts-retry" />
      ) : null}
      {!runs.isPending && !runs.isError && successful.length === 0 ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id="image-builder-detail:artifacts-empty">
          {t('devopsProject.s2ibuilder.artifacts.empty')}
        </p>
      ) : null}
      {!runs.isPending && !runs.isError && successful.length > 0 ? (
        <table className="w-full border-collapse text-xs" data-ai-id="image-builder-detail:artifacts-table">
          <thead>
            <tr className="border-b border-ai-line text-ai-fg-muted">
              <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.artifacts.imageName')}</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.artifacts.imageSize')}</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.artifacts.pullCommand')}</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.artifacts.publishedAt')}</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((run) => (
              <tr key={run.name} className="border-b border-ai-line" data-ai-row={run.name}>
                <td className="max-w-56 truncate px-2 py-2 font-mono text-[11px]" title={run.imageName}>{run.imageName || '-'}</td>
                <td className="px-2 py-2 tabular-nums text-ai-fg-secondary">{formatSize(run.imageSize)}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1">
                    <code className="max-w-56 truncate font-mono text-[11px] text-ai-fg-secondary" title={run.imagePullCommand}>
                      {run.imagePullCommand || '-'}
                    </code>
                    {run.imagePullCommand ? (
                      <Tooltip content={t('devopsProject.s2ibuilder.artifacts.copy')}>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t('devopsProject.s2ibuilder.artifacts.copy')}
                          data-ai-id={'image-builder-detail:artifact-copy:' + run.name}
                          onClick={() => {
                            void navigator.clipboard.writeText(run.imagePullCommand).then(() => {
                              Notify.success({ content: t('devopsProject.s2ibuilder.copied') });
                            });
                          }}
                        >
                          <Icon name="copy" size={14} />
                        </Button>
                      </Tooltip>
                    ) : null}
                  </div>
                </td>
                <td className="px-2 py-2 tabular-nums text-ai-fg-secondary">
                  {run.imageCreated ? formatTimestamp(run.imageCreated) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {successful.length > RUN_PAGE_SIZE ? (
        <div className="mt-3 flex justify-end">
          <Pagination
            aiPrefix="image-builder-detail:artifacts"
            page={page}
            pageSize={RUN_PAGE_SIZE}
            total={successful.length}
            onChange={setPage}
            labels={{
              previous: t('table.previous'),
              next: t('table.next'),
              range: (from, to, total) => t('table.range', { from, to, total }),
            }}
          />
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 资源状态                                                             */
/* ------------------------------------------------------------------ */

export interface JobPanelProps {
  cluster: string;
  namespace: string;
  /** The Job of the latest run; `null` = the controller has not created one. */
  job: S2iJobDetail | null | undefined;
  jobLoading: boolean;
  jobError: unknown;
  onRetry: () => void;
  hasRun: boolean;
}

function NoJobNotice({ hasRun }: { hasRun: boolean }): React.ReactElement {
  const t = useT();
  return (
    <Alert tone="info" data-ai-id="image-builder-detail:no-job">
      {hasRun ? t('devopsProject.s2ibuilder.noJob') : t('devopsProject.s2ibuilder.noRun')}
    </Alert>
  );
}

export function ResourceStatusPanel({ cluster, namespace, job, jobLoading, jobError, onRetry, hasRun }: JobPanelProps): React.ReactElement {
  const t = useT();
  const pods = useJobPods({ cluster, namespace, job });
  const ports = (job?.containers ?? []).flatMap((container) => container.ports ?? []);

  return (
    <div className="flex flex-col gap-4" data-ai-id="image-builder-detail:resource-status">
      {jobLoading ? <Skeleton className="h-16 w-full" /> : null}
      {jobError ? <ResourceErrorPanel error={jobError} onRetry={onRetry} retryAiId="image-builder-detail:job-retry" /> : null}
      {!jobLoading && !jobError && !job ? <NoJobNotice hasRun={hasRun} /> : null}
      {job ? (
        <>
          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="image-builder-detail:ports">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('devopsProject.s2ibuilder.resourceStatus.ports')}</h2>
            {ports.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('devopsProject.s2ibuilder.resourceStatus.noPorts')}</p>
            ) : (
              <table className="w-full border-collapse text-xs" data-ai-id="image-builder-detail:ports-table">
                <thead>
                  <tr className="border-b border-ai-line text-ai-fg-muted">
                    <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.resourceStatus.portName')}</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.resourceStatus.protocol')}</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.resourceStatus.port')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ports.map((port, index) => (
                    <tr key={String(port.name ?? index)} className="border-b border-ai-line">
                      <td className="px-2 py-2">{port.name || '-'}</td>
                      <td className="px-2 py-2">{port.protocol || 'TCP'}</td>
                      <td className="px-2 py-2 tabular-nums">{port.containerPort ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="image-builder-detail:pods">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('devopsProject.s2ibuilder.resourceStatus.pods')}</h2>
            {pods.isPending ? <Skeleton className="h-12 w-full" /> : null}
            {pods.isError ? <ResourceErrorPanel error={pods.error} onRetry={() => void pods.refetch()} retryAiId="image-builder-detail:pods-retry" /> : null}
            {!pods.isPending && !pods.isError && (pods.data?.length ?? 0) === 0 ? (
              <p className="text-xs text-ai-fg-muted" data-ai-id="image-builder-detail:pods-empty">
                {t('devopsProject.s2ibuilder.resourceStatus.podsEmpty')}
              </p>
            ) : null}
            {!pods.isPending && !pods.isError && (pods.data?.length ?? 0) > 0 ? (
              <table className="w-full border-collapse text-xs" data-ai-id="image-builder-detail:pods-table">
                <thead>
                  <tr className="border-b border-ai-line text-ai-fg-muted">
                    <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.resourceStatus.podName')}</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.resourceStatus.podStatus')}</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.resourceStatus.ready')}</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.resourceStatus.restarts')}</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.resourceStatus.node')}</th>
                    <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.resourceStatus.podIP')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pods.data?.map((pod) => (
                    <tr key={pod.name} className="border-b border-ai-line" data-ai-row={pod.name}>
                      <td className="px-2 py-2 font-mono text-[11px]">{pod.name}</td>
                      <td className="px-2 py-2">{pod.phase || '-'}</td>
                      <td className="px-2 py-2 tabular-nums">{pod.ready}</td>
                      <td className="px-2 py-2 tabular-nums">{pod.restarts}</td>
                      <td className="px-2 py-2">{pod.node || '-'}</td>
                      <td className="px-2 py-2 font-mono text-[11px]">{pod.podIP || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 环境变量                                                             */
/* ------------------------------------------------------------------ */

/** The old console masked values whose variable name hints at a credential. */
const HIDE_RULE = ['password', 'secret'];

function hidden(name: string): boolean {
  const lower = name.toLowerCase();
  return HIDE_RULE.some((rule) => lower.includes(rule));
}

export function EnvironmentPanel({ cluster, namespace, job, jobLoading, jobError, onRetry, hasRun }: JobPanelProps): React.ReactElement {
  const t = useT();
  const containers = React.useMemo(() => job?.containers ?? [], [job]);
  const sources = useEnvSources({ cluster, namespace, containers });
  const [collapsed, setCollapsed] = React.useState<Record<number, boolean>>({});

  return (
    <div className="flex flex-col gap-3" data-ai-id="image-builder-detail:environment">
      {jobLoading ? <Skeleton className="h-16 w-full" /> : null}
      {jobError ? <ResourceErrorPanel error={jobError} onRetry={onRetry} retryAiId="image-builder-detail:env-retry" /> : null}
      {!jobLoading && !jobError && !job ? <NoJobNotice hasRun={hasRun} /> : null}
      {job ? (
        <>
          {sources.isError ? (
            <ResourceErrorPanel error={sources.error} onRetry={() => void sources.refetch()} retryAiId="image-builder-detail:env-sources-retry" />
          ) : null}
          {containers.length === 0 ? (
            <p className="text-xs text-ai-fg-muted" data-ai-id="image-builder-detail:env-empty">
              {t('devopsProject.s2ibuilder.environment.empty')}
            </p>
          ) : null}
          {containers.map((container, index) => {
            const open = !collapsed[index];
            const env = container.env ?? [];
            return (
              <section key={String(container.name ?? index)} className="rounded-ai-md border border-ai-line" data-ai-id={'image-builder-detail:env-container:' + (container.name ?? index)}>
                <Button
                  variant="ghost"
                  className="flex w-full items-center justify-between gap-2 p-3"
                  aria-expanded={open}
                  data-ai-id={'image-builder-detail:env-toggle:' + (container.name ?? index)}
                  onClick={() => setCollapsed((current) => ({ ...current, [index]: open }))}
                >
                  <span className="flex items-center gap-2 text-sm text-ai-fg">
                    <Icon name="docker" size={16} />
                    {t('devopsProject.s2ibuilder.environment.container', { name: container.name ?? '-' })}
                  </span>
                  <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} />
                </Button>
                {open ? (
                  <div className="border-t border-ai-line p-3">
                    {env.length === 0 ? (
                      <p className="text-xs text-ai-fg-muted">{t('devopsProject.s2ibuilder.environment.emptyContainer')}</p>
                    ) : (
                      <table className="w-full border-collapse text-xs" data-ai-id={'image-builder-detail:env-table:' + (container.name ?? index)}>
                        <thead>
                          <tr className="border-b border-ai-line text-ai-fg-muted">
                            <th scope="col" className="px-2 py-1.5 text-left font-medium">{t('devopsProject.s2ibuilder.environment.name')}</th>
                            <th scope="col" className="px-2 py-1.5 text-left font-medium">{t('devopsProject.s2ibuilder.environment.value')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {env.map((entry) => {
                            const name = entry.name ?? '';
                            const ref = entry.valueFrom?.secretKeyRef
                              ? { kind: 'Secret' as const, name: entry.valueFrom.secretKeyRef.name ?? '', key: entry.valueFrom.secretKeyRef.key ?? '' }
                              : entry.valueFrom?.configMapKeyRef
                                ? { kind: 'ConfigMap' as const, name: entry.valueFrom.configMapKeyRef.name ?? '', key: entry.valueFrom.configMapKeyRef.key ?? '' }
                                : null;
                            const resolved = ref ? sources.data?.[ref.kind + '/' + ref.name]?.values[ref.key] : undefined;
                            const value = ref ? resolved ?? '' : entry.value ?? '';
                            const masked = hidden(name);
                            return (
                              <tr key={name} className="border-b border-ai-line" data-ai-row={name}>
                                <td className="px-2 py-1.5 font-mono text-[11px]">{name || '-'}</td>
                                <td className="px-2 py-1.5 font-mono text-[11px] text-ai-fg-secondary">
                                  {masked ? '******' : value || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 事件                                                                 */
/* ------------------------------------------------------------------ */

export function EventsPanel({ cluster, namespace, job, jobLoading, jobError, onRetry, hasRun }: JobPanelProps): React.ReactElement {
  const t = useT();
  const events = useJobEvents({ cluster, namespace, job });

  return (
    <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="image-builder-detail:events">
      <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('devopsProject.s2ibuilder.events.title')}</h2>
      {jobLoading ? <Skeleton className="h-16 w-full" /> : null}
      {jobError ? <ResourceErrorPanel error={jobError} onRetry={onRetry} retryAiId="image-builder-detail:events-job-retry" /> : null}
      {!jobLoading && !jobError && !job ? <NoJobNotice hasRun={hasRun} /> : null}
      {job ? (
        <>
          {events.isPending ? <Skeleton className="h-12 w-full" /> : null}
          {events.isError ? <ResourceErrorPanel error={events.error} onRetry={() => void events.refetch()} retryAiId="image-builder-detail:events-retry" /> : null}
          {!events.isPending && !events.isError && (events.data?.length ?? 0) === 0 ? (
            <p className="text-xs text-ai-fg-muted" data-ai-id="image-builder-detail:events-empty">
              {t('devopsProject.s2ibuilder.events.empty')}
            </p>
          ) : null}
          {!events.isPending && !events.isError && (events.data?.length ?? 0) > 0 ? (
            <table className="w-full border-collapse text-xs" data-ai-id="image-builder-detail:events-table">
              <thead>
                <tr className="border-b border-ai-line text-ai-fg-muted">
                  <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.events.type')}</th>
                  <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.events.reason')}</th>
                  <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.events.lastSeen')}</th>
                  <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.events.count')}</th>
                  <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.events.source')}</th>
                  <th scope="col" className="px-2 py-2 text-left font-medium">{t('devopsProject.s2ibuilder.events.message')}</th>
                </tr>
              </thead>
              <tbody>
                {events.data?.map((event) => (
                  <tr key={event.name} className="border-b border-ai-line" data-ai-row={event.name}>
                    <td className="px-2 py-2">
                      <Badge tone={event.type === 'Warning' ? 'warning' : 'info'}>{event.type || '-'}</Badge>
                    </td>
                    <td className="px-2 py-2">{event.reason || '-'}</td>
                    <td className="px-2 py-2 tabular-nums text-ai-fg-secondary">
                      {event.lastTimestamp ? formatTimestamp(event.lastTimestamp) : '-'}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-ai-fg-secondary">{event.count}</td>
                    <td className="px-2 py-2 text-ai-fg-secondary">{event.source || '-'}</td>
                    <td className="px-2 py-2 text-ai-fg-secondary">{event.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/* Re-exported for the detail page, which owns the latest-run/job derivation. */
export function downloadArtifact(downloadURL: string): void {
  void downloadS2iBinary({ token: currentToken(), downloadURL }).then((blob) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = downloadURL.split('/').pop() ?? 'artifact';
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

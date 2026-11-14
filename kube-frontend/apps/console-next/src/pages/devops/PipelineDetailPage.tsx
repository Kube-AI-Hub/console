import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ApiError,
  devopsCollectionsApi,
  devopsProjectNamespace,
  type DevopsProjectDetail,
  type PipelineRunStatus,
  type PipelineRunSummary,
} from '@kube-ai-hub/api-client';
import { AiButton, AiSurface, Badge, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel, errorMessage } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';

/**
 * 流水线详情.
 *
 * The project detail's pipeline rows used to be plain text; the old console lets a reader
 * open a pipeline and inspect its history. This page adds the read-only half: basic facts
 * plus the pipeline's run records (PipelineRuns), which ks-devops reports through an
 * annotation rather than `status` — see `toPipelineRunSummary`.
 *
 * The namespace comes from the project's `status.adminNamespace` exactly like the project
 * detail page, with the project name as fallback, so a missing pipeline still renders a
 * readable not-found plus an empty run list (this cluster currently has no pipelines).
 */
export interface PipelineDetailPageProps {
  cluster: string;
  /** DevOps project name from the URL. */
  devops: string;
  pipeline: string;
}

const RUN_STATUS_KEYS: Record<PipelineRunStatus, `devops.pipeline.state.${PipelineRunStatus}`> = {
  queued: 'devops.pipeline.state.queued',
  running: 'devops.pipeline.state.running',
  success: 'devops.pipeline.state.success',
  failure: 'devops.pipeline.state.failure',
  aborted: 'devops.pipeline.state.aborted',
  paused: 'devops.pipeline.state.paused',
  unstable: 'devops.pipeline.state.unstable',
  notRunning: 'devops.pipeline.state.notRunning',
};

const RUN_STATUS_TONES: Record<PipelineRunStatus, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  queued: 'info',
  running: 'info',
  success: 'success',
  failure: 'danger',
  aborted: 'warning',
  paused: 'warning',
  unstable: 'warning',
  notRunning: 'neutral',
};

/** `durationInMillis` → `1m 20s`; a run without a duration shows `-`. */
function formatDuration(millis: number): string {
  if (!Number.isFinite(millis) || millis <= 0) return '-';
  const totalSeconds = Math.round(millis / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function PipelineDetailPage({ cluster, devops, pipeline }: PipelineDetailPageProps): React.ReactElement {
  const t = useT();

  const project = useQuery({
    queryKey: ['devops-project', devops],
    queryFn: ({ signal }): Promise<DevopsProjectDetail> =>
      apiClient.request<DevopsProjectDetail>(`/apis/devops.kubesphere.io/v1alpha3/devopsprojects/${encodeURIComponent(devops)}`, {
        ...(signal ? { signal } : {}),
      }),
  });
  const namespace = devopsProjectNamespace(project.data, devops);

  const detail = useQuery({
    queryKey: ['devops-pipeline', namespace, pipeline],
    queryFn: ({ signal }) => devopsCollectionsApi(apiClient).pipeline({ cluster, namespace, name: pipeline, signal }),
    retry: false,
  });

  // The run list is an independent read: a missing pipeline still shows the empty/failed
  // history state, which is exactly the observable shape on a cluster with no pipelines.
  const runs = useQuery({
    queryKey: ['devops-pipeline-runs', namespace, pipeline],
    queryFn: ({ signal }) => devopsCollectionsApi(apiClient).pipelineRuns({ cluster, namespace, pipeline, signal }),
    retry: false,
  });

  const missing = detail.error instanceof ApiError && detail.error.isNotFound;
  const state = detail.isPending ? 'loading' : detail.isError ? 'error' : 'ready';
  const runRows = runs.data ?? [];

  return (
    <AiSurface as="section" aiId="pipeline-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link
          to="/kube-frontend/clusters/$cluster/devops/$name"
          params={{ cluster, name: devops }}
          className="text-sm text-ai-accent hover:underline"
          data-ai-id="pipeline-detail:back"
        >
          ← {devops}
        </Link>
        <h1 className="text-lg font-semibold text-ai-fg" data-ai-id="pipeline-detail:title">
          {detail.data?.alias || detail.data?.name || pipeline}
        </h1>
        <p className="text-xs text-ai-fg-muted">{t('devops.pipeline.subtitle')}</p>
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

      {detail.data ? (
        <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="pipeline-detail:basic">
          <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workspace.detail.basic')}</h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <DefinitionRow label={t('cluster.column.name')} value={detail.data.name} aiId="pipeline-detail:name" />
            <DefinitionRow label={t('devops.pipeline.type')} value={detail.data.type || '-'} aiId="pipeline-detail:type" />
            <DefinitionRow
              label={t('devops.pipeline.status')}
              value={detail.data.syncStatus || '-'}
              aiId="pipeline-detail:status"
            />
            <DefinitionRow
              label={t('cluster.column.createdAt')}
              value={detail.data.createdAt ? formatTimestamp(detail.data.createdAt) : '-'}
              aiId="pipeline-detail:created-at"
            />
            <DefinitionRow label={t('devops.detail.namespace')} value={namespace} aiId="pipeline-detail:namespace" />
          </dl>
          {detail.data.description ? (
            <p className="mt-2 text-xs text-ai-fg-muted" data-ai-id="pipeline-detail:description">
              {detail.data.description}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="pipeline-detail:runs">
        <h2 className="mb-3 text-sm font-medium text-ai-fg">
          {t('devops.pipeline.runs')}
          {runs.data ? ` (${runRows.length})` : null}
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
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('devops.pipeline.column.runId')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('devops.pipeline.column.status')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('devops.pipeline.column.startTime')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('devops.pipeline.column.duration')}</th>
              </tr>
            </thead>
            <tbody>
              {runRows.map((row: PipelineRunSummary) => (
                <tr key={row.runId} className="border-b border-ai-line" data-ai-row={row.runId}>
                  <td className="px-2 py-2 font-mono text-[11px] text-ai-fg-secondary">{row.runId || '-'}</td>
                  <td className="px-2 py-2">
                    <Badge tone={RUN_STATUS_TONES[row.status]}>{t(RUN_STATUS_KEYS[row.status])}</Badge>
                  </td>
                  <td className="px-2 py-2 tabular-nums text-ai-fg-secondary">
                    {row.startTime ? formatTimestamp(row.startTime) : '-'}
                  </td>
                  <td className="px-2 py-2 tabular-nums text-ai-fg-secondary">{formatDuration(row.durationMillis)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </AiSurface>
  );
}

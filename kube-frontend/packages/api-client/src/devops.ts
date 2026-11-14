import type { Client } from './client';
import { baseOf, type KubeObject, type ResourceBase } from './resources';

/**
 * DevOps project sub-collections: pipelines, continuous deployment (GitOps
 * Applications) and code repositories (GitRepositories).
 *
 * Probed on this cluster (2026-11-15):
 * - `/apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/pipelines` → 200
 * - `/apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/gitrepositories` → 200
 * - `/apis/gitops.kubesphere.io/v1alpha1/namespaces/<ns>/applications` → 200 (CD)
 * - `…/cd` and `…/coderepositories` → **404**; the real resource names are
 *   `gitrepositories` and the CD list lives in the gitops group. The old console's
 *   `cds`/`codeRepos` modules map to exactly these two.
 *
 * All three are namespaced, and the namespace is the DevOps project's
 * **`status.adminNamespace`** (the CRD's only status field), not necessarily the
 * project's name. There is no live project on this installation to confirm the value,
 * so the reader falls back to the project name — the same assumption the old console
 * made — and the UI says which namespace it used.
 */

const DEVOPS_VERSION = 'devops.kubesphere.io/v1alpha3';
const GITOPS_VERSION = 'gitops.kubesphere.io/v1alpha1';

/** The DevOpsProject CRD's fields this app reads. */
export interface DevopsProjectDetail extends KubeObject {
  spec?: { argo?: unknown };
  status?: { adminNamespace?: string };
}

/**
 * The namespace that holds a project's pipelines/CD/code repositories.
 *
 * `status.adminNamespace` is written by the devops controller. Falling back to the
 * project name keeps the tabs readable for a half-created or missing project (the old
 * console used the project name as the namespace too) instead of hiding the page; the
 * fallback is visible as a value, so a wrong guess is diagnosable.
 */
export function devopsProjectNamespace(project: DevopsProjectDetail | undefined, fallback: string): string {
  const namespace = project?.status?.adminNamespace;
  return typeof namespace === 'string' && namespace.trim() ? namespace.trim() : fallback;
}

/** One pipeline row. */
export interface PipelineSummary extends ResourceBase {
  /** `spec.type`: `pipeline` or `multi-branch-pipeline`. */
  type: string;
  /** Jenkins sync state, from the `pipeline.devops.kubesphere.io/syncstatus` annotation. */
  syncStatus: string;
}

interface KubePipeline extends KubeObject {
  spec?: { type?: string };
}

export function toPipelineSummary(item: KubePipeline): PipelineSummary {
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  return {
    ...baseOf(item),
    type: String(item.spec?.type ?? 'pipeline'),
    syncStatus: annotations['pipeline.devops.kubesphere.io/syncstatus'] ?? '',
  };
}

/** One code repository row (devops `GitRepository`). */
export interface CodeRepositorySummary extends ResourceBase {
  /** `spec.provider`: github / gitlab / bitbucket / gitee … */
  provider: string;
  /** `spec.url`: the clone URL. */
  url: string;
}

interface KubeGitRepository extends KubeObject {
  spec?: { provider?: string; url?: string };
}

export function toCodeRepositorySummary(item: KubeGitRepository): CodeRepositorySummary {
  return {
    ...baseOf(item),
    provider: String(item.spec?.provider ?? ''),
    url: String(item.spec?.url ?? ''),
  };
}

/** One continuous-deployment row (KubeSphere GitOps `Application`). */
export interface CdApplicationSummary extends ResourceBase {
  /** Argo CD `status.sync.status`: Synced / OutOfSync / Unknown. */
  syncStatus: string;
  /** Argo CD `status.health.status`: Healthy / Degraded / Progressing / Missing / Unknown. */
  healthStatus: string;
  /** `spec.argoApp.spec.destination.namespace` — the namespace being deployed to. */
  destination: string;
}

interface KubeApplication extends KubeObject {
  spec?: { argoApp?: { spec?: { destination?: { namespace?: string; name?: string } } } };
  status?: { argoApp?: unknown };
}

/**
 * Read the wrapped Argo CD status.
 *
 * KubeSphere stores the Argo status in `status.argoApp`, which the CRD declares as a
 * **string** — the controller writes JSON into it. A non-JSON value is treated as the
 * status text itself, so a controller that changes the encoding does not blank the
 * column.
 */
function argoStatusOf(item: KubeApplication): Record<string, unknown> {
  const raw = item.status?.argoApp;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
      return { sync: { status: raw.trim() } };
    } catch {
      return { sync: { status: raw.trim() } };
    }
  }
  return {};
}

function nestedStatus(status: Record<string, unknown>, group: 'sync' | 'health'): string {
  const entry = status[group];
  if (!entry || typeof entry !== 'object') return '';
  const value = (entry as Record<string, unknown>)['status'];
  return typeof value === 'string' ? value : '';
}

export function toCdApplicationSummary(item: KubeApplication): CdApplicationSummary {
  const argoStatus = argoStatusOf(item);
  const destination = item.spec?.argoApp?.spec?.destination;
  return {
    ...baseOf(item),
    syncStatus: nestedStatus(argoStatus, 'sync'),
    healthStatus: nestedStatus(argoStatus, 'health'),
    destination: String(destination?.namespace ?? destination?.name ?? ''),
  };
}

/** Everything the pipeline detail page shows; the list row is a subset. */
export interface PipelineDetail extends PipelineSummary {
  description: string;
  raw: KubeObject;
}

export function toPipelineDetail(item: KubePipeline): PipelineDetail {
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  return {
    ...toPipelineSummary(item),
    description: annotations['kubesphere.io/description'] ?? '',
    raw: item,
  };
}

/** The states a PipelineRun reports through the Jenkins status annotation. */
export type PipelineRunStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failure'
  | 'aborted'
  | 'paused'
  | 'unstable'
  | 'notRunning';

/** One run row: 编号 / 状态 / 开始时间 / 耗时, plus the fields the table may grow. */
export interface PipelineRunSummary extends ResourceBase {
  /** Jenkins run id, falling back to the object name when the annotation has none. */
  runId: string;
  /** Jenkins `state`: QUEUED / RUNNING / FINISHED / PAUSED. */
  state: string;
  /** Jenkins `result`: SUCCESS / FAILURE / ABORTED / UNSTABLE, empty while running. */
  result: string;
  /** Derived from state+result, so the page does not repeat the mapping. */
  status: PipelineRunStatus;
  startTime: string;
  durationMillis: number;
  commitId: string;
  /** Multi-branch runs carry the branch in `spec.scm.refName`. */
  branch: string;
}

interface KubePipelineRun extends KubeObject {
  spec?: { pipelineRef?: { name?: string }; scm?: { refName?: string } };
}

/**
 * The run status lives in an annotation, not in `status`.
 *
 * The CRD's status is unused/pruned, and ks-devops mirrors Jenkins' state into
 * `devops.kubesphere.io/jenkins-pipelinerun-status` as a JSON string. A non-JSON value
 * is ignored rather than treated as a state.
 */
function jenkinsStatusOf(item: KubePipelineRun): Record<string, unknown> {
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  const raw = annotations['devops.kubesphere.io/jenkins-pipelinerun-status'];
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function pipelineRunStatusOf(state: string, result: string): PipelineRunStatus {
  if (state === 'QUEUED') return 'queued';
  if (state === 'RUNNING') return 'running';
  if (state === 'PAUSED') return 'paused';
  if (result === 'UNSTABLE') return 'unstable';
  if (state === 'FINISHED' && result === 'SUCCESS') return 'success';
  if (state === 'FINISHED' && result === 'FAILURE') return 'failure';
  if (state === 'FINISHED' && result === 'ABORTED') return 'aborted';
  return 'notRunning';
}

export function toPipelineRunSummary(item: KubePipelineRun): PipelineRunSummary {
  const status = jenkinsStatusOf(item);
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  const state = String(status['state'] ?? '');
  const result = String(status['result'] ?? '');
  return {
    ...baseOf(item),
    runId: String(status['id'] ?? annotations['devops.kubesphere.io/jenkins-pipelinerun-id'] ?? item.metadata?.name ?? ''),
    state,
    result,
    status: pipelineRunStatusOf(state, result),
    startTime: String(status['startTime'] ?? item.metadata?.creationTimestamp ?? ''),
    durationMillis: Number(status['durationInMillis'] ?? 0) || 0,
    commitId: String(status['commitId'] ?? ''),
    branch: String(item.spec?.scm?.refName ?? ''),
  };
}

/** Whether a run belongs to one pipeline: label first, `spec.pipelineRef` as the fallback. */
export function isRunOfPipeline(item: KubePipelineRun, pipeline: string): boolean {
  const labels = (item.metadata?.labels ?? {}) as Record<string, string>;
  if (labels['devops.kubesphere.io/pipeline'] === pipeline) return true;
  return item.spec?.pipelineRef?.name === pipeline;
}

/**
 * Path for one namespaced devops/gitops collection, optionally one object.
 *
 * The `clusters/<id>` segment matches the other native kube paths in this app; only
 * the host cluster is verified on this installation.
 */
function collectionPath(groupVersion: string, cluster: string, namespace: string, resource: string, name?: string): string {
  const clusterSegment = cluster && cluster !== 'host' ? `clusters/${encodeURIComponent(cluster)}/` : '';
  const base = `/apis/${groupVersion}/${clusterSegment}namespaces/${encodeURIComponent(namespace)}/${resource}`;
  return name ? `${base}/${encodeURIComponent(name)}` : base;
}

export function devopsCollectionsApi(client: Client) {
  return {
    async pipelines(params: { cluster: string; namespace: string; signal?: AbortSignal }): Promise<PipelineSummary[]> {
      const body = await client.request<{ items?: KubePipeline[] }>(
        collectionPath(DEVOPS_VERSION, params.cluster, params.namespace, 'pipelines'),
        { ...(params.signal ? { signal: params.signal } : {}) },
      );
      return (body?.items ?? []).map(toPipelineSummary);
    },

    async codeRepositories(params: { cluster: string; namespace: string; signal?: AbortSignal }): Promise<CodeRepositorySummary[]> {
      const body = await client.request<{ items?: KubeGitRepository[] }>(
        collectionPath(DEVOPS_VERSION, params.cluster, params.namespace, 'gitrepositories'),
        { ...(params.signal ? { signal: params.signal } : {}) },
      );
      return (body?.items ?? []).map(toCodeRepositorySummary);
    },

    async cdApplications(params: { cluster: string; namespace: string; signal?: AbortSignal }): Promise<CdApplicationSummary[]> {
      const body = await client.request<{ items?: KubeApplication[] }>(
        collectionPath(GITOPS_VERSION, params.cluster, params.namespace, 'applications'),
        { ...(params.signal ? { signal: params.signal } : {}) },
      );
      return (body?.items ?? []).map(toCdApplicationSummary);
    },

    /** One pipeline, for the detail page. A missing pipeline is a 404 `Status`. */
    async pipeline(params: { cluster: string; namespace: string; name: string; signal?: AbortSignal }): Promise<PipelineDetail> {
      const item = await client.request<KubePipeline>(
        collectionPath(DEVOPS_VERSION, params.cluster, params.namespace, 'pipelines', params.name),
        { ...(params.signal ? { signal: params.signal } : {}) },
      );
      return toPipelineDetail(item);
    },

    /**
     * Runs of one pipeline.
     *
     * The server-side filter is the label ks-devops writes
     * (`devops.kubesphere.io/pipeline`). No run exists on this cluster to confirm the
     * label from real controller output, so an empty label result triggers one
     * unfiltered read matched by label **or** `spec.pipelineRef.name`: a controller
     * that changes the label key must not make every pipeline look like it never ran.
     */
    async pipelineRuns(params: {
      cluster: string;
      namespace: string;
      pipeline: string;
      signal?: AbortSignal;
    }): Promise<PipelineRunSummary[]> {
      const path = collectionPath(DEVOPS_VERSION, params.cluster, params.namespace, 'pipelineruns');
      const signal = params.signal ? { signal: params.signal } : {};
      const filtered = await client.request<{ items?: KubePipelineRun[] }>(path, {
        query: { labelSelector: `devops.kubesphere.io/pipeline=${params.pipeline}` },
        ...signal,
      });
      const byLabel = (filtered?.items ?? []).filter((item) => isRunOfPipeline(item, params.pipeline));
      if (byLabel.length > 0) return byLabel.map(toPipelineRunSummary);
      const all = await client.request<{ items?: KubePipelineRun[] }>(path, signal);
      return (all?.items ?? []).filter((item) => isRunOfPipeline(item, params.pipeline)).map(toPipelineRunSummary);
    },
  };
}

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
 * project's name. On this installation the controller does write it, and for a
 * freshly created project it equals the project name; the reader still falls back
 * to the project name for a half-created project and the UI says which namespace
 * it used, so a wrong guess is diagnosable instead of silent.
 */

const DEVOPS_VERSION = 'devops.kubesphere.io/v1alpha3';
const GITOPS_VERSION = 'gitops.kubesphere.io/v1alpha1';

/**
 * Where the deployed devops-apiserver actually serves its kapis routes.
 *
 * Only these paths answer on this installation (probed 2026-11-15):
 * `/workspaces/<ws>/devops`, `/devops/<d>/pipelines`,
 * `/devops/<d>/pipelines/<p>`, `PUT …/pipelines/<p>/jenkinsfile`,
 * `/devops/<d>/credentials`, `/clustertemplates`.
 * The upstream multi-cluster prefix (`/klusters/<cluster>`) and the pipeline-scoped
 * `pipelineruns`/`branches`/`scan`/`sonarqube` routes answer 404 here, so every
 * collection that the kapis group does not serve is read from the raw group
 * instead of being hidden. The old console built the same paths from
 * `API_VERSIONS` + `getPath()`; the difference is recorded in the design doc.
 */
const DEVOPS_KAPIS = '/kapis/devops.kubesphere.io/v1alpha3';
const IAM_KAPIS = '/kapis/iam.kubesphere.io/v1alpha2';

/** The DevOpsProject CRD's fields this app reads. */
export interface DevopsProjectDetail extends KubeObject {
  spec?: { argo?: { sourceRepos?: unknown[]; destinations?: unknown[] } };
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
  spec?: {
    type?: string;
    pipeline?: { jenkinsfile?: string; name?: string; parameters?: unknown[]; disable_concurrent?: boolean };
    multi_branch_pipeline?: Record<string, unknown>;
  };
}

export function toPipelineSummary(item: KubePipeline): PipelineSummary {
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  return {
    ...baseOf(item),
    type: String(item.spec?.type ?? 'pipeline'),
    syncStatus: annotations['pipeline.devops.kubesphere.io/syncstatus'] ?? '',
  };
}

/** One pipeline parameter as the devops controller reports it. */
export interface PipelineParameter {
  name: string;
  defaultValue: string;
  description: string;
  type: string;
}

/** Jenkins metadata the controller mirrors into the pipeline annotation. */
interface JenkinsMetadata {
  weatherScore?: number;
  totalNumberOfBranches?: number;
  totalNumberOfPullRequests?: number;
  branchNames?: string[];
  parameters?: { name?: string; value?: string; defaultValue?: string; description?: string; type?: string }[];
  disabledBrancheNames?: string[];
  numberOfFailingBranches?: number;
  numberOfSuccessfulBranches?: number;
}

/**
 * The Jenkins-derived half of a pipeline row.
 *
 * ks-devops mirrors Jenkins' view into `pipeline.devops.kubesphere.io/jenkins-metadata`
 * as a JSON string. The old console parsed it and then **defaulted `weatherScore` to 100
 * and every counter to 0**, which made an unsynced pipeline look perfectly healthy and
 * empty. This reader keeps `undefined` for anything the annotation does not carry, so the
 * page can render "no status" instead of a fabricated number; that difference is a
 * deliberate design decision, not an oversight.
 */
function jenkinsMetadataOf(item: KubePipeline): JenkinsMetadata | undefined {
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  const raw = annotations['pipeline.devops.kubesphere.io/jenkins-metadata'];
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    return parsed as JenkinsMetadata;
  } catch {
    return undefined;
  }
}

/** One pipeline row as the list page renders it: the summary plus the Jenkins half. */
export interface PipelineRow extends PipelineSummary {
  /** `weatherScore` 0–100; `undefined` when Jenkins has not reported it. */
  health: number | undefined;
  /** Total branches Jenkins knows; `undefined` for a single-branch pipeline. */
  branchCount: number | undefined;
  /** Total pull requests Jenkins knows; `undefined` for a single-branch pipeline. */
  pullRequestCount: number | undefined;
  branchNames: string[];
  disabledBranchNames: string[];
  parameters: PipelineParameter[];
  /** `jenkinsfile.validate === 'success'`; `undefined` when never validated. */
  validated: boolean | undefined;
  /** `spec.pipeline.jenkinsfile`, empty for a multi-branch pipeline. */
  jenkinsfile: string;
  raw: KubeObject;
}

export function toPipelineRow(item: KubePipeline): PipelineRow {
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  const metadata = jenkinsMetadataOf(item);
  const validate = annotations['pipeline.devops.kubesphere.io/jenkinsfile.validate'];
  const isMultiBranch = (item.spec?.type ?? '') === 'multi-branch-pipeline';
  return {
    ...toPipelineSummary(item),
    health: typeof metadata?.weatherScore === 'number' ? metadata.weatherScore : undefined,
    branchCount:
      typeof metadata?.totalNumberOfBranches === 'number'
        ? metadata.totalNumberOfBranches
        : isMultiBranch
          ? undefined
          : 0,
    pullRequestCount:
      typeof metadata?.totalNumberOfPullRequests === 'number' ? metadata.totalNumberOfPullRequests : undefined,
    branchNames: Array.isArray(metadata?.branchNames) ? metadata!.branchNames! : [],
    disabledBranchNames: Array.isArray(metadata?.disabledBrancheNames) ? metadata!.disabledBrancheNames! : [],
    parameters: (metadata?.parameters ?? []).map((parameter) => ({
      name: String(parameter.name ?? ''),
      defaultValue: String(parameter.defaultValue ?? parameter.value ?? ''),
      description: String(parameter.description ?? ''),
      type: String(parameter.type ?? ''),
    })),
    validated: validate === undefined ? undefined : validate === 'success',
    jenkinsfile: String(item.spec?.pipeline?.jenkinsfile ?? ''),
    raw: item,
  };
}

/** One code repository row (devops `GitRepository`). */
export interface CodeRepositorySummary extends ResourceBase {
  /** `spec.provider`: github / gitlab / bitbucket / gitee … */
  provider: string;
  /** `spec.url`: the clone URL. */
  url: string;
  /** `spec.secret.name` (or `spec.secretRef.name`): the credential used to clone. */
  secretName: string;
}

interface KubeGitRepository extends KubeObject {
  spec?: { provider?: string; url?: string; secret?: { name?: string }; secretRef?: { name?: string } };
}

export function toCodeRepositorySummary(item: KubeGitRepository): CodeRepositorySummary {
  return {
    ...baseOf(item),
    provider: String(item.spec?.provider ?? ''),
    url: String(item.spec?.url ?? ''),
    secretName: String(item.spec?.secret?.name ?? item.spec?.secretRef?.name ?? ''),
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
  /** `causes[0].shortDescription`: why Jenkins started the run. */
  cause: string;
  /** `status.phase` from the CR (the controller writes it; empty before it reconciles). */
  phase: string;
  /** `status.message`: the controller's failure reason, verbatim. */
  message: string;
  /** Declared parameters of this run (`spec.parameters`). */
  parameters: { name: string; value: string }[];
  raw: KubeObject;
}

interface KubePipelineRun extends KubeObject {
  spec?: { pipelineRef?: { name?: string }; scm?: { refName?: string }; parameters?: { name?: string; value?: unknown }[] };
  status?: { phase?: string; message?: string; startTime?: string; completionTime?: string };
}

/**
 * The run status lives in an annotation, not in `status`.
 *
 * The CRD's `status` only carries phase/conditions, and ks-devops mirrors Jenkins' state
 * into `devops.kubesphere.io/jenkins-pipelinerun-status` as a JSON string. A non-JSON value
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
  const causes = status['causes'];
  const firstCause =
    Array.isArray(causes) && causes[0] && typeof causes[0] === 'object'
      ? String((causes[0] as Record<string, unknown>)['shortDescription'] ?? '')
      : '';
  return {
    ...baseOf(item),
    runId: String(status['id'] ?? annotations['devops.kubesphere.io/jenkins-pipelinerun-id'] ?? item.metadata?.name ?? ''),
    state,
    result,
    status: pipelineRunStatusOf(state, result),
    startTime: String(status['startTime'] ?? item.status?.startTime ?? item.metadata?.creationTimestamp ?? ''),
    durationMillis: Number(status['durationInMillis'] ?? 0) || 0,
    commitId: String(status['commitId'] ?? ''),
    branch: String(item.spec?.scm?.refName ?? ''),
    cause: firstCause,
    phase: String(item.status?.phase ?? ''),
    message: String(item.status?.message ?? ''),
    parameters: (item.spec?.parameters ?? []).map((parameter) => ({
      name: String(parameter.name ?? ''),
      value: String(parameter.value ?? ''),
    })),
    raw: item,
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
     * (`devops.kubesphere.io/pipeline`). A run created before the label was adopted (or by
     * a controller that changes the key) must not make the pipeline look like it never
     * ran, so an empty label result triggers one unfiltered read matched by label **or**
     * `spec.pipelineRef.name`.
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
      if (byLabel.length > 0) return sortRunsNewestFirst(byLabel.map(toPipelineRunSummary));
      const all = await client.request<{ items?: KubePipelineRun[] }>(path, signal);
      return sortRunsNewestFirst(
        (all?.items ?? []).filter((item) => isRunOfPipeline(item, params.pipeline)).map(toPipelineRunSummary),
      );
    },

    /** One run, by the object name the list returned. */
    async pipelineRun(params: {
      cluster: string;
      namespace: string;
      name: string;
      signal?: AbortSignal;
    }): Promise<PipelineRunSummary> {
      const item = await client.request<KubePipelineRun>(
        collectionPath(DEVOPS_VERSION, params.cluster, params.namespace, 'pipelineruns', params.name),
        { ...(params.signal ? { signal: params.signal } : {}) },
      );
      return toPipelineRunSummary(item);
    },
  };
}

/**
 * Newest first, by start time and then by creation time.
 *
 * The raw kube collection has no server-side sort, and ks-devops' own kapis endpoint
 * (which sorted) answers 404 on this installation. Sorting here keeps the page's
 * default order equal to the old console's, and the comparison falls back to
 * `createdAt` so a run without a Jenkins start time still lands in a stable place
 * instead of jumping around between refreshes.
 */
function sortRunsNewestFirst(runs: PipelineRunSummary[]): PipelineRunSummary[] {
  return [...runs].sort((a, b) => {
    const left = Date.parse(a.startTime || a.createdAt || '') || 0;
    const right = Date.parse(b.startTime || b.createdAt || '') || 0;
    return right - left;
  });
}


/* ------------------------------------------------------------------------- *
 * Write side and the kapis-served collections.
 *
 * Everything below was probed against the live devops-apiserver on 2026-11-15
 * (the request/response table lives in design/devops-projects.md):
 *   POST   /kapis/devops…/v1alpha3/workspaces/<ws>/devops            → 200 (needs metadata.generateName)
 *   GET    /kapis/devops…/v1alpha3/devops/<d>/pipelines              → 200
 *   GET    /kapis/devops…/v1alpha3/devops/<d>/pipelines/<p>          → 200
 *   PUT    /kapis/devops…/v1alpha3/devops/<d>/pipelines/<p>/jenkinsfile → route exists (GET is 405)
 *   GET    /kapis/devops…/v1alpha3/devops/<d>/credentials            → 200 but ALWAYS 0 items
 *   POST   /kapis/devops…/v1alpha3/devops/<d>/credentials            → 200
 *   GET    /kapis/iam…/v1alpha2/devops/<d>/members                   → 200
 *   GET    /kapis/iam…/v1alpha2/devops/<d>/roles                     → 200 (19 rows: 3 preset + 16 templates)
 *   GET    /api/v1/namespaces/<ns>/secrets                           → 200 (the credentials the kapis list misses)
 * ------------------------------------------------------------------------- */

const PROJECT_API = '/apis/' + DEVOPS_VERSION + '/devopsprojects';
const ANNOTATION_ALIAS = 'kubesphere.io/alias-name';
const ANNOTATION_DESCRIPTION = 'kubesphere.io/description';

function q(value: string): string {
  return encodeURIComponent(value);
}

/** One DevOps project row. */
export interface DevopsProjectSummary extends ResourceBase {
  /** metadata.labels['kubesphere.io/workspace'] — the owning workspace. */
  workspace: string;
  /** status.adminNamespace; empty until the controller reconciles. */
  adminNamespace: string;
  /** devopsproject.devops.kubesphere.io/syncstatus: pending / successful / failed. */
  syncStatus: string;
  /** spec.placement.cluster, written by the create form on a multi-cluster install. */
  placementCluster: string;
  /** spec.argo.sourceRepos — the CD allow-list of code repositories. */
  sourceRepos: string[];
  /** spec.argo.destinations — the CD allow-list of deployment locations. */
  destinations: { name: string; namespace: string; server: string }[];
  raw: KubeObject;
}

export function toDevopsProjectSummary(item: KubeObject): DevopsProjectSummary {
  const project = item as DevopsProjectDetail;
  const spec = (item as { spec?: { placement?: { cluster?: string } } }).spec;
  const argo = project.spec?.argo;
  const sourceRepos = Array.isArray(argo?.sourceRepos) ? argo!.sourceRepos!.map((entry) => String(entry)) : [];
  const destinations = Array.isArray(argo?.destinations)
    ? argo!.destinations!.map((entry) => {
        const record = (entry ?? {}) as Record<string, unknown>;
        return {
          name: String(record.name ?? ''),
          namespace: String(record.namespace ?? ''),
          server: String(record.server ?? ''),
        };
      })
    : [];
  return {
    ...baseOf(item),
    workspace: (item.metadata?.labels ?? {})['kubesphere.io/workspace'] ?? '',
    adminNamespace: project.status?.adminNamespace ?? '',
    syncStatus: (item.metadata?.annotations ?? {})['devopsproject.devops.kubesphere.io/syncstatus'] ?? '',
    placementCluster: spec?.placement?.cluster ?? '',
    sourceRepos,
    destinations,
    raw: item,
  };
}

/**
 * A create body whose metadata also carries `generateName`.
 *
 * `KubeObject['metadata']` is the read shape and has no `generateName`, while both devops
 * creates require it (the apiserver rejects a body that only sets `name`). Widening the
 * metadata here keeps the read type honest instead of adding a field every reader would
 * then have to treat as possibly present.
 */
export interface KubeWriteObject extends Omit<KubeObject, 'metadata'> {
  metadata?: NonNullable<KubeObject['metadata']> & { generateName?: string };
}

/**
 * The two console annotations, written only when they have a value.
 *
 * `metadataAnnotations` takes optional strings, but this package compiles with
 * `exactOptionalPropertyTypes`, so passing `{ alias: undefined }` is not the same as
 * omitting the key. Building the record here keeps both call sites type-clean and makes
 * "empty means remove the annotation" a single rule.
 */
function annotationsOf(input: {
  alias?: string | undefined;
  description?: string | undefined;
}): Record<string, string> {
  const annotations: Record<string, string> = {};
  if (input.alias?.trim()) annotations[ANNOTATION_ALIAS] = input.alias.trim();
  if (input.description?.trim()) annotations[ANNOTATION_DESCRIPTION] = input.description.trim();
  return annotations;
}

/** What the create form collects; the server appends a 5-character suffix to the name. */
export interface DevopsProjectDraft {
  /** Goes into metadata.generateName — the API rejects a body that only sets metadata.name. */
  generateName: string;
  workspace: string;
  cluster?: string;
  alias?: string;
  description?: string;
}

/**
 * The DevOpsProject create body.
 *
 * metadata.generateName is mandatory: the devops-apiserver answers
 * 'DevOpsProject "" is invalid: metadata.generateName: Required value' for a body that
 * only sets metadata.name (probed 2026-11-15). The 5-character suffix it appends is why
 * the old console trimmed name.slice(0, -5) to recover the typed name.
 */
export function devopsProjectCreateBody(draft: DevopsProjectDraft): KubeWriteObject {
  const annotations = annotationsOf({ alias: draft.alias, description: draft.description });
  return {
    kind: 'DevOpsProject',
    apiVersion: DEVOPS_VERSION,
    metadata: {
      generateName: draft.generateName,
      labels: { 'kubesphere.io/workspace': draft.workspace },
      ...(Object.keys(annotations).length > 0 ? { annotations } : {}),
    },
    spec: draft.cluster ? { placement: { cluster: draft.cluster } } : {},
  };
}

/** One pipeline parameter definition the create form accepts. */
export interface PipelineParameterDraft {
  name: string;
  defaultValue: string;
  description: string;
}

/** What the pipeline create / edit form collects. */
export interface PipelineDraft {
  name: string;
  alias?: string;
  description?: string;
  type: 'pipeline' | 'multi-branch-pipeline';
  /** Single-branch: the Jenkinsfile text. */
  jenkinsfile?: string;
  /** Multi-branch: which SCM the repository lives in. */
  sourceType?: 'github' | 'gitlab' | 'bitbucket' | 'gitee' | 'svn' | 'single_svn' | undefined;
  repoUrl?: string;
  owner?: string;
  credentialId?: string;
  scriptPath?: string;
  regexFilter?: string;
  parameters?: PipelineParameterDraft[];
}

/**
 * The Pipeline create body.
 *
 * A single-branch pipeline stores the Jenkinsfile inline in spec.pipeline.jenkinsfile;
 * a multi-branch pipeline stores only the SCM discovery settings in
 * spec.multi_branch_pipeline and lets Jenkins read the script from the repository
 * (script_path), which is why the two shapes never share a branch.
 */
export function pipelineCreateBody(draft: PipelineDraft): KubeWriteObject {
  const annotations = annotationsOf({ alias: draft.alias, description: draft.description });
  const metadata: Record<string, unknown> = { name: draft.name };
  if (Object.keys(annotations).length > 0) metadata.annotations = annotations;

  if (draft.type === 'multi-branch-pipeline') {
    const sourceType = draft.sourceType ?? 'github';
    const source: Record<string, unknown> = {
      credential_id: draft.credentialId ?? '',
      repo: draft.repoUrl ?? '',
    };
    if (sourceType !== 'svn' && sourceType !== 'single_svn') source.owner = draft.owner ?? '';
    if (draft.regexFilter) source.regex_filter = draft.regexFilter;
    const multi: Record<string, unknown> = {
      name: draft.name,
      source_type: sourceType,
      script_path: draft.scriptPath || 'Jenkinsfile',
    };
    multi[sourceType + '_source'] = source;
    return {
      kind: 'Pipeline',
      apiVersion: DEVOPS_VERSION,
      metadata,
      spec: { type: 'multi-branch-pipeline', multi_branch_pipeline: multi },
    };
  }

  return {
    kind: 'Pipeline',
    apiVersion: DEVOPS_VERSION,
    metadata,
    spec: {
      type: 'pipeline',
      pipeline: {
        name: draft.name,
        jenkinsfile: draft.jenkinsfile ?? '',
        ...(draft.parameters && draft.parameters.length > 0
          ? {
              parameters: draft.parameters.map((parameter) => ({
                name: parameter.name,
                default_value: parameter.defaultValue,
                description: parameter.description,
                type: 'string',
              })),
            }
          : {}),
      },
    },
  };
}

/** One run trigger request. */
export interface RunPipelineRequest {
  namespace: string;
  pipeline: string;
  /** Multi-branch: the branch to run; empty runs the default branch. */
  branch?: string;
  parameters?: { name: string; value: string }[];
}

/**
 * The PipelineRun create body used to trigger a run.
 *
 * The kapis route the old console posted to
 * (POST …/devops/<d>/pipelines/<p>/pipelineruns) answers 404 on this installation, so the
 * run is created the way that route itself creates it: a PipelineRun CR in the project
 * namespace, labelled with the pipeline it belongs to. The object is accepted (201) and
 * readable; whether Jenkins then executes it depends on the controller's Jenkins
 * credentials — an environment condition the page reports verbatim (status.message)
 * instead of pretending the run started.
 */
export function pipelineRunCreateBody(request: RunPipelineRequest): KubeWriteObject {
  const spec: Record<string, unknown> = {
    pipelineRef: { name: request.pipeline, kind: 'Pipeline', apiVersion: DEVOPS_VERSION },
    parameters: (request.parameters ?? []).map((parameter) => ({ name: parameter.name, value: parameter.value })),
  };
  if (request.branch) spec.scm = { refName: request.branch, refType: 'branch' };
  return {
    kind: 'PipelineRun',
    apiVersion: DEVOPS_VERSION,
    metadata: {
      generateName: request.pipeline + '-',
      namespace: request.namespace,
      labels: { 'devops.kubesphere.io/pipeline': request.pipeline },
    },
    spec,
  };
}

/** The credential kinds the devops apiserver recognises (from the old console's CREDENTIAL_KEY). */
export type CredentialKind = 'username_password' | 'ssh' | 'secret_text' | 'kubeconfig';

const CREDENTIAL_SECRET_TYPE: Record<CredentialKind, string> = {
  username_password: 'credential.devops.kubesphere.io/basic-auth',
  ssh: 'credential.devops.kubesphere.io/ssh-auth',
  secret_text: 'credential.devops.kubesphere.io/secret-text',
  kubeconfig: 'credential.devops.kubesphere.io/kubeconfig',
};

const CREDENTIAL_KIND_OF_SECRET: Record<string, CredentialKind> = {
  'credential.devops.kubesphere.io/basic-auth': 'username_password',
  'credential.devops.kubesphere.io/ssh-auth': 'ssh',
  'credential.devops.kubesphere.io/secret-text': 'secret_text',
  'credential.devops.kubesphere.io/kubeconfig': 'kubeconfig',
};

/** One credential row. */
export interface CredentialRow extends ResourceBase {
  /** username_password / ssh / secret_text / kubeconfig. */
  kind: CredentialKind | '';
  /** The Secret's type, kept so an unknown kind is visible instead of silently dropped. */
  secretType: string;
  /** Jenkins sync state from credential.devops.kubesphere.io/syncstatus. */
  syncStatus: string;
  /** Decoded data.username; empty for a secret_text / kubeconfig credential. */
  username: string;
  raw: KubeObject;
}

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value: string): string {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

/**
 * Map one Secret to a credential row.
 *
 * The kapis /credentials list answers 200 with items: [] on this installation even for
 * credentials that same API just created, so the list is read from the Secret collection
 * and filtered by the credential.devops.kubesphere.io/* secret type. That keeps the tab
 * truthful: a credential that exists is shown, and a Secret that is not a devops
 * credential is not.
 */
export function toCredentialRow(secret: KubeObject): CredentialRow {
  const secretType = String((secret as { type?: string }).type ?? '');
  const data = ((secret as { data?: Record<string, string> }).data ?? {}) as Record<string, string>;
  const annotations = (secret.metadata?.annotations ?? {}) as Record<string, string>;
  return {
    ...baseOf(secret),
    kind: CREDENTIAL_KIND_OF_SECRET[secretType] ?? '',
    secretType,
    syncStatus: annotations['credential.devops.kubesphere.io/syncstatus'] ?? '',
    username: data.username ? fromBase64(data.username) : '',
    raw: secret,
  };
}

/** Whether a Secret is one of the four devops credential types. */
export function isDevopsCredential(secret: KubeObject): boolean {
  return String((secret as { type?: string }).type ?? '') in CREDENTIAL_KIND_OF_SECRET;
}

/** What the credential form collects. */
export interface CredentialDraft {
  name: string;
  kind: CredentialKind;
  description?: string;
  /** The kind-specific fields; every non-empty value is base64-encoded on the way out. */
  fields: Record<string, string>;
}

/** The Secret body the kapis credential endpoint accepts. */
export function credentialCreateBody(draft: CredentialDraft, namespace: string): KubeWriteObject {
  const data: Record<string, string> = {};
  Object.entries(draft.fields).forEach(([key, value]) => {
    if (value) data[key] = toBase64(value);
  });
  const annotations = annotationsOf({ description: draft.description });
  return {
    kind: 'Secret',
    apiVersion: 'v1',
    metadata: { name: draft.name, namespace, ...(Object.keys(annotations).length > 0 ? { annotations } : {}) },
    type: CREDENTIAL_SECRET_TYPE[draft.kind],
    data,
  };
}

/** One project member. */
export interface MemberRow {
  /** The username; the iam endpoint keys members by user, not by binding. */
  name: string;
  /** iam.kubesphere.io/role on the aggregated RoleBinding. */
  role: string;
  email: string;
  /** active / disabled / uninitialized, from the user the endpoint joins. */
  state: string;
  lastLoginTime: string;
}

/** One project role (viewer / operator / admin plus the role templates). */
export interface RoleRow {
  name: string;
  alias: string;
  description: string;
  /** Role templates carry iam.kubesphere.io/role-template: 'true'. */
  template: boolean;
  /** viewer / operator / admin are created with the project and cannot be deleted. */
  preset: boolean;
  createdAt: string;
}

const PRESET_DEVOPS_ROLES = ['viewer', 'operator', 'admin'];

/**
 * The kapis-served devops collections plus every write path this app uses.
 *
 * Kept beside devopsCollectionsApi (which owns the raw-group reads) so a caller never has
 * to know which of the two a given collection comes from.
 */
export function devopsApi(client: Client) {
  const projectKapis = (name: string) => DEVOPS_KAPIS + '/devops/' + q(name);

  return {
    /** Every DevOps project of one workspace, through the kapis workspace aggregate. */
    async projects(params: { workspace: string; signal?: AbortSignal }): Promise<DevopsProjectSummary[]> {
      const body = await client.request<{ items?: KubeObject[] }>(
        DEVOPS_KAPIS + '/workspaces/' + q(params.workspace) + '/devops',
        { query: { limit: -1 }, ...(params.signal ? { signal: params.signal } : {}) },
      );
      return (body?.items ?? []).map(toDevopsProjectSummary);
    },

    /** Every DevOps project in the cluster, read from the cluster-scoped CRD. */
    async allProjects(params: { signal?: AbortSignal } = {}): Promise<DevopsProjectSummary[]> {
      const body = await client.request<{ items?: KubeObject[] }>(PROJECT_API, {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (body?.items ?? []).map(toDevopsProjectSummary);
    },

    /** One project, cluster-scoped. A missing project is a 404 Status. */
    async project(params: { name: string; signal?: AbortSignal }): Promise<DevopsProjectSummary> {
      const item = await client.request<KubeObject>(PROJECT_API + '/' + q(params.name), {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return toDevopsProjectSummary(item);
    },

    /** Create a project. The response carries the generated name; the caller navigates to it. */
    async createProject(draft: DevopsProjectDraft): Promise<DevopsProjectSummary> {
      const body = await client.request<KubeObject>(
        DEVOPS_KAPIS + '/workspaces/' + q(draft.workspace) + '/devops',
        { method: 'POST', body: devopsProjectCreateBody(draft) },
      );
      return toDevopsProjectSummary(body);
    },

    /**
     * Edit the alias and description.
     *
     * The devops update is a whole-object PUT, so the current object is read first and only
     * the two annotations are replaced; a body built from the form alone would drop
     * spec.argo (the CD allow-list) and the workspace label.
     */
    async updateProject(input: {
      name: string;
      alias?: string;
      description?: string;
      current: KubeObject;
    }): Promise<DevopsProjectSummary> {
      const next = JSON.parse(JSON.stringify(input.current)) as KubeObject;
      const annotations = { ...((next.metadata?.annotations ?? {}) as Record<string, string>) };
      annotations[ANNOTATION_ALIAS] = input.alias?.trim() ?? '';
      annotations[ANNOTATION_DESCRIPTION] = input.description?.trim() ?? '';
      if (!annotations[ANNOTATION_ALIAS]) delete annotations[ANNOTATION_ALIAS];
      if (!annotations[ANNOTATION_DESCRIPTION]) delete annotations[ANNOTATION_DESCRIPTION];
      next.metadata = { ...(next.metadata ?? {}), annotations };
      const body = await client.request<KubeObject>(PROJECT_API + '/' + q(input.name), {
        method: 'PUT',
        body: next,
      });
      return toDevopsProjectSummary(body);
    },

    async deleteProject(name: string): Promise<void> {
      await client.request<void>(PROJECT_API + '/' + q(name), { method: 'DELETE' });
    },

    /**
     * Pipelines of one project, through the kapis list the devops-apiserver serves.
     *
     * The list is **paged and filtered by the server**, like the old console: the kapis
     * endpoint accepts `page`, `limit`, `name` (substring search), `type` and
     * `ascending`, and answers `totalItems` for the whole collection. Sorting and paging
     * here instead would make the row count and the page count disagree with the API, which
     * is exactly the drift the migration guide warns about.
     */
    async pipelines(params: {
      project: string;
      page?: number;
      limit?: number;
      name?: string;
      type?: string;
      ascending?: string;
      signal?: AbortSignal;
    }): Promise<{ items: PipelineRow[]; total: number }> {
      const query: Record<string, string | number> = {
        page: params.page ?? 1,
        limit: params.limit ?? 10,
      };
      if (params.name?.trim()) query.name = params.name.trim();
      if (params.type?.trim()) query.type = params.type.trim();
      if (params.ascending?.trim()) query.ascending = params.ascending.trim();
      const body = await client.request<{ items?: KubePipeline[]; totalItems?: number }>(
        projectKapis(params.project) + '/pipelines',
        { query, ...(params.signal ? { signal: params.signal } : {}) },
      );
      const items = (body?.items ?? []).map(toPipelineRow);
      return { items, total: typeof body?.totalItems === 'number' ? body.totalItems : items.length };
    },

    /** One pipeline. */
    async pipeline(params: { project: string; name: string; signal?: AbortSignal }): Promise<PipelineRow> {
      const item = await client.request<KubePipeline>(
        projectKapis(params.project) + '/pipelines/' + q(params.name),
        { ...(params.signal ? { signal: params.signal } : {}) },
      );
      return toPipelineRow(item);
    },

    async createPipeline(project: string, draft: PipelineDraft): Promise<PipelineRow> {
      const body = await client.request<KubePipeline>(projectKapis(project) + '/pipelines', {
        method: 'POST',
        body: pipelineCreateBody(draft),
      });
      return toPipelineRow(body);
    },

    /**
     * Edit a pipeline.
     *
     * The kapis update is a whole-object PUT: the current object is read, the alias /
     * description annotations and the Jenkinsfile are replaced, and everything else
     * (spec.pipeline.parameters, spec.multi_branch_pipeline, the controller's annotations)
     * is carried through untouched.
     */
    async updatePipeline(input: {
      project: string;
      name: string;
      alias?: string | undefined;
      description?: string | undefined;
      jenkinsfile?: string | undefined;
      current: KubeObject;
    }): Promise<PipelineRow> {
      const next = JSON.parse(JSON.stringify(input.current)) as KubeObject;
      const annotations = { ...((next.metadata?.annotations ?? {}) as Record<string, string>) };
      annotations[ANNOTATION_ALIAS] = input.alias?.trim() ?? '';
      annotations[ANNOTATION_DESCRIPTION] = input.description?.trim() ?? '';
      if (!annotations[ANNOTATION_ALIAS]) delete annotations[ANNOTATION_ALIAS];
      if (!annotations[ANNOTATION_DESCRIPTION]) delete annotations[ANNOTATION_DESCRIPTION];
      next.metadata = { ...(next.metadata ?? {}), annotations };
      if (typeof input.jenkinsfile === 'string') {
        const spec = (next.spec ?? {}) as Record<string, unknown>;
        const pipeline = (spec.pipeline ?? {}) as Record<string, unknown>;
        pipeline.jenkinsfile = input.jenkinsfile;
        spec.pipeline = pipeline;
        next.spec = spec;
      }
      const body = await client.request<KubePipeline>(
        projectKapis(input.project) + '/pipelines/' + q(input.name),
        { method: 'PUT', body: next },
      );
      return toPipelineRow(body);
    },

    async deletePipeline(project: string, name: string): Promise<void> {
      await client.request<void>(projectKapis(project) + '/pipelines/' + q(name), { method: 'DELETE' });
    },

    /**
     * Trigger a run.
     *
     * Creates the PipelineRun CR (the kapis run route is absent here — see
     * pipelineRunCreateBody). The caller must re-read the run list: the controller fills
     * status asynchronously, so the object exists immediately but its phase does not.
     */
    async runPipeline(request: RunPipelineRequest): Promise<KubeObject> {
      return client.request<KubeObject>(
        '/apis/' + DEVOPS_VERSION + '/namespaces/' + q(request.namespace) + '/pipelineruns',
        { method: 'POST', body: pipelineRunCreateBody(request) },
      );
    },

    /**
     * The console log of one run.
     *
     * Served only by the kapis run route (…/pipelines/<p>/runs/<id>/log), which answers 404
     * on this installation; the page therefore surfaces the failure text rather than an
     * empty log, and the design doc records the blocked capability.
     */
    async runLog(params: {
      project: string;
      pipeline: string;
      runId: string;
      branch?: string;
      start?: number;
      signal?: AbortSignal;
    }): Promise<string> {
      const runPath = params.branch
        ? 'pipelines/' + q(params.pipeline) + '/branches/' + q(params.branch) + '/runs/' + q(params.runId)
        : 'pipelines/' + q(params.pipeline) + '/runs/' + q(params.runId);
      const query = typeof params.start === 'number' && params.start > 0 ? { start: params.start } : undefined;
      return client.request<string>(projectKapis(params.project) + '/' + runPath + '/log/', {
        ...(query ? { query } : {}),
        ...(params.signal ? { signal: params.signal } : {}),
      });
    },

    /**
     * Credentials of one project.
     *
     * Read from the Secret collection: the kapis /credentials list answers 200 with an empty
     * list even for credentials that endpoint itself created (probed), so using it would
     * render a permanently empty tab. The write paths stay on kapis because that is what
     * stamps the Jenkins-sync annotations the controller reads.
     */
    async credentials(params: { namespace: string; signal?: AbortSignal }): Promise<CredentialRow[]> {
      const body = await client.request<{ items?: KubeObject[] }>(
        '/api/v1/namespaces/' + q(params.namespace) + '/secrets',
        { ...(params.signal ? { signal: params.signal } : {}) },
      );
      return (body?.items ?? []).filter(isDevopsCredential).map(toCredentialRow);
    },

    async createCredential(project: string, draft: CredentialDraft, namespace: string): Promise<KubeObject> {
      return client.request<KubeObject>(projectKapis(project) + '/credentials', {
        method: 'POST',
        body: credentialCreateBody(draft, namespace),
      });
    },

    /** Update the data and description of an existing credential; the type cannot change. */
    async updateCredential(input: {
      project: string;
      name: string;
      kind: CredentialKind;
      fields: Record<string, string>;
      description?: string;
      current: KubeObject;
    }): Promise<KubeObject> {
      const next = JSON.parse(JSON.stringify(input.current)) as KubeObject;
      const data: Record<string, string> = {};
      Object.entries(input.fields).forEach(([key, value]) => {
        if (value) data[key] = toBase64(value);
      });
      (next as { data?: Record<string, string> }).data = data;
      const annotations = { ...((next.metadata?.annotations ?? {}) as Record<string, string>) };
      annotations[ANNOTATION_DESCRIPTION] = input.description?.trim() ?? '';
      if (!annotations[ANNOTATION_DESCRIPTION]) delete annotations[ANNOTATION_DESCRIPTION];
      next.metadata = { ...(next.metadata ?? {}), annotations };
      return client.request<KubeObject>(
        projectKapis(input.project) + '/credentials/' + q(input.name) + '?content=1',
        { method: 'PUT', body: next },
      );
    },

    async deleteCredential(project: string, name: string): Promise<void> {
      await client.request<void>(projectKapis(project) + '/credentials/' + q(name), { method: 'DELETE' });
    },

    /** Members of one project: the iam aggregate over the namespace's RoleBindings. */
    async members(params: { project: string; signal?: AbortSignal }): Promise<MemberRow[]> {
      const body = await client.request<{ items?: KubeObject[] }>(
        IAM_KAPIS + '/devops/' + q(params.project) + '/members',
        { query: { limit: -1 }, ...(params.signal ? { signal: params.signal } : {}) },
      );
      return (body?.items ?? []).map((item) => {
        const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
        const spec = (item as { spec?: Record<string, unknown> }).spec ?? {};
        const status = (item as { status?: Record<string, unknown> }).status ?? {};
        return {
          name: item.metadata?.name ?? '',
          role: annotations['iam.kubesphere.io/role'] ?? String(spec.roleRef ?? ''),
          email: String(spec.email ?? ''),
          state: String(status.state ?? ''),
          lastLoginTime: String(status.lastLoginTime ?? ''),
        };
      });
    },

    /** Invite members. The iam endpoint takes an ARRAY of members, not one object. */
    async inviteMembers(project: string, members: { username: string; roleRef: string }[]): Promise<void> {
      await client.request<void>(IAM_KAPIS + '/devops/' + q(project) + '/members', {
        method: 'POST',
        body: members,
      });
    },

    /** Change one member's project role. */
    async changeMemberRole(project: string, username: string, roleRef: string): Promise<void> {
      await client.request<void>(IAM_KAPIS + '/devops/' + q(project) + '/members/' + q(username), {
        method: 'PUT',
        body: { username, roleRef },
      });
    },

    async removeMember(project: string, username: string): Promise<void> {
      await client.request<void>(IAM_KAPIS + '/devops/' + q(project) + '/members/' + q(username), {
        method: 'DELETE',
      });
    },

    /** Roles of one project: three preset roles plus the role templates. */
    async roles(params: { project: string; signal?: AbortSignal }): Promise<RoleRow[]> {
      const body = await client.request<{ items?: KubeObject[] }>(
        IAM_KAPIS + '/devops/' + q(params.project) + '/roles',
        { query: { limit: -1 }, ...(params.signal ? { signal: params.signal } : {}) },
      );
      return (body?.items ?? []).map((item) => {
        const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
        const labels = (item.metadata?.labels ?? {}) as Record<string, string>;
        const name = item.metadata?.name ?? '';
        return {
          name,
          alias: annotations['kubesphere.io/alias-name'] ?? '',
          description: annotations['kubesphere.io/description'] ?? annotations['iam.kubesphere.io/module'] ?? '',
          template: labels['iam.kubesphere.io/role-template'] === 'true',
          preset: PRESET_DEVOPS_ROLES.includes(name),
          createdAt: item.metadata?.creationTimestamp ?? '',
        };
      });
    },

    /** Import a code repository (devops GitRepository). */
    async createCodeRepository(
      namespace: string,
      draft: { name: string; provider: string; url: string; secretName?: string; description?: string },
    ): Promise<KubeObject> {
      const annotations = annotationsOf({ description: draft.description });
      const spec: Record<string, unknown> = { provider: draft.provider, url: draft.url };
      if (draft.secretName?.trim()) spec.secret = { name: draft.secretName.trim() };
      return client.request<KubeObject>(
        '/apis/' + DEVOPS_VERSION + '/namespaces/' + q(namespace) + '/gitrepositories',
        {
          method: 'POST',
          body: {
            kind: 'GitRepository',
            apiVersion: DEVOPS_VERSION,
            metadata: {
              name: draft.name,
              namespace,
              ...(Object.keys(annotations).length > 0 ? { annotations } : {}),
            },
            spec,
          },
        },
      );
    },

    async deleteCodeRepository(namespace: string, name: string): Promise<void> {
      await client.request<void>(
        '/apis/' + DEVOPS_VERSION + '/namespaces/' + q(namespace) + '/gitrepositories/' + q(name),
        { method: 'DELETE' },
      );
    },
  };
}

import type { Client } from './client';
import { ApiError } from './errors';
import { annotationKeys, baseOf, type KubeObject, type ResourceBase, type ResourceListResult } from './resources';

/**
 * 镜像构建器（S2I/B2I）.
 *
 * The devops API group serves two versions: v1alpha3 has pipelines/projects, while the
 * S2I resources (s2ibuilders, s2iruns, s2ibuildertemplates, s2ibinaries) live in
 * **v1alpha1**. Asking v1alpha3 for s2ibuilders answers 404 — that is the version split,
 * not a missing feature.
 *
 * Two read paths, both probed on this cluster (2026-11-15):
 *
 * 1. The **list** goes through the generic resources proxy
 *    (`/kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/s2ibuilders`) because that is
 *    the only endpoint that pages, sorts and searches server-side and returns
 *    `totalItems`. Reading the raw CRD list returns everything at once with no total.
 * 2. Everything else (detail, writes, runs, jobs, events) uses the raw CRD endpoints under
 *    `/apis/devops.kubesphere.io/v1alpha1`, which is what the old console's store used
 *    (`S2IBuilderStore.apiVersion`).
 *
 * The old console read its runs through `/kapis/resources.kubesphere.io/v1alpha2/.../s2iruns`
 * with a `labels.devops.kubesphere.io/builder-name` condition. That label is written by the
 * s2i controller, so a run created by this console before the controller reconciles it is
 * invisible to that query (probed: the label condition returned 0 while the run existed).
 * Runs are therefore read from the CRD list and filtered on the authoritative
 * `spec.builderName`, with client-side paging over that filtered set.
 */
const S2I_GROUP = 'devops.kubesphere.io/v1alpha1';
const S2I_APIS = '/apis/' + S2I_GROUP;
/** The generic resources proxy: the only endpoint with server-side paging for this CRD. */
const S2I_BUILDERS_KAPIS = '/kapis/resources.kubesphere.io/v1alpha3';

/** S2I builds from source; B2I builds from an uploaded binary. */
export type ImageBuilderKind = 's2i' | 'b2i';

/** The `spec.config.environment` entry the CRD stores. */
export interface S2iEnvVar {
  name?: string;
  value?: string;
}

/** The subset of `spec.config` this console reads and writes. */
export interface S2iBuildConfig {
  builderImage?: string;
  builderImageVersion?: string;
  /** The webhook rejects a create without this field; `if-not-present` is the old default. */
  builderPullPolicy?: string;
  sourceUrl?: string;
  revisionId?: string;
  contextDir?: string;
  imageName?: string;
  outputImageName?: string;
  tag?: string;
  isBinaryURL?: boolean;
  secretCode?: string;
  environment?: S2iEnvVar[];
  gitSecretRef?: { name?: string };
  pushAuthentication?: { secretRef?: { name?: string } };
  export?: boolean;
  outputBuildResult?: boolean;
  replicas?: number;
  [key: string]: unknown;
}

/** One `s2ibuilders.devops.kubesphere.io` object, as stored. */
export interface RawS2iBuilder extends KubeObject {
  spec?: {
    config?: S2iBuildConfig;
    fromTemplate?: { name?: string; builderImage?: string; parameters?: unknown[] };
  };
  status?: {
    lastRunName?: string;
    lastRunStartTime?: string;
    /** `Running` | `Successful` | `Failed`; empty before the first run. */
    lastRunState?: string;
    runCount?: number;
  };
}

/** One `s2iruns.devops.kubesphere.io` object, as stored. */
export interface RawS2iRun extends KubeObject {
  spec?: {
    builderName?: string;
    newRevisionId?: string;
    newSourceURL?: string;
    newTag?: string;
    backoffLimit?: number;
    secondsAfterFinished?: number;
  };
  status?: {
    runState?: string;
    startTime?: string;
    completionTime?: string;
    kubernetesJobName?: string;
    logURL?: string;
    s2iBuildSource?: {
      sourceUrl?: string;
      builderImage?: string;
      revisionId?: string;
      commitID?: string;
      committerName?: string;
      committerEmail?: string;
      binaryName?: string;
      binarySize?: string | number;
      description?: string;
    };
    s2iBuildResult?: {
      imageName?: string;
      imageSize?: string | number;
      imageID?: string;
      commandPull?: string;
      imageCreated?: string;
      imageRepoTags?: string[];
    };
  };
}

/** One `s2ibuildertemplates.devops.kubesphere.io` object (cluster-scoped). */
export interface RawS2iBuilderTemplate extends KubeObject {
  spec?: {
    codeFramework?: string;
    defaultBaseImage?: string;
    version?: string;
    description?: string;
    iconPath?: string;
    containerInfo?: Array<{
      builderImage?: string;
      runtimeImage?: string;
      buildVolumes?: string[];
      runtimeArtifacts?: Array<{ source?: string; destination?: string }>;
    }>;
    environment?: Array<{
      key?: string;
      description?: string;
      defaultValue?: string;
      required?: boolean;
      type?: string;
    }>;
  };
}

/** One `s2ibinaries.devops.kubesphere.io` object (an uploaded artifact). */
export interface RawS2iBinary extends KubeObject {
  spec?: {
    downloadURL?: string;
    fileName?: string;
    size?: string;
    md5?: string;
    uploadTimeStamp?: string;
  };
  status?: { phase?: string };
}

/** A builder row. */
export interface ImageBuilderSummary extends ResourceBase {
  /** `displayName` annotation when present; the page falls back to `name`. */
  displayName: string;
  /** `spec.config.builderImage` — the builder image the build runs in. */
  baseImage: string;
  /** `spec.config.imageName` — the output image repository (not the built tag). */
  outputImage: string;
  kind: ImageBuilderKind;
  /** Normalised run state: `building` | `successful` | `failed` | `` (never run). */
  status: string;
  /** `serviceName` annotation; the workload the built image is deployed as. */
  serviceName: string;
  pullPolicy: string;
  /** `status.lastRunName`, empty until the controller writes one. */
  lastRunName: string;
  /** `status.lastRunStartTime`; the list's "last build" column. */
  lastRunStartTime: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  sourceUrl: string;
  revisionId: string;
  tag: string;
  isBinary: boolean;
}

/** A builder detail row: the summary plus the fields the detail page renders and edits. */
export interface ImageBuilderDetail extends ImageBuilderSummary {
  config: S2iBuildConfig;
  runCount: number;
  lastRunStartTime: string;
  raw: RawS2iBuilder;
}

/** A build run row. */
export interface S2iRunSummary {
  name: string;
  namespace: string;
  createdAt: string;
  builderName: string;
  /** Normalised: `building` | `successful` | `failed` | `` (controller has not reported). */
  status: string;
  /** The raw `status.runState` (`Running`/`Successful`/`Failed`), for honest diagnostics. */
  statusRaw: string;
  imageName: string;
  imageSize: number | string;
  imagePullCommand: string;
  imageCreated: string;
  startTime: string;
  completionTime: string;
  logURL: string;
  jobName: string;
  revisionId: string;
  sourceUrl: string;
  builderImage: string;
  binaryName: string;
  binarySize: number | string;
  raw: RawS2iRun;
}

/** One builder template, flattened for the create dialog. */
export interface S2iBuilderTemplate {
  name: string;
  codeFramework: string;
  defaultBaseImage: string;
  version: string;
  description: string;
  docUrl: string;
  /** Which build modes the template declares (a template may support both). */
  s2i: boolean;
  b2i: boolean;
  /** `binary-type.kubesphere.io` label, e.g. `jar`/`war`/`binary`. */
  binaryType: string;
  containerInfo: NonNullable<RawS2iBuilderTemplate['spec']>['containerInfo'];
  environment: NonNullable<RawS2iBuilderTemplate['spec']>['environment'];
}

/** A secret the create dialog can reference. */
export interface S2iSecretOption {
  name: string;
  /** `kubernetes.io/basic-auth` or `kubernetes.io/dockerconfigjson`. */
  type: string;
  /** For a registry secret the first registry host in `.dockerconfigjson`. */
  repoUrl: string;
}

/** A job owned by one S2I run. */
export interface S2iJobDetail {
  name: string;
  namespace: string;
  uid: string;
  labels: Record<string, string>;
  containers: Array<{
    name?: string;
    ports?: Array<{ name?: string; protocol?: string; containerPort?: number }>;
    env?: Array<{
      name?: string;
      value?: string;
      valueFrom?: {
        secretKeyRef?: { name?: string; key?: string };
        configMapKeyRef?: { name?: string; key?: string };
      };
    }>;
  }>;
  /** `spec.selector.matchLabels`, falling back to the pod-template labels. */
  selector: Record<string, string>;
  raw: KubeObject;
}

/** One event attached to the job of a run. */
export interface S2iEvent {
  name: string;
  type: string;
  reason: string;
  message: string;
  source: string;
  firstTimestamp: string;
  lastTimestamp: string;
  count: number;
}

/** A pod that belongs to the job of a run. */
export interface S2iJobPod {
  name: string;
  phase: string;
  ready: string;
  restarts: number;
  node: string;
  podIP: string;
  createdAt: string;
}

/** A Secret/ConfigMap read for resolving `env[].valueFrom`. */
export interface EnvSourceValues {
  /** Plain (ConfigMap) or base64-decoded (Secret) values keyed by data key. */
  values: Record<string, string>;
  /** `Secret` | `ConfigMap`; the page renders a masked value for secrets. */
  kind: 'Secret' | 'ConfigMap';
}

/** List parameters for the paged builder collection. */
export interface ImageBuilderListParams {
  cluster: string;
  namespace: string;
  page: number;
  pageSize: number;
  /** `createTime` (default) or `name`. */
  sortBy?: string;
  order?: 'asc' | 'desc';
  keyword?: string;
  signal?: AbortSignal;
}

/** Normalise `status.lastRunState` to the four UI states. */
export function normalizeBuilderStatus(raw: string | undefined): string {
  const value = (raw ?? '').toLowerCase();
  if (value === 'running' || value === 'building') return 'building';
  if (value === 'successful' || value === 'succeeded' || value === 'success') return 'successful';
  if (value === 'failed' || value === 'error') return 'failed';
  return '';
}

/** Normalise `status.runState` to the four UI states. */
export function normalizeRunStatus(raw: string | undefined): string {
  return normalizeBuilderStatus(raw);
}

/** The `clusters/<id>` segment other native kube paths in this app use. Only host is verified. */
function clusterSegment(cluster: string | undefined): string {
  return cluster && cluster !== 'host' ? 'clusters/' + encodeURIComponent(cluster) + '/' : '';
}

function namespacePath(cluster: string | undefined, namespace: string): string {
  return S2I_APIS + '/' + clusterSegment(cluster) + 'namespaces/' + encodeURIComponent(namespace);
}

function buildersPath(cluster: string | undefined, namespace: string, name?: string): string {
  const base = namespacePath(cluster, namespace) + '/s2ibuilders';
  return name ? base + '/' + encodeURIComponent(name) : base;
}

function runsPath(cluster: string | undefined, namespace: string, name?: string): string {
  const base = namespacePath(cluster, namespace) + '/s2iruns';
  return name ? base + '/' + encodeURIComponent(name) : base;
}

function binariesPath(cluster: string | undefined, namespace: string, name?: string): string {
  const base = namespacePath(cluster, namespace) + '/s2ibinaries';
  return name ? base + '/' + encodeURIComponent(name) : base;
}

function binaryFileKapisPath(cluster: string | undefined, namespace: string, name: string): string {
  return (
    '/kapis/devops.kubesphere.io/v1alpha2/' +
    clusterSegment(cluster) +
    'namespaces/' +
    encodeURIComponent(namespace) +
    '/s2ibinaries/' +
    encodeURIComponent(name) +
    '/file'
  );
}

function kapisClusterSegment(cluster: string | undefined): string {
  return cluster && cluster !== 'host' ? 'clusters/' + encodeURIComponent(cluster) + '/' : '';
}

/**
 * The remote-trigger URL shown on the detail page.
 *
 * It is the s2ioperator trigger service address, not a console URL: the reader copies it
 * into a webhook. The old console built exactly this string
 * (`console/src/pages/projects/containers/ImageBuilder/Detail/index.jsx`).
 */
export function imageBuilderTriggerLink(namespace: string, name: string, secretCode: string): string {
  const base =
    'http://s2ioperator-trigger-service.kubesphere-devops-system.svc/s2itrigger/v1alpha1/general/namespaces/' +
    namespace +
    '/s2ibuilders/' +
    name +
    '/';
  return secretCode ? base + '?secretCode=' + encodeURIComponent(secretCode) : base;
}

/** Map one stored builder to the list/detail row. */
export function toImageBuilderSummary(raw: RawS2iBuilder): ImageBuilderSummary {
  const annotations = raw.metadata?.annotations ?? {};
  const labels = raw.metadata?.labels ?? {};
  const config = raw.spec?.config ?? {};
  const base = baseOf(raw);
  return {
    ...base,
    name: raw.metadata?.name ?? '',
    namespace: raw.metadata?.namespace ?? '',
    displayName: annotations['displayName'] ?? '',
    baseImage: config.builderImage ?? '',
    outputImage: config.imageName ?? '',
    // The controller labels binary builds explicitly; absence has always meant source builds.
    kind: labels['s2i-type.kubesphere.io'] === 'b2i' ? 'b2i' : 's2i',
    status: normalizeBuilderStatus(raw.status?.lastRunState),
    serviceName: annotations['serviceName'] ?? '',
    pullPolicy: config.builderPullPolicy ?? '',
    lastRunName: raw.status?.lastRunName ?? '',
    lastRunStartTime: raw.status?.lastRunStartTime ?? '',
    labels,
    annotations,
    sourceUrl: config.sourceUrl ?? '',
    revisionId: config.revisionId ?? '',
    tag: config.tag ?? '',
    isBinary: config.isBinaryURL === true || labels['s2i-type.kubesphere.io'] === 'b2i',
  };
}

/** Map one stored builder to the detail row. */
export function toImageBuilderDetail(raw: RawS2iBuilder): ImageBuilderDetail {
  const summary = toImageBuilderSummary(raw);
  return {
    ...summary,
    config: raw.spec?.config ?? {},
    runCount: raw.status?.runCount ?? 0,
    lastRunStartTime: raw.status?.lastRunStartTime ?? '',
    raw,
  };
}

/** Map one stored run to a row. */
export function toS2iRunSummary(raw: RawS2iRun): S2iRunSummary {
  const status = raw.status ?? {};
  const result = status.s2iBuildResult ?? {};
  const source = status.s2iBuildSource ?? {};
  return {
    name: raw.metadata?.name ?? '',
    namespace: raw.metadata?.namespace ?? '',
    createdAt: raw.metadata?.creationTimestamp ?? '',
    builderName: raw.spec?.builderName ?? '',
    status: normalizeRunStatus(status.runState),
    statusRaw: status.runState ?? '',
    imageName: result.imageName ?? '',
    imageSize: result.imageSize ?? '',
    imagePullCommand: result.commandPull ?? '',
    imageCreated: result.imageCreated ?? '',
    startTime: status.startTime ?? '',
    completionTime: status.completionTime ?? '',
    logURL: status.logURL ?? '',
    jobName: status.kubernetesJobName ?? '',
    // The old mapper read the revision from `status.s2iBuildResult.revisionId`, which the CRD
    // does not have; the build source is where the controller writes it.
    revisionId: source.revisionId ?? '',
    sourceUrl: source.sourceUrl ?? '',
    builderImage: source.builderImage ?? '',
    binaryName: source.binaryName ?? '',
    binarySize: source.binarySize ?? '',
    raw,
  };
}

/** Map one template. */
export function toS2iBuilderTemplate(raw: RawS2iBuilderTemplate): S2iBuilderTemplate {
  const labels = raw.metadata?.labels ?? {};
  const annotations = raw.metadata?.annotations ?? {};
  const spec = raw.spec ?? {};
  return {
    name: raw.metadata?.name ?? '',
    codeFramework: spec.codeFramework ?? '',
    defaultBaseImage: spec.defaultBaseImage ?? '',
    version: spec.version ?? '',
    description: spec.description ?? '',
    docUrl: annotations['devops.kubesphere.io/s2i-template-url'] ?? '',
    s2i: labels['builder-type.kubesphere.io/s2i'] === 's2i',
    b2i: labels['builder-type.kubesphere.io/b2i'] === 'b2i',
    binaryType: labels['binary-type.kubesphere.io'] ?? '',
    containerInfo: spec.containerInfo ?? [],
    environment: spec.environment ?? [],
  };
}

/** Decode the protocol of `spec.s2iBuildResult.imageSize` which the controller may send as a number. */
export function runImageSize(value: number | string | undefined): number | string {
  if (typeof value === 'number') return value;
  if (value === undefined || value === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function toJob(raw: KubeObject): S2iJobDetail {
  const metadata = raw.metadata ?? {};
  const spec = (raw.spec ?? {}) as {
    selector?: { matchLabels?: Record<string, string> };
    template?: { metadata?: { labels?: Record<string, string> }; spec?: { containers?: S2iJobDetail['containers'] } };
  };
  const containers = spec.template?.spec?.containers ?? [];
  const selector = spec.selector?.matchLabels ?? spec.template?.metadata?.labels ?? {};
  return {
    name: metadata.name ?? '',
    namespace: metadata.namespace ?? '',
    uid: metadata.uid ?? '',
    labels: metadata.labels ?? {},
    containers,
    selector,
    raw,
  };
}

/** Build the `labelSelector` string for the job's pods. */
export function labelSelector(labels: Record<string, string>): string {
  return Object.entries(labels)
    .map(([key, value]) => key + '=' + value)
    .join(',');
}

interface RawEvent {
  metadata?: { name?: string };
  type?: string;
  reason?: string;
  message?: string;
  source?: { component?: string };
  firstTimestamp?: string;
  lastTimestamp?: string;
  eventTime?: string;
  count?: number;
}

interface RawPod {
  metadata?: { name?: string; creationTimestamp?: string };
  spec?: { nodeName?: string };
  status?: {
    phase?: string;
    podIP?: string;
    containerStatuses?: Array<{ ready?: boolean; restartCount?: number }>;
  };
}

interface RawSecret extends KubeObject {
  type?: string;
  data?: Record<string, string>;
}

function encodeFieldSelector(pairs: Record<string, string>): string {
  return Object.entries(pairs)
    .map(([key, value]) => key + '=' + value)
    .join(',');
}

/** Read one Secret/ConfigMap value that a container environment variable references. */
export function decodeEnvValue(source: EnvSourceValues, key: string): string {
  return source.values[key] ?? '';
}

/**
 * The API surface for the image builder page family.
 *
 * Kept as one object because every method shares the same paths, version split and
 * status normalisation; splitting it per screen would duplicate the version knowledge.
 */
export function imageBuildersApi(client: Client) {
  return {
    /**
     * One page of builders.
     *
     * The generic resources proxy pages, searches (`name`, a fuzzy match) and sorts on the
     * server, and returns `totalItems`; the raw CRD list does none of those. The keyword is
     * searched by name only — displayName is an annotation the server cannot filter on.
     */
    async list(params: ImageBuilderListParams): Promise<ResourceListResult<ImageBuilderSummary>> {
      const query: Record<string, string | number | boolean> = {
        page: params.page,
        limit: params.pageSize,
      };
      if (params.sortBy) query.sortBy = params.sortBy;
      if (params.order) query.ascending = params.order === 'asc';
      if (params.keyword?.trim()) query.name = params.keyword.trim();
      const body = await client.request<{ items?: RawS2iBuilder[]; totalItems?: number; total_count?: number }>(
        S2I_BUILDERS_KAPIS + '/' + kapisClusterSegment(params.cluster) + 'namespaces/' + encodeURIComponent(params.namespace) + '/s2ibuilders',
        {
          query,
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      const items = (body?.items ?? []).map(toImageBuilderSummary);
      return {
        items,
        total: body?.totalItems ?? body?.total_count ?? items.length,
        page: params.page,
        pageSize: params.pageSize,
      };
    },

    async get(params: { cluster: string; namespace: string; name: string; signal?: AbortSignal }): Promise<ImageBuilderDetail> {
      const raw = await client.request<RawS2iBuilder>(buildersPath(params.cluster, params.namespace, params.name), {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return toImageBuilderDetail(raw);
    },

    async create(params: { cluster: string; namespace: string; body: KubeObject }): Promise<ImageBuilderDetail> {
      const raw = await client.request<RawS2iBuilder>(buildersPath(params.cluster, params.namespace), {
        method: 'POST',
        body: params.body,
      });
      return toImageBuilderDetail(raw);
    },

    /** Merge-patch: metadata annotations and/or `spec.config` only, so untouched fields survive. */
    async patch(params: { cluster: string; namespace: string; name: string; body: unknown }): Promise<ImageBuilderDetail> {
      const raw = await client.request<RawS2iBuilder>(buildersPath(params.cluster, params.namespace, params.name), {
        method: 'PATCH',
        body: params.body,
        contentType: 'application/merge-patch+json',
      });
      return toImageBuilderDetail(raw);
    },

    /** Whole-object PUT, for the YAML editor. */
    async update(params: { cluster: string; namespace: string; name: string; body: KubeObject }): Promise<ImageBuilderDetail> {
      const raw = await client.request<RawS2iBuilder>(buildersPath(params.cluster, params.namespace, params.name), {
        method: 'PUT',
        body: params.body,
      });
      return toImageBuilderDetail(raw);
    },

    async remove(params: { cluster: string; namespace: string; name: string }): Promise<void> {
      await client.request<void>(buildersPath(params.cluster, params.namespace, params.name), { method: 'DELETE' });
    },

    /** Every builder template (cluster-scoped), for the create dialog's language/template picker. */
    async templates(params: { cluster: string; signal?: AbortSignal }): Promise<S2iBuilderTemplate[]> {
      const body = await client.request<{ items?: RawS2iBuilderTemplate[] }>(S2I_APIS + '/' + clusterSegment(params.cluster) + 's2ibuildertemplates', {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (body?.items ?? []).map(toS2iBuilderTemplate);
    },

    /**
     * Secrets the form can reference, filtered by type.
     *
     * The API context of this console is an administrator, so the list can be long; the old
     * console resolved it the same way (`fetchListByK8s` with a `type=` field selector).
     */
    async secrets(params: { cluster: string; namespace: string; type: string; signal?: AbortSignal }): Promise<S2iSecretOption[]> {
      const body = await client.request<{ items?: RawSecret[] }>(
        '/api/v1/' + clusterSegment(params.cluster) + 'namespaces/' + encodeURIComponent(params.namespace) + '/secrets',
        {
          query: { fieldSelector: 'type=' + params.type },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      return (body?.items ?? []).map((item) => {
        let repoUrl = '';
        if (params.type === 'kubernetes.io/dockerconfigjson') {
          try {
            const decoded = typeof atob === 'function' ? atob(item.data?.['.dockerconfigjson'] ?? '') : '';
            const parsed = JSON.parse(decoded) as { auths?: Record<string, unknown> };
            repoUrl = Object.keys(parsed.auths ?? {})[0] ?? '';
          } catch {
            repoUrl = '';
          }
        }
        return { name: item.metadata?.name ?? '', type: item.type ?? '', repoUrl };
      });
    },

    /** Every run of one builder, newest first. */
    async runs(params: { cluster: string; namespace: string; builderName: string; signal?: AbortSignal }): Promise<S2iRunSummary[]> {
      const body = await client.request<{ items?: RawS2iRun[] }>(runsPath(params.cluster, params.namespace), {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return (body?.items ?? [])
        .map(toS2iRunSummary)
        .filter((run) => run.builderName === params.builderName)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    /** One page of a builder's runs; paging is client-side because the CRD list has no pager. */
    async runsPage(params: {
      cluster: string;
      namespace: string;
      builderName: string;
      page: number;
      pageSize: number;
      signal?: AbortSignal;
    }): Promise<ResourceListResult<S2iRunSummary>> {
      const all = await this.runs(params);
      const start = (params.page - 1) * params.pageSize;
      return {
        items: all.slice(start, start + params.pageSize),
        total: all.length,
        page: params.page,
        pageSize: params.pageSize,
      };
    },

    async run(params: { cluster: string; namespace: string; name: string; signal?: AbortSignal }): Promise<S2iRunSummary> {
      const raw = await client.request<RawS2iRun>(runsPath(params.cluster, params.namespace, params.name), {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return toS2iRunSummary(raw);
    },

    async createRun(params: { cluster: string; namespace: string; body: KubeObject }): Promise<S2iRunSummary> {
      const raw = await client.request<RawS2iRun>(runsPath(params.cluster, params.namespace), {
        method: 'POST',
        body: params.body,
      });
      return toS2iRunSummary(raw);
    },

    async removeRun(params: { cluster: string; namespace: string; name: string }): Promise<void> {
      await client.request<void>(runsPath(params.cluster, params.namespace, params.name), { method: 'DELETE' });
    },

    /** The Job a run created, or `null` when the controller has not created one (404). */
    async job(params: { cluster: string; namespace: string; name: string; signal?: AbortSignal }): Promise<S2iJobDetail | null> {
      try {
        const raw = await client.request<KubeObject>(
          '/apis/batch/v1/' + clusterSegment(params.cluster) + 'namespaces/' + encodeURIComponent(params.namespace) + '/jobs/' + encodeURIComponent(params.name),
          { ...(params.signal ? { signal: params.signal } : {}) },
        );
        return toJob(raw);
      } catch (cause) {
        if (cause instanceof ApiError && cause.isNotFound) return null;
        throw cause;
      }
    },

    /** Pods owned by a Job, matched by the job's selector. */
    async jobPods(params: { cluster: string; namespace: string; selector: Record<string, string>; signal?: AbortSignal }): Promise<S2iJobPod[]> {
      const selector = labelSelector(params.selector);
      if (!selector) return [];
      const body = await client.request<{ items?: RawPod[] }>(
        '/api/v1/' + clusterSegment(params.cluster) + 'namespaces/' + encodeURIComponent(params.namespace) + '/pods',
        {
          query: { labelSelector: selector },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      return (body?.items ?? []).map((pod) => {
        const statuses = pod.status?.containerStatuses ?? [];
        const ready = statuses.filter((entry) => entry.ready).length;
        return {
          name: pod.metadata?.name ?? '',
          phase: pod.status?.phase ?? '',
          ready: ready + '/' + statuses.length,
          restarts: statuses.reduce((sum, entry) => sum + (entry.restartCount ?? 0), 0),
          node: pod.spec?.nodeName ?? '',
          podIP: pod.status?.podIP ?? '',
          createdAt: pod.metadata?.creationTimestamp ?? '',
        };
      });
    },

    /** Events of one Job, newest first. */
    async events(params: {
      cluster: string;
      namespace: string;
      name: string;
      uid?: string;
      signal?: AbortSignal;
    }): Promise<S2iEvent[]> {
      const fields: Record<string, string> = {
        'involvedObject.kind': 'Job',
        'involvedObject.name': params.name,
        'involvedObject.namespace': params.namespace,
      };
      if (params.uid) fields['involvedObject.uid'] = params.uid;
      const body = await client.request<{ items?: RawEvent[] }>(
        '/api/v1/' + clusterSegment(params.cluster) + 'namespaces/' + encodeURIComponent(params.namespace) + '/events',
        {
          query: { fieldSelector: encodeFieldSelector(fields) },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      return (body?.items ?? [])
        .map((event) => ({
          name: event.metadata?.name ?? '',
          type: event.type ?? '',
          reason: event.reason ?? '',
          message: event.message ?? '',
          source: event.source?.component ?? '',
          firstTimestamp: event.firstTimestamp ?? event.eventTime ?? '',
          lastTimestamp: event.lastTimestamp ?? event.eventTime ?? '',
          count: event.count ?? 1,
        }))
        .sort((a, b) => (b.lastTimestamp ?? '').localeCompare(a.lastTimestamp ?? ''));
    },

    /**
     * Read the Secret a container environment variable references.
     *
     * The value is base64 in the API; it is decoded here so the page never handles base64.
     */
    async secretValues(params: { cluster: string; namespace: string; name: string; signal?: AbortSignal }): Promise<EnvSourceValues> {
      const raw = await client.request<RawSecret>(
        '/api/v1/' + clusterSegment(params.cluster) + 'namespaces/' + encodeURIComponent(params.namespace) + '/secrets/' + encodeURIComponent(params.name),
        { ...(params.signal ? { signal: params.signal } : {}) },
      );
      const values: Record<string, string> = {};
      for (const [key, value] of Object.entries(raw.data ?? {})) {
        try {
          values[key] = typeof atob === 'function' ? atob(value) : '';
        } catch {
          values[key] = '';
        }
      }
      return { values, kind: 'Secret' };
    },

    /** Read the ConfigMap a container environment variable references. */
    async configMapValues(params: { cluster: string; namespace: string; name: string; signal?: AbortSignal }): Promise<EnvSourceValues> {
      const raw = await client.request<KubeObject & { data?: Record<string, string> }>(
        '/api/v1/' + clusterSegment(params.cluster) + 'namespaces/' + encodeURIComponent(params.namespace) + '/configmaps/' + encodeURIComponent(params.name),
        { ...(params.signal ? { signal: params.signal } : {}) },
      );
      return { values: raw.data ?? {}, kind: 'ConfigMap' };
    },

    async binary(params: { cluster: string; namespace: string; name: string; signal?: AbortSignal }): Promise<RawS2iBinary> {
      return client.request<RawS2iBinary>(binariesPath(params.cluster, params.namespace, params.name), {
        ...(params.signal ? { signal: params.signal } : {}),
      });
    },

    async createBinary(params: { cluster: string; namespace: string; name: string }): Promise<RawS2iBinary> {
      return client.request<RawS2iBinary>(binariesPath(params.cluster, params.namespace), {
        method: 'POST',
        body: {
          apiVersion: 'devops.kubesphere.io/v1alpha1',
          kind: 'S2iBinary',
          metadata: { name: params.name, namespace: params.namespace, labels: { 'controller-tools.k8s.io': '1.0' } },
        },
      });
    },

    async removeBinary(params: { cluster: string; namespace: string; name: string }): Promise<void> {
      await client.request<void>(binariesPath(params.cluster, params.namespace, params.name), { method: 'DELETE' });
    },

    /**
     * Ask the console backend whether a Git URL is readable.
     *
     * The old form ran this on blur and used it to decide whether a repository secret is
     * required. On this installation the endpoint answers 500 `authentication required`
     * for every URL (probed 2026-11-15), so the form treats a non-success answer as an
     * advisory note and never blocks creation on it.
     */
    async verifyRepository(params: {
      namespace: string;
      url: string;
      secretName?: string;
      signal?: AbortSignal;
    }): Promise<{ ok: boolean; message: string }> {
      const body = params.secretName
        ? { remoteUrl: params.url, secretRef: { name: params.secretName, namespace: params.namespace } }
        : { remoteUrl: params.url };
      try {
        const result = await client.request<{ message?: string }>('/kapis/resources.kubesphere.io/v1alpha2/git/verify', {
          method: 'POST',
          body,
          ...(params.signal ? { signal: params.signal } : {}),
        });
        return { ok: result?.message === 'success', message: result?.message ?? '' };
      } catch (cause) {
        if (cause instanceof ApiError) return { ok: false, message: cause.message };
        throw cause;
      }
    },

    /** The absolute in-cluster path of an artifact, turned into a same-origin path for the browser. */
    binaryFilePath(params: { downloadURL: string }): string {
      try {
        return new URL(params.downloadURL).pathname;
      } catch {
        return params.downloadURL;
      }
    },
  };
}

export type ImageBuildersApi = ReturnType<typeof imageBuildersApi>;

/**
 * Upload an artifact for a binary (B2I) build.
 *
 * Why this does not go through `client.request`: the endpoint consumes
 * `multipart/form-data` and the shared client JSON-encodes every body. The file must be a
 * `FormData`, and `Content-Type` must be left for the browser to set with its boundary.
 * The request still lives in this module (so the API surface stays in one place) and still
 * goes through the BFF's `/kapis` proxy with the session token.
 */
export async function uploadS2iBinary(params: {
  token: string | null;
  cluster: string;
  namespace: string;
  name: string;
  file: File;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const form = new FormData();
  form.append('s2ibinary', params.file, params.file.name);
  const doFetch = params.fetchImpl ?? globalThis.fetch;
  const headers: Record<string, string> = {};
  if (params.token) headers.Authorization = 'Bearer ' + params.token;
  const response = await doFetch(binaryFileKapisPath(params.cluster, params.namespace, params.name), {
    method: 'PUT',
    headers,
    body: form,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let message = text || 'artifact upload failed (' + response.status + ')';
    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string };
      message = parsed.message ?? parsed.error ?? message;
    } catch {
      // The devops apiserver answers a plain sentence for a storage failure; keep it.
    }
    throw new ApiError({ code: 'upload_failed', message }, response.status);
  }
}

/** Download an artifact through the BFF, which carries the bearer token the browser link cannot. */
export async function downloadS2iBinary(params: {
  token: string | null;
  downloadURL: string;
  fetchImpl?: typeof fetch;
}): Promise<Blob> {
  const doFetch = params.fetchImpl ?? globalThis.fetch;
  const headers: Record<string, string> = {};
  if (params.token) headers.Authorization = 'Bearer ' + params.token;
  const path = (() => {
    try {
      return new URL(params.downloadURL).pathname;
    } catch {
      return params.downloadURL;
    }
  })();
  const response = await doFetch(path, { headers });
  if (!response.ok) {
    throw new ApiError({ code: 'download_failed', message: 'artifact download failed (' + response.status + ')' }, response.status);
  }
  return response.blob();
}

/** Annotation keys this page family writes (kept next to the mapper that reads them). */
export const s2iAnnotationKeys = {
  displayName: 'displayName',
  serviceName: 'serviceName',
  languageType: 'languageType',
  repoUrl: 'kubesphere.io/repoUrl',
  file: 'kubesphere.io/file',
  noAutoscale: 'devops.kubesphere.io/donotautoscale',
  alias: annotationKeys.alias,
  description: annotationKeys.description,
} as const;

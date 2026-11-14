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

/**
 * Path for one namespaced devops/gitops collection.
 *
 * The `clusters/<id>` segment matches the other native kube paths in this app; only
 * the host cluster is verified on this installation.
 */
function collectionPath(groupVersion: string, cluster: string, namespace: string, resource: string): string {
  const clusterSegment = cluster && cluster !== 'host' ? `clusters/${encodeURIComponent(cluster)}/` : '';
  return `/apis/${groupVersion}/${clusterSegment}namespaces/${encodeURIComponent(namespace)}/${resource}`;
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
  };
}

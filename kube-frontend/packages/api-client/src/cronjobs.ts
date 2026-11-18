import type { Client } from './client';
import { podResourceLines, type PodLike, type ResourceLine } from './pods';
import { collectionPath, type KubeObject } from './resources';
import { workloadsApi } from './workloads';

/**
 * 定时任务的运行记录.
 *
 * A CronJob does not own pods directly: every firing creates a **Job**, and that Job owns
 * the pods. The old console listed those Jobs in a 运行记录 tab and read them by the
 * labels on `spec.jobTemplate.metadata.labels`; this module keeps that relation and adds
 * the one check the old page lacked — when the created Jobs carry `ownerReferences`, only
 * the ones that name this CronJob are kept, so a template label shared with another
 * CronJob cannot mix two histories into one table.
 */

/** One firing of a CronJob, as the runs table shows it. */
export interface CronJobRun {
  /** Job name; the row links to that Job's detail page. */
  name: string;
  /** `completed` / `failed` / `running` — the Job's own condition, not a pod phase. */
  outcome: 'completed' | 'failed' | 'running';
  /** The condition that decided the outcome (`Complete` / `Failed`), empty while running. */
  reason: string;
  startTime: string;
  /** `completionTime`, or the failed condition's probe time — the old console's fallback. */
  endTime: string;
  /** Seconds between start and end; absent while the run is still going. */
  durationSeconds?: number;
  succeeded: number;
  failed: number;
  active: number;
  /** Requests/limits of the run's first container template, aggregated like a pod's. */
  requests: ResourceLine[];
  limits: ResourceLine[];
}

interface KubeJob extends KubeObject {
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

interface KubeCronJob extends KubeObject {
  spec?: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** The labels a CronJob puts on the Jobs it creates; empty when the template has none. */
export function cronJobJobLabels(item: KubeCronJob): Record<string, string> {
  const template = asObject(asObject(item.spec)?.['jobTemplate']);
  const metadata = template ? asObject(template['metadata']) : undefined;
  const labels = metadata ? asObject(metadata['labels']) : undefined;
  if (!labels) return {};
  return Object.fromEntries(Object.entries(labels).map(([key, value]) => [key, String(value)]));
}

/** The pod template of a CronJob's Job template, as `podResourceLines` wants it. */
function jobTemplatePod(item: KubeJob): PodLike {
  const template = asObject(asObject(item.spec)?.['template']);
  const podSpec = template ? asObject(template['spec']) : undefined;
  return { spec: podSpec ?? {} };
}

/**
 * One Job → one row.
 *
 * The outcome comes from the Job's conditions (Complete / Failed), because `succeeded: 0`
 * on a running Job means "not finished", not "failed". A Job with no status yet is
 * **running** — the old console called that Failed, which reads as an alarm for a run that
 * simply has not started.
 */
export function toCronJobRun(item: KubeJob): CronJobRun {
  const status = item.status ?? {};
  const conditions = (Array.isArray(status['conditions']) ? status['conditions'] : []) as Array<Record<string, unknown>>;
  const complete = conditions.find((condition) => condition['type'] === 'Complete' && condition['status'] === 'True');
  const failed = conditions.find((condition) => condition['type'] === 'Failed' && condition['status'] === 'True');
  const outcome: CronJobRun['outcome'] = complete ? 'completed' : failed ? 'failed' : 'running';
  const startTime = String(status['startTime'] ?? item.metadata?.creationTimestamp ?? '');
  const endTime = String(
    status['completionTime'] ?? (failed ? (failed['lastProbeTime'] ?? failed['lastTransitionTime'] ?? '') : '') ?? '',
  );
  const start = startTime ? Date.parse(startTime) : Number.NaN;
  const end = endTime ? Date.parse(endTime) : Number.NaN;
  const durationSeconds =
    Number.isFinite(start) && Number.isFinite(end) && end >= start ? Math.round((end - start) / 1000) : undefined;
  const pod = jobTemplatePod(item);

  return {
    name: item.metadata?.name ?? '',
    outcome,
    reason: complete ? 'Complete' : failed ? 'Failed' : '',
    startTime,
    endTime,
    ...(durationSeconds === undefined ? {} : { durationSeconds }),
    succeeded: asNumber(status['succeeded']),
    failed: asNumber(status['failed']),
    active: asNumber(status['active']),
    requests: podResourceLines(pod, 'requests'),
    limits: podResourceLines(pod, 'limits'),
  };
}

/** Does this Job belong to that CronJob? Undecidable (no ownerReferences) counts as yes. */
function ownedBy(job: KubeJob, cronJob: string): boolean {
  const owners = itemOwners(job);
  if (owners.length === 0) return true;
  return owners.includes(cronJob);
}

function itemOwners(job: KubeJob): string[] {
  const refs = (job.metadata as { ownerReferences?: Array<{ kind?: string; name?: string }> } | undefined)?.ownerReferences;
  if (!Array.isArray(refs)) return [];
  return refs.filter((ref) => ref?.kind === 'CronJob' && ref?.name).map((ref) => String(ref.name));
}

export function cronJobRunsApi(client: Client) {
  return {
    /**
     * The Jobs this CronJob created, newest first.
     *
     * Reads the `jobs` collection through the same kapis path the Jobs list uses, filtered
     * by the template labels server-side; the owner check happens here because kapis cannot
     * express `ownerReferences` as a selector.
     */
    async list(params: {
      cluster: string;
      namespace: string;
      cronJob: string;
      labels: Record<string, string>;
      signal?: AbortSignal;
    }): Promise<CronJobRun[]> {
      const selector = Object.entries(params.labels)
        .map(([key, value]) => `${key}=${value}`)
        .join(',');
      /*
       * Raw Jobs, not the list page's summaries: the runs table needs `status.conditions` and
       * the pod template, and a summary has already thrown both away. `limit=-1` asks kapis
       * for the whole collection — a CronJob keeps at most
       * successfulJobsHistoryLimit + failedJobsHistoryLimit Jobs (default 3 + 1).
       */
      const body = await client.request<{ items?: KubeJob[] }>(collectionPath(params.cluster, params.namespace, 'jobs'), {
        query: {
          limit: -1,
          ...(selector ? { labelSelector: selector } : {}),
        },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      const jobs = body?.items ?? [];
      return jobs
        .filter((job) => ownedBy(job, params.cronJob))
        .map(toCronJobRun)
        .sort((a, b) => (b.startTime || b.name).localeCompare(a.startTime || a.name));
    },

    /**
     * 立即运行一次: create one Job from the CronJob's jobTemplate.
     *
     * Kubernetes has no "run now" verb for a CronJob; the documented way is to copy
     * `spec.jobTemplate` into a Job of your own. The name carries a timestamp so two clicks
     * cannot collide, and the annotation is the one kubectl stamps for a manual instantiation.
     */
    async runNow(params: {
      cluster: string;
      namespace: string;
      cronJob: string;
      labels: Record<string, string>;
      template: Record<string, unknown>;
    }): Promise<string> {
      const spec = asObject(params.template['spec']) ?? {};
      const suffix = Date.now().toString(36).toLowerCase();
      const created = await workloadsApi(client, 'jobs').createManifest({
        cluster: params.cluster,
        namespace: params.namespace,
        body: {
          apiVersion: 'batch/v1',
          kind: 'Job',
          metadata: {
            name: `${params.cronJob}-manual-${suffix}`,
            namespace: params.namespace,
            labels: { ...params.labels },
            annotations: { 'cronjob.kubernetes.io/instantiate': 'manual' },
          },
          spec,
        } as KubeObject,
      });
      return created.name;
    },
  };
}

import type { KubeObject } from '@kube-ai-hub/api-client';

export type JobKind = 'jobs' | 'cronjobs';

export function jobManifest(kind: JobKind, values: Record<string, unknown>): KubeObject {
  const name = String(values['name'] ?? '').trim();
  const jobSpec = {
    parallelism: Number(values['parallelism'] ?? 1),
    completions: Number(values['completions'] ?? 1),
    backoffLimit: Number(values['backoffLimit'] ?? 6),
    ...(values['activeDeadlineSeconds'] ? { activeDeadlineSeconds: Number(values['activeDeadlineSeconds']) } : {}),
    template: {
      metadata: { labels: { app: String(values['app'] ?? '').trim() || name } },
      spec: {
        restartPolicy: String(values['restartPolicy'] ?? 'Never'),
        containers: [{ name: 'container', image: String(values['image'] ?? '').trim(), imagePullPolicy: String(values['imagePullPolicy'] ?? 'IfNotPresent') }],
      },
    },
  };
  return {
    apiVersion: 'batch/v1', kind: kind === 'jobs' ? 'Job' : 'CronJob',
    metadata: { name, namespace: String(values['namespace'] ?? '') },
    spec: kind === 'jobs' ? jobSpec : {
      schedule: String(values['schedule'] ?? '').trim(),
      suspend: values['suspend'] === true,
      concurrencyPolicy: String(values['concurrencyPolicy'] ?? 'Forbid'),
      successfulJobsHistoryLimit: Number(values['successfulJobsHistoryLimit'] ?? 3),
      failedJobsHistoryLimit: Number(values['failedJobsHistoryLimit'] ?? 1),
      jobTemplate: { spec: jobSpec },
    },
  };
}

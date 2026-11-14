import { describe, expect, it } from 'vitest';
import { jobManifest } from '@/pages/app-workloads/jobManifest';

describe('job creation manifest', () => {
  it('creates a Job template with zero counters preserved and no replicas or selector', () => {
    const body = jobManifest('jobs', { name: 'job', namespace: 'default', image: 'busybox:1.37',
      parallelism: 0, completions: 2, backoffLimit: 0, activeDeadlineSeconds: 10 });
    expect(body.apiVersion).toBe('batch/v1');
    expect(body.kind).toBe('Job');
    expect(body.spec).toMatchObject({ parallelism: 0, completions: 2, backoffLimit: 0, activeDeadlineSeconds: 10,
      template: { spec: { restartPolicy: 'Never', containers: [{ name: 'container', image: 'busybox:1.37', imagePullPolicy: 'IfNotPresent' }] } } });
    expect(body.spec).not.toHaveProperty('replicas');
    expect(body.spec).not.toHaveProperty('selector');
  });
  it('nests the job template correctly for a suspended CronJob', () => {
    const body = jobManifest('cronjobs', { name: 'daily', namespace: 'default', image: 'busybox',
      schedule: '@daily', suspend: true, successfulJobsHistoryLimit: 0, failedJobsHistoryLimit: 0 });
    expect(body.kind).toBe('CronJob');
    expect(body.spec).toMatchObject({ schedule: '@daily', suspend: true, concurrencyPolicy: 'Forbid',
      successfulJobsHistoryLimit: 0, failedJobsHistoryLimit: 0,
      jobTemplate: { spec: { template: { metadata: { labels: { app: 'daily' } }, spec: { restartPolicy: 'Never' } } } } });
    expect(body.spec).not.toHaveProperty('template');
  });
});

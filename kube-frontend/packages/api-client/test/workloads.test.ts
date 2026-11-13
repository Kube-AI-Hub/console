import { describe, expect, it } from 'vitest';
import {
  daemonSetStatus,
  deploymentStatus,
  jobStatus,
  podStatus,
  workloadProgress,
  workloadStatus,
} from '../src/workloads';

/**
 * Workload status derivation.
 *
 * These rules are a port of `console/src/utils/status.js`; the list's status column
 * is the most visible thing on the page, so "did we keep the same answer for the
 * same object" is worth pinning down. Every case below is taken from the old
 * implementation's branches, not invented.
 */

const deployment = (replicas: number, readyReplicas?: number) => ({
  metadata: { name: 'd' },
  spec: { replicas },
  status: readyReplicas === undefined ? {} : { readyReplicas },
});

describe('deployment status', () => {
  it('is running when every replica is ready', () => {
    expect(deploymentStatus(deployment(3, 3))).toBe('running');
  });

  it('is updating when some replicas are not ready yet', () => {
    expect(deploymentStatus(deployment(3, 1))).toBe('updating');
  });

  it('is updating while scaling to zero with old pods still up', () => {
    // spec says 0 but readyReplicas still reports the draining pods: the old
    // console calls that Updating, not Stopped.
    expect(deploymentStatus(deployment(0, 2))).toBe('updating');
  });

  it('is stopped at zero replicas with nothing ready', () => {
    expect(deploymentStatus(deployment(0, 0))).toBe('stopped');
    expect(deploymentStatus(deployment(0))).toBe('stopped');
  });

  it('treats a never-reported readyReplicas as zero for a scaled workload', () => {
    // replicas > 0 with no status yet: not running, and the old console says Updating.
    expect(deploymentStatus(deployment(2))).toBe('updating');
  });
});

describe('daemonset status', () => {
  const ds = (desired?: number, ready?: number) => ({
    metadata: { name: 'ds' },
    spec: {},
    status: { ...(desired === undefined ? {} : { desiredNumberScheduled: desired }), ...(ready === undefined ? {} : { numberReady: ready }) },
  });

  it('is running when every scheduled node has a ready pod', () => {
    expect(daemonSetStatus(ds(4, 4))).toBe('running');
  });

  it('is updating when some nodes are not ready', () => {
    expect(daemonSetStatus(ds(4, 2))).toBe('updating');
  });

  it('is stopped when nothing is scheduled', () => {
    expect(daemonSetStatus(ds(0, 0))).toBe('stopped');
    expect(daemonSetStatus(ds())).toBe('stopped');
  });
});

describe('job status', () => {
  it('is running while an instance is active', () => {
    expect(jobStatus({ metadata: { name: 'j' }, status: { active: 1 } })).toBe('running');
  });

  it('is running once something succeeded', () => {
    expect(jobStatus({ metadata: { name: 'j' }, status: { succeeded: 1 } })).toBe('running');
  });

  it('is updating when anything failed', () => {
    expect(jobStatus({ metadata: { name: 'j' }, status: { failed: 1 } })).toBe('updating');
  });

  it('is stopped when it has neither run nor failed', () => {
    expect(jobStatus({ metadata: { name: 'j' }, status: {} })).toBe('stopped');
  });
});

describe('pod status', () => {
  const pod = (phase: string, containerStatuses: Array<Record<string, unknown>> = []) => ({
    metadata: { name: 'p' },
    status: { phase, containerStatuses },
  });

  it('is terminated for a finished or failed pod', () => {
    expect(podStatus(pod('Succeeded'))).toBe('terminated');
    expect(podStatus(pod('Failed'))).toBe('terminated');
  });

  it('is waiting while pending', () => {
    expect(podStatus(pod('Pending'))).toBe('waiting');
  });

  it('is running only when every container reports ready', () => {
    expect(podStatus(pod('Running', [{ ready: true }, { ready: true }]))).toBe('running');
    expect(podStatus(pod('Running', [{ ready: true }, { ready: false }]))).toBe('waiting');
  });

  it('is waiting for a running pod whose state has not been reported yet', () => {
    // No containerStatuses at all: the pod exists but nothing is ready, and saying
    // "running" here is what makes a crash-loop look healthy.
    expect(podStatus(pod('Running'))).toBe('waiting');
  });
});

describe('progress counters', () => {
  it('reports deployment ready/desired', () => {
    expect(workloadProgress('deployments', deployment(3, 2))).toEqual({ ready: 2, total: 3 });
  });

  it('reports daemonset ready/desired from the scheduled counters', () => {
    expect(workloadProgress('daemonsets', { metadata: { name: 'd' }, status: { numberReady: 2, desiredNumberScheduled: 5 } })).toEqual({
      ready: 2,
      total: 5,
    });
  });

  it('reports job succeeded/completions', () => {
    expect(
      workloadProgress('jobs', { metadata: { name: 'j' }, spec: { completions: 4 }, status: { succeeded: 1 } }),
    ).toEqual({ ready: 1, total: 4 });
  });

  it('has no counters for kinds without replicas', () => {
    expect(workloadProgress('pods', { metadata: { name: 'p' } })).toEqual({});
    expect(workloadProgress('services', { metadata: { name: 's' } })).toEqual({});
  });
});

describe('dispatch', () => {
  it('routes each kind to its own rule', () => {
    expect(workloadStatus('deployments', deployment(1, 1))).toBe('running');
    expect(workloadStatus('pods', { metadata: { name: 'p' }, status: { phase: 'Pending' } })).toBe('waiting');
    // Services and routes have no status; an empty string keeps the column absent
    // rather than showing a meaningless badge.
    expect(workloadStatus('services', { metadata: { name: 's' } })).toBe('');
  });
});

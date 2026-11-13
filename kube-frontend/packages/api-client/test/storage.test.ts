import { describe, expect, it } from 'vitest';
import { accessModeLabel, claimStatus, snapshotStatus, toStorageSummary } from '../src/storage';

/**
 * Storage summaries.
 *
 * The old console reads a claim's status from `status.phase`, but shows the
 * enhancement conditions when they are present — a claim that is bound and
 * resizing is "Resizing", not "Bound". These cases pin that behaviour down.
 */

const claim = (phase: string, conditions: Array<Record<string, unknown>> = []) => ({
  metadata: { name: 'c', namespace: 'default' },
  spec: {
    accessModes: ['ReadWriteOnce', 'ReadWriteMany'],
    storageClassName: 'local-path',
    resources: { requests: { storage: '5Gi' } },
    volumeName: 'pvc-123',
  },
  status: { phase, ...(conditions.length ? { conditions } : {}) },
});

describe('claim status', () => {
  it('uses the phase when there is no enhancement condition', () => {
    expect(claimStatus(claim('Bound'))).toBe('Bound');
    expect(claimStatus(claim('Pending'))).toBe('Pending');
  });

  it('prefers a resize condition over the phase', () => {
    // Bound + resizing is "Resizing": the phase alone would hide that a resize is
    // in flight, which is the whole reason the old console looks at conditions.
    expect(claimStatus(claim('Bound', [{ type: 'Resizing' }]))).toBe('Resizing');
    expect(claimStatus(claim('Bound', [{ type: 'FileSystemResizePending' }]))).toBe('FileSystemResizePending');
  });

  it('ignores unrelated conditions', () => {
    expect(claimStatus(claim('Bound', [{ type: 'Ready' }]))).toBe('Bound');
  });
});

describe('snapshot status', () => {
  it('is Ready when readyToUse is true', () => {
    expect(snapshotStatus({ metadata: { name: 's' }, status: { readyToUse: true } })).toBe('Ready');
  });

  it('surfaces the error message when the snapshot failed', () => {
    expect(snapshotStatus({ metadata: { name: 's' }, status: { error: { message: 'boom' } } })).toBe('boom');
  });

  it('is Pending while the driver works', () => {
    expect(snapshotStatus({ metadata: { name: 's' }, status: {} })).toBe('Pending');
  });
});

describe('access mode labels', () => {
  it('uses the old console abbreviations', () => {
    expect(accessModeLabel('ReadWriteOnce')).toBe('RWO');
    expect(accessModeLabel('ReadOnlyMany')).toBe('ROX');
    expect(accessModeLabel('ReadWriteMany')).toBe('RWX');
    expect(accessModeLabel('ReadWriteOncePod')).toBe('RWOP');
  });

  it('passes an unknown mode through instead of hiding it', () => {
    expect(accessModeLabel('SomeFutureMode')).toBe('SomeFutureMode');
  });
});

describe('summary', () => {
  it('carries capacity from the request and the class from the spec', () => {
    const summary = toStorageSummary('persistentvolumeclaims', claim('Bound'));
    expect(summary.capacity).toBe('5Gi');
    expect(summary.storageClass).toBe('local-path');
    expect(summary.accessModes).toEqual(['RWO', 'RWX']);
    expect(summary.status).toBe('Bound');
  });

  it('reads a snapshot capacity from status.restoreSize', () => {
    const summary = toStorageSummary('volumesnapshots', {
      metadata: { name: 's', namespace: 'default' },
      spec: { storageClassName: 'csi', source: { persistentVolumeClaim: { name: 'data' } } },
      status: { readyToUse: true, restoreSize: '2Gi' },
    });
    expect(summary.capacity).toBe('2Gi');
    expect(summary.status).toBe('Ready');
    expect(summary.accessModes).toEqual([]);
  });
});

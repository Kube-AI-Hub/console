import { describe, expect, it } from 'vitest';
import { nodeRole, nodeStatus, toNamespaceSummary, toNodeSummary } from '../src/storage';

/**
 * Cluster-level read models.
 *
 * Node health is decided by one condition and the role by one label family; both are
 * easy to get subtly wrong (a node with no Ready condition must not be "Ready", a
 * node with no role label must still show something), so each branch is pinned down.
 */

const node = (labels: Record<string, string>, conditions: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) => ({
  metadata: { name: 'n1', labels },
  status: {
    conditions,
    addresses: [{ type: 'InternalIP', address: '10.0.0.5' }],
    nodeInfo: { kubeletVersion: 'v1.31.0' },
    allocatable: { cpu: '16', memory: '64Gi' },
    ...extra,
  },
});

describe('node status', () => {
  it('is Ready when the Ready condition is True', () => {
    expect(nodeStatus(node({}, [{ type: 'Ready', status: 'True' }]))).toBe('Ready');
  });

  it('is NotReady when the Ready condition is False', () => {
    expect(nodeStatus(node({}, [{ type: 'Ready', status: 'False' }]))).toBe('NotReady');
  });

  it('is Unknown when no Ready condition has been reported yet', () => {
    // A node that has just joined has no condition; calling that "Ready" would hide
    // exactly the state an operator is looking for.
    expect(nodeStatus(node({}, []))).toBe('Unknown');
    expect(nodeStatus({ metadata: { name: 'n' } })).toBe('Unknown');
  });
});

describe('node role', () => {
  it('reports the control plane label', () => {
    expect(nodeRole(node({ 'node-role.kubernetes.io/control-plane': '' }, []))).toBe('control-plane');
  });

  it('joins several role labels', () => {
    const labels = { 'node-role.kubernetes.io/control-plane': '', 'node-role.kubernetes.io/etcd': '' };
    expect(nodeRole(node(labels, []))).toBe('control-plane, etcd');
  });

  it('defaults to worker when no role label exists', () => {
    // `worker` is not written as a label by kubeadm clusters, so an unlabelled node
    // is a worker — showing nothing there would read as missing data.
    expect(nodeRole(node({}, []))).toBe('worker');
  });

  it('treats an empty or explicit worker label as the default', () => {
    expect(nodeRole(node({ 'node-role.kubernetes.io/worker': '' }, []))).toBe('worker');
  });
});

describe('node summary', () => {
  it('carries address, version and allocatable resources', () => {
    const summary = toNodeSummary(node({}, [{ type: 'Ready', status: 'True' }]));
    expect(summary.status).toBe('Ready');
    expect(summary.internalIP).toBe('10.0.0.5');
    expect(summary.version).toBe('v1.31.0');
    expect(summary.cpu).toBe('16');
    expect(summary.memory).toBe('64Gi');
  });
});

describe('namespace summary', () => {
  it('reads the workspace from the label', () => {
    const summary = toNamespaceSummary({
      metadata: { name: 'spaces', labels: { 'kubesphere.io/workspace': 'system-workspace' } },
      status: { phase: 'Active' },
    });
    expect(summary.workspace).toBe('system-workspace');
    expect(summary.status).toBe('Active');
  });

  it('leaves the workspace empty when the label is absent', () => {
    expect(toNamespaceSummary({ metadata: { name: 'kube-system' } }).workspace).toBe('');
  });
});

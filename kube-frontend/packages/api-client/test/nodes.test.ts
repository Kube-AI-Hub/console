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
  /*
   * Three states, matching `kube-server`'s `getNodeStatus`: `running` when every
   * expected condition holds, `warning` when one does not, `unschedulable` when
   * cordoned. The `Ready` condition alone cannot express the last two — a cordoned
   * node is healthy but takes no new pods, and a pressure condition can be set while
   * `Ready` is still True.
   */
  it('is Running when every expected condition holds', () => {
    expect(nodeStatus(node({}, [{ type: 'Ready', status: 'True' }]))).toBe('Running');
    expect(nodeStatus(node({}, [
      { type: 'Ready', status: 'True' }, { type: 'MemoryPressure', status: 'False' },
    ]))).toBe('Running');
  });

  it('is Warning when any expected condition is out of range', () => {
    expect(nodeStatus(node({}, [{ type: 'Ready', status: 'False' }]))).toBe('Warning');
    // `Ready` True does not save it: memory pressure is its own unhealthy fact, and
    // the old console's JS version decided from the *last* condition only.
    expect(nodeStatus(node({}, [
      { type: 'MemoryPressure', status: 'True' }, { type: 'Ready', status: 'True' },
    ]))).toBe('Warning');
  });

  it('is Unschedulable when cordoned, even with every condition healthy', () => {
    // `spec.unschedulable`, not a condition: cordoning is a spec write, and a
    // cordoned node is still perfectly healthy — it just takes no new pods.
    expect(nodeStatus({
      metadata: { name: 'n1', labels: {} },
      spec: { unschedulable: true },
      status: { conditions: [{ type: 'Ready', status: 'True' }] },
    })).toBe('Unschedulable');
  });

  it('ignores conditions the server does not expect anything from', () => {
    // A condition outside `expectedConditions` carries no expectation, so it cannot
    // make a node unhealthy.
    expect(nodeStatus(node({}, [
      { type: 'Ready', status: 'True' }, { type: 'FlannelIsUp', status: 'False' },
    ]))).toBe('Running');
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
    // `Running`, not `Ready`: the summary carries `kube-server`'s three-state status
    // (see `nodeStatus`), not the raw `Ready` condition.
    expect(summary.status).toBe('Running');
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

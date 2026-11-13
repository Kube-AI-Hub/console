import { describe, expect, it } from 'vitest';
import { toAlertSummary, toAlertingRuleSummary } from '../src/alerting';
import { toComponentSummary } from '../src/storage';
import { toNetworkPolicySummary, toSelector } from '../src/iam';
import { toStorageClassSummary, mountsOf, withMountState, quantityToNumber, usagePercent } from '../src/storage';
import { toWorkloadService, toWorkloadPod, toWorkloadRevision, toWorkloadSummary, revisionTemplate } from '../src/workloads';

/**
 * Row mappers that turn a Kubernetes object into a table row.
 *
 * These are where the console decides what a column says, so each one is pinned by
 * the cases that had a non-obvious answer: which annotation a role lives in, what an
 * empty selector means, what a missing field should render as.
 */

describe('alert summary', () => {
  it('reads the message from the annotation and the state from status', () => {
    const row = toAlertSummary({
      metadata: { name: 'a1', labels: { severity: 'warning', alertname: 'HighCPU' }, annotations: { message: 'CPU high' } },
      status: { state: 'firing' },
    });
    expect(row.message).toBe('CPU high');
    expect(row.state).toBe('firing');
    expect(row.severity).toBe('warning');
  });

  it('normalises severity through the three-value vocabulary', () => {
    // The platform wrote `high`/`medium`/`low` in some versions.
    const high = toAlertSummary({ metadata: { name: 'a', labels: { severity: 'high' } } });
    const medium = toAlertSummary({ metadata: { name: 'a', labels: { severity: 'medium' } } });
    expect(high.severity).toBe('critical');
    expect(medium.severity).toBe('warning');
  });

  it('falls back to the object name when there is no message', () => {
    expect(toAlertSummary({ metadata: { name: 'only-name' } }).message).toBe('only-name');
  });
});

describe('alerting rule summary', () => {
  it('is enabled when the label is absent', () => {
    // Never-disabled policies carry no label; treating that as disabled would hide
    // every working policy behind a grey badge.
    expect(toAlertingRuleSummary({ metadata: { name: 'r' }, spec: { rules: [{}] } }).enabled).toBe(true);
  });

  it('is disabled only when the label says so', () => {
    const row = toAlertingRuleSummary({ metadata: { name: 'r', labels: { 'alerting.kubesphere.io/enable': 'false' } } });
    expect(row.enabled).toBe(false);
  });

  it('counts the rules it contains', () => {
    expect(toAlertingRuleSummary({ metadata: { name: 'r' }, spec: { rules: [{}, {}, {}] } }).ruleCount).toBe(3);
  });
});

describe('component summary', () => {
  it('is up only when every backend is healthy', () => {
    expect(toComponentSummary({ metadata: { name: 'c' }, healthyBackends: 2, totalBackends: 2 }).up).toBe(true);
    expect(toComponentSummary({ metadata: { name: 'c' }, healthyBackends: 1, totalBackends: 2 }).up).toBe(false);
  });

  it('is not up when it has no backends at all', () => {
    // Zero-of-zero is not "healthy": it is a component that never started.
    expect(toComponentSummary({ metadata: { name: 'c' }, totalBackends: 0 }).up).toBe(false);
  });
});

describe('network policy summary', () => {
  it('renders the pod selector of the first rule', () => {
    const row = toNetworkPolicySummary({
      metadata: { name: 'np' },
      spec: { podSelector: { matchLabels: { app: 'web', tier: 'fe' } }, policyTypes: ['Ingress'] },
    });
    expect(row.podSelector).toBe('app=web, tier=fe');
    expect(row.policyTypes).toEqual(['Ingress']);
  });

  it('shows a wildcard for an empty selector', () => {
    // `{}` selects every pod, which is what the policy protects; rendering it as an
    // empty string reads as "protects nothing".
    expect(toNetworkPolicySummary({ metadata: { name: 'np' }, spec: { podSelector: {} } }).podSelector).toBe('*');
  });

  it('parses a label string into a selector', () => {
    expect(toSelector('app=web, tier=fe')).toEqual({ matchLabels: { app: 'web', tier: 'fe' } });
    expect(toSelector('')).toEqual({});
    expect(toSelector('  ')).toEqual({});
  });
});

describe('storage class summary', () => {
  const base = { metadata: { name: 'sc' } };

  it('applies Kubernetes default values when the fields are absent', () => {
    // The API omits these when unset; the defaults are well defined, so showing an
    // empty string would read as "unknown".
    const row = toStorageClassSummary(base);
    expect(row.reclaimPolicy).toBe('Delete');
    expect(row.volumeBindingMode).toBe('Immediate');
  });

  it('recognises the default marker in both spellings', () => {
    const current = toStorageClassSummary({
      metadata: { name: 'a', annotations: { 'storageclass.kubernetes.io/is-default-class': 'true' } },
    });
    const beta = toStorageClassSummary({
      metadata: { name: 'b', annotations: { 'storageclass.beta.kubernetes.io/is-default-class': 'true' } },
    });
    expect(current.isDefault).toBe(true);
    expect(beta.isDefault).toBe(true);
  });

  it('leaves the claim count undefined when the platform does not report it', () => {
    // A zero would be a statement ("nobody uses this class") the API never made.
    expect(toStorageClassSummary(base).pvcCount).toBeUndefined();
    const counted = toStorageClassSummary({ metadata: { name: 'c', annotations: { 'kubesphere.io/pvc-count': '7' } } });
    expect(counted.pvcCount).toBe(7);
  });

  it('reports capabilities only when the class declares them', () => {
    const plain = toStorageClassSummary(base);
    expect(plain.allowExpansion).toBe(false);
    const expandable = toStorageClassSummary({ ...base, allowVolumeExpansion: true });
    expect(expandable.allowExpansion).toBe(true);
  });
});

describe('workload summary', () => {
  it('reads service ports and type for a Service', () => {
    const row = toWorkloadSummary('services', {
      metadata: { name: 's' },
      spec: { type: 'ClusterIP', ports: [{ name: 'http', port: 80, targetPort: 8080 }] },
    });
    expect(row.serviceType).toBe('ClusterIP');
    // A ClusterIP port carries no `nodePort` key at all (not a zero), so the detail
    // table can render `-` for "this service has none".
    expect(row.ports).toEqual([{ name: 'http', port: 80, targetPort: '8080' }]);
  });

  it('defaults the service type to ClusterIP when absent', () => {
    expect(toWorkloadSummary('services', { metadata: { name: 's' }, spec: { ports: [] } }).serviceType).toBe('ClusterIP');
  });

  it('flattens an Ingress into one row per host and path', () => {
    const row = toWorkloadSummary('ingresses', {
      metadata: { name: 'i' },
      spec: {
        rules: [
          {
            host: 'a.example.com',
            http: { paths: [{ path: '/', backend: { service: { name: 'svc', port: { number: 80 } } } }] },
          },
          {
            host: 'b.example.com',
            http: { paths: [{ path: '/api', backend: { service: { name: 'api', port: { name: 'http' } } } }] },
          },
        ],
      },
    });
    expect(row.rules).toEqual([
      { host: 'a.example.com', path: '/', serviceName: 'svc', servicePort: '80' },
      { host: 'b.example.com', path: '/api', serviceName: 'api', servicePort: 'http' },
    ]);
  });

  it('leaves ports and rules empty for other kinds', () => {
    const row = toWorkloadSummary('deployments', { metadata: { name: 'd' } });
    expect(row.ports).toEqual([]);
    expect(row.rules).toEqual([]);
    expect(row.serviceType).toBe('');
  });
});

describe('quantity parsing', () => {
  it('converts the suffixes the metrics API uses', () => {
    // Nano-cores and Ki are different units of the same quantity; comparing them raw
    // is how a usage column ends up showing 3000%.
    expect(quantityToNumber('9983741666n')).toBeCloseTo(9.98, 1);
    expect(quantityToNumber('1282375024Ki')).toBeCloseTo(1282375024 * 1024, 0);
    expect(quantityToNumber('127600m')).toBeCloseTo(127.6, 3);
    expect(quantityToNumber('8')).toBe(8);
    expect(quantityToNumber('1Gi')).toBe(1024 ** 3);
  });

  it('tolerates values it cannot parse', () => {
    expect(quantityToNumber('')).toBe(0);
    expect(quantityToNumber('abc')).toBe(0);
  });

  it('computes a clamped percentage of capacity', () => {
    const used = '10306401619n';
    const capacity = '127600m';
    const percent = usagePercent(used, capacity);
    expect(percent).toBeGreaterThanOrEqual(0);
    expect(percent).toBeLessThanOrEqual(100);
    // ~10.3 cores of 127.6: single digits.
    expect(percent).toBe(8);
  });

  it('returns undefined when capacity is zero or unparseable', () => {
    // An undefined percentage renders as `-`; a zero would read as "idle".
    expect(usagePercent('1', '0')).toBeUndefined();
    expect(usagePercent('1', '')).toBeUndefined();
  });
});

describe('pod metric shapes', () => {
  it('demonstrates why container usage must be read one level deeper', () => {
    // A node metric carries `usage` next to `metadata`; a pod metric nests it under
    // `containers[]`. Reading the node shape for pods yields zero usage while the pod
    // count stays right — the exact symptom this pinning guards against.
    const pod = { metadata: { namespace: 'spaces' }, containers: [{ usage: { cpu: '11712447n', memory: '8143892Ki' } }] };
    const nodeShape = (pod as unknown as { usage?: Record<string, string> }).usage;
    expect(nodeShape).toBeUndefined();

    const containerCores = pod.containers.reduce((sum, c) => sum + quantityToNumber(c.usage.cpu), 0);
    expect(containerCores).toBeCloseTo(0.0117, 3);
  });
});

describe('deployment revisions', () => {
  const rs = (name: string, revision: string, replicas: number, image: string) => ({
    metadata: {
      name,
      creationTimestamp: '2026-11-01T10:00:00Z',
      annotations: { 'deployment.kubernetes.io/revision': revision },
    },
    spec: { replicas, template: { metadata: { creationTimestamp: null }, spec: { containers: [{ name: 'c', image }] } } },
  });

  it('reads the revision number and images from the ReplicaSet', () => {
    const row = toWorkloadRevision(rs('d-abc', '3', 2, 'nginx:1.29'), 3);
    expect(row.revision).toBe(3);
    expect(row.replicas).toBe(2);
    expect(row.images).toEqual(['nginx:1.29']);
    expect(row.current).toBe(true);
  });

  it('marks only the revision the Deployment points at as current', () => {
    expect(toWorkloadRevision(rs('d-old', '2', 0, 'nginx:1.28'), 3).current).toBe(false);
  });

  it('treats a missing revision annotation as zero', () => {
    // Number('') is 0 and Number(undefined) is NaN; both must end up usable for sorting.
    const row = toWorkloadRevision({ metadata: { name: 'd' } } as never, 3);
    expect(row.revision).toBe(0);
    expect(row.current).toBe(false);
  });

  it('exposes the template a rollback writes back', () => {
    const template = revisionTemplate(rs('d-abc', '1', 1, 'nginx:1.27'));
    const containers = (template as { spec?: { containers?: Array<{ image?: string }> } })?.spec?.containers ?? [];
    expect(containers[0]?.image).toBe('nginx:1.27');
  });
});

describe('workload pods', () => {
  it('totals restarts across containers', () => {
    const row = toWorkloadPod({
      metadata: { name: 'p', creationTimestamp: '2026-11-01T10:00:00Z' },
      spec: { nodeName: 'node-a' },
      status: {
        phase: 'Running',
        containerStatuses: [{ restartCount: 2 }, { restartCount: 3 }],
      },
    });
    expect(row.restarts).toBe(5);
    expect(row.node).toBe('node-a');
    expect(row.phase).toBe('Running');
    expect(row.terminating).toBe(false);
  });

  it('marks a terminating pod, because it is still listed', async () => {
    const row = toWorkloadPod({ metadata: { name: 'p', deletionTimestamp: '2026-11-01T10:00:00Z' } as never });
    expect(row.terminating).toBe(true);
  });
});

describe('mount state', () => {
  const podWith = (claim: string, deleting = false) => ({
    metadata: { name: `p-${claim}`, ...(deleting ? { deletionTimestamp: '2026-11-01T00:00:00Z' } : {}) },
    spec: { volumes: [{ name: 'v', persistentVolumeClaim: { claimName: claim } }, { name: 'tmp', emptyDir: {} }] },
  });

  it('collects the claims pods mount', () => {
    const mounted = mountsOf([podWith('data-a'), podWith('data-b')]);
    expect([...mounted].sort()).toEqual(['data-a', 'data-b']);
  });

  it('ignores volumes that are not claims', () => {
    expect(mountsOf([podWith('data-a')]).has('tmp')).toBe(false);
  });

  it('counts a terminating pod as still mounting the claim', () => {
    // The volume is not free until the pod is gone; saying 未挂载 here is how a claim
    // gets deleted out from under a running process.
    expect(mountsOf([podWith('data-a', true)]).has('data-a')).toBe(true);
  });

  it('leaves rows untouched until the scan has run', () => {
    const rows = [{ kind: 'persistentvolumeclaims' as const, name: 'data-a' }];
    // `undefined` means "not computed", and the column says 计算中 rather than 未挂载.
    expect(withMountState(rows, undefined)[0]).not.toHaveProperty('inUse');
    expect(withMountState(rows, new Set(['data-a']))[0]).toMatchObject({ inUse: true });
    expect(withMountState(rows, new Set(['other']))[0]).toMatchObject({ inUse: false });
  });

  it('does not attach a mount state to snapshots', () => {
    const snapshots = [{ kind: 'volumesnapshots' as const, name: 'snap' }];
    expect(withMountState(snapshots, new Set(['snap']))[0]).not.toHaveProperty('inUse');
  });
});

describe('statefulset governing service', () => {
  it('reports a headless service as Headless, not ClusterIP', () => {
    // `clusterIP: None` is how Kubernetes spells a headless service; calling it
    // ClusterIP hides the one property that matters for pod DNS.
    const svc = toWorkloadService(
      { metadata: { name: 'db' }, spec: { clusterIP: 'None', ports: [{ port: 5432, protocol: 'TCP' }] } } as never,
      'db',
    );
    expect(svc.exists).toBe(true);
    expect(svc.type).toBe('Headless');
    expect(svc.clusterIP).toBe('None');
    expect(svc.ports).toEqual(['5432/TCP']);
  });

  it('reports a named service that does not exist', () => {
    // Naming a missing service breaks pod DNS without failing the apply, so the page
    // has to say "missing" rather than render an empty block.
    const svc = toWorkloadService(undefined, 'typo-service');
    expect(svc.exists).toBe(false);
    expect(svc.name).toBe('typo-service');
  });

  it('defaults the protocol to TCP', () => {
    const svc = toWorkloadService({ metadata: { name: 's' }, spec: { clusterIP: '10.0.0.1', ports: [{ port: 80 }] } } as never, 's');
    expect(svc.ports).toEqual(['80/TCP']);
  });
});

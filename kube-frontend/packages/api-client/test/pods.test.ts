import { describe, expect, it } from 'vitest';
import {
  containerEnvGroups,
  containerLifecycleHooks,
  envValueMasked,
  isInformativeReason,
  parseGpuAllocations,
  podResourceLines,
  podStatusReason,
  resolvePodEnv,
  toPodScheduling,
  type PodLike,
} from '../src/pods';
import type { Client } from '../src/client';

/**
 * The pod views the 容器组 pages read.
 *
 * Each case uses inputs that differ from one another — two containers with
 * different requests, two GPU devices, a masked and an unmasked variable — so a
 * mapper that silently drops one of them fails here instead of passing on a
 * single-container sample.
 */

function pod(overrides: Partial<PodLike> = {}): PodLike {
  return {
    metadata: { annotations: {} },
    spec: {
      nodeName: 'gpu01',
      containers: [
        {
          name: 'app',
          image: 'nginx:1.27',
          resources: {
            requests: { cpu: '250m', memory: '256Mi', 'nvidia.com/gpu': '1' },
            limits: { cpu: '1', memory: '1Gi' },
          },
          env: [
            { name: 'PLAIN', value: 'hello' },
            { name: 'DB_PASSWORD', value: 'hunter2' },
            { name: 'FROM_CONFIG', valueFrom: { configMapKeyRef: { name: 'app-config', key: 'mode' } } },
            { name: 'FROM_SECRET', valueFrom: { secretKeyRef: { name: 'app-secret', key: 'token' } } },
            { name: 'POD_NAME', valueFrom: { fieldRef: { fieldPath: 'metadata.name' } } },
          ],
        },
      ],
      initContainers: [
        { name: 'init-db', resources: { requests: { cpu: '500m', memory: '512Mi' } } },
      ],
    },
    status: {
      phase: 'Running',
      conditions: [
        { type: 'PodScheduled', status: 'True', lastTransitionTime: '2026-11-18T10:00:00Z' },
        { type: 'Ready', status: 'False', reason: 'ContainersNotReady', message: 'containers with unready status: [app]' },
      ],
      containerStatuses: [
        { name: 'app', ready: true, restartCount: 3, state: { running: { startedAt: '2026-11-18T10:00:05Z' } } },
      ],
    },
    ...overrides,
  };
}

describe('podStatusReason', () => {
  it('keeps a plain phase when nothing is wrong', () => {
    expect(podStatusReason(pod())).toBe('Running');
    expect(isInformativeReason('Running', 'Running')).toBe(false);
  });

  it('reports the container waiting reason, which is what the list shows', () => {
    const crashing = pod({
      status: {
        phase: 'Running',
        containerStatuses: [{ name: 'app', ready: false, restartCount: 7, state: { waiting: { reason: 'CrashLoopBackOff' } } }],
      },
    });
    expect(podStatusReason(crashing)).toBe('CrashLoopBackOff');
    expect(isInformativeReason('CrashLoopBackOff', 'Running')).toBe(true);
  });

  it('prefixes an init container failure', () => {
    const failing = pod({
      status: {
        phase: 'Pending',
        initContainerStatuses: [{ name: 'init-db', state: { terminated: { exitCode: 1, reason: 'Error' } } }],
      },
    });
    expect(podStatusReason(failing)).toBe('Init:Error');
  });
});

describe('podResourceLines', () => {
  it('sums every container, init containers included, with units per resource', () => {
    const requests = podResourceLines(pod(), 'requests');
    expect(requests).toEqual([
      { resource: 'cpu', value: '0.75' },
      { resource: 'memory', value: '768Mi' },
      { resource: 'gpu', value: '1' },
    ]);
    expect(podResourceLines(pod(), 'limits')).toEqual([
      { resource: 'cpu', value: '1' },
      { resource: 'memory', value: '1024Mi' },
    ]);
  });

  it('returns no lines when no container declares anything of that kind', () => {
    const bare = pod({ spec: { nodeName: 'gpu01', containers: [{ name: 'app' }] } });
    expect(podResourceLines(bare, 'requests')).toEqual([]);
    expect(podResourceLines(bare, 'limits')).toEqual([]);
  });

  it('keeps an unparseable quantity visible instead of counting it as zero', () => {
    const odd = pod({
      spec: { containers: [{ name: 'app', resources: { requests: { 'example.com/thing': 'a lot' } } }] },
    });
    expect(podResourceLines(odd, 'requests')).toEqual([{ resource: 'thing', value: 'a lot' }]);
  });
});

describe('toPodScheduling', () => {
  it('reads the node, the PodScheduled time and the conditions', () => {
    const scheduling = toPodScheduling(pod());
    expect(scheduling.node).toBe('gpu01');
    expect(scheduling.scheduled).toBe(true);
    expect(scheduling.scheduledAt).toBe('2026-11-18T10:00:00Z');
    expect(scheduling.conditions.map((condition) => condition.type)).toEqual(['PodScheduled', 'Ready']);
    expect(scheduling.conditions[1]?.reason).toBe('ContainersNotReady');
  });

  it('says not scheduled when there is no node and no condition', () => {
    const scheduling = toPodScheduling(pod({ spec: { containers: [] }, status: { phase: 'Pending' } }));
    expect(scheduling.node).toBe('');
    expect(scheduling.scheduled).toBe(false);
    expect(scheduling.scheduledAt).toBe('');
  });

  it('parses HAMi device annotations, de-duplicating by physical uuid', () => {
    const annotated = pod({
      metadata: {
        annotations: {
          'hami.io/vgpu-devices-allocated': 'GPU-aaa,NVIDIA,10240,50:GPU-bbb,NVIDIA,10240,50',
          'other/key': 'ignored',
        },
      },
    });
    const allocations = parseGpuAllocations(annotated.metadata?.annotations);
    expect(allocations).toHaveLength(2);
    expect(allocations[0]).toMatchObject({ uuid: 'GPU-aaa', vendor: 'NVIDIA', memoryMi: 10240, corePercent: 50 });
    expect(toPodScheduling(annotated).gpuAllocations).toHaveLength(2);
  });

  it('links a MIG device by its physical uuid', () => {
    const mig = parseGpuAllocations({ 'hami.io/vgpu-devices-allocated': 'GPU-aaa[1-1],NVIDIA,2048,10' });
    expect(mig[0]?.physicalUuid).toBe('GPU-aaa');
    expect(mig[0]?.uuid).toBe('GPU-aaa[1-1]');
  });
});

describe('containerLifecycleHooks', () => {
  it('describes an HTTP, a TCP and a command hook', () => {
    const hooks = containerLifecycleHooks({
      lifecycle: {
        postStart: { httpGet: { path: '/ready', port: 8080, scheme: 'HTTPS' } },
        preStop: { exec: { command: ['/bin/sh', '-c', 'sleep 5'] } },
      },
    });
    expect(hooks).toEqual([
      { kind: 'postStart', type: 'httpGet', detail: ['HTTPS', '/ready', ':8080'] },
      { kind: 'preStop', type: 'exec', detail: ['/bin/sh -c sleep 5'] },
    ]);
    expect(containerLifecycleHooks({ lifecycle: { preStop: { tcpSocket: { port: 9000 } } } })).toEqual([
      { kind: 'preStop', type: 'tcpSocket', detail: ['9000'] },
    ]);
    expect(containerLifecycleHooks({})).toEqual([]);
  });
});

describe('containerEnvGroups and resolvePodEnv', () => {
  it('keeps init containers first and marks the masked names', () => {
    const groups = containerEnvGroups(
      pod({
        spec: {
          initContainers: [{ name: 'init-db', env: [{ name: 'WAIT', value: '5' }] }],
          containers: [{ name: 'app', env: [{ name: 'API_SECRET', value: 'x' }] }],
        },
      }),
    );
    expect(groups.map((group) => [group.name, group.init])).toEqual([
      ['init-db', true],
      ['app', false],
    ]);
    expect(envValueMasked('API_SECRET')).toBe(true);
    expect(envValueMasked('API_TOKEN')).toBe(false);
    expect(groups[1]?.entries[0]).toMatchObject({ name: 'API_SECRET', masked: true });
  });

  it('resolves ConfigMap and Secret references and leaves the unresolvable ones as references', async () => {
    const requests: string[] = [];
    const client = {
      request: async (path: string) => {
        requests.push(path);
        if (path.endsWith('/configmaps/app-config')) return { metadata: { name: 'app-config' }, data: { mode: 'fast' } };
        if (path.endsWith('/secrets/app-secret')) return { metadata: { name: 'app-secret' }, data: { token: btoa('s3cr3t') } };
        throw new Error('not found');
      },
    } as unknown as Client;

    const groups = await resolvePodEnv(client, { cluster: 'host', namespace: 'default', item: pod() });
    // The pod declares an init container without env, so the app group is the second one.
    const entries = groups.find((group) => group.name === 'app')?.entries ?? [];
    const byName = Object.fromEntries(entries.map((entry) => [entry.name, entry]));

    expect(byName['PLAIN']?.value).toBe('hello');
    expect(byName['FROM_CONFIG']?.value).toBe('fast');
    expect(byName['FROM_SECRET']?.value).toBe('s3cr3t');
    // A fieldRef is resolved by the kubelet, not by us: the reference stays visible.
    expect(byName['POD_NAME']?.value).toBe('');
    expect(byName['POD_NAME']?.reference).toBe('fieldRef:metadata.name');
    // Each object is read once even though two variables could point at it.
    expect(requests.filter((path) => path.endsWith('/configmaps/app-config'))).toHaveLength(1);
  });

  it('keeps the reference when the referenced object cannot be read', async () => {
    const client = {
      request: async () => {
        throw new Error('403');
      },
    } as unknown as Client;
    const groups = await resolvePodEnv(client, { cluster: 'host', namespace: 'default', item: pod() });
    const secretEntry = groups.find((group) => group.name === 'app')?.entries.find((entry) => entry.name === 'FROM_SECRET');
    expect(secretEntry?.value).toBe('');
    expect(secretEntry?.reference).toBe('secretKeyRef:app-secret/token');
  });
});

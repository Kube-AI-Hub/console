import { describe, expect, it } from 'vitest';
import { toNodeDetail } from '@kube-ai-hub/api-client';
import { allocationText, allocationValue, conditionTone, topologyRows } from '@/pages/cluster/nodeDetailModel';

describe('node detail facts', () => {
  it('interprets pressure and readiness independently and preserves unknown conditions', () => {
    const tone = (type: string, status: string) => conditionTone({
      type, status, reason: '', message: '', lastTransitionTime: '', lastHeartbeatTime: '',
    });
    expect(tone('Ready', 'True')).toBe('success');
    expect(tone('Ready', 'False')).toBe('danger');
    for (const type of ['MemoryPressure', 'DiskPressure', 'PIDPressure', 'NetworkUnavailable']) {
      expect(tone(type, 'False')).toBe('success');
      expect(tone(type, 'True')).toBe('danger');
      expect(tone(type, 'Unknown')).toBe('neutral');
    }
    expect(tone('NewCondition', 'True')).toBe('neutral');
  });
  it('prefers reported allocations, falls back only to matching annotations and keeps overcommit', () => {
    const node = toNodeDetail({
      metadata: { name: 'n', annotations: { 'node.kubesphere.io/cpu-requests': '2',
        'node.kubesphere.io/memory-requests': '1Gi' } },
      status: { allocated: { cpu: '0' }, allocatedLimits: { cpu: '12' } },
    });
    expect(allocationValue(node, 'requests', 'cpu')).toBe('0');
    expect(allocationValue(node, 'requests', 'memory')).toBe('1Gi');
    expect(allocationValue(node, 'limits', 'memory')).toBeUndefined();
    expect(allocationText('cpu', '12', '8')).toContain('150%');
    expect(allocationText('cpu', '0', '8')).toContain('0%');
    expect(allocationText('cpu', undefined, '8')).toBe('-');
    expect(allocationText('cpu', '2', '0')).not.toContain('%');
  });
  it('separates affinity, uses diagonal identity, naturally sorts and retains unknown connection codes', () => {
    const topology = topologyRows([
      { GPU10: 'NV18', GPU2: 'X', NIC0: 'FUTURE', 'CPU Affinity': '0-63', 'NUMA Affinity': '0' },
      { GPU10: 'X', GPU2: 'NV18', NIC0: 'SYS' },
      { GPU10: 'SYS', GPU2: 'SYS', NIC0: 'SYS' },
    ]);
    expect(topology.columns).toEqual(['GPU2', 'GPU10', 'NIC0']);
    expect(topology.rows.map((row) => row.device)).toEqual(['GPU2', 'GPU10', 'row-3']);
    expect(topology.rows[0]?.connections.NIC0).toBe('FUTURE');
    expect(topology.rows[0]?.affinity['CPU Affinity']).toBe('0-63');
    expect(topologyRows([])).toEqual({ columns: [], rows: [] });
  });
});

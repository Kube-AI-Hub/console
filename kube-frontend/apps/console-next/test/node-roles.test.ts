import { describe, expect, it } from 'vitest';
import { isControlPlane, roleLabel, roleLabels } from '../src/pages/cluster/nodeRoles';
import { zh } from '@kube-ai-hub/locales';

/**
 * Node roles are labels, and a node can hold several at once.
 *
 * The cluster this was written against has `storage` + `worker` on two nodes and
 * `control-plane` + `storage` + `worker` on a third, so "is it a control-plane node"
 * is not enough to describe one — the old console's yes/no collapsed `storage` into
 * "worker" and lost it.
 *
 * `t` is stubbed with the real catalogue rather than identity, so a key that does
 * not exist shows up as the key itself and fails the assertion.
 */
const t = (key: keyof typeof zh) => zh[key] ?? String(key);

describe('node roles', () => {
  it('translates the roles the catalogue knows', () => {
    expect(roleLabel('control-plane', t)).toBe('控制平面');
    expect(roleLabel('storage', t)).toBe('存储');
    expect(roleLabel('master', t)).toBe('控制平面');
    expect(roleLabel('edge', t)).toBe('边缘');
  });

  it('keeps a role the catalogue does not know', () => {
    // A cluster administrator can define their own role; showing the raw label beats
    // hiding a fact the node reports.
    expect(roleLabel('gpu-worker', t)).toBe('gpu-worker');
  });

  it('splits a multi-role node and translates each part', () => {
    expect(roleLabels('control-plane, storage', t)).toEqual(['控制平面', '存储']);
  });

  it('drops empty entries from a hand-edited label', () => {
    expect(roleLabels('storage,,', t)).toEqual(['存储']);
    expect(roleLabels('', t)).toEqual([]);
  });

  it('recognises both the current and the legacy control-plane name', () => {
    // `master` is the pre-1.20 label; clusters upgrading across that boundary keep it,
    // and the server's `role=master` filter accepts both for the same reason.
    expect(isControlPlane('control-plane, storage')).toBe(true);
    expect(isControlPlane('master')).toBe(true);
    expect(isControlPlane('storage, worker')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import type { NodeTaint } from '@kube-ai-hub/api-client';
import { commonTaints, distinctTaints, formatTaint, mergeTaints, taintId, taintsUnchanged, type TaintDraft } from '@/pages/cluster/nodeTaints';

/**
 * Bulk taint editing is a merge, and the merge is where it can go wrong silently.
 *
 * The cases below are the ones that produce a wrong cluster rather than an error:
 * a shared taint deleted from one node but not another, a node's own taint erased by
 * editing the shared block, and a "no change" that still bumps `resourceVersion`.
 */
const taint = (key: string, effect = 'NoSchedule', value = ''): NodeTaint => ({ key, value, effect });
const node = (name: string, taints: NodeTaint[]) => ({ name, taints });
const draft = (common: NodeTaint[], perNode: Record<string, NodeTaint[]> = {}): TaintDraft => ({ common, perNode });

describe('taint identity and formatting', () => {
  it('keys taints by key and effect, the way Kubernetes does', () => {
    expect(taintId(taint('dedicated', 'NoSchedule', 'a'))).toBe('dedicated:NoSchedule');
    // Same key, different effect: two taints, not one with a new value.
    expect(taintId(taint('dedicated', 'NoExecute', 'a'))).not.toBe(taintId(taint('dedicated', 'NoSchedule', 'a')));
  });

  it('prints key=value:effect and omits an empty value', () => {
    expect(formatTaint(taint('dedicated', 'NoSchedule', 'gpu'))).toBe('dedicated=gpu:NoSchedule');
    expect(formatTaint(taint('dedicated'))).toBe('dedicated:NoSchedule');
  });
});

describe('splitting shared from node-specific taints', () => {
  it('treats only taints present on every node as shared', () => {
    const shared = taint('shared');
    const nodes = [node('a', [shared, taint('only-a')]), node('b', [shared])];
    expect(commonTaints(nodes)).toEqual([shared]);
    expect(distinctTaints(nodes[0]!, commonTaints(nodes))).toEqual([taint('only-a')]);
    expect(distinctTaints(nodes[1]!, commonTaints(nodes))).toEqual([]);
  });

  it('compares effects, not just keys, when deciding what is shared', () => {
    const nodes = [node('a', [taint('dedicated', 'NoSchedule')]), node('b', [taint('dedicated', 'NoExecute')])];
    expect(commonTaints(nodes)).toEqual([]);
  });

  it('has no shared taints for a single node, so its own list is the shared block', () => {
    // With one node the split is meaningless; the dialog renders it as one list.
    const nodes = [node('a', [taint('x')])];
    expect(commonTaints(nodes)).toEqual([taint('x')]);
  });
});

describe('merging a draft back onto a node', () => {
  it('replaces the shared set and keeps the node-specific taints', () => {
    const old = taint('old');
    const nodes = [node('a', [old, taint('own')]), node('b', [old])];
    const result = mergeTaints(nodes[0]!, commonTaints(nodes), draft([taint('new')]));
    // `old` is gone because it was shared and the shared block no longer lists it;
    // `own` survives because it was never part of the shared block.
    expect(result).toEqual([taint('own'), taint('new')]);
  });

  it('lets a per-node edit delete a node-specific taint', () => {
    const nodes = [node('a', [taint('shared'), taint('own')]), node('b', [taint('shared')])];
    const result = mergeTaints(nodes[0]!, commonTaints(nodes), draft([taint('shared')], { a: [] }));
    expect(result).toEqual([taint('shared')]);
  });

  it('applies the shared block to every node, including one with no own taints', () => {
    const nodes = [node('a', []), node('b', [])];
    const shared = [taint('dedicated', 'NoSchedule', 'gpu')];
    expect(mergeTaints(nodes[1]!, [], draft(shared))).toEqual(shared);
  });

  it('does not write when nothing changed', () => {
    const nodes = [node('a', [taint('shared'), taint('own')]), node('b', [taint('shared')])];
    const old = commonTaints(nodes);
    const unchanged = draft(old, { a: [taint('own')], b: [] });
    expect(taintsUnchanged(nodes[0]!, old, unchanged)).toBe(true);
    expect(taintsUnchanged(nodes[1]!, old, unchanged)).toBe(true);
  });

  it('detects a change that only reorders nothing but adds one taint', () => {
    const nodes = [node('a', [taint('shared')])];
    expect(taintsUnchanged(nodes[0]!, [taint('shared')], draft([taint('shared'), taint('extra')]))).toBe(false);
  });
});

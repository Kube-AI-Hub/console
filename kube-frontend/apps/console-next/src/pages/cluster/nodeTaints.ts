import { parse } from 'yaml';
import type { NodeTaint } from '@kube-ai-hub/api-client';
import { toYaml } from '@/components/resource/yaml';

/**
 * Taint parsing and diffing, shared by the single-node dialog and the bulk editor.
 *
 * Kept out of the dialogs because the bulk path needs the same rules applied to
 * several nodes at once: one parser means "valid here" cannot disagree with "valid
 * on the detail page", and the merge below is the part worth reading on its own.
 */

export const TAINT_EFFECTS = ['NoSchedule', 'PreferNoSchedule', 'NoExecute'] as const;

export type TaintEffect = (typeof TAINT_EFFECTS)[number];

/** Identity of a taint: Kubernetes keys taints by `key` + `effect`, not by value. */
export function taintId(taint: Pick<NodeTaint, 'key' | 'effect'>): string {
  return `${taint.key}:${taint.effect}`;
}

/** `key=value:effect`, the form the list tooltip and `kubectl describe` print. */
export function formatTaint(taint: NodeTaint): string {
  return `${taint.key}${taint.value ? `=${taint.value}` : ''}:${taint.effect}`;
}

export function parseNodeTaints(text: string): NodeTaint[] {
  const entries: unknown = parse(text);
  if (!Array.isArray(entries)) throw new Error('Expected a YAML array of taints');
  const seen = new Set<string>();
  return entries.map((entry: unknown) => {
    const taint = entry as Record<string, unknown> | null;
    if (!taint || typeof taint.key !== 'string' || !taint.key.trim() ||
      typeof taint.effect !== 'string' || !(TAINT_EFFECTS as readonly string[]).includes(taint.effect) ||
      (taint.value !== undefined && typeof taint.value !== 'string')) throw new Error('Invalid taint key, value or effect');
    const id = taintId({ key: taint.key, effect: taint.effect });
    if (seen.has(id)) throw new Error('Duplicate taint key and effect');
    seen.add(id);
    return { key: taint.key, value: String(taint.value ?? ''), effect: taint.effect,
      ...(taint.timeAdded ? { timeAdded: String(taint.timeAdded) } : {}) };
  });
}

/** Serialise back to the YAML the form edits, so the two views round-trip. */
export function toTaintYaml(taints: NodeTaint[]): string {
  return toYaml(taints);
}

/**
 * Taints present on every selected node.
 *
 * The bulk editor shows these once, at the top, and each node's remaining taints
 * under its own heading — the same split the old console made. A taint that only
 * some nodes carry cannot be edited in the shared block: applying it there would
 * silently spread it to nodes that never had it.
 */
export function commonTaints(nodes: Array<{ taints: NodeTaint[] }>): NodeTaint[] {
  if (nodes.length === 0) return [];
  const [first, ...rest] = nodes;
  const others = rest.map((node) => new Set(node.taints.map(taintId)));
  return (first?.taints ?? []).filter((taint) => others.every((ids) => ids.has(taintId(taint))));
}

/** Taints a node carries that the shared block does not account for. */
export function distinctTaints(node: { taints: NodeTaint[] }, common: NodeTaint[]): NodeTaint[] {
  const shared = new Set(common.map(taintId));
  return node.taints.filter((taint) => !shared.has(taintId(taint)));
}

export interface TaintDraft {
  /** Edited shared block: replaces the old shared set on every selected node. */
  common: NodeTaint[];
  /** Per-node additions and removals, keyed by node name. */
  perNode: Record<string, NodeTaint[]>;
}

/**
 * Apply a draft to one node.
 *
 * The result is `(node's own taints − old shared set) + new shared set`, with the
 * per-node list taking precedence on `key`+`effect`. Order is stable — shared first,
 * then node-specific — so a node whose taints did not change produces an identical
 * array and the caller can skip the write instead of bumping `resourceVersion` for
 * nothing.
 */
export function mergeTaints(node: { name: string; taints: NodeTaint[] }, oldCommon: NodeTaint[], draft: TaintDraft): NodeTaint[] {
  const shared = new Set(oldCommon.map(taintId));
  const own = node.taints.filter((taint) => !shared.has(taintId(taint)));
  const merged = new Map<string, NodeTaint>();
  for (const taint of draft.perNode[node.name] ?? own) merged.set(taintId(taint), taint);
  for (const taint of draft.common) merged.set(taintId(taint), taint);
  return [...merged.values()];
}

/** Whether applying the draft would leave this node exactly as it is. */
export function taintsUnchanged(node: { name: string; taints: NodeTaint[] }, oldCommon: NodeTaint[], draft: TaintDraft): boolean {
  const next = mergeTaints(node, oldCommon, draft);
  const before = new Set(node.taints.map(taintId));
  return next.length === node.taints.length && next.every((taint) => before.has(taintId(taint)));
}

import type { LocaleKey } from '@kube-ai-hub/locales';

/**
 * How a node's role label reads.
 *
 * A node carries one label per role (`node-role.kubernetes.io/<role>`), and a node
 * can hold several at once — the cluster this was written against has nodes that are
 * `storage` *and* `worker`, and one that is `control-plane`, `storage` and `worker`.
 * `toNodeSummary` keeps all of them except `worker` in `NodeSummary.role`, because
 * "worker" is the default and printing it next to `control-plane` says nothing.
 *
 * The names need translating: the labels are English and the console is not. Roles
 * the catalogue does not know fall back to the label itself, which is better than
 * hiding a role the cluster administrator defined.
 */
const ROLE_LABEL_KEYS: Record<string, LocaleKey> = {
  'control-plane': 'node.role.controlPlane',
  master: 'node.role.master',
  storage: 'node.role.storage',
  edge: 'node.role.edge',
  infra: 'node.role.infra',
};

/** The localised label for one role, e.g. `storage` → 存储. */
export function roleLabel(role: string, t: (key: LocaleKey) => string): string {
  const key = ROLE_LABEL_KEYS[role.trim().toLowerCase()];
  return key ? t(key) : role;
}

/**
 * `NodeSummary.role` split into localised labels.
 *
 * Empty roles are dropped: `node-role.kubernetes.io/worker=` has an empty value and
 * the derivation already excludes it, but a hand-edited label can leave a trailing
 * comma that would otherwise render as an empty badge.
 */
export function roleLabels(role: string, t: (key: LocaleKey) => string): string[] {
  return role.split(',').map((entry) => entry.trim()).filter(Boolean).map((entry) => roleLabel(entry, t));
}

/**
 * Whether a node is a control-plane node.
 *
 * `master` is the pre-1.20 name for the same role, and clusters upgrading across
 * that boundary can still carry it. The server's `role=master` filter accepts both
 * for the same reason.
 */
export function isControlPlane(role: string): boolean {
  return role.split(',').map((entry) => entry.trim().toLowerCase())
    .some((entry) => entry === 'control-plane' || entry === 'master');
}

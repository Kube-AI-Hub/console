/**
 * 网络策略的规则投影（只读）.
 *
 * One module because two places answer the same question at different scopes: the
 * project's rule view (every policy, one row per rule) and a policy's own detail page
 * (this policy's rules). Two copies of "what does a peer look like" would drift, and the
 * reader would see `namespaceSelector: app=web` on one page and `app=web` on the other.
 *
 * The old console's allowlist abstraction merged several policies into two lossy columns;
 * these rows keep the policy name and the rule ordinal so a row always identifies the
 * object and rule it came from.
 */

/** The slice of a NetworkPolicy these rows read. */
export interface KubePolicy {
  metadata?: { name?: string };
  spec?: {
    podSelector?: unknown;
    policyTypes?: string[];
    ingress?: Array<{ from?: unknown[]; ports?: unknown[] }>;
    egress?: Array<{ to?: unknown[]; ports?: unknown[] }>;
  };
}

/** One rule, flattened for display. */
export interface RuleRow {
  key: string;
  policy: string;
  direction: 'Ingress' | 'Egress';
  /** The pods the policy applies to (`spec.podSelector`). */
  target: string;
  /** Allowed peers, joined; `*` when the rule allows everything. */
  peers: string;
  /** Allowed ports, e.g. `TCP/80, UDP/53`; `*` when every port is allowed. */
  ports: string;
}

const ALL = '*';

/** `{ matchLabels, matchExpressions }` in the form a reader can compare with labels. */
export function selectorText(selector: unknown): string {
  if (!selector || typeof selector !== 'object') return ALL;
  const record = selector as Record<string, unknown>;
  const parts: string[] = [];
  const labels = (record['matchLabels'] ?? {}) as Record<string, string>;
  for (const [key, value] of Object.entries(labels)) parts.push(key + '=' + value);
  const expressions = (record['matchExpressions'] ?? []) as Array<Record<string, unknown>>;
  for (const expression of expressions) {
    const key = String(expression['key'] ?? '');
    const operator = String(expression['operator'] ?? '');
    const values = ((expression['values'] ?? []) as unknown[]).map(String).join(', ');
    if (operator === 'In' || operator === 'NotIn') parts.push(key + ' ' + operator + ' (' + values + ')');
    else if (operator) parts.push(key + ' ' + operator);
  }
  return parts.length > 0 ? parts.join(', ') : ALL;
}

/** Kept out of JSX so the peer format has one definition. */
function tPeer(kind: string, value: string): string {
  return kind + ': ' + value;
}

/**
 * One peer as "namespaceSelector: … + podSelector: …" / "ipBlock: …".
 *
 * A peer may carry a namespace and a pod selector together; printing only one of them
 * would describe a wider permission than the object grants. An empty peer object matches
 * everything, which Kubernetes spells as `{}`.
 */
export function peerText(peer: unknown): string {
  if (!peer || typeof peer !== 'object') return ALL;
  const record = peer as Record<string, unknown>;
  const parts: string[] = [];
  if (record['namespaceSelector'] !== undefined) {
    parts.push(tPeer('namespaceSelector', selectorText(record['namespaceSelector'])));
  }
  if (record['podSelector'] !== undefined) {
    parts.push(tPeer('podSelector', selectorText(record['podSelector'])));
  }
  const ipBlock = record['ipBlock'] as Record<string, unknown> | undefined;
  if (ipBlock) {
    const cidr = String(ipBlock['cidr'] ?? '');
    const except = ((ipBlock['except'] ?? []) as unknown[]).map(String);
    parts.push(tPeer('ipBlock', cidr + (except.length > 0 ? ' except ' + except.join(', ') : '')));
  }
  return parts.length > 0 ? parts.join(' + ') : ALL;
}

export function peersText(peers: unknown[] | undefined): string {
  if (!peers || peers.length === 0) return ALL;
  return peers.map(peerText).join(' / ');
}

/**
 * One rule's ports: `TCP/80`, `TCP/8000-9000`, `TCP` (every port), or `*`.
 *
 * A missing `ports` list allows every port; a port entry without a number allows every
 * port of that protocol. Both are `*`-like and must not be printed as 0.
 */
export function portsText(ports: unknown[] | undefined): string {
  if (!ports || ports.length === 0) return ALL;
  return ports
    .map((entry) => {
      const port = (entry ?? {}) as Record<string, unknown>;
      const protocol = String(port['protocol'] ?? 'TCP');
      const number = port['port'] === undefined ? '' : String(port['port']);
      const endPort = port['endPort'] === undefined ? '' : '-' + String(port['endPort']);
      return number ? protocol + '/' + number + endPort : protocol;
    })
    .join(', ');
}

/** Every rule of every policy, sorted by policy name then rule order. */
export function toRuleRows(policies: KubePolicy[]): RuleRow[] {
  const rows: RuleRow[] = [];
  for (const policy of [...policies].sort((a, b) => String(a.metadata?.name ?? '').localeCompare(String(b.metadata?.name ?? '')))) {
    const name = String(policy.metadata?.name ?? '');
    const spec = policy.spec ?? {};
    const target = selectorText(spec.podSelector);
    let index = 0;
    for (const rule of spec.ingress ?? []) {
      rows.push({ key: name + '/' + index, policy: name, direction: 'Ingress', target, peers: peersText(rule?.from), ports: portsText(rule?.ports) });
      index += 1;
    }
    for (const rule of spec.egress ?? []) {
      rows.push({ key: name + '/' + index, policy: name, direction: 'Egress', target, peers: peersText(rule?.to), ports: portsText(rule?.ports) });
      index += 1;
    }
  }
  return rows;
}

/** One policy's rules, split by direction, keeping the rule order. */
export function policyRuleSections(policy: KubePolicy | undefined): { target: string; ingress: RuleRow[]; egress: RuleRow[] } {
  if (!policy) return { target: ALL, ingress: [], egress: [] };
  const rows = toRuleRows([policy]);
  return {
    target: selectorText(policy.spec?.podSelector),
    ingress: rows.filter((row) => row.direction === 'Ingress'),
    egress: rows.filter((row) => row.direction === 'Egress'),
  };
}

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AiSurface, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

/**
 * 网络隔离的规则视图（只读）.
 *
 * The policy table answers "which NetworkPolicy objects exist"; this panel answers
 * "what do they actually allow". Each spec.ingress / spec.egress entry becomes one
 * row — direction, the pods the policy applies to, the allowed peers and the ports —
 * so a reader does not have to mentally parse YAML to answer "is this traffic
 * allowed".
 *
 * This is deliberately not the old console's allowlist abstraction: that view merged
 * several policies into two lossy columns (project→project, CIDR+port), so a row no
 * longer identified the object and rule it came from. Here every row keeps its
 * policy name and ordinal and the table remains a projection of the objects.
 *
 * The panel reads the whole collection rather than the current list page: a rules
 * view that only showed the ten policies on page one would hide rules for the rest.
 */
export interface NetworkRulesPanelProps {
  workspace: string;
  cluster: string;
  namespace: string;
}

interface KubePolicy {
  metadata?: { name?: string };
  spec?: {
    podSelector?: unknown;
    policyTypes?: string[];
    ingress?: Array<{ from?: unknown[]; ports?: unknown[] }>;
    egress?: Array<{ to?: unknown[]; ports?: unknown[] }>;
  };
}

interface RuleRow {
  key: string;
  policy: string;
  direction: 'Ingress' | 'Egress';
  target: string;
  peers: string;
  ports: string;
}

const ALL = '*';

/** `{ matchLabels, matchExpressions }` in the form a reader can compare with labels. */
function selectorText(selector: unknown): string {
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

/**
 * One peer as "namespaceSelector: … + podSelector: …" / "ipBlock: …".
 *
 * A peer may carry a namespace and a pod selector together; printing only one of
 * them would describe a wider permission than the object grants. An empty peer
 * object matches everything, which Kubernetes spells as `{}`.
 */
function peerText(peer: unknown): string {
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

/** Kept out of JSX so the peer format has one definition. */
function tPeer(kind: string, value: string): string {
  return kind + ': ' + value;
}

function peersText(peers: unknown[] | undefined): string {
  if (!peers || peers.length === 0) return ALL;
  return peers.map(peerText).join(' / ');
}

/**
 * One rule's ports: `TCP/80`, `TCP/8000-9000`, `TCP` (every port), or `*`.
 *
 * A missing `ports` list allows every port; a port entry without a number allows
 * every port of that protocol. Both are `*`-like and must not be printed as 0.
 */
function portsText(ports: unknown[] | undefined): string {
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

function toRuleRows(policies: KubePolicy[]): RuleRow[] {
  const rows: RuleRow[] = [];
  for (const policy of [...policies].sort((a, b) => String(a.metadata?.name ?? '').localeCompare(String(b.metadata?.name ?? '')))) {
    const name = String(policy.metadata?.name ?? '');
    const spec = policy.spec ?? {};
    const target = selectorText(spec.podSelector);
    let index = 0;
    for (const rule of spec.ingress ?? []) {
      rows.push({
        key: name + '/' + index,
        policy: name,
        direction: 'Ingress',
        target,
        peers: peersText(rule?.from),
        ports: portsText(rule?.ports),
      });
      index += 1;
    }
    for (const rule of spec.egress ?? []) {
      rows.push({
        key: name + '/' + index,
        policy: name,
        direction: 'Egress',
        target,
        peers: peersText(rule?.to),
        ports: portsText(rule?.ports),
      });
      index += 1;
    }
  }
  return rows;
}

export function NetworkRulesPanel({ workspace, cluster, namespace }: NetworkRulesPanelProps): React.ReactElement {
  const t = useT();
  const query = useQuery({
    queryKey: ['networkpolicy-rules', cluster, namespace],
    enabled: Boolean(namespace),
    queryFn: async ({ signal }): Promise<KubePolicy[]> => {
      const body = await api.request<{ items?: KubePolicy[] }>(
        '/apis/networking.k8s.io/v1/namespaces/' + encodeURIComponent(namespace) + '/networkpolicies',
        { signal },
      );
      return body?.items ?? [];
    },
  });

  const policies = query.data ?? [];
  const rows = React.useMemo(() => toRuleRows(policies), [policies]);
  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  return (
    <AiSurface as="section" aiId="settings-network:rules" state={state} className="flex min-w-0 flex-col gap-2">
      <h2 className="text-sm font-medium text-ai-fg">{t('settings.network.ruleView')}</h2>
      {query.isPending ? <Skeleton className="h-24 w-full" /> : null}
      {query.isError ? (
        <ResourceErrorPanel
          error={query.error}
          onRetry={() => void query.refetch()}
          retryAiId="settings-network:rules:retry"
        />
      ) : null}
      {query.isSuccess && rows.length === 0 ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id="settings-network:rules:empty">
          {policies.length === 0 ? t('settings.network.ruleViewEmpty') : t('common.empty')}
        </p>
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-ai-md border border-ai-line">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-ai-fg-muted">
                <th className="px-3 pb-2 pt-2 font-medium">{t('settings.network.rules.policy')}</th>
                <th className="px-3 pb-2 pt-2 font-medium">{t('settings.network.direction')}</th>
                <th className="px-3 pb-2 pt-2 font-medium">{t('settings.network.ruleViewTarget')}</th>
                <th className="px-3 pb-2 pt-2 font-medium">{t('settings.network.ruleViewPeers')}</th>
                <th className="px-3 pb-2 pt-2 font-medium">{t('settings.network.ruleViewPorts')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className="border-t border-ai-line align-top"
                  data-ai-id={'settings-network:rule:' + row.key}
                  data-ai-row={row.key}
                >
                  <td className="px-3 py-1.5">
                    <a
                      href={
                        '/kube-frontend/' +
                        encodeURIComponent(workspace) +
                        '/clusters/' +
                        encodeURIComponent(cluster) +
                        '/projects/' +
                        encodeURIComponent(namespace) +
                        '/networkpolicies/' +
                        encodeURIComponent(row.policy)
                      }
                      className="inline-flex min-h-6 items-center font-mono text-[11px] text-ai-link hover:underline"
                    >
                      {row.policy}
                    </a>
                  </td>
                  <td className="px-3 py-1.5 text-ai-fg-secondary">
                    {row.direction === 'Ingress' ? t('settings.network.ingress') : t('settings.network.egress')}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-ai-fg-secondary">{row.target}</td>
                  <td className="px-3 py-1.5 text-ai-fg-secondary">{row.peers}</td>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-ai-fg-secondary">{row.ports}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </AiSurface>
  );
}

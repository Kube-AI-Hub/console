import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AiSurface, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { toRuleRows, type KubePolicy } from './networkPolicyRules';

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
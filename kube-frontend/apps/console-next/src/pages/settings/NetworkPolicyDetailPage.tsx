import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { networkPoliciesApi, type KubeObject, type NetworkPolicyDetail } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { YamlDialog } from '@/components/resource/YamlDialog';
import { toYaml } from '@/components/resource/yaml';
import { formatTimestamp } from '@/lib/time';

/**
 * 网络策略详情.
 *
 * The project console could create and delete a policy but not open one: a rule that
 * needed a change had no page to change it on, and the cluster-wide list only linked
 * back to the project's isolation page. This page closes that hole and is the
 * NetworkPolicy entry point for 编辑 YAML (the old console edits the policy's YAML from
 * its detail), while rule creation stays in the isolation page's dialog.
 *
 * The write is a whole-object PUT carrying `resourceVersion`; a policy the API server
 * refuses (a malformed peer, a group version that does not exist) keeps the dialog
 * open with the message.
 */
export interface NetworkPolicyDetailPageProps {
  workspace: string;
  cluster: string;
  namespace: string;
}

export function NetworkPolicyDetailPage({ workspace, cluster, namespace }: NetworkPolicyDetailPageProps): React.ReactElement {
  const t = useT();
  const { name } = useParams({ from: '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/networkpolicies/$name' });

  const queryClient = useQueryClient();
  const [editingYaml, setEditingYaml] = React.useState(false);

  const query = useQuery({
    queryKey: ['networkpolicy-detail', cluster, namespace, name],
    queryFn: ({ signal }) => networkPoliciesApi(apiClient).get({ cluster, namespace, name, signal }),
  });

  const update = useMutation({
    mutationFn: (body: KubeObject) => networkPoliciesApi(apiClient).update({ cluster, namespace, body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['networkpolicy-detail', cluster, namespace, name] });
      void queryClient.invalidateQueries({ queryKey: ['networkpolicies', cluster, namespace] });
    },
  });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const policy = query.data as NetworkPolicyDetail | undefined;

  return (
    <AiSurface as="section" aiId="networkpolicy-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Link
            to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/networkpolicies"
            params={{ workspace, cluster, namespace }}
            className="text-sm text-ai-link hover:underline"
            {...actionProps('networkpolicy-detail:back')}
          >
            ← {t('settings.network.title')}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-ai-fg">{policy?.alias || name}</h1>
          {policy ? (
            <span className="flex flex-wrap gap-1">
              {policy.policyTypes.map((type) => (
                <Badge key={type} tone="info">
                  {type}
                </Badge>
              ))}
            </span>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            {...actionProps('networkpolicy-detail:edit-yaml')}
            onClick={() => setEditingYaml(true)}
          >
            {t('resource.action.editYaml')}
          </Button>
        </div>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="networkpolicy-detail:retry" />
      ) : null}

      {policy ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="networkpolicy-detail:basic">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('resource.attributes')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow label={t('settings.network.podSelector')} value={policy.podSelector} />
              <DefinitionRow
                label={t('settings.network.types')}
                value={policy.policyTypes.length > 0 ? policy.policyTypes.join(', ') : '-'}
              />
              <DefinitionRow
                label={t('settings.network.rules')}
                value={t('settings.network.ruleCounts', { ingress: policy.ingressRules, egress: policy.egressRules })}
              />
              <DefinitionRow label={t('settings.column.createdAt')} value={formatTimestamp(policy.createdAt)} />
            </dl>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="networkpolicy-detail:metadata">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('resource.attributes')}</h2>
            <div className="flex flex-col gap-2 text-xs">
              <p className="text-ai-fg-secondary">{t('metadata.labels')}</p>
              {Object.keys(policy.labels).length === 0 ? (
                <p className="text-ai-fg-muted">{t('metadata.noLabels')}</p>
              ) : (
                <ul className="flex flex-wrap gap-1">
                  {Object.entries(policy.labels).map(([key, value]) => (
                    <li key={key} className="max-w-full truncate rounded-ai-md bg-ai-surface-2 px-2 py-0.5 text-[11px] text-ai-fg-secondary">
                      {key}={value}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-ai-fg-secondary">{t('metadata.annotations')}</p>
              {Object.keys(policy.annotations).length === 0 ? (
                <p className="text-ai-fg-muted">{t('metadata.noAnnotations')}</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {Object.entries(policy.annotations).map(([key, value]) => (
                    <li key={key} className="min-w-0 break-all text-[11px] text-ai-fg-secondary">
                      {key}={value}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </React.Fragment>
      ) : null}

      <MutationAlert error={update.error} />

      {policy ? (
        <YamlDialog
          open={editingYaml}
          onOpenChange={setEditingYaml}
          initialYaml={toYaml(policy.raw)}
          lockName={name}
          title={t('resource.action.editYaml')}
          submitLabel={t('common.confirm')}
          pending={update.isPending}
          onSubmit={async (object) => {
            await update.mutateAsync(object);
            setEditingYaml(false);
          }}
        />
      ) : null}
    </AiSurface>
  );
}

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { clusterLoggingApi } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';

/**
 * 集群日志收集.
 *
 * Whether logs reach storage is decided by four objects: the collector, its config, the inputs
 * that tail sources and the outputs that write records. This page reads them directly and shows
 * one line each — the old console's log-collection page is the same facts behind an editable
 * form, and editing pipelines from a console is not something this page pretends to do.
 */
export interface ClusterLogCollectionsPageProps {
  cluster: string;
}

export function ClusterLogCollectionsPage({ cluster }: ClusterLogCollectionsPageProps): React.ReactElement {
  const t = useT();
  const api = React.useMemo(() => clusterLoggingApi(apiClient), []);
  const collectors = useQuery({ queryKey: ['logging-collectors', cluster], queryFn: ({ signal }) => api.collectors({ signal }) });
  const inputs = useQuery({ queryKey: ['logging-inputs', cluster], queryFn: ({ signal }) => api.inputs({ signal }) });
  const outputs = useQuery({ queryKey: ['logging-outputs', cluster], queryFn: ({ signal }) => api.outputs({ signal }) });

  const namespace = collectors.data?.[0]?.namespace ?? '';
  const pods = useQuery({
    queryKey: ['logging-collector-pods', namespace],
    queryFn: ({ signal }) => api.podStats({ namespace, signal }),
    enabled: Boolean(namespace),
  });

  const state = collectors.isPending ? 'loading' : collectors.isError ? 'error' : 'ready';
  const podsLabel = pods.data ? `${pods.data.running}/${pods.data.total}` : '';

  return (
    <AiSurface as="section" aiId="cluster-log-collections:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{t('cluster.logCollections.title')}</h1>
        <p className="text-xs text-ai-fg-muted">{t('cluster.logCollections.description')}</p>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={collectors.error} onRetry={() => void collectors.refetch()} retryAiId="cluster-log-collections:retry" />
      ) : null}

      {state === 'ready' ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="cluster-log-collections:collectors">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('cluster.logCollections.collectors')}</h2>
            {collectors.data && collectors.data.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('cluster.logCollections.noCollectors')}</p>
            ) : null}
            <ul className="flex flex-col gap-3 text-sm" data-ai-id="cluster-log-collections:collector-list">
              {(collectors.data ?? []).map((collector) => (
                <li key={`${collector.namespace}/${collector.name}`} className="flex flex-col gap-2" data-ai-row={collector.name}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ai-fg">{collector.name}</span>
                    <Badge tone={pods.data && pods.data.total > 0 && pods.data.running === pods.data.total ? 'success' : 'warning'}>
                      {podsLabel ? `${t('cluster.logCollections.podsReady')} ${podsLabel}` : t('cluster.logCollections.unknownState')}
                    </Badge>
                  </div>
                  <dl className="grid grid-cols-1 gap-x-8 gap-y-1 text-xs sm:grid-cols-2">
                    <DefinitionRow label={t('cluster.logCollections.namespace')} value={collector.namespace} />
                    <DefinitionRow label={t('cluster.logCollections.config')} value={collector.configName || '-'} />
                    <DefinitionRow label={t('cluster.logCollections.image')} value={collector.image || '-'} />
                  </dl>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="cluster-log-collections:inputs">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('cluster.logCollections.inputs')}</h2>
            {inputs.data && inputs.data.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('cluster.logCollections.noInputs')}</p>
            ) : null}
            <ul className="flex flex-col divide-y divide-ai-line text-sm" data-ai-id="cluster-log-collections:input-list">
              {(inputs.data ?? []).map((input) => (
                <li key={input.name} className="flex items-center justify-between gap-3 py-2" data-ai-row={input.name}>
                  <span className="font-medium text-ai-fg">{input.name}</span>
                  <span className="text-xs text-ai-fg-muted">{[input.plugin, input.tag].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="cluster-log-collections:outputs">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('cluster.logCollections.outputs')}</h2>
            {outputs.data && outputs.data.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('cluster.logCollections.noOutputs')}</p>
            ) : null}
            <ul className="flex flex-col divide-y divide-ai-line text-sm" data-ai-id="cluster-log-collections:output-list">
              {(outputs.data ?? []).map((output) => (
                <li key={output.name} className="flex flex-col gap-1 py-2" data-ai-row={output.name}>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ai-fg">{output.name}</span>
                    {output.plugin ? <Badge tone="neutral">{output.plugin}</Badge> : null}
                  </span>
                  <span className="text-xs text-ai-fg-muted">
                    {[output.host, output.match && `match: ${output.match}`].filter(Boolean).join(' · ') || '-'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}
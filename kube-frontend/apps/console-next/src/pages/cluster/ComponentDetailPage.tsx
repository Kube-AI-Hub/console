import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { componentsApi, workloadsApi, type ComponentSummary, type WorkloadSummary } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { formatTimestamp } from '@/lib/time';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

export interface ComponentDetailPageProps {}

/**
 * 系统组件详情.
 *
 * The components endpoint is an aggregate (healthy/total backend counts), not an object, so
 * this page reads the same list the index page does and picks its row. The backend pods are
 * derived from the component's namespace by name prefix: labelling is not consistent across
 * KubeSphere modules (ks-console uses app=, minio uses release=), while every component's pods
 * do start with its own name.
 */
export function ComponentDetailPage(_props: ComponentDetailPageProps): React.ReactElement {
  const t = useT();
  const { cluster, name } = useParams({ from: '/kube-frontend/clusters/$cluster/components/$name' });

  const components = useQuery({
    queryKey: ['components', cluster],
    queryFn: ({ signal }) => componentsApi(apiClient).list({ cluster, signal }),
  });
  const component: ComponentSummary | undefined = (components.data?.items ?? []).find((row) => row.name === name);
  const namespace = component?.namespace ?? '';

  const pods = useQuery({
    queryKey: ['component-pods', cluster, namespace, name],
    enabled: namespace.length > 0,
    queryFn: ({ signal }) => workloadsApi(apiClient, 'pods').list({ cluster, namespace, page: 1, pageSize: 200, signal }),
  });
  const relatedPods = (pods.data?.items ?? []).filter((pod: WorkloadSummary) =>
    pod.name === name || pod.name.startsWith(`${name}-`));

  const state = components.isPending ? 'loading' : components.isError ? 'error' : component ? 'ready' : 'empty';

  return (
    <AiSurface as="section" aiId="component-detail" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link to="/kube-frontend/clusters/$cluster/components" params={{ cluster }} className="text-sm text-ai-accent hover:underline">
          ← {t('components.title')}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-ai-fg">{name}</h1>
          {component ? (
            <>
              <Badge tone={component.up ? 'success' : 'danger'}>
                {component.up ? t('component.detail.up') : t('component.detail.down')}
              </Badge>
              <Badge data-ai-id="component-detail:backends">
                {t('component.detail.backends')} {component.healthy}/{component.total}
              </Badge>
            </>
          ) : null}
        </div>
      </header>

      {components.isError ? (
        <ResourceErrorPanel error={components.error} retryAiId="component-detail:retry" onRetry={() => void components.refetch()} />
      ) : null}

      {components.isPending ? <Skeleton className="h-24 w-full" /> : null}

      {!components.isPending && !components.isError && !component ? (
        <p className="text-sm text-ai-fg-muted" data-ai-id="component-detail:not-found">
          {t('component.detail.notFound')}
        </p>
      ) : null}

      {component ? (
        <>
          <dl className="grid grid-cols-1 gap-3 rounded-ai-md border border-ai-line bg-ai-surface-1 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div data-ai-id="component-detail:namespace">
              <dt className="text-xs text-ai-fg-muted">{t('cluster.workloads.column.project')}</dt>
              <dd className="text-sm text-ai-fg">{component.namespace || '-'}</dd>
            </div>
            <div data-ai-id="component-detail:health">
              <dt className="text-xs text-ai-fg-muted">{t('component.detail.backends')}</dt>
              <dd className="text-sm text-ai-fg">{component.healthy}/{component.total}</dd>
            </div>
            <div data-ai-id="component-detail:started-at">
              <dt className="text-xs text-ai-fg-muted">{t('component.detail.startedAt')}</dt>
              <dd className="text-sm text-ai-fg">{component.startedAt ? formatTimestamp(component.startedAt) : '-'}</dd>
            </div>
          </dl>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-ai-fg">{t('component.detail.pods')}</h2>
            <p className="text-xs text-ai-fg-muted">{t('component.detail.podsHint')}</p>
            {pods.isError ? (
              <ResourceErrorPanel error={pods.error} retryAiId="component-detail:retry-pods" onRetry={() => void pods.refetch()} />
            ) : pods.isPending ? (
              <Skeleton className="h-16 w-full" />
            ) : relatedPods.length === 0 ? (
              <p className="text-sm text-ai-fg-muted" data-ai-id="component-detail:no-pods">
                {t('component.detail.noPods')}
              </p>
            ) : (
              <table className="w-full text-left text-sm" data-ai-id="component-detail:pods">
                <thead className="text-xs text-ai-fg-muted">
                  <tr>
                    <th className="py-1 pr-3 font-medium">{t('cluster.column.name')}</th>
                    <th className="py-1 pr-3 font-medium">{t('cluster.column.status')}</th>
                    <th className="py-1 font-medium">{t('cluster.column.node')}</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedPods.map((pod) => (
                    <tr key={`${pod.namespace}/${pod.name}`} data-ai-row={pod.name} className="border-t border-ai-line">
                      <td className="py-1.5 pr-3 font-medium text-ai-fg">{pod.name}</td>
                      <td className="py-1.5 pr-3"><Badge>{pod.status}</Badge></td>
                      <td className="py-1.5 text-ai-fg-muted">{pod.node || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : null}
    </AiSurface>
  );
}

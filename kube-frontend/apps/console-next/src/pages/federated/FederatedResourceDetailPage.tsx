import * as React from 'react';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Icon, Skeleton, Tabs, TabsContent } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { toYaml } from '@/components/resource/yaml';
import { formatTimestamp } from '@/lib/time';
import { pluralOf, useFederatedResource } from './queries';
import { FederatedEventsPanel } from './FederatedEventsPanel';

/**
 * 联邦资源详情.
 *
 * Two read-only questions about one federated object: what it spreads (its
 * `spec.template`, shown as YAML, plus the complete object for the fields the template
 * does not repeat) and where the control plane has got (the clusters and conditions it
 * reports). The 事件 tab is where the control plane explains why a condition is what it
 * is. Nothing here is editable: the federated console is the place to change them.
 *
 * The route carries the old console's shape
 * (`…/federatedprojects/<project>/deployments/<name>`), so the segment is the console
 * kind while the API needs the Federated collection.
 */
export interface FederatedResourceDetailPageProps {
  workspace: string;
  projectName: string;
  /** Console segment, e.g. `deployments`. */
  resource: string;
  object: string;
}

type Tab = 'definition' | 'events';

export function FederatedResourceDetailPage({
  workspace,
  projectName,
  resource,
  object,
}: FederatedResourceDetailPageProps): React.ReactElement {
  const t = useT();
  const plural = pluralOf(resource);
  const detail = useFederatedResource(projectName, plural, object);
  const [tab, setTab] = React.useState<Tab>('definition');
  const back =
    '/kube-frontend/workspaces/' +
    encodeURIComponent(workspace) +
    '/federatedprojects/' +
    encodeURIComponent(projectName);

  const state = !plural
    ? 'empty'
    : detail.isPending
      ? 'loading'
      : detail.isError
        ? 'error'
        : detail.data === null
          ? 'empty'
          : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="federated-resource:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={detail.error} onRetry={() => void detail.refetch()} retryAiId="federated-resource:retry" />
      </AiSurface>
    );
  }

  if (state === 'empty') {
    return (
      <AiSurface as="section" aiId="federated-resource:surface" state="empty" className="min-w-0">
        <div className="rounded-ai-md border border-ai-line bg-ai-surface-2 p-6" data-ai-id="federated-resource:not-found">
          <h2 className="text-sm font-medium text-ai-fg">
            {plural ? t('fedprojects.resource.notFound') : t('fedprojects.resource.unknownType')}
          </h2>
        </div>
      </AiSurface>
    );
  }

  const record = detail.data;
  const templateYaml = record && record.template !== undefined && record.template !== null ? toYaml(record.template) : '';
  const objectYaml = record ? toYaml(record.raw) : '';
  const noDistribution = record != null && record.clusters.length === 0 && record.conditions.length === 0;
  const tabs = [
    { value: 'definition', label: t('fedprojects.resource.tab.definition'), aiId: 'federated-resource:tab:definition:trigger' },
    { value: 'events', label: t('fedprojects.resource.tab.events'), aiId: 'federated-resource:tab:events:trigger' },
  ];

  return (
    <AiSurface as="section" aiId="federated-resource:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <div>
        <a
          href={back}
          className="inline-flex items-center gap-1 text-xs text-ai-link hover:underline"
          {...actionProps('federated-resource:back')}
        >
          <Icon name="chevron-left" size={12} />
          {t('fedprojects.resource.back')}
        </a>
      </div>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}

      {record ? (
        <React.Fragment>
          <header className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="truncate text-base font-semibold text-ai-fg" data-ai-id="federated-resource:title">
              {record.name || object}
            </h1>
            <Badge tone="info" data-ai-id="federated-resource:kind">
              {record.kind || t('fedprojects.detail.column.kind')}
            </Badge>
            <span className="text-xs text-ai-fg-muted">
              {t('fedprojects.field.namespace')}: {record.namespace || projectName}
            </span>
          </header>

          <Tabs value={tab} onValueChange={(next) => setTab(next as Tab)} items={tabs}>
            <TabsContent value="definition">
              <div data-ai-id="federated-resource:tab:definition" className="flex flex-col gap-4 pt-2">
                <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="federated-resource:template">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-medium text-ai-fg">{t('fedprojects.resource.template')}</h2>
                    <span className="text-[11px] text-ai-fg-muted">{t('fedprojects.resource.templateHint')}</span>
                  </div>
                  {templateYaml ? (
                    <pre className="max-h-[28rem] overflow-auto rounded-ai-sm bg-ai-surface-2 p-3 font-mono text-[11px] leading-relaxed text-ai-fg-secondary">
                      {templateYaml}
                    </pre>
                  ) : (
                    <p className="text-xs text-ai-fg-muted" data-ai-id="federated-resource:template:empty">
                      {t('fedprojects.resource.templateEmpty')}
                    </p>
                  )}
                </section>

                <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="federated-resource:object">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-medium text-ai-fg">{t('fedprojects.resource.object')}</h2>
                    <span className="text-[11px] text-ai-fg-muted">{t('fedprojects.resource.objectHint')}</span>
                  </div>
                  <pre
                    className="max-h-[28rem] overflow-auto rounded-ai-sm bg-ai-surface-2 p-3 font-mono text-[11px] leading-relaxed text-ai-fg-secondary"
                    data-ai-id="federated-resource:object:yaml"
                  >
                    {objectYaml}
                  </pre>
                </section>

                <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="federated-resource:distribution">
                  <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('fedprojects.resource.distribution')}</h2>

                  {noDistribution ? (
                    <p className="text-xs text-ai-fg-muted" data-ai-id="federated-resource:distribution:empty">
                      {t('fedprojects.resource.distributionEmpty')}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-ai-fg-muted">{t('fedprojects.resource.distributionClusters')}:</span>
                        {record.clusters.length === 0 ? (
                          <span className="text-ai-fg-muted">-</span>
                        ) : (
                          record.clusters.map((cluster) => (
                            <Badge key={cluster} tone="info">
                              {cluster}
                            </Badge>
                          ))
                        )}
                      </div>

                      {record.conditions.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="text-ai-fg-muted">
                                <th className="pb-2 pr-4 font-medium">{t('fedprojects.resource.column.condition')}</th>
                                <th className="pb-2 pr-4 font-medium">{t('cluster.column.status')}</th>
                                <th className="pb-2 pr-4 font-medium">{t('fedprojects.resource.column.reason')}</th>
                                <th className="pb-2 pr-4 font-medium">{t('fedprojects.resource.column.message')}</th>
                                <th className="pb-2 font-medium">{t('fedprojects.resource.column.lastTransition')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {record.conditions.map((condition) => (
                                <tr key={condition.type} className="border-t border-ai-line" data-ai-row={condition.type}>
                                  <td className="py-1.5 pr-4 font-medium text-ai-fg-secondary">{condition.type}</td>
                                  <td className="py-1.5 pr-4">{condition.status || '-'}</td>
                                  <td className="py-1.5 pr-4">{condition.reason || '-'}</td>
                                  <td className="py-1.5 pr-4">{condition.message || '-'}</td>
                                  <td className="py-1.5 tabular-nums text-ai-fg-muted">
                                    {condition.lastTransitionTime ? formatTimestamp(condition.lastTransitionTime) : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>
              </div>
            </TabsContent>

            <TabsContent value="events">
              <div data-ai-id="federated-resource:tab:events" className="pt-2">
                <FederatedEventsPanel
                  namespace={record.namespace || projectName}
                  name={record.name || object}
                  kind={record.kind}
                  enabled={tab === 'events'}
                  aiPrefix="federated-resource"
                />
              </div>
            </TabsContent>
          </Tabs>
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}

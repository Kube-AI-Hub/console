import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { accessReviewApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Icon, Notify, Skeleton, Tabs, TabsContent } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api } from '@/api';
import { ResourceErrorPanel, errorMessage } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow as Row } from '@/components/resource/DefinitionRow';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { formatTimestamp } from '@/lib/time';
import {
  useDeleteFederatedProjects,
  useFederatedClusters,
  useFederatedProject,
  useFederatedResourceTypes,
  useUpdateFederatedProjectInfo,
  useUpdateFederatedProjectPlacement,
  useWorkspaceAliases,
} from './queries';
import { FederatedResourceTable } from './FederatedResourceTable';
import { FederatedEventsPanel, FederatedKeyValuePanel } from './FederatedEventsPanel';
import { FederatedProjectPlacementDialog, type FederatedClusterOption } from './FederatedProjectDialogs';

/**
 * 联邦项目详情.
 *
 * Two kinds of question, split into tabs: 概览 answers "what is this project"
 * (namespace, workspace, placement, propagation and the conditions behind it), the
 * resource tabs answer "what has already been federated into it", and 元数据 / 事件
 * answer "what does the object carry" and "what is the control plane doing". The writes
 * the old console offered on the project — edit information, add a cluster, delete —
 * are here, on the object they act on.
 */
export interface FederatedProjectDetailPageProps {
  workspace: string;
  name: string;
}

type Tab = 'overview' | 'workloads' | 'config' | 'storage' | 'metadata' | 'events';

/**
 * The Federated types each resource tab lists.
 *
 * The subset of the API's 13 namespaced Federated types, grouped like the old console's
 * project sidebar. `federatednamespaces` is deliberately excluded: that object is the
 * project itself, not a resource inside it.
 */
const WORKLOAD_PLURALS = [
  'federatedapplications',
  'federateddeployments',
  'federatedstatefulsets',
  'federatedreplicasets',
  'federatedjobs',
  'federatedservices',
  'federatedingresses',
] as const;

const CONFIG_PLURALS = [
  'federatedconfigmaps',
  'federatedsecrets',
  'federatedserviceaccounts',
  'federatedlimitranges',
] as const;

const STORAGE_PLURALS = ['federatedpersistentvolumeclaims'] as const;

export function FederatedProjectDetailPage({ workspace, name }: FederatedProjectDetailPageProps): React.ReactElement {
  const t = useT();
  const navigate = useNavigate();
  const detail = useFederatedProject(workspace, name);
  const aliases = useWorkspaceAliases();
  const types = useFederatedResourceTypes();
  const clusters = useFederatedClusters();
  const [tab, setTab] = React.useState<Tab>('overview');
  const back = '/kube-frontend/workspaces/' + encodeURIComponent(workspace) + '/federatedprojects';

  const updateInfo = useUpdateFederatedProjectInfo(workspace);
  const updatePlacement = useUpdateFederatedProjectPlacement(workspace);
  const removeProjects = useDeleteFederatedProjects(workspace);
  const [editing, setEditing] = React.useState(false);
  const [placing, setPlacing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [denied, setDenied] = React.useState<string | null>(null);

  /** The create/edit/delete permission question, asked with the request's own scope. */
  const requirePermission = React.useCallback(
    async (verb: 'update' | 'delete'): Promise<boolean> => {
      try {
        const allowed = await accessReviewApi(api).allowed({
          verb,
          resource: verb === 'delete' ? 'namespaces' : 'federatednamespaces',
          ...(verb === 'delete' ? {} : { group: 'types.kubefed.io' }),
          namespace: name,
          ...(verb === 'update' ? { name } : {}),
        });
        if (allowed) return true;
      } catch {
        return true;
      }
      setDenied(t(verb === 'delete' ? 'fedprojects.permission.deleteDenied' : 'fedprojects.permission.updateDenied'));
      return false;
    },
    [name, t],
  );

  const state = detail.isPending ? 'loading' : detail.isError ? 'error' : detail.data === null ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="federated-project:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={detail.error} onRetry={() => void detail.refetch()} retryAiId="federated-project:retry" />
      </AiSurface>
    );
  }

  if (state === 'empty') {
    return (
      <AiSurface as="section" aiId="federated-project:surface" state="empty" className="min-w-0">
        <div className="rounded-ai-md border border-ai-line bg-ai-surface-2 p-6" data-ai-id="federated-project:not-found">
          <h2 className="text-sm font-medium text-ai-fg">{t('fedprojects.detail.notFound')}</h2>
        </div>
      </AiSurface>
    );
  }

  const project = detail.data;
  const workspaceLabel = aliases.data?.get(project?.workspace ?? '') ?? project?.workspace ?? '-';
  const tabs = [
    { value: 'overview', label: t('fedprojects.tab.overview'), aiId: 'federated-project:tab:overview:trigger' },
    { value: 'workloads', label: t('fedprojects.tab.workloads'), aiId: 'federated-project:tab:workloads:trigger' },
    { value: 'config', label: t('fedprojects.tab.config'), aiId: 'federated-project:tab:config:trigger' },
    { value: 'storage', label: t('fedprojects.tab.storage'), aiId: 'federated-project:tab:storage:trigger' },
    { value: 'metadata', label: t('fedprojects.tab.metadata'), aiId: 'federated-project:tab:metadata:trigger' },
    { value: 'events', label: t('fedprojects.tab.events'), aiId: 'federated-project:tab:events:trigger' },
  ];

  const clusterOptions: FederatedClusterOption[] = (clusters.data ?? []).map((cluster) => ({
    name: cluster.name,
    label: cluster.label,
    ready: cluster.ready,
    isHost: cluster.isHost,
  }));

  return (
    <AiSurface as="section" aiId="federated-project:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <div>
        <a
          href={back}
          className="inline-flex items-center gap-1 text-xs text-ai-accent hover:underline"
          {...actionProps('federated-project:back')}
        >
          <Icon name="chevron-left" size={12} />
          {t('fedprojects.detail.back')}
        </a>
      </div>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}

      {project ? (
        <React.Fragment>
          <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="truncate text-base font-semibold text-ai-fg" data-ai-id="federated-project:title">
                {project.alias || project.name}
              </h1>
              <p className="text-xs text-ai-fg-muted">
                {t('fedprojects.field.namespace')}: {project.namespace || '-'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                {...actionProps('federated-project:edit-info')}
                onClick={() => {
                  setDenied(null);
                  updateInfo.reset();
                  void requirePermission('update').then((allowed) => {
                    if (allowed) setEditing(true);
                  });
                }}
              >
                {t('resource.action.editInfo')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                {...actionProps('federated-project:edit-placement')}
                onClick={() => {
                  setDenied(null);
                  updatePlacement.reset();
                  void requirePermission('update').then((allowed) => {
                    if (allowed) setPlacing(true);
                  });
                }}
              >
                {t('fedprojects.action.editPlacement')}
              </Button>
              <Button
                size="sm"
                variant="danger"
                {...actionProps('federated-project:delete')}
                onClick={() => {
                  setDenied(null);
                  removeProjects.reset();
                  void requirePermission('delete').then((allowed) => {
                    if (allowed) setDeleting(true);
                  });
                }}
              >
                {t('common.delete')}
              </Button>
            </div>
          </header>

          {denied ? (
            <p role="alert" className="text-xs text-ai-danger" data-ai-id="federated-project:permission-denied">
              {denied}
            </p>
          ) : null}
          {updateInfo.error || updatePlacement.error ? (
            <p role="alert" className="text-xs text-ai-danger" data-ai-id="federated-project:mutation-error">
              {errorMessage(t, updateInfo.error ?? updatePlacement.error)}
            </p>
          ) : null}

          <Tabs value={tab} onValueChange={(next) => setTab(next as Tab)} items={tabs}>
            <TabsContent value="overview">
              <div data-ai-id="federated-project:tab:overview" className="flex flex-col gap-4 pt-2">
                <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="federated-project:basic">
                  <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('fedprojects.detail.basicInfo')}</h2>
                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
                    <Row label={t('workspace.field.name')} value={project.name} />
                    <Row label={t('workspace.field.alias')} value={project.alias || '-'} />
                    <Row label={t('common.description')} value={project.description || '-'} />
                    <Row label={t('fedprojects.field.namespace')} value={project.namespace || '-'} />
                    <Row label={t('fedprojects.field.workspace')} value={workspaceLabel} />
                    <Row
                      label={t('workspace.field.clusters')}
                      value={project.clusters.length === 0 ? '-' : project.clusters.join(', ')}
                    />
                    <Row
                      label={t('fedprojects.field.propagation')}
                      value={
                        project.propagated === undefined
                          ? '-'
                          : project.propagated
                            ? t('fedprojects.detail.propagated')
                            : t('fedprojects.detail.notPropagated')
                      }
                    />
                    <Row label={t('workspace.field.createdAt')} value={formatTimestamp(project.createdAt)} />
                    <Row label={t('workspace.field.creator')} value={project.creator || '-'} />
                  </dl>
                </section>

                <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="federated-project:conditions">
                  <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('fedprojects.detail.conditions')}</h2>
                  {project.conditions.length === 0 ? (
                    <p className="text-xs text-ai-fg-muted" data-ai-id="federated-project:conditions:empty">
                      {t('fedprojects.detail.conditionsEmpty')}
                    </p>
                  ) : (
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
                          {project.conditions.map((condition) => (
                            <tr key={condition.type} className="border-t border-ai-line" data-ai-row={condition.type}>
                              <td className="py-1.5 pr-4 font-medium text-ai-fg-secondary">{condition.type || '-'}</td>
                              <td className="py-1.5 pr-4">
                                <Badge tone={condition.status === 'True' ? 'success' : condition.status === 'False' ? 'danger' : 'neutral'} dot>
                                  {condition.status || '-'}
                                </Badge>
                              </td>
                              <td className="py-1.5 pr-4">{condition.reason || '-'}</td>
                              <td className="max-w-[24rem] whitespace-normal py-1.5 pr-4">{condition.message || '-'}</td>
                              <td className="py-1.5 tabular-nums text-ai-fg-muted">
                                {condition.lastTransitionTime ? formatTimestamp(condition.lastTransitionTime) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="federated-project:types">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-medium text-ai-fg">{t('fedprojects.detail.resourceTypes')}</h2>
                    <span className="text-[11px] text-ai-fg-muted">{t('fedprojects.detail.resourceTypesHint')}</span>
                  </div>

                  {types.isPending ? <Skeleton className="h-24 w-full" /> : null}

                  {types.isError ? (
                    <p className="flex flex-wrap items-center gap-2 text-xs text-ai-fg-muted" data-ai-id="federated-project:types:error">
                      {t('fedprojects.detail.resourceTypesUnavailable')}
                      <Button size="sm" variant="ghost" {...actionProps('federated-project:types:retry')} onClick={() => void types.refetch()}>
                        {t('common.retry')}
                      </Button>
                    </p>
                  ) : null}

                  {types.isSuccess && (types.data?.length ?? 0) === 0 ? (
                    <p className="text-xs text-ai-fg-muted" data-ai-id="federated-project:types:empty">
                      {t('fedprojects.detail.resourceTypesEmpty')}
                    </p>
                  ) : null}

                  {(types.data?.length ?? 0) > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-ai-fg-muted">
                            <th className="pb-2 pr-4 font-medium">{t('fedprojects.detail.column.kind')}</th>
                            <th className="pb-2 font-medium">{t('fedprojects.detail.column.resource')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(types.data ?? []).map((type) => (
                            <tr key={type.plural} className="border-t border-ai-line" data-ai-row={type.plural}>
                              <td className="py-1.5 pr-4 font-mono text-[11px] text-ai-fg-secondary">{type.kind}</td>
                              <td className="py-1.5 font-mono text-[11px] text-ai-fg-muted">{type.plural}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>
              </div>
            </TabsContent>

            <TabsContent value="workloads">
              <div data-ai-id="federated-project:tab:workloads" className="pt-2">
                <FederatedResourceTable
                  workspace={workspace}
                  projectName={project.name}
                  namespace={project.namespace}
                  plurals={WORKLOAD_PLURALS}
                  aiId="federated-project:resources:workloads"
                />
              </div>
            </TabsContent>

            <TabsContent value="config">
              <div data-ai-id="federated-project:tab:config" className="pt-2">
                <FederatedResourceTable
                  workspace={workspace}
                  projectName={project.name}
                  namespace={project.namespace}
                  plurals={CONFIG_PLURALS}
                  aiId="federated-project:resources:config"
                />
              </div>
            </TabsContent>

            <TabsContent value="storage">
              <div data-ai-id="federated-project:tab:storage" className="pt-2">
                <FederatedResourceTable
                  workspace={workspace}
                  projectName={project.name}
                  namespace={project.namespace}
                  plurals={STORAGE_PLURALS}
                  aiId="federated-project:resources:storage"
                />
              </div>
            </TabsContent>

            <TabsContent value="metadata">
              <div data-ai-id="federated-project:tab:metadata" className="flex flex-col gap-4 pt-2">
                <FederatedKeyValuePanel
                  title={t('fedprojects.metadata.labels')}
                  entries={project.labels}
                  emptyText={t('fedprojects.metadata.empty')}
                  aiId="federated-project:metadata:labels"
                />
                <FederatedKeyValuePanel
                  title={t('fedprojects.metadata.annotations')}
                  entries={project.annotations}
                  emptyText={t('fedprojects.metadata.empty')}
                  aiId="federated-project:metadata:annotations"
                />
                <FederatedKeyValuePanel
                  title={t('fedprojects.metadata.templateLabels')}
                  entries={project.templateLabels}
                  emptyText={t('fedprojects.metadata.empty')}
                  aiId="federated-project:metadata:template-labels"
                />
              </div>
            </TabsContent>

            <TabsContent value="events">
              <div data-ai-id="federated-project:tab:events" className="pt-2">
                <FederatedEventsPanel
                  namespace={project.namespace}
                  name={project.name}
                  kind="FederatedNamespace"
                  enabled={tab === 'events'}
                  aiPrefix="federated-project"
                />
              </div>
            </TabsContent>
          </Tabs>

          <EditInfoDialog
            open={editing}
            onOpenChange={(open) => {
              if (!open && !updateInfo.isPending) setEditing(false);
            }}
            resource="federated-project"
            name={project.name}
            alias={project.alias}
            description={project.description}
            annotations={project.annotations}
            pending={updateInfo.isPending}
            onSubmit={async (annotations) => {
              await updateInfo.mutateAsync({
                name: project.name,
                alias: annotations['kubesphere.io/alias-name'] ?? '',
                description: annotations['kubesphere.io/description'] ?? '',
              });
              setEditing(false);
              Notify.success({ content: t('common.saved') });
            }}
          />

          <FederatedProjectPlacementDialog
            open={placing}
            onOpenChange={(open) => {
              if (!open && !updatePlacement.isPending) setPlacing(false);
            }}
            name={project.name}
            clusters={clusterOptions}
            current={project.clusters}
            pending={updatePlacement.isPending}
            {...(updatePlacement.error ? { error: errorMessage(t, updatePlacement.error) } : {})}
            onSubmit={async (next) => {
              await updatePlacement.mutateAsync({ name: project.name, clusters: next });
              setPlacing(false);
              Notify.success({ content: t('fedprojects.placement.succeeded') });
            }}
          />

          <DeleteDialog
            open={deleting}
            onOpenChange={(open) => {
              if (!open && !removeProjects.isPending) setDeleting(false);
            }}
            names={[project.name]}
            resource="federated-project"
            noun={t('fedprojects.noun')}
            pending={removeProjects.isPending}
            {...(removeProjects.error ? { error: errorMessage(t, removeProjects.error) } : {})}
            onConfirm={async () => {
              try {
                const result = await removeProjects.mutateAsync([project.name]);
                if (result.failed.length === 0) {
                  setDeleting(false);
                  Notify.success({ content: t('fedprojects.delete.succeeded', { count: 1 }) });
                  void navigate({ href: back });
                }
              } catch {
                /* Error stays in the confirmation dialog. */
              }
            }}
          />
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}

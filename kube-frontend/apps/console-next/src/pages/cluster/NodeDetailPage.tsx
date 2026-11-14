import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { nodesApi, nodesWriteApi, type KubeObject, type NodeDetail } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Skeleton, Tabs, TabsContent } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { YamlDialog } from '@/components/resource/YamlDialog';
import { toYaml } from '@/components/resource/yaml';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';
import { formatQuantity } from '@/lib/quantity';
import { ExecConsoleDialog } from '@/components/resource/ExecConsoleDialog';
import { NodeMetadataDialog } from './NodeMetadataDialog';
import { NodeResourcesPanel } from './NodeResourcesPanel';
import { ClusterMonitorPage } from './ClusterMonitorPage';

/**
 * 节点详情.
 *
 * The list answers "which nodes are healthy"; this answers "what is this node" — its
 * conditions, what it can allocate, its labels and taints. Those are the four facts an
 * operator needs before cordoning or troubleshooting one, and none of them fit a row.
 *
 * Pods, monitoring and events use independent node-scoped queries, loaded only
 * when their tab opens. The terminal view is shared, but node access keeps its
 * own backend protocol and authorization.
 */
export interface NodeDetailPageProps {
  cluster: string;
}

export function NodeDetailPage({ cluster }: NodeDetailPageProps): React.ReactElement {
  const t = useT();
  const { name } = useParams({ from: '/kube-frontend/clusters/$cluster/nodes/$name' });

  const query = useQuery({
    queryKey: ['node-detail', cluster, name],
    queryFn: ({ signal }) => nodesApi(apiClient).get({ name, cluster, namespace: '', signal }),
  });

  const queryClient = useQueryClient();
  const [editingYaml, setEditingYaml] = React.useState(false);
  const [terminalOpen, setTerminalOpen] = React.useState(false);
  const [metadataKind, setMetadataKind] = React.useState<'labels' | 'taints' | null>(null);
  const [tab, setTab] = React.useState('status');
  React.useEffect(() => { setTerminalOpen(false); setMetadataKind(null); setTab('status'); }, [cluster, name]);
  const refreshNode = () => {
    void queryClient.invalidateQueries({ queryKey: ['node-detail', cluster, name] });
    void queryClient.invalidateQueries({ queryKey: ['cluster', 'nodes', cluster] });
  };
  const cordon = useMutation({
    mutationFn: (unschedulable: boolean) => nodesWriteApi(apiClient).setUnschedulable({ cluster, name, unschedulable }),
    onSuccess: refreshNode,
  });
  /**
   * 编辑 YAML. The node object is written with a whole-object PUT carrying its
   * `resourceVersion`, exactly like every other editor in the app. A node is owned by
   * kubelet and the cloud controller, so a concurrent update answers 409; the dialog
   * keeps the text and the page shows the error instead of pretending it saved.
   */
  const update = useMutation({
    mutationFn: (body: KubeObject) => nodesApi(apiClient).update({ cluster, namespace: '', body }),
    onSuccess: refreshNode,
  });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const node = query.data as NodeDetail | undefined;

  return (
    <AiSurface as="section" aiId="node-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Link to="/kube-frontend/clusters/$cluster/nodes" params={{ cluster }} className="text-sm text-ai-accent hover:underline">
            ← {t('cluster.nodes.title')}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-ai-fg">{name}</h1>
          {node ? (
            <Badge tone={node.status === 'Ready' ? 'success' : 'danger'}>{node.status}</Badge>
          ) : null}
          {node?.unschedulable ? <span className="text-xs text-ai-fg-muted">{t('node.status.cordoned')}</span> : null}
          <Button variant="primary" size="sm" className="ml-auto" disabled={node?.status !== 'Ready'}
            {...actionProps('node-detail:terminal-open')} onClick={() => setTerminalOpen(true)}>
            {t('container.terminal.open')}
          </Button>
          {node ? <Button variant="secondary" size="sm" disabled={cordon.isPending}
            {...actionProps('node-detail:cordon')} onClick={() => cordon.mutate(!node.unschedulable)}>
            {t(node.unschedulable ? 'node.action.uncordon' : 'node.action.cordon')}
          </Button> : null}
          <Button
            variant="secondary"
            size="sm"
            disabled={!node || query.isFetching}
            {...actionProps('node-detail:edit-yaml')}
            onClick={() => setEditingYaml(true)}
          >
            {t('resource.action.editYaml')}
          </Button>
          <Button variant="ghost" size="sm" disabled={query.isFetching} {...actionProps('node-detail:refresh')}
            onClick={() => void query.refetch()}>{t('common.refresh')}</Button>
        </div>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="node-detail:retry" />
      ) : null}

      {node ? (
        <Tabs value={tab} onValueChange={setTab} items={[
          { value: 'status', label: t('node.detail.statusTab'), aiId: 'node-detail:tab:status' },
          { value: 'pods', label: t('cluster.workloads.pods.title'), aiId: 'node-detail:tab:pods' },
          { value: 'monitor', label: t('node.detail.monitor'), aiId: 'node-detail:tab:monitor' },
          { value: 'events', label: t('node.detail.events'), aiId: 'node-detail:tab:events' },
        ]}>
        <TabsContent value="status" className="flex flex-col gap-4">
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="node-detail:basic">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('node.detail.basic')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow label={t('cluster.column.status')} value={node.status} />
              <DefinitionRow label={t('cluster.column.role')} value={node.role} />
              <DefinitionRow label={t('node.detail.kubeletVersion')} value={node.nodeInfo.kubeletVersion || '-'} />
              <DefinitionRow label={t('node.detail.internalIP')} value={node.internalIP || '-'} />
              <DefinitionRow label={t('node.detail.osImage')} value={node.nodeInfo.osImage || '-'} />
              <DefinitionRow label={t('node.detail.kernel')} value={node.nodeInfo.kernelVersion || '-'} />
              <DefinitionRow label={t('node.detail.runtime')} value={node.nodeInfo.containerRuntimeVersion || '-'} />
              <DefinitionRow label={t('node.detail.architecture')} value={node.nodeInfo.architecture || '-'} />
              <DefinitionRow label={t('node.detail.operatingSystem')} value={node.nodeInfo.operatingSystem || '-'} />
              <DefinitionRow label={t('node.detail.kubeProxyVersion')} value={node.nodeInfo.kubeProxyVersion || '-'} />
              <DefinitionRow label={t('node.detail.xpu')} value={node.xpu || '-'} />
              {node.gpuMode ? <DefinitionRow label={t('node.detail.gpuMode')} value={node.gpuMode} /> : null}
              {node.nodeInfo.gpuDriverVersion ? <DefinitionRow label={t('node.detail.gpuDriver')} value={node.nodeInfo.gpuDriverVersion} /> : null}
              {node.nodeInfo.gpuEngineVersion ? <DefinitionRow label={t('node.detail.gpuEngine')} value={node.nodeInfo.gpuEngineVersion} /> : null}
              <DefinitionRow label={t('node.detail.createdAt')} value={formatTimestamp(node.createdAt)} />
            </dl>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="node-detail:capacity">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('node.detail.capacity')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              {Array.from(new Set(['cpu', 'memory', 'pods', 'ephemeral-storage', ...Object.keys(node.capacity), ...Object.keys(node.allocatable)])).map((key) => (
                <DefinitionRow
                  key={key}
                  label={key}
                  value={`${formatQuantity(key, node.allocatable[key] ?? '')} / ${formatQuantity(key, node.capacity[key] ?? '')}`}
                />
              ))}
            </dl>
            <p className="mt-2 text-[11px] text-ai-fg-muted">{t('node.detail.capacityHint')}</p>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="node-detail:conditions">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('node.detail.conditions')}</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {node.conditions.map((condition) => (
                <li key={condition.type} className="flex flex-wrap items-baseline gap-2" data-ai-id={`node-detail:condition:${condition.type}`}>
                  <Badge tone={condition.status === 'True' ? 'success' : 'neutral'}>{condition.status}</Badge>
                  <span className="font-medium text-ai-fg">{condition.type}</span>
                  {condition.message ? <span className="text-xs text-ai-fg-muted">{condition.message}</span> : null}
                  {condition.lastTransitionTime ? (
                    <span className="text-[11px] text-ai-fg-faint">{formatTimestamp(condition.lastTransitionTime)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="node-detail:labels">
            <div className="mb-3 flex gap-2">
              <Button variant="secondary" size="sm" {...actionProps('node-detail:edit-labels')} onClick={() => setMetadataKind('labels')}>{t('node.action.labels')}</Button>
              <Button variant="secondary" size="sm" {...actionProps('node-detail:edit-taints')} onClick={() => setMetadataKind('taints')}>{t('node.action.taints')}</Button>
            </div>
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('node.detail.labels')}</h2>
            <ul className="flex flex-wrap gap-1">
              {Object.entries(node.labels).map(([key, value]) => (
                <li key={key} className="max-w-full truncate rounded-ai-md bg-ai-surface-2 px-2 py-0.5 text-[11px] text-ai-fg-secondary" title={`${key}=${value}`}>
                  {key}={value}
                </li>
              ))}
            </ul>
            <h2 className="mb-3 mt-4 text-sm font-medium text-ai-fg">{t('node.detail.taints')}</h2>
            {node.taints.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('node.detail.noTaints')}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {node.taints.map((taint) => (
                  <li key={`${taint.key}-${taint.effect}`} className="text-ai-fg-secondary">
                    {taint.key}{taint.value ? `=${taint.value}` : ''}:{taint.effect}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>
        <TabsContent value="pods">{tab === 'pods' ? <NodeResourcesPanel cluster={cluster} node={name} kind="pods" /> : null}</TabsContent>
        <TabsContent value="monitor">{tab === 'monitor' ? <ClusterMonitorPage cluster={cluster} node={name} /> : null}</TabsContent>
        <TabsContent value="events">{tab === 'events' ? <NodeResourcesPanel cluster={cluster} node={name} kind="events" /> : null}</TabsContent>
        </Tabs>
      ) : null}

      <MutationAlert error={update.error} />
      <MutationAlert error={cordon.error} />
      {node && metadataKind ? <NodeMetadataDialog cluster={cluster} node={node} kind={metadataKind}
        onClose={() => setMetadataKind(null)} onSaved={refreshNode} /> : null}
      {terminalOpen && node ? <ExecConsoleDialog target={{ cluster, node: name }} title={`${t('container.terminal.title')} · ${name}`}
        aiPrefix="node" onClose={() => setTerminalOpen(false)} /> : null}

      {node ? (
        <YamlDialog
          open={editingYaml}
          onOpenChange={setEditingYaml}
          initialYaml={toYaml(node.raw)}
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

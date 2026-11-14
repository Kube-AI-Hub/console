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
import { ExecConsoleDialog } from '@/components/resource/ExecConsoleDialog';
import { NodeMetadataDialog } from './NodeMetadataDialog';
import { NodeResourcesPanel } from './NodeResourcesPanel';
import { NodeInfoSidebar } from './NodeInfoSidebar';
import { NodeResourceOverview } from './NodeResourceOverview';
import { NodeHardwarePanel } from './NodeHardwarePanel';
import { NodeTrendPanel } from './NodeTrendPanel';
import { GpuModeDialog } from './GpuModeDialog';
import { hasPendingMode } from './nodeListQueries';

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
  /**
   * Present when another route renders this page (edge nodes share it). Without it the
   * name comes from the node route, which is the common case.
   */
  name?: string;
  /** Where the breadcrumb goes back to; defaults to the cluster node list. */
  backTo?: '/kube-frontend/clusters/$cluster/nodes' | '/kube-frontend/clusters/$cluster/edgenodes';
}

export function NodeDetailPage({ cluster, name: nameProp, backTo = '/kube-frontend/clusters/$cluster/nodes' }: NodeDetailPageProps): React.ReactElement {
  const t = useT();
  const params = useParams({ strict: false }) as { name?: string };
  const name = nameProp ?? params.name ?? '';

  const query = useQuery({
    queryKey: ['node-detail', cluster, name],
    queryFn: ({ signal }) => nodesApi(apiClient).get({ name, cluster, namespace: '', signal }),
    refetchInterval: (entry) => entry.state.data && hasPendingMode(entry.state.data) ? 3000 : false,
  });

  const queryClient = useQueryClient();
  const [editingYaml, setEditingYaml] = React.useState(false);
  const [terminalOpen, setTerminalOpen] = React.useState(false);
  const [metadataKind, setMetadataKind] = React.useState<'labels' | 'taints' | null>(null);
  const [tab, setTab] = React.useState('status');
  const [modeOpen, setModeOpen] = React.useState(false);
  React.useEffect(() => { setTerminalOpen(false); setMetadataKind(null); setTab('status'); setModeOpen(false); setEditingYaml(false); }, [cluster, name]);
  const refreshNode = () => {
    void queryClient.invalidateQueries({ queryKey: ['node-detail', cluster, name] });
    void queryClient.invalidateQueries({ queryKey: ['cluster', 'nodes', cluster] });
    for (const key of ['node-list', 'node-insights', 'node-cards', 'node-ports', 'node-trend', 'node-list-time']) {
      void queryClient.invalidateQueries({ queryKey: [key, cluster] });
    }
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
          <Link to={backTo} params={{ cluster }} className="text-sm text-ai-accent hover:underline">
            ← {t('cluster.nodes.title')}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-ai-fg">{name}</h1>
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
            onClick={refreshNode}>{t('common.refresh')}</Button>
        </div>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="node-detail:retry" />
      ) : null}

      {node ? (
        <div key={`${cluster}/${name}`} className="grid min-w-0 gap-5 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)]">
        <NodeInfoSidebar node={node} cluster={cluster} onMode={() => setModeOpen(true)} />
        <Tabs className="min-w-0" value={tab} onValueChange={setTab} items={[
          { value: 'status', label: t('node.detail.statusTab'), aiId: 'node-detail:tab:status' },
          { value: 'hardware', label: t('node.hardware.title'), aiId: 'node-detail:tab:hardware' },
          { value: 'pods', label: t('cluster.workloads.pods.title'), aiId: 'node-detail:tab:pods' },
          { value: 'monitor', label: t('node.detail.monitor'), aiId: 'node-detail:tab:monitor' },
          { value: 'events', label: t('node.detail.events'), aiId: 'node-detail:tab:events' },
          { value: 'metadata', label: t('node.detail.metadata'), aiId: 'node-detail:tab:metadata' },
        ]}>
        <TabsContent value="status" className="flex flex-col gap-4">
          <NodeResourceOverview node={node} cluster={cluster} />
        </TabsContent>
        <TabsContent value="metadata">
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
        <TabsContent value="hardware">{tab === 'hardware' ? <NodeHardwarePanel node={node} cluster={cluster} /> : null}</TabsContent>
        <TabsContent value="pods">{tab === 'pods' ? <NodeResourcesPanel cluster={cluster} node={name} kind="pods" /> : null}</TabsContent>
        <TabsContent value="monitor">{tab === 'monitor' ? <NodeTrendPanel cluster={cluster} node={name} gpu={Boolean(node.gpuVendor && node.gpuVendor.toLowerCase() !== 'cpu')} all /> : null}</TabsContent>
        <TabsContent value="events">{tab === 'events' ? <NodeResourcesPanel cluster={cluster} node={name} kind="events" /> : null}</TabsContent>
        </Tabs>
        </div>
      ) : null}

      <MutationAlert error={update.error} />
      <MutationAlert error={cordon.error} />
      {node && metadataKind ? <NodeMetadataDialog cluster={cluster} node={node} kind={metadataKind}
        onClose={() => setMetadataKind(null)} onSaved={refreshNode} /> : null}
      {modeOpen ? <GpuModeDialog cluster={cluster} name={name} onClose={() => setModeOpen(false)} onUpdated={refreshNode} /> : null}
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

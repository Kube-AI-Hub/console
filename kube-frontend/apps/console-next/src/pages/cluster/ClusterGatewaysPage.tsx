import * as React from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { accessReviewApi, projectGatewaysApi, type ClusterGateway, type GatewayServicePort } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, ResourceList, Tabs, type ListSchema } from '@kube-ai-hub/ui';
import { api } from '@/api';
import { useT } from '@/i18n';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { useClusterProjectIndex } from './useClusterProjectIndex';
import { GatewayEditDialog } from '@/pages/settings/GatewayEditDialog';

function formatNodePorts(ports: GatewayServicePort[]): string {
  const pinned = ports.filter((port) => port.nodePort !== undefined);
  if (pinned.length === 0) return '-';
  return pinned.map((port) => port.name.toUpperCase() + ': ' + port.nodePort).join('/ ');
}

/**
 * 网关设置（集群侧）.
 *
 * Two views over one collection. The cluster view is a read-only inventory of the
 * cluster gateway; the project view lists every project gateway with the facts the old
 * console showed — access type, IP, NodePorts, replicas, tracing — and the same
 * edit/delete actions the project's own gateway page offers, reusing its dialog.
 *
 * The Gateway CR does not carry the address or the NodePorts (the Helm release's
 * Service does), so the API layer joins them; a gateway whose Service is not readable
 * still appears with `-` instead of disappearing.
 */
export function ClusterGatewaysPage({ cluster, component = 'cluster' }: {
  cluster: string; component?: 'cluster' | 'project';
}): React.ReactElement {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceOf = useClusterProjectIndex(cluster);
  const [search, setSearch] = React.useState('');
  const [editing, setEditing] = React.useState<ClusterGateway | undefined>(undefined);
  const [deleting, setDeleting] = React.useState<ClusterGateway | undefined>(undefined);

  const query = useQuery({
    queryKey: ['cluster-gateways', cluster],
    queryFn: ({ signal }) => projectGatewaysApi(api).list({ cluster, signal }),
    refetchInterval: (state) => (state.state.data?.some((row) => !row.ready) ? 5000 : false),
  });

  const all = query.data ?? [];
  const rows = all.filter((row) => row.scope === component && row.name.includes(search.trim()));
  const projectRows = React.useMemo(() => rows.filter((row) => row.scope === 'project'), [rows]);

  /*
   * Per-row write permission. One SSAR per row/namespace is the only honest answer —
   * `update` is namespaced, and a cluster-wide answer would be a different question.
   * The checks fail open: only an explicit `allowed: false` hides the action.
   */
  const updateChecks = useQueries({
    queries: projectRows.map((row) => ({
      queryKey: ['gateway-row-update', cluster, row.namespace],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        accessReviewApi(api).allowed({
          verb: 'update' as const,
          resource: 'gateways',
          group: 'gateway.kubesphere.io',
          namespace: row.namespace,
          signal,
        }),
      staleTime: 60_000,
      retry: false,
    })),
  });
  const deleteChecks = useQueries({
    queries: projectRows.map((row) => ({
      queryKey: ['gateway-row-delete', cluster, row.namespace],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        accessReviewApi(api).allowed({
          verb: 'delete' as const,
          resource: 'gateways',
          group: 'gateway.kubesphere.io',
          namespace: row.namespace,
          signal,
        }),
      staleTime: 60_000,
      retry: false,
    })),
  });

  const deniedNamespaces = new Set<string>();
  projectRows.forEach((row, index) => {
    if (updateChecks[index]?.data === false || deleteChecks[index]?.data === false) deniedNamespaces.add(row.namespace);
  });
  const canUpdate = (row: ClusterGateway) => updateChecks[projectRows.findIndex((entry) => entry.namespace === row.namespace)]?.data !== false;
  const canDelete = (row: ClusterGateway) => deleteChecks[projectRows.findIndex((entry) => entry.namespace === row.namespace)]?.data !== false;

  const deleteMutation = useMutationLike(async (row: ClusterGateway) => {
    await projectGatewaysApi(api).remove({ cluster, namespace: row.namespace, name: row.name });
    await queryClient.invalidateQueries({ queryKey: ['cluster-gateways'] });
  });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length ? 'ready' : 'empty';

  const projectNameCell = (row: ClusterGateway) => (
    <a
      className="font-medium text-ai-accent hover:underline"
      href={
        '/kube-frontend/' +
        encodeURIComponent(workspaceOf.get(row.namespace) ?? 'public') +
        '/clusters/' +
        encodeURIComponent(cluster) +
        '/projects/' +
        encodeURIComponent(row.namespace) +
        '/gateways'
      }
      data-ai-id={'cluster-gateways:project-name:' + row.namespace + '/' + row.name}
    >
      {row.name}
    </a>
  );

  const clusterSchema: ListSchema<ClusterGateway> = {
    rowKey: (row) => row.namespace + '/' + row.name,
    rowAttributes: (row) => ({ 'data-ai-row': row.namespace + '/' + row.name }),
    search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'cluster-gateways:search' },
    refresh: { label: t('cluster.list.refresh'), aiId: 'cluster-gateways:refresh', busy: query.isFetching },
    columns: [
      {
        key: 'name',
        title: t('settings.gateway.name'),
        render: (row) => (
          <a
            className="font-medium text-ai-accent hover:underline"
            href={'/kube-frontend/clusters/' + encodeURIComponent(cluster) + '/gateways/' + encodeURIComponent(row.name)}
            data-ai-id={'cluster-gateways:name:' + row.name}
          >
            {row.name}
          </a>
        ),
      },
      { key: 'namespace', title: t('cluster.workloads.column.project'), render: (row) => row.namespace || '-' },
      { key: 'ready', title: t('cluster.column.status'), render: (row) => (
        <Badge tone={row.ready ? 'success' : 'warning'}>{t(row.ready ? 'settings.gateway.ready' : 'settings.gateway.pending')}</Badge>
      ) },
      { key: 'type', title: t('settings.gateway.type'), render: (row) => row.type || row.serviceType || '-' },
      { key: 'address', title: t('settings.gateway.address'), render: (row) => row.address || '-', hideBelow: 'lg' },
      { key: 'message', title: t('settings.gateway.message'), render: (row) => row.message || '-', wrap: true },
      { key: 'createdAt', title: t('cluster.column.createdAt'), render: (row) => formatTimestamp(row.createdAt), hideBelow: 'xl' },
    ],
    empty: { title: t('cluster.clusterGateways.empty'), description: t('cluster.clusterGateways.emptyHint') },
  };

  const projectSchema: ListSchema<ClusterGateway> = {
    rowKey: (row) => row.namespace + '/' + row.name,
    rowAttributes: (row) => ({ 'data-ai-row': row.namespace + '/' + row.name }),
    search: { placeholder: t('cluster.searchPlaceholder'), aiId: 'cluster-gateways:search' },
    refresh: { label: t('cluster.list.refresh'), aiId: 'cluster-gateways:refresh', busy: query.isFetching },
    columns: [
      { key: 'name', title: t('settings.gateway.name'), render: projectNameCell },
      {
        key: 'namespace',
        title: t('cluster.workloads.column.project'),
        render: (row) => (
          <a
            className="text-ai-accent hover:underline"
            href={
              '/kube-frontend/' +
              encodeURIComponent(workspaceOf.get(row.namespace) ?? 'public') +
              '/clusters/' +
              encodeURIComponent(cluster) +
              '/projects/' +
              encodeURIComponent(row.namespace) +
              '/gateways'
            }
          >
            {row.namespace}
          </a>
        ),
      },
      {
        key: 'type',
        title: t('settings.gateway.type'),
        render: (row) => (
          <span data-ai-id={'cluster-gateways:cell:type:' + row.namespace + '/' + row.name}>{row.type || row.serviceType || '-'}</span>
        ),
      },
      {
        key: 'address',
        title: t('cluster.clusterGateways.ip'),
        render: (row) => (
          <span data-ai-id={'cluster-gateways:cell:ip:' + row.namespace + '/' + row.name}>{row.address || '-'}</span>
        ),
        hideBelow: 'md',
      },
      {
        key: 'nodePorts',
        title: t('settings.gateway.nodePorts'),
        render: (row) => (
          <span data-ai-id={'cluster-gateways:cell:node-ports:' + row.namespace + '/' + row.name}>{formatNodePorts(row.ports)}</span>
        ),
        hideBelow: 'lg',
      },
      {
        key: 'replicas',
        title: t('settings.gateway.replicas'),
        render: (row) => (
          <span data-ai-id={'cluster-gateways:cell:replicas:' + row.namespace + '/' + row.name}>
            {row.replicas === undefined ? '-' : String(row.replicas)}
          </span>
        ),
      },
      {
        key: 'tracing',
        title: t('settings.gateway.tracing'),
        render: (row) => (
          <span data-ai-id={'cluster-gateways:cell:tracing:' + row.namespace + '/' + row.name}>
            {row.tracing ? t('settings.gateway.on') : t('settings.gateway.off')}
          </span>
        ),
      },
      { key: 'ready', title: t('cluster.column.status'), render: (row) => (
        <Badge tone={row.ready ? 'success' : 'warning'}>{t(row.ready ? 'settings.gateway.ready' : 'settings.gateway.pending')}</Badge>
      ) },
    ],
    rowActions: [
      {
        key: 'edit',
        label: t('settings.gateway.edit'),
        aiId: 'cluster-gateways:edit',
        visible: (row) => canUpdate(row),
      },
      {
        key: 'delete',
        label: t('settings.gateway.delete'),
        tone: 'danger' as const,
        aiId: 'cluster-gateways:delete',
        visible: (row) => canDelete(row),
      },
    ],
    empty: { title: t('cluster.clusterGateways.projectEmpty'), description: t('cluster.clusterGateways.projectEmptyHint') },
  };

  return (
    <AiSurface as="section" aiId="cluster-gateways:surface" state={state} aria-busy={query.isFetching} className="flex min-w-0 flex-col gap-4" data-ai-id="cluster-gateways:body">
      <header>
        <h1 className="text-lg font-semibold text-ai-fg">{t('cluster.clusterGateways.title')}</h1>
        <p className="mt-1 text-xs text-ai-fg-muted">{t('cluster.clusterGateways.description')}</p>
      </header>
      <Tabs value={component} items={[
        { value: 'cluster', label: t('cluster.clusterGateways.cluster'), aiId: 'cluster-gateways:tab:cluster' },
        { value: 'project', label: t('cluster.clusterGateways.project'), aiId: 'cluster-gateways:tab:project' },
      ]} onValueChange={(value) => {
        setSearch('');
        void navigate({ to: '/kube-frontend/clusters/$cluster/gateways/$name', params: { cluster, name: value } });
      }} />
      {component === 'project' && deniedNamespaces.size > 0 ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id="cluster-gateways:project-edit-denied">
          {t('cluster.clusterGateways.projectEditDenied')}
        </p>
      ) : null}
      <MutationAlert error={deleteMutation.error} />
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="cluster-gateways:retry" />
      ) : (
        <ResourceList
          schema={component === 'project' ? projectSchema : clusterSchema}
          rows={rows}
          loading={query.isPending}
          searchValue={search}
          onSearchChange={setSearch}
          onRefresh={() => void query.refetch()}
          onAction={(action, row) => {
            if (action === 'edit') setEditing(row);
            if (action === 'delete') setDeleting(row);
          }}
        />
      )}
      <GatewayEditDialog
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        cluster={cluster}
        namespace={editing?.namespace ?? ''}
        gateway={editing}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ['cluster-gateways'] });
          void queryClient.invalidateQueries({ queryKey: ['project-gateway'] });
        }}
      />
      {deleting ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDeleting(undefined)}
          names={[deleting.name]}
          resource="cluster-gateways:project"
          noun={t('settings.gateway.title')}
          pending={deleteMutation.pending}
          onConfirm={async () => {
            await deleteMutation.run(deleting);
            setDeleting(undefined);
          }}
        />
      ) : null}
    </AiSurface>
  );
}

/**
 * A tiny mutation wrapper so the delete confirmation can show progress without pulling
 * the page into a full useMutation ceremony for one call.
 */
function useMutationLike<TInput>(run: (input: TInput) => Promise<void>) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<unknown>(undefined);
  return {
    pending,
    error,
    async run(input: TInput) {
      setPending(true);
      setError(undefined);
      try {
        await run(input);
      } catch (caught) {
        setError(caught);
        throw caught;
      } finally {
        setPending(false);
      }
    },
  };
}

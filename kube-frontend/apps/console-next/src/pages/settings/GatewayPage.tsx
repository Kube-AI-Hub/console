import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accessReviewApi, projectGatewaysApi, type GatewayDetail, type GatewayServicePort } from '@kube-ai-hub/api-client';
import { AiButton, AiSurface, Badge, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow as Row } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';
import { GatewayEditDialog } from './GatewayEditDialog';

/**
 * 项目网关.
 *
 * Two states: the project has a gateway, or it does not. When it does not, the page
 * offers to create one (a NodePort gateway, which works on any cluster). When it does,
 * it reports what the controller achieved rather than what was requested: the
 * `Deployed` condition is the only thing that says the gateway is actually serving.
 *
 * The editable spec lives on the Gateway CR; the address and NodePorts live on the
 * Service the release creates (the CR has neither), so the details join both reads.
 * Edit/delete are permission-gated: a reader without `update` on gateways sees no edit
 * entry and a sentence saying why, instead of a dialog that can only 403.
 */
export interface GatewayPageProps {
  cluster: string;
  namespace: string;
}

/** NodePort display in the old console's shape: `HTTP: 3xxxx/HTTPS: 3xxxx`. */
function formatNodePorts(ports: GatewayServicePort[]): string {
  const pinned = ports.filter((port) => port.nodePort !== undefined);
  if (pinned.length === 0) return '-';
  return pinned.map((port) => port.name.toUpperCase() + ': ' + port.nodePort).join('/ ');
}

export function GatewayPage({ cluster, namespace }: GatewayPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  const gateway = useQuery({
    queryKey: ['project-gateway', cluster, namespace],
    queryFn: ({ signal }) => projectGatewaysApi(apiClient).get({ cluster, namespace, signal }),
    // The controller needs a moment to deploy; polling keeps the page honest without
    // making the reader reload it themselves.
    refetchInterval: (state) => (state.state.data?.exists && !state.state.data.ready ? 5000 : false),
  });

  /*
   * Same verb/resource/namespace the write will use. It fails **open**: only an explicit
   * `allowed: false` hides a control, so an older BFF or a network blip cannot take the
   * edit entry away from a permitted reader.
   */
  const canUpdate = useQuery({
    queryKey: ['gateway-can-update', cluster, namespace],
    queryFn: ({ signal }) =>
      accessReviewApi(apiClient).allowed({
        verb: 'update',
        resource: 'gateways',
        group: 'gateway.kubesphere.io',
        namespace,
        signal,
      }),
    staleTime: 60_000,
    retry: false,
  });
  const canDelete = useQuery({
    queryKey: ['gateway-can-delete', cluster, namespace],
    queryFn: ({ signal }) =>
      accessReviewApi(apiClient).allowed({
        verb: 'delete',
        resource: 'gateways',
        group: 'gateway.kubesphere.io',
        namespace,
        signal,
      }),
    staleTime: 60_000,
    retry: false,
  });
  const editable = canUpdate.data !== false;
  const deletable = canDelete.data !== false;

  const create = useMutation({
    mutationFn: () => projectGatewaysApi(apiClient).create({ cluster, namespace }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['project-gateway', cluster, namespace] }),
  });

  const remove = useMutation({
    mutationFn: (name: string) => projectGatewaysApi(apiClient).remove({ cluster, namespace, name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-gateway', cluster, namespace] });
      void queryClient.invalidateQueries({ queryKey: ['cluster-gateways'] });
    },
  });

  const state = gateway.isPending ? 'loading' : gateway.isError ? 'error' : 'ready';
  const data: GatewayDetail | undefined = gateway.data;

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="gateway:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={gateway.error} onRetry={() => void gateway.refetch()} retryAiId="gateway:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="gateway:surface" state={state} className="flex min-w-0 flex-col gap-4">
      {state === 'loading' ? <Skeleton className="h-32 w-full" /> : null}

      {data ? (
        data.exists ? (
          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="gateway:info">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-ai-fg">{t('settings.gateway.title')}</h2>
              <Badge tone={data.ready ? 'success' : 'warning'}>
                {data.ready ? t('settings.gateway.ready') : t('settings.gateway.pending')}
              </Badge>
            </div>
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
              <Row label={t('settings.gateway.name')} value={data.name} aiId="gateway:name" />
              <Row label={t('settings.gateway.type')} value={data.type || data.serviceType || '-'} aiId="gateway:type" />
              <Row label={t('settings.gateway.address')} value={data.address || '-'} aiId="gateway:address" />
              <Row label={t('settings.gateway.nodePorts')} value={formatNodePorts(data.ports)} aiId="gateway:node-ports" />
              <Row
                label={t('settings.gateway.replicas')}
                value={data.replicas === undefined ? '-' : String(data.replicas)}
                aiId="gateway:replicas"
              />
              <Row
                label={t('settings.gateway.tracing')}
                value={data.tracing ? t('settings.gateway.on') : t('settings.gateway.off')}
                aiId="gateway:tracing"
              />
              <Row label={t('settings.gateway.creator')} value={data.creator || '-'} aiId="gateway:creator" />
              <Row label={t('cluster.column.createdAt')} value={data.createdAt ? formatTimestamp(data.createdAt) : '-'} aiId="gateway:created-at" />
              {data.provider ? (
                <Row label={t('settings.gateway.provider')} value={data.provider} aiId="gateway:provider" />
              ) : null}
              <Row label={t('settings.gateway.message')} value={data.message || '-'} aiId="gateway:message" />
            </dl>
            {!editable ? (
              <p className="mt-3 text-xs text-ai-fg-muted" data-ai-id="gateway:edit-denied">
                {t('settings.gateway.editDenied')}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              {editable ? (
                <AiButton aiId="gateway:edit" size="sm" variant="secondary" onClick={() => setEditing(true)}>
                  {t('settings.gateway.edit')}
                </AiButton>
              ) : null}
              {deletable ? (
                <AiButton aiId="gateway:delete" size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
                  {t('settings.gateway.delete')}
                </AiButton>
              ) : null}
            </div>
          </section>
        ) : (
          // No gateway: the useful thing to show is how to get one, not an empty table.
          <section className="flex flex-col gap-3 rounded-ai-md border border-ai-line p-4" data-ai-id="gateway:empty">
            <h2 className="text-sm font-medium text-ai-fg">{t('settings.gateway.title')}</h2>
            <p className="text-xs text-ai-fg-muted">{t('settings.gateway.none')}</p>
            <div>
              <AiButton aiId="gateway:create" size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
                {t('settings.gateway.create')}
              </AiButton>
            </div>
          </section>
        )
      ) : null}

      <MutationAlert error={create.error ?? remove.error} />

      <GatewayEditDialog
        open={editing}
        onOpenChange={setEditing}
        cluster={cluster}
        namespace={namespace}
        gateway={data}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ['cluster-gateways'] });
        }}
      />

      {confirmDelete && data ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setConfirmDelete(false)}
          names={[data.name]}
          resource="gateway"
          noun={t('settings.gateway.title')}
          pending={remove.isPending}
          onConfirm={async () => {
            await remove.mutateAsync(data.name);
            setConfirmDelete(false);
          }}
        />
      ) : null}
    </AiSurface>
  );
}

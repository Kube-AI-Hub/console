import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectGatewayApi, type ProjectGateway } from '@kube-ai-hub/api-client';
import { AiButton, AiSurface, Badge, Skeleton } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

/**
 * 项目网关.
 *
 * Two states: the project has a gateway, or it does not. When it does not, the page
 * offers to create one — that is the whole interaction the old console offers here
 * (a NodePort gateway, which works on any cluster). When it does, it reports what the
 * controller achieved rather than what was requested: the `Deployed` condition is the
 * only thing that says the gateway is actually serving.
 */
export interface GatewayPageProps {
  cluster: string;
  namespace: string;
}

export function GatewayPage({ cluster, namespace }: GatewayPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const gateway = useQuery({
    queryKey: ['project-gateway', cluster, namespace],
    queryFn: ({ signal }) => projectGatewayApi(apiClient).get({ namespace, signal }),
    // The controller needs a moment to deploy; polling keeps the page honest without
    // making the reader reload it themselves.
    refetchInterval: (state) => (state.state.data?.exists && !state.state.data.ready ? 5000 : false),
  });

  const create = useMutation({
    mutationFn: () => projectGatewayApi(apiClient).create({ namespace }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['project-gateway', cluster, namespace] }),
  });

  const remove = useMutation({
    mutationFn: (name: string) => projectGatewayApi(apiClient).remove({ namespace, name }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['project-gateway', cluster, namespace] }),
  });

  const state = gateway.isPending ? 'loading' : gateway.isError ? 'error' : 'ready';
  const data: ProjectGateway | undefined = gateway.data;

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
              <Row label={t('settings.gateway.type')} value={data.type || '-'} />
              <Row label={t('settings.gateway.address')} value={data.address || '-'} />
              <Row label={t('settings.gateway.message')} value={data.message || '-'} />
            </dl>
            <div className="mt-4 flex justify-end">
              <AiButton aiId="gateway:delete" size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
                {t('settings.gateway.delete')}
              </AiButton>
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

function Row({ label, value, aiId }: { label: string; value: string; aiId?: string }): React.ReactElement {
  return (
    <>
      <dt className="text-ai-fg-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ai-fg-secondary" {...(aiId ? actionProps(aiId) : {})}>
        {value}
      </dd>
    </>
  );
}

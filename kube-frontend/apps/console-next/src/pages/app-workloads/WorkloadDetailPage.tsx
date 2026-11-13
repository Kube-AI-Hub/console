import * as React from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, AiSurface, Badge, Button, Icon, Skeleton } from '@kube-ai-hub/ui';
import type { WorkloadKind } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { useDeleteWorkload, useRestartWorkload, useScaleWorkload, useUpdateWorkload, useWorkload, useWorkloadAutoscaling, type WorkloadDescriptor } from './queries';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { ReplicasDialog } from './ReplicasDialog';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { LoadingDialog } from '@/components/resource/LoadingDialog';
import { ResourceErrorPanel, MutationAlert } from '@/components/resource/ResourceErrorPanel';
import { YamlDialog } from '@/components/resource/YamlDialog';
import { toYaml } from '@/components/resource/yaml';
import { formatTimestamp } from '@/lib/time';

/**
 * The detail view shared by every application workload.
 *
 * The old console's detail is attributes, a container list and the same operations
 * the row offers, so the shape is common to all eight kinds and only the labels
 * differ. `replicas`, `images` and the status badge come from the same derivation
 * the list uses — one source, so the two screens cannot disagree about whether a
 * deployment is running.
 *
 * Actions: 编辑 YAML (all kinds), 重新部署 (the three controllers that run pods
 * directly), 删除. 扩缩容 and 编辑信息 need a form surface the workload kinds do not
 * share, so they are listed as remaining work rather than half-built here.
 */
export interface WorkloadDetailPageProps {
  descriptor: WorkloadDescriptor;
  cluster: string;
  namespace: string;
  name: string;
}

type Dialog = 'none' | 'loading' | 'editYaml' | 'delete' | 'editInfo' | 'scale';

export function WorkloadDetailPage({ descriptor, cluster, namespace, name }: WorkloadDetailPageProps): React.ReactElement {
  const t = useT();
  const kind: WorkloadKind = descriptor.kind;
  const navigate = useNavigate();
  const query = useWorkload(kind, { cluster, namespace, name });
  const update = useUpdateWorkload(kind, { cluster, namespace });
  const remove = useDeleteWorkload(kind, { cluster, namespace });
  const restart = useRestartWorkload(kind, { cluster, namespace });
  const scale = useScaleWorkload(kind, { cluster, namespace });
  const autoscaling = useWorkloadAutoscaling(kind, { cluster, namespace, name });
  const [dialog, setDialog] = React.useState<Dialog>('none');

  const detail = query.data;
  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';

  const back = useBackTo(kind);

  const statusLabel = (status: string): string => {
    const key = descriptor.statusKeys[status];
    return key ? t(key) : status;
  };

  return (
    <AiSurface as="section" aiId={`${kind}-detail:surface`} state={state} className="flex min-w-0 flex-col gap-4">
      <div>
        <a
          href={back}
          className="inline-flex items-center gap-1 text-xs text-ai-accent hover:underline"
          {...actionProps(`${kind}-detail:back`)}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
            void navigate({ href: back });
          }}
        >
          <Icon name="chevron-left" size={12} />
          {t(descriptor.titleKey)}
        </a>
      </div>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}

      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId={`${kind}-detail:retry`} />
      ) : null}

      {detail ? (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold text-ai-fg">{detail.alias || detail.name}</h1>
                {descriptor.showStatus && detail.status ? (
                  <Badge tone={detail.status === 'running' ? 'success' : detail.status === 'updating' ? 'warning' : 'neutral'}>
                    {statusLabel(detail.status)}
                  </Badge>
                ) : null}
                {detail.federated ? <Badge tone="info">{t('resource.federated')}</Badge> : null}
              </div>
              {detail.alias ? <p className="text-xs text-ai-fg-muted">{detail.name}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Same operations the old console's detail offered, in its order. */}
              <AiButton aiId={`${kind}-detail:edit-info`} size="sm" variant="secondary" onClick={() => setDialog('editInfo')}>
                {t('resource.action.editInfo')}
              </AiButton>
              {descriptor.allowScale ? (
                <AiButton aiId={`${kind}-detail:scale`} size="sm" variant="secondary" onClick={() => setDialog('scale')}>
                  {t('workloads.action.scale')}
                </AiButton>
              ) : null}
              {descriptor.allowRedeploy ? (
                <AiButton
                  aiId={`${kind}-detail:redeploy`}
                  size="sm"
                  variant="secondary"
                  // Restarting is a write: the loading frame covers the request so
                  // the button never looks dead while the pod template is patched.
                  onClick={() => {
                    setDialog('loading');
                    restart.mutate(name, { onSettled: () => setDialog('none') });
                  }}
                >
                  {t('workloads.action.redeploy')}
                </AiButton>
              ) : null}
              <Button variant="ghost" size="sm" {...actionProps(`${kind}-detail:edit-yaml`)} onClick={() => setDialog('editYaml')}>
                {t('resource.action.editYaml')}
              </Button>
              {descriptor.allowDelete === false ? null : (
                <AiButton aiId={`${kind}-detail:delete`} size="sm" variant="danger" onClick={() => setDialog('delete')}>
                  {t('common.delete')}
                </AiButton>
              )}
            </div>
          </header>

          <section className="rounded-ai-md border border-ai-line p-4">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workloads.detail.attributes')}</h2>
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
              <Row label={t('workloads.field.cluster')} value={cluster} />
              <Row label={t('workloads.field.project')} value={detail.namespace || namespace} />
              <Row label={t('workloads.field.app')} value={detail.app || '-'} />
              {descriptor.showProgress ? (
                <Row
                  label={t('workloads.field.replicas')}
                  value={detail.total === undefined ? '-' : `${detail.ready ?? 0}/${detail.total}`}
                />
              ) : null}
              <Row label={t('workloads.field.createdAt')} value={formatTimestamp(detail.createdAt)} />
              <Row label={t('workloads.field.creator')} value={detail.creator || '-'} />
              {/*
               * Kind-specific rows, in the old console's order: a pod shows its node,
               * IPs, QoS and restarts; a service shows its type, addresses and
               * selector. Rendering them from a list keeps this page free of per-kind
               * branches.
               */}
              {detail.attributes.map((attribute) => (
                <Row
                  key={attribute.key}
                  label={t(`workloads.field.${attribute.key}` as never)}
                  value={attribute.value || '-'}
                />
              ))}
            </dl>
          </section>

          {/*
            * 自动伸缩: the old console shows this block only when an autoscaler exists,
            * because there is nothing to report otherwise. The same rule here — a
            * "no autoscaling" row would be noise on every workload.
            */}
          {autoscaling.data?.exists ? (
            <section className="rounded-ai-md border border-ai-line p-4" data-ai-id={`${kind}-detail:autoscaling`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-ai-fg">{t('workloads.detail.autoscaling')}</h2>
                <Badge tone={autoscaling.data.active ? 'success' : 'warning'}>
                  {autoscaling.data.active ? t('workloads.detail.autoscalingActive') : t('workloads.detail.autoscalingInactive')}
                </Badge>
              </div>
              <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
                <Row label={t('workloads.field.autoscalingName')} value={autoscaling.data.name} />
                <Row
                  label={t('workloads.field.replicas')}
                  value={`${autoscaling.data.minReplicas} – ${autoscaling.data.maxReplicas}`}
                />
                <Row label={t('workloads.field.currentReplicas')} value={String(autoscaling.data.currentReplicas)} />
                <Row
                  label={t('workloads.field.metrics')}
                  value={autoscaling.data.metrics.length === 0 ? '-' : autoscaling.data.metrics.join(', ')}
                />
              </dl>
            </section>
          ) : null}

          {/*
            * 端口: a service's ports answer "how does traffic reach it" — the service
            * port maps to a container port, and for NodePort/LoadBalancer there is a
            * node port as well. The old console shows the same three columns.
            */}
          {kind === 'services' && detail.ports.length > 0 ? (
            <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="services-detail:ports">
              <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workloads.detail.ports')}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-ai-fg-muted">
                      <th className="pb-2 pr-4 font-medium">{t('workloads.field.portName')}</th>
                      <th className="pb-2 pr-4 font-medium">{t('workloads.field.servicePort')}</th>
                      <th className="pb-2 pr-4 font-medium">{t('workloads.field.containerPort')}</th>
                      <th className="pb-2 font-medium">{t('workloads.field.nodePort')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.ports.map((port, index) => (
                      <tr key={`${port.name}-${index}`} className="border-t border-ai-line" data-ai-row={`port-${index}`}>
                        <td className="py-1.5 pr-4 font-mono text-[11px] text-ai-fg-secondary">{port.name || '-'}</td>
                        <td className="py-1.5 pr-4 tabular-nums text-ai-fg">{port.port}</td>
                        <td className="py-1.5 pr-4 tabular-nums text-ai-fg-secondary">{port.targetPort || '-'}</td>
                        <td className="py-1.5 tabular-nums text-ai-fg-secondary">{port.nodePort ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {detail.images.length > 0 ? (
            <section className="rounded-ai-md border border-ai-line p-4" data-ai-id={`${kind}-detail:containers`}>
              <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('workloads.detail.containers')}</h2>
              <ul className="flex flex-col gap-2">
                {detail.images.map((image) => (
                  <li
                    key={image}
                    className="overflow-x-auto whitespace-nowrap rounded-ai-sm border border-ai-line px-2 py-1.5 font-mono text-[11px] text-ai-fg-muted"
                    data-ai-row={image}
                  >
                    {image}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      <MutationAlert error={update.error ?? remove.error ?? restart.error ?? scale.error} />

      <LoadingDialog open={dialog === 'loading'} title={t('workloads.action.redeploy')} subject={name} />

      {dialog === 'editInfo' && detail ? (
        <EditInfoDialog
          open
          onOpenChange={(open) => !open && setDialog('none')}
          resource={`${kind}-detail`}
          name={detail.name}
          alias={detail.alias}
          description={detail.description}
          annotations={detail.annotations}
          pending={update.isPending}
          onSubmit={async (annotations) => {
            // `update()` derives the object name from `body.metadata.name`; a bare
            // annotation patch has no name and would be PUT to the collection URL.
            await update.mutateAsync({ ...detail.raw, metadata: { ...detail.raw.metadata, annotations } });
            setDialog('none');
          }}
        />
      ) : null}

      {dialog === 'scale' && detail ? (
        <ReplicasDialog
          open
          onOpenChange={(open) => !open && setDialog('none')}
          current={detail.total ?? 0}
          pending={scale.isPending}
          onSubmit={async (replicas) => {
            await scale.mutateAsync({ name: detail.name, replicas });
            setDialog('none');
          }}
        />
      ) : null}

      {dialog === 'editYaml' && detail ? (
        <YamlDialog
          open
          onOpenChange={(open) => !open && setDialog('none')}
          initialYaml={toYaml(detail.raw)}
          lockName={detail.name}
          title={t('resource.action.editYaml')}
          submitLabel={t('common.confirm')}
          pending={update.isPending}
          onSubmit={async (object) => {
            await update.mutateAsync(object as never);
            setDialog('none');
          }}
        />
      ) : null}

      {dialog === 'delete' ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDialog('none')}
          names={[name]}
          resource={kind}
          noun={t(descriptor.titleKey)}
          pending={remove.isPending}
          onConfirm={async () => {
            await remove.mutateAsync([name]);
            setDialog('none');
            void navigate({ href: back });
          }}
        />
      ) : null}
    </AiSurface>
  );
}

/** The list URL, derived from the current scope so a detail page can always go back. */
function useBackTo(kind: WorkloadKind): string {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const match = /^(\/kube-frontend\/[^/]+\/clusters\/[^/]+\/projects\/[^/]+)\//.exec(pathname);
  const root = match?.[1] ?? '/';
  return `${root}/${kind}`;
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <>
      <dt className="text-ai-fg-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ai-fg-secondary">{value}</dd>
    </>
  );
}

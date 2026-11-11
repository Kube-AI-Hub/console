import * as React from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ApiError, type ConfigMapDetail } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, AiSurface, Badge, Button, Icon, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { useConfigMap, useDeleteConfigMaps, usePatchConfigMap, useUpdateConfigMap } from '@/pages/configmaps/queries';
import { formatTimestamp } from '@/pages/configmaps/format';
import { toYaml } from '@/pages/configmaps/yaml';
import { ConfigMapDeleteDialog } from '@/pages/configmaps/ConfigMapDeleteDialog';
import { ConfigMapEditInfoDialog, ConfigMapEditSettingsDialog } from '@/pages/configmaps/ConfigMapEditDialogs';
import { DialogSuspense } from '@/components/resource/DialogSuspense';

const ConfigMapYamlDialog = React.lazy(() => import('@/pages/configmaps/ConfigMapYamlDialog'));

/**
 * `/kube-frontend/clusters/$cluster/configmaps/$name?namespace=<ns>`
 *
 * The cluster console's detail page.
 *
 * The namespace rides in the search string because a ConfigMap's name is only
 * unique within its project: the list can show two objects called `app-config` and
 * the URL has to say which. The old console solved the same problem by sending the
 * reader to the *project* console's detail page; that leaves them outside 集群管理
 * mid-task, so this page stays here and names the project in the query instead.
 * Recorded as DEC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DETAIL-01.
 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/configmaps/$name')({
  validateSearch: (search: Record<string, unknown>): { namespace?: string } =>
    typeof search['namespace'] === 'string' && search['namespace'] ? { namespace: search['namespace'] } : {},
  component: ClusterConfigMapDetailRoute,
});

type Dialog = 'none' | 'delete' | 'editInfo' | 'editSettings' | 'editYaml';

function ClusterConfigMapDetailRoute() {
  const t = useT();
  const navigate = useNavigate();
  const { cluster, name } = Route.useParams();
  const { namespace = '' } = Route.useSearch();
  const query = useConfigMap({ cluster, namespace, name });
  const [dialog, setDialog] = React.useState<Dialog>('none');

  const remove = useDeleteConfigMaps({ cluster, namespace });
  const update = useUpdateConfigMap({ cluster, namespace });
  const patch = usePatchConfigMap({ cluster, namespace, name });

  const detail = query.data;
  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const listRoute = '/kube-frontend/clusters/$cluster/configmaps';

  /** A federated object is read-only here; the list hides its actions for the same reason. */
  const federated = detail?.federated ?? false;

  return (
    <AiSurface as="section" aiId="cluster-configmap-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <div>
        <Link
          to={listRoute}
          params={{ cluster }}
          search={namespace ? { namespace } : {}}
          className="inline-flex items-center gap-1 text-xs text-ai-accent hover:underline"
          {...actionProps('cluster-configmap-detail:back')}
        >
          <Icon name="chevron-left" size={12} />
          {t('clusterConfigmaps.title')}
        </Link>
      </div>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}

      {state === 'error' ? (
        <p role="alert" className="text-xs text-ai-danger">
          {query.error instanceof ApiError
            ? query.error.isNotFound
              ? t('error.notFound')
              : query.error.message
            : t('error.unknown')}
        </p>
      ) : null}

      {detail ? (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold text-ai-fg">{detail.name}</h1>
                {detail.alias ? <Badge tone="neutral">{detail.alias}</Badge> : null}
                {detail.federated ? <Badge tone="info">{t('configmaps.federated')}</Badge> : null}
              </div>
              {detail.description ? <p className="text-xs text-ai-fg-muted">{detail.description}</p> : null}
            </div>
            {federated ? (
              // Explained rather than silently missing: an empty toolbar reads as a
              // broken page.
              <p className="text-xs text-ai-fg-muted">{t('clusterConfigmaps.federated.readOnly')}</p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <AiButton aiId="cluster-configmap-detail:edit-info" size="sm" variant="secondary" onClick={() => setDialog('editInfo')}>
                  {t('configmaps.action.editInfo')}
                </AiButton>
                <AiButton aiId="cluster-configmap-detail:edit-settings" size="sm" variant="secondary" onClick={() => setDialog('editSettings')}>
                  {t('configmaps.action.editSettings')}
                </AiButton>
                <Button variant="ghost" size="sm" {...actionProps('cluster-configmap-detail:edit-yaml')} onClick={() => setDialog('editYaml')}>
                  {t('configmaps.action.editYaml')}
                </Button>
                <AiButton aiId="cluster-configmap-detail:delete" size="sm" variant="danger" onClick={() => setDialog('delete')}>
                  {t('common.delete')}
                </AiButton>
              </div>
            )}
          </header>

          <section className="rounded-ai-md border border-ai-line p-4">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('configmaps.attributes')}</h2>
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
              <Row label={t('configmaps.field.cluster')} value={cluster} />
              <Row label={t('configmaps.field.project')} value={detail.namespace || namespace} />
              <Row label={t('configmaps.field.createdAt')} value={formatTimestamp(detail.createdAt)} />
              <Row label={t('configmaps.field.creator')} value={detail.creator || '-'} />
            </dl>
          </section>

          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="cluster-configmap-detail:data">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('configmaps.data')}</h2>
            {Object.keys(detail.data).length === 0 ? (
              <p className="text-xs text-ai-fg-faint">{t('configmaps.data.empty')}</p>
            ) : (
              <dl className="flex flex-col gap-3">
                {Object.entries(detail.data).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-1" data-ai-row={key}>
                    <dt className="w-fit rounded-ai-sm bg-ai-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ai-fg-secondary">{key}</dt>
                    <dd className="overflow-x-auto whitespace-pre-wrap break-words rounded-ai-sm border border-ai-line px-2 py-1.5 font-mono text-[11px] leading-5 text-ai-fg-muted">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          {remove.isError || update.isError || patch.isError ? (
            <p role="alert" className="text-xs text-ai-danger">
              {(() => {
                const error = remove.error ?? update.error ?? patch.error;
                return error instanceof ApiError ? error.message : t('error.unknown');
              })()}
            </p>
          ) : null}

          <ConfigMapEditInfoDialog
            open={dialog === 'editInfo'}
            onOpenChange={(open) => setDialog(open ? 'editInfo' : 'none')}
            detail={detail}
            pending={patch.isPending}
            onSubmit={async (annotations) => {
              await patch.mutateAsync({ metadata: { annotations } });
              setDialog('none');
            }}
          />
          <ConfigMapEditSettingsDialog
            open={dialog === 'editSettings'}
            onOpenChange={(open) => setDialog(open ? 'editSettings' : 'none')}
            detail={detail}
            pending={update.isPending}
            onSubmit={async (data) => {
              await update.mutateAsync({
                apiVersion: 'v1',
                kind: 'ConfigMap',
                metadata: { name, namespace: detail.namespace || namespace },
                data,
              });
              setDialog('none');
            }}
          />
          <DialogSuspense>
            {dialog === 'editYaml' ? (
              <ConfigMapYamlDialog
                open
                onOpenChange={(open) => setDialog(open ? 'editYaml' : 'none')}
                initialYaml={toYaml(detail.raw)}
                lockName={name}
                title={t('configmaps.edit.yamlTitle')}
                submitLabel={t('common.confirm')}
                pending={update.isPending}
                onSubmit={async (object) => {
                  await update.mutateAsync(object as never);
                  setDialog('none');
                }}
              />
            ) : null}
          </DialogSuspense>
          <ConfigMapDeleteDialog
            open={dialog === 'delete'}
            onOpenChange={(open) => setDialog(open ? 'delete' : 'none')}
            names={[name]}
            pending={remove.isPending}
            onConfirm={async () => {
              await remove.mutateAsync([name]);
              setDialog('none');
              // The object is gone; staying here would show a 404 on the next refetch.
              void navigate({ to: listRoute, params: { cluster }, search: namespace ? { namespace } : {} });
            }}
          />
        </>
      ) : null}
    </AiSurface>
  );
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <>
      <dt className="text-ai-fg-muted">{label}</dt>
      <dd className="min-w-0 break-all text-ai-fg">{value}</dd>
    </>
  );
}

export type { ConfigMapDetail };

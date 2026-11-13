import * as React from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, AiSurface, Badge, Button, Icon, Skeleton } from '@kube-ai-hub/ui';
import { ApiError } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { useConfigMap, useDeleteConfigMaps, usePatchConfigMap, useUpdateConfigMap } from '@/pages/configmaps/queries';
import { formatTimestamp } from '@/pages/configmaps/format';
import { ConfigMapDeleteDialog } from '@/pages/configmaps/ConfigMapDeleteDialog';
import { ConfigMapEditInfoDialog, ConfigMapEditSettingsDialog } from '@/pages/configmaps/ConfigMapEditDialogs';
import { ConfigMapYamlDialog, toYaml } from '@/pages/configmaps/ConfigMapYamlDialog';

/**
 * ConfigMap detail.
 *
 * Layout follows the old console: attributes on top, one `Data` section below, and
 * the same four operations the list offers. `labels` and `annotations` are not
 * shown because the old page does not show them either — they are only reachable
 * through YAML, which is what "edit YAML" is for.
 */
export const Route = createFileRoute(
  '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/configmaps/$name',
)({
  component: ConfigMapDetailRoute,
});

type Dialog = 'none' | 'delete' | 'editInfo' | 'editSettings' | 'editYaml';

function ConfigMapDetailRoute() {
  const t = useT();
  const navigate = useNavigate();
  const { cluster, namespace, name, workspace } = Route.useParams();
  const query = useConfigMap({ cluster, namespace, name });
  const [dialog, setDialog] = React.useState<Dialog>('none');

  const remove = useDeleteConfigMaps({ cluster, namespace });
  const update = useUpdateConfigMap({ cluster, namespace });
  const patch = usePatchConfigMap({ cluster, namespace, name });

  const detail = query.data;
  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const listRoute = '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/configmaps';
  const listParams = { workspace, cluster, namespace };

  return (
    <AiSurface as="section" aiId="configmap-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <div>
        <Link
          to={listRoute}
          params={listParams}
          className="inline-flex items-center gap-1 text-xs text-ai-accent hover:underline"
          {...actionProps('configmap-detail:back')}
        >
          <Icon name="chevron-left" size={12} />
          {t('configmaps.title')}
        </Link>
      </div>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}

      {state === 'error' ? (
        <p role="alert" className="text-xs text-ai-danger">
          {query.error instanceof ApiError ? query.error.message : t('error.unknown')}
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
            <div className="flex flex-wrap items-center gap-1.5">
              <AiButton aiId="configmap-detail:edit-info" size="sm" variant="secondary" onClick={() => setDialog('editInfo')}>
                {t('configmaps.action.editInfo')}
              </AiButton>
              <AiButton aiId="configmap-detail:edit-settings" size="sm" variant="secondary" onClick={() => setDialog('editSettings')}>
                {t('configmaps.action.editSettings')}
              </AiButton>
              <Button variant="ghost" size="sm" {...actionProps('configmap-detail:edit-yaml')} onClick={() => setDialog('editYaml')}>
                {t('configmaps.action.editYaml')}
              </Button>
              <AiButton aiId="configmap-detail:delete" size="sm" variant="danger" onClick={() => setDialog('delete')}>
                {t('common.delete')}
              </AiButton>
            </div>
          </header>

          <section className="rounded-ai-md border border-ai-line p-4">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('configmaps.attributes')}</h2>
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
              <Row label={t('configmaps.field.cluster')} value={cluster} />
              <Row label={t('configmaps.field.project')} value={namespace} />
              <Row label={t('configmaps.field.createdAt')} value={formatTimestamp(detail.createdAt)} />
              <Row label={t('configmaps.field.creator')} value={detail.creator || '-'} />
            </dl>
          </section>

          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="configmap-detail:data">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('configmaps.data')}</h2>
            {Object.keys(detail.data).length === 0 ? (
              <p className="text-xs text-ai-fg-faint">{t('configmaps.data.empty')}</p>
            ) : (
              <dl className="flex flex-col gap-3">
                {Object.entries(detail.data).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-1" data-ai-row={key}>
                    <dt className="w-fit rounded-ai-sm bg-ai-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ai-fg-secondary">
                      {key}
                    </dt>
                    {/* `pre` keeps the value's own line breaks; a ConfigMap value is often a file. */}
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
              await update.mutateAsync({ apiVersion: 'v1', kind: 'ConfigMap', metadata: { name, namespace }, data });
              setDialog('none');
            }}
          />
          <ConfigMapYamlDialog
            open={dialog === 'editYaml'}
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
          <ConfigMapDeleteDialog
            open={dialog === 'delete'}
            onOpenChange={(open) => setDialog(open ? 'delete' : 'none')}
            names={[name]}
            pending={remove.isPending}
            onConfirm={async () => {
              await remove.mutateAsync([name]);
              setDialog('none');
              // The object is gone; staying here would show a 404 on the next refetch.
              void navigate({ to: listRoute, params: listParams });
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


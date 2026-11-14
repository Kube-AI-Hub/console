import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { storageClassesApi, type KubeObject, type StorageClassDetail } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { YamlDialog } from '@/components/resource/YamlDialog';
import { toYaml } from '@/components/resource/yaml';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';

/**
 * 存储类型详情.
 *
 * The list answers "which classes exist and what creates volumes"; this answers "would a
 * claim on this class behave the way I expect" — binding mode, reclaim policy, whether
 * expansion and snapshots are allowed, and the driver's own parameters.
 *
 * Those parameters are driver-specific key/value pairs, so they are shown as such instead of
 * being squeezed into named columns that would only fit one CSI driver.
 */
export interface StorageClassDetailPageProps {}

export function StorageClassDetailPage(_props: StorageClassDetailPageProps): React.ReactElement {
  const t = useT();
  const { name, cluster } = useParams({ from: '/kube-frontend/clusters/$cluster/storageclasses/$name' });

  const query = useQuery({
    queryKey: ['storageclass-detail', name],
    queryFn: ({ signal }) => storageClassesApi(apiClient).get({ name, namespace: '', cluster: '', signal }),
  });

  const queryClient = useQueryClient();
  const [editingYaml, setEditingYaml] = React.useState(false);
  /**
   * 编辑 YAML. The old console edits a StorageClass through this dialog; the write is
   * a read-then-PUT to `storage.k8s.io/v1`, the group the object actually lives in.
   * A class that existing claims still reference cannot change every field (the
   * provisioner, for one), and the apiserver's rejection is shown in the dialog.
   */
  const update = useMutation({
    mutationFn: (body: KubeObject) => storageClassesApi(apiClient).update({ cluster, namespace: '', body }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['storageclass-detail', name] }),
  });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const sc = query.data as StorageClassDetail | undefined;

  return (
    <AiSurface as="section" aiId="sc-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link to="/kube-frontend/clusters/$cluster/storageclasses" params={{ cluster }} className="text-sm text-ai-accent hover:underline">
          ← {t('cluster.storageClasses.title')}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-ai-fg">{name}</h1>
          {sc?.isDefault ? <Badge tone="info">{t('cluster.storageClasses.default')}</Badge> : null}
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            {...actionProps('sc-detail:edit-yaml')}
            onClick={() => setEditingYaml(true)}
          >
            {t('resource.action.editYaml')}
          </Button>
        </div>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="sc-detail:retry" />
      ) : null}

      {sc ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="sc-detail:basic">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('platform.user.detail.basic')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow label={t('cluster.storageClasses.provisioner')} value={sc.provisioner || '-'} />
              <DefinitionRow label={t('pv.detail.reclaimPolicy')} value={sc.reclaimPolicy || '-'} />
              <DefinitionRow label={t('sc.detail.bindingMode')} value={sc.volumeBindingMode || '-'} />
              <DefinitionRow label={t('platform.column.createdAt')} value={formatTimestamp(sc.createdAt)} />
              <DefinitionRow label={t('sc.detail.allowExpansion')} value={sc.allowExpansion ? t('common.yes') : t('common.no')} />
              <DefinitionRow label={t('sc.detail.allowCloning')} value={sc.allowCloning ? t('common.yes') : t('common.no')} />
              <DefinitionRow label={t('sc.detail.allowSnapshot')} value={sc.allowSnapshot ? t('common.yes') : t('common.no')} />
              <DefinitionRow label={t('sc.detail.pvcCount')} value={String(sc.pvcCount ?? '-')} />
            </dl>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="sc-detail:parameters">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('sc.detail.parameters')}</h2>
            {sc.parameters.length === 0 ? (
              <p className="text-xs text-ai-fg-muted">{t('sc.detail.noParameters')}</p>
            ) : (
              <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2" data-ai-id="sc-detail:parameter-list">
                {sc.parameters.map((parameter) => (
                  <React.Fragment key={parameter.key}>
                    <dt className="text-ai-fg-muted">{parameter.key}</dt>
                    <dd className="min-w-0 break-all text-ai-fg-secondary">{parameter.value || '-'}</dd>
                  </React.Fragment>
                ))}
              </dl>
            )}
            {sc.allowedTopologies.length > 0 ? (
              <p className="mt-3 text-xs text-ai-fg-muted">
                {t('sc.detail.topologies')}: {sc.allowedTopologies.join('; ')}
              </p>
            ) : null}
          </section>
        </React.Fragment>
      ) : null}

      <MutationAlert error={update.error} />

      {sc ? (
        <YamlDialog
          open={editingYaml}
          onOpenChange={setEditingYaml}
          initialYaml={toYaml(sc.raw)}
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
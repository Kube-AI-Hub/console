import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { storageApi, storageClassesApi, type KubeObject, type StorageClassDetail, type StorageSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { YamlDialog } from '@/components/resource/YamlDialog';
import { toYaml } from '@/components/resource/yaml';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';
import { statusLabel } from '@/lib/status';
import { projectObjectUrl, useClusterProjectIndex } from './useClusterProjectIndex';

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

  /*
   * The claims bound to this class.
   *
   * One cluster-wide PVC read, filtered here: the resources proxy ignores a
   * fieldSelector (measured, see the migration plan §52), so asking it for
   * `storageClassName=…` would quietly return every claim. The project index is
   * the same one the cluster pages use, so each row can link into its project.
   */
  const claims = useQuery({
    queryKey: ['storageclass-claims', cluster],
    queryFn: ({ signal }) =>
      storageApi(apiClient, 'persistentvolumeclaims').list({ cluster, namespace: '', page: 1, pageSize: 500, signal }),
  });
  const workspaceOf = useClusterProjectIndex(cluster);
  const relatedClaims = React.useMemo<StorageSummary[]>(
    () => (claims.data?.items ?? []).filter((claim) => claim.storageClass === name),
    [claims.data, name],
  );

  return (
    <AiSurface as="section" aiId="sc-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link to="/kube-frontend/clusters/$cluster/storageclasses" params={{ cluster }} className="text-sm text-ai-link hover:underline">
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

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="sc-detail:pvcs">
            <h2 className="mb-3 flex items-baseline gap-2 text-sm font-medium text-ai-fg">
              {t('sc.detail.relatedClaims')}
              <span className="text-xs font-normal text-ai-fg-muted">{relatedClaims.length}</span>
            </h2>

            {claims.isPending ? <Skeleton className="h-16 w-full" /> : null}

            {!claims.isPending && claims.isError ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-xs text-ai-fg-muted">{t('sc.detail.relatedClaimsError')}</p>
                <Button variant="secondary" size="sm" data-ai-id="sc-detail:pvcs-retry" onClick={() => void claims.refetch()}>
                  {t('sc.detail.relatedClaimsRetry')}
                </Button>
              </div>
            ) : null}

            {!claims.isPending && !claims.isError && relatedClaims.length === 0 ? (
              <p className="text-xs text-ai-fg-muted" data-ai-id="sc-detail:pvcs-empty">
                {t('sc.detail.relatedClaimsEmpty')}
              </p>
            ) : null}

            {!claims.isPending && !claims.isError && relatedClaims.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-ai-line text-left text-ai-fg-muted">
                      <th className="py-2 pr-3 font-medium">{t('storage.column.name')}</th>
                      <th className="py-2 pr-3 font-medium">{t('sc.detail.relatedClaimsNamespace')}</th>
                      <th className="py-2 pr-3 font-medium">{t('storage.column.status')}</th>
                      <th className="py-2 font-medium">{t('storage.column.capacity')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatedClaims.map((claim) => {
                      const workspace = workspaceOf.get(claim.namespace) ?? 'public';
                      const handle = claim.namespace + '/' + claim.name;
                      return (
                        <tr
                          key={handle}
                          data-ai-row={handle}
                          data-ai-id={'sc-detail:pvc:' + handle}
                          className="border-b border-ai-line last:border-b-0"
                        >
                          <td className="py-2 pr-3">
                            <a
                              href={projectObjectUrl({
                                cluster,
                                workspace,
                                namespace: claim.namespace,
                                page: 'persistentvolumeclaims',
                                name: claim.name,
                              })}
                              className="font-medium text-ai-link hover:underline"
                              data-ai-id={'sc-detail:pvc:' + handle + ':open'}
                            >
                              {claim.name}
                            </a>
                          </td>
                          <td className="py-2 pr-3 text-ai-fg-secondary">{claim.namespace || '-'}</td>
                          <td className="py-2 pr-3">
                            <Badge tone={claim.status === 'Bound' ? 'success' : 'warning'}>
                              {claim.status ? statusLabel(t, claim.status) : '-'}
                            </Badge>
                          </td>
                          <td className="py-2 tabular-nums text-ai-fg-secondary">{claim.capacity || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
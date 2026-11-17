import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import {
  annotationKeys,
  storageApi,
  storageClassesApi,
  type KubeObject,
  type StorageClassDetail,
  type StorageSummary,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Modal, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage, MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
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
  const navigate = useNavigate();
  const [editingYaml, setEditingYaml] = React.useState(false);
  const [editingInfo, setEditingInfo] = React.useState(false);
  const [editingFeatures, setEditingFeatures] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  /*
   * Feature checkboxes live in local state while the dialog is open; the saved values are
   * the class itself. A failed save keeps the dialog and the chosen values, so the reader
   * does not have to re-tick the boxes.
   */
  const [features, setFeatures] = React.useState({ expansion: false, cloning: false, snapshot: false });
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
  const updateInfo = useMutation({
    mutationFn: (annotations: Record<string, string>) => storageClassesApi(apiClient).updateInfo({ cluster, name, annotations }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['storageclass-detail', name] }),
  });
  const setDefault = useMutation({
    mutationFn: () => storageClassesApi(apiClient).setDefault({ cluster, name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['storageclass-detail', name] });
      void queryClient.invalidateQueries({ queryKey: ['storageclasses', cluster] });
    },
  });
  const saveFeatures = useMutation({
    mutationFn: () =>
      storageClassesApi(apiClient).setFeatures({
        cluster,
        name,
        allowExpansion: features.expansion,
        allowCloning: features.cloning,
        allowSnapshot: features.snapshot,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['storageclass-detail', name] });
      setEditingFeatures(false);
    },
  });
  const remove = useMutation({
    mutationFn: () => storageClassesApi(apiClient).remove({ cluster, names: [name] }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['storageclasses', cluster] });
      void navigate({ to: '/kube-frontend/clusters/$cluster/storageclasses', params: { cluster } });
    },
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
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" {...actionProps('sc-detail:edit-info')} onClick={() => setEditingInfo(true)}>
              {t('resource.action.editInfo')}
            </Button>
            <Button variant="secondary" size="sm" {...actionProps('sc-detail:edit-yaml')} onClick={() => setEditingYaml(true)}>
              {t('resource.action.editYaml')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!sc || sc.isDefault}
              {...actionProps('sc-detail:set-default')}
              onClick={() => setDefault.mutate()}
            >
              {t('cluster.storageClasses.setDefault')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              {...actionProps('sc-detail:features')}
              onClick={() => {
                if (!sc) return;
                setFeatures({ expansion: sc.allowExpansion, cloning: sc.allowCloning, snapshot: sc.allowSnapshot });
                setEditingFeatures(true);
              }}
            >
              {t('sc.detail.volumeFeatures')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={claims.isPending || relatedClaims.length > 0}
              {...actionProps('sc-detail:delete')}
              onClick={() => setDeleting(true)}
            >
              {t('common.delete')}
            </Button>
          </div>
        </div>
        {sc && !sc.isDefault ? (
          <p className="text-[11px] text-ai-fg-muted" data-ai-id="sc-detail:set-default-hint">
            {t('cluster.storageClasses.setDefaultConfirm')}
          </p>
        ) : null}
        {!claims.isPending && (relatedClaims.length > 0 || claims.isError) ? (
          <p className="text-[11px] text-ai-fg-muted" data-ai-id="sc-detail:delete-protected">
            {claims.isError ? t('sc.detail.claimsUnavailableForDelete') : t('sc.detail.deleteInUse', { count: relatedClaims.length })}
          </p>
        ) : null}
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

      <MutationAlert error={update.error ?? updateInfo.error ?? setDefault.error ?? saveFeatures.error ?? remove.error} />

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

      {sc ? (
        <EditInfoDialog
          open={editingInfo}
          onOpenChange={setEditingInfo}
          resource="sc-detail"
          name={sc.name}
          alias={sc.annotations[annotationKeys.alias] ?? ''}
          description={sc.annotations[annotationKeys.description] ?? ''}
          annotations={sc.annotations}
          pending={updateInfo.isPending}
          onSubmit={async (annotations) => {
            await updateInfo.mutateAsync(annotations);
            setEditingInfo(false);
          }}
        />
      ) : null}

      {sc ? (
        <Modal
          open={editingFeatures}
          onOpenChange={setEditingFeatures}
          size="sm"
          title={t('sc.detail.volumeFeatures')}
          description={t('sc.detail.volumeFeaturesDescription')}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingFeatures(false)}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" loading={saveFeatures.isPending} {...actionProps('sc-detail:features-submit')} onClick={() => saveFeatures.mutate()}>
                {t('common.confirm')}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-2" data-ai-id="sc-detail:features-dialog">
            {[
              { key: 'expansion', label: t('cluster.storageClasses.expand'), value: features.expansion, set: (next: boolean) => setFeatures((current) => ({ ...current, expansion: next })) },
              { key: 'cloning', label: t('cluster.storageClasses.clone'), value: features.cloning, set: (next: boolean) => setFeatures((current) => ({ ...current, cloning: next })) },
              { key: 'snapshot', label: t('cluster.storageClasses.snapshot'), value: features.snapshot, set: (next: boolean) => setFeatures((current) => ({ ...current, snapshot: next })) },
            ].map((option) => (
              <label key={option.key} className="flex items-center gap-2 text-xs text-ai-fg-secondary">
                <input
                  type="checkbox"
                  checked={option.value}
                  data-ai-id={'sc-detail:feature:' + option.key}
                  onChange={(event) => option.set(event.target.checked)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </Modal>
      ) : null}

      {sc ? (
        <DeleteDialog
          open={deleting}
          onOpenChange={setDeleting}
          names={[name]}
          resource="sc-detail"
          noun={t('cluster.storageClasses.noun')}
          pending={remove.isPending}
          {...(remove.error ? { error: errorMessage(t, remove.error) } : {})}
          onConfirm={async () => {
            await remove.mutateAsync();
            setDeleting(false);
          }}
        />
      ) : null}
    </AiSurface>
  );
}
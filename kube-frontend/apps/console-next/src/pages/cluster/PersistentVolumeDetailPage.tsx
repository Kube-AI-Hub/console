import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import {
  annotationKeys,
  persistentVolumesApi,
  type KubeObject,
  type PersistentVolumeDetail,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage, MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { YamlDialog } from '@/components/resource/YamlDialog';
import { toYaml } from '@/components/resource/yaml';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatQuantity } from '@/lib/quantity';
import { formatTimestamp } from '@/lib/time';

/**
 * 持久卷详情.
 *
 * A persistent volume is the cluster's storage inventory: what it is, who holds it, and
 * what happens to its data when the claim goes away. Those three questions decide whether
 * deleting a claim is safe, and none of them fit the list row.
 *
 * Writes (edit info / edit YAML / delete) were re-included on 2026-11-17 (N-11). Delete is
 * constrained, not hidden: `Bound` / `Released` volumes cannot be removed here, and the
 * reason is visible beside the disabled button. Removing the console button never removed
 * the capability — it moved the操作 to kubectl, which has no status guard at all.
 */
export interface PersistentVolumeDetailPageProps {
  cluster: string;
}

const UNDELETABLE = new Set(['Bound', 'Released']);

export function PersistentVolumeDetailPage({ cluster }: PersistentVolumeDetailPageProps): React.ReactElement {
  const t = useT();
  const { name } = useParams({ from: '/kube-frontend/clusters/$cluster/persistentvolumes/$name' });
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ['persistent-volume-detail', name],
    queryFn: ({ signal }) => persistentVolumesApi(apiClient).get({ name, signal }),
  });

  const queryClient = useQueryClient();
  const [editingYaml, setEditingYaml] = React.useState(false);
  const [editingInfo, setEditingInfo] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const update = useMutation({
    mutationFn: (body: KubeObject) => persistentVolumesApi(apiClient).update({ name, body }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['persistent-volume-detail', name] }),
  });
  const updateInfo = useMutation({
    mutationFn: (annotations: Record<string, string>) => persistentVolumesApi(apiClient).updateInfo({ name, annotations }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['persistent-volume-detail', name] }),
  });
  const remove = useMutation({
    mutationFn: () => persistentVolumesApi(apiClient).remove({ names: [name] }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['persistentvolumes'] });
      void navigate({ to: '/kube-frontend/clusters/$cluster/persistentvolumes', params: { cluster } });
    },
  });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const volume = query.data as PersistentVolumeDetail | undefined;
  const [, claimName] = (volume?.claim ?? '').split('/');
  const protectedVolume = volume ? UNDELETABLE.has(volume.status) : false;

  return (
    <AiSurface as="section" aiId="pv-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-2">
        <Link to="/kube-frontend/clusters/$cluster/persistentvolumes" params={{ cluster }} className="text-sm text-ai-link hover:underline">
          ← {t('cluster.persistentVolumes.title')}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-ai-fg">{name}</h1>
          {volume ? <Badge tone={volume.status === 'Bound' ? 'success' : 'neutral'}>{volume.status}</Badge> : null}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm" {...actionProps('pv-detail:edit-info')} onClick={() => setEditingInfo(true)}>
              {t('resource.action.editInfo')}
            </Button>
            <Button variant="secondary" size="sm" {...actionProps('pv-detail:edit-yaml')} onClick={() => setEditingYaml(true)}>
              {t('resource.action.editYaml')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={protectedVolume}
              {...actionProps('pv-detail:delete')}
              onClick={() => setDeleting(true)}
            >
              {t('common.delete')}
            </Button>
          </div>
        </div>
        {protectedVolume ? (
          <p className="text-[11px] text-ai-fg-muted" data-ai-id="pv-detail:delete-protected">
            {t('cluster.persistentVolumes.deleteProtected')}
          </p>
        ) : null}
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="pv-detail:retry" />
      ) : null}

      {volume ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="pv-detail:basic">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('pv.detail.basic')}</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <DefinitionRow label={t('cluster.column.status')} value={volume.status || '-'} />
              <DefinitionRow label={t('pv.detail.capacity')} value={formatQuantity('memory', volume.capacity)} />
              <DefinitionRow label={t('pv.detail.accessModes')} value={volume.accessModes.join(', ') || '-'} />
              <DefinitionRow label={t('pv.detail.reclaimPolicy')} value={volume.reclaimPolicy || '-'} />
              <DefinitionRow label={t('pv.detail.storageClass')} value={volume.storageClass || '-'} />
              <DefinitionRow label={t('pv.detail.volumeMode')} value={volume.volumeMode || '-'} />
              <DefinitionRow label={t('pv.detail.mountOptions')} value={volume.mountOptions.join(', ') || '-'} />
              <DefinitionRow label={t('cluster.column.createdAt')} value={formatTimestamp(volume.createdAt)} />
            </dl>
            <p className="mt-2 text-[11px] text-ai-fg-muted">{t('pv.detail.reclaimHint')}</p>
          </section>

          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="pv-detail:claim">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('pv.detail.claim')}</h2>
            {claimName ? (
              <p className="text-sm text-ai-fg-secondary" data-ai-id="pv-detail:claim-value">
                {t('pv.detail.claimBoundTo')}{' '}
                {/* Shown as text, not a link: the volume is cluster-scoped and its URL has no
                    workspace, while a claim's page needs one. Guessing a workspace would be
                    right on this installation and wrong on the next. */}
                <span className="font-medium text-ai-fg">{volume.claim}</span>
              </p>
            ) : (
              <p className="text-sm text-ai-fg-muted">{t('pv.detail.unbound')}</p>
            )}
          </section>

          {Object.keys(volume.labels).length || Object.keys(volume.annotations).length ? (
            <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="pv-detail:metadata">
              <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('pv.detail.metadata')}</h2>
              <ul className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
                {Object.entries(volume.labels).map(([key, value]) => (
                  <li key={`label-${key}`}>label: {key}={value}</li>
                ))}
                {Object.entries(volume.annotations).map(([key, value]) => (
                  <li key={`annotation-${key}`}>annotation: {key}={value}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </React.Fragment>
      ) : null}

      <MutationAlert error={update.error ?? updateInfo.error ?? remove.error} />

      {volume ? (
        <YamlDialog
          open={editingYaml}
          onOpenChange={setEditingYaml}
          initialYaml={toYaml(volume.raw)}
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

      {volume ? (
        <EditInfoDialog
          open={editingInfo}
          onOpenChange={setEditingInfo}
          resource="pv-detail"
          name={volume.name}
          alias={volume.annotations[annotationKeys.alias] ?? ''}
          description={volume.annotations[annotationKeys.description] ?? ''}
          annotations={volume.annotations}
          pending={updateInfo.isPending}
          onSubmit={async (annotations) => {
            await updateInfo.mutateAsync(annotations);
            setEditingInfo(false);
          }}
        />
      ) : null}

      {volume ? (
        <DeleteDialog
          open={deleting}
          onOpenChange={setDeleting}
          names={[name]}
          resource="pv-detail"
          noun={t('cluster.persistentVolumes.noun')}
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

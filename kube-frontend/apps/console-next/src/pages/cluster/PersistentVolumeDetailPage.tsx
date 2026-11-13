import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { persistentVolumesApi, type PersistentVolumeDetail } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
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
 * Read-only on purpose: the old console's volume detail can edit and delete one, but a
 * volume is usually the only copy of its data and «reclaim policy: Delete» means the
 * cluster destroy it. Editing that from a console is an operation to design deliberately
 * rather than port in passing; the page says so instead of offering the buttons.
 */
export interface PersistentVolumeDetailPageProps {
  cluster: string;
}

export function PersistentVolumeDetailPage({ cluster }: PersistentVolumeDetailPageProps): React.ReactElement {
  const t = useT();
  const { name } = useParams({ from: '/kube-frontend/clusters/$cluster/persistentvolumes/$name' });

  const query = useQuery({
    queryKey: ['persistent-volume-detail', name],
    queryFn: ({ signal }) => persistentVolumesApi(apiClient).get({ name, signal }),
  });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const volume = query.data as PersistentVolumeDetail | undefined;
  const [, claimName] = (volume?.claim ?? '').split('/');

  return (
    <AiSurface as="section" aiId="pv-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link to="/kube-frontend/clusters/$cluster/persistentvolumes" params={{ cluster }} className="text-sm text-ai-accent hover:underline">
          ← {t('cluster.persistentVolumes.title')}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-ai-fg">{name}</h1>
          {volume ? <Badge tone={volume.status === 'Bound' ? 'success' : 'neutral'}>{volume.status}</Badge> : null}
        </div>
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
    </AiSurface>
  );
}
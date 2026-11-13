import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clusterApi, clusterWriteApi, type ClusterDetail } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, AiSurface, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';

/**
 * 集群设置.
 *
 * One editable field: the description. The old console's 集群设置 page also offers
 * group labels, region/zone and provider, but those are written by the installer — a
 * UI that lets an operator change them would let the console disagree with the thing
 * that actually configures the cluster, and the disagreement would only surface on the
 * next install.
 *
 * So the page shows the installer-owned fields as read-only, and says so, rather than
 * showing them as editable and failing on save.
 */
export interface ClusterSettingsPageProps {
  cluster: string;
}

export function ClusterSettingsPage({ cluster }: ClusterSettingsPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ['cluster-detail', cluster],
    queryFn: ({ signal }) => clusterApi(apiClient).get({ cluster, signal }),
  });

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [justSaved, setJustSaved] = React.useState(false);

  const save = useMutation({
    mutationFn: (description: string) => clusterWriteApi(apiClient).setDescription({ cluster, description }),
    onSuccess: async () => {
      setEditing(false);
      setJustSaved(true);
      // The overview renders the same annotation; invalidating only this page would
      // leave the two showing different descriptions until a manual reload.
      await queryClient.invalidateQueries({ queryKey: ['cluster-detail', cluster] });
    },
  });

  const state = detail.isPending ? 'loading' : detail.isError ? 'error' : 'ready';

  return (
    <AiSurface as="section" aiId="cluster-settings:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{t('cluster.settings.title')}</h1>
        <p className="text-sm text-ai-fg-muted">{t('cluster.settings.description')}</p>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={detail.error} onRetry={() => void detail.refetch()} retryAiId="cluster-settings:retry" />
      ) : null}

      {detail.data ? (
        <React.Fragment>
          <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="cluster-settings:description-panel">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-ai-fg">{t('cluster.settings.descriptionLabel')}</h2>
              {editing ? null : (
                <AiButton
                  aiId="cluster-settings:edit"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setDraft(detail.data.description);
                    setJustSaved(false);
                    setEditing(true);
                  }}
                >
                  {t('cluster.settings.edit')}
                </AiButton>
              )}
            </div>

            {editing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  aria-label={t('cluster.settings.descriptionLabel')}
                  className="min-h-24 w-full rounded-ai-md border border-ai-line bg-ai-bg p-2 text-sm text-ai-fg"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  {...actionProps('cluster-settings:description-input')}
                />
                <p className="text-xs text-ai-fg-muted">{t('cluster.settings.descriptionHint')}</p>
                {save.isError ? (
                  // A failure that leaves the textarea open with the user's text intact:
                  // closing on error would discard what they wrote.
                  <p className="text-xs text-ai-danger" role="alert">
                    {save.error instanceof Error ? save.error.message : t('error.unknown')}
                  </p>
                ) : null}
                <div className="flex items-center gap-2">
                  <AiButton
                    aiId="cluster-settings:save"
                    size="sm"
                    disabled={save.isPending}
                    onClick={() => save.mutate(draft)}
                  >
                    {t('cluster.settings.save')}
                  </AiButton>
                  <AiButton
                    aiId="cluster-settings:cancel"
                    size="sm"
                    variant="secondary"
                    disabled={save.isPending}
                    onClick={() => setEditing(false)}
                  >
                    {t('cluster.settings.cancel')}
                  </AiButton>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-ai-fg-secondary" {...actionProps('cluster-settings:description')}>
                  {detail.data.description || '-'}
                </p>
                {justSaved ? (
                  <p className="text-xs text-ai-success" data-ai-id="cluster-settings:saved">
                    {t('cluster.settings.saved')}
                  </p>
                ) : null}
              </div>
            )}
          </section>

          <ReadOnlyPanel detail={detail.data} />
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}

/** The installer-owned fields, shown so the page is a complete picture of the object. */
function ReadOnlyPanel({ detail }: { detail: ClusterDetail }): React.ReactElement {
  const t = useT();
  return (
    <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="cluster-settings:readonly">
      <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('cluster.settings.readonly')}</h2>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <DefinitionRow label={t('cluster.overview.provider')} value={detail.provider || '-'} aiId="cluster-settings:provider" />
        <DefinitionRow
          label={t('cluster.overview.kubernetesVersion')}
          value={detail.kubernetesVersion || '-'}
          aiId="cluster-settings:kubernetes-version"
        />
        <DefinitionRow
          label={t('cluster.overview.kubeSphereVersion')}
          value={detail.kubeSphereVersion || '-'}
          aiId="cluster-settings:kubesphere-version"
        />
        <DefinitionRow
          label={t('cluster.overview.connectionType')}
          value={detail.connectionType || '-'}
          aiId="cluster-settings:connection"
        />
        <DefinitionRow
          label={t('cluster.overview.apiEndpoint')}
          value={detail.kubernetesAPIEndpoint || '-'}
          aiId="cluster-settings:api-endpoint"
        />
        <DefinitionRow label={t('cluster.overview.nodeCount')} value={String(detail.nodeCount)} aiId="cluster-settings:node-count" />
      </dl>
    </section>
  );
}

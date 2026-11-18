import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clusterApi } from '@kube-ai-hub/api-client';
import { AiButton, AiSurface, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { ClusterEditDialog } from './ClusterEditDialog';
import { connectionLabelKey } from './connectionLabel';

/**
 * 集群设置.
 *
 * The installer-owned attributes are shown read-only; the four that a reader owns — alias,
 * tag, provider, description — are edited through the **same** dialog the cluster list
 * uses. This page had its own description-only form, which meant a cluster could show one
 * alias here and another in the list.
 *
 * Connection, modules and addresses are not editable at all: they are written by the
 * thing that installed the cluster, and a UI that changed them would disagree with it
 * until the next install.
 */
export interface ClusterSettingsPageProps {
  cluster: string;
}

export function ClusterSettingsPage({ cluster }: ClusterSettingsPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState(false);

  const detail = useQuery({
    queryKey: ['cluster-detail', cluster],
    queryFn: ({ signal }) => clusterApi(apiClient).get({ cluster, signal }),
  });

  const state = detail.isPending ? 'loading' : detail.isError ? 'error' : 'ready';
  const data = detail.data;

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

      {data ? (
        <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="cluster-settings:basic-info">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-ai-fg">{t('cluster.settings.baseInfo')}</h2>
            {/*
             * The same dialog the list's 编辑信息 opens. Two editors over one object is
             * how a page ends up showing an alias the other one cannot change — the
             * description-only form this replaces was exactly that.
             */}
            <AiButton
              aiId="cluster-settings:edit"
              size="sm"
              variant="secondary"
              onClick={() => setEditing(true)}
            >
              {t('resource.action.editInfo')}
            </AiButton>
          </div>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <DefinitionRow label={t('cluster.edit.name')} value={data.name} />
            <DefinitionRow label={t('cluster.edit.alias')} value={data.alias || '-'} />
            <DefinitionRow
              label={t('cluster.edit.group')}
              value={data.group ? t(`cluster.group.${data.group}` as 'cluster.group.production') : '-'}
            />
            <DefinitionRow label={t('cluster.edit.provider')} value={data.provider || '-'} />
          </dl>

          {/*
           * The installer-owned half, read-only.
           *
           * These are written by whatever installed the cluster (its connection type, its
           * addresses, its modules). Showing them here keeps one page that answers "what
           * is this cluster"; editing them would disagree with the installer until its
           * next run, so the controls are absent rather than failing on save.
           */}
          <dl
            className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 border-t border-ai-line pt-3 text-sm sm:grid-cols-2"
            data-ai-id="cluster-settings:readonly"
          >
            <DefinitionRow label={t('cluster.column.status')} value={data.ready ? t('cluster.list.ready') : t('cluster.list.notReady')} />
            <DefinitionRow label={t('cluster.edit.provider')} value={data.provider || '-'} />
            <DefinitionRow label={t('cluster.settings.kubernetesVersion')} value={data.kubernetesVersion || '-'} />
            <DefinitionRow label={t('cluster.settings.productVersion')} value={data.kubeSphereVersion || '-'} />
            <DefinitionRow label={t('cluster.settings.connectionType')} value={(() => { const label = connectionLabelKey(data.connectionType); return label ? t(label) : '-'; })()} />
            <DefinitionRow label={t('cluster.settings.apiEndpoint')} value={data.kubernetesAPIEndpoint || '-'} />
            <DefinitionRow label={t('cluster.settings.nodeCount')} value={String(data.nodeCount)} />
          </dl>

          <dl className="mt-3 grid grid-cols-1 gap-y-2 border-t border-ai-line pt-3 text-sm">
            <DefinitionRow
              label={t('cluster.edit.descriptionLabel')}
              value={data.description || '-'}
              aiId="cluster-settings:description"
            />
          </dl>

          <ClusterEditDialog
            open={editing}
            onOpenChange={setEditing}
            cluster={{
              name: data.name,
              alias: data.alias,
              group: data.group,
              provider: data.provider,
              description: data.description,
            }}
            onSaved={async () => {
              // The overview renders the same annotations; invalidating only this page
              // would leave the two showing different values until a manual reload.
              await queryClient.invalidateQueries({ queryKey: ['cluster-detail', cluster] });
              await queryClient.invalidateQueries({ queryKey: ['clusters'] });
            }}
          />
        </section>
      ) : null}
    </AiSurface>
  );
}
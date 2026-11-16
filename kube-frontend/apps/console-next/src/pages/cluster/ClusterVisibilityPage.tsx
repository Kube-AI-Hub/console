import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clusterApi, clusterWriteApi, workspacePlacementApi, type WorkspacePlacement } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

/**
 * 集群可见性.
 *
 * Whether every enterprise space can see this cluster. KubeSphere stores it as the label
 * `cluster.kubesphere.io/visibility` (`public` / `private`), and that label is the only
 * thing the workspace list is derived from — so the page edits the label, not a copy.
 *
 * Public means every space can use the cluster; private means only the spaces that were
 * granted it. The old console also lists those spaces on this page and lets an operator
 * change them; that half needs the federation workspace CRs, and is recorded as not
 * migrated rather than shown as a switch that does nothing.
 */

/**
 * 可使用该集群的企业空间.
 *
 * A private cluster is usable only by the workspaces whose `spec.placement` includes it; the old
 * console edits that placement per workspace with a JSON patch, and this section does the same.
 *
 * Two kinds of workspace are shown differently on purpose:
 *
 * - one that selects clusters by label (`clusterSelector`) already has access — toggling it would
 *   either do nothing or silently rewrite its selector, so its row is read-only and says why;
 * - one that lists clusters explicitly can be switched here.
 *
 * When the cluster is public the whole section is read-only with an explanation: "every space can
 * use it" makes per-workspace toggles meaningless, and letting them look editable would suggest
 * they do something.
 */
function WorkspaceAccessSection({ cluster, isPublic }: { cluster: string; isPublic: boolean }): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const workspaces = useQuery({
    queryKey: ['workspace-placements'],
    queryFn: ({ signal }) => workspacePlacementApi(apiClient).list({ signal }),
  });
  const toggle = useMutation({
    mutationFn: async (input: { workspace: WorkspacePlacement; grant: boolean }) => {
      const api = workspacePlacementApi(apiClient);
      if (input.grant) await api.addCluster({ workspace: input.workspace, cluster });
      else await api.removeCluster({ workspace: input.workspace, cluster });
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['workspace-placements'] });
    },
    onError: (cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)),
  });

  const rows = workspaces.data ?? [];

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-ai-line pt-4" data-ai-id="cluster-visibility:workspaces">
      <span className="text-sm font-medium text-ai-fg">{t('cluster.visibility.workspaces.title')}</span>
      {isPublic ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id="cluster-visibility:workspaces:public">
          {t('cluster.visibility.workspaces.publicHint')}
        </p>
      ) : (
        <p className="text-xs text-ai-fg-muted">{t('cluster.visibility.workspaces.privateHint')}</p>
      )}
      {workspaces.isPending ? <Skeleton className="h-16 w-full" /> : null}
      {workspaces.isError ? (
        <p className="text-xs text-ai-fg-muted" data-ai-id="cluster-visibility:workspaces:unavailable">
          {t('cluster.visibility.workspaces.unavailable')}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-ai-danger" role="alert" data-ai-id="cluster-visibility:workspaces:error">
          {error}
        </p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="flex flex-col gap-1 text-xs" data-ai-id="cluster-visibility:workspaces:list">
          {rows.map((workspace) => {
            const granted = workspace.clusters.includes(cluster);
            const bySelector = workspace.selectorAll;
            return (
              <li
                key={workspace.name}
                className="flex flex-wrap items-center justify-between gap-2 rounded-ai-md border border-ai-line px-3 py-2"
                data-ai-row={workspace.name}
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-ai-fg" data-ai-id={`cluster-visibility:workspaces:name:${workspace.name}`}>
                    {workspace.alias || workspace.name}
                  </span>
                  {bySelector ? (
                    <span className="text-[11px] text-ai-fg-muted">{t('cluster.visibility.workspaces.bySelector')}</span>
                  ) : null}
                </span>
                {bySelector ? (
                  <span className="text-ai-fg-muted">{t('cluster.visibility.workspaces.selectorGranted')}</span>
                ) : (
                  <label className="flex items-center gap-2 text-ai-fg-secondary">
                    <input
                      type="checkbox"
                      checked={granted}
                      disabled={isPublic || toggle.isPending}
                      onChange={(event) => toggle.mutate({ workspace, grant: event.target.checked })}
                      data-ai-id={`cluster-visibility:workspaces:toggle:${workspace.name}`}
                    />
                    {granted ? t('cluster.visibility.workspaces.granted') : t('cluster.visibility.workspaces.notGranted')}
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export interface ClusterVisibilityPageProps {
  cluster: string;
}

export function ClusterVisibilityPage({ cluster }: ClusterVisibilityPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();

  const detail = useQuery({
    queryKey: ['cluster-detail', cluster],
    queryFn: ({ signal }) => clusterApi(apiClient).get({ cluster, signal }),
  });

  /*
   * The radio reflects the reader's choice immediately, then the server's answer.
   *
   * Deriving it purely from the query makes a click look unresponsive until the refetch
   * lands — the "nothing happened, so it must be broken" moment this project keeps fixing.
   * A failed save drops back to the stored value.
   */
  const [selected, setSelected] = React.useState<'public' | 'private' | null>(null);

  const save = useMutation({
    mutationFn: (visibility: 'public' | 'private') => clusterWriteApi(apiClient).setVisibility({ cluster, visibility }),
    onError: () => setSelected(null),
    onSuccess: async () => {
      // The list shows the cluster's visibility tag from the same label.
      await queryClient.invalidateQueries({ queryKey: ['cluster-detail', cluster] });
      await queryClient.invalidateQueries({ queryKey: ['clusters'] });
      setSelected(null);
    },
  });

  const state = detail.isPending ? 'loading' : detail.isError ? 'error' : 'ready';
  const stored = detail.data?.visibility === 'public' ? 'public' : 'private';
  const visibility = selected ?? stored;

  return (
    <AiSurface as="section" aiId="cluster-visibility:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{t('cluster.visibility.title')}</h1>
        <p className="text-sm text-ai-fg-muted">{t('cluster.visibility.description')}</p>
      </header>

      {state === 'loading' ? <Skeleton className="h-28 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={detail.error} onRetry={() => void detail.refetch()} retryAiId="cluster-visibility:retry" />
      ) : null}

      {detail.data ? (
        <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="cluster-visibility:panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-ai-fg">{t('cluster.visibility.current')}</span>
            <Badge tone={visibility === 'public' ? 'info' : 'neutral'}>
              {visibility === 'public' ? t('cluster.visibility.public') : t('cluster.visibility.private')}
            </Badge>
          </div>

          <div className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label={t('cluster.visibility.title')}>
            {(['private', 'public'] as const).map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-start gap-2 rounded-ai-md border border-ai-line p-3 text-sm"
              >
                <input
                  type="radio"
                  name="cluster-visibility"
                  value={option}
                  checked={visibility === option}
                  disabled={save.isPending}
                  onChange={() => {
                    setSelected(option);
                    save.mutate(option);
                  }}
                  data-ai-id={'cluster-visibility:' + option}
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-ai-fg">
                    {option === 'private' ? t('cluster.visibility.private') : t('cluster.visibility.public')}
                  </span>
                  <span className="text-xs text-ai-fg-muted">
                    {option === 'private' ? t('cluster.visibility.privateHint') : t('cluster.visibility.publicHint')}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {save.isError ? (
            <p className="mt-3 text-xs text-ai-danger" role="alert">
              {save.error instanceof Error ? save.error.message : String(save.error)}
            </p>
          ) : null}

          <WorkspaceAccessSection cluster={cluster} isPublic={visibility === 'public'} />
        </section>
      ) : null}
    </AiSurface>
  );
}
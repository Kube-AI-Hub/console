import * as React from 'react';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Button, Icon, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow as Row } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';
import {
  useFederatedProject,
  useFederatedResourceTypes,
  useWorkspaceAliases,
} from './queries';

/**
 * 联邦项目详情（概览骨架）.
 *
 * Two questions this page answers read-only: what is this federated project (namespace,
 * workspace, placement, propagation), and which resource types the federation API can
 * federate inside a namespace. The federated console's own resource pages (deployments,
 * config maps, …) are a later step; this skeleton makes the project reachable and
 * honest about what it does and does not show.
 */
export interface FederatedProjectDetailPageProps {
  workspace: string;
  name: string;
}

export function FederatedProjectDetailPage({ workspace, name }: FederatedProjectDetailPageProps): React.ReactElement {
  const t = useT();
  const detail = useFederatedProject(workspace, name);
  const aliases = useWorkspaceAliases();
  const types = useFederatedResourceTypes();
  const back = '/kube-frontend/workspaces/' + encodeURIComponent(workspace) + '/federatedprojects';

  const state = detail.isPending ? 'loading' : detail.isError ? 'error' : detail.data === null ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="federated-project:surface" state="error" className="min-w-0">
        <ResourceErrorPanel
          error={detail.error}
          onRetry={() => void detail.refetch()}
          retryAiId="federated-project:retry"
        />
      </AiSurface>
    );
  }

  if (state === 'empty') {
    return (
      <AiSurface as="section" aiId="federated-project:surface" state="empty" className="min-w-0">
        <div className="rounded-ai-md border border-ai-line bg-ai-surface-2 p-6" data-ai-id="federated-project:not-found">
          <h2 className="text-sm font-medium text-ai-fg">{t('fedprojects.detail.notFound')}</h2>
        </div>
      </AiSurface>
    );
  }

  const project = detail.data;
  const workspaceLabel = aliases.data?.get(project?.workspace ?? '') ?? project?.workspace ?? '-';

  return (
    <AiSurface as="section" aiId="federated-project:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <div>
        <a
          href={back}
          className="inline-flex items-center gap-1 text-xs text-ai-accent hover:underline"
          {...actionProps('federated-project:back')}
        >
          <Icon name="chevron-left" size={12} />
          {t('fedprojects.detail.back')}
        </a>
      </div>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}

      {project ? (
        <React.Fragment>
          <header className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-base font-semibold text-ai-fg">{project.name}</h1>
            <p className="text-xs text-ai-fg-muted">{t('fedprojects.list.description')}</p>
          </header>

          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="federated-project:basic">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('fedprojects.detail.basicInfo')}</h2>
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
              <Row label={t('workspace.field.name')} value={project.name} />
              <Row label={t('fedprojects.field.namespace')} value={project.namespace || '-'} />
              <Row label={t('fedprojects.field.workspace')} value={workspaceLabel} />
              <Row
                label={t('workspace.field.clusters')}
                value={project.clusters.length === 0 ? '-' : project.clusters.join(', ')}
              />
              <Row
                label={t('fedprojects.field.propagation')}
                value={
                  project.propagated === undefined
                    ? '-'
                    : project.propagated
                      ? t('fedprojects.detail.propagated')
                      : t('fedprojects.detail.notPropagated')
                }
              />
              <Row label={t('workspace.field.createdAt')} value={formatTimestamp(project.createdAt)} />
              <Row label={t('workspace.field.creator')} value={project.creator || '-'} />
            </dl>
          </section>

          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="federated-project:types">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium text-ai-fg">{t('fedprojects.detail.resourceTypes')}</h2>
              <span className="text-[11px] text-ai-fg-muted">{t('fedprojects.detail.resourceTypesHint')}</span>
            </div>

            {types.isPending ? <Skeleton className="h-24 w-full" /> : null}

            {types.isError ? (
              <p className="flex flex-wrap items-center gap-2 text-xs text-ai-fg-muted" data-ai-id="federated-project:types:error">
                {t('fedprojects.detail.resourceTypesUnavailable')}
                <Button
                  size="sm"
                  variant="ghost"
                  {...actionProps('federated-project:types:retry')}
                  onClick={() => void types.refetch()}
                >
                  {t('common.retry')}
                </Button>
              </p>
            ) : null}

            {types.isSuccess && (types.data?.length ?? 0) === 0 ? (
              <p className="text-xs text-ai-fg-muted" data-ai-id="federated-project:types:empty">
                {t('fedprojects.detail.resourceTypesEmpty')}
              </p>
            ) : null}

            {(types.data?.length ?? 0) > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-ai-fg-muted">
                      <th className="pb-2 pr-4 font-medium">{t('fedprojects.detail.column.kind')}</th>
                      <th className="pb-2 font-medium">{t('fedprojects.detail.column.resource')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(types.data ?? []).map((type) => (
                      <tr key={type.plural} className="border-t border-ai-line" data-ai-row={type.plural}>
                        <td className="py-1.5 pr-4 font-mono text-[11px] text-ai-fg-secondary">{type.kind}</td>
                        <td className="py-1.5 font-mono text-[11px] text-ai-fg-muted">{type.plural}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          {project.propagated === undefined ? (
            <p className="text-[11px] text-ai-fg-muted" data-ai-id="federated-project:propagation-unknown">
              {t('fedprojects.detail.propagationUnknown')}
            </p>
          ) : null}
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}

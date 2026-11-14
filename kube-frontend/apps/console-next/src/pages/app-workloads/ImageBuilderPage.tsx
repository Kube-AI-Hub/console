import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { imageBuildersApi, type ImageBuilderSummary } from '@kube-ai-hub/api-client';
import type { LocaleKey } from '@kube-ai-hub/locales';
import { AiSurface, Badge, ResourceList, type ListSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 镜像构建器（项目级）.
 *
 * S2I/B2I builders live in the devops group's **v1alpha1**, not the v1alpha3 that serves
 * pipelines: the same group has two versions and the S2I CRDs were never promoted. The
 * page reads the project's builders and shows what the controller already knows
 * (image, last run state, when it was created); it does not create or start builds —
 * those are separate write flows and the create entry is not migrated yet.
 *
 * The list is often empty on a fresh install (this cluster has zero builders in every
 * namespace), so the empty state says where builders come from instead of implying the
 * page is broken.
 */
export interface ImageBuilderPageProps {
  cluster: string;
  namespace: string;
}

const PAGE_SIZE = 20;

type BuildTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

/** `status.lastRunState` → label + tone; empty means the builder has never run. */
function buildStatus(status: string): { key: LocaleKey; tone: BuildTone } {
  const value = status.toLowerCase();
  if (value === 'running' || value === 'building') {
    return { key: 'devopsProject.s2ibuilder.status.building', tone: 'info' };
  }
  if (value === 'successful' || value === 'succeeded' || value === 'success') {
    return { key: 'devopsProject.s2ibuilder.status.successful', tone: 'success' };
  }
  if (value === 'failed' || value === 'error') {
    return { key: 'devopsProject.s2ibuilder.status.failed', tone: 'danger' };
  }
  return { key: 'devopsProject.s2ibuilder.status.notRunYet', tone: 'neutral' };
}

export function ImageBuilderPage({ cluster, namespace }: ImageBuilderPageProps): React.ReactElement {
  const t = useT();
  const [page, setPage] = React.useState(1);

  const query = useQuery({
    queryKey: ['image-builders', cluster, namespace],
    queryFn: ({ signal }) => imageBuildersApi(apiClient).list({ namespace, signal }),
  });

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const schema = React.useMemo<ListSchema<ImageBuilderSummary>>(
    () => ({
      title: t('devopsProject.s2ibuilder.title'),
      description: t('devopsProject.s2ibuilder.description'),
      rowKey: 'name',
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      columns: [
        {
          key: 'name',
          title: t('cluster.column.name'),
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-ai-fg">{row.displayName || row.name}</span>
              <span className="truncate text-[11px] text-ai-fg-muted">
                {[row.kind.toUpperCase(), row.serviceName ? t('devopsProject.s2ibuilder.forService', { service: row.serviceName }) : '']
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          ),
        },
        {
          key: 'baseImage',
          title: t('devopsProject.s2ibuilder.column.baseImage'),
          render: (row) => (
            <code className="block max-w-md truncate font-mono text-[11px] text-ai-fg-secondary" title={row.baseImage}>
              {row.baseImage || '-'}
            </code>
          ),
        },
        {
          key: 'status',
          title: t('monitoring.column.state'),
          width: 130,
          render: (row) => {
            const info = buildStatus(row.status);
            return <Badge tone={info.tone}>{t(info.key)}</Badge>;
          },
        },
        {
          key: 'createdAt',
          title: t('cluster.column.createdAt'),
          width: 170,
          hideBelow: 'md',
          render: (row) => <span className="tabular-nums text-ai-fg-muted">{formatTimestamp(row.createdAt)}</span>,
        },
      ],
      empty: {
        title: t('devopsProject.s2ibuilder.emptyTitle'),
        description: t('devopsProject.s2ibuilder.emptyDescription'),
      },
      labels: {
        selectAll: t('table.selectAll'),
        selectRow: (index) => t('table.selectRow', { index }),
        moreActions: t('table.moreActions'),
        previous: t('table.previous'),
        next: t('table.next'),
        selected: (count) => t('table.selectedCount', { count }),
      },
      pagination: { page, pageSize: PAGE_SIZE, total },
    }),
    [page, t, total],
  );

  const state = query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="image-builder:surface" data-ai-id="image-builder:surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="image-builder:retry" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="image-builder:surface" data-ai-id="image-builder:surface" state={state} className="min-w-0">
      <ResourceList schema={schema} rows={pageRows} loading={state === 'loading'} onPageChange={setPage} />
    </AiSurface>
  );
}

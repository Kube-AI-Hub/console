import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api as apiClient } from '@/api';
import { AiSurface, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';

/**
 * 快照内容（VolumeSnapshotContent）详情.
 *
 * 老 console 的 `/volume-snapshot-content/:name` 是一个只读详情页：快照对象引用某条内容，内容才带着
 * CSI 驱动、真实快照句柄（snapshotHandle）与恢复大小。排障时缺的就是这一层——「快照说我有了，卷上到底有没有」。
 *
 * 读集群级对象：`/apis/snapshot.storage.k8s.io/v1/volumesnapshotcontents/<name>`；不走 kapis，因为它是原生组，
 * 且 kapis 在成员集群要带 clusters 段（同一选择在快照列表页的 design 里记过）。
 */
interface SnapshotContent {
  name: string;
  driver: string;
  snapshotHandle: string;
  volumeSnapshotName: string;
  volumeSnapshotNamespace: string;
  restoreSize: string;
  readyToUse: string;
  deletionPolicy: string;
  createdAt: string;
}

function toSnapshotContent(item: Record<string, unknown>): SnapshotContent {
  const metadata = (item['metadata'] ?? {}) as Record<string, unknown>;
  const spec = (item['spec'] ?? {}) as Record<string, unknown>;
  const status = (item['status'] ?? {}) as Record<string, unknown>;
  const ref = (spec['volumeSnapshotRef'] ?? {}) as Record<string, unknown>;
  return {
    name: String(metadata['name'] ?? ''),
    driver: String(spec['driver'] ?? ''),
    snapshotHandle: String(spec['snapshotHandle'] ?? ''),
    volumeSnapshotName: String(ref['name'] ?? ''),
    volumeSnapshotNamespace: String(ref['namespace'] ?? ''),
    restoreSize: String(status['restoreSize'] ?? ''),
    readyToUse: String(status['readyToUse'] ?? ''),
    deletionPolicy: String(spec['deletionPolicy'] ?? ''),
    createdAt: String(metadata['creationTimestamp'] ?? ''),
  };
}

export interface VolumeSnapshotContentPageProps {
  name: string;
}

export function VolumeSnapshotContentPage({ name }: VolumeSnapshotContentPageProps): React.ReactElement {
  const t = useT();
  const query = useQuery({
    queryKey: ['volume-snapshot-content', name],
    queryFn: async ({ signal }) => {
      const item = await apiClient.request<Record<string, unknown>>(
        `/apis/snapshot.storage.k8s.io/v1/volumesnapshotcontents/${encodeURIComponent(name)}`,
        { signal },
      );
      return toSnapshotContent(item ?? {});
    },
  });
  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const data = query.data;

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="snapshot-content:surface" state="error" className="min-w-0">
        <ResourceErrorPanel
          error={query.error}
          onRetry={() => void query.refetch()}
          retryAiId="snapshot-content:retry"
        />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="snapshot-content:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{data?.name || name}</h1>
        <p className="text-xs text-ai-fg-muted">{t('storage.snapshotContent.description')}</p>
      </header>
      {state === 'loading' ? <Skeleton className="h-32 w-full" /> : null}
      {data ? (
        <dl className="grid grid-cols-1 gap-3 rounded-lg border border-ai-border bg-ai-surface p-4 text-xs sm:grid-cols-2 lg:grid-cols-3" data-ai-id="snapshot-content:basic">
          {[
            [t('storage.snapshotContent.driver'), data.driver],
            [t('storage.snapshotContent.handle'), data.snapshotHandle],
            [t('storage.snapshotContent.snapshot'), [data.volumeSnapshotNamespace, data.volumeSnapshotName].filter(Boolean).join('/')],
            [t('storage.snapshotContent.restoreSize'), data.restoreSize || '-'],
            [t('storage.snapshotContent.ready'), data.readyToUse || '-'],
            [t('storage.snapshotContent.deletionPolicy'), data.deletionPolicy || '-'],
            [t('storage.field.createdAt'), formatTimestamp(data.createdAt)],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-ai-fg-muted">{label}</dt>
              <dd className="truncate font-mono text-[11px] text-ai-fg" title={value}>{value || '-'}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </AiSurface>
  );
}
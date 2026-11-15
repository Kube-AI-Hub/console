import * as React from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, AiSurface, Badge, Button, Empty, Icon, Skeleton, Tabs, TabsContent } from '@kube-ai-hub/ui';
import type { StorageKind } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import {
  STORAGE_DESCRIPTORS,
  useCloneStorage,
  useCreateClaimSnapshot,
  useDeleteStorage,
  useObjectEvents,
  useSnapshotClasses,
  useStorageClasses,
  useStorageOne,
  useUpdateStorage,
} from './queries';
import { useClaimSnapshots, type ClaimSnapshot } from './detailSnapshots';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { CloneVolumeDialog } from './CloneVolumeDialog';
import { CreateSnapshotDialog } from './CreateSnapshotDialog';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { YamlDialog } from '@/components/resource/YamlDialog';
import { toYaml } from '@/components/resource/yaml';
import { formatTimestamp } from '@/lib/time';
import { statusLabel } from '@/lib/status';
import { DefinitionRow as Row } from '@/components/resource/DefinitionRow';

/**
 * The storage detail view.
 *
 * Attributes the old console's detail shows: cluster, project, storage class,
 * capacity, access modes, and — for a claim — the volume that backs it; for a
 * snapshot, the claim it came from.
 *
 * A claim also gets a 快照 tab: the snapshots taken from this claim, which is
 * how a reader answers "can I restore this, and how old is the copy". It is
 * read-only — creating or deleting a snapshot is a write and lives elsewhere.
 */
export interface StorageDetailPageProps {
  kind: StorageKind;
  cluster: string;
  namespace: string;
  name: string;
}

type Dialog = 'none' | 'editYaml' | 'delete' | 'editInfo' | 'clone' | 'snapshot';

type Tab = 'attributes' | 'metadata' | 'events' | 'snapshots';

export function StorageDetailPage({ kind, cluster, namespace, name }: StorageDetailPageProps): React.ReactElement {
  const t = useT();
  const descriptor = STORAGE_DESCRIPTORS[kind]!;
  const navigate = useNavigate();
  const query = useStorageOne(kind, { cluster, namespace, name });
  const update = useUpdateStorage(kind, { cluster, namespace });
  const remove = useDeleteStorage(kind, { cluster, namespace });
  const [dialog, setDialog] = React.useState<Dialog>('none');
  const [tab, setTab] = React.useState<Tab>('attributes');

  const isClaim = kind === 'persistentvolumeclaims';
  const snapshots = useClaimSnapshots({ cluster, namespace, claimName: isClaim ? name : '' });
  const storageClasses = useStorageClasses();
  const snapshotClasses = useSnapshotClasses();
  const clone = useCloneStorage({ cluster, namespace });
  const createSnapshot = useCreateClaimSnapshot({ cluster, namespace, claim: isClaim ? name : '' });
  const events = useObjectEvents({ namespace, name, kind: isClaim ? 'PersistentVolumeClaim' : 'VolumeSnapshot' });

  const detail = query.data;
  /*
   * Capability gates, read from the class rather than assumed:
   * - clone needs `allow-clone` on the class and a bound source claim;
   * - snapshot needs `allow-snapshot` on the class;
   * - expand is the list's action and is gated the same way.
   * A control that the storage layer will reject is worse than no control: the failure reads as a
   * console bug.
   */
  const claimClass = detail ? storageClasses.data?.find((entry) => entry.name === detail.storageClass) : undefined;
  const canClone = isClaim && claimClass?.allowCloning === true && detail?.status === 'Bound';
  const canSnapshot = isClaim && claimClass?.allowSnapshot === true;
  const matchingSnapshotClasses = (snapshotClasses.data ?? []).filter(
    (entry) => !detail?.provisioner || entry.driver === detail.provisioner,
  );
  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  /*
   * Back target is the list of the same kind. Derived from the current URL rather
   * than from route params so a detail opened from a filtered list still returns to
   * the same scope; the object name is simply dropped.
   */
  const scope = useRouterState({
    select: (state) => /^(\/kube-frontend\/[^/]+\/clusters\/[^/]+\/projects\/[^/]+)/.exec(state.location.pathname)?.[1] ?? '',
  });
  const back = `${scope}/${kind}`;

  /*
   * Built once and rendered inside the tabs: the attributes are the same block
   * whether the object is a claim (tabbed view) or a snapshot (single view), and
   * duplicating it for the two branches is how the two drift apart.
   */
  const attributes = detail ? (
    <section className="rounded-ai-md border border-ai-line p-4" data-ai-id={`${kind}-detail:attributes`}>
      <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('storage.detail.attributes')}</h2>
      <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
        <Row label={t('storage.field.cluster')} value={cluster} />
        <Row label={t('storage.field.project')} value={detail.namespace || namespace} />
        {/* 状态 was missing even though the list shows it: a detail page that
            omits the one field people came to check is the wrong shape. */}
        <Row label={t('storage.column.status')} value={detail.status ? statusLabel(t, detail.status) : '-'} />
        <Row label={t('storage.field.storageClass')} value={detail.storageClass || '-'} />
        <Row label={t('storage.field.capacity')} value={detail.capacity || '-'} />
        {isClaim ? (
          <>
            <Row label={t('storage.field.accessModes')} value={detail.accessModes.join(', ') || '-'} />
            <Row label={t('storage.field.volume')} value={detail.volumeName || '-'} />
          </>
        ) : (
          <>
            <Row label={t('storage.field.sourceClaim')} value={detail.sourceClaim || '-'} />
            <Row label={t('storage.field.snapshotClass')} value={detail.snapshotClass || '-'} />
          </>
        )}
        {/* The provisioner is what a reader needs to know which driver backs the
            claim; the old console shows it too. */}
        <Row label={t('storage.field.provisioner')} value={detail.provisioner || '-'} />
        <Row label={t('storage.field.createdAt')} value={formatTimestamp(detail.createdAt)} />
        <Row label={t('storage.field.creator')} value={detail.creator || '-'} />
      </dl>
    </section>
  ) : null;

  return (
    <AiSurface as="section" aiId={`${kind}-detail:surface`} state={state} className="flex min-w-0 flex-col gap-4">
      <div>
        <a
          href={back}
          className="inline-flex items-center gap-1 text-xs text-ai-accent hover:underline"
          {...actionProps(`${kind}-detail:back`)}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
            void navigate({ href: back });
          }}
        >
          <Icon name="chevron-left" size={12} />
          {t(descriptor.titleKey)}
        </a>
      </div>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId={`${kind}-detail:retry`} />
      ) : null}

      {detail ? (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold text-ai-fg">{detail.alias || detail.name}</h1>
                {detail.status ? <Badge tone={detail.status === 'Bound' || detail.status === 'Ready' ? 'success' : 'warning'}>{detail.status}</Badge> : null}
                {detail.federated ? <Badge tone="info">{t('resource.federated')}</Badge> : null}
              </div>
              {detail.alias ? <p className="text-xs text-ai-fg-muted">{detail.name}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button variant="ghost" size="sm" {...actionProps(`${kind}-detail:edit-info`)} onClick={() => setDialog('editInfo')}>
                {t('resource.action.editInfo')}
              </Button>
              {canClone ? (
                <Button variant="ghost" size="sm" {...actionProps('persistentvolumeclaims-detail:clone')} onClick={() => setDialog('clone')}>
                  {t('storage.action.clone')}
                </Button>
              ) : null}
              {canSnapshot ? (
                <Button variant="ghost" size="sm" {...actionProps('persistentvolumeclaims-detail:snapshot')} onClick={() => setDialog('snapshot')}>
                  {t('storage.action.createSnapshot')}
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" {...actionProps(`${kind}-detail:edit-yaml`)} onClick={() => setDialog('editYaml')}>
                {t('resource.action.editYaml')}
              </Button>
              <AiButton aiId={`${kind}-detail:delete`} size="sm" variant="danger" onClick={() => setDialog('delete')}>
                {t('common.delete')}
              </AiButton>
            </div>
          </header>

          {isClaim ? (
            <Tabs
              value={tab}
              onValueChange={(next) => setTab(next as Tab)}
              items={[
                { value: 'attributes', label: t('storage.detail.attributes'), aiId: 'storage-detail:tab:attributes' },
                { value: 'metadata', label: t('storage.detail.tab.metadata'), aiId: 'storage-detail:tab:metadata' },
                { value: 'events', label: t('storage.detail.tab.events'), aiId: 'storage-detail:tab:events' },
                { value: 'snapshots', label: t('storage.detail.tab.snapshots'), aiId: 'storage-detail:tab:snapshots' },
              ]}
            >
              <TabsContent value="attributes">{attributes}</TabsContent>
              <TabsContent value="metadata">
                <MetadataPanel labels={detail.labels} annotations={detail.annotations} />
              </TabsContent>
              <TabsContent value="events">
                <EventsPanel events={events.data ?? []} pending={events.isPending} error={events.error} onRetry={() => void events.refetch()} />
              </TabsContent>
              <TabsContent value="snapshots">
                <SnapshotsPanel
                  snapshots={snapshots.data ?? []}
                  pending={snapshots.isPending}
                  error={snapshots.error}
                  onRetry={() => void snapshots.refetch()}
                  snapshotHref={(snapshotName) => scope + '/volumesnapshots/' + snapshotName}
                />
              </TabsContent>
            </Tabs>
          ) : (
            attributes
          )}
        </>
      ) : null}

      <MutationAlert error={update.error ?? remove.error ?? clone.error ?? createSnapshot.error} />

      {dialog === 'editYaml' && detail ? (
        <YamlDialog
          open
          onOpenChange={(open) => !open && setDialog('none')}
          initialYaml={toYaml(detail.raw)}
          lockName={detail.name}
          title={t('resource.action.editYaml')}
          submitLabel={t('common.confirm')}
          pending={update.isPending}
          onSubmit={async (object) => {
            await update.mutateAsync(object as never);
            setDialog('none');
          }}
        />
      ) : null}

      {dialog === 'editInfo' && detail ? (
        <EditInfoDialog
          open
          onOpenChange={(open) => !open && setDialog('none')}
          resource={kind}
          name={detail.name}
          alias={detail.alias}
          description={detail.description}
          annotations={detail.annotations}
          pending={update.isPending}
          onSubmit={async (annotations) => {
            await update.mutateAsync({ ...detail.raw, metadata: { ...detail.raw.metadata, annotations } } as never);
            setDialog('none');
          }}
        />
      ) : null}

      {dialog === 'clone' && detail ? (
        <CloneVolumeDialog
          open
          source={{ name: detail.name, storageClass: detail.storageClass, capacity: detail.capacity }}
          pending={clone.isPending}
          onOpenChange={(open) => !open && setDialog('none')}
          onSubmit={async (cloneName) => {
            await clone.mutateAsync({ source: detail, name: cloneName });
            setDialog('none');
            void navigate({ href: back });
          }}
        />
      ) : null}

      {dialog === 'snapshot' && detail ? (
        <CreateSnapshotDialog
          open
          claim={detail.name}
          provisioner={detail.provisioner}
          classes={matchingSnapshotClasses}
          pending={createSnapshot.isPending}
          onOpenChange={(open) => !open && setDialog('none')}
          onSubmit={async (input) => {
            await createSnapshot.mutateAsync(input);
            setDialog('none');
            setTab('snapshots');
          }}
        />
      ) : null}

      {dialog === 'delete' ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDialog('none')}
          names={[name]}
          resource={kind}
          noun={t(descriptor.titleKey)}
          pending={remove.isPending}
          onConfirm={async () => {
            await remove.mutateAsync([name]);
            setDialog('none');
            void navigate({ href: back });
          }}
        />
      ) : null}
    </AiSurface>
  );
}

/**
 * 元数据: the labels and annotations a claim carries.
 *
 * Read-only here on purpose — editing them is 编辑信息 (alias/description) or 编辑 YAML (anything
 * else), and a second editor for the same two maps is how a page ends up with two answers.
 */
function MetadataPanel({
  labels,
  annotations,
}: {
  labels: Record<string, string>;
  annotations: Record<string, string>;
}): React.ReactElement {
  const t = useT();
  const labelRows = Object.entries(labels);
  const annotationRows = Object.entries(annotations);
  const block = (title: string, rows: Array<[string, string]>, aiId: string, empty: string) => (
    <section className="rounded-ai-md border border-ai-line p-4" data-ai-id={aiId}>
      <h2 className="mb-2 text-sm font-medium text-ai-fg">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-ai-fg-muted">{empty}</p>
      ) : (
        <table className="w-full text-left text-xs">
          <thead className="text-ai-fg-muted">
            <tr>
              <th className="w-1/3 py-1 pr-3 font-medium">{t('configmaps.field.dataKey')}</th>
              <th className="py-1 font-medium">{t('configmaps.field.dataValue')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, value]) => (
              <tr key={key} className="border-t border-ai-line" data-ai-row={key}>
                <td className="py-1 pr-3 font-mono text-[11px] text-ai-fg-secondary">{key}</td>
                <td className="break-all py-1 text-ai-fg">{value || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
  return (
    <div className="flex flex-col gap-3">
      {block(t('metadata.labels'), labelRows, 'storage-detail:labels', t('storage.detail.noLabels'))}
      {block(t('metadata.annotations'), annotationRows, 'storage-detail:annotations', t('storage.detail.noAnnotations'))}
    </div>
  );
}

/**
 * 事件: what the cluster said about this claim.
 *
 * A pending claim is almost always explained by an event (`waiting for first consumer`, `no
 * volume plugin matches`), which is why this tab exists rather than a link elsewhere.
 */
function EventsPanel({
  events,
  pending,
  error,
  onRetry,
}: {
  events: Array<{ type: string; reason: string; message: string; count: number; lastSeen: string }>;
  pending: boolean;
  error: unknown;
  onRetry: () => void;
}): React.ReactElement {
  const t = useT();
  if (error) {
    return <ResourceErrorPanel error={error} onRetry={onRetry} retryAiId="storage-detail:events-retry" />;
  }
  if (pending) return <Skeleton className="h-24 w-full" />;
  if (events.length === 0) {
    return (
      <p className="text-xs text-ai-fg-muted" data-ai-id="storage-detail:events-empty">
        {t('storage.detail.noEvents')}
      </p>
    );
  }
  return (
    <table className="w-full text-left text-xs" data-ai-id="storage-detail:events">
      <thead className="text-ai-fg-muted">
        <tr>
          <th className="py-1 pr-3 font-medium">{t('storage.detail.event.type')}</th>
          <th className="py-1 pr-3 font-medium">{t('storage.detail.event.reason')}</th>
          <th className="py-1 pr-3 font-medium">{t('storage.detail.event.message')}</th>
          <th className="py-1 pr-3 font-medium">{t('storage.detail.event.count')}</th>
          <th className="py-1 font-medium">{t('storage.detail.event.lastSeen')}</th>
        </tr>
      </thead>
      <tbody>
        {events.map((event) => (
          <tr key={`${event.reason}-${event.lastSeen}-${event.message.slice(0, 12)}`} className="border-t border-ai-line">
            <td className="py-1 pr-3">{event.type || '-'}</td>
            <td className="py-1 pr-3">{event.reason || '-'}</td>
            <td className="break-all py-1 pr-3">{event.message || '-'}</td>
            <td className="py-1 pr-3 tabular-nums">{event.count}</td>
            <td className="py-1 tabular-nums text-ai-fg-muted">{formatTimestamp(event.lastSeen)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The snapshots taken from one claim.
 *
 * Read-only: a snapshot list is where the restore decision starts, and both
 * creating and deleting a snapshot are writes this page does not offer. The
 * empty state is explicit because an installed CRD with zero objects is the
 * common case on a fresh cluster — a blank area would read as "still loading".
 */
function SnapshotsPanel({
  snapshots,
  pending,
  error,
  onRetry,
  snapshotHref,
}: {
  snapshots: ClaimSnapshot[];
  pending: boolean;
  error: unknown;
  onRetry: () => void;
  snapshotHref: (name: string) => string;
}): React.ReactElement {
  const t = useT();

  return (
    <section data-ai-id="storage-detail:snapshots" className="rounded-ai-md border border-ai-line p-4">
      <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('storage.detail.tab.snapshots')}</h2>

      {pending ? <Skeleton className="h-24 w-full" /> : null}

      {!pending && error ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-xs text-ai-fg-muted">{t('storage.detail.snapshotsError')}</p>
          <Button variant="secondary" size="sm" data-ai-id="storage-detail:snapshots-retry" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {!pending && !error && snapshots.length === 0 ? (
        <Empty
          data-ai-id="storage-detail:snapshots-empty"
          title={t('storage.detail.snapshotsEmpty')}
          description={t('storage.detail.snapshotsEmptyHint')}
        />
      ) : null}

      {!pending && !error && snapshots.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-ai-line text-left text-ai-fg-muted">
                <th className="py-2 pr-3 font-medium">{t('storage.column.name')}</th>
                <th className="py-2 pr-3 font-medium">{t('storage.column.status')}</th>
                <th className="py-2 pr-3 font-medium">{t('storage.detail.snapshotSize')}</th>
                <th className="py-2 font-medium">{t('storage.column.createdAt')}</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snapshot) => (
                <tr
                  key={snapshot.name}
                  data-ai-row={snapshot.name}
                  data-ai-id={'storage-detail:snapshot:' + snapshot.name}
                  className="border-b border-ai-line last:border-b-0"
                >
                  <td className="py-2 pr-3">
                    <a href={snapshotHref(snapshot.name)} className="font-medium text-ai-accent hover:underline">
                      {snapshot.name}
                    </a>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge tone={snapshot.ready ? 'success' : 'warning'}>
                      {statusLabel(t, snapshot.ready ? 'Ready' : 'Pending')}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-ai-fg-secondary">{snapshot.size || '-'}</td>
                  <td className="py-2 tabular-nums text-ai-fg-muted">{formatTimestamp(snapshot.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

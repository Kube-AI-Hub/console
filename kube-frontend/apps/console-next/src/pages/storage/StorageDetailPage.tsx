import * as React from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, AiSurface, Badge, Button, Empty, Icon, Skeleton, Tabs, TabsContent } from '@kube-ai-hub/ui';
import type { StorageKind } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { useDeleteStorage, useStorageOne, useUpdateStorage, STORAGE_DESCRIPTORS } from './queries';
import { useClaimSnapshots, type ClaimSnapshot } from './detailSnapshots';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
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

type Dialog = 'none' | 'editYaml' | 'delete';

type Tab = 'attributes' | 'snapshots';

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

  const detail = query.data;
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
                { value: 'snapshots', label: t('storage.detail.tab.snapshots'), aiId: 'storage-detail:tab:snapshots' },
              ]}
            >
              <TabsContent value="attributes">{attributes}</TabsContent>
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

      <MutationAlert error={update.error ?? remove.error} />

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

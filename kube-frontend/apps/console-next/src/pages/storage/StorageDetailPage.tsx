import * as React from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, AiSurface, Badge, Button, Icon, Skeleton } from '@kube-ai-hub/ui';
import type { StorageKind } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { useDeleteStorage, useStorageOne, useUpdateStorage, STORAGE_DESCRIPTORS } from './queries';
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
 */
export interface StorageDetailPageProps {
  kind: StorageKind;
  cluster: string;
  namespace: string;
  name: string;
}

type Dialog = 'none' | 'editYaml' | 'delete';

export function StorageDetailPage({ kind, cluster, namespace, name }: StorageDetailPageProps): React.ReactElement {
  const t = useT();
  const descriptor = STORAGE_DESCRIPTORS[kind]!;
  const navigate = useNavigate();
  const query = useStorageOne(kind, { cluster, namespace, name });
  const update = useUpdateStorage(kind, { cluster, namespace });
  const remove = useDeleteStorage(kind, { cluster, namespace });
  const [dialog, setDialog] = React.useState<Dialog>('none');

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

          <section className="rounded-ai-md border border-ai-line p-4">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('storage.detail.attributes')}</h2>
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
              <Row label={t('storage.field.cluster')} value={cluster} />
              <Row label={t('storage.field.project')} value={detail.namespace || namespace} />
              {/* 状态 was missing even though the list shows it: a detail page that
                  omits the one field people came to check is the wrong shape. */}
              <Row label={t('storage.column.status')} value={detail.status ? statusLabel(t, detail.status) : '-'} />
              <Row label={t('storage.field.storageClass')} value={detail.storageClass || '-'} />
              <Row label={t('storage.field.capacity')} value={detail.capacity || '-'} />
              {kind === 'persistentvolumeclaims' ? (
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


/** Status → locale key suffix, shared with the list so both name a state the same way. */


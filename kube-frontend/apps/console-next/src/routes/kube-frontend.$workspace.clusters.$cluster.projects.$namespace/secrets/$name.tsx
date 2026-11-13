import * as React from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, AiSurface, Badge, Button, Icon, Modal, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import {
  useDeleteSecrets,
  usePatchSecret,
  useDefaultRegistrySecret,
  useSecret,
  useSetDefaultSecret,
  useUpdateSecret,
} from '@/pages/secrets/queries';
import { SecretDataSection, detailTypeLabel } from '@/pages/secrets/SecretDataSection';
import { SecretEditSettingsDialog } from '@/pages/secrets/SecretEditDialogs';
import { formatTimestamp } from '@/lib/time';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { MutationAlert, ResourceErrorPanel, errorMessage } from '@/components/resource/ResourceErrorPanel';
import { YamlDialog, toYaml } from '@/components/resource/YamlDialog';

/**
 * Secret detail.
 *
 * Layout follows the old console: attributes on top (集群、项目、类型、创建时间、
 * 创建者), one `数据` section below rendered per type, and the same operations the
 * list offers plus 设为默认镜像仓库 for a registry Secret that is not default.
 * Labels and annotations are not shown because the old page does not show them;
 * they stay reachable through 编辑 YAML.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/secrets/$name')({
  component: SecretDetailRoute,
});

type Dialog = 'none' | 'delete' | 'editInfo' | 'editSettings' | 'editYaml' | 'setDefault';

function SecretDetailRoute() {
  const t = useT();
  const navigate = useNavigate();
  const { cluster, namespace, name, workspace } = Route.useParams();
  const query = useSecret({ cluster, namespace, name });
  const [dialog, setDialog] = React.useState<Dialog>('none');

  const remove = useDeleteSecrets({ cluster, namespace });
  const update = useUpdateSecret({ cluster, namespace });
  const patch = usePatchSecret({ cluster, namespace, name });
  const setDefault = useSetDefaultSecret({ cluster, namespace });

  const detail = query.data;
  const isRegistry = detail?.type === 'kubernetes.io/dockerconfigjson';
  /**
   * The Secret currently marked default, so it is unmarked when this one takes
   * over: a second `true` would leave the image puller with no defined winner.
   * Loaded with the page rather than when the dialog opens, so the confirm button
   * cannot be pressed before the previous default is known.
   */
  const defaultRegistry = useDefaultRegistrySecret({ cluster, namespace, enabled: Boolean(isRegistry) });

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const listRoute = '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/secrets';
  const listParams = { workspace, cluster, namespace };

  const canSetDefault = Boolean(isRegistry && detail && !detail.isDefault);
  const previousDefaultName = defaultRegistry.data;
  const previousDefault = previousDefaultName && previousDefaultName !== name ? previousDefaultName : undefined;

  return (
    <AiSurface as="section" aiId="secret-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <div>
        <Link
          to={listRoute}
          params={listParams}
          className="inline-flex items-center gap-1 text-xs text-ai-accent hover:underline"
          {...actionProps('secret-detail:back')}
        >
          <Icon name="chevron-left" size={12} />
          {t('secrets.title')}
        </Link>
      </div>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}

      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="secret-detail:retry" />
      ) : null}

      {detail ? (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-base font-semibold text-ai-fg">{detail.alias || detail.name}</h1>
                {detail.alias ? <span className="truncate text-xs text-ai-fg-muted">{detail.name}</span> : null}
                <Badge tone="neutral">{detailTypeLabel(t, detail.type)}</Badge>
                {detail.isDefault ? <Badge tone="info">{t('secrets.defaultBadge')}</Badge> : null}
                {detail.federated ? <Badge tone="info">{t('resource.federated')}</Badge> : null}
              </div>
              {detail.description ? <p className="text-xs text-ai-fg-muted">{detail.description}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <AiButton aiId="secret-detail:edit-info" size="sm" variant="secondary" onClick={() => setDialog('editInfo')}>
                {t('resource.action.editInfo')}
              </AiButton>
              <Button variant="ghost" size="sm" {...actionProps('secret-detail:edit-yaml')} onClick={() => setDialog('editYaml')}>
                {t('resource.action.editYaml')}
              </Button>
              <AiButton aiId="secret-detail:edit-settings" size="sm" variant="secondary" onClick={() => setDialog('editSettings')}>
                {t('resource.action.editSettings')}
              </AiButton>
              {/* Mirrors the old detail page's conditional operation, which is last but for delete. */}
              {canSetDefault ? (
                <AiButton aiId="secret-detail:set-default" size="sm" variant="secondary" onClick={() => setDialog('setDefault')}>
                  {t('secrets.action.setDefault')}
                </AiButton>
              ) : null}
              <AiButton aiId="secret-detail:delete" size="sm" variant="danger" onClick={() => setDialog('delete')}>
                {t('common.delete')}
              </AiButton>
            </div>
          </header>

          <section className="rounded-ai-md border border-ai-line p-4">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('resource.attributes')}</h2>
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
              <Row label={t('resource.field.cluster')} value={cluster} aiId="secret-detail:attr-cluster" />
              <Row label={t('resource.field.project')} value={namespace} aiId="secret-detail:attr-project" />
              <Row label={t('secrets.field.type')} value={detailTypeLabel(t, detail.type)} aiId="secret-detail:attr-type" />
              <Row label={t('resource.field.createdAt')} value={formatTimestamp(detail.createdAt)} aiId="secret-detail:attr-created" />
              <Row label={t('resource.field.creator')} value={detail.creator || '-'} aiId="secret-detail:attr-creator" />
            </dl>
          </section>

          <SecretDataSection detail={detail} />

          <MutationAlert error={remove.error ?? update.error ?? patch.error ?? setDefault.error} />

          <EditInfoDialog
            open={dialog === 'editInfo'}
            onOpenChange={(open) => setDialog(open ? 'editInfo' : 'none')}
            resource="secrets"
            name={detail.name}
            alias={detail.alias}
            description={detail.description}
            annotations={detail.annotations}
            pending={update.isPending}
            onSubmit={async (annotations) => {
              await update.mutateAsync({ ...detail.raw, metadata: { ...detail.raw.metadata, name, namespace, annotations } });
              setDialog('none');
            }}
          />

          <SecretEditSettingsDialog
            open={dialog === 'editSettings'}
            onOpenChange={(open) => setDialog(open ? 'editSettings' : 'none')}
            detail={detail}
            pending={update.isPending}
            onSubmit={async ({ data, annotations }) => {
              await update.mutateAsync({ ...detail.raw, metadata: { ...detail.raw.metadata, name, namespace, annotations }, data });
              setDialog('none');
            }}
          />

          <YamlDialog
            open={dialog === 'editYaml'}
            onOpenChange={(open) => setDialog(open ? 'editYaml' : 'none')}
            initialYaml={toYaml(detail.raw)}
            lockName={name}
            title={t('resource.action.editYaml')}
            submitLabel={t('common.confirm')}
            pending={update.isPending}
            onSubmit={async (object) => {
              await update.mutateAsync(object as never);
              setDialog('none');
            }}
          />

          <DeleteDialog
            open={dialog === 'delete'}
            onOpenChange={(open) => setDialog(open ? 'delete' : 'none')}
            names={[name]}
            resource="secrets"
            noun={t('secrets.noun')}
            pending={remove.isPending}
            onConfirm={async () => {
              await remove.mutateAsync([name]);
              setDialog('none');
              // The object is gone; staying here would show a 404 on the next refetch.
              void navigate({ to: listRoute, params: listParams });
            }}
          />

          {/* Plain confirmation, like the old `SetDefaultSecretClass`: the effect is reversible in one click. */}
          <SetDefaultConfirm
            open={dialog === 'setDefault'}
            onOpenChange={(open) => setDialog(open ? 'setDefault' : 'none')}
            name={name}
            previous={previousDefault}
            // Held until the previous default is known: confirming before the
            // lookup returns would set the new mark and leave the old one in place.
            pending={setDefault.isPending || defaultRegistry.isPending}
            pendingReason={defaultRegistry.isPending ? t('secrets.setDefault.lookingUp') : undefined}
            onConfirm={async () => {
              await setDefault.mutateAsync({ name, ...(previousDefault ? { previous: previousDefault } : {}) });
              setDialog('none');
            }}
            error={setDefault.error}
          />
        </>
      ) : null}
    </AiSurface>
  );
}

function SetDefaultConfirm({
  open,
  onOpenChange,
  name,
  previous,
  pending,
  pendingReason,
  onConfirm,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  previous: string | undefined;
  pending: boolean;
  /** Shown while the dialog waits for a precondition (e.g. the current default). */
  pendingReason?: string | undefined;
  onConfirm: () => void | Promise<void>;
  error: unknown;
}): React.ReactElement {
  const t = useT();
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('secrets.setDefault.title')}
      description={t('secrets.setDefault.description')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" disabled={pending} {...actionProps('secrets:set-default-confirm')} onClick={() => void onConfirm()}>
            {pendingReason ?? t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 text-xs text-ai-fg-secondary">
        <p>
          {t('secrets.setDefault.subject')}
          <span className="ml-1 rounded-ai-sm bg-ai-surface-2 px-1.5 py-0.5 font-mono text-ai-fg" data-ai-id="secrets:set-default-name">
            {name}
          </span>
        </p>
        {previous ? (
          <p data-ai-id="secrets:set-default-previous">{t('secrets.setDefault.replaceHint', { previous })}</p>
        ) : null}
        {error ? (
          <p role="alert" className="text-ai-danger">
            {errorMessage(t, error)}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function Row({ label, value, aiId }: { label: string; value: string; aiId: string }): React.ReactElement {
  return (
    <>
      <dt className="text-ai-fg-muted">{label}</dt>
      <dd className="min-w-0 break-all text-ai-fg" data-ai-id={aiId}>
        {value}
      </dd>
    </>
  );
}

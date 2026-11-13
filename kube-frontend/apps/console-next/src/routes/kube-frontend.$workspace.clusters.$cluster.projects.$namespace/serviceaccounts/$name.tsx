import * as React from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, AiSurface, Badge, Button, Icon, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import {
  useDeleteServiceAccounts,
  useServiceAccount,
  useServiceAccountSecrets,
  useSetServiceAccountRole,
  useUpdateServiceAccount,
} from '@/pages/serviceaccounts/queries';
import { ServiceAccountSecretsSection } from '@/pages/serviceaccounts/ServiceAccountSecretsSection';
import { ServiceAccountRoleDialog } from '@/pages/serviceaccounts/ServiceAccountRoleDialog';
import { formatTimestamp } from '@/lib/time';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { EditInfoDialog } from '@/components/resource/EditInfoDialog';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { YamlDialog, toYaml } from '@/components/resource/YamlDialog';

/**
 * ServiceAccount detail.
 *
 * Attributes follow the old console (`getAttrs`): 集群、项目、角色、创建时间、创建者 —
 * note that the role sits between project and time. The `数据` section below renders
 * each token Secret with its kubeconfig.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/serviceaccounts/$name')({
  component: ServiceAccountDetailRoute,
});

type Dialog = 'none' | 'delete' | 'editInfo' | 'role' | 'editYaml';

function ServiceAccountDetailRoute() {
  const t = useT();
  const navigate = useNavigate();
  const { cluster, namespace, name, workspace } = Route.useParams();
  const query = useServiceAccount({ cluster, namespace, name });
  const [dialog, setDialog] = React.useState<Dialog>('none');

  const detail = query.data;
  const secrets = useServiceAccountSecrets({ cluster, namespace, names: detail?.secrets ?? [] });

  const remove = useDeleteServiceAccounts({ cluster, namespace });
  const update = useUpdateServiceAccount({ cluster, namespace });
  const setRole = useSetServiceAccountRole({ cluster, namespace });
  const mutationError = remove.error ?? update.error ?? setRole.error;

  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  const listRoute = '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/serviceaccounts';
  const listParams = { workspace, cluster, namespace };

  return (
    <AiSurface as="section" aiId="serviceaccount-detail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <div>
        <Link
          to={listRoute}
          params={listParams}
          className="inline-flex items-center gap-1 text-xs text-ai-accent hover:underline"
          {...actionProps('serviceaccount-detail:back')}
        >
          <Icon name="chevron-left" size={12} />
          {t('serviceaccounts.title')}
        </Link>
      </div>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}

      {state === 'error' ? (
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="serviceaccount-detail:retry" />
      ) : null}

      {detail ? (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-base font-semibold text-ai-fg">{detail.alias || detail.name}</h1>
                {detail.alias ? <span className="truncate text-xs text-ai-fg-muted">{detail.name}</span> : null}
                {detail.federated ? <Badge tone="info">{t('resource.federated')}</Badge> : null}
              </div>
              {detail.description ? <p className="text-xs text-ai-fg-muted">{detail.description}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <AiButton aiId="serviceaccount-detail:edit-info" size="sm" variant="secondary" onClick={() => setDialog('editInfo')}>
                {t('resource.action.editInfo')}
              </AiButton>
              <Button variant="ghost" size="sm" {...actionProps('serviceaccount-detail:edit-yaml')} onClick={() => setDialog('editYaml')}>
                {t('resource.action.editYaml')}
              </Button>
              <AiButton aiId="serviceaccount-detail:change-role" size="sm" variant="secondary" onClick={() => setDialog('role')}>
                {t('serviceaccounts.action.changeRole')}
              </AiButton>
              <AiButton aiId="serviceaccount-detail:delete" size="sm" variant="danger" onClick={() => setDialog('delete')}>
                {t('common.delete')}
              </AiButton>
            </div>
          </header>

          <section className="rounded-ai-md border border-ai-line p-4">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('resource.attributes')}</h2>
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
              <Row label={t('resource.field.cluster')} value={cluster} aiId="serviceaccount-detail:attr-cluster" />
              <Row label={t('resource.field.project')} value={namespace} aiId="serviceaccount-detail:attr-project" />
              <Row label={t('serviceaccounts.field.role')} value={detail.role || ''} aiId="serviceaccount-detail:attr-role" />
              <Row label={t('resource.field.createdAt')} value={formatTimestamp(detail.createdAt)} aiId="serviceaccount-detail:attr-created" />
              <Row label={t('resource.field.creator')} value={detail.creator || '-'} aiId="serviceaccount-detail:attr-creator" />
            </dl>
          </section>

          <ServiceAccountSecretsSection
            detail={detail}
            secrets={detail.secrets.map((_, index) => secrets.data?.[index])}
            loading={secrets.isPending && detail.secrets.length > 0}
          />

          <MutationAlert error={mutationError} />

          <EditInfoDialog
            open={dialog === 'editInfo'}
            onOpenChange={(open) => setDialog(open ? 'editInfo' : 'none')}
            resource="serviceaccounts"
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

          <ServiceAccountRoleDialog
            open={dialog === 'role'}
            onOpenChange={(open) => setDialog(open ? 'role' : 'none')}
            cluster={cluster}
            namespace={namespace}
            name={name}
            role={detail.role}
            pending={setRole.isPending}
            onSubmit={async (role) => {
              await setRole.mutateAsync({ name, role });
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
            resource="serviceaccounts"
            noun={t('serviceaccounts.noun')}
            pending={remove.isPending}
            onConfirm={async () => {
              await remove.mutateAsync([name]);
              setDialog('none');
              void navigate({ to: listRoute, params: listParams });
            }}
          />
        </>
      ) : null}
    </AiSurface>
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

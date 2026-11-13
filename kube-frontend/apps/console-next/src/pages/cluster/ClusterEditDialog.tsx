import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, CLUSTER_GROUPS, CLUSTER_PROVIDERS, clusterWriteApi, type ClusterSummary } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Button, Modal } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage } from '@/components/resource/ResourceErrorPanel';

/**
 * 编辑信息 for a cluster — the old console's `EditBasicInfoModal`.
 *
 * What can be changed here is what the old console lets you change: the alias, the tag
 * (the `cluster.kubesphere.io/group` label), the provider, and the description. The name
 * is shown but read-only — it is the object's identity, referenced by every URL and by
 * the federation.
 *
 * Everything else about a cluster object belongs to the installer (its connection, its
 * modules, its addresses). Offering those would let a click silently disagree with the
 * thing that actually configured the cluster, so they are not here.
 */
export interface ClusterEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: ClusterSummary | null;
  onSaved?: () => void;
}

const ALIAS_MAX = 63;
const DESCRIPTION_MAX = 256;

export function ClusterEditDialog({ open, onOpenChange, cluster, onSaved }: ClusterEditDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [alias, setAlias] = React.useState('');
  const [group, setGroup] = React.useState('');
  const [provider, setProvider] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [aliasError, setAliasError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !cluster) return;
    setAlias(cluster.alias);
    setGroup(cluster.group);
    setProvider(cluster.provider);
    setDescription(cluster.description ?? '');
    setAliasError(null);
  }, [open, cluster]);

  const mutation = useMutation({
    mutationFn: (input: { alias: string; group: string; provider: string; description: string }) =>
      clusterWriteApi(apiClient).updateBasicInfo({ cluster: cluster?.name ?? '', ...input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clusters'] });
      onSaved?.();
      onOpenChange(false);
    },
  });

  const submit = React.useCallback(() => {
    if (alias.trim().length > ALIAS_MAX) {
      setAliasError(t('cluster.edit.aliasHint'));
      return;
    }
    setAliasError(null);
    mutation.mutate({ alias, group, provider, description });
  }, [alias, description, group, mutation, provider, t]);

  const requestError = mutation.error
    ? mutation.error instanceof ApiError && mutation.error.isPermission
      ? t('error.unauthorized')
      : errorMessage(t, mutation.error)
    : null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('cluster.edit.title')}
      description={t('cluster.edit.description')}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} {...actionProps('clusters:edit-cancel')}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} loading={mutation.isPending} {...actionProps('clusters:edit-submit')}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-cluster-edit-name">
          {t('cluster.edit.name')}
          <input
            id="ai-field-cluster-edit-name"
            value={cluster?.name ?? ''}
            readOnly
            disabled
            className="h-9 rounded-ai-md border border-ai-line bg-ai-surface-2 px-2 text-sm text-ai-fg-muted"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-cluster-edit-alias">
          {t('cluster.edit.alias')}
          <input
            id="ai-field-cluster-edit-alias"
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
            maxLength={ALIAS_MAX}
            className="h-9 rounded-ai-md border border-ai-line bg-ai-surface px-2 text-sm text-ai-fg"
            {...actionProps('clusters:edit-alias')}
          />
          <span className="text-[11px] text-ai-fg-muted">{t('cluster.edit.aliasHint')}</span>
          {aliasError ? <span className="text-[11px] text-ai-danger" role="alert">{aliasError}</span> : null}
        </label>

        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-cluster-edit-group">
          {t('cluster.edit.group')}
          <select
            id="ai-field-cluster-edit-group"
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            className="h-9 rounded-ai-md border border-ai-line bg-ai-surface px-2 text-sm text-ai-fg"
            {...actionProps('clusters:edit-group')}
          >
            <option value="">{t('cluster.group.none')}</option>
            {CLUSTER_GROUPS.map((value) => (
              <option key={value} value={value}>
                {t(`cluster.group.${value}` as never)}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-ai-fg-muted">{t('cluster.edit.groupHint')}</span>
        </label>

        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-cluster-edit-provider">
          {t('cluster.edit.provider')}
          <input
            id="ai-field-cluster-edit-provider"
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            list="cluster-provider-options"
            className="h-9 rounded-ai-md border border-ai-line bg-ai-surface px-2 text-sm text-ai-fg"
            {...actionProps('clusters:edit-provider')}
          />
          <datalist id="cluster-provider-options">
            {CLUSTER_PROVIDERS.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
          <span className="text-[11px] text-ai-fg-muted">{t('cluster.edit.providerHint')}</span>
        </label>

        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-cluster-edit-description">
          {t('cluster.edit.descriptionLabel')}
          <textarea
            id="ai-field-cluster-edit-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={DESCRIPTION_MAX}
            rows={3}
            className="rounded-ai-md border border-ai-line bg-ai-surface p-2 text-sm text-ai-fg"
            {...actionProps('clusters:edit-description')}
          />
          <span className="text-[11px] text-ai-fg-muted">{t('cluster.edit.descriptionHint')}</span>
        </label>

        {requestError ? (
          <p className="text-xs text-ai-danger" role="alert" data-ai-id="clusters:edit-error">
            {requestError}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

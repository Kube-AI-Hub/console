import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, clusterWriteApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Alert, Button, FormField, Input, Modal, Notify } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage } from '@/components/resource/ResourceErrorPanel';
import { ALIAS_MAX, ClusterIdentityFields } from './ClusterIdentityFields';

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
 *
 * The four fields come from `ClusterIdentityFields`, the same component 添加集群 uses.
 * They were duplicated before, and the copies had already drifted: this dialog's tag
 * list was missing `demo`, and its provider was a plain text input with a `<datalist>`
 * while 添加集群 had the shared searchable `Select`. One component is the only way the
 * two dialogs cannot disagree about what a cluster's alias or tag is.
 */
/**
 * The four writable attributes.
 *
 * Narrow on purpose: the list row (`ClusterSummary`) and the settings page's detail
 * object both satisfy it, so there is exactly **one** editor for these fields. A second
 * editor that knew only some of them would let the two pages disagree about what a
 * cluster's alias is.
 */
export interface ClusterEditable {
  name: string;
  alias: string;
  group: string;
  provider: string;
  description: string;
}

export interface ClusterEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: ClusterEditable | null;
  onSaved?: () => void;
}

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
      // Same confirmation the add dialog gives: a dialog that vanishes silently leaves
      // the reader unsure whether the write happened.
      Notify.success({ content: t('common.saved') });
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
      <div className="flex flex-col gap-4">
        {/* Same placement as 添加集群: the failure is at the top, where a long form
            cannot scroll it under the confirm button. */}
        {requestError ? (
          <Alert tone="danger" title={t('cluster.edit.failedTitle')} data-ai-id="clusters:edit-error">
            <p>{requestError}</p>
          </Alert>
        ) : null}

        <FormField htmlFor="ai-field-cluster-edit-name" label={t('cluster.edit.name')} hint={t('cluster.edit.nameHint')}>
          <Input
            id="ai-field-cluster-edit-name"
            value={cluster?.name ?? ''}
            readOnly
            disabled
            className="bg-ai-surface-2 text-ai-fg-muted"
          />
        </FormField>

        <ClusterIdentityFields
          idPrefix="ai-field-cluster-edit"
          aiPrefix="clusters:edit"
          alias={alias}
          onAliasChange={setAlias}
          group={group}
          onGroupChange={setGroup}
          provider={provider}
          onProviderChange={setProvider}
          description={description}
          onDescriptionChange={setDescription}
          aliasError={aliasError}
        />
      </div>
    </Modal>
  );
}

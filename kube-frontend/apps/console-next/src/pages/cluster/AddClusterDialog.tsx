import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, clusterImportApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Button, Modal, Textarea } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage } from '@/components/resource/ResourceErrorPanel';

/**
 * 添加集群 — import an existing cluster with its kubeconfig.
 *
 * The old console's 添加集群 offers two ways in: import an existing cluster, or
 * provision a new one with KubeKey. Only the import half is offered here: provisioning
 * needs the kubekey API plus a host inventory, while importing is a single object write
 * and is how a member cluster actually joins a running platform.
 *
 * Both fields are validated before the request: a name that Kubernetes rejects and a
 * kubeconfig that is not a kubeconfig both come back as a 422 whose message says nothing
 * a reader can act on.
 */
export interface AddClusterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the object is created, so the list can refetch. */
  onCreated?: () => void;
}

const NAME_PATTERN = /^[a-z][a-z0-9-]*[a-z0-9]$/;

export function AddClusterDialog({ open, onOpenChange, onCreated }: AddClusterDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [name, setName] = React.useState('');
  const [kubeconfig, setKubeconfig] = React.useState('');
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [kubeconfigError, setKubeconfigError] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: { name: string; kubeconfig: string }) => clusterImportApi(apiClient).import(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clusters'] });
      onCreated?.();
      onOpenChange(false);
      setName('');
      setKubeconfig('');
    },
  });

  const submit = React.useCallback(() => {
    const trimmedName = name.trim();
    const trimmedConfig = kubeconfig.trim();
    const invalidName = !NAME_PATTERN.test(trimmedName);
    setNameError(invalidName ? t('cluster.add.nameInvalid') : null);
    // A kubeconfig always carries these three keys; checking for them catches a paste of
    // the wrong document without pretending to parse YAML here.
    const looksLikeKubeconfig =
      trimmedConfig.includes('apiVersion') && trimmedConfig.includes('clusters:') && trimmedConfig.includes('server:');
    setKubeconfigError(looksLikeKubeconfig ? null : t('cluster.add.kubeconfigInvalid'));
    if (invalidName || !looksLikeKubeconfig) return;
    mutation.mutate({ name: trimmedName, kubeconfig: trimmedConfig });
  }, [kubeconfig, mutation, name, t]);

  const requestError = mutation.error
    ? mutation.error instanceof ApiError && mutation.error.isPermission
      ? t('error.unauthorized')
      : errorMessage(t, mutation.error)
    : null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('cluster.add.title')}
      description={t('cluster.add.description')}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} {...actionProps('clusters:add-cancel')}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} loading={mutation.isPending} {...actionProps('clusters:add-submit')}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-cluster-name">
          {t('cluster.add.name')}
          <input
            id="ai-field-cluster-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-9 rounded-ai-md border border-ai-line bg-ai-surface px-2 text-sm text-ai-fg"
            placeholder="member-cluster"
            {...actionProps('clusters:add-name')}
          />
          <span className="text-[11px] text-ai-fg-muted">{t('cluster.add.nameHint')}</span>
          {nameError ? <span className="text-[11px] text-ai-danger" role="alert">{nameError}</span> : null}
        </label>

        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-cluster-kubeconfig">
          {t('cluster.add.kubeconfig')}
          <Textarea
            id="ai-field-cluster-kubeconfig"
            value={kubeconfig}
            onChange={(event) => setKubeconfig(event.target.value)}
            rows={8}
            className="font-mono text-[11px]"
            placeholder="apiVersion: v1&#10;clusters:&#10;- cluster:&#10;    server: https://…"
            {...actionProps('clusters:add-kubeconfig')}
          />
          <span className="text-[11px] text-ai-fg-muted">{t('cluster.add.kubeconfigHint')}</span>
          {kubeconfigError ? (
            <span className="text-[11px] text-ai-danger" role="alert">{kubeconfigError}</span>
          ) : null}
        </label>

        {requestError ? (
          <p className="text-xs text-ai-danger" role="alert" data-ai-id="clusters:add-error">
            {requestError}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

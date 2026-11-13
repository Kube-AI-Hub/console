import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, clusterWriteApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Button, Modal, Textarea } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage } from '@/components/resource/ResourceErrorPanel';

/**
 * 更新 kubeconfig — the old console's `cluster.updateKubeConfig`.
 *
 * Only for direct-connected member clusters: a proxy cluster is reached by its agent
 * dialling out, so there is no kubeconfig to replace and the row action is hidden rather
 * than failing. The request goes through the kapis subresource, which parses the
 * kubeconfig and reports what is wrong with it — that message is what a reader needs
 * (our own structural check can only say "this is not a kubeconfig").
 */
export interface UpdateKubeconfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: { name: string } | null;
  onUpdated?: () => void;
}

const looksLikeKubeconfig = (value: string): boolean =>
  value.includes('apiVersion') && value.includes('clusters:') && value.includes('server:');

export function UpdateKubeconfigDialog({ open, onOpenChange, cluster, onUpdated }: UpdateKubeconfigDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [value, setValue] = React.useState('');
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setValue('');
    setLocalError(null);
  }, [open, cluster?.name]);

  const mutation = useMutation({
    mutationFn: () => clusterWriteApi(apiClient).updateKubeconfig({ cluster: cluster?.name ?? '', kubeconfig: value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clusters'] });
      onUpdated?.();
      onOpenChange(false);
    },
  });

  const submit = (): void => {
    // A structural check first: pasting the wrong document should not cost a round trip,
    // and the server's parse error for an empty body says nothing useful.
    if (!looksLikeKubeconfig(value)) {
      setLocalError(t('cluster.kubeconfig.invalid'));
      return;
    }
    setLocalError(null);
    mutation.mutate();
  };

  const requestError = mutation.error
    ? mutation.error instanceof ApiError && mutation.error.isPermission
      ? t('error.unauthorized')
      : errorMessage(t, mutation.error)
    : null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('cluster.kubeconfig.title')}
      description={t('cluster.kubeconfig.description')}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} {...actionProps('clusters:kubeconfig-cancel')}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" loading={mutation.isPending} {...actionProps('clusters:kubeconfig-submit')} onClick={submit}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Textarea
          id="ai-field-cluster-kubeconfig"
          value={value}
          rows={10}
          onChange={(event) => setValue(event.target.value)}
          className="font-mono text-[11px]"
          placeholder={'apiVersion: v1\nclusters:\n- cluster:\n    server: https://…'}
          {...actionProps('clusters:kubeconfig-input')}
        />
        <p className="text-[11px] text-ai-fg-muted">{t('cluster.kubeconfig.hint')}</p>
        {localError ? (
          <p className="text-xs text-ai-danger" role="alert" data-ai-id="clusters:kubeconfig-error">
            {localError}
          </p>
        ) : null}
        {requestError ? (
          <p className="text-xs text-ai-danger" role="alert" data-ai-id="clusters:kubeconfig-server-error">
            {requestError}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

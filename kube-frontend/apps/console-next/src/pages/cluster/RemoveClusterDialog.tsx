import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, clusterWriteApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Button, Input, Modal } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage } from '@/components/resource/ResourceErrorPanel';

/**
 * 移除集群 — the old console's `cluster.unbind`.
 *
 * Removing a cluster deletes the platform's `Cluster` object. It does **not** touch the
 * member cluster or anything running on it; that is the point of the warning, because
 * "remove" reads like "delete the cluster" and the difference matters.
 *
 * Confirmation is the object's name, typed. A checkbox next to a red button is dismissed
 * in a second and protects nobody; typing a name that is on screen forces the reader to
 * look at which cluster they picked, which is the mistake that actually happens when
 * several member clusters have similar names.
 */
export interface RemoveClusterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: { name: string; alias?: string } | null;
  onRemoved?: () => void;
}

export function RemoveClusterDialog({ open, onOpenChange, cluster, onRemoved }: RemoveClusterDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [typed, setTyped] = React.useState('');

  React.useEffect(() => {
    if (open) setTyped('');
  }, [open, cluster?.name]);

  const mutation = useMutation({
    mutationFn: () => clusterWriteApi(apiClient).remove({ cluster: cluster?.name ?? '' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clusters'] });
      onRemoved?.();
      onOpenChange(false);
    },
  });

  const confirmed = typed.trim() === (cluster?.name ?? '');
  const requestError = mutation.error
    ? mutation.error instanceof ApiError && mutation.error.isPermission
      ? t('error.unauthorized')
      : errorMessage(t, mutation.error)
    : null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('cluster.remove.title')}
      description={t('cluster.remove.description')}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} {...actionProps('clusters:remove-cancel')}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={!confirmed}
            loading={mutation.isPending}
            {...actionProps('clusters:remove-confirm')}
            onClick={() => mutation.mutate()}
          >
            {t('cluster.remove.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-ai-id="clusters:remove-dialog">
        <div className="rounded-ai-md border border-ai-line bg-ai-surface-2 p-3 text-xs text-ai-fg-secondary">
          <p className="mb-1 font-medium text-ai-fg">{t('cluster.remove.warningTitle')}</p>
          <p>{t('cluster.remove.warningA')}</p>
          <p>{t('cluster.remove.warningB')}</p>
        </div>
        <p className="text-xs text-ai-fg-muted">
          {t('cluster.remove.typeToConfirm', { name: cluster?.name ?? '' })}
        </p>
        <Input
          value={typed}
          aria-label={t('cluster.remove.title')}
          placeholder={cluster?.name ?? ''}
          {...actionProps('clusters:remove-input')}
          onChange={(event) => setTyped(event.target.value)}
        />
        {requestError ? (
          <p className="text-xs text-ai-danger" role="alert">
            {requestError}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

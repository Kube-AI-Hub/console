import * as React from 'react';
import { Button, Modal } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';

/**
 * 「设为默认镜像仓库」确认框.
 *
 * The mark lives in an annotation, and the image puller reads whichever Secret carries
 * it — two marked Secrets leave the choice undefined. So the dialog names the Secret that
 * will lose the mark before anything is written, and the confirm is only enabled once the
 * previous default is known (a missing lookup is "nothing to clear", an in-flight one is
 * not).
 */
export interface SetDefaultSecretDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The Secret that becomes the default. */
  name: string;
  /** The Secret that currently carries the mark, if any. */
  previous?: string;
  /** The lookup that finds `previous` is still running. */
  loadingPrevious?: boolean;
  pending?: boolean;
  onSubmit: () => void | Promise<void>;
}

export function SetDefaultSecretDialog({
  open,
  onOpenChange,
  name,
  previous,
  loadingPrevious = false,
  pending = false,
  onSubmit,
}: SetDefaultSecretDialogProps): React.ReactElement {
  const t = useT();
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('secrets.action.setDefault')}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            {...actionProps('secrets:set-default-confirm')}
            disabled={pending || loadingPrevious}
            onClick={() => void onSubmit()}
          >
            {pending ? t('common.loading') : t('common.confirm')}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-ai-fg-secondary" data-ai-id="secrets:set-default-body">
        {previous && previous !== name
          ? t('secrets.setDefaultHint', { name, previous })
          : t('secrets.setDefaultHintNoPrevious', { name })}
      </p>
    </Modal>
  );
}

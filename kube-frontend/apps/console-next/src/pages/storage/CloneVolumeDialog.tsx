import * as React from 'react';
import { Button, Input, Modal } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';

/**
 * 克隆存储卷.
 *
 * A clone inherits everything that defines the volume — class, access modes, size — so the only
 * thing to type is the new name. Asking for the rest again would let a reader produce something
 * that is not a clone at all, and the apiserver requires the dataSource to match the source claim.
 */
export interface CloneVolumeDialogProps {
  open: boolean;
  source: { name: string; storageClass: string; capacity: string };
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void | Promise<void>;
}

const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

export function CloneVolumeDialog({ open, source, pending = false, onOpenChange, onSubmit }: CloneVolumeDialogProps): React.ReactElement {
  const t = useT();
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    // A default that is obviously derived from the source, and still unique: the reader who
    // accepts it gets a name they can find again.
    setName(`${source.name}-clone`.slice(0, 63).replace(/-$/, ''));
    setError('');
  }, [open, source.name]);

  if (!open) return <></>;

  const submit = async () => {
    setError('');
    const trimmed = name.trim();
    if (!trimmed) return setError(t('storage.create.nameRequired'));
    if (!NAME_PATTERN.test(trimmed)) return setError(t('storage.create.nameInvalid'));
    if (trimmed === source.name) return setError(t('storage.clone.sameName'));
    try {
      await onSubmit(trimmed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => { if (!pending) onOpenChange(next); }}
      title={t('storage.clone.title')}
      description={t('storage.clone.description', { source: source.name, storageClass: source.storageClass || '-', capacity: source.capacity || '-' })}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button {...actionProps('storage-clone:submit')} disabled={pending} onClick={() => void submit()}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ai-fg-muted">{t('storage.clone.name')}</span>
          <Input data-ai-id="storage-clone:name" value={name} disabled={pending} onChange={(event) => setName(event.target.value)} />
        </label>
        <span className="text-xs text-ai-fg-muted">{t('storage.clone.hint')}</span>
        {error ? <p role="alert" data-ai-id="storage-clone:error" className="text-sm text-ai-danger">{error}</p> : null}
      </div>
    </Modal>
  );
}

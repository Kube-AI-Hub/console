import * as React from 'react';
import { Button, Input, Modal, Select } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';
import type { SnapshotClassRow } from './queries';

/**
 * 创建快照.
 *
 * A VolumeSnapshot has to name a snapshot class whose driver matches the claim's provisioner —
 * the cluster's storage layer rejects a class from another driver, so offering every class would
 * produce a write that fails for a reason the reader cannot see. When no class matches, the
 * dialog says so instead of offering an empty select: an empty dropdown reads as a bug.
 */
export interface CreateSnapshotDialogProps {
  open: boolean;
  claim: string;
  /** The claim's provisioner, so the dialog can explain an empty class list. */
  provisioner: string;
  classes: SnapshotClassRow[];
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { name: string; snapshotClass: string }) => void | Promise<void>;
}

const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

export function CreateSnapshotDialog({
  open,
  claim,
  provisioner,
  classes,
  pending = false,
  onOpenChange,
  onSubmit,
}: CreateSnapshotDialogProps): React.ReactElement {
  const t = useT();
  const [name, setName] = React.useState('');
  const [snapshotClass, setSnapshotClass] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setName(`${claim}-snapshot`.slice(0, 63).replace(/-$/, ''));
    setSnapshotClass(classes[0]?.name ?? '');
    setError('');
  }, [open, claim, classes]);

  if (!open) return <></>;

  const submit = async () => {
    setError('');
    const trimmed = name.trim();
    if (!trimmed) return setError(t('storage.create.nameRequired'));
    if (!NAME_PATTERN.test(trimmed)) return setError(t('storage.create.nameInvalid'));
    if (!snapshotClass) return setError(t('storage.snapshot.classRequired'));
    try {
      await onSubmit({ name: trimmed, snapshotClass });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => { if (!pending) onOpenChange(next); }}
      title={t('storage.snapshot.title')}
      description={t('storage.snapshot.description', { claim })}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button {...actionProps('storage-snapshot:submit')} disabled={pending || classes.length === 0} onClick={() => void submit()}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ai-fg-muted">{t('storage.snapshot.name')}</span>
          <Input data-ai-id="storage-snapshot:name" value={name} disabled={pending} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ai-fg-muted">{t('storage.snapshot.class')}</span>
          {classes.length === 0 ? (
            <p className="text-xs text-ai-warning" data-ai-id="storage-snapshot:no-class">
              {t('storage.snapshot.noClass', { driver: provisioner || '-' })}
            </p>
          ) : (
            <Select
              value={snapshotClass}
              options={classes.map((entry) => ({ value: entry.name, label: `${entry.name}（${entry.driver}）` }))}
              data-ai-id="storage-snapshot:class"
              aria-label={t('storage.snapshot.class')}
              onValueChange={(value: string) => setSnapshotClass(value)}
            />
          )}
        </label>
        {error ? <p role="alert" data-ai-id="storage-snapshot:error" className="text-sm text-ai-danger">{error}</p> : null}
      </div>
    </Modal>
  );
}

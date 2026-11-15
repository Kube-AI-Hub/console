import * as React from 'react';
import { Button, Input, Modal, Select, Textarea } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { claimManifest, type KubeObject, type StorageClassSummary, type StorageSummary } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { MutationAlert } from '@/components/resource/ResourceErrorPanel';

/**
 * 创建存储卷.
 *
 * The old console's create flow is two shapes behind one entry: a claim provisioned from a
 * StorageClass, or a claim restored from an existing snapshot. Both are offered here because a
 * reader who wants the second one has no other path — and the difference is not cosmetic: a
 * restored claim inherits its class from the snapshot, so the class field disappears.
 *
 * The class decides two other fields: which access modes the driver supports and how large the
 * claim may be. Both are read from the class rather than guessed, so the form cannot offer a
 * mode the driver will reject or a size outside the driver's bounds.
 */
export interface CreateVolumeDialogProps {
  open: boolean;
  namespace: string;
  classes: StorageClassSummary[];
  /** Snapshots available to restore from; only ready ones are offered. */
  snapshots: StorageSummary[];
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: KubeObject) => void | Promise<void>;
}

type Method = 'new' | 'snapshot';

/** The four modes Kubernetes defines; a class that declares its own list narrows this. */
const ALL_ACCESS_MODES = ['ReadWriteOnce', 'ReadOnlyMany', 'ReadWriteMany', 'ReadWriteOncePod'];
const PREFERRED_ACCESS_MODE = 'ReadWriteOnce';
const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

export function CreateVolumeDialog({
  open,
  namespace,
  classes,
  snapshots,
  pending = false,
  onOpenChange,
  onSubmit,
}: CreateVolumeDialogProps): React.ReactElement {
  const t = useT();
  const [method, setMethod] = React.useState<Method>('new');
  const [name, setName] = React.useState('');
  const [alias, setAlias] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [storageClass, setStorageClass] = React.useState('');
  const [accessModes, setAccessModes] = React.useState<string[]>([PREFERRED_ACCESS_MODE]);
  const [size, setSize] = React.useState('10');
  const [snapshot, setSnapshot] = React.useState('');
  const [error, setError] = React.useState('');

  const selectedClass = classes.find((entry) => entry.name === storageClass);
  const supportedModes = selectedClass?.supportedAccessModes?.length
    ? selectedClass.supportedAccessModes
    : ALL_ACCESS_MODES;
  const sizeConfig = selectedClass?.sizeConfig ?? { min: 0, max: 2048, step: 1 };

  // Seed on open: the default class is what most claims should use, and the old console's
  // form preselects it for the same reason.
  React.useEffect(() => {
    if (!open) return;
    const fallback = classes.find((entry) => entry.isDefault)?.name ?? '';
    setMethod('new');
    setName('');
    setAlias('');
    setDescription('');
    setStorageClass(fallback);
    setAccessModes([PREFERRED_ACCESS_MODE]);
    setSize('10');
    setSnapshot(snapshots[0]?.name ?? '');
    setError('');
  }, [open, classes, snapshots]);

  // A class change is a different set of modes; keeping the old pick would submit a mode the
  // driver does not support.
  React.useEffect(() => {
    if (!open) return;
    setAccessModes((current) => {
      const usable = current.filter((mode) => supportedModes.includes(mode));
      if (usable.length > 0) return usable;
      return [supportedModes.includes(PREFERRED_ACCESS_MODE) ? PREFERRED_ACCESS_MODE : supportedModes[0] ?? PREFERRED_ACCESS_MODE];
    });
  }, [open, storageClass, supportedModes.join(',')]);

  if (!open) return <></>;

  const toggleMode = (mode: string) => {
    setAccessModes((current) =>
      current.includes(mode) ? current.filter((entry) => entry !== mode) : [...current, mode],
    );
  };

  const submit = async () => {
    setError('');
    const trimmed = name.trim();
    if (!trimmed) return setError(t('storage.create.nameRequired'));
    if (!NAME_PATTERN.test(trimmed)) return setError(t('storage.create.nameInvalid'));
    if (accessModes.length === 0) return setError(t('storage.create.accessRequired'));
    const numeric = Number(size);
    if (!Number.isFinite(numeric) || numeric <= 0) return setError(t('storage.create.sizeRequired'));
    if (numeric < sizeConfig.min || numeric > sizeConfig.max) {
      return setError(t('storage.create.sizeOutOfRange', { min: sizeConfig.min, max: sizeConfig.max }));
    }
    if (method === 'snapshot' && !snapshot) return setError(t('storage.create.snapshotRequired'));

    const body = claimManifest({
      name: trimmed,
      namespace,
      storageClass: method === 'new' ? storageClass : '',
      accessModes,
      storage: `${numeric}Gi`,
      alias,
      description,
      fromSnapshot: method === 'snapshot' ? { name: snapshot } : undefined,
    });
    try {
      await onSubmit(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => { if (!pending) onOpenChange(next); }}
      size="lg"
      title={t('storage.create.title')}
      description={t('storage.create.description', { namespace })}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button {...actionProps('storage-create:submit')} disabled={pending} onClick={() => void submit()}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ai-fg-muted">{t('storage.create.method')}</span>
          <Select
            value={method}
            options={[
              { value: 'new', label: t('storage.create.method.new') },
              { value: 'snapshot', label: t('storage.create.method.snapshot') },
            ]}
            data-ai-id="storage-create:method"
            aria-label={t('storage.create.method')}
            onValueChange={(value: string) => setMethod(value as Method)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ai-fg-muted">{t('storage.create.name')}</span>
          <Input
            data-ai-id="storage-create:name"
            value={name}
            disabled={pending}
            placeholder="pvc-name"
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ai-fg-muted">{t('storage.create.alias')}</span>
          <Input data-ai-id="storage-create:alias" value={alias} disabled={pending} onChange={(event) => setAlias(event.target.value)} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ai-fg-muted">{t('storage.create.description.label')}</span>
          <Textarea
            data-ai-id="storage-create:description"
            value={description}
            disabled={pending}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        {method === 'new' ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ai-fg-muted">{t('storage.create.storageClass')}</span>
            <Select
              value={storageClass}
              options={classes.map((entry) => ({
                value: entry.name,
                label: entry.isDefault ? `${entry.name}${t('storage.create.defaultClass')}` : entry.name,
              }))}
              placeholder={t('storage.create.storageClassPlaceholder')}
              data-ai-id="storage-create:storage-class"
              aria-label={t('storage.create.storageClass')}
              onValueChange={(value: string) => setStorageClass(value)}
            />
            <span className="text-xs text-ai-fg-muted">{t('storage.create.storageClassHint')}</span>
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ai-fg-muted">{t('storage.create.snapshot')}</span>
            {snapshots.length === 0 ? (
              <p className="text-xs text-ai-warning" data-ai-id="storage-create:no-snapshot">
                {t('storage.create.noSnapshot')}
              </p>
            ) : (
              <Select
                value={snapshot}
                options={snapshots.map((entry) => ({ value: entry.name, label: entry.name }))}
                data-ai-id="storage-create:snapshot"
                aria-label={t('storage.create.snapshot')}
                onValueChange={(value: string) => setSnapshot(value)}
              />
            )}
            <span className="text-xs text-ai-fg-muted">{t('storage.create.snapshotHint')}</span>
          </label>
        )}

        <div className="flex flex-col gap-1 text-sm">
          <span className="text-ai-fg-muted">{t('storage.create.accessModes')}</span>
          <div className="flex flex-wrap gap-3" data-ai-id="storage-create:access-modes">
            {supportedModes.map((mode) => (
              <label key={mode} className="inline-flex min-h-6 items-center gap-1 text-sm text-ai-fg">
                <input
                  type="checkbox"
                  checked={accessModes.includes(mode)}
                  data-ai-id={`storage-create:access-mode:${mode}`}
                  disabled={pending}
                  onChange={() => toggleMode(mode)}
                />
                {mode}
              </label>
            ))}
          </div>
          <span className="text-xs text-ai-fg-muted">{t('storage.create.accessModesHint')}</span>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ai-fg-muted">{t('storage.create.size')}</span>
          <div className="flex items-center gap-2">
            <Input
              data-ai-id="storage-create:size"
              value={size}
              disabled={pending}
              inputMode="numeric"
              onChange={(event) => setSize(event.target.value)}
            />
            <span className="text-sm text-ai-fg-muted">Gi</span>
          </div>
          <span className="text-xs text-ai-fg-muted">
            {t('storage.create.sizeHint', { min: sizeConfig.min, max: sizeConfig.max, step: sizeConfig.step })}
          </span>
        </label>

        <MutationAlert error={null} />
        {error ? <p role="alert" data-ai-id="storage-create:error" className="text-sm text-ai-danger">{error}</p> : null}
      </div>
    </Modal>
  );
}

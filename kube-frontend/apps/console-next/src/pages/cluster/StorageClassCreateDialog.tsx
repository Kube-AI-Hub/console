import * as React from 'react';
import { Button, Input, Modal, Select } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import type { StorageClassDraft } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';

/**
 * 创建存储类型.
 *
 * The old console's create form: provisioner, reclaim policy, binding mode and the three
 * volume capabilities. Parameters are driver-specific and are left to 编辑 YAML — asking a
 * form to enumerate every CSI driver's keys would produce a form that fits one driver.
 */
export interface StorageClassCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: string;
  pending?: boolean;
  isNameTaken: (name: string) => boolean;
  onSubmit: (draft: StorageClassDraft) => void | Promise<void>;
}

const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export function StorageClassCreateDialog({
  open,
  onOpenChange,
  cluster,
  pending = false,
  isNameTaken,
  onSubmit,
}: StorageClassCreateDialogProps): React.ReactElement {
  const t = useT();
  const [name, setName] = React.useState('');
  const [provisioner, setProvisioner] = React.useState('');
  const [reclaimPolicy, setReclaimPolicy] = React.useState<'Delete' | 'Retain'>('Delete');
  const [volumeBindingMode, setVolumeBindingMode] = React.useState<'Immediate' | 'WaitForFirstConsumer'>('Immediate');
  const [allowExpansion, setAllowExpansion] = React.useState(false);
  const [allowCloning, setAllowCloning] = React.useState(false);
  const [allowSnapshot, setAllowSnapshot] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setName('');
    setProvisioner('');
    setReclaimPolicy('Delete');
    setVolumeBindingMode('Immediate');
    setAllowExpansion(false);
    setAllowCloning(false);
    setAllowSnapshot(false);
    setError(null);
  }, [open]);

  const submit = (): void => {
    const trimmed = name.trim();
    const driver = provisioner.trim();
    if (!NAME_PATTERN.test(trimmed)) return setError(t('cluster.storageClasses.error.name'));
    if (isNameTaken(trimmed)) return setError(t('cluster.storageClasses.error.duplicate'));
    if (!driver) return setError(t('cluster.storageClasses.error.provisioner'));
    setError(null);
    void onSubmit({
      cluster,
      name: trimmed,
      provisioner: driver,
      reclaimPolicy,
      volumeBindingMode,
      allowVolumeExpansion: allowExpansion,
      allowCloning,
      allowSnapshot,
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('cluster.storageClasses.create')}
      description={t('cluster.storageClasses.createDescription')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" loading={pending} {...actionProps('storageclasses:create-submit')} onClick={submit}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-ai-id="storageclasses:create-dialog">
        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
          {t('cluster.storageClasses.name')}
          <Input
            value={name}
            placeholder="fast-ssd"
            {...actionProps('storageclasses:create-name')}
            onChange={(event) => setName(event.target.value)}
          />
          <span className="text-[11px] text-ai-fg-muted">{t('cluster.storageClasses.nameHint')}</span>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
          {t('cluster.storageClasses.provisioner')}
          <Input
            value={provisioner}
            placeholder="csi.example.com"
            {...actionProps('storageclasses:create-provisioner')}
            onChange={(event) => setProvisioner(event.target.value)}
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
            {t('pv.detail.reclaimPolicy')}
            <div {...actionProps('storageclasses:create-reclaim')}>
              <Select
                value={reclaimPolicy}
                options={[
                  { value: 'Delete', label: t('cluster.storageClasses.reclaimDelete') },
                  { value: 'Retain', label: t('cluster.storageClasses.reclaimRetain') },
                ]}
                onValueChange={(next) => setReclaimPolicy(next === 'Retain' ? 'Retain' : 'Delete')}
              />
            </div>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
            {t('sc.detail.bindingMode')}
            <div {...actionProps('storageclasses:create-binding')}>
              <Select
                value={volumeBindingMode}
                options={[
                  { value: 'Immediate', label: 'Immediate' },
                  { value: 'WaitForFirstConsumer', label: 'WaitForFirstConsumer' },
                ]}
                onValueChange={(next) => setVolumeBindingMode(next === 'WaitForFirstConsumer' ? 'WaitForFirstConsumer' : 'Immediate')}
              />
            </div>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" data-ai-id="storageclasses:create-capabilities">
          {[
            { key: 'expand', label: t('cluster.storageClasses.expand'), value: allowExpansion, set: setAllowExpansion },
            { key: 'clone', label: t('cluster.storageClasses.clone'), value: allowCloning, set: setAllowCloning },
            { key: 'snapshot', label: t('cluster.storageClasses.snapshot'), value: allowSnapshot, set: setAllowSnapshot },
          ].map((option) => (
            <label key={option.key} className="flex items-center gap-2 text-xs text-ai-fg-secondary">
              <input
                type="checkbox"
                checked={option.value}
                data-ai-id={`storageclasses:create-${option.key}`}
                onChange={(event) => option.set(event.target.checked)}
              />
              {option.label}
            </label>
          ))}
        </div>
        {error ? (
          <p className="text-xs text-ai-danger" role="alert" data-ai-id="storageclasses:create-error">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

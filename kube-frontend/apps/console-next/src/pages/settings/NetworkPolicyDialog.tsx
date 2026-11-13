import * as React from 'react';
import { Modal, ResourceForm, type FormSchema } from '@kube-ai-hub/ui';
import { POLICY_DIRECTIONS, type PolicyDirection } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';

/** 创建网络策略: name, what it applies to, which direction, and one peer. */
export interface NetworkPolicyDialogProps {
  open: boolean;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { name: string; podSelector: string; direction: PolicyDirection; peerSelector: string }) => void | Promise<void>;
}

export function NetworkPolicyDialog({ open, pending, onOpenChange, onSubmit }: NetworkPolicyDialogProps): React.ReactElement {
  const t = useT();

  const schema = React.useMemo<FormSchema>(
    () => ({
      title: t('settings.network.create'),
      submit: { label: t('common.confirm'), cancelLabel: t('common.cancel') },
      fields: [
        {
          key: 'name',
          label: t('settings.column.name'),
          type: 'text',
          required: true,
          hint: t('platform.users.field.nameHint'),
          rules: [
            {
              validate: (value) => {
                const name = String(value ?? '').trim();
                if (!name) return null;
                return /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/.test(name) ? null : t('platform.users.field.nameInvalid');
              },
            },
          ],
        },
        {
          key: 'podSelector',
          label: t('settings.network.podSelector'),
          type: 'text',
          hint: t('settings.network.podSelectorHint'),
        },
        {
          key: 'direction',
          label: t('settings.network.direction'),
          type: 'select',
          required: true,
          options: POLICY_DIRECTIONS.map((direction) => ({
            value: direction,
            label: direction === 'Ingress' ? t('settings.network.ingress') : t('settings.network.egress'),
          })),
        },
        {
          key: 'peerSelector',
          label: t('settings.network.peerSelector'),
          type: 'text',
          hint: t('settings.network.peerSelectorHint'),
        },
      ],
    }),
    [t],
  );

  if (!open) return <></>;

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="md" title={t('settings.network.create')}>
      <ResourceForm
        schema={schema}
        defaultValues={{ direction: 'Ingress' }}
        submitting={pending ?? false}
        onCancel={() => onOpenChange(false)}
        onSubmit={async (raw) => {
          const values = raw as Record<string, unknown>;
          await onSubmit({
            name: String(values['name'] ?? '').trim(),
            podSelector: String(values['podSelector'] ?? '').trim(),
            direction: String(values['direction'] ?? 'Ingress') as PolicyDirection,
            peerSelector: String(values['peerSelector'] ?? '').trim(),
          });
        }}
      />
    </Modal>
  );
}

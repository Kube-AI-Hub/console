import * as React from 'react';
import { Modal, ResourceForm, type FormSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';

/**
 * 存储卷扩容.
 *
 * One field, because that is the whole operation: Kubernetes accepts a larger
 * `spec.resources.requests.storage` and nothing else. Shrinking is not supported by
 * any driver, so the current size is offered as the floor and a smaller value is
 * refused here rather than by the apiserver.
 */
export interface ExpandVolumeDialogProps {
  open: boolean;
  name: string;
  current: string;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (storage: string) => void | Promise<void>;
}

/** Parse a Kubernetes quantity into bytes, for comparison only. */
function toBytes(quantity: string): number | null {
  const match = /^([0-9]+(?:\.[0-9]+)?)(Ki|Mi|Gi|Ti|Pi|Ei|k|M|G|T|P|E)?$/.exec(quantity.trim());
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2] ?? '';
  const factors: Record<string, number> = {
    '': 1,
    k: 1e3,
    M: 1e6,
    G: 1e9,
    T: 1e12,
    P: 1e15,
    E: 1e18,
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    Pi: 1024 ** 5,
    Ei: 1024 ** 6,
  };
  return value * (factors[unit] ?? 1);
}

export function ExpandVolumeDialog({ open, name, current, pending, onOpenChange, onSubmit }: ExpandVolumeDialogProps): React.ReactElement {
  const t = useT();

  const schema = React.useMemo<FormSchema>(
    () => ({
      title: t('storage.expand.title'),
      submit: { label: t('common.confirm'), cancelLabel: t('common.cancel') },
      fields: [
        {
          key: 'storage',
          label: t('storage.expand.capacity'),
          type: 'text',
          required: true,
          hint: t('storage.expand.hint', { current }),
          rules: [
            {
              validate: (value) => {
                const next = toBytes(String(value ?? ''));
                if (next === null) return t('storage.expand.invalid');
                const now = toBytes(current);
                // Shrinking is rejected by every storage driver; catching it here
                // saves a round trip and explains why.
                if (now !== null && next < now) return t('storage.expand.smaller', { current });
                if (now !== null && next === now) return t('storage.expand.same');
                return null;
              },
            },
          ],
        },
      ],
    }),
    [current, t],
  );

  if (!open) return <></>;

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="sm" title={t('storage.expand.title')} description={name}>
      <ResourceForm
        schema={schema}
        defaultValues={{ storage: '' }}
        submitting={pending ?? false}
        onCancel={() => onOpenChange(false)}
        onSubmit={async (raw) => {
          await onSubmit(String((raw as Record<string, unknown>)['storage'] ?? '').trim());
        }}
      />
    </Modal>
  );
}

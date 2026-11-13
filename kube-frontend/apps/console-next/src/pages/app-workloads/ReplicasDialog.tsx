import * as React from 'react';
import { Modal, ResourceForm, type FormSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';

/**
 * 扩缩容: one number.
 *
 * A dedicated dialog rather than the YAML editor: scaling is the single most common
 * write on a controller, and editing YAML to change one integer is how mistakes get
 * made. The old console offers the same narrow control.
 */
export interface ReplicasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: number;
  pending?: boolean;
  onSubmit: (replicas: number) => void | Promise<void>;
}

export function ReplicasDialog({ open, onOpenChange, current, pending, onSubmit }: ReplicasDialogProps): React.ReactElement {
  const t = useT();

  const schema = React.useMemo<FormSchema>(
    () => ({
      title: t('workloads.scale.title'),
      submit: { label: t('common.confirm'), cancelLabel: t('common.cancel') },
      fields: [
        {
          key: 'replicas',
          label: t('workloads.scale.replicas'),
          type: 'number',
          required: true,
          hint: t('workloads.scale.hint'),
          rules: [
            {
              // Zero is meaningful (it stops the workload), but a negative or
              // fractional replica count is not something the API will accept.
              validate: (value) => {
                const next = Number(value);
                if (!Number.isInteger(next)) return t('workloads.scale.integer');
                if (next < 0) return t('workloads.scale.negative');
                return null;
              },
            },
          ],
        },
      ],
    }),
    [t],
  );

  if (!open) return <></>;

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="sm" title={t('workloads.scale.title')}>
      <ResourceForm
        schema={schema}
        defaultValues={{ replicas: current }}
        submitting={pending ?? false}
        onCancel={() => onOpenChange(false)}
        onSubmit={async (raw) => {
          await onSubmit(Number((raw as Record<string, unknown>)['replicas']));
        }}
      />
    </Modal>
  );
}

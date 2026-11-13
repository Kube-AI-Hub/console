import * as React from 'react';
import { Modal, ResourceForm, type FormSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';

/**
 * 编辑服务端口.
 *
 * Editing the port list is what an operator actually changes on a Service: exposing a
 * new container port or moving one. Type and selector are deliberately out of scope —
 * changing a selector re-points traffic and changing the type changes how the service
 * is reachable, neither of which should sit behind a one-field dialog.
 *
 * The form edits up to three ports, which covers the overwhelming majority; a service
 * with more is better served by the YAML editor that already exists.
 */
export interface ServicePortsDialogProps {
  open: boolean;
  name: string;
  ports: Array<{ name: string; port: number; targetPort: string }>;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (ports: Array<{ name: string; port: number; targetPort: string }>) => void | Promise<void>;
}

const SLOTS = 3;

export function ServicePortsDialog({ open, name, ports, pending, onOpenChange, onSubmit }: ServicePortsDialogProps): React.ReactElement {
  const t = useT();

  const schema = React.useMemo<FormSchema>(
    () => ({
      title: t('workloads.service.editTitle'),
      submit: { label: t('common.confirm'), cancelLabel: t('common.cancel') },
      fields: [
        {
          key: 'port1',
          label: t('workloads.service.port'),
          type: 'number',
          required: true,
          hint: t('workloads.service.portHint'),
        },
        {
          key: 'target1',
          label: t('workloads.service.targetPort'),
          type: 'text',
          required: true,
        },
        { key: 'port2', label: t('workloads.service.portOptional'), type: 'number' },
        { key: 'target2', label: t('workloads.service.targetPort'), type: 'text' },
        { key: 'port3', label: t('workloads.service.portOptional'), type: 'number' },
        { key: 'target3', label: t('workloads.service.targetPort'), type: 'text' },
      ],
    }),
    [t],
  );

  if (!open) return <></>;

  const defaults: Record<string, unknown> = {};
  for (let index = 0; index < SLOTS; index += 1) {
    const entry = ports[index];
    defaults[`port${index + 1}`] = entry ? String(entry.port) : '';
    defaults[`target${index + 1}`] = entry ? entry.targetPort : '';
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="md" title={t('workloads.service.editTitle')} description={name}>
      <ResourceForm
        schema={schema}
        defaultValues={defaults}
        submitting={pending ?? false}
        onCancel={() => onOpenChange(false)}
        onSubmit={async (raw) => {
          const values = raw as Record<string, unknown>;
          const next: Array<{ name: string; port: number; targetPort: string }> = [];
          for (let index = 0; index < SLOTS; index += 1) {
            const port = String(values[`port${index + 1}`] ?? '').trim();
            const target = String(values[`target${index + 1}`] ?? '').trim();
            if (!port) continue;
            next.push({
              // Keep the existing name so the port's identity survives the edit.
              name: ports[index]?.name ?? '',
              port: Number(port),
              targetPort: target || port,
            });
          }
          await onSubmit(next);
        }}
      />
    </Modal>
  );
}

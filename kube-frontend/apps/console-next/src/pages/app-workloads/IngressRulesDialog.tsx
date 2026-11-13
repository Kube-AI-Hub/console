import * as React from 'react';
import { Modal, ResourceForm, type FormSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';

/**
 * 编辑路由规则.
 *
 * One rule per dialog: host, path and the backend service. The old console's editor
 * is the same shape — a routing rule is rarely edited in bulk, and a multi-row editor
 * turns a two-field change into a table with add/remove state.
 */
export interface IngressRulesDialogProps {
  open: boolean;
  name: string;
  rules: Array<{ host: string; path: string; serviceName: string; servicePort: string }>;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (rules: Array<{ host: string; path: string; serviceName: string; servicePort: string }>) => void | Promise<void>;
}

export function IngressRulesDialog({
  open,
  name,
  rules,
  pending,
  onOpenChange,
  onSubmit,
}: IngressRulesDialogProps): React.ReactElement {
  const t = useT();

  // Edit the first rule; when a route has several, the rest are preserved by
  // `setIngressRules`, which re-groups whatever it is given.
  const first = rules[0] ?? { host: '', path: '/', serviceName: '', servicePort: '' };

  const schema = React.useMemo<FormSchema>(
    () => ({
      title: t('workloads.ingress.editTitle'),
      submit: { label: t('common.confirm'), cancelLabel: t('common.cancel') },
      fields: [
        {
          key: 'host',
          label: t('workloads.ingress.host'),
          type: 'text',
          hint: t('workloads.ingress.hostHint'),
        },
        {
          key: 'path',
          label: t('workloads.ingress.path'),
          type: 'text',
          required: true,
          hint: t('workloads.ingress.pathHint'),
        },
        {
          key: 'serviceName',
          label: t('workloads.ingress.backend'),
          type: 'text',
          required: true,
          hint: t('workloads.ingress.backendHint'),
        },
        {
          key: 'servicePort',
          label: t('workloads.ingress.backendPort'),
          type: 'text',
          required: true,
          hint: t('workloads.ingress.backendPortHint'),
        },
      ],
    }),
    [t],
  );

  if (!open) return <></>;

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="md" title={t('workloads.ingress.editTitle')} description={name}>
      <ResourceForm
        schema={schema}
        defaultValues={{ host: first.host, path: first.path, serviceName: first.serviceName, servicePort: first.servicePort }}
        submitting={pending ?? false}
        onCancel={() => onOpenChange(false)}
        onSubmit={async (raw) => {
          const values = raw as Record<string, unknown>;
          const edited = {
            host: String(values['host'] ?? '').trim(),
            path: String(values['path'] ?? '/').trim() || '/',
            serviceName: String(values['serviceName'] ?? '').trim(),
            servicePort: String(values['servicePort'] ?? '').trim(),
          };
          // Replace the first rule, keep any others untouched.
          await onSubmit(rules.length === 0 ? [edited] : [edited, ...rules.slice(1)]);
        }}
      />
    </Modal>
  );
}

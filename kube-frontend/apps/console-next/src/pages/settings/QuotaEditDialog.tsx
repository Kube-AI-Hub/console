import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, ResourceForm, type FormSchema } from '@kube-ai-hub/ui';
import { projectQuotaApi, QUOTA_RESOURCES, type ProjectQuota } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';

/**
 * Form keys must not contain dots.
 *
 * `ResourceForm` stores values through `setByPath`, which treats `requests.cpu` as a
 * nested path and writes `{ requests: { cpu } }` — so a dotted key silently submits
 * nothing. Resource keys are therefore flattened for the form and mapped back on
 * submit.
 */
const FORM_KEY: Record<string, string> = {
  'requests.cpu': 'requests_cpu',
  'requests.memory': 'requests_memory',
  'limits.cpu': 'limits_cpu',
  'limits.memory': 'limits_memory',
  pods: 'pods',
  'count/deployments.apps': 'count_deployments',
  'count/services': 'count_services',
  'count/persistentvolumeclaims': 'count_pvcs',
  persistentvolumeclaims: 'pvc_requests',
  'requests.storage': 'requests_storage',
};

const RESOURCE_OF: Record<string, string> = Object.fromEntries(
  Object.entries(FORM_KEY).map(([resource, key]) => [key, resource]),
);

/**
 * 编辑项目配额.
 *
 * The old console edits quotas through a resource picker (choose a key, add a row).
 * A fixed list of the ten resources administrators actually set is calmer: the picker
 * invites choosing a key with an unusual unit and then discovering the apiserver
 * rejects it, while these ten all accept plain quantities.
 *
 * Leaving a field empty **removes** the limit rather than setting zero — zero would
 * forbid the resource entirely, which is the opposite of what an empty box means.
 */
export interface QuotaEditDialogProps {
  open: boolean;
  namespace: string;
  /** The project's existing quota, when it has one. */
  quota: ProjectQuota | undefined;
  onOpenChange: (open: boolean) => void;
}

export function QuotaEditDialog({ open, namespace, quota, onOpenChange }: QuotaEditDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const apply = useMutation({
    mutationFn: (hard: Record<string, string>) =>
      projectQuotaApi(apiClient).apply({
        namespace,
        // Reuse the existing object's name: a second ResourceQuota in the same
        // namespace would compete with this one and Kubernetes enforces the
        // intersection, which silently tightens every limit.
        name: quota?.name || `${namespace}-quota`,
        resource: namespace,
        hard,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-info'] });
    },
  });

  const schema = React.useMemo<FormSchema>(
    () => ({
      title: t('quota.title'),
      submit: { label: t('common.confirm'), cancelLabel: t('common.cancel') },
      fields: QUOTA_RESOURCES.map((resource) => ({
        key: FORM_KEY[resource] ?? resource,
        label: t(`quota.resource.${FORM_KEY[resource] ?? resource}` as never),
        type: 'text' as const,
        placeholder: quota?.hard[resource] ?? '',
        hint: t(`quota.hint.${FORM_KEY[resource] ?? resource}` as never),
        rules: [
          {
            // Kubernetes quantities: a number followed by an optional unit.
            validate: (value) => {
              const text = String(value ?? '').trim();
              if (!text) return null;
              return /^[0-9]+(\.[0-9]+)?(m|Ki|Mi|Gi|Ti|Pi|Ei|k|M|G|T|P|E)?$/.test(text)
                ? null
                : t('quota.invalidQuantity');
            },
          },
        ],
      })),
    }),
    [namespace, quota, t],
  );

  if (!open) return <></>;

  const defaults: Record<string, unknown> = {};
  for (const resource of QUOTA_RESOURCES) defaults[FORM_KEY[resource] ?? resource] = quota?.hard[resource] ?? '';

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="lg" title={t('quota.title')} description={t('quota.description')}>
      <ResourceForm
        schema={schema}
        defaultValues={defaults}
        submitting={apply.isPending}
        onCancel={() => onOpenChange(false)}
        onSubmit={async (raw) => {
          const values = raw as Record<string, unknown>;
          // Map the flat form keys back to the resource keys the API expects.
          const hard: Record<string, string> = {};
          for (const [key, resource] of Object.entries(RESOURCE_OF)) {
            const value = String(values[key] ?? '').trim();
            if (value) hard[resource] = value;
          }
          await apply.mutateAsync(hard);
          onOpenChange(false);
        }}
      />
    </Modal>
  );
}

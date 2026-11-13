import * as React from 'react';
import { ResourceForm, Modal, type FormSchema } from '@kube-ai-hub/ui';
import type { WorkloadKind } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { useProjectOptions } from '@/components/projects/useProjects';
import { useCreateWorkload } from './queries';

/**
 * 创建部署 / 有状态副本集 / 守护进程集.
 *
 * The old console's create flow is a multi-step wizard (镜像 → 容器设置 → 存储 →
 * 高级设置). This is the single-step subset that covers the common case: name,
 * image, replicas and the two labels that decide routing. Storage, probes, GPU and
 * scheduling are the parts a team almost always configures afterwards with YAML,
 * and shipping a wizard that only fills half of them would be worse than pointing at
 * the YAML path that already works.
 *
 * Built on ai-kit's `ResourceForm`, so validation is the same engine the rest of the
 * console uses and every field gets its own agent handle.
 */
export interface WorkloadCreateDialogProps {
  kind: WorkloadKind;
  cluster: string;
  /** Project the dialog opens on; the field still lets the reader change it. */
  namespace: string;
  onOpenChange: (open: boolean) => void;
}

export function WorkloadCreateDialog({ kind, cluster, namespace, onOpenChange }: WorkloadCreateDialogProps): React.ReactElement {
  const t = useT();
  const projects = useProjectOptions(cluster);
  const create = useCreateWorkload(kind, { cluster });

  const [target, setTarget] = React.useState(namespace);
  React.useEffect(() => setTarget(namespace), [namespace]);

  // Replicas do not apply to a DaemonSet (one pod per node).
  const hasReplicas = kind !== 'daemonsets';

  const schema = React.useMemo<FormSchema>(
    () => ({
      title: t('workloads.create.title'),
      // Explicit labels: the schema's defaults are the old console's wording, and the
      // rest of this app says 确认 / 取消.
      submit: { label: t('common.confirm'), cancelLabel: t('common.cancel') },
      fields: [
        {
          key: 'namespace',
          label: t('workloads.create.namespace'),
          type: 'select',
          required: true,
          options: projects,
        },
        {
          key: 'name',
          label: t('workloads.create.name'),
          type: 'text',
          required: true,
          hint: t('workloads.create.nameHint'),
          rules: [
            {
              // Kubernetes object names: lower-case alphanumerics and dashes.
              validate: (value) => {
                const name = String(value ?? '').trim();
                if (!name) return null;
                if (name.length > 63) return t('workloads.create.nameTooLong');
                return /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name) ? null : t('workloads.create.nameInvalid');
              },
            },
          ],
        },
        {
          key: 'image',
          label: t('workloads.create.image'),
          type: 'text',
          required: true,
          placeholder: 'nginx:1.27',
          hint: t('workloads.create.imageHint'),
          wide: true,
        },
        ...(hasReplicas
          ? [
              {
                key: 'replicas',
                label: t('workloads.create.replicas'),
                type: 'number' as const,
                defaultValue: 1,
              },
            ]
          : []),
        {
          key: 'app',
          label: t('workloads.create.appLabel'),
          type: 'text',
          hint: t('workloads.create.appLabelHint'),
        },
      ],
    }),
    [hasReplicas, projects, t],
  );

  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      size="lg"
      title={t('workloads.create.title')}
      description={t('workloads.create.description')}
    >
      <ResourceForm
        schema={schema}
        defaultValues={{ namespace: target, replicas: 1 }}
        submitting={create.isPending}
        onCancel={() => onOpenChange(false)}
        onSubmit={async (raw) => {
          // `ResourceForm` types values from `defaultValues`; the schema's other keys
          // arrive at runtime, so read them through a record.
          const values = raw as Record<string, unknown>;
          const name = String(values['name'] ?? '').trim();
          const image = String(values['image'] ?? '').trim();
          const ns = String(values['namespace'] ?? target) || target;
          const app = String(values['app'] ?? '').trim() || name;
          const replicas = Number(values['replicas'] ?? 1);
          await create.mutateAsync({ namespace: ns, name, image, app, replicas });
          onOpenChange(false);
        }}
      />
    </Modal>
  );
}

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormSchema } from '@kube-ai-hub/ui';
import type { KubeObject } from '@kube-ai-hub/api-client';
import { api, workloadsApi } from '@/api';
import { useT } from '@/i18n';
import { useProjectOptions } from '@/components/projects/useProjects';
import { ManifestCreateDialog } from '@/components/resource/ManifestCreateDialog';
import { networkManifest, validNetworkName, validNetworkPort, type NetworkKind } from './networkManifest';

export function NetworkResourceCreateDialog({ kind, cluster, namespace, onOpenChange }: {
  kind: NetworkKind; cluster: string; namespace: string; onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const t = useT();
  const projects = useProjectOptions(cluster);
  const cache = useQueryClient();
  const initialValues: Record<string, unknown> = {
    namespace, name: '', serviceType: 'ClusterIP', port: 80, targetPort: '80', protocol: 'TCP',
    host: '', path: '/', pathType: 'Prefix', servicePort: '80',
  };
  const create = useMutation({
    mutationFn: (body: KubeObject) => workloadsApi(api, kind).createManifest({
      cluster, namespace: String(body.metadata?.namespace ?? ''), body,
    }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: [kind] });
      onOpenChange(false);
    },
  });
  const nameRule = (value: unknown) => validNetworkName(String(value ?? '').trim()) ? null : t('workloads.create.nameInvalid');
  const portRule = (value: unknown) => validNetworkPort(String(value ?? '').trim()) ? null : t('networkCreate.portInvalid');
  const schema: FormSchema = {
    submit: { label: t('common.confirm'), cancelLabel: t('common.cancel') },
    fields: [
      { key: 'namespace', label: t('workloads.create.namespace'), type: 'select', required: true, options: projects },
      { key: 'name', label: t('workloads.create.name'), type: 'text', required: true, rules: [{ validate: nameRule }] },
      ...(kind === 'services' ? [
        { key: 'serviceType', label: t('networkCreate.serviceType'), type: 'select' as const,
          options: ['ClusterIP', 'NodePort', 'Headless', 'ExternalName'].map((value) => ({ value, label: value })) },
        { key: 'externalName', label: t('networkCreate.externalName'), type: 'text' as const, required: true,
          visible: (v: Record<string, unknown>) => v['serviceType'] === 'ExternalName' },
        { key: 'app', label: t('workloads.create.appLabel'), type: 'text' as const, hint: t('workloads.create.appLabelHint'),
          visible: (v: Record<string, unknown>) => v['serviceType'] !== 'ExternalName' },
        { key: 'port', label: t('workloads.service.port'), type: 'number' as const, required: true, min: 1, max: 65535,
          visible: (v: Record<string, unknown>) => v['serviceType'] !== 'ExternalName' },
        { key: 'targetPort', label: t('workloads.service.targetPort'), type: 'text' as const, required: true,
          rules: [{ validate: portRule }], visible: (v: Record<string, unknown>) => v['serviceType'] !== 'ExternalName' },
        { key: 'protocol', label: t('networkCreate.protocol'), type: 'select' as const,
          options: ['TCP', 'UDP', 'SCTP'].map((value) => ({ value, label: value })),
          visible: (v: Record<string, unknown>) => v['serviceType'] !== 'ExternalName' },
      ] : [
        { key: 'host', label: t('workloads.ingress.host'), type: 'text' as const, hint: t('workloads.ingress.hostHint') },
        { key: 'path', label: t('workloads.ingress.path'), type: 'text' as const, required: true,
          rules: [{ validate: (value: unknown) => String(value).startsWith('/') ? null : t('networkCreate.pathInvalid') }] },
        { key: 'pathType', label: t('networkCreate.pathType'), type: 'select' as const,
          options: ['Prefix', 'Exact'].map((value) => ({ value, label: value })) },
        { key: 'serviceName', label: t('workloads.ingress.backend'), type: 'text' as const, required: true,
          rules: [{ validate: nameRule }], hint: t('workloads.ingress.backendHint') },
        { key: 'servicePort', label: t('workloads.ingress.backendPort'), type: 'text' as const, required: true, rules: [{ validate: portRule }] },
        { key: 'ingressClass', label: t('networkCreate.ingressClass'), type: 'text' as const },
        { key: 'tlsSecret', label: t('networkCreate.tlsSecret'), type: 'text' as const },
      ]),
    ],
  };
  return <ManifestCreateDialog resource={kind} onOpenChange={onOpenChange}
    title={t(kind === 'services' ? 'networkCreate.serviceTitle' : 'networkCreate.ingressTitle')}
    description={t('networkCreate.hint')} schema={schema} initialValues={initialValues}
    buildManifest={(values) => networkManifest(kind, values)} pending={create.isPending}
    onSubmit={(body) => create.mutateAsync(body)} />;
}

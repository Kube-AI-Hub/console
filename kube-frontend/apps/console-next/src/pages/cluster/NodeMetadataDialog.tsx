import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { nodesWriteApi, type NodeDetail, type NodeTaint } from '@kube-ai-hub/api-client';
import { Modal, ResourceForm, type FormSchema } from '@kube-ai-hub/ui';
import { parse } from 'yaml';
import { api } from '@/api';
import { useT } from '@/i18n';
import { toYaml } from '@/components/resource/yaml';

export function parseNodeTaints(text: string): NodeTaint[] {
  const entries: unknown = parse(text);
  if (!Array.isArray(entries)) throw new Error('Expected a YAML array of taints');
  const seen = new Set<string>();
  return entries.map((entry: unknown) => {
    const taint = entry as Record<string, unknown> | null;
    if (!taint || typeof taint.key !== 'string' || !taint.key.trim() ||
      typeof taint.effect !== 'string' || !['NoSchedule', 'PreferNoSchedule', 'NoExecute'].includes(taint.effect) ||
      (taint.value !== undefined && typeof taint.value !== 'string')) throw new Error('Invalid taint key, value or effect');
    const id = `${taint.key}:${taint.effect}`;
    if (seen.has(id)) throw new Error('Duplicate taint key and effect');
    seen.add(id);
    return { key: taint.key, value: String(taint.value ?? ''), effect: taint.effect,
      ...(taint.timeAdded ? { timeAdded: String(taint.timeAdded) } : {}) };
  });
}

/** A narrow patch with optimistic concurrency leaves kubelet-owned fields untouched. */
export function NodeMetadataDialog({ cluster, node, kind, onClose, onSaved }: {
  cluster: string; node: NodeDetail; kind: 'labels' | 'taints'; onClose: () => void; onSaved: () => void;
}): React.ReactElement {
  const t = useT();
  // Keep the version paired with the form's initial values, even if the page refetches.
  const [original] = React.useState(node);
  const [values, setValues] = React.useState<Record<string, unknown>>({
    labels: original.labels, taints: toYaml(original.taints),
  });
  const save = useMutation({
    mutationFn: (next: Record<string, unknown>) => {
      const resourceVersion = String(original.raw.metadata?.resourceVersion ?? '');
      if (kind === 'taints') return nodesWriteApi(api).updateMetadata({
        cluster, name: node.name, resourceVersion, taints: parseNodeTaints(String(next.taints)),
      });
      const labels = next.labels as Record<string, string>;
      const removed = Object.fromEntries(Object.keys(original.labels).filter((key) => !(key in labels)).map((key) => [key, null]));
      return nodesWriteApi(api).updateMetadata({ cluster, name: node.name, resourceVersion, labels: { ...removed, ...labels } });
    },
    onSuccess: () => { onSaved(); onClose(); },
  });
  const schema: FormSchema = {
    fields: [{ key: kind, label: t(`node.detail.${kind}`), type: kind === 'labels' ? 'key-value' : 'textarea',
      ...(kind === 'taints' ? { hint: t('node.taints.hint'), rules: [{ validate: (value: unknown) => {
        try { parseNodeTaints(String(value)); return null; } catch { return t('node.taints.invalid'); }
      } }] } : {}) }],
    submit: { label: t('common.confirm'), cancelLabel: t('common.cancel') },
  };
  return <Modal open title={t(kind === 'labels' ? 'node.action.labels' : 'node.action.taints')} size="lg"
    onOpenChange={(open) => { if (!open && !save.isPending) onClose(); }}>
    <div data-ai-id={`node-metadata:${kind}`}>
      {kind === 'taints' ? <p className="mb-3 text-sm text-ai-warning">{t('node.taints.warning')}</p> : null}
      <ResourceForm schema={schema} values={values} onChange={setValues} submitting={save.isPending}
        onCancel={() => { if (!save.isPending) onClose(); }} onSubmit={(next) => save.mutateAsync(next)} />
    </div>
  </Modal>;
}

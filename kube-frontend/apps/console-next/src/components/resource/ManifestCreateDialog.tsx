import * as React from 'react';
import { Button, Modal, ResourceForm, type FormSchema } from '@kube-ai-hub/ui';
import { YamlEditor } from '@kube-ai-hub/ui/editor';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { parse as parseYaml } from 'yaml';
import type { KubeObject } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { toYaml } from './yaml';

/** Shared create interaction; resource-specific fields and mapping stay with the caller. */
export function ManifestCreateDialog({ resource, title, description, schema, initialValues, buildManifest, pending, onOpenChange, onSubmit }: {
  resource: string; title: string; description: string; schema: FormSchema;
  initialValues: Record<string, unknown>; buildManifest: (values: Record<string, unknown>) => KubeObject;
  pending: boolean; onOpenChange: (open: boolean) => void; onSubmit: (body: KubeObject) => Promise<unknown>;
}): React.ReactElement {
  const t = useT();
  const [values, setValues] = React.useState(initialValues);
  const [yaml, setYaml] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const submitYaml = async () => {
    try {
      const body = parseYaml(yaml ?? '') as KubeObject;
      if (!body || typeof body !== 'object' || Array.isArray(body) || !body.metadata?.namespace || !body.metadata.name) {
        throw new Error(t('networkCreate.manifestInvalid'));
      }
      await onSubmit(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('networkCreate.manifestInvalid'));
    }
  };
  return <Modal open onOpenChange={(open) => { if (!pending) onOpenChange(open); }}
    title={title} description={description} size="lg">
    {yaml === null ? <>
      <Button variant="secondary" size="sm" {...actionProps(`${resource}:create-yaml`)}
        onClick={() => { setError(''); setYaml(toYaml(buildManifest(values))); }}>{t('networkCreate.yaml')}</Button>
      <ResourceForm schema={schema} values={values} onChange={setValues} submitting={pending}
        onCancel={() => onOpenChange(false)} onSubmit={async (next) => { await onSubmit(buildManifest(next)); }} />
    </> : <>
      <YamlEditor value={yaml} onChange={setYaml} readOnly={pending} />
      {error ? <p role="alert" className="mt-2 text-sm text-ai-danger">{error}</p> : null}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setYaml(null)} disabled={pending}>{t('networkCreate.back')}</Button>
        <Button {...actionProps(`${resource}:create-yaml-submit`)} disabled={pending} onClick={() => void submitYaml()}>{t('common.confirm')}</Button>
      </div>
    </>}
  </Modal>;
}

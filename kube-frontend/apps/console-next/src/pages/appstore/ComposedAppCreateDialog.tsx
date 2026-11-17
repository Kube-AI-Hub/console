import * as React from 'react';
import { Button, Input, Modal } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { validateComposedAppInput, type ComposedAppCreateInput } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';

/**
 * 创建自制应用.
 *
 * Application + one Deployment/Service per component, written dry-run first. This is the
 * "services" step of the old wizard; the routes step and per-component advanced settings are
 * the remaining slice. [N-01]
 */
export interface ComposedAppCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  namespace: string;
  cluster: string;
  pending?: boolean;
  error?: unknown;
  onSubmit: (input: ComposedAppCreateInput & { cluster: string }) => void | Promise<void>;
}

interface ComponentForm {
  name: string;
  image: string;
  replicas: string;
  port: string;
}

const newComponent = (index: number): ComponentForm => ({
  name: index === 0 ? 'web' : 'component-' + (index + 1),
  image: 'nginx:1.27',
  replicas: '1',
  port: String(80 + index),
});

const DEFAULTS = {
  name: '',
  description: '',
  version: 'v1',
  components: [newComponent(0)],
};

const ERROR_KEYS: Record<string, 'composedApps.error.name' | 'composedApps.error.image' | 'composedApps.error.component' | 'composedApps.error.replicas' | 'composedApps.error.port' | 'composedApps.error.components'> = {
  name: 'composedApps.error.name',
  componentName: 'composedApps.error.component',
  image: 'composedApps.error.image',
  replicas: 'composedApps.error.replicas',
  port: 'composedApps.error.port',
  components: 'composedApps.error.components',
};

export function ComposedAppCreateDialog({ open, onOpenChange, namespace, cluster, pending = false, error, onSubmit }: ComposedAppCreateDialogProps): React.ReactElement {
  const t = useT();
  const [form, setForm] = React.useState(DEFAULTS);
  const [validation, setValidation] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setForm(DEFAULTS);
      setValidation(null);
    }
  }, [open]);

  const setField = (key: 'name' | 'description' | 'version') => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };
  const setComponent = (index: number, key: keyof ComponentForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({
      ...current,
      components: current.components.map((component, i) => (i === index ? { ...component, [key]: event.target.value } : component)),
    }));
  };
  const addComponent = (): void => {
    setForm((current) => ({ ...current, components: [...current.components, newComponent(current.components.length)] }));
  };
  const removeComponent = (index: number): void => {
    setForm((current) => ({ ...current, components: current.components.filter((_, i) => i !== index) }));
  };

  const submit = (): void => {
    const input: ComposedAppCreateInput = {
      namespace,
      name: form.name.trim(),
      description: form.description,
      version: form.version.trim() || 'v1',
      components: form.components.map((component) => ({
        name: component.name.trim(),
        image: component.image.trim(),
        replicas: Number(component.replicas),
        port: Number(component.port),
      })),
    };
    const invalid = validateComposedAppInput(input);
    if (invalid) {
      setValidation(t(ERROR_KEYS[invalid] ?? 'composedApps.error.name'));
      return;
    }
    setValidation(null);
    void onSubmit({ ...input, cluster });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('composedApps.create.title')}
      description={t('composedApps.create.description')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" loading={pending} {...actionProps('composed-apps:create-submit')} onClick={submit}>
            {t('common.create')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-ai-id="composed-apps:create-dialog">
        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
          {t('workspace.field.name')}
          <Input value={form.name} placeholder="shop" {...actionProps('composed-apps:create-name')} onChange={setField('name')} />
          <span className="text-[11px] text-ai-fg-muted">{t('composedApps.create.nameHint')}</span>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
          {t('settings.roles.fieldDescription')}
          <Input value={form.description} {...actionProps('composed-apps:create-description')} onChange={setField('description')} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary sm:max-w-40">
          {t('composedApps.column.version')}
          <Input value={form.version} {...actionProps('composed-apps:create-version')} onChange={setField('version')} />
        </label>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ai-fg">{t('composedApps.create.components')}</span>
            <Button size="sm" variant="secondary" {...actionProps('composed-apps:create-add-component')} onClick={addComponent}>
              {t('composedApps.create.addComponent')}
            </Button>
          </div>
          {form.components.map((component, index) => (
            <div key={index} className="rounded-ai-md border border-ai-line p-3" data-ai-id={'composed-apps:create-component-row-' + index}>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
                  {t('composedApps.create.component')}
                  <Input
                    value={component.name}
                    {...actionProps(index === 0 ? 'composed-apps:create-component' : 'composed-apps:create-component-' + index)}
                    onChange={setComponent(index, 'name')}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
                  {t('composedApps.create.image')}
                  <Input
                    value={component.image}
                    {...actionProps(index === 0 ? 'composed-apps:create-image' : 'composed-apps:create-image-' + index)}
                    onChange={setComponent(index, 'image')}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
                  {t('composedApps.create.replicas')}
                  <Input
                    type="number"
                    min={1}
                    value={component.replicas}
                    {...actionProps(index === 0 ? 'composed-apps:create-replicas' : 'composed-apps:create-replicas-' + index)}
                    onChange={setComponent(index, 'replicas')}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
                  {t('composedApps.create.port')}
                  <Input
                    type="number"
                    min={1}
                    max={65535}
                    value={component.port}
                    {...actionProps(index === 0 ? 'composed-apps:create-port' : 'composed-apps:create-port-' + index)}
                    onChange={setComponent(index, 'port')}
                  />
                </label>
              </div>
              {form.components.length > 1 ? (
                <Button className="mt-2" size="sm" variant="ghost" onClick={() => removeComponent(index)}>
                  {t('composedApps.create.removeComponent')}
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        <p className="text-[11px] text-ai-fg-muted">{t('composedApps.create.namespaceHint', { namespace })}</p>
        {validation ? (
          <p className="text-xs text-ai-danger" role="alert" data-ai-id="composed-apps:create-error">
            {validation}
          </p>
        ) : null}
        {error ? (
          <p className="text-xs text-ai-danger" role="alert">
            {String((error as { message?: string }).message ?? error)}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

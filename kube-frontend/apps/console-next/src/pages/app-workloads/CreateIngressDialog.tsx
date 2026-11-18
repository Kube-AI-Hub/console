import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Icon, Input, Modal, Select } from '@kube-ai-hub/ui';
import { YamlEditor } from '@kube-ai-hub/ui/editor';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { parse as parseYaml } from 'yaml';
import { ApiError, type KubeObject } from '@kube-ai-hub/api-client';
import { api, workloadsApi } from '@/api';
import { useT } from '@/i18n';
import { useProjectOptions } from '@/components/projects/useProjects';
import { toYaml } from '@/components/resource/yaml';
import { ingressManifest, validNetworkName, validNetworkPort, type IngressRuleDraft } from './networkManifest';

/**
 * 创建应用路由.
 *
 * A route is one host plus a list of paths, each pointing at a service port. The form
 * is a row per path and the manifest builder groups rows by host: two paths on the
 * same host are one Kubernetes rule with two `http.paths` entries, not two rules.
 *
 * Rows can be added and removed. A route with a single hard-coded row was the old
 * editor's shape, which is fine for editing one rule but wrong for creating a route —
 * the common create is "this host serves /api and /static".
 */
export interface CreateIngressDialogProps {
  cluster: string;
  namespace: string;
  onOpenChange: (open: boolean) => void;
}

interface RuleRow extends IngressRuleDraft {
  /** Stable key so deleting an earlier row does not move the handles of the later ones. */
  id: number;
}

interface FieldErrors {
  namespace?: string;
  name?: string;
  rules?: string;
  [key: string]: string | undefined;
}

let ruleSequence = 0;
function nextRuleId(): number {
  ruleSequence += 1;
  return ruleSequence;
}

function emptyRule(): RuleRow {
  return { id: nextRuleId(), host: '', path: '/', pathType: 'Prefix', serviceName: '', servicePort: '' };
}

export function CreateIngressDialog({ cluster, namespace, onOpenChange }: CreateIngressDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const projects = useProjectOptions(cluster);

  const [namespaceValue, setNamespaceValue] = React.useState(namespace);
  const [name, setName] = React.useState('');
  const [ingressClass, setIngressClass] = React.useState('');
  const [tlsSecret, setTlsSecret] = React.useState('');
  const [rules, setRules] = React.useState<RuleRow[]>([emptyRule()]);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [error, setError] = React.useState<string | null>(null);
  const [yaml, setYaml] = React.useState<string | null>(null);
  const [yamlError, setYamlError] = React.useState<string | null>(null);

  React.useEffect(() => setNamespaceValue(namespace), [namespace]);

  const create = useMutation({
    mutationFn: (input: { namespace: string; body: KubeObject }) =>
      workloadsApi(api, 'ingresses').createManifest({ cluster, namespace: input.namespace, body: input.body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ingresses'] });
      void queryClient.invalidateQueries({ queryKey: ['workload', 'ingresses'] });
    },
  });

  const updateRule = (id: number, patch: Partial<IngressRuleDraft>): void => {
    setRules((previous) => previous.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  const addRule = (): void => {
    setRules((previous) => [...previous, emptyRule()]);
  };

  const removeRule = (id: number): void => {
    setRules((previous) => (previous.length <= 1 ? previous : previous.filter((rule) => rule.id !== id)));
  };

  const draft = (): { name: string; namespace: string; ingressClass: string; tlsSecret: string; rules: IngressRuleDraft[] } => ({
    name,
    namespace: namespaceValue,
    ingressClass,
    tlsSecret,
    rules,
  });

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!namespaceValue) next.namespace = t('resource.validate.projectRequired');
    if (!name.trim()) next.name = t('resource.validate.nameRequired');
    else if (!validNetworkName(name.trim())) next.name = t('workloads.create.nameInvalid');
    let badRule = false;
    for (const rule of rules) {
      if (!rule.path.trim().startsWith('/')) {
        next[`path:${rule.id}`] = t('networkCreate.pathInvalid');
        badRule = true;
      }
      if (!rule.serviceName.trim()) {
        next[`service:${rule.id}`] = t('resource.validate.nameRequired');
        badRule = true;
      }
      if (!rule.servicePort.trim()) {
        next[`servicePort:${rule.id}`] = t('networkCreate.portRequired');
        badRule = true;
      } else if (!validNetworkPort(rule.servicePort.trim())) {
        next[`servicePort:${rule.id}`] = t('networkCreate.portInvalid');
        badRule = true;
      }
    }
    if (badRule) next.rules = t('networkCreate.ruleInvalid');
    return next;
  };

  const messageOf = (cause: unknown): string => {
    if (cause instanceof ApiError) {
      if (cause.isConflict) return t('resource.validate.nameExists');
      if (cause.isPermission) return t('networkCreate.noPermission', { resource: t('workloads.ingresses.title') });
      return cause.message || t('networkCreate.failed');
    }
    return t('networkCreate.failed');
  };

  const submitForm = async (): Promise<void> => {
    setError(null);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    try {
      await create.mutateAsync({ namespace: namespaceValue, body: ingressManifest(draft()) });
      onOpenChange(false);
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

  const submitYaml = async (): Promise<void> => {
    setYamlError(null);
    let body: KubeObject;
    try {
      body = parseYaml(yaml ?? '') as KubeObject;
    } catch {
      setYamlError(t('yaml.invalid'));
      return;
    }
    if (!body || typeof body !== 'object' || Array.isArray(body) || body.kind !== 'Ingress' || !body.metadata?.name) {
      setYamlError(t('networkCreate.manifestInvalid'));
      return;
    }
    try {
      await create.mutateAsync({ namespace: String(body.metadata.namespace ?? namespaceValue), body });
      onOpenChange(false);
    } catch (cause) {
      setYamlError(messageOf(cause));
    }
  };

  const inYaml = yaml !== null;

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!create.isPending) onOpenChange(open);
      }}
      size="lg"
      title={t('networkCreate.ingressTitle')}
      description={t('networkCreate.ingressHint')}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {inYaml ? (
            <Button variant="ghost" size="sm" disabled={create.isPending} onClick={() => setYaml(null)}>
              {t('networkCreate.back')}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
          )}
          <Button
            size="sm"
            disabled={create.isPending}
            {...actionProps(inYaml ? 'ingresses:create-yaml-submit' : 'ingresses-create:submit')}
            onClick={() => void (inYaml ? submitYaml() : submitForm())}
          >
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      {inYaml ? (
        <div data-ai-id="ingresses-create:yaml">
          <YamlEditor value={yaml} onChange={setYaml} height="46vh" ariaLabel={t('networkCreate.ingressTitle')} copyLabel={t('yaml.copy')} copiedLabel={t('yaml.copied')} />
          {yamlError ? (
            <p role="alert" className="mt-2 text-xs text-ai-danger" data-ai-id="ingresses-create:error">
              {yamlError}
            </p>
          ) : null}
        </div>
      ) : (
        <div data-ai-id="ingresses-create:dialog" className="flex flex-col gap-3">
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              {...actionProps('ingresses:create-yaml')}
              onClick={() => {
                setError(null);
                setYaml(toYaml(ingressManifest(draft())));
              }}
            >
              {t('networkCreate.yaml')}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ai-fg-secondary">{t('workloads.create.namespace')}</span>
              <Select
                value={namespaceValue}
                options={projects.some((project) => project.value === namespaceValue) ? projects : [{ value: namespaceValue, label: namespaceValue }, ...projects]}
                data-ai-id="ingresses-create:namespace"
                aria-label={t('workloads.create.namespace')}
                onValueChange={setNamespaceValue}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ai-fg-secondary">{t('workloads.create.name')}</span>
              <Input value={name} {...actionProps('ingresses-create:name')} onChange={(event) => setName(event.target.value)} />
              {errors.name ? <span role="alert" className="text-[11px] text-ai-danger">{errors.name}</span> : null}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ai-fg-secondary">{t('networkCreate.ingressClass')}</span>
              <Input
                value={ingressClass}
                {...actionProps('ingresses-create:ingress-class')}
                onChange={(event) => setIngressClass(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ai-fg-secondary">{t('networkCreate.tlsSecret')}</span>
              <Input value={tlsSecret} {...actionProps('ingresses-create:tls-secret')} onChange={(event) => setTlsSecret(event.target.value)} />
            </label>
          </div>

          <section className="rounded-ai-md border border-ai-line p-3" data-ai-id="ingresses-create:rules">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-ai-fg">{t('networkCreate.rules')}</span>
              <Button size="sm" variant="secondary" {...actionProps('ingresses-create:rule-add')} onClick={addRule}>
                <Icon name="add" size={12} />
                {t('networkCreate.ruleAdd')}
              </Button>
            </div>
            {rules.map((rule) => (
              <div key={rule.id} className="mb-2 grid grid-cols-1 gap-2 last:mb-0 sm:grid-cols-2" data-ai-row={`rule-${rule.id}`}>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-ai-fg-muted">{t('workloads.ingress.host')}</span>
                  <Input
                    value={rule.host}
                    placeholder="app.example.com"
                    {...actionProps(`ingresses-create:host:${rule.id}`)}
                    onChange={(event) => updateRule(rule.id, { host: event.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-ai-fg-muted">{t('workloads.ingress.path')}</span>
                  <Input
                    value={rule.path}
                    {...actionProps(`ingresses-create:path:${rule.id}`)}
                    onChange={(event) => updateRule(rule.id, { path: event.target.value })}
                  />
                  {errors[`path:${rule.id}`] ? (
                    <span role="alert" className="text-[11px] text-ai-danger">{errors[`path:${rule.id}`]}</span>
                  ) : null}
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-ai-fg-muted">{t('networkCreate.pathType')}</span>
                  <Select
                    value={rule.pathType}
                    options={['Prefix', 'Exact'].map((value) => ({ value, label: value }))}
                    data-ai-id={`ingresses-create:path-type:${rule.id}`}
                    aria-label={t('networkCreate.pathType')}
                    onValueChange={(value: string) => updateRule(rule.id, { pathType: value })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-ai-fg-muted">{t('workloads.ingress.backend')}</span>
                  <Input
                    value={rule.serviceName}
                    {...actionProps(`ingresses-create:backend:${rule.id}`)}
                    onChange={(event) => updateRule(rule.id, { serviceName: event.target.value })}
                  />
                  {errors[`service:${rule.id}`] ? (
                    <span role="alert" className="text-[11px] text-ai-danger">{errors[`service:${rule.id}`]}</span>
                  ) : null}
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-ai-fg-muted">{t('workloads.ingress.backendPort')}</span>
                  <Input
                    value={rule.servicePort}
                    {...actionProps(`ingresses-create:backend-port:${rule.id}`)}
                    onChange={(event) => updateRule(rule.id, { servicePort: event.target.value })}
                  />
                  {errors[`servicePort:${rule.id}`] ? (
                    <span role="alert" className="text-[11px] text-ai-danger">{errors[`servicePort:${rule.id}`]}</span>
                  ) : null}
                </label>
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t('networkCreate.ruleRemove')}
                    disabled={rules.length <= 1}
                    {...actionProps(`ingresses-create:rule-remove:${rule.id}`)}
                    onClick={() => removeRule(rule.id)}
                  >
                    <Icon name="trash" size={14} />
                    {t('networkCreate.ruleRemove')}
                  </Button>
                </div>
              </div>
            ))}
            {errors.rules ? <p role="alert" className="text-[11px] text-ai-danger">{errors.rules}</p> : null}
          </section>

          {error ? (
            <p role="alert" className="text-xs text-ai-danger" data-ai-id="ingresses-create:error">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

export default CreateIngressDialog;

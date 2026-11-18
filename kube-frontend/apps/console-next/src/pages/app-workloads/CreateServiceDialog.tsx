import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Modal, Select } from '@kube-ai-hub/ui';
import { YamlEditor } from '@kube-ai-hub/ui/editor';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { parse as parseYaml } from 'yaml';
import { ApiError, type KubeObject } from '@kube-ai-hub/api-client';
import { api, workloadsApi } from '@/api';
import { useT } from '@/i18n';
import { useProjectOptions } from '@/components/projects/useProjects';
import { useWorkloadAppLabels } from './queries';
import { toYaml } from '@/components/resource/yaml';
import {
  SERVICE_TYPES,
  serviceManifest,
  validNetworkName,
  validNetworkPort,
  validNodePort,
  type ServiceDraft,
  type ServiceType,
} from './networkManifest';

/**
 * 创建服务.
 *
 * The old console's create dialog is type + ports + selector; this keeps that shape
 * and adds the one conditional the old form hid in a separate branch: a NodePort
 * service gets a node-port field, a ClusterIP service does not. Showing every field
 * for every type is how a reader ends up setting a node port on a ClusterIP service
 * and learning from a rejected write that the field never applied.
 *
 * The selector is prefilled from the project's workload `app` labels — a service that
 * selects nothing is valid but useless, and typing the label by hand is where typos
 * become "why is this service empty". `手动填写` keeps the free-text path.
 *
 * The YAML view is kept from the generic create dialog: multiple ports and advanced
 * settings are legitimate and the form covers one port.
 */
export interface CreateServiceDialogProps {
  cluster: string;
  /** Project the dialog opens on; the field still lets the reader change it. */
  namespace: string;
  onOpenChange: (open: boolean) => void;
}

interface FieldErrors {
  namespace?: string;
  name?: string;
  port?: string;
  targetPort?: string;
  nodePort?: string;
  externalName?: string;
}

const MANUAL_SELECTOR = '__manual__';

export function CreateServiceDialog({ cluster, namespace, onOpenChange }: CreateServiceDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const projects = useProjectOptions(cluster);
  const appLabels = useWorkloadAppLabels(cluster, namespace);

  const [draft, setDraft] = React.useState<ServiceDraft>({
    name: '',
    namespace,
    serviceType: 'ClusterIP',
    protocol: 'TCP',
    port: '80',
    targetPort: '80',
    nodePort: '',
    externalName: '',
    selectorApp: '',
  });
  const [manualSelector, setManualSelector] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [error, setError] = React.useState<string | null>(null);
  const [yaml, setYaml] = React.useState<string | null>(null);
  const [yamlError, setYamlError] = React.useState<string | null>(null);

  // A project change is a different set of workloads; re-seed the selector from it.
  React.useEffect(() => {
    setDraft((previous) => ({ ...previous, namespace }));
  }, [namespace]);

  // Prefill the selector from the first workload label once the list arrives, unless
  // the reader already chose manual entry.
  React.useEffect(() => {
    if (manualSelector) return;
    const first = appLabels[0];
    if (!first) return;
    setDraft((previous) => (previous.selectorApp ? previous : { ...previous, selectorApp: first }));
  }, [appLabels, manualSelector]);

  const isExternal = draft.serviceType === 'ExternalName';
  const showsPorts = !isExternal;
  const isNodePort = draft.serviceType === 'NodePort';

  const create = useMutation({
    mutationFn: (input: { namespace: string; body: KubeObject }) =>
      workloadsApi(api, 'services').createManifest({ cluster, namespace: input.namespace, body: input.body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['services'] });
      void queryClient.invalidateQueries({ queryKey: ['workload', 'services'] });
    },
  });

  const set = <K extends keyof ServiceDraft>(key: K, value: ServiceDraft[K]): void => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!draft.namespace) next.namespace = t('resource.validate.projectRequired');
    if (!draft.name.trim()) next.name = t('resource.validate.nameRequired');
    else if (!validNetworkName(draft.name.trim())) next.name = t('workloads.create.nameInvalid');
    if (isExternal) {
      if (!draft.externalName.trim()) next.externalName = t('networkCreate.externalNameRequired');
    } else {
      if (!/^\d+$/.test(draft.port.trim()) || !validNetworkPort(draft.port.trim())) next.port = t('networkCreate.portInvalid');
      if (!draft.targetPort.trim()) next.targetPort = t('networkCreate.targetPortRequired');
      else if (!validNetworkPort(draft.targetPort.trim())) next.targetPort = t('networkCreate.portInvalid');
      if (isNodePort && draft.nodePort.trim() && !validNodePort(draft.nodePort.trim())) next.nodePort = t('networkCreate.nodePortInvalid');
    }
    return next;
  };

  const messageOf = (cause: unknown): string => {
    if (cause instanceof ApiError) {
      if (cause.isConflict) return t('resource.validate.nameExists');
      if (cause.isPermission) return t('networkCreate.noPermission', { resource: t('workloads.services.title') });
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
      await create.mutateAsync({ namespace: draft.namespace, body: serviceManifest(draft) });
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
    if (!body || typeof body !== 'object' || Array.isArray(body) || body.kind !== 'Service' || !body.metadata?.name) {
      setYamlError(t('networkCreate.manifestInvalid'));
      return;
    }
    try {
      await create.mutateAsync({ namespace: String(body.metadata.namespace ?? draft.namespace), body });
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
      title={t('networkCreate.serviceTitle')}
      description={t('networkCreate.serviceHint')}
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
            {...actionProps(inYaml ? 'services:create-yaml-submit' : 'services-create:submit')}
            onClick={() => void (inYaml ? submitYaml() : submitForm())}
          >
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      {inYaml ? (
        <div data-ai-id="services-create:yaml">
          <YamlEditor value={yaml} onChange={setYaml} height="46vh" ariaLabel={t('networkCreate.serviceTitle')} copyLabel={t('yaml.copy')} copiedLabel={t('yaml.copied')} />
          {yamlError ? (
            <p role="alert" className="mt-2 text-xs text-ai-danger" data-ai-id="services-create:error">
              {yamlError}
            </p>
          ) : null}
        </div>
      ) : (
        <div data-ai-id="services-create:dialog" className="flex flex-col gap-3">
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              {...actionProps('services:create-yaml')}
              onClick={() => {
                setError(null);
                setYaml(toYaml(serviceManifest(draft)));
              }}
            >
              {t('networkCreate.yaml')}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ai-fg-secondary">{t('workloads.create.namespace')}</span>
              <Select
                value={draft.namespace}
                options={projects.some((project) => project.value === draft.namespace) ? projects : [{ value: draft.namespace, label: draft.namespace }, ...projects]}
                data-ai-id="services-create:namespace"
                aria-label={t('workloads.create.namespace')}
                onValueChange={(value: string) => set('namespace', value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ai-fg-secondary">{t('workloads.create.name')}</span>
              <Input
                value={draft.name}
                {...actionProps('services-create:name')}
                onChange={(event) => set('name', event.target.value)}
              />
              {errors.name ? <span role="alert" className="text-[11px] text-ai-danger">{errors.name}</span> : null}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ai-fg-secondary">{t('networkCreate.serviceType')}</span>
              <Select
                value={draft.serviceType}
                options={SERVICE_TYPES.map((value) => ({ value, label: value }))}
                data-ai-id="services-create:type"
                aria-label={t('networkCreate.serviceType')}
                onValueChange={(value: string) => set('serviceType', value as ServiceType)}
              />
            </label>
            {isExternal ? (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-ai-fg-secondary">{t('networkCreate.externalName')}</span>
                <Input
                  value={draft.externalName}
                  placeholder="example.com"
                  {...actionProps('services-create:external-name')}
                  onChange={(event) => set('externalName', event.target.value)}
                />
                {errors.externalName ? <span role="alert" className="text-[11px] text-ai-danger">{errors.externalName}</span> : null}
              </label>
            ) : (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-ai-fg-secondary">{t('networkCreate.selector')}</span>
                <Select
                  value={manualSelector ? MANUAL_SELECTOR : draft.selectorApp}
                  options={[
                    ...appLabels.map((label) => ({ value: label, label })),
                    { value: MANUAL_SELECTOR, label: t('networkCreate.selectorManual') },
                  ]}
                  data-ai-id="services-create:selector"
                  aria-label={t('networkCreate.selector')}
                  onValueChange={(value: string) => {
                    if (value === MANUAL_SELECTOR) {
                      setManualSelector(true);
                      return;
                    }
                    setManualSelector(false);
                    set('selectorApp', value);
                  }}
                />
                {manualSelector ? (
                  <Input
                    value={draft.selectorApp}
                    placeholder={t('networkCreate.selectorValue')}
                    {...actionProps('services-create:selector-manual')}
                    onChange={(event) => set('selectorApp', event.target.value)}
                  />
                ) : null}
                <span className="text-[11px] text-ai-fg-muted">{t('networkCreate.selectorHint')}</span>
              </label>
            )}
            {showsPorts ? (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ai-fg-secondary">{t('workloads.service.port')}</span>
                  <Input
                    type="number"
                    min={1}
                    max={65535}
                    value={draft.port}
                    {...actionProps('services-create:port')}
                    onChange={(event) => set('port', event.target.value)}
                  />
                  {errors.port ? <span role="alert" className="text-[11px] text-ai-danger">{errors.port}</span> : null}
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ai-fg-secondary">{t('workloads.service.targetPort')}</span>
                  <Input
                    value={draft.targetPort}
                    {...actionProps('services-create:target-port')}
                    onChange={(event) => set('targetPort', event.target.value)}
                  />
                  {errors.targetPort ? <span role="alert" className="text-[11px] text-ai-danger">{errors.targetPort}</span> : null}
                </label>
                {isNodePort ? (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-ai-fg-secondary">{t('networkCreate.nodePort')}</span>
                    <Input
                      type="number"
                      min={30000}
                      max={32767}
                      value={draft.nodePort}
                      placeholder={t('networkCreate.nodePortPlaceholder')}
                      {...actionProps('services-create:node-port')}
                      onChange={(event) => set('nodePort', event.target.value)}
                    />
                    {errors.nodePort ? <span role="alert" className="text-[11px] text-ai-danger">{errors.nodePort}</span> : null}
                  </label>
                ) : null}
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ai-fg-secondary">{t('networkCreate.protocol')}</span>
                  <Select
                    value={draft.protocol}
                    options={['TCP', 'UDP', 'SCTP'].map((value) => ({ value, label: value }))}
                    data-ai-id="services-create:protocol"
                    aria-label={t('networkCreate.protocol')}
                    onValueChange={(value: string) => set('protocol', value)}
                  />
                </label>
              </>
            ) : null}
          </div>

          {error ? (
            <p role="alert" className="text-xs text-ai-danger" data-ai-id="services-create:error">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

export default CreateServiceDialog;

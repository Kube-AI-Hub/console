import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectGatewaysApi, type GatewayChanges, type GatewayDetail } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, Button, FormField, Input, Modal, Select, Switch } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage } from '@/components/resource/ResourceErrorPanel';

/**
 * 项目网关编辑设置.
 *
 * The fields mirror what the Gateway CR actually accepts (probed on B200):
 *
 * - 访问方式 / 副本数 → `spec.service.type` / `spec.deployment.replicas`
 * - 链路追踪 → `spec.deployment.annotations['servicemesh.kubesphere.io/enabled']`
 * - 服务注解 → `spec.service.annotations` (LoadBalancer only, like the old dialog)
 * - 配置选项 → `spec.controller.config`
 * - NodePort → the gateway Service's ports (the CRD has no nodePort field)
 *
 * Validation is local and blocking: a negative replica, a NodePort outside the
 * Kubernetes default range, a duplicate NodePort or a missing access type never reaches
 * the API. The API is still the last line (the server rejects out-of-range NodePorts with
 * 422), but a form that only fails server-side wastes the reader's input.
 */
export interface GatewayEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: string;
  namespace: string;
  gateway: GatewayDetail | undefined;
  /** Called after a successful save so the host can refetch. */
  onSaved?: () => void;
}

interface PairRow {
  id: string;
  key: string;
  value: string;
}

/** Kubernetes' default NodePort range; the API server rejected 1234 in the probe. */
const NODE_PORT_MIN = 30000;
const NODE_PORT_MAX = 32767;

function pairsOf(record: Record<string, string>): PairRow[] {
  return Object.entries(record).map(([key, value], index) => ({ id: 'row-' + index, key, value }));
}

function mapOf(rows: PairRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (key) out[key] = row.value;
  }
  return out;
}

function pairId(seed: string): string {
  return seed + '-' + Math.random().toString(36).slice(2, 8);
}

export function GatewayEditDialog({
  open,
  onOpenChange,
  cluster,
  namespace,
  gateway,
  onSaved,
}: GatewayEditDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [type, setType] = React.useState<'NodePort' | 'LoadBalancer'>('NodePort');
  const [replicas, setReplicas] = React.useState('1');
  const [tracing, setTracing] = React.useState(false);
  const [annotations, setAnnotations] = React.useState<PairRow[]>([]);
  const [config, setConfig] = React.useState<PairRow[]>([]);
  const [nodePorts, setNodePorts] = React.useState<Record<string, string>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  /*
   * Reset on every open: the same dialog instance is reused for different rows on the
   * cluster page, and an old attempt's values must not leak into the next gateway.
   */
  React.useEffect(() => {
    if (!open) return;
    const nextType = gateway?.type === 'LoadBalancer' ? 'LoadBalancer' : 'NodePort';
    setType(nextType);
    setReplicas(gateway?.replicas === undefined ? '1' : String(gateway.replicas));
    setTracing(Boolean(gateway?.tracing));
    setAnnotations(pairsOf(gateway?.serviceAnnotations ?? {}));
    setConfig(pairsOf(gateway?.controllerConfig ?? {}));
    setNodePorts(
      Object.fromEntries((gateway?.ports ?? []).filter((port) => port.nodePort !== undefined).map((port) => [port.name, String(port.nodePort)])),
    );
    setErrors({});
  }, [open, gateway?.name, gateway?.resourceVersion, gateway?.type, gateway?.replicas, gateway?.tracing]);

  const validation = React.useMemo(() => {
    const next: Record<string, string> = {};
    if (type !== 'NodePort' && type !== 'LoadBalancer') next.type = t('settings.gateway.validationType');
    if (!/^\d+$/.test(replicas.trim())) next.replicas = t('settings.gateway.validationReplicas');
    if (type === 'NodePort') {
      const seen = new Set<number>();
      for (const [name, raw] of Object.entries(nodePorts)) {
        const value = raw.trim();
        if (!value) continue;
        if (!/^\d+$/.test(value)) {
          next['nodePorts:' + name] = t('settings.gateway.validationNodePort');
          continue;
        }
        const parsed = Number(value);
        if (parsed < NODE_PORT_MIN || parsed > NODE_PORT_MAX) {
          next['nodePorts:' + name] = t('settings.gateway.validationNodePort');
          continue;
        }
        if (seen.has(parsed)) next['nodePorts:' + name] = t('settings.gateway.validationNodePortDuplicate');
        seen.add(parsed);
      }
    }
    return next;
  }, [nodePorts, replicas, t, type]);

  const effectiveErrors = { ...validation, ...errors };
  const blocked = Object.keys(effectiveErrors).length > 0;

  const save = useMutation({
    mutationFn: async () => {
      if (!gateway) throw new Error('no gateway');
      const changes: GatewayChanges = {
        type,
        replicas: Number(replicas),
        tracing,
        serviceAnnotations: type === 'LoadBalancer' ? mapOf(annotations) : {},
        controllerConfig: mapOf(config),
      };
      await projectGatewaysApi(apiClient).update({ cluster, namespace, name: gateway.name, changes });
      // Only write ports the reader actually changed: an unchanged save must not depend
      // on the Service being readable at that moment.
      const current = new Map((gateway.ports ?? []).map((port) => [port.name, port.nodePort]));
      const pins = Object.entries(nodePorts)
        .map(([name, raw]) => [name, raw.trim()] as const)
        .filter(([name, raw]) => raw !== '' && Number(raw) !== current.get(name));
      if (type === 'NodePort' && pins.length > 0) {
        await projectGatewaysApi(apiClient).setNodePorts({
          cluster,
          namespace,
          name: gateway.name,
          nodePorts: Object.fromEntries(pins.map(([name, raw]) => [name, Number(raw)])),
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-gateway'] });
      void queryClient.invalidateQueries({ queryKey: ['cluster-gateways'] });
      onSaved?.();
      onOpenChange(false);
    },
  });

  const addRow = (setter: React.Dispatch<React.SetStateAction<PairRow[]>>) => {
    setter((rows) => [...rows, { id: pairId('pair'), key: '', value: '' }]);
  };

  const pairEditor = (
    rows: PairRow[],
    setter: React.Dispatch<React.SetStateAction<PairRow[]>>,
    prefix: string,
    label: string,
    hint: string,
  ) => (
    <FormField label={label} hint={hint}>
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div key={row.id} className="flex items-center gap-2">
            <Input
              className="flex-1"
              value={row.key}
              placeholder={t('settings.gateway.annotationKey')}
              aria-label={t('settings.gateway.annotationKey')}
              {...actionProps(prefix + ':key:' + index)}
              onChange={(event) =>
                setter((current) => current.map((entry) => (entry.id === row.id ? { ...entry, key: event.target.value } : entry)))
              }
            />
            <Input
              className="flex-1"
              value={row.value}
              placeholder={t('settings.gateway.annotationValue')}
              aria-label={t('settings.gateway.annotationValue')}
              {...actionProps(prefix + ':value:' + index)}
              onChange={(event) =>
                setter((current) => current.map((entry) => (entry.id === row.id ? { ...entry, value: event.target.value } : entry)))
              }
            />
            <AiButton
              aiId={prefix + ':remove:' + index}
              size="sm"
              variant="ghost"
              onClick={() => setter((current) => current.filter((entry) => entry.id !== row.id))}
            >
              {t('settings.gateway.remove')}
            </AiButton>
          </div>
        ))}
        <div>
          <Button size="sm" variant="ghost" {...actionProps(prefix + ':add')} onClick={() => addRow(setter)}>
            {t('settings.gateway.add')}
          </Button>
        </div>
      </div>
    </FormField>
  );

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !save.isPending && onOpenChange(next)}
      closeDisabled={save.isPending}
      size="lg"
      title={t('settings.gateway.editTitle')}
      description={gateway?.name ? gateway.name : undefined}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={save.isPending} {...actionProps('gateway:edit:cancel')} onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <AiButton
            aiId="gateway:edit:save"
            size="sm"
            disabled={blocked || !gateway || save.isPending}
            aria-busy={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? t('settings.gateway.saving') : t('settings.gateway.save')}
          </AiButton>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <FormField
          label={t('settings.gateway.type')}
          required
          error={effectiveErrors.type ?? ''}
          errorAiId="gateway:edit:type:error"
        >
          <Select
            value={type}
            onValueChange={(value) => setType(value === 'LoadBalancer' ? 'LoadBalancer' : 'NodePort')}
            data-ai-id="gateway:edit:type"
            options={[
              { value: 'NodePort', label: 'NodePort' },
              { value: 'LoadBalancer', label: 'LoadBalancer' },
            ]}
          />
        </FormField>

        <FormField
          label={t('settings.gateway.replicas')}
          required
          hint={t('settings.gateway.replicasHint')}
          error={effectiveErrors.replicas ?? ''}
          errorAiId="gateway:edit:replicas:error"
        >
          <Input
            type="number"
            min={0}
            step={1}
            value={replicas}
            data-ai-id="gateway:edit:replicas"
            onChange={(event) => setReplicas(event.target.value)}
          />
        </FormField>

        <FormField label={t('settings.gateway.tracing')} hint={t('settings.gateway.tracingHint')}>
          <div className="flex items-center gap-2">
            <Switch
              checked={tracing}
              onCheckedChange={setTracing}
              data-ai-id="gateway:edit:tracing"
              aria-label={t('settings.gateway.tracing')}
            />
            <span className="text-xs text-ai-fg-secondary">{tracing ? t('settings.gateway.on') : t('settings.gateway.off')}</span>
          </div>
        </FormField>

        {type === 'NodePort' ? (
          <FormField label={t('settings.gateway.nodePorts')} hint={t('settings.gateway.nodePortsHint')}>
            <div className="flex flex-col gap-2">
              {(gateway?.ports ?? []).length === 0 ? (
                <p className="text-xs text-ai-fg-muted" data-ai-id="gateway:edit:node-ports-pending">
                  {t('settings.gateway.nodePortsPending')}
                </p>
              ) : (gateway?.ports ?? []).map((port) => (
                <div key={port.name} className="flex flex-col gap-1">
                  <label className="text-xs text-ai-fg-secondary" htmlFor={'gateway-node-port-' + port.name}>
                    {port.name.toUpperCase()} · {port.port}
                  </label>
                  <Input
                    id={'gateway-node-port-' + port.name}
                    type="number"
                    inputMode="numeric"
                    placeholder={t('settings.gateway.nodePortAuto')}
                    value={nodePorts[port.name] ?? ''}
                    data-ai-id={'gateway:edit:node-port:' + port.name}
                    onChange={(event) =>
                      setNodePorts((current) => ({ ...current, [port.name]: event.target.value }))
                    }
                  />
                  {effectiveErrors['nodePorts:' + port.name] ? (
                    <p role="alert" className="text-xs text-ai-danger" data-ai-id={'gateway:edit:node-port:' + port.name + ':error'}>
                      {effectiveErrors['nodePorts:' + port.name]}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </FormField>
        ) : null}

        {type === 'LoadBalancer'
          ? pairEditor(
              annotations,
              setAnnotations,
              'gateway:edit:annotation',
              t('settings.gateway.serviceAnnotations'),
              t('settings.gateway.serviceAnnotationsHint'),
            )
          : null}

        {pairEditor(config, setConfig, 'gateway:edit:config', t('settings.gateway.controllerConfig'), t('settings.gateway.controllerConfigHint'))}

        {save.isError ? (
          <p role="alert" className="text-xs text-ai-danger" data-ai-id="gateway:edit:error">
            {(save.error as { code?: string } | null)?.code === 'node_ports_pending'
              ? t('settings.gateway.nodePortsPending')
              : errorMessage(t, save.error)}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { gpusApi, nodeListApi } from '@kube-ai-hub/api-client';
import { Button, Modal, ResourceForm, Skeleton, type FormSchema } from '@kube-ai-hub/ui';
import { api } from '@/api';
import { useT } from '@/i18n';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { buildModeParams, GPU_MODES, modeResult, sameModeParams, type ModeRequest } from './gpuModeConfig';

export function GpuModeDialog({ cluster, name, onClose, onUpdated }: {
  cluster: string; name: string; onClose: () => void; onUpdated: () => void;
}): React.ReactElement {
  const t = useT();
  const [values, setValues] = React.useState<Record<string, unknown> | null>(null);
  const [request, setRequest] = React.useState<ModeRequest | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const [localError, setLocalError] = React.useState('');
  const [, updateClock] = React.useReducer((value: number) => value + 1, 0);
  React.useEffect(() => {
    if (!request) return;
    const timer = setTimeout(updateClock, Math.max(0, request.startedAt + 300_000 - Date.now()));
    return () => clearTimeout(timer);
  }, [request]);
  const node = useQuery({
    queryKey: ['node-gpu-mode', cluster, name], retry: false, staleTime: 0,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: ({ signal }) => nodeListApi(api).get({ cluster, name, signal }),
    refetchInterval: (query) => request && ['waiting', 'in_progress'].includes(modeResult(query.state.data, request)) ? 3000 : false,
  });
  const vendor = node.data?.gpuVendor?.toLowerCase() ?? '';
  const modes = GPU_MODES[vendor] ?? [];
  const selected = modes.find((entry) => entry.value === values?.mode);
  const result = request ? modeResult(node.data, request) : null;
  const monitoring = result === 'waiting' || result === 'in_progress';
  const loading = node.isPending || (values === null && node.isFetching);
  React.useEffect(() => {
    if (!node.data || node.isFetching || values) return;
    const mode = node.data.gpuMode ?? '';
    const definition = GPU_MODES[node.data.gpuVendor?.toLowerCase() ?? '']?.find((entry) => entry.value === mode);
    setValues({ mode, ...Object.fromEntries((definition?.parameters ?? []).map((parameter) =>
      [parameter.key, Number(node.data?.gpuModeParams?.[parameter.key] ?? parameter.defaultValue)])) });
  }, [node.data, node.isFetching, values]);
  React.useEffect(() => { if (result === 'completed') onUpdated(); }, [result]);

  const save = useMutation({
    mutationFn: async () => {
      const mode = String(values?.mode ?? '');
      const params = buildModeParams(vendor, mode, values ?? {});
      const pending: ModeRequest = { mode, params, baselineTimestamp: node.data?.gpuModeDesired?.timestamp ?? '', startedAt: Date.now() };
      await gpusApi(api).setMode({ cluster, node: name, mode, params });
      setRequest(pending);
      onUpdated();
      void node.refetch();
    },
  });
  const schema: FormSchema = {
    fields: [
      { key: 'mode', label: t('node.detail.gpuMode'), type: 'select', required: true,
        disabled: monitoring, options: modes.map((mode) => ({ value: mode.value, label: t(mode.labelKey) })) },
      ...(selected?.parameters ?? []).map((parameter) => ({
        key: parameter.key, label: t(parameter.labelKey), type: 'number', required: true, disabled: monitoring,
        min: parameter.integer ? 1 : 0.000001, step: parameter.integer ? 1 : 0.01,
        rules: [{ validate: (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0 &&
          (!parameter.integer || Number.isInteger(Number(value))) ? null : t('node.mode.invalid') }],
      })),
    ],
    submit: { label: t('node.mode.confirm'), cancelLabel: t('common.close') },
  };
  const prepare = () => {
    if (monitoring || !node.data || !values) return;
    const mode = String(values.mode);
    const params = buildModeParams(vendor, mode, values);
    const currentDefinition = modes.find((entry) => entry.value === node.data?.gpuMode);
    const currentParams = Object.fromEntries((currentDefinition?.parameters ?? []).map((parameter) =>
      [parameter.key, String(node.data?.gpuModeParams?.[parameter.key] ?? parameter.defaultValue)]));
    if (mode === node.data.gpuMode && sameModeParams(params, currentParams)) { setLocalError(t('node.mode.unchanged')); return; }
    setLocalError('');
    setConfirm(true);
  };
  return <Modal open size="lg" title={`${t('node.mode.title')} · ${name}`} description={`${cluster} / ${name}`}
    closeDisabled={save.isPending}
    closeAiId="node-mode:close" closeLabel={t('common.close')}
    onOpenChange={(open) => { if (!open && !save.isPending) onClose(); }}>
    <div data-ai-id="node-mode:surface"
      data-ai-state={loading ? 'loading' : node.isError ? 'error' : node.isFetching ? 'refreshing' : 'ready'}>
      <p className="mb-3 text-sm text-ai-warning">{t('node.mode.warning')}</p>
      {selected?.descriptionKey ? <p className="mb-3 text-sm">{t(selected.descriptionKey)}</p> : null}
      {loading ? <Skeleton className="h-40" /> : node.isError ?
        <ResourceErrorPanel error={node.error} onRetry={() => void node.refetch()} retryAiId="node-mode:retry" /> :
        modes.length === 0 ? <p>{t('node.mode.unsupported')}</p> :
        values ? <ResourceForm schema={schema} values={values} submitting={save.isPending || monitoring}
          onChange={(next) => {
            setLocalError('');
            if (request && !monitoring) setRequest(null);
            if (next.mode !== values.mode) {
              const nextMode = modes.find((entry) => entry.value === next.mode);
              setValues({ mode: next.mode, ...Object.fromEntries((nextMode?.parameters ?? []).map((parameter) => [parameter.key, parameter.defaultValue])) });
            } else setValues(next);
          }} onCancel={() => { if (!save.isPending) onClose(); }} onSubmit={prepare} /> : null}
      {localError || save.error ? <p role="alert" className="mt-2 text-sm text-ai-danger">{localError || save.error?.message}</p> : null}
      {result ? <div className="mt-3 text-sm" role="status" data-ai-id="node-mode:result" data-mode-state={result}>
        <p>{t(`node.mode.${result}`)}</p>
        {result === 'failed' ? <p>{node.data?.gpuModeStatus?.message}</p> : null}
        {['timeout', 'external', 'failed'].includes(result) ? <Button size="sm" variant="secondary" onClick={() => void node.refetch()}>{t('common.refresh')}</Button> : null}
      </div> : null}
    </div>
    {confirm ? <Modal open title={t('node.mode.confirm')} size="sm" description={`${cluster} / ${name}`}
      closeDisabled={save.isPending}
      onOpenChange={(open) => { if (!open && !save.isPending) setConfirm(false); }}>
      <p className="text-sm text-ai-warning">{t('node.mode.warning')}</p>
      <p className="my-2 text-sm">{node.data?.gpuMode || '-'} → {String(values?.mode)}</p>
      <dl className="text-xs">{(selected?.parameters ?? []).map((parameter) => <div key={parameter.key} className="mb-1">
        <dt>{t(parameter.labelKey)}</dt><dd>{node.data?.gpuModeParams?.[parameter.key] ?? '-'} → {String(values?.[parameter.key])}</dd>
      </div>)}</dl>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" disabled={save.isPending} onClick={() => setConfirm(false)}>{t('common.cancel')}</Button>
        <Button data-ai-id="node-mode:submit" disabled={save.isPending} loading={save.isPending}
          onClick={async () => { try { await save.mutateAsync(); } catch { /* The draft remains in the parent form. */ } finally { setConfirm(false); } }}>{t('common.confirm')}</Button>
      </div>
    </Modal> : null}
  </Modal>;
}

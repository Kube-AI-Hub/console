import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { KubeObject } from '@kube-ai-hub/api-client';
import type { FormSchema } from '@kube-ai-hub/ui';
import { api, workloadsApi } from '@/api';
import { useT } from '@/i18n';
import { useProjectOptions } from '@/components/projects/useProjects';
import { ManifestCreateDialog } from '@/components/resource/ManifestCreateDialog';
import { jobManifest, type JobKind } from './jobManifest';

export function JobCreateDialog({ kind, cluster, namespace, onOpenChange }: {
  kind: JobKind; cluster: string; namespace: string; onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const t = useT();
  const projects = useProjectOptions(cluster);
  const cache = useQueryClient();
  const create = useMutation({
    mutationFn: (body: KubeObject) => workloadsApi(api, kind).createManifest({
      cluster, namespace: body.metadata?.namespace ?? '', body,
    }),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: [kind] }); onOpenChange(false); },
  });
  const integerRule = (value: unknown) => Number.isInteger(Number(value)) && Number(value) >= 0 ? null : t('jobCreate.integerInvalid');
  const schema: FormSchema = {
    submit: { label: t('common.confirm'), cancelLabel: t('common.cancel') },
    fields: [
      { key: 'namespace', label: t('workloads.create.namespace'), type: 'select', required: true, options: projects },
      { key: 'name', label: t('workloads.create.name'), type: 'text', required: true,
        rules: [{ validate: (value) => /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(String(value)) && String(value).length <= 63 ? null : t('workloads.create.nameInvalid') }] },
      { key: 'image', label: t('workloads.create.image'), type: 'text', required: true },
      { key: 'app', label: t('workloads.create.appLabel'), type: 'text' },
      { key: 'parallelism', label: t('jobCreate.parallelism'), type: 'number', required: true, rules: [{ validate: integerRule }] },
      { key: 'completions', label: t('jobCreate.completions'), type: 'number', required: true, rules: [{ validate: integerRule }] },
      { key: 'backoffLimit', label: t('jobCreate.backoffLimit'), type: 'number', required: true, rules: [{ validate: integerRule }] },
      { key: 'activeDeadlineSeconds', label: t('jobCreate.deadline'), type: 'number', min: 1,
        rules: [{ validate: (value) => !value || Number.isInteger(Number(value)) ? null : t('jobCreate.integerInvalid') }] },
      { key: 'restartPolicy', label: t('jobCreate.restartPolicy'), type: 'select',
        options: ['Never', 'OnFailure'].map((value) => ({ value, label: value })) },
      { key: 'imagePullPolicy', label: t('workloads.editSettings.pullPolicy'), type: 'select',
        options: ['IfNotPresent', 'Always', 'Never'].map((value) => ({ value, label: value })) },
      ...(kind === 'cronjobs' ? [
        { key: 'schedule', label: t('jobCreate.schedule'), type: 'text' as const, required: true, hint: t('jobCreate.scheduleHint') },
        { key: 'concurrencyPolicy', label: t('jobCreate.concurrency'), type: 'select' as const,
          options: ['Forbid', 'Allow', 'Replace'].map((value) => ({ value, label: value })) },
        { key: 'suspend', label: t('jobCreate.suspend'), type: 'switch' as const },
        { key: 'successfulJobsHistoryLimit', label: t('jobCreate.successHistory'), type: 'number' as const, rules: [{ validate: integerRule }] },
        { key: 'failedJobsHistoryLimit', label: t('jobCreate.failureHistory'), type: 'number' as const, rules: [{ validate: integerRule }] },
      ] : []),
    ],
  };
  return <ManifestCreateDialog resource={kind} title={t(kind === 'jobs' ? 'jobCreate.title' : 'jobCreate.cronTitle')}
    description={t('jobCreate.hint')} schema={schema} initialValues={{
      namespace, name: '', image: '', parallelism: 1, completions: 1, backoffLimit: 6,
      restartPolicy: 'Never', imagePullPolicy: 'IfNotPresent', schedule: '0 * * * *',
      concurrencyPolicy: 'Forbid', suspend: false, successfulJobsHistoryLimit: 3, failedJobsHistoryLimit: 1,
    }} buildManifest={(values) => jobManifest(kind, values)} pending={create.isPending}
    onOpenChange={onOpenChange} onSubmit={(body) => create.mutateAsync(body)} />;
}

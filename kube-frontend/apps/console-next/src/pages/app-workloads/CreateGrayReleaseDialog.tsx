import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { strategiesApi, workloadsApi, type StrategyType } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Button, Input, Modal, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage } from '@/components/resource/ResourceErrorPanel';

/**
 * 创建灰度发布（最小向导）.
 *
 * Three inputs are enough for a runnable Strategy: a name, the deployment being released,
 * and the strategy type. The shape below is the one the servicemesh controller accepted
 * when probed: type + selector matching the workload + a VirtualService template whose
 * host is the workload's app label, with v1/v2 destinations. Traffic weights and match
 * rules are intentionally left at controller defaults — editing those belongs to the
 * follow-up release-detail work.
 *
 * Submission is two-step: the form is validated locally, then a confirmation panel names
 * what will be created. The API is called only from the confirm button, so a half-typed
 * release never reaches the controller.
 */
export interface CreateGrayReleaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: string;
  namespace: string;
  onCreated: (name: string) => void;
}

type Step = 'form' | 'confirm';

const TYPES: StrategyType[] = ['Canary', 'Bluegreen', 'Mirror'];

/** A DNS-1123 label is what metadata.name must be; the old console used the same rule. */
const NAME_PATTERN = /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/;

/** Workload app label → the selector and the Istio host of the minimal strategy. */
function targetOf(workload: { name: string; app: string }): string {
  return workload.app || workload.name;
}

function strategyManifest(name: string, workload: { name: string; app: string }, type: StrategyType, namespace: string) {
  const target = targetOf(workload);
  return {
    apiVersion: 'servicemesh.kubesphere.io/v1alpha2',
    kind: 'Strategy',
    metadata: {
      name,
      namespace,
      labels: { app: target },
    },
    spec: {
      type,
      principal: 'v1',
      governor: 'v2',
      strategyPolicy: 'WaitForWorkloadReady',
      selector: { matchLabels: { app: target } },
      template: {
        metadata: { labels: { app: target } },
        spec: {
          hosts: [target],
          http: [
            {
              route: [
                { destination: { host: target, subset: 'v1' } },
                { destination: { host: target, subset: 'v2' } },
              ],
            },
          ],
        },
      },
    },
  };
}

export function CreateGrayReleaseDialog({
  open,
  onOpenChange,
  cluster,
  namespace,
  onCreated,
}: CreateGrayReleaseDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [step, setStep] = React.useState<Step>('form');
  const [name, setName] = React.useState('');
  const [workloadName, setWorkloadName] = React.useState('');
  const [type, setType] = React.useState<StrategyType>('Canary');
  const [error, setError] = React.useState('');

  const workloads = useQuery({
    enabled: open,
    queryKey: ['workloads', 'deployments', cluster, namespace, 'grayrelease-picker'],
    queryFn: ({ signal }) =>
      workloadsApi(apiClient, 'deployments').list({ cluster, namespace, page: 1, pageSize: -1, signal }),
  });

  const deployments = workloads.data?.items ?? [];
  const selected = deployments.find((item) => item.name === workloadName) ?? deployments[0];

  // Reset on each open: a previous attempt's draft must not satisfy a new release.
  React.useEffect(() => {
    if (!open) return;
    setStep('form');
    setName('');
    setType('Canary');
    setError('');
  }, [open]);

  React.useEffect(() => {
    const first = deployments[0];
    if (!workloadName && first) setWorkloadName(first.name);
  }, [deployments, workloadName]);

  const create = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('no deployment selected');
      return strategiesApi(apiClient).create({
        cluster,
        namespace,
        body: strategyManifest(name.trim(), selected, type, namespace),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['strategies', cluster, namespace] });
      onCreated(name.trim());
      onOpenChange(false);
    },
    onError: (cause) => setError(errorMessage(t, cause)),
  });

  function validate(): string {
    if (!NAME_PATTERN.test(name.trim())) return t('grayRelease.create.error.name');
    if (!selected) return t('grayRelease.create.error.workload');
    return '';
  }

  function next(): void {
    const problem = validate();
    setError(problem);
    if (!problem) setStep('confirm');
  }

  function close(): void {
    if (create.isPending) return;
    onOpenChange(false);
  }

  const typeLabel = (value: StrategyType): string => {
    const key = value === 'Canary' ? 'grayRelease.type.canary' : value === 'Bluegreen' ? 'grayRelease.type.bluegreen' : 'grayRelease.type.mirror';
    return t(key);
  };

  return (
    <Modal open={open} onOpenChange={(nextOpen) => (nextOpen ? undefined : close())} title={t('grayRelease.create.title')} size="md">
      <div className="flex flex-col gap-4" data-ai-id="grayrelease:create-dialog">
        {workloads.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : step === 'form' ? (
          <>
            <p className="text-xs text-ai-fg-muted">{t('grayRelease.create.description')}</p>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-ai-fg-muted">{t('grayRelease.create.name')}</span>
              <Input
                value={name}
                maxLength={63}
                aria-label={t('grayRelease.create.name')}
                {...actionProps('grayrelease:create-name')}
                onChange={(event) => setName(event.target.value)}
              />
              <span className="text-[11px] text-ai-fg-muted">{t('grayRelease.create.nameHint')}</span>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-ai-fg-muted">{t('grayRelease.create.workload')}</span>
              <select
                className="h-8 rounded-ai-md border border-ai-line bg-ai-bg px-2 text-xs text-ai-fg"
                value={selected?.name ?? ''}
                aria-label={t('grayRelease.create.workload')}
                data-ai-id="grayrelease:create-workload"
                onChange={(event) => setWorkloadName(event.target.value)}
              >
                {deployments.length === 0 ? <option value="">{t('grayRelease.create.noDeployments')}</option> : null}
                {deployments.map((deployment) => (
                  <option key={deployment.name} value={deployment.name}>
                    {deployment.name}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-ai-fg-muted">{t('grayRelease.create.workloadHint')}</span>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-ai-fg-muted">{t('grayRelease.create.type')}</span>
              <select
                className="h-8 rounded-ai-md border border-ai-line bg-ai-bg px-2 text-xs text-ai-fg"
                value={type}
                aria-label={t('grayRelease.create.type')}
                data-ai-id="grayrelease:create-type"
                onChange={(event) => setType(event.target.value as StrategyType)}
              >
                {TYPES.map((value) => (
                  <option key={value} value={value}>
                    {typeLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            {error ? (
              <p role="alert" className="text-xs text-ai-danger" data-ai-id="grayrelease:create-error">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" disabled={create.isPending} {...actionProps('grayrelease:create-cancel')} onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" disabled={create.isPending || deployments.length === 0} {...actionProps('grayrelease:create-next')} onClick={next}>
                {t('grayRelease.create.next')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-ai-fg-secondary">
              {t('grayRelease.create.confirmDescription', {
                name: name.trim(),
                workload: selected?.name ?? '-',
                type: typeLabel(type),
              })}
            </p>
            {error ? (
              <p role="alert" className="text-xs text-ai-danger" data-ai-id="grayrelease:create-error">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={create.isPending}
                {...actionProps('grayrelease:create-back')}
                onClick={() => setStep('form')}
              >
                {t('grayRelease.create.back')}
              </Button>
              <Button size="sm" disabled={create.isPending} {...actionProps('grayrelease:create-confirm')} onClick={() => create.mutate()}>
                {t('grayRelease.create.confirm')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

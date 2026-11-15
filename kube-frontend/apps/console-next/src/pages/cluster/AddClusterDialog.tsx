import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, clusterImportApi, type ClusterConnectionMode } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Alert, Button, Modal, Notify, Textarea } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { formatClusterImportError } from './clusterImportError';

/**
 * 添加集群 — import an existing cluster, directly or through an agent.
 *
 * The old console's 添加集群 offers two ways in: provision a new cluster with KubeKey, or
 * import an existing one. Provisioning needs the kubekey API plus a host inventory, which
 * this installation does not run, so importing is what is offered here — in both of the
 * connection modes the platform supports.
 *
 * The modes differ in what the reader has to supply:
 *
 * - **直接连接** carries a kubeconfig and the platform *checks it first*
 *   (`/clusters/validation`). A wrong kubeconfig is then reported immediately instead of
 *   producing a cluster that never becomes ready.
 * - **代理连接** carries no kubeconfig: the member cluster installs an agent that dials
 *   out. Nothing can be validated up front, so the dialog explains what to run next.
 *
 * Name and kubeconfig are checked before the request too: a name Kubernetes rejects and a
 * pasted non-kubeconfig both come back as a 422 whose message says nothing a reader can
 * act on.
 */
export interface AddClusterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the object is created, so the list can refetch. */
  onCreated?: () => void;
}

const NAME_PATTERN = /^[a-z][a-z0-9-]*[a-z0-9]$/;

/** A kubeconfig always carries these three; checking for them catches a wrong paste. */
function looksLikeKubeconfig(text: string): boolean {
  return text.includes('apiVersion') && text.includes('clusters:') && text.includes('server:');
}

export function AddClusterDialog({ open, onOpenChange, onCreated }: AddClusterDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [mode, setMode] = React.useState<ClusterConnectionMode>('direct');
  const [name, setName] = React.useState('');
  const [kubeconfig, setKubeconfig] = React.useState('');
  const [provider, setProvider] = React.useState('');
  const [alias, setAlias] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [kubeconfigError, setKubeconfigError] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: {
      name: string;
      mode: ClusterConnectionMode;
      kubeconfig?: string;
      provider?: string;
      alias?: string;
      description?: string;
    }) => {
      const api = clusterImportApi(apiClient);
      if (input.mode === 'direct') {
        /*
         * Validate before creating. The old console does the same and it is the
         * difference between "this kubeconfig cannot reach the cluster" and a cluster
         * object that sits not-ready forever with no explanation.
         *
         * A validation endpoint that is missing (older/newer installations) must not make
         * the feature unusable: only the endpoint's actual refusal stops the create.
         */
        try {
          await api.validate(input);
        } catch (error) {
          if (error instanceof ApiError && error.isNotFound) {
            // No validation endpoint on this installation — carry on.
          } else {
            throw error;
          }
        }
      }
      await api.import(input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clusters'] });
      onCreated?.();
      onOpenChange(false);
    },
    onError: (error) => {
      const copy = formatClusterImportError(t, error);
      Notify.error({
        title: copy.title,
        content: copy.body,
        duration: 10_000,
        key: 'clusters:add-error',
      });
    },
  });

  React.useEffect(() => {
    if (open) return;
    // Reopening starts clean: a half-typed kubeconfig from the previous attempt is not
    // something the reader wants to be handed back.
    setMode('direct');
    setName('');
    setKubeconfig('');
    setProvider('');
    setAlias('');
    setDescription('');
    setNameError(null);
    setKubeconfigError(null);
    mutation.reset();
  }, [open, mutation]);

  const submit = React.useCallback(() => {
    const trimmedName = name.trim();
    const trimmedConfig = kubeconfig.trim();
    const invalidName = !NAME_PATTERN.test(trimmedName);
    setNameError(invalidName ? t('cluster.add.nameInvalid') : null);

    // Proxy mode has no kubeconfig to check: the agent dials out.
    const configIsValid = mode === 'proxy' || looksLikeKubeconfig(trimmedConfig);
    setKubeconfigError(configIsValid ? null : t('cluster.add.kubeconfigInvalid'));

    if (invalidName || !configIsValid) return;
    mutation.reset();
    mutation.mutate({
      name: trimmedName,
      mode,
      ...(mode === 'direct' ? { kubeconfig: trimmedConfig } : {}),
      ...(provider.trim() ? { provider: provider.trim() } : {}),
      ...(alias.trim() ? { alias: alias.trim() } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
    });
  }, [alias, description, kubeconfig, mode, mutation, name, provider, t]);

  const requestError = mutation.error ? formatClusterImportError(t, mutation.error) : null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('cluster.add.title')}
      description={t('cluster.add.description')}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} {...actionProps('clusters:add-cancel')}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} loading={mutation.isPending} {...actionProps('clusters:add-submit')}>
            {mutation.isPending && mode === 'direct' ? t('cluster.add.validating') : t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <fieldset className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
          <legend className="mb-1">{t('cluster.add.mode')}</legend>
          <div className="flex gap-2" role="radiogroup" aria-label={t('cluster.add.mode')}>
            {(
              [
                { value: 'direct', label: t('cluster.add.modeDirect') },
                { value: 'proxy', label: t('cluster.add.modeProxy') },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-center gap-1.5 rounded-ai-md border px-3 py-2 text-sm ${
                  mode === option.value
                    ? 'border-ai-accent bg-ai-surface-2 text-ai-fg'
                    : 'border-ai-line text-ai-fg-secondary'
                }`}
              >
                <input
                  type="radio"
                  name="cluster-add-mode"
                  value={option.value}
                  checked={mode === option.value}
                  onChange={() => setMode(option.value)}
                  data-ai-id={`clusters:add-mode:${option.value}`}
                />
                {option.label}
              </label>
            ))}
          </div>
          <span className="text-[11px] text-ai-fg-muted">{t('cluster.add.modeDesc')}</span>
        </fieldset>

        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-cluster-name">
          {t('cluster.add.name')}
          <input
            id="ai-field-cluster-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-9 rounded-ai-md border border-ai-line bg-ai-surface px-2 text-sm text-ai-fg"
            placeholder="member-cluster"
            {...actionProps('clusters:add-name')}
          />
          <span className="text-[11px] text-ai-fg-muted">{t('cluster.add.nameHint')}</span>
          {nameError ? <span className="text-[11px] text-ai-danger" role="alert">{nameError}</span> : null}
        </label>

        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-cluster-alias">
          {t('cluster.edit.alias')}
          <input
            id="ai-field-cluster-alias"
            value={alias}
            maxLength={63}
            onChange={(event) => setAlias(event.target.value)}
            className="h-9 rounded-ai-md border border-ai-line bg-ai-surface px-2 text-sm text-ai-fg"
            placeholder={t('cluster.add.aliasPlaceholder')}
            {...actionProps('clusters:add-alias')}
          />
          <span className="text-[11px] text-ai-fg-muted">{t('cluster.edit.aliasHint')}</span>
        </label>

        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-cluster-provider">
          {t('cluster.edit.provider')}
          <input
            id="ai-field-cluster-provider"
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            className="h-9 rounded-ai-md border border-ai-line bg-ai-surface px-2 text-sm text-ai-fg"
            placeholder="Kube AI Hub"
            {...actionProps('clusters:add-provider')}
          />
          <span className="text-[11px] text-ai-fg-muted">{t('cluster.edit.providerHint')}</span>
        </label>

        <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-cluster-description">
          {t('cluster.edit.descriptionLabel')}
          <Textarea
            id="ai-field-cluster-description"
            value={description}
            maxLength={256}
            rows={2}
            onChange={(event) => setDescription(event.target.value)}
            {...actionProps('clusters:add-description')}
          />
        </label>

        {mode === 'direct' ? (
          <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor="ai-field-cluster-kubeconfig">
            {t('cluster.add.kubeconfig')}
            <Textarea
              id="ai-field-cluster-kubeconfig"
              value={kubeconfig}
              onChange={(event) => setKubeconfig(event.target.value)}
              rows={8}
              className="font-mono text-[11px]"
              placeholder="apiVersion: v1&#10;clusters:&#10;- cluster:&#10;    server: https://…"
              {...actionProps('clusters:add-kubeconfig')}
            />
            <span className="text-[11px] text-ai-fg-muted">{t('cluster.add.kubeconfigHint')}</span>
            {kubeconfigError ? (
              <span className="text-[11px] text-ai-danger" role="alert">{kubeconfigError}</span>
            ) : null}
          </label>
        ) : (
          <div
            className="rounded-ai-md border border-ai-line bg-ai-surface-2/40 p-3 text-xs text-ai-fg-secondary"
            data-ai-id="clusters:add-proxy-tip"
          >
            <p>{t('cluster.add.proxyTip')}</p>
            {/* What happens after submit: the object exists immediately, readiness waits for
                the agent. Saying so here is the difference between "it is broken" and "it is
                waiting". */}
            <p className="mt-2 text-ai-fg-muted">{t('cluster.add.proxyNext')}</p>
          </div>
        )}

        {mode === 'direct' ? (
          <p className="text-[11px] text-ai-fg-muted">{t('cluster.add.directTip')}</p>
        ) : null}

        {requestError ? (
          <Alert tone="danger" title={requestError.title} data-ai-id="clusters:add-error">
            <p>{requestError.body}</p>
            {requestError.raw ? <p className="mt-1 break-all opacity-80">{requestError.raw}</p> : null}
          </Alert>
        ) : null}
      </div>
    </Modal>
  );
}
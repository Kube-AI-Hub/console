import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, clusterImportApi, type ClusterConnectionMode } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Alert, Button, FormField, Input, Modal, Notify, Radio, RadioGroup, focusFirstInvalidField } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { formatClusterImportError } from './clusterImportError';
import { ClusterIdentityFields } from './ClusterIdentityFields';

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
 * The fields are grouped the way the old console's two wizard steps were — basic
 * information, then connection — without the wizard itself: eight fields do not need
 * pagination, and a reader who mistypes an alias should not have to page back.
 *
 * Name and kubeconfig are checked before the request too: a name Kubernetes rejects and a
 * pasted non-kubeconfig both come back as a 422 whose message says nothing a reader can
 * act on. The name is also checked against the platform on blur, so "this name is taken"
 * arrives while the reader is still filling in the rest.
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

/**
 * Where the platform's documentation explains obtaining a kubeconfig.
 *
 * The old console builds this from `resourceDocs.kube_config` in its server config; this
 * app has no server-rendered config, and the docs site ships with the console, so the
 * path is a constant here. It resolves through the same `/kube-docs` mount.
 */
const KUBECONFIG_DOC_URL = '/kube-docs/docs/multicluster-management/enable-multicluster/retrieve-kubeconfig/';

export function AddClusterDialog({ open, onOpenChange, onCreated }: AddClusterDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [mode, setMode] = React.useState<ClusterConnectionMode>('direct');
  const [name, setName] = React.useState('');
  const [kubeconfig, setKubeconfig] = React.useState('');
  const [provider, setProvider] = React.useState('');
  const [group, setGroup] = React.useState('');
  const [alias, setAlias] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [kubeconfigError, setKubeconfigError] = React.useState<string | null>(null);
  /*
   * Whether the platform already has this name.
   *
   * Separate from `nameError` because it is an *answer*, not a validation failure of the
   * field's shape: the name can be perfectly well formed and still taken. It is asked on
   * blur only — a request per keystroke would turn typing into a load test.
   */
  const [nameTaken, setNameTaken] = React.useState(false);
  const [checkingName, setCheckingName] = React.useState(false);
  /**
   * The scrolling body, which is what has to scroll: the dialog itself is
   * `max-h-[90dvh]` and its content sits inside a `max-h-[70vh] overflow-y-auto` block.
   * `focusFirstInvalidField` searches within this subtree.
   */
  const formBodyRef = React.useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: async (input: {
      name: string;
      mode: ClusterConnectionMode;
      kubeconfig?: string;
      provider?: string;
      alias?: string;
      description?: string;
      group?: string;
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
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: ['clusters'] });
      onCreated?.();
      onOpenChange(false);
      /*
       * Say it worked. The old console does, and without it a proxy cluster — which
       * appears in the list but stays not-ready — is indistinguishable from a failure
       * the reader dismissed by accident.
       */
      Notify.success({ content: t('cluster.add.created', { name: input.name }) });
    },
    onError: (error) => {
      const copy = formatClusterImportError(t, error);
      Notify.error({
        title: copy.title,
        content: copy.body,
        // Stay until dismissed: a 10s toast on a tall dialog is gone before
        // the reader finishes reading the kubeconfig they just pasted.
        duration: 0,
        key: 'clusters:add-error',
      });
    },
  });

  const resetMutation = mutation.reset;
  React.useEffect(() => {
    if (open) return;
    // Reopening starts clean: a half-typed kubeconfig from the previous attempt is not
    // something the reader wants to be handed back.
    setMode('direct');
    setName('');
    setKubeconfig('');
    setProvider('');
    setGroup('');
    setAlias('');
    setDescription('');
    setNameError(null);
    setKubeconfigError(null);
    setNameTaken(false);
    setCheckingName(false);
    resetMutation();
  }, [open, resetMutation]);

  /**
   * Ask whether the name is free, once the reader has moved on from the field.
   *
   * A failure here is silent on purpose: the check is a convenience, and a network blip
   * must not stop the reader from filling in the form. The create path still answers 409
   * for a taken name, which is where it is authoritative.
   */
  const checkName = React.useCallback(async (candidate: string) => {
    const trimmed = candidate.trim();
    if (!trimmed || !NAME_PATTERN.test(trimmed)) {
      setNameTaken(false);
      return;
    }
    setCheckingName(true);
    try {
      setNameTaken(await clusterImportApi(apiClient).exists({ name: trimmed }));
    } catch {
      setNameTaken(false);
    } finally {
      setCheckingName(false);
    }
  }, []);

  const submit = React.useCallback(() => {
    const trimmedName = name.trim();
    const trimmedConfig = kubeconfig.trim();
    const invalidName = !NAME_PATTERN.test(trimmedName);
    setNameError(invalidName ? t('cluster.add.nameInvalid') : null);

    // Proxy mode has no kubeconfig to check: the agent dials out.
    const configIsValid = mode === 'proxy' || looksLikeKubeconfig(trimmedConfig);
    setKubeconfigError(configIsValid ? null : t('cluster.add.kubeconfigInvalid'));

    /*
     * Bring the first bad field into view.
     *
     * The dialog body scrolls (`max-h-[70vh]`) and the connection section sits below the
     * basic-information block: with only a name filled in, the kubeconfig error was
     * rendered below the fold and pressing 确认 looked like nothing happened. The name is
     * checked first because it is the first field in reading order.
     *
     * The scrolling itself is ai-kit's `focusFirstInvalidField` — the same helper
     * `ResourceForm` uses — so the two form flavours behave identically and there is one
     * place to fix a scroll offset.
     */
    if (invalidName || !configIsValid) {
      // The field key, not the DOM id: the kubeconfig control is a CodeMirror surface
      // with no id of its own, and the wrapper's `data-field-key` is what identifies it.
      const key = invalidName ? 'metadata.name' : 'spec.connection.kubeconfig';
      focusFirstInvalidField(formBodyRef.current, key);
      return;
    }
    // A taken name is reported by the create call (409). Submitting anyway keeps one
    // authority for that answer instead of two that can disagree.
    mutation.reset();
    mutation.mutate({
      name: trimmedName,
      mode,
      ...(mode === 'direct' ? { kubeconfig: trimmedConfig } : {}),
      ...(provider.trim() ? { provider: provider.trim() } : {}),
      ...(alias.trim() ? { alias: alias.trim() } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(group ? { group } : {}),
    });
  }, [alias, description, group, kubeconfig, mode, mutation, name, provider, t]);

  const requestError = mutation.error ? formatClusterImportError(t, mutation.error) : null;
  const errorRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!requestError) return;
    errorRef.current?.scrollIntoView({ block: 'nearest' });
  }, [requestError]);

  /*
   * The editor is CodeMirror (188 KB gzip). Imported on demand so the cluster list does
   * not pay for it: a reader who never adds a cluster downloads none of it.
   */
  const KubeconfigEditor = React.useMemo(() => React.lazy(() => import('@kube-ai-hub/ui/editor').then((module) => ({ default: module.YamlEditor }))), []);

  const nameMessages = [
    checkingName ? t('cluster.add.nameChecking') : null,
    nameTaken ? t('cluster.add.nameExists') : null,
  ].filter((message): message is string => message !== null);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('cluster.add.title')}
      description={t('cluster.add.description')}
      size="lg"
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
      <div ref={formBodyRef} className="flex flex-col gap-5">
        {requestError ? (
          <div ref={errorRef}>
            <Alert tone="danger" title={requestError.title} data-ai-id="clusters:add-error">
              <p>{requestError.body}</p>
              {requestError.raw ? <p className="mt-1 break-all opacity-80">{requestError.raw}</p> : null}
            </Alert>
          </div>
        ) : null}

        {/* ---- 基本信息 ---- */}
        <section className="flex flex-col gap-3" aria-labelledby="cluster-add-basic">
          <h3 id="cluster-add-basic" className="text-xs font-semibold text-ai-fg">
            {t('cluster.add.basicSection')}
          </h3>

          <FormField
            htmlFor="ai-field-cluster-name"
            fieldKey="metadata.name"
            label={t('cluster.add.name')}
            required
            hint={t('cluster.add.nameHint')}
            {...(nameError !== null ? { error: nameError } : nameTaken ? { error: t('cluster.add.nameExists') } : {})}
            errorAiId="clusters:add-name-error"
          >
            <Input
              id="ai-field-cluster-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                // A new value invalidates the previous answer; re-asked on blur.
                setNameTaken(false);
              }}
              onBlur={(event) => void checkName(event.target.value)}
              placeholder="member-cluster"
              {...actionProps('clusters:add-name')}
            />
            {/* The "checking" line has nowhere else to live: FormField shows either the
                error or the hint, and this is neither. */}
            {nameMessages.length && nameError === null ? (
              <p className="text-[11px] text-ai-fg-muted" role="status" data-ai-id="clusters:add-exists">
                {nameMessages.join(' ')}
              </p>
            ) : null}
          </FormField>

          <ClusterIdentityFields
            idPrefix="ai-field-cluster"
            aiPrefix="clusters:add"
            alias={alias}
            onAliasChange={setAlias}
            group={group}
            onGroupChange={setGroup}
            provider={provider}
            onProviderChange={setProvider}
            description={description}
            onDescriptionChange={setDescription}
          />
        </section>

        {/* ---- 连接设置 ---- */}
        <section className="flex flex-col gap-3" aria-labelledby="cluster-add-connection">
          <h3 id="cluster-add-connection" className="text-xs font-semibold text-ai-fg">
            {t('cluster.add.connectionSection')}
          </h3>

          <FormField label={t('cluster.add.mode')} hint={t('cluster.add.modeDesc')}>
            {/* Children rather than the `options` shortcut: each radio needs its own
                stable handle (`clusters:add-mode:direct|proxy`), and the shortcut does
                not carry one. */}
            <RadioGroup
              value={mode}
              onValueChange={(next: string) => setMode(next as ClusterConnectionMode)}
              aria-label={t('cluster.add.mode')}
            >
              {(
                [
                  { value: 'direct', label: t('cluster.add.modeDirect') },
                  { value: 'proxy', label: t('cluster.add.modeProxy') },
                ] as const
              ).map((option) => (
                <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm text-ai-fg-secondary">
                  <Radio value={option.value} {...actionProps(`clusters:add-mode:${option.value}`)} />
                  {option.label}
                </label>
              ))}
            </RadioGroup>
          </FormField>

          {mode === 'direct' ? (
            <>
              <p className="text-[11px] text-ai-fg-muted">{t('cluster.add.directTip')}</p>
              <FormField
                htmlFor="ai-field-cluster-kubeconfig"
                fieldKey="spec.connection.kubeconfig"
                label={t('cluster.add.kubeconfig')}
                required
                hint={t('cluster.add.kubeconfigHint')}
                {...(kubeconfigError !== null ? { error: kubeconfigError } : {})}
                errorAiId="clusters:add-kubeconfig-error"
              >
                <React.Suspense
                  fallback={
                    <div role="status" className="rounded-ai-md border border-ai-line bg-ai-surface px-2 py-8 text-center text-xs text-ai-fg-muted">
                      {t('common.loading')}
                    </div>
                  }
                >
                  <KubeconfigEditor
                    value={kubeconfig}
                    onChange={setKubeconfig}
                    height="200px"
                    ariaLabel={t('cluster.add.kubeconfig')}
                  />
                </React.Suspense>
                <a
                  href={KUBECONFIG_DOC_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 inline-block text-[11px] text-ai-link hover:underline"
                  data-ai-id="clusters:add-doc"
                >
                  {t('cluster.add.docLink')}
                </a>
              </FormField>
            </>
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
        </section>
      </div>
    </Modal>
  );
}

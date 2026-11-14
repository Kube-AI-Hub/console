import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  notificationConfigApi,
  notificationReceiverApi,
  notificationSecretApi,
  notificationVerifyApi,
  readChannel,
  type NotificationChannelKey,
  type NotificationObject,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Icon, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel, errorMessage } from '@/components/resource/ResourceErrorPanel';
import {
  CHANNELS,
  fieldVisible,
  toBodies,
  toFormValues,
  validate,
  type ChannelField,
} from './channelDescriptors';

/**
 * One notification channel's configuration page.
 *
 * Every channel is the same three objects — Config (transport), Receiver (recipients and
 * the enabled flag), Secret (credentials) — so one page renders all five from
 * `channelDescriptors.ts`. The old console has five near-identical pages; keeping the
 * differences in a table is what makes "add the sixth channel" a data change.
 *
 * Save order is Config → Secret → Receiver. That order is deliberate: a Receiver is only
 * meaningful once its Config exists, so a failure part way through cannot leave recipients
 * pointing at nothing.
 */
export interface ChannelConfigPageProps {
  channel: NotificationChannelKey;
}

export function ChannelConfigPage({ channel }: ChannelConfigPageProps): React.ReactElement {
  const t = useT();
  const descriptor = CHANNELS[channel];
  const queryClient = useQueryClient();
  const queryKey = React.useMemo(() => ['notification-channel', channel] as const, [channel]);

  const state = useQuery({
    queryKey,
    queryFn: () =>
      readChannel(apiClient, {
        key: channel,
        configName: descriptor.configName ?? '',
        receiverName: descriptor.receiverName,
        secretName: descriptor.secretName,
      }),
  });

  const [values, setValues] = React.useState<Record<string, string>>(() =>
    toFormValues(descriptor, { config: null, receiver: null }),
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saved, setSaved] = React.useState(false);
  const [verified, setVerified] = React.useState<{ ok: boolean; message: string } | null>(null);

  React.useEffect(() => {
    if (!state.data) return;
    setValues(
      toFormValues(descriptor, {
        config: (state.data.config as Record<string, unknown> | null) ?? null,
        receiver: (state.data.receiver as Record<string, unknown> | null) ?? null,
      }),
    );
  }, [descriptor, state.data]);

  const hasSecret = Boolean(state.data?.secretName);

  const save = useMutation({
    mutationFn: async (input: Record<string, string>) => {
      const bodies = toBodies(descriptor, input);

      if (descriptor.configName) {
        const configApi = notificationConfigApi(apiClient).forName(descriptor.configName);
        const current = await configApi.get();
        await configApi.save({
          apiVersion: 'notification.kubesphere.io/v2beta2',
          kind: 'Config',
          metadata: { ...(current?.metadata ?? {}), name: descriptor.configName },
          spec: bodies.configSpec,
        });
      }

      // Credentials: the page cannot read them back, so blank means "keep the stored one"
      // and an empty map means nothing to write at all.
      if (Object.keys(bodies.secretData).length > 0) {
        // base64 because a Secret stores `data`; the old console's `safeBtoa` encodes for
        // the same reason.
        const encoded = Object.fromEntries(
          Object.entries(bodies.secretData).map(([key, value]) => [key, btoa(unescape(encodeURIComponent(value)))]),
        );
        await notificationSecretApi(apiClient).save(descriptor.secretName, encoded);
      }

      const receiverApi = notificationReceiverApi(apiClient).forName(descriptor.receiverName);
      const current = await receiverApi.get();
      await receiverApi.save({
        apiVersion: 'notification.kubesphere.io/v2beta2',
        kind: 'Receiver',
        metadata: {
          ...(current?.metadata ?? {}),
          name: descriptor.receiverName,
          // Webhook's authentication type is an annotation, not part of the spec.
          ...(Object.keys(bodies.annotations).length > 0
            ? { annotations: { ...(current?.metadata?.annotations ?? {}), ...bodies.annotations } }
            : {}),
        },
        spec: bodies.receiverSpec,
      } as NotificationObject);
    },
    onSuccess: () => {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2_000);
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const verify = useMutation({
    mutationFn: async () => {
      const bodies = toBodies(descriptor, values);
      if (!descriptor.configName) {
        // Channels without a Config verify with the receiver alone; the endpoint accepts a
        // missing `config` key (the old console omits it in that case).
        return notificationVerifyApi(apiClient).verify({ receiver: bodies.receiverSpec });
      }
      return notificationVerifyApi(apiClient).verify({
        config: bodies.configSpec,
        receiver: bodies.receiverSpec,
      });
    },
    onSuccess: (result) => setVerified(result),
    onError: (error) => setVerified({ ok: false, message: errorMessage(t, error) }),
  });

  const submit = React.useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const found = validate(descriptor, values, { hasSecret });
      setErrors(found);
      if (Object.keys(found).length > 0) return;
      save.mutate(values);
    },
    [descriptor, hasSecret, save, values],
  );

  const viewState = state.isPending ? 'loading' : state.isError ? 'error' : 'ready';
  const configured = state.data?.configured ?? false;
  // Every field renders; `enabled` is drawn by its own component, the other booleans
  // (TLS, skip-verify) by the generic row. Filtering booleans out here is how the TLS
  // checkbox silently disappeared.
  const visibleFields = descriptor.fields;

  return (
    <AiSurface as="section" aiId={`notification-${channel}:surface`} state={viewState} className="flex min-w-0 flex-col gap-4">
      {viewState === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {viewState === 'error' ? (
        <ResourceErrorPanel
          error={state.error}
          onRetry={() => void state.refetch()}
          retryAiId={`notification-${channel}:retry`}
        />
      ) : null}

      {viewState === 'ready' ? (
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <header className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h1 className="flex items-center gap-2 text-base font-semibold text-ai-fg">
                <Icon name="bell" size={16} />
                {t(descriptor.titleKey)}
              </h1>
              <p className="text-xs text-ai-fg-muted">{t(descriptor.descriptionKey)}</p>
            </div>
            <Badge tone={configured ? 'success' : 'neutral'}>
              {configured ? t('platform.settings.configured') : t('platform.settings.notConfigured')}
            </Badge>
          </header>

          {!configured ? <p className="text-[11px] text-ai-fg-faint">{t('channel.notConfiguredHint')}</p> : null}

          <div className="flex flex-col gap-3 rounded-ai-md border border-ai-line p-4">
            {visibleFields.map((field) =>
              field.kind === 'boolean' && field.key === 'enabled' ? (
                <EnabledToggle
                  key={field.key}
                  channel={channel}
                  checked={values[field.key] === 'true'}
                  label={t(field.labelKey)}
                  {...(field.hintKey ? { hint: t(field.hintKey) } : {})}
                  onChange={(checked) => setValues({ ...values, [field.key]: checked ? 'true' : 'false' })}
                />
              ) : !fieldVisible(field, values) ? null : (
                <FieldRow
                  key={field.key}
                  field={field}
                  value={values[field.key] ?? ''}
                  {...(errors[field.key] ? { error: errors[field.key] } : {})}
                  channel={channel}
                  onChange={(value) => setValues({ ...values, [field.key]: value })}
                />
              ),
            )}
          </div>

          {save.isError ? (
            <p className="text-xs text-ai-danger" role="alert" data-ai-id={`notification-${channel}:save-error`}>
              {errorMessage(t, save.error)}
            </p>
          ) : null}

          {verified ? (
            <p
              className={`text-xs ${verified.ok ? 'text-ai-success' : 'text-ai-danger'}`}
              role="status"
              data-ai-id={`notification-${channel}:verify-result`}
            >
              {verified.ok ? t('channel.verifyOk') : `${t('channel.verifyFailed')}: ${verified.message}`}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary" loading={save.isPending} {...actionProps(`notification-${channel}:save`)}>
              {saved ? t('channel.saved') : t('channel.save')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={verify.isPending}
              onClick={() => {
                setVerified(null);
                verify.mutate();
              }}
              {...actionProps(`notification-${channel}:verify`)}
            >
              {t('channel.sendTest')}
            </Button>
          </div>
        </form>
      ) : null}
    </AiSurface>
  );
}

interface EnabledToggleProps {
  channel: NotificationChannelKey;
  checked: boolean;
  label: string;
  hint?: string;
  onChange: (checked: boolean) => void;
}

function EnabledToggle({ channel, checked, label, hint, onChange }: EnabledToggleProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="flex items-center gap-2 text-sm text-ai-fg-secondary" htmlFor={`ai-enabled-${channel}`}>
        <input
          id={`ai-enabled-${channel}`}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="size-4 accent-[rgb(var(--ai-accent))]"
          {...actionProps(`notification-${channel}:enabled`)}
        />
        {label}
      </label>
      {hint ? <p className="text-[11px] text-ai-fg-faint">{hint}</p> : null}
    </div>
  );
}

interface FieldRowProps {
  field: ChannelField;
  channel: NotificationChannelKey;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

function FieldRow({ field, channel, value, error, onChange }: FieldRowProps): React.ReactElement {
  const t = useT();
  const id = `ai-field-${channel}-${field.key}`;
  const inputClass = `h-9 rounded-ai-md border bg-ai-surface px-2 text-sm text-ai-fg ${
    error ? 'border-ai-danger' : 'border-ai-line'
  }`;

  return (
    <div className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
      <label htmlFor={id}>{t(field.labelKey)}</label>
      {field.kind === 'select' ? (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
          {...actionProps(`notification-${channel}:${field.key}`)}
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      ) : field.kind === 'boolean' ? (
        <label className="flex items-center gap-2 text-sm text-ai-fg-secondary" htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            checked={value === 'true'}
            onChange={(event) => onChange(event.target.checked ? 'true' : 'false')}
            className="size-4 accent-[rgb(var(--ai-accent))]"
            {...actionProps(`notification-${channel}:${field.key}`)}
          />
          {t(field.labelKey)}
        </label>
      ) : (
        <input
          id={id}
          type={field.kind === 'password' ? 'password' : 'text'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          autoComplete={field.kind === 'password' ? 'new-password' : 'off'}
          className={inputClass}
          {...actionProps(`notification-${channel}:${field.key}`)}
        />
      )}
      {field.hintKey && !error ? <span className="text-[11px] text-ai-fg-faint">{t(field.hintKey)}</span> : null}
      {error ? (
        <span className="text-[11px] text-ai-danger" role="alert">
          {t(`channel.error.${error}` as 'channel.error.required')}
        </span>
      ) : null}
    </div>
  );
}

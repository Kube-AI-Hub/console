import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CHANNEL_SPEC_KEY,
  notificationConfigApi,
  notificationReceiverApi,
  notificationSecretApi,
  notificationVerifyApi,
  readChannel,
  type NotificationObject,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Icon, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel, errorMessage } from '@/components/resource/ResourceErrorPanel';

/**
 * One notification channel's configuration page (邮件 first; the rest follow the same
 * shape).
 *
 * A channel is **three objects**, and this page writes all of them:
 *
 * | object | holds |
 * | --- | --- |
 * | Config (`default-email-config`) | the transport: SMTP host/port/TLS/sender |
 * | Receiver (`global-email-receiver`) | where it goes, and whether it is enabled |
 * | Secret (`global-email-config-secret`) | the SMTP password, base64 |
 *
 * The split is the platform's, not ours: the Config references the Secret by name
 * (`valueFrom.secretKeyRef`), so a password change is a Secret write and a sender change is
 * a Config write. The old console's mail page does exactly this (`Mail/index.jsx`), and the
 * write order matters — Config first, then Secret, then Receiver — because the Config is
 * what makes the receiver meaningful.
 */
export interface MailChannelPageProps {
  /** Stable handles for automation, e.g. `mail`. */
  channel?: 'mail';
}

/** Object names the platform's notification manager uses for the mail channel. */
const OBJECTS = {
  config: 'default-email-config',
  receiver: 'global-email-receiver',
  secret: 'global-email-config-secret',
} as const;

interface MailForm {
  host: string;
  port: string;
  requireTLS: boolean;
  username: string;
  password: string;
  from: string;
  recipients: string;
  enabled: boolean;
}

const EMPTY: MailForm = {
  host: '',
  port: '25',
  requireTLS: true,
  username: '',
  password: '',
  from: '',
  recipients: '',
  enabled: false,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Read the saved objects into the form's flat shape. */
function toForm(config: NotificationObject | null, receiver: NotificationObject | null): MailForm {
  const spec = ((config?.spec ?? {}) as Record<string, unknown>)['email'] as Record<string, unknown> | undefined;
  const smartHost = (spec?.['smartHost'] ?? {}) as Record<string, unknown>;
  const rspec = ((receiver?.spec ?? {}) as Record<string, unknown>)['email'] as Record<string, unknown> | undefined;
  const recipients = (rspec?.['to'] ?? []) as string[];
  return {
    host: String(smartHost['host'] ?? ''),
    port: String(smartHost['port'] ?? '25'),
    requireTLS: spec?.['requireTLS'] === true,
    username: String(spec?.['authUsername'] ?? ''),
    // The password is never read back: it lives in a Secret and ks-apiserver does not
    // return Secret data here. Leaving it blank keeps the stored one.
    password: '',
    from: String(spec?.['from'] ?? ''),
    recipients: recipients.join(', '),
    enabled: rspec?.['enabled'] === true,
  };
}

function splitList(text: string): string[] {
  return text
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function MailChannelPage(_props: MailChannelPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const queryKey = ['notification-channel', 'mail'] as const;

  const channel = useQuery({
    queryKey,
    queryFn: () =>
      readChannel(apiClient, {
        key: 'mail',
        configName: OBJECTS.config,
        receiverName: OBJECTS.receiver,
        secretName: OBJECTS.secret,
      }),
  });

  const [form, setForm] = React.useState<MailForm>(EMPTY);
  const [errors, setErrors] = React.useState<Partial<Record<keyof MailForm, string>>>({});
  const [saved, setSaved] = React.useState(false);
  const [verified, setVerified] = React.useState<{ ok: boolean; message: string } | null>(null);

  React.useEffect(() => {
    if (!channel.data) return;
    setForm(toForm(channel.data.config, channel.data.receiver));
  }, [channel.data]);

  const save = useMutation({
    mutationFn: async (input: MailForm) => {
      const channelKey = CHANNEL_SPEC_KEY.mail;
      const spec: Record<string, unknown> = {
        [channelKey]: {
          smartHost: { host: input.host.trim(), port: Number(input.port) },
          requireTLS: input.requireTLS,
          authUsername: input.username.trim(),
          from: input.from.trim(),
          // The Config only points at the Secret; the value never travels in the Config.
          authPassword: { valueFrom: { secretKeyRef: { name: OBJECTS.secret, key: 'authPassword' } } },
        },
      };
      const receiverSpec: Record<string, unknown> = {
        [channelKey]: { to: splitList(input.recipients), enabled: input.enabled },
      };
      const configApi = notificationConfigApi(apiClient).forName(OBJECTS.config);
      const current = await configApi.get();
      await configApi.save({
        apiVersion: 'notification.kubesphere.io/v2beta2',
        kind: 'Config',
        metadata: { ...(current?.metadata ?? {}), name: OBJECTS.config },
        spec,
      });

      /*
       * The password is optional on an existing channel: the page cannot read the stored
       * Secret, so an empty field means "keep what is there". Writing an empty value would
       * break a working configuration.
       */
      if (input.password.trim()) {
        // Base64 because the Secret is: the API stores `data`, not `stringData`, and the
        // old console's `safeBtoa` exists for the same reason.
        const encoded = btoa(unescape(encodeURIComponent(input.password)));
        await notificationSecretApi(apiClient).save(OBJECTS.secret, { authPassword: encoded });
      }

      const receiverApi = notificationReceiverApi(apiClient).forName(OBJECTS.receiver);
      const currentReceiver = await receiverApi.get();
      await receiverApi.save({
        apiVersion: 'notification.kubesphere.io/v2beta2',
        kind: 'Receiver',
        metadata: { ...(currentReceiver?.metadata ?? {}), name: OBJECTS.receiver },
        spec: receiverSpec,
      });
    },
    onSuccess: () => {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2_000);
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const verify = useMutation({
    mutationFn: async () => {
      const channelKey = CHANNEL_SPEC_KEY.mail;
      const configSpec = {
        [channelKey]: {
          smartHost: { host: form.host.trim(), port: Number(form.port) },
          requireTLS: form.requireTLS,
          authUsername: form.username.trim(),
          from: form.from.trim(),
          // A test message needs the actual password; that is why verification is the one
          // path that sends it.
          ...(form.password.trim() ? { authPassword: { value: form.password } } : {}),
        },
      };
      const receiverSpec = { [channelKey]: { to: splitList(form.recipients) } };
      return notificationVerifyApi(apiClient).verify({ config: configSpec, receiver: receiverSpec });
    },
    onSuccess: (result) => setVerified(result),
    onError: (error) => setVerified({ ok: false, message: errorMessage(t, error) }),
  });

  const submit = React.useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const next: Partial<Record<keyof MailForm, string>> = {};
      if (!form.host.trim()) next.host = t('mail.error.host');
      if (!/^\d+$/.test(form.port.trim()) || Number(form.port) <= 0 || Number(form.port) > 65535) {
        next.port = t('mail.error.port');
      }
      if (!form.username.trim()) next.username = t('mail.error.username');
      if (!form.from.trim()) next.from = t('mail.error.from');
      else if (!EMAIL_PATTERN.test(form.from.trim())) next.from = t('mail.error.email');
      const recipients = splitList(form.recipients);
      if (recipients.length === 0) next.recipients = t('mail.error.recipients');
      else if (recipients.some((item) => !EMAIL_PATTERN.test(item))) next.recipients = t('mail.error.email');
      setErrors(next);
      if (Object.keys(next).length > 0) return;
      save.mutate(form);
    },
    [form, save, t],
  );

  const state = channel.isPending ? 'loading' : channel.isError ? 'error' : 'ready';
  const configured = channel.data?.configured ?? false;

  return (
    <AiSurface as="section" aiId="notification-mail:surface" state={state} className="flex min-w-0 flex-col gap-4">
      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={channel.error} onRetry={() => void channel.refetch()} retryAiId="notification-mail:retry" />
      ) : null}

      {state === 'ready' ? (
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <header className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h1 className="flex items-center gap-2 text-base font-semibold text-ai-fg">
                <Icon name="email" size={16} />
                {t('mail.title')}
              </h1>
              <p className="text-xs text-ai-fg-muted">{t('mail.description')}</p>
            </div>
            <Badge tone={configured ? 'success' : 'neutral'}>
              {configured ? t('platform.settings.configured') : t('platform.settings.notConfigured')}
            </Badge>
          </header>

          <label className="flex items-center gap-2 text-sm text-ai-fg-secondary" htmlFor="ai-field-mail-enabled">
            <input
              id="ai-field-mail-enabled"
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
              className="size-4 accent-[rgb(var(--ai-accent))]"
              {...actionProps('notification-mail:enabled')}
            />
            {t('mail.enabled')}
          </label>
          <p className="-mt-2 text-[11px] text-ai-fg-faint">{t('mail.enabledHint')}</p>

          <fieldset className="flex flex-col gap-3 rounded-ai-md border border-ai-line p-4">
            <legend className="px-1 text-sm font-medium text-ai-fg">{t('mail.server')}</legend>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
              <Field id="ai-field-mail-host" label={t('mail.host')} {...(errors.host ? { error: errors.host } : {})}>
                <input
                  id="ai-field-mail-host"
                  value={form.host}
                  onChange={(event) => setForm({ ...form, host: event.target.value })}
                  placeholder="smtp.example.com"
                  className={inputClass(errors.host)}
                  {...actionProps('notification-mail:host')}
                />
              </Field>
              <Field id="ai-field-mail-port" label={t('mail.port')} {...(errors.port ? { error: errors.port } : {})}>
                <input
                  id="ai-field-mail-port"
                  value={form.port}
                  onChange={(event) => setForm({ ...form, port: event.target.value })}
                  inputMode="numeric"
                  className={inputClass(errors.port)}
                  {...actionProps('notification-mail:port')}
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm text-ai-fg-secondary" htmlFor="ai-field-mail-tls">
              <input
                id="ai-field-mail-tls"
                type="checkbox"
                checked={form.requireTLS}
                onChange={(event) => setForm({ ...form, requireTLS: event.target.checked })}
                className="size-4 accent-[rgb(var(--ai-accent))]"
                {...actionProps('notification-mail:tls')}
              />
              {t('mail.tls')}
            </label>

            <Field id="ai-field-mail-username" label={t('mail.username')} {...(errors.username ? { error: errors.username } : {})}>
              <input
                id="ai-field-mail-username"
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                placeholder="admin@example.com"
                className={inputClass(errors.username)}
                {...actionProps('notification-mail:username')}
              />
            </Field>

            <Field id="ai-field-mail-password" label={t('mail.password')} hint={t('mail.passwordHint')}>
              <input
                id="ai-field-mail-password"
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                autoComplete="new-password"
                className={inputClass()}
                {...actionProps('notification-mail:password')}
              />
            </Field>

            <Field id="ai-field-mail-from" label={t('mail.from')} {...(errors.from ? { error: errors.from } : {})}>
              <input
                id="ai-field-mail-from"
                value={form.from}
                onChange={(event) => setForm({ ...form, from: event.target.value })}
                placeholder="admin@example.com"
                className={inputClass(errors.from)}
                {...actionProps('notification-mail:from')}
              />
            </Field>
          </fieldset>

          <fieldset className="flex flex-col gap-3 rounded-ai-md border border-ai-line p-4">
            <legend className="px-1 text-sm font-medium text-ai-fg">{t('mail.recipients')}</legend>
            <Field id="ai-field-mail-recipients" label={t('mail.to')} {...(errors.recipients ? { error: errors.recipients } : {})}>
              <input
                id="ai-field-mail-recipients"
                value={form.recipients}
                onChange={(event) => setForm({ ...form, recipients: event.target.value })}
                placeholder="ops@example.com, oncall@example.com"
                className={inputClass(errors.recipients)}
                {...actionProps('notification-mail:recipients')}
              />
            </Field>
          </fieldset>

          {save.isError ? (
            <p className="text-xs text-ai-danger" role="alert" data-ai-id="notification-mail:save-error">
              {errorMessage(t, save.error)}
            </p>
          ) : null}

          {verified ? (
            <p
              className={`text-xs ${verified.ok ? 'text-ai-success' : 'text-ai-danger'}`}
              role="status"
              data-ai-id="notification-mail:verify-result"
            >
              {verified.ok ? t('mail.verifyOk') : `${t('mail.verifyFailed')}: ${verified.message}`}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary" loading={save.isPending} {...actionProps('notification-mail:save')}>
              {saved ? t('common.saved') : t('common.confirm')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={verify.isPending}
              onClick={() => {
                setVerified(null);
                verify.mutate();
              }}
              {...actionProps('notification-mail:verify')}
            >
              {t('mail.sendTest')}
            </Button>
          </div>
        </form>
      ) : null}
    </AiSurface>
  );
}

function inputClass(error?: string): string {
  return `h-9 rounded-ai-md border bg-ai-surface px-2 text-sm text-ai-fg ${
    error ? 'border-ai-danger' : 'border-ai-line'
  }`;
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <label className="flex flex-col gap-1 text-xs text-ai-fg-secondary" htmlFor={id}>
      {label}
      {children}
      {hint && !error ? <span className="text-[11px] text-ai-fg-faint">{hint}</span> : null}
      {error ? (
        <span className="text-[11px] text-ai-danger" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

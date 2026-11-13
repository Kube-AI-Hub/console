import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { NOTIFICATION_CHANNELS, platformInfoApi, toNotificationChannels } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

/**
 * 平台设置: 平台信息 and 通知渠道.
 *
 * The old console's 平台设置 group has one page of platform metadata and one page per
 * notification channel. This page keeps both readable in one view: what the platform
 * calls itself, and which channels exist. Editing either is a form workflow the
 * platform already owns (and the channel credentials are Secrets we do not read).
 */
export interface PlatformSettingsPageProps {
  view: 'info' | 'notifications';
}

export function PlatformSettingsPage({ view }: PlatformSettingsPageProps): React.ReactElement {
  const t = useT();

  const info = useQuery({
    queryKey: ['platform-info'],
    queryFn: ({ signal }) => platformInfoApi(apiClient).get({ signal }),
    enabled: view === 'info',
  });

  /*
   * Channel presence is read by **name**, one request per channel, not by listing the
   * namespace.
   *
   * Listing every Secret in `kubesphere-monitoring-system` took 70 seconds on this
   * cluster — long past any reader's patience, and long enough that the page sat in
   * `loading` — while a named read answers (or 404s) in under a second. We know the
   * five names, so asking about them directly is both faster and narrower: no other
   * tenant's Secret names cross the wire.
   *
   * A 404 means "not configured", which is a normal fresh install, not an error.
   */
  const channels = useQuery({
    queryKey: ['platform-notification-channels'],
    queryFn: async ({ signal }) => {
      const results = await Promise.all(
        NOTIFICATION_CHANNELS.map(async (channel) => {
          try {
            await apiClient.request(
              `/api/v1/namespaces/kubesphere-monitoring-system/secrets/${channel}s`,
              { signal },
            );
            return `${channel}s`;
          } catch {
            // 404 (absent) and any other failure both mean "this channel is not
            // available to send through", which is what the badge reports.
            return '';
          }
        }),
      );
      return results.filter(Boolean);
    },
    enabled: view === 'notifications',
    retry: false,
  });

  const active = view === 'info' ? info : channels;
  const state = active.isPending ? 'loading' : active.isError ? 'error' : 'ready';

  return (
    <AiSurface as="section" aiId={`platform-settings:${view}:surface`} state={state} className="flex min-w-0 flex-col gap-4">
      {state === 'loading' ? <Skeleton className="h-32 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel
          error={active.error}
          onRetry={() => void active.refetch()}
          retryAiId={`platform-settings:${view}:retry`}
        />
      ) : null}

      {view === 'info' && info.data ? (
        <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="platform-settings:info">
          <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('platform.settings.info')}</h2>
          <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
            <Row label={t('platform.settings.title')} value={info.data.title || '-'} aiId="platform-settings:title" />
            <Row label={t('platform.settings.description')} value={info.data.description || '-'} />
            <Row label={t('platform.settings.url')} value={info.data.consoleUrl || '-'} />
          </dl>
        </section>
      ) : null}

      {view === 'notifications' && channels.data ? (
        <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="platform-settings:channels">
          <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('platform.settings.channels')}</h2>
          <ul className="flex flex-col gap-2">
            {toNotificationChannels(channels.data).map((channel) => (
              <li
                key={channel.key}
                className="flex items-center justify-between gap-3 rounded-ai-sm border border-ai-line px-3 py-2 text-xs"
                data-ai-row={channel.key}
              >
                <span className="font-medium text-ai-fg-secondary">{t(`platform.channel.${channel.key === 'mail' ? 'mail' : channel.key}` as never)}</span>
                <Badge tone={channel.configured ? 'success' : 'neutral'}>
                  {channel.configured ? t('platform.settings.configured') : t('platform.settings.notConfigured')}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-ai-fg-faint" {...actionProps('platform-settings:channels-hint')}>
            {t('platform.settings.channelsHint')}
          </p>
        </section>
      ) : null}
    </AiSurface>
  );
}

function Row({ label, value, aiId }: { label: string; value: string; aiId?: string }): React.ReactElement {
  return (
    <>
      <dt className="text-ai-fg-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ai-fg-secondary" {...(aiId ? actionProps(aiId) : {})}>
        {value}
      </dd>
    </>
  );
}

/** Channel keys the page renders; kept next to the page that uses them. */
export const PLATFORM_CHANNELS = NOTIFICATION_CHANNELS;

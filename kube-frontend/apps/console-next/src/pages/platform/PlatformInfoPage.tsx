import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { platformInfoApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Button, Skeleton, useTheme, type AccentPalette } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow as Row } from '@/components/resource/DefinitionRow';

/**
 * 平台信息 — what this installation calls itself, plus the reader's own appearance.
 *
 * The platform facts come from the `kubesphere-config` ConfigMap, which the installer
 * writes: the console reads it and never edits it (the old console's page is read-only for
 * the same reason). Offering an editor here would let a click silently disagree with what
 * the installation was configured to be.
 *
 * The **外观** section is the one thing on this page that is *not* platform configuration:
 * it is a per-browser preference (stored by `ThemeProvider`) that changes how this console
 * looks for the reader who set it. It lives here because that is where the request put it;
 * it never writes a platform object.
 */
export function PlatformInfoPage(): React.ReactElement {
  const t = useT();
  const info = useQuery({
    queryKey: ['platform-info'],
    queryFn: ({ signal }) => platformInfoApi(apiClient).get({ signal }),
  });

  const state = info.isPending ? 'loading' : info.isError ? 'error' : 'ready';

  return (
    <AiSurface as="section" aiId="platform-settings:info:surface" state={state} className="flex min-w-0 flex-col gap-4">
      {state === 'loading' ? <Skeleton className="h-32 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={info.error} onRetry={() => void info.refetch()} retryAiId="platform-info:retry" />
      ) : null}

      {info.data ? (
        <React.Fragment>
          <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="platform-settings:info">
            <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('platform.settings.basicInfo')}</h2>

            <div className="mb-4 flex items-center gap-3">
              {/* The logo the console serves; a broken image would read as the platform
                  having no brand at all, so the alt text names it. */}
              <img
                src="/assets/logo.svg"
                alt={info.data.title || t('app.name')}
                className="size-12 shrink-0"
                data-ai-id="platform-info:logo"
              />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-ai-fg" data-ai-id="platform-info:title">
                  {info.data.title || t('app.name')}
                </span>
                <span className="truncate text-xs text-ai-fg-muted" data-ai-id="platform-info:address">
                  {typeof window === 'undefined' ? '' : window.location.host}
                </span>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
              <Row label={t('platform.settings.title')} value={info.data.title || '-'} aiId="platform-settings:title" />
              <Row
                label={t('platform.settings.description')}
                value={info.data.description || '-'}
                aiId="platform-info:description"
              />
              <Row label={t('platform.settings.url')} value={info.data.consoleUrl || '-'} aiId="platform-info:url" />
            </dl>
          </section>

          <AppearanceSection />
        </React.Fragment>
      ) : null}
    </AiSurface>
  );
}

const ACCENTS: readonly { key: AccentPalette; labelKey: 'appearance.accent.violet' | 'appearance.accent.green' }[] = [
  { key: 'violet', labelKey: 'appearance.accent.violet' },
  { key: 'green', labelKey: 'appearance.accent.green' },
];

/**
 * 外观 — theme mode and accent palette.
 *
 * Both are already implemented by `ThemeProvider` (localStorage + `data-theme` /
 * `data-accent` on `<html>`), including the pre-paint restore script, so this section is
 * only the control surface. A segmented control rather than the header's cycling toggle:
 * here the reader can see both options and what they are called.
 */
function AppearanceSection(): React.ReactElement {
  const t = useT();
  const { theme, setTheme, accent, setAccent } = useTheme();

  return (
    <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="platform-info:appearance">
      <h2 className="mb-1 text-sm font-medium text-ai-fg">{t('appearance.title')}</h2>
      <p className="mb-3 text-xs text-ai-fg-muted">{t('appearance.description')}</p>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-ai-fg-secondary">{t('appearance.mode')}</span>
          <div className="flex gap-2" role="radiogroup" aria-label={t('appearance.mode')}>
            {(['dark', 'light'] as const).map((mode) => (
              // The design-system Button rather than a bare HTML one: the AI-surface
              // contract requires every actionable element to carry a stable handle, and this
              // keeps focus and disabled styling consistent with the rest of the console.
              <Button
                key={mode}
                type="button"
                role="radio"
                aria-checked={theme === mode}
                variant={theme === mode ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setTheme(mode)}
                {...actionProps(`appearance:mode:${mode}`)}
              >
                {t(mode === 'dark' ? 'appearance.dark' : 'appearance.light')}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-ai-fg-secondary">{t('appearance.accent')}</span>
          <div className="flex gap-2" role="radiogroup" aria-label={t('appearance.accent')}>
            {ACCENTS.map((option) => (
              <Button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={accent === option.key}
                variant={accent === option.key ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setAccent(option.key)}
                {...actionProps(`appearance:accent:${option.key}`)}
              >
                <span
                  aria-hidden="true"
                  className="size-3.5 rounded-full ring-1 ring-inset ring-ai-line-strong"
                  style={{
                    // Each swatch shows that palette's own accent: violet-300 and the
                    // mint the green palette uses, not the currently applied one.
                    backgroundColor:
                      option.key === 'violet' ? 'rgb(var(--ai-raw-violet-300))' : 'rgb(var(--ai-raw-mint-400))',
                  }}
                />
                {t(option.labelKey)}
              </Button>
            ))}
          </div>
          <span className="text-[11px] text-ai-fg-faint">{t('appearance.hint')}</span>
        </div>
      </div>
    </section>
  );
}

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { identityProvidersApi, type IdentityProvider } from '@kube-ai-hub/api-client';
import { AiSurface, Badge, Button, Skeleton } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

/**
 * 第三方登录（平台设置）.
 *
 * Status page for the platform's identity providers. Two truthful states:
 *
 * - the IAM aggregate serves identityproviders → one card per provider (type + status);
 * - it does not (B200, 2026-11-17) → an explicit "this deployment does not expose the
 *   identity-provider API" state with the upstream reason, never an empty provider list.
 *
 * No writes. The old page's Configure buttons opened modals whose OK handler only closed
 * them — there was no request to migrate. When the platform starts serving mutations, a
 * separate write design is needed (credentials cannot be edited as ordinary annotations).
 * [N-02]
 */
export function ThirdLoginPage(): React.ReactElement {
  const t = useT();
  const query = useQuery({
    queryKey: ['identity-providers'],
    queryFn: ({ signal }) => identityProvidersApi(apiClient).list({ signal }),
  });

  const result = query.data;
  const state = query.isPending
    ? 'loading'
    : query.isError
      ? 'error'
      : result && !result.available
        ? 'unavailable'
        : (result?.providers.length ?? 0) === 0
          ? 'empty'
          : 'ready';

  return (
    <AiSurface as="section" aiId="third-login:surface" state={state === 'unavailable' ? 'empty' : state} className="min-w-0 p-4 sm:p-6">
      <header className="min-w-0">
        <h2 className="text-lg font-semibold text-ai-fg">{t('thirdLogin.title')}</h2>
        <p className="mt-1 text-xs text-ai-fg-muted">{t('thirdLogin.description')}</p>
      </header>

      {state === 'loading' ? <Skeleton className="mt-4 h-32 w-full" /> : null}

      {state === 'error' ? (
        <div className="mt-4">
          <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="third-login:retry" />
        </div>
      ) : null}

      {state === 'unavailable' ? (
        <div className="mt-4 rounded-ai-md border border-ai-line bg-ai-surface-2 p-6" data-ai-id="third-login:unavailable">
          <p className="text-sm font-medium text-ai-fg">{t('thirdLogin.unavailable.title')}</p>
          <p className="mt-1 text-xs text-ai-fg-muted">{t('thirdLogin.unavailable.description')}</p>
          {result && !result.available && result.reason ? (
            <p className="mt-2 break-all font-mono text-[11px] text-ai-fg-muted">{result.reason}</p>
          ) : null}
          <Button className="mt-3" size="sm" variant="secondary" {...actionProps('third-login:retry')} onClick={() => void query.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {state === 'empty' ? (
        <div className="mt-4 rounded-ai-md border border-ai-line p-6" data-ai-id="third-login:empty">
          <p className="text-sm font-medium text-ai-fg">{t('thirdLogin.empty.title')}</p>
          <p className="mt-1 text-xs text-ai-fg-muted">{t('thirdLogin.empty.description')}</p>
        </div>
      ) : null}

      {state === 'ready' && result?.available ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2" data-ai-id="third-login:providers">
          {result.providers.map((provider: IdentityProvider) => (
            <li key={provider.name} className="rounded-ai-md border border-ai-line p-4" data-ai-id={'third-login:provider:' + provider.name}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ai-fg">{provider.displayName || provider.name}</p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-ai-fg-muted">{provider.name}</p>
                </div>
                <Badge tone="success">{t('thirdLogin.configured')}</Badge>
              </div>
              <p className="mt-2 text-xs text-ai-fg-secondary">{provider.type || '-'}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-5 text-[11px] text-ai-fg-muted" data-ai-id="third-login:hint">
        {t('thirdLogin.hint')}
      </p>
    </AiSurface>
  );
}

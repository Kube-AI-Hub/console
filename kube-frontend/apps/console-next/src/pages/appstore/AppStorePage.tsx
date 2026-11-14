import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { storeAppsApi, storeCategoriesApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

/**
 * 应用商店（浏览）.
 *
 * The top bar has linked here since the shell was built, but the route never existed — one of
 * the two dead links the gap analysis flagged. The store itself is served by openpitrix and
 * every endpoint answers, so this page is the missing half of an entry that already shipped.
 *
 * Layout follows the old store: a category rail on the left, app cards on the right. With an
 * empty store that means honest empty states in both places rather than a spinner that never
 * resolves — the difference between "no apps published" and "something is broken" matters to
 * whoever is about to file a bug.
 */
export function AppStorePage(): React.ReactElement {
  const t = useT();
  const [categoryId, setCategoryId] = React.useState<string>('');

  const categories = useQuery({
    queryKey: ['store-categories'],
    queryFn: ({ signal }) => storeCategoriesApi(apiClient).list({ pageSize: -1, signal }),
  });

  const apps = useQuery({
    queryKey: ['store-apps', categoryId],
    queryFn: ({ signal }) =>
      storeAppsApi(apiClient).list({
        page: 1,
        pageSize: 24,
        ...(categoryId ? { categoryId } : {}),
        signal,
      }),
  });

  const state = apps.isPending ? 'loading' : apps.isError ? 'error' : (apps.data?.items.length ?? 0) === 0 ? 'empty' : 'ready';
  const rows = apps.data?.items ?? [];

  return (
    <AiSurface as="section" aiId="app-store:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-lg font-semibold text-ai-fg">{t('store.title')}</h1>
          <p className="text-xs text-ai-fg-muted">{t('store.description')}</p>
        </div>
        <a
          {...actionProps('app-store:manage')}
          href="/kube-frontend/apps-manage"
          className="text-sm text-ai-accent hover:underline"
        >
          {t('store.manage')}
        </a>
      </header>

      {state === 'loading' ? <Skeleton className="h-40 w-full" /> : null}
      {state === 'error' ? (
        <ResourceErrorPanel error={apps.error} onRetry={() => void apps.refetch()} retryAiId="app-store:retry" />
      ) : null}

      {state !== 'loading' && state !== 'error' ? (
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
          <nav className="flex shrink-0 flex-col gap-1 lg:w-52" aria-label={t('store.categories')} data-ai-id="app-store:categories">
            <Button
              type="button"
              variant={categoryId === '' ? 'secondary' : 'ghost'}
              className="justify-start"
              aria-pressed={categoryId === ''}
              {...actionProps('app-store:category:all')}
              onClick={() => setCategoryId('')}
            >
              {t('store.allCategories')}
            </Button>
            {(categories.data?.items ?? []).map((category) => (
              <Button
                key={category.id}
                type="button"
                variant={categoryId === category.id ? 'secondary' : 'ghost'}
                className="justify-between"
                aria-pressed={categoryId === category.id}
                {...actionProps(`app-store:category:${category.id}`)}
                onClick={() => setCategoryId(category.id)}
              >
                <span className="truncate">{category.name}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-ai-fg-faint">{category.appTotal}</span>
              </Button>
            ))}
          </nav>

          <div className="min-w-0 flex-1">
            {rows.length === 0 ? (
              <div className="rounded-ai-md border border-ai-line p-8 text-center" data-ai-id="app-store:empty">
                <p className="text-sm font-medium text-ai-fg">{t('store.empty')}</p>
                <p className="mt-1 text-xs text-ai-fg-muted">{t('store.emptyDescription')}</p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" data-ai-id="app-store:apps">
                {rows.map((app) => (
                  <li key={app.id} className="flex flex-col rounded-ai-md border border-ai-line hover:border-ai-accent" data-ai-row={app.id}>
                    <Link
                      to="/kube-frontend/apps/$appId"
                      params={{ appId: app.id }}
                      className="flex flex-col gap-2 p-4"
                      {...actionProps(`app-store:card:${app.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-medium text-ai-fg">{app.name}</span>
                        <Badge tone={app.status === 'active' ? 'success' : 'neutral'}>{app.status || '-'}</Badge>
                      </div>
                      <p className="line-clamp-2 min-h-8 text-xs text-ai-fg-muted">{app.description || '-'}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </AiSurface>
  );
}

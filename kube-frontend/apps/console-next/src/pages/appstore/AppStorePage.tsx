import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { storeAppsApi, storeCategoriesApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, InputSearch, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

/**
 * 应用商店（浏览）.
 *
 * The old console's store front: a category rail on the left (with the app count per category),
 * a toolbar that says how many apps matched and lets the reader search by name, and the app
 * cards on the right. The counts and the search are the server's — the list endpoint takes
 * `keyword` and `category_id` and answers `total_count` — so the page passes them through
 * instead of filtering a single page in the browser.
 *
 * "Load more" grows the page size rather than switching pages: the store has no stable cursor,
 * and appending is what the old console's infinite scroll did. The total is always the server's
 * count, so the button disappears exactly when everything is shown.
 */
const PAGE_SIZE = 24;

export function AppStorePage(): React.ReactElement {
  const t = useT();
  const [categoryId, setCategoryId] = React.useState<string>('');
  const [keyword, setKeyword] = React.useState('');
  const [limit, setLimit] = React.useState(PAGE_SIZE);

  const categories = useQuery({
    queryKey: ['store-categories'],
    queryFn: ({ signal }) => storeCategoriesApi(apiClient).list({ pageSize: -1, signal }),
  });

  const apps = useQuery({
    queryKey: ['store-apps', categoryId, keyword, limit],
    queryFn: ({ signal }) =>
      storeAppsApi(apiClient).list({
        page: 1,
        pageSize: limit,
        ...(categoryId ? { categoryId } : {}),
        ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
        signal,
      }),
  });

  const rows = apps.data?.items ?? [];
  const total = apps.data?.total ?? 0;
  const state = apps.isPending ? 'loading' : apps.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const filtered = Boolean(keyword.trim()) || Boolean(categoryId);

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
          className="text-sm text-ai-link hover:underline"
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
              onClick={() => {
                setCategoryId('');
                setLimit(PAGE_SIZE);
              }}
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
                onClick={() => {
                  setCategoryId(category.id);
                  setLimit(PAGE_SIZE);
                }}
              >
                <span className="truncate">{category.name}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-ai-fg-faint">{category.appTotal}</span>
              </Button>
            ))}
          </nav>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs tabular-nums text-ai-fg-muted" data-ai-id="app-store:total">
                {t('store.totalApps', { total })}
              </span>
              <InputSearch
                value={keyword}
                placeholder={t('store.searchPlaceholder')}
                data-ai-id="app-store:search"
                onSearch={(value) => {
                  setKeyword(value);
                  setLimit(PAGE_SIZE);
                }}
                onChange={(value) => {
                  setKeyword(value);
                  setLimit(PAGE_SIZE);
                }}
              />
            </div>

            {rows.length === 0 ? (
              <div className="rounded-ai-md border border-ai-line p-8 text-center" data-ai-id="app-store:empty">
                <p className="text-sm font-medium text-ai-fg">{filtered ? t('store.noMatchTitle') : t('store.empty')}</p>
                <p className="mt-1 text-xs text-ai-fg-muted">{filtered ? t('store.noMatchDescription') : t('store.emptyDescription')}</p>
              </div>
            ) : (
              <React.Fragment>
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
                {rows.length < total ? (
                  <div className="flex justify-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      {...actionProps('app-store:load-more')}
                      onClick={() => setLimit((current) => current + PAGE_SIZE)}
                    >
                      {t('store.loadMore')}
                    </Button>
                  </div>
                ) : null}
              </React.Fragment>
            )}
          </div>
        </div>
      ) : null}
    </AiSurface>
  );
}

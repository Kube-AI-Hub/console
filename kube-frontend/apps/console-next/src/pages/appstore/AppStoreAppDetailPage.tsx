import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ApiError, storeAppsApi, type StoreAppDetail, type StoreAppVersion } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Select, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { formatTimestamp } from '@/lib/time';
import { AppInstallDialog } from './AppInstallDialog';

/**
 * 应用详情（商店浏览 → 应用）.
 *
 * The list only answers "which apps exist". This page answers "should I install this one":
 * what it is, which versions are published, and what the chart's README says. Installing opens
 * the dialog that asks for the target workspace/project and creates the openpitrix release;
 * everything before that dialog is a read.
 *
 * The version row's "type" comes from the app's `app_version_types`: openpitrix versions do
 * not carry their own type field (probed), and inventing one per row would be a lie.
 */
export interface AppStoreAppDetailPageProps {
  appId: string;
}

interface DetailData {
  detail: StoreAppDetail;
  versions: StoreAppVersion[];
}

export function AppStoreAppDetailPage({ appId }: AppStoreAppDetailPageProps): React.ReactElement {
  const t = useT();
  const [readmeOpen, setReadmeOpen] = React.useState(false);
  const [iconFailed, setIconFailed] = React.useState(false);
  const [installOpen, setInstallOpen] = React.useState(false);
  /** Which version the README and the install dialog start from; the newest by default. */
  const [selectedVersionId, setSelectedVersionId] = React.useState('');

  const query = useQuery<DetailData>({
    queryKey: ['store-app-detail', appId],
    queryFn: async ({ signal }) => {
      const [detail, versions] = await Promise.all([
        storeAppsApi(apiClient).get({ appId, signal }),
        storeAppsApi(apiClient).versions({ appId, signal }),
      ]);
      return { detail, versions };
    },
    // A wrong/stale app id is a settled answer, not a transient failure: retrying for 30s
    // would only delay the not-found state.
    retry: false,
  });

  const detail = query.data?.detail;
  const versions = query.data?.versions ?? [];
  // The reader's pick wins; otherwise the newest published version (the list is newest-first).
  const readmeVersion = versions.find((version) => version.id === selectedVersionId) ?? versions[0] ?? detail?.latestVersion ?? null;

  const readme = useQuery({
    enabled: Boolean(readmeVersion?.id),
    queryKey: ['store-app-readme', appId, readmeVersion?.id],
    queryFn: ({ signal }) =>
      storeAppsApi(apiClient).readme({ appId, versionId: readmeVersion?.id ?? '', signal }),
  });

  React.useEffect(() => {
    setReadmeOpen(false);
    setIconFailed(false);
    setSelectedVersionId('');
  }, [appId]);

  const notFound = query.error instanceof ApiError && query.error.isNotFound;
  const state = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';

  const back = (
    <Link to="/kube-frontend/apps" className="text-sm text-ai-link hover:underline" {...actionProps('app-detail:back')}>
      ← {t('store.detail.back')}
    </Link>
  );

  if (state === 'loading') {
    return (
      <AiSurface as="section" aiId="app-detail:surface" state="loading" className="flex min-w-0 flex-col gap-4">
        {back}
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </AiSurface>
    );
  }

  if (notFound) {
    return (
      <AiSurface as="section" aiId="app-detail:surface" state="error" className="flex min-w-0 flex-col gap-4">
        {back}
        <div className="rounded-ai-md border border-ai-line p-8 text-center" data-ai-id="app-detail:not-found">
          <p className="text-sm font-medium text-ai-fg">{t('store.detail.notFoundTitle')}</p>
          <p className="mt-1 text-xs text-ai-fg-muted">{t('store.detail.notFoundDescription')}</p>
        </div>
      </AiSurface>
    );
  }

  if (state === 'error' || !detail) {
    return (
      <AiSurface as="section" aiId="app-detail:surface" state="error" className="flex min-w-0 flex-col gap-4">
        {back}
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="app-detail:retry" />
      </AiSurface>
    );
  }

  const readmeText = readme.data || '';
  const readmeBody = readmeText || detail.description;

  return (
    <AiSurface as="section" aiId="app-detail:surface" state={state} className="flex min-w-0 flex-col gap-5">
      {back}

      <header className="flex flex-wrap items-start gap-4">
        {detail.icon && !iconFailed ? (
          <img
            src={detail.icon}
            alt=""
            className="size-14 shrink-0 rounded-ai-md border border-ai-line object-contain p-1"
            data-ai-id="app-detail:icon"
            // Chart icons are external URLs; a broken/misconfigured one must not leave a
            // broken-image glyph where the app identity should be.
            onError={() => setIconFailed(true)}
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-14 shrink-0 place-items-center rounded-ai-md bg-ai-surface-3 text-lg font-semibold text-ai-fg-muted"
          >
            {(detail.name || '?').slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-ai-fg" data-ai-id="app-detail:name">
              {detail.name || detail.id}
            </h1>
            <Badge tone={detail.status === 'active' ? 'success' : 'neutral'}>{detail.status || '-'}</Badge>
          </div>
          <p className="text-xs text-ai-fg-muted">{detail.description || t('store.detail.noDescription')}</p>
          <div className="flex flex-wrap gap-1.5">
            {detail.categories.length === 0 ? (
              <Badge tone="neutral">-</Badge>
            ) : (
              detail.categories.map((category) => (
                <Badge key={category.id || category.name} tone="neutral">
                  {category.name || category.id}
                </Badge>
              ))
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Button
            size="sm"
            variant="primary"
            disabled={versions.length === 0}
            data-ai-id="app-detail:install"
            onClick={() => setInstallOpen(true)}
          >
            {t('store.detail.install')}
          </Button>
          <span className="max-w-56 text-right text-[11px] text-ai-fg-muted">{t('store.detail.installHint')}</span>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ai-fg">{t('store.detail.basicInfo')}</h2>
        <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(7rem,auto)_1fr]">
          <DefinitionRow label={t('store.detail.category')} value={detail.categories.map((c) => c.name).filter(Boolean).join(' / ') || '-'} />
          <DefinitionRow label={t('store.detail.type')} value={detail.versionTypes || '-'} />
          <DefinitionRow label={t('store.detail.appId')} value={detail.id || '-'} />
          <DefinitionRow label={t('store.detail.releasedAt')} value={formatTimestamp(detail.statusTime || detail.createdAt)} />
          <DefinitionRow label={t('store.detail.home')} value={detail.home || '-'} />
          {detail.latestVersion?.maintainers.length ? (
            <DefinitionRow label={t('store.detail.maintainers')} value={detail.latestVersion.maintainers.join('、')} />
          ) : null}
          {detail.latestVersion?.sources.length ? (
            <DefinitionRow label={t('store.detail.sources')} value={detail.latestVersion.sources.join('  ')} />
          ) : null}
          {/* Keywords come from the app object; this deployment returns none, so no empty row. */}
          {detail.keywords.length ? (
            <DefinitionRow label={t('store.detail.keywords')} value={detail.keywords.join(' / ')} />
          ) : null}
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-ai-fg">{t('store.detail.versions')}</h2>
          <span className="text-[11px] text-ai-fg-muted">{t('store.detail.versionsHint', { count: versions.length })}</span>
        </div>
        {versions.length === 0 ? (
          <p className="text-xs text-ai-fg-muted" data-ai-id="app-detail:versions-empty">
            {t('store.detail.versionsEmpty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" data-ai-id="app-detail:versions">
              <thead>
                <tr className="border-b border-ai-line text-ai-fg-muted">
                  <th scope="col" className="px-2 py-2 text-left font-medium">{t('store.detail.versionNumber')}</th>
                  <th scope="col" className="px-2 py-2 text-left font-medium">{t('store.detail.versionType')}</th>
                  <th scope="col" className="px-2 py-2 text-left font-medium">{t('store.detail.versionCreatedAt')}</th>
                  <th scope="col" className="px-2 py-2 text-left font-medium">{t('store.detail.versionStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr
                    key={version.id}
                    className="border-b border-ai-line"
                    data-ai-row={version.id}
                    data-ai-id={`app-detail:version:${version.id}`}
                  >
                    <td className="px-2 py-2 font-medium text-ai-fg">{version.name || version.id}</td>
                    <td className="px-2 py-2 text-ai-fg-secondary">{detail.versionTypes || '-'}</td>
                    <td className="px-2 py-2 tabular-nums text-ai-fg-secondary">{formatTimestamp(version.createdAt)}</td>
                    <td className="px-2 py-2">
                      <Badge tone={version.status === 'active' ? 'success' : 'neutral'}>{version.status || '-'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2" data-ai-id="app-detail:readme">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-ai-fg">{t('store.detail.readme')}</h2>
          <div className="flex items-center gap-2">
            {versions.length > 1 ? (
              <Select
                value={readmeVersion?.id ?? ''}
                options={versions.map((version) => ({ value: version.id, label: version.name || version.id }))}
                data-ai-id="app-detail:readme-version"
                onValueChange={(value) => {
                  setSelectedVersionId(value);
                  setReadmeOpen(true);
                }}
              />
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              {...actionProps('app-detail:readme-toggle')}
              onClick={() => setReadmeOpen((open) => !open)}
            >
              {readmeOpen ? t('store.detail.readmeCollapse') : t('store.detail.readmeExpand')}
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-ai-fg-muted">{t('store.detail.readmeHint', { version: readmeVersion?.name ?? '-' })}</p>
        {readmeOpen ? (
          readme.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : readmeBody ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-ai-md border border-ai-line bg-ai-bg p-3 text-[11px] leading-relaxed text-ai-fg-secondary">
              {readmeBody}
            </pre>
          ) : (
            <p className="text-xs text-ai-fg-muted" data-ai-id="app-detail:readme-empty">
              {t('store.detail.readmeEmpty')}
            </p>
          )
        ) : null}
      </section>

      <AppInstallDialog
        open={installOpen}
        onOpenChange={setInstallOpen}
        appId={appId}
        appName={detail.name || appId}
        versions={versions}
        defaultVersionId={readmeVersion?.id}
      />
    </AiSurface>
  );
}

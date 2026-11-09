import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { ApiError } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, AiSurface, Badge, ResourceList, type ListSchema, type SortOrder } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { useConfigMaps, useDeleteConfigMaps, ensureConfigMapsRegistered, type ConfigMapSummary } from './queries';

export interface ConfigMapsPageProps {
  /** Workspace segment; carried for route parity, not used for fetching yet. */
  workspace: string;
  cluster: string;
  namespace: string;
}

const PAGE_SIZE = 10;

/** Sort keys the server understands; matches the columns that can be sorted. */
type SortKey = 'name' | 'createdAt';

/**
 * ConfigMaps list.
 *
 * The page is a schema, not a layout. Title, search box, selection, the prop
 * table's chrome, empty state and pagination all come from `ResourceList` in
 * ai-kit, so this page renders exactly like the Storybook example and inherits
 * its spacing, borders and theme tokens. What stays here is the part that is
 * specific to ConfigMaps: which columns exist, what they render, and where the
 * data comes from.
 */
export function ConfigMapsPage({ workspace, cluster, namespace }: ConfigMapsPageProps): React.ReactElement {
  const t = useT();
  ensureConfigMapsRegistered();

  const [page, setPage] = React.useState(1);
  const [keyword, setKeyword] = React.useState('');
  // Debounced so typing does not issue one request per keystroke.
  const [debouncedKeyword, setDebouncedKeyword] = React.useState('');
  const [sortBy, setSortBy] = React.useState<SortKey>('createdAt');
  const [order, setOrder] = React.useState<SortOrder>('desc');
  const [selected, setSelected] = React.useState<string[]>([]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
      // A new search starts at page one; otherwise the user lands on an empty
      // page three of a two-page result.
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  const query = useConfigMaps({ cluster, namespace, page, pageSize: PAGE_SIZE, sortBy, order, keyword: debouncedKeyword });
  const remove = useDeleteConfigMaps({ cluster, namespace });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  // Selection is cleared whenever the visible page changes: acting on rows the
  // user can no longer see is the main way a bulk action deletes the wrong thing.
  React.useEffect(() => {
    setSelected([]);
  }, [cluster, namespace, page, debouncedKeyword, sortBy, order]);

  async function deleteNames(names: string[]) {
    if (!names.length) return;
    await remove.mutateAsync(names);
    setSelected([]);
  }

  const schema = React.useMemo<ListSchema<ConfigMapSummary>>(
    () => ({
      title: t('configmaps.title'),
      description: t('configmaps.description'),
      rowKey: 'name',
      // Stable per-record handle for automation; the row key is the resource name.
      rowAttributes: (row) => ({ 'data-ai-row': row.name }),
      search: { placeholder: t('configmaps.searchPlaceholder'), keys: ['name'] },
      selection: 'multiple',
      sortableKeys: ['name', 'createdAt'],
      sort: { key: sortBy, order },
      primaryAction: { key: 'create', label: t('configmaps.action.create'), aiId: 'configmaps:create' },
      actions: [
        {
          key: 'bulk-delete',
          label: t('configmaps.action.bulkDelete'),
          tone: 'danger',
          confirm: t('configmaps.confirm.bulkDelete'),
          aiId: 'configmaps:bulk-delete',
          aiNeeds: ['configmaps:row-select'],
        },
      ],
      columns: [
        {
          key: 'name',
          title: t('common.name'),
          // Two lines, as in the reference: the resource name carries the primary
          // weight and the description reads as supporting detail.
          render: (row) => (
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5">
                <Link
                  to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/configmaps/$name"
                  params={{ workspace, cluster, namespace, name: row.name }}
                  className="truncate font-medium text-ai-fg hover:text-ai-accent"
                  {...actionProps(`configmaps:open:${row.name}`)}
                >
                  {row.name}
                </Link>
                {row.federated ? <Badge tone="info">{t('configmaps.federated')}</Badge> : null}
              </span>
              <span className="truncate text-[11px] text-ai-fg-muted">{row.description || '-'}</span>
            </span>
          ),
        },
        {
          key: 'keys',
          title: t('configmaps.column.keys'),
          // Hidden on phones; the detail page still shows them.
          hideBelow: 'md',
          render: (row) => <span className="truncate text-ai-fg-secondary">{row.keys.join(', ') || '-'}</span>,
        },
        {
          key: 'createdAt',
          title: t('configmaps.column.createdAt'),
          width: 170,
          hideBelow: 'lg',
          render: (row) => (
            <span className="tabular-nums text-ai-fg-muted">
              {row.createdAt
                ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(row.createdAt))
                : '-'}
            </span>
          ),
        },
      ],
      rowActions: [
        {
          key: 'delete',
          label: t('common.delete'),
          tone: 'danger',
          confirm: t('configmaps.confirm.delete'),
        },
      ],
      empty: { title: t('configmaps.empty.title'), description: t('configmaps.empty.description') },
      pagination: { page, pageSize: PAGE_SIZE, total },
    }),
    [t, sortBy, order, page, total, cluster, namespace],
  );

  const state = query.isPending ? 'loading' : query.isError ? 'error' : items.length === 0 ? 'empty' : 'ready';

  /*
   * The error state is rendered by the page rather than the schema: `ResourceList`
   * reports an empty list the same way whether a query returned nothing or
   * failed, and those two need different affordances (retry vs create).
   */
  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="configmaps:surface" state="error" className="min-w-0">
        <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="configmaps:surface" state={state} className="min-w-0">
      <ResourceList
        schema={schema}
        rows={items}
        loading={state === 'loading'}
        searchValue={keyword}
        onSearchChange={setKeyword}
        selectedKeys={selected}
        onSelectionChange={setSelected}
        onPageChange={setPage}
        onSortChange={(next) => {
          if (!next) return;
          setSortBy(next.key as SortKey);
          setOrder(next.order);
          setPage(1);
        }}
        onAction={(action, row) => {
          // The delete affordance sits in the row menu; the schema's `confirm`
          // already asked before this fires.
          if (action === 'delete' && row) void deleteNames([row.name]);
        }}
        onBulkAction={(action, keys) => {
          if (action === 'bulk-delete') void deleteNames(keys);
        }}
      />

      {remove.isError ? (
        <p role="alert" className="mt-3 text-xs text-ai-danger">
          {remove.error instanceof ApiError ? remove.error.message : t('error.unknown')}
        </p>
      ) : null}
    </AiSurface>
  );
}

function ErrorPanel({ error, onRetry }: { error: unknown; onRetry: () => void }): React.ReactElement {
  const t = useT();
  const apiError = error instanceof ApiError ? error : undefined;
  const message = apiError
    ? apiError.isPermission
      ? t('error.unauthorized')
      : apiError.isNotFound
        ? t('error.notFound')
        : apiError.retryable
          ? t('error.network')
          : apiError.message
    : t('error.unknown');

  return (
    <div className="flex flex-col items-center gap-3 rounded-ai-md border border-ai-line p-8 text-center" role="alert">
      <p className="text-sm font-medium text-ai-fg">{t('error.title')}</p>
      <p className="text-xs text-ai-fg-muted">{message}</p>
      {/* No retry for a permission error: pressing it again cannot succeed. */}
      {apiError?.isPermission ? null : (
        <AiButton aiId="configmaps:retry" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </AiButton>
      )}
    </div>
  );
}

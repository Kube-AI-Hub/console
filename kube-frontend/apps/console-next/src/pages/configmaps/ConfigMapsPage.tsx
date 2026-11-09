import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { ApiError } from '@kube-ai-hub/api-client';
import { actionProps, rowProps, type AiSurfaceState } from '@kube-ai-hub/ai-surface';
import { AiButton, AiSurface, Badge, Empty, Pagination, Skeleton, cn, type TableColumn } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { useConfigMaps, useDeleteConfigMaps, ensureConfigMapsRegistered, type ConfigMapSummary } from './queries';

export interface ConfigMapsPageProps {
  cluster: string;
  namespace: string;
}

const PAGE_SIZE = 10;

/**
 * ConfigMaps list.
 *
 * There is no per-resource plumbing here: search, sorting, selection and
 * pagination are state on this component, and the columns are data. Adding
 * another k8s resource means writing a column list and a query, not another
 * list page — that is the claim the rewrite has to hold up, and this page is the
 * test of it.
 */
export function ConfigMapsPage({ cluster, namespace }: ConfigMapsPageProps): React.ReactElement {
  const t = useT();
  ensureConfigMapsRegistered();

  const [page, setPage] = React.useState(1);
  const [keyword, setKeyword] = React.useState('');
  // Debounced so typing does not issue one request per keystroke; 250ms is short
  // enough that the list feels live.
  const [debouncedKeyword, setDebouncedKeyword] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'name' | 'createdAt'>('createdAt');
  const [order, setOrder] = React.useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = React.useState<string[]>([]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
      // A new search starts from the first page; otherwise the user lands on an
      // empty page 3 of a two-page result.
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  const query = useConfigMaps({ cluster, namespace, page, pageSize: PAGE_SIZE, sortBy, order, keyword: debouncedKeyword });
  const remove = useDeleteConfigMaps({ cluster, namespace });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  // Selection is reset whenever the visible page changes: acting on rows the user
  // can no longer see is the main way a bulk action deletes the wrong thing.
  React.useEffect(() => {
    setSelected([]);
  }, [cluster, namespace, page, debouncedKeyword, sortBy, order]);

  const state: AiSurfaceState = query.isPending
    ? 'loading'
    : query.isError
      ? 'error'
      : items.length === 0
        ? 'empty'
        : 'ready';

  function toggleSort(key: 'name' | 'createdAt') {
    if (sortBy === key) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setOrder('asc');
    }
    setPage(1);
  }

  function toggleRow(name: string) {
    setSelected((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  }

  async function deleteNames(names: string[]) {
    if (!names.length) return;
    await remove.mutateAsync(names);
    setSelected([]);
  }

  const columns: Array<TableColumn<ConfigMapSummary>> = [
    {
      key: 'select',
      title: '',
      width: 44,
      render: (row) => (
        <label className="grid size-11 place-items-center sm:size-9" {...actionProps(`configmaps:select:${row.name}`, { label: t('common.selected', { count: 0 }) })}>
          <input
            type="checkbox"
            className="size-4 accent-[rgb(var(--ai-accent))]"
            checked={selected.includes(row.name)}
            onChange={() => toggleRow(row.name)}
          />
        </label>
      ),
    },
    {
      key: 'name',
      title: t('common.name'),
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5">
            <Link
              to="/c/$cluster/p/$namespace/configmaps/$name"
              params={{ cluster, namespace, name: row.name }}
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
      // Hidden on phones: the key list is supporting detail, and three columns do
      // not fit; the detail page still shows them.
      className: 'hidden sm:table-cell',
      render: (row) => <span className="truncate text-ai-fg-secondary">{row.keys.join(', ') || '-'}</span>,
    },
    {
      key: 'createdAt',
      title: t('configmaps.column.createdAt'),
      width: 170,
      className: 'hidden md:table-cell',
      render: (row) => (
        <span className="tabular-nums text-ai-fg-muted">
          {row.createdAt ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(row.createdAt)) : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: t('common.actions'),
      width: 96,
      render: (row) => (
        <AiButton
          aiId={`configmaps:delete:${row.name}`}
          variant="ghost"
          size="sm"
          onClick={() => {
            // A confirm dialog is required by the product; the agent path gets the
            // same protection, so an unattended run cannot delete silently.
            if (window.confirm(t('configmaps.confirm.delete'))) void deleteNames([row.name]);
          }}
        >
          {t('common.delete')}
        </AiButton>
      ),
    },
  ];

  return (
    <AiSurface as="section" aiId="configmaps:surface" state={state} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-base font-semibold text-ai-fg">{t('configmaps.title')}</h1>
        <p className="text-xs text-ai-fg-muted">{t('configmaps.description')}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t('configmaps.searchPlaceholder')}
          aria-label={t('configmaps.searchPlaceholder')}
          className="min-h-11 w-full rounded-ai-md border border-ai-line bg-ai-surface-1 px-3 text-sm text-ai-fg placeholder:text-ai-fg-faint focus-visible:border-ai-accent focus-visible:outline-none sm:min-h-9 sm:w-56"
          {...actionProps('configmaps:search')}
        />
        <AiButton aiId="configmaps:create" variant="primary" size="sm">
          {t('configmaps.action.create')}
        </AiButton>
        <AiButton
          aiId="configmaps:bulk-delete"
          variant="danger"
          size="sm"
          needs={['configmaps:row-select']}
          disabled={selected.length === 0 || remove.isPending}
          onClick={() => {
            if (window.confirm(t('configmaps.confirm.bulkDelete'))) void deleteNames(selected);
          }}
        >
          {t('configmaps.action.bulkDelete')}
          {selected.length ? ` (${selected.length})` : ''}
        </AiButton>
      </div>

      <div
        className={cn(
          'min-w-0 overflow-x-auto overscroll-x-contain rounded-ai-md border border-ai-line',
        )}
      >
        {state === 'loading' ? (
          <div className="space-y-2 p-3" role="status" aria-live="polite">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : state === 'error' ? (
          <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />
        ) : state === 'empty' ? (
          <Empty title={t('configmaps.empty.title')} description={t('configmaps.empty.description')} />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ai-line">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      'whitespace-nowrap px-3 py-2 text-left text-[11px] font-medium text-ai-fg-muted',
                      column.className,
                    )}
                    style={column.width ? { width: column.width } : undefined}
                    aria-sort={
                      column.key === 'name' || column.key === 'createdAt'
                        ? sortBy === column.key
                          ? order === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                        : undefined
                    }
                  >
                    {column.key === 'name' || column.key === 'createdAt' ? (
                      <AiButton
                        aiId={`configmaps:sort:${column.key}`}
                        bare
                        className="inline-flex min-h-8 items-center gap-1 hover:text-ai-fg"
                        onClick={() => toggleSort(column.key as 'name' | 'createdAt')}
                      >
                        {column.title}
                        {sortBy === column.key ? <span aria-hidden="true">{order === 'asc' ? '↑' : '↓'}</span> : null}
                      </AiButton>
                    ) : (
                      column.title
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.name} className="border-b border-ai-line last:border-b-0" {...rowProps(row.name)}>
                  {columns.map((column) => (
                    <td key={column.key} className={cn('px-3 py-2 align-middle', column.className)}>
                      {renderCell(column, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {state === 'ready' ? (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onChange={(next) => setPage(next)}
        />
      ) : null}

      {remove.isError ? (
        <p role="alert" className="text-xs text-ai-danger">
          {remove.error instanceof ApiError ? remove.error.message : t('error.unknown')}
        </p>
      ) : null}
    </AiSurface>
  );
}

function renderCell(column: TableColumn<ConfigMapSummary>, row: ConfigMapSummary): React.ReactNode {
  return typeof column.render === 'function' ? column.render(row, 0) : String(row[column.key as keyof ConfigMapSummary] ?? '');
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
    <div className="flex flex-col items-center gap-3 p-8 text-center" role="alert">
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

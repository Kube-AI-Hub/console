import * as React from 'react';
import { cn } from '../utils/cn';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { Select } from '../primitives/Select';
import { Table, type SortOrder, type TableColumn, type TableSortState } from '../primitives/Table';
import { Pagination } from '../primitives/Navigation';
import { Badge, Empty } from '../primitives/Display';
import { Dropdown } from '../primitives/Navigation';
import { getByPath, getColumnRenderer } from './registry';

/* ---------------- Types ---------------- */

export interface ListColumn<TRow> {
  /** Dot path into the row, or a stable id when `render` is used. */
  key: string;
  title: React.ReactNode;
  /** Built-in type name; `text` is the default. */
  type?: 'text' | 'link' | 'status' | 'number' | 'tags' | string;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  /** Escape hatch: takes precedence over `type`. */
  render?: (row: TRow, index: number) => React.ReactNode;
  /** Hide below this breakpoint; keeps wide tables readable on laptops. */
  hideBelow?: 'md' | 'lg' | 'xl';
}

export interface ListFilter {
  key: string;
  title: string;
  options: Array<{ value: string; label: string }>;
}

export interface ListAction<TRow> {
  key: string;
  label: React.ReactNode;
  tone?: 'default' | 'danger';
  /**
   * Stable automation handle, rendered as `data-ai-id`.
   *
   * The label is localised and may change; automation targets the handle.
   */
  aiId?: string;
  /**
   * Handles that must run before this one, rendered as `data-ai-needs`.
   *
   * A bulk action cannot run without a selection, and an agent should read that
   * from the DOM rather than infer it from a disabled attribute.
   */
  aiNeeds?: string[];
  /** Ask for confirmation before invoking `onAction`. */
  confirm?: string;
  /** Only show for matching rows. */
  visible?: (row: TRow) => boolean;
  disabled?: (row: TRow) => boolean;
}

export interface ListSchema<TRow> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  rowKey: keyof TRow | ((row: TRow) => string);
  columns: Array<ListColumn<TRow>>;
  filters?: ListFilter[];
  search?: { placeholder?: string; keys?: string[] };
  actions?: Array<ListAction<TRow>>;
  /** Row-level actions rendered as a dropdown in the last column. */
  rowActions?: Array<ListAction<TRow>>;
  /**
   * The page's one primary action, shown in the header.
   *
   * Kept separate from `actions` (which are bulk operations on a selection):
   * a create button is always visible and sits opposite the title, while bulk
   * actions only appear once rows are selected.
   */
  primaryAction?: { key: string; label: React.ReactNode; aiId?: string };
  selection?: 'none' | 'multiple';
  empty?: { title?: React.ReactNode; description?: React.ReactNode };
  pagination?: { pageSize: number; total: number; page: number };
  /**
   * Extra attributes for each row element.
   *
   * Used by the frontend to publish a stable handle per record (`data-ai-row`),
   * which automation uses to target one row without reading its cells.
   */
  rowAttributes?: (row: TRow) => Record<string, string>;
  /**
   * Current sort, when the host owns the order.
   *
   * Sorting stays controlled rather than internal because a resource list is
   * paged on the server: sorting one page in the browser produces an order that
   * is wrong across pages.
   */
  sort?: { key: string; order: SortOrder };
  /** Columns that can be sorted; defaults to none. */
  sortableKeys?: string[];
}

export interface ResourceListProps<TRow> {
  schema: ListSchema<TRow>;
  rows: TRow[];
  loading?: boolean;
  /** Controlled filter values keyed by `ListFilter.key`. */
  filters?: Record<string, string>;
  onFiltersChange?: (next: Record<string, string>) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  onPageChange?: (page: number) => void;
  /** Called with the next sort when a sortable header is clicked. */
  onSortChange?: (sort: { key: string; order: SortOrder } | undefined) => void;
  onAction?: (action: string, row: TRow) => void;
  /** Called with the primary action key and the current selection. */
  onBulkAction?: (action: string, keys: string[]) => void;
  className?: string;
}

/* ---------------- Built-in column renderers ---------------- */

const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  running: 'success',
  active: 'success',
  ready: 'success',
  healthy: 'success',
  pending: 'warning',
  waiting: 'warning',
  degraded: 'warning',
  failed: 'danger',
  error: 'danger',
  crashed: 'danger',
  unknown: 'neutral',
};

function renderStatus(value: unknown): React.ReactNode {
  const text = String(value ?? '');
  const tone = STATUS_TONES[text.toLowerCase()] ?? 'info';
  return <Badge tone={tone} dot>{text || '-'}</Badge>;
}

function renderTags(value: unknown): React.ReactNode {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',').filter(Boolean) : [];
  if (!items.length) return <span className="text-ai-fg-faint">-</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {items.slice(0, 4).map((item) => (
        <Badge key={String(item)} tone="neutral">{String(item)}</Badge>
      ))}
      {items.length > 4 ? <span className="text-[11px] text-ai-fg-faint">+{items.length - 4}</span> : null}
    </span>
  );
}

const hideBelowClass: Record<NonNullable<ListColumn<unknown>['hideBelow']>, string> = {
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

/**
 * Columns hidden below a breakpoint still need to render, but their header and
 * cells get a class the table picks up. Kept as a lookup rather than a computed
 * string so Tailwind can see the literal class names at build time.
 */
export function columnVisibilityClass<TRow>(column: ListColumn<TRow>): string {
  return column.hideBelow ? hideBelowClass[column.hideBelow] : '';
}

/* ---------------- Component ---------------- */

export function ResourceList<TRow>({
  schema,
  rows,
  loading = false,
  filters,
  onFiltersChange,
  searchValue,
  onSearchChange,
  selectedKeys = [],
  onSelectionChange,
  onPageChange,
  onSortChange,
  onAction,
  onBulkAction,
  className,
}: ResourceListProps<TRow>): React.ReactElement {
  const keyOf = React.useCallback(
    (row: TRow, index: number): string =>
      typeof schema.rowKey === 'function'
        ? schema.rowKey(row)
        : String(getByPath(row, String(schema.rowKey)) ?? index),
    [schema.rowKey],
  );

  const columns: Array<TableColumn<TRow>> = React.useMemo(() => {
    const sortableKeys = new Set(schema.sortableKeys ?? []);
    const mapped: Array<TableColumn<TRow>> = schema.columns.map((column) => ({
      key: column.key,
      title: column.title,
      width: column.width,
      align: column.align,
      sortable: sortableKeys.has(column.key),
      className: columnVisibilityClass(column),
      render: (row, index) => {
        if (column.render) return column.render(row, index);
        const value = getByPath(row, column.key);
        // The registry stores renderers type-erased (see registry.ts); the row
        // shape is only known to the component that registered it.
        const custom = getColumnRenderer(column.type ?? 'text') as
          | ((context: { row: TRow; value: unknown; rowIndex: number }) => React.ReactNode)
          | undefined;
        if (custom) return custom({ row, value, rowIndex: index });
        switch (column.type) {          case 'status':
            return renderStatus(value);
          case 'tags':
            return renderTags(value);
          case 'number':
            return <span className="tabular-nums">{value === undefined || value === null ? '-' : String(value)}</span>;
          case 'link':
            return (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onAction?.('open', row);
                }}
                className="truncate text-left font-medium text-ai-accent transition-colors duration-ai-fast hover:underline"
              >
                {String(value ?? '-')}
              </button>
            );
          default:
            return <span className="truncate">{value === undefined || value === null || value === '' ? '-' : String(value)}</span>;
        }
      },
    }));

    if (schema.rowActions?.length) {
      mapped.push({
        key: '__actions',
        title: '',
        width: 48,
        align: 'right',
        render: (row) => {
          const visible = schema.rowActions?.filter((action) => action.visible?.(row) ?? true) ?? [];
          if (!visible.length) return null;
          return (
            <Dropdown
              align="end"
              trigger={
                <Button variant="ghost" size="icon" aria-label="更多操作" onClick={(event) => event.stopPropagation()}>
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-4">
                    <circle cx="12" cy="5" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="12" cy="19" r="1.6" />
                  </svg>
                </Button>
              }
              items={visible.map((action) => ({
                key: action.key,
                label: action.label,
                danger: action.tone === 'danger',
                disabled: action.disabled?.(row) ?? false,
                onSelect: () => {
                  if (action.confirm && !window.confirm(action.confirm)) return;
                  onAction?.(action.key, row);
                },
              }))}
            />
          );
        },
      });
    }

    return mapped;
  }, [schema.columns, schema.sortableKeys, schema.rowActions, onAction]);

  const hasToolbar = Boolean(schema.search || schema.filters?.length);

  /**
   * The one action the page is for.
   *
   * Declared through `schema.primaryAction` rather than inferred from `actions`,
   * because "create" and "delete selected" are different kinds of control: the
   * first is always available and belongs in the header, the second only exists
   * once rows are selected and belongs next to the search box.
   */
  const primaryAction = schema.primaryAction;

  /** Actions that operate on the current selection; rendered only when non-empty. */
  const bulkActions = selectedKeys.length > 0 ? (schema.actions ?? []) : [];

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/*
       * Title and primary action share one row on wide screens.
       *
       * The action used to sit inside the toolbar, which put it on the same line
       * as the search box and left the header looking empty while the button
       * floated in the middle. A page header answers "what is this" and "what can
       * I do" — those belong together, above the list.
       */}
      {schema.title || schema.description || primaryAction ? (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {schema.title ? <h2 className="text-base font-semibold text-ai-fg">{schema.title}</h2> : null}
            {schema.description ? <p className="mt-1 text-xs text-ai-fg-muted">{schema.description}</p> : null}
          </div>
          {primaryAction ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onAction?.(primaryAction.key, undefined as unknown as TRow)}
              {...(primaryAction.aiId ? { 'data-ai-id': primaryAction.aiId } : {})}
            >
              {primaryAction.label}
            </Button>
          ) : null}
        </header>
      ) : null}

      {hasToolbar || bulkActions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {schema.search ? (
            <Input
              // Full width on a phone so the search field is reachable; a fixed
              // 224px box pushed the action buttons onto a second line.
              className="w-full sm:w-64"
              value={searchValue ?? ''}
              placeholder={schema.search.placeholder ?? '搜索'}
              aria-label={schema.search.placeholder ?? '搜索'}
              onChange={(event) => onSearchChange?.(event.target.value)}
              leading={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="size-3.5">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              }
            />
          ) : null}

          {schema.filters?.map((filter) => (
            <Select
              key={filter.key}
              className="w-40"
              aria-label={filter.title}
              placeholder={filter.title}
              value={filters?.[filter.key] ?? ''}
              onValueChange={(value) => onFiltersChange?.({ ...filters, [filter.key]: value })}
              options={[{ value: '', label: `全部${filter.title}` }, ...filter.options]}
            />
          ))}

          {/*
           * Bulk actions appear only once something is selected. Rendering them
           * disabled keeps the row the same width but adds two dead controls to
           * every visit; a selection bar is the pattern people expect from a list.
           */}
          {/*
           * The bar must be exactly as tall as the search field.
           *
           * It appears only after a selection, so a taller bar pushes the table
           * down at the moment the user is aiming at it — the row they just
           * selected jumps away. `h-9` matches the desktop field height, and the
           * buttons drop their own vertical padding so they cannot exceed it.
           */}
          {bulkActions.length > 0 ? (
            <div className="flex h-11 items-center gap-2 rounded-ai-md bg-ai-surface-2 px-2 sm:h-9">
              <span className="text-xs text-ai-fg-secondary">已选 {selectedKeys.length} 项</span>
              {bulkActions.map((action) => (
                <Button
                  key={action.key}
                  // `md` is h-9 on desktop, matching the search field exactly. The
                  // base `min-h-11` touch floor is cleared here so the bar cannot
                  // grow taller than the field it sits beside.
                  size="md"
                  variant={action.tone === 'danger' ? 'danger' : 'secondary'}
                  className="min-h-0 px-3"
                  onClick={() => {
                    if (action.confirm && !window.confirm(action.confirm)) return;
                    onBulkAction?.(action.key, selectedKeys);
                  }}
                  {...(action.aiId ? { 'data-ai-id': action.aiId } : {})}
                  {...(action.aiNeeds?.length ? { 'data-ai-needs': action.aiNeeds.join(' ') } : {})}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <Table
        columns={columns}
        rows={rows}
        rowKey={keyOf}
        loading={loading}
        {...(schema.rowAttributes ? { rowAttributes: schema.rowAttributes } : {})}
        {...(schema.sort ? { sorter: { key: schema.sort.key, order: schema.sort.order } satisfies TableSortState } : {})}
        {...(schema.sortableKeys?.length
          ? {
              // The cycle lives here so every host behaves the same: a new column
              // starts ascending, clicking the active one flips it.
              onSortChange: (next: TableSortState | undefined) =>
                onSortChange?.(next ? { key: next.key, order: next.order } : undefined),
            }
          : {})}
        selection={
          schema.selection === 'multiple' && onSelectionChange
            ? { selectedKeys, onChange: onSelectionChange }
            : undefined
        }
        empty={
          <Empty
            title={schema.empty?.title ?? '暂无数据'}
            description={schema.empty?.description}
          />
        }
      />

      {schema.pagination && onPageChange ? (
        <Pagination
          page={schema.pagination.page}
          pageSize={schema.pagination.pageSize}
          total={schema.pagination.total}
          onChange={onPageChange}
        />
      ) : null}
    </div>
  );
}

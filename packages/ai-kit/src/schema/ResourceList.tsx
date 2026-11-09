import * as React from 'react';
import { cn } from '../utils/cn';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';
import { Select } from '../primitives/Select';
import { Table, type TableColumn } from '../primitives/Table';
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
  selection?: 'none' | 'multiple';
  empty?: { title?: React.ReactNode; description?: React.ReactNode };
  pagination?: { pageSize: number; total: number; page: number };
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
    const mapped: Array<TableColumn<TRow>> = schema.columns.map((column) => ({
      key: column.key,
      title: column.title,
      width: column.width,
      align: column.align,
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
  }, [schema.columns, schema.rowActions, onAction]);

  const hasToolbar = Boolean(schema.search || schema.filters?.length || schema.actions?.length);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {schema.title || schema.description ? (
        <header>
          {schema.title ? <h2 className="text-base font-semibold text-ai-fg">{schema.title}</h2> : null}
          {schema.description ? <p className="mt-1 text-xs text-ai-fg-muted">{schema.description}</p> : null}
        </header>
      ) : null}

      {hasToolbar ? (
        <div className="flex flex-wrap items-center gap-2">
          {schema.search ? (
            <Input
              // Full width on a phone so the search field is reachable; a fixed
              // 224px box pushed the action buttons onto a second line.
              className="w-full sm:w-56"
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

          <div className="ml-auto flex items-center gap-2">
            {selectedKeys.length > 0 && schema.actions?.length ? (
              schema.actions.map((action) => (
                <Button
                  key={action.key}
                  size="sm"
                  variant={action.tone === 'danger' ? 'danger' : 'secondary'}
                  onClick={() => {
                    if (action.confirm && !window.confirm(action.confirm)) return;
                    onBulkAction?.(action.key, selectedKeys);
                  }}
                >
                  {action.label}（{selectedKeys.length}）
                </Button>
              ))
            ) : null}
          </div>
        </div>
      ) : null}

      <Table
        columns={columns}
        rows={rows}
        rowKey={keyOf}
        loading={loading}
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

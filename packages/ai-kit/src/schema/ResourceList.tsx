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
  /**
   * Let the cell grow to several lines instead of one.
   *
   * For columns holding a list of names — a ConfigMap's keys, a pod's containers —
   * one line hides most of the value and forces horizontal scrolling. Wrapping
   * trades row height for being able to read the cell.
   */
  wrap?: boolean;
}

/**
 * Radix `Select` refuses an option whose value is the empty string — it reserves
 * that for "no selection". A filter's "all" option is a real choice, so it needs a
 * sentinel; `''` still means "all" to callers, so no page has to know about this.
 */
const ALL_OPTION = '__all__';

export interface ListFilter {
  key: string;
  title: string;
  /** Label for the "no filter" option; defaults to `全部{title}`. */
  allLabel?: string;
  options: Array<{ value: string; label: string }>;
  /**
   * Let the reader type to narrow the options.
   *
   * For lists long enough that scrolling to an entry is slower than typing part
   * of its name — projects, namespaces — a plain popup is unusable.
   */
  searchable?: boolean;
  /** Text shown when nothing matches the typed filter. */
  emptyText?: string;
  /** Trigger width; defaults to 160px, enough for short values only. */
  widthClass?: string;
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
  search?: {
    placeholder?: string;
    keys?: string[];
    /**
     * Stable handle for the search input, rendered as `data-ai-id`.
     *
     * Optional so a list without automation still works, but any page that
     * declares the search in its agent manifest must set it: without the
     * attribute the declared id points at nothing, and every automation that
     * types into the box times out on a page that looks fine to a human.
     */
    aiId?: string;
  };
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
  /**
   * Whether a row can be selected.
   *
   * Selection drives bulk actions, so a row that may not be acted on — a
   * cluster-federated object, say — must not be checkable either. Returning false
   * disables the checkbox and keeps it out of select-all.
   */
  isRowSelectable?: (row: TRow) => boolean;
  empty?: { title?: React.ReactNode; description?: React.ReactNode };
  pagination?: {
    pageSize: number;
    total: number;
    page: number;
    /**
     * Sizes the reader may choose from.
     *
     * Omitted when the list cannot honour a jump — a cursor-paged collection can
     * only walk forward, so offering "100 per page" would be a dead control.
     */
    pageSizeOptions?: number[];
    /**
     * How pages are reached; see `PaginationProps.mode`.
     *
     * Cursor-paged collections must use `sequential`: page numbers would be dead
     * controls because page N is only reachable by walking every cursor before it.
     */
    mode?: 'numbered' | 'sequential';
  };
  /**
   * Accessible names for the built-in controls.
   *
   * These are screen-reader text, not visible copy, so a host with its own
   * language switcher must supply them or the reader hears the library's default
   * language in the middle of a translated page.
   */
  labels?: {
    selectAll?: string;
    selectRow?: (index: number) => string;
    moreActions?: string;
    previous?: string;
    next?: string;
    /** Prefix for the bulk-action count, e.g. 已选. */
    selected?: (count: number) => string;
    /** "1-10 of 3487"; the pager's range sentence. */
    range?: (from: number, to: number, total: number) => string;
    /** Accessible name for the page selector. */
    goToPage?: string;
    /** Label for the page-jump field. */
    jumpTo?: string;
  };
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
  /**
   * Prefix for the sort handles, rendered as `<prefix>:sort:<column key>`.
   *
   * Set it on any page whose automation sorts a column; the old console's list
   * pages all did. Omitted, the headers still sort but carry no handle.
   */
  sortAiPrefix?: string;
  /** Prefix for row-checkbox handles, rendered as `<selectAiId>:<row key>`. */
  selectAiId?: string;
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
  /** Provide together with `pagination.pageSizeOptions` to show a size picker. */
  onPageSizeChange?: (pageSize: number) => void;
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
  return [column.hideBelow ? hideBelowClass[column.hideBelow] : '', column.wrap ? 'whitespace-normal' : '']
    .filter(Boolean)
    .join(' ');
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
  onPageSizeChange,
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
      // `<column key>:sort` matches the convention the page objects and the agent
      // manifest already use (`configmaps:sort:name`).
      ...(sortableKeys.has(column.key) && schema.sortAiPrefix
        ? { sortAiId: `${schema.sortAiPrefix}:sort:${column.key}` }
        : {}),
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
                <Button variant="ghost" size="icon" aria-label={schema.labels?.moreActions ?? '更多操作'} onClick={(event) => event.stopPropagation()}>
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
  const bulkActions = schema.actions ?? [];
  const hasSelection = selectedKeys.length > 0;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/*
       * The header carries identity only.
       *
       * The primary action lives in the toolbar below, on the same row as search
       * and any bulk action. Keeping it here would occupy a second row for one
       * button: the title block is one line of text, and a header row whose right
       * half is empty wastes the vertical space a resource list needs most.
       */}
      {schema.title || schema.description ? (
        <header className="flex min-w-0 flex-col gap-1">
          {schema.title ? <h2 className="text-base font-semibold text-ai-fg">{schema.title}</h2> : null}
          {schema.description ? <p className="text-xs text-ai-fg-muted">{schema.description}</p> : null}
        </header>
      ) : null}

      {hasToolbar || bulkActions.length > 0 || primaryAction ? (
        <div className="flex flex-wrap items-center gap-2">
          {/*
           * Filters come before the search box.
           *
           * A filter narrows the whole set, while the search box narrows within it:
           * reading left to right, "which project" is a bigger question than "which
           * name", and putting the coarse control first matches the order the two
           * are actually used in. It also keeps the search box — the control people
           * reach for most — in a fixed position rather than shifting with the
           * number of filters.
           */}
          {schema.filters?.map((filter) => (
            <Select
              key={filter.key}
              className={cn('shrink-0', filter.widthClass ?? 'w-40')}
              aria-label={filter.title}
              placeholder={filter.title}
              value={filters?.[filter.key] || ALL_OPTION}
              onValueChange={(value) =>
                onFiltersChange?.({ ...filters, [filter.key]: value === ALL_OPTION ? '' : value })
              }
              options={[{ value: ALL_OPTION, label: filter.allLabel ?? `全部${filter.title}` }, ...filter.options]}
              {...(filter.searchable ? { searchable: true } : {})}
              {...(filter.emptyText ? { emptyText: filter.emptyText } : {})}
            />
          ))}

          {schema.search ? (
            <Input
              // Full width on a phone so the search field is reachable; a fixed
              // 224px box pushed the action buttons onto a second line.
              className="w-full sm:w-64"
              value={searchValue ?? ''}
              placeholder={schema.search.placeholder ?? '搜索'}
              aria-label={schema.search.placeholder ?? '搜索'}
              {...(schema.search.aiId ? { 'data-ai-id': schema.search.aiId } : {})}
              onChange={(event) => onSearchChange?.(event.target.value)}
              leading={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="size-3.5">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              }
            />
          ) : null}

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
          {/*
           * Two separate pieces: the count chip, then the actions pushed to the
           * right edge of the toolbar.
           *
           * The chip used to wrap both, so its tinted background also covered the
           * buttons and made the danger action read as part of the label. The chip
           * keeps the tint; the button sits on the page background, aligned with
           * the right edge of the table it operates on.
           */}
          {/*
           * Right-hand cluster: selection count, then bulk actions, then the
           * primary action. One `ml-auto` on the whole cluster keeps the search
           * on the left and everything actionable flush with the table's right
           * edge.
           *
           * The primary action goes last, not first: it stays in the same place
           * whether or not rows are selected, so its position never depends on a
           * transient state. Bulk actions sit immediately before it and disappear
           * when nothing is selected.
           */}
          <div className="ml-auto flex h-11 items-center gap-2 sm:h-9">
            {bulkActions.length > 0 ? (
              <>
                {/* Shown only with a selection. */}
                {hasSelection ? (
                <span
                  // Fixed width, right-aligned, tabular figures: the count grows
                  // leftward into reserved space so the actions never shift as it
                  // crosses 9 → 10 → 100.
                  className="flex h-full shrink-0 items-center justify-end rounded-ai-md bg-ai-surface-2 px-3 text-xs tabular-nums text-ai-fg-secondary"
                >
                  {schema.labels?.selected ? schema.labels.selected(selectedKeys.length) : `已选 ${selectedKeys.length} 项`}
                </span>
                ) : null}
                {bulkActions.map((action) => (
                  <Button
                    key={action.key}
                    // `md` is h-9 on desktop, matching the search field exactly. The
                    // base `min-h-11` touch floor is cleared so the row cannot grow
                    // taller than the field beside it.
                    size="md"
                    variant={action.tone === 'danger' ? 'danger' : 'secondary'}
                    className="px-3 sm:min-h-0"
                    /*
                     * Kept mounted and disabled when nothing is selected, rather
                     * than removed: the requirement is that 批量删除 stays visible
                     * and disabled, and an absent control is indistinguishable
                     * from a missing feature.
                     */
                    disabled={!hasSelection}
                    onClick={() => {
                      if (!hasSelection) return;
                      if (action.confirm && !window.confirm(action.confirm)) return;
                      onBulkAction?.(action.key, selectedKeys);
                    }}
                    {...(action.aiId ? { 'data-ai-id': action.aiId } : {})}
                    {...(action.aiNeeds?.length ? { 'data-ai-needs': action.aiNeeds.join(' ') } : {})}
                  >
                    {action.label}
                  </Button>
                ))}
              </>
            ) : null}
            {primaryAction ? (
              <Button
                size="md"
                variant="primary"
                className="px-3 sm:min-h-0"
                onClick={() => onAction?.(primaryAction.key, undefined as unknown as TRow)}
                {...(primaryAction.aiId ? { 'data-ai-id': primaryAction.aiId } : {})}
              >
                {primaryAction.label}
              </Button>
            ) : null}
          </div>
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
            ? {
                selectedKeys,
                onChange: onSelectionChange,
                ...(schema.isRowSelectable ? { isRowSelectable: schema.isRowSelectable } : {}),
                ...(schema.selectAiId ? { aiId: schema.selectAiId } : {}),
                ...(schema.labels ? { labels: { ...(schema.labels.selectAll ? { selectAll: schema.labels.selectAll } : {}), ...(schema.labels.selectRow ? { row: schema.labels.selectRow } : {}) } } : {}),
              }
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
          {...(onPageSizeChange ? { onPageSizeChange } : {})}
          {...(schema.pagination.pageSizeOptions ? { pageSizeOptions: schema.pagination.pageSizeOptions } : {})}
          {...(schema.pagination.mode ? { mode: schema.pagination.mode } : {})}
          /*
           * Forward every label the pager understands, not just prev/next: the
           * range sentence and the page-selector name are the two strings a reader
           * actually sees most.
           */
          {...(schema.labels
            ? {
                labels: {
                  ...(schema.labels.previous ? { previous: schema.labels.previous } : {}),
                  ...(schema.labels.next ? { next: schema.labels.next } : {}),
                  ...(schema.labels.range ? { range: schema.labels.range } : {}),
                  ...(schema.labels.goToPage ? { goToPage: schema.labels.goToPage } : {}),
                  ...(schema.labels.jumpTo ? { jumpTo: schema.labels.jumpTo } : {}),
                },
              }
            : {})}
        />
      ) : null}
    </div>
  );
}

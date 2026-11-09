import * as React from 'react';
import { cn } from '../utils/cn';

export type SortOrder = 'asc' | 'desc';

export interface TableColumn<T> {
  key: string;
  title: React.ReactNode;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  /** Extra classes for the header and body cells (responsive hiding). */
  className?: string;
  /**
   * Hide this column below the `sm` breakpoint.
   *
   * A wide table on a phone is better served by dropping the columns that carry
   * supporting detail than by making the user scroll sideways past the primary
   * one. The value is still reachable through the expanded row.
   */
  hideOnMobile?: boolean;
  render?: (row: T, index: number) => React.ReactNode;
  /**
   * Make the header clickable and cycle asc → desc → none.
   *
   * The table does not sort rows itself: the schema layer owns the data and may
   * sort server-side, so it only reports the requested order.
   */
  sortable?: boolean;
}

export interface TableSortState {
  key: string;
  order: SortOrder;
}

export interface TableProps<T> {
  columns: Array<TableColumn<T>>;
  rows: T[];
  rowKey: (row: T, index: number) => string;
  /** Renders a leading checkbox column when provided. */
  selection?: {
    selectedKeys: string[];
    onChange: (keys: string[]) => void;
    /** Disable selection for a specific row. */
    isRowSelectable?: (row: T) => boolean;
  };
  loading?: boolean;
  /** Shown when `rows` is empty and not loading. */
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
  /**
   * Extra attributes for each `<tr>`.
   *
   * The frontend publishes a stable handle per record (`data-ai-row`) so an agent
   * can target a row without parsing its cells.
   */
  rowAttributes?: (row: T) => Record<string, string>;
  className?: string;
  /** Current sort, when the host owns the order. */
  sorter?: TableSortState;
  /** Called with the next sort, or `undefined` when the cycle resets. */
  onSortChange?: (sorter: TableSortState | undefined) => void;
  /**
   * Expanded-row renderer. When present, each row gains a disclosure button and
   * the returned node renders in a full-width row beneath it.
   */
  expandedRow?: (row: T) => React.ReactNode;
}

/**
 * Presentational table.
 *
 * Deliberately not a data-grid: filtering and pagination belong to the schema
 * layer, which owns that state. Sorting is exposed only as a request (`sorter` +
 * `onSortChange`) so the same table serves client- and server-sorted data, and
 * row expansion is a rendering concern the host controls by supplying a renderer.
 *
 * Rows are plain `<tr>` elements, so the host can style them and tests can
 * query by role without a wrapper abstraction.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  selection,
  loading = false,
  empty,
  onRowClick,
  rowAttributes,
  className,
  sorter,
  onSortChange,
  expandedRow,
}: TableProps<T>): React.ReactElement {
  const allKeys = rows.map((row, index) => rowKey(row, index));
  const selected = new Set(selection?.selectedKeys ?? []);
  const selectableKeys = selection
    ? rows.filter((row) => selection.isRowSelectable?.(row) ?? true).map((row, index) => rowKey(row, index))
    : [];
  const allSelected = selectableKeys.length > 0 && selectableKeys.every((key) => selected.has(key));
  const [expandedKeys, setExpandedKeys] = React.useState<Set<string>>(new Set());

  const toggleAll = () => {
    if (!selection) return;
    if (allSelected) {
      selection.onChange(selection.selectedKeys.filter((key) => !selectableKeys.includes(key)));
    } else {
      selection.onChange([...new Set([...selection.selectedKeys, ...selectableKeys])]);
    }
  };

  const toggleOne = (key: string) => {
    if (!selection) return;
    selection.onChange(
      selected.has(key) ? selection.selectedKeys.filter((item) => item !== key) : [...selection.selectedKeys, key],
    );
  };

  const cycleSort = (key: string) => {
    if (!onSortChange) return;
    if (sorter?.key !== key) onSortChange({ key, order: 'asc' });
    else if (sorter.order === 'asc') onSortChange({ key, order: 'desc' });
    else onSortChange(undefined);
  };

  const toggleExpanded = (key: string) => {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // One leading column for selection, one for the disclosure control. Both are
  // accounted for in the colspan of the empty and expanded rows.
  const leadingColumns = (selection ? 1 : 0) + (expandedRow ? 1 : 0);
  const columnCount = columns.length + leadingColumns;

  const sortIcon = (key: string) => {
    if (sorter?.key !== key) return <SortIcon direction="none" />;
    return <SortIcon direction={sorter.order} />;
  };

  return (
    <div
      className={cn(
        // `overscroll-x-contain` stops a horizontal swipe at the table edge from
        // triggering the browser's back gesture on mobile.
        'overflow-x-auto overscroll-x-contain rounded-ai-md border border-ai-line',
        className,
      )}
    >
      <table className="w-full border-collapse text-sm text-ai-fg-secondary">
        <thead>
          <tr className="border-b border-ai-line bg-ai-th-bg">
            {expandedRow ? <th scope="col" className="w-8 px-2 py-2" aria-label="展开" /> : null}
            {selection ? (
              <th scope="col" className="w-10 px-3 py-2 text-ai-fg-muted">
                {/*
                 * The label supplies a 44px tap area on phones while the box
                 * itself stays 14px, so density on desktop is unchanged but a
                 * thumb can hit it. Below 44px, tapping selects the wrong row.
                 */}
                <label className="grid size-11 cursor-pointer place-items-center sm:size-auto">
                  <input
                    type="checkbox"
                    aria-label="全选"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="size-3.5 shrink-0 accent-[rgb(var(--ai-accent))]"
                  />
                </label>
              </th>
            ) : null}
            {columns.map((column) => {
              const active = sorter?.key === column.key;
              const ariaSort = column.sortable
                ? active
                  ? sorter.order === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
                : undefined;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort}
                  style={{ width: column.width }}
                  className={cn(
                    'whitespace-nowrap px-3 py-2 text-[11px] font-medium text-ai-fg-muted',
                    column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
                    column.hideOnMobile && 'hidden sm:table-cell',
                    column.className,
                  )}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => cycleSort(column.key)}
                      className={cn(
                        'inline-flex items-center gap-1 transition-colors duration-ai-fast hover:text-ai-fg',
                        active && 'text-ai-accent',
                      )}
                    >
                      {column.title}
                      {sortIcon(column.key)}
                    </button>
                  ) : (
                    column.title
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 3 }, (_, index) => (
              <tr key={`skeleton-${index}`} className="border-b border-ai-line last:border-b-0">
                {leadingColumns > 0
                  ? Array.from({ length: leadingColumns }, (_, cell) => <td key={cell} className="px-3 py-2.5" />)
                  : null}
                {columns.map((column) => (
                  <td key={column.key} className={cn('px-3 py-2.5', column.hideOnMobile && 'hidden sm:table-cell')}>
                    <div className="h-3 w-full animate-pulse rounded-ai-sm bg-ai-surface-3" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="px-3 py-10 text-center text-xs text-ai-fg-muted">
                {empty ?? '暂无数据'}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const key = allKeys[index] ?? String(index);
              const isSelected = selected.has(key);
              const isExpanded = expandedKeys.has(key);
              return (
                <React.Fragment key={key}>
                  <tr
                    data-selected={isSelected ? 'true' : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    {...(rowAttributes ? rowAttributes(row) : {})}
                    className={cn(
                      'border-b border-ai-line transition-colors duration-ai-fast',
                      !isExpanded && 'last:border-b-0',
                      'hover:bg-ai-surface-2',
                      onRowClick && 'cursor-pointer',
                      isSelected && 'bg-ai-accent/5',
                    )}
                  >
                    {expandedRow ? (
                      <td className="px-2 py-2.5" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          aria-label={isExpanded ? '收起' : '展开'}
                          aria-expanded={isExpanded}
                          onClick={() => toggleExpanded(key)}
                          className="grid size-5 place-items-center rounded-ai-sm text-ai-fg-muted transition-colors duration-ai-fast hover:bg-ai-surface-3 hover:text-ai-fg"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            className={cn('size-3 transition-transform duration-ai-fast', isExpanded && 'rotate-90')}
                          >
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                        </button>
                      </td>
                    ) : null}
                    {selection ? (
                      <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                        <label className="grid size-11 cursor-pointer place-items-center sm:size-auto">
                          <input
                            type="checkbox"
                            aria-label={`选择第 ${index + 1} 行`}
                            checked={isSelected}
                            disabled={!(selection.isRowSelectable?.(row) ?? true)}
                            onChange={() => toggleOne(key)}
                            className="size-3.5 shrink-0 accent-[rgb(var(--ai-accent))]"
                          />
                        </label>
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          'px-3 py-2.5 text-xs text-ai-fg-secondary',
                          column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
                          column.hideOnMobile && 'hidden sm:table-cell',
                          column.className,
                        )}
                      >
                        {column.render ? column.render(row, index) : null}
                      </td>
                    ))}
                  </tr>
                  {expandedRow && isExpanded ? (
                    <tr className="border-b border-ai-line bg-ai-surface-2/40 last:border-b-0">
                      <td colSpan={columnCount} className="px-4 py-3">
                        {expandedRow(row)}
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function SortIcon({ direction }: { direction: SortOrder | 'none' }): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-2.5"
      data-direction={direction}
    >
      {direction === 'none' ? (
        <path d="m8 9 4-4 4 4M8 15l4 4 4-4" opacity="0.45" />
      ) : direction === 'asc' ? (
        <path d="m8 14 4-4 4 4" />
      ) : (
        <path d="m8 10 4 4 4-4" />
      )}
    </svg>
  );
}

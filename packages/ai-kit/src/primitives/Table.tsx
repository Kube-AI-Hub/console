import * as React from 'react';
import { cn } from '../utils/cn';
import { Tooltip } from './Feedback';
import { Icon } from './Icon/Icon';

export type SortOrder = 'asc' | 'desc';

export interface TableColumn<T> {
  key: string;
  title: React.ReactNode;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  /** Extra classes for the header and body cells (responsive hiding). */
  className?: string;
  /**
   * Explain the column's unit or how the value is derived.
   *
   * Rendered as an info affordance beside the title. Column headers are one or two
   * words by necessity ("GPU usage"), and the difference between "allocated by the
   * scheduler" and "measured on the card" does not fit in a header — but it is the
   * difference that makes a number misread. A `title` attribute would only appear on
   * hover after a delay and is unreachable by keyboard; this is a real control.
   */
  hint?: React.ReactNode;
  /**
   * Keep this column visible while the table scrolls horizontally.
   *
   * `start` pins to the left edge, `end` to the right. The pinned column is the
   * reader's anchor — the row's identity on the left, its actions on the right — so
   * it must stay put when the middle columns scroll past.
   *
   * Only the first `start` and the last `end` are honoured; offsets are not
   * accumulated, because a pinned column's rendered width does not reliably match
   * its declared `width` and a stale offset drifts. Give a pinned column an explicit
   * `width`, or it jumps as content changes.
   */
  pin?: 'start' | 'end';
  /**
   * Filter control rendered beside the header title.
   *
   * A column's own filter belongs at the column: clicking the header is how a reader
   * says "narrow this field", and it leaves the toolbar for controls that are not a
   * field — the row search, the project scope, a time range. Supplied by the schema
   * layer, which owns the filter's value and options.
   */
  filter?: React.ReactNode;
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
  /**
   * Handle for the sort control, rendered as `data-ai-id`.
   *
   * Sorting happens server-side, so an automation has no other way to press the
   * header: the button carries no stable text (the label is the column title and
   * changes with locale) and no column index is survivable once a column is
   * inserted. Without it the "sort by X" step is unaddressable.
   */
  sortAiId?: string;
}

/**
 * Left offsets for pinned-start columns.
 *
 * Tailwind only emits classes it can see as literals, so the four possible leading
 * widths are spelled out instead of interpolated. They come from the fixed widths of
 * the two built-in leading columns in this file: the disclosure column is `w-8`
 * (32px), the selection column `w-10` (40px).
 *
 * Offsets are only ever computed from those literals. A business column's rendered
 * width does not reliably equal its declared `width`, so accumulating offsets from it
 * would drift — which is why only one business column pins per side.
 */
const PIN_LEFT: Record<number, string> = {
  0: 'left-0',
  32: 'left-8',
  40: 'left-10',
  72: 'left-[72px]',
};

/**
 * Sticky classes for a pinned column.
 *
 * A pinned cell must paint an opaque background or the columns scrolling underneath
 * show through it, and it must sit above them (z-index) or the text overlaps. The
 * `end` column also gets an inset shadow in place of a border: the table uses
 * `border-collapse`, where a cell's border scrolls away with the cell instead of
 * staying at the edge, so the shadow is what draws the seam.
 *
 * The shadow colour is a token rather than black, so it is visible on the light
 * theme instead of only on the dark one.
 */
function pinClasses(pin: TableColumn<unknown>['pin'], background: string, left = 0): string {
  if (!pin) return '';
  return cn(
    'sticky z-20',
    background,
    pin === 'start'
      ? PIN_LEFT[left] ?? 'left-0'
      : 'right-0 shadow-[inset_-8px_0_8px_-8px_rgb(var(--ai-line))]',
  );
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
    /**
     * Whether this row may be selected.
     *
     * Returning false omits the checkbox (an empty cell keeps the column) and
     * keeps the row out of select-all. A disabled checkbox that cannot succeed
     * is a trap.
     */
    isRowSelectable?: (row: T) => boolean;
    /**
     * Accessible names for the checkboxes.
     *
     * `row` receives the 1-based position so a host can say "Select row 2" in its
     * own language instead of leaving a Chinese label in an English page.
     */
    labels?: { selectAll?: string; row?: (index: number) => string };
    /**
     * Handle for a row's checkbox, rendered as `<aiId>:<row key>`.
     *
     * Selection drives the bulk actions, so an automation has to reach a specific
     * row's checkbox by name. Settling for "the nth checkbox" breaks the moment a
     * column or a row is inserted.
     */
    aiId?: string;
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
  /**
   * What the header cycle returns to when a column is turned off.
   *
   * A server-paginated list always sends a sort key, so "off" cannot mean "no
   * parameter" — it means "back to the order the page starts with". Without this the
   * cycle has nowhere to land and the third click looks like nothing happened.
   */
  sortFallback?: TableSortState;
  /** Called with the next sort. */
  onSortChange?: (sorter: TableSortState) => void;
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
  sortFallback,
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

  /*
   * Three states: ascending -> descending -> back to the default order.
   *
   * The middle version stopped at two because a "no sort" step looked like a dead
   * control: every consumer sorts server-side and always sends a key, so reporting
   * `undefined` left them with nothing to send and the third click did nothing
   * visible. The third state exists, it just is not `undefined` — turning the column
   * off returns `sortFallback`, the order the page starts with.
   */
  const cycleSort = (key: string) => {
    if (!onSortChange) return;
    if (sorter?.key !== key) {
      onSortChange({ key, order: 'asc' });
      return;
    }
    if (sorter.order === 'asc') {
      onSortChange({ key, order: 'desc' });
      return;
    }
    onSortChange(sortFallback ?? { key, order: 'asc' });
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

  /*
   * Left offsets for the leading columns, in the order they render.
   *
   * Both are pinned: they are the row's identity controls, and a reader who has
   * scrolled to the far right of a wide table must still be able to select a row.
   * Their widths are literals in this file, so the offsets are constants rather than
   * measurements.
   */
  const disclosureLeft = 0;
  const selectionLeft = expandedRow ? 32 : 0;
  /** Where the first business column starts once the leading columns are pinned. */
  const firstColumnLeft = (expandedRow ? 32 : 0) + (selection ? 40 : 0);

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
      {/*
        * `w-max` + `min-w-full` rather than `w-full`.
        *
        * `w-full` caps the table at the container's width, and with `table-layout: auto`
        * the browser then shrinks every column below its declared `width` — an eight
        * column node table squeezed 150px columns down to 129px and read as truncated
        * text rather than as a table that scrolls. `w-max` lets the table take the width
        * its columns ask for; `min-w-full` keeps a narrow table filling the container
        * so short lists do not collapse to the left.
        */}
      <table className="w-max min-w-full border-collapse text-sm text-ai-fg-secondary">
        {/*
         * No header when there is nothing to head. The old console renders an empty
         * card in that case, and a header row above "no data" reads as a table that
         * failed to load its rows rather than as a list that is legitimately empty.
         * Kept while loading: the skeleton rows sit under it, so removing it there
         * would make the table jump when data arrives.
         */}
        {loading || rows.length > 0 ? (
        <thead>
          <tr className="border-b border-ai-line bg-ai-th-bg">
            {expandedRow ? <th scope="col" className={cn('w-8 px-2 py-2', pinClasses('start', 'bg-ai-th-bg', disclosureLeft), 'z-30')} aria-label="展开" /> : null}
            {selection ? (
              <th scope="col" className={cn('w-10 px-3 py-2 text-ai-fg-muted', pinClasses('start', 'bg-ai-th-bg', selectionLeft), 'z-30')}>
                {/*
                 * The label supplies a 44px tap area on phones while the box
                 * itself stays 14px, so density on desktop is unchanged but a
                 * thumb can hit it. Below 44px, tapping selects the wrong row.
                 */}
                <label className="grid size-11 cursor-pointer place-items-center sm:size-auto">
                  <input
                    type="checkbox"
                    aria-label={selection.labels?.selectAll ?? '全选'}
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
                    // The header is above the pinned body cells so a scrolling column
                    // never paints over the heading.
                    column.pin ? cn(pinClasses(column.pin, 'bg-ai-th-bg', firstColumnLeft), 'z-30') : '',
                  )}
                >
                  {/*
                    * The title and the hint are siblings, not nested buttons.
                    *
                    * `sortable` puts the title inside a `<button>`; the hint needs its
                    * own control. Wrapping one in the other is invalid HTML and makes
                    * the click target ambiguous, so the pair is a flex row: the sort
                    * button covers the label, the hint button sits beside it.
                    */}
                  <span className="inline-flex items-center gap-1">
                    {column.sortable ? (
                      <button
                        type="button"
                        {...(column.sortAiId ? { 'data-ai-id': column.sortAiId } : {})}
                        onClick={() => cycleSort(column.key)}
                        className={cn(
                          /*
                           * The header cell is only as tall as its text, which leaves the
                           * sort control under the 44px touch minimum. Filling the cell's
                           * height on a touch viewport (`pointer-coarse`) gives a thumb a
                           * target without changing the row height on desktop.
                           */
                          'inline-flex min-h-11 items-center gap-1 transition-colors duration-ai-fast hover:text-ai-fg sm:min-h-0',
                          active && 'text-ai-accent',
                        )}
                      >
                        {column.title}
                        {sortIcon(column.key)}
                      </button>
                    ) : (
                      column.title
                    )}
                    {column.hint ? (
                      <Tooltip content={column.hint}>
                        {/*
                         * A button rather than a span with `title`: a tooltip that only
                         * appears on hover is unreachable by keyboard and by touch, and
                         * the hint is the only place the unit is written down.
                         */}
                        <button
                          type="button"
                          aria-label={typeof column.hint === 'string' ? column.hint : undefined}
                          className="grid size-4 place-items-center rounded-full text-ai-fg-faint transition-colors duration-ai-fast hover:text-ai-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring"
                          // Without this the click also lands on the header's sort
                          // button in browsers that route the event up the tree.
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Icon name="information" size={12} />
                        </button>
                      </Tooltip>
                    ) : null}
                    {column.filter ? <span className="inline-flex">{column.filter}</span> : null}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        ) : null}
        <tbody>
          {loading ? (
            Array.from({ length: 3 }, (_, index) => (
              <tr key={`skeleton-${index}`} className="border-b border-ai-line last:border-b-0">
                {leadingColumns > 0
                  ? Array.from({ length: leadingColumns }, (_, cell) => (
                    <td key={cell} className={cn('px-3 py-2.5', pinClasses('start', 'bg-ai-surface-1', cell === 0 ? disclosureLeft : selectionLeft))} />
                  ))
                  : null}
                {columns.map((column) => (
                  <td key={column.key} className={cn('px-3 py-2.5', column.hideOnMobile && 'hidden sm:table-cell',
                    pinClasses(column.pin, 'bg-ai-surface-1', firstColumnLeft))}>
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
                      <td className={cn('px-2 py-2.5', pinClasses('start', 'bg-ai-surface-1', disclosureLeft))} onClick={(event) => event.stopPropagation()}>
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
                      <td className={cn('px-3 py-2.5', pinClasses('start', 'bg-ai-surface-1', selectionLeft))} onClick={(event) => event.stopPropagation()}>
                        {selection.isRowSelectable?.(row) ?? true ? (
                          <label className="grid size-11 cursor-pointer place-items-center sm:size-auto">
                            <input
                              type="checkbox"
                              {...(selection.aiId ? { 'data-ai-id': `${selection.aiId}:${key}` } : {})}
                              aria-label={selection.labels?.row?.(index + 1) ?? `选择第 ${index + 1} 行`}
                              checked={isSelected}
                              onChange={() => toggleOne(key)}
                              className="size-3.5 shrink-0 accent-[rgb(var(--ai-accent))]"
                            />
                          </label>
                        ) : null}
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
                          pinClasses(column.pin, 'bg-ai-surface-1', firstColumnLeft),
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

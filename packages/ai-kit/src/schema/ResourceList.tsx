import * as React from 'react';
import { cn } from '../utils/cn';
import { Button } from '../primitives/Button';
import { InputSearch, Input } from '../primitives/Input';
import { Select, MultiSelect } from '../primitives/Select';
import { Checkbox } from '../primitives/Toggles';
import { Table, type SortOrder, type TableColumn, type TableSortState } from '../primitives/Table';
import { Pagination } from '../primitives/Navigation';
import { Badge, Empty } from '../primitives/Display';
import { Icon } from '../primitives/Icon/Icon';
import { Dropdown } from '../primitives/Navigation';
import { Modal, Popover } from '../primitives/Feedback';
import { getByPath, getColumnRenderer } from './registry';

/* ---------------- Types ---------------- */

export interface ListColumnBase<TRow> {
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
  /**
   * Explain the column's unit or how the value is derived, shown on an info control
   * beside the header.
   *
   * A header is one or two words by necessity; the difference between "allocated by
   * the scheduler" and "measured on the card" does not fit, and it is the difference
   * that makes a number misread.
   */
  hint?: React.ReactNode;
  /**
   * Accessible name for the hint control, when `hint` is not a plain string.
   *
   * A multi-line hint (a list of label rules, say) cannot be its own name — the button
   * would be announced as "information" with no indication of what it explains. Pass
   * the column title here.
   */
  hintLabel?: string;
}

/**
 * A pinned column, or a hideable one — never both.
 *
 * A pinned column is the reader's anchor for locating a row. Hiding it while the
 * middle columns scroll leaves nothing to orient against, so the two states are
 * mutually exclusive. Expressed as a union rather than a doc comment so that writing
 * both is a compile error instead of a silently-ignored combination.
 */
export type ListColumn<TRow> = ListColumnBase<TRow> & (
  | {
    /**
     * Keep this column visible while the table scrolls horizontally.
     *
     * `start` pins to the left edge, `end` to the right. Only the first `start` and
     * the last `end` are honoured — offsets are not accumulated (see
     * `TableColumn.pin`).
     *
     * Give a pinned column an explicit `width`; without one it jumps as its content
     * changes, which makes the pin more distracting than useful.
     */
    pin: 'start' | 'end';
    /** A pinned column cannot be hidden; see `ListColumn`. */
    hideable?: false;
  }
  | {
    pin?: undefined;
    /** Opt in to the host-controlled column chooser. Key columns remain visible. */
    hideable?: boolean;
  }
);

/**
 * Radix `Select` refuses an option whose value is the empty string — it reserves
 * that for "no selection". A filter's "all" option is a real choice, so it needs a
 * sentinel; `''` still means "all" to callers, so no page has to know about this.
 */
const ALL_OPTION = '__all__';

/**
 * Warn about a misconfiguration once per key.
 *
 * A list re-renders on every keystroke, so an unguarded warning would flood the
 * console and hide the message it is trying to deliver. The key is the column, which
 * is what the reader would have to change.
 */
const warned = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

export interface ListFilter {
  key: string;
  title: string;
  /**
   * Put this filter on a column's header instead of in the toolbar.
   *
   * The column's key. A field's own filter belongs where the field is — clicking
   * the header is how a reader says "narrow this column", and it keeps the toolbar
   * for the things that are not a field: the row search, the project scope, the
   * time range. Filters without this stay in the toolbar, which is the right place
   * for a control that narrows several columns at once.
   */
  column?: string;
  /** Label for the "no filter" option; defaults to `全部{title}`. */
  allLabel?: string;
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
  type?: 'select' | 'text';
  multiple?: boolean;
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
  /**
   * Automation handle, rendered as `data-ai-id` on the trigger.
   *
   * Without one the trigger is reachable only by its accessible name, and its
   * role is `combobox`, not `button` — that is what Radix renders for a select
   * trigger. Automation that assumed `button` waited 30 seconds per attempt for
   * a match that never came.
   */
  aiId?: string;
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
  /**
   * Ask for confirmation in a modal before invoking `onAction`.
   *
   * The string is the dialog title. Cancel leaves the row untouched; confirm
   * runs the action. A native `window.confirm` would look like a browser
   * prompt and cannot match the rest of the overlays.
   */
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
  columnVisibility?: { label: string; resetLabel: string; aiId?: string };
  search?: {
    placeholder?: string;
    /**
     * No `keys`: searching is a server-side keyword, not a client-side field match.
     *
     * The field existed and every caller filled it with `['name']`, which happened to
     * describe what the server does — but nothing read it, so declaring `['name','app']`
     * would have implied a multi-field search that does not exist. Filtering a
     * server-paginated list client-side would only search the current page.
     */
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
   *
   * `disabled` keeps the control mounted (an absent button reads as a missing
   * feature) and `disabledHint` is rendered as visible text beside it: a disabled
   * control with no explanation leaves the reader guessing whether it is a permission
   * problem or a bug.
   */
  primaryAction?: {
    key: string;
    label: React.ReactNode;
    aiId?: string;
    disabled?: boolean;
    disabledHint?: React.ReactNode;
  };
  /**
   * A refresh affordance next to the search box.
   *
   * For lists whose rows change without the reader acting (a cluster that becomes ready,
   * a job that finishes): without it the only way to see the new state is a reload, and
   * people do not reload — they read stale rows and conclude nothing changed.
   */
  refresh?: { label: string; aiId?: string; busy?: boolean };
  selection?: 'none' | 'multiple';
  /**
   * Whether a row can be selected.
   *
   * Selection drives bulk actions, so a row that may not be acted on — a
   * preset account, say — must not be checkable either. Returning false omits
   * the checkbox and keeps the row out of select-all.
   */
  isRowSelectable?: (row: TRow) => boolean;
  empty?: {
    /** Shown when the collection itself is empty. */
    title?: React.ReactNode;
    description?: React.ReactNode;
    /**
     * Shown when the collection has rows but the current search/filters exclude them all.
     *
     * "Nothing here yet" and "nothing matches what you typed" are different answers, and a reader
     * who typed a query needs the second one. Pages may override it; the component supplies a
     * neutral default so every list distinguishes the two states.
     */
    noMatchTitle?: React.ReactNode;
    noMatchDescription?: React.ReactNode;
  };
  /**
   * Whether the list is currently narrowed by the reader, overriding the component's guess.
   *
   * The component infers this from the search box alone. It deliberately ignores `filters`:
   * many pages put their **scope** in `filters` (the project a route points at), and treating
   * that as narrowing made every empty project-scoped list claim "nothing matches" when the
   * truth was "nothing here yet" (found by a console-next case, 2026-11-18). A page that
   * narrows by a real filter can say so here.
   */
  narrowed?: boolean;
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
    /** Accessible name for the rows-per-page picker. */
    pageSize?: string;
    pageSizeSuffix?: string;
    /** Dismiss the confirmation dialog. */
    confirmCancel?: string;
    /** Proceed from the confirmation dialog. */
    confirmOk?: string;
    clearSearch?: string;
    clearFilters?: string;
    /**
     * Label for the empty state's "clear search and filters" escape hatch.
     *
     * It is separate from `clearFilters` (the toolbar button, shown only while a
     * filter is active) because the empty state also appears for a list that simply
     * has no rows yet; the escape hatch is about getting unstuck, not about the
     * current filter state.
     */
    emptyClear?: string;
    /** Label for the empty state's refresh action; defaults to the refresh label. */
    emptyRefresh?: string;
    clearFilter?: (title: string) => string;
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
  /**
   * What the header cycle returns to when a sorted column is turned off.
   *
   * A server-paginated list always sends a sort key, so "off" has to land somewhere.
   * Set this to the order the page starts with; `useResourceListState` already
   * exposes it as `list.sortFallback`.
   */
  sortFallback?: { key: string; order: SortOrder };
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
  /**
   * A refetch is in flight while rows are still on screen.
   *
   * Set this instead of `loading` for a refresh: the rows stay (dimmed, with a
   * spinner) rather than being replaced by skeletons, so the reader keeps their place
   * and can see the values that are about to change.
   */
  refreshing?: boolean;
  /** Replace data/pager on failure while retaining the editable search and filters. */
  errorContent?: React.ReactNode;
  /** Controlled filter values keyed by `ListFilter.key`. */
  filters?: Record<string, string>;
  onFiltersChange?: (next: Record<string, string>) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Paired with `schema.refresh`; the list renders the button only when both exist. */
  onRefresh?: () => void;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  onPageChange?: (page: number) => void;
  /** Provide together with `pagination.pageSizeOptions` to show a size picker. */
  onPageSizeChange?: (pageSize: number) => void;
  /** Called with the next sort when a sortable header is clicked. */
  onSortChange?: (sort: { key: string; order: SortOrder }) => void;
  onAction?: (action: string, row: TRow) => void;
  /** Called with the primary action key and the current selection. */
  onBulkAction?: (action: string, keys: string[]) => void;
  className?: string;
  visibleColumnKeys?: string[];
  onVisibleColumnsChange?: (keys: string[]) => void;
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

/**
 * A column's own filter, as an icon in its header.
 *
 * The icon is always present so the column does not shift when a filter becomes
 * active; it is tinted when the column is narrowed, which is the only signal that a
 * filter is on once the popover is closed.
 *
 * The options are rendered directly in the panel, not behind a nested select. A
 * select inside a popover makes the reader open the filter and then open the select —
 * two clicks to reach a list of four vendors. The panel is already the place they
 * asked for, so the choices belong in it.
 */
function ColumnFilter({ filter, value, onChange, labels }: {
  filter: ListFilter;
  value: string;
  onChange: (next: string) => void;
  labels?: { clearFilter?: (title: string) => string };
}): React.ReactElement {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const active = value !== '';
  const selected = value.split(',').filter(Boolean);
  const selectedSet = new Set(selected);
  const clear = (): void => onChange('');
  const keyword = query.trim().toLowerCase();
  const matches = (filter.options ?? []).filter((option) => !keyword || option.label.toLowerCase().includes(keyword));

  /*
   * A single-select filter closes as soon as a choice is made.
   *
   * There is nothing left to do in the panel — one value is the whole answer — and
   * leaving it open makes the reader dismiss it to see the result of their click.
   * Multi-select stays open: choosing three vendors is one visit, not three.
   */
  const chooseOne = (next: string): void => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover
      align="start"
      className="w-56 p-0"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // The search box is a way to find an option, not a saved state: reopening the
        // panel should show the full list rather than whatever was typed last time.
        if (!next) setQuery('');
      }}
      trigger={
        <button
          type="button"
          aria-label={filter.title}
          data-ai-id={filter.aiId}
          data-active={active ? 'true' : undefined}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            // size-6 is the 24px minimum touch target: at size-5 (20px) the column-filter chip
            // failed the mobile sweep on every list that has filters (2026-11-19).
            'grid size-6 cursor-pointer place-items-center rounded-ai-sm transition-colors duration-ai-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring',
            active ? 'text-ai-accent' : 'text-ai-fg-faint hover:text-ai-fg-muted',
          )}
        >
          <Icon name="filter" size={14} />
        </button>
      }
    >
      <div className="flex w-full flex-col">
        {filter.type === 'text' ? (
          <InputSearch
            hideButton
            type="text"
            role="textbox"
            aria-label={filter.title}
            placeholder={filter.title}
            value={value}
            onChange={onChange}
            clearLabel={labels?.clearFilter?.(filter.title)}
            clearAiId={filter.aiId ? `${filter.aiId}:clear` : undefined}
          />
        ) : (
          <>
            {/*
             * A search field only when the list is long enough to need one: a filter
             * with three options does not, and the extra row pushes the options down.
             */}
            {filter.searchable ? (
              <div className="border-b border-ai-line p-1.5">
                <Input value={query} aria-label={filter.title} placeholder={filter.title}
                  onChange={(event) => setQuery(event.target.value)} />
              </div>
            ) : null}
            <div className="flex max-h-60 flex-col gap-0.5 overflow-y-auto p-1" role="group" aria-label={filter.title}
              data-ai-id={filter.aiId ? `${filter.aiId}:options` : undefined}
              onKeyDown={(event) => {
                if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
                const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"], [role="checkbox"]'));
                const index = items.indexOf(document.activeElement as HTMLButtonElement);
                items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
                event.preventDefault();
              }}>
              {filter.multiple ? null : (
                <FilterOption key={ALL_OPTION} label={filter.allLabel ?? `全部${filter.title}`}
                  selected={!active} onSelect={() => chooseOne('')} />
              )}
              {matches.map((option) => filter.multiple ? (
                <label key={option.value} className="flex min-h-8 cursor-pointer items-center gap-2 rounded-ai-sm px-2 text-xs text-ai-fg hover:bg-ai-surface-2">
                  <Checkbox checked={selectedSet.has(option.value)} disabled={option.disabled} aria-label={option.label}
                    onCheckedChange={(checked) => onChange(checked
                      ? [...selected, option.value].join(',')
                      : selected.filter((entry) => entry !== option.value).join(','))} />
                  <span className="truncate">{option.label}</span>
                </label>
              ) : (
                <FilterOption key={option.value} label={option.label} selected={selectedSet.has(option.value)}
                  onSelect={() => chooseOne(option.value)} />
              ))}
              {matches.length === 0 ? (
                <p className="p-2 text-xs text-ai-fg-muted">{filter.emptyText ?? '无匹配项'}</p>
              ) : null}
            </div>
          </>
        )}
        {active ? (
          <div className="border-t border-ai-line p-1">
            <Button size="sm" variant="ghost" block onClick={clear} data-ai-id={filter.aiId ? `${filter.aiId}:reset` : undefined}>
              {labels?.clearFilter?.(filter.title) ?? '清除'}
            </Button>
          </div>
        ) : null}
      </div>
    </Popover>
  );
}

/**
 * One row in a single-select filter.
 *
 * A button rather than a Radix select item: the list lives in the popover the reader
 * already opened, so it only has to report the choice.
 */
function FilterOption({ label, selected, onSelect }: {
  label: string; selected: boolean; onSelect: () => void;
}): React.ReactElement {
  return (
    <button type="button" role="option" aria-selected={selected} onClick={onSelect}
      className={cn(
        'flex min-h-8 items-center gap-2 rounded-ai-sm px-2 text-left text-xs transition-colors duration-ai-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring',
        selected ? 'text-ai-accent' : 'text-ai-fg hover:bg-ai-surface-2',
      )}>
      <span className="flex size-3 shrink-0 items-center justify-center">
        {selected ? <Icon name="check" size={12} /> : null}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
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
  refreshing = false,
  errorContent,
  filters,
  onFiltersChange,
  searchValue,
  onSearchChange,
  onRefresh,
  selectedKeys = [],
  onSelectionChange,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onAction,
  onBulkAction,
  visibleColumnKeys,
  onVisibleColumnsChange,
  className,
}: ResourceListProps<TRow>): React.ReactElement {
  /*
   * Is the reader narrowing the list right now? An empty result then means "nothing matches",
   * not "nothing exists" -- two different answers.
   *
   * Inferred from the search box only: `filters` carries the page's scope on many lists, and a
   * scope is not a narrowing. Pages that narrow by a filter pass `schema.narrowed`.
   */
  const narrowed = schema.narrowed ?? Boolean(searchValue?.trim());

  const keyOf = React.useCallback(
    (row: TRow, index: number): string =>
      typeof schema.rowKey === 'function'
        ? schema.rowKey(row)
        : String(getByPath(row, String(schema.rowKey)) ?? index),
    [schema.rowKey],
  );

  const [pendingConfirm, setPendingConfirm] = React.useState<{
    title: string;
    tone?: ListAction<TRow>['tone'];
    run: () => void;
  } | null>(null);

  const askConfirm = React.useCallback(
    (action: Pick<ListAction<TRow>, 'confirm' | 'tone'>, run: () => void) => {
      if (!action.confirm) {
        run();
        return;
      }
      setPendingConfirm({ title: action.confirm, tone: action.tone, run });
    },
    [],
  );

  const columns: Array<TableColumn<TRow>> = React.useMemo(() => {
    const sortableKeys = new Set(schema.sortableKeys ?? []);
    /*
     * Which business columns may actually pin.
     *
     * Only the first `start` and the last `end` are honoured: offsets are not
     * accumulated, so a second pinned column on the same side would sit exactly on
     * top of the first. A pinned column without a declared width is dropped too — it
     * would change width as content changes, and the pin then reads as a glitch.
     * Both cases warn rather than fail silently, because a configuration that looks
     * applied but does nothing is worse than an obvious error.
     */
    const pinStartKey = schema.columns.find((column) => column.pin === 'start')?.key;
    const pinEndKey = [...schema.columns].reverse().find((column) => column.pin === 'end')?.key;
    const resolvedPin = (column: ListColumn<TRow>): 'start' | 'end' | undefined => {
      if (!column.pin) return undefined;
      const isHonoured = column.pin === 'start' ? column.key === pinStartKey : column.key === pinEndKey;
      if (!isHonoured) {
        warnOnce(`pinned-extra:${column.key}`,
          `[ResourceList] column "${column.key}" is pinned but only the first start and last end are honoured; ignoring.`);
        return undefined;
      }
      if (column.width === undefined) {
        warnOnce(`pinned-width:${column.key}`,
          `[ResourceList] column "${column.key}" is pinned without a width; it would shift while scrolling. Ignoring the pin.`);
        return undefined;
      }
      return column.pin;
    };

    const mapped: Array<TableColumn<TRow>> = schema.columns
      // A pinned column is an anchor, so it survives a stale `visibleColumnKeys`
      // that predates the pin — otherwise an old saved selection silently removes
      // the very column the reader scrolls back to.
      .filter((column) => column.pin || !column.hideable || !visibleColumnKeys || visibleColumnKeys.includes(column.key))
      .map((column) => {
      /*
       * The filter declared for this column, if any.
       *
       * Rendered inside the header rather than in the toolbar: a field's own filter
       * belongs where the field is. The toolbar keeps the controls that are not a
       * field — the row search, the project scope, the time range.
       */
      const columnFilterEntry = schema.filters?.find((filter) => filter.column === column.key);
      const columnFilter = columnFilterEntry
        ? <ColumnFilter filter={columnFilterEntry} value={filters?.[columnFilterEntry.key] ?? ''}
            onChange={(next) => onFiltersChange?.({ ...filters, [columnFilterEntry.key]: next })}
            labels={schema.labels} />
        : undefined;
      return {
      key: column.key,
      title: column.title,
      width: column.width,
      align: column.align,
      sortable: sortableKeys.has(column.key),
      ...(column.hint === undefined ? {} : { hint: column.hint }),
      ...(column.hintLabel === undefined ? {} : { hintLabel: column.hintLabel }),
      ...(resolvedPin(column) ? { pin: resolvedPin(column) } : {}),
      // `<column key>:sort` matches the convention the page objects and the agent
      // manifest already use (`configmaps:sort:name`).
      ...(sortableKeys.has(column.key) && schema.sortAiPrefix
        ? { sortAiId: `${schema.sortAiPrefix}:sort:${column.key}` }
        : {}),
      ...(columnFilter ? { filter: columnFilter } : {}),
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
      };
      });

    if (schema.rowActions?.length) {
      mapped.push({
        key: '__actions',
        title: '',
        width: 48,
        align: 'right',
        /*
         * Pinned to the right edge: the row's actions are the other half of its
         * identity. On a wide table a reader who has scrolled past the metrics must
         * still be able to act on the row without scrolling back.
         */
        pin: 'end',
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
                aiId: action.aiId,
                onSelect: () => {
                  askConfirm(action, () => onAction?.(action.key, row));
                },
              }))}
            />
          );
        },
      });
    }

    return mapped;
  }, [schema.columns, schema.sortableKeys, schema.rowActions, schema.labels, onAction, askConfirm, visibleColumnKeys]);

  //
  // A column chooser is a toolbar control, so a list with no search, filters or refresh still
  // needs the toolbar row to hold it — otherwise wiring `columnVisibility` on such a page does
  // nothing at all (the chooser never renders). Found on the store-management tables.
  const hasToolbar = Boolean(
    schema.search || schema.filters?.length || (schema.refresh && onRefresh) || schema.columnVisibility,
  );

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
          {schema.filters?.filter((filter) => filter.column === undefined).map((filter) => (
            <div key={filter.key} className="flex items-center gap-1">
            {filter.type === 'text' ? <InputSearch hideButton type="text" role="textbox" className={filter.widthClass ?? 'w-40'} value={filters?.[filter.key] ?? ''}
              aria-label={filter.title} placeholder={filter.title} data-ai-id={filter.aiId}
              clearLabel={schema.labels?.clearFilter?.(filter.title)}
              clearAiId={filter.aiId ? `${filter.aiId}:clear` : undefined}
              onChange={(value) => onFiltersChange?.({ ...filters, [filter.key]: value })} /> :
            filter.multiple ? <MultiSelect options={filter.options ?? []}
              value={(filters?.[filter.key] ?? '').split(',').filter(Boolean)}
              onValueChange={(values) => onFiltersChange?.({ ...filters, [filter.key]: values.join(',') })}
              placeholder={filter.title} clearLabel={schema.labels?.clearFilter?.(filter.title) ?? filter.title}
              searchLabel={filter.searchable ? filter.title : undefined} emptyText={filter.emptyText}
              data-ai-id={filter.aiId} className={filter.widthClass ?? 'w-40'} /> :
            <Select
              key={filter.key}
              className={cn('shrink-0', filter.widthClass ?? 'w-40')}
              aria-label={filter.title}
              placeholder={filter.title}
              value={filters?.[filter.key] || ALL_OPTION}
              onValueChange={(value) =>
                onFiltersChange?.({ ...filters, [filter.key]: value === ALL_OPTION ? '' : value })
              }
              {...(filter.aiId ? { 'data-ai-id': filter.aiId } : {})}
              options={[{ value: ALL_OPTION, label: filter.allLabel ?? `全部${filter.title}` }, ...(filter.options ?? [])]}
              {...(filter.searchable ? { searchable: true } : {})}
              {...(filter.emptyText ? { emptyText: filter.emptyText } : {})}
            />}
            {filter.type !== 'text' && filters?.[filter.key] && schema.labels?.clearFilter ? <Button size="icon" variant="ghost"
              aria-label={schema.labels.clearFilter(filter.title)} data-ai-id={filter.aiId ? `${filter.aiId}:clear` : undefined}
              onClick={() => onFiltersChange?.({ ...filters, [filter.key]: '' })}>
              <span aria-hidden="true">x</span>
            </Button> : null}
            </div>
          ))}
          {schema.search ? (
            <InputSearch hideButton
              // Full width on a phone so the search field is reachable; a fixed
              // 224px box pushed the action buttons onto a second line.
              className="w-full sm:w-64"
              value={searchValue ?? ''}
              placeholder={schema.search.placeholder ?? '搜索'}
              aria-label={schema.search.placeholder ?? '搜索'}
              {...(schema.search.aiId ? { 'data-ai-id': schema.search.aiId } : {})}
              onChange={(value) => onSearchChange?.(value)}
              clearLabel={schema.labels?.clearSearch}
              clearAiId={schema.search.aiId ? `${schema.search.aiId}:clear` : undefined}
            />
          ) : null}
          {schema.columnVisibility && onVisibleColumnsChange ? <Dropdown closeOnSelect={false}
            tooltip={schema.columnVisibility.label}
            trigger={
              /*
               * An icon, not the label.
               *
               * The toolbar carries a search box, a project selector and a refresh
               * button; a text button here was the widest control on the row for the
               * least frequent action. The label stays as the accessible name and the
               * tooltip, so nothing is lost for a screen reader or for a reader who
               * does not recognise the glyph.
               */
              <Button size="icon" variant="secondary" data-ai-id={schema.columnVisibility.aiId}
                aria-label={schema.columnVisibility.label}>
                <Icon name="column" size={16} />
              </Button>
            }
            items={[
              ...schema.columns.filter((column) => column.hideable).map((column) => ({
                key: column.key, label: column.title, aiId: `${schema.columnVisibility?.aiId}:${column.key}`,
                checked: !visibleColumnKeys || visibleColumnKeys.includes(column.key),
                onSelect: () => {
                  const keys = visibleColumnKeys ?? schema.columns.map((entry) => entry.key);
                  onVisibleColumnsChange(keys.includes(column.key) ? keys.filter((key) => key !== column.key) : [...keys, column.key]);
                },
              })),
              { key: '__reset', label: schema.columnVisibility.resetLabel, dividerBefore: true,
                aiId: `${schema.columnVisibility.aiId}:reset`, onSelect: () => onVisibleColumnsChange(schema.columns.map((column) => column.key)) },
            ]} /> : null}

          {/*
           * Refresh sits after the search box, where the old console puts it: next to
           * the controls that shape the current view, not among the actions that change
           * the data.
           */}
          {schema.refresh && onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={schema.refresh.busy}
              aria-busy={schema.refresh.busy ?? false}
              aria-label={schema.refresh.label}
              title={schema.refresh.label}
              className={cn(
                'inline-flex size-9 shrink-0 items-center justify-center rounded-ai-md border border-ai-line text-ai-fg-secondary transition-colors duration-ai-fast hover:bg-ai-surface-2 hover:text-ai-fg disabled:opacity-50',
              )}
              {...(schema.refresh.aiId ? { 'data-ai-id': schema.refresh.aiId } : {})}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className={cn('size-4', schema.refresh.busy && 'animate-spin motion-reduce:animate-none')}>
                <path d="M20 11a8 8 0 1 0-2.3 5.7" />
                <path d="M20 4v7h-7" />
              </svg>
            </button>
          ) : null}

          {/*
           * "Clear all" sits after the refresh button, at the end of the view-shaping
           * cluster.
           *
           * It used to sit before the search box, which made every filter appear to
           * shift the search field and everything after it: the control only exists
           * while something is filtered, so its appearance moved the box the reader
           * was about to type into. At the end it grows into the gap before the bulk
           * actions, and nothing that is always present moves.
           */}
          {schema.labels?.clearFilters && (searchValue || Object.values(filters ?? {}).some(Boolean)) ?
            <Button size="sm" variant="ghost" data-ai-id={schema.sortAiPrefix ? `${schema.sortAiPrefix}:filters-clear` : undefined}
              onClick={() => { onSearchChange?.(''); onFiltersChange?.({}); }}>{schema.labels.clearFilters}</Button> : null}

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
                      askConfirm(action, () => onBulkAction?.(action.key, selectedKeys));
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
              <>
                {primaryAction.disabled && primaryAction.disabledHint ? (
                  <span
                    className="max-w-[22rem] text-right text-xs text-ai-fg-muted"
                    {...(primaryAction.aiId ? { 'data-ai-id': `${primaryAction.aiId}:disabled-hint` } : {})}
                  >
                    {primaryAction.disabledHint}
                  </span>
                ) : null}
                <Button
                  size="md"
                  variant="primary"
                  className="px-3 sm:min-h-0"
                  disabled={primaryAction.disabled === true}
                  title={typeof primaryAction.disabledHint === 'string' ? primaryAction.disabledHint : undefined}
                  onClick={() => {
                    if (primaryAction.disabled) return;
                    onAction?.(primaryAction.key, undefined as unknown as TRow);
                  }}
                  {...(primaryAction.aiId ? { 'data-ai-id': primaryAction.aiId } : {})}
                >
                  {primaryAction.label}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {errorContent != null ? errorContent : <Table
        columns={columns}
        rows={rows}
        rowKey={keyOf}
        loading={loading}
        refreshing={refreshing}
        {...(schema.rowAttributes ? { rowAttributes: schema.rowAttributes } : {})}
        {...(schema.sort ? { sorter: { key: schema.sort.key, order: schema.sort.order } satisfies TableSortState } : {})}
        {...(schema.sortFallback ? { sortFallback: schema.sortFallback } : {})}
        {...(schema.sortableKeys?.length
          ? {
              // The cycle lives in `Table` so every host behaves the same: a new
              // column starts ascending, an active one advances, and turning it off
              // returns `sortFallback`.
              onSortChange: (next: TableSortState) => onSortChange?.(next),
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
            title={narrowed ? schema.empty?.noMatchTitle ?? '没有匹配的结果' : schema.empty?.title ?? '暂无数据'}
            description={narrowed ? schema.empty?.noMatchDescription : schema.empty?.description}
            action={
              onSearchChange || onFiltersChange || onRefresh || (primaryAction && !primaryAction.disabled) ? (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {/* An empty list is exactly where a create button earns its place: the header one is
                      easy to miss when the table body is what drew the eye. */}
                  {primaryAction && !primaryAction.disabled ? (
                    <Button
                      size="sm"
                      variant="primary"
                      data-ai-id="empty-state:primary"
                      onClick={() => onAction?.(primaryAction.key, undefined as unknown as TRow)}
                    >
                      {primaryAction.label}
                    </Button>
                  ) : null}
                  {onSearchChange || onFiltersChange ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      data-ai-id="empty-state:clear"
                      onClick={() => {
                        onSearchChange?.('');
                        onFiltersChange?.({});
                      }}
                    >
                      {schema.labels?.emptyClear ?? '清空搜索与筛选'}
                    </Button>
                  ) : null}
                  {onRefresh ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      data-ai-id="empty-state:refresh"
                      onClick={onRefresh}
                    >
                      {schema.refresh?.label ?? schema.labels?.emptyRefresh ?? '刷新'}
                    </Button>
                  ) : null}
                </div>
              ) : undefined
            }
          />
        }
      />}

      {errorContent == null && schema.pagination && onPageChange ? (
        <Pagination
          // Same prefix as the rows and sort buttons, so the pager belongs to the list.
          {...(schema.sortAiPrefix ? { aiPrefix: schema.sortAiPrefix } : {})}
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
                  ...(schema.labels.pageSize ? { pageSize: schema.labels.pageSize } : {}),
                  ...(schema.labels.pageSizeSuffix ? { pageSizeSuffix: schema.labels.pageSizeSuffix } : {}),
                },
              }
            : {})}
        />
      ) : null}

      <Modal
        open={pendingConfirm != null}
        onOpenChange={(open) => {
          if (!open) setPendingConfirm(null);
        }}
        title={pendingConfirm?.title ?? ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingConfirm(null)}>
              {schema.labels?.confirmCancel ?? '取消'}
            </Button>
            <Button
              variant={pendingConfirm?.tone === 'danger' ? 'danger' : 'primary'}
              onClick={() => {
                const run = pendingConfirm?.run;
                setPendingConfirm(null);
                run?.();
              }}
            >
              {schema.labels?.confirmOk ?? '确认'}
            </Button>
          </>
        }
      />
    </div>
  );
}

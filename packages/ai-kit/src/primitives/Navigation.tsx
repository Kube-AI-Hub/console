import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '../utils/cn';

/* ---------------- Tabs ---------------- */

export interface TabItem {
  value: string;
  label: React.ReactNode;
  /** Optional count shown after the label. */
  count?: number;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function Tabs({ items, value, defaultValue, onValueChange, className }: TabsProps): React.ReactElement {
  return (
    <TabsPrimitive.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange} className={className}>
      <TabsPrimitive.List className="flex gap-1 border-b border-ai-line">
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-ai-fg-muted',
              'transition-colors duration-ai-fast hover:text-ai-fg',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent after:transition-colors after:duration-ai-base',
              'data-[state=active]:text-ai-accent data-[state=active]:after:bg-ai-accent',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ai-bg',
            )}
          >
            {item.label}
            {typeof item.count === 'number' ? (
              <span className="rounded-ai-pill bg-ai-surface-3 px-1.5 text-[10px] leading-4 text-ai-fg-muted">
                {item.count}
              </span>
            ) : null}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}

export const TabsContent = TabsPrimitive.Content;

/* ---------------- Accordion (also used as Collapse) ---------------- */

export interface AccordionItem {
  value: string;
  title: React.ReactNode;
  content: React.ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** Allow several sections open at once. */
  multiple?: boolean;
  defaultValue?: string[];
  className?: string;
}

export function Accordion({ items, multiple = false, defaultValue, className }: AccordionProps): React.ReactElement {
  const rootClassName = cn('flex flex-col divide-y divide-ai-line rounded-ai-md border border-ai-line', className);

  const body = items.map((item) => (
    <AccordionPrimitive.Item key={item.value} value={item.value} className="px-3">
      <AccordionPrimitive.Header>
        <AccordionPrimitive.Trigger
          className={cn(
            'group flex w-full items-center justify-between gap-2 py-2.5 text-left text-xs font-medium text-ai-fg-secondary',
            'transition-colors duration-ai-fast hover:text-ai-fg',
          )}
        >
          {item.title}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="size-3.5 shrink-0 text-ai-fg-muted transition-transform duration-ai-base ease-ai-out group-data-[state=open]:rotate-180"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className="overflow-hidden pb-2.5 text-xs leading-5 text-ai-fg-muted">
        {item.content}
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  ));

  // Radix models single and multiple as distinct prop shapes, so the two
  // branches are rendered explicitly rather than through a shared props object
  // whose union type would widen defaultValue to `string | string[]`.
  return multiple ? (
    <AccordionPrimitive.Root type="multiple" defaultValue={defaultValue} className={rootClassName}>
      {body}
    </AccordionPrimitive.Root>
  ) : (
    <AccordionPrimitive.Root type="single" collapsible defaultValue={defaultValue?.[0]} className={rootClassName}>
      {body}
    </AccordionPrimitive.Root>
  );
}

/* ---------------- Dropdown ---------------- */

export interface DropdownItem {
  key: string;
  label: React.ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  /**
   * Marks a choice as current.
   *
   * Used by the language switcher: the menu stays a menu, but the reader can see
   * which option is active without guessing from the page's language.
   */
  checked?: boolean;
  /** Renders a separator above this item. */
  dividerBefore?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactElement;
  items: DropdownItem[];
  align?: 'start' | 'center' | 'end';
  /** Controlled open state; leave undefined to let the menu manage itself. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Close after an item is chosen; defaults to true. */
  closeOnSelect?: boolean;
}

export function Dropdown({
  trigger,
  items,
  align = 'end',
  open,
  onOpenChange,
  closeOnSelect = true,
}: DropdownProps): React.ReactElement {
  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align}
          sideOffset={6}
          className="z-50 min-w-44 rounded-ai-md border border-ai-line bg-ai-bg-overlay p-1 shadow-ai-pop animate-ai-scale-in"
        >
          {items.map((item) => (
            <React.Fragment key={item.key}>
              {item.dividerBefore ? <DropdownMenuPrimitive.Separator className="my-1 h-px bg-ai-line" /> : null}
              <DropdownMenuPrimitive.Item
                disabled={item.disabled}
                onSelect={(event) => {
                  // Radix closes on select by default; keep the menu open when
                  // the host wants to run a multi-step action from one visit.
                  if (!closeOnSelect) event.preventDefault();
                  item.onSelect?.();
                }}
                className={cn(
                  'flex cursor-pointer select-none items-center gap-2 rounded-ai-sm px-2 py-1.5 text-xs outline-none',
                  'transition-colors duration-ai-fast',
                  item.danger
                    ? 'text-ai-danger data-[highlighted]:bg-ai-danger/10'
                    : item.checked
                      ? 'text-ai-accent data-[highlighted]:bg-ai-surface-2'
                      : 'text-ai-fg-secondary data-[highlighted]:bg-ai-surface-2 data-[highlighted]:text-ai-fg',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                )}
              >
                <span className="truncate">{item.label}</span>
                {/*
                 * The check sits at the far right, which is where the eye looks
                 * for a current selection. It is always rendered, only made
                 * invisible when unchecked: dropping it from the DOM would change
                 * the row's width and shift every label sideways as the choice
                 * moves.
                 */}
                <svg
                  viewBox="0 0 24 24"
                  className={cn('ml-auto size-3.5 shrink-0', item.checked ? 'visible' : 'invisible')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  aria-hidden="true"
                >
                  <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </DropdownMenuPrimitive.Item>
            </React.Fragment>
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

/* ---------------- Breadcrumb ---------------- */

export interface BreadcrumbItem {
  label: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps): React.ReactElement {
  return (
    <nav aria-label="面包屑" className={cn('flex items-center gap-1 text-xs', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            {index > 0 ? <span className="text-ai-fg-faint" aria-hidden="true">/</span> : null}
            {isLast ? (
              <span aria-current="page" className="text-ai-fg">{item.label}</span>
            ) : (
              <button
                type="button"
                onClick={item.onClick}
                className="text-ai-fg-muted transition-colors duration-ai-fast hover:text-ai-accent"
              >
                {item.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/* ---------------- Pagination ---------------- */

/**
 * Text the pagination controls announce.
 *
 * Defaults are Chinese because that is the product's primary language; a host
 * that offers its own language switcher passes translated strings so an English
 * reader is not told "上一页" by their screen reader.
 */
export interface PaginationLabels {
  previous: string;
  next: string;
  /** "1-10 of 3487"; both numbers are interpolated. */
  range?: (from: number, to: number, total: number) => string;
  /** Accessible name for the page selector. */
  goToPage?: string;
  /** Label for the "jump to page" input. */
  jumpTo?: string;
}

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  /**
   * Rows per page, when the caller offers a choice.
   *
   * Given both this and `onPageSizeChange`, a size picker appears. A cursor-paged
   * list cannot honour an arbitrary jump, so it simply omits them.
   */
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  /**
   * How pages can be reached.
   *
   * `numbered` renders clickable page numbers and a jump field, which suits
   * offset-paged APIs. `sequential` renders only prev/next plus a counter, for
   * cursor-paged collections where page N is unreachable without walking every
   * cursor before it — offering numbers there would be offering dead controls.
   */
  mode?: 'numbered' | 'sequential';
  className?: string;
  labels?: Partial<PaginationLabels>;
}

const DEFAULT_PAGINATION_LABELS: PaginationLabels = {
  previous: '上一页',
  next: '下一页',
  range: (from, to, total) => `第 ${from}-${to} 条，共 ${total} 条`,
  goToPage: '选择页码',
  jumpTo: '跳至',
};

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

/**
 * Page numbers to render, with gaps folded into an ellipsis.
 *
 * A 349-page list cannot render every number, and a window that jumps to a
 * truncated list as the reader moves is disorienting; showing the first, last and
 * a few around the current page is the shape people already read.
 */
function pageWindow(page: number, pageCount: number): Array<number | 'gap'> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  // Keep the window stable at the edges: a bare "1 … 2 3 4" wastes the slot.
  if (page <= 3) [2, 3, 4].forEach((value) => pages.add(value));
  if (page >= pageCount - 2) [pageCount - 1, pageCount - 2, pageCount - 3].forEach((value) => pages.add(value));

  const sorted = [...pages].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  const result: Array<number | 'gap'> = [];
  let previous = 0;
  for (const value of sorted) {
    if (previous && value - previous > 1) result.push('gap');
    result.push(value);
    previous = value;
  }
  return result;
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  mode = 'numbered',
  className,
  labels,
}: PaginationProps): React.ReactElement {
  const text = { ...DEFAULT_PAGINATION_LABELS, ...labels };
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const [jumpValue, setJumpValue] = React.useState('');

  const goTo = (target: number): void => {
    // Clamp rather than ignore: a typed "999" on a 3-page list should land on the
    // last page, not look broken.
    const next = Math.min(Math.max(1, Math.trunc(target) || 1), pageCount);
    if (next !== page) onChange(next);
  };

  /** Accepts "12" as well as "12/349", which is what people paste. */
  const submitJump = (): void => {
    const parsed = Number.parseInt(jumpValue.split('/')[0]?.trim() ?? '', 10);
    setJumpValue('');
    if (Number.isFinite(parsed)) goTo(parsed);
  };

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 text-xs text-ai-fg-muted', className)}>
      <div className="flex items-center gap-3">
        <span>{text.range?.(from, to, total)}</span>
        {onPageSizeChange ? (
          <label className="flex items-center gap-1">
            <select
              className="h-7 rounded-ai-sm border border-ai-line bg-ai-surface-1 px-1.5 text-xs text-ai-fg-secondary"
              value={pageSize}
              aria-label={text.jumpTo}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>/ 页</span>
          </label>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        <PageButton label={text.previous} disabled={page <= 1} onClick={() => onChange(page - 1)} direction="prev" />

        {/*
         * Explicit page buttons, not a "x / y" counter: with hundreds of pages the
         * reader needs to land somewhere specific, and prev/next alone means
         * dozens of clicks. Only for offset-paged lists; see `mode`.
         */}
        {mode === 'numbered' ? (
        <nav aria-label={text.goToPage} className="hidden items-center gap-0.5 sm:flex">
          {pageWindow(page, pageCount).map((entry, index) =>
            entry === 'gap' ? (
              <span key={`gap-${index}`} className="px-1 text-ai-fg-faint" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                aria-current={entry === page ? 'page' : undefined}
                aria-label={`${text.goToPage} ${entry}`}
                onClick={() => goTo(entry)}
                className={cn(
                  'grid size-7 place-items-center rounded-ai-sm text-xs tabular-nums transition-colors duration-ai-fast',
                  entry === page
                    ? 'bg-ai-accent-soft font-medium text-ai-accent'
                    : 'text-ai-fg-secondary hover:bg-ai-surface-2 hover:text-ai-fg',
                )}
              >
                {entry}
              </button>
            ),
          )}
        </nav>
        ) : (
          <span className="px-2 tabular-nums text-ai-fg-secondary">
            {page} / {pageCount}
          </span>
        )}

        {/* Phone: the numbers do not fit, so a typeable page field takes their place. */}
        {mode === 'numbered' ? (
          <span className="flex items-center gap-1 sm:hidden">
            <input
              className="h-7 w-12 rounded-ai-sm border border-ai-line bg-ai-surface-1 px-1.5 text-center text-xs tabular-nums text-ai-fg-secondary"
              inputMode="numeric"
              aria-label={text.jumpTo}
              placeholder={String(page)}
              value={jumpValue}
              onChange={(event) => setJumpValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitJump();
              }}
              onBlur={submitJump}
            />
            <span className="tabular-nums">/ {pageCount}</span>
          </span>
        ) : null}

        <PageButton label={text.next} disabled={page >= pageCount} onClick={() => onChange(page + 1)} direction="next" />
      </div>
    </div>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  direction,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  direction: 'prev' | 'next';
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid size-11 place-items-center rounded-ai-sm border border-ai-line text-ai-fg-secondary sm:size-7',
        'transition-colors duration-ai-fast hover:border-ai-line-strong hover:bg-ai-surface-2 hover:text-ai-fg',
        'disabled:pointer-events-none disabled:opacity-40',
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5">
        <path d={direction === 'prev' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
      </svg>
    </button>
  );
}

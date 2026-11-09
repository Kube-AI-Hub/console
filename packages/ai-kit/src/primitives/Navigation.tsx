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
          className="z-50 min-w-40 rounded-ai-md border border-ai-line bg-ai-bg-overlay p-1 shadow-ai-pop animate-ai-scale-in"
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
                  'flex cursor-pointer select-none items-center rounded-ai-sm px-2 py-1.5 text-xs outline-none',
                  'transition-colors duration-ai-fast',
                  item.danger
                    ? 'text-ai-danger data-[highlighted]:bg-ai-danger/10'
                    : 'text-ai-fg-secondary data-[highlighted]:bg-ai-surface-2 data-[highlighted]:text-ai-fg',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                )}
              >
                {item.label}
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

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, pageSize, total, onChange, className }: PaginationProps): React.ReactElement {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className={cn('flex items-center justify-between gap-3 text-xs text-ai-fg-muted', className)}>
      <span>第 {from}-{to} 条，共 {total} 条</span>
      <div className="flex items-center gap-1">
        <PageButton label="上一页" disabled={page <= 1} onClick={() => onChange(page - 1)} direction="prev" />
        <span className="px-2 tabular-nums text-ai-fg-secondary">{page} / {pageCount}</span>
        <PageButton label="下一页" disabled={page >= pageCount} onClick={() => onChange(page + 1)} direction="next" />
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
        'grid size-7 place-items-center rounded-ai-sm border border-ai-line text-ai-fg-secondary',
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

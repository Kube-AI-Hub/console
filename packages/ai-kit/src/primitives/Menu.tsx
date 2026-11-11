import * as React from 'react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { cn } from '../utils/cn';

/**
 * Sidebar navigation.
 *
 * A nested list with one expandable level, which is what console's left rail
 * actually needs. Deliberately not a menu widget: `role="menu"` implies roving
 * focus and keyboard arrow semantics for a command list, while this is
 * navigation, so links keep their natural tab order.
 */

export interface MenuNode {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Leaf navigation target. Groups omit it. */
  href?: string;
  onClick?: () => void;
  children?: MenuNode[];
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface MenuProps {
  items: MenuNode[];
  /** Currently active leaf key. */
  activeKey?: string;
  /** Hidden by default; groups containing the active leaf open automatically. */
  defaultOpenKeys?: string[];
  /** Collapse to icon-only rail. */
  collapsed?: boolean;
  /**
   * Router navigation for a link node, replacing the browser's default.
   *
   * An `<a href>` always costs a full document load, which for this console means
   * re-fetching every chunk and re-running the session check — measured at ~1.5 MB
   * of JS and a visible blank frame on each click between resource pages. Pass
   * the router's own click handler here to keep the SPA alive.
   *
   * Receives the href and the originating click so the host can decide (a
   * modified click, a different origin or a `target` still belongs to the
   * browser). Returning `true` means "handled"; `false` falls through to the
   * browser's default navigation.
   *
   * Kept as a prop rather than an `<Link>` element so this package stays free of
   * router imports (its contract: no routing).
   */
  onNavigate?: (href: string, event: React.MouseEvent<HTMLAnchorElement>) => boolean;
  className?: string;
  'aria-label'?: string;
}

function containsKey(node: MenuNode, key: string): boolean {
  if (node.key === key) return true;
  return (node.children ?? []).some((child) => containsKey(child, key));
}

export function Menu({
  items,
  activeKey,
  defaultOpenKeys,
  collapsed = false,
  onNavigate,
  className,
  ...aria
}: MenuProps): React.ReactElement {
  // Groups that contain the active leaf must be open, otherwise the user loses
  // their place after a refresh.
  const derivedOpen = React.useMemo(
    () => items.filter((item) => item.children?.length && activeKey && containsKey(item, activeKey)).map((item) => item.key),
    [items, activeKey],
  );
  const [openKeys, setOpenKeys] = React.useState<string[]>(defaultOpenKeys ?? derivedOpen);

  React.useEffect(() => {
    if (!derivedOpen.length) return;
    setOpenKeys((current) => [...new Set([...current, ...derivedOpen])]);
  }, [derivedOpen]);

  const toggle = (key: string) => {
    setOpenKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  };

  const renderLeaf = (node: MenuNode, depth: number): React.ReactElement => {
    const active = node.key === activeKey;
    const content = (
      <>
        {node.icon ? <span className="grid size-4 shrink-0 place-items-center" aria-hidden="true">{node.icon}</span> : null}
        {!collapsed ? <span className="min-w-0 flex-1 truncate">{node.label}</span> : null}
        {!collapsed && node.badge ? <span className="shrink-0">{node.badge}</span> : null}
      </>
    );
    const classes = cn(
      // 13px: 12px was too small for CJK, whose strokes need more vertical room
      // to stay legible at this density.
      'flex w-full items-center gap-2 rounded-ai-md py-1.5 text-[13px] leading-5 transition-colors duration-ai-fast',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring focus-visible:ring-inset',
      collapsed ? 'justify-center px-2' : 'pl-2 pr-2',
      active
        ? 'bg-ai-accent/12 font-medium text-ai-accent'
        : 'text-ai-fg-muted hover:bg-ai-surface-2 hover:text-ai-fg',
      node.disabled && 'pointer-events-none opacity-50',
    );

    // Nested levels indent by the same 16px as the icon slot plus the 8px gap,
    // so a child's text lines up under its parent's text rather than under the
    // chevron. Previously `px-2` and an inline `paddingLeft` were both applied,
    // which made every level drift 8px further right.
    const indent = collapsed ? undefined : depth > 0 ? { paddingLeft: 8 + depth * 16 } : undefined;

    if (node.href) {
      return (
        <a
          href={node.disabled ? undefined : node.href}
          aria-current={active ? 'page' : undefined}
          title={collapsed ? String(node.label) : undefined}
          className={classes}
          style={indent}
          onClick={(event) => {
            /*
             * Router first: a full document load re-downloads every chunk and
             * re-runs the session check, which is what made switching between
             * two resource pages feel like a page reload.
             */
            if (!node.disabled && onNavigate?.(node.href as string, event)) {
              event.preventDefault();
            }
            node.onClick?.();
          }}
        >
          {content}
        </a>
      );
    }
    return (
      <button type="button" aria-current={active ? 'page' : undefined} className={classes} style={indent} onClick={node.onClick}>
        {content}
      </button>
    );
  };

  const renderNode = (node: MenuNode, depth: number): React.ReactElement => {
    const hasChildren = Boolean(node.children?.length);
    if (!hasChildren) return <li key={node.key}>{renderLeaf(node, depth)}</li>;

    const open = openKeys.includes(node.key);
    // A group's icon keeps the children aligned with it: the trigger has the
    // same 16px icon slot and the same gap as a leaf.
    const groupIndent = collapsed ? undefined : depth > 0 ? { paddingLeft: 8 + depth * 16 } : undefined;
    return (
      <li key={node.key}>
        <CollapsiblePrimitive.Root open={open} onOpenChange={() => toggle(node.key)}>
          <CollapsiblePrimitive.Trigger
            className={cn(
              'group flex w-full items-center gap-2 rounded-ai-md py-1.5 text-[13px] font-medium leading-5 text-ai-fg-secondary',
              'transition-colors duration-ai-fast hover:bg-ai-surface-2 hover:text-ai-fg',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring focus-visible:ring-inset',
              collapsed ? 'justify-center px-2' : 'px-2',
            )}
            style={groupIndent}
            title={collapsed ? String(node.label) : undefined}
          >
            {node.icon ? <span className="grid size-4 shrink-0 place-items-center" aria-hidden="true">{node.icon}</span> : null}
            {!collapsed ? <span className="min-w-0 flex-1 truncate text-left">{node.label}</span> : null}
            {!collapsed ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={cn('size-3 shrink-0 text-ai-fg-faint transition-transform duration-ai-base ease-ai-out', open && 'rotate-90')}
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            ) : null}
          </CollapsiblePrimitive.Trigger>
          {!collapsed ? (
            <CollapsiblePrimitive.Content>
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {(node.children ?? []).map((child) => renderNode(child, depth + 1))}
              </ul>
            </CollapsiblePrimitive.Content>
          ) : null}
        </CollapsiblePrimitive.Root>
      </li>
    );
  };

  return (
    <nav {...aria} className={className}>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => renderNode(item, 0))}
      </ul>
    </nav>
  );
}

export interface CollapseProps {
  items: Array<{ key: string; title: React.ReactNode; content: React.ReactNode }>;
  defaultOpenKeys?: string[];
  accordion?: boolean;
  className?: string;
}

/**
 * Standalone disclosure list.
 *
 * `Accordion` already covers this shape; this alias exists because console's
 * existing pages import a component named `Collapse`, and renaming every call
 * site during a migration is churn without benefit.
 */
export function Collapse({ items, defaultOpenKeys, accordion = false, className }: CollapseProps): React.ReactElement {
  const [open, setOpen] = React.useState<string[]>(defaultOpenKeys ?? []);
  const isOpen = (key: string) => open.includes(key);
  const toggle = (key: string) => {
    setOpen((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key);
      return accordion ? [key] : [...current, key];
    });
  };

  return (
    <div className={cn('flex flex-col divide-y divide-ai-line rounded-ai-md border border-ai-line', className)}>
      {items.map((item) => (
        <CollapsiblePrimitive.Root key={item.key} open={isOpen(item.key)} onOpenChange={() => toggle(item.key)}>
          <CollapsiblePrimitive.Trigger
            className="group flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-medium text-ai-fg-secondary transition-colors duration-ai-fast hover:text-ai-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring focus-visible:ring-inset"
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
          </CollapsiblePrimitive.Trigger>
          <CollapsiblePrimitive.Content className="overflow-hidden px-3 pb-2.5 text-xs leading-5 text-ai-fg-muted">
            {item.content}
          </CollapsiblePrimitive.Content>
        </CollapsiblePrimitive.Root>
      ))}
    </div>
  );
}

import * as React from 'react';
import { cn } from '../utils/cn';

export interface TreeNode {
  key: string;
  label: React.ReactNode;
  children?: TreeNode[];
  disabled?: boolean;
}

export interface TreeProps {
  nodes: TreeNode[];
  /** Controlled expanded keys. */
  expandedKeys?: string[];
  onExpandedChange?: (keys: string[]) => void;
  selectedKey?: string;
  onSelect?: (key: string) => void;
  className?: string;
}

/**
 * Simple nested list tree.
 *
 * Expansion is controlled when `expandedKeys` is supplied, otherwise the tree
 * keeps its own state. Roving `aria-expanded` on the toggle keeps the structure
 * navigable by screen readers without implementing a full tree widget.
 */
export function Tree({
  nodes,
  expandedKeys,
  onExpandedChange,
  selectedKey,
  onSelect,
  className,
}: TreeProps): React.ReactElement {
  const [internal, setInternal] = React.useState<string[]>([]);
  const expanded = new Set(expandedKeys ?? internal);

  const toggle = (key: string) => {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const values = [...next];
    if (expandedKeys === undefined) setInternal(values);
    onExpandedChange?.(values);
  };

  const renderNodes = (list: TreeNode[], depth: number): React.ReactNode =>
    list.map((node) => {
      const hasChildren = Boolean(node.children?.length);
      const isOpen = expanded.has(node.key);
      return (
        <li key={node.key}>
          <div
            className={cn(
              'flex items-center gap-1 rounded-ai-sm py-1 pr-2 transition-colors duration-ai-fast',
              'hover:bg-ai-surface-2',
              selectedKey === node.key && 'bg-ai-accent/10',
            )}
            style={{ paddingLeft: depth * 12 + 4 }}
          >
            {hasChildren ? (
              <button
                type="button"
                aria-expanded={isOpen}
                aria-label={isOpen ? '收起' : '展开'}
                onClick={() => toggle(node.key)}
                className="grid size-4 shrink-0 place-items-center text-ai-fg-muted transition-transform duration-ai-base ease-ai-out"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={cn('size-3', isOpen && 'rotate-90')}
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            ) : (
              <span className="size-4 shrink-0" />
            )}
            <button
              type="button"
              disabled={node.disabled}
              onClick={() => onSelect?.(node.key)}
              className={cn(
                'min-w-0 flex-1 truncate text-left text-xs',
                selectedKey === node.key ? 'font-medium text-ai-accent' : 'text-ai-fg-secondary',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {node.label}
            </button>
          </div>
          {hasChildren && isOpen ? <ul>{renderNodes(node.children ?? [], depth + 1)}</ul> : null}
        </li>
      );
    });

  return (
    <ul role="tree" className={cn('flex flex-col', className)}>
      {renderNodes(nodes, 0)}
    </ul>
  );
}

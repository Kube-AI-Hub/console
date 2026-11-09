import * as React from 'react';
import { actionProps, type AiSurfaceState } from '@kube-ai-hub/ai-surface';

/**
 * `AiButton` — an ai-kit button that always carries an agent handle.
 *
 * The `aiId` prop is required, not optional. That is the whole point: a button
 * without a stable handle forces an agent to click by visible text, which breaks
 * on the next copy change or locale. Making it required means the omission is a
 * compile error rather than a bug found in production.
 */
export interface AiButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'data-ai-id'> {
  aiId: string;
  /** Actions that must run before this one; surfaced as `data-ai-needs`. */
  needs?: readonly string[];
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  /**
   * Rendered class overrides for controls that are buttons semantically but not
   * visually — a sortable table header, for instance. Keeping them on `AiButton`
   * means the agent handle is applied by construction instead of by convention.
   */
  bare?: boolean;
}

export const AiButton = React.forwardRef<HTMLButtonElement, AiButtonProps>(function AiButton(
  { aiId, needs, variant = 'secondary', size = 'md', bare = false, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={
        bare
          ? className
          : [buttonBase, buttonVariant[variant], buttonSize[size], className].filter(Boolean).join(' ')
      }
      {...rest}
      {...actionProps(aiId, needs === undefined ? {} : { needs })}
    >
      {children}
    </button>
  );
});

const buttonBase =
  'ai-pressable inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-ai-md font-medium ' +
  'transition-colors duration-ai-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-accent ' +
  'disabled:cursor-not-allowed disabled:opacity-50 min-h-11 sm:min-h-9';

/**
 * Sizes keep a 44px touch target below `sm` and the denser desktop height above.
 * A desktop-height button on a phone is the single most common miss in a list
 * toolbar, so the floor lives here rather than in each page.
 */
const buttonSize = {
  sm: 'px-3 text-xs',
  md: 'px-4 text-sm',
  lg: 'px-6 text-base min-h-11',
} as const;

const buttonVariant = {
  primary: 'bg-ai-accent text-ai-accent-fg hover:opacity-90',
  secondary: 'border border-ai-line bg-ai-surface-2 text-ai-fg hover:bg-ai-surface-3',
  ghost: 'text-ai-fg-secondary hover:bg-ai-surface-2 hover:text-ai-fg',
  danger: 'bg-ai-danger text-white hover:opacity-90',
} as const;

/**
 * `AiSurface` — the element that owns a region's state.
 *
 * An agent reads `data-ai-state` to decide whether the region is usable. It is
 * set on a real element (not the document) so several regions can report
 * independently.
 */
export interface AiSurfaceProps extends React.HTMLAttributes<HTMLElement> {
  aiId: string;
  state: AiSurfaceState;
  as?: 'div' | 'section' | 'main';
}

export function AiSurface({ aiId, state, as = 'div', className, children, ...rest }: AiSurfaceProps) {
  const Tag = as;
  return (
    <Tag
      className={className}
      aria-busy={state === 'loading' ? true : undefined}
      {...rest}
      data-ai-id={aiId}
      data-ai-state={state}
    >
      {children}
    </Tag>
  );
}

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const buttonVariants = cva(
  [
    'ai-pressable inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-ai-md text-sm font-medium',
    // Transition the shadow and transform too, not just colour: the hover state
    // now moves the button, and a colour-only transition would snap.
    'transition-[background-color,border-color,color,box-shadow,transform] duration-ai-base ease-ai-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ai-bg',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        // Primary carries an accent-tinted glow on hover, the same device the
        // cards use, so a click target reads as the brightest thing on screen.
        primary: [
          'bg-ai-accent text-ai-accent-fg',
          'hover:bg-ai-accent-hover hover:-translate-y-px',
          'hover:shadow-[0_8px_20px_-8px_rgb(var(--ai-accent)/0.7)]',
          'active:translate-y-0 active:shadow-none',
        ].join(' '),
        secondary: [
          'border border-ai-line bg-ai-surface-2 text-ai-fg',
          'hover:bg-ai-surface-3 hover:border-ai-line-strong hover:-translate-y-px',
          'hover:shadow-[0_6px_16px_-10px_rgb(0_0_0/0.5)]',
          'active:translate-y-0 active:shadow-none',
        ].join(' '),
        ghost: 'bg-transparent text-ai-fg-secondary hover:bg-ai-surface-2 hover:text-ai-fg',
        danger: [
          'bg-ai-danger text-ai-danger-fg',
          'hover:brightness-110 hover:-translate-y-px',
          'hover:shadow-[0_8px_20px_-8px_rgb(var(--ai-danger)/0.7)]',
          'active:translate-y-0 active:shadow-none',
        ].join(' '),
        link: 'bg-transparent text-ai-accent underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4',
        lg: 'h-11 px-6 text-base',
        icon: 'size-9 p-0',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the child element instead of a `<button>` (e.g. an anchor). */
  asChild?: boolean;
  /** Show a spinner and block interaction. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild = false, loading = false, disabled, children, ...props },
  ref,
) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      ref={ref}
      data-loading={loading ? 'true' : undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </Component>
  );
});

function Spinner(): React.ReactElement {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 animate-spin" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export { buttonVariants };

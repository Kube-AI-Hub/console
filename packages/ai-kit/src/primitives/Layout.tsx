import * as React from 'react';
import { cn } from '../utils/cn';

/**
 * Layout primitives kept from kube-design.
 *
 * These four shapes appear throughout console's pages, so porting them avoids
 * rewriting every call site into raw Tailwind during the migration. Each maps
 * onto a plain flex container; there is no sizing state to manage.
 */

/* ---------------- Columns / Column ---------------- */

export interface ColumnsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Allow children to wrap onto multiple rows. */
  multiline?: boolean;
  /** Uniform gap between columns, in Tailwind spacing units. */
  gap?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8;
  /** Center children on the cross axis. */
  centered?: boolean;
}

const gapClass = {
  0: 'gap-0',
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-5',
  6: 'gap-6',
  8: 'gap-8',
} as const;

export function Columns({
  multiline = false,
  gap = 4,
  centered = false,
  className,
  ...props
}: ColumnsProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex w-full',
        // Columns always wrap on a phone: two side-by-side blocks on a 390px
        // screen leave each one too narrow to read.
        multiline ? 'flex-wrap' : 'flex-wrap sm:flex-nowrap',
        centered && 'items-center',
        gapClass[gap],
        className,
      )}
      {...props}
    />
  );
}

export interface ColumnProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Take the remaining space instead of sizing to content. */
  grow?: boolean;
  /** Fixed width in Tailwind flex-basis steps. */
  size?: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;
}

const sizeClass = {
  1: 'sm:basis-1/12',
  2: 'sm:basis-2/12',
  3: 'sm:basis-3/12',
  4: 'sm:basis-4/12',
  5: 'sm:basis-5/12',
  6: 'sm:basis-6/12',
  8: 'sm:basis-8/12',
  10: 'sm:basis-10/12',
  12: 'sm:basis-full',
} as const;

export function Column({ grow = true, size, className, ...props }: ColumnProps): React.ReactElement {
  return (
    <div
      className={cn(
        'min-w-0',
        grow && !size && 'flex-1',
        // A `basis-4/12` column is a sliver on a phone; full width below `sm`,
        // then the requested proportion once there is room for it.
        size && cn('w-full shrink-0 basis-full', sizeClass[size]),
        className,
      )}
      {...props}
    />
  );
}

/* ---------------- Level ---------------- */

export interface LevelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Mobile keeps the left/right split stacked instead of side by side. */
  mobile?: boolean;
}

export function Level({ mobile = false, className, ...props }: LevelProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex w-full items-center justify-between gap-4',
        mobile && 'flex-col items-stretch sm:flex-row sm:items-center',
        className,
      )}
      {...props}
    />
  );
}

export function LevelLeft({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('flex min-w-0 flex-wrap items-center gap-2', className)} {...props} />;
}

export function LevelRight({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('flex shrink-0 items-center gap-2', className)} {...props} />;
}

export interface LevelItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Render the item as a heading so it reads as the section title. */
  heading?: boolean;
}

export function LevelItem({ heading = false, className, children, ...props }: LevelItemProps): React.ReactElement {
  if (heading) {
    return (
      <h3 className={cn('m-0 text-sm font-semibold text-ai-fg', className)} {...props}>
        {children}
      </h3>
    );
  }
  return (
    <div className={cn('text-xs text-ai-fg-secondary', className)} {...props}>
      {children}
    </div>
  );
}

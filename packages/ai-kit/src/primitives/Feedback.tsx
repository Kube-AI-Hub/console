import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '../utils/cn';
import { Button } from './Button';

/* ---------------- Alert ---------------- */

const alertTones = {
  info: 'border-ai-info/30 bg-ai-info/10 text-ai-info',
  success: 'border-ai-success/30 bg-ai-success/10 text-ai-success',
  warning: 'border-ai-warning/30 bg-ai-warning/10 text-ai-warning',
  danger: 'border-ai-danger/30 bg-ai-danger/10 text-ai-danger',
} as const;

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: keyof typeof alertTones;
  title?: React.ReactNode;
}

export function Alert({ tone = 'info', title, className, children, ...props }: AlertProps): React.ReactElement {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-ai-md border px-3 py-2', alertTones[tone], className)}
      {...props}
    >
      {title ? <p className="text-xs font-semibold">{title}</p> : null}
      {children ? <div className="mt-0.5 text-xs leading-5 opacity-90">{children}</div> : null}
    </div>
  );
}

/* ---------------- Loading ---------------- */

export interface LoadingProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
}

export function Loading({ label = '加载中', className, ...props }: LoadingProps): React.ReactElement {
  return (
    <div role="status" aria-label={label} className={cn('flex items-center justify-center gap-2 py-8 text-ai-fg-muted', className)} {...props}>
      <svg viewBox="0 0 16 16" className="size-4 animate-spin" aria-hidden="true">
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
        <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-xs">{label}</span>
    </div>
  );
}

/* ---------------- Modal ---------------- */

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Width preset; defaults to a comfortable form width. */
  size?: 'sm' | 'md' | 'lg';
}

const modalSizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md' }: ModalProps): React.ReactElement {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] animate-ai-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50',
            /*
             * Phone: a bottom sheet anchored to the safe edge.
             * Desktop: centred.
             *
             * A centred box on a phone wastes the reachable area and fights the
             * on-screen keyboard; the sheet pattern keeps actions under the
             * thumb. Both branches share the same panel styling below.
             */
            /*
             * `tailwind-merge` treats `inset-x-0` as owning `left`/`right`, so it
             * stripped the `sm:left-1/2` that restores horizontal centring. The
             * longhands keep both branches intact; this was caught by the
             * mobile test, not by eye.
             */
            'left-0 right-0 bottom-0 w-full max-h-[90dvh] overflow-y-auto rounded-t-ai-xl',
            'sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2',
            // Static centring for the moment before the animation starts and for
            // environments where the animation never runs. The keyframes then
            // restate it alongside the scale so the two never fight.
            //
            // The sheet has no `sm:` counterpart on purpose: above the breakpoint
            // the pop-in keyframes own `transform`, and a competing animation
            // would overwrite the centring translate.
            'animate-ai-sheet-in sm:animate-ai-pop-in [--ai-pop-scale:0.96]',
            'rounded-ai-xl border border-ai-line bg-ai-bg-elevated shadow-ai-pop',
            'focus:outline-none',
            modalSizes[size],
          )}
        >
          <header className="flex items-start gap-3 border-b border-ai-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-sm font-semibold text-ai-fg">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-xs leading-5 text-ai-fg-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="关闭">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </Button>
            </DialogPrimitive.Close>
          </header>
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <footer className="flex justify-end gap-2 border-t border-ai-line px-5 py-3">{footer}</footer> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ---------------- Drawer ---------------- */

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  side?: 'right' | 'left';
}

export function Drawer({ open, onOpenChange, title, description, children, footer, side = 'right' }: DrawerProps): React.ReactElement {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 animate-ai-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            // Full width on a phone; a 28rem rail would leave nothing behind it.
            'fixed inset-y-0 z-50 flex w-full flex-col border-ai-line bg-ai-bg-elevated shadow-ai-pop sm:w-[min(28rem,100%)]',
            side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
            'focus:outline-none',
          )}
        >
          <header className="flex items-start gap-3 border-b border-ai-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-sm font-semibold text-ai-fg">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-xs leading-5 text-ai-fg-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="关闭">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </Button>
            </DialogPrimitive.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <footer className="flex justify-end gap-2 border-t border-ai-line px-5 py-3">{footer}</footer> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ---------------- Tooltip / Popover ---------------- */

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /**
   * How the tooltip is revealed.
   *
   * `hover` and `focus` stay in the Tooltip primitive. `click` uses a popover
   * instead, because the tooltip's hover timers would otherwise dismiss the
   * panel the moment the pointer leaves the trigger.
   */
  trigger?: 'hover' | 'focus' | 'click';
}

export function Tooltip({ content, children, side = 'top', trigger = 'hover' }: TooltipProps): React.ReactElement {
  if (trigger === 'click') {
    return (
      <PopoverPrimitive.Root>
        <PopoverPrimitive.Trigger asChild>{children}</PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            side={side}
            sideOffset={6}
            className="z-50 max-w-xs rounded-ai-md border border-ai-line bg-ai-bg-overlay px-2.5 py-1.5 text-[11px] leading-4 text-ai-fg shadow-ai-pop animate-ai-scale-in"
          >
            {content}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    );
  }

  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        {/* Radix tooltips already open on focus, so `focus` needs no special
            case; the prop exists to document intent at call sites. */}
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className="z-50 rounded-ai-sm bg-ai-fg px-2 py-1 text-[11px] leading-4 text-ai-bg animate-ai-fade-in"
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-ai-fg" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export interface PopoverProps {
  trigger: React.ReactElement;
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function Popover({ trigger, children, align = 'start', className }: PopoverProps): React.ReactElement {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={6}
          className={cn(
            'z-50 rounded-ai-md border border-ai-line bg-ai-bg-overlay p-3 shadow-ai-pop animate-ai-scale-in',
            className,
          )}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '../utils/cn';
import { Button } from './Button';
import { observeHiddenErrors } from '../utils/observeHiddenErrors';

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
  /**
   * Width preset; defaults to a comfortable form width.
   *
   * `xl` matches the old console's 960px create dialog: the two-step ConfigMap
   * form and the YAML editor both need the room, and `lg` forces the data editor
   * to scroll horizontally.
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'console';
  /** Interactive consoles need Escape and outside clicks to reach the session. */
  dismissOnEscape?: boolean;
  dismissOnOutside?: boolean;
  closeAiId?: string;
  closeLabel?: string;
  closeDisabled?: boolean;
}

const modalSizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', console: 'max-w-none h-[calc(100dvh-1rem)]' } as const;

export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md', dismissOnEscape = true, dismissOnOutside = true, closeAiId, closeLabel = '关闭', closeDisabled = false }: ModalProps): React.ReactElement {
  /*
   * Reveal an error that would otherwise be rendered below the fold.
   *
   * Done here rather than in each dialog: the body scrolls (`max-h-[70vh]`), a form can
   * be taller than that, and a message rendered outside the visible area reads as "the
   * button did nothing". Every dialog gets it, including the ones that validate by hand
   * and never call `focusFirstInvalidField`.
   *
   * The observer is attached to the scrolling body (not the whole dialog) so it only
   * sees content that can actually be scrolled.
   *
   * State, not a ref: `DialogPrimitive.Portal` mounts its subtree in a later commit, so
   * on the first effect `bodyRef.current` is still null and an observer attached there
   * would silently never exist. A callback ref runs when the node actually appears.
   */
  const [body, setBody] = React.useState<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!open) return;
    return observeHiddenErrors(body);
  }, [open, body]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] animate-ai-fade-in" />
        <DialogPrimitive.Content
          onEscapeKeyDown={(event) => { if (!dismissOnEscape || closeDisabled) event.preventDefault(); }}
          onPointerDownOutside={(event) => { if (!dismissOnOutside || closeDisabled) event.preventDefault(); }}
          // Confirm dialogs have a title and no extra copy; without this Radix
          // warns that the dialog is missing a description, then would point
          // `aria-describedby` at nothing.
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            /*
             * Always a centred box, including below Tailwind's `sm` (640px).
             *
             * The overlays story — and any console page with a sidebar — often
             * renders in a canvas narrower than 640px. A bottom-sheet branch at
             * that width sat on the bottom-left (max-width capped, `left: 0`)
             * and read as "the dialog is not centred".
             *
             * Offset uses the CSS `translate` *property* (`[translate:-50%_-50%]`),
             * not Tailwind's transform-based translate utilities. Those write
             * `transform`, which `ai-pop-in` also animates, so the scale
             * keyframes erased the offset and the dialog sat down-right of centre.
             */
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto',
            '[translate:-50%_-50%]',
            'rounded-ai-xl border border-ai-line bg-ai-bg-elevated shadow-ai-pop',
            'animate-ai-pop-in [--ai-pop-scale:0.96]',
            'focus:outline-none',
            modalSizes[size],
            size === 'console' && 'flex w-[calc(100%-1rem)] max-h-none flex-col overflow-hidden animate-none',
          )}
        >
          <header className={cn('flex shrink-0 items-start gap-3 border-b border-ai-line px-5', size === 'console' ? 'py-2' : 'py-4')}>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-sm font-semibold text-ai-fg">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-xs leading-5 text-ai-fg-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" disabled={closeDisabled} aria-label={closeLabel} data-ai-id={closeAiId}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </Button>
            </DialogPrimitive.Close>
          </header>
          {children ? <div ref={setBody} className={size === 'console' ? 'flex min-h-0 flex-1 flex-col overflow-hidden p-2' : 'max-h-[70vh] overflow-y-auto px-5 py-4'}>{children}</div> : null}
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

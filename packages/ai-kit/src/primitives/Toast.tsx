import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { cn } from '../utils/cn';

/**
 * Toasts.
 *
 * A queue, not a single slot: an operation that fails five rows in a row must
 * not swallow four of the messages. Radix handles the announcement, the swipe
 * dismissal and the live-region wiring so screen readers hear each one.
 *
 * The API is a hook because a toast is always raised from an event handler,
 * never rendered declaratively by a parent.
 */

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastOptions {
  title: React.ReactNode;
  description?: React.ReactNode;
  tone?: ToastTone;
  /** Milliseconds before auto-dismiss; `0` keeps it until dismissed. */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastRecord extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  push: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const toneClass: Record<ToastTone, string> = {
  info: 'border-ai-info/40 text-ai-fg',
  success: 'border-ai-success/40 text-ai-fg',
  warning: 'border-ai-warning/40 text-ai-fg',
  danger: 'border-ai-danger/40 text-ai-fg',
};

const toneDotClass: Record<ToastTone, string> = {
  info: 'bg-ai-info',
  success: 'bg-ai-success',
  warning: 'bg-ai-warning',
  danger: 'bg-ai-danger',
};

export interface ToastProviderProps {
  children: React.ReactNode;
  /** Where the stack sits. Bottom-right keeps it out of the content column. */
  position?: 'top-right' | 'bottom-right' | 'bottom-center';
  /** Cap the visible stack; older items are dropped rather than stacking forever. */
  limit?: number;
}

const positionClass = {
  'top-right': 'top-4 right-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
} as const;

export function ToastProvider({
  children,
  position = 'bottom-right',
  limit = 4,
}: ToastProviderProps): React.ReactElement {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = React.useCallback(
    (options: ToastOptions) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((current) => [...current, { ...options, id }].slice(-limit));
      return id;
    },
    [limit],
  );

  const value = React.useMemo<ToastContextValue>(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4000}>
        {children}
        {toasts.map((toast) => {
          const tone = toast.tone ?? 'info';
          return (
            <ToastPrimitive.Root
              key={toast.id}
              open
              duration={toast.duration ?? 4000}
              onOpenChange={(open) => {
                if (!open) dismiss(toast.id);
              }}
              className={cn(
                // Full-bleed on phones: a fixed 320px card plus its insets does
                // not fit a 360px screen.
                'pointer-events-auto flex w-[calc(100vw-2rem)] max-w-80 items-start gap-2 rounded-ai-md border sm:w-80',
                'bg-ai-bg-elevated p-3 shadow-ai-pop animate-ai-slide-up',
                toneClass[tone],
              )}
            >
              <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', toneDotClass[tone])} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <ToastPrimitive.Title className="text-xs font-medium text-ai-fg">
                  {toast.title}
                </ToastPrimitive.Title>
                {toast.description ? (
                  <ToastPrimitive.Description className="mt-0.5 text-[11px] leading-4 text-ai-fg-muted">
                    {toast.description}
                  </ToastPrimitive.Description>
                ) : null}
                {toast.action ? (
                  <ToastPrimitive.Action
                    asChild
                    altText={toast.action.label}
                    onClick={toast.action.onClick}
                  >
                    <button
                      type="button"
                      className="mt-1.5 text-[11px] font-medium text-ai-accent hover:underline"
                    >
                      {toast.action.label}
                    </button>
                  </ToastPrimitive.Action>
                ) : null}
              </div>
              <ToastPrimitive.Close
                aria-label="关闭通知"
                className="grid size-5 shrink-0 place-items-center rounded text-ai-fg-faint transition-colors duration-ai-fast hover:bg-ai-surface-2 hover:text-ai-fg"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className="size-3">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport
          className={cn(
            'fixed z-[70] flex max-h-screen w-auto flex-col gap-2 outline-none',
            positionClass[position],
          )}
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}

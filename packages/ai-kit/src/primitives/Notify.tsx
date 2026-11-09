import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { cn } from '../utils/cn';
import { Icon } from './Icon';

/**
 * Imperative notifications, matching console's `Notify` module.
 *
 * `Toast` is the declarative path (Provider + `useToast`) and is preferred in
 * new code. `Notify` exists because console calls it from plain functions —
 * request interceptors, promise handlers, action dispatchers — where there is
 * no component to read a context from. It mounts its own root on first use and
 * tears it down when the last notice closes.
 */

export type NotifyTone = 'info' | 'success' | 'warning' | 'error';
export type NotifyPlacement = 'topRight' | 'topLeft' | 'bottomRight' | 'bottomLeft';

export interface NotifyOptions {
  title?: React.ReactNode;
  content?: React.ReactNode;
  tone?: NotifyTone;
  placement?: NotifyPlacement;
  /** Milliseconds before auto-close; `0` keeps it until closed. */
  duration?: number;
  closable?: boolean;
  /** Stable key: re-opening the same key updates the existing notice. */
  key?: string;
  /** Extra action buttons rendered under the content. */
  actions?: React.ReactNode;
}

interface Notice extends NotifyOptions {
  id: string;
}

const toneIcon: Record<NotifyTone, React.ComponentProps<typeof Icon>['name']> = {
  info: 'information',
  success: 'check',
  warning: 'exclamation',
  error: 'exclamation',
};

const toneAccent: Record<NotifyTone, string> = {
  info: 'text-ai-info',
  success: 'text-ai-success',
  warning: 'text-ai-warning',
  error: 'text-ai-danger',
};

const placementClass: Record<NotifyPlacement, string> = {
  topRight: 'top-4 right-4 items-end sm:top-6 sm:right-6',
  topLeft: 'top-4 left-4 items-start sm:top-6 sm:left-6',
  bottomRight: 'bottom-4 right-4 items-end sm:bottom-6 sm:right-6',
  bottomLeft: 'bottom-4 left-4 items-start sm:bottom-6 sm:left-6',
};

/* ---------------- Renderer ---------------- */

interface NotifyStackProps {
  notices: Notice[];
  onClose: (id: string) => void;
}

function NotifyStack({ notices, onClose }: NotifyStackProps): React.ReactElement {
  return (
    // No full-viewport layer: each placement group is its own fixed box in a
    // corner. A `fixed inset-0` wrapper would cover the host page even though
    // it ignores pointer events, and it made every story after this one look
    // blank because the empty overlay outlived the notices.
    <div className="ai-root">
      {(['topRight', 'topLeft', 'bottomRight', 'bottomLeft'] as const).map((placement) => {
        const group = notices.filter((notice) => (notice.placement ?? 'topRight') === placement);
        if (!group.length) return null;
        return (
          <div
            key={placement}
            className={cn(
              // A fixed 320px stack overflows a 360px phone once the corner
              // insets are counted, so it collapses to the available width.
              'pointer-events-none fixed z-[80] flex w-[calc(100vw-2rem)] max-w-80 flex-col gap-2 sm:w-80',
              placementClass[placement],
            )}
          >
            {group.map((notice) => (
              <div
                key={notice.id}
                role={notice.tone === 'error' ? 'alert' : 'status'}
                className="pointer-events-auto flex items-start gap-2 rounded-ai-md border border-ai-line bg-ai-bg-elevated p-3 shadow-ai-pop animate-ai-slide-up"
              >
                <Icon
                  name={toneIcon[notice.tone ?? 'info']}
                  size={14}
                  className={cn('mt-0.5', toneAccent[notice.tone ?? 'info'])}
                />
                <div className="min-w-0 flex-1">
                  {notice.title ? <p className="text-xs font-medium text-ai-fg">{notice.title}</p> : null}
                  {notice.content ? (
                    <div className="mt-0.5 text-[11px] leading-4 text-ai-fg-muted">{notice.content}</div>
                  ) : null}
                  {notice.actions ? <div className="mt-2 flex gap-2">{notice.actions}</div> : null}
                </div>
                {notice.closable === false ? null : (
                  <button
                    type="button"
                    aria-label="关闭通知"
                    onClick={() => onClose(notice.id)}
                    className="grid size-5 shrink-0 place-items-center rounded text-ai-fg-faint transition-colors duration-ai-fast hover:bg-ai-surface-2 hover:text-ai-fg"
                  >
                    <Icon name="close" size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Imperative host ---------------- */

interface NotifyHost {
  container: HTMLDivElement;
  notices: Notice[];
  render: () => void;
  closeNotice: (id: string) => void;
  timers: Map<string, ReturnType<typeof setTimeout>>;
  destroy: () => void;
}

let host: NotifyHost | null = null;

function ensureHost(): NotifyHost {
  if (host) return host;
  const container = document.createElement('div');
  container.id = '__ai-kit-notify__';
  document.body.appendChild(container);
  const root = createRoot(container);

  const state: NotifyHost = {
    container,
    notices: [],
    timers: new Map<string, ReturnType<typeof setTimeout>>(),
    render() {
      root.render(<NotifyStack notices={state.notices} onClose={state.closeNotice} />);
    },
    closeNotice(id: string) {
      const timer = state.timers.get(id);
      if (timer) clearTimeout(timer);
      state.timers.delete(id);
      state.notices = state.notices.filter((notice) => notice.id !== id);
      if (!state.notices.length) {
        state.destroy();
        return;
      }
      state.render();
    },
    /**
     * Tear the host down once nothing is left to show.
     *
     * Leaving an empty host on `<body>` means any later consumer — a route
     * change, or the next story in Storybook — inherits a layer it never asked
     * for. Removing the container also unmounts the React root so nothing
     * leaks across pages.
     */
    destroy() {
      for (const timer of state.timers.values()) clearTimeout(timer);
      state.timers.clear();
      state.notices = [];
      root.unmount();
      container.remove();
      host = null;
    },
  };

  host = state;
  return state;
}

function open(options: NotifyOptions): string {
  const state = ensureHost();
  const id = options.key ?? `notice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // A repeated key updates in place rather than stacking duplicates: a retried
  // request must not leave three copies of the same error.
  const existing = state.notices.findIndex((notice) => notice.id === id);
  const record: Notice = { ...options, id };
  if (existing >= 0) state.notices[existing] = record;
  else state.notices.push(record);

  const duration = options.duration ?? 4500;
  const previous = state.timers.get(id);
  if (previous) clearTimeout(previous);
  if (duration > 0) {
    state.timers.set(
      id,
      setTimeout(() => {
        // Route expiry through the same path as a manual close so the host is
        // torn down when the last notice times out. Duplicating the removal
        // here previously skipped that cleanup.
        const current = host;
        if (current) current.closeNotice(id);
      }, duration),
    );
  }

  state.render();
  return id;
}

/** Normalise `Notify.success('title', 'content')` and `Notify.success({...})`. */
function convert(first: string | NotifyOptions, second?: React.ReactNode, tone?: NotifyTone): string {
  if (typeof first === 'string') return open({ title: first, content: second, tone });
  return open({ ...first, tone: tone ?? first.tone });
}

export const Notify = {
  open: (options: NotifyOptions): string => open(options),
  info: (first: string | NotifyOptions, second?: React.ReactNode): string => convert(first, second, 'info'),
  success: (first: string | NotifyOptions, second?: React.ReactNode): string => convert(first, second, 'success'),
  warning: (first: string | NotifyOptions, second?: React.ReactNode): string => convert(first, second, 'warning'),
  error: (first: string | NotifyOptions, second?: React.ReactNode): string => convert(first, second, 'error'),
  close: (id: string): void => {
    host?.closeNotice(id);
  },
  /** Remove every notice and drop the host; safe to call when nothing is open. */
  clear: (): void => {
    host?.destroy();
  },
};

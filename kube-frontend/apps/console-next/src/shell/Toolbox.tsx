import * as React from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Icon, cn } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/shell/AuthProvider';
import { readLastCluster } from '@/lib/lastCluster';

/**
 * 浮动工具箱.
 *
 * The old console's KubeTools ball: a fixed, draggable entry point in the corner of every
 * page with the cluster's six debugging/analysis tools. Two behaviours are load-bearing:
 *
 * - the position is remembered per browser, because a reader who moved it out of the way
 *   does not want to move it again after every navigation;
 * - a drag must not also toggle the panel (pointerup after a move is not a click).
 *
 * The tools are all cluster-scoped in this console, so the cluster comes from the URL; on
 * a platform/workspace page it falls back to the last cluster the reader entered, then to
 * the default. [N-03]
 */
const POSITION_KEY = 'kube-frontend:toolbox';
const DEFAULT_POSITION = { right: 24, bottom: 32 };
const BALL_SIZE = 44;

interface Position {
  right: number;
  bottom: number;
}

function readPosition(): Position {
  try {
    const raw = window.localStorage.getItem(POSITION_KEY);
    if (!raw) return DEFAULT_POSITION;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_POSITION;
    const { right, bottom } = parsed as Partial<Position>;
    return typeof right === 'number' && typeof bottom === 'number' ? { right, bottom } : DEFAULT_POSITION;
  } catch {
    return DEFAULT_POSITION;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function Toolbox(): React.ReactElement | null {
  const t = useT();
  const { user } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<Position>(DEFAULT_POSITION);
  const drag = React.useRef<{ startX: number; startY: number; right: number; bottom: number; moved: boolean } | null>(null);

  React.useEffect(() => setPosition(readPosition()), []);

  const cluster = React.useMemo(() => {
    const project = /^\/kube-frontend\/[^/]+\/clusters\/([^/]+)/.exec(pathname);
    if (project?.[1]) return decodeURIComponent(project[1]);
    const plain = /^\/kube-frontend\/clusters\/([^/]+)/.exec(pathname);
    if (plain?.[1]) return decodeURIComponent(plain[1]);
    return readLastCluster(user?.name ?? '') || 'host';
  }, [pathname, user?.name]);

  const items = React.useMemo(
    () => [
      { key: 'logs', label: t('toolbox.logs'), to: '/kube-frontend/clusters/' + encodeURIComponent(cluster) + '/logs' },
      { key: 'events', label: t('toolbox.events'), to: '/kube-frontend/clusters/' + encodeURIComponent(cluster) + '/events' },
      { key: 'audit', label: t('toolbox.audit'), to: '/kube-frontend/clusters/' + encodeURIComponent(cluster) + '/audit-logs' },
      { key: 'bill', label: t('toolbox.bill'), to: '/kube-frontend/clusters/' + encodeURIComponent(cluster) + '/bill' },
      { key: 'kubeconfig', label: t('toolbox.kubeconfig'), to: '/kube-frontend/clusters/' + encodeURIComponent(cluster) + '/overview' },
      { key: 'kubectl', label: t('toolbox.kubectl'), to: '/kube-frontend/clusters/' + encodeURIComponent(cluster) + '/kubectl' },
    ],
    [cluster, t],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>): void => {
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      right: position.right,
      bottom: position.bottom,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>): void => {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) current.moved = true;
    if (!current.moved) return;
    const maxRight = Math.max(8, window.innerWidth - BALL_SIZE - 8);
    const maxBottom = Math.max(8, window.innerHeight - BALL_SIZE - 8);
    setPosition({
      right: clamp(current.right - dx, 8, maxRight),
      bottom: clamp(current.bottom - dy, 8, maxBottom),
    });
  };

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>): void => {
    const current = drag.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!current) return;
    if (current.moved) {
      setPosition((next) => {
        try {
          window.localStorage.setItem(POSITION_KEY, JSON.stringify(next));
        } catch {
          // Private mode: the ball just does not stay where it was put.
        }
        return next;
      });
      return;
    }
    setOpen((value) => !value);
  };

  return (
    <div className="fixed z-40 flex flex-col items-end gap-2" style={{ right: position.right, bottom: position.bottom }}>
      {open ? (
        <div
          id="kube-frontend-toolbox"
          role="menu"
          aria-label={t('toolbox.title')}
          className="w-56 rounded-ai-md border border-ai-line bg-ai-bg p-2 shadow-ai-lg"
          data-ai-id="toolbox:panel"
        >
          <p className="px-2 py-1 text-[11px] font-medium text-ai-fg-muted">{t('toolbox.title')}</p>
          {items.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              role="menuitem"
              className="flex items-center rounded-ai-sm px-2 py-1.5 text-xs text-ai-fg-secondary hover:bg-ai-surface-2"
              data-ai-id={'toolbox:item:' + item.key}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        aria-label={t('toolbox.label')}
        aria-expanded={open}
        aria-controls="kube-frontend-toolbox"
        className={cn(
          'flex h-11 w-11 touch-none items-center justify-center rounded-full border border-ai-line bg-ai-bg text-ai-fg shadow-ai-md',
          'hover:bg-ai-surface-2 active:cursor-grabbing',
        )}
        data-ai-id="toolbox:ball"
        {...actionProps('toolbox:ball')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <Icon name="hammer" size={18} />
      </button>
    </div>
  );
}

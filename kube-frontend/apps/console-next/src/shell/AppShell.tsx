import * as React from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { Drawer, Menu, cn, useIsMobile, type MenuNode } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';

/** Navigation entries. `href` is a route path; the shell resolves labelling. */
interface NavEntry {
  key: string;
  labelKey: Parameters<ReturnType<typeof useT>>[0];
  /**
   * Builder rather than a literal: every console route carries the current
   * workspace, cluster and namespace, so the sidebar has to fill them from the
   * route the user is on. A literal would render `$workspace` into the link.
   */
  build: (params: Scope) => string;
}

const NAV: readonly NavEntry[] = [
  {
    key: 'configmaps',
    labelKey: 'configmaps.title',
    build: ({ workspace, cluster, namespace }) =>
      `/kube-frontend/${workspace}/clusters/${cluster}/projects/${namespace}/configmaps`,
  },
];

/** Defaults used by the landing route and by any page without route params. */
export interface Scope {
  workspace: string;
  cluster: string;
  namespace: string;
}

export const DEFAULT_SCOPE: Scope = { workspace: 'system-workspace', cluster: 'host', namespace: 'default' };

/**
 * Application shell: a sidebar on wide screens, a drawer on phones.
 *
 * The breakpoint lives here, not in each page, so every route gets the same
 * behaviour. Below `sm` the sidebar is replaced by a drawer opened from a button
 * whose 44px target is set on the button itself.
 */
export function AppShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const t = useT();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const location = useRouterState({ select: (state) => state.location.pathname });

  /*
   * Scope read from the URL, with a default for pages outside a resource route.
   *
   * The sidebar used to carry a literal path, which rendered `$workspace` into
   * the href and produced a dead link. Deriving it from the location keeps the
   * links valid on every page and preserves the user's current project.
   */
  const scope = React.useMemo<Scope>(() => {
    const match = /^\/kube-frontend\/([^/]+)\/clusters\/([^/]+)\/projects\/([^/]+)/.exec(location);
    return match?.[1] && match[2] && match[3]
      ? { workspace: decodeURIComponent(match[1]), cluster: decodeURIComponent(match[2]), namespace: decodeURIComponent(match[3]) }
      : DEFAULT_SCOPE;
  }, [location]);

  const items = React.useMemo<MenuNode[]>(
    () =>
      NAV.map((entry) => ({
        key: entry.key,
        label: t(entry.labelKey),
        href: entry.build(scope),
        onClick: () => setDrawerOpen(false),
      })),
    [t, scope],
  );

  const activeKey = NAV.find((entry) => location.includes(`/${entry.key}`))?.key;

  return (
    <div className="flex min-h-dvh bg-ai-bg text-ai-fg">
      {/* Keyboard users and agents land here first; without it the first Tab goes
          to the sidebar instead of the page content. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:rounded-ai-md focus:bg-ai-bg-elevated focus:px-3 focus:py-2"
      >
        {t('app.skipToContent')}
      </a>

      {isMobile ? (
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title={t('app.name')} side="left">
          <Menu items={items} {...(activeKey ? { activeKey } : {})} />
        </Drawer>
      ) : (
        <aside className="flex w-56 shrink-0 flex-col border-r border-ai-line bg-ai-bg-elevated">
          <div className="shrink-0 px-4 py-4 text-sm font-semibold leading-none">{t('app.name')}</div>
          <nav aria-label={t('nav.primary')} className="min-w-0 flex-1 overflow-y-auto px-2">
            <Menu items={items} {...(activeKey ? { activeKey } : {})} />
          </nav>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-ai-line px-4">
          {isMobile ? (
            <button
              type="button"
              className="grid size-11 place-items-center rounded-ai-md hover:bg-ai-surface-2"
              {...actionProps('shell:nav-toggle', { label: t('nav.toggle') })}
              onClick={() => setDrawerOpen(true)}
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
          <Link to="/" className={cn('text-sm font-medium text-ai-fg')}>
            {t('app.name')}
          </Link>
        </header>
        <main id="main" className="min-w-0 flex-1 p-4 sm:p-6">
          {/* A resource list reads badly at 1600px wide; the column is capped and
              centred the same way the Storybook examples are. */}
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

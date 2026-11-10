import * as React from 'react';
import { useRouterState } from '@tanstack/react-router';
import { Drawer, Dropdown, Icon, Menu, ThemeToggle, cn, useIsMobile, type DropdownItem, type IconName, type MenuNode } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useLocale, useT } from '@/i18n';
import { useAuth } from '@/shell/AuthProvider';

/**
 * Scope carried by every console route.
 *
 * The old console addresses resources by workspace, cluster and namespace, so the
 * shell derives these from the current location and rebuilds links with them
 * rather than hard-coding a path (which once rendered `$workspace` literally).
 */
export interface Scope {
  workspace: string;
  cluster: string;
  namespace: string;
}

export const DEFAULT_SCOPE: Scope = { workspace: 'system-workspace', cluster: 'host', namespace: 'default' };

/** One navigable item. `build` fills the scope from the route the user is on. */
interface NavEntry {
  key: string;
  labelKey: Parameters<ReturnType<typeof useT>>[0];
  /**
   * Icon name from ai-kit's sprite.
   *
   * Required, not optional: the collapsed rail shows icons only, so an entry
   * without one becomes a blank 64px row that the reader cannot identify.
   */
  icon: IconName;
  build: (params: Scope) => string;
}

/**
 * A titled group of entries.
 *
 * The old console groups its sidebar (Configuration, Workloads, Network, …); a
 * flat list loses that and stops scaling at about eight items. Titles are
 * dropped in the collapsed rail, where they would sit above icon-only rows as
 * blank space.
 */
interface NavGroup {
  key: string;
  titleKey: Parameters<ReturnType<typeof useT>>[0];
  items: readonly NavEntry[];
}

const NAV: readonly NavGroup[] = [
  {
    key: 'config',
    titleKey: 'nav.groupConfig',
    items: [
      {
        key: 'configmaps',
        labelKey: 'configmaps.title',
        icon: 'catalog',
        build: ({ workspace, cluster, namespace }) =>
          `/kube-frontend/${workspace}/clusters/${cluster}/projects/${namespace}/configmaps`,
      },
    ],
  },
];

const SIDEBAR_KEY = 'kube-frontend-sidebar';

/**
 * Focus indicator for elements this app renders itself.
 *
 * Matches ai-kit's (`focus-visible:ring-2 ring-ai-ring ring-offset-2`), because
 * the two sit side by side in the header and a different treatment would read as
 * a different kind of control. Needed because `styles.css` has no global
 * `:focus-visible` rule: that rule outranked every component's own
 * `outline-none` (this file is appended after Tailwind's utilities) and painted a
 * double frame, so it was removed and each control now owns its indicator.
 */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ai-bg';

/**
 * The platforms this console can switch between.
 *
 * Each is a separate application on its own path, so these are plain navigations
 * rather than router links, and "active" has to be decided from the pathname —
 * three of the four live outside this app's router.
 *
 * The switcher and the centre navigation are deliberately the same list: they are
 * two views of one choice (which platform am I in), and keeping them in one array
 * is the only way to stop them drifting apart.
 */
interface Platform {
  key: string;
  labelKey: Parameters<ReturnType<typeof useT>>[0];
  icon: IconName;
  href: string;
  /** External applications open in a new tab. */
  external?: boolean;
  matches: (pathname: string) => boolean;
}

const PLATFORMS: readonly Platform[] = [
  {
    key: 'compute',
    labelKey: 'platform.compute',
    icon: 'computing',
    href: '/kube-frontend/',
    /*
     * This app is the compute console, so it owns its own route prefix. The bare
     * `/` also belongs here: the landing route redirects into it.
     */
    matches: (path) => path.startsWith('/kube-frontend') || path === '/',
  },
  { key: 'model', labelKey: 'platform.model', icon: 'ai', href: '/platform-model/', matches: (path) => path.startsWith('/platform-model') },
  {
    key: 'agent',
    labelKey: 'platform.agent',
    icon: 'strategy-group',
    href: '/agent-platform/',
    matches: (path) => path.startsWith('/agent-platform') || path.startsWith('/studio'),
  },
  { key: 'ecosystem', labelKey: 'platform.ecosystem', icon: 'application', href: '/dongba/', matches: (path) => path.startsWith('/dongba') },
];

/** The platform the current route belongs to; falls back to this console. */
function activePlatform(pathname: string): Platform {
  return PLATFORMS.find((platform) => platform.matches(pathname)) ?? PLATFORMS[0]!;
}

/**
 * Top-level entries of the compute platform, matching the old console's header.
 *
 * These are the console's own areas, not the other products: switching platform
 * is the switcher's job in the top-left corner. Keeping them separate is why the
 * header shows 工作台 while the switcher shows 算力管理平台 — treating them as the
 * same level would make them look like peers.
 *
 * 平台管理 opens a menu rather than navigating: the old console groups cluster,
 * access, app-store and platform settings under it, and four extra top-level
 * entries would crowd out the two that matter day to day.
 */
interface ModuleChild {
  key: string;
  labelKey: Parameters<ReturnType<typeof useT>>[0];
  icon: IconName;
  path: string;
}

interface ModuleEntry {
  key: string;
  labelKey: Parameters<ReturnType<typeof useT>>[0];
  icon: IconName;
  /** Target when the entry is a link; the first child when it opens a menu. */
  path: string;
  /** Present when the entry opens a menu instead of navigating. */
  children?: readonly ModuleChild[];
  matches: (pathname: string) => boolean;
}

/**
 * Every route in this app lives under `/kube-frontend/`.
 *
 * The console shares an origin with the other products, so an unprefixed
 * `/settings` would collide with the old console's own page and leave this app's
 * shell. Keeping the prefix in one constant makes the boundary explicit.
 */
const BASE = '/kube-frontend';

/** Roots that belong to 平台管理 rather than 工作台. */
const ADMIN_ROOTS = ['/clusters', '/access', '/apps-manage', '/settings'] as const;

function isAdminPath(path: string): boolean {
  return ADMIN_ROOTS.some((root) => path.startsWith(`${BASE}${root}`));
}

const MODULES: readonly ModuleEntry[] = [
  {
    key: 'platform',
    labelKey: 'module.platform',
    icon: 'cogwheel',
    path: `${BASE}/clusters`,
    children: [
      { key: 'clusters', labelKey: 'admin.clusters', icon: 'cluster', path: `${BASE}/clusters` },
      { key: 'access', labelKey: 'admin.access', icon: 'key', path: `${BASE}/access` },
      { key: 'appsManage', labelKey: 'admin.appsManage', icon: 'openpitrix', path: `${BASE}/apps-manage` },
      { key: 'settings', labelKey: 'admin.settings', icon: 'cogwheel', path: `${BASE}/settings` },
    ],
    matches: (path) => isAdminPath(path),
  },
  {
    key: 'appStore',
    labelKey: 'module.appStore',
    icon: 'appcenter',
    path: `${BASE}/apps`,
    matches: (path) => path.startsWith(`${BASE}/apps`),
  },
  {
    key: 'workbench',
    labelKey: 'module.workbench',
    icon: 'dashboard',
    /*
     * The workbench is the project console: it owns both the app root and the
     * scoped project routes. It deliberately does not claim the platform roots so
     * that only one entry highlights at a time.
     */
    path: `${BASE}/`,
    matches: (path) => path === BASE || path.startsWith(`${BASE}/`) && !isAdminPath(path),
  },
];

function navigateTo(platform: Platform): void {
  if (platform.external) window.open(platform.href, '_blank', 'noopener');
  else window.location.assign(platform.href);
}

/** One module in the centred navigation; opens a menu when it has children. */
function ModuleLink({
  module,
  active,
  activeChildKey,
  label,
}: {
  module: ModuleEntry;
  active: boolean;
  /** Key of the child matching the route, if any. */
  activeChildKey?: string;
  label: string;
}): React.ReactElement {
  const t = useT();
  const className = cn(
    'inline-flex h-9 items-center gap-1.5 rounded-ai-md px-2.5 text-xs transition-colors duration-ai-fast lg:px-4',
    // These are raw `<button>`/`<a>` elements, so they carry their own focus
    // indicator: the app has no global `:focus-visible` fallback (it would paint a
    // second frame over every ai-kit control's ring), which makes an unstyled
    // element invisible to keyboard users.
    FOCUS_RING,
    active
      ? 'bg-ai-accent-soft font-medium text-ai-accent'
      : 'text-ai-fg-secondary hover:bg-ai-surface-2 hover:text-ai-fg',
  );

  if (module.children) {
    return (
      <Dropdown
        align="start"
        trigger={
          <button
            type="button"
            className={className}
            title={label}
            aria-current={active ? 'page' : undefined}
            {...actionProps(`global-nav:${module.key}`)}
          >
            <Icon name={module.icon} size={14} />
            <span className="hidden lg:inline">{label}</span>
            <Icon name="caret-down" size={10} className="shrink-0 opacity-60" />
          </button>
        }
        items={module.children.map((child) => ({
          key: child.key,
          label: (
            <span className="flex items-center gap-2">
              <Icon name={child.icon} size={14} />
              {t(child.labelKey)}
            </span>
          ),
          checked: child.key === activeChildKey,
          onSelect: () => window.location.assign(child.path),
        }))}
      />
    );
  }

  return (
    <a
      href={module.path}
      aria-current={active ? 'page' : undefined}
      title={label}
      {...actionProps(`global-nav:${module.key}`)}
      className={className}
    >
      <Icon name={module.icon} size={14} />
      <span className="hidden lg:inline">{label}</span>
    </a>
  );
}

/**
 * Platform switcher in the top-left corner.
 *
 * Shows the current platform's icon and name with a chevron, mirroring the model
 * platform's switcher so the same gesture works in every app.
 */
function PlatformSwitcher({ current, label }: { current: Platform; label: string }): React.ReactElement {
  const t = useT();
  return (
    <Dropdown
      align="start"
      trigger={
        <button
          type="button"
          className={cn('inline-flex h-11 items-center gap-2 rounded-ai-md px-2 text-sm font-semibold text-ai-fg hover:bg-ai-surface-2', FOCUS_RING)}
          {...actionProps('shell:platform-switch', { label })}
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-ai-sm bg-ai-accent/20 text-ai-accent">
            <Icon name={current.icon} size={14} />
          </span>
          <span className="truncate">{label}</span>
          <Icon name="chevron-down" size={12} className="shrink-0 text-ai-fg-muted" />
        </button>
      }
      items={PLATFORMS.map((platform) => ({
        key: platform.key,
        label: t(platform.labelKey),
        checked: platform.key === current.key,
        onSelect: () => navigateTo(platform),
      }))}
    />
  );
}

/**
 * Read the stored rail state during render.
 *
 * An effect would paint the expanded sidebar first and collapse it afterwards,
 * which reads as a layout jump on every navigation.
 */
function readStoredCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

/**
 * Application shell.
 *
 * Wide screens get a sidebar that collapses to an icon rail, phones get a drawer.
 * The rail exists for a reason beyond convenience: an AI assistant panel will
 * occupy the right edge, so the navigation has to give up width on demand.
 */
export function AppShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(readStoredCollapsed);
  const location = useRouterState({ select: (state) => state.location.pathname });
  const platform = activePlatform(location);

  /**
   * Which top-level entry the current page belongs to.
   *
   * The project console highlights 工作台 as a whole rather than per section: the
   * header now names areas of the product, not the resources inside a project.
   */
  const activeModuleKey = MODULES.find((item) => item.matches(location))?.key ?? MODULES[0]!.key;

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'expanded');
      } catch {
        // Ignore: the choice simply will not survive a reload.
      }
      return next;
    });
  }, []);

  const scope = React.useMemo<Scope>(() => {
    const match = /^\/kube-frontend\/([^/]+)\/clusters\/([^/]+)\/projects\/([^/]+)/.exec(location);
    return match?.[1] && match[2] && match[3]
      ? {
          workspace: decodeURIComponent(match[1]),
          cluster: decodeURIComponent(match[2]),
          namespace: decodeURIComponent(match[3]),
        }
      : DEFAULT_SCOPE;
  }, [location]);

  const activeKey = NAV.flatMap((group) => group.items).find((entry) => location.includes(`/${entry.key}`))?.key;

  /** Menu nodes for one group, with the drawer closing on navigation. */
  const groupItems = React.useCallback(
    (group: NavGroup): MenuNode[] =>
      group.items.map((entry) => ({
        key: entry.key,
        label: t(entry.labelKey),
        icon: <Icon name={entry.icon} size={14} />,
        href: entry.build(scope),
        onClick: () => setDrawerOpen(false),
      })),
    [t, scope],
  );

  const localeButton = (
    <button
      type="button"
      className={cn('inline-flex h-11 items-center gap-1.5 rounded-ai-md px-2 text-xs text-ai-fg-secondary hover:bg-ai-surface-2 hover:text-ai-fg sm:h-9', FOCUS_RING)}
      {...actionProps('shell:locale-switch', { label: t('shell.locale') })}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
      </svg>
      <span className="hidden sm:inline">{t(`locale.${locale}`)}</span>
    </button>
  );

  return (
    // `ai-ambient` adds ai-kit's brand-coloured radial wash behind the page. It is
    // part of the library's look (the Storybook examples all sit on it), so the
    // shell opts in here rather than each page repeating the class.
    <div className="ai-ambient relative flex min-h-dvh flex-col bg-ai-bg text-ai-fg">
      {/* Keyboard users and agents land here first; without it the first Tab goes
          to the sidebar instead of the page content. */}
      <a
        href="#main"
        className={cn(
          'sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:rounded-ai-md focus:bg-ai-bg-elevated focus:px-3 focus:py-2',
          FOCUS_RING,
        )}
      >
        {t('app.skipToContent')}
      </a>

      {/*
       * The header spans the full viewport, including the sidebar's column, which
       * is why it lives outside the body row. In the old console the top bar also
       * runs edge to edge and the sidebar starts beneath it.
       */}
      <header className="relative flex h-14 shrink-0 items-center gap-1 border-b border-ai-line px-3">
        {isMobile ? (
          <button
            type="button"
            // `shrink-0`: the header is a flex row, and at 375px the button was
            // squeezed to 43px — one pixel under the 44px touch minimum the
            // mobile spec promises.
            className={cn('grid size-11 shrink-0 place-items-center rounded-ai-md hover:bg-ai-surface-2', FOCUS_RING)}
            {...actionProps('shell:nav-toggle', { label: t('nav.toggle') })}
            onClick={() => setDrawerOpen(true)}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}

        {/*
         * The platform switcher replaces the product wordmark.
         *
         * The old header printed the product name as static text; naming the
         * current platform in a menu says the same thing and adds the way out of
         * it. The name still comes from `app.name`, so a rebrand stays in the
         * locale dictionaries rather than here.
         */}
        <PlatformSwitcher current={platform} label={t(platform.labelKey)} />

        {/*
         * Module navigation, centred on the viewport rather than on the content
         * column. `absolute` + `left-1/2` is what makes it truly centred: inside
         * the flex row it would be pushed right by the buttons on either side and
         * drift whenever the language label changes width.
         */}
        <nav
          aria-label={t('globalNav.primary')}
          className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-2 md:flex lg:gap-8"
        >
          {MODULES.map((item) => (
            <ModuleLink
              key={item.key}
              module={item}
              active={activeModuleKey === item.key}
              {...(item.children?.find((child) => location.startsWith(child.path))?.key
                ? { activeChildKey: item.children.find((child) => location.startsWith(child.path))!.key }
                : {})}
              label={t(item.labelKey)}
            />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {/* Below `md` the modules no longer fit beside the switcher, so the same
              list collapses into a menu. */}
          <Dropdown
            align="end"
            trigger={
              <button
                type="button"
                className={cn('inline-flex h-11 items-center gap-1.5 rounded-ai-md px-2 text-xs text-ai-fg-secondary hover:bg-ai-surface-2 hover:text-ai-fg md:hidden', FOCUS_RING)}
                {...actionProps('shell:global-nav', { label: t('globalNav.primary') })}
              >
                <Icon name="apps" size={14} />
              </button>
            }
            items={MODULES.flatMap<DropdownItem>((item) =>
              item.children
                ? item.children.map((child) => ({
                    key: child.key,
                    label: (
                      <span className="flex items-center gap-2">
                        <Icon name={child.icon} size={14} />
                        {t(child.labelKey)}
                      </span>
                    ),
                    checked: location.startsWith(child.path),
                    onSelect: () => window.location.assign(child.path),
                  }))
                : [
                    {
                      key: item.key,
                      label: t(item.labelKey),
                      checked: activeModuleKey === item.key,
                      onSelect: () => window.location.assign(item.path),
                    },
                  ],
            )}
          />
          <Dropdown
            align="end"
            trigger={localeButton}
            items={[
              { key: 'zh', label: t('locale.zh'), onSelect: () => setLocale('zh'), checked: locale === 'zh' },
              { key: 'en', label: t('locale.en'), onSelect: () => setLocale('en'), checked: locale === 'en' },
            ]}
          />
          {/*
           * The label reaches `aria-label` and `title`, so the button announces
           * itself in the reader's language whether the console is in zh or en.
           * Placed with the language switch: both are display preferences that
           * apply to the whole app, not to one resource.
           *
           * Sized like the neighbours on this row (`h-11` on touch, `sm:h-9`
           * above): the component's own `size-9` is 36px, which is under the
           * 44px touch target every other control in the phone header uses and
           * made this one sit visibly smaller than the language switch beside it.
           */}
          <ThemeToggle label={t('shell.theme')} className="size-11 sm:size-9" />
          <UserMenu />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {isMobile ? (
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title={t('app.name')} side="left">
            <div className="flex flex-col gap-3">
              {NAV.map((group) => (
                <div key={group.key} className="flex flex-col gap-1">
                  <p className="px-3 text-[11px] font-medium uppercase tracking-wide text-ai-fg-faint">
                    {t(group.titleKey)}
                  </p>
                  <Menu items={groupItems(group)} {...(activeKey ? { activeKey } : {})} />
                </div>
              ))}
            </div>
          </Drawer>
        ) : (
          <aside
            className={cn(
              // The rail gives up 128px to the assistant panel that will sit on the
              // right edge; the expanded width is already narrower than the old
              // console's 260px for the same reason.
              'flex shrink-0 flex-col border-r border-ai-line bg-ai-bg-elevated/40 backdrop-blur-sm transition-[width] duration-ai-base ease-ai-out',
              collapsed ? 'w-16' : 'w-48',
            )}
          >
            <nav aria-label={t('nav.primary')} className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto px-2 py-3">
              {NAV.map((group, index) => (
                <div key={group.key} className="flex flex-col gap-1">
                  {/* Collapsed rails have no room for a title; a rule between groups
                      keeps them visually separated without the empty line. */}
                  {collapsed ? (
                    index > 0 ? <div className="mx-2 my-1 border-t border-ai-line" /> : null
                  ) : (
                    <p className="px-3 text-[11px] font-medium uppercase tracking-wide text-ai-fg-faint">
                      {t(group.titleKey)}
                    </p>
                  )}
                  <Menu items={groupItems(group)} collapsed={collapsed} {...(activeKey ? { activeKey } : {})} />
                </div>
              ))}
            </nav>

            {/*
             * Collapse control lives at the bottom of the sidebar, not in the
             * header. It acts on the sidebar, so it belongs with it: sitting in the
             * top bar it read as a page-level control and competed with the
             * platform switcher for the top-left corner.
             */}
            <div className="shrink-0 border-t border-ai-line p-2">
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
                title={collapsed ? t('nav.expand') : t('nav.collapse')}
                {...actionProps('shell:sidebar-toggle')}
                className={cn(
                  'flex h-10 w-full items-center gap-2 rounded-ai-md px-2 text-sm text-ai-fg-secondary',
                  'transition-colors duration-ai-fast hover:bg-ai-surface-2 hover:text-ai-fg',
                  FOCUS_RING,
                  collapsed && 'justify-center px-0',
                )}
              >
                <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  {/* A panel outline with the arrow pointing at the edge it moves to. */}
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M9 4v16" />
                  {collapsed ? <path d="m13 9 3 3-3 3" strokeLinecap="round" strokeLinejoin="round" /> : <path d="m16 9-3 3 3 3" strokeLinecap="round" strokeLinejoin="round" />}
                </svg>
                {collapsed ? null : <span className="truncate">{t('nav.collapse')}</span>}              </button>
            </div>
          </aside>
        )}

        <main id="main" className="min-w-0 flex-1 px-4 pt-4 pb-16 sm:px-6 sm:pt-8 sm:pb-24">
          {/*
           * The content column fills the space it is given.
           *
           * A fixed cap was wrong here: resource tables gain columns (keys,
           * labels, status, age) and every one of them is data the reader came
           * for. On a wide screen the cap left a third of the viewport empty
           * while the table scrolled sideways inside it. The remaining ceiling is
           * high enough that only very large displays hit it, and it exists so a
           * single row does not stretch to 3000px on an ultrawide monitor.
           */}
          <div className="w-full max-w-[1800px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

/**
 * The signed-in account, with sign-out.
 *
 * The old console put this at the bottom of the sidebar; here it sits in the top
 * bar next to the language switch, because the sidebar's bottom edge is taken by
 * the collapse control and a second control there competes with it.
 */
function UserMenu(): React.ReactElement | null {
  const t = useT();
  const { user, signOut } = useAuth();

  if (!user) return null;
  const label = user.displayName ?? user.name;

  return (
    <Dropdown
      align="end"
      trigger={
        <button
          type="button"
          className={cn('inline-flex h-11 max-w-[180px] items-center gap-1.5 rounded-ai-md px-2 text-xs text-ai-fg-secondary hover:bg-ai-surface-2 hover:text-ai-fg sm:h-9', FOCUS_RING)}
          title={label}
          {...actionProps('shell:user-menu', { label })}
        >
          <Icon name="user-profile" size={14} />
          {/* The name is truncated rather than wrapped: a long account name must not
              push the language switch or the module links out of the header. */}
          <span className="hidden truncate sm:inline">{label}</span>
        </button>
      }
      items={[
        ...(user.email ? [{ key: 'email', label: user.email, disabled: true }] : []),
        { key: 'signout', label: t('login.signOut'), onSelect: () => void signOut().then(() => window.location.assign('/login')) },
      ]}
    />
  );
}

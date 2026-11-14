import * as React from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Drawer, Dropdown, Icon, Menu, ThemeToggle, cn, useIsMobile, type DropdownItem, type IconName, type MenuNode } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useLocale, useT } from '@/i18n';
import { useAuth } from '@/shell/AuthProvider';
import { SharedChunkWarmer } from '@/shell/preload';
import { areasFor, areaPages, areaOfPage, type Area } from '@/areas/registry';
import { projectPageSegment } from '@/areas/scope';
import { ClusterSwitcher } from '@/shell/ClusterSwitcher';
import { UserSettingsDialog } from '@/shell/UserSettingsDialog';
import { readLastCluster } from '@/lib/lastCluster';

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
/**
 * Sidebar groups, derived from the area registry.
 *
 * The sidebar used to spell out each entry with its own `build`, which meant a new
 * page had to be remembered here *and* in the old console's navigation. Now the
 * registry is the only list: every project area contributes its pages in the order
 * the old console lists them, and its pages are reached through the area's tabs
 * rather than as separate sidebar rows.
 *
 * The sidebar therefore answers "which area" and the tabs answer "which page in
 * it" — the same split the old console had, and the reason forty pages can exist
 * without a forty-row sidebar.
 */
function areaEntry(area: Area, scope: Scope): NavEntry {
  const pages = areaPages(area);
  /*
   * The default page is the one the bare area opens. It is declared by the area,
   * not taken as `pages[0]`: the old console's 配置 lists 保密字典 first but opens
   * 配置字典, and picking by position would silently change where a link lands.
   */
  const target = pages.find((page) => page.key === (area.defaultPage ?? pages[0]?.key));
  return {
    key: area.key,
    labelKey: area.titleKey,
    icon: area.icon,
    build: () => {
      if (!target) return `/kube-frontend/${scope.workspace}/clusters/${scope.cluster}/projects/${scope.namespace}`;
      return projectPageHref(scope, target.path);
    },
  };
}

function projectPageHref({ workspace, cluster, namespace }: Scope, path: string): string {
  return `/kube-frontend/${encodeURIComponent(workspace)}/clusters/${encodeURIComponent(cluster)}/projects/${encodeURIComponent(namespace)}/${path}`;
}

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
  /**
   * Heading a child is grouped under, as a locale key.
   *
   * The old console nests 集群管理 → 配置 → 配置字典 and the resource pages will keep
   * arriving, so a child carries its group instead of the menu assuming one flat
   * list. Children without a group render at the top level.
   */
  groupKey?: Parameters<ReturnType<typeof useT>>[0];
  /**
   * Resolve the target from the current scope, when the destination needs it.
   *
   * A cluster-scoped page has no cluster id in the menu definition, so it reads the
   * cluster the reader is already in. `path` is then only the static fallback.
   */
  build?: (scope: Scope) => string;
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

/** Where a module child points, given the scope the shell is currently in. */
function childHref(child: ModuleChild, scope: Scope): string {
  return child.build ? child.build(scope) : child.path;
}

/**
 * Whether a child's own route is the current page.
 *
 * Compared against the built href, not the static `path`: two entries can share the
 * static prefix `/clusters` while pointing at different pages, and a prefix test on the
 * static path would highlight both.
 */
function childMatches(child: ModuleChild, pathname: string, scope: Scope): boolean {
  if (!child.build) return pathname.startsWith(child.path);
  const href = child.build(scope);
  return pathname === href || pathname.startsWith(`${href}/`);
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
      ? 'bg-ai-accent font-medium text-ai-accent-fg'
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
  const { user } = useAuth();
  const { locale, setLocale } = useLocale();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(readStoredCollapsed);
  const location = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();

  /*
   * Client-side navigation for the sidebar.
   *
   * Without this every click between two resource pages was a full document
   * load: ~1.5 MB of JS re-fetched, the session re-validated, the shell rebuilt.
   * Same area or not, the page flashed. Handing the click to the router keeps the
   * SPA alive, so a switch inside the workbench costs only the data request.
   *
   * Modified clicks and explicit targets stay with the browser — "open in new
   * tab" must still work.
   */
  const onNavigate = React.useCallback(
    (href: string, event: React.MouseEvent<HTMLAnchorElement>): boolean => {
      if (event.defaultPrevented) return false;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return false;
      if (event.currentTarget.target && event.currentTarget.target !== '_self') return false;
      void navigate({ href });
      return true;
    },
    [navigate],
  );
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
      : {
          ...DEFAULT_SCOPE,
          // A cluster console URL names its cluster; everything else falls back to the one
          // the reader was last in, then to the default. Without this the header's 集群管理
          // entry sends everyone to `host` even after they switched away from it.
          cluster: readLastCluster(user?.name ?? '') || DEFAULT_SCOPE.cluster,
        };
  }, [location, user?.name]);

  /*
   * The active sidebar row is the area the current page belongs to, resolved from
   * the page segment through the registry — not a substring match on the URL.
   * Substring matching broke as soon as an area key was a prefix of another
   * (`services` inside `serviceaccounts`).
   */
  /**
   * The cluster console (`/kube-frontend/clusters/<id>/<page>`) is its own scope.
   *
   * The sidebar there is the cluster's menu — 节点、项目、配置字典… — rather than the
   * project areas: those pages live under a project, and offering them from a cluster
   * console silently teleports the reader into one (usually `default`). The old console
   * puts the cluster menu in the sidebar, which is what "进入集群后管理它" looks like.
   */
  const clusterPath = React.useMemo(() => {
    const match = /^\/kube-frontend\/clusters\/([^/]+)(?:\/([^/?#]+))?/.exec(location);
    if (!match?.[1]) return null;
    return { cluster: decodeURIComponent(match[1]), segment: match[2] ? decodeURIComponent(match[2]) : '' };
  }, [location]);

  /**
   * The workspace console (`/kube-frontend/workspaces/<ws>/<page>`), its own scope.
   *
   * It sits above projects and below the platform: the sidebar there is the workspace's
   * menu (概览/项目/企业空间成员), not a project's. Without this branch the shell would fall
   * through to the project menu and highlight nothing.
   */
  const workspacePath = React.useMemo(() => {
    const match = /^\/kube-frontend\/workspaces\/([^/?#]+)(?:\/([^/?#]+))?/.exec(location);
    if (!match?.[1]) return null;
    return { workspace: decodeURIComponent(match[1]), segment: match[2] ? decodeURIComponent(match[2]) : '' };
  }, [location]);

  /**
   * The platform's own pages — the fleet list and the two platform areas.
   *
   * They are neither a project nor one cluster, so neither of those menus belongs there.
   * The old console gives `/access` and `/settings` a platform sidebar and leaves
   * `/clusters` full width; this app shows the platform menu on all three, so a reader
   * always has a way to the sibling platform pages instead of a project menu that would
   * silently move them into `default`.
   */
  const platformChildren = React.useMemo(
    () => MODULES.find((module) => module.key === 'platform')?.children ?? [],
    [],
  );

  const platformScope = React.useMemo(() => {
    if (clusterPath) return false;
    if (location === `${BASE}/clusters` || location === `${BASE}/clusters/`) return true;
    return [`${BASE}/access`, `${BASE}/settings`, `${BASE}/apps-manage`].some(
      (root) => location === root || location.startsWith(`${root}/`),
    );
  }, [clusterPath, location]);

  const platformActiveChild = platformScope
    ? platformChildren.find((child) => childMatches(child, location, scope))
    : undefined;

  const activeArea = clusterPath
    ? areaOfPage('cluster', clusterPath.segment)
    : workspacePath
      ? areaOfPage('workspace', workspacePath.segment)
      : areaOfPage('project', projectPageSegment(location));
  const activeKey = clusterPath
    ? (clusterPath.segment || activeArea?.defaultPage || '')
    : workspacePath
      ? (workspacePath.segment || activeArea?.defaultPage || '')
      : platformScope
        ? platformActiveChild?.key
        : activeArea?.key;

  /**
   * Sidebar rows: one per project area, with the drawer closing on navigation.
   *
   * Memoised on the scope and language so typing in a page's search box does not
   * rebuild the sidebar's nodes.
   */
  const sidebarItems = React.useMemo<MenuNode[]>(() => {
    if (clusterPath) {
      const root = `/kube-frontend/clusters/${encodeURIComponent(clusterPath.cluster)}`;
      /*
       * The cluster menu is grouped, as the old console's is: eleven flat entries is
       * past the point where a reader can find one without reading all of them.
       *
       * A group is a collapsible node whose children are the pages (ai-kit's Menu opens
       * the group that contains the active page, so a refresh does not lose your place).
       * Pages without a `groupKey` stay at the top level — that is where 概览 belongs.
       */
      const nodes: MenuNode[] = [];
      const groups = new Map<string, MenuNode>();
      for (const area of areasFor('cluster')) {
        for (const page of areaPages(area)) {
          const leaf: MenuNode = {
            key: page.key,
            label: t(page.titleKey),
            icon: <Icon name={area.icon} size={14} />,
            href: `${root}/${page.path}`,
            onClick: () => setDrawerOpen(false),
          };
          if (!page.groupKey) {
            nodes.push(leaf);
            continue;
          }
          const existing = groups.get(page.groupKey);
          if (existing) {
            existing.children?.push(leaf);
            continue;
          }
          const group: MenuNode = {
            // A distinct key: the page keys are leaves and the shell looks one of them up
            // to highlight, so a group may not reuse one.
            key: `cluster:group:${page.groupKey}`,
            label: t(page.groupKey),
            children: [leaf],
          };
          groups.set(page.groupKey, group);
          nodes.push(group);
        }
      }
      return nodes;
    }
    if (workspacePath) {
      /*
       * The workspace menu, built from the registry like the project and cluster menus.
       * `/kube-frontend/workspaces/<ws>/<page>` is the old console's shape for this scope.
       */
      const root = `/kube-frontend/workspaces/${encodeURIComponent(workspacePath.workspace)}`;
      return areasFor('workspace').flatMap((area) =>
        areaPages(area).map((page) => ({
          key: page.key,
          label: t(page.titleKey),
          icon: <Icon name={area.icon} size={14} />,
          href: `${root}/${page.path}`,
          onClick: () => setDrawerOpen(false),
        })),
      );
    }
    if (platformScope) {
      /*
       * The platform entries, taken from the header's own menu rather than a second list:
       * 集群管理 / 配置字典 / 访问控制 / 应用商店管理 / 平台设置. `childMatches` is the same
       * comparison the header uses, so the two surfaces never disagree about the current
       * page.
       */
      return platformChildren.map((child) => ({
        key: child.key,
        label: (
          <span className="flex items-center gap-2">
            <Icon name={child.icon} size={14} />
            {t(child.labelKey)}
          </span>
        ),
        href: childHref(child, scope),
        onClick: () => setDrawerOpen(false),
      }));
    }
    return areasFor('project').map((area) => {
      const entry = areaEntry(area, scope);
      return {
        key: entry.key,
        label: t(entry.labelKey),
        icon: <Icon name={entry.icon} size={14} />,
        href: entry.build(scope),
        onClick: () => setDrawerOpen(false),
      };
    });
  }, [clusterPath, location, platformChildren, platformScope, scope, t]);

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
      {/* Warms the chunks several areas share (the YAML editor) while the first
          screen settles, instead of paying for them on the first "edit YAML". */}
      <SharedChunkWarmer />
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
              {...(item.children?.find((child) => childMatches(child, location, scope))?.key
                ? { activeChildKey: item.children.find((child) => childMatches(child, location, scope))!.key }
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
            items={MODULES.flatMap<DropdownItem>((item) => {
              if (!item.children) {
                return [
                  {
                    key: item.key,
                    label: t(item.labelKey),
                    checked: activeModuleKey === item.key,
                    onSelect: () => window.location.assign(item.path),
                  },
                ];
              }
              /*
               * Grouped children carry a heading. A heading is a disabled item so it
               * stays out of the keyboard cycle: picking it would mean nothing.
               */
              const rows: DropdownItem[] = [];
              let lastGroup: string | undefined;
              for (const child of item.children) {
                if (child.groupKey && child.groupKey !== lastGroup) {
                  /*
                   * The heading rides on an ordinary item whose `onSelect` does
                   * nothing: `DropdownItem` has no non-interactive kind, and a
                   * `disabled` one is dropped from the DOM by Radix, which made the
                   * heading vanish rather than merely read as a label.
                   */
                  rows.push({
                    key: `${item.key}:group:${child.groupKey}`,
                    label: (
                      <span className="text-[11px] font-medium uppercase tracking-wide text-ai-fg-faint">
                        {t(child.groupKey)}
                      </span>
                    ),
                    onSelect: () => undefined,
                  });
                  lastGroup = child.groupKey;
                }
                rows.push({
                  key: child.key,
                  label: (
                    <span className={cn('flex items-center gap-2', child.groupKey ? 'pl-3' : undefined)}>
                      <Icon name={child.icon} size={14} />
                      {t(child.labelKey)}
                    </span>
                  ),
                  checked: childMatches(child, location, scope),
                  onSelect: () => window.location.assign(childHref(child, scope)),
                });
              }
              return rows;
            })}
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
              {clusterPath ? (
                <ClusterSwitcher current={clusterPath.cluster} />
              ) : null}
              <div className="flex flex-col gap-1">
                <Menu items={sidebarItems} onNavigate={onNavigate} {...(activeKey ? { activeKey } : {})} />
              </div>
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
              {clusterPath ? (
                /*
                 * The old console opens the cluster console with this block: the cluster
                 * you are in, and a way to the others. It sits above the menu because it
                 * scopes everything below it.
                 */
                <div className="border-b border-ai-line pb-2">
                  <ClusterSwitcher current={clusterPath.cluster} collapsed={collapsed} />
                </div>
              ) : null}
              <Menu
                items={sidebarItems}
                collapsed={collapsed}
                onNavigate={onNavigate}
                {...(activeKey ? { activeKey } : {})}
              />
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
 * The signed-in account: personal settings and sign-out.
 *
 * The old console put this at the bottom of the sidebar; here it sits in the top
 * bar next to the language switch, because the sidebar's bottom edge is taken by
 * the collapse control and a second control there competes with it.
 *
 * 用户设置 is here rather than in the sidebar because it is not a place in the console —
 * it is a property of the account, like the language switch beside it, and the old console
 * reached it the same way (头像 → 用户设置).
 */
function UserMenu(): React.ReactElement | null {
  const t = useT();
  const { user, signOut } = useAuth();
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  if (!user) return null;
  const label = user.displayName ?? user.name;
  const leave = (): void => void signOut().then(() => window.location.assign('/login'));

  return (
    <React.Fragment>
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
          {
            key: 'settings',
            // The handle sits on the label because `DropdownItem` has no id of its own; the
            // menu item is what handles the click, so a test (or an agent) targets the label.
            label: <span {...actionProps('shell:user-settings')}>{t('userSettings.title')}</span>,
            onSelect: () => setSettingsOpen(true),
          },
          { key: 'signout', label: t('login.signOut'), onSelect: leave },
        ]}
      />
      <UserSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        /*
         * A password change ends the session: the platform keeps the old token valid (verified),
         * so the console has to sign out itself. Same sequence as 退出登录, so there is one way
         * to leave the console rather than two.
         */
        onSignedOut={leave}
      />
    </React.Fragment>
  );
}
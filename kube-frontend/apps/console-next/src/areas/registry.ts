import type { IconName } from '@kube-ai-hub/ui';
import type { LocaleKey } from '@kube-ai-hub/locales';

/**
 * Areas: the old console's functional grouping, declared once.
 *
 * The old console groups its pages in `server/config.yaml` — 应用负载 / 存储 /
 * 配置 / 监控告警 / 项目设置 — and every navigation surface reads that one file:
 * the sidebar, the breadcrumb and the tabs inside a group. Rebuilding the same
 * information in four places (sidebar, tab bar, breadcrumb, AI manifest) is how a
 * console with forty pages ends up with three different answers to "what belongs
 * in Configuration".
 *
 * So this file is the only place an area is described. Adding a page to an area
 * is an entry here plus its route; no navigation code changes.
 *
 * Scope matters because the same area key can exist at project and cluster level
 * (the old console has both 配置 groups, with different contents). Pages are
 * matched on the route's scope first, then on the page segment.
 */

/** Where a page lives; the shell derives it from the URL. */
export type AreaScope = 'project' | 'cluster' | 'platform';

/** One navigable page inside an area. */
export interface AreaPage {
  /** Route segment, exactly as the old console spells it (`deployments`, `pods`). */
  key: string;
  /** Path for the page, relative to the scope root (no leading slash). */
  path: string;
  titleKey: LocaleKey;
  /** Login/authorisation key the old console gates the page on, if any. */
  authKey?: string;
  /**
   * Whether the page is implemented in this app yet.
   *
   * Declared rather than inferred so a planned page can appear in the sidebar as
   * "not yet available" instead of silently missing — the difference between
   * "we have not migrated it" and "it does not exist".
   */
  status?: 'ready' | 'planned';
}

/** A titled group of pages — the tabs of an area. */
export interface AreaSection {
  key: string;
  titleKey: LocaleKey;
  /** Pages in the order the old console's navigation lists them. */
  pages: readonly AreaPage[];
}

export interface Area {
  key: string;
  scope: AreaScope;
  titleKey: LocaleKey;
  icon: IconName;
  /**
   * The area's pages, flat. Order is the tab order.
   *
   * Sections exist only where the old console renders nested navigation (工作负载
   * with three tabs, 任务 with two); a flat area is the common case and must stay
   * cheap to declare.
   */
  sections?: readonly AreaSection[];
  pages?: readonly AreaPage[];
  /** Page a bare area URL opens. */
  defaultPage?: string;
}

/**
 * The areas this app knows about, in the old console's sidebar order.
 *
 * Only 配置 is implemented so far; the others are declared with `status: 'planned'`
 * so the navigation can show where the rest of the console is going without
 * pretending it is there. This list grows one area per migration iteration.
 */
export const AREAS: readonly Area[] = [
  {
    key: 'config',
    scope: 'project',
    titleKey: 'nav.groupConfig',
    icon: 'hammer',
    defaultPage: 'configmaps',
    pages: [
      // The old console lists 保密字典 before 配置字典; the link order is what
      // people remember, so it is kept even though configmaps shipped first.
      { key: 'secrets', path: 'secrets', titleKey: 'secrets.title', status: 'ready' },
      { key: 'configmaps', path: 'configmaps', titleKey: 'configmaps.title', status: 'ready' },
      { key: 'serviceaccounts', path: 'serviceaccounts', titleKey: 'serviceaccounts.title', status: 'ready' },
    ],
  },
  {
    key: 'app-workloads',
    scope: 'project',
    titleKey: 'nav.groupWorkload',
    icon: 'appcenter',
    defaultPage: 'deployments',
    /*
     * The old console nests these in the sidebar (工作负载 3 页签, 任务 2 页签). The
     * tab strip is flat and scrollable instead: two levels of tabs for eight pages
     * costs a click and hides pages behind a group, while the sidebar already
     * carries the area. Order follows `projectNavs` so the strip reads like the
     * old navigation.
     */
    pages: [
      { key: 'deployments', path: 'deployments', titleKey: 'workloads.deployments.title', status: 'ready' },
      { key: 'statefulsets', path: 'statefulsets', titleKey: 'workloads.statefulsets.title', status: 'ready' },
      { key: 'daemonsets', path: 'daemonsets', titleKey: 'workloads.daemonsets.title', status: 'ready' },
      { key: 'jobs', path: 'jobs', titleKey: 'workloads.jobs.title', status: 'ready' },
      { key: 'cronjobs', path: 'cronjobs', titleKey: 'workloads.cronjobs.title', status: 'ready' },
      { key: 'pods', path: 'pods', titleKey: 'workloads.pods.title', status: 'ready' },
      { key: 'services', path: 'services', titleKey: 'workloads.services.title', status: 'ready' },
      { key: 'ingresses', path: 'ingresses', titleKey: 'workloads.ingresses.title', status: 'ready' },
    ],
  },
  {
    key: 'storage',
    scope: 'project',
    titleKey: 'nav.groupStorage',
    icon: 'database',
    defaultPage: 'persistentvolumeclaims',
    pages: [
      { key: 'persistentvolumeclaims', path: 'persistentvolumeclaims', titleKey: 'storage.volumes.title', status: 'ready' },
      { key: 'volumesnapshots', path: 'volumesnapshots', titleKey: 'storage.snapshots.title', status: 'ready' },
    ],
  },
  {
    key: 'monitoring',
    scope: 'project',
    titleKey: 'nav.groupMonitoring',
    icon: 'monitor',
    defaultPage: 'alerts',
    pages: [
      { key: 'alerts', path: 'alerts', titleKey: 'monitoring.alerts.title', status: 'ready' },
      { key: 'alertingrules', path: 'alertingrules', titleKey: 'monitoring.rules.title', status: 'ready' },
    ],
  },
  {
    key: 'settings',
    scope: 'project',
    titleKey: 'nav.groupSettings',
    icon: 'cogwheel',
    defaultPage: 'baseinfo',
    pages: [
      // 基本信息 first: the old console lists it before the access-control pages.
      { key: 'baseinfo', path: 'baseinfo', titleKey: 'settings.baseInfo.title', status: 'ready' },
      { key: 'roles', path: 'roles', titleKey: 'settings.roles.title', status: 'ready' },
      { key: 'members', path: 'members', titleKey: 'settings.members.title', status: 'ready' },
      { key: 'networkpolicies', path: 'networkpolicies', titleKey: 'settings.network.title', status: 'ready' },
      { key: 'gateways', path: 'gateways', titleKey: 'settings.gateway.title', status: 'ready' },
    ],
  },
  {
    key: 'cluster-management',
    scope: 'cluster',
    titleKey: 'nav.groupCluster',
    icon: 'cluster',
    defaultPage: 'overview',
    /*
     * Cluster-scoped: the pages sit under `/kube-frontend/clusters/<id>/…` with no
     * workspace and no project. The old console puts them in 集群管理, reached from
     * the platform switcher rather than from inside a project.
     */
    pages: [
      // Overview is the landing page, as it is in the old console: the first question
      // about a cluster is "what is it and is anything wrong", not "list its nodes".
      { key: 'overview', path: 'overview', titleKey: 'cluster.overview.title', status: 'ready' },
      { key: 'nodes', path: 'nodes', titleKey: 'cluster.nodes.title', status: 'ready' },
      { key: 'namespaces', path: 'namespaces', titleKey: 'cluster.projects.title', status: 'ready' },
      { key: 'components', path: 'components', titleKey: 'cluster.components.title', status: 'ready' },
      // The cluster console's ConfigMap list spans every project; the project console
      // has its own page. It existed as a route but was missing here, so the sidebar
      // could not reach it.
      { key: 'configmaps', path: 'configmaps', titleKey: 'clusterConfigMaps.title', status: 'ready' },
      { key: 'storageclasses', path: 'storageclasses', titleKey: 'cluster.storageClasses.title', status: 'ready' },
      { key: 'persistentvolumes', path: 'persistentvolumes', titleKey: 'cluster.persistentVolumes.title', status: 'ready' },
      // Editable cluster attributes. Only the description is writable: the rest of the
      // object is owned by the installer, and a console that edited it would disagree
      // with the thing that actually configures the cluster.
      { key: 'settings', path: 'settings', titleKey: 'cluster.settings.title', status: 'ready' },
      // Trends over time. The old console puts these under 集群监控; the numbers come
      // from the monitoring API's range query, which is a different read from the
      // current-value panel on the overview.
      { key: 'monitor', path: 'monitor', titleKey: 'cluster.monitor.title', status: 'ready' },
      // The ranking under 集群监控: which node is hot, not every attribute of every node.
      { key: 'nodeUsage', path: 'node-usage', titleKey: 'cluster.nodeUsage.title', status: 'ready' },
    ],
  },
  {
    key: 'access',
    scope: 'platform',
    titleKey: 'nav.groupAccess',
    icon: 'key',
    defaultPage: 'users',
    /*
     * Platform scope: no workspace, no cluster, no project. These are the platform's
     * own records, so the area renders under `/kube-frontend/access/…`.
     */
    pages: [
      { key: 'users', path: 'users', titleKey: 'platform.users.title', status: 'ready' },
      { key: 'clusterroles', path: 'clusterroles', titleKey: 'platform.roles.title', status: 'ready' },
      { key: 'workspaces', path: 'workspaces', titleKey: 'platform.workspaces.title', status: 'ready' },
    ],
  },
  {
    key: 'platform-settings',
    scope: 'platform',
    titleKey: 'nav.groupPlatformSettings',
    icon: 'cogwheel',
    defaultPage: 'info',
    pages: [
      { key: 'info', path: 'info', titleKey: 'platform.settings.info', status: 'ready' },
      { key: 'notifications', path: 'notifications', titleKey: 'platform.settings.channels', status: 'ready' },
    ],
  },
] as const;

/** Areas of one scope. */
export function areasFor(scope: AreaScope): readonly Area[] {
  return AREAS.filter((area) => area.scope === scope);
}

/** Every page of an area, flattened, in tab order. */
export function areaPages(area: Area): readonly AreaPage[] {
  if (area.pages) return area.pages;
  return (area.sections ?? []).flatMap((section) => section.pages);
}

/** The page whose route segment is `segment`, if the area has one. */
export function findPage(area: Area, segment: string): AreaPage | undefined {
  return areaPages(area).find((page) => page.key === segment);
}

/** The area a page segment belongs to, within a scope. */
export function areaOfPage(scope: AreaScope, segment: string): Area | undefined {
  return areasFor(scope).find((area) => findPage(area, segment) !== undefined);
}

/**
 * Path of a page inside a scope, for building links.
 *
 * **No area segment in the URL.** Pages keep the old console's paths exactly
 * (`/kube-frontend/<workspace>/clusters/<cluster>/projects/<namespace>/configmaps`),
 * so a bookmark from the old console maps onto the new one by prefixing
 * `/kube-frontend`, nothing else. The area is a navigation concept: it decides
 * which group a page belongs to and which tabs its breadcrumb shows, not where
 * the page lives.
 *
 * `scopeRoot` carries the route's own parameters, which is why it is passed in
 * rather than built here: that keeps the registry a plain data table a test can
 * enumerate without a router.
 */
export function pageHref(scopeRoot: string, page: AreaPage): string {
  const root = scopeRoot.replace(/\/+$/, '');
  return `${root}/${page.path}`.replace(/\/{2,}/g, '/');
}

import type { LocaleKey } from '@kube-ai-hub/locales';

/**
 * The in-page tabs of 集群监控.
 *
 * One navigation entry, five tabs, deep-linkable through `?tab=`: the old console
 * split the same five pages behind a sub-navigation, and flattening them into one
 * long page made "where is the scheduler" a scroll hunt. The order is the old
 * console's, and the overview leads because it answers "is the cluster healthy"
 * before "what is it doing".
 */
export const MONITOR_TABS = ['overview', 'resource', 'apiserver', 'scheduler', 'ranking'] as const;

/** The five tabs every cluster has. */
export type MonitorBaseTabKey = (typeof MONITOR_TABS)[number];

/**
 * Every tab a page can show, including the conditional etcd one.
 *
 * `etcd` is deliberately **not** in {@link MONITOR_TABS}: it is only offered when the
 * cluster actually wires etcd into monitoring (the old console behaved the same
 * way), so it is appended by the page after a probe rather than drawn for every
 * cluster and then found empty.
 */
export type MonitorTabKey = MonitorBaseTabKey | 'etcd';

/** The tab a URL without a valid `tab` means. */
export const DEFAULT_MONITOR_TAB: MonitorTabKey = 'overview';

/** Where each base tab's label comes from; the host translates it. */
export const MONITOR_TAB_LABEL_KEYS: Record<MonitorBaseTabKey, LocaleKey> = {
  overview: 'cluster.monitor.tab.overview',
  resource: 'cluster.monitor.tab.resource',
  apiserver: 'cluster.monitor.tab.apiserver',
  scheduler: 'cluster.monitor.tab.scheduler',
  ranking: 'cluster.monitor.tab.ranking',
};

/** One entry of the tab strip. */
export interface MonitorTabItem {
  key: MonitorTabKey;
  /** Locale key for the trigger label. */
  labelKey: LocaleKey;
  /** Stable automation handle for the trigger. */
  aiId: string;
  /**
   * True when the page decides whether the tab exists.
   *
   * A conditional tab must also be handled on deep link: `?tab=etcd` falls back to
   * the overview when the probe says the tab would be hidden, instead of painting
   * an empty panel.
   */
  conditional?: boolean;
}

/**
 * The etcd tab, offered only when `etcdServiceMonitor` answers 200.
 *
 * The overview's component band already says "etcd 未接入监控" for the other branch;
 * the tab is where the reported case belongs.
 */
export const ETCD_TAB: MonitorTabItem = {
  key: 'etcd',
  labelKey: 'cluster.monitor.tab.etcd',
  aiId: 'cluster-monitor:tab:etcd',
  conditional: true,
};

/** The five base tabs as strip entries, in render order. */
export const MONITOR_TAB_ITEMS: readonly MonitorTabItem[] = MONITOR_TABS.map((key) => ({
  key,
  labelKey: MONITOR_TAB_LABEL_KEYS[key],
  aiId: `cluster-monitor:tab:${key}`,
}));

/** Narrow an unknown value (a search param, a stored value) to a tab key. */
export function isMonitorTabKey(value: unknown): value is MonitorTabKey {
  return (
    typeof value === 'string' &&
    ((MONITOR_TABS as readonly string[]).includes(value) || value === ETCD_TAB.key)
  );
}

/**
 * Read `?tab=`; an unknown value is ignored, as the route contract says.
 *
 * Returning `undefined` (rather than the default) lets the route keep the search
 * object empty when the URL did not name a tab -- the canonical overview URL stays
 * `/monitor` instead of growing `?tab=overview`.
 */
export function parseMonitorTab(value: unknown): MonitorTabKey | undefined {
  return isMonitorTabKey(value) ? value : undefined;
}

/** The four states an agent surface understands; tabs report the state of their main query. */
export type MonitorTabState = 'loading' | 'ready' | 'empty' | 'error';

/**
 * Everything a tab needs from the page.
 *
 * The page owns the header controls (window + auto refresh) and the query range;
 * a tab owns its own reads, so switching tabs never mounts -- and therefore never
 * queries -- a tab that is not on screen. `rangeKey` doubles as the query-key
 * identity because the range timestamps already change per window.
 */
export interface WindowContext {
  cluster: string;
  /**
   * Identity of the selected window, e.g. `1h` or `custom`.
   *
   * Also the query-key component: the range timestamps already change per window,
   * so two windows of the same length still cache separately, while a preset key
   * keeps the entry stable across auto-refresh ticks.
   */
  rangeKey: string;
  /** Epoch milliseconds, inclusive lower bound. */
  start: number;
  /** Epoch milliseconds, inclusive upper bound. */
  end: number;
  /** Prometheus duration for the range query, e.g. '60s'. */
  step: string;
  /**
   * Whether the header's 自动刷新 switch is on.
   *
   * The page already moves `start`/`end` every {@link AUTO_REFRESH_INTERVAL_MS},
   * which re-queries any tab reading those fields; a tab that queries something
   * else (the ranking list) can use this flag to poll at the same cadence.
   */
  live?: boolean;
  /**
   * Bumped by the page header's 刷新, and only by it.
   *
   * A tab cannot see the header's button, and `live` describes the timer. This is
   * how a chart inside a tab learns that the refresh now in flight was the reader's
   * — so its veil matches the one its own refresh button draws.
   */
  manualTick?: number;
  /**
   * Report the tab's main query state to the page's {@link AiSurface}.
   *
   * The page cannot see a tab's queries, so the active tab owns the surface state:
   * the contract says `cluster-monitor:surface` reflects the current tab's main
   * read, and "loading" must not be a permanent guess.
   */
  onStateChange?: (state: MonitorTabState) => void;
}

/**
 * Alias with the same shape, for callers that read the name as "window context".
 * Both names are exported so the contract name and a self-describing name coexist.
 */
export type MonitorWindowContext = WindowContext;

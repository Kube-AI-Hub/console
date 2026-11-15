import type { Client } from './client';
import { baseOf, type KubeObject, type ResourceBase } from './resources';

/**
 * Gray release (canary / blue-green / traffic mirroring).
 *
 * A gray release is a KubeSphere `Strategy` custom resource in the servicemesh API
 * group: the controller turns it into Istio VirtualServices. The object carries both
 * the intent (`spec.type`, versions) and the controller's progress
 * (`status.conditions`), which is why the list derives a status instead of showing a
 * `phase` that does not exist on the CRD.
 *
 * Both endpoints answer 200 on this cluster; the page reads the **native** CRD endpoint
 * (`/apis/servicemesh.kubesphere.io/...`) because it returns the object verbatim and
 * needs no second request for status. The kapis proxy (`/kapis/servicemesh...`) works
 * too but returns the same items in the resource-proxy envelope.
 */

const SERVICE_MESH_VERSION = 'servicemesh.kubesphere.io/v1alpha2';

/** What the strategy asks the mesh to do. */
export type StrategyType = 'Canary' | 'Bluegreen' | 'Mirror' | (string & {});

/**
 * Derived from `status.conditions` (types `Complete` / `Failed`), falling back to
 * `completionTime`; `unknown` is a real state (the controller has not reported yet),
 * not an error.
 */
export type StrategyStatus = 'completed' | 'failed' | 'progressing' | 'unknown';

/** One row of the gray-release list. */
export interface StrategySummary extends ResourceBase {
  /** `spec.type`: Canary / Bluegreen / Mirror. */
  type: StrategyType;
  /**
   * The Istio host the strategy routes, i.e. the service being released.
   *
   * `spec.template.spec.hosts[0]` is the authoritative source; a strategy created
   * without a template falls back to the selector's `app` label and then to the
   * VirtualService name, so the column does not read "-" for an object that does have
   * a target somewhere.
   */
  targetService: string;
  status: StrategyStatus;
  /** Condition message/reason, shown as the badge's tooltip when present. */
  statusDetail: string;
  /**
   * Distinct version subsets in display order (the release candidate first, the
   * principal last), so the list can show what the strategy splits without loading
   * the whole object into the row.
   */
  versionOrder: string[];
  /** Route weight per version, in percent; a version without an entry has no explicit weight. */
  weights: Record<string, number>;
}

export interface KubeStrategy extends KubeObject {
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/** First non-empty string in a list of candidates. */
function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/**
 * The service a strategy targets.
 *
 * Istio's `hosts` entry is the host the VirtualService serves — for a KubeSphere
 * release that is the service's name — so it is the first choice. The selector and the
 * template metadata are fallbacks for a partially-created object.
 */
export function targetServiceOf(item: KubeStrategy): string {
  const spec = item.spec ?? {};
  const template = asRecord(spec['template']);
  const templateSpec = asRecord(template?.['spec']);
  const hosts = Array.isArray(templateSpec?.['hosts']) ? (templateSpec['hosts'] as unknown[]) : [];
  const selector = asRecord(spec['selector']);
  const matchLabels = asRecord(selector?.['matchLabels']);
  const templateMetadata = asRecord(template?.['metadata']);
  const templateLabels = asRecord(templateMetadata?.['labels']);
  return firstString(
    hosts[0],
    matchLabels?.['app'],
    templateLabels?.['app'],
    templateMetadata?.['name'],
    item.metadata?.name,
  );
}

/** Read the controller's verdict out of `status.conditions`. */
export function strategyStatusOf(item: KubeStrategy): { status: StrategyStatus; detail: string } {
  const status = item.status ?? {};
  const conditions = Array.isArray(status['conditions']) ? (status['conditions'] as Array<Record<string, unknown>>) : [];
  const failed = conditions.find(
    (condition) => String(condition['type'] ?? '') === 'Failed' && String(condition['status'] ?? '') === 'True',
  );
  if (failed) {
    return { status: 'failed', detail: firstString(failed['message'], failed['reason']) };
  }
  const complete = conditions.find(
    (condition) => String(condition['type'] ?? '') === 'Complete' && String(condition['status'] ?? '') === 'True',
  );
  if (complete) {
    return { status: 'completed', detail: firstString(complete['message'], complete['reason']) };
  }
  // A recorded completion time without a condition still means the controller finished.
  if (typeof status['completionTime'] === 'string' && status['completionTime']) {
    return { status: 'completed', detail: '' };
  }
  if (conditions.length > 0) {
    const latest = conditions[conditions.length - 1] ?? {};
    return { status: 'progressing', detail: firstString(latest['message'], latest['reason']) };
  }
  return { status: 'unknown', detail: '' };
}

/** Version subsets and their weights, the two facts the list and the detail share. */
function versionFactsOf(spec: Record<string, unknown>): { versionOrder: string[]; weights: Record<string, number> } {
  const protocol = protocolOf(spec);
  const rules = rulesOf(spec, protocol);
  const principal = firstString(spec['principal']);
  const ordered: string[] = [];
  const weights: Record<string, number> = {};
  for (const route of destinationsOf(rules[0])) {
    if (!route.subset) continue;
    if (route.weight !== undefined) weights[route.subset] = route.weight;
    if (route.subset !== principal && !ordered.includes(route.subset)) ordered.push(route.subset);
  }
  const mirror = firstString(recordOf(rules[0]?.['mirror'])?.['subset']);
  if (mirror && !ordered.includes(mirror)) ordered.push(mirror);
  if (principal && !ordered.includes(principal)) ordered.push(principal);
  return { versionOrder: ordered, weights };
}

export function toStrategySummary(item: KubeStrategy): StrategySummary {
  const status = strategyStatusOf(item);
  const spec = item.spec ?? {};
  return {
    ...baseOf(item),
    type: firstString(spec['type']) || 'unknown',
    targetService: targetServiceOf(item),
    status: status.status,
    statusDetail: status.detail,
    ...versionFactsOf(spec),
  };
}

/**
 * List path for one project.
 *
 * Host cluster writes/reads through the plain group path; a member cluster needs the
 * `clusters/<id>` segment, the same shape every other native kube write in this app
 * uses. Only the host cluster is verified on this installation.
 */
function strategiesPath(cluster: string, namespace: string): string {
  const clusterSegment = cluster && cluster !== 'host' ? `clusters/${encodeURIComponent(cluster)}/` : '';
  return `/apis/${SERVICE_MESH_VERSION}/${clusterSegment}namespaces/${encodeURIComponent(namespace)}/strategies`;
}

export function strategiesApi(client: Client) {
  return {
    /**
     * Every strategy of one project.
     *
     * The CRD list is not paginated (the controller writes a handful per project), so
     * the page filters and pages locally; asking for a page would be a parameter the
     * server ignores.
     */
    async list(params: { cluster: string; namespace: string; signal?: AbortSignal }): Promise<{ items: StrategySummary[] }> {
      const body = await client.request<{ items?: KubeStrategy[] }>(strategiesPath(params.cluster, params.namespace), {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return { items: (body?.items ?? []).map(toStrategySummary) };
    },

    /**
     * Create one strategy.
     *
     * The caller supplies the whole manifest: the minimal viable object needs a type, a
     * selector matching the workload, and a VirtualService template whose host is the
     * service the release routes. The wizard builds exactly that and nothing else —
     * traffic weights and match rules stay at the controller's defaults until the
     * follow-up round.
     */
    async create(params: { cluster: string; namespace: string; body: KubeStrategy }): Promise<KubeStrategy> {
      return client.request<KubeStrategy>(strategiesPath(params.cluster, params.namespace), {
        method: 'POST',
        body: params.body,
      });
    },

    /**
     * One strategy, verbatim.
     *
     * The detail view needs the VirtualService routes, weights and match rules together
     * with the controller conditions, so it reads the object itself instead of a second
     * envelope: one request, one shape, the same shape the write path sends back.
     */
    async get(params: { cluster: string; namespace: string; name: string; signal?: AbortSignal }): Promise<KubeStrategy> {
      return client.request<KubeStrategy>(`${strategiesPath(params.cluster, params.namespace)}/${encodeURIComponent(params.name)}`, {
        ...(params.signal ? { signal: params.signal } : {}),
      });
    },

    /**
     * Replace one strategy (PUT on the object endpoint).
     *
     * The servicemesh CRD declares no status subresource and no merge keys for the nested
     * VirtualService fields, so callers send the whole object back with the resourceVersion
     * they read. That is the same write shape the old console used, and it is what makes
     * "read once, change one field, keep the rest" safe.
     */
    async update(params: { cluster: string; namespace: string; name: string; body: KubeStrategy }): Promise<KubeStrategy> {
      return client.request<KubeStrategy>(`${strategiesPath(params.cluster, params.namespace)}/${encodeURIComponent(params.name)}`, {
        method: 'PUT',
        body: params.body,
      });
    },

    /** Delete one strategy (detail-page action and test cleanup). */
    async remove(params: { cluster: string; namespace: string; name: string }): Promise<void> {
      await client.request(`${strategiesPath(params.cluster, params.namespace)}/${encodeURIComponent(params.name)}`, {
        method: 'DELETE',
      });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Release detail: versions, traffic weights, match rules, conditions  */
/* ------------------------------------------------------------------ */

/** How the strategy splits traffic, derived from spec.type plus the VirtualService shape. */
export type StrategyMode = 'traffic' | 'content' | 'bluegreen' | 'mirror' | 'unknown';

export type StrategyProtocol = 'http' | 'tcp';

/** One destination of a weighted route. */
export interface StrategyRoute {
  host: string;
  subset: string;
  /** Absent when the object never set a weight; Istio then splits evenly. Not 0. */
  weight?: number;
}

export type MatchKind = 'cookie' | 'header' | 'uri' | 'userAgent' | 'other';

export type MatchType = 'exact' | 'prefix' | 'regex' | 'unknown';

/** One request-content match rule and the versions it routes to. */
export interface StrategyMatchRule {
  /** 1-based position of the http rule that carries this match. */
  index: number;
  kind: MatchKind;
  /** Header name, or the key part of a cookie match; empty for uri / userAgent. */
  key: string;
  matchType: MatchType;
  value: string;
  /** Destination subsets of the rule's route, in object order. */
  targets: string[];
}

export interface StrategyCondition {
  type: string;
  status: string;
  reason: string;
  message: string;
  lastTransitionTime: string;
}

/** One version of the release, with the traffic fact that belongs to it. */
export interface StrategyVersion {
  version: string;
  /** principal = reference (old) version, canary = the new one, mirror = copied traffic. */
  role: 'principal' | 'canary' | 'mirror';
  /** Route weight in percent; absent when the object does not set one. */
  weight?: number;
  /** True when spec.governor names this version, i.e. it takes all incoming traffic. */
  governing: boolean;
}

/** Everything the release detail page shows, derived once from one object. */
export interface StrategyDetail extends StrategySummary {
  labels: Record<string, string>;
  principal: string;
  governor: string;
  strategyPolicy: string;
  mode: StrategyMode;
  protocol: StrategyProtocol;
  /** Destinations of the first http/tcp rule: the traffic split the page shows. */
  routes: StrategyRoute[];
  /** The mirrored destination for type Mirror. */
  mirror: StrategyRoute | null;
  versions: StrategyVersion[];
  matchRules: StrategyMatchRule[];
  conditions: StrategyCondition[];
  /** The object as read, for whole-object PUTs. */
  raw: KubeStrategy;
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function recordsOf(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as unknown[]).map(recordOf).filter((entry): entry is Record<string, unknown> => entry !== undefined) : [];
}

/** Which array the routes live in: http unless only tcp rules exist. */
function protocolOf(spec: Record<string, unknown>): StrategyProtocol {
  const templateSpec = recordOf(recordOf(spec['template'])?.['spec']);
  return recordsOf(templateSpec?.['http']).length > 0 ? 'http' : 'tcp';
}

function templateSpecOf(spec: Record<string, unknown>): Record<string, unknown> {
  const template = recordOf(spec['template']) ?? {};
  const templateSpec = recordOf(template['spec']) ?? {};
  template['spec'] = templateSpec;
  spec['template'] = template;
  return templateSpec;
}

function rulesOf(spec: Record<string, unknown>, protocol: StrategyProtocol): Array<Record<string, unknown>> {
  return recordsOf(templateSpecOf(spec)[protocol]);
}

function destinationsOf(rule: Record<string, unknown> | undefined): StrategyRoute[] {
  return recordsOf(rule?.['route']).map((entry) => {
    const destination = recordOf(entry['destination']) ?? {};
    const weight = entry['weight'];
    return {
      host: firstString(destination['host']),
      subset: firstString(destination['subset']),
      ...(typeof weight === 'number' ? { weight } : {}),
    };
  });
}

function matchRulesOf(spec: Record<string, unknown>, protocol: StrategyProtocol): StrategyMatchRule[] {
  const out: StrategyMatchRule[] = [];
  rulesOf(spec, protocol).forEach((rule, ruleIndex) => {
    const targets = destinationsOf(rule).map((route) => route.subset).filter(Boolean);
    recordsOf(rule['match']).forEach((match) => {
      const uri = recordOf(match['uri']);
      if (uri) {
        const matchType = (Object.keys(uri)[0] ?? 'unknown') as MatchType;
        out.push({ index: ruleIndex + 1, kind: 'uri', key: '', matchType, value: firstString(uri[matchType]), targets });
      }
      const headers = recordOf(match['headers']);
      if (headers) {
        for (const [key, raw] of Object.entries(headers)) {
          const value = recordOf(raw) ?? {};
          const matchType = (Object.keys(value)[0] ?? 'unknown') as MatchType;
          const kind: MatchKind = key === 'cookie' ? 'cookie' : key === 'User-Agent' ? 'userAgent' : 'header';
          out.push({
            index: ruleIndex + 1,
            kind,
            key: kind === 'header' ? key : '',
            matchType,
            value: firstString(value[matchType]),
            targets,
          });
        }
      }
      // A match kind this page does not model (method, queryParams, ...) still has to be
      // visible: silently dropping it would show "no match rules" for a content-routed release.
      for (const key of Object.keys(match)) {
        if (key === 'uri' || key === 'headers') continue;
        out.push({ index: ruleIndex + 1, kind: 'other', key, matchType: 'unknown', value: JSON.stringify(match[key] ?? ''), targets });
      }
    });
  });
  return out;
}

function modeOf(spec: Record<string, unknown>): StrategyMode {
  const type = firstString(spec['type']).toLowerCase();
  if (type.includes('mirror')) return 'mirror';
  if (type.includes('blue')) return 'bluegreen';
  if (!type) return 'unknown';
  const protocol = protocolOf(spec);
  const rules = rulesOf(spec, protocol);
  if (rules.length === 0) return 'unknown';
  if (rules.some((rule) => recordsOf(rule['match']).length > 0)) return 'content';
  return 'traffic';
}

function versionsOf(
  principal: string,
  governor: string,
  routes: StrategyRoute[],
  mirror: StrategyRoute | null,
): StrategyVersion[] {
  const byVersion = new Map<string, StrategyVersion>();
  const add = (version: string, role: StrategyVersion['role'], weight?: number): void => {
    if (!version) return;
    const existing = byVersion.get(version);
    if (existing) {
      if (existing.weight === undefined && weight !== undefined) existing.weight = weight;
      return;
    }
    byVersion.set(version, { version, role, ...(weight === undefined ? {} : { weight }), governing: governor === version });
  };
  // New versions first (the old console puts the new version on the left), principal last.
  for (const route of routes) {
    add(route.subset, route.subset === principal ? 'principal' : 'canary', route.weight);
  }
  add(principal, 'principal');
  if (mirror) add(mirror.subset, 'mirror');
  for (const version of byVersion.values()) version.governing = governor === version.version;
  return [...byVersion.values()].sort((left, right) => {
    if (left.version === principal && right.version !== principal) return 1;
    if (right.version === principal && left.version !== principal) return -1;
    return left.version.localeCompare(right.version);
  });
}

/** The full detail model of one strategy object. */
export function toStrategyDetail(item: KubeStrategy): StrategyDetail {
  const spec = item.spec ?? {};
  const summary = toStrategySummary(item);
  const protocol = protocolOf(spec);
  const firstRule = rulesOf(spec, protocol)[0];
  const routes = destinationsOf(firstRule);
  const principal = firstString(spec['principal']);
  const governor = firstString(spec['governor']);
  const mirrorDestination = recordOf(firstRule?.['mirror']);
  const mirror = mirrorDestination
    ? { host: firstString(mirrorDestination['host']), subset: firstString(mirrorDestination['subset']) }
    : null;
  const conditions = recordsOf(recordOf(item.status)?.['conditions']).map((condition) => ({
    type: firstString(condition['type']),
    status: firstString(condition['status']),
    reason: firstString(condition['reason']),
    message: firstString(condition['message']),
    lastTransitionTime: firstString(condition['lastTransitionTime']),
  }));
  return {
    ...summary,
    labels: item.metadata?.labels ?? {},
    principal,
    governor,
    strategyPolicy: firstString(spec['strategyPolicy']),
    mode: modeOf(spec),
    protocol,
    routes,
    mirror,
    versions: versionsOf(principal, governor, routes, mirror),
    matchRules: matchRulesOf(spec, protocol),
    conditions,
    raw: item,
  };
}

/* ---------------- writes: pure object builders ---------------- */

/** Whole-object clone: the CRD has no merge keys, so writes replace the object. */
function cloneStrategy(item: KubeStrategy): KubeStrategy {
  return JSON.parse(JSON.stringify(item)) as KubeStrategy;
}

/**
 * Set the new version's traffic share in percent and keep spec.governor consistent.
 *
 * 0 and 100 are not just the ends of the slider: at those values the strategy has a
 * single receiving version, and the old console expressed that as spec.governor. In
 * between, governor must be empty or the controller keeps sending everything to the
 * governing version regardless of the weights.
 */
export function withTrafficWeight(item: KubeStrategy, newWeight: number): KubeStrategy {
  const weight = Math.max(0, Math.min(100, Math.round(newWeight)));
  const next = cloneStrategy(item);
  const spec = recordOf(next.spec) ?? {};
  next.spec = spec;
  const principal = firstString(spec['principal']);
  const protocol = protocolOf(spec);
  const firstRule = rulesOf(spec, protocol)[0];
  if (!firstRule) throw new Error('strategy has no route to adjust');
  const routes = recordsOf(firstRule['route']);
  const destinations = routes.map((route) => recordOf(route['destination']) ?? {});
  const principalIndex = destinations.findIndex((destination) => firstString(destination['subset']) === principal);
  const newIndex = principalIndex === 0 ? 1 : 0;
  if (destinations.length < 2 || principalIndex < 0) throw new Error('strategy does not route two versions');
  routes[principalIndex] = { ...routes[principalIndex], weight: 100 - weight };
  routes[newIndex] = { ...routes[newIndex], weight };
  firstRule['route'] = routes;
  if (protocol === 'tcp') firstRule['match'] = [];
  const newVersion = firstString(destinations[newIndex]?.['subset']);
  spec['governor'] = weight === 100 ? newVersion : weight === 0 ? principal : '';
  return next;
}

/**
 * Set or clear the governing version.
 *
 * An empty string is the "no takeover" state: the routes decide again. This is the only
 * lever the CRD offers, so pause/resume are expressed as governor writes (the weights
 * are left untouched, which is what makes resume restore the previous split).
 */
export function withGovernor(item: KubeStrategy, version: string): KubeStrategy {
  const next = cloneStrategy(item);
  const spec = recordOf(next.spec) ?? {};
  next.spec = spec;
  spec['governor'] = version.trim();
  return next;
}

/** Pause: the principal version takes all traffic; the configured weights stay. */
export function pausedStrategy(item: KubeStrategy): KubeStrategy {
  return withGovernor(item, firstString(item.spec?.['principal']));
}

/** Resume: clear the takeover so the configured weights apply again. */
export function resumedStrategy(item: KubeStrategy): KubeStrategy {
  return withGovernor(item, '');
}

/**
 * Blue-green switch: one version receives 100 percent.
 *
 * Expressed through the same route weights the traffic slider writes, because the
 * controller applies whatever the VirtualService says; governor is then the explicit
 * statement of who owns the traffic.
 */
export function withBluegreenVersion(item: KubeStrategy, version: string): KubeStrategy {
  const principal = firstString(item.spec?.['principal']);
  return withTrafficWeight(item, version === principal ? 0 : 100);
}

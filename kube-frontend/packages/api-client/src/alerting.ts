import type { Client } from './client';
import { clusterScoped } from './paths';
import { ApiError } from './errors';
import { KAPIS_ALERTING, baseOf, resourceApi, type KubeObject, type ResourceBase } from './resources';

/**
 * Monitoring and alerting: alert messages and alerting rules.
 *
 * These are **not** served by the generic resources proxy — alerting has its own
 * aggregated kapis group, and asking the generic proxy for `alerts` answers 404.
 * That is why this module passes `kapisPrefix` instead of reusing the default.
 *
 * Both kinds are read-mostly: a message is history (delete only), a rule can be
 * enabled, disabled and edited.
 */

export type AlertingKind = 'alerts' | 'alertingrules';

interface KubeAlert extends KubeObject {
  /** Alerting rules carry the rule body; messages carry the firing state. */
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

/** One row of the alert message list. */
export interface AlertSummary extends ResourceBase {
  kind: 'alerts';
  /** The message the rule produced. */
  message: string;
  /** `firing` / `pending` / `inactive`, as the alerting API reports it. */
  state: string;
  /** `critical` / `warning` / `info`, or empty when the rule set none. */
  severity: string;
  /** Name of the rule that fired. */
  ruleName: string;
  /** The monitored object, e.g. `deployment/nginx`. */
  target: string;
  /** When it started firing. */
  triggeredAt: string;
}

/** One row of the alerting rule list. */
export interface AlertingRuleSummary extends ResourceBase {
  kind: 'alertingrules';
  /** Whether the rule set is enabled. */
  enabled: boolean;
  /** How many rules the set contains. */
  ruleCount: number;
  /** `active` / `inactive` / `error`, from the rule set's state. */
  state: string;
  /** Human-readable expression of the evaluation interval. */
  timeSpent: string;
  /** When the rule set last evaluated. */
  lastEvaluation: string;
}

/** `ALERT_SEVERITY` in the old console: critical/high/medium/low → three labels. */
export function severityLabel(severity: string): string {
  const map: Record<string, string> = {
    critical: 'critical',
    warning: 'warning',
    info: 'info',
    high: 'critical',
    medium: 'warning',
    low: 'info',
  };
  return map[severity.toLowerCase()] ?? severity;
}

/** Alert state → the old console's wording: firing / pending / resolved. */
export function alertStateLabel(state: string): string {
  const map: Record<string, string> = {
    firing: 'firing',
    pending: 'pending',
    inactive: 'resolved',
    resolved: 'resolved',
  };
  return map[state.toLowerCase()] ?? state;
}

function conditionOf(item: KubeAlert): string {
  const status = (item.status ?? {}) as Record<string, unknown>;
  const value = status['state'] ?? status['conditions'] ?? '';
  if (typeof value === 'string') return value;
  const conditions = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
  const firing = conditions.find((condition) => String(condition['type'] ?? '').toLowerCase() === 'firing');
  return String(firing?.['status'] ?? '');
}

function targetOf(item: KubeAlert): string {
  const labels = (item.metadata?.labels ?? {}) as Record<string, string>;
  const kind = labels['alerttype'] ?? labels['kind'] ?? '';
  const name = labels['alertname'] ?? labels['name'] ?? '';
  return [kind, name].filter(Boolean).join('/');
}

export function toAlertSummary(item: KubeAlert): AlertSummary {
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  const labels = (item.metadata?.labels ?? {}) as Record<string, string>;
  const spec = (item.spec ?? {}) as Record<string, unknown>;
  return {
    ...baseOf(item),
    kind: 'alerts',
    message: String(annotations['message'] ?? spec['message'] ?? item.metadata?.name ?? ''),
    state: conditionOf(item),
    severity: severityLabel(String(labels['severity'] ?? '')),
    ruleName: String(labels['alertingrule'] ?? labels['rule_name'] ?? ''),
    target: targetOf(item),
    triggeredAt: String(spec['startsAt'] ?? annotations['startsAt'] ?? item.metadata?.creationTimestamp ?? ''),
  };
}

export function toAlertingRuleSummary(item: KubeAlert): AlertingRuleSummary {
  const spec = (item.spec ?? {}) as Record<string, unknown>;
  const status = (item.status ?? {}) as Record<string, unknown>;
  const rules = (spec['rules'] ?? []) as unknown[];
  return {
    ...baseOf(item),
    kind: 'alertingrules',
    /*
     * Read from the label the platform actually evaluates on. A policy with no label
     * has never been disabled, so it counts as enabled; the `spec.enabled` fallback
     * covers rule sets written by newer APIs that carry the flag in the body.
     */
    enabled: String((item.metadata?.labels ?? {})[ALERTING_ENABLE_LABEL] ?? 'true') !== 'false' && spec['enabled'] !== false,
    ruleCount: rules.length,
    state: String(status['state'] ?? (spec['enabled'] === false ? 'inactive' : 'active')),
    timeSpent: String(spec['evaluationInterval'] ?? spec['interval'] ?? ''),
    lastEvaluation: String(status['lastEvaluation'] ?? ''),
  };
}

/** Detail view models carry the raw object so YAML editing stays possible. */
export interface AlertDetail extends AlertSummary {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  raw: KubeAlert;
}

export interface AlertingRuleDetail extends AlertingRuleSummary {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  raw: KubeAlert;
}

export function alertingApi(client: Client, kind: 'alerts') {
  return {
    ...resourceApi<KubeAlert, AlertSummary, AlertDetail>(client, {
      resource: kind,
      kapisPrefix: KAPIS_ALERTING,
      toSummary: toAlertSummary,
      toDetail: (item) => ({
        ...toAlertSummary(item),
        labels: item.metadata?.labels ?? {},
        annotations: item.metadata?.annotations ?? {},
        raw: item,
      }),
    }),
    kind,
  };
}

/**
 * Label the platform reads to decide whether a policy is evaluated.
 *
 * The old console writes it as a label (not an annotation) when enabling or
 * disabling a policy — see `console/src/stores/alerting/policy.js`. Writing the
 * wrong kind of metadata would look saved in our UI and never take effect.
 */
export const ALERTING_ENABLE_LABEL = 'alerting.kubesphere.io/enable';

export function alertingRulesApi(client: Client) {
  return {
    ...resourceApi<KubeAlert, AlertingRuleSummary, AlertingRuleDetail>(client, {
      resource: 'alertingrules',
      kapisPrefix: KAPIS_ALERTING,
      toSummary: toAlertingRuleSummary,
      toDetail: (item) => ({
        ...toAlertingRuleSummary(item),
        labels: item.metadata?.labels ?? {},
        annotations: item.metadata?.annotations ?? {},
        raw: item,
      }),
    }),
    kind: 'alertingrules' as const,
    /**
     * Enable or disable a policy.
     *
     * A merge patch on the label only: the rule body is long and must not be
     * re-sent, or a concurrent edit from another admin would be overwritten by an
     * enable/disable that meant to touch one field.
     */
    setEnabled(params: { cluster: string; namespace: string; name: string; enabled: boolean }): Promise<AlertingRuleDetail> {
      const rules = resourceApi<KubeAlert, AlertingRuleSummary, AlertingRuleDetail>(client, {
        resource: 'alertingrules',
        kapisPrefix: KAPIS_ALERTING,
        toSummary: toAlertingRuleSummary,
        toDetail: (item) => ({
          ...toAlertingRuleSummary(item),
          labels: item.metadata?.labels ?? {},
          annotations: item.metadata?.annotations ?? {},
          raw: item,
        }),
      });
      return rules.patch({
        cluster: params.cluster,
        namespace: params.namespace,
        name: params.name,
        body: { metadata: { labels: { [ALERTING_ENABLE_LABEL]: String(params.enabled) } } },
      });
    },
  };
}

export type AlertingApi = ReturnType<typeof alertingApi>;
export type AlertingRulesApi = ReturnType<typeof alertingRulesApi>;

/* ------------------------------------------------------------------ *
 * Rule groups (KubeSphere 3.4 / Whizard model).
 * ------------------------------------------------------------------ */

/**
 * Alerting rules as this generation of KubeSphere stores them.
 *
 * 3.3 and earlier had an `alertingrules` resource; the current API group serves
 * `globalrulegroups`, `clusterrulegroups` and namespaced `rulegroups`, each holding
 * a list of Prometheus rules. Both models are supported because both are deployed:
 * the page picks one by probing the API group, not by guessing a version string.
 */
export type RuleGroupScope = 'global' | 'cluster' | 'project';

export interface RuleGroupSummary extends ResourceBase {
  kind: 'rulegroups';
  scope: RuleGroupScope;
  /** How many rules the group contains. */
  ruleCount: number;
  /** Evaluation interval from `spec.interval`, e.g. `1m`; empty when unset. */
  interval: string;
  /** Whether the platform evaluates this group, from its enable label. */
  enabled: boolean;
  /** Installed rules are platform-managed; editing them is not offered. */
  builtin: boolean;
  /** Whether the installer left an initial configuration this group can be reset to. */
  resettable: boolean;
  /** Free-form description, from the `kubesphere.io/description` annotation. */
  description: string;
  /** Display name, from the `kubesphere.io/alias-name` annotation; empty when unset. */
  alias: string;
  /** Runtime status; absent when the group was read through a path that does not enrich it. */
  status?: RuleGroupRuntimeStatus;
}

/** One Prometheus rule inside a group. */
export interface RuleGroupRule {
  /** `alert` name, e.g. `ksApiSlow`. */
  name: string;
  /** PromQL expression. */
  expression: string;
  /** How long the condition must hold before firing (`for`), e.g. `10m`. */
  duration: string;
  /** `critical` / `warning` / `info`, as the rule declares it. */
  severity: string;
  /** One-line summary from the rule's annotations. */
  summary: string;
  /** Longer description, when the rule carries one. */
  description: string;
  /** Longer message shown with the alert, from `annotations.message`. */
  message: string;
  /** This rule's evaluation state, when the API enriched the response with status. */
  status?: RuleGroupRuleStatus;
}

export interface RuleGroupDetail extends RuleGroupSummary {
  rules: RuleGroupRule[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  raw: KubeObject;
}

/**
 * One rule's evaluation state, as the aggregated kapis API enriches it.
 *
 * The raw CRD has no status at all: ks-apiserver joins each group with Prometheus's
 * rule API before answering, and only on the **kapis** path. Reading `/apis` therefore
 * returns the same rules with every state silently missing — which is how a policy
 * list ends up claiming "nothing is firing" about a cluster that has alerts.
 */
export interface RuleGroupRuleStatus {
  /** `inactive` / `pending` / `firing` / `disabled`, as Prometheus reports it. */
  state: string;
  /** Prometheus's own health for the rule: `ok` / `err` / `unknown`. */
  health: string;
  /** Seconds the rule took to evaluate, when the API reports it. */
  evaluationTime?: number;
  /** When the rule was last evaluated, when the API reports it. */
  lastEvaluation?: string;
}

/** Counts per state, exactly as the aggregated API reports them (absent keys stay absent). */
export interface RuleGroupStateCounts {
  inactive?: number;
  pending?: number;
  firing?: number;
  disabled?: number;
}

/**
 * A group's runtime status.
 *
 * Absent means "the API did not report it" (an installation without the rule API, a
 * read through `/apis`): the page must render `-`, never zero. A zero is a real
 * observation — "evaluated 0 rules firing" — and the two are different facts.
 */
export interface RuleGroupRuntimeStatus {
  /** Seconds the whole group took to evaluate. */
  evaluationTime?: number;
  /** When the group was last evaluated. */
  lastEvaluation?: string;
  stats: RuleGroupStateCounts;
  /** Per-rule states, aligned by index with `spec.rules`. */
  rules: RuleGroupRuleStatus[];
}

const BUILTIN_LABEL = 'alerting.kubesphere.io/builtin';

/**
 * Annotation holding the installer's initial object for a built-in group.
 *
 * The value is the full JSON object as installed (apiVersion/kind/metadata/spec), so
 * the reset can restore `spec` without guessing the original rules. The old console's
 * `alerting.rule.reset` parses this same annotation.
 */
const INITIAL_CONFIGURATION_ANNOTATION = 'alerting.kubesphere.io/initial-configuration';

/**
 * Annotation the platform and the old console use for a policy's description.
 *
 * An annotation, not a label or a spec field: Kubernetes caps annotation values at
 * 256 KiB and labels at 63 characters, and the old console's `BaseInfo` form wrote
 * exactly this key. Writing a different one would save successfully and then show
 * nothing on re-read.
 */
const DESCRIPTION_ANNOTATION = 'kubesphere.io/description';

/**
 * Annotation holding a policy's display name.
 *
 * The old console's create/edit form writes `kubesphere.io/alias-name`, and its list,
 * detail and YAML all render it as the title. Writing `metadata.name` there instead
 * would rename the object; writing a different annotation would save and then show
 * nothing on re-read.
 */
const ALIAS_ANNOTATION = 'kubesphere.io/alias-name';

/** Severity as the rule declares it; Whizard writes it as `severity` or a label. */
function ruleSeverity(rule: Record<string, unknown>): string {
  const direct = rule['severity'];
  if (typeof direct === 'string' && direct) return direct;
  const labels = (rule['labels'] ?? {}) as Record<string, unknown>;
  return String(labels['severity'] ?? '');
}

function toRule(raw: unknown): RuleGroupRule {
  const rule = (raw ?? {}) as Record<string, unknown>;
  const annotations = (rule['annotations'] ?? {}) as Record<string, unknown>;
  return {
    name: String(rule['alert'] ?? rule['record'] ?? ''),
    expression: String(rule['expr'] ?? ''),
    duration: String(rule['for'] ?? ''),
    severity: ruleSeverity(rule),
    summary: String(annotations['summary'] ?? ''),
    description: String(annotations['description'] ?? ''),
    message: String(annotations['message'] ?? ''),
  };
}

/**
 * The aggregated status, when the response carries one.
 *
 * Missing status is kept as `undefined` rather than defaulted: "the API did not
 * report" and "reported zero" are different. Every field is parsed defensively —
 * the status is written by ks-apiserver from Prometheus, so its shape can differ
 * between installations.
 */
export function toRuleGroupStatus(raw: KubeObject): RuleGroupRuntimeStatus | undefined {
  const status = (raw.status ?? undefined) as Record<string, unknown> | undefined;
  if (!status || typeof status !== 'object') return undefined;
  const counts = (status['rulesStats'] ?? {}) as Record<string, unknown>;
  const stats: RuleGroupStateCounts = {};
  for (const state of ['inactive', 'pending', 'firing', 'disabled'] as const) {
    const value = counts[state];
    // Only a real number is a count; a missing key is unknown, not zero.
    if (typeof value === 'number' && Number.isFinite(value)) stats[state] = value;
  }
  const rawRules = (status['rulesStatus'] ?? []) as Array<Record<string, unknown>>;
  const rules: RuleGroupRuleStatus[] = rawRules.map((entry) => ({
    state: String(entry['state'] ?? ''),
    health: String(entry['health'] ?? ''),
    ...(typeof entry['evaluationTime'] === 'number' ? { evaluationTime: entry['evaluationTime'] } : {}),
    ...(typeof entry['lastEvaluation'] === 'string' ? { lastEvaluation: entry['lastEvaluation'] } : {}),
  }));
  const evaluationTime = typeof status['evaluationTime'] === 'number' ? status['evaluationTime'] : undefined;
  const lastEvaluation = typeof status['lastEvaluation'] === 'string' ? status['lastEvaluation'] : undefined;
  return {
    ...(evaluationTime === undefined ? {} : { evaluationTime }),
    ...(lastEvaluation === undefined ? {} : { lastEvaluation }),
    stats,
    rules,
  };
}

export function toRuleGroupSummary(raw: KubeObject, scope: RuleGroupScope): RuleGroupSummary {
  const spec = (raw.spec ?? {}) as Record<string, unknown>;
  const labels = (raw.metadata?.labels ?? {}) as Record<string, string>;
  const rules = (spec['rules'] ?? []) as unknown[];
  const status = toRuleGroupStatus(raw);
  return {
    ...baseOf(raw),
    kind: 'rulegroups',
    scope,
    ruleCount: rules.length,
    interval: String(spec['interval'] ?? spec['evaluationInterval'] ?? ''),
    // An absent label means never disabled: the platform evaluates it.
    enabled: String(labels[ALERTING_ENABLE_LABEL] ?? 'true') !== 'false',
    builtin: String(labels[BUILTIN_LABEL] ?? 'false') === 'true',
    resettable: String((raw.metadata?.annotations ?? {})[INITIAL_CONFIGURATION_ANNOTATION] ?? '') !== '',
    description: String((raw.metadata?.annotations ?? {})[DESCRIPTION_ANNOTATION] ?? ''),
    alias: String((raw.metadata?.annotations ?? {})[ALIAS_ANNOTATION] ?? ''),
    ...(status ? { status } : {}),
  };
}

export function toRuleGroupDetail(raw: KubeObject, scope: RuleGroupScope): RuleGroupDetail {
  const spec = (raw.spec ?? {}) as Record<string, unknown>;
  const summary = toRuleGroupSummary(raw, scope);
  const statusRules = summary.status?.rules ?? [];
  return {
    ...summary,
    rules: ((spec['rules'] ?? []) as unknown[]).map((entry, index) => {
      const rule = toRule(entry);
      const state = statusRules[index];
      return state ? { ...rule, status: state } : rule;
    }),
    labels: raw.metadata?.labels ?? {},
    annotations: raw.metadata?.annotations ?? {},
    raw,
  };
}

/** Scope → resource path segment. Project scope additionally needs a namespace segment. */
const RULE_GROUP_PATHS: Record<RuleGroupScope, string> = {
  global: 'globalrulegroups',
  cluster: 'clusterrulegroups',
  project: 'rulegroups',
};

/** Raw CRD path: rules only, no runtime status. */
const API = '/apis/alerting.kubesphere.io/v2beta1';
/**
 * Aggregated kapis path: the same objects enriched with Prometheus's rule status.
 *
 * Measured on the mlu370 host cluster (2026-11-17): `GET /kapis/.../clusterrulegroups`
 * returns `status.{evaluationTime,lastEvaluation,rulesStatus,rulesStats}`, while
 * `GET /apis/.../clusterrulegroups` returns the identical objects with **no status
 * key at all**. The old console read the kapis path for this reason.
 */
const KAPIS = '/kapis/alerting.kubesphere.io/v2beta1';

function rawCollectionPath(scope: RuleGroupScope, namespace: string): string {
  return scope === 'project'
    ? `${API}/namespaces/${encodeURIComponent(namespace)}/${RULE_GROUP_PATHS.project}`
    : `${API}/${RULE_GROUP_PATHS[scope]}`;
}

function rawItemPath(params: { name: string; scope: RuleGroupScope; namespace?: string }): string {
  return `${rawCollectionPath(params.scope, params.namespace ?? '')}/${encodeURIComponent(params.name)}`;
}

/**
 * The same collection through kapis, which is where the runtime status lives.
 *
 * `cluster` is optional so the existing project page's calls stay host-only; a
 * cluster-scope page passes it and a member cluster gets its segment right after
 * `/kapis`, exactly as the aggregated API expects (see `clusterScoped`).
 */
function kapisCollectionPath(scope: RuleGroupScope, namespace: string, cluster?: string): string {
  const rest =
    scope === 'project'
      ? `namespaces/${encodeURIComponent(namespace)}/${RULE_GROUP_PATHS.project}`
      : RULE_GROUP_PATHS[scope];
  return clusterScoped(KAPIS, cluster, rest);
}

function kapisItemPath(params: {
  name: string;
  scope: RuleGroupScope;
  namespace?: string;
  cluster?: string;
}): string {
  return `${kapisCollectionPath(params.scope, params.namespace ?? '', params.cluster)}/${encodeURIComponent(params.name)}`;
}

/**
 * Which alerting model this cluster serves.
 *
 * Probed from the API group's resource list: that is the authoritative answer to
 * "does this resource exist", and it costs one request. A version string says
 * nothing about which CRDs were actually installed.
 */
export async function alertingModel(
  client: Client,
  signal?: AbortSignal,
): Promise<'rulegroups' | 'alertingrules'> {
  try {
    const group = await client.request<{ resources?: Array<{ name?: string }> }>(API, signal ? { signal } : {});
    const names = (group?.resources ?? []).map((resource) => resource.name);
    if (names.includes('globalrulegroups') || names.includes('clusterrulegroups')) return 'rulegroups';
  } catch {
    // No such group: the old model, or no alerting at all. Both read the same here.
  }
  return 'alertingrules';
}

export function ruleGroupsApi(client: Client) {
  const collectionPath = rawCollectionPath;
  const itemPath = rawItemPath;

  return {
    /**
     * Every group the caller can see, merged.
     *
     * Three sources but one list: the page is 告警策略, not "global strategies" and
     * "project strategies" as separate pages. Pagination therefore happens after
     * merging — the API only paginates per source, so a per-source page would show
     * fewer rows than the page size claims.
     */
    async list(params: {
      cluster: string;
      namespace: string;
      keyword?: string;
      signal?: AbortSignal;
    }): Promise<{ items: RuleGroupSummary[]; total: number }> {
      /*
       * A project filter adds that project's groups; "all projects" cannot list them
       * (there is no cross-namespace collection for this resource), so it shows the
       * cluster-wide ones. Say that in the empty state rather than pretending the
       * project-scoped rules do not exist.
       */
      const scopes: RuleGroupScope[] = params.namespace ? ['global', 'cluster', 'project'] : ['global', 'cluster'];
      const results = await Promise.all(
        scopes.map(async (scope) => {
          const body = await client.request<{ items?: KubeObject[] }>(collectionPath(scope, params.namespace), {
            ...(params.signal ? { signal: params.signal } : {}),
          });
          return (body?.items ?? []).map((item) => toRuleGroupSummary(item, scope));
        }),
      );
      let items = results.flat();
      const keyword = (params.keyword ?? '').trim().toLowerCase();
      if (keyword) items = items.filter((item) => item.name.toLowerCase().includes(keyword));
      items.sort((a, b) => a.name.localeCompare(b.name));
      return { items, total: items.length };
    },

    async get(params: {
      name: string;
      scope: RuleGroupScope;
      namespace?: string;
      /** Read the aggregated path so the returned detail carries `status` (rule states). */
      withStatus?: boolean;
      /** Member cluster the page is looking at; host omits the segment. */
      cluster?: string;
      signal?: AbortSignal;
    }): Promise<RuleGroupDetail> {
      const path = params.withStatus ? kapisItemPath(params) : itemPath(params);
      const body = await client.request<KubeObject>(path, params.signal ? { signal: params.signal } : {});
      return toRuleGroupDetail(body ?? {}, params.scope);
    },

    /**
     * One scope's groups, for the cluster-scope pages.
     *
     * `list` intentionally merges scopes because the project page is one list. The
     * cluster pages are separate by ownership — custom cluster groups vs the
     * installer's global ones — so they read a single collection.
     *
     * `withStatus` switches the read to the aggregated kapis path, which is the only
     * one that carries each group's rule states, evaluation time and last evaluation.
     * It fetches the collection whole (`limit=-1`) because the rule-state filter is not
     * a server parameter (probed: `state=inactive` is ignored by kapis); the caller
     * filters and pages locally, which is what the project page already does. Without
     * `withStatus` the raw CRD path is used and the status columns must show `-`.
     */
    async listScope(params: {
      scope: 'cluster' | 'global';
      /** Read the aggregated kapis path so status is present. */
      withStatus?: boolean;
      /** Member cluster the page is looking at; host omits the segment. */
      cluster?: string;
      signal?: AbortSignal;
    }): Promise<{ items: RuleGroupSummary[]; total: number }> {
      const body = params.withStatus
        ? await client.request<{ items?: KubeObject[]; totalItems?: number }>(
            kapisCollectionPath(params.scope, '', params.cluster),
            { query: { limit: -1 }, ...(params.signal ? { signal: params.signal } : {}) },
          )
        : await client.request<{ items?: KubeObject[]; totalItems?: number }>(
            `${API}/${RULE_GROUP_PATHS[params.scope]}`,
            { ...(params.signal ? { signal: params.signal } : {}) },
          );
      const items = (body?.items ?? [])
        .map((item) => toRuleGroupSummary(item, params.scope))
        .sort((a, b) => a.name.localeCompare(b.name));
      // kapis reports totalItems; the raw CRD list does not, so the array length is the count.
      const total = typeof body?.totalItems === 'number' ? body.totalItems : items.length;
      return { items, total };
    },

    /**
     * Enable or disable one group.
     *
     * A merge patch on the enable label only, for the same reason the older model
     * patches only that label: re-sending the rule bodies would overwrite a
     * concurrent edit another administrator is making.
     */
    async setEnabled(params: {
      name: string;
      scope: RuleGroupScope;
      namespace?: string;
      enabled: boolean;
    }): Promise<void> {
      await client.request(itemPath(params), {
        method: 'PATCH',
        contentType: 'application/merge-patch+json',
        body: { metadata: { labels: { [ALERTING_ENABLE_LABEL]: String(params.enabled) } } },
      });
    },

    /**
     * Restore a built-in group's rules from the installer's initial configuration.
     *
     * The annotation holds the full object as installed; only its `spec` is written
     * back. A merge-patch is used instead of PUT because `spec.rules` is an array
     * (the patch replaces it wholesale, which is exactly a reset) and because PUT
     * would need the current `resourceVersion` and a full object. The enable label is
     * deliberately **not** restored: the operator can switch a policy separately, and
     * a reset that silently re-enabled a disabled policy would be a surprise.
     *
     * Probe on host: dry-run and real merge-patches both return 200, and the spec
     * reads back identical to the annotation's `spec`; the original rules were then
     * restored with PUT.
     */
    async resetToInitial(params: {
      name: string;
      scope: RuleGroupScope;
      namespace?: string;
      signal?: AbortSignal;
    }): Promise<void> {
      const current = await client.request<KubeObject>(itemPath(params), params.signal ? { signal: params.signal } : {});
      const encoded = (current.metadata?.annotations ?? {})[INITIAL_CONFIGURATION_ANNOTATION];
      if (!encoded) {
        throw new ApiError(
          { code: 'invalid', message: 'this policy has no initial configuration to reset to' },
          422,
        );
      }
      let initial: { spec?: unknown };
      try {
        initial = JSON.parse(encoded) as { spec?: unknown };
      } catch {
        throw new ApiError(
          { code: 'invalid', message: 'the stored initial configuration is not valid JSON' },
          422,
        );
      }
      if (!initial?.spec || typeof initial.spec !== 'object') {
        throw new ApiError(
          { code: 'invalid', message: 'the stored initial configuration has no spec to restore' },
          422,
        );
      }
      await client.request(itemPath(params), {
        method: 'PATCH',
        contentType: 'application/merge-patch+json',
        body: { spec: initial.spec },
        ...(params.signal ? { signal: params.signal } : {}),
      });
    },
  };
}

export type RuleGroupsApi = ReturnType<typeof ruleGroupsApi>;

/* ------------------------------------------------------------------ *
 * Writing project rule groups.
 * ------------------------------------------------------------------ */

/** One rule as the editor writes it. */
export interface RuleGroupRuleInput {
  /** Alert name, unique within the group. */
  alert: string;
  /** PromQL expression. */
  expression: string;
  /** How long the condition must hold before firing, e.g. `5m`. */
  duration: string;
  /** `critical` / `warning` / `info`. */
  severity: string;
  /** One-line summary, written to `annotations.summary`. */
  summary: string;
  /** Longer message, written to `annotations.message`. */
  message: string;
}

/** One group's editable fields, from the create/edit form. */
export interface RuleGroupWriteInput {
  name: string;
  rules: RuleGroupRuleInput[];
  /** Free-form description (`kubesphere.io/description`). */
  description?: string;
  /** Display name (`kubesphere.io/alias-name`). */
  alias?: string;
  /** Check interval, e.g. `2m`; empty clears it. */
  interval?: string;
}

/** Where a write lands. Project groups are namespaced; cluster groups are not. */
export type RuleGroupWriteScope = 'project' | 'cluster';

const RULE_GROUP_KIND: Record<RuleGroupWriteScope, string> = {
  project: 'RuleGroup',
  cluster: 'ClusterRuleGroup',
};

/**
 * Create, edit and delete a rule group, at project or cluster scope.
 *
 * Global groups are **not** writable here: they are installer-owned (`builtin:
 * true`) and the next reconciliation puts them back, which is worse than refusing the
 * edit. The cluster-scoped `clusterrulegroups` are the operator's own policies, and the
 * old console created/edited/deleted them from the same page that shows the global ones
 * — the page is one page; ownership decides which rows are writable.
 *
 * Rule bodies are sent whole: they are the object, and a merge patch on an array
 * replaces it anyway.
 */
export function ruleGroupsWriteApi(client: Client) {
  const kindOf = (scope: RuleGroupWriteScope): string => RULE_GROUP_KIND[scope];
  const collection = (scope: RuleGroupWriteScope, namespace: string) => rawCollectionPath(scope, namespace);
  const item = (scope: RuleGroupWriteScope, namespace: string, name: string) =>
    `${collection(scope, namespace)}/${encodeURIComponent(name)}`;

  const toSpec = (rules: RuleGroupRuleInput[], interval?: string) => {
    const spec: Record<string, unknown> = {
      rules: rules.map((rule) => {
        const annotations: Record<string, string> = {};
        if (rule.summary) annotations.summary = rule.summary;
        if (rule.message) annotations.message = rule.message;
        return {
          alert: rule.alert,
          expr: rule.expression,
          for: rule.duration,
          severity: rule.severity,
          ...(Object.keys(annotations).length > 0 ? { annotations } : {}),
        };
      }),
    };
    if (interval !== undefined) spec['interval'] = interval;
    return spec;
  };

  /** Merge the two console-owned annotations, leaving strangers' keys alone. */
  const mergeAnnotations = (
    current: Record<string, string>,
    fields: { description?: string; alias?: string },
  ): Record<string, string> => {
    const annotations = { ...current };
    if (fields.description !== undefined) {
      const description = fields.description.trim();
      if (description) annotations[DESCRIPTION_ANNOTATION] = description;
      else delete annotations[DESCRIPTION_ANNOTATION];
    }
    if (fields.alias !== undefined) {
      const alias = fields.alias.trim();
      if (alias) annotations[ALIAS_ANNOTATION] = alias;
      else delete annotations[ALIAS_ANNOTATION];
    }
    return annotations;
  };

  return {
    async create(params: RuleGroupWriteInput & {
      scope: RuleGroupWriteScope;
      /** Required for project scope. */
      namespace?: string;
    }): Promise<void> {
      const namespace = params.namespace ?? '';
      if (params.scope === 'project' && !namespace) {
        throw new ApiError({ code: 'invalid', message: 'a project rule group needs a namespace' }, 422);
      }
      const annotations = mergeAnnotations({}, params);
      await client.request(collection(params.scope, namespace), {
        method: 'POST',
        body: {
          apiVersion: 'alerting.kubesphere.io/v2beta1',
          kind: kindOf(params.scope),
          metadata: {
            name: params.name,
            ...(params.scope === 'project' ? { namespace } : {}),
            ...(Object.keys(annotations).length > 0 ? { annotations } : {}),
            // The platform evaluates an absent label as enabled; write it explicitly so
            // the enable/disable switch starts from an observable value.
            labels: { [ALERTING_ENABLE_LABEL]: 'true' },
          },
          spec: toSpec(params.rules, params.interval ?? ''),
        },
      });
    },

    /**
     * Replace a group's rules and its editable metadata.
     *
     * PUT with the full object: `spec.rules` is an array, and a merge patch would
     * replace it wholesale while leaving `metadata` untouched — which is what we want,
     * so the current object is read first to carry `resourceVersion` and the
     * annotations this editor does not own. Sending a bare body lets two editors
     * overwrite each other silently.
     *
     * The description/alias are merged into the existing annotations rather than
     * replacing them: the alerting controller and the installer write their own
     * annotations on the group, and a save that dropped them would break the object for
     * a field the form did not even show.
     */
    async update(params: RuleGroupWriteInput & {
      scope: RuleGroupWriteScope;
      /** Required for project scope. */
      namespace?: string;
    }): Promise<void> {
      const namespace = params.namespace ?? '';
      const itemPath = item(params.scope, namespace, params.name);
      const current = await client.request<KubeObject>(itemPath);
      const metadata = { ...(current.metadata ?? {}) };
      metadata.annotations = mergeAnnotations(metadata.annotations ?? {}, params);
      await client.request(itemPath, {
        method: 'PUT',
        body: {
          ...current,
          metadata,
          spec: { ...(current?.spec as object), ...toSpec(params.rules, params.interval) },
        },
      });
    },

    async remove(params: {
      scope: RuleGroupWriteScope;
      namespace?: string;
      name: string;
    }): Promise<void> {
      await client.request(item(params.scope, params.namespace ?? '', params.name), { method: 'DELETE' });
    },

    /**
     * Write a whole object from the YAML editor.
     *
     * The editor edits the object the API returned, so the caller owns what changes —
     * this method only decides the path. It is deliberately separate from `update`:
     * that one merges the form's fields and keeps annotations the form does not show,
     * while YAML mode is the reader's explicit whole-object write.
     */
    async replace(params: {
      scope: RuleGroupWriteScope;
      namespace?: string;
      name: string;
      object: KubeObject;
    }): Promise<void> {
      await client.request(item(params.scope, params.namespace ?? '', params.name), {
        method: 'PUT',
        body: params.object,
      });
    },
  };
}

export type RuleGroupsWriteApi = ReturnType<typeof ruleGroupsWriteApi>;


/* ------------------------------------------------------------------ *
 * Aggregated alert messages (v2beta1 kapis API, every scope).
 * ------------------------------------------------------------------ */

/** Which aggregated collection an alert message comes from. */
export type AlertMessageScope = 'global' | 'cluster' | 'project';

/**
 * One active alert message from the aggregated v2beta1 API.
 *
 * This is the shape the API returns **directly** — `{activeAt, annotations, labels,
 * state, value}` — not a Kubernetes object. That is why it does not extend the
 * resource base type the list pages use elsewhere: there is no `metadata.name`,
 * no namespace and no resourceVersion, and the row key has to be synthesised.
 */
export interface AlertMessage {
  /** Stable row key: the API has no object name and alert names repeat per rule. */
  id: string;
  /** `labels.alertname` — the rule that fired. */
  name: string;
  /** `annotations.summary` — the one-line message title. */
  summary: string;
  /** `annotations.message`, falling back to `annotations.description`. */
  message: string;
  /** `firing` / `pending`, as the aggregated API reports it. */
  state: string;
  /** `critical` / `warning` / `info`; the old console's high/medium/low map onto these. */
  severity: string;
  /** The rule group that fired it (`labels.rule_group`). */
  ruleGroup: string;
  /** `labels.rule_type` — `custom` (`metric`) or `template`; empty when unset. */
  ruleType: string;
  /** `activeAt` — when it started firing. */
  triggeredAt: string;
  /** The monitored object, derived from the alert's own labels; empty when it has none. */
  target: string;
  /** The value the expression evaluated to, when the alert reports it. */
  value: string;
  /** The alert's labels, verbatim; the detail view shows an allowlisted summary. */
  labels: Record<string, string>;
  /** The alert's annotations, verbatim; the detail view shows an allowlisted summary. */
  annotations: Record<string, string>;
}

/**
 * Which policy set produced a cluster alert.
 *
 * `custom` are alerts from cluster rule groups (clusterrulegroups), `builtin`
 * from the installer's global groups. The old console exposed them as two tabs;
 * the API keeps them in two collections.
 */
export type ClusterAlertSource = 'custom' | 'builtin';

/** One alert message at cluster scope; same record plus the collection it came from. */
export interface ClusterAlertSummary extends AlertMessage {
  source: ClusterAlertSource;
}

/** Paths of the two cluster-scoped aggregated collections. */
const CLUSTER_ALERT_KAPIS = '/kapis/alerting.kubesphere.io/v2beta1';
const CLUSTER_ALERT_PATHS: Record<ClusterAlertSource, string> = {
  custom: 'clusteralerts',
  builtin: 'globalalerts',
};

/** The raw item the aggregated API returns, before any display mapping. */
interface AggregatedAlertItem {
  activeAt?: string;
  annotations?: Record<string, string>;
  labels?: Record<string, string>;
  state?: string;
  value?: string | number;
}

/**
 * Collection path for one scope.
 *
 * The project collection is namespaced (`namespaces/<ns>/alerts`); the cluster and
 * global ones are cluster-wide and split by ownership. All three live under the
 * **aggregated kapis** prefix — `/apis/alerting.kubesphere.io/v2beta1` serves rule
 * groups only, and `/apis/.../alerts` answers 404 (probed 2026-11-15).
 */
function alertCollectionPath(scope: AlertMessageScope, namespace: string, cluster?: string): string {
  if (scope === 'project') {
    return clusterScoped(CLUSTER_ALERT_KAPIS, cluster, `namespaces/${encodeURIComponent(namespace)}/alerts`);
  }
  return clusterScoped(CLUSTER_ALERT_KAPIS, cluster, CLUSTER_ALERT_PATHS[scope === 'global' ? 'builtin' : 'custom']);
}

/**
 * The monitored object, from the alert's own labels.
 *
 * The old console only rendered a target for `rule_type=template` and `-` for
 * everything else. On this deployment **all 33 active alerts are `rule_type=custom`**
 * yet carry `namespace`/`pod`/`container` labels, so that gate hid the target of
 * every alert. The labels are the evidence; the object is whatever they name.
 */
function alertTarget(labels: Record<string, string>): string {
  const resource = labels['workload'] || labels['pod'] || labels['node'] || '';
  const namespace = labels['namespace'] || '';
  return [namespace, resource].filter(Boolean).join('/');
}

/** Raw item → display model. Severity is normalised here so every reader agrees. */
function toAlertMessage(item: AggregatedAlertItem, scope: AlertMessageScope, index: number): AlertMessage {
  const annotations = item.annotations ?? {};
  const labels = item.labels ?? {};
  const name = String(labels['alertname'] ?? '');
  return {
    id: `${scope}:${index}:${name}`,
    name,
    summary: String(annotations['summary'] ?? ''),
    message: String(annotations['message'] ?? annotations['description'] ?? ''),
    state: String(item.state ?? ''),
    severity: severityLabel(String(labels['severity'] ?? '')),
    ruleGroup: String(labels['rule_group'] ?? ''),
    ruleType: String(labels['rule_type'] ?? ''),
    triggeredAt: String(item.activeAt ?? ''),
    target: alertTarget(labels),
    value: item.value === undefined || item.value === null ? '' : String(item.value),
    labels: { ...labels },
    annotations: { ...annotations },
  };
}

export function toClusterAlertSummary(
  item: AggregatedAlertItem,
  source: ClusterAlertSource,
  index: number,
): ClusterAlertSummary {
  return { ...toAlertMessage(item, source === 'builtin' ? 'global' : 'cluster', index), source };
}

/**
 * Active alert messages, queried per scope and (optionally) per rule group.
 *
 * Why one API for three collections: the three paths differ only by prefix and the
 * item shape is identical, and the policy detail page needs the same query for a
 * global group opened from the project page as the cluster page needs for the same
 * group. Splitting this into three clients would duplicate the mapping and let the
 * severity/target rules drift apart.
 *
 * `ruleGroup` is sent as `label_filters=rule_group=<name>`, the parameter the old
 * console used for the policy detail's message tab. Probed 2026-11-15:
 * `globalalerts?label_filters=rule_group=kubernetes-resources` returns 14 of the 33
 * records, so the filter is applied server-side rather than after pagination.
 */
export function alertMessagesApi(client: Client) {
  return {
    async list(params: {
      /** Which cluster the alerts belong to; a member cluster answers for itself (or errors). */
      cluster?: string;
      scope: AlertMessageScope;
      /** Required for project scope: the collection is namespaced. */
      namespace?: string;
      /** Restrict to one policy's alerts. */
      ruleGroup?: string;
      /** Restrict to one alert state (`firing` / `pending`); server-side. */
      state?: string;
      /** Restrict to one severity; sent as the `severity` label filter. */
      severity?: string;
      page: number;
      pageSize: number;
      keyword?: string;
      /** Server-side sort key, e.g. `activeAt`. */
      sortBy?: string;
      order?: 'asc' | 'desc';
      signal?: AbortSignal;
    }): Promise<{ items: AlertMessage[]; total: number }> {
      // Both filters live in the same `label_filters` value (a label selector), so they
      // are assembled once instead of overwriting each other.
      const labelFilters: string[] = [];
      if (params.severity) labelFilters.push(`severity=${params.severity}`);
      if (params.ruleGroup) labelFilters.push(`rule_group=${params.ruleGroup}`);
      const query: Record<string, string | number | boolean | undefined> = {
        page: params.page,
        limit: params.pageSize,
        ...(params.keyword ? { keyword: params.keyword } : {}),
        ...(params.sortBy ? { sortBy: params.sortBy } : {}),
        ...(params.order ? { ascending: params.order === 'asc' ? 'true' : 'false' } : {}),
        ...(params.state ? { state: params.state } : {}),
        ...(labelFilters.length > 0 ? { label_filters: labelFilters.join(',') } : {}),
      };
      const body = await client.request<{ items?: AggregatedAlertItem[]; totalItems?: number }>(
        alertCollectionPath(params.scope, params.namespace ?? '', params.cluster),
        { query, ...(params.signal ? { signal: params.signal } : {}) },
      );
      return {
        items: (body?.items ?? []).map((item, index) => toAlertMessage(item, params.scope, index)),
        total: Number(body?.totalItems ?? 0),
      };
    },
  };
}

export type AlertMessagesApi = ReturnType<typeof alertMessagesApi>;

/**
 * Cluster-scope alert messages, merged from the custom and builtin collections.
 *
 * Both collections are **aggregated v2beta1 endpoints** (`/kapis`, not `/apis`):
 * the CRD-backed v2beta1 group has rule groups only, and `/apis/.../alerts`
 * answers 404.
 *
 * The merge is client-side: each source pages on its own, so a page of "all
 * cluster alerts" cannot be one request. The page fetches enough of each source
 * to fill the requested page (`page * pageSize`, capped), sorts by `activeAt`
 * descending and slices. The cap is documented because beyond it the total stops
 * being reachable through pagination.
 */
/**
 * Cluster-scope alert messages, merged from the custom and builtin collections.
 *
 * Both collections are **aggregated v2beta1 endpoints** (`/kapis`, not `/apis`):
 * the CRD-backed v2beta1 group has rule groups only, and `/apis/.../alerts`
 * answers 404. The v1alpha2 paths the project monitoring page still uses answer
 * 200 with an empty body here — empty is not "no alerts", it is the wrong group.
 *
 * The merge is client-side: each source pages on its own, so a page of "all
 * cluster alerts" cannot be one request. The page fetches enough of each source
 * to fill the requested page (`page * pageSize`, capped), sorts by `activeAt`
 * descending and slices. The cap is documented because beyond it the total stops
 * being reachable through pagination.
 */
export function clusterAlertMessagesApi(client: Client) {
  /** Newest-first window of one collection, large enough for the requested page. */
  async function fetchSource(
    source: ClusterAlertSource,
    limit: number,
    filters: { state?: string | undefined; severity?: string | undefined; ruleGroup?: string | undefined },
    cluster: string | undefined,
    signal?: AbortSignal,
  ): Promise<{ source: ClusterAlertSource; items: AggregatedAlertItem[]; total: number }> {
    /*
     * `state` and the label filters are applied by the server: the collection pages, so
     * filtering after the fact would only filter the page that happened to be fetched.
     * Severity and rule group share one `label_filters` value (a label selector), which is
     * why they are assembled here instead of being set as separate parameters.
     */
    const labelFilters: string[] = [];
    if (filters.severity) labelFilters.push(`severity=${filters.severity}`);
    if (filters.ruleGroup) labelFilters.push(`rule_group=${filters.ruleGroup}`);
    const body = await client.request<{ items?: AggregatedAlertItem[]; totalItems?: number }>(
      clusterScoped(CLUSTER_ALERT_KAPIS, cluster, CLUSTER_ALERT_PATHS[source]),
      {
        query: {
          limit,
          page: 1,
          sortBy: 'activeAt',
          ascending: 'false',
          ...(filters.state ? { state: filters.state } : {}),
          ...(labelFilters.length > 0 ? { label_filters: labelFilters.join(',') } : {}),
        },
        ...(signal ? { signal } : {}),
      },
    );
    return { source, items: body?.items ?? [], total: Number(body?.totalItems ?? 0) };
  }

  /** Largest window fetched from either collection; see the comment above. */
  const MAX_WINDOW = 500;

  return {
    async list(params: {
      /** Which cluster the alerts belong to; a member cluster answers for itself (or errors). */
      cluster?: string;
      page: number;
      pageSize: number;
      /** `firing` / `pending`; server-side. */
      state?: string;
      /** `critical` / `error` / `warning`; server-side label filter. */
      severity?: string;
      /** One alerting policy (label `rule_group`); server-side label filter. */
      ruleGroup?: string;
      signal?: AbortSignal;
    }): Promise<{ items: ClusterAlertSummary[]; total: number }> {
      const limit = Math.min(params.page * params.pageSize, MAX_WINDOW);
      const filters = { state: params.state, severity: params.severity, ruleGroup: params.ruleGroup };
      const [custom, builtin] = await Promise.all([
        fetchSource('custom', limit, filters, params.cluster, params.signal),
        fetchSource('builtin', limit, filters, params.cluster, params.signal),
      ]);
      const items = [
        ...custom.items.map((item, index) => toClusterAlertSummary(item, 'custom', index)),
        ...builtin.items.map((item, index) => toClusterAlertSummary(item, 'builtin', index)),
      ].sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt));
      return {
        items: items.slice((params.page - 1) * params.pageSize, params.page * params.pageSize),
        total: custom.total + builtin.total,
      };
    },
  };
}

export type ClusterAlertMessagesApi = ReturnType<typeof clusterAlertMessagesApi>;


import type { Client } from './client';
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
  /** Whether the platform evaluates this group, from its enable label. */
  enabled: boolean;
  /** Installed rules are platform-managed; editing them is not offered. */
  builtin: boolean;
  /** Free-form description, from the `kubesphere.io/description` annotation. */
  description: string;
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
}

export interface RuleGroupDetail extends RuleGroupSummary {
  rules: RuleGroupRule[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  raw: KubeObject;
}

const BUILTIN_LABEL = 'alerting.kubesphere.io/builtin';

/**
 * Annotation the platform and the old console use for a policy's description.
 *
 * An annotation, not a label or a spec field: Kubernetes caps annotation values at
 * 256 KiB and labels at 63 characters, and the old console's `BaseInfo` form wrote
 * exactly this key. Writing a different one would save successfully and then show
 * nothing on re-read.
 */
const DESCRIPTION_ANNOTATION = 'kubesphere.io/description';

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

export function toRuleGroupSummary(raw: KubeObject, scope: RuleGroupScope): RuleGroupSummary {
  const spec = (raw.spec ?? {}) as Record<string, unknown>;
  const labels = (raw.metadata?.labels ?? {}) as Record<string, string>;
  const rules = (spec['rules'] ?? []) as unknown[];
  return {
    ...baseOf(raw),
    kind: 'rulegroups',
    scope,
    ruleCount: rules.length,
    // An absent label means never disabled: the platform evaluates it.
    enabled: String(labels[ALERTING_ENABLE_LABEL] ?? 'true') !== 'false',
    builtin: String(labels[BUILTIN_LABEL] ?? 'false') === 'true',
    description: String((raw.metadata?.annotations ?? {})[DESCRIPTION_ANNOTATION] ?? ''),
  };
}

export function toRuleGroupDetail(raw: KubeObject, scope: RuleGroupScope): RuleGroupDetail {
  const spec = (raw.spec ?? {}) as Record<string, unknown>;
  return {
    ...toRuleGroupSummary(raw, scope),
    rules: ((spec['rules'] ?? []) as unknown[]).map(toRule),
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

const API = '/apis/alerting.kubesphere.io/v2beta1';

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
  const collectionPath = (scope: RuleGroupScope, namespace: string): string =>
    scope === 'project'
      ? `${API}/namespaces/${encodeURIComponent(namespace)}/${RULE_GROUP_PATHS.project}`
      : `${API}/${RULE_GROUP_PATHS[scope]}`;

  const itemPath = (params: { name: string; scope: RuleGroupScope; namespace?: string }): string =>
    `${collectionPath(params.scope, params.namespace ?? '')}/${encodeURIComponent(params.name)}`;

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
      signal?: AbortSignal;
    }): Promise<RuleGroupDetail> {
      const body = await client.request<KubeObject>(itemPath(params), params.signal ? { signal: params.signal } : {});
      return toRuleGroupDetail(body ?? {}, params.scope);
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

/**
 * Create, edit and delete a **project-scoped** rule group.
 *
 * Only the namespaced `rulegroups` resource is writable here. The global and
 * cluster-scoped groups are installer-owned (`builtin: true`) — the API accepts a
 * write, but the next reconciliation puts them back, which is a worse outcome than
 * refusing the edit.
 *
 * Rule bodies are sent whole: they are the object, and a merge patch on an array
 * replaces it anyway.
 */
export function ruleGroupsWriteApi(client: Client) {
  const collection = (namespace: string) =>
    `/apis/alerting.kubesphere.io/v2beta1/namespaces/${encodeURIComponent(namespace)}/rulegroups`;
  const item = (namespace: string, name: string) => `${collection(namespace)}/${encodeURIComponent(name)}`;

  const toSpec = (rules: RuleGroupRuleInput[]) => ({
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
  });

  return {
    async create(params: {
      namespace: string;
      name: string;
      rules: RuleGroupRuleInput[];
      description?: string;
    }): Promise<void> {
      const description = (params.description ?? '').trim();
      await client.request(collection(params.namespace), {
        method: 'POST',
        body: {
          apiVersion: 'alerting.kubesphere.io/v2beta1',
          kind: 'RuleGroup',
          metadata: {
            name: params.name,
            namespace: params.namespace,
            ...(description ? { annotations: { [DESCRIPTION_ANNOTATION]: description } } : {}),
          },
          spec: toSpec(params.rules),
        },
      });
    },

    /**
     * Replace a group's rules and its description.
     *
     * PUT with the full object: `spec.rules` is an array, and a merge patch would
     * replace it wholesale while leaving `metadata` untouched — which is what we want,
     * so the current object is read first to carry `resourceVersion` and the
     * annotations this editor does not own. Sending a bare body lets two editors
     * overwrite each other silently.
     *
     * The description is merged into the existing annotations rather than replacing
     * them: the alerting controller and the installer write their own annotations on
     * the group, and a save that dropped them would break the object for a field the
     * form did not even show.
     */
    async update(params: {
      namespace: string;
      name: string;
      rules: RuleGroupRuleInput[];
      description?: string;
    }): Promise<void> {
      const current = await client.request<KubeObject>(item(params.namespace, params.name));
      const metadata = { ...(current.metadata ?? {}) };
      if (params.description !== undefined) {
        const annotations = { ...(metadata.annotations ?? {}) };
        const description = params.description.trim();
        if (description) annotations[DESCRIPTION_ANNOTATION] = description;
        else delete annotations[DESCRIPTION_ANNOTATION];
        metadata.annotations = annotations;
      }
      await client.request(item(params.namespace, params.name), {
        method: 'PUT',
        body: {
          ...current,
          metadata,
          spec: { ...(current?.spec as object), ...toSpec(params.rules) },
        },
      });
    },

    async remove(params: { namespace: string; name: string }): Promise<void> {
      await client.request(item(params.namespace, params.name), { method: 'DELETE' });
    },
  };
}

export type RuleGroupsWriteApi = ReturnType<typeof ruleGroupsWriteApi>;


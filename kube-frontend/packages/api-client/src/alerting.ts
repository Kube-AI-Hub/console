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

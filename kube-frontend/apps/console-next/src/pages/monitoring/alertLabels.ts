import type { RuleGroupScope } from '@kube-ai-hub/api-client';
import type { LocaleKey } from '@kube-ai-hub/locales';

/**
 * Alert state / severity → locale keys, with the raw value as the fallback.
 *
 * The aggregated alert API reports the controller's own strings (`firing`,
 * `critical`, but also `inactive` and `high`/`medium`/`low` from older rule
 * sets). A raw value that has no key is shown as-is rather than replaced by a
 * missing-key marker: an unrecognised state is information, not a formatting bug.
 */
const STATE_KEYS: Record<string, LocaleKey> = {
  firing: 'monitoring.state.firing',
  pending: 'monitoring.state.pending',
  resolved: 'monitoring.state.resolved',
  inactive: 'monitoring.state.resolved',
};

const SEVERITY_KEYS: Record<string, LocaleKey> = {
  critical: 'monitoring.severity.critical',
  warning: 'monitoring.severity.warning',
  info: 'monitoring.severity.info',
};

type Translate = (key: LocaleKey) => string;

export function alertStateLabel(t: Translate, state: string): string {
  const key = STATE_KEYS[state.toLowerCase()];
  return key ? t(key) : state || '-';
}

/**
 * Per-rule evaluation state → the four words the old policy page used.
 *
 * They are **not** the alert-message states: an inactive rule was evaluated and found
 * nothing wrong ("未触发"), while a resolved alert is a message that stopped firing
 * ("已恢复"). Reusing the message words here would claim a rule never ran.
 */
const RULE_STATE_KEYS: Record<string, LocaleKey> = {
  inactive: 'monitoring.ruleGroupState.inactive',
  pending: 'monitoring.ruleGroupState.pending',
  firing: 'monitoring.ruleGroupState.firing',
  disabled: 'monitoring.ruleGroupState.disabled',
};

export function ruleStateLabel(t: Translate, state: string): string {
  const key = RULE_STATE_KEYS[state.toLowerCase()];
  return key ? t(key) : state || '-';
}

/** One rule state's badge tone: firing is the alarm, pending is building, the rest calm. */
export function ruleStateTone(state: string): 'danger' | 'warning' | 'success' | 'neutral' {
  const normalized = state.toLowerCase();
  if (normalized === 'firing') return 'danger';
  if (normalized === 'pending') return 'warning';
  if (normalized === 'inactive') return 'success';
  return 'neutral';
}

export function alertSeverityLabel(t: Translate, severity: string): string {
  const key = SEVERITY_KEYS[severity.toLowerCase()];
  return key ? t(key) : severity || '-';
}
/** Policy scope → the word the list and detail use for it. */
export function scopeLabel(t: Translate, scope: RuleGroupScope): string {
  const map = {
    global: 'monitoring.ruleGroups.scope.global',
    cluster: 'monitoring.ruleGroups.scope.cluster',
    project: 'monitoring.ruleGroups.scope.project',
  } as const;
  return t(map[scope]);
}

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

import type { LocaleKey } from '@kube-ai-hub/locales';
import type { ClusterAlertSource } from '@kube-ai-hub/api-client';

/**
 * Locale keys and label helpers for the cluster alerting pages.
 *
 * Alert states and severities come from the aggregated v2beta1 API as the
 * controller's raw strings (`firing`, `critical`…). The project monitoring page
 * has the same mapping; keeping it here means a new state is added in one place,
 * and an unknown value falls back to the raw label rather than a missing key.
 */
const ALERT_STATE_KEYS: Record<string, LocaleKey> = {
  firing: 'monitoring.state.firing',
  pending: 'monitoring.state.pending',
  resolved: 'monitoring.state.resolved',
};

const ALERT_SEVERITY_KEYS: Record<string, LocaleKey> = {
  critical: 'monitoring.severity.critical',
  error: 'monitoring.severity.error',
  warning: 'monitoring.severity.warning',
  info: 'monitoring.severity.info',
};

const ALERT_SOURCE_KEYS: Record<ClusterAlertSource, LocaleKey> = {
  custom: 'cluster.alerting.tab.custom',
  builtin: 'cluster.alerting.tab.builtin',
};

type Translate = (key: LocaleKey) => string;

export function alertStateLabel(t: Translate, state: string): string {
  const key = ALERT_STATE_KEYS[state.toLowerCase()];
  return key ? t(key) : state || '-';
}

export function alertSeverityLabel(t: Translate, severity: string): string {
  const key = ALERT_SEVERITY_KEYS[severity.toLowerCase()];
  return key ? t(key) : severity || '-';
}

export function alertSourceLabel(t: Translate, source: ClusterAlertSource): string {
  return t(ALERT_SOURCE_KEYS[source]);
}

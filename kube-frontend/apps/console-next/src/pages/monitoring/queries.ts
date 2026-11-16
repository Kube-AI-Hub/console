import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  alertMessagesApi,
  alertingModel,
  alertingRulesApi,
  type AlertMessage,
  type AlertMessageScope,
  type AlertingRuleSummary,
  type ResourceListParams,
} from '@kube-ai-hub/api-client';
import type { LocaleKey } from '@kube-ai-hub/locales';
import { api } from '@/api';

/** Monitoring kinds this area exposes. */
export type MonitoringKind = 'alerts' | 'alertingrules';

/**
 * List parameters, plus the two alert filters the old console offered.
 *
 * They are separate from the generic resource-list parameters because they are
 * alert-specific query fields: `state` is a top-level parameter and `severity` is a
 * label filter, while a rule list has neither.
 */
export interface MonitoringListParams extends Omit<ResourceListParams, 'signal'> {
  state?: string;
  severity?: string;
}

/**
 * Cache key for the two monitoring lists.
 *
 * The project scope is part of the key because alert messages are read from a
 * namespaced collection: a page that filtered by project but reused another
 * project's cached page would show the wrong history.
 */
export function monitoringKey(kind: MonitoringKind, params: MonitoringListParams) {
  return [
    'monitoring',
    kind,
    params.cluster,
    params.namespace,
    params.page,
    params.pageSize,
    params.sortBy,
    params.order,
    params.keyword,
    params.state,
    params.severity,
  ] as const;
}

/**
 * List query for one monitoring kind.
 *
 * Alerts read the aggregated v2beta1 collection, which is the **only** collection
 * that actually returns records on this deployment. The page used to read
 * `/kapis/alerting.kubesphere.io/v1alpha2/.../alerts`, which answers 200 with an
 * empty body — that is not "no alerts", it is the wrong API group (the old console
 * itself reads v2beta1: `console/src/stores/alerting/message.js`). Rule groups read
 * the CRD-backed group; the legacy `alertingrules` model keeps its own client for
 * clusters that still serve it.
 */
export function useMonitoringList(kind: MonitoringKind, params: MonitoringListParams) {
  return useQuery({
    queryKey: monitoringKey(kind, params),
    queryFn: async ({ signal }) => {
      if (kind === 'alerts') {
        return alertMessagesApi(api).list({
          cluster: params.cluster,
          scope: 'project',
          namespace: params.namespace,
          page: params.page,
          pageSize: params.pageSize,
          ...(params.keyword ? { keyword: params.keyword } : {}),
          // The only server-supported sort key for messages is the trigger time;
          // the list exposes exactly that, so the mapping is total.
          sortBy: 'activeAt',
          ...(params.order ? { order: params.order } : {}),
          ...(params.state ? { state: params.state } : {}),
          ...(params.severity ? { severity: params.severity } : {}),
          signal,
        }) as Promise<{ items: Array<AlertMessage | AlertingRuleSummary>; total: number }>;
      }
      return alertingRulesApi(api).list({ ...params, signal }) as Promise<{
        items: Array<AlertMessage | AlertingRuleSummary>;
        total: number;
      }>;
    },
  });
}

/**
 * Which alerting model the cluster serves.
 *
 * Cached for the session: installing or removing an alerting CRD is not something
 * that happens while a page is open, and the probe costs a request on every render
 * otherwise.
 */
export function useAlertingModel() {
  return useQuery({
    queryKey: ['alerting-model'],
    queryFn: ({ signal }) => alertingModel(api, signal),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useToggleRule(params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; enabled: boolean }) =>
      alertingRulesApi(api).setEnabled({ cluster: params.cluster, namespace: params.namespace, ...input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['monitoring', 'alertingrules'] }),
  });
}

/**
 * Alert messages of one policy, newest first.
 *
 * The page number is part of the key: the policy detail keeps its own pager and a
 * shared key would make page 2 overwrite page 1's data. `ruleGroup` is sent to the
 * server (`label_filters=rule_group=<name>`) instead of filtering a page locally —
 * filtering after pagination would show "no alerts" for a policy whose alerts sit
 * on a later page.
 */
export function useAlertMessages(params: {
  cluster?: string;
  scope: AlertMessageScope;
  /** Required for project scope. */
  namespace?: string;
  ruleGroup: string;
  page: number;
  pageSize: number;
}) {
  return useQuery({
    queryKey: ['alert-messages', params.cluster, params.scope, params.namespace, params.ruleGroup, params.page, params.pageSize],
    queryFn: ({ signal }) =>
      alertMessagesApi(api).list({
        ...(params.cluster ? { cluster: params.cluster } : {}),
        scope: params.scope,
        ...(params.namespace ? { namespace: params.namespace } : {}),
        ruleGroup: params.ruleGroup,
        page: params.page,
        pageSize: params.pageSize,
        sortBy: 'activeAt',
        order: 'desc',
        signal,
      }),
    retry: false,
  });
}

export interface MonitoringDescriptor {
  titleKey: LocaleKey;
  descriptionKey: LocaleKey;
  emptyTitleKey: LocaleKey;
  emptyDescriptionKey: LocaleKey;
  /** Rules can be enabled/disabled in place; alert messages are history. */
  allowToggle: boolean;
}

export const MONITORING_DESCRIPTORS: Record<MonitoringKind, MonitoringDescriptor> = {
  alerts: {
    titleKey: 'monitoring.alerts.title',
    descriptionKey: 'monitoring.alerts.description',
    emptyTitleKey: 'monitoring.alerts.emptyTitle',
    emptyDescriptionKey: 'monitoring.alerts.emptyDescription',
    allowToggle: false,
  },
  alertingrules: {
    titleKey: 'monitoring.rules.title',
    descriptionKey: 'monitoring.rules.description',
    emptyTitleKey: 'monitoring.rules.emptyTitle',
    emptyDescriptionKey: 'monitoring.rules.emptyDescription',
    allowToggle: true,
  },
};

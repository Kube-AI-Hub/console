import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertingApi, alertingRulesApi, type AlertSummary, type AlertingRuleSummary, type ResourceListParams } from '@kube-ai-hub/api-client';
import type { LocaleKey } from '@kube-ai-hub/locales';
import { api } from '@/api';

/** Monitoring kinds this area exposes. */
export type MonitoringKind = 'alerts' | 'alertingrules';

/**
 * The two kinds return different row types, so the client is typed per kind.
 *
 * A union return here made `list()` resolve to `{}` at every call site — the two
 * generic overloads collapse when merged. Callers that need the concrete type pick
 * the kind themselves (see `useMonitoringList`).
 */
export function monitoringKey(kind: MonitoringKind, params: Omit<ResourceListParams, 'signal'>) {
  return ['monitoring', kind, params.cluster, params.namespace, params.page, params.pageSize, params.sortBy, params.order, params.keyword] as const;
}

/**
 * List query for one monitoring kind.
 *
 * One `useQuery` call with the kind chosen **inside** the query function: React
 * requires the same hooks in the same order on every render, so branching at the
 * hook level would be a latent rules-of-hooks bug the day a page can switch kind.
 * The row type is the union of the two kinds; the page narrows it for display.
 */
export function useMonitoringList(kind: MonitoringKind, params: Omit<ResourceListParams, 'signal'>) {
  return useQuery({
    queryKey: monitoringKey(kind, params),
    queryFn: async ({ signal }) => {
      const client = kind === 'alerts' ? alertingApi(api, 'alerts') : alertingRulesApi(api);
      return client.list({ ...params, signal }) as Promise<{
        items: Array<AlertSummary | AlertingRuleSummary>;
        total: number;
      }>;
    },
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

export function useDeleteAlert(params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (names: string[]) => alertingApi(api, 'alerts').remove({ ...params, names }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['monitoring', 'alerts'] }),
  });
}

export interface MonitoringDescriptor {
  titleKey: LocaleKey;
  descriptionKey: LocaleKey;
  emptyTitleKey: LocaleKey;
  emptyDescriptionKey: LocaleKey;
  /** Alerts are history and can be deleted; rules are configuration. */
  allowDelete: boolean;
  /** Rules can be enabled/disabled in place. */
  allowToggle: boolean;
}

export const MONITORING_DESCRIPTORS: Record<MonitoringKind, MonitoringDescriptor> = {
  alerts: {
    titleKey: 'monitoring.alerts.title',
    descriptionKey: 'monitoring.alerts.description',
    emptyTitleKey: 'monitoring.alerts.emptyTitle',
    emptyDescriptionKey: 'monitoring.alerts.emptyDescription',
    allowDelete: true,
    allowToggle: false,
  },
  alertingrules: {
    titleKey: 'monitoring.rules.title',
    descriptionKey: 'monitoring.rules.description',
    emptyTitleKey: 'monitoring.rules.emptyTitle',
    emptyDescriptionKey: 'monitoring.rules.emptyDescription',
    allowDelete: false,
    allowToggle: true,
  },
};

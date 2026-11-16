import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { type AlertMessage } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';

/**
 * Where an alert message came from, as links.
 *
 * The old console let a reader jump from a message to the policy that fired and to the
 * object the alert is about; without them a message is a dead end. Both facts live in the
 * alert's own labels, so deciding the links needs no request — only the workspace of the
 * object's namespace is unknown when the message is opened from the cluster-scope list,
 * and that is one namespace read.
 */
export interface AlertLinkTargets {
  ruleName: string;
  scope: 'global' | 'cluster' | 'project';
  targetKind: string;
  targetName: string;
  objectNamespace: string;
}

const TARGET_LABELS = [
  ['pod', 'pods'],
  ['deployment', 'deployments'],
  ['statefulset', 'statefulsets'],
  ['daemonset', 'daemonsets'],
  ['job', 'jobs'],
  ['cronjob', 'cronjobs'],
  ['service', 'services'],
  ['ingress', 'ingresses'],
] as const;

/**
 * Resolve an alert message to its drill-down targets.
 *
 * Pure on purpose: the label contract is the part that can be wrong (a policy labelled
 * global must not be looked up as a project policy; an alert with only a container label
 * must not invent an object row), so it is unit-tested rather than only clicked through.
 */
export function resolveAlertLinks(input: {
  labels: Record<string, string>;
  ruleGroup?: string | undefined;
  fallbackNamespace: string;
}): AlertLinkTargets {
  const labels = input.labels ?? {};
  const ruleName = input.ruleGroup || labels['rule_group'] || '';
  const level = labels['rule_level'];
  const scope: AlertLinkTargets['scope'] = level === 'global' || level === 'cluster' ? level : 'project';
  const objectNamespace = labels['namespace'] || input.fallbackNamespace;
  const target = TARGET_LABELS.find(([key]) => Boolean(labels[key])) ?? null;
  return {
    ruleName,
    scope,
    targetKind: target ? target[1] : '',
    targetName: target ? labels[target[0]] ?? '' : '',
    objectNamespace,
  };
}

function TargetLink({
  kind,
  params,
  label,
}: {
  kind: string;
  params: { workspace: string; cluster: string; namespace: string; name: string };
  label: string;
}): React.ReactElement | null {
  const common = { params, className: 'text-ai-link hover:underline', 'data-ai-id': 'alerts:detail:target-link' } as const;
  switch (kind) {
    case 'pods':
      return <Link to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/pods/$name" {...common}>{label}</Link>;
    case 'deployments':
      return <Link to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/deployments/$name" {...common}>{label}</Link>;
    case 'statefulsets':
      return <Link to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/statefulsets/$name" {...common}>{label}</Link>;
    case 'daemonsets':
      return <Link to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/daemonsets/$name" {...common}>{label}</Link>;
    case 'jobs':
      return <Link to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/jobs/$name" {...common}>{label}</Link>;
    case 'cronjobs':
      return <Link to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/cronjobs/$name" {...common}>{label}</Link>;
    case 'services':
      return <Link to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/services/$name" {...common}>{label}</Link>;
    case 'ingresses':
      return <Link to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/ingresses/$name" {...common}>{label}</Link>;
    default:
      return null;
  }
}

function useNamespaceWorkspace(namespace: string, enabled: boolean): string {
  const query = useQuery({
    enabled: enabled && Boolean(namespace),
    queryKey: ['namespace-workspace', namespace],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const item = await apiClient.request<{ metadata?: { labels?: Record<string, string> } }>(
        `/api/v1/namespaces/${encodeURIComponent(namespace)}`,
        { signal },
      );
      return item?.metadata?.labels?.['kubesphere.io/workspace'] ?? '';
    },
  });
  return query.data ?? '';
}

export interface AlertDrillDownProps {
  message: AlertMessage;
  cluster: string;
  workspace?: string | undefined;
  fallbackNamespace: string;
}

export function AlertDrillDown({ message, cluster, workspace, fallbackNamespace }: AlertDrillDownProps): React.ReactElement | null {
  const t = useT();
  const targets = resolveAlertLinks({ labels: message.labels ?? {}, ruleGroup: message.ruleGroup, fallbackNamespace });
  const needsLookup = !workspace && (Boolean(targets.ruleName) || Boolean(targets.targetKind));
  const resolved = useNamespaceWorkspace(targets.objectNamespace, needsLookup);
  const effectiveWorkspace = workspace || resolved;
  if (!effectiveWorkspace) return null;
  if (!targets.ruleName && !targets.targetKind) return null;
  return (
    <section className="flex flex-col gap-2" data-ai-id="alerts:detail:links">
      <h3 className="text-sm font-medium text-ai-fg">{t('monitoring.detail.links')}</h3>
      <div className="flex flex-wrap gap-3">
        {targets.ruleName ? (
          <Link
            to="/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/alertingrules/$name"
            params={{ workspace: effectiveWorkspace, cluster, namespace: targets.objectNamespace, name: targets.ruleName }}
            search={{ scope: targets.scope }}
            className="text-ai-link hover:underline"
            data-ai-id="alerts:detail:rule-link"
          >
            {t('monitoring.detail.openRule', { name: targets.ruleName })}
          </Link>
        ) : null}
        {targets.targetKind && targets.targetName ? (
          <TargetLink
            kind={targets.targetKind}
            params={{ workspace: effectiveWorkspace, cluster, namespace: targets.objectNamespace, name: targets.targetName }}
            label={t('monitoring.detail.openTarget', { kind: targets.targetKind, name: targets.targetName })}
          />
        ) : null}
      </div>
    </section>
  );
}

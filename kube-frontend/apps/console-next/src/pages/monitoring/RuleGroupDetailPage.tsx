import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import {
  ruleGroupsApi,
  ruleGroupsWriteApi,
  type AlertMessage,
  type RuleGroupDetail,
  type RuleGroupScope,
  type RuleGroupSummary,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, AiSurface, Badge, Icon, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { MutationAlert, ResourceErrorPanel, errorMessage } from '@/components/resource/ResourceErrorPanel';
import { formatTimestamp } from '@/lib/time';
import { AlertMessagesTimeline } from './AlertMessagesTimeline';
import { alertStateLabel, scopeLabel } from './alertLabels';
import { useRuleGroupPermissions } from './permissions';
import { useAlertMessages } from './queries';
import { RuleGroupDialog } from './RuleGroupDialog';

/**
 * 告警策略详情.
 *
 * The old console's policy detail was a full page with a left column (status,
 * check interval, evaluation time, creator) and two tabs: **规则** and
 * **告警消息**. The migrated list only had a modal with the rule table, so a
 * reader could not answer the question the page exists for: "are any of these
 * rules firing right now, and what do the alerts say". This page restores that.
 *
 * The detail is route-based rather than a drawer for one concrete reason: the
 * alert history pages, filters and retries on its own, and a modal that grows a
 * second data fetch with its own error state is a page in a dialog. It also makes
 * the detail linkable from the cluster pages and from a 告警消息 row later on.
 *
 * Scope is a search parameter, not a path segment: the project list merges
 * global, cluster and project rule groups into one table, so the same `$name` can
 * be any of the three. `scope` says which collection to read; it defaults to
 * `project` for URLs typed by hand.
 */
export interface RuleGroupDetailPageProps {
  cluster: string;
  namespace: string;
  name: string;
  scope: RuleGroupScope;
}

/** The project's policy list; the back link and delete both return here. */
const LIST_ROUTE = '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/alertingrules';

export function RuleGroupDetailPage({ cluster, namespace, name, scope }: RuleGroupDetailPageProps): React.ReactElement {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const routeParams = useParams({ strict: false }) as { workspace?: string };
  const workspace = routeParams.workspace ?? 'system-workspace';
  const permissions = useRuleGroupPermissions({ cluster, namespace });

  const [editing, setEditing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const detailQuery = useQuery({
    queryKey: ['rule-group-detail', cluster, namespace, scope, name],
    queryFn: ({ signal }) =>
      ruleGroupsApi(apiClient).get({
        name,
        scope,
        ...(scope === 'project' ? { namespace } : {}),
        signal,
      }),
  });

  /*
   * All active alerts of this group, for the per-rule state column.
   *
   * Separate from the timeline's own paged query on purpose: the timeline pages
   * 10 records, while a rule's state must be visible even when its alert is not on
   * page 1. One extra request, no duplicated mapping code. `MAX_ROWS` is documented
   * because every alert beyond it is invisible to the rule-state column (the table
   * says whether the map is complete).
   */
  const MAX_ROWS = 100;
  const activeQuery = useAlertMessages({
    scope,
    ...(scope === 'project' ? { namespace } : {}),
    ruleGroup: name,
    page: 1,
    pageSize: MAX_ROWS,
  });
  const activeByRule = React.useMemo(() => {
    const map = new Map<string, AlertMessage>();
    for (const message of activeQuery.data?.items ?? []) {
      if (message.name && !map.has(message.name)) map.set(message.name, message);
    }
    return map;
  }, [activeQuery.data]);

  const toggle = useMutation({
    mutationFn: (enabled: boolean) =>
      ruleGroupsApi(apiClient).setEnabled({
        name,
        scope,
        ...(scope === 'project' ? { namespace } : {}),
        enabled,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rule-group-detail', cluster, namespace, scope, name] });
      void queryClient.invalidateQueries({ queryKey: ['rule-groups', cluster] });
    },
  });

  const remove = useMutation({
    mutationFn: () => ruleGroupsWriteApi(apiClient).remove({ namespace, name }),
    onSuccess: async () => {
      setDeleting(false);
      void queryClient.invalidateQueries({ queryKey: ['rule-groups', cluster] });
      await navigate({ to: LIST_ROUTE, params: { workspace, cluster, namespace } });
    },
  });

  const detail = detailQuery.data;
  const canEdit = detail !== undefined && detail.scope === 'project' && !detail.builtin && permissions.update.project;
  const canDelete = detail !== undefined && detail.scope === 'project' && !detail.builtin && permissions.deleteProject;
  const canToggle = permissions.update[scope];
  const state = detailQuery.isPending ? 'loading' : detailQuery.isError ? 'error' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="alertingrules:detail-surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={detailQuery.error} onRetry={() => void detailQuery.refetch()} retryAiId="alertingrules:detail-retry" />
        <div className="mt-3">
          <BackLink workspace={workspace} cluster={cluster} namespace={namespace} />
        </div>
      </AiSurface>
    );
  }

  if (state === 'loading' || !detail) {
    return (
      <AiSurface as="section" aiId="alertingrules:detail-surface" state="loading" className="min-w-0">
        <Skeleton className="h-56 w-full" />
      </AiSurface>
    );
  }

  return (
    <AiSurface as="section" aiId="alertingrules:detail" state={state} className="flex min-w-0 flex-col gap-4">
      <BackLink workspace={workspace} cluster={cluster} namespace={namespace} />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-base font-semibold text-ai-fg">{detail.name}</h1>
            <Badge tone={detail.enabled ? 'success' : 'neutral'}>
              {detail.enabled ? t('monitoring.status.enabled') : t('monitoring.status.disabled')}
            </Badge>
            <Badge tone="info">{scopeLabel(t, detail.scope)}</Badge>
            <Badge tone={detail.builtin ? 'neutral' : 'info'}>
              {detail.builtin ? t('monitoring.ruleGroups.builtin') : t('monitoring.ruleGroups.custom')}
            </Badge>
          </div>
          <p className="text-xs text-ai-fg-muted">{detail.description || t('monitoring.ruleGroups.noDescription')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {canEdit ? (
            <AiButton aiId="alertingrules:detail:edit" size="sm" variant="secondary" onClick={() => setEditing(true)}>
              {t('common.edit')}
            </AiButton>
          ) : null}
          {canToggle ? (
            <AiButton
              aiId="alertingrules:detail:toggle"
              size="sm"
              variant="secondary"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate(!detail.enabled)}
            >
              {detail.enabled ? t('monitoring.action.disable') : t('monitoring.action.enable')}
            </AiButton>
          ) : null}
          {canDelete ? (
            <AiButton aiId="alertingrules:detail:delete" size="sm" variant="danger" onClick={() => setDeleting(true)}>
              {t('common.delete')}
            </AiButton>
          ) : null}
        </div>
      </header>

      <MutationAlert error={toggle.error} />

      <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="alertingrules:detail:attributes">
        <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('monitoring.ruleGroups.detail.attributes')}</h2>
        <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]">
          <DefinitionRow label={t('monitoring.field.name')} value={detail.name} />
          <DefinitionRow label={t('monitoring.ruleGroups.field.description')} value={detail.description || t('monitoring.ruleGroups.noDescription')} />
          <DefinitionRow label={t('monitoring.ruleGroups.scope')} value={scopeLabel(t, detail.scope)} />
          <DefinitionRow label={t('monitoring.column.ruleStatus')} value={detail.enabled ? t('monitoring.status.enabled') : t('monitoring.status.disabled')} />
          <DefinitionRow label={t('monitoring.ruleGroups.type')} value={detail.builtin ? t('monitoring.ruleGroups.builtin') : t('monitoring.ruleGroups.custom')} />
          <DefinitionRow label={t('monitoring.ruleGroups.ruleCount')} value={String(detail.ruleCount)} />
          <DefinitionRow label={t('monitoring.field.createdAt')} value={formatTimestamp(detail.createdAt)} />
        </dl>
      </section>

      <RuleSection
        detail={detail}
        activeByRule={activeByRule}
        activeTotal={activeQuery.data?.total ?? 0}
        activeFetched={activeQuery.data?.items.length ?? 0}
      />
      <AlertMessagesTimeline scope={scope} {...(scope === 'project' ? { namespace } : {})} ruleGroup={detail.name} />

      <RuleGroupDialog
        open={editing}
        onOpenChange={(open) => {
          setEditing(open);
          if (!open) void queryClient.invalidateQueries({ queryKey: ['rule-group-detail', cluster, namespace, scope, name] });
        }}
        cluster={cluster}
        namespace={namespace}
        group={detail as RuleGroupSummary}
      />

      {deleting ? (
        <DeleteDialog
          open
          onOpenChange={(open) => !open && setDeleting(false)}
          names={[detail.name]}
          resource="alertingrules"
          noun={t('monitoring.ruleGroups.title')}
          pending={remove.isPending}
          {...(remove.error ? { error: errorMessage(t, remove.error) } : {})}
          onConfirm={async () => {
            await remove.mutateAsync();
          }}
        />
      ) : null}
    </AiSurface>
  );
}

/**
 * The rules of one group.
 *
 * The expression is shown in full and wraps: it is the "threshold" of a PromQL
 * rule (the comparison lives inside the expression), and truncating it hides the
 * exact condition the reader opened the page to check.
 *
 * The state column is derived from the active alerts of this group, not fabricated:
 * the rule-group API has no per-rule evaluation status. A rule with no active alert
 * reads **正常**, not `-` — "evaluated and not firing" is a fact, while `-` would
 * claim the state is unknown.
 */
function RuleSection({
  detail,
  activeByRule,
  activeTotal,
  activeFetched,
}: {
  detail: RuleGroupDetail;
  activeByRule: Map<string, AlertMessage>;
  activeTotal: number;
  activeFetched: number;
}): React.ReactElement {
  const t = useT();
  return (
    <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="alertingrules:detail:rules">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-ai-fg">
          {t('monitoring.ruleGroups.rules')} ({detail.rules.length})
        </h2>
        {activeTotal > activeFetched ? (
          <span className="text-[11px] text-ai-fg-muted">
            {t('monitoring.ruleGroups.detail.ruleStatePartial', { fetched: activeFetched, total: activeTotal })}
          </span>
        ) : null}
      </header>

      {detail.rules.length === 0 ? (
        <p className="text-xs text-ai-fg-muted" {...actionProps('alertingrules:detail:no-rules')}>
          {t('monitoring.ruleGroups.rule.noRules')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs" data-ai-id="alertingrules:detail:rule-table">
            <thead>
              <tr className="border-b border-ai-line text-ai-fg-muted">
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('monitoring.ruleGroups.rule.state')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('monitoring.ruleGroups.rule.name')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('monitoring.ruleGroups.rule.severity')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('monitoring.ruleGroups.rule.duration')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('monitoring.ruleGroups.rule.summary')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('monitoring.ruleGroups.rule.expressionThreshold')}</th>
              </tr>
            </thead>
            <tbody>
              {detail.rules.map((rule) => {
                const active = activeByRule.get(rule.name);
                return (
                  <tr key={rule.name} className="border-b border-ai-line align-top" data-ai-row={rule.name}>
                    <td className="whitespace-nowrap px-2 py-2">
                      {active ? (
                        <Badge tone={active.state === 'firing' ? 'danger' : 'warning'}>{alertStateLabel(t, active.state)}</Badge>
                      ) : (
                        <span className="text-ai-fg-secondary">{t('monitoring.ruleGroups.rule.stateNormal')}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 font-medium text-ai-fg">{rule.name}</td>
                    <td className="px-2 py-2 text-ai-fg-secondary">{rule.severity || '-'}</td>
                    <td className="px-2 py-2 tabular-nums text-ai-fg-secondary">{rule.duration || '-'}</td>
                    <td className="min-w-0 px-2 py-2 text-ai-fg-secondary">
                      <span className="block break-words">{rule.summary || rule.description || '-'}</span>
                      {rule.message ? <span className="mt-1 block break-words text-ai-fg-muted">{rule.message}</span> : null}
                    </td>
                    <td className="min-w-0 px-2 py-2">
                      <code className="block break-words font-mono text-[11px] text-ai-fg-muted">{rule.expression || '-'}</code>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BackLink({ workspace, cluster, namespace }: { workspace: string; cluster: string; namespace: string }): React.ReactElement {
  const t = useT();
  return (
    <Link
      to={LIST_ROUTE}
      params={{ workspace, cluster, namespace }}
      className="inline-flex w-fit items-center gap-1 text-xs text-ai-accent hover:underline"
      {...actionProps('alertingrules:detail:back')}
    >
      <Icon name="chevron-left" size={12} />
      {t('monitoring.ruleGroups.detail.back')}
    </Link>
  );
}

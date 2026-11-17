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
import { AiButton, AiSurface, Badge, Button, Icon, InputSearch, Modal, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { DefinitionRow } from '@/components/resource/DefinitionRow';
import { DeleteDialog } from '@/components/resource/DeleteDialog';
import { DialogSuspense } from '@/components/resource/DialogSuspense';
import { MutationAlert, ResourceErrorPanel, errorMessage } from '@/components/resource/ResourceErrorPanel';
import { toYaml } from '@/components/resource/yaml';
import { formatTimestamp } from '@/lib/time';
import { AlertMessagesTimeline } from './AlertMessagesTimeline';
import { alertSeverityLabel, alertStateLabel, ruleStateLabel, ruleStateTone, scopeLabel } from './alertLabels';
import { RuleMetricDialog } from './RuleMetricDialog';
import { useRuleGroupPermissions } from './permissions';
import { useAlertMessages } from './queries';
import { RuleGroupDialog } from './RuleGroupDialog';

/*
 * The YAML editor is 188 KB gzip of CodeMirror; a detail page must not pay for it until
 * the reader asks for it (DEC-CORE-KUBE_FRONTEND-04).
 */
const LazyYamlDialog = React.lazy(async () => {
  const module = await import('@/components/resource/YamlDialog');
  return { default: module.YamlDialog };
});

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
  /** Required for project scope; omitted when `from` is `cluster`. */
  namespace?: string;
  name: string;
  scope: RuleGroupScope;
  /**
   * Which list opened this detail, because it decides the back link.
   *
   * The same page serves two lists: the project list (which merges global, cluster and
   * project groups) and the cluster page (two tabs, custom cluster groups and the
   * installer's global ones). Returning to the wrong list loses the reader's tab and
   * filter, so the context is explicit rather than inferred from the scope.
   */
  from?: 'project' | 'cluster';
}

/** The project's policy list; the back link and delete both return here. */
const PROJECT_LIST_ROUTE = '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/alertingrules';
/** The cluster page's two tabs live on one route. */
const CLUSTER_LIST_ROUTE = '/kube-frontend/clusters/$cluster/alerting-policies';

export function RuleGroupDetailPage({
  cluster,
  namespace = '',
  name,
  scope,
  from = 'project',
}: RuleGroupDetailPageProps): React.ReactElement {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const routeParams = useParams({ strict: false }) as { workspace?: string };
  const workspace = routeParams.workspace ?? 'system-workspace';
  const permissions = useRuleGroupPermissions({ cluster, namespace });
  /*
   * The cluster page reads the aggregated path: its attributes include the group's
   * evaluation time and last evaluation, and each rule's state. The project page keeps
   * deriving rule state from the alert list, because a project group's alerts are the
   * page's own second list; switching its read path is not part of this change.
   */
  const withStatus = from === 'cluster';

  const [editing, setEditing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [editingYaml, setEditingYaml] = React.useState(false);
  const [yamlError, setYamlError] = React.useState('');
  /** Disabling stops evaluation, so it asks once — as the old console's detail did. */
  const [confirmDisable, setConfirmDisable] = React.useState(false);

  const detailQuery = useQuery({
    queryKey: ['rule-group-detail', cluster, namespace, scope, name, withStatus],
    queryFn: ({ signal }) =>
      ruleGroupsApi(apiClient).get({
        name,
        scope,
        ...(scope === 'project' ? { namespace } : {}),
        ...(withStatus ? { withStatus: true, cluster } : {}),
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
      void queryClient.invalidateQueries({ queryKey: ['cluster-rule-groups', cluster] });
    },
  });

  /**
   * Whole-object write from the YAML editor.
   *
   * The aggregated read injects `status`; the CRD has no status subresource, so a
   * write that carries it is rejected. The editor is seeded without it, and the object
   * is stripped here too (a reader can paste status back in).
   */
  const replaceYaml = useMutation({
    mutationFn: async (object: Record<string, unknown>) => {
      const body = { ...object } as Record<string, unknown>;
      delete body['status'];
      await ruleGroupsWriteApi(apiClient).replace({
        scope: scope === 'project' ? 'project' : 'cluster',
        ...(scope === 'project' ? { namespace } : {}),
        name,
        object: body,
      });
    },
    onSuccess: () => {
      setEditingYaml(false);
      setYamlError('');
      void queryClient.invalidateQueries({ queryKey: ['rule-group-detail', cluster, namespace, scope, name] });
      void queryClient.invalidateQueries({ queryKey: ['cluster-rule-groups', cluster] });
    },
    onError: (error) => setYamlError(errorMessage(t, error)),
  });

  const remove = useMutation({
    mutationFn: () =>
      ruleGroupsWriteApi(apiClient).remove({
        scope: scope === 'project' ? 'project' : 'cluster',
        ...(scope === 'project' ? { namespace } : {}),
        name,
      }),
    onSuccess: async () => {
      setDeleting(false);
      void queryClient.invalidateQueries({ queryKey: ['rule-groups', cluster] });
      void queryClient.invalidateQueries({ queryKey: ['cluster-rule-groups', cluster] });
      if (from === 'cluster' || scope !== 'project') {
        await navigate({ to: CLUSTER_LIST_ROUTE, params: { cluster } });
        return;
      }
      await navigate({ to: PROJECT_LIST_ROUTE, params: { workspace, cluster, namespace } });
    },
  });

  const detail = detailQuery.data;
  const writable = detail !== undefined && !detail.builtin;
  const canEdit =
    writable &&
    (detail.scope === 'project' ? permissions.update.project : detail.scope === 'cluster' ? permissions.update.cluster : false);
  const canDelete =
    writable &&
    (detail.scope === 'project' ? permissions.deleteProject : detail.scope === 'cluster' ? permissions.deleteCluster : false);
  const canToggle = permissions.update[scope];
  const state = detailQuery.isPending ? 'loading' : detailQuery.isError ? 'error' : 'ready';

  if (state === 'error') {
    return (
      <AiSurface as="section" aiId="alertingrules:detail-surface" state="error" className="min-w-0">
        <ResourceErrorPanel error={detailQuery.error} onRetry={() => void detailQuery.refetch()} retryAiId="alertingrules:detail-retry" />
        <div className="mt-3">
          <BackLink from={from} workspace={workspace} cluster={cluster} namespace={namespace} />
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
      <BackLink from={from} workspace={workspace} cluster={cluster} namespace={namespace} />

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
          {canEdit && from === 'cluster' ? (
            <AiButton
              aiId="alertingrules:detail:edit-yaml"
              size="sm"
              variant="secondary"
              onClick={() => {
                setYamlError('');
                setEditingYaml(true);
              }}
            >
              {t('resource.action.editYaml')}
            </AiButton>
          ) : null}
          {canToggle ? (
            <AiButton
              aiId="alertingrules:detail:toggle"
              size="sm"
              variant="secondary"
              disabled={toggle.isPending}
              onClick={() => {
                if (detail.enabled) setConfirmDisable(true);
                else toggle.mutate(true);
              }}
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
          <DefinitionRow label={t('monitoring.ruleGroups.field.alias')} value={detail.alias || '-'} />
          <DefinitionRow label={t('monitoring.ruleGroups.field.description')} value={detail.description || t('monitoring.ruleGroups.noDescription')} />
          <DefinitionRow label={t('monitoring.ruleGroups.scope')} value={scopeLabel(t, detail.scope)} />
          <DefinitionRow label={t('monitoring.column.ruleStatus')} value={detail.enabled ? t('monitoring.status.enabled') : t('monitoring.status.disabled')} />
          <DefinitionRow label={t('monitoring.ruleGroups.type')} value={detail.builtin ? t('monitoring.ruleGroups.builtin') : t('monitoring.ruleGroups.custom')} />
          <DefinitionRow label={t('monitoring.ruleGroups.ruleCount')} value={String(detail.ruleCount)} />
          <DefinitionRow label={t('monitoring.ruleGroups.checkInterval')} value={detail.interval || '-'} />
          {withStatus ? (
            <DefinitionRow
              label={t('monitoring.ruleGroups.evaluationTime')}
              value={detail.status?.evaluationTime === undefined ? '-' : `${detail.status.evaluationTime.toFixed(3)} ${t('monitoring.ruleGroups.seconds')}`}
            />
          ) : null}
          {withStatus ? (
            <DefinitionRow
              label={t('monitoring.ruleGroups.lastEvaluation')}
              value={detail.status?.lastEvaluation ? formatTimestamp(detail.status.lastEvaluation) : '-'}
            />
          ) : null}
          <DefinitionRow label={t('monitoring.field.createdAt')} value={formatTimestamp(detail.createdAt)} />
          <DefinitionRow label={t('monitoring.ruleGroups.creator')} value={detail.creator || '-'} />
        </dl>
      </section>

      <RuleSection
        detail={detail}
        activeByRule={activeByRule}
        activeTotal={activeQuery.data?.total ?? 0}
        activeFetched={activeQuery.data?.items.length ?? 0}
        useStatus={withStatus && detail.status !== undefined}
      />
      <AlertMessagesTimeline scope={scope} {...(scope === 'project' ? { namespace } : {})} ruleGroup={detail.name} />

      <RuleGroupDialog
        open={editing}
        onOpenChange={(open) => {
          setEditing(open);
          if (!open) void queryClient.invalidateQueries({ queryKey: ['rule-group-detail', cluster, namespace, scope, name] });
        }}
        cluster={cluster}
        scope={detail.scope}
        {...(detail.scope === 'project' ? { namespace } : {})}
        group={detail as RuleGroupSummary}
      />

      <Modal
        open={confirmDisable}
        onOpenChange={(open) => !open && !toggle.isPending && setConfirmDisable(false)}
        title={t('cluster.alerting.policies.disableTitle')}
        size="md"
      >
        {detail ? (
          <div className="flex flex-col gap-4 text-xs" data-ai-id="alertingrules:detail:disable-dialog">
            <p className="text-ai-fg-secondary">{t('cluster.alerting.policies.disableDesc', { name: detail.name })}</p>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={toggle.isPending}
                {...actionProps('alertingrules:detail:disable-cancel')}
                onClick={() => setConfirmDisable(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={toggle.isPending}
                {...actionProps('alertingrules:detail:disable-confirm')}
                onClick={() => {
                  toggle.mutate(false);
                  setConfirmDisable(false);
                }}
              >
                {t('monitoring.action.disable')}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {editingYaml && detail ? (
        <DialogSuspense>
          <LazyYamlDialog
            open
            onOpenChange={(open) => !open && setEditingYaml(false)}
            initialYaml={toYaml(withoutStatus(detail.raw))}
            lockName={detail.name}
            title={t('resource.action.editYaml')}
            submitLabel={t('common.confirm')}
            pending={replaceYaml.isPending}
            onSubmit={async (object) => {
              await replaceYaml.mutateAsync(object);
            }}
          />
        </DialogSuspense>
      ) : null}

      {yamlError ? (
        <p role="alert" className="text-xs text-ai-danger" data-ai-id="alertingrules:detail:yaml-error">
          {yamlError}
        </p>
      ) : null}

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
 * The state column has two sources, and which one is authoritative depends on the
 * read path:
 *
 * - Through the aggregated kapis path (cluster pages) the group carries
 *   `status.rulesStatus` — Prometheus's own per-rule state, including `disabled`.
 *   That is used when present; it is the same field the old console rendered.
 * - Through the raw CRD path (project page today) there is no status, so the state is
 *   derived from the group's active alerts. A rule with no active alert reads **正常**,
 *   not `-` — "evaluated and not firing" is a fact, while `-` would claim it is unknown.
 */
function RuleSection({
  detail,
  activeByRule,
  activeTotal,
  activeFetched,
  useStatus,
}: {
  detail: RuleGroupDetail;
  activeByRule: Map<string, AlertMessage>;
  activeTotal: number;
  activeFetched: number;
  /** Render `status.rulesStatus` (kapis) instead of deriving state from alerts. */
  useStatus: boolean;
}): React.ReactElement {
  const t = useT();
  const [metricRule, setMetricRule] = React.useState<{ name: string; expression: string; summary?: string } | null>(null);
  /*
   * Rule search and paging.
   *
   * A policy can carry dozens of rules (the builtin Kubernetes policies carry 10–20 each), and the
   * old console let the reader filter them. The filter is client-side on purpose: the rules arrive
   * inside the group object, so asking the server to search them would be a second, slower request
   * for data this page already holds.
   */
  const [keyword, setKeyword] = React.useState('');
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 10;
  const needle = keyword.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      needle
        ? detail.rules.filter((rule) =>
            [rule.name, rule.expression, rule.summary, rule.message, rule.severity, rule.description]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(needle)),
          )
        : detail.rules,
    [detail.rules, needle],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  React.useEffect(() => setPage(1), [needle]);
  return (
    <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="alertingrules:detail:rules">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-ai-fg">
          {t('monitoring.ruleGroups.rules')} ({detail.rules.length})
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {detail.rules.length > 0 ? (
            <InputSearch
              value={keyword}
              placeholder={t('monitoring.ruleGroups.detail.searchRules')}
              data-ai-id="alertingrules:detail:rule-search"
              onSearch={setKeyword}
              onChange={setKeyword}
            />
          ) : null}
          {!useStatus && activeTotal > activeFetched ? (
            <span className="text-[11px] text-ai-fg-muted">
              {t('monitoring.ruleGroups.detail.ruleStatePartial', { fetched: activeFetched, total: activeTotal })}
            </span>
          ) : null}
        </div>
      </header>

      {detail.rules.length === 0 ? (
        <p className="text-xs text-ai-fg-muted" {...actionProps('alertingrules:detail:no-rules')}>
          {t('monitoring.ruleGroups.rule.noRules')}
        </p>
      ) : filtered.length === 0 ? (
        /* A search that matches nothing is not an empty policy: say which it is. */
        <p className="text-xs text-ai-fg-muted" data-ai-id="alertingrules:detail:no-rule-match">
          {t('monitoring.ruleGroups.detail.noRuleMatch', { keyword: keyword.trim() })}
        </p>
      ) : (
        <div className="overflow-x-auto">
          {/*
           * Fixed layout: a PromQL expression is long and has no spaces a browser
           * will break on, so an auto-layout table grows past its container and the
           * expression is clipped at narrow widths. Percent widths keep every column
           * inside the card and let the expression wrap onto its own lines.
           */}
          <table className="w-full table-fixed border-collapse text-xs" data-ai-id="alertingrules:detail:rule-table">
            <colgroup>
              <col className="w-[9%]" />
              <col className="w-[17%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
              <col className="w-[20%]" />
              <col className="w-[25%]" />
              {useStatus ? <col className="w-[14%]" /> : null}
            </colgroup>
            <thead>
              <tr className="border-b border-ai-line text-ai-fg-muted">
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('monitoring.ruleGroups.rule.state')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('monitoring.ruleGroups.rule.name')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('monitoring.ruleGroups.rule.severity')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('monitoring.ruleGroups.rule.duration')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('monitoring.ruleGroups.rule.summary')}</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">{t('monitoring.ruleGroups.rule.expressionThreshold')}</th>
                {useStatus ? <th scope="col" className="px-2 py-2 text-left font-medium">{t('monitoring.ruleGroups.lastEvaluation')}</th> : null}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((rule, indexInPage) => {
                const absoluteIndex = (current - 1) * PAGE_SIZE + indexInPage;
                const statusRule = useStatus ? detail.status?.rules[absoluteIndex] : undefined;
                const active = activeByRule.get(rule.name);
                return (
                  <tr key={rule.name} className="border-b border-ai-line align-top" data-ai-row={rule.name}>
                    <td className="whitespace-nowrap px-2 py-2">
                      {statusRule ? (
                        <Badge tone={ruleStateTone(statusRule.state)}>{ruleStateLabel(t, statusRule.state)}</Badge>
                      ) : active ? (
                        <Badge tone={active.state === 'firing' ? 'danger' : 'warning'}>{alertStateLabel(t, active.state)}</Badge>
                      ) : (
                        <span className="text-ai-fg-secondary">{t('monitoring.ruleGroups.rule.stateNormal')}</span>
                      )}
                    </td>
                    <td className="break-all px-2 py-2 font-medium text-ai-fg">
                      {rule.name}
                      {rule.expression ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 flex w-full justify-start px-0 py-0 text-left text-[11px] font-normal text-ai-link hover:underline"
                          {...actionProps(`alertingrules:detail:rule-metric:${rule.name}`)}
                          onClick={() =>
                            setMetricRule({ name: rule.name, expression: rule.expression, ...(rule.summary ? { summary: rule.summary } : {}) })
                          }
                        >
                          {t('monitoring.ruleGroups.metric.open')}
                        </Button>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-ai-fg-secondary">{rule.severity ? alertSeverityLabel(t, rule.severity) : '-'}</td>
                    <td className="px-2 py-2 tabular-nums text-ai-fg-secondary">{rule.duration || '-'}</td>
                    <td className="min-w-0 px-2 py-2 text-ai-fg-secondary">
                      <span className="block break-words">{rule.summary || rule.description || '-'}</span>
                      {rule.message ? <span className="mt-1 block break-words text-ai-fg-muted">{rule.message}</span> : null}
                    </td>
                    <td className="min-w-0 px-2 py-2">
                      <code className="block whitespace-pre-wrap break-all font-mono text-[11px] text-ai-fg-muted">{rule.expression || '-'}</code>
                    </td>
                    {useStatus ? (
                      <td className="whitespace-nowrap px-2 py-2 tabular-nums text-ai-fg-muted" data-ai-id={`alertingrules:detail:rule-last:${rule.name}`}>
                        {statusRule?.lastEvaluation ? formatTimestamp(statusRule.lastEvaluation) : '-'}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > PAGE_SIZE ? (
        <nav className="mt-3 flex items-center justify-between gap-2 text-[11px] text-ai-fg-muted" data-ai-id="alertingrules:detail:rule-pager">
          <span data-ai-id="alertingrules:detail:rule-range">
            {t('monitoring.ruleGroups.detail.ruleRange', {
              from: (current - 1) * PAGE_SIZE + 1,
              to: Math.min(current * PAGE_SIZE, filtered.length),
              total: filtered.length,
            })}
          </span>
          <span className="flex items-center gap-1">
            <Button
              size="sm"
              variant="secondary"
              disabled={current <= 1}
              {...actionProps('alertingrules:detail:rule-prev')}
              onClick={() => setPage(current - 1)}
            >
              {t('table.previous')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={current >= pageCount}
              {...actionProps('alertingrules:detail:rule-next')}
              onClick={() => setPage(current + 1)}
            >
              {t('table.next')}
            </Button>
          </span>
        </nav>
      ) : null}

      <RuleMetricDialog open={metricRule !== null} onOpenChange={(open) => !open && setMetricRule(null)} rule={metricRule} />
    </section>
  );
}

/** The aggregated read injects `status`; the CRD has no status subresource. */
function withoutStatus(object: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...object };
  delete copy['status'];
  return copy;
}

function BackLink({
  from,
  workspace,
  cluster,
  namespace,
}: {
  from: 'project' | 'cluster';
  workspace: string;
  cluster: string;
  namespace: string;
}): React.ReactElement {
  const t = useT();
  if (from === 'cluster') {
    return (
      <Link
        to={CLUSTER_LIST_ROUTE}
        params={{ cluster }}
        className="inline-flex w-fit items-center gap-1 text-xs text-ai-link hover:underline"
        {...actionProps('alertingrules:detail:back')}
      >
        <Icon name="chevron-left" size={12} />
        {t('monitoring.ruleGroups.detail.back')}
      </Link>
    );
  }
  return (
    <Link
      to={PROJECT_LIST_ROUTE}
      params={{ workspace, cluster, namespace }}
      className="inline-flex w-fit items-center gap-1 text-xs text-ai-link hover:underline"
      {...actionProps('alertingrules:detail:back')}
    >
      <Icon name="chevron-left" size={12} />
      {t('monitoring.ruleGroups.detail.back')}
    </Link>
  );
}

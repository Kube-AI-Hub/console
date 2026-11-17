import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ruleGroupsApi,
  ruleGroupsWriteApi,
  type RuleGroupRuleInput,
  type RuleGroupScope,
  type RuleGroupSummary,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, Button, Input, Modal, Select, Skeleton, Textarea } from '@kube-ai-hub/ui';
import type { LocaleKey } from '@kube-ai-hub/locales';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { errorMessage } from '@/components/resource/ResourceErrorPanel';

/**
 * Create or edit one project alerting policy, including its rule list.
 *
 * A policy is a rule group and its rules are a **list**, so the editor edits a list:
 * writing a single rule and replacing `spec.rules` would delete every other rule in the
 * group. The draft list stays local until save — a half-typed rule must not reach the
 * cluster, where the alerting controller would start evaluating it.
 *
 * Validation happens before submit because the API accepts an empty rule list: a policy
 * with no rules is accepted and evaluates nothing, which is the quietest possible
 * failure.
 *
 * The description lives in the `kubesphere.io/description` annotation, the same key the
 * old console writes; the rule's long text lives in `annotations.message`, matching its
 * `MESSAGE_SUMMARY` / `MESSAGE_DETAILS` pair. Both are annotations because the resource
 * has no spec fields for them.
 */
export interface RuleGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: string;
  /**
   * Which collection the dialog writes to.
   *
   * The project page and the cluster page share this editor, and the only difference is
   * the resource: a project group is namespaced, a cluster group is not. Ownership
   * (built-in vs operator-created) is the caller's gate — the dialog never offers a
   * built-in group for editing.
   */
  scope: RuleGroupScope;
  /** Required when `scope` is `project`; ignored for cluster/global. */
  namespace?: string;
  /** Present when editing; absent when creating. */
  group?: RuleGroupSummary | undefined;
}

interface DraftRule extends RuleGroupRuleInput {
  /** Stable key for React; the alert name is user-editable so it cannot serve as one. */
  id: string;
}

const SEVERITIES = ['critical', 'warning', 'info'] as const;

function newDraft(): DraftRule {
  return {
    id: Math.random().toString(36).slice(2),
    alert: '',
    expression: '',
    duration: '5m',
    severity: 'warning',
    summary: '',
    message: '',
  };
}

/** Split `2m` / `30s` / `1h` into the number and unit the form edits separately. */
function splitInterval(interval: string | undefined): { value: string; unit: 's' | 'm' | 'h' } {
  const match = /^(\d+)\s*([smh])$/.exec((interval ?? '').trim());
  if (!match) {
    // A value the platform wrote in another form (or nothing) is left for the reader to
    // replace; defaulting the numeric part would silently change the configured interval.
    return { value: '', unit: 'm' };
  }
  return { value: match[1] ?? '', unit: (match[2] as 's' | 'm' | 'h') ?? 'm' };
}

const INTERVAL_UNITS = ['s', 'm', 'h'] as const;

export function RuleGroupDialog({ open, onOpenChange, cluster, scope, namespace = '', group }: RuleGroupDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const editing = group !== undefined;

  const detail = useQuery({
    // Only when editing: the list row does not carry the rule bodies.
    enabled: open && editing,
    queryKey: ['rule-group-detail', cluster, scope, namespace, group?.name],
    queryFn: ({
      signal,
    }) =>
      ruleGroupsApi(apiClient).get({
        name: group?.name ?? '',
        scope,
        ...(scope === 'project' ? { namespace } : {}),
        cluster,
        signal,
      }),
  });

  const [name, setName] = React.useState('');
  const [alias, setAlias] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [intervalValue, setIntervalValue] = React.useState('');
  const [intervalUnit, setIntervalUnit] = React.useState<'s' | 'm' | 'h'>('m');
  const [draft, setDraft] = React.useState<DraftRule[]>([]);
  const [error, setError] = React.useState('');

  /*
   * Seed the draft when the dialog opens, from the group's own rules. Keyed on the
   * fetched detail as well as `open`: the query resolves after the dialog mounts, and
   * seeding on `open` alone would leave an empty list that looks like "no rules".
   */
  React.useEffect(() => {
    if (!open) return;
    setName(group?.name ?? '');
    setAlias(detail.data?.alias ?? group?.alias ?? '');
    setDescription(detail.data?.description ?? group?.description ?? '');
    const interval = splitInterval(detail.data?.interval ?? group?.interval);
    setIntervalValue(interval.value);
    setIntervalUnit(interval.unit);
    setError('');
    if (!editing) {
      setDraft([newDraft()]);
      return;
    }
    if (!detail.data) return;
    setDraft(
      detail.data.rules.length === 0
        ? [newDraft()]
        : detail.data.rules.map((rule) => ({
            id: Math.random().toString(36).slice(2),
            alert: rule.name,
            expression: rule.expression,
            duration: rule.duration || '5m',
            severity: SEVERITIES.includes(rule.severity as (typeof SEVERITIES)[number]) ? rule.severity : 'warning',
            summary: rule.summary,
            message: rule.message,
          })),
    );
  }, [open, editing, scope, group?.name, group?.alias, group?.description, group?.interval, detail.data]);

  const save = useMutation({
    mutationFn: async () => {
      const rules: RuleGroupRuleInput[] = draft.map((rule) => ({
        alert: rule.alert.trim(),
        expression: rule.expression.trim(),
        duration: rule.duration.trim() || '5m',
        severity: rule.severity,
        summary: rule.summary.trim(),
        message: rule.message.trim(),
      }));
      // The unit is part of the value: the API stores `spec.interval` as a duration string.
      const interval = intervalValue.trim() ? `${intervalValue.trim()}${intervalUnit}` : '';
      const fields = { rules, description, alias, interval };
      if (editing) {
        await ruleGroupsWriteApi(apiClient).update({
          scope: scope === 'global' ? 'cluster' : scope,
          ...(scope === 'project' ? { namespace } : {}),
          name: group?.name ?? '',
          ...fields,
        });
      } else {
        await ruleGroupsWriteApi(apiClient).create({
          scope: scope === 'global' ? 'cluster' : scope,
          ...(scope === 'project' ? { namespace } : {}),
          name: name.trim(),
          ...fields,
        });
      }
    },
    onSuccess: () => {
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ['rule-groups', cluster] });
      void queryClient.invalidateQueries({ queryKey: ['cluster-rule-groups', cluster] });
      void queryClient.invalidateQueries({ queryKey: ['rule-group-detail', cluster] });
    },
  });

  /** Problems that make the policy useless, checked before it reaches the cluster. */
  function validate(): string {
    if (!editing && !/^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/.test(name.trim())) return t('monitoring.ruleGroups.error.name');
    if (draft.length === 0) return t('monitoring.ruleGroups.error.noRules');
    for (const rule of draft) {
      if (!rule.alert.trim()) return t('monitoring.ruleGroups.error.alert');
      if (!rule.expression.trim()) return t('monitoring.ruleGroups.error.expression');
    }
    const alerts = draft.map((rule) => rule.alert.trim());
    if (new Set(alerts).size !== alerts.length) return t('monitoring.ruleGroups.error.duplicateAlert');
    return '';
  }

  const update = (id: string, patch: Partial<DraftRule>): void =>
    setDraft((current) => current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));

  if (!open) return <></>;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={editing ? t('monitoring.ruleGroups.editTitle') : t('monitoring.ruleGroups.createTitle')}
    >
      {editing && detail.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="flex flex-col gap-4" data-ai-id="monitoring-alerts:dialog">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ai-fg-muted">{t('monitoring.ruleGroups.field.name')}</span>
            <Input
              value={name}
              disabled={editing}
              aria-label={t('monitoring.ruleGroups.field.name')}
              {...actionProps('monitoring-alerts:name')}
              onChange={(event) => setName(event.target.value)}
            />
            <span className="text-ai-fg-muted">{t('monitoring.ruleGroups.field.nameHint')}</span>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-ai-fg-muted">{t('monitoring.ruleGroups.field.alias')}</span>
              <Input
                value={alias}
                maxLength={63}
                aria-label={t('monitoring.ruleGroups.field.alias')}
                {...actionProps('monitoring-alerts:alias')}
                onChange={(event) => setAlias(event.target.value)}
              />
              <span className="text-ai-fg-muted">{t('monitoring.ruleGroups.field.aliasHint')}</span>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-ai-fg-muted">{t('monitoring.ruleGroups.field.interval')}</span>
              <span className="flex items-center gap-2">
                <Input
                  value={intervalValue}
                  inputMode="numeric"
                  maxLength={6}
                  aria-label={t('monitoring.ruleGroups.field.interval')}
                  {...actionProps('monitoring-alerts:interval')}
                  onChange={(event) => setIntervalValue(event.target.value.replace(/[^0-9]/g, ''))}
                />
                <Select
                  value={intervalUnit}
                  aria-label={t('monitoring.ruleGroups.field.intervalUnit')}
                  {...actionProps('monitoring-alerts:interval-unit')}
                  onValueChange={(value) => setIntervalUnit(value as 's' | 'm' | 'h')}
                  options={INTERVAL_UNITS.map((unit) => ({ value: unit, label: t(`monitoring.ruleGroups.intervalUnit.${unit}`) }))}
                />
              </span>
              <span className="text-ai-fg-muted">{t('monitoring.ruleGroups.field.intervalHint')}</span>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ai-fg-muted">{t('monitoring.ruleGroups.field.description')}</span>
            <Textarea
              value={description}
              rows={2}
              maxLength={256}
              aria-label={t('monitoring.ruleGroups.field.description')}
              {...actionProps('monitoring-alerts:description')}
              onChange={(event) => setDescription(event.target.value)}
            />
            <span className="text-ai-fg-muted">{t('monitoring.ruleGroups.field.descriptionHint')}</span>
          </label>

          <div className="flex flex-col gap-2" {...actionProps('monitoring-alerts:rules')}>
            <span className="text-xs text-ai-fg-muted">
              {t('monitoring.ruleGroups.rules')} ({draft.length})
            </span>
            {draft.map((rule, index) => (
              <div
                key={rule.id}
                className="flex flex-col gap-2 rounded-ai-md border border-ai-line p-3"
                data-ai-id={'monitoring-alerts:rule:' + String(index)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-ai-fg">
                    {rule.alert.trim() || t('monitoring.ruleGroups.rule.unnamed')}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    // A policy with zero rules is accepted by the API and evaluates
                    // nothing, so the last rule cannot be removed here.
                    disabled={draft.length === 1}
                    {...actionProps('monitoring-alerts:rule-remove:' + String(index))}
                    onClick={() => setDraft((current) => current.filter((entry) => entry.id !== rule.id))}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input
                    value={rule.alert}
                    placeholder={t('monitoring.ruleGroups.field.alert')}
                    aria-label={t('monitoring.ruleGroups.field.alert')}
                    {...actionProps('monitoring-alerts:rule:' + String(index) + ':alert')}
                    onChange={(event) => update(rule.id, { alert: event.target.value })}
                  />
                  <Input
                    value={rule.expression}
                    placeholder={t('monitoring.ruleGroups.field.expression')}
                    aria-label={t('monitoring.ruleGroups.field.expression')}
                    {...actionProps('monitoring-alerts:rule:' + String(index) + ':expression')}
                    onChange={(event) => update(rule.id, { expression: event.target.value })}
                  />
                  <Input
                    value={rule.duration}
                    placeholder={t('monitoring.ruleGroups.field.duration')}
                    aria-label={t('monitoring.ruleGroups.field.duration')}
                    {...actionProps('monitoring-alerts:rule:' + String(index) + ':duration')}
                    onChange={(event) => update(rule.id, { duration: event.target.value })}
                  />
                  <Select
                    value={rule.severity}
                    aria-label={t('monitoring.ruleGroups.field.severity')}
                    {...actionProps('monitoring-alerts:rule:' + String(index) + ':severity')}
                    onValueChange={(value) => update(rule.id, { severity: value })}
                    options={SEVERITIES.map((severity) => ({ value: severity, label: t(SEVERITY_LABELS[severity]) }))}
                  />
                  <Input
                    value={rule.summary}
                    maxLength={63}
                    placeholder={t('monitoring.ruleGroups.field.summary')}
                    aria-label={t('monitoring.ruleGroups.field.summary')}
                    {...actionProps('monitoring-alerts:rule:' + String(index) + ':summary')}
                    onChange={(event) => update(rule.id, { summary: event.target.value })}
                  />
                  <Input
                    value={rule.message}
                    maxLength={256}
                    placeholder={t('monitoring.ruleGroups.field.message')}
                    aria-label={t('monitoring.ruleGroups.field.message')}
                    {...actionProps('monitoring-alerts:rule:' + String(index) + ':message')}
                    onChange={(event) => update(rule.id, { message: event.target.value })}
                  />
                </div>
              </div>
            ))}
            <AiButton aiId="monitoring-alerts:rule-add" size="sm" variant="secondary" onClick={() => setDraft((current) => [...current, newDraft()])}>
              {t('monitoring.ruleGroups.addRule')}
            </AiButton>
          </div>

          {error ? (
            <p className="text-xs text-ai-danger" role="alert" data-ai-id="monitoring-alerts:error">
              {error}
            </p>
          ) : null}
          {save.isError ? (
            <p className="text-xs text-ai-danger" role="alert" data-ai-id="monitoring-alerts:submit-error">
              {errorMessage(t, save.error)}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={save.isPending}
              {...actionProps('monitoring-alerts:cancel')}
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              disabled={save.isPending}
              {...actionProps('monitoring-alerts:save')}
              onClick={() => {
                const problem = validate();
                setError(problem);
                if (!problem) save.mutate();
              }}
            >
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Severity value → the label key the old console used. */
const SEVERITY_LABELS: Record<(typeof SEVERITIES)[number], LocaleKey> = {
  critical: 'monitoring.severity.critical',
  warning: 'monitoring.severity.warning',
  info: 'monitoring.severity.info',
};

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ruleGroupsApi,
  ruleGroupsWriteApi,
  type RuleGroupSummary,
  type RuleGroupRuleInput,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiButton, Button, Input, Modal, Select, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';

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
 */
export interface RuleGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: string;
  namespace: string;
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
  };
}

export function RuleGroupDialog({ open, onOpenChange, cluster, namespace, group }: RuleGroupDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const editing = group !== undefined;

  const detail = useQuery({
    // Only when editing: the list row does not carry the rule bodies.
    enabled: open && editing,
    queryKey: ['rule-group-detail', cluster, namespace, group?.name],
    queryFn: ({ signal }) => ruleGroupsApi(apiClient).get({ name: group?.name ?? '', scope: 'project', namespace, signal }),
  });

  const [name, setName] = React.useState('');
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
          })),
    );
  }, [open, editing, group?.name, detail.data]);

  const save = useMutation({
    mutationFn: async () => {
      const rules: RuleGroupRuleInput[] = draft.map((rule) => ({
        alert: rule.alert.trim(),
        expression: rule.expression.trim(),
        duration: rule.duration.trim() || '5m',
        severity: rule.severity,
        summary: rule.summary.trim(),
      }));
      if (editing) await ruleGroupsWriteApi(apiClient).update({ namespace, name: group?.name ?? '', rules });
      else await ruleGroupsWriteApi(apiClient).create({ namespace, name: name.trim(), rules });
    },
    onSuccess: () => {
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ['rule-groups', cluster] });
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
        <div className="flex flex-col gap-4" data-ai-id="rule-group-dialog">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ai-fg-muted">{t('monitoring.ruleGroups.field.name')}</span>
            <Input
              value={name}
              disabled={editing}
              aria-label={t('monitoring.ruleGroups.field.name')}
              {...actionProps('rule-group:name')}
              onChange={(event) => setName(event.target.value)}
            />
            <span className="text-ai-fg-muted">{t('monitoring.ruleGroups.field.nameHint')}</span>
          </label>

          <div className="flex flex-col gap-2" {...actionProps('rule-group:rules')}>
            <span className="text-xs text-ai-fg-muted">
              {t('monitoring.ruleGroups.rules')} ({draft.length})
            </span>
            {draft.map((rule, index) => (
              <div
                key={rule.id}
                className="flex flex-col gap-2 rounded-ai-md border border-ai-line p-3"
                data-ai-id={'rule-group:rule:' + String(index)}
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
                    {...actionProps('rule-group:remove-rule:' + String(index))}
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
                    {...actionProps('rule-group:rule:' + String(index) + ':alert')}
                    onChange={(event) => update(rule.id, { alert: event.target.value })}
                  />
                  <Input
                    value={rule.expression}
                    placeholder={t('monitoring.ruleGroups.field.expression')}
                    aria-label={t('monitoring.ruleGroups.field.expression')}
                    {...actionProps('rule-group:rule:' + String(index) + ':expression')}
                    onChange={(event) => update(rule.id, { expression: event.target.value })}
                  />
                  <Input
                    value={rule.duration}
                    placeholder={t('monitoring.ruleGroups.field.duration')}
                    aria-label={t('monitoring.ruleGroups.field.duration')}
                    {...actionProps('rule-group:rule:' + String(index) + ':duration')}
                    onChange={(event) => update(rule.id, { duration: event.target.value })}
                  />
                  <Select
                    value={rule.severity}
                    aria-label={t('monitoring.ruleGroups.field.severity')}
                    {...actionProps('rule-group:rule:' + String(index) + ':severity')}
                    onValueChange={(value) => update(rule.id, { severity: value })}
                    options={SEVERITIES.map((severity) => ({ value: severity, label: severity }))}
                  />
                  <Input
                    className="sm:col-span-2"
                    value={rule.summary}
                    placeholder={t('monitoring.ruleGroups.field.summary')}
                    aria-label={t('monitoring.ruleGroups.field.summary')}
                    {...actionProps('rule-group:rule:' + String(index) + ':summary')}
                    onChange={(event) => update(rule.id, { summary: event.target.value })}
                  />
                </div>
              </div>
            ))}
            <AiButton
              aiId="rule-group:add-rule"
              size="sm"
              variant="secondary"
              onClick={() => setDraft((current) => [...current, newDraft()])}
            >
              {t('monitoring.ruleGroups.addRule')}
            </AiButton>
          </div>

          {error ? (
            <p className="text-xs text-ai-danger" role="alert" data-ai-id="rule-group:error">
              {error}
            </p>
          ) : null}
          {save.isError ? (
            <p className="text-xs text-ai-danger" role="alert">
              {save.error instanceof Error ? save.error.message : String(save.error)}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              disabled={save.isPending}
              {...actionProps('rule-group:save')}
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
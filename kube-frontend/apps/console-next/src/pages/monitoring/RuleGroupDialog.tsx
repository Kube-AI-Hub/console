import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ruleGroupsApi,
  ruleGroupsWriteApi,
  type RuleGroupSummary,
  type RuleGroupRuleInput,
} from '@kube-ai-hub/api-client';
import { Modal, ResourceForm, Skeleton, type FormSchema } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';

/**
 * Create or edit one project alerting policy.
 *
 * A policy is a rule group; this editor manages **one rule per group**. Multi-rule
 * groups are shown read-only in the list, because writing them here would drop the
 * rules the editor does not know about — the group's `spec.rules` is replaced whole.
 * Editing them needs a list editor, which is a separate piece of work.
 */
export interface RuleGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: string;
  namespace: string;
  /** Present when editing; absent when creating. */
  group?: RuleGroupSummary | undefined;
}

export function RuleGroupDialog({ open, onOpenChange, cluster, namespace, group }: RuleGroupDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const editing = group !== undefined;

  const detail = useQuery({
    // Only when editing: the list row does not carry the rule body.
    enabled: open && editing,
    queryKey: ['rule-group-detail', cluster, namespace, group?.name],
    queryFn: ({ signal }) => ruleGroupsApi(apiClient).get({ name: group?.name ?? '', scope: 'project', namespace, signal }),
  });

  const create = useMutation({
    mutationFn: (input: { name: string; rules: RuleGroupRuleInput[] }) =>
      ruleGroupsWriteApi(apiClient).create({ namespace, ...input }),
    onSuccess: () => {
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ['rule-groups', cluster] });
    },
  });

  const update = useMutation({
    mutationFn: (rules: RuleGroupRuleInput[]) =>
      ruleGroupsWriteApi(apiClient).update({ namespace, name: group?.name ?? '', rules }),
    onSuccess: () => {
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ['rule-groups', cluster] });
    },
  });

  const firstRule = detail.data?.rules[0];

  const schema = React.useMemo<FormSchema>(
    () => ({
      fields: [
        {
          key: 'name',
          label: t('monitoring.ruleGroups.field.name'),
          type: 'text',
          required: true,
          // Editing locks the name: a rule group's name is how the platform refers to
          // it, and renaming would mean create-then-delete with a window where both
          // exist.
          ...(editing ? { disabled: true } : {}),
          hint: t('monitoring.ruleGroups.field.nameHint'),
        },
        {
          key: 'alert',
          label: t('monitoring.ruleGroups.field.alert'),
          type: 'text',
          required: true,
          hint: t('monitoring.ruleGroups.field.alertHint'),
        },
        {
          key: 'expression',
          label: t('monitoring.ruleGroups.field.expression'),
          type: 'text',
          required: true,
          hint: t('monitoring.ruleGroups.field.expressionHint'),
        },
        {
          key: 'duration',
          label: t('monitoring.ruleGroups.field.duration'),
          type: 'text',
          hint: t('monitoring.ruleGroups.field.durationHint'),
        },
        {
          key: 'severity',
          label: t('monitoring.ruleGroups.field.severity'),
          type: 'select',
          required: true,
          options: [
            { value: 'critical', label: t('monitoring.severity.critical') },
            { value: 'warning', label: t('monitoring.severity.warning') },
            { value: 'info', label: t('monitoring.severity.info') },
          ],
        },
        {
          key: 'summary',
          label: t('monitoring.ruleGroups.field.summary'),
          type: 'text',
          hint: t('monitoring.ruleGroups.field.summaryHint'),
        },
      ],
    }),
    [editing, t],
  );

  const defaults = React.useMemo(
    () => ({
      name: group?.name ?? '',
      alert: firstRule?.name ?? '',
      expression: firstRule?.expression ?? '',
      duration: firstRule?.duration || '5m',
      severity: firstRule?.severity || 'warning',
      summary: firstRule?.summary ?? '',
    }),
    [group?.name, firstRule],
  );

  if (!open) return <></>;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={editing ? t('monitoring.ruleGroups.editTitle') : t('monitoring.ruleGroups.createTitle')}
    >
      {editing && detail.isPending ? (
        <Skeleton className="h-56 w-full" />
      ) : (
        <ResourceForm
          schema={schema}
          defaultValues={defaults}
          submitting={create.isPending || update.isPending}
          onCancel={() => onOpenChange(false)}
          onSubmit={async (raw) => {
            const values = raw as Record<string, unknown>;
            const rule: RuleGroupRuleInput = {
              alert: String(values['alert'] ?? '').trim(),
              expression: String(values['expression'] ?? '').trim(),
              duration: String(values['duration'] ?? '').trim() || '5m',
              severity: String(values['severity'] ?? 'warning'),
              summary: String(values['summary'] ?? '').trim(),
            };
            if (editing) await update.mutateAsync([rule]);
            else await create.mutateAsync({ name: String(values['name'] ?? '').trim(), rules: [rule] });
          }}
        />
      )}
    </Modal>
  );
}

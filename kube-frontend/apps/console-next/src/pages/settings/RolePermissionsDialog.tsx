import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal, ResourceForm, Skeleton, type FormSchema } from '@kube-ai-hub/ui';
import { projectRolesWriteApi } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { MutationAlert } from '@/components/resource/ResourceErrorPanel';

/**
 * 编辑权限 (a project role's rules).
 *
 * The dialog opens first and loads the rules after, showing a skeleton while it does:
 * opening a modal that stays empty until the response lands reads as a broken control.
 *
 * Rules are edited as one text area, three comma-separated fields per line
 * (`apiGroups | resources | verbs`). A project role commonly carries a handful of
 * rules that mirror a `kubectl describe` dump, and a text form keeps all of them
 * visible at once — a row-per-rule editor would turn a five-rule role into scrolling.
 */
export interface RolePermissionsDialogProps {
  open: boolean;
  namespace: string;
  name: string;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function RolePermissionsDialog({
  open,
  namespace,
  name,
  onOpenChange,
}: RolePermissionsDialogProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const write = projectRolesWriteApi(apiClient);

  const rules = useQuery({
    queryKey: ['role-rules', namespace, name],
    enabled: open && Boolean(name),
    queryFn: () => write.rules({ namespace, name }),
  });

  const save = useMutation({
    mutationFn: (input: Array<{ apiGroups: string; resources: string; verbs: string }>) =>
      write.setRules({ namespace, name, rules: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings', 'roles'] });
      await queryClient.invalidateQueries({ queryKey: ['role-rules', namespace, name] });
    },
  });

  const schema = React.useMemo<FormSchema>(
    () => ({
      title: t('settings.roles.permissions'),
      description: name,
      submit: { label: t('common.confirm'), cancelLabel: t('common.cancel') },
      fields: [
        {
          key: 'rules',
          label: t('settings.roles.rules'),
          type: 'textarea',
          rows: 12,
          hint: t('settings.roles.rulesHint'),
        },
      ],
    }),
    [name, t],
  );

  const initial = React.useMemo(
    () =>
      (rules.data ?? [])
        .map((rule) => [rule.apiGroups, rule.resources, rule.verbs].join(' | '))
        .join('\n'),
    [rules.data],
  );

  if (!open) return <></>;

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="lg" title={t('settings.roles.permissions')} description={name}>
      {rules.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <MutationAlert error={save.error ?? rules.error} />
          <ResourceForm
            schema={schema}
            defaultValues={{ rules: initial }}
            submitting={save.isPending}
            onCancel={() => onOpenChange(false)}
            onSubmit={async (raw) => {
              const text = String((raw as Record<string, unknown>)['rules'] ?? '');
              const parsed = text
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                  const [apiGroups = '', resources = '', verbs = ''] = line.split('|').map((part) => part.trim());
                  return { apiGroups, resources, verbs };
                });
              await save.mutateAsync(parsed);
              onOpenChange(false);
            }}
          />
        </>
      )}
    </Modal>
  );
}

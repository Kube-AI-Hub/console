import * as React from 'react';
import { AiSurface, Button, Input, Modal, Select, Textarea, type SelectOption } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import type { ServiceAccountInput } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { useProjectRoles } from './queries';
import { DialogSuspense } from '@/components/resource/DialogSuspense';
import { toYaml } from '@/components/resource/yaml';

/*
 * The YAML editor is 188 KB gzip of CodeMirror. A list page must not pay for it
 * before a dialog opens, so it is imported on demand (DEC-CORE-KUBE_FRONTEND-04).
 */
const YamlDialog = React.lazy(() => import('@/components/resource/YamlDialog'));

/**
 * Create dialog for a ServiceAccount.
 *
 * The old console's create form is a single step (`configs/steps/serviceaccounts.js`:
 * 基本信息, with no data step — the token Secret is created by the controller), and
 * it asks for name, alias, project, description and project role. That is kept
 * exactly: one step, plus the same YAML escape hatch the other resources have.
 *
 * The role list belongs to the *project*, so it is loaded for whichever project
 * the form currently targets and re-fetched when that changes.
 */

const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const ALIAS_PATTERN = /^(?!-)([a-zA-Z0-9\u4e00-\u9fa5-]+)(?<!-)$/;
const NAME_MAX = 63;
const DESCRIPTION_MAX = 256;

interface Draft {
  name: string;
  alias: string;
  description: string;
  namespace: string;
  role: string;
}

const EMPTY: Draft = { name: '', alias: '', description: '', namespace: '', role: '' };

export interface ServiceAccountCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cluster: string;
  namespace: string;
  projects?: SelectOption[];
  onNamespaceChange?: (namespace: string) => void;
  isNameTaken?: (name: string, namespace: string) => Promise<boolean>;
  pending?: boolean;
  onSubmit: (input: ServiceAccountInput) => void | Promise<void>;
  onSubmitYaml?: (object: Record<string, unknown>) => void | Promise<void>;
}

export function ServiceAccountCreateDialog({
  open,
  onOpenChange,
  cluster,
  namespace,
  projects = [],
  onNamespaceChange,
  isNameTaken,
  pending = false,
  onSubmit,
  onSubmitYaml,
}: ServiceAccountCreateDialogProps): React.ReactElement {
  const t = useT();
  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  const [errors, setErrors] = React.useState<{ name?: string; alias?: string; description?: string; namespace?: string }>({});
  const [yamlOpen, setYamlOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setDraft({ ...EMPTY, namespace });
      setErrors({});
    }
  }, [open, namespace]);

  /*
   * Track a late-arriving seed: the caller's project can become known after the
   * dialog opens (the list filter defaults to the route's namespace), and
   * re-seeding only while nothing has been chosen keeps the reader's choice.
   */
  React.useEffect(() => {
    if (!open || !namespace) return;
    setDraft((current) => (current.namespace === '' && current.name === '' ? { ...current, namespace } : current));
  }, [open, namespace]);

  const roles = useProjectRoles({ cluster, namespace: draft.namespace, enabled: open && Boolean(draft.namespace) });
  const roleOptions: SelectOption[] = React.useMemo(
    () =>
      [
        // The old form's role select has a placeholder, not an empty option: leaving
        // it alone creates the account without a role, which is the common case.
        { value: '', label: t('serviceaccounts.role.none') } as SelectOption,
        ...(roles.data ?? []).map((role) => ({ value: role.name, label: role.name })),
      ],
    [roles.data, t],
  );

  const validate = (): boolean => {
    const next: typeof errors = {};
    const name = draft.name.trim();
    if (!name) next.name = t('resource.validate.nameRequired');
    else if (name.length > NAME_MAX || !NAME_PATTERN.test(name)) next.name = t('resource.validate.namePattern');
    if (draft.alias.trim() && !ALIAS_PATTERN.test(draft.alias.trim())) next.alias = t('resource.validate.aliasPattern');
    if (draft.description.length > DESCRIPTION_MAX) next.description = t('resource.validate.descriptionMax');
    if (!draft.namespace) next.namespace = t('resource.validate.projectRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (): Promise<void> => {
    if (!validate()) return;
    if (isNameTaken) {
      const taken = await isNameTaken(draft.name.trim(), draft.namespace);
      if (taken) {
        setErrors({ name: t('resource.validate.nameExists') });
        return;
      }
    }
    void onSubmit({
      name: draft.name.trim(),
      namespace: draft.namespace,
      alias: draft.alias.trim(),
      description: draft.description.trim(),
      role: draft.role,
    });
  };

  return (
    <>
      <Modal
        open={open && !yamlOpen}
        onOpenChange={onOpenChange}
        size="xl"
        title={t('serviceaccounts.create.title')}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="link" size="sm" {...actionProps('serviceaccounts:create-yaml-mode')} onClick={() => setYamlOpen(true)}>
              {t('serviceaccounts.create.yamlMode')}
            </Button>
            <Button size="sm" disabled={pending} {...actionProps('serviceaccounts:create-submit')} onClick={() => void submit()}>
              {t('serviceaccounts.create.submit')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label={t('resource.field.name')} error={errors.name} required>
            <Input
              value={draft.name}
              autoFocus
              maxLength={NAME_MAX}
              placeholder="my-service-account"
              {...actionProps('serviceaccounts:field-name')}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </Field>
          <Field label={t('resource.field.project')} error={errors.namespace} required>
            <AiSurface as="div" aiId="serviceaccounts:field-project" state="ready" className="contents">
                <Select
                {...(draft.namespace ? { value: draft.namespace } : {})}
                {...actionProps('serviceaccounts:field-project')}
                onValueChange={(next: string) => {
                  // Switching project resets the role: roles are per project, and a
                  // name carried over would point at something that may not exist.
                  setDraft({ ...draft, namespace: next, role: '' });
                  setErrors((previous) => {
                    const { namespace: _cleared, ...rest } = previous;
                    return rest;
                  });
                  onNamespaceChange?.(next);
                }}
                options={projects}
                searchable
                placeholder={t('serviceaccounts.create.projectPlaceholder')}
                emptyText={t('serviceaccounts.create.projectEmpty')}
                aria-label={t('resource.field.project')}
              />
            </AiSurface>
          </Field>
          <Field label={t('resource.field.alias')} error={errors.alias}>
            <Input
              value={draft.alias}
              maxLength={NAME_MAX}
              {...actionProps('serviceaccounts:field-alias')}
              onChange={(event) => setDraft({ ...draft, alias: event.target.value })}
            />
          </Field>
          <Field label={t('resource.field.description')} error={errors.description}>
            <Textarea
              value={draft.description}
              rows={3}
              maxLength={DESCRIPTION_MAX}
              {...actionProps('serviceaccounts:field-description')}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </Field>
          <Field label={t('serviceaccounts.field.role')}>
            <AiSurface as="div" aiId="serviceaccounts:field-role" state="ready" className="contents">
              <Select
                value={draft.role}
                options={roleOptions}
                searchable
                placeholder={t('serviceaccounts.field.rolePlaceholder')}
                emptyText={roles.isPending ? t('common.loading') : t('serviceaccounts.role.empty')}
                aria-label={t('serviceaccounts.field.role')}
                onValueChange={(next: string) => setDraft({ ...draft, role: next })}
              />
            </AiSurface>
            <span className="text-[11px] text-ai-fg-muted">{t('serviceaccounts.field.roleHint')}</span>
          </Field>
        </div>
      </Modal>

      <DialogSuspense>

        <YamlDialog
          open={open && yamlOpen}
          onOpenChange={setYamlOpen}
          initialYaml={toYaml({
            apiVersion: 'v1',
            kind: 'ServiceAccount',
            metadata: {
              name: draft.name || 'my-service-account',
              namespace: draft.namespace || null,
              ...(draft.alias || draft.description || draft.role
                ? {
                    annotations: {
                      ...(draft.alias ? { 'kubesphere.io/alias-name': draft.alias } : {}),
                      ...(draft.description ? { 'kubesphere.io/description': draft.description } : {}),
                      ...(draft.role ? { 'iam.kubesphere.io/role': draft.role } : {}),
                    },
                  }
                : {}),
            },
          })}
          title={t('serviceaccounts.create.title')}
          submitLabel={t('serviceaccounts.create.submit')}
          pending={pending}
          onSubmit={(object) => {
            setYamlOpen(false);
            void (onSubmitYaml ?? (() => undefined))(object);
          }}
        />


      </DialogSuspense>
    </>
  );
}

function Field({
  label,
  error,
  required = false,
  children,
}: {
  label: string;
  /** Leave it off for fields without validation; `undefined` means "no problem". */
  error?: string | undefined;
  required?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-ai-fg-secondary">
        {label}
        {required ? <span className="ml-0.5 text-ai-danger">*</span> : null}
      </span>
      {children}
      {error ? (
        <span role="alert" className="text-[11px] text-ai-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

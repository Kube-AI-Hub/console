import * as React from 'react';
import { Button, Input, Modal, Select, Textarea, cn, type SelectOption } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import type { ConfigMapInput } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { ConfigMapDataEditor } from './ConfigMapDataEditor';
import { ConfigMapYamlDialog, toYaml } from './ConfigMapYamlDialog';

/**
 * Create dialog, two steps, with a YAML escape hatch.
 *
 * Same shape as the old console (`console/src/configs/steps/configmaps.js`):
 * Basic Information then Data Settings, plus a mode switch that replaces both
 * steps with a raw YAML editor. The switch is not a nicety — pasting a multi-key
 * object is the common way a ConfigMap arrives, and retyping it pair by pair is
 * where people give up and use kubectl instead.
 */

/** Name rules the API enforces; checked here so the error appears before submit. */
const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
/** Alias allows Chinese, letters, digits and inner hyphens. */
const ALIAS_PATTERN = /^(?!-)([a-zA-Z0-9\u4e00-\u9fa5-]+)(?<!-)$/;
const NAME_MAX = 63;
const DESCRIPTION_MAX = 256;

export interface ConfigMapCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Initially selected project; the reader can change it before submitting. */
  namespace: string;
  /**
   * Projects the object may be created in.
   *
   * Passed in rather than fetched here so the dialog shares the list page's
   * cached project query: the old console's create form pulled its own copy, and
   * opening the dialog re-fetched a cluster-wide list every time.
   */
  projects?: SelectOption[];
  /** `undefined` when the cluster has no selectable project at all. */
  onNamespaceChange?: (namespace: string) => void;
  /**
   * Checks the name against the cluster; resolves true when it is taken.
   *
   * Takes the project because names are unique per namespace: the same name in a
   * different project is free.
   */
  isNameTaken?: (name: string, namespace: string) => Promise<boolean>;
  pending?: boolean;
  onSubmit: (input: ConfigMapInput) => void | Promise<void>;
  /** Send a whole YAML object instead of the two-step form. */
  onSubmitYaml?: (object: Record<string, unknown>) => void | Promise<void>;
}

type Step = 'basic' | 'data';

interface Draft {
  name: string;
  alias: string;
  description: string;
  namespace: string;
  data: Record<string, string>;
}

const EMPTY: Draft = { name: '', alias: '', description: '', namespace: '', data: {} };

export function ConfigMapCreateDialog({
  open,
  onOpenChange,
  namespace,
  projects = [],
  onNamespaceChange,
  isNameTaken,
  pending = false,
  onSubmit,
  onSubmitYaml,
}: ConfigMapCreateDialogProps): React.ReactElement {
  const t = useT();
  const [step, setStep] = React.useState<Step>('basic');
  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  const [errors, setErrors] = React.useState<{ name?: string; alias?: string; description?: string; namespace?: string }>({});
  const [editingData, setEditingData] = React.useState(false);
  const [yamlOpen, setYamlOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setStep('basic');
      // Seed the project from the caller's context (the list's filter, or the
      // route's namespace) so the common case needs no interaction, as in the old
      // console where the project arrived pre-selected from the page.
      setDraft({ ...EMPTY, namespace });
      setErrors({});
    }
  }, [open, namespace]);

  const validateBasics = (): boolean => {
    const next: typeof errors = {};
    const name = draft.name.trim();
    if (!name) next.name = t('configmaps.validate.nameRequired');
    else if (name.length > NAME_MAX || !NAME_PATTERN.test(name)) next.name = t('configmaps.validate.namePattern');
    if (draft.alias.trim() && !ALIAS_PATTERN.test(draft.alias.trim())) next.alias = t('configmaps.validate.aliasPattern');
    if (draft.description.length > DESCRIPTION_MAX) next.description = t('configmaps.validate.descriptionMax');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = async (): Promise<void> => {
    if (!validateBasics()) return;
    // The project is validated alongside the name: both decide which object this
    // is, and an empty namespace would otherwise reach the API as a bad request.
    if (!draft.namespace) {
      setErrors((previous) => ({ ...previous, namespace: t('configmaps.validate.projectRequired') }));
      return;
    }
    // Availability is checked here rather than on submit so the reader learns
    // before spending time entering data.
    if (isNameTaken) {
      const taken = await isNameTaken(draft.name.trim(), draft.namespace);
      if (taken) {
        setErrors({ name: t('configmaps.validate.nameExists') });
        return;
      }
    }
    setStep('data');
  };

  const submit = (): void => {
    void onSubmit({
      name: draft.name.trim(),
      namespace: draft.namespace,
      alias: draft.alias.trim(),
      description: draft.description.trim(),
      data: draft.data,
    });
  };

  return (
    <>
      <Modal
        open={open && !yamlOpen}
        onOpenChange={onOpenChange}
        size="xl"
        title={t('configmaps.create.title')}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            {step === 'data' ? (
              <Button variant="ghost" size="sm" onClick={() => setStep('basic')}>
                {t('configmaps.create.previous')}
              </Button>
            ) : null}
            {step === 'basic' ? (
              <Button size="sm" {...actionProps('configmaps:create-next')} onClick={() => void goNext()}>
                {t('configmaps.create.next')}
              </Button>
            ) : (
              <Button
                size="sm"
                // A half-typed pair is not in `data` yet; submitting would drop it.
                disabled={editingData || pending}
                {...actionProps('configmaps:create-submit')}
                onClick={submit}
              >
                {t('configmaps.create.submit')}
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <ol className="flex items-center gap-2 text-xs">
              <StepDot index={1} label={t('configmaps.create.stepBasic')} active={step === 'basic'} done={step === 'data'} />
              <span className="h-px w-6 bg-ai-line" aria-hidden="true" />
              <StepDot index={2} label={t('configmaps.create.stepData')} active={step === 'data'} done={false} />
            </ol>
            <Button
              variant="link"
              size="sm"
              {...actionProps('configmaps:create-yaml-mode')}
              onClick={() => setYamlOpen(true)}
            >
              {t('configmaps.create.yamlMode')}
            </Button>
          </div>

          {step === 'basic' ? (
            <div className="flex flex-col gap-3">
              <Field label={t('configmaps.field.name')} error={errors.name} required>
                <Input
                  value={draft.name}
                  autoFocus
                  maxLength={NAME_MAX}
                  placeholder="my-configmap"
                  {...actionProps('configmaps:field-name')}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </Field>
              <Field label={t('configmaps.field.project')} error={errors.namespace} required>
                <Select
                  {...(draft.namespace ? { value: draft.namespace } : {})}
                  onValueChange={(next: string) => {
                    setDraft({ ...draft, namespace: next });
                    // Clearing the key rather than setting `undefined`: under
                    // `exactOptionalPropertyTypes` the two are different types.
                    setErrors((previous) => {
                      const { namespace: _cleared, ...rest } = previous;
                      return rest;
                    });
                    onNamespaceChange?.(next);
                  }}
                  options={projects}
                  searchable
                  placeholder={t('configmaps.create.projectPlaceholder')}
                  emptyText={t('configmaps.create.projectEmpty')}
                  aria-label={t('configmaps.field.project')}
                />
              </Field>
              <Field label={t('configmaps.field.alias')} error={errors.alias}>
                <Input
                  value={draft.alias}
                  maxLength={NAME_MAX}
                  {...actionProps('configmaps:field-alias')}
                  onChange={(event) => setDraft({ ...draft, alias: event.target.value })}
                />
              </Field>
              <Field label={t('configmaps.field.description')} error={errors.description}>
                <Textarea
                  value={draft.description}
                  rows={3}
                  maxLength={DESCRIPTION_MAX}
                  {...actionProps('configmaps:field-description')}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </Field>
            </div>
          ) : (
            <ConfigMapDataEditor
              value={draft.data}
              onChange={(next) => setDraft({ ...draft, data: next })}
              onEditingChange={setEditingData}
            />
          )}
        </div>
      </Modal>

      <ConfigMapYamlDialog
        open={open && yamlOpen}
        onOpenChange={(next) => setYamlOpen(next)}
        initialYaml={toYaml({
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: {
            name: draft.name || 'my-configmap',
            namespace: draft.namespace || null,
            ...(draft.alias || draft.description
              ? {
                  annotations: {
                    ...(draft.alias ? { 'kubesphere.io/alias-name': draft.alias } : {}),
                    ...(draft.description ? { 'kubesphere.io/description': draft.description } : {}),
                  },
                }
              : {}),
          },
          data: draft.data,
        })}
        title={t('configmaps.create.title')}
        submitLabel={t('configmaps.create.submit')}
        pending={pending}
        onSubmit={(object) => {
          setYamlOpen(false);
          void (onSubmitYaml ?? (() => undefined))(object);
        }}
      />
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
  error: string | undefined;
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

function StepDot({
  index,
  label,
  active,
  done,
}: {
  index: number;
  label: string;
  active: boolean;
  done: boolean;
}): React.ReactElement {
  return (
    <li className={cn('flex items-center gap-1.5', active || done ? 'text-ai-fg' : 'text-ai-fg-muted')}>
      <span
        className={cn(
          'grid size-5 place-items-center rounded-full text-[10px]',
          active ? 'bg-ai-accent text-ai-accent-fg' : done ? 'bg-ai-accent-soft text-ai-accent' : 'bg-ai-surface-2',
        )}
      >
        {index}
      </span>
      {label}
    </li>
  );
}

import * as React from 'react';
import { AiSurface, Button, Input, Modal, Select, Textarea, cn, type SelectOption } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import type { SecretInput } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { SecretSettingsEditor, type SecretSettingsValue } from './SecretSettingsEditor';
import { SECRET_TYPE_LABEL } from './secretTypes';
import { DialogSuspense } from '@/components/resource/DialogSuspense';

/*
 * The YAML editor is 188 KB gzip of CodeMirror. A list page must not pay for it
 * before a dialog opens, so it is imported on demand (DEC-CORE-KUBE_FRONTEND-04).
 */
const YamlDialog = React.lazy(() => import('@/components/resource/YamlDialog'));
import { toYaml } from '@/components/resource/yaml';

/**
 * Create dialog, two steps, with a YAML escape hatch.
 *
 * Same shape as the old console (`configs/steps/secrets.js`: 基本信息 then 数据设置)
 * and the same mode switch as ConfigMaps, because "type it in" and "paste the
 * object" are two real ways a Secret arrives. Name, alias and description
 * follow the shared rules; the payload belongs to the second step.
 */

/** Name rules the API enforces; checked here so the error appears before submit. */
const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const ALIAS_PATTERN = /^(?!-)([a-zA-Z0-9\u4e00-\u9fa5-]+)(?<!-)$/;
const NAME_MAX = 63;
const DESCRIPTION_MAX = 256;

interface Draft {
  name: string;
  alias: string;
  description: string;
  namespace: string;
  type: string;
  data: Record<string, string>;
  annotations: Record<string, string>;
  isDefault: boolean;
}

const EMPTY: Draft = {
  name: '',
  alias: '',
  description: '',
  namespace: '',
  type: 'Opaque',
  data: {},
  annotations: {},
  isDefault: false,
};

export interface SecretCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  namespace: string;
  projects?: SelectOption[];
  onNamespaceChange?: (namespace: string) => void;
  isNameTaken?: (name: string, namespace: string) => Promise<boolean>;
  pending?: boolean;
  /**
   * Type the data step starts on.
   *
   * The form always starts at `Opaque` in the product; a caller (and a test) can
   * open it on another type when the reader's task is known in advance, e.g.
   * "add a TLS certificate" from a future entry point.
   */
  initialType?: string;
  onSubmit: (input: SecretInput) => void | Promise<void>;
  onSubmitYaml?: (object: Record<string, unknown>) => void | Promise<void>;
}

type Step = 'basic' | 'data';

export function SecretCreateDialog({
  open,
  onOpenChange,
  namespace,
  projects = [],
  onNamespaceChange,
  isNameTaken,
  pending = false,
  initialType = 'Opaque',
  onSubmit,
  onSubmitYaml,
}: SecretCreateDialogProps): React.ReactElement {
  const t = useT();
  const [step, setStep] = React.useState<Step>('basic');
  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  const [errors, setErrors] = React.useState<{ name?: string; alias?: string; description?: string; namespace?: string; data?: string }>({});
  const [editingData, setEditingData] = React.useState(false);
  const [yamlOpen, setYamlOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setStep('basic');
      // Seed the project from the caller's context so the common case needs no
      // interaction, as in the old console where it arrived pre-selected.
      setDraft({ ...EMPTY, namespace, type: initialType });
      setErrors({});
    }
  }, [open, namespace, initialType]);

  /*
   * Track a late-arriving seed: the caller's project can become known after the
   * dialog opens (the list filter defaults to the route's namespace), and
   * re-seeding only while nothing has been chosen keeps the reader's choice.
   */
  React.useEffect(() => {
    if (!open || !namespace) return;
    setDraft((current) => (current.namespace === '' && current.name === '' ? { ...current, namespace } : current));
  }, [open, namespace]);

  const validateBasics = (): boolean => {
    const next: typeof errors = {};
    const name = draft.name.trim();
    if (!name) next.name = t('resource.validate.nameRequired');
    else if (name.length > NAME_MAX || !NAME_PATTERN.test(name)) next.name = t('resource.validate.namePattern');
    if (draft.alias.trim() && !ALIAS_PATTERN.test(draft.alias.trim())) next.alias = t('resource.validate.aliasPattern');
    if (draft.description.length > DESCRIPTION_MAX) next.description = t('resource.validate.descriptionMax');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = async (): Promise<void> => {
    if (!validateBasics()) return;
    if (!draft.namespace) {
      setErrors((previous) => ({ ...previous, namespace: t('resource.validate.projectRequired') }));
      return;
    }
    // Availability is checked here rather than on submit so the reader learns
    // before spending time entering data.
    if (isNameTaken) {
      const taken = await isNameTaken(draft.name.trim(), draft.namespace);
      if (taken) {
        setErrors({ name: t('resource.validate.nameExists') });
        return;
      }
    }
    setStep('data');
  };

  /** The type's required fields must be filled before the object can be created. */
  const requiredMissing = (): boolean => {
    if (draft.type === 'kubernetes.io/tls') return !draft.data['tls.crt'] || !draft.data['tls.key'];
    if (draft.type === 'kubernetes.io/basic-auth') return !draft.data['username'] || !draft.data['password'];
    if (draft.type === 'kubernetes.io/dockerconfigjson') return !draft.data['.dockerconfigjson'];
    return false;
  };

  const submit = (): void => {
    if (requiredMissing()) {
      setErrors((previous) => ({ ...previous, data: t('secrets.validate.typeFieldsRequired') }));
      return;
    }
    setErrors({});
    void onSubmit({
      name: draft.name.trim(),
      namespace: draft.namespace,
      type: draft.type,
      alias: draft.alias.trim(),
      description: draft.description.trim(),
      data: draft.data,
      annotations: draft.annotations,
    });
  };

  const settingsValue: SecretSettingsValue = {
    type: draft.type,
    data: draft.data,
    annotations: draft.annotations,
    isDefault: draft.isDefault,
  };

  const template = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      name: draft.name || 'my-secret',
      namespace: draft.namespace || null,
      ...(draft.alias || draft.description || Object.keys(draft.annotations).length
        ? {
            annotations: {
              ...(draft.alias ? { 'kubesphere.io/alias-name': draft.alias } : {}),
              ...(draft.description ? { 'kubesphere.io/description': draft.description } : {}),
              ...draft.annotations,
            },
          }
        : {}),
    },
    type: draft.type,
    data: draft.data,
  };

  return (
    <>
      <Modal
        open={open && !yamlOpen}
        onOpenChange={onOpenChange}
        size="xl"
        title={t('secrets.create.title')}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            {step === 'data' ? (
              <Button variant="ghost" size="sm" onClick={() => setStep('basic')}>
                {t('secrets.create.previous')}
              </Button>
            ) : null}
            {step === 'basic' ? (
              <Button size="sm" {...actionProps('secrets:create-next')} onClick={() => void goNext()}>
                {t('secrets.create.next')}
              </Button>
            ) : (
              <Button
                size="sm"
                // A half-typed pair is not in `data` yet; submitting would drop it.
                disabled={editingData || pending}
                {...actionProps('secrets:create-submit')}
                onClick={submit}
              >
                {t('secrets.create.submit')}
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <ol className="flex items-center gap-2 text-xs">
              <StepDot index={1} label={t('secrets.create.stepBasic')} active={step === 'basic'} done={step === 'data'} />
              <span className="h-px w-6 bg-ai-line" aria-hidden="true" />
              <StepDot index={2} label={t('secrets.create.stepData')} active={step === 'data'} done={false} />
            </ol>
            <Button variant="link" size="sm" {...actionProps('secrets:create-yaml-mode')} onClick={() => setYamlOpen(true)}>
              {t('secrets.create.yamlMode')}
            </Button>
          </div>

          {step === 'basic' ? (
            <div className="flex flex-col gap-3">
              <Field label={t('resource.field.name')} error={errors.name} required>
                <Input
                  value={draft.name}
                  autoFocus
                  maxLength={NAME_MAX}
                  placeholder="my-secret"
                  {...actionProps('secrets:field-name')}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </Field>
              <Field label={t('resource.field.project')} error={errors.namespace} required>
                <AiSurface as="div" aiId="secrets:field-project" state="ready" className="contents">
                    <Select
                    {...(draft.namespace ? { value: draft.namespace } : {})}
                    {...actionProps('secrets:field-project')}
                    onValueChange={(next: string) => {
                      setDraft({ ...draft, namespace: next });
                      setErrors((previous) => {
                        const { namespace: _cleared, ...rest } = previous;
                        return rest;
                      });
                      onNamespaceChange?.(next);
                    }}
                    options={projects}
                    searchable
                    placeholder={t('secrets.create.projectPlaceholder')}
                    emptyText={t('secrets.create.projectEmpty')}
                    aria-label={t('resource.field.project')}
                  />
                </AiSurface>
              </Field>
              <Field label={t('resource.field.alias')} error={errors.alias}>
                <Input
                  value={draft.alias}
                  maxLength={NAME_MAX}
                  {...actionProps('secrets:field-alias')}
                  onChange={(event) => setDraft({ ...draft, alias: event.target.value })}
                />
              </Field>
              <Field label={t('resource.field.description')} error={errors.description}>
                <Textarea
                  value={draft.description}
                  rows={3}
                  maxLength={DESCRIPTION_MAX}
                  {...actionProps('secrets:field-description')}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </Field>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {errors.data ? (
                <p role="alert" className="text-[11px] text-ai-danger">
                  {errors.data}
                </p>
              ) : null}
              <SecretSettingsEditor
                value={settingsValue}
                onChange={(next) =>
                  setDraft({ ...draft, type: next.type, data: next.data, annotations: next.annotations, isDefault: next.isDefault })
                }
                onEditingChange={setEditingData}
                resource="secrets"
                typeHint={t('secrets.create.typeHint')}
              />
            </div>
          )}
        </div>
      </Modal>

      <DialogSuspense>
  <YamlDialog
          open={open && yamlOpen}
          onOpenChange={setYamlOpen}
          initialYaml={toYaml(template)}
          title={t('secrets.create.title')}
          submitLabel={t('secrets.create.submit')}
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

/** Default type label, exported so the YAML template comment and tests share it. */
export const DEFAULT_SECRET_TYPE_LABEL_KEY = SECRET_TYPE_LABEL['Opaque'];
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

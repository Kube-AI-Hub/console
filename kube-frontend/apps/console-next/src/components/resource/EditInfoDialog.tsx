import * as React from 'react';
import { Button, Input, Modal, Textarea } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { annotationKeys } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';

/**
 * "Edit information" dialog, shared by every resource.
 *
 * It changes only the alias and description annotations. That is separate from
 * each resource's own settings dialog because the two need different permissions
 * in some installs and because mixing them makes an accidental alias change look
 * like a data change in the diff.
 */

/** Alias allows Chinese, letters, digits and inner hyphens (old `PATTERN_ALIAS_NAME`). */
const ALIAS_PATTERN = /^(?!-)([a-zA-Z0-9\u4e00-\u9fa5-]+)(?<!-)$/;
const ALIAS_MAX = 63;
const DESCRIPTION_MAX = 256;

export interface EditInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Agent handle prefix, e.g. `secrets`. */
  resource: string;
  name: string;
  alias: string;
  description: string;
  /** All current annotations; edited in place so keys this dialog does not show survive. */
  annotations: Record<string, string>;
  pending?: boolean;
  onSubmit: (annotations: Record<string, string>) => void | Promise<void>;
}

export function EditInfoDialog({
  open,
  onOpenChange,
  resource,
  name,
  alias: initialAlias,
  description: initialDescription,
  annotations,
  pending = false,
  onSubmit,
}: EditInfoDialogProps): React.ReactElement {
  const t = useT();
  const [alias, setAlias] = React.useState(initialAlias);
  const [description, setDescription] = React.useState(initialDescription);
  const [errors, setErrors] = React.useState<{ alias?: string; description?: string }>({});

  React.useEffect(() => {
    if (open) {
      setAlias(initialAlias);
      setDescription(initialDescription);
      setErrors({});
    }
  }, [open, initialAlias, initialDescription]);

  const submit = (): void => {
    const next: typeof errors = {};
    const trimmedAlias = alias.trim();
    if (trimmedAlias && !ALIAS_PATTERN.test(trimmedAlias)) next.alias = t('resource.validate.aliasPattern');
    if (description.length > DESCRIPTION_MAX) next.description = t('resource.validate.descriptionMax');
    setErrors(next);
    if (Object.keys(next).length) return;

    // Merge rather than replace: the object carries annotations this dialog does
    // not show (creator, kubeconfig, managed-by markers), and dropping them would
    // detach the object from how it was created.
    const merged: Record<string, string> = { ...annotations };
    if (trimmedAlias) merged[annotationKeys.alias] = trimmedAlias;
    else delete merged[annotationKeys.alias];
    if (description.trim()) merged[annotationKeys.description] = description.trim();
    else delete merged[annotationKeys.description];

    void onSubmit(merged);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('resource.editInfo.title')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" disabled={pending} {...actionProps(`${resource}:edit-info-submit`)} onClick={submit}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* The name identifies the object; the API does not allow renaming it. */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ai-fg-secondary">{t('resource.field.name')}</span>
          <Input value={name} disabled readOnly />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ai-fg-secondary">{t('resource.field.alias')}</span>
          <span className="text-[11px] text-ai-fg-muted">{t('resource.aliasHint')}</span>
          <Input
            value={alias}
            maxLength={ALIAS_MAX}
            autoFocus
            {...actionProps(`${resource}:edit-alias`)}
            onChange={(event) => setAlias(event.target.value)}
          />
          {errors.alias ? (
            <span role="alert" className="text-[11px] text-ai-danger">
              {errors.alias}
            </span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ai-fg-secondary">{t('resource.field.description')}</span>
          <Textarea
            value={description}
            rows={3}
            maxLength={DESCRIPTION_MAX}
            {...actionProps(`${resource}:edit-description`)}
            onChange={(event) => setDescription(event.target.value)}
          />
          {errors.description ? (
            <span role="alert" className="text-[11px] text-ai-danger">
              {errors.description}
            </span>
          ) : null}
        </label>
      </div>
    </Modal>
  );
}

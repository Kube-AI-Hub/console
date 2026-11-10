import * as React from 'react';
import { Button, Input, Modal, Textarea } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { annotationKeys, type ConfigMapDetail } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { ConfigMapDataEditor } from './ConfigMapDataEditor';

/**
 * Two edit dialogs, matching the old console's split.
 *
 * "Edit Information" changes only the alias and description annotations; "Edit
 * Settings" changes only `data`. They are separate because they need different
 * permissions in some installs and because mixing them makes an accidental label
 * change look like a data change in the diff.
 */

const ALIAS_PATTERN = /^(?!-)([a-zA-Z0-9\u4e00-\u9fa5-]+)(?<!-)$/;
const DESCRIPTION_MAX = 256;

/* ---------------- Edit information ---------------- */

export interface ConfigMapEditInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: ConfigMapDetail;
  pending?: boolean;
  onSubmit: (annotations: Record<string, string>) => void | Promise<void>;
}

export function ConfigMapEditInfoDialog({
  open,
  onOpenChange,
  detail,
  pending = false,
  onSubmit,
}: ConfigMapEditInfoDialogProps): React.ReactElement {
  const t = useT();
  const [alias, setAlias] = React.useState(detail.alias);
  const [description, setDescription] = React.useState(detail.description);
  const [errors, setErrors] = React.useState<{ alias?: string; description?: string }>({});

  React.useEffect(() => {
    if (open) {
      setAlias(detail.alias);
      setDescription(detail.description);
      setErrors({});
    }
  }, [open, detail.alias, detail.description]);

  const submit = (): void => {
    const next: typeof errors = {};
    if (alias.trim() && !ALIAS_PATTERN.test(alias.trim())) next.alias = t('configmaps.validate.aliasPattern');
    if (description.length > DESCRIPTION_MAX) next.description = t('configmaps.validate.descriptionMax');
    setErrors(next);
    if (Object.keys(next).length) return;

    // Merge rather than replace: the object carries annotations this dialog does
    // not show (creator, kubefed markers), and dropping them would orphan it.
    const annotations = { ...detail.annotations };
    if (alias.trim()) annotations[annotationKeys.alias] = alias.trim();
    else delete annotations[annotationKeys.alias];
    if (description.trim()) annotations[annotationKeys.description] = description.trim();
    else delete annotations[annotationKeys.description];

    void onSubmit(annotations);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('configmaps.edit.infoTitle')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" disabled={pending} {...actionProps('configmaps:edit-info-submit')} onClick={submit}>
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* The name identifies the object; the API does not allow renaming it. */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ai-fg-secondary">{t('configmaps.field.name')}</span>
          <Input value={detail.name} disabled readOnly />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ai-fg-secondary">{t('configmaps.field.alias')}</span>
          <Input
            value={alias}
            maxLength={63}
            autoFocus
            {...actionProps('configmaps:edit-alias')}
            onChange={(event) => setAlias(event.target.value)}
          />
          {errors.alias ? (
            <span role="alert" className="text-[11px] text-ai-danger">
              {errors.alias}
            </span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ai-fg-secondary">{t('configmaps.field.description')}</span>
          <Textarea
            value={description}
            rows={3}
            maxLength={DESCRIPTION_MAX}
            {...actionProps('configmaps:edit-description')}
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

/* ---------------- Edit settings (data) ---------------- */

export interface ConfigMapEditSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: ConfigMapDetail;
  pending?: boolean;
  onSubmit: (data: Record<string, string>) => void | Promise<void>;
}

export function ConfigMapEditSettingsDialog({
  open,
  onOpenChange,
  detail,
  pending = false,
  onSubmit,
}: ConfigMapEditSettingsDialogProps): React.ReactElement {
  const t = useT();
  const [data, setData] = React.useState(detail.data);
  const [editing, setEditing] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setData(detail.data);
      setEditing(false);
    }
  }, [open, detail.data]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={t('configmaps.edit.settingsTitle')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            disabled={editing || pending}
            {...actionProps('configmaps:edit-settings-submit')}
            onClick={() => void onSubmit(data)}
          >
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <ConfigMapDataEditor value={data} onChange={setData} onEditingChange={setEditing} />
    </Modal>
  );
}

import * as React from 'react';
import { Button, Modal } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import type { SecretDetail } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { SecretSettingsEditor, type SecretSettingsValue } from './SecretSettingsEditor';

/**
 * "Edit settings" for a Secret.
 *
 * The type is locked in edit mode (old `SecretEditModal` passes
 * `disableSelect`): kube-apiserver validates `data` against `type`, so switching
 * type here would mostly produce a rejected save after the reader re-entered
 * everything. Changing the type is a YAML edit.
 */
export interface SecretEditSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: SecretDetail;
  pending?: boolean;
  /** Receives the full replacement object's `data` and the annotations to merge. */
  onSubmit: (next: { data: Record<string, string>; annotations: Record<string, string> }) => void | Promise<void>;
}

export function SecretEditSettingsDialog({
  open,
  onOpenChange,
  detail,
  pending = false,
  onSubmit,
}: SecretEditSettingsDialogProps): React.ReactElement {
  const t = useT();
  const [value, setValue] = React.useState<SecretSettingsValue>({
    type: detail.type,
    data: detail.data,
    annotations: detail.annotations,
    isDefault: detail.isDefault,
  });
  const [editing, setEditing] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setValue({ type: detail.type, data: detail.data, annotations: detail.annotations, isDefault: detail.isDefault });
      setEditing(false);
    }
  }, [open, detail.type, detail.data, detail.annotations, detail.isDefault]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={t('secrets.edit.settingsTitle')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            disabled={editing || pending}
            {...actionProps('secrets:edit-settings-submit')}
            onClick={() => void onSubmit({ data: value.data, annotations: value.annotations })}
          >
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <SecretSettingsEditor
        value={value}
        onChange={setValue}
        lockType
        onEditingChange={setEditing}
        resource="secrets"
      />
    </Modal>
  );
}

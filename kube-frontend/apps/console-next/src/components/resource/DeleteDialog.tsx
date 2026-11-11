import * as React from 'react';
import { Button, Input, Modal } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';

/**
 * Delete confirmation, typed-name style, shared by every resource page.
 *
 * The requirement is that the reader proves they know which object they are about
 * to remove, so the field has to match the name exactly — a plain confirm dialog
 * is one misplaced click away from an outage. Single and bulk share the dialog
 * because the rule is the same: the typed text must equal what is being deleted.
 * For several objects that string is the names joined with ", ", which is what
 * the old console asks for (`console/src/components/Modals/Delete/index.jsx`).
 *
 * `resource` is the agent handle prefix (`secrets`, `serviceaccounts`); the ids
 * it produces (`secrets:delete-confirm`, …) match the page manifest.
 */
export interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names being deleted; one for a row action, many for a bulk delete. */
  names: string[];
  /** Agent handle prefix, e.g. `secrets`. */
  resource: string;
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
  /** The noun in the title, e.g. `保密字典`. */
  noun: string;
}

/** The exact text the reader must type. */
export function expectedConfirmation(names: string[]): string {
  return names.join(', ');
}

export function DeleteDialog({
  open,
  onOpenChange,
  names,
  resource,
  pending = false,
  onConfirm,
  noun,
}: DeleteDialogProps): React.ReactElement {
  const t = useT();
  const [typed, setTyped] = React.useState('');
  const expected = expectedConfirmation(names);
  const bulk = names.length > 1;

  // Reset on each open so a previous attempt's text cannot satisfy a new delete.
  React.useEffect(() => {
    if (open) setTyped('');
  }, [open, expected]);

  const confirmed = typed === expected;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={bulk ? t('delete.bulkTitle', { noun }) : t('delete.title', { noun })}
      description={bulk ? t('delete.bulkHint', { names: expected }) : t('delete.singleHint', { name: expected })}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={!confirmed || pending}
            {...actionProps(`${resource}:delete-confirm`)}
            onClick={() => void onConfirm()}
          >
            {t('common.delete')}
          </Button>
        </div>
      }
    >
      <Input
        value={typed}
        autoFocus
        aria-label={t('delete.inputLabel')}
        placeholder={expected}
        {...actionProps(`${resource}:delete-input`)}
        onChange={(event) => setTyped(event.target.value)}
      />
    </Modal>
  );
}

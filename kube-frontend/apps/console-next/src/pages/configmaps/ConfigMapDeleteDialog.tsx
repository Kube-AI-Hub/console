import * as React from 'react';
import { Button, Input, Modal } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { useT } from '@/i18n';

/**
 * Delete confirmation, typed-name style.
 *
 * The requirement is that the reader proves they know which object they are about
 * to remove, so the field has to match the name exactly — a plain confirm dialog is
 * one misplaced click away from an outage.
 *
 * Single and bulk share the dialog, but not the confirmation rule.
 *
 * A single object is confirmed by its name: the old console does that
 * (`console/src/components/Modals/Delete/index.jsx` compares `confirm !== resource`),
 * and it is the friction that stops a mis-click deleting the wrong thing.
 *
 * A **bulk** delete is confirmed by its count. The old console asks for the names
 * joined with ", " there as well, but nobody types that correctly, so its confirm
 * button stays disabled forever — a deliberate deviation, because replicating it
 * would ship a feature nobody can use. Verified here: the bulk confirm button stayed
 * disabled whatever was typed, since no one reproduces `a, b, c` from a list of twenty.
 */
export interface ConfigMapDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names being deleted; one for a row action, many for a bulk delete. */
  names: string[];
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * The exact text the reader must type: the name for one object, the count for a batch.
 *
 * See the note at the top of the file for why the batch form deviates from the old
 * console.
 */
export function expectedConfirmation(names: string[]): string {
  return names.length > 1 ? String(names.length) : (names[0] ?? '');
}

export function ConfigMapDeleteDialog({
  open,
  onOpenChange,
  names,
  pending = false,
  onConfirm,
}: ConfigMapDeleteDialogProps): React.ReactElement {
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
      title={bulk ? t('configmaps.delete.bulkTitle') : t('configmaps.delete.title')}
      description={
        bulk ? t('configmaps.delete.bulkHint', { names: expected }) : t('configmaps.delete.singleHint', { name: expected })
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('configmaps.delete.cancel')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={!confirmed || pending}
            {...actionProps('configmaps:delete-confirm')}
            onClick={() => void onConfirm()}
          >
            {t('configmaps.delete.confirm')}
          </Button>
        </div>
      }
    >
      <Input
        value={typed}
        autoFocus
        aria-label={t('configmaps.delete.title')}
        placeholder={expected}
        {...actionProps('configmaps:delete-input')}
        onChange={(event) => setTyped(event.target.value)}
      />
    </Modal>
  );
}

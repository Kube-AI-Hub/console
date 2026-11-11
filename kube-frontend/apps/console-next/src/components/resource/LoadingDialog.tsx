import * as React from 'react';
import { Modal } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';

/**
 * Shown between a click and the data the clicked dialog needs.
 *
 * Several actions cannot open their dialog immediately: the list carries a
 * summary, while the edit dialogs seed their fields from the full object. The
 * fetch takes a visible moment on a real cluster, and doing it silently leaves
 * the reader staring at an unchanged screen after their click — which reads as a
 * frozen app, not as a request in flight.
 *
 * So the click opens this dialog at once, and the real one replaces it when the
 * object arrives. The frame is the same size and title as the dialog it stands
 * in for, so the transition does not jump.
 *
 * Why not open the real dialog and fill it later: these dialogs seed local state
 * from `detail` on open and submit that state wholesale, so a dialog opened with a
 * placeholder would either flash empty fields or, if submitted early, write them
 * back over the object.
 */
export interface LoadingDialogProps {
  open: boolean;
  title: string;
  /** Named in the body so the reader knows what is being fetched. */
  subject?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function LoadingDialog({ open, title, subject, size = 'md' }: LoadingDialogProps): React.ReactElement {
  const t = useT();

  return (
    <Modal
      open={open}
      // Dismissal is the caller's: closing here would cancel the pending fetch's
      // destination but not the fetch, and the dialog would reappear.
      onOpenChange={() => undefined}
      title={title}
      size={size}
    >
      <div
        role="status"
        aria-live="polite"
        aria-label={t('common.loading')}
        className="flex flex-col items-center justify-center gap-3 py-10 text-ai-fg-muted"
        data-ai-id="dialog:loading"
      >
        <svg viewBox="0 0 16 16" className="size-5 animate-spin" aria-hidden="true">
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
          <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-xs">
          {subject ? t('common.loadingSubject', { subject }) : t('common.loading')}
        </p>
      </div>
    </Modal>
  );
}

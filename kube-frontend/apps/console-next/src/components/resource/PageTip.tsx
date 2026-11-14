import * as React from 'react';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Button, Icon } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';

/**
 * A one-line page tip: what this resource is, the misconception worth naming, and
 * (optionally) where the docs are.
 *
 * The old console put a dismissible Banner above every list. Without it the header
 * is only title + one description line, which is enough to recognise a page but not
 * enough to warn about the trap that page exists to avoid — "a Secret is base64,
 * not encrypted" is not something a list of names can teach.
 *
 * Deliberately not a modal or a card: it is one row, it does not block the table,
 * and it stays dismissed. The dismissal is stored per `pageKey` because a reader
 * who has internalised the ConfigMap note should still see the one on Secrets.
 */
export interface PageTipProps {
  /** Stable per-page key; the dismissal is stored under it. */
  pageKey: string;
  /** The sentence(s) shown in the bar. */
  children: React.ReactNode;
  /** Optional documentation URL; rendered as a small link inside the bar. */
  docHref?: string;
}

const STORAGE_PREFIX = 'kube-frontend.page-tip.dismissed.';

function readDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + key) === '1';
  } catch {
    // Private browsing can throw on access; showing the tip is the safe default.
    return false;
  }
}

export function PageTip({ pageKey, children, docHref }: PageTipProps): React.ReactElement | null {
  const t = useT();
  // Read once on mount: re-reading on every render would undo a dismissal when some
  // unrelated state re-renders the page.
  const [dismissed, setDismissed] = React.useState(() => readDismissed(pageKey));

  if (dismissed) return null;

  return (
    <div
      role="note"
      data-ai-id="page-tip"
      className="mb-3 flex items-start gap-2 rounded-ai-md border border-ai-line bg-ai-surface-2 px-3 py-2"
    >
      <Icon name="information" size={14} className="mt-1 shrink-0 text-ai-fg-muted" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-xs leading-5 text-ai-fg-muted">
        {children}
        {docHref ? (
          <a
            href={docHref}
            target="_blank"
            rel="noreferrer"
            className="ml-1 inline-flex items-center gap-0.5 text-ai-accent hover:underline"
            data-ai-id="page-tip:link"
          >
            {t('pageTip.docs')}
            <Icon name="link" size={10} aria-hidden="true" />
          </a>
        ) : null}
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 min-h-0 shrink-0 px-1"
        aria-label={t('pageTip.close')}
        {...actionProps('page-tip:close')}
        onClick={() => {
          try {
            window.localStorage.setItem(STORAGE_PREFIX + pageKey, '1');
          } catch {
            // Persistence is a convenience; the tip still closes for this render.
          }
          setDismissed(true);
        }}
      >
        <Icon name="close" size={12} aria-hidden="true" />
      </Button>
    </div>
  );
}

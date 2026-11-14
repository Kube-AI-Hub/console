import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { AiSurface } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';

/**
 * 404 兜底.
 *
 * The old console has one (`routes/index.js:162`) and the new one had none: an unknown path fell
 * through to a blank shell — the sidebar rendered, the page area did not. A console that silently
 * shows nothing for a wrong URL is indistinguishable from one that is broken, and a stale
 * bookmark from the old console lands exactly there.
 */
export function NotFoundPage(): React.ReactElement {
  const t = useT();
  return (
    <AiSurface as="section" aiId="not-found:surface" state="empty" className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <h1 className="text-lg font-semibold text-ai-fg" data-ai-id="not-found:title">
        {t('notFound.title')}
      </h1>
      <p className="max-w-md text-center text-xs text-ai-fg-muted">{t('notFound.description')}</p>
      <Link
        to="/kube-frontend"
        className="rounded-ai-md border border-ai-line px-3 py-1.5 text-xs text-ai-accent hover:underline"
      >
        {t('notFound.backHome')}
      </Link>
    </AiSurface>
  );
}
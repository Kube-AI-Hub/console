import * as React from 'react';
import { AiButton } from '@kube-ai-hub/ui';
import { ApiError } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';

/**
 * The failed state of a resource surface, with its way out.
 *
 * Lives next to the dialogs because every resource page needs exactly this
 * decision: show a sentence the reader can act on, and offer retry *unless* the
 * failure is a permission error — pressing retry on a 403 can only fail again.
 */
export interface ResourceErrorPanelProps {
  error: unknown;
  onRetry: () => void;
  /** Retry button handle, e.g. `secrets:retry`. */
  retryAiId: string;
  /** Without permission or without `onRetry` the panel simply states the problem. */
  retryable?: boolean;
}

/**
 * The generic phrases a transport failure is reported with.
 *
 * They say nothing a reader can act on, so the localized "network error" is better.
 * Anything else a 5xx carries is the apiserver's own sentence — see `upstreamReason`.
 */
const GENERIC_FAILURE = /^(internal server error|bad gateway|service unavailable|gateway timeout|network request failed|request failed|error)$/i;

/**
 * The reason inside a 5xx message, when it has one.
 *
 * The client already strips the `Internal Server Error: "/kapis/...":` wrapper, but a body
 * that never had one still arrives whole. What matters is that a permanent, specific
 * sentence ("cluster 4paradigm is not ready") is not replaced by "network error, please
 * retry" — the retry cannot succeed, and the sentence is the only next step the reader has.
 */
function upstreamReason(error: ApiError): string | undefined {
  const message = error.message.trim();
  const tail = message.replace(/^[A-Za-z ]+:\s*"[^"]*":\s*/, '').trim() || message;
  return GENERIC_FAILURE.test(tail) ? undefined : tail;
}

export function errorMessage(t: ReturnType<typeof useT>, error: unknown): string {
  /*
   * A non-ApiError still usually says something: `JSON.parse` throws a SyntaxError whose
   * message names the position, and a thrown string carries the server's sentence. Only
   * a value with nothing readable falls back to the localized "unknown error" — replacing
   * every one of them with it is how a 200-with-a-parsing-bug looked like "unknown error"
   * with no way to tell what happened.
   */
  if (!(error instanceof ApiError)) {
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
    return message.trim() || t('error.unknown');
  }
  if (error.isPermission) return t('error.unauthorized');
  if (error.isNotFound) return t('error.notFound');
  if (error.retryable) return upstreamReason(error) ?? t('error.network');
  return error.message;
}

export function ResourceErrorPanel({
  error,
  onRetry,
  retryAiId,
  retryable = true,
}: ResourceErrorPanelProps): React.ReactElement {
  const t = useT();
  const apiError = error instanceof ApiError ? error : undefined;
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-ai-md border border-ai-line p-8 text-center"
      role="alert"
      data-ai-id="resource-error"
    >
      <p className="text-sm font-medium text-ai-fg">{t('error.title')}</p>
      <p className="text-xs text-ai-fg-muted">{errorMessage(t, error)}</p>
      {/* No retry for a permission error: pressing it again cannot succeed. */}
      {retryable && !apiError?.isPermission ? (
        <AiButton aiId={retryAiId} size="sm" onClick={onRetry}>
          {t('common.retry')}
        </AiButton>
      ) : null}
    </div>
  );
}

/**
 * The inline failure of a write (create/edit/delete), kept separate from the
 * surface's own state: a failed save must not turn the table into an error page.
 */
export function MutationAlert({ error }: { error: unknown }): React.ReactElement | null {
  const t = useT();
  if (!error) return null;
  return (
    <p role="alert" className="mt-3 text-xs text-ai-danger" data-ai-id="resource-mutation-error">
      {errorMessage(t, error)}
    </p>
  );
}

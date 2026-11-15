import { ApiError } from '@kube-ai-hub/api-client';
import type { LocaleKey } from '@kube-ai-hub/locales';
import type { useT } from '@/i18n';

/**
 * Copy the add-cluster dialog shows when validation or create fails.
 *
 * The platform answers `/clusters/validation` with plain text (not a kube
 * Status). Mapping the known sentences is the difference between "网络异常"
 * and an instruction the reader can act on. Unknown text is shown as-is —
 * swallowing it as a generic network error was how a jwt/clusterRole mismatch
 * looked like a timeout.
 */
export interface ClusterImportErrorCopy {
  title: string;
  body: string;
  /** Original server text when it still adds detail the mapped sentence omits. */
  raw?: string;
}

type Translate = ReturnType<typeof useT>;

function rawMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message.trim();
  if (error instanceof Error) return error.message.trim();
  if (typeof error === 'string') return error.trim();
  return '';
}

const RULES: ReadonlyArray<{ match: RegExp; key: LocaleKey }> = [
  { match: /jwt is not equal/i, key: 'cluster.add.errorJwt' },
  { match: /clusterRole of the member cluster must be/i, key: 'cluster.add.errorClusterRole' },
  { match: /unable validate kubesphere endpoint/i, key: 'cluster.add.errorMemberApiserver' },
  { match: /MUST not import the same cluster twice/i, key: 'cluster.add.errorAlreadyExists' },
  {
    match: /timeout|i\/o timeout|connection refused|no route to host|network is unreachable|dial tcp/i,
    key: 'cluster.add.errorUnreachable',
  },
];

export function formatClusterImportError(t: Translate, error: unknown): ClusterImportErrorCopy {
  const title = t('cluster.add.errorTitle');
  if (error instanceof ApiError && error.isPermission) {
    return { title, body: t('error.unauthorized') };
  }
  if (error instanceof ApiError && error.isConflict) {
    return { title, body: t('cluster.add.errorConflict') };
  }

  const raw = rawMessage(error);
  for (const rule of RULES) {
    if (rule.match.test(raw)) {
      const body = t(rule.key);
      return raw && raw !== body ? { title, body, raw } : { title, body };
    }
  }

  if (raw && !/^bad request$/i.test(raw) && !/^internal server error$/i.test(raw)) {
    return { title, body: raw };
  }

  if (error instanceof ApiError && error.status >= 500) {
    return raw ? { title, body: t('cluster.add.errorInternal'), raw } : { title, body: t('cluster.add.errorInternal') };
  }
  if (error instanceof ApiError && error.retryable) {
    return { title, body: t('cluster.add.errorUnreachable') };
  }
  return { title, body: t('cluster.add.validationFailed') };
}

import { createFileRoute, redirect } from '@tanstack/react-router';
import { isTokenExpired } from '@kube-ai-hub/api-client';
import { LoginPage } from '@/pages/login/LoginPage';
import { readToken } from '@/shell/AuthProvider';

/**
 * `/login`
 *
 * A signed-in reader is sent on rather than shown the form again. The token is
 * read synchronously (not from context) so the redirect happens before the page
 * paints.
 *
 * `redirect` is declared as a validator even though the page itself never reads
 * the parsed search: without one, TanStack strips unknown search keys, so
 * `beforeLoad` saw an empty object and a signed-in reader arriving on a
 * `?redirect=...` link landed on `/` instead of the page they asked for.
 */
export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search['redirect'] === 'string' ? { redirect: search['redirect'] } : {},
  beforeLoad: ({ search }) => {
    const token = readToken();
    if (!token || isTokenExpired(token)) return;
    throw redirect({ href: safeReturnPath(search.redirect) ?? '/' });
  },
  component: LoginPage,
});

/**
 * A same-origin absolute path, or `null` for anything that could leave it.
 *
 * `//host` and `/\host` are both read as protocol-relative by browsers, and the
 * value comes from the query string, so it is attacker-controlled.
 */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) return null;
  return trimmed;
}

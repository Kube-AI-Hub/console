import { safeReturnPath } from './return-path';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { isTokenExpired } from '@kube-ai-hub/api-client';
import { LoginPage } from '@/pages/login/LoginPage';
import { readToken } from '@/shell/AuthProvider';

/**
 * `/kube-frontend/login`
 *
 * Under the app's prefix like every other route: this app shares an origin with
 * the old console, which owns `/login`. A bare path here would shadow that page
 * the moment the two are served from one host.
 *
 * A signed-in reader is sent on rather than shown the form again. The token is
 * read synchronously (not from context) so the redirect happens before the page
 * paints.
 *
 * `redirect` is declared as a validator even though the page itself never reads
 * the parsed search: without one, TanStack strips unknown search keys, so
 * `beforeLoad` saw an empty object and a signed-in reader arriving on a
 * `?redirect=...` link landed on the home page instead of the page they asked
 * for.
 */
export const Route = createFileRoute('/kube-frontend/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search['redirect'] === 'string' ? { redirect: search['redirect'] } : {},
  beforeLoad: ({ search }) => {
    const token = readToken();
    if (!token || isTokenExpired(token)) return;
    throw redirect({ href: safeReturnPath(search.redirect) ?? '/kube-frontend/' });
  },
  component: LoginPage,
});

export { safeReturnPath };

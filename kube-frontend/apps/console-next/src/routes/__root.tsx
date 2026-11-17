import * as React from 'react';
import { Outlet, createRootRoute, redirect, useRouterState } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/query';
import { isTokenExpired } from '@kube-ai-hub/api-client';
import { AppShell } from '@/shell/AppShell';
import { AuthProvider, readToken, useAuth } from '@/shell/AuthProvider';

/**
 * Root layout.
 *
 * The shell lives here rather than in each route so the sidebar, the mobile
 * drawer and the skip link exist exactly once, and a new route cannot forget
 * them — with one exception: `/kube-frontend/login` renders without the shell,
 * because a reader who is not signed in has no navigation to use and every link
 * behind it would fail.
 *
 * The gate is `beforeLoad`, not an effect, so the login form paints first and the
 * console behind it never flashes. It checks only that a token *exists* and has
 * not expired; whether the cluster still honours it is decided by the first
 * `/oauth/userinfo`, which clears the token and sends the reader here.
 */
export const Route = createRootRoute({
  beforeLoad: ({ location }) => {
    if (isPublicRoute(location.pathname)) return;
    const token = readToken();
    if (token && !isTokenExpired(token)) return;
    throw redirect({
      to: '/kube-frontend/login',
      // The return path rides in the query string, as in the old console, so a
      // deep link lands where it pointed after signing in.
      search: { redirect: `${location.pathname}${location.searchStr}` },
    });
  },
  component: RootComponent,
});

/**
 * Routes reachable without a session.
 *
 * Prefixed, like the login route itself: the bare `/login` belongs to the old
 * console on the shared origin, and treating it as public here would only ever
 * match a path this app does not serve.
 */
function isPublicRoute(pathname: string): boolean {
  return pathname === '/kube-frontend/login' || pathname.startsWith('/kube-frontend/login/');
}

function RootComponent(): React.ReactElement {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <AuthProvider>
      {isPublicRoute(pathname) ? (
        <Outlet />
      ) : (
        <AuthenticatedShell>
          <Outlet />
        </AuthenticatedShell>
      )}
    </AuthProvider>
  );
}

/**
 * Renders the shell only once the stored token has been checked upstream.
 *
 * Without this, a revoked token paints the full console for one round trip and
 * then bounces, which reads as a broken app rather than an expired session.
 */
function AuthenticatedShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const { user, ready } = useAuth();

  React.useEffect(() => {
    if (ready && !user) {
      window.location.assign(`/kube-frontend/login?redirect=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [ready, user]);

  /*
   * Cheap guard for layouts that render outside this app's providers (a test
   * mounting one page, or a future storybook entry): a page that needs the query
   * client would otherwise throw "No QueryClient set" and show a blank screen.
   */
  if (!ready || !user) {
    return (
      <QueryClientProvider client={createQueryClient()}>
        <div className="min-h-screen" aria-busy="true" />
      </QueryClientProvider>
    );
  }
  return <AppShell>{children}</AppShell>;
}

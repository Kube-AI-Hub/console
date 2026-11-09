import { createRootRoute, Outlet } from '@tanstack/react-router';
import { AppShell } from '@/shell/AppShell';

/**
 * Root layout.
 *
 * The shell lives here rather than in each route so the sidebar, the mobile
 * drawer and the skip link exist exactly once, and a new route cannot forget
 * them.
 */
export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

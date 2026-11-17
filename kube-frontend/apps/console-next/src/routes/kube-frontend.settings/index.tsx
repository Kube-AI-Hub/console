import * as React from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * `/kube-frontend/settings` — 默认进平台信息。
 *
 * The layout renders the area's tabs and an `<Outlet/>`; with no index child the root
 * path rendered the shell and nothing else (measured: body text stops after the sidebar).
 * `access` and `apps-manage` already redirect from their roots; this is the same shape,
 * and `platform-settings` names its first page `info`.
 */
export const Route = createFileRoute('/kube-frontend/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/kube-frontend/settings/info' });
  },
  component: Redirecting,
});

function Redirecting(): React.ReactElement {
  return <React.Fragment />;
}

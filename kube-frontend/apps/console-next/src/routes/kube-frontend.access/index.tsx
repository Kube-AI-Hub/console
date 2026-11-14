import * as React from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * `/kube-frontend/access` — 默认进用户表。
 *
 * The old console's access layout used `getIndexRoute` to the first nav item
 * (`accounts`). This app's registry names that page `users`; the sidebar still
 * points at the area root, so a missing index would render tabs-less empty
 * chrome. `apps-manage` uses the same beforeLoad redirect.
 */
export const Route = createFileRoute('/kube-frontend/access/')({
  beforeLoad: () => {
    throw redirect({ to: '/kube-frontend/access/users' });
  },
  component: Redirecting,
});

function Redirecting(): React.ReactElement {
  return <React.Fragment />;
}

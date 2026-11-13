import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { PlatformListPage } from '@/pages/platform/PlatformListPage';

/** `/kube-frontend/access/users` — 平台级 users 列表。 */
export const Route = createFileRoute('/kube-frontend/access/users/')({
  component: usersRoute,
});

function usersRoute(): React.ReactElement {
  return <PlatformListPage kind="users" />;
}

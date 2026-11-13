import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { UserDetailPage } from '@/pages/platform/UserDetailPage';

/** `/kube-frontend/access/users/$name` — 用户详情。 */
export const Route = createFileRoute('/kube-frontend/access/users/$name')({
  component: userDetailRoute,
});

function userDetailRoute(): React.ReactElement {
  return <UserDetailPage />;
}

import * as React from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';

/** `/kube-frontend/apps-manage` — 默认进分类页。 */
export const Route = createFileRoute('/kube-frontend/apps-manage/')({
  beforeLoad: () => {
    throw redirect({ to: '/kube-frontend/apps-manage/store' });
  },
  component: Redirecting,
});

function Redirecting(): React.ReactElement {
  return <React.Fragment />;
}

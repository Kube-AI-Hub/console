import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/kube-frontend/apps-manage/reviews')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}

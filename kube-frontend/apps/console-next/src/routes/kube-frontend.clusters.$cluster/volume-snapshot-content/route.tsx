import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/kube-frontend/clusters/$cluster/volume-snapshot-content')({
  component: () => <Outlet />,
});

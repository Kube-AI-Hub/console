import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/kube-frontend/clusters/$cluster/gateways')({
  component: () => <Outlet />,
});

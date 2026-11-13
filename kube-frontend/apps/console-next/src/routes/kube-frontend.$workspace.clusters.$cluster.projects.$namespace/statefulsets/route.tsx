import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/**
 * `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/statefulsets`
 *
 * Layout for the statefulsets page: the list lives in `index.tsx`, the detail in `$name.tsx`.
 * It renders its child and nothing else, so a detail URL does not fall back to the
 * list (in file-based routing this route is the parent of both).
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/statefulsets')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}

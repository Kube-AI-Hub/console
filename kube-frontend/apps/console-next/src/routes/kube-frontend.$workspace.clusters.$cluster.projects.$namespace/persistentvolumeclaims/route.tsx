import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/**
 * `…/projects/:namespace/persistentvolumeclaims`
 *
 * Layout for the persistentvolumeclaims page: the list is `index.tsx`, the detail is `$name.tsx`.
 * Renders only its child, so a detail URL is never swallowed by the list.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/persistentvolumeclaims')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}

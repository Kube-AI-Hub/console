import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/**
 * `…/projects/:namespace/volumesnapshots`
 *
 * Layout for the volumesnapshots page: the list is `index.tsx`, the detail is `$name.tsx`.
 * Renders only its child, so a detail URL is never swallowed by the list.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/volumesnapshots')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}

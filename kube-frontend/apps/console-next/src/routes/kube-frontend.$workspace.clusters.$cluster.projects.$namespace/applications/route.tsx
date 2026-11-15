import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/**
 * `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/applications`
 *
 * The project's 应用 list lives in `index.tsx`, a release detail in `$releaseId.tsx`.
 * This layout only renders its child, so a detail URL never falls back to the list.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/applications')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}

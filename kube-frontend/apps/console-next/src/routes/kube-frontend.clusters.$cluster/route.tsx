import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/**
 * `/kube-frontend/clusters/$cluster`
 *
 * The cluster console's layout. It renders no navigation of its own: the cluster's
 * pages are listed in the **left sidebar** (the shell switches to the cluster menu for
 * this path prefix), which is how the old console presents "进入集群后管理它".
 *
 * It used to repeat the same list as a tab strip. Two identical menus stacked — one in
 * the sidebar, one under the header — is not a feature; the strip also carried the
 * breadcrumb, which the pages themselves provide.
 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster')({
  component: ClusterWorkspace,
});

function ClusterWorkspace(): React.ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Outlet />
    </div>
  );
}

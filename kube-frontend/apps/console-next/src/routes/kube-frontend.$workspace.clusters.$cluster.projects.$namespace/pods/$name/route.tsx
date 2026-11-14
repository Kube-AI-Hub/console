import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';

/**
 * Pod folder: the detail page and its container subpage live under one path segment.
 *
 * `$name.tsx` could not hold a nested route, so the pod detail became this folder's
 * index. The layout renders the outlet only: the pod detail is not a shell around the
 * container page, and wrapping it would nest two headers.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/pods/$name')({
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}

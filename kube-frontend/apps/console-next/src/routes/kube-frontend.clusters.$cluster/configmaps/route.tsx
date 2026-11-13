import * as React from 'react';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

/**
 * `/kube-frontend/clusters/$cluster/configmaps` — 集群级配置字典的路径宿主。
 *
 * A layout route rather than one file that owns the path and renders the page: with a
 * folder, `<page>.tsx` would become the parent of `<page>.$name.tsx` and the detail
 * would hide behind the list. `namespace` stays a search parameter because narrowing
 * the same list is a filter, not a different resource scope.
 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster/configmaps')({
  validateSearch: (search: Record<string, unknown>): { namespace?: string } =>
    typeof search['namespace'] === 'string' && search['namespace'] ? { namespace: search['namespace'] } : {},
  beforeLoad: ({ params }) => {
    if (!params.cluster) throw redirect({ to: '/' });
  },
  component: PageOutlet,
});

function PageOutlet(): React.ReactElement {
  return <Outlet />;
}

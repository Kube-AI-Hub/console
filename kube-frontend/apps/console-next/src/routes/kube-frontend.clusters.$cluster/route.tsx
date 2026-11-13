import * as React from 'react';
import { createFileRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { areaOfPage } from '@/areas/registry';
import { AreaTabs } from '@/shell/AreaTabs';

/**
 * `/kube-frontend/clusters/$cluster`
 *
 * The cluster console's layout. It carries the area's tabs but **not** the workspace
 * bar: these pages are not scoped to a project, so a project switcher would offer a
 * choice that changes nothing. That is the one structural difference from the
 * project layout, and it is why they are two routes rather than one with a flag.
 */
export const Route = createFileRoute('/kube-frontend/clusters/$cluster')({
  component: ClusterWorkspace,
});

function ClusterWorkspace(): React.ReactElement {
  const { cluster } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();

  // The page segment is the part after `clusters/<id>/`.
  const segment = React.useMemo(() => {
    const rest = pathname.replace(/^\/kube-frontend\/clusters\/[^/]+\/?/, '');
    return rest.split('/').filter(Boolean)[0] ?? '';
  }, [pathname]);

  const area = areaOfPage('cluster', segment);

  const onNavigate = React.useCallback(
    (href: string, event: React.MouseEvent<HTMLAnchorElement>): boolean => {
      if (event.defaultPrevented) return false;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return false;
      if (event.currentTarget.target && event.currentTarget.target !== '_self') return false;
      void navigate({ href });
      return true;
    },
    [navigate],
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {area ? (
        <AreaTabs area={area} activeKey={segment} scopeRoot={`/kube-frontend/clusters/${encodeURIComponent(cluster)}`} onNavigate={onNavigate} />
      ) : null}
      <div className="min-w-0" data-area-page={segment}>
        <Outlet />
      </div>
    </div>
  );
}

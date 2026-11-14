import * as React from 'react';
import { createFileRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { areaOfPage } from '@/areas/registry';
import { AreaTabs } from '@/shell/AreaTabs';

/**
 * `/kube-frontend/access`
 *
 * The platform-level layout: same two things as the cluster console (area tabs, no
 * project workspace bar), but with neither a cluster nor a project in the URL —
 * these records belong to the platform itself. The index route redirects the bare
 * path to `users` (the area's `defaultPage`); this layout then has a segment to
 * hang the tabs on.
 */
export const Route = createFileRoute('/kube-frontend/access')({
  component: AccessWorkspace,
});

function AccessWorkspace(): React.ReactElement {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const segment = pathname.replace(/^\/kube-frontend\/access\/?/, '').split('/').filter(Boolean)[0] ?? '';
  const area = areaOfPage('platform', segment);

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
      {area ? <AreaTabs area={area} activeKey={segment} scopeRoot="/kube-frontend/access" onNavigate={onNavigate} /> : null}
      <div className="min-w-0" data-area-page={segment}>
        <Outlet />
      </div>
    </div>
  );
}

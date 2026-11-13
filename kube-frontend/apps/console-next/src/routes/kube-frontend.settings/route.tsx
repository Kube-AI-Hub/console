import * as React from 'react';
import { createFileRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { areaOfPage } from '@/areas/registry';
import { AreaTabs } from '@/shell/AreaTabs';

/**
 * `/kube-frontend/settings`
 *
 * The platform-settings layout. Same shape as the other platform area: tabs and no
 * project workspace bar, because none of these records belong to a project.
 */
export const Route = createFileRoute('/kube-frontend/settings')({
  component: SettingsWorkspace,
});

function SettingsWorkspace(): React.ReactElement {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const segment = pathname.replace(/^\/kube-frontend\/settings\/?/, '').split('/').filter(Boolean)[0] ?? '';
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
      {area ? <AreaTabs area={area} activeKey={segment} scopeRoot="/kube-frontend/settings" onNavigate={onNavigate} /> : null}
      <div className="min-w-0" data-area-page={segment}>
        <Outlet />
      </div>
    </div>
  );
}

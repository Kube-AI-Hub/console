import * as React from 'react';
import { createFileRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { areaOfPage } from '@/areas/registry';
import { PROJECT_ROUTE_PATTERN, projectPageSegment, projectRoot } from '@/areas/scope';
import { AreaTabs } from '@/shell/AreaTabs';
import { WorkspaceBar } from '@/shell/WorkspaceBar';
import { areaBreadcrumb } from '@/shell/breadcrumb';

/**
 * `/kube-frontend/$workspace/clusters/$cluster/projects/$namespace`
 *
 * The project workspace: one layout, many pages. It renders the workspace bar
 * (which project) and the current area's tabs (which page), and nothing else — the
 * page itself arrives through `<Outlet/>`.
 *
 * Why this route exists: before it, every resource page was a sibling, so moving
 * between two pages of the same area swapped the whole subtree and no navigation
 * surface knew that 配置字典 and 保密字典 belong to 配置. The layout makes the area a
 * property of the route tree instead of a fact each page re-discovers.
 *
 * The URL keeps the old console's shape — no area segment — so a page path is
 * `/kube-frontend/<ws>/clusters/<cluster>/projects/<ns>/configmaps` exactly
 * (DEC-AREA-01). The area is derived from the page segment.
 */
export const Route = createFileRoute('/kube-frontend/$workspace/clusters/$cluster/projects/$namespace')({
  component: ProjectWorkspace,
});

/**
 * The object a detail view shows, when the URL is `<page>/<name>`.
 *
 * The layout reads it rather than the page pushing it up: the breadcrumb belongs to
 * the tab strip, and a page reporting its own name would need a context, a
 * callback and an unmount path — three things to get wrong for one string.
 */
const useDetailLeaf = (pageSegment: string) =>
  useRouterState({
    select: (state) => {
      const rest = (PROJECT_ROUTE_PATTERN.exec(state.location.pathname)?.[4] ?? '').split('/').filter(Boolean);
      return rest.length > 1 && rest[0] === pageSegment ? decodeURIComponent(rest[1] ?? '') : undefined;
    },
  });

function ProjectWorkspace(): React.ReactElement {
  const { workspace, cluster, namespace } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();

  const segment = projectPageSegment(pathname);
  const area = areaOfPage('project', segment);
  const leaf = useDetailLeaf(segment);

  /*
   * A plain left click becomes a client-side transition; everything else keeps
   * the browser's behaviour (open in new tab, download, …).
   */
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

  const root = projectRoot({ workspace, cluster, namespace });

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <WorkspaceBar />
      {area ? (
        <AreaTabs
          area={area}
          activeKey={segment}
          scopeRoot={root}
          onNavigate={onNavigate}
          breadcrumb={areaBreadcrumb({ area, activeKey: segment, scopeRoot: root, pathname, onNavigate, leaf })}
        />
      ) : null}
      {/* The page owns its heading and toolbars; the tabs already say where the
          reader is, so a second title here would duplicate every page's <h1>. */}
      <div className="min-w-0" data-area-page={segment}>
        <Outlet />
      </div>
    </div>
  );
}

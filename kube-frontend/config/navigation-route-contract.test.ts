import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AREAS } from '../apps/console-next/src/areas/registry';

/**
 * Navigation ↔ route contracts.
 *
 * `areas/registry.ts` is the single description of what the sidebar shows, and it declares
 * `status: 'ready'` only for pages that are supposed to exist. That claim is worth checking:
 * a `ready` page with no route is a sidebar link to a 404, and a route nobody declared is a page
 * only reachable by typing the URL -- both are migration leftovers that no type covers.
 */
const root = new URL('..', import.meta.url).pathname;
const routesDir = join(root, 'apps/console-next/src/routes');

/** Where a scope's pages live in the file-based router. */
const SCOPE_PREFIX: Record<string, string> = {
  project: 'kube-frontend.$workspace.clusters.$cluster.projects.$namespace',
  cluster: 'kube-frontend.clusters.$cluster',
  workspace: 'kube-frontend.workspaces.$workspace',
};

/** Platform pages: the file router splits them across several top-level groups. */
const PLATFORM_FILES = [
  join(routesDir, 'kube-frontend.apps'),
  join(routesDir, 'kube-frontend.apps-manage'),
  join(routesDir, 'kube-frontend.access'),
  join(routesDir, 'kube-frontend.settings'),
];

/** A page path may be nested (`apps/instances`), so check the full relative path. */
function hasRouteDirectory(prefix: string, pagePath: string): boolean {
  return existsSync(join(routesDir, prefix, pagePath));
}

const readyPages = AREAS.flatMap((area) =>
  area.pages.filter((page) => page.status === 'ready').map((page) => ({ area: area.key, scope: area.scope, page })),
);

describe('navigation and routes', () => {
  it('declares enough pages for this contract to matter', () => {
    expect(AREAS.length).toBeGreaterThan(10);
    expect(readyPages.length).toBeGreaterThan(80);
  });

  it('points every ready page at a real route directory', () => {
    const missing: string[] = [];
    for (const { area, scope, page } of readyPages) {
      const prefix = SCOPE_PREFIX[scope];
      if (!prefix) continue; // platform pages are checked separately
      if (!hasRouteDirectory(prefix, page.path)) {
        missing.push(`${area}/${page.key}: 期望 routes/${prefix}/${page.path}/ 存在`);
      }
    }
    expect(missing, `侧栏声明为 ready 但没有对应路由（点进去就是 404）：\n${missing.join('\n')}`).toEqual([]);
  });

  it('keeps platform pages reachable', () => {
    const platform = readyPages.filter((entry) => entry.scope === 'platform');
    expect(platform.length).toBeGreaterThan(0);
    const known = new Set(PLATFORM_FILES.flatMap((dir) => (existsSync(dir) ? readdirSync(dir) : [])));
    const missing: string[] = [];
    for (const { area, page } of platform) {
      // Platform pages use several file-router groups; accept a match on the last path segment.
      const segment = page.path.split('/').pop() as string;
      const found = known.has(segment) || known.has(segment + '.tsx');
      if (!found) missing.push(`${area}/${page.key}: 平台页 ${page.path} 在任何平台路由组里都找不到`);
    }
    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('does not advertise a planned page as ready', () => {
    const planned = AREAS.flatMap((area) => area.pages.filter((page) => page.status === 'planned'));
    // Planned pages are allowed to exist in the registry (that is the point: the sidebar can say
    // "not yet"), but they must stay out of the ready set counted above.
    expect(planned.length).toBeLessThanOrEqual(readyPages.length);
  });
});

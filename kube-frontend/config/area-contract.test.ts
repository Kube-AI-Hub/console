import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Area contract.
 *
 * The console is being rebuilt one functional area at a time (配置 today, 应用负载
 * and the rest next). An area is a navigation concept, not a URL segment — pages
 * keep the old console's paths exactly — so the rules that make the grouping real
 * cannot be seen in the routes. They are checked here instead:
 *
 * 1. Every page under a scope belongs to exactly one area, and every area page
 *    exists on disk. A page with no area is a page the sidebar cannot reach; an
 *    area page with no file is a dead tab.
 * 2. Page paths carry no area segment (DEC-AREA-01). This is the one that would
 *    silently break bookmarks from the old console.
 * 3. The sidebar, the tab strip and the breadcrumb read the same registry.
 *    Re-deriving the grouping in a component is how three surfaces start
 *    disagreeing about what "配置" contains.
 */

const root = new URL('..', import.meta.url).pathname;
const APP_SRC = join(root, 'apps/console-next/src');

function read(path: string): string {
  return readFileSync(join(APP_SRC, path), 'utf8');
}

/**
 * Every route file, as `[path relative to src/routes, text]`.
 *
 * Route files live in folders (`<scope>/<page>/index.tsx`), so this walks rather
 * than lists one directory. The relative path is what the assertions below use to
 * tell a layout from a page.
 */
function routeFiles(): Array<[string, string]> {
  const dir = join(APP_SRC, 'routes');
  const out: Array<[string, string]> = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.tsx')) out.push([relative(dir, full), readFileSync(full, 'utf8')] as [string, string]);
    }
  };
  walk(dir);
  return out;
}

/** Files of one page folder, e.g. `<scope>/configmaps`. */
function pageFolder(scopeDir: string, page: string): Array<[string, string]> {
  return routeFiles().filter(([file]) => file.startsWith(`${scopeDir}/${page}/`));
}

/** Page directories that exist on disk. */
function pageDirs(): string[] {
  return readdirSync(join(APP_SRC, 'pages')).filter((entry) => statSync(join(APP_SRC, 'pages', entry)).isDirectory());
}

describe('area registry', () => {
  it('derives routes from the registry and not from a second list', () => {
    const shell = read('shell/AppShell.tsx');
    // The sidebar builds its rows from `areasFor('project')`; a hard-coded nav
    // array would be the second source of truth this test exists to prevent.
    expect(shell).toContain("areasFor('project')");
    expect(shell).not.toMatch(/const NAV\s*:/);
    const tabs = read('shell/AreaTabs.tsx');
    expect(tabs).toContain('areaPages(area)');
  });

  it('gives every ready area page a route folder with a list route', () => {
    const registry = read('areas/registry.ts');
    const keys = [...registry.matchAll(/\{ key: '([a-z0-9-]+)', path: '/g)].map((match) => match[1]);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      // The page exists when its route folder does. A page may share its
      // implementation with the rest of its area (the eight application
      // workloads do), so the folder is the evidence, not a `src/pages/<key>`.
      const list = routeFiles().some(([file]) => file.endsWith(`/${key}/index.tsx`));
      expect(list, `${key} has no route folder with index.tsx`).toBe(true);
    }
  });

  it('keeps page paths free of an area segment', () => {
    const registry = read('areas/registry.ts');
    for (const match of registry.matchAll(/\{ key: '([a-z0-9-]+)', path: '([^']+)'/g)) {
      const [, key, path] = match;
      // A path equal to its key is the old console's shape; anything that prefixes
      // another segment would be the area segment this decision rules out.
      expect(path, `${key} path`).not.toContain('/');
      expect(path).toBe(key);
    }
  });
});

describe('project routes', () => {
  it('has a project layout that owns the workspace bar and tabs', () => {
    const scope = 'kube-frontend.$workspace.clusters.$cluster.projects.$namespace';
    const text = read(`routes/${scope}/route.tsx`);
    expect(text, 'project layout must render the workspace bar').toContain('<WorkspaceBar');
    expect(text, 'project layout must render the area tabs').toContain('<AreaTabs');
    expect(text, 'project layout must render the page through Outlet').toContain('<Outlet');
  });

  it('renders the current page through exactly one Outlet per scope', () => {
    // Two Outlets in one layout double-render the child (and the queries with it).
    // The root route is the exception: it renders either the bare `/kube-frontend/login`
    // outlet or the one inside the shell, never both at once.
    for (const [file, text] of routeFiles()) {
      if (file === '__root.tsx') continue;
      // Strip comments first: a doc block that *mentions* `<Outlet/>` is not a
      // second render.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      const outlets = (code.match(/<Outlet\b/g) ?? []).length;
      expect(outlets, `${relative(APP_SRC, join('routes', file))} has ${outlets} Outlet(s)`).toBeLessThanOrEqual(1);
    }
  });

  it('keeps every page in its own folder instead of a flat route list', () => {
    const scope = 'kube-frontend.$workspace.clusters.$cluster.projects.$namespace';
    const files = routeFiles().map(([file]) => file);

    for (const page of ['configmaps', 'secrets', 'serviceaccounts']) {
      const folder = pageFolder(scope, page).map(([file]) => file.replace(`${scope}/${page}/`, ''));
      // One page = one folder: a list route, a detail route and the layout that
      // lets the detail render instead of the list.
      expect(folder.sort(), `${page} folder contents`).toEqual(['$name.tsx', 'index.tsx', 'route.tsx']);
    }

    // Nothing page-shaped may sit directly in the scope folder any more.
    const loose = files.filter((file) => file.startsWith(`${scope}/`) && !file.includes('/', scope.length + 1));
    expect(loose, 'page routes must live in folders').toEqual([`${scope}/route.tsx`]);
  });

  it('gives each page folder a layout that renders its child', () => {
    const scope = 'kube-frontend.$workspace.clusters.$cluster.projects.$namespace';
    for (const page of ['configmaps', 'secrets', 'serviceaccounts']) {
      const text = read(`routes/${scope}/${page}/route.tsx`);
      // Without this the list route is the detail's parent and renders itself for
      // `/page/<name>` — the detail silently never appears.
      expect(text, `${page}/route.tsx must render <Outlet/>`).toContain('<Outlet');
    }
  });
});

describe('workspace navigation', () => {
  it('switches project without leaving the page', () => {
    const bar = read('shell/WorkspaceBar.tsx');
    // Same page, new namespace: the switch rewrites the scope segment and keeps
    // the rest of the path, which is what makes it feel like switching documents.
    expect(bar).toContain('PROJECT_ROUTE_PATTERN');
    expect(bar).toMatch(/rest/);
    expect(bar).toContain('navigate');
  });

  it('turns plain clicks into client-side transitions and leaves modified clicks alone', () => {
    const tabs = read('shell/AreaTabs.tsx');
    for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
      expect(tabs).toContain(modifier);
    }
    expect(tabs).toContain('navigate');
  });
});

describe('shared chunk warm-up', () => {
  it('warms the editor on purpose instead of leaving it to the first page that needs it', () => {
    const preload = read('shell/preload.tsx');
    expect(preload).toContain("@kube-ai-hub/ui/editor");
    expect(preload).toContain('requestIdleCallback');
    const shell = read('shell/AppShell.tsx');
    expect(shell).toContain('<SharedChunkWarmer');
  });
});

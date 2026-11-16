import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Route/page coherence contracts.
 *
 * Two kinds of breakage that a migration of this size produces and that neither TypeScript nor
 * the page contracts notice:
 *
 * 1. A route imports a page path that no longer exists. `tsc` does catch this, but only when the
 *    route is type-checked -- and a route that throws at import time takes the whole router down
 *    at runtime with a much less obvious message.
 * 2. A page component is left behind by a redesign: the file still exports `XxxPage`, nothing
 *    imports it, so it silently rots (and confuses the next reader about which page is live).
 *    `PlatformSettingsPage` was exactly this: superseded by `PlatformInfoPage` plus
 *    `ChannelConfigPage`, then never deleted.
 *
 * A page component is considered live when any *other* source file mentions its name -- that
 * covers both `routes/...` imports and page-to-page composition (e.g. `MonitoringListPage`
 * rendering `RuleGroupsPage`).
 */
const root = new URL('..', import.meta.url).pathname;
const srcDir = join(root, 'apps/console-next/src');

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    if (!existsSync(current)) return;
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist') continue;
        walk(full);
      } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

const routeFiles = tsxFiles(join(srcDir, 'routes')).filter((file) => file.endsWith('.tsx'));
const pageFiles = tsxFiles(join(srcDir, 'pages'));
const sources = new Map<string, string>();
for (const file of [...routeFiles, ...pageFiles]) {
  sources.set(file, readFileSync(file, 'utf8'));
}

function resolvesPageImport(specifier: string): boolean {
  const base = resolve(srcDir, specifier.replace(/^@\//, ''));
  return ['.tsx', '.ts', '/index.tsx', '/index.ts'].some((suffix) => existsSync(base + suffix));
}

describe('routes and pages', () => {
  it('finds the route and page inventories', () => {
    expect(routeFiles.length).toBeGreaterThan(100);
    expect(pageFiles.length).toBeGreaterThan(100);
  });

  it('only imports page modules that exist', () => {
    const unresolved: string[] = [];
    for (const file of routeFiles) {
      const source = sources.get(file) ?? '';
      for (const match of source.matchAll(/from '(@\/pages\/[^']+)'/g)) {
        if (!resolvesPageImport(match[1])) unresolved.push(`${file} -> ${match[1]}`);
      }
    }
    expect(unresolved, unresolved.join('\n')).toEqual([]);
  });

  it('leaves no page component unreferenced', () => {
    const orphans: string[] = [];
    // Only `.tsx` holds components; `.ts` helpers export functions like `registerWorkloadPage`
    // that merely end in "Page".
    for (const file of pageFiles.filter((candidate) => candidate.endsWith('.tsx'))) {
      const source = sources.get(file) ?? '';
      for (const match of source.matchAll(/export function (\w+Page)\s*[<(]/g)) {
        const name = match[1];
        const referenced = [...sources.entries()].some(
          ([otherFile, otherSource]) => otherFile !== file && new RegExp(`\\b${name}\\b`).test(otherSource),
        );
        if (!referenced) orphans.push(`${file}: ${name}`);
      }
    }
    expect(orphans, `以下页面组件没有被任何路由或页面引用（可能是改版后遗留的死代码）：\n${orphans.join('\n')}`).toEqual([]);
  });
});

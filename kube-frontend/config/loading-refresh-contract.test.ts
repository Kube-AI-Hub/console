import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The loading / refreshing standard, as a mechanical guard.
 *
 * Three lessons, all of them "the page looked fine":
 *
 * 1. A first load and a refresh are different pictures. The first one has nothing to
 *    show, so it draws a skeleton shaped like the thing that is arriving; a refresh
 *    already has content, and replacing it with a skeleton makes the table or chart
 *    blink and loses the reader's place. When the chart drew both — a skeleton *above*
 *    the plot instead of in place of it — a 180px panel measured 264px on the first
 *    load with empty axes showing underneath. Nothing failed; it just looked wrong.
 * 2. The skeleton and the veil are shared components. Three copies of the veil had
 *    already drifted (40% vs 45% tint, a rounded corner on one, z-10 vs z-30), so the
 *    same refresh looked like a different feature per page.
 * 3. Auto-refresh must not veil. A rolling window moves every few seconds; a veil on
 *    each tick strobes, which is worse than no feedback at all.
 *
 * These read source rather than rendering. A render test per surface would take
 * minutes and would not catch the page somebody adds next month; source is where the
 * wrong branch actually lives. The docs this encodes are `docs/SDD.md` §2「加载态与
 * 刷新态」and the component sections of `packages/ai-kit/README.md`.
 */

const root = new URL('..', import.meta.url).pathname;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist' || entry === 'test') continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry)) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

const APP = join(root, 'apps/console-next/src');
const SOURCES = sourceFiles(APP).map((path) => ({ path: relative(root, path), text: readFileSync(path, 'utf8') }));
const PAGES = SOURCES.filter(({ path }) => path.includes('/pages/'));

/** Strip comments so prose about a pitfall does not read as the pitfall. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('the kit owns the two appearances', () => {
  it('keeps one veil: the shared RefreshVeil', () => {
    // The veil's classes are the contract (tint, blur, z-index, pill). A page or a
    // component that writes them again is a second implementation that will drift.
    const copycats = SOURCES.filter(({ path, text }) => {
      if (path.includes('/packages/ai-kit/')) return false;
      return /backdrop-blur-\[1px\]/.test(code(text));
    }).map(({ path }) => path);
    expect(copycats, `这些文件自己画了一份刷新遮罩，改用共享 RefreshVeil：\n${copycats.join('\n')}`).toEqual([]);
  });

  it('keeps the veil label in the locale dictionaries', () => {
    // '更新中…' hard-coded in a component means the English build says Chinese. The
    // shared veil defaults to it only where no host label is wired (stories).
    const hardcoded = SOURCES.filter(({ text }) => /['"]更新中/.test(code(text))).map(({ path }) => path);
    expect(hardcoded, `刷新文案写死在代码里，应走文案键：\n${hardcoded.join('\n')}`).toEqual([]);
  });

  it('leaves the first-load skeleton to the shared components', () => {
    // A chart's first load draws `ChartSkeleton`; a table's draws skeleton rows. A
    // single pulsing grey block reads as "broken", which is what it replaced.
    //
    // Matched inside a `className` so a lazy editor's fallback block — a different
    // thing entirely, and legitimately a solid box — stays out of the report.
    const offenders = PAGES.filter(({ text }) => {
      const body = code(text);
      return /className={'?["'][^"']*animate-pulse[^"']*rounded-ai-md bg-ai-surface/.test(body);
    }).map(({ path }) => path);
    expect(offenders, `这些页面自己拼了整块骨架，改用 ChartSkeleton / Table 的骨架行：\n${offenders.join('\n')}`).toEqual([]);
  });
});

describe('a first load and a refresh are not the same state', () => {
  it('never derives a list\'s first load from isFetching', () => {
    // `loading={isFetching}` replaces rows with skeletons on every refetch and keeps
    // the veil from ever appearing, so a slow refresh looks like a dead button.
    const offenders = PAGES.filter(({ text }) =>
      /<ResourceList[\s\S]{0,2000}?loading=\{query\.isFetching\}/.test(text),
    ).map(({ path }) => path);
    expect(offenders, `这些列表的首次加载用了 isFetching，刷新会闪骨架：\n${offenders.join('\n')}`).toEqual([]);
  });

  it('never puts a static state on a region that is still loading', () => {
    // The wrapper said `ready` while `ChartPanel` inside it said `loading`, so a test
    // or an agent could wait for "ready" and read a panel with no data. A region that
    // distinguishes `loading` must also distinguish a refresh (which keeps its
    // content) — `... ? 'loading' : ... : 'ready'` folds the two back together and the
    // only visible difference between "first load" and "updating" disappears.
    const offenders: string[] = [];
    for (const { path, text } of PAGES) {
      const blocks = text.match(/data-ai-state=\{[^}]*\}/g) ?? [];
      for (const block of blocks) {
        const body = code(block);
        if (!/'loading'/.test(body)) continue;
        if (/'ready'/.test(body) && !/refreshing/.test(body)) offenders.push(`${path} -> ${block}`);
      }
    }
    expect(
      offenders,
      `这些区域的 data-ai-state 把刷新并进了 ready，却区分了 loading：\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

describe('auto-refresh stays quiet', () => {
  it('does not veil on an interval-driven read', () => {
    // A page that polls and also hands the shared components a manual-refresh flag
    // must set that flag only for the reader's request. Reading `isFetching` there
    // veils every tick.
    const offenders = PAGES.filter(({ text }) => {
      const body = code(text);
      if (!/refetchInterval|setInterval/.test(body)) return false;
      return /manualRefresh=\{[^}]*isFetching/.test(body);
    }).map(({ path }) => path);
    expect(offenders, `这些页面会轮询，却把每次轮询都当成手动刷新：\n${offenders.join('\n')}`).toEqual([]);
  });
});

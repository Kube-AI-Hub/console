import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The list standard, as a mechanical guard.
 *
 * Every list page in the console shares `ResourceList`, and the standard is what
 * makes them behave the same: an identity column that stays put while the rest
 * scrolls, a refresh that is visible while it runs, and a way to undo every filter
 * at once. All three are easy to lose in a refactor because the page still looks
 * correct without them — the table renders, the rows arrive, and the reader only
 * notices when they scroll sideways and lose the row they were reading.
 *
 * These checks read source rather than rendering: a page-level render test per list
 * would take minutes and still miss the page somebody adds next month. Source is
 * where a missing `pin` actually lives.
 *
 * The pinned-end column is not checked here: `ResourceList` appends it whenever a
 * list declares `rowActions`, so it cannot be forgotten per page.
 */

const root = new URL('..', import.meta.url).pathname;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist') continue;
        walk(full);
      } else if (/\.tsx$/.test(entry)) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

const PAGES = sourceFiles(join(root, 'apps/console-next/src/pages'));
const PAGE_SOURCES = PAGES.map((path) => ({ path: relative(root, path), text: readFileSync(path, 'utf8') }));

/**
 * Pages that render a data table through the shared list.
 *
 * Panels and dashboards (`NodeRankingPanel`, `NodeResourcesPanel`, `GpuPodsPanel`,
 * `MonitoringListPage`) embed a table inside a card rather than being a page: their
 * table has no row identity to anchor and no toolbar of its own, so the standard's
 * pin/refresh rules do not apply.
 */
const PANEL_EXEMPT = new Set([
  'apps/console-next/src/pages/cluster/NodeRankingPanel.tsx',
  'apps/console-next/src/pages/cluster/NodeResourcesPanel.tsx',
  'apps/console-next/src/pages/cluster/GpuPodsPanel.tsx',
]);

/** Every file that builds a `ListSchema` — i.e. a page whose table is the page. */
const listPages = PAGE_SOURCES.filter(
  ({ path, text }) => text.includes('ResourceList') && text.includes('columns:') && !PANEL_EXEMPT.has(path),
);

describe('list standard', () => {
  it('finds the list pages it is meant to guard', () => {
    // A guard that silently matches nothing is worse than no guard: it reports green
    // while the standard erodes. The floor is deliberately below the current count so
    // adding a page does not need this number edited, but deleting the pages wholesale
    // does fail.
    expect(listPages.length).toBeGreaterThanOrEqual(35);
  });

  it('pins the identity column so it survives horizontal scrolling', () => {
    const missing = listPages
      .filter(({ text }) => !text.includes("pin: 'start'"))
      .map(({ path }) => path);
    expect(missing, `这些列表没有固定首列（横向滚动时行身份会滚出视野）：\n${missing.join('\n')}`).toEqual([]);
  });

  it('gives every pinned column an explicit width', () => {
    // `ResourceList` ignores a pin without a width (and warns): the column would
    // change width as its content changes, which reads as a glitch rather than a pin.
    // The width may be written before or after the pin, so the check reads the whole
    // column literal — from the pin back to the `key:` that opens it.
    const missing: string[] = [];
    for (const { path, text } of listPages) {
      const pinIndex = text.indexOf("pin: 'start'");
      if (pinIndex < 0) continue;
      const keyIndex = text.lastIndexOf('key:', pinIndex);
      const block = text.slice(Math.max(0, keyIndex), pinIndex + 200);
      if (!/width:\s*\d+/.test(block)) missing.push(path);
    }
    expect(missing, `固定列缺少显式宽度：\n${missing.join('\n')}`).toEqual([]);
  });

  it('keeps a refetch visible instead of only swapping rows at the end', () => {
    // `loading` replaces the rows with skeletons and only covers the first load. A
    // page that never sets `refreshing` shows nothing while a refresh runs, so a
    // slow response looks like a button that did not work.
    const withRefresh = listPages.filter(({ text }) => text.includes('refresh:'));
    const missing = withRefresh
      .filter(({ text }) => !text.includes('refreshing='))
      .map(({ path }) => path);
    expect(missing, `这些列表有刷新按钮但刷新时没有任何可见反馈：\n${missing.join('\n')}`).toEqual([]);
  });

  it('offers one control that clears every filter', () => {
    // `ResourceList` renders "清除全部条件" only when the host supplies `clearFilters`.
    // Without it a reader who narrowed three columns must reopen each popover.
    // Supplying it through `useListRefresh(...).filterLabels` is the standard route —
    // that is what makes every list behave the same — so a spread counts.
    const withFilters = listPages.filter(({ text }) => text.includes('filters:') || text.includes('filter:'));
    const missing = withFilters
      .filter(({ text }) => !text.includes('clearFilters') && !text.includes('.filterLabels'))
      .map(({ path }) => path);
    expect(missing, `这些列表有筛选但没有「清除全部条件」入口：\n${missing.join('\n')}`).toEqual([]);
  });
});

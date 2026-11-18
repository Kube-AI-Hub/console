import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A status badge in a table cell must size to its text.
 *
 * A `flex flex-col` cell defaults to `align-items: stretch`, which stretched the
 * badge to the full column width — a 126px band of tinted background behind a
 * 60px label, on every row. `items-start` is the fix, and it is invisible to a
 * DOM assertion (the badge is a `<span>` either way), so the guard reads source.
 *
 * The check is deliberately narrow: it looks at one JSX element at a time — the
 * opening tag through its matching close on the same renderer — rather than a
 * fixed line window. A window catches the *next* column's badge and reports a
 * false positive on a name column that has no badge at all.
 */
const PAGES = join(__dirname, '..', 'src', 'pages');

const files = [
  'cluster/MultiClusterListPage.tsx',
  'cluster/ClusterListPage.tsx',
  'cluster/NodesPage.tsx',
  'cluster/GpusPage.tsx',
  'cluster/NodeUsagePage.tsx',
];

/**
 * The JSX elements of `source` that are a `flex flex-col` without `items-*`,
 * paired with the elements nested inside them.
 */
function stretchedColumnsWithBadge(source: string): number[] {
  const offenders: number[] = [];
  /*
   * Comments are blanked before scanning, keeping line numbers intact.
   *
   * A comment that *names* the pattern — "a `flex flex-col` would stretch the badge" —
   * is documentation of the very rule this test enforces, and matching it reported the
   * line that explains the fix as a violation. Only real markup should count.
   */
  const lines = source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, (line) => ' '.repeat(line.length))
    .split('\n');

  lines.forEach((line, index) => {
    if (!line.includes('flex flex-col')) return;
    if (/items-(start|center|end|baseline)/.test(line)) return;

    /*
     * Walk forward counting `<span`/`<div` against their closers, and stop at the
     * first tag that closes the wrapper. Only what is genuinely inside it counts;
     * a sibling element in the next column does not.
     */
    let depth = 0;
    let opened = false;
    let hasBadge = false;
    for (let i = index; i < Math.min(index + 30, lines.length); i += 1) {
      const text = lines[i]!;
      const opens = (text.match(/<(span|div)\b/g) ?? []).length;
      const closes = (text.match(/<\/(span|div)>/g) ?? []).length;
      if (opens > 0) opened = true;
      depth += opens - closes;
      if (text.includes('<Badge')) hasBadge = true;
      if (opened && depth <= 0) break;
    }
    if (hasBadge) offenders.push(index + 1);
  });

  return offenders;
}

describe('status badges in table cells', () => {
  it.each(files)('%s does not stretch a badge inside a flex column', (file) => {
    const source = readFileSync(join(PAGES, file), 'utf8');
    expect(stretchedColumnsWithBadge(source)).toEqual([]);
  });

  it('still detects the pattern it is meant to catch', () => {
    // Guards the guard: a checker that always passes is worse than none.
    const broken = [
      'const col = {',
      "  key: 'status',",
      '  render: (row) => (',
      '    <span className="flex flex-col gap-1">',
      '      <Badge tone="success">{row.status}</Badge>',
      '    </span>',
      '  ),',
      '};',
    ].join('\n');
    expect(stretchedColumnsWithBadge(broken)).toEqual([4]);

    const fixed = broken.replace('flex flex-col gap-1', 'flex flex-col items-start gap-1');
    expect(stretchedColumnsWithBadge(fixed)).toEqual([]);
  });

  it('ignores the pattern when it only appears in a comment', () => {
    // A comment explaining why the wrapper is wrong must not be read as the wrapper.
    const documented = [
      'const col = {',
      "  key: 'status',",
      '  /* A `flex flex-col` here would stretch the badge. */',
      '  render: (row) => <Badge>{row.status}</Badge>,',
      '};',
    ].join('\n');
    expect(stretchedColumnsWithBadge(documented)).toEqual([]);

    // The same words in real markup are still caught, at the same line number.
    const real = [
      'const col = {',
      "  key: 'status',",
      '  /* A column wrapper would stretch the badge. */',
      '  render: (row) => <span className="flex flex-col"><Badge>{row.status}</Badge></span>,',
      '};',
    ].join('\n');
    expect(stretchedColumnsWithBadge(real)).toEqual([4]);
  });
});

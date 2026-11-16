import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Column-visibility wiring contracts.
 *
 * Three defects the migration hit while wiring the column chooser onto 37 lists, all of which
 * compile cleanly and only show up in the browser:
 *
 * 1. A schema declared `columnVisibility` but no column carried `hideable: true`. The chooser then
 *    renders with only its reset row — it looks broken, and nothing in the type system objects.
 * 2. The schema declared the chooser but the page never passed `onVisibleColumnsChange`, so the
 *    chooser never rendered at all.
 * 3. Two pages (or two tabs of one page) reused the same `aiId`, so automation could not tell them
 *    apart and a user's choice on one list was read by the other.
 *
 * All three are mechanical, so they are checked mechanically over every page source.
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
      } else if (entry.endsWith('.tsx')) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

const files = sourceFiles(join(root, 'apps/console-next/src/pages')).map((file) => ({
  file,
  source: readFileSync(file, 'utf8'),
}));

const withChooser = files.filter(({ source }) => source.includes('columnVisibility: {'));

describe('column visibility', () => {
  it('covers enough pages to be worth guarding', () => {
    expect(withChooser.length).toBeGreaterThan(30);
  });

  it('marks at least one column hideable wherever the chooser is declared', () => {
    const offenders = withChooser
      .filter(({ source }) => !source.includes('hideable: true'))
      .map(({ file }) => file);
    expect(offenders, `声明了 columnVisibility 但没有 hideable 列（选择器只剩「重置」）：${offenders.join(', ')}`).toEqual([]);
  });

  it('passes the change handler wherever the chooser is declared', () => {
    const offenders = withChooser
      .filter(({ source }) => !source.includes('onVisibleColumnsChange'))
      .map(({ file }) => file);
    expect(offenders, `声明了 columnVisibility 但没有 onVisibleColumnsChange：${offenders.join(', ')}`).toEqual([]);
  });

  it('gives every list its own persistent choice key', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const { file } of withChooser) {
      const keys = new Set(readFileSync(file, 'utf8').match(/useColumnVisibility\('([^']+)'/g) ?? []);
      for (const call of keys) {
        const key = call.replace("useColumnVisibility('", '').replace(/'$/, '');
        const owner = seen.get(key);
        if (owner && owner !== file) duplicates.push(`${key} 被 ${owner} 与 ${file} 共用`);
        else seen.set(key, file);
      }
    }
    expect(duplicates, duplicates.join('; ')).toEqual([]);
  });
});

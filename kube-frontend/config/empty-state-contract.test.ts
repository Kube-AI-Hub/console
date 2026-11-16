import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Empty-state contracts.
 *
 * The migration's hardest rule is that "nothing here" must never be confused with "could not load"
 * or "zero". A `ResourceList` renders a blank table body when the row array is empty, which reads
 * as breakage; every schema therefore has to say what the absence means (`empty.title`, and
 * optionally a description). The one page allowed to own its empty block instead does so
 * because its empty state is a page-level block with its own handle rather than a table row.
 */
const root = new URL('..', import.meta.url).pathname;
const pagesDir = join(root, 'apps/console-next/src/pages');

/** Pages that render their own empty block instead of `schema.empty`. */
const OWN_EMPTY_BLOCK = new Set(['monitoring/ProjectCustomMonitoringPage.tsx']);

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist') continue;
        walk(full);
      } else if (entry.endsWith('.tsx')) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

const listFiles = tsxFiles(pagesDir)
  .map((file) => ({
    relative: file.slice(pagesDir.length + 1),
    source: readFileSync(file, 'utf8'),
  }))
  .filter(({ source }) => source.includes('<ResourceList'));

describe('empty states', () => {
  it('finds the list pages', () => {
    expect(listFiles.length).toBeGreaterThan(40);
  });

  it('tells the reader why a list is empty', () => {
    const offenders = listFiles
      .filter(({ relative, source }) => !OWN_EMPTY_BLOCK.has(relative) && !/\bempty:\s*\{/.test(source))
      .map(({ relative }) => relative);
    expect(
      offenders,
      `以下列表没有声明 schema.empty——空列表会渲染成一张空表格，读者分不清「没有数据」还是「加载失败」：\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('keeps the own-empty-block list honest', () => {
    for (const relative of OWN_EMPTY_BLOCK) {
      const entry = listFiles.find((candidate) => candidate.relative === relative);
      expect(entry, `OWN_EMPTY_BLOCK 里的 ${relative} 不存在或不再使用 ResourceList`).toBeDefined();
      // Owning the empty block means having an explicit state machine plus a handle for it.
      expect(entry?.source).toMatch(/===\s*'empty'/);
      expect(entry?.source).toMatch(/data-ai-id=["{][^\n]*:empty/);
    }
  });
});

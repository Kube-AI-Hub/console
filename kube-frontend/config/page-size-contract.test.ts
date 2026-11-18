import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Page-size picker contracts.
 *
 * Two defects from the migration, both invisible to the type checker:
 *
 * 1. `ResourceList` renders the size picker only when the schema declares `pagination.pageSizeOptions`
 *    **and** the list receives `onPageSizeChange`. Declaring one without the other produces a picker
 *    that is either missing or dead — and `tsc` is happy either way.
 * 2. A list whose query key omits the page size re-renders the picker, changes state, and shows the
 *    old rows: react-query answers from cache because the key did not change.
 *
 * Both are mechanical, so they are checked mechanically over every page source.
 */
const root = new URL('..', import.meta.url).pathname;

function pageFiles(dir: string): string[] {
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

const files = pageFiles(join(root, 'apps/console-next/src/pages')).map((file) => ({
  file,
  source: readFileSync(file, 'utf8'),
}));

describe('page-size picker', () => {
  it('is wired to a handler wherever the schema declares the options', () => {
    const broken = files
      .filter(({ source }) => source.includes('pageSizeOptions'))
      .filter(({ source }) => !source.includes('onPageSizeChange'))
      .map(({ file }) => file);
    expect(broken, `声明了 pageSizeOptions 但没有 onPageSizeChange：${broken.join(', ')}`).toEqual([]);
  });

  it('never asks the server for a page size other than the one the reader picked', () => {
    // A `pageSize: PAGE_SIZE` inside a request object means the picker changes state the request
    // never sees. The constant is fine as a *default* (defaultPageSize / useState initial value).
    const offenders = files
      .filter(({ source }) => /pageSize:\s*PAGE_SIZE\b/.test(source))
      // `pager-less on purpose` opts a list out: it shows one fixed window and has no picker.
      .filter(({ source }) => !source.includes('pager-less on purpose'))
      .map(({ file }) => file);
    expect(offenders, `请求参数仍用常量 PAGE_SIZE：${offenders.join(', ')}`).toEqual([]);
  });

  it('gives every paged list the four sizes the old console offered', () => {
    // Coverage, not just wiring: the migration delivered the picker page family by page
    // family, and seven lists were still rendering every row on one "page". A list that
    // declares `pagination` without the sizes has no picker at all — invisible to tsc.
    const offenders = files
      .filter(({ source }) => source.includes('pagination: {'))
      .filter(({ source }) => !source.includes('pageSizeOptions'))
      .map(({ file }) => file);
    expect(offenders, `有分页但没有每页档位：${offenders.join(', ')}`).toEqual([]);
  });

  it('keeps the page size in the query key when the list is server-paged', () => {
    // Server-paged lists derive their key from the list state; if `list.page` is in the key but
    // `list.pageSize` is not, changing the size reuses the cached page.
    const offenders = files
      .filter(({ source }) => source.includes('pageSizeOptions'))
      .filter(({ source }) => source.includes('queryKey:') && source.includes('list.page'))
      .filter(({ source }) => !source.includes('list.pageSize'))
      .map(({ file }) => file);
    expect(offenders, `查询键缺 list.pageSize：${offenders.join(', ')}`).toEqual([]);
  });
});

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Consistency contracts: the defects that compile, type-check, render, and are still wrong.
 *
 * Every check here exists because the migration hit the defect it prevents. Each one
 * was found in a browser after the fact, cost a round trip, and is mechanically
 * detectable without running anything.
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
      } else if (/\.(ts|tsx)$/.test(entry)) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

const appFiles = sourceFiles(join(root, 'apps/console-next/src'));
const read = (file: string): string => readFileSync(file, 'utf8');

/**
 * The two dictionaries, read as text.
 *
 * These contract tests read source rather than importing it (no bundler aliases here);
 * both quote styles have to be handled — an earlier scan that only understood single
 * quotes reported a perfectly good English entry as missing.
 */
function dictionaryBlocks(): { zh: Set<string>; en: Set<string> } {
  const text = read(join(root, 'packages/locales/src/index.ts'));
  const zhStart = text.indexOf('export const zh');
  const enStart = text.indexOf('export const en');
  const entries = (block: string): Set<string> =>
    new Set([...block.matchAll(/^ {2}'([a-zA-Z0-9_.]+)':/gm)].map((match) => match[1]!));
  return { zh: entries(text.slice(zhStart, enStart)), en: entries(text.slice(enStart)) };
}

describe('locale keys', () => {
  it('defines the same keys in every language', () => {
    // A key present in one dictionary and missing from the other renders the key
    // itself in that language — `clusterConfigMaps.title` shipped like that until a
    // page was opened in English.
    const { zh, en } = dictionaryBlocks();
    const missingInEn = [...zh].filter((key) => !en.has(key));
    const missingInZh = [...en].filter((key) => !zh.has(key));
    expect(missingInEn, 'zh → en').toEqual([]);
    expect(missingInZh, 'en → zh').toEqual([]);
  });

  it('every literal key a page asks for exists', () => {
    const keys = dictionaryBlocks().zh;
    const missing: string[] = [];
    for (const file of appFiles) {
      for (const match of read(file).matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
        if (!keys.has(match[1]!)) missing.push(`${relative(root, file)} -> ${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every literal key held in a *Key field exists', () => {
    /*
     * Keys also travel as data: `{ label: 'node.list.gpu' }`, `titleKey: 'cluster.monitor…'`,
     * `emptyKey`, `hintKey`. The render site then has to call `t(...)` on that field, so a typo
     * here is invisible to the check above and shows up as a raw key in an attribute label or a
     * column header — the exact "i18n went missing on this page" report.
     *
     * Only values that look like keys are checked (`a.b`), because these fields also hold plain
     * words ("HTTP", "Immediate", "Kube AI Hub").
     */
    const keys = dictionaryBlocks().zh;
    const namespaces = new Set([...keys].map((key) => key.split('.')[0]!));
    const missing: string[] = [];
    for (const file of appFiles) {
      const text = read(file);
      /*
       * `label` and `title` carry keys too (chart series, column descriptors), and they also hold
       * plain words ("HTTP", "Immediate"), so the check is limited to values whose namespace is
       * one the dictionary actually uses.
       */
      for (const match of text.matchAll(/\b(?:[a-zA-Z]*Key|label|title)\s*:\s*'([a-zA-Z0-9_.]+)'/g)) {
        const value = match[1]!;
        if (!value.includes('.')) continue;
        if (!namespaces.has(value.split('.')[0]!)) continue;
        if (!keys.has(value)) missing.push(`${relative(root, file)} -> ${value}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('api-client barrel', () => {
  it('re-exports every factory defined in a module', () => {
    // The barrel is maintained by hand. Adding `persistentVolumesApi` to storage.ts and
    // forgetting the re-export produced "has no exported member" and, on the retry, a
    // duplicate identifier — two round trips for a missing line.
    const srcDir = join(root, 'packages/api-client/src');
    const index = read(join(srcDir, 'index.ts'));
    const missing: string[] = [];
    for (const entry of readdirSync(srcDir)) {
      if (!entry.endsWith('.ts') || entry === 'index.ts') continue;
      const text = read(join(srcDir, entry));
      for (const match of text.matchAll(/export function ([a-zA-Z0-9]+Api)\b/g)) {
        if (!new RegExp(`\\b${match[1]}\\b`).test(index)) missing.push(`${entry}: ${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('one implementation per concept', () => {
  const duplicateDefinitions = (name: string): string[] =>
    appFiles
      .filter((file) => new RegExp(`^function ${name}\\(`, 'm').test(read(file)))
      .map((file) => relative(root, file));

  it('defines the detail label/value row once', () => {
    // Eight detail pages had their own copy and they had already drifted: some painted
    // the value in the primary text colour, others in the secondary one.
    expect(duplicateDefinitions('Row')).toEqual([]);
  });

  it('defines the status label mapping once', () => {
    // Two copies meant one page said 已绑定 and another said `Bound` for the same value.
    expect(duplicateDefinitions('storageStatusLabel')).toEqual([]);
    expect(duplicateDefinitions('statusLabel')).toEqual([]);
  });

  it('defines the surface error panel once', () => {
    // Three copies of the same error-message branch; a new page could easily pick the
    // one that treats a 403 as retryable.
    expect(duplicateDefinitions('ErrorPanel')).toEqual([]);
  });
});

describe('declared list capabilities are wired', () => {
  /**
   * A list schema declares what the page can do; the handler props are what make it true.
   *
   * Every case below shipped: sortable columns whose clicks did nothing, a search box
   * whose value never reached the query, pagination buttons with no target. The page
   * rendered, typed and clicked — and nothing happened.
   */
  const pageFiles = appFiles.filter((file) => file.includes('/pages/'));

  const cases = [
    { declared: 'sortableKeys', handler: 'onSortChange', what: '排序' },
    { declared: 'search', handler: 'onSearchChange', what: '搜索' },
    { declared: 'filters', handler: 'onFiltersChange', what: '筛选' },
    { declared: 'selection', handler: 'onSelectionChange', what: '多选' },
  ] as const;

  for (const probe of cases) {
    it(`wires ${probe.handler} wherever ${probe.declared} is declared (${probe.what})`, () => {
      const offenders: string[] = [];
      for (const file of pageFiles) {
        const text = read(file);
        if (!new RegExp(`^\\s+${probe.declared}:`, 'm').test(text)) continue;
        if (!text.includes(probe.handler)) offenders.push(relative(root, file));
      }
      expect(offenders).toEqual([]);
    });
  }

  it('wires onPageChange wherever the list has more than one page', () => {
    // A single-page schema sets `pageSize` from the row count (`Math.max(...)`); anything
    // else is a real pager, and a pager whose page never changes is a dead control.
    const offenders: string[] = [];
    for (const file of pageFiles) {
      const text = read(file);
      const pagination = text.match(/pagination:\s*\{([^}]*)\}/);
      if (!pagination) continue;
      if (pagination[1]!.includes('Math.max(')) continue;
      if (!text.includes('onPageChange')) offenders.push(relative(root, file));
    }
    expect(offenders).toEqual([]);
  });
});

describe('page files', () => {
  it('do not hand-roll a delete confirmation', () => {
    // The shared dialog owns the typed-name friction and, after this migration, the
    // wording for non-delete actions. A bespoke confirm is how `删除停止` happened.
    const offenders = appFiles
      .filter((file) => /confirm\(/.test(read(file)) && /pages\//.test(file))
      .map((file) => relative(root, file));
    expect(offenders).toEqual([]);
  });
});

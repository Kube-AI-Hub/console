import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Resource page conventions.
 *
 * The AI-surface test next door checks the machine-readable contract; this one
 * checks the mistakes that compile, type-check and pass review but still break a
 * page:
 *
 * 1. `actionProps()` spread *after* a business handler. The spread carries only
 *    `data-*` attributes, but props are merged left to right, so anything after
 *    it wins — a handler written after it is fine, one written before is
 *    silently replaced. This happened for real in this migration: the role
 *    picker stopped responding. (The migration guide lists it; nothing enforced
 *    it until now.)
 * 2. Imports from the AGPL-3.0 console (`console/src` or its libraries).
 * 3. `Intl`-based timestamps: the old console printed `YYYY-MM-DD HH:mm:ss`
 *    everywhere, and a second formatting helper is how the two drift apart.
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
      } else if (/\.(ts|tsx)$/.test(entry)) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

const APP_SOURCES = sourceFiles(join(root, 'apps/console-next/src'));
const PACKAGE_SOURCES = ['packages/ui', 'packages/api-client', 'packages/ai-surface', 'packages/locales'].flatMap((pkg) =>
  sourceFiles(join(root, pkg, 'src')),
);

/**
 * Find spreads of `actionProps` that would overwrite a handler.
 *
 * `{...props}` is merged left to right, so attributes written **after** the
 * spread win. `actionProps` only carries `data-*`, so writing handlers after it
 * is correct and writing them before it silently replaces them with nothing.
 * The check therefore looks backwards from each spread, to the start of its JSX
 * tag, for handler attributes — those are the ones at risk.
 */
function spreadsAfterHandlers(text: string): string[] {
  const problems: string[] = [];
  const pattern = /\{\.\.\.actionProps\(([^)]*)\)\}/g;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    const tagStart = Math.max(text.lastIndexOf('<', index), text.lastIndexOf('{', index - 1));
    const before = text.slice(Math.max(tagStart, 0), index);
    const handlers = before
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^(on[A-Z]\w*|href|to|checked|valueEditable)=/.test(line));
    if (handlers.length) problems.push(`${match[1]} preceded by ${handlers.join(', ')}`);
  }
  return problems;
}

describe('actionProps ordering', () => {
  for (const file of APP_SOURCES.filter((file) => !file.endsWith('.test.tsx'))) {
    it(`${relative(root, file)} does not let actionProps overwrite a handler`, () => {
      const problems = spreadsAfterHandlers(readFileSync(file, 'utf8'));
      // A handler written *before* `{...actionProps(...)}` is replaced by the
      // spread's absence of it, so the control stops responding.
      expect(problems).toEqual([]);
    });
  }
});

describe('license boundary', () => {
  const FORBIDDEN = [/from ['"][^'"]*console\/src['"]/, /from ['"]js-base64['"]/, /require\(['"]js-base64['"]\)/];

  for (const file of [...APP_SOURCES, ...PACKAGE_SOURCES]) {
    it(`${relative(root, file)} imports nothing AGPL`, () => {
      const text = readFileSync(file, 'utf8');
      const hits = FORBIDDEN.filter((pattern) => pattern.test(text)).map(String);
      expect(hits).toEqual([]);
    });
  }

  it('does not depend on js-base64 in any manifest', () => {
    for (const pkg of ['apps/console-next', 'packages/api-client', 'packages/ui', 'packages/ai-surface', 'packages/locales']) {
      const manifest = JSON.parse(readFileSync(join(root, pkg, 'package.json'), 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const all = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) };
      expect(Object.keys(all)).not.toContain('js-base64');
    }
  });
});

describe('timestamp formatting', () => {
  it('has exactly one formatter and it is not locale-dependent', () => {
    // A call, not the word: both formatters *mention* it in a comment explaining
    // why they avoid it.
    const withIntl = APP_SOURCES.filter((file) => /new Intl\.DateTimeFormat|Intl\.DateTimeFormat\(/.test(readFileSync(file, 'utf8')));
    expect(withIntl.map((file) => relative(root, file))).toEqual([]);
  });

  it('every resource page imports the shared formatter instead of formatting inline', () => {
    const pages = APP_SOURCES.filter((file) => /pages[\\/](secrets|serviceaccounts)[\\/].*Page\.tsx$/.test(file));
    expect(pages.length).toBeGreaterThanOrEqual(2);
    for (const file of pages) {
      const text = readFileSync(file, 'utf8');
      expect(text).toContain("from '@/lib/time'");
    }
  });
});

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The shared packages' permanent contract.
 *
 * `@kube-ai-hub/ui` claims to be a presentation layer. That claim is only worth
 * something if it is checked, because the cheapest way to fix a UI problem is to
 * fetch something or read a global, and the cost of that shortcut lands months
 * later when the component cannot be reused or tested. These tests scan source
 * text and fail on the import — the same rule bisheng's `dependencyContracts`
 * enforces, applied to this workspace.
 *
 * The rules are listed as data so a new one is a new entry, not a new test file.
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
      } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

interface ForbiddenImport {
  readonly packagePrefix: string;
  readonly reason: string;
}

const UI_FORBIDDEN_STATE: readonly ForbiddenImport[] = [
  { packagePrefix: 'zustand', reason: 'state belongs to the app; pass props instead' },
  { packagePrefix: 'jotai', reason: 'state belongs to the app; pass props instead' },
  { packagePrefix: 'recoil', reason: 'state belongs to the app; pass props instead' },
  { packagePrefix: 'mobx', reason: 'state belongs to the app; pass props instead' },
  { packagePrefix: '@tanstack/react-query', reason: 'no requests: data comes in via props' },
  { packagePrefix: '@kube-ai-hub/api-client', reason: 'no requests: the UI package must not know the BFF' },
  { packagePrefix: '@kube-ai-hub/locales', reason: 'no i18n: every string arrives as a prop' },
  { packagePrefix: '@tanstack/react-router', reason: 'no routing: navigation is a callback' },
  { packagePrefix: 'react-router', reason: 'no routing: navigation is a callback' },
];

describe('@kube-ai-hub/ui contract', () => {
  const files = sourceFiles(join(root, 'packages/ui/src'));

  it('has source to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const rule of UI_FORBIDDEN_STATE) {
    it(`does not import ${rule.packagePrefix} (${rule.reason})`, () => {
      const offenders = files.filter((file) => {
        const text = readFileSync(file, 'utf8');
        // Matches the package name at an import boundary, so `react-router-dom`
        // is not confused with `react-router` when the rule targets one of them.
        const pattern = new RegExp(`from ['"]${escapeRegExp(rule.packagePrefix)}(/|['"])`);
        return pattern.test(text);
      });
      expect(offenders.map((file) => relative(root, file))).toEqual([]);
    });
  }
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

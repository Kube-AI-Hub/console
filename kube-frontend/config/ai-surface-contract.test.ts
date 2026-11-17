import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * AI-surface conventions.
 *
 * The claim "an agent can drive this UI" rests on two things being true of every
 * page: it announces a machine-readable state, and its controls carry stable
 * ids. Both are easy to drop in review — a page that renders is not a page an
 * agent can use. These tests read the page source and fail on the omission.
 */

const root = new URL('..', import.meta.url).pathname;
const pagesDir = join(root, 'apps/console-next/src/pages');

function pageFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/Page\.tsx$/.test(entry)) out.push(full);
    }
  };
  walk(pagesDir);
  return out;
}

/**
 * Pages whose failure UI lives in a component they render.
 *
 * The retry assertion below reads one file. A page that delegates its error state to a child
 * (the child owns the retry button) would fail it while the reader still has a way out. Each
 * entry names the file that *does* carry the retry, so the exemption is checkable rather than
 * a blanket skip.
 */
const DELEGATED_RETRY: Record<string, string> = {
  'apps/console-next/src/pages/cluster/KubectlPage.tsx':
    'the error panel and its kubectl:retry button live in components/resource/KubectlConsoleDialog.tsx',
};

describe('page AI surface', () => {
  const files = pageFiles();

  it('finds at least one page', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const relativePath = relative(root, file);
    const text = readFileSync(file, 'utf8');

    it(`${relativePath} declares a surface state`, () => {
      // `AiSurface` sets `data-ai-state`; using it is how a page tells the agent
      // whether it is loading, ready, empty or failed.
      expect(text).toContain('<AiSurface');
      expect(text).toMatch(/state=\{/);
    });

    it(`${relativePath} gives every action a stable id`, () => {
      // Raw <button> elements bypass the aiId convention and leave the agent with
      // nothing to target but the label.
      const rawButtons = text.match(/<button\b/g) ?? [];
      expect(rawButtons.length, `${relativePath} uses raw <button> elements; wrap them or add actionProps`).toBe(0);
      expect(text).toMatch(/data-ai-id|actionProps\(/);
    });

    it(`${relativePath} exposes a retry path on failure`, () => {
      // A failed page an agent cannot recover from is a dead end for automation.
      if (text.includes("'error'") && !(relativePath in DELEGATED_RETRY)) {
        expect(text).toMatch(/retry|refetch/i);
      }
    });
  }
});

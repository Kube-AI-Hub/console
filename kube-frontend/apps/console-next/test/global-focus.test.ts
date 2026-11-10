import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The app must not declare a global focus outline.
 *
 * `styles.css` is appended after Tailwind's utilities, so any `:focus-visible`
 * rule written there outranks every component's own `focus-visible:outline-none`
 * regardless of specificity — `:where()` was tried and lost too. With such a rule
 * in place every ai-kit control drew its ring *and* an outline 2px outside it,
 * which reads as a thick double border.
 *
 * The rule was removed and each control now owns its indicator. This test fails if
 * one is reintroduced, because the symptom is purely visual: nothing breaks, so
 * only a test catches it.
 */

const css = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');

/** Strip comments so an explanatory mention of `:focus-visible` does not match. */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('global focus styles', () => {
  it('declares no focus-visible rule', () => {
    expect(rules).not.toMatch(/:focus-visible\s*\{/);
    expect(rules).not.toMatch(/:focus-visible[^,{]*\{[^}]*outline\s*:/);
  });

  it('declares no outline on any selector', () => {
    // The specific regression: `outline: 2px solid …` in this file lands on top
    // of a component ring. Components write their own, so this file needs none.
    expect(rules).not.toMatch(/(^|\})\s*[^@{}]+\{[^}]*\boutline\s*:/);
  });
});

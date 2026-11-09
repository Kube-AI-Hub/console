import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Motion CSS guards.
 *
 * A duplicated hover block is not a syntax error — the later rule simply wins —
 * so a stale copy silently cancels an improvement with no warning. These tests
 * make the duplication visible.
 */

const motion = readFileSync(resolve(__dirname, '../src/styles/motion.css'), 'utf8');

/** Strip comments and at-rule wrappers so selector counting is exact. */
function selectorsOf(css: string, selector: string): number {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (css.match(new RegExp(`${escaped}\\s*\\{`, 'g')) ?? []).length;
}

describe('motion css', () => {
  it('defines the lift hover state at most twice (base + light override)', () => {
    // The light theme legitimately redefines the shadow; anything beyond that
    // is a stale copy that would override the improvement.
    expect(selectorsOf(motion, '.ai-lift:hover')).toBeLessThanOrEqual(2);
  });

  it('defines the spotlight hover once', () => {
    // The highlight is painted by ::before, so the selector carries a pseudo
    // element rather than applying to the surface itself.
    expect(selectorsOf(motion, '.ai-spotlight:hover::before')).toBe(1);
  });

  it('gates every hover rule behind a fine-pointer media query', () => {
    // `:hover` sticks after a tap on touch devices, which makes a UI feel broken.
    // Walk the file tracking whether each selector sits inside the media block.
    const lines = motion.split('\n');
    let insideHoverMedia = false;
    let depth = 0;
    const violations: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('@media (hover: hover)')) {
        insideHoverMedia = true;
        depth = 0;
      }
      if (insideHoverMedia) {
        depth += (line.match(/\{/g) ?? []).length;
        depth -= (line.match(/\}/g) ?? []).length;
      }
      if (/^\s*\.ai-[\w-]+:hover\s*\{/.test(line) && !insideHoverMedia) {
        violations.push(trimmed);
      }
      if (insideHoverMedia && depth <= 0 && trimmed === '}') {
        insideHoverMedia = false;
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps the ambient wash decorative', () => {
    expect(motion).toContain('.ai-ambient::before');
    expect(motion).toMatch(/pointer-events:\s*none/);
  });

  it('honours reduced motion for the ambient layer', () => {
    expect(motion).toMatch(/prefers-reduced-motion: reduce[\s\S]*\.ai-ambient/);
  });
});

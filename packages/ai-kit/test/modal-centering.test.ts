import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards the modal's centring contract.
 *
 * The bug these assert against: the modal was centred with `-translate-x-1/2
 * -translate-y-1/2` while animating `transform`. Tailwind 3 puts those
 * translate utilities on `transform` too, so the scale keyframes erase the
 * offset and the dialog sits down-right of centre.
 *
 * A DOM assertion cannot catch this without running a real animation timeline,
 * so these read the source of truth: the preset's keyframes and the classes the
 * modal actually applies.
 */

const ROOT = path.resolve(__dirname, '..');

function read(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

describe('Modal centring', () => {
  it('does not move the element in the keyframes', () => {
    const preset = read('src/tailwind.preset.ts');
    const keyframes = preset.slice(preset.indexOf("'ai-pop-in': {"), preset.indexOf("'ai-sheet-in'"));

    expect(keyframes).toBeTruthy();
    /*
     * Placement is `margin: auto`, so the keyframes must not introduce a
     * translate of their own. Only scale and opacity belong here.
     */
    expect(keyframes).not.toContain('translate');
    expect(keyframes).toContain('scale');
  });

  it('keeps the final frame applied, as the sheet animation does', () => {
    const preset = read('src/tailwind.preset.ts');
    const line = preset.split('\n').find((row) => row.includes("'ai-pop-in': 'ai-pop-in")) ?? '';

    // Without `both`, the end frame is dropped the moment the animation finishes.
    expect(line).toMatch(/\bboth\b/);
  });

  it('does not use an animation that ends at transform:none', () => {
    const feedback = read('src/primitives/Feedback.tsx');
    const modal = feedback.slice(feedback.indexOf('export function Modal'), feedback.indexOf('/* ---------------- Drawer'));

    expect(modal).toContain('animate-ai-pop-in');
    expect(modal).not.toContain('animate-ai-scale-in');
  });

  it('centres with the CSS translate property, not a transform offset', () => {
    const feedback = read('src/primitives/Feedback.tsx');
    const modal = feedback.slice(feedback.indexOf('export function Modal'), feedback.indexOf('/* ---------------- Drawer'));

    // `left: 50%; top: 50%` plus the CSS `translate` property. Tailwind's
    // `-translate-x-1/2` writes `transform`, which `ai-pop-in` also animates.
    expect(modal).toContain("'fixed left-1/2 top-1/2");
    expect(modal).toContain("'[translate:-50%_-50%]'");
    expect(modal).not.toMatch(/-translate-x-1\/2/);
    expect(modal).not.toMatch(/-translate-y-1\/2/);
  });

  it('registers the animation so the utility class exists', () => {
    const preset = read('src/tailwind.preset.ts');
    expect(preset).toMatch(/'ai-pop-in': 'ai-pop-in [^']*\bboth'/);
  });
});

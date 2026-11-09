import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards the modal's centring contract.
 *
 * The bug these assert against: the modal was centred with `-translate-x-1/2
 * -translate-y-1/2` while animating with `ai-scale-in`, whose keyframes animate
 * `transform` down to `none`. The animation won, the centring translate was
 * erased, and the dialog sat half its width/height down-right of centre before
 * snapping into place when the animation ended.
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
  it('animates with a keyframe set that keeps the centring translate', () => {
    const preset = read('src/tailwind.preset.ts');
    const keyframes = preset.slice(preset.indexOf("'ai-pop-in'"), preset.indexOf("'ai-slide-up'"));

    expect(keyframes).toBeTruthy();
    // The whole point: the translate must be present in both endpoints.
    expect(keyframes).toContain('translate(-50%, -50%)');
  });

  it('does not use an animation that ends at transform:none', () => {
    const feedback = read('src/primitives/Feedback.tsx');
    const modal = feedback.slice(feedback.indexOf('export function Modal'), feedback.indexOf('/* ---------------- Drawer'));

    expect(modal).toContain('animate-ai-pop-in');
    expect(modal).not.toContain('animate-ai-scale-in');
  });

  it('keeps a static centring fallback for when the animation does not run', () => {
    const feedback = read('src/primitives/Feedback.tsx');
    const modal = feedback.slice(feedback.indexOf('export function Modal'), feedback.indexOf('/* ---------------- Drawer'));

    expect(modal).toContain('-translate-x-1/2');
    expect(modal).toContain('-translate-y-1/2');
  });

  it('registers the animation so the utility class exists', () => {
    const preset = read('src/tailwind.preset.ts');
    expect(preset).toContain("'ai-pop-in': 'ai-pop-in var(--ai-duration-base) var(--ai-ease-out)'");
  });
});

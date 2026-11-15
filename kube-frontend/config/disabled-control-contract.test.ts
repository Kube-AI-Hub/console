import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Disabled controls must read as inert, not as a faded copy of the enabled state.
 *
 * The defect this prevents: a filled danger button at `disabled:opacity-50` is white text on a
 * washed-out red — measured `#ab2f29` at 50% over the light page, about 2:1 contrast — while
 * still looking clickable. The fix is a neutral surface plus muted text with no opacity change,
 * and it has to stay on the shared base class so every variant inherits it.
 */
// ai-kit lives beside `kube-frontend/`, not inside it — the apps consume it as a workspace package.
const button = readFileSync(new URL('../../packages/ai-kit/src/primitives/Button.tsx', import.meta.url).pathname, 'utf8');

describe('disabled button styling', () => {
  it('never fades a filled button with opacity', () => {
    expect(button).not.toContain('disabled:opacity-50');
  });

  it('gives disabled buttons a neutral surface and muted text', () => {
    expect(button).toContain('disabled:bg-ai-surface-2');
    expect(button).toContain('disabled:text-ai-fg-muted');
    expect(button).toContain('disabled:shadow-none');
  });

  it('keeps pointer events off and drops the border emphasis', () => {
    expect(button).toContain('disabled:pointer-events-none');
    expect(button).toContain('disabled:border-ai-line');
  });
});

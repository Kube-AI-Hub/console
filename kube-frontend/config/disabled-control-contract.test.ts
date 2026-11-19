import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Disabled controls must read as inert, not as a faded copy of the enabled state.
 *
 * Two defects are pinned here.
 *
 * 1. A filled danger button at `disabled:opacity-50` is white text on a washed-out red —
 *    measured `#ab2f29` at 50% over the light page, about 2:1 contrast — while still
 *    looking clickable. The fix is a neutral surface plus muted text with no opacity
 *    change, and it has to stay on the shared base class so every variant inherits it.
 *
 * 2. The neutral surface must not be `--ai-surface-2`: that is the *enabled* secondary
 *    button's own fill, so the two states rendered identically apart from the label.
 *    On the light themes that fill is only 1.14:1 against the page, which made neither
 *    state read as a button. `--ai-surface-disabled` sits on the far side of the page
 *    colour from the enabled fill in every theme.
 *
 * The inert look is applied from `Button`, not from `disabled:` utilities, because
 * `loading` also sets the `disabled` attribute and a submitting button must keep its
 * variant fill — the reader needs to know which action is running.
 */
// ai-kit lives beside `kube-frontend/`, not inside it — the apps consume it as a workspace package.
const button = readFileSync(new URL('../../packages/ai-kit/src/primitives/Button.tsx', import.meta.url).pathname, 'utf8');
const tokens = readFileSync(new URL('../../packages/ai-kit/src/styles/tokens.css', import.meta.url).pathname, 'utf8');

describe('disabled button styling', () => {
  it('never fades a filled button with opacity', () => {
    expect(button).not.toContain('disabled:opacity-50');
  });

  it('uses a dedicated recessed surface, not the enabled secondary fill', () => {
    expect(button).toContain('bg-ai-surface-disabled');
    // The old rule that made the two states indistinguishable.
    expect(button).not.toContain('disabled:bg-ai-surface-2');
  });

  it('marks the state structurally, with a broken outline', () => {
    // Colour alone cannot separate the states at the ratios these palettes allow
    // (best case 1.68:1 dark, 1.18:1 light), so the outline carries it.
    expect(button).toContain('border-dashed');
    expect(button).toContain('text-ai-fg-faint');
    expect(button).toContain('shadow-none');
  });

  it('keeps pointer events off', () => {
    expect(button).toContain('disabled:pointer-events-none');
  });

  it('defines the disabled surface once per theme', () => {
    // A token that only exists in the dark block silently falls back to nothing in the
    // light themes, which is how the two states drifted apart in the first place.
    const definitions = tokens.match(/--ai-surface-disabled:/g) ?? [];
    expect(definitions.length).toBeGreaterThanOrEqual(5);
  });
});

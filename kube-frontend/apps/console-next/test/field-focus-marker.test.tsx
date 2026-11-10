import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Input, Textarea } from '@kube-ai-hub/ui';

/**
 * ai-kit fields must be marked as owning their focus indicator.
 *
 * The app keeps a global `:focus-visible { outline: 2px solid … }` fallback for
 * plain HTML. That rule lives in `styles.css`, which is appended after Tailwind's
 * utilities, so it outranks a component's own `focus-visible:outline-none` no
 * matter how the utility is written — the only reliable fix is for the fallback
 * to skip these elements, which it does by `[data-ai-field-input]`.
 *
 * A field rendered without the marker therefore gets a second frame 2px outside
 * its ring. That is a visual bug with no failing behaviour, so it needs a test
 * that reads the attribute rather than one that waits for something to break.
 */

describe('ai-kit field focus marker', () => {
  it('marks a bare input', () => {
    const { container } = render(<Input aria-label="plain" />);
    expect(container.querySelector('input')?.hasAttribute('data-ai-field-input')).toBe(true);
  });

  it('marks the input inside a wrapper', () => {
    // `leading`/`trailing` switch `Input` to a wrapper that draws the ring; the
    // inner input is the element the host's outline rule would have matched.
    const { container } = render(<Input aria-label="wrapped" leading={<span>@</span>} />);
    expect(container.querySelector('[data-ai-field]')).toBeTruthy();
    expect(container.querySelector('input')?.hasAttribute('data-ai-field-input')).toBe(true);
  });

  it('marks a textarea', () => {
    const { container } = render(<Textarea aria-label="text" />);
    expect(container.querySelector('textarea')?.hasAttribute('data-ai-field-input')).toBe(true);
  });
});

import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormField, Input, Modal } from '@kube-ai-hub/ui';

/**
 * A dialog must reveal an error it renders below the fold.
 *
 * This is the wiring half of `observeHiddenErrors` (its own tests live in ai-kit): the
 * observer is framework-free and tested there, but rendering `Modal` needs one React
 * graph, and ai-kit keeps a second install for Storybook. Here the app's single React
 * renders the real dialog.
 *
 * What is asserted is the decision — did the dialog ask to scroll the alert? — because
 * jsdom has no layout. The resulting offset was measured in a real browser: 443px of
 * scroll on 添加集群 with only the name filled in.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Modal reveals a hidden error', () => {
  it('scrolls the alert that a failed submit rendered off-screen', async () => {
    const scrolled: Element[] = [];
    /*
     * `HTMLElement.prototype`, not `Element.prototype`: the test setup defines a no-op
     * `scrollIntoView` on `HTMLElement`, and a stub on the parent prototype is shadowed
     * by it — the spy would never be called and the test would look like a product bug.
     */
    HTMLElement.prototype.scrollIntoView = vi.fn(function (this: HTMLElement) {
      scrolled.push(this);
    }) as unknown as typeof HTMLElement.prototype.scrollIntoView;

    /*
     * jsdom reports every rect as zero, so "off-screen" has to be simulated. It has to
     * be in place *before* the error renders: the observer measures on the frame after
     * the mutation, and a stub installed later would never be consulted.
     */
    const originalRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.getAttribute('role') === 'alert') {
        return { top: 900, bottom: 920, left: 0, right: 100, width: 100, height: 20, x: 0, y: 900, toJSON: () => ({}) } as DOMRect;
      }
      return originalRect.call(this);
    };

    function Harness(): React.ReactElement {
      const [error, setError] = React.useState<string | null>(null);
      return (
        <Modal
          open
          onOpenChange={() => undefined}
          title="编辑"
          footer={
            <button type="button" onClick={() => setError('不能为空')}>
              提交
            </button>
          }
        >
          <FormField htmlFor="field-name" label="名称" {...(error ? { error } : {})}>
            <Input id="field-name" defaultValue="" />
          </FormField>
        </Modal>
      );
    }

    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: '提交' }));

    await waitFor(() => expect(scrolled.length).toBeGreaterThan(0));
    /*
     * The target is the error's field wrapper or the alert paragraph — both are valid
     * and both are what the reader needs on screen. Asserting the exact tag would fail
     * on the `[data-invalid]` branch, which is the same behaviour by a different route.
     */
    const target = scrolled[0]!;
    const isErrorTarget = target.getAttribute('role') === 'alert' || target.getAttribute('data-invalid') === 'true';
    expect(isErrorTarget).toBe(true);
    Element.prototype.getBoundingClientRect = originalRect;
  });
});

import { describe, expect, it, vi, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { observeHiddenErrors } from '../src/utils/observeHiddenErrors';

/**
 * An error rendered below the fold must reveal itself.
 *
 * The defect: a dialog body scrolls (`max-h-[70vh]`), a form is taller than that, and a
 * rejected submit renders its message outside the visible area — so the button reads as
 * a no-op. Measured on 添加集群 (2026-11-17): the kubeconfig error sat 443px below the
 * visible region.
 *
 * `Modal` now observes its body for `role="alert"` / `data-invalid` and scrolls the
 * first hidden one into view, which covers every dialog at once instead of one change
 * per dialog. jsdom has no layout, so the tests assert the decision (did it ask to
 * scroll?) rather than the resulting offset; the offset itself was verified in a real
 * browser.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

/** jsdom reports zero rects; this makes an element claim a position. */
function placeAt(element: Element, top: number, height = 20): void {
  element.getBoundingClientRect = () =>
    ({ top, bottom: top + height, left: 0, right: 100, width: 100, height, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
}

describe('observeHiddenErrors', () => {
  it('scrolls an alert that is out of view', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this);
    }) as unknown as typeof Element.prototype.scrollIntoView;

    const dispose = observeHiddenErrors(container);
    const alert = document.createElement('p');
    alert.setAttribute('role', 'alert');
    alert.textContent = '名称只能包含小写字母';
    placeAt(alert, 900); // below a 768px-tall window
    container.appendChild(alert);

    await waitFor(() => expect(scrolled).toContain(alert));
    dispose();
    container.remove();
  });

  it('leaves an alert that is already on screen alone', async () => {
    // Scrolling a visible message would move the field the reader is looking at.
    const container = document.createElement('div');
    document.body.appendChild(container);
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this);
    }) as unknown as typeof Element.prototype.scrollIntoView;

    const dispose = observeHiddenErrors(container);
    const alert = document.createElement('p');
    alert.setAttribute('role', 'alert');
    alert.textContent = '已经有同名集群了';
    placeAt(alert, 100);
    container.appendChild(alert);

    // A frame plus a tick: the observer is scheduled, then decides not to act.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(scrolled).toHaveLength(0);
    dispose();
    container.remove();
  });

  it('ignores an empty alert placeholder', async () => {
    // Some dialogs always render the paragraph and fill it in later; scrolling to the
    // empty box would jump the form for no reason.
    const container = document.createElement('div');
    document.body.appendChild(container);
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this);
    }) as unknown as typeof Element.prototype.scrollIntoView;

    const dispose = observeHiddenErrors(container);
    const alert = document.createElement('p');
    alert.setAttribute('role', 'alert');
    alert.textContent = '';
    placeAt(alert, 900);
    container.appendChild(alert);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(scrolled).toHaveLength(0);
    dispose();
    container.remove();
  });

  it('reveals only the first of several errors in one commit', async () => {
    // A submit that fails three fields renders three messages at once; scrolling to each
    // in turn would leave the reader at the bottom one.
    const container = document.createElement('div');
    document.body.appendChild(container);
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this);
    }) as unknown as typeof Element.prototype.scrollIntoView;

    const dispose = observeHiddenErrors(container);
    for (const [index, text] of ['第一个', '第二个', '第三个'].entries()) {
      const alert = document.createElement('p');
      alert.setAttribute('role', 'alert');
      alert.textContent = text;
      placeAt(alert, 900 + index * 40);
      container.appendChild(alert);
    }

    await waitFor(() => expect(scrolled.length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(scrolled).toHaveLength(1);
    dispose();
    container.remove();
  });

  it('does not throw when the container is null', () => {
    expect(() => observeHiddenErrors(null)()).not.toThrow();
  });
});

describe('Modal error reveal', () => {
  it('leaves the wiring to the app suite, which has one React', () => {
    /*
     * The Modal half lives in `apps/console-next/test/modal-error-reveal.test.tsx`.
     *
     * ai-kit keeps its own React 18 install for Storybook; rendering `Modal` here loads
     * that second copy and every hook inside it throws "Invalid hook call". The
     * observer itself is framework-free, so it is tested above where it can be; the
     * wiring is asserted in the app, whose single React graph renders the real dialog.
     */
    expect(typeof observeHiddenErrors).toBe('function');
  });
});

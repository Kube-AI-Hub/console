import '@testing-library/jest-dom/vitest';

/**
 * jsdom gaps that Radix popper-based components depend on.
 *
 * Radix measures the anchor and content with `ResizeObserver` and uses
 * `PointerEvent` for interactions. Without them a popover never reaches its
 * "open" state in tests, which makes a component look broken when it is only
 * running in an incomplete DOM.
 */

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: ResizeObserverStub,
  });
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

/**
 * jsdom has no layout engine, so every `getBoundingClientRect` returns zeros.
 * Radix's popper uses that to decide visibility and skips rendering content it
 * believes has no size. Reporting a plausible box keeps the components
 * exercisable in tests.
 */
if (typeof Element !== 'undefined') {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect(this: Element): DOMRect {
    return {
      x: 0,
      y: 0,
      width: 200,
      height: 32,
      top: 0,
      left: 0,
      right: 200,
      bottom: 32,
      toJSON: () => ({}),
    } as DOMRect;
  };
}

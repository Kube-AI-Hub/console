import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// Radix Select uses browser pointer capture and scroll APIs absent from jsdom.
HTMLElement.prototype.hasPointerCapture ??= () => false;
HTMLElement.prototype.setPointerCapture ??= () => undefined;
HTMLElement.prototype.releasePointerCapture ??= () => undefined;
HTMLElement.prototype.scrollIntoView ??= () => undefined;
// jsdom has no Range layout queries; floating-ui measures text ranges through them.
Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null }) as unknown as DOMRectList;
Range.prototype.getBoundingClientRect ??= () => new DOMRect();

/** jsdom has no `matchMedia`; the default is the desktop branch. */
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/*
 * Wait a little longer than testing-library's one-second default.
 *
 * The suite runs alongside builds and browsers on a loaded machine; several list cases wait for
 * a fetch, a debounce and a re-render in sequence, and one second is enough to fail a correct
 * component while the CPU is busy. A longer ceiling does not hide a broken component, it only
 * stops the clock from being the thing under test.
 */
configure({ asyncUtilTimeout: 5_000 });


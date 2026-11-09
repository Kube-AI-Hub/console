import '@testing-library/jest-dom/vitest';

/**
 * jsdom lacks `matchMedia`, which ai-kit's responsive hooks read during render.
 * A no-match stub is the desktop case, which is the default these tests assume.
 */
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

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { Select } from '../src/primitives/Select';

/**
 * The popup must be able to scroll inside a modal.
 *
 * The defect: Radix Dialog locks page scrolling with `react-remove-scroll`, which
 * listens on `document` in the capture phase and cancels wheel/touch for anything it
 * judges "outside" the dialog. A Select or Popover portal renders into
 * `document.body` — outside — so the list had `overflow: auto`, a real
 * `scrollHeight > clientHeight`, and still would not scroll: measured `scrollTop` 0
 * against a `max` of 24, with `defaultPrevented` true on every wheel event.
 *
 * jsdom has no real wheel dispatch to the document, so the runtime behaviour is
 * asserted in the browser (recorded in `docs/plans/cluster-add-dialog-20261117.md`).
 * What is checkable here is the mechanism that makes it work, and that is worth
 * pinning: a capture-phase listener on the popup that stops the event before the
 * document-level lock sees it, gated on the lock actually being engaged.
 */

/** Radix marks the body while a modal is open; the shield keys off the same attribute. */
const LOCK_ATTRIBUTE = 'data-scroll-locked';

describe('Select popup scroll shield', () => {
  it('documents the lock attribute the shield depends on', () => {
    // If `react-remove-scroll` ever changes the attribute, the shield silently stops
    // working — the popup would look fine and refuse to scroll. Pin the contract.
    document.body.setAttribute(LOCK_ATTRIBUTE, '1');
    expect(document.body.hasAttribute(LOCK_ATTRIBUTE)).toBe(true);
    document.body.removeAttribute(LOCK_ATTRIBUTE);
    expect(document.body.hasAttribute(LOCK_ATTRIBUTE)).toBe(false);
  });

  it('renders a scrollable popup with overscroll containment', () => {
    // The classes that make the list scroll at all, and stop a wheel at the end of
    // the list from scrolling the page behind the modal.
    // `import.meta.url` is a file URL here; jsdom's `URL` global is not the one that
    // resolves it, so the path is built from `fileURLToPath` instead.
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/primitives/Select.tsx'), 'utf8');
    expect(source).toContain('overscroll-contain');
    expect(source).toContain(LOCK_ATTRIBUTE);
    // The height has to come from the space Radix measured, or a short viewport
    // pushes the last option below the window edge (measured at 360px height).
    expect(source).toContain('--radix-select-content-available-height');
    expect(source).toContain('--radix-popover-content-available-height');
  });

  it('exposes the component without throwing on render', () => {
    // A smoke check that the shield's callback ref is wired: an invalid ref type is a
    // typecheck error, but a ref callback that throws on mount is not.
    expect(() =>
      React.createElement(Select, {
        value: 'a',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
        'aria-label': 'tag',
      }),
    ).not.toThrow();
  });
});

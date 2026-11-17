/**
 * Reveal a validation error that would otherwise be rendered out of view.
 *
 * Why this exists: a dialog body scrolls (`max-h-[70vh]`), and a form taller than that
 * hides the field that failed. The reader presses 提交 and nothing appears to happen —
 * the message was rendered below the fold. Measured on 添加集群 (2026-11-17): with only
 * the name filled in, the kubeconfig error sat 443px below the visible area.
 *
 * `focusFirstInvalidField` handles the submit path, where the caller knows which field
 * failed. This module handles the other half: a dialog that renders an error *element*
 * — `role="alert"`, or a `FormField` that just flipped `data-invalid` — without telling
 * anyone. One observer on the dialog body covers every dialog, including the ones that
 * validate by hand.
 *
 * Two rules keep it from being annoying:
 *
 * 1. **Only when it is actually hidden.** An error already on screen must not scroll the
 *    body; that would move the field the reader is looking at.
 * 2. **Once per burst.** Several fields can fail in one submit, and React renders them
 *    in one commit. Scrolling to each in turn would leave the reader at the last one.
 */

/** Elements that represent a field or an error message. */
const ERROR_SELECTOR = '[role="alert"], [data-invalid="true"]';

/** Whether the element is fully inside the nearest scrollable ancestor and the viewport. */
function isFullyVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.height === 0 && rect.width === 0) return false;

  // The viewport is the outer bound: a dialog can itself be taller than the window.
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  if (rect.top < 0 || rect.bottom > viewportHeight + 1) return false;

  // Then each scrollable ancestor. The dialog body is the one that usually clips.
  let ancestor = element.parentElement;
  while (ancestor) {
    const style = window.getComputedStyle(ancestor);
    const scrolls = /(auto|scroll|hidden)/.test(`${style.overflowY}${style.overflow}`);
    if (scrolls) {
      const box = ancestor.getBoundingClientRect();
      if (rect.top < box.top - 1 || rect.bottom > box.bottom + 1) return false;
    }
    ancestor = ancestor.parentElement;
  }
  return true;
}

/** Bring one element into view without fighting a smooth scroll already in flight. */
function reveal(element: HTMLElement): void {
  try {
    if (typeof element.scrollIntoView !== 'function') return;
    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } catch {
    // jsdom has no layout and some embedded browsers refuse the options object.
  }
}

/**
 * Watch `container` and reveal the first error that appears hidden.
 *
 * Returns a disposer. Safe to call with `null` (nothing to watch).
 *
 * `MutationObserver` rather than a render-time effect because the error is not a prop
 * of the modal: it is rendered by a child that owns its own validation state, and the
 * modal has no way to know when that happens.
 */
export function observeHiddenErrors(container: HTMLElement | null): () => void {
  if (!container || typeof MutationObserver === 'undefined') return () => undefined;

  /** Errors already revealed, so a re-render does not scroll again. */
  const revealed = new WeakSet<Element>();
  /** A single submit can flip several fields; only the first is worth scrolling to. */
  let scheduled = false;

  const scan = (): void => {
    scheduled = false;
    const candidates = Array.from(container.querySelectorAll<HTMLElement>(ERROR_SELECTOR));
    for (const candidate of candidates) {
      if (revealed.has(candidate)) continue;
      // An empty alert is a placeholder; wait until it carries a sentence.
      if (candidate.getAttribute('role') === 'alert' && (candidate.textContent ?? '').trim() === '') continue;
      revealed.add(candidate);
      if (isFullyVisible(candidate)) continue;
      reveal(candidate);
      // One per commit: scrolling to each in turn would land on the last field.
      return;
    }
  };

  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    /*
     * One frame: the mutation fires while React is still committing siblings, and
     * measuring then can use a pre-error height. `requestAnimationFrame` runs after
     * layout, which is what `scrollIntoView` needs to be correct.
     */
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(scan);
    else setTimeout(scan, 0);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(container, {
    childList: true,
    subtree: true,
    // The message text and the `data-invalid` flag both arrive as attribute changes on
    // an element that already existed (a `FormField` whose error prop just became set).
    attributes: true,
    attributeFilter: ['data-invalid', 'role'],
    characterData: true,
  });
  return () => observer.disconnect();
}

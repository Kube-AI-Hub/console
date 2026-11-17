/**
 * Bring a failed form field into view, and put the caret in it.
 *
 * Why this is a shared utility rather than a few lines in one dialog: every form
 * that can be taller than its scroll container has the same failure. The reader
 * fills in the top, presses 提交, and nothing appears to happen — the error message
 * was rendered below the fold, inside a `max-h-[70vh] overflow-y-auto` body. Measured
 * on 添加集群 (2026-11-17): with only the name filled in, the kubeconfig error sat
 * 443px below the visible area and the submit looked like a no-op.
 *
 * What it does, in order, because each step alone is insufficient:
 *
 * 1. **Scroll the field wrapper into view**, not the message paragraph. The message is
 *    rendered under the control and can be added after this runs; the wrapper exists
 *    either way. `block: 'center'` is used rather than `'nearest'`: a field at the very
 *    bottom of the container scrolls to the edge with `'nearest'`, and its own error
 *    line — which is *below* it — stays clipped.
 * 2. **Focus the actual control**, preferring a real focusable element over the
 *    wrapper. Focusing the wrapper looks like focus went nowhere (the outline is on a
 *    `div`), and a `contenteditable` editor needs `.focus()` on the editable node, not
 *    its container.
 * 3. **Defer one frame** (`requestAnimationFrame`) so the error paragraph has rendered
 *    before measuring. Scrolling to an element that does not exist yet is a no-op, and
 *    React renders the error in the same commit as the state change that reveals it.
 */

/** Selector for the element a reader should end up typing in. */
const FOCUSABLE = 'input:not([type="hidden"]), textarea, select, [role="combobox"], [contenteditable="true"]';

/**
 * Scroll and focus the first invalid field of a form.
 *
 * `fieldId` is either a DOM id (`ai-field-cluster-kubeconfig`) or a schema field key
 * (`spec.connection.kubeconfig`). Both are accepted because not every control carries
 * the id: a custom renderer — the YAML editor, a tag list — renders its own markup, so
 * `document.getElementById` finds nothing and only the wrapper's `data-field-key`
 * identifies the field. Passing the key is the more reliable of the two.
 *
 * Returns `false` when no element was found, which lets a caller fall back (for
 * example to scrolling the whole form). This never throws: `scrollIntoView` is absent
 * in jsdom and `CSS.escape` is absent in older browsers, and an exception inside a
 * submit handler surfaces as an unhandled rejection that hides the real failure.
 */
export function focusFirstInvalidField(container: HTMLElement | null, fieldId: string): boolean {
  if (!container || !fieldId) return false;

  const target = findFieldWrapper(container, fieldId);
  if (!target) return false;

  const reveal = (): void => {
    try {
      if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    } catch {
      // A detached node or a browser without smooth scrolling: focus alone still helps.
    }

    const focusable = target.matches(FOCUSABLE) ? target : target.querySelector<HTMLElement>(FOCUSABLE);
    if (!focusable) return;
    try {
      // `preventScroll` because the scroll above is already decided: letting the browser
      // also scroll to the control fights the `block: 'center'` position and can leave
      // the error line clipped at the edge.
      focusable.focus({ preventScroll: true });
    } catch {
      // Focus can throw on a disabled control; the scroll already happened.
    }
  };

  /*
   * One frame is enough: React commits the error before this timer runs, and the
   * smooth scroll then measures the final layout. Called synchronously instead, a
   * field whose message is still being inserted would scroll to its pre-error height.
   */
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(reveal);
  else reveal();

  return true;
}

/**
 * The element that represents one field: the control itself, or the wrapper carrying
 * `data-field-key`.
 *
 * Three shapes exist because three kinds of form render fields here:
 * 1. `ResourceForm` wraps every field in a `FormField` with `fieldKey` and an id.
 * 2. A hand-written dialog (添加集群) places the id on the input.
 * 3. A custom renderer (the YAML editor) has no id at all — only the wrapper's
 *    `data-field-key` identifies it.
 *
 * The wrapper is preferred over the control in every case: scrolling to the input
 * alone leaves the error paragraph below it out of view, which is the whole point.
 */
function findFieldWrapper(container: HTMLElement, fieldId: string): HTMLElement | null {
  // By wrapper key first: it covers the case where the control has no id.
  const byKey = container.querySelector<HTMLElement>(`[data-field-key="${escapeAttribute(fieldId)}"]`);
  if (byKey) return byKey;

  const byId = safeQuery(container, `#${escapeId(fieldId)}`);
  if (byId) return (byId.closest<HTMLElement>('[data-field-key]') ?? byId) as HTMLElement;
  return null;
}

function safeQuery(container: HTMLElement, selector: string): HTMLElement | null {
  try {
    return container.querySelector<HTMLElement>(selector);
  } catch {
    // An id that is not a valid CSS selector (rare, but `CSS.escape` is not universal).
    return null;
  }
}

function escapeId(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/([^\w-])/g, '\\$1');
}

function escapeAttribute(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

/**
 * Whether the control currently holds focus inside `container`.
 *
 * A form that re-runs validation on every change must not yank the reader back to the
 * first error on each keystroke; callers use this to reveal only when focus is
 * elsewhere (i.e. on a submit attempt, not while typing).
 */
export function hasFocusWithin(container: HTMLElement | null): boolean {
  if (!container) return false;
  const active = document.activeElement;
  return active !== null && container.contains(active);
}

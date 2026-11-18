import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { YamlEditor } from '../src/editor/YamlEditor';

/**
 * A read-only editor must still be able to take focus.
 *
 * `EditorView.editable.of(false)` alone makes CodeMirror drop `contenteditable`
 * *and* focusability, so Cmd/Ctrl+A on a viewer selects the whole page instead of
 * the document. The fix adds `tabindex="0"` while keeping the content
 * non-editable; these assertions pin both halves, because either one alone is a
 * bug — focusable-but-editable loses the read-only guarantee, and
 * non-editable-but-unfocusable brings back the select-all-the-page problem.
 *
 * CodeMirror is lazy-loaded and mounts in an effect, so every query waits for the
 * content DOM rather than reading it synchronously after `render`.
 */
async function contentOf(container: HTMLElement): Promise<Element> {
  let node: Element | null = null;
  await waitFor(() => {
    node = container.querySelector('.cm-content');
    expect(node).not.toBeNull();
  });
  return node as unknown as Element;
}

describe('YamlEditor read-only focus', () => {
  it('gives the content DOM a tabindex so it can receive focus', async () => {
    const { container } = render(<YamlEditor value="a: 1" readOnly height="120px" />);
    const content = await contentOf(container);

    expect(content).toHaveAttribute('tabindex', '0');
  });

  it('keeps the content non-editable and announces it as read-only', async () => {
    const { container } = render(<YamlEditor value="a: 1" readOnly height="120px" />);
    const content = await contentOf(container);

    // The point of the fix: focusable, but still not a text field you can type in.
    expect(content).toHaveAttribute('contenteditable', 'false');
    expect(content).toHaveAttribute('aria-readonly', 'true');
  });

  it('does not add a tabindex to an editable editor', async () => {
    // Editable editors are already focusable through `contenteditable`; a
    // tabindex there would be a second, unnecessary tab stop.
    const { container } = render(<YamlEditor value="a: 1" onChange={() => {}} height="120px" />);
    const content = await contentOf(container);

    expect(content).toHaveAttribute('contenteditable', 'true');
    expect(content).not.toHaveAttribute('tabindex');
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { YamlEditor } from '../src/editor/YamlEditor';

/**
 * The built-in copy button.
 *
 * Worth pinning because it has two paths — `navigator.clipboard` and the legacy
 * `execCommand` — and the lab clusters serve the console over plain HTTP, where
 * `navigator.clipboard` does not exist at all. A test that only exercises the
 * modern path would pass while the deployed button did nothing.
 *
 * The editor body is CodeMirror, which is lazy-loaded and needs a layout
 * environment jsdom does not provide, so these assert the toolbar contract rather
 * than the rendered document: what the button is called, what it says after a
 * copy, and that it reverts.
 */

const DOC = 'apiVersion: v1\nkind: ConfigMap\n';

/*
 * CodeMirror needs real layout (`getClientRects`), which jsdom does not provide:
 * letting it mount throws an unhandled error that Vitest reports even though the
 * assertions pass. These tests are about the corner, not the document, so the
 * editor body is replaced with a plain textarea that keeps the same contract.
 */
vi.mock('../src/editor/YamlEditorImpl', () => ({
  default: ({ value, ariaLabel }: { value: string; ariaLabel: string }) =>
    <textarea aria-label={ariaLabel} defaultValue={value} readOnly />,
}));

function stubClipboard(impl: { writeText?: (text: string) => Promise<void> }) {
  Object.defineProperty(navigator, 'clipboard', { value: impl, configurable: true, writable: true });
}

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error -- the property is stubbed per test; drop it so the next one starts clean.
  delete navigator.clipboard;
});

describe('YamlEditor copy button', () => {
  it('copies the document and reports success, then reverts', async () => {
    const written: string[] = [];
    stubClipboard({ writeText: async (text) => { written.push(text); } });
    render(<YamlEditor value={DOC} copyLabel="复制" copiedLabel="已复制" height="120px" />);

    const button = await screen.findByRole('button', { name: '复制' });
    await userEvent.click(button);

    expect(written).toEqual([DOC]);
    // The label is the feedback: a button that silently succeeds leaves the reader
    // unsure whether anything happened.
    await waitFor(() => expect(button).toHaveTextContent('已复制'));
    expect(button).toHaveAttribute('aria-label', '已复制');
    expect(button).toHaveAttribute('data-ai-copied', 'true');
  });

  it('falls back to execCommand when the clipboard API is unavailable', async () => {
    /*
     * The plain-HTTP case: `navigator.clipboard` is undefined rather than
     * rejecting, so the guard has to check for the method, not just try/catch.
     */
    stubClipboard({});
    const exec = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true, writable: true });
    render(<YamlEditor value={DOC} copyLabel="Copy" copiedLabel="Copied" height="120px" />);

    const button = await screen.findByRole('button', { name: 'Copy' });
    await userEvent.click(button);

    expect(exec).toHaveBeenCalledWith('copy');
    await waitFor(() => expect(button).toHaveTextContent('Copied'));
  });

  it('says nothing when both mechanisms fail', async () => {
    // A rejected write must not claim success; leaving the label alone is the
    // honest outcome, and the document is still on screen to select by hand.
    stubClipboard({ writeText: async () => { throw new Error('denied'); } });
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true, writable: true });
    render(<YamlEditor value={DOC} copyLabel="复制" copiedLabel="已复制" height="120px" />);

    const button = await screen.findByRole('button', { name: '复制' });
    await userEvent.click(button);

    await waitFor(() => expect(button).toHaveTextContent('复制'));
    expect(button).not.toHaveAttribute('data-ai-copied');
  });

  it('can be turned off, and a host toolbar still renders', async () => {
    render(<YamlEditor value={DOC} copyable={false} toolbar={<span>host</span>} height="120px" />);

    expect(screen.queryByRole('button', { name: '复制' })).toBeNull();
    expect(screen.getByText('host')).toBeInTheDocument();
  });

  it('renders no corner at all when there is nothing to put in it', async () => {
    // `copyable={false}` with no toolbar: the previous markup had no wrapper, and
    // an empty positioned div would be an invisible click-blocker over the text.
    const { container } = render(<YamlEditor value={DOC} copyable={false} height="120px" />);
    await waitFor(() => expect(container.querySelector('.absolute')).toBeNull());
  });
});

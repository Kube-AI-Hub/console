import * as React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TerminalView, type TerminalHandle } from '../src/terminal';

const state = vi.hoisted(() => ({
  input: undefined as ((data: string) => void) | undefined,
  created: vi.fn(), write: vi.fn(), reset: vi.fn(), fit: vi.fn(), dispose: vi.fn(), disconnect: vi.fn(),
}));
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    options: Record<string, unknown>;
    textarea?: HTMLTextAreaElement;
    constructor(options: Record<string, unknown>) { this.options = options; state.created(options); }
    open(host: HTMLElement) { this.textarea = document.createElement('textarea'); host.appendChild(this.textarea); }
    loadAddon() {}
    onData(callback: (data: string) => void) { state.input = callback; return { dispose: vi.fn() }; }
    onBinary() { return { dispose: vi.fn() }; }
    onResize() { return { dispose: vi.fn() }; }
    write = state.write;
    reset = state.reset;
    focus() {}
    dispose = state.dispose;
  },
}));
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit = state.fit; } }));
afterEach(() => vi.unstubAllGlobals());

describe('terminal renderer lifetime', () => {
  it('preserves raw output and callback updates without recreating the screen, then disposes observers', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = state.disconnect; });
    const first = vi.fn();
    const second = vi.fn();
    const ref = React.createRef<TerminalHandle>();
    const view = render(<TerminalView ref={ref} onData={first} scrollback={1000} ariaLabel="console" />);
    await waitFor(() => expect(state.created).toHaveBeenCalledTimes(1));
    expect(state.created).toHaveBeenCalledWith(expect.objectContaining({ scrollback: 1000, convertEol: false }));
    act(() => { ref.current!.write('\u001b[?1049h\u001b[31mtext'); state.input?.('\u001b[A'); state.input?.('\t'); });
    expect(state.write).toHaveBeenCalledWith('\u001b[?1049h\u001b[31mtext');
    expect(first).toHaveBeenCalledWith('\u001b[A');
    expect(first).toHaveBeenCalledWith('\t');
    view.rerender(<TerminalView ref={ref} onData={second} scrollback={1000} ariaLabel="console" />);
    act(() => { state.input?.('\u001b'); });
    expect(second).toHaveBeenCalledWith('\u001b');
    expect(state.created).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(state.dispose).toHaveBeenCalledTimes(1);
    expect(state.disconnect).toHaveBeenCalledTimes(1);
  });
});

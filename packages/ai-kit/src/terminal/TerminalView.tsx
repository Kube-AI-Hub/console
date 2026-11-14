import * as React from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export interface TerminalHandle {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
  fit: () => void;
}

export interface TerminalViewProps {
  onData?: (data: string) => void;
  onBinary?: (data: string) => void;
  onResize?: (columns: number, rows: number) => void;
  onReady?: (terminal: TerminalHandle) => void;
  readOnly?: boolean;
  scrollback?: number;
  ariaLabel: string;
  aiId?: string;
}

/** VT terminal renderer only. The application owns connections, credentials and status. */
export const TerminalView = React.forwardRef<TerminalHandle, TerminalViewProps>(function TerminalView(
  { onData, onBinary, onResize, onReady, readOnly = false, scrollback = 5000, ariaLabel, aiId }, ref,
) {
  const host = React.useRef<HTMLDivElement>(null);
  const terminal = React.useRef<Terminal | null>(null);
  const fitAddon = React.useRef<FitAddon | null>(null);
  const callbacks = React.useRef({ onData, onBinary, onResize, onReady });
  callbacks.current = { onData, onBinary, onResize, onReady };
  const handle = React.useMemo<TerminalHandle>(() => ({
    write: (data) => terminal.current?.write(data),
    clear: () => terminal.current?.reset(),
    focus: () => terminal.current?.focus(),
    fit: () => fitAddon.current?.fit(),
  }), []);
  React.useImperativeHandle(ref, () => handle, [handle]);

  React.useEffect(() => {
    const element = host.current;
    if (!element) return;
    const color = (key: string): string => `rgb(${getComputedStyle(element).getPropertyValue(key).trim()})`;
    const theme = () => ({
      background: color('--ai-bg-deep'), foreground: color('--ai-fg'),
      cursor: color('--ai-fg'), selectionBackground: color('--ai-accent'),
      red: color('--ai-danger'), green: color('--ai-success'), yellow: color('--ai-warning'),
      blue: color('--ai-info'), magenta: color('--ai-accent'), cyan: color('--ai-info'),
    });
    const instance = new Terminal({
      allowProposedApi: false, cursorBlink: true, cursorStyle: 'block',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 14, lineHeight: 1.15, scrollback, theme: theme(),
      disableStdin: readOnly, convertEol: false,
    });
    const fit = new FitAddon();
    terminal.current = instance;
    fitAddon.current = fit;
    instance.loadAddon(fit);
    instance.open(element);
    instance.textarea?.setAttribute('aria-label', ariaLabel);
    const input = instance.onData((data) => callbacks.current.onData?.(data));
    const binary = instance.onBinary((data) => callbacks.current.onBinary?.(data));
    const resize = instance.onResize(({ cols, rows }) => {
      element.dataset.terminalColumns = String(cols);
      element.dataset.terminalRows = String(rows);
      callbacks.current.onResize?.(cols, rows);
    });
    let frame = 0;
    const scheduleFit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { if (element.clientWidth && element.clientHeight) fit.fit(); });
    };
    const observer = new ResizeObserver(scheduleFit);
    observer.observe(element);
    const themeObserver = new MutationObserver(() => { instance.options.theme = theme(); });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    fit.fit();
    callbacks.current.onReady?.(handle);
    scheduleFit();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      themeObserver.disconnect();
      input.dispose();
      binary.dispose();
      resize.dispose();
      instance.dispose();
      terminal.current = null;
      fitAddon.current = null;
    };
    // Callback changes must not destroy a live terminal's screen or cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, scrollback]);

  React.useEffect(() => {
    if (terminal.current) terminal.current.options.disableStdin = readOnly;
  }, [readOnly]);

  return <div ref={host} className="min-h-0 min-w-0 flex-1 overflow-hidden bg-ai-bg-deep p-1"
    data-ai-id={aiId} aria-label={ariaLabel} />;
});

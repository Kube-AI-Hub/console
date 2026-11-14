import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ExecOptions } from '@kube-ai-hub/api-client';
import { I18nProvider } from '@/i18n';
import { ExecConsoleDialog } from '@/components/resource/ExecConsoleDialog';

const mock = vi.hoisted(() => ({ open: vi.fn(), write: vi.fn(), close: vi.fn(), resize: vi.fn(), output: vi.fn() }));
vi.mock('@kube-ai-hub/ui/terminal', async () => {
  const React = await import('react');
  return { TerminalView: ({ onReady, onData, onResize, readOnly }: {
    onReady: (handle: unknown) => void; onData: (data: string) => void;
    onResize: (columns: number, rows: number) => void; readOnly: boolean;
  }) => {
    React.useEffect(() => {
      onResize(120, 40);
      onReady({ write: mock.output, clear: vi.fn(), focus: vi.fn(), fit: vi.fn() });
    }, []);
    return <textarea aria-label="terminal" disabled={readOnly} onKeyDown={(event) => onData(event.key === 'Escape' ? '\u001b' : event.key)} />;
  } };
});
vi.mock('@kube-ai-hub/api-client', async (load) => ({
  ...await load<typeof import('@kube-ai-hub/api-client')>(),
  openExecSession: mock.open,
}));

describe('shared command terminal', () => {
  it('connects only on request, writes commands, retains output and closes on unmount', async () => {
    let options: ExecOptions | undefined;
    mock.open.mockImplementation((next: ExecOptions) => {
      options = next;
      return { write: mock.write, close: mock.close, resize: mock.resize };
    });
    const close = vi.fn();
    const view = render(<I18nProvider locale="zh"><ExecConsoleDialog target={{ cluster: 'host', namespace: 'system',
      pod: 'kubectl-admin-1', container: 'kubectl' }} title="kubectl" aiPrefix="kubectl" onClose={close} /></I18nProvider>);
    await waitFor(() => expect(mock.open).toHaveBeenCalledTimes(1));
    expect(options).toMatchObject({ cluster: 'host', namespace: 'system', pod: 'kubectl-admin-1', container: 'kubectl' });
    expect(options?.command).toEqual(expect.arrayContaining([
      expect.stringContaining('exec bash -i'),
    ]));
    expect(options?.command).toEqual(expect.arrayContaining([
      expect.stringContaining('exec /bin/sh -i'),
    ]));
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
    act(() => { options!.onOpen?.(); });
    await userEvent.click(input);
    await userEvent.keyboard('i{Escape}');
    expect(mock.write).toHaveBeenCalledWith('\u001b');
    expect(close).not.toHaveBeenCalled();
    expect(mock.resize).toHaveBeenCalledWith(120, 40);
    act(() => { options!.onData?.('\u001b[32mnamespace/default\u001b[0m\n'); });
    expect(mock.output).toHaveBeenCalledWith('\u001b[32mnamespace/default\u001b[0m\n');
    view.unmount();
    expect(mock.close).toHaveBeenCalledTimes(1);
  });
});

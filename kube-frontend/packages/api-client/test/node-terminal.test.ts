import { describe, expect, it, vi } from 'vitest';
import { nodeTerminalPath, openNodeTerminalSession } from '../src/node-terminal';
import type { ExecSocket } from '../src/exec';

let current: FakeSocket;
class FakeSocket implements ExecSocket {
  binaryType = '';
  readyState = 0;
  onopen: ExecSocket['onopen'] = null;
  onmessage: ExecSocket['onmessage'] = null;
  onerror: ExecSocket['onerror'] = null;
  onclose: ExecSocket['onclose'] = null;
  sent: string[] = [];
  constructor(public url: string, public protocols?: string[]) { current = this; }
  send(data: ArrayBufferView | string) { this.sent.push(String(data)); }
  close() { this.readyState = 3; this.onclose?.({ wasClean: true }); }
  open() { this.readyState = 1; this.onopen?.(); }
  message(Op: string, Data: string) { this.onmessage?.({ data: JSON.stringify({ Op, Data }) }); }
}
const options = () => ({ cluster: 'host', node: 'gpu01', getToken: () => 'test-token', webSocketImpl: FakeSocket });

describe('node terminal transport', () => {
  it('encodes targets and keeps tokens out of the URL', () => {
    expect(nodeTerminalPath({ cluster: 'member/a', node: 'gpu/1' })).toBe(
      '/kapis/terminal.kubesphere.io/v1alpha2/clusters/member%2Fa/nodes/gpu%2F1/exec');
    const session = openNodeTerminalSession(options());
    expect(current.url).not.toContain('test-token');
    expect(current.protocols).toEqual(['binary.k8s.io', 'bearer.test-token']);
    session.close();
  });
  it('waits for stdout before readiness and sends native Tab and resize envelopes', () => {
    const onOpen = vi.fn(), onData = vi.fn();
    const session = openNodeTerminalSession({ ...options(), onOpen, onData });
    current.open();
    session.write('must-not-send');
    session.resize(140, 48);
    expect(onOpen).not.toHaveBeenCalled();
    expect(current.sent).toEqual([]);
    current.message('stdout', '\u001b[32mroot@gpu01\u001b[0m');
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenCalledWith('\u001b[32mroot@gpu01\u001b[0m');
    session.write('\t\u001b[A\u0003');
    expect(current.sent.map((message) => JSON.parse(message))).toEqual([
      { Op: 'resize', Cols: 140, Rows: 48 }, { Op: 'stdin', Data: '\t\u001b[A\u0003' },
    ]);
    session.close();
    current.message('stdout', 'late output');
    expect(onData).toHaveBeenCalledTimes(1);
  });
  it('reports toast failure once and closes the socket', () => {
    const onError = vi.fn(), onClose = vi.fn();
    openNodeTerminalSession({ ...options(), onError, onClose });
    current.open();
    current.message('toast', 'node access failed');
    expect(onError.mock.calls[0]?.[0].message).toBe('node access failed');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(current.readyState).toBe(3);
  });
  it('bounds readiness waiting after a successful handshake', () => {
    vi.useFakeTimers();
    try {
      const onError = vi.fn();
      openNodeTerminalSession({ ...options(), onError, connectTimeoutMs: 500 });
      current.open();
      vi.advanceTimersByTime(500);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(current.readyState).toBe(3);
    } finally { vi.useRealTimers(); }
  });
  it('does not open unauthenticated sessions or report failures after deliberate close', async () => {
    const onError = vi.fn(), onClose = vi.fn();
    const session = openNodeTerminalSession({ ...options(), getToken: () => '', onError, onClose });
    session.close();
    await Promise.resolve();
    expect(onError).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

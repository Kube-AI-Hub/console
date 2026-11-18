import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/errors';
import {
  EXEC_PROTOCOL,
  EXEC_PROTOCOL_FALLBACK,
  execPath,
  execWebSocketUrl,
  openExecSession,
  stripAnsi,
  type ExecSocket,
} from '../src/exec';

/**
 * The exec channel is the second streaming channel in this client and the first
 * one that writes. The pieces that are easy to get wrong are all pinned here:
 * the kube path and its repeated 'command' parameters, the token carrier (a
 * subprotocol, because a browser WebSocket cannot set headers), the frame layout,
 * and the difference between "the shell exited" and "the connection failed".
 */

interface Sent {
  channel: number;
  body: string;
}

/** A stand-in for the browser WebSocket that records what the session does with it. */
class FakeSocket implements ExecSocket {
  static created: FakeSocket[] = [];

  binaryType = 'blob';
  readyState = 0;
  sent: Uint8Array[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code?: number; reason?: string; wasClean?: boolean }) => void) | null = null;

  constructor(
    readonly url: string,
    readonly protocols?: string[],
  ) {
    FakeSocket.created.push(this);
  }

  send(data: ArrayBufferView | string): void {
    if (typeof data === 'string') {
      this.sent.push(new TextEncoder().encode(data));
      return;
    }
    this.sent.push(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }

  close(code?: number, _reason?: string): void {
    this.readyState = 3;
    this.onclose?.({ code: code ?? 1000, reason: _reason ?? '', wasClean: true });
  }

  /** Complete the handshake. */
  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  /** Deliver one channel frame from the upstream. */
  frame(channel: number, text: string): void {
    const body = new TextEncoder().encode(text);
    const frame = new Uint8Array(body.length + 1);
    frame[0] = channel;
    frame.set(body, 1);
    this.onmessage?.({ data: frame.buffer });
  }

  /** The handshake was refused. */
  fail(): void {
    this.readyState = 3;
    this.onerror?.();
    this.onclose?.({ code: 1006, reason: '', wasClean: false });
  }

  channels(): Sent[] {
    return this.sent.map((frame) => ({
      channel: frame[0] ?? -1,
      body: new TextDecoder().decode(frame.subarray(1)),
    }));
  }
}

beforeEach(() => {
  FakeSocket.created = [];
});

function lastSocket(): FakeSocket {
  const socket = FakeSocket.created.at(-1);
  if (!socket) throw new Error('no socket was created');
  return socket;
}

/** Let the queued microtasks (the token check) run. */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('execPath', () => {
  it('addresses the exec subresource with a pty and a shell on the host cluster', () => {
    expect(execPath({ cluster: 'host', namespace: 'demo', pod: 'web-0', container: 'web' })).toBe(
      '/api/v1/namespaces/demo/pods/web-0/exec?container=web&stdin=true&stdout=true&stderr=true&tty=true&command=%2Fbin%2Fsh',
    );
  });

  it('keeps the member-cluster segment, encodes path segments, and repeats command parts', () => {
    const path = execPath({
      cluster: 'a b',
      namespace: 'demo',
      pod: 'web-0',
      command: ['sh', '-c', 'echo hi'],
    });
    expect(path.startsWith('/api/v1/clusters/a%20b/namespaces/demo/pods/web-0/exec?')).toBe(true);
    const query = new URLSearchParams(path.split('?')[1]);
    expect(query.getAll('command')).toEqual(['sh', '-c', 'echo hi']);
    expect(query.get('tty')).toBe('true');
  });
});

describe('execWebSocketUrl', () => {
  it('switches the page origin to ws', () => {
    expect(
      execWebSocketUrl({ cluster: 'host', namespace: 'demo', pod: 'web-0', origin: 'http://localhost:5178' }),
    ).toBe('ws://localhost:5178/api/v1/namespaces/demo/pods/web-0/exec?stdin=true&stdout=true&stderr=true&tty=true&command=%2Fbin%2Fsh');
  });

  it('uses wss when the page is https', () => {
    expect(
      execWebSocketUrl({ cluster: 'host', namespace: 'demo', pod: 'web-0', origin: 'https://console.example' }),
    ).toMatch(/^wss:\/\/console\.example\//);
  });
});

describe('openExecSession', () => {
  it('preserves UTF-8 characters split between output frames', () => {
    const chunks: string[] = [];
    const session = openExecSession({ cluster: 'host', namespace: 'demo', pod: 'web-0',
      getToken: () => 'token', webSocketImpl: FakeSocket, onData: (data) => chunks.push(data) });
    lastSocket().open();
    const bytes = new TextEncoder().encode('终端');
    lastSocket().onmessage?.({ data: new Uint8Array([1, ...bytes.slice(0, 2)]).buffer });
    lastSocket().onmessage?.({ data: new Uint8Array([1, ...bytes.slice(2)]).buffer });
    expect(chunks.join('')).toBe('终端');
    session.close();
  });

  it('sends legacy terminal mouse bytes without UTF-8 rewriting', () => {
    const session = openExecSession({ cluster: 'host', namespace: 'demo', pod: 'web-0',
      getToken: () => 'token', webSocketImpl: FakeSocket });
    lastSocket().open();
    session.writeBinary?.('\u001b[M\u00ff');
    expect([...lastSocket().sent[0]!]).toEqual([0, 27, 91, 77, 255]);
    session.close();
  });

  it('times out a stalled handshake and closes its socket', () => {
    vi.useFakeTimers();
    try {
      const errors: ApiError[] = [];
      openExecSession({ cluster: 'host', namespace: 'demo', pod: 'web-0', getToken: () => 'token-abc',
        webSocketImpl: FakeSocket, connectTimeoutMs: 1000, onError: (error) => errors.push(error) });
      vi.advanceTimersByTime(1000);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toContain('timed out');
      expect(lastSocket().readyState).toBe(3);
    } finally { vi.useRealTimers(); }
  });

  it('offers both channel versions and the bearer token as subprotocols', () => {
    openExecSession({
      cluster: 'host',
      namespace: 'demo',
      pod: 'web-0',
      container: 'web',
      getToken: () => 'token-abc',
      origin: 'http://localhost:5178',
      webSocketImpl: FakeSocket,
    });
    expect(lastSocket().url).toContain('/api/v1/namespaces/demo/pods/web-0/exec?');
    // v5 first, v4 as the fallback: a 1.28 cluster answers a v5-only handshake
    // with a bare 403, so the server has to be able to pick an older name.
    expect(lastSocket().protocols).toEqual([EXEC_PROTOCOL, EXEC_PROTOCOL_FALLBACK, 'bearer.token-abc']);
    expect(lastSocket().binaryType).toBe('arraybuffer');
  });

  it('writes stdin and resize as channel frames once open', () => {
    const session = openExecSession({
      cluster: 'host',
      namespace: 'demo',
      pod: 'web-0',
      getToken: () => 'token-abc',
      webSocketImpl: FakeSocket,
    });
    // Nothing may be sent before the handshake completes.
    session.write('ignored');
    expect(lastSocket().sent).toHaveLength(0);

    lastSocket().open();
    session.write('echo hi\n');
    session.resize(120, 30);

    expect(lastSocket().channels()).toEqual([
      { channel: 0, body: 'echo hi\n' },
      { channel: 4, body: '{"Width":120,"Height":30}' },
    ]);
  });

  it('reports stdout and stderr as text', () => {
    const chunks: string[] = [];
    openExecSession({
      cluster: 'host',
      namespace: 'demo',
      pod: 'web-0',
      getToken: () => 'token-abc',
      webSocketImpl: FakeSocket,
      onData: (chunk) => chunks.push(chunk),
    });
    lastSocket().open();
    lastSocket().frame(1, 'hello\n');
    lastSocket().frame(2, 'warning\n');
    expect(chunks).toEqual(['hello\n', 'warning\n']);
  });

  it('turns a channel-3 Status into an ApiError with the readable message', () => {
    const errors: ApiError[] = [];
    openExecSession({
      cluster: 'host',
      namespace: 'demo',
      pod: 'web-0',
      getToken: () => 'token-abc',
      webSocketImpl: FakeSocket,
      onError: (error) => errors.push(error),
    });
    lastSocket().open();
    lastSocket().frame(
      3,
      JSON.stringify({
        status: 'Failure',
        message:
          'Internal error occurred: Internal error occurred: error executing command in container: exec: "/bin/sh": stat /bin/sh: no such file or directory',
        reason: 'InternalError',
        code: 500,
      }),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe(
      'error executing command in container: exec: "/bin/sh": stat /bin/sh: no such file or directory',
    );
    expect(errors[0]!.status).toBe(500);
  });

  it('treats a channel-3 Success as a clean exit', () => {
    const errors: ApiError[] = [];
    let closed = 0;
    openExecSession({
      cluster: 'host',
      namespace: 'demo',
      pod: 'web-0',
      getToken: () => 'token-abc',
      webSocketImpl: FakeSocket,
      onError: (error) => errors.push(error),
      onClose: () => {
        closed += 1;
      },
    });
    lastSocket().open();
    lastSocket().frame(3, JSON.stringify({ status: 'Success' }));
    lastSocket().close(1000, '');

    expect(errors).toHaveLength(0);
    expect(closed).toBe(1);
  });

  it('reports a refused handshake as connection_failed, not as a dropped session', () => {
    const errors: ApiError[] = [];
    let closed = 0;
    openExecSession({
      cluster: 'host',
      namespace: 'demo',
      pod: 'web-0',
      getToken: () => 'token-abc',
      webSocketImpl: FakeSocket,
      onError: (error) => errors.push(error),
      onClose: () => {
        closed += 1;
      },
    });
    lastSocket().fail();

    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe('connection_failed');
    expect(closed).toBe(1);
  });

  it('reports a lost connection after opening as network_error', () => {
    const errors: ApiError[] = [];
    openExecSession({
      cluster: 'host',
      namespace: 'demo',
      pod: 'web-0',
      getToken: () => 'token-abc',
      webSocketImpl: FakeSocket,
      onError: (error) => errors.push(error),
    });
    lastSocket().open();
    lastSocket().fail();

    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe('network_error');
  });

  it('fails before connecting when there is no token', async () => {
    const errors: ApiError[] = [];
    const session = openExecSession({
      cluster: 'host',
      namespace: 'demo',
      pod: 'web-0',
      getToken: () => null,
      webSocketImpl: FakeSocket,
      onError: (error) => errors.push(error),
    });
    session.write('ignored');
    await tick();

    expect(FakeSocket.created).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe('unauthorized');
  });

  it('closes deliberately without reporting an error', () => {
    const errors: ApiError[] = [];
    let closed = 0;
    const session = openExecSession({
      cluster: 'host',
      namespace: 'demo',
      pod: 'web-0',
      getToken: () => 'token-abc',
      webSocketImpl: FakeSocket,
      onError: (error) => errors.push(error),
      onClose: () => {
        closed += 1;
      },
    });
    lastSocket().open();
    session.close();
    session.close();

    expect(errors).toHaveLength(0);
    expect(closed).toBe(1);
  });
});

describe('stripAnsi', () => {
  it('removes colour codes, cursor reports and bracketed-paste toggles', () => {
    expect(stripAnsi('\u001b[6n\u001b[?2004hsh-5.1# \u001b[0m\u001b[32mok\u001b[0m')).toBe('sh-5.1# ok');
  });

  it('leaves plain output alone', () => {
    expect(stripAnsi('tc-terminal-ok\n')).toBe('tc-terminal-ok\n');
  });
});

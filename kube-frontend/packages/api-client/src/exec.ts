import { ApiError } from './errors';

/**
 * Container exec, read and written over the kube WebSocket channel protocol.
 *
 * The browser cannot use a plain HTTP read here: exec is a protocol upgrade, and
 * the kube log trick (a never-ending chunked response) does not apply because this
 * channel is bidirectional. The browser's native 'WebSocket' is enough — no xterm,
 * no third-party transport — and the frames are the ones kube-apiserver documents
 * for 'v5.channel.k8s.io':
 *
 * | byte | channel | direction |
 * | ---- | ------- | --------- |
 * | 0    | stdin   | client → server |
 * | 1    | stdout  | server → client |
 * | 2    | stderr  | server → client |
 * | 3    | error   | server → client (a kube 'Status' JSON) |
 * | 4    | resize  | client → server (JSON '{Width,Height}') |
 *
 * Tokens: the browser 'WebSocket' constructor cannot set headers and this console
 * has no cookie session, so the bearer token travels as a 'bearer.<token>'
 * subprotocol. The BFF strips it and sets the 'Authorization' header on the
 * upstream hop; see 'kube-frontend/server/src/upgrade.ts'.
 */

/** Channel protocol the upstream expects; kube 1.37 removed the SPDY transports. */
export const EXEC_PROTOCOL = 'v5.channel.k8s.io';

/** Subprotocol prefix the BFF uses to receive the bearer token from a browser. */
export const TOKEN_PROTOCOL_PREFIX = 'bearer.';

/** Commands tried when the caller does not name one: a POSIX shell is the point of the feature. */
export const DEFAULT_EXEC_COMMAND = ['/bin/sh'];

/** Frame channel numbers from the kube channel protocol. */
export const EXEC_CHANNELS = {
  stdin: 0,
  stdout: 1,
  stderr: 2,
  error: 3,
  resize: 4,
} as const;

/** Default terminal geometry, used until the page reports its real size. */
export const DEFAULT_EXEC_COLUMNS = 80;
export const DEFAULT_EXEC_ROWS = 24;

/** Where one exec session runs. */
export interface ExecTarget {
  /** Member cluster id; 'host' (or an empty string) is the cluster the BFF itself talks to. */
  cluster: string;
  namespace: string;
  pod: string;
  /** Defaults to the pod's only container upstream; required when the pod has several. */
  container?: string;
  /** Defaults to '/bin/sh'. An array is sent as repeated 'command' parameters. */
  command?: string | string[];
}

/** One channel can be written to and listened to; the page owns its lifetime. */
export interface ExecSession {
  /** Send stdin. No-op until the socket is open. */
  write(data: string): void;
  /** Raw input bytes for legacy mouse reports emitted by a terminal emulator. */
  writeBinary?(data: string): void;
  /** Tell the remote pty how big the page's output area is. */
  resize(columns: number, rows: number): void;
  /** Close the session. Idempotent; a deliberate close reports no error. */
  close(): void;
}

/** The subset of the browser WebSocket the client uses, so tests can stand in for it. */
export interface ExecSocket {
  binaryType: string;
  readonly readyState: number;
  send(data: ArrayBufferView | string): void;
  close(code?: number, reason?: string): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onclose: ((event: { code?: number; reason?: string; wasClean?: boolean }) => void) | null;
}

/** Constructor shape of 'WebSocket' (and of a test double). */
export interface ExecSocketFactory {
  new (url: string, protocols?: string[]): ExecSocket;
}

export interface ExecOptions extends ExecTarget {
  /** Called with stdout and stderr text as it arrives (raw; the page strips escape codes). */
  onData?: (chunk: string) => void;
  /** The handshake completed: commands can be sent. */
  onOpen?: () => void;
  /**
   * The session failed. A rejected handshake gives a generic 'connection_failed'
   * because the WebSocket API hides the HTTP status; a channel-3 error frame from
   * kube carries the exact reason (e.g. the container has no '/bin/sh').
   */
  onError?: (error: ApiError) => void;
  /** The session ended: the shell exited, the connection dropped, or 'close()' was called. */
  onClose?: () => void;
  /** Bearer token, read per connection so a re-login takes effect. */
  getToken?: () => string | null | undefined;
  /** WebSocket origin; defaults to the page's origin (same-origin with the BFF). */
  origin?: string;
  /** Test seam: defaults to the browser's 'WebSocket'. */
  webSocketImpl?: ExecSocketFactory;
  /** Bound a stalled handshake so the page never remains connecting indefinitely. */
  connectTimeoutMs?: number;
}

/** 'WebSocket.OPEN', spelled out so the client does not depend on the constant. */
const SOCKET_OPEN = 1;

/**
 * Path of the exec subresource, addressed through the BFF.
 *
 * Mirrors 'podLogPath' in 'logs.ts': the app reads pods through '/api/v1', which
 * ks-apiserver forwards verbatim; kapis's resources endpoint does not expose the
 * exec subresource.
 */
export function execPath(target: ExecTarget): string {
  // The exec subresource exists only on the core group, which has no member-cluster form; a member
  // exec therefore keeps the host path. Documented here rather than silently building a 404.
  const clusterSegment =
    target.cluster && target.cluster !== 'host' ? 'clusters/' + encodeURIComponent(target.cluster) + '/' : '';
  const query = new URLSearchParams();
  if (target.container) query.set('container', target.container);
  query.set('stdin', 'true');
  query.set('stdout', 'true');
  query.set('stderr', 'true');
  query.set('tty', 'true');
  const command = typeof target.command === 'string' ? [target.command] : (target.command ?? DEFAULT_EXEC_COMMAND);
  for (const part of command) query.append('command', part);
  return (
    '/api/v1/' +
    clusterSegment +
    'namespaces/' +
    encodeURIComponent(target.namespace) +
    '/pods/' +
    encodeURIComponent(target.pod) +
    '/exec?' +
    query.toString()
  );
}

/** Absolute ws(s) URL for a session, derived from the page origin by default. */
export function execWebSocketUrl(options: ExecTarget & { origin?: string }): string {
  const origin = options.origin ?? globalThis.location?.origin ?? 'http://localhost';
  const url = new URL(execPath(options), origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

/**
 * Remove terminal escape sequences so the plain output area stays readable.
 *
 * The pty sends cursor movements, colour codes and two-position reports
 * ('\x1b[6n') that mean something to a real terminal and nothing to a '<pre>'.
 * What remains is the text a reader wants. This is presentation support, exported
 * because the page that renders the output must not grow its own regex.
 */
const ANSI_PATTERN =
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

/**
 * Open one exec session.
 *
 * The caller owns the lifetime: 'close()' on unmount or when the panel closes. A
 * connection that never opens reports 'connection_failed'; once open, a channel-3
 * error frame reports as an 'ApiError' with the upstream message, which is how a
 * container without a shell explains itself instead of staying blank.
 */
export function openExecSession(options: ExecOptions): ExecSession {
  const Impl = options.webSocketImpl ?? (globalThis.WebSocket as unknown as ExecSocketFactory);
  let socket: ExecSocket | undefined;
  let finished = false;
  /** The browser's error event carries no detail; the close event decides what to report. */
  let rawError = false;
  let opened = false;
  let deliberate = false;
  let connectTimer: ReturnType<typeof setTimeout> | undefined;

  const finish = (error?: ApiError): void => {
    if (finished) return;
    finished = true;
    clearTimeout(connectTimer);
    if (error) options.onError?.(error);
    options.onClose?.();
  };

  const token = options.getToken?.() ?? '';
  if (!token) {
    // Fail before the handshake: the BFF would answer 401 and the browser would
    // report only "handshake failed", hiding the actual cause.
    queueMicrotask(() => {
      finish(new ApiError({ code: 'unauthorized', message: 'not signed in' }, 401));
    });
    return { write: () => undefined, resize: () => undefined, close: () => undefined };
  }

  const protocols = [EXEC_PROTOCOL, TOKEN_PROTOCOL_PREFIX + token];
  try {
    socket = new Impl(execWebSocketUrl(options), protocols);
  } catch (cause) {
    queueMicrotask(() => {
      finish(new ApiError({ code: 'connection_failed', message: cause instanceof Error ? cause.message : 'cannot open a terminal' }, 0));
    });
    return { write: () => undefined, resize: () => undefined, close: () => undefined };
  }

  socket.binaryType = 'arraybuffer';
  connectTimer = setTimeout(() => {
    finish(new ApiError({ code: 'connection_failed', message: 'the terminal connection timed out' }, 0));
    socket?.close();
  }, options.connectTimeoutMs ?? 20_000);
  socket.onopen = () => {
    clearTimeout(connectTimer);
    if (finished) { socket?.close(); return; }
    opened = true;
    options.onOpen?.();
  };
  socket.onerror = () => {
    rawError = true;
  };
  socket.onclose = () => {
    if (deliberate) {
      finish();
      return;
    }
    if (!opened) {
      finish(
        new ApiError(
          { code: 'connection_failed', message: 'the terminal connection was refused' },
          0,
        ),
      );
      return;
    }
    if (rawError && !finished) {
      finish(new ApiError({ code: 'network_error', message: 'the terminal connection was lost' }, 0));
      return;
    }
    finish();
  };

  const outputDecoders = { 1: new TextDecoder(), 2: new TextDecoder() };
  const handleFrame = (bytes: Uint8Array): void => {
    if (bytes.length === 0) return;
    const channel = bytes[0];
    const payload = bytes.subarray(1);
    if (channel === EXEC_CHANNELS.stdout || channel === EXEC_CHANNELS.stderr) {
      options.onData?.(outputDecoders[channel].decode(payload, { stream: true }));
      return;
    }
    if (channel !== EXEC_CHANNELS.error) return;
    const failure = statusFailure(new TextDecoder().decode(payload));
    if (failure === undefined) {
      // A channel-3 'Success' Status means the shell exited cleanly; the socket
      // closes right after, and the UI shows "disconnected", not an error.
      return;
    }
    finish(failure);
    socket?.close();
  };

  socket.onmessage = (event) => {
    const data = event.data;
    if (typeof data === 'string') {
      handleFrame(new TextEncoder().encode(data));
      return;
    }
    if (data instanceof ArrayBuffer) {
      handleFrame(new Uint8Array(data));
      return;
    }
    if (ArrayBuffer.isView(data)) {
      handleFrame(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      return;
    }
    // A Blob is the other browser representation; read it and then decode the frame.
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      void data
        .arrayBuffer()
        .then((buffer) => handleFrame(new Uint8Array(buffer)))
        .catch(() => undefined);
    }
  };

  const sendFrame = (channel: number, payload: Uint8Array): void => {
    if (!socket || socket.readyState !== SOCKET_OPEN) return;
    const frame = new Uint8Array(payload.length + 1);
    frame[0] = channel;
    frame.set(payload, 1);
    socket.send(frame);
  };

  return {
    write(data: string) {
      sendFrame(EXEC_CHANNELS.stdin, new TextEncoder().encode(data));
    },
    writeBinary(data: string) {
      sendFrame(EXEC_CHANNELS.stdin, Uint8Array.from(data, (character) => character.charCodeAt(0)));
    },
    resize(columns: number, rows: number) {
      sendFrame(EXEC_CHANNELS.resize, new TextEncoder().encode(JSON.stringify({ Width: columns, Height: rows })));
    },
    close() {
      if (deliberate) return;
      deliberate = true;
      clearTimeout(connectTimer);
      try {
        socket?.close(1000, 'closed by client');
      } catch {
        // The socket already closed; closing again is not a failure.
      }
    },
  };
}

/**
 * Turn a channel-3 body into an 'ApiError', or 'undefined' for a clean exit.
 *
 * kube sends a 'Status' object. Its 'message' is the useful sentence, but kubelet
 * wraps it twice ("Internal error occurred: Internal error occurred: …"), so the
 * repeated prefix is collapsed once — the reader needs the shell/tool error, not
 * the wrapper.
 */
function statusFailure(body: string): ApiError | undefined {
  const text = body.trim();
  if (text.length === 0) return undefined;
  let message = text;
  let code = 'upstream_error';
  let status = 500;
  try {
    const parsed = JSON.parse(text) as {
      status?: string;
      message?: string;
      reason?: string;
      code?: number;
    };
    if (parsed.status === 'Success') return undefined;
    if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) message = parsed.message.trim();
    if (parsed.reason === 'Forbidden') {
      code = 'forbidden';
      status = 403;
    }
    if (typeof parsed.code === 'number' && parsed.code >= 400) status = parsed.code;
  } catch {
    // Not a Status object: keep the raw text as the message.
  }
  message = message.replace(/^(?:Internal error occurred:\s*)+/i, '');
  return new ApiError({ code, message }, status);
}

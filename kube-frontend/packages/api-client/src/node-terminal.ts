import { ApiError } from './errors';
import { TOKEN_PROTOCOL_PREFIX, type ExecOptions, type ExecSession, type ExecSocket, type ExecSocketFactory } from './exec';

export interface NodeTerminalTarget {
  cluster: string;
  node: string;
}

export type NodeTerminalOptions = NodeTerminalTarget & Pick<ExecOptions,
  'getToken' | 'origin' | 'basePath' | 'webSocketImpl' | 'connectTimeoutMs' | 'onOpen' | 'onData' | 'onError' | 'onClose'>;

/** Node access is authorized as nodes/exec, not as an ordinary container exec. */
export function nodeTerminalPath(target: NodeTerminalTarget): string {
  const cluster = target.cluster && target.cluster !== 'host' ? `clusters/${encodeURIComponent(target.cluster)}/` : '';
  return `/kapis/terminal.kubesphere.io/v1alpha2/${cluster}nodes/${encodeURIComponent(target.node)}/exec`;
}

/** KubeSphere's node terminal uses JSON envelopes, even with binary.k8s.io selected. */
export function openNodeTerminalSession(options: NodeTerminalOptions): ExecSession {
  let socket: ExecSocket | undefined;
  let finished = false;
  let ready = false;
  let deliberate = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let geometry = { Cols: 80, Rows: 24 };
  const finish = (error?: ApiError) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    if (error && !deliberate) options.onError?.(error);
    options.onClose?.();
  };
  const fail = (message: string, code = 'connection_failed', status = 0) => {
    if (finished) return;
    finish(new ApiError({ code, message }, status));
    socket?.close();
  };
  const send = (message: object) => {
    if (!finished && socket?.readyState === 1) socket.send(JSON.stringify(message));
  };
  const session: ExecSession = {
    write: (data) => { if (ready) send({ Op: 'stdin', Data: data }); },
    resize: (columns, rows) => {
      geometry = { Cols: Math.max(1, Math.min(65535, columns)), Rows: Math.max(1, Math.min(65535, rows)) };
      if (ready) send({ Op: 'resize', ...geometry });
    },
    close: () => {
      if (deliberate) return;
      deliberate = true;
      finish();
      socket?.close(1000, 'closed by client');
    },
  };
  const token = options.getToken?.();
  if (!token || !options.node) {
    queueMicrotask(() => fail(token ? 'a node is required' : 'not signed in', token ? 'invalid_target' : 'unauthorized', token ? 400 : 401));
    return session;
  }
  try {
    const url = new URL(`${options.basePath ?? ''}${nodeTerminalPath(options)}`, options.origin ?? globalThis.location?.origin ?? 'http://localhost');
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const Impl = options.webSocketImpl ?? (globalThis.WebSocket as unknown as ExecSocketFactory);
    socket = new Impl(url.toString(), ['binary.k8s.io', TOKEN_PROTOCOL_PREFIX + token]);
    // Upgrade is not readiness: the backend still has to start the node access Pod.
    timer = setTimeout(() => fail('the node terminal did not become ready'), options.connectTimeoutMs ?? 30_000);
    socket.onopen = () => { if (finished) socket?.close(); };
    socket.onmessage = (event) => {
      if (finished) return;
      try {
        if (typeof event.data !== 'string') throw new Error('expected a JSON terminal message');
        const message = JSON.parse(event.data) as { Op?: string; Data?: string };
        if (message.Op === 'toast') {
          fail(message.Data || 'the node shell failed', 'upstream_error');
        } else if (message.Op === 'stdout' && typeof message.Data === 'string') {
          if (!ready) {
            ready = true;
            clearTimeout(timer);
            options.onOpen?.();
            send({ Op: 'resize', ...geometry });
          }
          options.onData?.(message.Data);
        }
      } catch {
        fail('invalid node terminal response', 'upstream_error');
      }
    };
    socket.onerror = () => fail('the node terminal connection failed; check nodes/exec permission');
    socket.onclose = (event) => {
      if (!ready && !deliberate) fail(event.reason || 'the node terminal connection was refused');
      else finish();
    };
  } catch (cause) {
    queueMicrotask(() => fail(cause instanceof Error ? cause.message : 'cannot open a node terminal'));
  }
  return session;
}

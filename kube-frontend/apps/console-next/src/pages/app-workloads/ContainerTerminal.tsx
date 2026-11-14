import * as React from 'react';
import { openExecSession, stripAnsi, type ExecSession } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Button, Input } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { currentToken } from '@/api';

/**
 * 容器终端.
 *
 * A plain command input plus an output area, not an xterm: the requirement is to
 * run a command in the container and read what it prints. A full terminal
 * emulator (cursor addressing, colours, full-screen programs) is a much larger
 * component and is deliberately out of scope; the escape sequences the pty does
 * emit are stripped so the text stays readable.
 *
 * The channel is the WebSocket exec subresource. Everything protocol-specific
 * lives in openExecSession; this component owns only the session lifetime and the
 * four states a reader can see: connecting, connected, disconnected, error.
 */

/** Output lines kept in the view; the pty can print without bound. */
export const MAX_TERMINAL_LINES = 500;

/** How often accumulated output is flushed into React state, in milliseconds. */
const FLUSH_MS = 80;

type TerminalState = 'connecting' | 'connected' | 'error' | 'closed';

export interface ContainerTerminalProps {
  cluster: string;
  namespace: string;
  pod: string;
  container: string;
}

export function ContainerTerminal({ cluster, namespace, pod, container }: ContainerTerminalProps): React.ReactElement {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  /** Bumped by "reconnect": the effect is the only owner of the socket. */
  const [attempt, setAttempt] = React.useState(0);
  const [state, setState] = React.useState<TerminalState>('connecting');
  const [error, setError] = React.useState('');
  const [lines, setLines] = React.useState<string[]>([]);
  /** The last, incomplete line: a prompt usually arrives without a newline. */
  const [partial, setPartial] = React.useState('');
  const [command, setCommand] = React.useState('');
  const sessionRef = React.useRef<ExecSession | null>(null);
  const outputRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const bufferRef = React.useRef('');
  const partialRef = React.useRef('');
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    if (!open) return;
    let disposed = false;
    bufferRef.current = '';
    partialRef.current = '';
    setLines([]);
    setPartial('');
    setError('');
    setState('connecting');

    /*
     * Output is batched every FLUSH_MS: one setState per pty read would make a
     * command like "ls -l /usr" re-render the page hundreds of times. The partial
     * line survives between flushes so a prompt split across reads is not shown
     * twice or cut in half.
     */
    const flush = (): void => {
      timerRef.current = undefined;
      if (disposed) return;
      const raw = bufferRef.current;
      bufferRef.current = '';
      if (raw.length === 0 && partialRef.current.length === 0) return;
      const text = stripAnsi(partialRef.current + raw).replace(/\r\n/g, '\n');
      const segments = text.split('\n');
      partialRef.current = segments.pop() ?? '';
      if (segments.length > 0) {
        setLines((previous) => {
          const next = previous.concat(segments);
          return next.length > MAX_TERMINAL_LINES ? next.slice(-MAX_TERMINAL_LINES) : next;
        });
      }
      setPartial(partialRef.current);
    };

    const schedule = (): void => {
      if (timerRef.current !== undefined) return;
      timerRef.current = setTimeout(flush, FLUSH_MS);
    };

    const session = openExecSession({
      cluster,
      namespace,
      pod,
      container,
      getToken: currentToken,
      onData: (chunk) => {
        if (disposed) return;
        bufferRef.current += chunk;
        schedule();
      },
      onOpen: () => {
        if (disposed) return;
        setState('connected');
        // Tell the pty how wide the output area is so commands that wrap (and
        // interactive tools that ask) see a sane geometry instead of 80x24.
        const list = outputRef.current;
        if (list) {
          session.resize(
            Math.max(20, Math.floor(list.clientWidth / 7)),
            Math.max(8, Math.floor(list.clientHeight / 18)),
          );
        }
      },
      onError: (cause) => {
        if (disposed) return;
        flush();
        setError(cause.message);
        setState('error');
      },
      onClose: () => {
        if (disposed) return;
        flush();
        // Do not overwrite a specific cause with the generic "disconnected".
        setState((previous) => (previous === 'error' ? previous : 'closed'));
      },
    });
    sessionRef.current = session;

    return () => {
      disposed = true;
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
      sessionRef.current = null;
      // Closing the browser socket closes the upstream exec channel too; the BFF
      // destroys its half when this one goes away.
      session.close();
    };
  }, [open, attempt, cluster, namespace, pod, container]);

  // Keep the newest output in view; a command's output is read from the bottom.
  React.useEffect(() => {
    const list = outputRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [lines, partial]);

  // The input is the only usable control, so focus it as soon as it works.
  React.useEffect(() => {
    if (state === 'connected') inputRef.current?.focus();
  }, [state]);

  const close = React.useCallback((): void => {
    setOpen(false);
    setState('connecting');
    setError('');
    setLines([]);
    setPartial('');
    setCommand('');
  }, []);

  const retry = React.useCallback((): void => {
    setAttempt((current) => current + 1);
  }, []);

  const submit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      if (state !== 'connected') return;
      // Enter is CR in a terminal; the tty's line discipline turns it into a newline.
      sessionRef.current?.write(command + '\r');
      setCommand('');
    },
    [state, command],
  );

  const ready = state === 'connected';
  const aiState = ready ? 'ready' : state === 'connecting' ? 'loading' : state === 'error' ? 'error' : 'empty';
  const statusText =
    state === 'connecting'
      ? t('container.terminal.connecting')
      : state === 'connected'
        ? t('container.terminal.connected')
        : state === 'closed'
          ? t('container.terminal.exited')
          : '';

  return (
    <section
      className="rounded-lg border border-ai-border bg-ai-surface p-4"
      data-ai-id="container-detail:terminal-section"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-ai-fg">{t('container.terminal.title')}</h2>
        {open ? (
          <Button variant="secondary" {...actionProps('container-detail:terminal-close')} onClick={close}>
            {t('container.terminal.close')}
          </Button>
        ) : (
          <Button variant="secondary" {...actionProps('container-detail:terminal-open')} onClick={() => setOpen(true)}>
            {t('container.terminal.open')}
          </Button>
        )}
      </div>

      {!open ? (
        <p className="text-xs text-ai-fg-muted">{t('container.terminal.hint')}</p>
      ) : (
        <div className="flex flex-col gap-2" data-ai-id="container-detail:terminal" data-ai-state={aiState}>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ai-fg-muted">
            <span>{statusText}</span>
            {state === 'error' || state === 'closed' ? (
              <Button variant="secondary" {...actionProps('container-detail:terminal-retry')} onClick={retry}>
                {t('container.terminal.retry')}
              </Button>
            ) : null}
          </div>

          {state === 'error' ? (
            <div className="flex flex-col gap-1" data-ai-id="container-detail:terminal-error">
              <p className="text-xs text-ai-danger">{t('container.terminal.error')}</p>
              {error ? <p className="break-all font-mono text-[11px] text-ai-fg-muted">{error}</p> : null}
            </div>
          ) : null}

          <div
            ref={outputRef}
            className="flex max-h-80 min-h-40 flex-col gap-1 overflow-y-auto rounded-ai-md border border-ai-line bg-[#0f141d] p-2 font-mono text-[11px] leading-5 text-ai-fg-secondary"
            data-ai-id="container-detail:terminal-output"
          >
            {lines.length === 0 && partial.length === 0 ? (
              <p className="font-sans text-ai-fg-muted">
                {state === 'connecting'
                  ? t('container.terminal.connecting')
                  : state === 'connected'
                    ? t('container.terminal.connected')
                    : state === 'closed'
                      ? t('container.terminal.disconnected')
                      : ''}
              </p>
            ) : null}
            {lines.map((line, index) => (
              <div key={index} className="whitespace-pre-wrap break-all" data-ai-row={String(index)}>
                {line.length > 0 ? line : '\u00a0'}
              </div>
            ))}
            {partial.length > 0 ? <div className="whitespace-pre-wrap break-all">{partial}</div> : null}
          </div>

          <form className="flex flex-wrap items-center gap-2" onSubmit={submit}>
            <Input
              ref={inputRef}
              id="container-detail:terminal-input"
              className="min-w-0 flex-1 font-mono"
              value={command}
              disabled={!ready}
              placeholder={t('container.terminal.inputPlaceholder')}
              aria-label={t('container.terminal.inputPlaceholder')}
              autoComplete="off"
              spellCheck={false}
              {...actionProps('container-detail:terminal-input')}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setCommand(event.target.value)}
            />
            <Button variant="secondary" type="submit" disabled={!ready} {...actionProps('container-detail:terminal-send')}>
              {t('container.terminal.send')}
            </Button>
          </form>
          <p className="text-[11px] text-ai-fg-muted">{t('container.terminal.outputHint')}</p>
        </div>
      )}
    </section>
  );
}

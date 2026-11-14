import * as React from 'react';
import { openExecSession, type ExecTarget, type ExecSession } from '@kube-ai-hub/api-client';
import { Button, Modal } from '@kube-ai-hub/ui';
import type { TerminalHandle } from '@kube-ai-hub/ui/terminal';
import { currentToken } from '@/api';
import { useT } from '@/i18n';
import { actionProps } from '@kube-ai-hub/ai-surface';

const TerminalView = React.lazy(() => import('@kube-ai-hub/ui/terminal').then((module) => ({ default: module.TerminalView })));

export function ExecConsoleDialog({ target, title, aiPrefix, onClose }: {
  target: ExecTarget; title: string; aiPrefix: string; onClose: () => void;
}): React.ReactElement {
  const t = useT();
  const [attempt, setAttempt] = React.useState(0);
  const [state, setState] = React.useState<'connecting' | 'ready' | 'error' | 'closed'>('connecting');
  const [error, setError] = React.useState('');
  const session = React.useRef<ExecSession | null>(null);
  const [renderer, setRenderer] = React.useState<TerminalHandle | null>(null);
  const geometry = React.useRef({ columns: 80, rows: 24 });

  React.useEffect(() => {
    if (!renderer) return;
    let disposed = false;
    setState('connecting');
    setError('');
    renderer.clear();
    const connection = openExecSession({
      ...target, getToken: currentToken,
      command: target.command ?? ['/bin/sh', '-c',
        'export TERM=xterm-256color; if command -v bash >/dev/null 2>&1; then exec bash -i; else exec /bin/sh -i; fi'],
      onData: (data) => { if (!disposed) renderer.write(data); },
      onOpen: () => {
        if (disposed) return;
        setState('ready');
        renderer.fit();
        connection.resize(geometry.current.columns, geometry.current.rows);
        renderer.focus();
      },
      onError: (cause) => { if (!disposed) { setError(cause.message); setState('error'); } },
      onClose: () => { if (!disposed) setState((previous) => previous === 'error' ? 'error' : 'closed'); },
    });
    session.current = connection;
    return () => { disposed = true; connection.close(); session.current = null; };
  }, [renderer, attempt, target.cluster, target.namespace, target.pod, target.container]);

  return <Modal open onOpenChange={(open) => { if (!open) onClose(); }} size="console"
    dismissOnEscape={false} dismissOnOutside={false} title={title}
    closeAiId={`${aiPrefix}:terminal-close`} closeLabel={t('container.terminal.close')}
    description={`${target.cluster} / ${target.namespace} / ${target.pod} / ${target.container ?? ''}`}>
    <div className="flex min-h-0 flex-1 flex-col gap-2" data-ai-id={`${aiPrefix}:terminal`}
      data-ai-state={state === 'ready' ? 'ready' : state === 'connecting' ? 'loading' : 'error'}
      aria-busy={state === 'connecting'}>
      <div className="flex shrink-0 items-center gap-3 px-1 text-xs text-ai-fg-muted">
        <span role="status">{t(state === 'connecting' ? 'container.terminal.connecting' : state === 'ready'
          ? 'container.terminal.connected' : 'container.terminal.disconnected')}</span>
        {state === 'error' || state === 'closed' ? <Button size="sm" variant="secondary"
          {...actionProps(`${aiPrefix}:terminal-retry`)} onClick={() => setAttempt((value) => value + 1)}>
          {t('container.terminal.retry')}</Button> : null}
      </div>
      {error ? <p role="alert" className="shrink-0 text-xs text-ai-danger" data-ai-id={`${aiPrefix}:terminal-error`}>{error}</p> : null}
      <React.Suspense fallback={<p role="status">{t('common.loading')}</p>}>
        <TerminalView onReady={setRenderer} readOnly={state !== 'ready'} ariaLabel={t('console.terminal.input')}
          aiId={`${aiPrefix}:terminal-output`} onData={(data) => session.current?.write(data)}
          onBinary={(data) => session.current?.writeBinary?.(data)}
          onResize={(columns, rows) => {
            geometry.current = { columns, rows };
            session.current?.resize(columns, rows);
          }} />
      </React.Suspense>
    </div>
  </Modal>;
}

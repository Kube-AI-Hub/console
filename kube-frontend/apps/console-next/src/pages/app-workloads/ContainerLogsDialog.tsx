import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { logSearchApi, openPodLogStream, type PodLogTarget } from '@kube-ai-hub/api-client';
import { Button, Input, Modal, Switch } from '@kube-ai-hub/ui';
import type { TerminalHandle } from '@kube-ai-hub/ui/terminal';
import { api } from '@/api';
import { useT } from '@/i18n';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { errorMessage } from '@/components/resource/ResourceErrorPanel';

const TerminalView = React.lazy(() => import('@kube-ai-hub/ui/terminal').then((module) => ({ default: module.TerminalView })));

export function ContainerLogsDialog({ target, onClose }: { target: PodLogTarget; onClose: () => void }): React.ReactElement {
  const t = useT();
  const [live, setLive] = React.useState(false);
  const [keyword, setKeyword] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [renderer, setRenderer] = React.useState<TerminalHandle | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [state, setState] = React.useState<'connecting' | 'ready' | 'error'>('connecting');
  const [error, setError] = React.useState('');
  const logs = useQuery({
    queryKey: ['container-logs', target.cluster, target.namespace, target.pod, target.container, search],
    enabled: !live,
    queryFn: ({ signal }) => {
      const endTime = Math.floor(Date.now() / 1000);
      return logSearchApi(api).search({ namespace: target.namespace, pod: target.pod, ...(target.container ? { container: target.container } : {}),
        keyword: search, startTime: endTime - 3600, endTime, size: 200, signal });
    },
  });
  React.useEffect(() => {
    if (!renderer || live) return;
    renderer.clear();
    if (logs.data) renderer.write(logs.data.records.map((record) => `${record.time} ${record.log}\r\n`).join(''));
  }, [renderer, live, logs.data]);

  React.useEffect(() => {
    if (!renderer || !live) return;
    let disposed = false;
    let frame = 0;
    let pending: string[] = [];
    let started = false;
    renderer.clear();
    setState('connecting');
    setError('');
    const stream = openPodLogStream(api, { ...target, follow: true, timestamps: true });
    const flush = () => {
      frame = 0;
      if (!disposed && pending.length) renderer.write(pending.join(''));
      pending = [];
    };
    void (async () => {
      try {
        for await (const line of stream) {
          if (disposed) return;
          if (!started) { started = true; setState('ready'); }
          pending.push(line + '\r\n');
          // Bound bursts replayed by the upstream before the next browser frame.
          if (pending.length > 1000) pending = pending.slice(-1000);
          if (!frame) frame = requestAnimationFrame(flush);
        }
        if (!disposed) { flush(); setError(t('container.logs.followError')); setState('error'); }
      } catch (cause) {
        if (!disposed) { flush(); setError(errorMessage(t, cause)); setState('error'); }
      }
    })();
    return () => { disposed = true; cancelAnimationFrame(frame); stream.close(); };
  }, [renderer, live, attempt, target.cluster, target.namespace, target.pod, target.container, t]);

  const status = live ? state : logs.isPending ? 'connecting' : logs.isError ? 'error' : 'ready';
  return <Modal open size="console" title={t('container.section.logs')} dismissOnOutside={false}
    closeAiId="container-detail:log-stream-stop" closeLabel={t('common.close')}
    description={`${target.cluster} / ${target.namespace} / ${target.pod} / ${target.container ?? ''}`}
    onOpenChange={(open) => { if (!open) onClose(); }}>
    <div className="flex min-h-0 flex-1 flex-col gap-2" data-ai-id="container-detail:log-console" data-ai-state={status === 'connecting' ? 'loading' : status}>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <span {...actionProps('container-detail:log-follow')}>
          <Switch checked={live} aria-label={t('container.logs.follow')} onCheckedChange={setLive} />
        </span>
        <span className="text-xs text-ai-fg-muted">{t('container.logs.follow')}</span>
        {!live ? <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); setSearch(keyword); }}>
          <Input value={keyword} placeholder={t('search.field.keyword')} {...actionProps('container-detail:log-keyword')}
            onChange={(event) => setKeyword(event.target.value)} />
          <Button type="submit" size="sm" variant="secondary">{t('common.search')}</Button>
        </form> : null}
        <Button size="sm" variant="secondary" {...actionProps('container-detail:log-stream-retry')}
          onClick={() => { if (live) setAttempt((value) => value + 1); else void logs.refetch(); }}>{t('common.refresh')}</Button>
      </div>
      {status === 'connecting' ? <p role="status" className="text-xs text-ai-fg-muted">{t('container.logs.followConnecting')}</p> : null}
      {status === 'error' ? <p role="alert" className="text-xs text-ai-danger">{live ? error : errorMessage(t, logs.error)}</p> : null}
      {!live && logs.data?.records.length === 0 ? <p role="status" className="text-xs text-ai-fg-muted">{t('search.logs.empty')}</p> : null}
      <React.Suspense fallback={<p role="status">{t('common.loading')}</p>}>
        <TerminalView readOnly scrollback={1000} ariaLabel={t('container.section.logs')} onReady={setRenderer}
          aiId={live ? 'container-detail:log-stream' : 'container-detail:log-list'} />
      </React.Suspense>
    </div>
  </Modal>;
}

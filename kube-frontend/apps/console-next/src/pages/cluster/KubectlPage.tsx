import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { kubectlApi } from '@kube-ai-hub/api-client';
import { AiSurface, Button, Modal } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { api } from '@/api';
import { useT } from '@/i18n';
import { useAuth } from '@/shell/AuthProvider';
import { ExecConsoleDialog } from '@/components/resource/ExecConsoleDialog';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

export function KubectlPage({ cluster }: { cluster: string }): React.ReactElement {
  const t = useT();
  const { user } = useAuth();
  const [requested, setRequested] = React.useState(false);
  React.useEffect(() => { setRequested(false); }, [cluster, user?.name]);
  const target = useQuery({
    queryKey: ['kubectl-target', cluster, user?.name],
    enabled: requested && Boolean(user?.name),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 0,
    queryFn: ({ signal }) => kubectlApi(api).target({ cluster, username: user?.name ?? '', signal }),
  });
  const state = requested && target.isFetching ? 'loading' : requested && target.isError ? 'error' : 'ready';
  return <AiSurface as="section" aiId="kubectl:surface" state={state} className="flex min-w-0 flex-col gap-4">
    <header>
      <h1 className="text-lg font-semibold text-ai-fg">{t('kubectl.title')}</h1>
      <p className="mt-1 text-sm text-ai-fg-muted">{t('kubectl.description')}</p>
    </header>
    <p className="text-sm text-ai-fg-secondary">{t('kubectl.warning')}</p>
    <Button variant="primary" disabled={!user} {...actionProps('kubectl:prepare')}
      onClick={() => setRequested(true)}>{t('kubectl.prepare')}</Button>
    {requested ? target.data && !target.isFetching && !target.isError ?
      <ExecConsoleDialog key={`${cluster}:${user?.name}:${target.data.pod}`}
        target={{ cluster, ...target.data }} aiPrefix="kubectl" title={t('kubectl.title')}
        onClose={() => setRequested(false)} /> :
      <Modal open size="console" title={t('kubectl.title')} dismissOnEscape={false} dismissOnOutside={false}
        onOpenChange={(open) => { if (!open) setRequested(false); }}>
        {target.isError ? <ResourceErrorPanel error={target.error} onRetry={() => void target.refetch()} retryAiId="kubectl:retry" /> :
          <p role="status">{t('kubectl.preparing')}</p>}
      </Modal> : null}
  </AiSurface>;
}

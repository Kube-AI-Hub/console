import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { kubectlApi } from '@kube-ai-hub/api-client';
import { Modal } from '@kube-ai-hub/ui';
import { api } from '@/api';
import { useAuth } from '@/shell/AuthProvider';
import { useT } from '@/i18n';
import { ResourceErrorPanel } from './ResourceErrorPanel';
import { ExecConsoleDialog } from './ExecConsoleDialog';

/** Mount only in response to an explicit launch; resolve and connect in one dialog. */
export function KubectlConsoleDialog({ cluster, onClose, onStateChange }: {
  cluster: string; onClose: () => void;
  onStateChange?: (state: 'loading' | 'ready' | 'error') => void;
}): React.ReactElement | null {
  const t = useT();
  const { user } = useAuth();
  const client = useQueryClient();
  const instance = React.useId();
  const username = user?.name ?? '';
  const [owner] = React.useState(`${cluster}/${username}`);
  const active = owner === `${cluster}/${username}` && Boolean(username);
  const queryKey = React.useMemo(() => ['kubectl-target', cluster, username, instance], [cluster, username, instance]);
  const target = useQuery({
    queryKey, enabled: active, retry: false, gcTime: 0, staleTime: 0,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: ({ signal }) => kubectlApi(api).target({ cluster, username, signal }),
  });
  const state = target.isFetching ? 'loading' : target.isError ? 'error' : target.data ? 'ready' : 'loading';
  React.useEffect(() => onStateChange?.(state), [onStateChange, state]);
  React.useEffect(() => {
    if (!active) onClose();
  }, [active, onClose]);
  React.useEffect(() => () => {
    void client.cancelQueries({ queryKey, exact: true });
    client.removeQueries({ queryKey, exact: true });
  }, [client, queryKey]);
  if (!active) return null;
  if (target.data && !target.isFetching && !target.isError) {
    return <ExecConsoleDialog target={{ cluster, ...target.data }} aiPrefix="kubectl" title={t('kubectl.title')} onClose={onClose} />;
  }
  return <Modal open size="console" title={t('kubectl.title')} dismissOnEscape={false} dismissOnOutside={false}
    closeAiId="kubectl:terminal-close" closeLabel={t('container.terminal.close')}
    onOpenChange={(open) => { if (!open) onClose(); }}>
    <p className="text-sm text-ai-warning">{t('kubectl.warning')}</p>
    {target.isError ? <ResourceErrorPanel error={target.error} onRetry={() => void target.refetch()} retryAiId="kubectl:retry" /> :
      <p role="status" data-ai-id="kubectl:preparing">{t('kubectl.preparing')}</p>}
  </Modal>;
}

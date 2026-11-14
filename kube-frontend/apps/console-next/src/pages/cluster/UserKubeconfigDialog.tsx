import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { kubectlApi } from '@kube-ai-hub/api-client';
import { Button, Modal, Skeleton, Textarea } from '@kube-ai-hub/ui';
import { api } from '@/api';
import { useT } from '@/i18n';
import { ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';

export function UserKubeconfigDialog({ cluster, username, onClose }: {
  cluster: string; username: string; onClose: () => void;
}): React.ReactElement {
  const t = useT();
  const client = useQueryClient();
  const key = ['user-kubeconfig', cluster, username];
  const query = useQuery({ queryKey: key, retry: false, gcTime: 0, staleTime: 0,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: ({ signal }) => kubectlApi(api).kubeconfig({ cluster, username, signal }) });
  React.useEffect(() => () => {
    void client.cancelQueries({ queryKey: ['user-kubeconfig', cluster, username] });
    client.removeQueries({ queryKey: ['user-kubeconfig', cluster, username] });
  }, [client, cluster, username]);
  const download = () => {
    if (!query.data) return;
    const url = URL.createObjectURL(new Blob([query.data], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'kubeconfig.yaml'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return <Modal open size="console" title={`kubeconfig · ${cluster}`} closeAiId="overview:kubeconfig-close"
    closeLabel={t('common.close')} onOpenChange={(open) => { if (!open) onClose(); }}>
    <div className="flex flex-col gap-4" data-ai-id="overview:kubeconfig-dialog">
      <p className="text-sm text-ai-fg-secondary">{t('cluster.overview.kubeconfigHint')}</p>
      {query.isPending ? <Skeleton className="h-64" /> : query.isError ?
        <ResourceErrorPanel error={query.error} onRetry={() => void query.refetch()} retryAiId="overview:kubeconfig-retry" /> :
        <>
          <Button variant="secondary" data-ai-id="overview:kubeconfig-download" onClick={download}>{t('cluster.overview.downloadConfig')}</Button>
          <Textarea readOnly value={query.data ?? ''} aria-label="kubeconfig" data-ai-id="overview:kubeconfig-content"
            className="h-[60dvh] font-mono text-xs" />
        </>}
    </div>
  </Modal>;
}

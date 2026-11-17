import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, nodesWriteApi } from '@kube-ai-hub/api-client';
import { AiButton, Button, Modal, Skeleton } from '@kube-ai-hub/ui';
import { api } from '@/api';
import { useT } from '@/i18n';
import { formatTimestamp } from '@/lib/time';

/**
 * "Add node" dialog: fetch a short-lived kubeadm join command from ks-apiserver.
 *
 * The old console edited a KubeKey Cluster CR; kube-server has no KubeKey integration, so
 * the backend now issues a bootstrap token and returns the join command. A 404 is not a
 * generic failure: it means the running ks-apiserver predates the endpoint, and the dialog
 * says which dependency to upgrade. The command is kept in memory only (no URL, no logging).
 */
export function NodeJoinDialog({
  cluster,
  open,
  onOpenChange,
}: {
  cluster: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}): React.ReactElement {
  const t = useT();
  const [copied, setCopied] = React.useState(false);
  const commandRef = React.useRef<HTMLTextAreaElement | null>(null);
  const query = useQuery({
    queryKey: ['node-join-command', cluster, open],
    enabled: open,
    retry: false,
    staleTime: 0,
    queryFn: () => nodesWriteApi(api).joinCommand({ cluster }),
  });

  React.useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const copy = async (): Promise<void> => {
    if (!query.data?.command) return;
    try {
      await navigator.clipboard.writeText(query.data.command);
      setCopied(true);
    } catch {
      commandRef.current?.select();
      setCopied(false);
    }
  };

  const error = query.error;
  // An older ks-apiserver either has no route (404) or only the generic GET /nodes/{name}
  // (405 for POST); both mean "the endpoint is absent", not a transient failure.
  const notSupported = error instanceof ApiError && (error.status === 404 || error.status === 405);
  const forbidden = error instanceof ApiError && error.status === 403;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('node.add.title')}
      description={t('node.add.description')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} {...{ 'data-ai-id': 'node-add:close' }}>
            {t('common.close')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-ai-id="node-add:surface">
        {query.isPending ? <Skeleton className="h-24 w-full" /> : null}
        {query.isError ? (
          <div className="flex flex-col gap-2" data-ai-id="node-add:error">
            <p role="alert" className="text-sm text-ai-danger">
              {notSupported
                ? t('node.add.unsupported')
                : forbidden
                  ? t('node.add.forbidden')
                  : t('node.add.failed')}
            </p>
            {notSupported ? (
              <p className="text-xs text-ai-fg-muted">{t('node.add.unsupportedHint')}</p>
            ) : (
              <p className="break-all font-mono text-[11px] text-ai-fg-muted">{error instanceof Error ? error.message : String(error)}</p>
            )}
            <div>
              <AiButton aiId="node-add:retry" size="sm" variant="ghost" onClick={() => void query.refetch()} disabled={query.isFetching}>
                {t('common.retry')}
              </AiButton>
            </div>
          </div>
        ) : null}
        {query.data ? (
          <>
            <p className="text-xs text-ai-fg-muted">{t('node.add.runHint')}</p>
            <textarea
              ref={commandRef}
              readOnly
              value={query.data.command}
              data-ai-id="node-add:command"
              aria-label={t('node.add.command')}
              className="h-24 w-full resize-none rounded-ai-sm border border-ai-line bg-ai-surface-2 p-2 font-mono text-[11px] leading-5 text-ai-fg-secondary"
            />
            <div className="flex flex-wrap items-center gap-3 text-xs text-ai-fg-muted">
              <span data-ai-id="node-add:expires">
                {t('node.add.expires')} {query.data.expiresAt ? formatTimestamp(query.data.expiresAt) : '-'}
              </span>
              <span className="break-all font-mono text-[11px]">{query.data.caCertHash}</span>
            </div>
            <div>
              <AiButton aiId="node-add:copy" size="sm" onClick={() => void copy()}>
                {copied ? t('node.add.copied') : t('node.add.copy')}
              </AiButton>
            </div>
            <p className="text-[11px] text-ai-fg-muted">{t('node.add.securityHint')}</p>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { logCollectionApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { AiSurface, Badge, Button, Skeleton, Switch } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';
import { MutationAlert, ResourceErrorPanel } from '@/components/resource/ResourceErrorPanel';
import { DefinitionRow } from '@/components/resource/DefinitionRow';

/**
 * 项目日志收集.
 *
 * KubeSphere's project log collection is one label on the project's namespace:
 * `logging.kubesphere.io/logsidecar-injection`. The old console's page is that switch
 * plus an explanation, and this is the same page for the same reason — there is no
 * per-project log resource to configure.
 *
 * Turning it off asks first: the injector removes the sidecar from the project's pods,
 * which restarts them, and that is not obviously implied by flipping a switch.
 */
export interface LogCollectionPageProps {
  cluster: string;
  namespace: string;
}

export function LogCollectionPage({ cluster, namespace }: LogCollectionPageProps): React.ReactElement {
  const t = useT();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = React.useState(false);

  const state = useQuery({
    queryKey: ['log-collection', cluster, namespace],
    queryFn: ({ signal }) => logCollectionApi(apiClient).get({ namespace, cluster, signal }),
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => logCollectionApi(apiClient).setEnabled({ namespace, enabled }),
    onSuccess: () => {
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: ['log-collection', cluster, namespace] });
    },
  });

  if (state.isError) {
    return (
      <ResourceErrorPanel error={state.error} onRetry={() => void state.refetch()} retryAiId="log-collection:retry" />
    );
  }

  const loading = state.isPending;
  const data = state.data;
  const surfaceState = loading ? 'loading' : 'ready';

  return (
    <AiSurface as="section" aiId="log-collection:surface" state={surfaceState} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-ai-fg">{t('logCollection.title')}</h1>
        <p className="text-sm text-ai-fg-muted">{t('logCollection.description')}</p>
      </header>

      {loading ? <Skeleton className="h-28 w-full" /> : null}

      {data ? (
        <section className="rounded-lg border border-ai-border bg-ai-surface p-4" data-ai-id="log-collection:panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm font-medium text-ai-fg">
                {t('logCollection.switchLabel')}
                <Badge tone={data.enabled ? 'success' : data.raw === 'disabled' ? 'neutral' : 'warning'}>
                  {data.raw === ''
                    ? t('logCollection.neverConfigured')
                    : data.enabled
                      ? t('logCollection.enabled')
                      : t('logCollection.disabled')}
                </Badge>
              </span>
              <span className="text-xs text-ai-fg-muted">{t('logCollection.hint')}</span>
            </div>
            <Switch
              // Turning collection off is the destructive direction: the sidecar is
              // removed from running pods, which restarts them.
              checked={data.enabled}
              disabled={toggle.isPending || !data.supported}
              aria-label={t('logCollection.switchLabel')}
              className="h-6 w-11 sm:h-5 sm:w-9"
              {...actionProps('log-collection:toggle')}
              onCheckedChange={(checked) => {
                if (checked) toggle.mutate(true);
                else setConfirming(true);
              }}
            />
          </div>

          {!data.supported ? (
            <p className="mt-3 text-xs text-ai-warning" data-ai-id="log-collection:unsupported">
              {t('logCollection.unsupported')}
            </p>
          ) : null}

          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <DefinitionRow label={t('logCollection.project')} value={namespace} />
            <DefinitionRow label={t('logCollection.storageLabel')} value={data.raw || '-'} />
          </dl>

          {confirming ? (
            <div className="mt-3 flex flex-col gap-2 rounded-ai-md border border-ai-line p-3" data-ai-id="log-collection:confirm">
              <p className="text-sm text-ai-fg">{t('logCollection.confirmDisable')}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  {...actionProps('log-collection:confirm-disable')}
                  onClick={() => toggle.mutate(false)}
                >
                  {t('logCollection.confirmDisableAction')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  {...actionProps('log-collection:cancel-disable')}
                  onClick={() => setConfirming(false)}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : null}

          <MutationAlert error={toggle.error} />
        </section>
      ) : null}
    </AiSurface>
  );
}
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { platformInfoApi, versionApi } from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Modal, Skeleton } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { api as apiClient } from '@/api';

/**
 * 关于: the product name, its description and the versions this console is talking to.
 *
 * The old console puts this behind the user menu (`Modals/About`), showing the logo, a
 * one-line description and the KubeSphere version from its server config. This one reads
 * the platform ConfigMap for the name and description and `/kapis/version` for the two
 * version strings, so a renamed deployment shows its own name rather than a hard-coded one.
 *
 * A failed read is not fatal: the dialog still opens and says the version is unavailable,
 * because "what version is this" is exactly the question asked when something is broken.
 */
export interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps): React.ReactElement {
  const t = useT();
  const info = useQuery({
    queryKey: ['platform-info', 'about'],
    queryFn: ({ signal }) => platformInfoApi(apiClient).get({ signal }),
    enabled: open,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  const version = useQuery({
    queryKey: ['platform-version'],
    queryFn: ({ signal }) => versionApi(apiClient).get({ signal }),
    enabled: open,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const title = info.data?.title || t('app.name');
  const description = info.data?.description || '';
  const consoleVersion = version.data?.consoleVersion || '';
  const kubernetesVersion = version.data?.kubernetesVersion || '';

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="md" title={t('shell.about')} footer={null}>
      <div className="flex flex-col items-center gap-3 py-2 text-center" data-ai-id="shell-about:surface">
        <div
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-ai-md bg-ai-accent/15 text-lg font-semibold text-ai-accent"
        >
          KAH
        </div>
        <h2 className="text-base font-semibold text-ai-fg" data-ai-id="shell-about:title">
          {title}
        </h2>
        {description ? (
          <p className="max-w-md text-xs text-ai-fg-secondary" data-ai-id="shell-about:description">
            {description}
          </p>
        ) : null}

        {version.isPending ? <Skeleton className="h-12 w-64" /> : null}

        {version.isError || (!consoleVersion && !kubernetesVersion) ? (
          <p className="text-xs text-ai-fg-muted" data-ai-id="shell-about:unavailable">
            {t('shell.aboutUnavailable')}
          </p>
        ) : (
          <dl className="flex flex-col gap-1 text-xs text-ai-fg-secondary">
            <div className="flex items-center justify-center gap-2" {...actionProps('shell-about:console-version')}>
              <dt>{t('shell.aboutConsoleVersion')}</dt>
              <dd className="tabular-nums text-ai-fg">{consoleVersion || '-'}</dd>
            </div>
            <div className="flex items-center justify-center gap-2" {...actionProps('shell-about:kubernetes-version')}>
              <dt>{t('shell.aboutKubernetesVersion')}</dt>
              <dd className="tabular-nums text-ai-fg">{kubernetesVersion || '-'}</dd>
            </div>
          </dl>
        )}
      </div>
    </Modal>
  );
}

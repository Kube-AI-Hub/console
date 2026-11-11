import * as React from 'react';
import { Button, Icon } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import type { SecretDetail, ServiceAccountDetail } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { safeAtob } from '@/lib/base64';
import { KUBECONFIG_FILENAME, buildKubeconfig, maskKubeconfig } from '@/lib/kubeconfig';
import { toYaml } from '@/components/resource/yaml';

/**
 * The `数据` section of a ServiceAccount.
 *
 * For each token Secret the account mounts, the old console
 * (`ServiceAccounts/Detail/.../Secret.jsx`) shows two blocks in one card:
 *
 *   数据设置 — the Secret's entries, masked until the eye is pressed;
 *   kubeconfig 设置 — a ready-to-use kubeconfig with copy and download.
 *
 * The kubeconfig is the reason anyone opens this page: it turns "paste the token
 * into ~/.kube/config by hand" into one click. Both blocks are kept per Secret
 * because an account can mount several.
 */

export interface ServiceAccountSecretsSectionProps {
  detail: ServiceAccountDetail;
  /** Resolved payloads, in the same order as `detail.secrets`. */
  secrets: Array<SecretDetail | undefined>;
  loading: boolean;
}

export function ServiceAccountSecretsSection({
  detail,
  secrets,
  loading,
}: ServiceAccountSecretsSectionProps): React.ReactElement {
  const t = useT();

  if (detail.secrets.length === 0) {
    return (
      <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="serviceaccount-detail:secrets">
        <h2 className="mb-3 text-sm font-medium text-ai-fg">{t('serviceaccounts.data')}</h2>
        <p className="text-xs text-ai-fg-faint">{t('serviceaccounts.detail.noSecrets')}</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4" data-ai-id="serviceaccount-detail:secrets">
      <h2 className="text-sm font-medium text-ai-fg">{t('serviceaccounts.data')}</h2>
      {detail.secrets.map((name, index) => {
        const secret = secrets[index];
        return (
          <SecretPanel
            key={name}
            serviceAccountName={detail.name}
            secretName={name}
            namespace={detail.namespace}
            {...(secret ? { secret } : {})}
            loading={loading}
          />
        );
      })}
    </section>
  );
}

function SecretPanel({
  serviceAccountName,
  secretName,
  namespace,
  secret,
  loading,
}: {
  serviceAccountName: string;
  secretName: string;
  namespace: string;
  secret?: SecretDetail;
  loading: boolean;
}): React.ReactElement {
  const t = useT();
  const [revealed, setRevealed] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const kubeconfig = React.useMemo(
    () =>
      buildKubeconfig({
        serviceAccountName,
        namespace,
        tokenData: secret?.data['token'] ?? '',
        caData: secret?.data['ca.crt'] ?? '',
      }),
    [serviceAccountName, namespace, secret],
  );
  const kubeconfigText = React.useMemo(() => toYaml(kubeconfig), [kubeconfig]);
  /**
   * The text put on screen, which is masked while values are hidden.
   *
   * The kubeconfig embeds the very token the block masks, so rendering it
   * verbatim would defeat the eye toggle — the old console showed it in a code
   * editor for the same reason, but "trust the editor" is not a reason. The
   * full document is always what copy and download produce.
   */
  const kubeconfigShown = revealed ? kubeconfigText : maskKubeconfig(kubeconfigText, safeAtob(secret?.data['token'] ?? ''));

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(kubeconfigText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access is denied in some embedded browsers; the download button
      // is the fallback and the text is selectable in the preview.
      setCopied(false);
    }
  };

  const download = (): void => {
    const blob = new Blob([kubeconfigText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = KUBECONFIG_FILENAME;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const entries = Object.entries(secret?.data ?? {});
  /** `data.token` is base64; other entries (ca.crt, namespace) are base64 too. */
  const display = (stored: string): string => (revealed ? safeAtob(stored) : '*'.repeat(safeAtob(stored).length));

  return (
    <div className="flex flex-col gap-4 rounded-ai-md border border-ai-line p-4" data-ai-row={secretName}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-ai-fg">{t('serviceaccounts.detail.secretTitle', { name: secretName })}</h3>
        {loading ? <span className="text-[11px] text-ai-fg-muted">{t('common.loading')}</span> : null}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-ai-fg-secondary">{t('secrets.data')}</h4>
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={revealed}
            aria-label={revealed ? t('secrets.hideValues') : t('secrets.showValues')}
            title={revealed ? t('secrets.hideValues') : t('secrets.showValues')}
            {...actionProps(`serviceaccount-detail:toggle:${secretName}`)}
            onClick={() => setRevealed((current) => !current)}
          >
            <Icon name={revealed ? 'eye-closed' : 'eye'} size={16} />
          </Button>
        </div>
        {entries.length === 0 ? (
          <p className="text-xs text-ai-fg-faint">{t('secrets.data.empty')}</p>
        ) : (
          <dl className="flex flex-col gap-2 text-[11px]">
            {entries.map(([key, stored]) => (
              <div key={key} className="flex flex-col gap-1 sm:flex-row sm:gap-2">
                <dt className="w-fit rounded-ai-sm bg-ai-surface-2 px-1.5 py-0.5 font-mono text-ai-fg-secondary">{key}</dt>
                <dd className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-ai-sm border border-ai-line px-2 py-1.5 font-mono leading-5 text-ai-fg-muted">
                  {display(stored) || '-'}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col">
            <h4 className="text-xs font-medium text-ai-fg-secondary">{t('serviceaccounts.detail.kubeconfig')}</h4>
            <p className="text-[11px] text-ai-fg-muted">{t('serviceaccounts.detail.kubeconfigHint')}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              {...actionProps(`serviceaccount-detail:copy-kubeconfig:${secretName}`)}
              onClick={() => void copy()}
            >
              <Icon name="copy" size={14} />
              {copied ? t('serviceaccounts.detail.copied') : t('serviceaccounts.detail.copy')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              {...actionProps(`serviceaccount-detail:download-kubeconfig:${secretName}`)}
              onClick={download}
            >
              <Icon name="download" size={14} />
              {t('serviceaccounts.detail.download')}
            </Button>
          </div>
        </div>
        {/* Read-only: this is a generated document, not something to edit here;
            downloading it is the action. */}
        <pre
          className="max-h-72 overflow-auto rounded-ai-sm border border-ai-line bg-ai-surface-1/40 p-3 font-mono text-[11px] leading-5 text-ai-fg-muted"
          data-ai-id={`serviceaccount-detail:kubeconfig:${secretName}`}
        >
          {kubeconfigShown}
        </pre>
      </div>
    </div>
  );
}

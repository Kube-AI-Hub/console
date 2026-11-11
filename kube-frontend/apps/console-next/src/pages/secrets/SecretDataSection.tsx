import * as React from 'react';
import { Button, Icon } from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import type { SecretDetail } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';
import { isTextBase64, safeAtob } from '@/lib/base64';
import { parseDockerConfig } from '@/lib/dockerconfig';
import { SECRET_TYPE_LABEL } from './secretTypes';

/**
 * The `数据` section of a Secret, rendered per type.
 *
 * The old console's detail page (`Secrets/Detail/SecretDetail/index.jsx`) has one
 * view per type and a single eye toggle that switches every value between masked
 * and plain. That toggle is the whole point of the page, so the mask is the
 * default: a screenshot, a screen share or a shoulder does not leak a password by
 * accident, and revealing is one deliberate click.
 *
 * Masking here is exactly what the old code does — a run of `*` the same length as
 * the value, not a fixed placeholder — so the length is still visible (useful when
 * comparing a certificate against a blob) without exposing the content.
 */

/** What the toggle shows instead of the real value. */
export function maskValue(value: string): string {
  // One `*` per character of the *decoded* value, which is what the old code
  // iterates over (`value.split('').map(...)`).
  return '*'.repeat(value.length);
}

export interface SecretDataSectionProps {
  detail: SecretDetail;
}

export function SecretDataSection({ detail }: SecretDataSectionProps): React.ReactElement {
  const t = useT();
  const [revealed, setRevealed] = React.useState(false);

  /** Decoded text for display, or a marker when the payload is not UTF-8 text. */
  const display = (stored: string): string => {
    if (!stored) return '';
    if (!isTextBase64(stored)) return t('secrets.data.binary');
    return safeAtob(stored);
  };

  const value = (stored: string): string => {
    const text = display(stored);
    return revealed ? text : maskValue(text);
  };

  return (
    <section className="rounded-ai-md border border-ai-line p-4" data-ai-id="secret-detail:data">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ai-fg">{t('secrets.data')}</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-pressed={revealed}
          aria-label={revealed ? t('secrets.hideValues') : t('secrets.showValues')}
          title={revealed ? t('secrets.hideValues') : t('secrets.showValues')}
          {...actionProps('secret-detail:toggle-values')}
          onClick={() => setRevealed((current) => !current)}
        >
          <Icon name={revealed ? 'eye-closed' : 'eye'} size={16} />
        </Button>
      </div>

      {detail.type === 'kubernetes.io/tls' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ValueBlock label={t('secrets.field.certificate')} text={value(detail.data['tls.crt'] ?? '')} aiId="secret-detail:tls-crt" />
          <ValueBlock label={t('secrets.field.privateKey')} text={value(detail.data['tls.key'] ?? '')} aiId="secret-detail:tls-key" />
        </div>
      ) : detail.type === 'kubernetes.io/dockerconfigjson' ? (
        <ImageRegistryValues b64={detail.data['.dockerconfigjson'] ?? ''} revealed={revealed} />
      ) : detail.type === 'kubernetes.io/basic-auth' ? (
        <dl className="flex flex-col gap-3">
          {Object.entries(detail.data).map(([key, stored]) => (
            <div key={key} className="flex flex-col gap-1" data-ai-row={key}>
              <dt className="w-fit rounded-ai-sm bg-ai-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ai-fg-secondary">
                {/* The old page translates known keys and prints unknown ones raw. */}
                {secretFieldLabel(t, key)}
              </dt>
              <dd className="overflow-x-auto whitespace-pre-wrap break-words rounded-ai-sm border border-ai-line px-2 py-1.5 font-mono text-[11px] leading-5 text-ai-fg-muted">
                {value(stored)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <dl className="flex flex-col gap-3">
          {Object.entries(detail.data).map(([key, stored]) => (
            <div key={key} className="flex flex-col gap-1" data-ai-row={key}>
              <dt className="w-fit rounded-ai-sm bg-ai-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ai-fg-secondary">
                {key}
              </dt>
              <dd className="overflow-x-auto whitespace-pre-wrap break-words rounded-ai-sm border border-ai-line px-2 py-1.5 font-mono text-[11px] leading-5 text-ai-fg-muted">
                {value(stored)}
              </dd>
            </div>
          ))}
          {Object.keys(detail.data).length === 0 ? (
            <p className="text-xs text-ai-fg-faint">{t('secrets.data.empty')}</p>
          ) : null}
        </dl>
      )}
    </section>
  );
}

function ValueBlock({ label, text, aiId }: { label: string; text: string; aiId: string }): React.ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-xs text-ai-fg-secondary">{label}</p>
      <pre
        className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-ai-sm border border-ai-line px-2 py-1.5 font-mono text-[11px] leading-5 text-ai-fg-muted"
        data-ai-id={aiId}
      >
        {text || '-'}
      </pre>
    </div>
  );
}

/**
 * One card per registry in `.dockerconfigjson`.
 *
 * Every entry is listed (not just the first) because a Secret may carry several
 * registries; the editor only authors one, but the detail page must not hide what
 * is actually stored.
 */
function ImageRegistryValues({ b64, revealed }: { b64: string; revealed: boolean }): React.ReactElement {
  const t = useT();
  const config = parseDockerConfig(safeAtob(b64));
  const registries = Object.entries(config.auths ?? {});
  if (registries.length === 0) {
    return <p className="text-xs text-ai-fg-faint">{t('secrets.data.empty')}</p>;
  }
  const show = (text: string): string => (revealed ? text : maskValue(text));
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {registries.map(([url, entry]) => (
        <div key={url} className="flex flex-col gap-2 rounded-ai-md border border-ai-line p-3" data-ai-row={url}>
          <p className="flex items-center gap-1.5 text-xs font-medium text-ai-fg">
            <Icon name="earth" size={14} />
            <span className="truncate" title={url}>
              {url}
            </span>
          </p>
          <dl className="flex flex-col gap-1 text-[11px]">
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-ai-fg-muted">{t('secrets.field.username')}</dt>
              <dd className="min-w-0 break-all font-mono text-ai-fg-secondary">{show(entry.username ?? '')}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-ai-fg-muted">{t('secrets.field.password')}</dt>
              <dd className="min-w-0 break-all font-mono text-ai-fg-secondary">{show(entry.password ?? '')}</dd>
            </div>
            {entry.email ? (
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-ai-fg-muted">{t('secrets.field.email')}</dt>
                <dd className="min-w-0 break-all font-mono text-ai-fg-secondary">{show(entry.email)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ))}
    </div>
  );
}

/** `username` / `password` get translated labels; anything else prints as stored. */
function secretFieldLabel(t: ReturnType<typeof useT>, key: string): string {
  if (key === 'username') return t('secrets.field.username');
  if (key === 'password') return t('secrets.field.password');
  return key;
}

/** Type label for a detail header; unknown types print verbatim. */
export function detailTypeLabel(t: ReturnType<typeof useT>, type: string): string {
  const key = SECRET_TYPE_LABEL[type];
  return key ? t(key as Parameters<typeof t>[0]) : type;
}

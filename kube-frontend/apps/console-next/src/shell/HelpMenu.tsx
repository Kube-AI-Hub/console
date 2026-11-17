import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DEFAULT_DOCUMENTS,
  publicConfigApi,
  type PublicConfig,
} from '@kube-ai-hub/api-client';
import { actionProps } from '@kube-ai-hub/ai-surface';
import { Dropdown, Icon } from '@kube-ai-hub/ui';
import { useLocale, useT, type Locale } from '@/i18n';
import { api as apiClient } from '@/api';

/**
 * 帮助 / 文档 (the old console's header documentation menu).
 *
 * The old console showed a documentation dropdown with two entries — user guide and API
 * reference — sourced from its Node server's `client.documents` config, which it
 * localised by the current language. The new console keeps the same shape: the BFF answers
 * `GET /api/config` (deployment-specific env), and this menu falls back to the old
 * console's relative paths when that read fails, so a config-endpoint regression does not
 * remove the help entry.
 *
 * The links open in a new tab: they leave the console, and replacing the current page would
 * lose the reader's context. `noopener` keeps the opened page from touching this window.
 */
export interface HelpLink {
  key: 'guide' | 'api';
  labelKey: 'shell.userGuide' | 'shell.apiDocs';
  url: string;
}

/** The two documentation entries for one language; blank values are dropped. */
export function helpLinksFor(documents: PublicConfig['documents'], locale: Locale): HelpLink[] {
  const selected = locale === 'zh' ? documents.zh : documents.en;
  const links: HelpLink[] = [
    { key: 'guide', labelKey: 'shell.userGuide', url: selected.url },
    { key: 'api', labelKey: 'shell.apiDocs', url: selected.api },
  ];
  return links.filter((link) => link.url.trim() !== '');
}

export interface HelpMenuProps {
  /** Test/deployment override; production reads `/api/config`. */
  documents?: PublicConfig['documents'];
}

export function HelpMenu({ documents }: HelpMenuProps = {}): React.ReactElement | null {
  const t = useT();
  const { locale } = useLocale();
  const config = useQuery({
    queryKey: ['public-config'],
    queryFn: ({ signal }) => publicConfigApi(apiClient).get({ signal }),
    enabled: documents === undefined,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  /*
   * Wait for the config before deciding there is no help: rendering nothing while the read
   * is in flight and then popping the button in would shift the header. On failure the
   * fallback paths keep the entry; an explicit empty value removes it (deployment hosts no
   * docs) rather than rendering a dead link.
   */
  if (documents === undefined && config.isPending) return null;
  const resolved = documents ?? config.data?.documents ?? DEFAULT_DOCUMENTS;
  const links = helpLinksFor(resolved, locale);
  if (links.length === 0) return null;

  return (
    <Dropdown
      align="end"
      trigger={
        <button
          type="button"
          className="hidden h-11 items-center rounded-ai-md px-2 text-ai-fg-secondary hover:bg-ai-surface-2 hover:text-ai-fg sm:inline-flex sm:h-9"
          title={t('shell.help')}
          aria-label={t('shell.help')}
          {...actionProps('shell:help-menu')}
        >
          <Icon name="documentation" size={16} />
        </button>
      }
      items={links.map((link) => ({
        key: link.key,
        aiId: `shell:docs-${link.key}`,
        label: (
          <span className="flex items-center gap-2">
            <Icon name={link.key === 'guide' ? 'documentation' : 'api'} size={14} />
            {t(link.labelKey)}
          </span>
        ),
        onSelect: () => window.open(link.url, '_blank', 'noopener'),
      }))}
    />
  );
}

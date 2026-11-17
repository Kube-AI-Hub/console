import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n';
import { HelpMenu, helpLinksFor } from '@/shell/HelpMenu';
import { DEFAULT_DOCUMENTS } from '@kube-ai-hub/api-client';

/**
 * Help menu links.
 *
 * The old console localised its documentation menu from the server config; the new BFF
 * answers the same shape at `/api/config`. These tests pin the language selection and the
 * blank-URL rule (a blank entry must disappear, not render a dead link).
 */
describe('helpLinksFor', () => {
  it('picks the language-specific guide and API reference', () => {
    const zh = helpLinksFor(DEFAULT_DOCUMENTS, 'zh');
    expect(zh.map((link) => link.url)).toEqual([DEFAULT_DOCUMENTS.zh.url, DEFAULT_DOCUMENTS.zh.api]);
    const en = helpLinksFor(DEFAULT_DOCUMENTS, 'en');
    expect(en.map((link) => link.url)).toEqual([DEFAULT_DOCUMENTS.en.url, DEFAULT_DOCUMENTS.en.api]);
  });

  it('drops a blank entry instead of rendering a dead link', () => {
    const links = helpLinksFor(
      {
        zh: { url: '', api: '/api-docs/' },
        en: { url: '/docs/', api: '' },
      },
      'zh',
    );
    expect(links).toHaveLength(1);
    expect(links[0]?.key).toBe('api');
  });
});

describe('HelpMenu', () => {
  it('renders the header trigger with an accessible name', () => {
    const { getByRole } = render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider locale="zh">
          <HelpMenu documents={DEFAULT_DOCUMENTS} />
        </I18nProvider>
      </QueryClientProvider>,
    );
    expect(getByRole('button', { name: '帮助与文档' })).toBeTruthy();
  });

  it('renders nothing when the deployment explicitly has no docs', () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider locale="zh">
          <HelpMenu documents={{ zh: { url: '', api: '' }, en: { url: '', api: '' } }} />
        </I18nProvider>
      </QueryClientProvider>,
    );
    // No dead link and no empty header button.
    expect(container.firstChild).toBeNull();
  });
});

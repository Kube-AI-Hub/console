import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { MultiClusterListPage } from '@/pages/cluster/MultiClusterListPage';

/**
 * The list shows how each cluster is reached.
 *
 * `connectionType` and the API endpoint had been on `ClusterSummary` all along and were
 * rendered nowhere, so the one question a reader asks first when a member cluster stops
 * answering — is it direct or behind the agent, and what address is the platform calling
 * — required opening every cluster's detail page.
 *
 * The three states matter: `direct`, `proxy`, and a value this build does not know. The
 * last one must render as a dash rather than being folded into one of the two known
 * kinds; guessing "proxy" because it is the common case would hide a real fact.
 */
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

/** One cluster object in the shape the API returns, before flattening. */
const cluster = (name: string, type: string | undefined, endpoint: string | undefined) => ({
  metadata: { name, creationTimestamp: '2026-11-01T00:00:00Z', labels: {} },
  spec: {
    enable: true,
    provider: 'Kube AI Hub',
    ...(type || endpoint
      ? { connection: { ...(type ? { type } : {}), ...(endpoint ? { kubernetesAPIEndpoint: endpoint } : {}) } }
      : {}),
  },
  status: { conditions: [{ type: 'Ready', status: 'True' }], nodeCount: 3, kubernetesVersion: 'v1.28.15' },
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="zh"><MultiClusterListPage /></I18nProvider>
    </QueryClientProvider>,
  );
}

function stub(items: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    // Permission probe: allow, so the add button does not change what is rendered.
    if (url.pathname.includes('/selfsubjectaccessreviews')) return json({ status: { allowed: true } });
    if (url.pathname.includes('/config')) return json({ multicluster: true });
    return json({ items, totalItems: items.length });
  }));
}

describe('cluster list connection columns', () => {
  it('renders direct and proxy in Chinese, and sizes each badge to its label', async () => {
    stub([
      cluster('host', 'direct', 'https://10.233.0.1:443'),
      cluster('agent', 'proxy', 'https://10.233.8.58:6443'),
    ]);
    mount();

    const direct = await screen.findByText('直连');
    const proxy = await screen.findByText('代理');
    expect(direct).toBeInTheDocument();
    expect(proxy).toBeInTheDocument();

    // The raw wire values must not leak into the page: they are what this column
    // replaces.
    expect(screen.queryByText('direct')).toBeNull();
    expect(screen.queryByText('proxy')).toBeNull();

    // Each badge is a direct child of its cell, so it can size to its text. A
    // `flex flex-col` wrapper would stretch it to the column width.
    expect(direct.closest('td')).not.toBeNull();
    expect(direct.closest('td')?.firstElementChild).toBe(direct);
  });

  it('shows the API endpoint with the full value in the title', async () => {
    stub([cluster('agent', 'proxy', 'https://10.233.8.58:6443')]);
    mount();

    const endpoint = await screen.findByText('https://10.233.8.58:6443');
    // Truncated in the cell, so the tooltip is the only way to read a clipped value.
    expect(endpoint).toHaveAttribute('title', 'https://10.233.8.58:6443');
    expect(endpoint).toHaveAttribute('data-ai-id', 'clusters:endpoint:agent');
  });

  it('renders a dash for a connection type this build does not know', async () => {
    // Not folded into "proxy": an unrecognised value is a fact the reader should see
    // as missing, not as the nearest known kind.
    stub([cluster('mystery', 'tunnel', undefined)]);
    mount();

    const row = await screen.findByText('mystery').then((node) => node.closest('tr') as HTMLElement);
    const cells = within(row).getAllByRole('cell');
    // Connection column and endpoint column both fall back to a dash.
    expect(cells.some((cell) => cell.textContent === '-')).toBe(true);
    expect(within(row).queryByText('直连')).toBeNull();
    expect(within(row).queryByText('代理')).toBeNull();
  });

  it('keeps the columns out of the way when the value is missing', async () => {
    stub([cluster('bare', undefined, undefined)]);
    mount();

    const row = await screen.findByText('bare').then((node) => node.closest('tr') as HTMLElement);
    expect(within(row).queryByText('直连')).toBeNull();
    expect(within(row).queryByText('代理')).toBeNull();
    expect(within(row).getAllByText('-').length).toBeGreaterThanOrEqual(2);
  });
});

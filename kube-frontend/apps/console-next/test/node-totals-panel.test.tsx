import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { NodeDetailPage } from '@/pages/cluster/NodeDetailPage';

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ name: 'gpu01' }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

/**
 * 资源总量 sits before 用量, and names resources the way a reader does.
 *
 * Two things were wrong before: the page opened on percentages (how full) with no
 * capacity headline (how big), and the allocation table printed raw API keys
 * (`ephemeral-storage`, `nvidia.com/gpu`) in monospace. The old console leads with
 * the totals and names the rows 临时存储 / GPU 总量.
 *
 * `hugepages-*` is excluded from both: it is a tuning knob, near-always zero, and
 * listing it under "totals" implies it is capacity to plan against.
 */
const raw = {
  metadata: { name: 'gpu01', resourceVersion: '42', labels: { xpu: 'nvidia-B200' } },
  spec: {},
  status: {
    conditions: [{ type: 'Ready', status: 'True' }],
    capacity: {
      cpu: '128', memory: '2147483648Ki', pods: '300', 'ephemeral-storage': '1073741824Ki',
      'hugepages-1Gi': '0', 'hugepages-2Mi': '0', 'nvidia.com/gpu': '8',
    },
    allocatable: { cpu: '128', memory: '2147483648Ki', pods: '300', 'nvidia.com/gpu': '8' },
    nodeInfo: { architecture: 'amd64', operatingSystem: 'linux' },
  },
};

function mount() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider locale="zh"><NodeDetailPage cluster="host" /></I18nProvider>
    </QueryClientProvider>,
  );
}

const stub = () => vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input instanceof Request ? input.url : input);
  // The accelerator table comes from the platform, not from a bundled copy.
  if (url.includes('/configs/gpu/kinds')) return Response.json([
    { resourceName: 'nvidia.com/gpu', displayName: 'GPU - Nvidia/英伟达', resourceType: 'GPU', default: true, memoryUnit: 'Mi' },
    { resourceName: 'cambricon.com/vmlu', displayName: 'vMLU - Cambricon/寒武纪', resourceType: 'MLU',
      memoryUnit: '%', memoryName: 'cambricon.com/mlu.smlu.vmemory', vcoresName: 'cambricon.com/mlu.smlu.vcore' },
  ]);
  return Response.json(raw);
}));

describe('node detail resource totals', () => {
  it('renders the totals block above the usage figures', async () => {
    stub();
    const view = mount();
    await screen.findByText('amd64');

    const totals = view.container.querySelector('[data-ai-id="node-detail:totals"]')!;
    const usage = view.container.querySelector('[data-ai-id="node-detail:usage"]')!;
    expect(totals).not.toBeNull();
    // Document order is the reading order: capacity first, then utilisation.
    expect(totals.compareDocumentPosition(usage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('names each total the way the old console does', async () => {
    stub();
    const view = mount();
    await screen.findByText('amd64');

    const totals = view.container.querySelector('[data-ai-id="node-detail:totals"]')!;
    // Accelerator rows come from a second request, so the block fills in two steps.
    await waitFor(() => expect(totals).toHaveTextContent('GPU - Nvidia/英伟达'));
    expect(totals).toHaveTextContent('CPU 总量');
    expect(totals).toHaveTextContent('内存总量');
    expect(totals).toHaveTextContent('容器组总量');
    expect(totals).toHaveTextContent('临时存储');
    // Accelerator rows use the platform's own displayName, which is what the old
    // console prints too — not a generic "GPU 总量".
    expect(totals).toHaveTextContent('GPU - Nvidia/英伟达');
    // The raw key must not survive as a label.
    expect(totals.textContent).not.toContain('ephemeral-storage');
    expect(totals.textContent).not.toContain('nvidia.com/gpu');
  });

  it('leaves hugepages out of the totals', async () => {
    stub();
    const view = mount();
    await screen.findByText('amd64');

    const totals = view.container.querySelector('[data-ai-id="node-detail:totals"]')!;
    await waitFor(() => expect(totals.querySelector('[data-ai-resource="nvidia.com/gpu"]')).not.toBeNull());
    const keys = [...totals.querySelectorAll('[data-ai-resource]')].map((node) => node.getAttribute('data-ai-resource'));
    expect(keys).toEqual(['cpu', 'memory', 'pods', 'ephemeral-storage', 'nvidia.com/gpu']);
  });

  it('names the allocation rows too, and drops hugepages there as well', async () => {
    stub();
    const view = mount();
    await screen.findByText('amd64');

    const table = view.container.querySelector('[data-ai-id="node-detail:capacity"]')!;
    await waitFor(() => expect(table).toHaveTextContent('GPU - Nvidia/英伟达'));
    const keys = [...table.querySelectorAll('[data-ai-resource]')].map((node) => node.getAttribute('data-ai-resource'));
    expect(keys).not.toContain('hugepages-1Gi');
    expect(keys).not.toContain('hugepages-2Mi');
    // Same vocabulary as the totals block, so the two sections read as one story.
    expect(table).toHaveTextContent('临时存储');
    expect(table).toHaveTextContent('GPU - Nvidia/英伟达');
    expect(table.textContent).not.toContain('ephemeral-storage');
  });

  it('keeps an unknown extended resource under its own name', async () => {
    // No catalogue entry means no translation — printing a guessed label would be
    // worse than the API's own identifier.
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      ...raw,
      status: { ...raw.status, capacity: { ...raw.status.capacity, 'example.com/foo': '3' },
        allocatable: { ...raw.status.allocatable, 'example.com/foo': '3' } },
    })));
    const view = mount();
    await screen.findByText('amd64');

    const table = view.container.querySelector('[data-ai-id="node-detail:capacity"]')!;
    expect(table).toHaveTextContent('example.com/foo');
  });
});

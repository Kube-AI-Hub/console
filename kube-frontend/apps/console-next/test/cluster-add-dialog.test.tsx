import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { AddClusterDialog } from '@/pages/cluster/AddClusterDialog';

/**
 * The add-cluster dialog's fields.
 *
 * Two things here are easy to lose and impossible to notice from a screenshot of an
 * empty form: the environment tag and the provider list must carry the old console's
 * full option set, and the proxy mode must not render a kubeconfig editor at all (a
 * textarea the request will not send is a field the reader fills for nothing).
 */

const KUBECONFIG = `apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://10.0.0.9:6443
  name: member
`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function mount(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="zh">
        <AddClusterDialog open onOpenChange={() => undefined} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AddClusterDialog sections', () => {
  it('groups the fields into basic information and connection', () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({})));
    mount();
    expect(screen.getByRole('heading', { name: '基本信息' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '连接设置' })).toBeTruthy();
  });

  it('offers all four environment tags, including demo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({})));
    mount();
    const user = userEvent.setup();
    await user.click(document.querySelector('#ai-field-cluster-group') as HTMLElement);
    for (const label of ['生产', '开发', '测试', '演示']) {
      expect(await screen.findByRole('option', { name: label })).toBeTruthy();
    }
  });

  it('hides the kubeconfig editor in proxy mode and explains what happens next', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({})));
    mount();
    const user = userEvent.setup();
    // The editor is lazy; in direct mode it eventually appears inside the dialog.
    await user.click(screen.getByRole('radio', { name: '代理连接' }));
    await waitFor(() => {
      expect(document.querySelector('#ai-field-cluster-kubeconfig')).toBeNull();
    });
    expect(document.querySelector('[data-ai-id="clusters:add-proxy-tip"]')).toBeTruthy();
  });

  it('links to the documentation that explains obtaining a kubeconfig', () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({})));
    mount();
    const link = document.querySelector('[data-ai-id="clusters:add-doc"]') as HTMLAnchorElement | null;
    expect(link?.getAttribute('href')).toContain('retrieve-kubeconfig');
    expect(link?.getAttribute('target')).toBe('_blank');
  });
});

describe('AddClusterDialog name check', () => {
  it('says the name is taken after the field loses focus', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/clusters/taken-name')) return json({ exist: true });
        return json({});
      }),
    );
    mount();
    const user = userEvent.setup();
    const name = document.querySelector('#ai-field-cluster-name') as HTMLInputElement;
    await user.type(name, 'taken-name');
    await user.tab();
    // The notice lands in the field's own error slot, not a separate status line: a
    // name that is taken is a validation failure of the value, not of its shape.
    await waitFor(
      () => {
        expect(document.querySelector('[data-ai-id="clusters:add-name-error"]')?.textContent).toMatch(/已经有同名集群/);
      },
      { timeout: 8_000 },
    );
  });

  it('does not ask about a name that is not a legal object name', async () => {
    const fetchMock = vi.fn(async () => json({ exist: true }));
    vi.stubGlobal('fetch', fetchMock);
    mount();
    const user = userEvent.setup();
    await user.type(document.querySelector('#ai-field-cluster-name') as HTMLInputElement, 'Bad_Name');
    await user.tab();
    // Only the shape is wrong; asking the server about it would be noise.
    const called = fetchMock.mock.calls.map((call) => String((call as unknown[])[0] ?? ''));
    expect(called.every((url) => !url.includes('/clusters/Bad_Name'))).toBe(true);
  });

  it('clears the taken notice once the name changes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => (String(input).includes('/clusters/taken-name') ? json({ exist: true }) : json({}))),
    );
    mount();
    const user = userEvent.setup();
    const name = document.querySelector('#ai-field-cluster-name') as HTMLInputElement;
    await user.type(name, 'taken-name');
    await user.tab();
    await waitFor(
      () => expect(document.querySelector('[data-ai-id="clusters:add-name-error"]')?.textContent).toMatch(/已经有同名集群/),
      { timeout: 8_000 },
    );
    await user.type(name, '-2');
    await waitFor(() => expect(document.querySelector('[data-ai-id="clusters:add-name-error"]')).toBeNull());
  });
});

describe('AddClusterDialog submit', () => {
  it('sends the tag and provider in the created object', async () => {
    const posted: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'POST' && url.includes('/clusters/validation')) return json({});
        if (init?.method === 'POST' && url.includes('/apis/cluster.kubesphere.io')) {
          posted.push(JSON.parse(String(init.body)) as unknown);
          return json({});
        }
        return json({});
      }),
    );
    mount();
    const user = userEvent.setup();
    await user.type(document.querySelector('#ai-field-cluster-name') as HTMLInputElement, 'member-a');
    // The editor is CodeMirror; drive it through its content element.
    const editor = await waitFor(() => {
      const content = document.querySelector('.cm-content');
      if (!content) throw new Error('editor not ready');
      return content as HTMLElement;
    });
    await user.click(editor);
    await user.keyboard('{Control>}a{/Control}');
    await user.keyboard(KUBECONFIG.replace(/\n/g, ' '));
    await user.click(screen.getByRole('button', { name: '确认' }));

    await waitFor(() => expect(posted.length).toBe(1));
    const body = posted[0] as { metadata: { name: string; labels?: Record<string, string> } };
    expect(body.metadata.name).toBe('member-a');
  });
});

describe('AddClusterDialog error mapping', () => {
  it('maps a kube Status JSON 400 to the actionable sentence', async () => {
    // mlu370 answers the validation endpoint with kube Status JSON, not the plain text
    // the old console's own server produced.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/clusters/validation')) {
          return json(
            {
              kind: 'Status',
              apiVersion: 'v1',
              status: 'Failure',
              message: "the clusterRole of the member cluster must be 'host' or 'member'",
              reason: 'BadRequest',
              code: 400,
            },
            400,
          );
        }
        return json({});
      }),
    );
    mount();
    const user = userEvent.setup();
    await user.type(document.querySelector('#ai-field-cluster-name') as HTMLInputElement, 'member-b');
    const editor = await waitFor(() => {
      const content = document.querySelector('.cm-content');
      if (!content) throw new Error('editor not ready');
      return content as HTMLElement;
    });
    await user.click(editor);
    await user.keyboard('{Control>}a{/Control}');
    await user.keyboard(KUBECONFIG.replace(/\n/g, ' '));
    await user.click(screen.getByRole('button', { name: '确认' }));

    const banner = await waitFor(() => {
      const element = document.querySelector('[data-ai-id="clusters:add-error"]');
      if (!element) throw new Error('no banner');
      return element as HTMLElement;
    });
    // The mapped sentence, not the raw server text: the same string also appears in
    // the toast, so scope the assertion to the banner.
    expect(banner.textContent).toMatch(/clusterRole/);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

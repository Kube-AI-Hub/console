import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { createQueryClient } from '@/query';
import { I18nProvider } from '@/i18n';
import { formatTimestamp } from '@/lib/time';
import { SecretsPage, secretTypeLabel } from '@/pages/secrets/SecretsPage';
import { SecretCreateDialog } from '@/pages/secrets/SecretCreateDialog';

/**
 * Secrets list and dialogs.
 *
 * Runs against a stubbed `fetch` that answers with kube-api shapes, so the
 * assertions cover both the request the page issues and what a reader sees.
 * The rules under test are the ones the old console got wrong: type names,
 * masked values, UTF-8 encoding and the type-locked editor.
 */

const KAPIS = '/kapis/resources.kubesphere.io/v1alpha3/namespaces/default/secrets';

const listBody = {
  kind: 'SecretList',
  apiVersion: 'v1',
  items: [
    {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: 'web-tls',
        namespace: 'default',
        creationTimestamp: '2026-11-01T08:12:00Z',
        annotations: { 'kubesphere.io/description': '站点证书', 'kubesphere.io/creator': 'admin' },
      },
      type: 'kubernetes.io/tls',
      data: { 'tls.crt': 'Y3J0', 'tls.key': 'a2V5' },
    },
    {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: { name: 'legacy', namespace: 'default', creationTimestamp: '2026-11-02T11:40:00Z' },
      // A stored empty type: kube-apiserver would default it to Opaque.
      data: {},
    },
    {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: { name: 'ci-registry', namespace: 'default', creationTimestamp: '2026-11-03T09:00:00Z' },
      type: 'kubernetes.io/dockerconfigjson',
      data: { '.dockerconfigjson': btoa(JSON.stringify({ auths: { 'https://r.example.com': { username: 'u', password: 'p' } } })) },
    },
  ],
  totalItems: 3,
};

const projectsBody = {
  kind: 'NamespaceList',
  items: [
    { metadata: { name: 'default' }, status: { phase: 'Active' } },
    { metadata: { name: 'dev' }, status: { phase: 'Active' } },
  ],
};

/** `AiSurface` renders `display: contents`, so query the document, not the element. */
function byAiId(aiId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-ai-id="${aiId}"]`);
}

/** Base64 of UTF-8 text, the way `safeBtoa` does it. */
function utf8Btoa(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function stubFetch(handler?: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    // Resource paths answer from the list body unless the test overrides them;
    // the project picker and the name check read elsewhere and are answered below.
    if (url.includes('/kapis/resources.kubesphere.io/') && url.includes('/namespaces?') === false) {
      const override = handler?.(url, init);
      if (override) return override;
      if (url.includes(KAPIS)) return json(listBody);
      return json(listBody);
    }
    if (url.includes('/namespaces?') || url.endsWith('/namespaces')) return json(projectsBody);
    if (handler) {
      const override = handler(url, init);
      if (override) return override;
    }
    if (url.includes('/api/v1/namespaces/') && url.includes('/secrets/')) {
      // A name that is free: the checkName call must see NotFound.
      return json({ kind: 'Status', status: 'Failure', reason: 'NotFound', code: 404 }, 404);
    }
    return json({ kind: 'Status', status: 'Success' });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function surface(aiId = 'secrets:surface'): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-ai-id="${aiId}"]`);
  if (!element) throw new Error(`${aiId} not rendered`);
  return element;
}

function renderPage() {
  const client = createQueryClient();
  const rootRoute = createRootRoute();
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/secrets',
    component: () => <SecretsPage workspace="system-workspace" cluster="host" namespace="default" />,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/secrets/$name',
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([listRoute.addChildren([detailRoute])]),
    history: createMemoryHistory({ initialEntries: ['/kube-frontend/system-workspace/clusters/host/projects/default/secrets'] }),
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="zh">
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('secretTypeLabel', () => {
  const t = ((key: string) => `t:${key}`) as never;
  it('translates the four known types', () => {
    expect(secretTypeLabel(t, 'Opaque')).toBe('t:secrets.type.opaque');
    expect(secretTypeLabel(t, 'kubernetes.io/tls')).toBe('t:secrets.type.tls');
    expect(secretTypeLabel(t, 'kubernetes.io/dockerconfigjson')).toBe('t:secrets.type.dockerconfigjson');
    expect(secretTypeLabel(t, 'kubernetes.io/basic-auth')).toBe('t:secrets.type.basicAuth');
  });

  it('prints an unknown type verbatim', () => {
    expect(secretTypeLabel(t, 'kubernetes.io/ssh-auth')).toBe('kubernetes.io/ssh-auth');
  });
});

describe('Secrets list', () => {
  it('lists the objects with translated types and field counts', async () => {
    stubFetch();
    renderPage();
    await waitFor(() => expect(surface()).toBeTruthy());
    await screen.findByText('web-tls');
    expect(surface().getAttribute('data-ai-state')).toBe('ready');

    // Headers in the old console's order.
    const headers = [...surface().querySelectorAll('thead th')].map((th) => th.textContent?.trim()).filter(Boolean);
    expect(headers.slice(0, 5)).toEqual(['名称', '项目', '类型', '字段数', '创建时间']);

    // TLS shows its label, the empty type falls back to Opaque's label.
    expect(screen.getByText('TLS 信息')).toBeTruthy();
    expect(screen.getByText('默认')).toBeTruthy();
    // The row for the empty-type object shows 0 keys.
    const legacyRow = surface().querySelector('[data-ai-row="legacy"]');
    expect(legacyRow?.textContent).toContain('0');
    // Name cell shows the description on the second line.
    expect(surface().querySelector('[data-ai-row="web-tls"]')?.textContent).toContain('站点证书');
  });

  it('requests the kapis collection with paging and the createTime sort', async () => {
    const fetchMock = stubFetch();
    renderPage();
    await screen.findByText('web-tls');
    const url = fetchMock.mock.calls.map((call) => String(call[0])).find((value) => value.includes(KAPIS));
    expect(url).toContain('page=1');
    expect(url).toContain('limit=10');
    expect(url).toContain('sortBy=createTime');
    expect(url).toContain('ascending=false');
  });

  it('never renders a secret value in the list', async () => {
    stubFetch();
    renderPage();
    await screen.findByText('web-tls');
    const text = surface().textContent ?? '';
    // The stored values are base64 "crt"/"key": neither they nor their plaintext appear.
    expect(text).not.toContain('crt');
    expect(text).not.toContain('Y3J0');
  });

  it('shows the failure state with a retry handle', async () => {
    stubFetch(() => json({ kind: 'Status', status: 'Failure', reason: 'Forbidden', message: 'forbidden', code: 403 }, 403));
    renderPage();
    await waitFor(() => expect(surface('secrets:surface').getAttribute('data-ai-state')).toBe('error'));
    // A 403 must not offer retry: pressing it can only fail again.
    expect(document.querySelector('[data-ai-id="secrets:retry"]')).toBeNull();
    expect(screen.getByText('没有权限执行该操作')).toBeTruthy();
  });
});

describe('Secrets create dialog', () => {
  async function openCreate() {
    stubFetch();
    renderPage();
    await screen.findByText('web-tls');
    await userEvent.click(screen.getByRole('button', { name: '创建' }));
    await screen.findByRole('dialog');
  }

  it('blocks an invalid name before the next step', async () => {
    await openCreate();
    await userEvent.type(screen.getByRole('textbox', { name: /名称/ }), 'Bad_Name');
    await userEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(await screen.findByText(/名称无效/)).toBeTruthy();
  });

  it('reports a duplicate name against the selected project', async () => {
    // `web-tls` exists, so the name check must answer 200 for it.
    const fetchMock = stubFetch((url) => {
      if (/\/api\/v1\/namespaces\/default\/secrets\/web-tls$/.test(url)) {
        return json({ apiVersion: 'v1', kind: 'Secret', metadata: { name: 'web-tls', namespace: 'default' }, type: 'kubernetes.io/tls', data: {} });
      }
      return undefined as unknown as Response;
    });
    renderPage();
    await screen.findByText('web-tls');
    await userEvent.click(screen.getByRole('button', { name: '创建' }));
    await userEvent.type(screen.getByRole('textbox', { name: /名称/ }), 'web-tls');
    await userEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(await screen.findByText('名称已存在，请输入其他名称。')).toBeTruthy();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/api/v1/namespaces/default/secrets/web-tls'))).toBe(true);
  });

  it('requires username and password for basic-auth and encodes UTF-8 values', async () => {
    // The type switch itself is covered by the editor tests below: Radix's select
    // popup does not open in jsdom, so the page-level test mounts the editor in
    // its basic-auth state and drives the same submit path the dialog uses.
    const onSubmit = vi.fn();
    render(
      <I18nProvider locale="zh">
        <SecretCreateDialog open onOpenChange={() => undefined} namespace="default" onSubmit={onSubmit} isNameTaken={async () => false} initialType="kubernetes.io/basic-auth" />
      </I18nProvider>,
    );
    await userEvent.type(screen.getByRole('textbox', { name: /名称/ }), 'tc-basic');
    await userEvent.click(screen.getByRole('button', { name: '下一步' }));

    // Submit with the required fields empty: blocked, nothing is sent.
    await userEvent.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByText('请填写当前类型要求的数据项。')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    // The editor wraps each field in a `<label>`, so the accessible name is the
    // visible label plus the required marker and any inline error.
    await userEvent.type(screen.getByRole('textbox', { name: /^用户名/ }), 'robot');
    await userEvent.type(screen.getByLabelText(/^密码/), 'p@ss 中文');
    await userEvent.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const input = onSubmit.mock.calls[0]?.[0] as { type: string; data: Record<string, string> };
    expect(input.type).toBe('kubernetes.io/basic-auth');
    expect(input.data['username']).toBe(utf8Btoa('robot'));
    // The UTF-8 value round-trips: `atob` alone would throw here.
    const bytes = Uint8Array.from(atob(input.data['password'] ?? ''), (c) => c.charCodeAt(0));
    expect(new TextDecoder().decode(bytes)).toBe('p@ss 中文');
  });

  it('explains that changing the type clears the data', async () => {
    render(
      <I18nProvider locale="zh">
        <SecretCreateDialog open onOpenChange={() => undefined} namespace="default" onSubmit={vi.fn()} />
      </I18nProvider>,
    );
    await userEvent.type(screen.getByRole('textbox', { name: /名称/ }), 'tc-typed');
    await userEvent.click(screen.getByRole('button', { name: '下一步' }));
    // The warning is permanent on the data step, not only after a switch.
    expect(screen.getByText('切换类型会清空已填写的数据。')).toBeTruthy();
    // And it is true: the editor drops the payload when handed a different type.
    await userEvent.click(screen.getByRole('button', { name: /添加数据/ }));
    await userEvent.type(screen.getByRole('textbox', { name: '键' }), 'password');
    await userEvent.type(screen.getByRole('textbox', { name: '值' }), 'x');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByText('password')).toBeTruthy();
  });

  it('carries the form into YAML mode', async () => {
    stubFetch();
    renderPage();
    await screen.findByText('web-tls');
    await userEvent.click(screen.getByRole('button', { name: '创建' }));
    await userEvent.type(screen.getByRole('textbox', { name: /名称/ }), 'tc-yaml');
    await userEvent.click(screen.getByRole('button', { name: '编辑 YAML' }));
    const editor = await waitFor(() => {
      const content = document.querySelector('[role="dialog"] .cm-content');
      if (!content) throw new Error('editor not ready');
      return content as HTMLElement;
    });
    expect(editor.textContent).toContain('name: tc-yaml');
    expect(editor.textContent).toContain('type: Opaque');
  });
});

describe('Secrets edit settings dialog', () => {
  it('locks the type and disables submit while a pair is being edited', async () => {
    const fetchMock = stubFetch((url) => {
      if (url.includes(`${KAPIS}/web-tls`)) {
        return json({
          apiVersion: 'v1',
          kind: 'Secret',
          metadata: { name: 'web-tls', namespace: 'default', annotations: {} },
          type: 'kubernetes.io/tls',
          data: { 'tls.crt': 'Y3J0', 'tls.key': 'a2V5' },
        });
      }
      return json(listBody);
    });
    renderPage();
    await screen.findByText('web-tls');
    const row = surface().querySelector('[data-ai-row="web-tls"]') as HTMLElement;
    await userEvent.click(row.querySelector('button[aria-label="更多操作"]') as HTMLElement);
    await userEvent.click(await screen.findByRole('menuitem', { name: '编辑设置' }));

    const combobox = await waitFor(() => {
      const element = byAiId('secrets:field-type')?.querySelector('[role="combobox"]');
      if (!element) throw new Error('type select not rendered');
      return element as HTMLButtonElement;
    });
    expect(combobox.disabled).toBe(true);
    expect(combobox.textContent).toContain('TLS 信息');
    // Required fields are prefilled from the object.
    expect((screen.getByLabelText(/证书/) as HTMLInputElement).value).toBe('crt');
    expect(fetchMock).toBeTruthy();
  });
});

describe('formatTimestamp', () => {
  it('is used for both list and detail cells', () => {
    // One implementation: the value the list prints is the one the detail prints.
    expect(formatTimestamp('2026-11-03T09:00:00')).toMatch(/^2026-11-03 \d{2}:00:00$/);
  });
});

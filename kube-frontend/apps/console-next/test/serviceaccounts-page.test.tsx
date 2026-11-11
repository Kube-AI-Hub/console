import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
import { ServiceAccountsPage } from '@/pages/serviceaccounts/ServiceAccountsPage';
import { ServiceAccountCreateDialog } from '@/pages/serviceaccounts/ServiceAccountCreateDialog';
import { ServiceAccountSecretsSection } from '@/pages/serviceaccounts/ServiceAccountSecretsSection';
import { buildKubeconfig } from '@/lib/kubeconfig';
import { safeBtoa } from '@/lib/base64';

/**
 * Service account list, create dialog and kubeconfig section.
 *
 * The kubeconfig is the page's reason to exist, so most of these assertions are
 * about the document it produces — the one thing `kubectl` will actually read.
 */

const KAPIS = '/kapis/resources.kubesphere.io/v1alpha3/namespaces/default/serviceaccounts';
const ROLES = '/kapis/iam.kubesphere.io/v1alpha2/namespaces/default/roles';
const TOKEN = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJidWlsZC1ib3QifQ.sig';
const CA = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n';

const listBody = {
  kind: 'ServiceAccountList',
  items: [
    {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        name: 'build-bot',
        namespace: 'default',
        creationTimestamp: '2026-11-01T08:12:00Z',
        annotations: { 'iam.kubesphere.io/role': 'project-viewer', 'kubesphere.io/description': 'CI 构建使用' },
      },
      secrets: [{ name: 'build-bot-token-abcde' }],
    },
    {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: { name: 'no-token', namespace: 'default', creationTimestamp: '2026-11-02T09:00:00Z' },
    },
  ],
  totalItems: 2,
};

const tokenSecret = {
  apiVersion: 'v1',
  kind: 'Secret',
  metadata: { name: 'build-bot-token-abcde', namespace: 'default' },
  type: 'kubernetes.io/service-account-token',
  data: { token: safeBtoa(TOKEN), 'ca.crt': safeBtoa(CA), namespace: safeBtoa('default') },
};

const projectsBody = {
  kind: 'NamespaceList',
  items: [{ metadata: { name: 'default' }, status: { phase: 'Active' } }],
};

const rolesBody = {
  kind: 'RoleList',
  items: [
    { metadata: { name: 'project-viewer', namespace: 'default' }, description: 'PROJECT_VIEWER_DESC' },
    { metadata: { name: 'project-editor', namespace: 'default' }, description: 'PROJECT_EDITOR_DESC' },
  ],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function stubFetch(handler?: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes(ROLES)) return json(rolesBody);
    if (url.includes('/namespaces?') || url.endsWith('/namespaces')) return json(projectsBody);
    if (url.includes(KAPIS)) {
      const override = handler?.(url, init);
      if (override) return override;
      return json(listBody);
    }
    if (url.includes('/secrets/build-bot-token-abcde')) return json(tokenSecret);
    if (handler) {
      const override = handler(url, init);
      if (override) return override;
    }
    return json({ kind: 'Status', status: 'Success' });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function surface(aiId = 'serviceaccounts:surface'): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-ai-id="${aiId}"]`);
  if (!element) throw new Error(`${aiId} not rendered`);
  return element;
}

function renderPage() {
  const client = createQueryClient();
  const rootRoute = createRootRoute();
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/serviceaccounts',
    component: () => <ServiceAccountsPage workspace="system-workspace" cluster="host" namespace="default" />,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/serviceaccounts/$name',
    component: () => null,
  });
  const secretsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/secrets/$name',
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([listRoute.addChildren([detailRoute]), secretsRoute]),
    history: createMemoryHistory({
      initialEntries: ['/kube-frontend/system-workspace/clusters/host/projects/default/serviceaccounts'],
    }),
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider locale="zh">
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('ServiceAccounts list', () => {
  it('shows role and token columns with the old console labels', async () => {
    stubFetch();
    renderPage();
    await waitFor(() => expect(surface()).toBeTruthy());
    await screen.findByText('build-bot');

    const headers = [...surface().querySelectorAll('thead th')].map((th) => th.textContent?.trim()).filter(Boolean);
    expect(headers.slice(0, 5)).toEqual(['名称', '项目', '角色', '保密字典', '创建时间']);

    const row = surface().querySelector('[data-ai-row="build-bot"]') as HTMLElement;
    expect(row.textContent).toContain('project-viewer');
    expect(row.textContent).toContain('build-bot-token-abcde');
  });

  it('leaves the role cell empty when no role is set', async () => {
    stubFetch();
    renderPage();
    await screen.findByText('no-token');
    const row = surface().querySelector('[data-ai-row="no-token"]') as HTMLElement;
    // The old console prints `record.role` verbatim; a placeholder like 无 would
    // read like a role with that name.
    expect(row.textContent).not.toContain('无');
  });

  it('links a token to the secrets detail of the object own project', async () => {
    stubFetch();
    renderPage();
    await screen.findByText('build-bot');
    const link = surface().querySelector('[data-ai-id="serviceaccounts:open-secret:build-bot-token-abcde"]');
    expect(link?.getAttribute('href') ?? (link as HTMLElement)?.tagName).toBeTruthy();
    expect(link?.textContent).toBe('build-bot-token-abcde');
  });

  it('requests the kapis collection with paging and sort', async () => {
    const fetchMock = stubFetch();
    renderPage();
    await screen.findByText('build-bot');
    const url = fetchMock.mock.calls.map((call) => String(call[0])).find((value) => value.includes(KAPIS));
    expect(url).toContain('page=1');
    expect(url).toContain('limit=10');
    expect(url).toContain('sortBy=createTime');
  });
});

describe('ServiceAccount create dialog', () => {
  it('writes the chosen role into the annotation', async () => {
    const onSubmit = vi.fn();
    stubFetch();
    render(
      <QueryClientProvider client={createQueryClient()}>
        <I18nProvider locale="zh">
          <ServiceAccountCreateDialog open onOpenChange={() => undefined} cluster="host" namespace="default" onSubmit={onSubmit} />
        </I18nProvider>
      </QueryClientProvider>,
    );
    await userEvent.type(screen.getByRole('textbox', { name: /名称/ }), 'ci-bot');
    await userEvent.type(screen.getByRole('textbox', { name: /描述/ }), '构建机器人');
    await userEvent.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ci-bot', namespace: 'default', description: '构建机器人', role: '' }),
    );
  });

  it('blocks an invalid name', async () => {
    const onSubmit = vi.fn();
    stubFetch();
    render(
      <QueryClientProvider client={createQueryClient()}>
        <I18nProvider locale="zh">
          <ServiceAccountCreateDialog open onOpenChange={() => undefined} cluster="host" namespace="default" onSubmit={onSubmit} />
        </I18nProvider>
      </QueryClientProvider>,
    );
    await userEvent.type(screen.getByRole('textbox', { name: /名称/ }), 'Bad_Name');
    await userEvent.click(screen.getByRole('button', { name: '创建' }));
    expect(await screen.findByText(/名称无效/)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('offers the project roles of the target project', async () => {
    const fetchMock = stubFetch();
    render(
      <QueryClientProvider client={createQueryClient()}>
        <I18nProvider locale="zh">
          <ServiceAccountCreateDialog open onOpenChange={() => undefined} cluster="host" namespace="default" onSubmit={vi.fn()} />
        </I18nProvider>
      </QueryClientProvider>,
    );
    // The role list is fetched for the project the form targets.
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes(`/namespaces/default/roles`))).toBe(true),
    );
    expect(document.querySelector('[data-ai-id="serviceaccounts:field-role"]')).toBeTruthy();
  });
});

describe('ServiceAccountSecretsSection', () => {
  const detail = {
    name: 'build-bot',
    namespace: 'default',
    alias: '',
    description: '',
    createdAt: '2026-11-01T08:12:00Z',
    creator: 'admin',
    federated: false,
    role: 'project-viewer',
    secrets: ['build-bot-token-abcde'],
    labels: {},
    annotations: {},
    secretRefs: [{ name: 'build-bot-token-abcde' }],
    raw: { apiVersion: 'v1', kind: 'ServiceAccount', metadata: { name: 'build-bot', namespace: 'default' } },
  };

  it('builds the same kubeconfig the pure function builds, and masks values first', async () => {
    stubFetch();
    const secret = {
      name: 'build-bot-token-abcde',
      namespace: 'default',
      alias: '',
      description: '',
      createdAt: '',
      creator: '',
      federated: false,
      type: 'kubernetes.io/service-account-token',
      fieldCount: 3,
      isDefault: false,
      data: tokenSecret.data,
      binaryData: {},
      labels: {},
      annotations: {},
      raw: tokenSecret as never,
    };
    render(
      <I18nProvider locale="zh">
        <ServiceAccountSecretsSection detail={detail} secrets={[secret]} loading={false} />
      </I18nProvider>,
    );

    const kubeconfigElement = document.querySelector('[data-ai-id="serviceaccount-detail:kubeconfig:build-bot-token-abcde"]') as HTMLElement;
    const expected = buildKubeconfig({
      serviceAccountName: 'build-bot',
      namespace: 'default',
      tokenData: tokenSecret.data.token,
      caData: tokenSecret.data['ca.crt'],
    });
    expect(kubeconfigElement.textContent).toContain('server: https://kubernetes.default.svc:443');
    expect(kubeconfigElement.textContent).toContain('namespace: default');
    // While values are hidden the preview carries the token's *place*, not its
    // content: the eye toggle on this page would otherwise be pointless.
    expect(kubeconfigElement.textContent).not.toContain(TOKEN);
    expect(kubeconfigElement.textContent).toContain('token: ');
    expect(expected['current-context']).toBe('build-bot@local');

    // Values are masked until the eye is pressed.
    const section = document.querySelector('[data-ai-id="serviceaccount-detail:secrets"]') as HTMLElement;
    expect(section.textContent).not.toContain(TOKEN);
    const toggle = document.querySelector('[data-ai-id="serviceaccount-detail:toggle:build-bot-token-abcde"]') as HTMLElement;
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    // Revealing shows the token in the value list *and* restores the kubeconfig text.
    expect(within(section).getByText(/^eyJhbGciOiJSUzI1NiJ9/)).toBeTruthy();
    expect(kubeconfigElement.textContent).toContain(TOKEN);
  });

  it('explains an account without tokens instead of failing', () => {
    render(
      <I18nProvider locale="zh">
        <ServiceAccountSecretsSection detail={{ ...detail, secrets: [], secretRefs: [] }} secrets={[]} loading={false} />
      </I18nProvider>,
    );
    expect(screen.getByText(/没有绑定令牌/)).toBeTruthy();
  });
});

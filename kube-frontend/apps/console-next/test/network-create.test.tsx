import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { NetworkResourceCreateDialog } from '@/pages/app-workloads/NetworkResourceCreateDialog';
import { networkManifest, validNetworkName, validNetworkPort } from '@/pages/app-workloads/networkManifest';

describe('network resource manifests', () => {
  it('uses numeric ports, selectors and protocol for a service', () => {
    const body = networkManifest('services', { name: 'svc', namespace: 'default', app: 'web', port: 8080, targetPort: 'http', protocol: 'UDP' });
    expect(body.spec).toEqual({ type: 'ClusterIP', selector: { app: 'web' },
      ports: [{ name: 'port-1', port: 8080, targetPort: 'http', protocol: 'UDP' }] });
  });
  it('separates ExternalName and headless service semantics', () => {
    expect(networkManifest('services', { serviceType: 'ExternalName', externalName: 'db.example.com' }).spec)
      .toEqual({ type: 'ExternalName', externalName: 'db.example.com' });
    expect(networkManifest('services', { serviceType: 'Headless' }).spec).toMatchObject({ type: 'ClusterIP', clusterIP: 'None' });
  });
  it('builds v1 ingress backend, path type and TLS', () => {
    const body = networkManifest('ingresses', {
      name: 'route', namespace: 'default', host: 'app.example.com', serviceName: 'svc', servicePort: '8080',
      path: '/app', pathType: 'Exact', tlsSecret: 'tls', ingressClass: 'nginx',
    });
    expect(body.apiVersion).toBe('networking.k8s.io/v1');
    expect(body.spec).toMatchObject({
      ingressClassName: 'nginx', tls: [{ hosts: ['app.example.com'], secretName: 'tls' }],
      rules: [{ host: 'app.example.com', http: { paths: [{ path: '/app', pathType: 'Exact',
        backend: { service: { name: 'svc', port: { number: 8080 } } } }] } }],
    });
  });
  it('validates DNS labels and IntOrString ports', () => {
    expect(validNetworkName('web-svc')).toBe(true);
    expect(validNetworkName('UPPER')).toBe(false);
    expect(validNetworkPort('http')).toBe(true);
    expect(validNetworkPort('65535')).toBe(true);
    for (const value of ['0', '65536', '1.5', 'bad_name']) expect(validNetworkPort(value)).toBe(false);
  });
});

describe('network create dialog', () => {
  it('retains form data when the server rejects creation', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Response(JSON.stringify(init?.method === 'POST' ? { message: 'service already exists' } : {
        items: [{ metadata: { name: 'default' } }], totalItems: 1,
      }), { status: init?.method === 'POST' ? 409 : 200, headers: { 'content-type': 'application/json' } }),
    ));
    const close = vi.fn();
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider locale="zh"><NetworkResourceCreateDialog kind="services" cluster="host" namespace="default" onOpenChange={close} /></I18nProvider>
    </QueryClientProvider>);
    await userEvent.type(screen.getByRole('textbox', { name: /^名称/ }), 'web-svc');
    await userEvent.click(screen.getByRole('button', { name: '确认' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('service already exists'));
    expect(screen.getByRole('textbox', { name: /^名称/ })).toHaveValue('web-svc');
    expect(close).not.toHaveBeenCalled();
  });
});

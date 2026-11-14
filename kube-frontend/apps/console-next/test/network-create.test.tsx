import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { CreateServiceDialog } from '@/pages/app-workloads/CreateServiceDialog';
import {
  ingressManifest,
  serviceManifest,
  validNetworkName,
  validNetworkPort,
  validNodePort,
} from '@/pages/app-workloads/networkManifest';

/** Minimal draft; individual cases override the field under test. */
const serviceDraft = {
  name: 'svc',
  namespace: 'default',
  serviceType: 'ClusterIP' as const,
  protocol: 'TCP',
  port: '8080',
  targetPort: 'http',
  nodePort: '',
  externalName: '',
  selectorApp: 'web',
};

describe('network resource manifests', () => {
  it('uses numeric ports, selectors and protocol for a service', () => {
    const body = serviceManifest(serviceDraft);
    expect(body.spec).toEqual({
      type: 'ClusterIP',
      selector: { app: 'web' },
      ports: [{ name: 'port-1', port: 8080, targetPort: 'http', protocol: 'TCP' }],
    });
  });

  it('adds a node port only for a NodePort service that specifies one', () => {
    const withPort = serviceManifest({ ...serviceDraft, serviceType: 'NodePort', nodePort: '30080' });
    expect((withPort.spec as Record<string, unknown>)['ports']).toEqual([
      { name: 'port-1', port: 8080, targetPort: 'http', protocol: 'TCP', nodePort: 30080 },
    ]);
    const autoAssigned = serviceManifest({ ...serviceDraft, serviceType: 'NodePort' });
    expect((autoAssigned.spec as Record<string, unknown>)['ports']).toEqual([
      { name: 'port-1', port: 8080, targetPort: 'http', protocol: 'TCP' },
    ]);
  });

  it('separates ExternalName and headless service semantics', () => {
    expect(serviceManifest({ ...serviceDraft, serviceType: 'ExternalName', externalName: 'db.example.com' }).spec).toEqual({
      type: 'ExternalName',
      externalName: 'db.example.com',
    });
    expect(serviceManifest({ ...serviceDraft, serviceType: 'Headless' }).spec).toMatchObject({
      type: 'ClusterIP',
      clusterIP: 'None',
    });
  });

  it('groups paths of one host into a single ingress rule and keeps TLS hosts unique', () => {
    const body = ingressManifest({
      name: 'route',
      namespace: 'default',
      ingressClass: 'nginx',
      tlsSecret: 'tls',
      rules: [
        { host: 'app.example.com', path: '/app', pathType: 'Exact', serviceName: 'svc', servicePort: '8080' },
        { host: 'app.example.com', path: '/static', pathType: 'Prefix', serviceName: 'svc', servicePort: 'http' },
        { host: 'other.example.com', path: '/', pathType: 'Prefix', serviceName: 'other', servicePort: '80' },
      ],
    });
    expect(body.apiVersion).toBe('networking.k8s.io/v1');
    expect(body.spec).toMatchObject({
      ingressClassName: 'nginx',
      tls: [{ hosts: ['app.example.com', 'other.example.com'], secretName: 'tls' }],
      rules: [
        {
          host: 'app.example.com',
          http: {
            paths: [
              { path: '/app', pathType: 'Exact', backend: { service: { name: 'svc', port: { number: 8080 } } } },
              { path: '/static', pathType: 'Prefix', backend: { service: { name: 'svc', port: { name: 'http' } } } },
            ],
          },
        },
        {
          host: 'other.example.com',
          http: { paths: [{ path: '/', pathType: 'Prefix', backend: { service: { name: 'other', port: { number: 80 } } } }] },
        },
      ],
    });
  });

  it('validates DNS labels, IntOrString ports and the node-port range', () => {
    expect(validNetworkName('web-svc')).toBe(true);
    expect(validNetworkName('UPPER')).toBe(false);
    expect(validNetworkPort('http')).toBe(true);
    expect(validNetworkPort('65535')).toBe(true);
    for (const value of ['0', '65536', '1.5', 'bad_name']) expect(validNetworkPort(value)).toBe(false);
    expect(validNodePort('30080')).toBe(true);
    expect(validNodePort('29999')).toBe(false);
    expect(validNodePort('32768')).toBe(false);
  });
});

describe('service create dialog', () => {
  it('keeps the form and shows the conflict when the server rejects creation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Response(
          JSON.stringify(
            init?.method === 'POST'
              ? { code: 'conflict', message: 'services "web-svc" already exists' }
              : { items: [], totalItems: 0 },
          ),
          { status: init?.method === 'POST' ? 409 : 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    const close = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <I18nProvider locale="zh">
          <CreateServiceDialog cluster="host" namespace="default" onOpenChange={close} />
        </I18nProvider>
      </QueryClientProvider>,
    );
    const name = document.querySelector<HTMLInputElement>('[data-ai-id="services-create:name"]');
    if (!name) throw new Error('name input not rendered');
    await userEvent.type(name, 'web-svc');
    await userEvent.click(screen.getByRole('button', { name: '确认' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('名称已存在'));
    expect(name).toHaveValue('web-svc');
    expect(close).not.toHaveBeenCalled();
  });
});

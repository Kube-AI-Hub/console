import type { KubeObject } from '@kube-ai-hub/api-client';

export type NetworkKind = 'services' | 'ingresses';

export function validNetworkName(value: string): boolean {
  return value.length <= 63 && /^[a-z]([-a-z0-9]*[a-z0-9])?$/.test(value);
}

export function validNetworkPort(value: string): boolean {
  if (/^\d+$/.test(value)) return Number(value) >= 1 && Number(value) <= 65535;
  return value.length <= 15 && /[a-z]/.test(value) && /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(value);
}

export function networkManifest(kind: NetworkKind, values: Record<string, unknown>): KubeObject {
  const text = (key: string, fallback = '') => String(values[key] ?? fallback).trim();
  const metadata = { name: text('name'), namespace: text('namespace') };
  if (kind === 'services') {
    const type = text('serviceType', 'ClusterIP');
    return {
      apiVersion: 'v1', kind: 'Service', metadata,
      spec: type === 'ExternalName' ? { type, externalName: text('externalName') } : {
        type: type === 'Headless' ? 'ClusterIP' : type,
        ...(type === 'Headless' ? { clusterIP: 'None' } : {}),
        selector: { app: text('app') || metadata.name },
        ports: [{
          name: 'port-1',
          port: Number(text('port', '80')),
          targetPort: /^\d+$/.test(text('targetPort', '80')) ? Number(text('targetPort', '80')) : text('targetPort'),
          protocol: text('protocol', 'TCP'),
        }],
      },
    };
  }
  const host = text('host');
  const port = text('servicePort', '80');
  return {
    apiVersion: 'networking.k8s.io/v1', kind: 'Ingress', metadata,
    spec: {
      ...(text('ingressClass') ? { ingressClassName: text('ingressClass') } : {}),
      rules: [{
        ...(host ? { host } : {}),
        http: { paths: [{
          path: text('path', '/') || '/', pathType: text('pathType', 'Prefix'),
          backend: { service: { name: text('serviceName'), port: /^\d+$/.test(port) ? { number: Number(port) } : { name: port } } },
        }] },
      }],
      ...(text('tlsSecret') ? { tls: [{ secretName: text('tlsSecret'), ...(host ? { hosts: [host] } : {}) }] } : {}),
    },
  };
}

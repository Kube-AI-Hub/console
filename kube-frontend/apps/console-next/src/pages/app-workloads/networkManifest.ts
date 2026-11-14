import type { KubeObject } from '@kube-ai-hub/api-client';

/**
 * Service and Ingress manifests, built from the create dialogs' form state.
 *
 * Pure functions on purpose: the two dialogs are mostly layout and validation, and
 * the part that decides what the cluster receives is testable without a browser. The
 * old generic create dialog built these inline; splitting them out is what allowed the
 * typed Service form (NodePort) and the multi-rule Ingress form to share one writer.
 */

export type NetworkKind = 'services' | 'ingresses';

/** Types the Service form offers. Headless is spelled ClusterIP + clusterIP: None. */
export const SERVICE_TYPES = ['ClusterIP', 'NodePort', 'Headless', 'ExternalName'] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

/** Kubernetes object names: lower-case alphanumerics and inner dashes, up to 63. */
export function validNetworkName(value: string): boolean {
  return value.length > 0 && value.length <= 63 && /^[a-z]([-a-z0-9]*[a-z0-9])?$/.test(value);
}

/** A service port is a number 1–65535 or a named port (letters, at most 15 chars). */
export function validNetworkPort(value: string): boolean {
  if (/^\d+$/.test(value)) return Number(value) >= 1 && Number(value) <= 65535;
  return value.length <= 15 && /[a-z]/.test(value) && /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(value);
}

/**
 * A node port is not arbitrary: kube-apiserver accepts the configured service-node-port
 * range, which defaults to 30000–32767. Out-of-range values are rejected upstream with
 * a message that does not name the range, so the form checks the default range first.
 */
export function validNodePort(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const port = Number(value);
  return port >= 30000 && port <= 32767;
}

export interface ServiceDraft {
  name: string;
  namespace: string;
  serviceType: ServiceType;
  protocol: string;
  /** Service port; kept as the form's string until the manifest is built. */
  port: string;
  targetPort: string;
  nodePort: string;
  externalName: string;
  /** The `app` label the service selects; empty leaves the service selector-less. */
  selectorApp: string;
}

export function serviceManifest(draft: ServiceDraft): KubeObject {
  const metadata = { name: draft.name.trim(), namespace: draft.namespace };
  if (draft.serviceType === 'ExternalName') {
    return {
      apiVersion: 'v1',
      kind: 'Service',
      metadata,
      spec: { type: 'ExternalName', externalName: draft.externalName.trim() },
    };
  }
  const target = draft.targetPort.trim();
  const port: Record<string, unknown> = {
    // The name matters: a named targetPort is resolved through it, and renaming a port
    // later would break every service that points at it.
    name: 'port-1',
    port: Number(draft.port.trim()),
    targetPort: /^\d+$/.test(target) ? Number(target) : target,
    protocol: draft.protocol || 'TCP',
  };
  if (draft.serviceType === 'NodePort' && draft.nodePort.trim()) port['nodePort'] = Number(draft.nodePort.trim());
  const selector = draft.selectorApp.trim();
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata,
    spec: {
      type: draft.serviceType === 'Headless' ? 'ClusterIP' : draft.serviceType,
      ...(draft.serviceType === 'Headless' ? { clusterIP: 'None' } : {}),
      ...(selector ? { selector: { app: selector } } : {}),
      ports: [port],
    },
  };
}

export interface IngressRuleDraft {
  host: string;
  path: string;
  pathType: string;
  serviceName: string;
  servicePort: string;
}

export interface IngressDraft {
  name: string;
  namespace: string;
  ingressClass: string;
  tlsSecret: string;
  rules: IngressRuleDraft[];
}

/**
 * Build an Ingress from one row per path.
 *
 * Kubernetes nests paths under a host: `rules[]` → `http.paths[]`. The form is flat
 * (host, path, backend per row), so rows are grouped by host here — two rows for the
 * same host must become one rule with two paths, and rows without a host become the
 * catch-all rule. Building one rule per row would produce an object the API treats as
 * a conflict.
 */
export function ingressManifest(draft: IngressDraft): KubeObject {
  const rules: Array<Record<string, unknown>> = [];
  for (const rule of draft.rules) {
    const host = rule.host.trim();
    const path = rule.path.trim() || '/';
    const port = rule.servicePort.trim();
    const entry = {
      path,
      pathType: rule.pathType || 'Prefix',
      backend: {
        service: {
          name: rule.serviceName.trim(),
          port: /^\d+$/.test(port) ? { number: Number(port) } : { name: port },
        },
      },
    };
    const existing = host ? rules.find((candidate) => candidate['host'] === host) : undefined;
    if (existing) {
      const http = existing['http'] as { paths: unknown[] };
      http.paths.push(entry);
    } else {
      rules.push({ ...(host ? { host } : {}), http: { paths: [entry] } });
    }
  }
  const hosts = rules.map((rule) => rule['host']).filter((host): host is string => typeof host === 'string');
  const tlsSecret = draft.tlsSecret.trim();
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: { name: draft.name.trim(), namespace: draft.namespace },
    spec: {
      ...(draft.ingressClass.trim() ? { ingressClassName: draft.ingressClass.trim() } : {}),
      rules,
      ...(tlsSecret ? { tls: [{ secretName: tlsSecret, ...(hosts.length > 0 ? { hosts } : {}) }] } : {}),
    },
  };
}

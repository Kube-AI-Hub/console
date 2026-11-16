import type { Client } from './client';
import { clusterScoped, corePath } from './paths';
import { ApiError } from './errors';
import { baseOf, type KubeObject, type ResourceBase } from './resources';

/**
 * Project and cluster gateways (`gateway.kubesphere.io/v1alpha1`).
 *
 * What the cluster actually serves was probed on B200 before this file was written:
 *
 * - The object the console manages is a **Gateway** CR. Its `spec` is
 *   `{ controller, deployment, service }`; `spec.deployment.replicas`,
 *   `spec.service.type`, `spec.service.annotations` and
 *   `spec.deployment.annotations['servicemesh.kubesphere.io/enabled']` are the fields
 *   the old console's edit dialog wrote, and they survive a native PUT (verified: the
 *   controller reconciles them onto the ingress-nginx Deployment and Service).
 * - The CR does **not** carry the address or the NodePorts. Those belong to the Service
 *   the gateway's Helm release creates (`kubesphere-router-<namespace>`); the Gateway's
 *   `status` only carries conditions and the rendered release manifest.
 * - The operator also creates an `Nginx` CR (`<gateway>-ingress`) owned by the Gateway.
 *   It is operator/Helm-owned: a concurrent PUT is rejected with 409, so the console
 *   must not write it.
 * - `spec` has no NodePort field (checked against the CRD schema). A pinned NodePort is
 *   therefore written to the Service ports, which is the only object that owns them.
 */

/** One port of the gateway Service: what a client reaches, and the pinned nodePort if any. */
export interface GatewayServicePort {
  name: string;
  port: number;
  protocol: string;
  /** Assigned by Kubernetes (or pinned by the reader); absent for ClusterIP-only ports. */
  nodePort?: number;
}

/** The Gateway CR's `spec`, as the CRD accepts it (unknown fields are pruned). */
export interface GatewaySpec {
  controller?: {
    replicas?: number;
    annotations?: Record<string, string>;
    config?: Record<string, string>;
    scope?: { enabled?: boolean; namespace?: string };
  };
  deployment?: {
    replicas?: number;
    annotations?: Record<string, string>;
  };
  service?: {
    type?: string;
    annotations?: Record<string, string>;
  };
}

/** A gateway flattened for the pages: the spec the reader edits plus what the Service serves. */
export interface GatewayDetail {
  name: string;
  namespace: string;
  exists: boolean;
  createdAt: string;
  creator: string;
  /** Desired access type (`spec.service.type`), falling back to the Service's actual type. */
  type: string;
  /** What the Service exposes right now; differs from `type` while the controller reconciles. */
  serviceType: string;
  /** `spec.deployment.replicas`; undefined when the spec never set it. */
  replicas: number | undefined;
  /** `spec.deployment.annotations['servicemesh.kubesphere.io/enabled'] === 'true'`. */
  tracing: boolean;
  /** `spec.service.annotations` — cloud load-balancer annotations (LoadBalancer only). */
  serviceAnnotations: Record<string, string>;
  /** `spec.controller.config` — nginx controller options (`worker-processes`, …). */
  controllerConfig: Record<string, string>;
  /** `metadata.annotations['kubesphere.io/annotations']`, the old console's LB provider. */
  provider: string;
  ready: boolean;
  /** The Deployed condition's reason/message when it is not ready. */
  message: string;
  /** Load-balancer ingress IP/hostname; empty for a NodePort gateway without one. */
  address: string;
  ports: GatewayServicePort[];
  resourceVersion: string;
}

export interface ClusterGateway extends ResourceBase, GatewayDetail {
  scope: 'cluster' | 'project';
}

/** The editable half of a gateway, as the edit dialog collects it. */
export interface GatewayChanges {
  type: 'NodePort' | 'LoadBalancer';
  replicas: number;
  tracing: boolean;
  /** Applied only for LoadBalancer; NodePort gateways clear it (as the old dialog did). */
  serviceAnnotations: Record<string, string>;
  controllerConfig: Record<string, string>;
}

/**
 * Whether a Gateway object belongs to the cluster gateway rather than a project.
 *
 * The cluster gateway used to live in `kubesphere-system`; the current operator
 * creates it in `kubesphere-controls-system` (the Gateway installs the nginx
 * release there). Both namespaces are cluster-owned, while a project gateway
 * lives in the project's own namespace — so namespace, not name, tells them apart.
 */
export function isClusterGatewayNamespace(namespace: string | undefined): boolean {
  return namespace === 'kubesphere-system' || namespace === 'kubesphere-controls-system';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function stringMap(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(asRecord(value))) {
    if (entry !== null && entry !== undefined) out[key] = String(entry);
  }
  return out;
}

function numberOrUndefined(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// `clusters/<id>` goes before the group, not after the version: see `clusterScoped`.
function gatewayGroupPath(cluster: string, suffix: string): string {
  return clusterScoped('/apis/gateway.kubesphere.io/v1alpha1', cluster, suffix);
}

function resourcesPath(cluster: string, suffix: string): string {
  return clusterScoped('/kapis/resources.kubesphere.io/v1alpha3', cluster, suffix);
}

function servicePath(cluster: string, namespace: string, name: string): string {
  return resourcesPath(cluster, 'namespaces/' + encodeURIComponent(namespace) + '/services/' + encodeURIComponent(name));
}

/**
 * The native core-API Service path, used for writes.
 *
 * The kapis resources endpoint registers GET only (a PATCH answers 405, measured), so a
 * pinned NodePort has to be written through `/api/v1`. Member clusters keep the app's
 * `clusters/<id>/` segment convention.
 */
function nativeServicePath(cluster: string, namespace: string, name: string): string {
  return corePath(cluster, 'namespaces/' + encodeURIComponent(namespace) + '/services/' + encodeURIComponent(name));
}

function toPorts(service: KubeObject | undefined): GatewayServicePort[] {
  const spec = asRecord(service?.spec);
  const ports = Array.isArray(spec['ports']) ? (spec['ports'] as Array<Record<string, unknown>>) : [];
  return ports.map((port) => ({
    name: text(port['name']),
    port: numberOrUndefined(port['port']) ?? 0,
    protocol: text(port['protocol']) || 'TCP',
    ...(numberOrUndefined(port['nodePort']) !== undefined ? { nodePort: numberOrUndefined(port['nodePort'])! } : {}),
  }));
}

function loadBalancerAddress(service: KubeObject | undefined): string {
  const status = asRecord(service?.status);
  const entries = Array.isArray(asRecord(status['loadBalancer'])['ingress'])
    ? (asRecord(status['loadBalancer'])['ingress'] as Array<Record<string, unknown>>)
    : [];
  const first = entries[0];
  return first ? text(first['ip'] ?? first['hostname']) : '';
}

function emptyDetail(namespace: string): GatewayDetail {
  return {
    name: '',
    namespace,
    exists: false,
    createdAt: '',
    creator: '',
    type: '',
    serviceType: '',
    replicas: undefined,
    tracing: false,
    serviceAnnotations: {},
    controllerConfig: {},
    provider: '',
    ready: false,
    message: '',
    address: '',
    ports: [],
    resourceVersion: '',
  };
}

/**
 * Map one Gateway CR plus the Service its release created.
 *
 * `ready` is the `Deployed` condition, never `spec.replicas > 0`: a gateway whose Helm
 * release failed keeps a non-empty spec but serves nothing.
 */
export function toGatewayDetail(item: KubeObject, service?: KubeObject): GatewayDetail {
  const base = baseOf(item);
  const spec = asRecord(item.spec);
  const controller = asRecord(spec['controller']);
  const deployment = asRecord(spec['deployment']);
  const desiredService = asRecord(spec['service']);
  const conditions = Array.isArray(asRecord(item.status)['conditions'])
    ? (asRecord(item.status)['conditions'] as Array<Record<string, unknown>>)
    : [];
  const deployed = conditions.find((condition) => condition['type'] === 'Deployed');
  const serviceSpec = asRecord(service?.spec);
  const tracing = text(asRecord(deployment['annotations'])['servicemesh.kubesphere.io/enabled']) === 'true';
  return {
    name: base.name,
    namespace: base.namespace,
    exists: true,
    createdAt: base.createdAt,
    creator: base.creator,
    type: text(desiredService['type']) || text(serviceSpec['type']),
    serviceType: text(serviceSpec['type']),
    replicas: numberOrUndefined(deployment['replicas']),
    tracing,
    serviceAnnotations: stringMap(desiredService['annotations']),
    controllerConfig: stringMap(controller['config']),
    provider: text(asRecord(item.metadata?.annotations)['kubesphere.io/annotations']),
    ready: deployed?.['status'] === 'True',
    message: deployed?.['status'] === 'True' ? '' : text(deployed?.['reason'] ?? deployed?.['message']),
    address: loadBalancerAddress(service),
    ports: toPorts(service),
    resourceVersion: item.metadata?.resourceVersion ?? '',
  };
}

export function toClusterGateway(item: KubeObject, service?: KubeObject): ClusterGateway {
  return {
    ...baseOf(item),
    ...toGatewayDetail(item, service),
    scope: isClusterGatewayNamespace(item.metadata?.namespace) ? 'cluster' : 'project',
  };
}

function serviceKey(namespace: string, name: string): string {
  return namespace + '/' + name;
}

/**
 * Project and cluster gateways with their access information.
 *
 * Reads stay on the native Gateway collection (the kapis `gateways` resource is not
 * served — a `resources.kubesphere.io` read answers 404), then one cluster-wide Service
 * list joins address/nodePorts by namespace+name. A failed Service join degrades to
 * `-` instead of failing the list: the gateway's readiness is still worth showing.
 */
export function projectGatewaysApi(client: Client) {
  async function readList(cluster: string, signal?: AbortSignal): Promise<KubeObject[]> {
    const body = await client.request<{ items?: KubeObject[] }>(gatewayGroupPath(cluster, 'gateways'), {
      ...(signal ? { signal } : {}),
    });
    return body?.items ?? [];
  }

  async function readServices(cluster: string, signal?: AbortSignal): Promise<Map<string, KubeObject>> {
    const body = await client
      .request<{ items?: KubeObject[] }>(resourcesPath(cluster, 'services'), {
        query: { limit: -1 },
        ...(signal ? { signal } : {}),
      })
      .catch(() => undefined);
    const map = new Map<string, KubeObject>();
    for (const item of body?.items ?? []) {
      const metadata = item.metadata ?? {};
      if (metadata.namespace && metadata.name) map.set(serviceKey(metadata.namespace, metadata.name), item);
    }
    return map;
  }

  async function readService(cluster: string, namespace: string, name: string, signal?: AbortSignal) {
    return client
      .request<KubeObject>(servicePath(cluster, namespace, name), { ...(signal ? { signal } : {}) })
      .catch(() => undefined);
  }

  function applyChanges(gateway: KubeObject, changes: GatewayChanges): KubeObject {
    const spec = asRecord(gateway.spec);
    const service = asRecord(spec['service']);
    const deployment = asRecord(spec['deployment']);
    const controller = asRecord(spec['controller']);
    const deployAnnotations = stringMap(deployment['annotations']);
    return {
      ...gateway,
      spec: {
        ...spec,
        service: {
          ...service,
          type: changes.type,
          // NodePort gateways do not use load-balancer annotations; keeping stale cloud
          // annotations on a NodePort Service is what the old dialog cleared on switch.
          annotations: changes.type === 'LoadBalancer' ? changes.serviceAnnotations : {},
        },
        deployment: {
          ...deployment,
          replicas: changes.replicas,
          annotations: {
            ...deployAnnotations,
            'servicemesh.kubesphere.io/enabled': changes.tracing ? 'true' : 'false',
          },
        },
        controller: { ...controller, config: changes.controllerConfig },
      },
    };
  }

  async function get(params: { cluster: string; namespace: string; name?: string; signal?: AbortSignal }): Promise<GatewayDetail> {
    // Namespace-scoped, not the cluster-wide list: the cluster list contains every
    // project's gateway and picking the first one would show another project's data.
    const body = await client.request<{ items?: KubeObject[] }>(
      gatewayGroupPath(params.cluster, 'namespaces/' + encodeURIComponent(params.namespace) + '/gateways'),
      { ...(params.signal ? { signal: params.signal } : {}) },
    );
    const items = body?.items ?? [];
    const item = params.name ? items.find((candidate) => candidate.metadata?.name === params.name) : items[0];
    if (!item) return emptyDetail(params.namespace);
    const name = item.metadata?.name ?? params.name ?? '';
    const service = await readService(params.cluster, item.metadata?.namespace ?? params.namespace, name, params.signal);
    return toGatewayDetail(item, service);
  }

  return {
    /** Cluster-wide list, with each row's Service joined for address/nodePorts. */
    async list(params: { cluster: string; signal?: AbortSignal }): Promise<ClusterGateway[]> {
      const [items, services] = await Promise.all([
        readList(params.cluster, params.signal),
        readServices(params.cluster, params.signal),
      ]);
      return items.map((item) => {
        const metadata = item.metadata ?? {};
        const service = metadata.namespace && metadata.name ? services.get(serviceKey(metadata.namespace, metadata.name)) : undefined;
        return toClusterGateway(item, service);
      });
    },

    /** One project's gateway (the first object in its namespace), or `exists: false`. */
    get,

    /**
     * Create the project gateway as NodePort, the old console's default.
     *
     * The body uses the CRD's real schema; the previous body sent `spec.type`/`ports`,
     * which the API server prunes, leaving an empty spec that the controller rendered as
     * its own defaults (LoadBalancer) rather than the NodePort the console promised.
     */
    async create(params: { cluster: string; namespace: string; signal?: AbortSignal }): Promise<GatewayDetail> {
      const namespace = params.namespace;
      const name = 'kubesphere-router-' + namespace;
      const item = await client.request<KubeObject>(
        gatewayGroupPath(params.cluster, 'namespaces/' + encodeURIComponent(namespace) + '/gateways'),
        {
          method: 'POST',
          body: {
            apiVersion: 'gateway.kubesphere.io/v1alpha1',
            kind: 'Gateway',
            metadata: { name, namespace },
            spec: {
              controller: { replicas: 1, scope: { enabled: true, namespace } },
              deployment: { replicas: 1 },
              service: { type: 'NodePort' },
            },
          },
          ...(params.signal ? { signal: params.signal } : {}),
        },
      );
      return toGatewayDetail(item);
    },

    /**
     * Save the editable spec.
     *
     * Reads the latest object first and applies the changes to it, so a controller
     * reconcile between opening the dialog and saving does not fail the write on a stale
     * resourceVersion; a 409 still retries once from a fresh read.
     */
    async update(params: {
      cluster: string;
      namespace: string;
      name: string;
      changes: GatewayChanges;
      signal?: AbortSignal;
    }): Promise<GatewayDetail> {
      if (!Number.isInteger(params.changes.replicas) || params.changes.replicas < 0) {
        throw new Error('replicas must be a non-negative integer');
      }
      const itemPath = gatewayGroupPath(
        params.cluster,
        'namespaces/' + encodeURIComponent(params.namespace) + '/gateways/' + encodeURIComponent(params.name),
      );
      const save = async (): Promise<KubeObject> => {
        const latest = await client.request<KubeObject>(itemPath, params.signal ? { signal: params.signal } : {});
        return client.request<KubeObject>(itemPath, {
          method: 'PUT',
          body: applyChanges(latest, params.changes),
          ...(params.signal ? { signal: params.signal } : {}),
        });
      };
      let saved: KubeObject;
      try {
        saved = await save();
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status !== 409) throw error;
        saved = await save();
      }
      const service = await readService(params.cluster, params.namespace, params.name, params.signal);
      return toGatewayDetail(saved, service);
    },

    async remove(params: { cluster: string; namespace: string; name: string }): Promise<void> {
      await client.request<void>(
        gatewayGroupPath(
          params.cluster,
          'namespaces/' + encodeURIComponent(params.namespace) + '/gateways/' + encodeURIComponent(params.name),
        ),
        { method: 'DELETE' },
      );
    },

    /**
     * Pin or update NodePorts on the gateway Service.
     *
     * The Gateway CRD has no nodePort field (checked in its schema), and the Nginx CR is
     * operator/Helm-owned (a concurrent PUT answers 409) — the Service is the object that
     * owns the ports. A merge patch has to carry the full port list: patching only
     * `{name, nodePort}` is rejected by the API server.
     */
    async setNodePorts(params: {
      cluster: string;
      namespace: string;
      name: string;
      nodePorts: Record<string, number>;
      signal?: AbortSignal;
    }): Promise<GatewayServicePort[]> {
      const target = nativeServicePath(params.cluster, params.namespace, params.name);
      const service = await client.request<KubeObject>(target, params.signal ? { signal: params.signal } : {}).catch((error: unknown) => {
        /*
         * The gateway's Helm release may still be installing. Both a 404 and the kapis
         * proxy's 500 "service ... not found" mean "not ready yet", which the dialog
         * explains as a NodePort-not-assigned condition rather than a generic failure.
         */
        if (
          error instanceof ApiError &&
          (error.status === 404 || (error.status === 500 && /not found/i.test(error.message)))
        ) {
          throw Object.assign(new Error('gateway service is not created yet'), { code: 'node_ports_pending' });
        }
        throw error;
      });
      const serviceSpec = asRecord(service.spec);
      const ports = Array.isArray(serviceSpec['ports']) ? (serviceSpec['ports'] as Array<Record<string, unknown>>) : [];
      const patched = ports.map((port) => {
        const name = text(port['name']);
        const pinned = params.nodePorts[name];
        return pinned === undefined ? port : { ...port, nodePort: pinned };
      });
      const updated = await client.request<KubeObject>(target, {
        method: 'PATCH',
        contentType: 'application/merge-patch+json',
        body: { spec: { ports: patched } },
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return toPorts(updated);
    },
  };
}

/** Backwards-compatible listing entry for the cluster gateway page. */
export function clusterGatewaysApi(client: Client) {
  const api = projectGatewaysApi(client);
  return {
    async list(params: { cluster: string; signal?: AbortSignal }): Promise<ClusterGateway[]> {
      return api.list(params);
    },
  };
}

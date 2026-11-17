import type { Client } from './client';
import { ApiError } from './errors';

/**
 * 自制 CRD 应用（composing）.
 *
 * Old console's "自制应用" is an `app.k8s.io/v1beta1 Application` whose selector names the
 * workload/service/ingress labels that make up the app. The API exposes the Applications;
 * the component list and health have to be derived, because there is no server-side
 * aggregate that joins them.
 *
 * Read-only: create/edit/delete of a composed app is a multi-object transaction (see the
 * old console's application store), which is a separate unit. [N-01]
 */
export interface ComposedAppComponentCounts {
  workloads: number;
  services: number;
  ingresses: number;
}

export type ComposedAppHealth = 'healthy' | 'progressing' | 'degraded' | 'unknown';

export interface ComposedAppSummary {
  name: string;
  namespace: string;
  version: string;
  health: ComposedAppHealth;
  components: ComposedAppComponentCounts;
  createdAt: string;
  /** Human-readable reason behind `health`, e.g. `1/2` workloads ready. */
  healthDetail: string;
}

interface KubeObject {
  metadata?: {
    name?: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    creationTimestamp?: string;
  };
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

interface KubeList {
  items?: KubeObject[];
}

const KAPIS_RESOURCES = '/kapis/resources.kubesphere.io/v1alpha3';

function matches(labels: Record<string, string> | undefined, selector: Record<string, string>): boolean {
  return Object.entries(selector).every(([key, value]) => (labels ?? {})[key] === value);
}

function replicasOf(item: KubeObject): { ready: number; desired: number } {
  const spec = item.spec ?? {};
  const status = item.status ?? {};
  const desired = Number(spec['replicas'] ?? 0);
  const ready = Number(status['readyReplicas'] ?? 0);
  return { ready, desired };
}

function healthOf(workloads: KubeObject[]): { health: ComposedAppHealth; detail: string } {
  if (workloads.length === 0) return { health: 'unknown', detail: '' };
  let ready = 0;
  let desired = 0;
  for (const workload of workloads) {
    const counts = replicasOf(workload);
    ready += counts.ready;
    desired += counts.desired;
  }
  if (desired === 0) return { health: 'unknown', detail: '' };
  if (ready >= desired) return { health: 'healthy', detail: ready + '/' + desired };
  if (ready === 0) return { health: 'degraded', detail: '0/' + desired };
  return { health: 'progressing', detail: ready + '/' + desired };
}

export interface ComposedAppWorkload {
  kind: 'Deployment' | 'StatefulSet';
  name: string;
  ready: number;
  desired: number;
}

export interface ComposedAppService {
  name: string;
  type: string;
  clusterIP: string;
  ports: number[];
}

export interface ComposedAppIngress {
  name: string;
  hosts: string[];
}

export interface ComposedAppTrafficNode {
  id: string;
  nodeType: string;
  app: string;
  workload: string;
  service: string;
  namespace: string;
  outside: boolean;
}

export interface ComposedAppTraffic {
  available: boolean;
  reason?: string;
  nodes: ComposedAppTrafficNode[];
  edges: number;
}

export type ComposedAppGrayType = 'traffic' | 'content' | 'mirror' | 'unknown';

export interface ComposedAppGrayStrategy {
  name: string;
  type: ComposedAppGrayType;
  hosts: string[];
  selector: Record<string, string>;
}

export interface ComposedAppGray {
  available: boolean;
  reason?: string;
  strategies: ComposedAppGrayStrategy[];
}

export interface ComposedAppTraceSpan {
  spanId: string;
  operationName: string;
  service: string;
  /** Milliseconds from the trace start to this span's start. */
  startOffsetMs: number;
  durationMs: number;
}

export interface ComposedAppTrace {
  traceId: string;
  service: string;
  spanCount: number;
  durationMs: number;
  /** Spans for the trace waterfall, sorted by start offset (capped at 100). */
  spans: ComposedAppTraceSpan[];
}

export interface ComposedAppTracing {
  available: boolean;
  reason?: string;
  traces: ComposedAppTrace[];
}

export interface ComposedAppEvent {
  type: string;
  reason: string;
  message: string;
  count: number;
  lastTimestamp: string;
  objectKind: string;
  objectName: string;
}

export interface ComposedAppDetail extends ComposedAppSummary {
  selector: Record<string, string>;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  workloads: ComposedAppWorkload[];
  serviceItems: ComposedAppService[];
  ingressItems: ComposedAppIngress[];
}

function hostsOf(item: KubeObject): string[] {
  const rules = ((item.spec?.['rules'] ?? []) as Array<Record<string, unknown>>) ?? [];
  const hosts = rules.map((rule) => String(rule['host'] ?? '')).filter(Boolean);
  return hosts.length > 0 ? hosts : ['*'];
}

interface ComposedComponents {
  deployments: KubeObject[];
  statefulsets: KubeObject[];
  services: KubeObject[];
  ingresses: KubeObject[];
}

async function fetchComponents(client: Client, namespace: string, signal?: AbortSignal): Promise<ComposedComponents> {
  const base = KAPIS_RESOURCES + '/namespaces/' + encodeURIComponent(namespace);
  const query = { limit: -1 } as const;
  const options = signal ? { signal } : {};
  const [deployments, statefulsets, services, ingresses] = await Promise.all([
    client.request<KubeList>(base + '/deployments', { query, ...options }),
    client.request<KubeList>(base + '/statefulsets', { query, ...options }),
    client.request<KubeList>(base + '/services', { query, ...options }),
    client.request<KubeList>(base + '/ingresses', { query, ...options }),
  ]);
  return {
    deployments: deployments?.items ?? [],
    statefulsets: statefulsets?.items ?? [],
    services: services?.items ?? [],
    ingresses: ingresses?.items ?? [],
  };
}

function selectorOf(app: KubeObject): Record<string, string> {
  return ((app.spec?.['selector'] as Record<string, unknown> | undefined)?.['matchLabels'] ?? {}) as Record<string, string>;
}

function matchAll(items: KubeObject[], selector: Record<string, string>): KubeObject[] {
  return items.filter((item) => matches(item.metadata?.labels, selector));
}

function toSummary(app: KubeObject, components: ComposedComponents): ComposedAppSummary {
  const metadata = app.metadata ?? {};
  const selector = selectorOf(app);
  const workloads = [...matchAll(components.deployments, selector), ...matchAll(components.statefulsets, selector)];
  const { health, detail } = healthOf(workloads);
  return {
    name: metadata.name ?? '',
    namespace: metadata.namespace ?? '',
    version: metadata.labels?.['app.kubernetes.io/version'] ?? '-',
    health,
    components: {
      workloads: workloads.length,
      services: matchAll(components.services, selector).length,
      ingresses: matchAll(components.ingresses, selector).length,
    },
    createdAt: metadata.creationTimestamp ?? '',
    healthDetail: detail,
  };
}

export interface ComposedAppComponentInput {
  name: string;
  image: string;
  replicas: number;
  port: number;
}

export interface ComposedAppRouteInput {
  namespace: string;
  cluster: string;
  appName: string;
  host: string;
  path: string;
  serviceName: string;
  servicePort: number;
}

export interface ComposedAppCreateInput {
  namespace: string;
  name: string;
  description: string;
  version: string;
  components: ComposedAppComponentInput[];
}

const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

/**
 * Validate before any request.
 *
 * The old console ran all POSTs as dry-run first; most rejections there were ordinary
 * form mistakes, so the dialog checks them locally instead of spending a round trip.
 */
export function validateComposedAppInput(input: ComposedAppCreateInput): string | null {
  if (!NAME_PATTERN.test(input.name)) return 'name';
  if (input.name.length > 63) return 'name';
  if (input.components.length === 0) return 'components';
  const names = new Set<string>();
  for (const component of input.components) {
    if (!NAME_PATTERN.test(component.name) || names.has(component.name)) return 'componentName';
    names.add(component.name);
    if (!component.image.trim()) return 'image';
    if (!Number.isInteger(component.replicas) || component.replicas < 1) return 'replicas';
    if (!Number.isInteger(component.port) || component.port < 1 || component.port > 65535) return 'port';
  }
  return null;
}

function clusterPrefix(cluster: string): string {
  return cluster === 'host' ? '' : '/clusters/' + encodeURIComponent(cluster);
}

export function composedAppBodies(input: ComposedAppCreateInput): { application: Record<string, unknown>; deployments: Record<string, unknown>[]; services: Record<string, unknown>[] } {
  const labels = { app: input.name };
  const application: Record<string, unknown> = {
    apiVersion: 'app.k8s.io/v1beta1',
    kind: 'Application',
    metadata: {
      name: input.name,
      namespace: input.namespace,
      labels: { 'app.kubernetes.io/version': input.version },
      ...(input.description.trim() ? { annotations: { 'kubesphere.io/description': input.description.trim() } } : {}),
    },
    spec: { selector: { matchLabels: labels }, addOwnerRef: true },
  };
  const deployments = input.components.map((component): Record<string, unknown> => {
    const workloadName = input.name + '-' + component.name;
    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: workloadName, namespace: input.namespace, labels },
      spec: {
        replicas: component.replicas,
        selector: { matchLabels: labels },
        template: {
          metadata: { labels },
          spec: {
            containers: [{ name: component.name, image: component.image.trim(), ports: [{ containerPort: component.port }] }],
          },
        },
      },
    };
  });
  const services = input.components.map((component): Record<string, unknown> => {
    const workloadName = input.name + '-' + component.name;
    return {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name: workloadName, namespace: input.namespace, labels },
      spec: { selector: labels, ports: [{ port: component.port, targetPort: component.port }] },
    };
  });
  return { application, deployments, services };
}

interface CreateResponse {
  metadata?: { name?: string };
}

export function composedAppsWriteApi(client: Client) {
  return {
        /** Replace alias/description annotations; removed keys are sent as null. */
        async updateInfo(params: {
          namespace: string;
          name: string;
          cluster: string;
          annotations: Record<string, string>;
        }): Promise<void> {
          const path =
            '/apis' +
            clusterPrefix(params.cluster) +
            '/app.k8s.io/v1beta1/namespaces/' +
            encodeURIComponent(params.namespace) +
            '/applications/' +
            encodeURIComponent(params.name);
          const current = await client.request<KubeObject>(path);
          const existing = current.metadata?.annotations ?? {};
          const patch: Record<string, string | null> = {};
          for (const key of Object.keys(existing)) {
            if (!(key in params.annotations)) patch[key] = null;
          }
          for (const [key, value] of Object.entries(params.annotations)) {
            if (existing[key] !== value) patch[key] = value;
          }
          if (Object.keys(patch).length === 0) return;
          await client.request(path, {
            method: 'PATCH',
            contentType: 'application/merge-patch+json',
            body: { metadata: { annotations: patch } },
          });
        },

    /**
     * Add an Ingress route to an existing composed app.
     *
     * The Ingress carries app=<name> so it appears in the app's component list, and points
     * at one of the app's Services. Dry-run first, like create; a failed real write removes
     * the object it just created (there is only one, but the same rule keeps errors clear).
     */
    async addRoute(input: ComposedAppRouteInput): Promise<void> {
      const path = String(input.path || '/').trim() || '/';
      const host = input.host.trim();
      if (!host) throw new Error('invalid host');
      if (!input.serviceName) throw new Error('invalid service');
      if (!Number.isInteger(input.servicePort) || input.servicePort < 1 || input.servicePort > 65535) {
        throw new Error('invalid port');
      }
      const name = (input.appName + '-' + host + '-' + path).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);
      const body = {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: { name, namespace: input.namespace, labels: { app: input.appName } },
        spec: {
          rules: [
            {
              host,
              http: {
                paths: [
                  {
                    path,
                    pathType: 'Prefix',
                    backend: { service: { name: input.serviceName, port: { number: input.servicePort } } },
                  },
                ],
              },
            },
          ],
        },
      };
      const target = '/apis' + clusterPrefix(input.cluster) + '/networking.k8s.io/v1/namespaces/' + encodeURIComponent(input.namespace) + '/ingresses';
      await client.request(target, { method: 'POST', body, query: { dryRun: 'All' } });
      try {
        await client.request(target, { method: 'POST', body });
      } catch (error) {
        await client.request<void>(target + '/' + encodeURIComponent(name), { method: 'DELETE' }).catch(() => undefined);
        throw error;
      }
    },

    /**
     * Create Application + Deployment + Service.
     *
     * The three objects are written in dry-run first (cheap full validation), then for
     * real. A failure during the real writes deletes whatever was already created: a
     * half-composed app is worse than a clear error, and the old console had no rollback.
     */
    async create(input: ComposedAppCreateInput & { cluster: string }): Promise<void> {
      const invalid = validateComposedAppInput(input);
      if (invalid) throw new Error('invalid ' + invalid);
      if (input.cluster !== 'host') throw new Error('member cluster creation is not supported yet');
      const { application, deployments, services } = composedAppBodies(input);
      const seg = clusterPrefix(input.cluster);
      const ns = encodeURIComponent(input.namespace);
      const targets = [
        { path: '/apis' + seg + '/app.k8s.io/v1beta1/namespaces/' + ns + '/applications', body: application },
        ...deployments.map((body) => ({ path: '/apis' + seg + '/apps/v1/namespaces/' + ns + '/deployments', body })),
        ...services.map((body) => ({ path: '/api/v1/namespaces/' + ns + '/services', body })),
      ];
      for (const target of targets) {
        await client.request(target.path, { method: 'POST', body: target.body, query: { dryRun: 'All' } });
      }
      const created: Array<{ path: string; name: string }> = [];
      try {
        for (const target of targets) {
          const result = await client.request<CreateResponse>(target.path, { method: 'POST', body: target.body });
          created.push({ path: target.path, name: result?.metadata?.name ?? '' });
        }
      } catch (error) {
        // Best effort: a failed cleanup must not mask the original error.
        await Promise.all(
          created.map((item) =>
            client.request<void>(item.path + '/' + encodeURIComponent(item.name), { method: 'DELETE' }).catch(() => undefined),
          ),
        );
        throw error;
      }
    },
  };
}

export function composedAppsApi(client: Client) {
  return {
    /**
     * Service-mesh traffic for the app's namespace.
     *
     * The graph endpoint is namespace-scoped and may include outside nodes (the ingress
     * controller, external services). The page picks the app's nodes from this result;
     * an unavailable module is a state, not an empty graph.
     */
    async traffic(params: { namespace: string; appName: string; workloads: string[]; services: string[]; cluster: string; signal?: AbortSignal }): Promise<ComposedAppTraffic> {
      const base =
        params.cluster === 'host'
          ? '/kapis/servicemesh.kubesphere.io/v1alpha2'
          : '/kapis/clusters/' + encodeURIComponent(params.cluster) + '/servicemesh.kubesphere.io/v1alpha2';
      try {
        const body = await client.request<{ elements?: { nodes?: Array<Record<string, unknown>>; edges?: unknown[] } }>(
          base + '/namespaces/' + encodeURIComponent(params.namespace) + '/graph',
          {
            query: { duration: '300s', graphType: 'versionedApp', injectServiceNodes: 'true', groupBy: 'app' },
            ...(params.signal ? { signal: params.signal } : {}),
          },
        );
        const wantedApps = new Set([params.appName]);
        const wantedWorkloads = new Set(params.workloads);
        const wantedServices = new Set(params.services);
        const nodes = (body?.elements?.nodes ?? [])
          .map((item): ComposedAppTrafficNode => {
            const data = (item['data'] ?? {}) as Record<string, unknown>;
            return {
              id: String(data['id'] ?? ''),
              nodeType: String(data['nodeType'] ?? ''),
              app: String(data['app'] ?? ''),
              workload: String(data['workload'] ?? ''),
              service: String(data['service'] ?? ''),
              namespace: String(data['namespace'] ?? ''),
              outside: data['isOutside'] === true,
            };
          })
          .filter((node) => wantedApps.has(node.app) || wantedWorkloads.has(node.workload) || wantedServices.has(node.service));
        const ids = new Set(nodes.map((node) => node.id));
        const edges = (body?.elements?.edges ?? []).filter((item) => {
          const data = (item as { data?: Record<string, unknown> }).data ?? {};
          return ids.has(String(data['source'] ?? '')) && ids.has(String(data['target'] ?? ''));
        }).length;
        return { available: true, nodes, edges };
      } catch (error) {
        if (error instanceof ApiError && (error.status === 404 || error.status === 400 || error.status === 501 || error.status >= 500)) {
          return { available: false, reason: error.message, nodes: [], edges: 0 };
        }
        throw error;
      }
    },

    /**
     * Events involving the app or any of its matched components.
     *
     * Namespace events are one collection; the page filters client-side by
     * `involvedObject.name` because the API's field selectors are ignored through the kapis
     * proxy (the same constraint as the storage-class PVC read). Only the objects the detail
     * page actually shows are included.
     */
    async events(params: { namespace: string; names: string[]; signal?: AbortSignal }): Promise<ComposedAppEvent[]> {
      if (params.names.length === 0) return [];
      const body = await client.request<{ items?: Array<Record<string, unknown>> }>(
        '/api/v1/namespaces/' + encodeURIComponent(params.namespace) + '/events',
        { query: { limit: 500 }, ...(params.signal ? { signal: params.signal } : {}) },
      );
      const wanted = new Set(params.names.filter(Boolean));
      return (body?.items ?? [])
        .map((item): ComposedAppEvent => {
          const involved = (item['involvedObject'] ?? {}) as Record<string, unknown>;
          const metadata = (item['metadata'] ?? {}) as Record<string, unknown>;
          return {
            type: String(item['type'] ?? ''),
            reason: String(item['reason'] ?? ''),
            message: String(item['message'] ?? ''),
            count: Number(item['count'] ?? 1),
            lastTimestamp: String(item['lastTimestamp'] ?? item['eventTime'] ?? metadata['creationTimestamp'] ?? ''),
            objectKind: String(involved['kind'] ?? ''),
            objectName: String(involved['name'] ?? ''),
          };
        })
        // Pods are named <workload>-<hash>; their events belong to the component that owns
        // them even though the pod itself is not in the component list.
        .filter((event) => wanted.has(event.objectName) || [...wanted].some((name) => event.objectName.startsWith(name + '-')))
        .sort((a, b) => (b.lastTimestamp || '').localeCompare(a.lastTimestamp || ''));
    },

    /**
     * Traces for the app's Services.
     *
     * The tracing API is per Service (`/services/<name>/traces`), so the page asks once per
     * matched Service. Each trace carries spans; duration is derived from the span window
     * because the listing endpoint does not return a top-level duration. No traces is an
     * empty state; an unserved module is `available: false`.
     */
    async tracing(params: { namespace: string; cluster: string; services: string[]; signal?: AbortSignal }): Promise<ComposedAppTracing> {
      if (params.services.length === 0) return { available: true, traces: [] };
      const base =
        params.cluster === 'host'
          ? '/kapis/servicemesh.kubesphere.io/v1alpha2'
          : '/kapis/clusters/' + encodeURIComponent(params.cluster) + '/servicemesh.kubesphere.io/v1alpha2';
      const traces: ComposedAppTrace[] = [];
      for (const service of params.services) {
        try {
          const body = await client.request<{ data?: Array<Record<string, unknown>> }>(
            base + '/namespaces/' + encodeURIComponent(params.namespace) + '/services/' + encodeURIComponent(service) + '/traces',
            { query: { limit: 10 }, ...(params.signal ? { signal: params.signal } : {}) },
          );
          for (const trace of body?.data ?? []) {
            const spans = (trace['spans'] ?? []) as Array<Record<string, unknown>>;
            let start = Number.POSITIVE_INFINITY;
            let end = 0;
            for (const span of spans) {
              const spanStart = Number(span['startTime'] ?? 0);
              const spanDuration = Number(span['duration'] ?? 0);
              if (spanStart > 0) start = Math.min(start, spanStart);
              end = Math.max(end, spanStart + spanDuration);
            }
            const processes = (trace['processes'] ?? {}) as Record<string, Record<string, unknown>>;
            const waterfall: ComposedAppTraceSpan[] = spans
              .map((span) => {
                const process = processes[String(span['processID'] ?? '')] ?? {};
                return {
                  spanId: String(span['spanID'] ?? ''),
                  operationName: String(span['operationName'] ?? ''),
                  service: String(process['serviceName'] ?? ''),
                  startOffsetMs: Number.isFinite(start) ? Math.max(0, Math.round((Number(span['startTime'] ?? 0) - start) / 1000)) : 0,
                  durationMs: Math.round(Number(span['duration'] ?? 0) / 1000),
                };
              })
              .sort((a, b) => a.startOffsetMs - b.startOffsetMs)
              .slice(0, 100);
            traces.push({
              traceId: String(trace['traceID'] ?? ''),
              service,
              spanCount: spans.length,
              durationMs: Number.isFinite(start) && end > start ? Math.round((end - start) / 1000) : 0,
              spans: waterfall,
            });
          }
        } catch (error) {
          if (error instanceof ApiError && (error.status === 404 || error.status === 400 || error.status === 501 || error.status >= 500)) {
            return { available: false, reason: error.message, traces: [] };
          }
          throw error;
        }
      }
      const seen = new Set<string>();
      return { available: true, traces: traces.filter((trace) => (seen.has(trace.traceId) ? false : Boolean(seen.add(trace.traceId)))) };
    },

    /**
     * Grayscale (servicemesh Strategy) objects for the app.
     *
     * A Strategy carries a selector and a hosts list; the app's strategies are the ones
     * whose selector matches app=<name> or whose hosts include one of the app Services.
     * The type is inferred from the first http rule (mirror / header match / weighted route),
     * because the CR has no `type` field.
     */
    async strategies(params: { namespace: string; cluster: string; appName: string; services: string[]; signal?: AbortSignal }): Promise<ComposedAppGray> {
      const base =
        '/apis' +
        clusterPrefix(params.cluster) +
        '/servicemesh.kubesphere.io/v1alpha2/namespaces/' +
        encodeURIComponent(params.namespace) +
        '/strategies';
      try {
        const body = await client.request<{ items?: Array<Record<string, unknown>> }>(base, {
          query: { limit: 500 },
          ...(params.signal ? { signal: params.signal } : {}),
        });
        const wanted = new Set(params.services);
        const strategies = (body?.items ?? [])
          .map((item): ComposedAppGrayStrategy => {
            const metadata = (item['metadata'] ?? {}) as Record<string, unknown>;
            const spec = (item['spec'] ?? {}) as Record<string, unknown>;
            const selector = ((spec['selector'] ?? {}) as Record<string, unknown>)['matchLabels'] ?? {};
            const template = (spec['template'] ?? {}) as Record<string, unknown>;
            const templateSpec = (template['spec'] ?? {}) as Record<string, unknown>;
            const hosts = ((templateSpec['hosts'] ?? []) as string[]).map(String);
            const http = ((templateSpec['http'] ?? []) as Array<Record<string, unknown>>) ?? [];
            const first = http[0] ?? {};
            const type: ComposedAppGrayType = first['mirror']
              ? 'mirror'
              : first['match']
                ? 'content'
                : first['route']
                  ? 'traffic'
                  : 'unknown';
            return {
              name: String(metadata['name'] ?? ''),
              type,
              hosts,
              selector: selector as Record<string, string>,
            };
          })
          .filter(
            (strategy) =>
              strategy.selector['app'] === params.appName || strategy.hosts.some((host) => wanted.has(host)),
          );
        return { available: true, strategies };
      } catch (error) {
        if (error instanceof ApiError && (error.status === 404 || error.status === 400 || error.status === 501 || error.status >= 500)) {
          return { available: false, reason: error.message, strategies: [] };
        }
        throw error;
      }
    },

    async list(params: { namespace: string; cluster: string; signal?: AbortSignal }): Promise<ComposedAppSummary[]> {
      const base = KAPIS_RESOURCES + '/namespaces/' + encodeURIComponent(params.namespace);
      const [apps, components] = await Promise.all([
        client.request<KubeList>(base + '/applications', {
          query: { limit: -1 },
          ...(params.signal ? { signal: params.signal } : {}),
        }),
        fetchComponents(client, params.namespace, params.signal),
      ]);
      return (apps?.items ?? []).map((app) => toSummary(app, components));
    },

    /**
     * One composed app and its matched components.
     *
     * The detail page needs the component objects, not just counts: it shows workloads with
     * readiness, services with type/ClusterIP, and ingress hosts. Matching stays the same
     * rule as the list (all selector labels equal), so the detail can never disagree with
     * the row the reader clicked.
     */
    /**
     * Delete the Application.
     *
     * Components are deleted only when they carry an ownerReference to this Application
     * (the app.k8s.io controller adds them when addOwnerRef is true). The page navigates
     * back after the Application is gone; component leftovers are the controller's job,
     * not a client-side cascade.
     */
    async remove(params: { namespace: string; name: string; cluster: string }): Promise<void> {
      const path =
        '/apis' +
        clusterPrefix(params.cluster) +
        '/app.k8s.io/v1beta1/namespaces/' +
        encodeURIComponent(params.namespace) +
        '/applications/' +
        encodeURIComponent(params.name);
      await client.request<void>(path, { method: 'DELETE' });
    },

    async get(params: { namespace: string; name: string; cluster: string; signal?: AbortSignal }): Promise<ComposedAppDetail> {
      const base = KAPIS_RESOURCES + '/namespaces/' + encodeURIComponent(params.namespace);
      const [app, components] = await Promise.all([
        client.request<KubeObject>(base + '/applications/' + encodeURIComponent(params.name), {
          ...(params.signal ? { signal: params.signal } : {}),
        }),
        fetchComponents(client, params.namespace, params.signal),
      ]);
      const summary = toSummary(app, components);
      const selector = selectorOf(app);
      const deployments = matchAll(components.deployments, selector).map((item): ComposedAppWorkload => ({
        kind: 'Deployment',
        name: item.metadata?.name ?? '',
        ...replicasOf(item),
      }));
      const statefulsets = matchAll(components.statefulsets, selector).map((item): ComposedAppWorkload => ({
        kind: 'StatefulSet',
        name: item.metadata?.name ?? '',
        ...replicasOf(item),
      }));
      return {
        ...summary,
        namespace: app.metadata?.namespace ?? params.namespace,
        selector,
        labels: app.metadata?.labels ?? {},
        annotations: app.metadata?.annotations ?? {},
        workloads: [...deployments, ...statefulsets],
        serviceItems: matchAll(components.services, selector).map((item) => ({
          name: item.metadata?.name ?? '',
          type: String(item.spec?.['type'] ?? 'ClusterIP'),
          clusterIP: String(item.spec?.['clusterIP'] ?? '-'),
          ports: (((item.spec?.['ports'] ?? []) as Array<Record<string, unknown>>) ?? []).map((port) => Number(port['port'] ?? 0)),
        })),
        ingressItems: matchAll(components.ingresses, selector).map((item) => ({
          name: item.metadata?.name ?? '',
          hosts: hostsOf(item),
        })),
      };
    },
  };
}

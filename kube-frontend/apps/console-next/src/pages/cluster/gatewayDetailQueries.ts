import { useQuery } from '@tanstack/react-query';
import { promqlApi } from '@kube-ai-hub/api-client';
import { api as apiClient } from '@/api';

/**
 * The cluster gateway's detail data.
 *
 * The current gateway operator deploys the cluster gateway as a Helm release in
 * `kubesphere-controls-system`: a Gateway CR (the requested install) and an Nginx
 * CR (the ingress-nginx release it manages). The address and ports are not on
 * either CR — they belong to the Service the release creates — so the page joins
 * three reads: Gateway + Nginx for identity/class/replicas, the Service for
 * address/ports, and the cluster's Ingresses filtered by `ingressClassName`.
 *
 * Every secondary read is optional: the detail is still worth reading when the
 * Service or the Ingress list is unavailable (RBAC, member cluster), so a failed
 * join degrades to `-` / an empty list instead of failing the page.
 */

export const CLUSTER_GATEWAY_NAMESPACE = 'kubesphere-controls-system';

export interface GatewayPort {
  name: string;
  port: number;
  nodePort: number;
  protocol: string;
}

export interface GatewayCondition {
  type: string;
  status: string;
  reason: string;
}

export interface GatewayDetail {
  name: string;
  namespace: string;
  createdAt: string;
  /** `status.conditions[type=Deployed].status === 'True'`. */
  ready: boolean;
  /** The Deployed condition's message, which explains a failed install. */
  message: string;
  conditions: GatewayCondition[];
  /** `spec.service.type`: NodePort / LoadBalancer. */
  type: string;
  /** The Nginx controller's ingress class — what an Ingress must name to use this gateway. */
  ingressClass: string;
  replicas: string;
  image: string;
  /** The controller's own config keys (`spec.controller.config`). */
  config: Array<{ key: string; value: string }>;
  serviceName: string;
  clusterIP: string;
  ports: GatewayPort[];
  /** What a client types: the load-balancer entry when there is one, else node IP + NodePort. */
  address: string;
  /** The service exposes an HTTPS port, so Ingress TLS can be terminated here. */
  tls: boolean;
  /** `metadata.annotations['kubesphere.io/creator']` — the old console shows it on the card. */
  creator: string;
  /** `spec.deployment.annotations['servicemesh.kubesphere.io/enabled']` — 链路追踪 in the old card. */
  tracing: boolean;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  resourceVersion: string;
}

export interface GatewayPod {
  name: string;
  phase: string;
  ready: boolean;
  restarts: number;
  createdAt: string;
}

export interface GatewayResourceStatus {
  deploymentName: string;
  readyReplicas: number;
  desiredReplicas: number;
  pods: GatewayPod[];
}

export interface GatewayMonitoring {
  available: boolean;
  cpuCores: number;
  memoryBytes: number;
  /** Ingress metrics (request rate / 5xx) are optional: the controller may not scrape them. */
  ingressAvailable: boolean;
  requestRate: number;
  errorRate: number;
  reason?: string;
}

export interface GatewayLogs {
  pod: string;
  container: string;
  text: string;
  available: boolean;
  reason?: string;
}

export interface GatewayIngress {
  name: string;
  namespace: string;
  hosts: string[];
  hasTLS: boolean;
  createdAt: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringRecord(value: unknown): Record<string, string> {
  const record = asRecord(value);
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, text(item)]));
}

function text(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clusterSegment(cluster: string): string {
  return cluster && cluster !== 'host' ? 'clusters/' + encodeURIComponent(cluster) + '/' : '';
}

function gatewayGroupPath(cluster: string, suffix: string): string {
  return '/apis/gateway.kubesphere.io/v1alpha1/' + clusterSegment(cluster) + suffix;
}

function resourcesPath(cluster: string, suffix: string): string {
  return '/kapis/resources.kubesphere.io/v1alpha3/' + clusterSegment(cluster) + suffix;
}

/** The Nginx control-plane object for a Gateway: same release, name suffix `-ingress`. */
function pickNginx(items: Array<Record<string, unknown>>, gatewayName: string): Record<string, unknown> | undefined {
  const matches = items.filter((item) => {
    const metadata = asRecord(item['metadata']);
    const spec = asRecord(item['spec']);
    const fullname = text(spec['fullnameOverride']);
    const itemName = text(metadata['name']);
    return fullname === gatewayName || itemName === gatewayName + '-ingress' || itemName.startsWith(gatewayName);
  });
  return matches[0];
}

function toPorts(service: Record<string, unknown> | undefined): GatewayPort[] {
  const spec = asRecord(service?.['spec']);
  const ports = Array.isArray(spec['ports']) ? (spec['ports'] as Array<Record<string, unknown>>) : [];
  return ports.map((port) => ({
    name: text(port['name']),
    port: num(port['port']),
    nodePort: num(port['nodePort']),
    protocol: text(port['protocol']) || 'TCP',
  }));
}

function loadBalancerAddress(service: Record<string, unknown> | undefined): string {
  const status = asRecord(service?.['status']);
  const lb = asRecord(status['loadBalancer']);
  const entries = Array.isArray(lb['ingress']) ? (lb['ingress'] as Array<Record<string, unknown>>) : [];
  const first = entries[0];
  if (!first) return '';
  return text(first['ip'] ?? first['hostname']);
}

function nodeAddress(nodes: Record<string, unknown> | undefined): string {
  const items = Array.isArray(nodes?.['items']) ? (nodes?.['items'] as Array<Record<string, unknown>>) : [];
  const node = items[0];
  if (!node) return '';
  const status = asRecord(node['status']);
  const addresses = Array.isArray(status['addresses']) ? (status['addresses'] as Array<Record<string, unknown>>) : [];
  const internal = addresses.find((address) => address['type'] === 'InternalIP');
  return text(internal?.['address']);
}

function toIngress(item: Record<string, unknown>): GatewayIngress {
  const metadata = asRecord(item['metadata']);
  const spec = asRecord(item['spec']);
  const rules = Array.isArray(spec['rules']) ? (spec['rules'] as Array<Record<string, unknown>>) : [];
  const tls = Array.isArray(spec['tls']) ? (spec['tls'] as Array<Record<string, unknown>>) : [];
  return {
    name: text(metadata['name']),
    namespace: text(metadata['namespace']),
    hosts: rules.map((rule) => text(rule['host'])).filter(Boolean),
    hasTLS: tls.length > 0,
    createdAt: text(metadata['creationTimestamp']),
  };
}

/** One page's worth of gateway detail: the CRs plus the Service and Ingress join. */
export function useGatewayDetail(cluster: string, name: string) {
  return useQuery({
    queryKey: ['gateway-detail', cluster, name],
    enabled: Boolean(name),
    queryFn: async ({ signal }) => {
      const options = signal ? { signal } : {};
      const namespace = CLUSTER_GATEWAY_NAMESPACE;
      const gateway = await apiClient.request<Record<string, unknown>>(
        gatewayGroupPath(cluster, 'namespaces/' + namespace + '/gateways/' + encodeURIComponent(name)),
        options,
      );

      const nginxBody = await apiClient
        .request<{ items?: Array<Record<string, unknown>> }>(gatewayGroupPath(cluster, 'namespaces/' + namespace + '/nginxes'), options)
        .catch(() => undefined);
      const nginx = pickNginx(nginxBody?.items ?? [], name);
      const nginxSpec = asRecord(nginx?.['spec']);
      const controller = asRecord(nginxSpec['controller']);
      const image = asRecord(controller['image']);

      const gatewaySpec = asRecord(gateway['spec']);
      const gatewayController = asRecord(gatewaySpec['controller']);
      const serviceName = text(nginxSpec['fullnameOverride']) || name;

      const service = await apiClient
        .request<Record<string, unknown>>(resourcesPath(cluster, 'namespaces/' + namespace + '/services/' + encodeURIComponent(serviceName)), options)
        .catch(() => undefined);
      const nodes = await apiClient
        .request<Record<string, unknown>>(resourcesPath(cluster, 'nodes'), { ...options, query: { limit: 1 } })
        .catch(() => undefined);

      const ingressClass = text(controller['ingressClass']);
      const ingressBody = await apiClient
        .request<{ items?: Array<Record<string, unknown>> }>(resourcesPath(cluster, 'ingresses'), { ...options, query: { limit: -1 } })
        .catch(() => undefined);
      const ingresses = (ingressBody?.items ?? [])
        .filter((item) => text(asRecord(item['spec'])['ingressClassName']) === ingressClass)
        .map(toIngress);

      const conditions = (Array.isArray(asRecord(gateway['status'])['conditions'])
        ? (asRecord(gateway['status'])['conditions'] as Array<Record<string, unknown>>)
        : []
      ).map((condition) => ({
        type: text(condition['type']),
        status: text(condition['status']),
        reason: text(condition['reason']),
      }));
      const deployed = conditions.find((condition) => condition.type === 'Deployed');
      const serviceSpec = asRecord(service?.['spec']);
      const ports = toPorts(service);
      const httpPort = ports.find((port) => port.name === 'http') ?? ports[0];
      const nodeIP = nodeAddress(nodes);
      const address =
        loadBalancerAddress(service) ||
        (text(serviceSpec['type'] || gatewaySpec['type']) === 'NodePort' && nodeIP && httpPort?.nodePort
          ? nodeIP + ':' + httpPort.nodePort
          : '');

      const config = Object.entries(asRecord(gatewayController['config'])).map(([key, value]) => ({ key, value: text(value) }));

      const podsBody = await apiClient
        .request<{ items?: Array<Record<string, unknown>> }>(resourcesPath(cluster, 'namespaces/' + namespace + '/pods'), {
          query: { labelSelector: 'app.kubernetes.io/instance=' + name + '-ingress', limit: 50 },
          ...options,
        })
        .catch(() => undefined);
      const deploymentBody = await apiClient
        .request<Record<string, unknown>>(resourcesPath(cluster, 'namespaces/' + namespace + '/deployments/' + encodeURIComponent(serviceName)), options)
        .catch(() => undefined);
      const deploymentStatus = asRecord(deploymentBody?.['status']);
      const deploymentSpec = asRecord(deploymentBody?.['spec']);
      const resourceStatus: GatewayResourceStatus = {
        deploymentName: serviceName,
        readyReplicas: Number(deploymentStatus['readyReplicas'] ?? 0),
        desiredReplicas: Number(deploymentSpec['replicas'] ?? 0),
        pods: (podsBody?.items ?? []).map((pod): GatewayPod => {
          const metadata = asRecord(pod['metadata']);
          const status = asRecord(pod['status']);
          const statuses = (status['containerStatuses'] ?? []) as Array<Record<string, unknown>>;
          return {
            name: text(metadata['name']),
            phase: text(status['phase']),
            ready: statuses.length > 0 && statuses.every((entry) => entry['ready'] === true),
            restarts: statuses.reduce((sum, entry) => sum + Number(entry['restartCount'] ?? 0), 0),
            createdAt: text(metadata['creationTimestamp']),
          };
        }),
      };

      const detail: GatewayDetail = {
        name: text(asRecord(gateway['metadata'])['name']) || name,
        namespace: text(asRecord(gateway['metadata'])['namespace']) || namespace,
        createdAt: text(asRecord(gateway['metadata'])['creationTimestamp']),
        ready: deployed?.status === 'True',
        message: text(deployed?.reason) === 'InstallSuccessful' ? '' : text(deployed?.reason),
        conditions,
        type: text(serviceSpec['type']) || text(gatewaySpec['type']),
        ingressClass,
        replicas: text(controller['replicaCount']) || text(gatewayController['replicas']),
        image: image['repository'] ? text(image['repository']) + (image['tag'] ? ':' + text(image['tag']) : '') : '',
        config,
        serviceName,
        clusterIP: text(serviceSpec['clusterIP']),
        ports,
        address,
        tls: ports.some((port) => port.name === 'https' || port.port === 443),
        creator: text(asRecord(asRecord(gateway['metadata'])['annotations'])['kubesphere.io/creator']),
        tracing:
          text(asRecord(asRecord(gatewaySpec['deployment'])['annotations'])['servicemesh.kubesphere.io/enabled']) ===
          'true',
        labels: stringRecord(asRecord(gateway['metadata'])['labels']),
        annotations: stringRecord(asRecord(gateway['metadata'])['annotations']),
        resourceVersion: text(asRecord(gateway['metadata'])['resourceVersion']),
      };
      let logs: GatewayLogs = { pod: '', container: '', text: '', available: false };
      const firstPod = resourceStatus.pods[0];
      if (firstPod) {
        // The controller pod has two containers (istio-proxy + controller); the API needs
        // an explicit container name when more than one exists.
        const podBody = await apiClient
          .request<Record<string, unknown>>(resourcesPath(cluster, 'namespaces/' + namespace + '/pods/' + encodeURIComponent(firstPod.name)), options)
          .catch(() => undefined);
        const containers = (((asRecord(podBody?.['spec'])['containers'] ?? []) as Array<Record<string, unknown>>) ?? []).map((item) =>
          text(item['name']),
        );
        const container = containers.includes('controller') ? 'controller' : containers[0] ?? '';
        try {
          const text = await apiClient.request<string>(
            '/api/v1/namespaces/' + encodeURIComponent(namespace) + '/pods/' + encodeURIComponent(firstPod.name) + '/log',
            { query: { container, tailLines: 200 }, ...options },
          );
          logs = { pod: firstPod.name, container, text: typeof text === 'string' ? text : '', available: true };
        } catch (error) {
          logs = {
            pod: firstPod.name,
            container,
            text: '',
            available: false,
            reason: error instanceof Error ? error.message : String(error),
          };
        }
      }

      const monitoring: GatewayMonitoring = {
        available: true,
        cpuCores: 0,
        memoryBytes: 0,
        ingressAvailable: false,
        requestRate: 0,
        errorRate: 0,
      };
      try {
        const selector = 'namespace="' + namespace + '",pod=~"' + serviceName + '.*",container="controller"';
        const prom = promqlApi(apiClient);
        const [cpu, memory, requests, errors] = await Promise.all([
          prom.instant({ query: 'sum(rate(container_cpu_usage_seconds_total{' + selector + '}[5m]))' }),
          prom.instant({ query: 'sum(container_memory_working_set_bytes{' + selector + '})' }),
          prom.instant({ query: 'sum(rate(nginx_ingress_controller_requests{namespace="' + namespace + '"}[5m]))' }),
          prom.instant({ query: 'sum(rate(nginx_ingress_controller_requests{namespace="' + namespace + '",status=~"5.."}[5m]))' }),
        ]);
        const value = (series: Array<{ points: Array<{ value: number }> }>): number => series[0]?.points.at(-1)?.value ?? 0;
        monitoring.cpuCores = value(cpu);
        monitoring.memoryBytes = value(memory);
        monitoring.ingressAvailable = requests.length > 0;
        monitoring.requestRate = value(requests);
        monitoring.errorRate = value(errors);
      } catch (error) {
        monitoring.available = false;
        monitoring.reason = error instanceof Error ? error.message : String(error);
      }

      return { detail, ingresses, resourceStatus, logs, monitoring };
    },
  });
}

import { useQuery } from '@tanstack/react-query';
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
      };
      return { detail, ingresses };
    },
  });
}

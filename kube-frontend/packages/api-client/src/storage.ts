import type { Client } from './client';
import { baseOf, resourceApi, type KubeObject, type ResourceBase } from './resources';

/**
 * Storage: persistent volume claims and volume snapshots.
 *
 * Both are read-mostly resources with a short column set, so one module serves
 * both and the list page is descriptor-driven — the same shape the application
 * workloads use, without their status derivation (a PVC reports a `phase` the
 * API already decided, and a snapshot reports `readyToUse`).
 */

export type StorageKind = 'persistentvolumeclaims' | 'volumesnapshots';

interface KubeStorage extends KubeObject {
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

/** What the storage list shows for one object. */
export interface StorageSummary extends ResourceBase {
  kind: StorageKind;
  /** PVC phase (`Bound`, `Pending`, `Lost`) or snapshot readiness. */
  status: string;
  /** `spec.storageClassName`, empty for a default-class claim. */
  storageClass: string;
  /** `spec.resources.requests.storage` (PVC) or `status.restoreSize` (snapshot). */
  capacity: string;
  /** Access modes in the old console's short form (`RWO`, `ROX`, `RWX`, `RWOP`). */
  accessModes: string[];
  /**
   * Whether a pod currently mounts this claim (`已挂载` / `未挂载`).
   *
   * `undefined` means "not computed yet": the answer requires listing every pod in the
   * project, which is slow against this cluster's API (see the PERFORMANCE note below),
   * so the column starts unknown and fills in when that list arrives. Rendering it as
   * `未挂载` before the scan finishes would be a statement the data does not support.
   */
  inUse?: boolean;
  /** Annotations: 编辑信息 edits them in place. */
  annotations: Record<string, string>;
  /**
   * Whether the claim's StorageClass allows expansion.
   *
   * Filled by the page after it resolves the class; a claim whose class forbids
   * expansion must not offer the control at all, because the apiserver would reject
   * the write and the failure would look like our bug.
   */
  expandable?: boolean;
}

/** The old console's abbreviations, used in the access-mode column. */
const ACCESS_MODE_LABELS: Readonly<Record<string, string>> = {
  ReadWriteOnce: 'RWO',
  ReadOnlyMany: 'ROX',
  ReadWriteMany: 'RWX',
  ReadWriteOncePod: 'RWOP',
};

export function accessModeLabel(mode: string): string {
  return ACCESS_MODE_LABELS[mode] ?? mode;
}

/**
 * PVC status.
 *
 * `phase` is authoritative; the enhancement conditions the old console looks at
 * (`Resizing`, `FileSystemResizePending`) only mean something while the claim is
 * bound, so they are folded into the same string rather than inventing a second
 * column.
 */
export function claimStatus(item: KubeStorage): string {
  const conditions = (item.status?.['conditions'] ?? []) as Array<Record<string, unknown>>;
  const detail = conditions.find((condition) =>
    ['FileSystemResizePending', 'Resizing'].includes(String(condition['type'] ?? '')),
  );
  if (detail) return String(detail['type']);
  return String(item.status?.['phase'] ?? '');
}

/** Snapshot status: `readyToUse` is the only bit the reader cares about. */
export function snapshotStatus(item: KubeStorage): string {
  if (item.status?.['readyToUse'] === true) return 'Ready';
  if (item.status?.['error']) return String((item.status?.['error'] as Record<string, unknown>)['message'] ?? 'Error');
  return 'Pending';
}

export function toStorageSummary(kind: StorageKind, item: KubeStorage): StorageSummary {
  const spec = (item.spec ?? {}) as Record<string, unknown>;
  const requested = ((spec['resources'] as Record<string, unknown> | undefined)?.['requests'] ?? {}) as Record<string, unknown>;
  const modes = (spec['accessModes'] ?? []) as string[];
  return {
    ...baseOf(item),
    kind,
    status: kind === 'persistentvolumeclaims' ? claimStatus(item) : snapshotStatus(item),
    storageClass: String(spec['storageClassName'] ?? ''),
    capacity:
      kind === 'persistentvolumeclaims'
        ? String(requested['storage'] ?? '')
        : String(item.status?.['restoreSize'] ?? ''),
    accessModes: modes.map(accessModeLabel),
    annotations: item.metadata?.annotations ?? {},
  };
}

/** Storage detail adds the fields the list deliberately leaves out. */
export interface StorageDetail extends StorageSummary {
  /** `spec.volumeName` for a claim: which PV backs it. */
  volumeName: string;
  /** Snapshot only: the claim it was taken from. */
  sourceClaim: string;
  /**
   * The driver that provisions claims for this class.
   *
   * Read from the claim's provisioner annotation, which the storage layer stamps when
   * it binds a volume — the class object itself is cluster-scoped and would need a
   * second request for one string.
   */
  provisioner: string;
  /** Snapshot only: the VolumeSnapshotClass used, from `spec.volumeSnapshotClassName`. */
  snapshotClass: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  raw: KubeStorage;
}

export function toStorageDetail(kind: StorageKind, item: KubeStorage): StorageDetail {
  const spec = (item.spec ?? {}) as Record<string, unknown>;
  const source = (spec['source'] as Record<string, unknown> | undefined)?.['persistentVolumeClaim'] as
    | Record<string, unknown>
    | undefined;
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  return {
    ...toStorageSummary(kind, item),
    volumeName: String(spec['volumeName'] ?? ''),
    sourceClaim: String(source?.['name'] ?? ''),
    provisioner:
      annotations['volume.kubernetes.io/storage-provisioner'] ??
      annotations['volume.beta.kubernetes.io/storage-provisioner'] ??
      '',
    snapshotClass: String(spec['volumeSnapshotClassName'] ?? ''),
    labels: item.metadata?.labels ?? {},
    annotations: item.metadata?.annotations ?? {},
    raw: item,
  };
}

/**
 * Whether a StorageClass allows online expansion.
 *
 * `allowVolumeExpansion` is the StorageClass's own flag. The old console additionally
 * consulted the CSI driver's `expandMode`; the flag is the one that decides whether
 * the apiserver accepts the change, so that is what the UI gates on — the driver's
 * mode only says how far it can go.
 */
export function storageClassExpands(storageClass: KubeObject | undefined): boolean {
  return storageClass?.allowVolumeExpansion === true;
}

/**
 * Grow a claim.
 *
 * Kubernetes only ever allows the request to go **up**: shrinking is not supported,
 * and a smaller value is rejected. The size is a merge patch on
 * `spec.resources.requests.storage`, so the rest of the claim (and its binding) is
 * untouched.
 */
export function storageApi(client: Client, kind: StorageKind) {
  // Named so `expand` can call `patch` on it instead of relying on `this`.
  const api = resourceApi<KubeStorage, StorageSummary, StorageDetail>(client, {
    resource: kind,
    toSummary: (item) => toStorageSummary(kind, item),
    toDetail: (item) => toStorageDetail(kind, item),
  });
  return {
    ...api,
    kind,
    /** PVC only: request a larger size for the claim. */
    expand(params: { cluster: string; namespace: string; name: string; storageClass: string; storage: string }): Promise<StorageDetail> {
      return api.patch({
        cluster: params.cluster,
        namespace: params.namespace,
        name: params.name,
        body: { spec: { resources: { requests: { storage: params.storage } } } },
      });
    },
  };
}

export type StorageApi = ReturnType<typeof storageApi>;

/* ------------------------------------------------------------------ *
 * Cluster-scoped reads: nodes and namespaces (projects).
 * ------------------------------------------------------------------ */

interface KubeNode extends KubeObject {
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

/** One row of the cluster's node list. */
export interface NodeSummary extends ResourceBase {
  /** `Ready` / `NotReady` / `Unknown`, from the Ready condition. */
  status: string;
  /** Control-plane / worker, derived from the node's labels as the old console does. */
  role: string;
  /** `status.nodeInfo.kubeletVersion`. */
  version: string;
  /** Internal IP, the address people use to reach the node. */
  internalIP: string;
  /** `status.allocatable.cpu`. */
  cpu: string;
  /** `status.allocatable.memory`. */
  memory: string;
  /**
   * Whether the scheduler may place new pods on this node.
   *
   * `spec.unschedulable: true` — the old console's 停止调度. A cordoned node still runs
   * what it runs; it only stops taking new work, which is why this is a column-worthy
   * fact and not just a flag in a detail page.
   */
  unschedulable: boolean;
  /** Current usage from the metrics API, absent when metrics are unavailable. */
  cpuUsage?: string;
  memoryUsage?: string;
  /** `used / allocatable`, 0–100, rounded. Absent without metrics. */
  cpuPercent?: number;
  memoryPercent?: number;
}

/**
 * Parse a Kubernetes quantity into a number for arithmetic.
 *
 * `9983741666n` (nano-cores) and `1282375024Ki` are different units of the same thing;
 * comparing them directly is how a usage column ends up showing 3000%.
 */
export function quantityToNumber(quantity: string): number {
  const match = /^([0-9.]+)([a-zA-Z]*)$/.exec(quantity.trim());
  if (!match?.[1]) return 0;
  const value = Number(match[1]);
  const units: Record<string, number> = {
    '': 1,
    n: 1e-9,
    u: 1e-6,
    m: 1e-3,
    k: 1e3,
    M: 1e6,
    G: 1e9,
    T: 1e12,
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
  };
  return value * (units[match[2] ?? ''] ?? 1);
}

/** `used / capacity` as a rounded percentage, clamped to 0–100. */
export function usagePercent(used: string, capacity: string): number | undefined {
  const total = quantityToNumber(capacity);
  if (!Number.isFinite(total) || total <= 0) return undefined;
  const percent = Math.round((quantityToNumber(used) / total) * 100);
  return Math.max(0, Math.min(100, percent));
}

/** `node-role.kubernetes.io/<role>` labels, minus the ones that are not roles. */
export function nodeRole(item: KubeNode): string {
  const labels = (item.metadata?.labels ?? {}) as Record<string, string>;
  const roles = Object.keys(labels)
    .filter((key) => key.startsWith('node-role.kubernetes.io/'))
    .map((key) => key.slice('node-role.kubernetes.io/'.length))
    .filter((role) => role && role !== 'worker');
  return roles.length > 0 ? roles.join(', ') : 'worker';
}

/** The Ready condition decides health; a node without one is not usable yet. */
export function nodeStatus(item: KubeNode): string {
  const conditions = (item.status?.['conditions'] ?? []) as Array<Record<string, unknown>>;
  const ready = conditions.find((condition) => condition['type'] === 'Ready');
  if (!ready) return 'Unknown';
  return String(ready['status']) === 'True' ? 'Ready' : 'NotReady';
}

function nodeAddress(item: KubeNode, type: string): string {
  const addresses = (item.status?.['addresses'] ?? []) as Array<Record<string, unknown>>;
  const match = addresses.find((address) => address['type'] === type);
  return String(match?.['address'] ?? '');
}

/** One condition of a node, as the kubelet reports it. */
export interface NodeCondition {
  type: string;
  /** 'True' | 'False' | 'Unknown'. */
  status: string;
  reason: string;
  message: string;
  lastTransitionTime: string;
}

export interface NodeTaint {
  key: string;
  value: string;
  effect: string;
}

/** Everything the node detail page shows; the list row is a subset of this. */
export interface NodeDetail extends NodeSummary {
  conditions: NodeCondition[];
  capacity: Record<string, string>;
  allocatable: Record<string, string>;
  labels: Record<string, string>;
  taints: NodeTaint[];
  nodeInfo: {
    osImage: string;
    kernelVersion: string;
    containerRuntimeVersion: string;
    architecture: string;
    operatingSystem: string;
    kubeletVersion: string;
  };
}

export function toNodeDetail(item: KubeNode): NodeDetail {
  const status = (item.status ?? {}) as Record<string, unknown>;
  const asRecord = (value: unknown): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [key, entry] of Object.entries((value ?? {}) as Record<string, unknown>)) {
      out[key] = String(entry ?? '');
    }
    return out;
  };
  const nodeInfo = (status['nodeInfo'] ?? {}) as Record<string, unknown>;
  const conditions = ((status['conditions'] ?? []) as Array<Record<string, unknown>>).map((condition) => ({
    type: String(condition['type'] ?? ''),
    status: String(condition['status'] ?? ''),
    reason: String(condition['reason'] ?? ''),
    message: String(condition['message'] ?? ''),
    lastTransitionTime: String(condition['lastTransitionTime'] ?? ''),
  }));
  return {
    ...toNodeSummary(item),
    conditions,
    capacity: asRecord(status['capacity']),
    allocatable: asRecord(status['allocatable']),
    labels: (item.metadata?.labels ?? {}) as Record<string, string>,
    taints: (((item.spec ?? {})['taints'] ?? []) as Array<Record<string, unknown>>).map((taint) => ({
      key: String(taint['key'] ?? ''),
      value: String(taint['value'] ?? ''),
      effect: String(taint['effect'] ?? ''),
    })),
    nodeInfo: {
      osImage: String(nodeInfo['osImage'] ?? ''),
      kernelVersion: String(nodeInfo['kernelVersion'] ?? ''),
      containerRuntimeVersion: String(nodeInfo['containerRuntimeVersion'] ?? ''),
      architecture: String(nodeInfo['architecture'] ?? ''),
      operatingSystem: String(nodeInfo['operatingSystem'] ?? ''),
      kubeletVersion: String(nodeInfo['kubeletVersion'] ?? ''),
    },
  };
}

export function toNodeSummary(item: KubeNode): NodeSummary {
  const nodeInfo = (item.status?.['nodeInfo'] ?? {}) as Record<string, unknown>;
  const allocatable = (item.status?.['allocatable'] ?? {}) as Record<string, unknown>;
  return {
    ...baseOf(item),
    status: nodeStatus(item),
    role: nodeRole(item),
    version: String(nodeInfo['kubeletVersion'] ?? ''),
    internalIP: nodeAddress(item, 'InternalIP'),
    cpu: String(allocatable['cpu'] ?? ''),
    memory: String(allocatable['memory'] ?? ''),
    unschedulable: (item.spec ?? {})['unschedulable'] === true,
  };
}

/** One row of the cluster's project (namespace) list. */
export interface NamespaceSummary extends ResourceBase {
  /** `Active` / `Terminating`. */
  status: string;
  /** The workspace the project belongs to, from `kubesphere.io/workspace`. */
  workspace: string;
}

export function toNamespaceSummary(item: KubeObject): NamespaceSummary {
  const labels = (item.metadata?.labels ?? {}) as Record<string, string>;
  return {
    ...baseOf(item),
    status: String((item.status as Record<string, unknown> | undefined)?.['phase'] ?? ''),
    workspace: labels['kubesphere.io/workspace'] ?? '',
  };
}

/** Nodes: cluster-scoped, so no namespace segment. */
export function nodesApi(client: Client) {
  return {
    ...resourceApi<KubeNode, NodeSummary, NodeDetail>(client, {
      resource: 'nodes',
      toSummary: toNodeSummary,
      toDetail: toNodeDetail,
    }),
    kind: 'nodes' as const,
  };
}

/**
 * Cordon and uncordon a node — the old console's 停止调度 / 启动调度.
 *
 * `spec.unschedulable` on the node itself; the scheduler honours it immediately. A merge
 * patch, because the node object is owned by kubelet and the cloud controller, and a PUT
 * would race them for every other field.
 */
export function nodesWriteApi(client: Client) {
  return {
    async setUnschedulable(params: { name: string; unschedulable: boolean }): Promise<void> {
      await client.request(`/api/v1/nodes/${encodeURIComponent(params.name)}`, {
        method: 'PATCH',
        contentType: 'application/merge-patch+json',
        body: { spec: { unschedulable: params.unschedulable } },
      });
    },
  };
}

export function namespacesApi(client: Client) {
  return {
    ...resourceApi<KubeObject, NamespaceSummary, NamespaceSummary>(client, {
      resource: 'namespaces',
      toSummary: toNamespaceSummary,
      toDetail: toNamespaceSummary,
    }),
    kind: 'namespaces' as const,
  };
}

/* ------------------------------------------------------------------ *
 * Cluster-scoped: storage classes.
 * ------------------------------------------------------------------ */

/** One StorageClass row, as the cluster console shows it. */
export interface StorageClassSummary extends ResourceBase {
  /** The CSI or in-tree driver that creates volumes. */
  provisioner: string;
  /** `Delete` / `Retain`. */
  reclaimPolicy: string;
  /** `Immediate` / `WaitForFirstConsumer`. */
  volumeBindingMode: string;
  /** Whether new claims default to this class. */
  isDefault: boolean;
  allowExpansion: boolean;
  allowCloning: boolean;
  /** Snapshot support is declared by the CSI driver, not by the class itself. */
  allowSnapshot: boolean;
  /** Number of claims referencing this class, from `kubesphere.io/pvc-count` when the
   * platform reports it; `undefined` when it does not, so the column can say so instead
   * of showing a misleading zero. */
  pvcCount: number | undefined;
}

interface KubeStorageClass extends KubeObject {
  provisioner?: string;
  reclaimPolicy?: string;
  volumeBindingMode?: string;
  allowVolumeExpansion?: boolean;
  /** KubeSphere extensions: cloning and snapshots are declared on the class. */
  allowVolumeCloning?: boolean;
  allowVolumeSnapshot?: boolean;
}

const DEFAULT_CLASS_ANNOTATIONS = [
  'storageclass.kubernetes.io/is-default-class',
  // Older clusters wrote the beta spelling; both still appear in the wild.
  'storageclass.beta.kubernetes.io/is-default-class',
];

export function toStorageClassSummary(item: KubeStorageClass): StorageClassSummary {
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  const rawCount = annotations['kubesphere.io/pvc-count'] ?? annotations['kubesphere.io/persistentvolumeclaims'];
  const parsed = rawCount === undefined ? Number.NaN : Number(rawCount);
  return {
    ...baseOf(item),
    provisioner: String(item.provisioner ?? ''),
    // Kubernetes defaults these when unset; showing the empty string would read as
    // "unknown" for a value that is perfectly well defined.
    reclaimPolicy: String(item.reclaimPolicy ?? 'Delete'),
    volumeBindingMode: String(item.volumeBindingMode ?? 'Immediate'),
    isDefault: DEFAULT_CLASS_ANNOTATIONS.some((key) => annotations[key] === 'true'),
    allowExpansion: item.allowVolumeExpansion === true,
    allowCloning: item.allowVolumeCloning === true || annotations['storageclass.kubesphere.io/allow-cloning'] === 'true',
    allowSnapshot: item.allowVolumeSnapshot === true || annotations['storageclass.kubesphere.io/allow-snapshot'] === 'true',
    pvcCount: Number.isFinite(parsed) ? parsed : undefined,
  };
}

export function storageClassesApi(client: Client) {
  return {
    ...resourceApi<KubeStorageClass, StorageClassSummary, StorageClassSummary>(client, {
      resource: 'storageclasses',
      toSummary: toStorageClassSummary,
      toDetail: toStorageClassSummary,
    }),
    kind: 'storageclasses' as const,
  };
}

/* ------------------------------------------------------------------ *
 * Cluster-scoped: platform components.
 * ------------------------------------------------------------------ */

/** One platform component row. */
export interface ComponentSummary extends ResourceBase {
  /** `healthyBackends / totalBackends`, when the platform reports them. */
  healthy: number;
  total: number;
  /** `startedAt`, the closest thing to an uptime the API gives. */
  startedAt: string;
  /** True when every backend is healthy; a component with no backends is not. */
  up: boolean;
}

interface KubeComponent extends KubeObject {
  healthyBackends?: number;
  totalBackends?: number;
  startedAt?: string;
  namespace?: string;
}

/**
 * Components come back as a **bare array**, not an `{ items }` envelope.
 *
 * KubeSphere's `/kapis/resources.kubesphere.io/v1alpha3/components` is a plain
 * list endpoint (verified: the body starts with `[`), so it cannot go through
 * `resourceApi` — that expects the standard envelope. The reader below takes the
 * array directly and says so, because the mismatch is otherwise a silent empty page.
 */
export function toComponentSummary(item: KubeComponent): ComponentSummary {
  const healthy = Number(item.healthyBackends ?? 0);
  const total = Number(item.totalBackends ?? 0);
  return {
    ...baseOf({
      metadata: {
        name: item.name ?? '',
        namespace: item.namespace ?? '',
        creationTimestamp: item.startedAt ?? '',
      },
    } as KubeObject),
    healthy,
    total,
    startedAt: String(item.startedAt ?? ''),
    // A component with zero backends has nothing to be healthy: reporting it as "up"
    // would hide a component that never started.
    up: total > 0 && healthy === total,
  };
}

export function componentsApi(client: Client) {
  return {
    kind: 'components' as const,
    async list(params: { signal?: AbortSignal } = {}): Promise<{ items: ComponentSummary[]; total: number }> {
      const body = await client.request<KubeComponent[] | { items?: KubeComponent[] }>(
        '/kapis/resources.kubesphere.io/v1alpha3/components',
        params.signal ? { signal: params.signal } : {},
      );
      // Accept both shapes: the envelope may appear on other cluster versions, and
      // treating an array as "no data" would be a silent empty page.
      const items = Array.isArray(body) ? body : (body?.items ?? []);
      const summaries = items.map(toComponentSummary);
      return { items: summaries, total: summaries.length };
    },
  };
}

/* ------------------------------------------------------------------ *
 * Project gateway.
 * ------------------------------------------------------------------ */

/** The gateway serving a project. */
export interface ProjectGateway {
  name: string;
  /** Whether a Gateway object exists for the project. */
  exists: boolean;
  /** `NodePort` / `LoadBalancer`, from the status the controller reports. */
  type: string;
  /** The address clients use, when the controller has assigned one. */
  address: string;
  /** Whether the controller reports the deployment as ready. */
  ready: boolean;
  /** The condition message, which is what explains a gateway that is not ready. */
  message: string;
}

interface KubeGateway extends KubeObject {
  spec?: Record<string, unknown>;
  status?: { conditions?: Array<Record<string, unknown>>; loadBalancer?: Record<string, unknown> };
}

/**
 * A project gateway is a `Gateway` object in the project's namespace.
 *
 * The controller rewrites `spec` and reports progress in `status.conditions`, so the
 * page reads readiness from conditions rather than from spec: spec says what was
 * asked for, conditions say what happened.
 */
export function toProjectGateway(item: KubeGateway | undefined): ProjectGateway {
  if (!item) {
    return { name: '', exists: false, type: '', address: '', ready: false, message: '' };
  }
  const conditions = (item.status?.conditions ?? []) as Array<Record<string, unknown>>;
  const deployed = conditions.find((condition) => condition['type'] === 'Deployed');
  const ingress = item.status?.loadBalancer as Record<string, unknown> | undefined;
  const ingressEntries = (ingress?.['ingress'] ?? []) as Array<Record<string, unknown>>;
  return {
    name: item.metadata?.name ?? '',
    exists: true,
    type: String((item.spec?.['type'] ?? '') || ''),
    address: String(ingressEntries[0]?.['ip'] ?? ingressEntries[0]?.['hostname'] ?? ''),
    ready: deployed?.['status'] === 'True',
    message: String(deployed?.['message'] ?? ''),
  };
}

export function projectGatewayApi(client: Client) {
  const base = (namespace: string) =>
    `/apis/gateway.kubesphere.io/v1alpha1/namespaces/${encodeURIComponent(namespace)}/gateways`;
  return {
    /** The project's gateway, or an `exists: false` value when it has none. */
    async get(params: { namespace: string; signal?: AbortSignal }): Promise<ProjectGateway> {
      const body = await client
        .request<{ items?: KubeGateway[] }>(base(params.namespace), params.signal ? { signal: params.signal } : {})
        .catch(() => undefined);
      return toProjectGateway(body?.items?.[0]);
    },

    /**
     * Create the project gateway.
     *
     * A NodePort gateway is what the old console offers by default: it needs no cloud
     * load balancer, so it works on any cluster. The controller fills in the rest of
     * the spec and reports progress through conditions.
     */
    async create(params: { namespace: string; type?: string }): Promise<ProjectGateway> {
      const item = await client.request<KubeGateway>(base(params.namespace), {
        method: 'POST',
        body: {
          apiVersion: 'gateway.kubesphere.io/v1alpha1',
          kind: 'Gateway',
          metadata: { name: 'kubesphere-router-' + params.namespace, namespace: params.namespace },
          spec: { type: params.type ?? 'NodePort', replicas: 1, ports: [{ name: 'http', port: 80, protocol: 'TCP' }] },
        },
      });
      return toProjectGateway(item);
    },

    async remove(params: { namespace: string; name: string }): Promise<void> {
      await client.request<void>(`${base(params.namespace)}/${encodeURIComponent(params.name)}`, { method: 'DELETE' });
    },
  };
}

/**
 * Compute which claims are mounted, from one project's pod list.
 *
 * PERFORMANCE: listing pods is the expensive call here — measured at ~11s for 35 pods
 * and ~58s for 81 pods against the current cluster, because the upstream API scales
 * with object count rather than response size. The column is therefore populated by a
 * single list call shared by the whole page (not one call per row), and it shows
 * `计算中` until that call returns. Migrating the feature faithfully was the priority;
 * a cheaper source (a projected volume field, or a cached sweep) is the follow-up.
 *
 * A pod that is terminating still counts as mounting the claim: the volume is not free
 * until the pod is gone, and telling an operator "未挂载" while a pod is still shutting
 * down is how a claim gets deleted out from under a running process.
 */
export function mountsOf(pods: Array<Record<string, unknown>>): Set<string> {
  const mounted = new Set<string>();
  for (const pod of pods) {
    const volumes = (((pod['spec'] as Record<string, unknown> | undefined)?.['volumes'] ?? []) as Array<Record<string, unknown>>);
    for (const volume of volumes) {
      const claim = ((volume['persistentVolumeClaim'] as Record<string, unknown> | undefined)?.['claimName']) as string | undefined;
      if (claim) mounted.add(claim);
    }
  }
  return mounted;
}

/** Attach the computed `inUse` to every claim row; snapshots are left untouched. */
export function withMountState<T extends { kind: StorageKind; name: string }>(rows: T[], mounted: Set<string> | undefined): T[] {
  if (!mounted) return rows;
  return rows.map((row) => (row.kind === 'persistentvolumeclaims' ? { ...row, inUse: mounted.has(row.name) } : row));
}

/* ------------------------------------------------------------------ *
 * Cluster-scoped: persistent volumes.
 * ------------------------------------------------------------------ */

/** One PersistentVolume row. */
export interface PersistentVolumeSummary extends ResourceBase {
  /** `spec.capacity.storage`, e.g. `5Ti`. */
  capacity: string;
  accessModes: string[];
  /** `Retain` / `Delete` / `Recycle`. */
  reclaimPolicy: string;
  /** `Bound` / `Available` / `Released` / `Failed`. */
  status: string;
  /** `spec.storageClassName`, empty for a statically provisioned volume. */
  storageClass: string;
  /** The claim holding it, `<namespace>/<name>`; empty when unbound. */
  claim: string;
  /** Follow-up after retain: the claim that was released. */
  claimNamespace: string;
}

interface KubePersistentVolume extends KubeObject {
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

export function toPersistentVolumeSummary(item: KubePersistentVolume): PersistentVolumeSummary {
  const spec = (item.spec ?? {}) as Record<string, unknown>;
  const claimRef = (spec['claimRef'] ?? {}) as Record<string, unknown>;
  const modes = ((spec['accessModes'] ?? []) as string[]).map((mode) => ACCESS_MODE_LABELS[mode] ?? mode);
  const capacity = ((spec['capacity'] ?? {}) as Record<string, unknown>)['storage'];
  const claimName = String(claimRef['name'] ?? '');
  const claimNamespace = String(claimRef['namespace'] ?? '');
  return {
    ...baseOf(item),
    capacity: capacity === undefined ? '' : String(capacity),
    accessModes: modes,
    reclaimPolicy: String(spec['persistentVolumeReclaimPolicy'] ?? 'Retain'),
    status: String((item.status ?? {})['phase'] ?? ''),
    storageClass: String(spec['storageClassName'] ?? ''),
    // `<namespace>/<name>`, the form a reader can act on, or just the name when the
    // volume is unbound.
    claim: claimName ? (claimNamespace ? `${claimNamespace}/${claimName}` : claimName) : '',
    claimNamespace,
  };
}

/**
 * Persistent volumes are cluster-scoped and read from the core API.
 *
 * The kapis proxy also serves them, but measured 63s for the list against 24s from
 * `/api/v1/persistentvolumes`; the page reads the faster one and the extra KubeSphere
 * annotations are not worth a minute of waiting.
 */
export function persistentVolumesApi(client: Client) {
  return {
    kind: 'persistentvolumes' as const,
    async list(params: { signal?: AbortSignal } = {}): Promise<{ items: PersistentVolumeSummary[]; total: number }> {
      const body = await client.request<{ items?: KubePersistentVolume[] }>(
        '/api/v1/persistentvolumes',
        params.signal ? { signal: params.signal } : {},
      );
      const items = (body?.items ?? []).map(toPersistentVolumeSummary);
      return { items, total: items.length };
    },
  };
}

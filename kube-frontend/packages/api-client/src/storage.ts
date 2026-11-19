import type { Client } from './client';
import { clusterScoped, coreWritePath } from './paths';
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
   * The same modes in their full Kubernetes spelling (`ReadWriteMany`).
   *
   * Writes need these: a clone copies `spec.accessModes` verbatim and the apiserver rejects the
   * abbreviated labels the column shows. Keeping both means the display and the write path each
   * get the form they need instead of one being derived by string surgery.
   */
  accessModeNames: string[];
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
   * `spec.volumeName` for a claim: the persistent volume that backs it.
   *
   * On the summary rather than the detail because the list shows it as a column — the binding is
   * how a reader gets from a claim to the volume's own fields.
   */
  volumeName: string;
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
    accessModeNames: modes.map(String),
    annotations: item.metadata?.annotations ?? {},
    volumeName: String(spec['volumeName'] ?? ''),
  };
}

/** Storage detail adds the fields the list deliberately leaves out. */
export interface StorageDetail extends StorageSummary {
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
    /** PVC only: create a claim whose dataSource is the given source claim. */
    clone(params: { cluster: string; namespace: string; source: StorageDetail; name: string }): Promise<StorageDetail> {
      return api.create(claimCloneManifest({ ...params.source, accessModes: params.source.accessModeNames }, params.name), {
        cluster: params.cluster,
        namespace: params.namespace,
      });
    },
  };
}

/**
 * A new claim, as the create form describes it.
 *
 * Kept as a pure function so the manifest can be asserted without a network round trip: the
 * interesting part of "create a volume" is exactly which fields the form produces.
 */
export interface ClaimCreateInput {
  name: string;
  namespace: string;
  /** Empty when the cluster's default class should decide. */
  storageClass: string;
  accessModes: string[];
  /** Kubernetes quantity, e.g. `10Gi`. */
  storage: string;
  alias?: string;
  description?: string;
  /** When set, the claim is restored from this snapshot instead of being provisioned empty. */
  fromSnapshot?: { name: string; snapshotClass?: string } | undefined;
}

/** Build the PersistentVolumeClaim body for `POST …/persistentvolumeclaims`. */
export function claimManifest(input: ClaimCreateInput): KubeObject {
  const annotations: Record<string, string> = {};
  if (input.alias?.trim()) annotations['kubesphere.io/alias-name'] = input.alias.trim();
  if (input.description?.trim()) annotations['kubesphere.io/description'] = input.description.trim();
  return {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: {
      name: input.name,
      namespace: input.namespace,
      ...(Object.keys(annotations).length > 0 ? { annotations } : {}),
    },
    spec: {
      accessModes: input.accessModes,
      resources: { requests: { storage: input.storage } },
      /*
       * A restored claim inherits its class from the snapshot: sending one here would either be
       * ignored or conflict with the restored volume, and the old console omits it for the same
       * reason. An empty string means "let the default class decide", which is also an omission.
       */
      ...(input.fromSnapshot
        ? { dataSource: { kind: 'VolumeSnapshot', name: input.fromSnapshot.name, apiGroup: 'snapshot.storage.k8s.io' } }
        : input.storageClass
          ? { storageClassName: input.storageClass }
          : {}),
    },
  } as KubeObject;
}

/**
 * A clone of an existing claim.
 *
 * Kubernetes expresses a clone as a claim whose `dataSource` points at the source claim; the class,
 * access modes and size are inherited from it. Only the name is the administrator's choice, which
 * is why the dialog asks for nothing else.
 */
export function claimCloneManifest(source: {
  name: string;
  namespace: string;
  storageClass: string;
  accessModes: string[];
  capacity: string;
}, name: string): KubeObject {
  return {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: { name, namespace: source.namespace },
    spec: {
      accessModes: source.accessModes,
      resources: { requests: { storage: source.capacity } },
      dataSource: { kind: 'PersistentVolumeClaim', name: source.name },
      ...(source.storageClass ? { storageClassName: source.storageClass } : {}),
    },
  } as KubeObject;
}

/** Build the VolumeSnapshot body for `POST …/volumesnapshots`. */
export function snapshotManifest(input: {
  name: string;
  namespace: string;
  claim: string;
  /** Empty leaves the class to the driver's default. */
  snapshotClass: string;
}): KubeObject {
  return {
    apiVersion: 'snapshot.storage.k8s.io/v1',
    kind: 'VolumeSnapshot',
    metadata: { name: input.name, namespace: input.namespace },
    spec: {
      ...(input.snapshotClass ? { volumeSnapshotClassName: input.snapshotClass } : {}),
      source: { kind: 'PersistentVolumeClaim', persistentVolumeClaimName: input.claim },
    },
  } as KubeObject;
}

export type StorageApi = ReturnType<typeof storageApi>;

/** VolumeSnapshot writes: one action, creating a snapshot of a claim. */
export function volumeSnapshotsWriteApi(client: Client) {
  const api = storageApi(client, 'volumesnapshots');
  return {
    create(params: { cluster: string; namespace: string; name: string; claim: string; snapshotClass: string }): Promise<StorageDetail> {
      return api.create(
        snapshotManifest({ name: params.name, namespace: params.namespace, claim: params.claim, snapshotClass: params.snapshotClass }),
        { cluster: params.cluster, namespace: params.namespace },
      );
    },
  };
}


/* ------------------------------------------------------------------ *
 * Cluster-scoped reads: nodes and namespaces (projects).
 * ------------------------------------------------------------------ */

interface KubeNode extends KubeObject {
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

/** One row of the cluster's node list. */
export interface NodeSummary extends ResourceBase {
  /**
   * The node's overall health, derived the way `kube-server` derives it.
   *
   * `kube-server`'s `getNodeStatus` (`pkg/models/resources/v1alpha3/node/nodes.go`)
   * answers `unschedulable` / `warning` / `running`; the API uses it to *filter*, not
   * to fill a response field, so the list has to reproduce it. `Ready` / `NotReady` /
   * `Unknown` describe the `Ready` condition alone and cannot express "cordoned but
   * healthy" or "a pressure condition is set".
   */
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
  /**
   * The node's taints, in full.
   *
   * On the row, not just the detail, because the cordoned state is explained by one
   * of them (`node.kubernetes.io/unschedulable`): the list shows "无法调度" and the
   * tooltip has to say *which* taints caused it, or the reader has to open the node
   * to find out.
   */
  taints: NodeTaint[];
  /** Current usage from the metrics API, absent when metrics are unavailable. */
  cpuUsage?: string;
  memoryUsage?: string;
  /** `used / allocatable`, 0–100, rounded. Absent without metrics. */
  cpuPercent?: number;
  memoryPercent?: number;
  xpu?: string;
  gpuMode?: string;
  gpuVendor?: string;
  gpuModel?: string;
  gpuModeParams?: Record<string, string>;
  gpuModeStatus?: { status: string; mode: string; message?: string; timestamp: string };
  gpuModeDesired?: { mode: string; params?: Record<string, string>; timestamp: string };
  cpuRequested?: string;
  memoryRequested?: string;
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

/**
 * The node's overall health, matching `kube-server`'s `getNodeStatus`.
 *
 * `kube-server` (`pkg/models/resources/v1alpha3/node/nodes.go`) answers three values
 * and uses them to *filter* the list rather than to fill a response field:
 *
 * - `unschedulable` — `spec.unschedulable` is set (cordoned);
 * - `warning` — any condition in `expectedConditions` is not at its expected status;
 * - `running` — otherwise.
 *
 * Reproduced here because the API does not return it, and because `Ready` alone
 * cannot express either "cordoned but healthy" or "a pressure condition is set".
 * The old console's JS version of this iterated with `health = …` (assignment, not
 * conjunction), so only the *last* condition decided — a node with a real pressure
 * condition could read as healthy. The Go version is the correct one and is what
 * this follows.
 */
export function nodeStatus(item: KubeNode): string {
  if ((item.spec ?? {})['unschedulable'] === true) return 'Unschedulable';
  const conditions = (item.status?.['conditions'] ?? []) as Array<Record<string, unknown>>;
  const unhealthy = conditions.some((condition) => {
    const expected = EXPECTED_CONDITIONS[String(condition['type'] ?? '')];
    return expected !== undefined && String(condition['status']) !== expected;
  });
  return unhealthy ? 'Warning' : 'Running';
}

/**
 * Conditions that are supposed to hold, and the status that says they do.
 *
 * Mirrors `expectedConditions` in `kube-server`'s node model. A condition not listed
 * here carries no expectation, so it cannot make a node unhealthy.
 */
const EXPECTED_CONDITIONS: Record<string, string> = {
  MemoryPressure: 'False',
  DiskPressure: 'False',
  PIDPressure: 'False',
  NetworkUnavailable: 'False',
  ConfigOK: 'True',
  KubeletReady: 'True',
  Ready: 'True',
};

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
  lastHeartbeatTime: string;
}

export interface NodeTaint {
  key: string;
  value: string;
  effect: string;
  timeAdded?: string;
}

/** Everything the node detail page shows; the list row is a subset of this. */
export interface NodeDetail extends NodeSummary {
  /** The object as stored, for the YAML editor; the derived fields above are not YAML. */
  raw: KubeNode;
  conditions: NodeCondition[];
  capacity: Record<string, string>;
  allocatable: Record<string, string>;
  allocated: Record<string, string>;
  allocatedLimits: Record<string, string>;
  gpuTopology: Array<Record<string, string>>;
  labels: Record<string, string>;
  nodeInfo: {
    osImage: string;
    kernelVersion: string;
    containerRuntimeVersion: string;
    architecture: string;
    operatingSystem: string;
    kubeletVersion: string;
    kubeProxyVersion: string;
    gpuDriverVersion: string;
    gpuEngineVersion: string;
    cardCount?: number;
    gpuMemoryTotalMiB?: number;
    deviceSplitCount?: string;
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
    lastHeartbeatTime: String(condition['lastHeartbeatTime'] ?? ''),
  }));
  return {
    ...toNodeSummary(item),
    raw: item,
    conditions,
    capacity: asRecord(status['capacity']),
    allocatable: asRecord(status['allocatable']),
    allocated: asRecord(status['allocated']),
    allocatedLimits: asRecord(status['allocatedLimits']),
    gpuTopology: Array.isArray(nodeInfo['gpuTopology']) ? nodeInfo['gpuTopology'].filter((row) =>
      row && typeof row === 'object' && !Array.isArray(row)).map(asRecord) : [],
    labels: (item.metadata?.labels ?? {}) as Record<string, string>,
    taints: (((item.spec ?? {})['taints'] ?? []) as Array<Record<string, unknown>>).map((taint) => ({
      key: String(taint['key'] ?? ''),
      value: String(taint['value'] ?? ''),
      effect: String(taint['effect'] ?? ''),
      ...(taint['timeAdded'] ? { timeAdded: String(taint['timeAdded']) } : {}),
    })),
    nodeInfo: {
      osImage: String(nodeInfo['osImage'] ?? ''),
      kernelVersion: String(nodeInfo['kernelVersion'] ?? ''),
      containerRuntimeVersion: String(nodeInfo['containerRuntimeVersion'] ?? ''),
      architecture: String(nodeInfo['architecture'] ?? ''),
      operatingSystem: String(nodeInfo['operatingSystem'] ?? ''),
      kubeletVersion: String(nodeInfo['kubeletVersion'] ?? ''),
      kubeProxyVersion: String(nodeInfo['kubeProxyVersion'] ?? ''),
      gpuDriverVersion: String(nodeInfo['gpuDriverVersion'] ?? ''),
      gpuEngineVersion: String(nodeInfo['gpuEngineVersion'] ?? ''),
      ...(nodeInfo['cardCount'] !== undefined && Number.isFinite(Number(nodeInfo['cardCount'])) ? { cardCount: Number(nodeInfo['cardCount']) } : {}),
      ...(nodeInfo['gpuMemoryTotal'] !== undefined && Number.isFinite(Number(nodeInfo['gpuMemoryTotal'])) ? { gpuMemoryTotalMiB: Number(nodeInfo['gpuMemoryTotal']) } : {}),
      ...(nodeInfo['deviceSplitCount'] !== undefined ? { deviceSplitCount: String(nodeInfo['deviceSplitCount']) } : {}),
    },
  };
}

export function toNodeSummary(item: KubeNode): NodeSummary {
  const nodeInfo = (item.status?.['nodeInfo'] ?? {}) as Record<string, unknown>;
  const allocatable = (item.status?.['allocatable'] ?? {}) as Record<string, unknown>;
  const labels = (item.metadata?.labels ?? {}) as Record<string, string>;
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  const annotationObject = (key: string): Record<string, unknown> => {
    try { const value: unknown = JSON.parse(annotations[key] ?? '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
    catch { return {}; }
  };
  const gpuInfo = { ...annotationObject('hami.io/node-gpu-info'), ...nodeInfo };
  const xpu = labels['xpu'] ?? '';
  const dash = xpu.indexOf('-');
  const gpuVendor = String(labels['xpu-vendor'] || (dash > 0 ? xpu.slice(0, dash) : '') || gpuInfo['gpuVendor'] || (xpu === 'CPU' ? 'CPU' : ''));
  const gpuModel = String(labels['xpu-model'] || (dash > 0 ? xpu.slice(dash + 1) : '') || gpuInfo['gpuModel'] || '');
  const modeStatus = (nodeInfo['gpuModeStatus'] ?? annotationObject('hami.io/gpu-mode-status')) as NonNullable<NodeSummary['gpuModeStatus']>;
  const desired = annotationObject('hami.io/gpu-mode-desired') as NonNullable<NodeSummary['gpuModeDesired']>;
  return {
    ...baseOf(item),
    status: nodeStatus(item),
    role: nodeRole(item),
    version: String(nodeInfo['kubeletVersion'] ?? ''),
    internalIP: nodeAddress(item, 'InternalIP'),
    cpu: String(allocatable['cpu'] ?? ''),
    memory: String(allocatable['memory'] ?? ''),
    unschedulable: (item.spec ?? {})['unschedulable'] === true,
    taints: (((item.spec ?? {})['taints'] ?? []) as Array<Record<string, unknown>>).map((taint) => ({
      key: String(taint['key'] ?? ''),
      value: String(taint['value'] ?? ''),
      effect: String(taint['effect'] ?? ''),
      ...(taint['timeAdded'] ? { timeAdded: String(taint['timeAdded']) } : {}),
    })),
    xpu: labels['xpu'] || (labels['xpu-vendor'] ? `${labels['xpu-vendor']}-${labels['xpu-model'] ?? ''}` : 'CPU'),
    gpuMode: String(gpuInfo['virtualCardMode'] ?? ''),
    gpuVendor,
    gpuModel,
    gpuModeParams: (gpuInfo['gpuModeParams'] ?? {}) as Record<string, string>,
    ...(modeStatus.status && modeStatus.timestamp ? { gpuModeStatus: modeStatus } : {}),
    ...(desired.mode && desired.timestamp ? { gpuModeDesired: desired } : {}),
    ...(annotations['node.kubesphere.io/cpu-requests'] !== undefined ? { cpuRequested: annotations['node.kubesphere.io/cpu-requests'] } : {}),
    ...(annotations['node.kubesphere.io/memory-requests'] !== undefined ? { memoryRequested: annotations['node.kubesphere.io/memory-requests'] } : {}),
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
export interface NodeJoinCommand {
  command: string;
  token: string;
  server: string;
  caCertHash: string;
  expiresAt: string;
}

export function nodesWriteApi(client: Client) {
  /*
   * Writes go to the core group, which only the host cluster has.
   *
   * The old form `/api/v1/clusters/<cluster>/nodes/<name>` looked cluster-scoped but the
   * core group has no member-cluster route: measured against `agent`, that URL answers 404
   * and the kapis proxy that *does* carry a cluster segment answers 405 to PATCH. So a
   * member-cluster write has nowhere to go, and `coreWritePath` refuses it instead of
   * silently patching the host cluster's node of the same name.
   */
  const path = (cluster: string | undefined, name: string) =>
    coreWritePath(cluster, `nodes/${encodeURIComponent(name)}`);
  return {
    async setUnschedulable(params: { cluster?: string; name: string; unschedulable: boolean }): Promise<void> {
      await client.request(path(params.cluster, params.name), {
        method: 'PATCH',
        contentType: 'application/merge-patch+json',
        body: { spec: { unschedulable: params.unschedulable } },
      });
    },
    /**
     * Ask ks-apiserver for a short-lived kubeadm join command.
     *
     * The server issues the bootstrap token (kube-system) and returns a command with the
     * CA discovery hash. This is the replacement for the old KubeKey Cluster-CR edit:
     * kube-server has no KubeKey integration. A 404 means the running ks-apiserver is
     * older than the endpoint; the dialog turns that into an actionable upgrade note.
     */
    async joinCommand(params: { cluster?: string; ttlHours?: number }): Promise<NodeJoinCommand> {
      const prefix =
        params.cluster && params.cluster !== 'host'
          ? '/kapis/clusters/' + encodeURIComponent(params.cluster) + '/resources.kubesphere.io/v1alpha3'
          : '/kapis/resources.kubesphere.io/v1alpha3';
      return client.request<NodeJoinCommand>(prefix + '/nodes/join-command', {
        method: 'POST',
        ...(params.ttlHours ? { query: { ttlHours: params.ttlHours } } : {}),
      });
    },
    async updateMetadata(params: { cluster: string; name: string; labels?: Record<string, string | null>; taints?: NodeTaint[]; resourceVersion: string }): Promise<void> {
      await client.request(path(params.cluster, params.name), {
        method: 'PATCH',
        contentType: 'application/merge-patch+json',
        body: {
          metadata: { resourceVersion: params.resourceVersion, ...(params.labels ? { labels: params.labels } : {}) },
          ...(params.taints ? { spec: { taints: params.taints } } : {}),
        },
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

/** Size bounds a class declares for new claims, from its `parameters`. */
export interface StorageClassSizeConfig {
  /** Minimum claim size in GiB. */
  min: number;
  /** Maximum claim size in GiB. */
  max: number;
  /** Step the slider/input should follow, in GiB. */
  step: number;
}

/** One StorageClass row, as the cluster console shows it. */
export interface StorageClassSummary extends ResourceBase {
  /** The CSI or in-tree driver that creates volumes. */
  provisioner: string;
  /**
   * Access modes the driver actually supports, from the class annotation
   * `storageclass.kubesphere.io/supported-access-modes`.
   *
   * Empty means "the class does not say", which the create form reads as "offer all four";
   * an empty *list* rendered as "no modes available" would make a claim impossible to create.
   */
  supportedAccessModes: string[];
  /** Size bounds for new claims; defaults are the old console's 0/2048/1 GiB. */
  sizeConfig: StorageClassSizeConfig;
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
  // KubeSphere's own marker, which is what this platform actually sets.
  'storageclass.kubesphere.io/is-default-class',
];

/**
 * Parse the driver's declared access modes.
 *
 * The annotation holds a JSON array of mode names. A malformed value is treated as "the class
 * does not say" rather than as an empty capability list: refusing to offer any mode would block
 * claim creation over a typo in an annotation.
 */
function supportedAccessModesOf(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** Size bounds from the class parameters, in GiB; unparseable values fall back to the defaults. */
function sizeConfigOf(parameters: Record<string, unknown>): StorageClassSizeConfig {
  const num = (key: string, fallback: number): number => {
    const raw = parameters[key];
    if (raw === undefined || raw === null || raw === '') return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  return { min: num('minSize', 0), max: num('maxSize', 2048), step: num('stepSize', 1) };
}

export function toStorageClassSummary(item: KubeStorageClass): StorageClassSummary {
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  const rawCount = annotations['kubesphere.io/pvc-count'] ?? annotations['kubesphere.io/persistentvolumeclaims'];
  const parsed = rawCount === undefined ? Number.NaN : Number(rawCount);
  const parameters = ((item as unknown as { parameters?: Record<string, unknown> }).parameters ?? {}) as Record<string, unknown>;
  return {
    ...baseOf(item),
    provisioner: String(item.provisioner ?? ''),
    supportedAccessModes: supportedAccessModesOf(annotations['storageclass.kubesphere.io/supported-access-modes']),
    sizeConfig: sizeConfigOf(parameters),
    // Kubernetes defaults these when unset; showing the empty string would read as
    // "unknown" for a value that is perfectly well defined.
    reclaimPolicy: String(item.reclaimPolicy ?? 'Delete'),
    volumeBindingMode: String(item.volumeBindingMode ?? 'Immediate'),
    isDefault: DEFAULT_CLASS_ANNOTATIONS.some((key) => annotations[key] === 'true'),
    allowExpansion: item.allowVolumeExpansion === true,
    /*
     * Cloning and snapshots are declared by KubeSphere on the class. Three spellings exist in the
     * wild and the live cluster uses the shortest one (allow-clone), which the first version of
     * this mapper missed — the clone control was hidden on a class that allows it.
     */
    allowCloning:
      item.allowVolumeCloning === true ||
      annotations['storageclass.kubesphere.io/allow-clone'] === 'true' ||
      annotations['storageclass.kubesphere.io/allow-cloning'] === 'true',
    allowSnapshot: item.allowVolumeSnapshot === true || annotations['storageclass.kubesphere.io/allow-snapshot'] === 'true',
    pvcCount: Number.isFinite(parsed) ? parsed : undefined,
  };
}

/** Everything the storage class detail page shows; the list row is a subset. */
export interface StorageClassDetail extends StorageClassSummary {
  /** The object as stored, for the YAML editor. */
  raw: KubeStorageClass;
  /** `parameters` verbatim — each driver has its own keys, so they are shown as pairs. */
  parameters: Array<{ key: string; value: string }>;
  /** `allowedTopologies`, flattened for display. */
  allowedTopologies: string[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

export function toStorageClassDetail(item: KubeStorageClass): StorageClassDetail {
  const spec = (item as unknown as { spec?: Record<string, unknown> }).spec ?? {};
  const parameters = (spec['parameters'] ?? {}) as Record<string, unknown>;
  const topologies = ((spec['allowedTopologies'] ?? []) as Array<Record<string, unknown>>).map((entry) => {
    const match = (entry['matchLabelExpressions'] ?? []) as Array<Record<string, unknown>>;
    return match
      .map((expression) => {
        const values = ((expression['values'] ?? []) as unknown[]).map(String).join('|');
        return `${String(expression['key'] ?? '')}=${values}`;
      })
      .join(' ');
  });
  return {
    ...toStorageClassSummary(item),
    raw: item,
    parameters: Object.entries(parameters).map(([key, value]) => ({ key, value: String(value ?? '') })),
    allowedTopologies: topologies.filter(Boolean),
    labels: (item.metadata?.labels ?? {}) as Record<string, string>,
    annotations: (item.metadata?.annotations ?? {}) as Record<string, string>,
  };
}

export interface StorageClassDraft {
  cluster: string;
  name: string;
  provisioner: string;
  reclaimPolicy: 'Delete' | 'Retain';
  volumeBindingMode: 'Immediate' | 'WaitForFirstConsumer';
  allowVolumeExpansion: boolean;
  allowCloning: boolean;
  allowSnapshot: boolean;
}

const STORAGE_CLASS_API = '/apis/storage.k8s.io/v1';
const DEFAULT_CLASS_KEYS = [
  'storageclass.kubernetes.io/is-default-class',
  'storageclass.beta.kubernetes.io/is-default-class',
  'storageclass.kubesphere.io/is-default-class',
];

export function storageClassesApi(client: Client) {
  const path = (cluster: string | undefined, name?: string) =>
    clusterScoped(STORAGE_CLASS_API, cluster, name ? `storageclasses/${encodeURIComponent(name)}` : 'storageclasses');
  const read = (cluster: string | undefined, name: string) =>
    client.request<KubeStorageClass>(path(cluster, name));

  return {
    ...resourceApi<KubeStorageClass, StorageClassSummary, StorageClassDetail>(client, {
      resource: 'storageclasses',
      toSummary: toStorageClassSummary,
      toDetail: toStorageClassDetail,
    }),
    kind: 'storageclasses' as const,

    /**
     * Create a storage class.
     *
     * The object lives in `storage.k8s.io/v1`, not the kapis proxy: that proxy registers
     * GET only and answers 405 to writes (same reason the YAML editor's PUT goes native).
     * Capabilities are annotations/spec fields rather than first-class CRD fields, so they
     * are written exactly as the reader displays them.
     */
    async create(draft: StorageClassDraft): Promise<StorageClassDetail> {
      const annotations: Record<string, string> = {};
      if (draft.allowCloning) annotations['storageclass.kubesphere.io/allow-clone'] = 'true';
      if (draft.allowSnapshot) annotations['storageclass.kubesphere.io/allow-snapshot'] = 'true';
      const item = await client.request<KubeStorageClass>(path(draft.cluster), {
        method: 'POST',
        body: {
          apiVersion: 'storage.k8s.io/v1',
          kind: 'StorageClass',
          metadata: { name: draft.name, ...(Object.keys(annotations).length ? { annotations } : {}) },
          provisioner: draft.provisioner,
          reclaimPolicy: draft.reclaimPolicy,
          volumeBindingMode: draft.volumeBindingMode,
          ...(draft.allowVolumeExpansion ? { allowVolumeExpansion: true } : {}),
        },
      });
      return toStorageClassDetail(item ?? {});
    },

    /**
     * Replace alias/description annotations only.
     *
     * Merge patch: the parameters are driver-specific and the class may be referenced by
     * existing claims; a whole-object PUT from the info dialog would race them. Removed
     * keys are sent as `null` (omitting them leaves the old value).
     */
    async updateInfo(params: { cluster: string; name: string; annotations: Record<string, string> }): Promise<void> {
      const current = await read(params.cluster, params.name);
      const existing = (current.metadata?.annotations ?? {}) as Record<string, string>;
      const patch: Record<string, string | null> = {};
      for (const key of Object.keys(existing)) {
        if (!(key in params.annotations)) patch[key] = null;
      }
      for (const [key, value] of Object.entries(params.annotations)) {
        if (existing[key] !== value) patch[key] = value;
      }
      if (Object.keys(patch).length === 0) return;
      await client.request(path(params.cluster, params.name), {
        method: 'PATCH',
        contentType: 'application/merge-patch+json',
        body: { metadata: { annotations: patch } },
      });
    },

    /**
     * Make one class the cluster's default.
     *
     * A cluster can have several default annotations at once, so the previous defaults are
     * cleared first (all three spellings the reader recognises). Doing only the "set" half
     * leaves two defaults, and the list would then show two badges.
     */
    async setDefault(params: { cluster: string; name: string }): Promise<void> {
      const body = await client.request<{ items?: KubeStorageClass[] }>(path(params.cluster, undefined), {
        query: { limit: 500 },
      });
      for (const item of body?.items ?? []) {
        const name = item.metadata?.name ?? '';
        if (!name || name === params.name) continue;
        const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
        const wasDefault = DEFAULT_CLASS_KEYS.some((key) => annotations[key] === 'true');
        if (!wasDefault) continue;
        const patch: Record<string, string | null> = {};
        for (const key of DEFAULT_CLASS_KEYS) patch[key] = null;
        await client.request(path(params.cluster, name), {
          method: 'PATCH',
          contentType: 'application/merge-patch+json',
          body: { metadata: { annotations: patch } },
        });
      }
      await client.request(path(params.cluster, params.name), {
        method: 'PATCH',
        contentType: 'application/merge-patch+json',
        body: { metadata: { annotations: { 'storageclass.kubernetes.io/is-default-class': 'true' } } },
      });
    },

    /** Toggle the three volume capabilities; false removes the annotation/spec field. */
    async setFeatures(params: {
      cluster: string;
      name: string;
      allowExpansion: boolean;
      allowCloning: boolean;
      allowSnapshot: boolean;
    }): Promise<void> {
      const body: Record<string, unknown> = {
        metadata: {
          annotations: {
            'storageclass.kubesphere.io/allow-clone': params.allowCloning ? 'true' : null,
            'storageclass.kubesphere.io/allow-snapshot': params.allowSnapshot ? 'true' : null,
          },
        },
      };
      if (!params.allowExpansion) body['allowVolumeExpansion'] = null;
      else body['allowVolumeExpansion'] = true;
      await client.request(path(params.cluster, params.name), {
        method: 'PATCH',
        contentType: 'application/merge-patch+json',
        body,
      });
    },

    /** Delete sequentially; the page enforces the "in use" guard before calling. */
    async remove(params: { cluster: string; names: string[] }): Promise<void> {
      for (const name of params.names) {
        await client.request<void>(path(params.cluster, name), { method: 'DELETE' });
      }
    },
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
    async list(params: { cluster?: string; signal?: AbortSignal } = {}): Promise<{ items: ComponentSummary[]; total: number }> {
      const body = await client.request<KubeComponent[] | { items?: KubeComponent[] }>(
        params.cluster && params.cluster !== 'host' ?
          `/kapis/clusters/${encodeURIComponent(params.cluster)}/resources.kubesphere.io/v1alpha3/components` :
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

/** Everything the volume detail page shows; the list row is a subset. */
export interface PersistentVolumeDetail extends PersistentVolumeSummary {
  /** The object as stored, for the YAML editor. */
  raw: KubePersistentVolume;
  /** `Filesystem` / `Block`. */
  volumeMode: string;
  mountOptions: string[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

export function toPersistentVolumeDetail(item: KubePersistentVolume): PersistentVolumeDetail {
  const spec = (item.spec ?? {}) as Record<string, unknown>;
  return {
    ...toPersistentVolumeSummary(item),
    raw: item,
    volumeMode: String(spec['volumeMode'] ?? 'Filesystem'),
    mountOptions: ((spec['mountOptions'] ?? []) as string[]).map(String),
    labels: (item.metadata?.labels ?? {}) as Record<string, string>,
    annotations: (item.metadata?.annotations ?? {}) as Record<string, string>,
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
    /** One volume by name — the detail page reads it from the same fast core endpoint. */
    async get(params: { name: string; signal?: AbortSignal }): Promise<PersistentVolumeDetail> {
      const item = await client.request<KubePersistentVolume>(`/api/v1/persistentvolumes/${encodeURIComponent(params.name)}`, {
        ...(params.signal ? { signal: params.signal } : {}),
      });
      return toPersistentVolumeDetail(item);
    },
    async list(params: { signal?: AbortSignal } = {}): Promise<{ items: PersistentVolumeSummary[]; total: number }> {
      const body = await client.request<{ items?: KubePersistentVolume[] }>(
        '/api/v1/persistentvolumes',
        params.signal ? { signal: params.signal } : {},
      );
      const items = (body?.items ?? []).map(toPersistentVolumeSummary);
      return { items, total: items.length };
    },
    /**
     * Replace a volume from the YAML editor.
     *
     * A read followed by a PUT, the same shape as `resourceApi.update`: a PUT needs
     * the current `resourceVersion`, and without it the apiserver answers 409 for
     * every save. The caller's object wins for every field it sends, so clearing an
     * annotation from the YAML editor still works.
     */
    async update(params: { name: string; body: KubeObject }): Promise<PersistentVolumeDetail> {
      const path = `/api/v1/persistentvolumes/${encodeURIComponent(params.name)}`;
      const current = await client.request<KubePersistentVolume>(path);
      const body: KubeObject = {
        ...(current as unknown as Record<string, unknown>),
        ...params.body,
        metadata: {
          ...(current.metadata ?? {}),
          ...params.body.metadata,
          ...(current.metadata?.resourceVersion ? { resourceVersion: current.metadata.resourceVersion } : {}),
        },
      };
      const item = await client.request<KubePersistentVolume>(path, { method: 'PUT', body });
      return toPersistentVolumeDetail(item);
    },

    /**
     * Replace the metadata annotations (alias / description) only.
     *
     * A merge patch, not the whole-object PUT used by the YAML editor: the volume spec is
     * owned by the provisioner and a PUT from the info dialog would race it for every
     * field the dialog does not show. The method reads first and emits `null` for the
     * annotations the caller removed — omitting a key from a merge patch leaves it in
     * place, which is the classic "cleared the alias and nothing happened" bug.
     */
    async updateInfo(params: { name: string; annotations: Record<string, string> }): Promise<void> {
      const path = `/api/v1/persistentvolumes/${encodeURIComponent(params.name)}`;
      const current = await client.request<KubePersistentVolume>(path);
      const existing = (current.metadata?.annotations ?? {}) as Record<string, string>;
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
     * Delete volumes sequentially.
     *
     * Batch delete has no transaction upstream: a failure halfway must not silently hide
     * the rows already deleted. The page reports the per-name outcome; this method throws
     * only for a single-name call so the single delete can show the server error.
     */
    async remove(params: { names: string[] }): Promise<void> {
      for (const name of params.names) {
        await client.request<void>(`/api/v1/persistentvolumes/${encodeURIComponent(name)}`, { method: 'DELETE' });
      }
    },
  };
}

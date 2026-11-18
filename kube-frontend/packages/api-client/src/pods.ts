import type { Client } from './client';
import { configMapsApi } from './configmaps';
import { secretsApi } from './secrets';

/**
 * 容器组（Pod）的派生视图：调度信息、资源聚合、环境变量解析、容器生命周期。
 *
 * 这一层只做「对象 → 视图」，不发请求；唯一例外是 `resolvePodEnv`——环境变量的
 * `valueFrom` 指向同命名空间的 ConfigMap / Secret，解析值必须另读这两个对象，
 * 而读取路径属于 api-client 的职责。
 *
 * 旧 console 的对应实现分别在 `utils/status.js`（状态与原因）、`utils/resource.js`
 * （资源聚合与 GPU 简化名）、`utils/gpuAllocation.js`（注解里的 GPU 分配）与
 * `stores/workload/env.js`（环境变量解析）。这里重新实现，不复制源码。
 */

/** 一个 Pod 条件，字段与 `status.conditions[]` 同名，值保持 API 原文。 */
export interface PodCondition {
  type: string;
  /** `True` / `False` / `Unknown`，API 原文，不做本地化。 */
  status: string;
  reason: string;
  message: string;
  /** RFC3339 原文；缺失为空串，由页面决定怎么显示「没有时间」。 */
  lastTransitionTime: string;
}

/** 注解里的一条 GPU 设备分配（HAMi `*devices-allocated` 格式）。 */
export interface GpuAllocation {
  /** 来源注解键，便于排查是哪个厂商写的。 */
  annotationKey: string;
  /** 设备 uuid，可能带 MIG 后缀（`GPU-x[1-1]`）。 */
  uuid: string;
  /** 去掉 MIG 后缀的物理 uuid，用于跳转该设备的 GPU 状态页。 */
  physicalUuid: string;
  vendor: string;
  /** 显存 MiB；0 表示注解里没写，页面不显示这一段。 */
  memoryMi: number;
  /** 算力百分比；0 表示没写。 */
  corePercent: number;
}

/** 容器组详情「调度信息」页签要的全部事实。 */
export interface PodScheduling {
  /** `spec.nodeName`；空串表示还没调度。 */
  node: string;
  /** `PodScheduled` 条件为 True。 */
  scheduled: boolean;
  /** `PodScheduled` 条件的 lastTransitionTime；没有条件时为空串。 */
  scheduledAt: string;
  conditions: PodCondition[];
  gpuAllocations: GpuAllocation[];
}

/** 聚合后的一行资源，例如 `{ resource: 'cpu', value: '1.5' }`。 */
export interface ResourceLine {
  resource: string;
  value: string;
}

/** 一条环境变量：值可能来自字面量、ConfigMap、Secret 或字段引用。 */
export interface EnvEntry {
  name: string;
  /** 已解析的值；解析失败时为空串，同时 `reference` 会说明它引用什么。 */
  value: string;
  /** 名称含 password / secret 时页面显示掩码，真实值不进入视图。 */
  masked: boolean;
  /** 非字面量时的来源描述（`configMapKeyRef:name/key` 等），空串表示字面量。 */
  reference: string;
}

/** 一个容器的环境变量分组；init 容器排在工作容器之前，与旧 console 一致。 */
export interface ContainerEnvGroup {
  name: string;
  init: boolean;
  entries: EnvEntry[];
}

/** 生命周期钩子的一条：postStart 或 preStop。 */
export interface LifecycleHook {
  kind: 'postStart' | 'preStop';
  /** `httpGet` / `tcpSocket` / `exec`，或空串（未知处理器）。 */
  type: string;
  /** 展示用的参数片段：scheme、路径、端口或命令。 */
  detail: string[];
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** 只关心容器组字段的最小对象形状。 */
export interface PodLike {
  metadata?: { annotations?: Record<string, string>; deletionTimestamp?: string };
  spec?: JsonObject;
  status?: JsonObject;
}

/** 容器组里的全部容器，init 在前；`init` 标记来源。 */
export function podContainersOf(item: PodLike): Array<{ container: JsonObject; init: boolean }> {
  const spec = item.spec ?? {};
  return [
    ...asArray(spec['initContainers']).map((container) => ({ container: asObject(container) ?? {}, init: true })),
    ...asArray(spec['containers']).map((container) => ({ container: asObject(container) ?? {}, init: false })),
  ];
}

/* ------------------------------------------------------------------ *
 * 状态与原因
 * ------------------------------------------------------------------ */

/** kubectl 式状态原因（`CrashLoopBackOff`、`ImagePullBackOff`、`Init:0/1` …）。 */
export function podStatusReason(item: PodLike): string {
  const status = item.status ?? {};
  const phase = String(status['phase'] ?? '');
  const podReason = String(status['reason'] ?? '');
  let reason = podReason || phase;

  const initStatuses = asArray(status['initContainerStatuses']).map((entry) => asObject(entry) ?? {});
  const containerStatuses = asArray(status['containerStatuses']).map((entry) => asObject(entry) ?? {});
  let initializing = false;

  for (let index = 0; index < initStatuses.length; index += 1) {
    const container = initStatuses[index] ?? {};
    const state = asObject(container['state']) ?? {};
    const waiting = asObject(state['waiting']);
    const terminated = asObject(state['terminated']);
    if (terminated && Number(terminated['exitCode'] ?? 0) === 0) continue;
    if (terminated) {
      const termReason = String(terminated['reason'] ?? '');
      const signal = Number(terminated['signal'] ?? 0);
      reason = termReason ? `Init:${termReason}` : signal !== 0 ? `Init:Signal:${signal}` : `Init:ExitCode:${String(terminated['exitCode'] ?? '')}`;
      initializing = true;
    } else if (waiting && String(waiting['reason'] ?? '') && String(waiting['reason']) !== 'PodInitializing') {
      reason = `Init:${String(waiting['reason'])}`;
      initializing = true;
    } else {
      reason = `Init:${index}/${initStatuses.length}`;
      initializing = true;
    }
    break;
  }

  if (!initializing) {
    let hasRunning = false;
    for (const container of containerStatuses) {
      const state = asObject(container['state']) ?? {};
      const waiting = asObject(state['waiting']);
      const terminated = asObject(state['terminated']);
      if (waiting && String(waiting['reason'] ?? '')) {
        reason = String(waiting['reason']);
      } else if (terminated && String(terminated['reason'] ?? '')) {
        reason = String(terminated['reason']);
      } else if (terminated) {
        const signal = Number(terminated['signal'] ?? 0);
        reason = signal !== 0 ? `Signal:${signal}` : `ExitCode:${String(terminated['exitCode'] ?? '')}`;
      } else if (container['ready'] && asObject(state['running'])) {
        hasRunning = true;
      }
    }
    // 一个容器已经 Completed、另一个还在跑，是 Running 而不是 Completed。
    if (reason === 'Completed' && hasRunning) reason = 'Running';
  }

  if (item.metadata?.deletionTimestamp) {
    reason = reason === 'NodeLost' ? 'Unknown' : 'Terminating';
  }
  return reason;
}

/**
 * 列表要不要显示原因。
 *
 * 原因与阶段同名（`Running` / `Pending` / `Succeeded` …）时是废话，只显示徽标；
 * 只有 `CrashLoopBackOff` 这类额外信息才追加一行——旧 console 在名称下显示的就是它。
 */
const PLAIN_PHASES = new Set(['', 'Running', 'Pending', 'Succeeded', 'Failed', 'Completed', 'Unknown', 'Terminating']);

export function isInformativeReason(reason: string, phase: string): boolean {
  if (!reason) return false;
  if (reason === phase) return false;
  return !PLAIN_PHASES.has(reason);
}

/* ------------------------------------------------------------------ *
 * 资源聚合（requests / limits）
 * ------------------------------------------------------------------ */

/** 解析 Kubernetes quantity 为「基准单位」数值：cpu 为毫核，内存为字节，其他为个数。 */
export function parseQuantity(resource: string, raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const text = String(raw).trim();
  if (!text) return undefined;
  const match = /^([+-]?[0-9.]+)([a-zA-Z]*)$/.exec(text);
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return undefined;
  const suffix = match[2] ?? '';

  if (resource === 'cpu') {
    if (suffix === 'm') return value;
    if (suffix === '') return value * 1000;
    return undefined;
  }
  if (resource === 'memory' || resource.endsWith('memory') || resource.endsWith('mem')) {
    const binary: Record<string, number> = { Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4 };
    const decimal: Record<string, number> = { k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15, E: 1e18 };
    if (suffix in binary) return value * (binary[suffix] ?? 1);
    if (suffix in decimal) return value * (decimal[suffix] ?? 1);
    if (suffix === '') return value;
    return undefined;
  }
  // GPU 卡数、自定义资源：只接受纯数字（含小数），带单位的保持原文。
  if (suffix === '') return value;
  if (suffix === 'm') return value / 1000;
  return undefined;
}

/** 基准数值 → 展示值。cpu 用核（去掉无意义的 .0），内存用 Mi，其他用个数。 */
export function formatQuantity(resource: string, value: number): string {
  if (resource === 'cpu') {
    const cores = value / 1000;
    return Number.isInteger(cores) ? String(cores) : String(Number(cores.toFixed(3)));
  }
  if (resource === 'memory' || resource.endsWith('memory') || resource.endsWith('mem')) {
    return `${Math.round(value / 1024 ** 2)}Mi`;
  }
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

/**
 * 展示用的资源名。
 *
 * 旧 console 读部署配置里的 GPU 展示名并截断到第一个连字符；新 UI 没有这份配置，
 * 于是用资源名的最后一段（`nvidia.com/gpu` → `gpu`）——同样的目的（让一行读得下），
 * 不引入一份需要运维同步的映射表。
 */
export function displayResourceName(resource: string): string {
  const slash = resource.lastIndexOf('/');
  return slash >= 0 ? resource.slice(slash + 1) : resource;
}

/**
 * 容器组全部容器（含 init）的 requests / limits 聚合。
 *
 * 每个资源一行；没有任何容器声明该类型资源时返回空数组，页面显示 `-`。
 * 不同容器的同种资源相加：cpu 按毫核、内存按字节、GPU 卡数按个数。
 */
export function podResourceLines(item: PodLike, kind: 'requests' | 'limits'): ResourceLine[] {
  const totals = new Map<string, number>();
  const rawFallback = new Map<string, string>();

  for (const { container } of podContainersOf(item)) {
    const resources = asObject(container['resources']);
    const block = resources ? asObject(resources[kind]) : undefined;
    if (!block) continue;
    for (const [resource, raw] of Object.entries(block)) {
      const parsed = parseQuantity(resource, raw);
      if (parsed === undefined) {
        // 解析不了的写法保留原文，让读者看到「有值但不是标准 quantity」，而不是当成 0。
        if (!rawFallback.has(resource)) rawFallback.set(resource, String(raw));
        continue;
      }
      totals.set(resource, (totals.get(resource) ?? 0) + parsed);
    }
  }

  const lines: ResourceLine[] = [];
  for (const [resource, total] of totals) {
    lines.push({ resource: displayResourceName(resource), value: formatQuantity(resource, total) });
  }
  for (const [resource, raw] of rawFallback) {
    if (totals.has(resource)) continue;
    lines.push({ resource: displayResourceName(resource), value: raw });
  }
  return lines;
}

/* ------------------------------------------------------------------ *
 * 调度信息
 * ------------------------------------------------------------------ */

/** `status.conditions` 按原顺序，字段缺失填空串。 */
export function podConditions(item: PodLike): PodCondition[] {
  return asArray((item.status ?? {})['conditions']).map((entry) => {
    const condition = asObject(entry) ?? {};
    return {
      type: String(condition['type'] ?? ''),
      status: String(condition['status'] ?? ''),
      reason: String(condition['reason'] ?? ''),
      message: String(condition['message'] ?? ''),
      lastTransitionTime: String(condition['lastTransitionTime'] ?? ''),
    };
  });
}

/** 物理 GPU uuid：去掉 MIG 后缀（`GPU-x[1-1]` → `GPU-x`）。 */
export function physicalGpuUuid(uuid: string): string {
  const index = uuid.indexOf('[');
  return index > 0 ? uuid.slice(0, index).trim() : uuid.trim();
}

/**
 * 解析注解里的 GPU 分配（HAMi 的 `*devices-allocated`）。
 *
 * 格式：容器段用 `;` 分隔，设备段用 `:` 分隔，设备字段用 `,` 分隔且为
 * `uuid,type,mem,core`。字段不足四段的设备段被忽略（不是设备，是别的写法）。
 */
export function parseGpuAllocations(annotations: Record<string, string> | undefined): GpuAllocation[] {
  if (!annotations) return [];
  const seen = new Set<string>();
  const out: GpuAllocation[] = [];
  for (const [key, value] of Object.entries(annotations)) {
    if (!key.includes('devices-allocated')) continue;
    for (const containerSegment of String(value).split(';')) {
      for (const deviceSegment of containerSegment.split(':')) {
        const parts = deviceSegment.split(',').map((part) => part.trim());
        if (parts.length < 4) continue;
        const uuid = parts[0] ?? '';
        if (!uuid) continue;
        const physicalUuid = physicalGpuUuid(uuid) || uuid;
        const dedupe = `${key}\t${physicalUuid}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        out.push({
          annotationKey: key,
          uuid,
          physicalUuid,
          vendor: parts[1] ?? '',
          memoryMi: Number.parseInt(parts[2] ?? '0', 10) || 0,
          corePercent: Number.parseInt(parts[3] ?? '0', 10) || 0,
        });
      }
    }
  }
  return out;
}

/** 容器组的调度信息：节点、PodScheduled 时间、条件、GPU 分配。 */
export function toPodScheduling(item: PodLike): PodScheduling {
  const node = String((item.spec ?? {})['nodeName'] ?? '');
  const conditions = podConditions(item);
  const scheduledCondition = conditions.find((condition) => condition.type === 'PodScheduled');
  return {
    node,
    scheduled: scheduledCondition?.status === 'True' || Boolean(node),
    scheduledAt: scheduledCondition?.lastTransitionTime ?? '',
    conditions,
    gpuAllocations: parseGpuAllocations(item.metadata?.annotations),
  };
}

/* ------------------------------------------------------------------ *
 * 容器生命周期
 * ------------------------------------------------------------------ */

/**
 * 一个容器的生命周期钩子。
 *
 * 只认识 kube 的三种处理器；其他写法不渲染（宁可少一行，也不把未知处理器
 * 显示成「命令」）。参数按处理器给出可读片段：HTTP 的 scheme/路径/端口、
 * TCP 的端口、exec 的命令行。
 */
export function containerLifecycleHooks(container: JsonObject): LifecycleHook[] {
  const lifecycle = asObject(container['lifecycle']);
  if (!lifecycle) return [];
  const out: LifecycleHook[] = [];
  for (const kind of ['postStart', 'preStop'] as const) {
    const hook = asObject(lifecycle[kind]);
    if (!hook) continue;
    const httpGet = asObject(hook['httpGet']);
    const tcpSocket = asObject(hook['tcpSocket']);
    const exec = asObject(hook['exec']);
    if (httpGet) {
      out.push({
        kind,
        type: 'httpGet',
        detail: [
          String(httpGet['scheme'] ?? 'HTTP'),
          String(httpGet['path'] ?? '/'),
          httpGet['port'] !== undefined ? `:${String(httpGet['port'])}` : '',
        ].filter(Boolean),
      });
    } else if (tcpSocket) {
      out.push({ kind, type: 'tcpSocket', detail: [String(tcpSocket['port'] ?? '')].filter(Boolean) });
    } else if (exec) {
      out.push({
        kind,
        type: 'exec',
        detail: [asArray(exec['command']).map((part) => String(part)).join(' ')].filter(Boolean),
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 环境变量
 * ------------------------------------------------------------------ */

const MASK_MARKERS = ['password', 'secret'];

/** 名称含 password / secret 的变量值要掩码（旧 console 的 HIDE_RULE）。 */
export function envValueMasked(name: string): boolean {
  const lower = name.toLowerCase();
  return MASK_MARKERS.some((marker) => lower.includes(marker));
}

/** 容器的环境变量分组（未解析 `valueFrom`，值只给出引用描述）。 */
export function containerEnvGroups(item: PodLike): ContainerEnvGroup[] {
  return podContainersOf(item).map(({ container, init }) => {
    const name = String(container['name'] ?? '');
    const entries: EnvEntry[] = asArray(container['env']).map((entry) => {
      const env = asObject(entry) ?? {};
      const envName = String(env['name'] ?? '');
      const valueFrom = asObject(env['valueFrom']);
      let reference = '';
      let value = String(env['value'] ?? '');
      if (valueFrom) {
        const ref = Object.entries(valueFrom)[0];
        if (ref) {
          const inner = asObject(ref[1]) ?? {};
          const objectName = String(inner['name'] ?? '');
          const key = String(inner['key'] ?? '');
          // configMapKeyRef / secretKeyRef name an object and a key; fieldRef and
          // resourceFieldRef name a path, so they get no "/" segment.
          reference = objectName
            ? `${ref[0]}:${objectName}/${key}`
            : `${ref[0]}:${String(inner['fieldPath'] ?? inner['resource'] ?? '')}`;
          value = '';
        }
      }
      return { name: envName, value, masked: envValueMasked(envName), reference };
    });
    return { name, init, entries };
  });
}

/** `resolvePodEnv` 的参数：作用域来自路由，容器组对象来自详情响应。 */
export interface ResolvePodEnvParams {
  cluster: string;
  namespace: string;
  item: PodLike;
  signal?: AbortSignal;
}

/**
 * 解析容器组的环境变量：把 `configMapKeyRef` / `secretKeyRef` 换成实际值。
 *
 * 规则与旧 console 的 `EnvStore.fetchVariables` 相同，但失败处理不同：旧实现让
 * 整个 Promise 一起 reject，页面只剩空白；这里按引用逐个读取，读不到的条目保留
 * 引用描述并把值留空——「读不到」与「值为空」是两件事，页面上必须分得开。
 *
 * Secret 的值按 base64 解码；ConfigMap 的值是明文。同一对象只读一次。
 */
export async function resolvePodEnv(client: Client, params: ResolvePodEnvParams): Promise<ContainerEnvGroup[]> {
  const groups = containerEnvGroups(params.item);
  const cache = new Map<string, Record<string, string> | undefined>();

  const readSecret = async (name: string): Promise<Record<string, string> | undefined> => {
    const key = `secret/${name}`;
    if (cache.has(key)) return cache.get(key);
    let data: Record<string, string> | undefined;
    try {
      const detail = await secretsApi(client).get({
        cluster: params.cluster,
        namespace: params.namespace,
        name,
        ...(params.signal ? { signal: params.signal } : {}),
      });
      data = detail.data;
    } catch {
      data = undefined;
    }
    cache.set(key, data);
    return data;
  };

  const readConfigMap = async (name: string): Promise<Record<string, string> | undefined> => {
    const key = `configmap/${name}`;
    if (cache.has(key)) return cache.get(key);
    let data: Record<string, string> | undefined;
    try {
      const detail = await configMapsApi(client).get({
        cluster: params.cluster,
        namespace: params.namespace,
        name,
        ...(params.signal ? { signal: params.signal } : {}),
      });
      data = detail.data;
    } catch {
      data = undefined;
    }
    cache.set(key, data);
    return data;
  };

  const resolveEntry = async (entry: EnvEntry): Promise<EnvEntry> => {
    if (!entry.reference) return entry;
    const [kind, rest] = entry.reference.split(':');
    const [objectName, dataKey] = (rest ?? '').split('/');
    if (!objectName || !dataKey) return entry;
    if (kind === 'secretKeyRef') {
      const data = await readSecret(objectName);
      const encoded = data?.[dataKey];
      if (encoded === undefined) return entry;
      return { ...entry, value: decodeBase64(encoded) };
    }
    if (kind === 'configMapKeyRef') {
      const data = await readConfigMap(objectName);
      const value = data?.[dataKey];
      if (value === undefined) return entry;
      return { ...entry, value };
    }
    // fieldRef / resourceFieldRef 由 kubelet 在运行时解析，客户端读不到值。
    return entry;
  };

  return Promise.all(
    groups.map(async (group) => ({
      ...group,
      entries: await Promise.all(group.entries.map(resolveEntry)),
    })),
  );
}

/** base64 → UTF-8 文本；浏览器与 Node 都能用，失败返回空串。 */
export function decodeBase64(value: string): string {
  try {
    if (typeof atob === 'function') {
      const binary = atob(value);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    return Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

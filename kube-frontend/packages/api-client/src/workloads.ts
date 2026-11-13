import type { Client } from './client';
import { annotationKeys, baseOf, kubePrefix, resourceApi, type KubeObject, type ResourceBase } from './resources';

/**
 * Application workloads: the resources the old console groups under 应用负载.
 *
 * One module for eight kinds because they share a list shape (name, status, some
 * numeric progress, a timestamp) and the differences are data, not structure. The
 * status derivation below is a port of `console/src/utils/status.js` — a status
 * column that disagrees with the old console is the most visible kind of migration
 * defect, so the rules are copied rather than invented.
 */

/** Statuses the old console distinguishes in the workload filter. */
export const WORKLOAD_STATUS = ['running', 'updating', 'stopped', 'terminating'] as const;
export type WorkloadStatus = (typeof WORKLOAD_STATUS)[number];

/** Statuses a Pod reports, in the old console's vocabulary. */
export const POD_STATUS = ['running', 'waiting', 'terminated'] as const;
export type PodStatus = (typeof POD_STATUS)[number];

export type WorkloadKind =
  | 'deployments'
  | 'statefulsets'
  | 'daemonsets'
  | 'jobs'
  | 'cronjobs'
  | 'pods'
  | 'services'
  | 'ingresses';

interface KubeWorkload extends KubeObject {
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

/** `spec.replicas` for the kinds that have one; 0 when absent. */
function replicasOf(item: KubeWorkload): number {
  const replicas = item.spec?.['replicas'];
  return typeof replicas === 'number' ? replicas : 0;
}

/** `status.readyReplicas`, `undefined` when the controller has never reported one. */
function readyReplicasOf(item: KubeWorkload): number | undefined {
  const ready = item.status?.['readyReplicas'];
  return typeof ready === 'number' ? ready : undefined;
}

/**
 * Deployment status — `getDeployStatus` in the old console.
 *
 * The `replicas === 0 && readyReplicas !== 0` case is "Updating" rather than
 * "Stopped": scaling to zero has been asked for but the old pods are still
 * draining, which is a different situation from a workload that is already down.
 */
export function deploymentStatus(item: KubeWorkload): WorkloadStatus {
  const replicas = replicasOf(item);
  const ready = readyReplicasOf(item);
  if (replicas === 0 && ready !== undefined && ready !== 0) return 'updating';
  if (replicas) return ready === replicas ? 'running' : 'updating';
  return 'stopped';
}

/** StatefulSet status — `getStatefulSetStatus` in the old console (same shape). */
export function statefulSetStatus(item: KubeWorkload): WorkloadStatus {
  return deploymentStatus(item);
}

/**
 * DaemonSet status — `getDaemonSetStatus`.
 *
 * A DaemonSet has no `replicas`; what it wants is one pod per eligible node, so
 * the comparison is `desiredNumberScheduled` against `numberReady`.
 */
export function daemonSetStatus(item: KubeWorkload): WorkloadStatus {
  const desired = item.status?.['desiredNumberScheduled'];
  const ready = item.status?.['numberReady'];
  if (typeof desired !== 'number') return 'stopped';
  if (desired === 0) return 'stopped';
  return ready === desired ? 'running' : 'updating';
}

/** Job status — `getJobStatus`: succeeded vs failed vs still running. */
export function jobStatus(item: KubeWorkload): WorkloadStatus {
  const failed = item.status?.['failed'];
  if (typeof failed === 'number' && failed > 0) return 'updating';
  const active = item.status?.['active'];
  if (typeof active === 'number' && active > 0) return 'running';
  const succeeded = item.status?.['succeeded'];
  if (typeof succeeded === 'number' && succeeded > 0) return 'running';
  return 'stopped';
}

/**
 * Pod status — `getPodStatus`.
 *
 * A pod in a terminal phase is reported as `terminated`; a pod whose phase says
 * Running but which has an unready container is `waiting`, because that is what
 * the reader is looking at while the container starts or crashes.
 */
export function podStatus(item: KubeWorkload): PodStatus {
  const phase = String(item.status?.['phase'] ?? '');
  if (phase === 'Succeeded' || phase === 'Failed') return 'terminated';
  if (phase === 'Pending') return 'waiting';
  const statuses = (item.status?.['containerStatuses'] ?? []) as Array<Record<string, unknown>>;
  const allReady = statuses.length > 0 && statuses.every((container) => container['ready'] === true);
  return allReady ? 'running' : 'waiting';
}

/** Status for any kind, so the list column does not branch on the resource. */
export function workloadStatus(kind: WorkloadKind, item: KubeWorkload): string {
  switch (kind) {
    case 'deployments':
      return deploymentStatus(item);
    case 'statefulsets':
      return statefulSetStatus(item);
    case 'daemonsets':
      return daemonSetStatus(item);
    case 'jobs':
    case 'cronjobs':
      return jobStatus(item);
    case 'pods':
      return podStatus(item);
    default:
      return '';
  }
}

/** Ready/desired counters, `-` when the kind has no such notion. */
export function workloadProgress(kind: WorkloadKind, item: KubeWorkload): { ready?: number | undefined; total?: number | undefined } {
  switch (kind) {
    case 'deployments':
    case 'statefulsets':
      return { ...(readyReplicasOf(item) !== undefined ? { ready: readyReplicasOf(item) } : {}), total: replicasOf(item) };
    case 'daemonsets': {
      const ready = item.status?.['numberReady'];
      const total = item.status?.['desiredNumberScheduled'];
      return {
        ...(typeof ready === 'number' ? { ready } : {}),
        ...(typeof total === 'number' ? { total } : {}),
      };
    }
    case 'jobs': {
      const ready = item.status?.['succeeded'];
      const total = item.spec?.['completions'];
      return {
        ...(typeof ready === 'number' ? { ready } : {}),
        ...(typeof total === 'number' ? { total } : {}),
      };
    }
    default:
      return {};
  }
}

/** One row of a workload list. */
export interface WorkloadSummary extends ResourceBase {
  kind: WorkloadKind;
  status: string;
  /** The `app` label the old list shows; empty when the workload was not labelled. */
  app: string;
  /** `spec.replicas` for the kinds that have one; 0 when absent. */
  replicas: number;
  /** `status.readyReplicas`-style counter, when the kind has one. */
  ready?: number;
  total?: number;
  /** Container images, for the pods and workloads that have them. */
  images: string[];
  /**
   * Service type (`ClusterIP` / `NodePort` / `LoadBalancer` / `ExternalName`).
   *
   * Empty for every other kind. The service editor uses it: editing ports of an
   * ExternalName service (which has none) would be a control that cannot work.
   */
  serviceType: string;
  /**
   * Service ports. `nodePort` is present only for NodePort/LoadBalancer services —
   * a ClusterIP service has no node port to show, which is why it is optional rather
   * than a zero.
   */
  ports: Array<{ name: string; port: number; targetPort: string; nodePort?: number }>;
  /** Ingress rules: host → paths → backend, for the list and the editor. */
  rules: Array<{ host: string; path: string; serviceName: string; servicePort: string }>;
  /**
   * Kind-specific attribute rows for the detail page.
   *
   * Pods and Services each show fields the others do not (a pod's node and QoS, a
   * service's virtual IP and selector). Keeping them as label/value pairs lets the
   * detail page render one list instead of branching on the kind six times.
   */
  attributes: Array<{ key: string; value: string }>;
  /** The object's annotations: 编辑信息 edits them in place. */
  annotations: Record<string, string>;
}

/** The `app` / `app.kubernetes.io/name` label, matching what the old console reads. */
function appOf(item: KubeWorkload): string {
  const labels = (item.metadata?.labels ?? {}) as Record<string, string>;
  return labels['app'] ?? labels['app.kubernetes.io/name'] ?? '';
}

/** Container images declared in a pod template or a pod. */
function imagesOf(item: KubeWorkload): string[] {
  const spec = (item.spec ?? {}) as Record<string, unknown>;
  const template = (spec['template'] ?? {}) as Record<string, unknown>;
  const podSpec = (template['spec'] ?? spec) as Record<string, unknown>;
  const containers = (podSpec['containers'] ?? []) as Array<Record<string, unknown>>;
  return containers.map((container) => String(container['image'] ?? '')).filter(Boolean);
}

/**
 * `spec.rules` of an Ingress, flattened to one row per host+path.
 *
 * An Ingress nests three levels (rule → path → backend service); the editor edits one
 * path at a time, so the shape it works with is the leaf.
 */
function ingressRulesOf(item: KubeWorkload): Array<{ host: string; path: string; serviceName: string; servicePort: string }> {
  const rules = (item.spec?.['rules'] ?? []) as Array<Record<string, unknown>>;
  const out: Array<{ host: string; path: string; serviceName: string; servicePort: string }> = [];
  for (const rule of rules) {
    const host = String(rule['host'] ?? '');
    const paths = ((rule['http'] as Record<string, unknown> | undefined)?.['paths'] ?? []) as Array<Record<string, unknown>>;
    for (const entry of paths) {
      const backend = (entry['backend'] as Record<string, unknown> | undefined) ?? {};
      const service = (backend['service'] as Record<string, unknown> | undefined) ?? {};
      const port = (service['port'] as Record<string, unknown> | undefined) ?? {};
      out.push({
        host,
        path: String(entry['path'] ?? '/'),
        serviceName: String(service['name'] ?? ''),
        servicePort: String(port['number'] ?? port['name'] ?? ''),
      });
    }
  }
  return out;
}

/**
 * The rows the detail page shows for one kind, mirroring the old console.
 *
 * Values are already strings: the page formats and translates the label, the mapper
 * decides what the value is. Empty values become `-` at render time, not here, so a
 * genuinely blank field stays distinguishable from a missing one.
 */
function kindAttributes(kind: WorkloadKind, item: KubeWorkload): Array<{ key: string; value: string }> {
  const status = (item.status ?? {}) as Record<string, unknown>;
  if (kind === 'pods') {
    const qos = status['qosClass'];
    const restarts = ((status['containerStatuses'] ?? []) as Array<Record<string, unknown>>).reduce(
      (sum, container) => sum + Number(container['restartCount'] ?? 0),
      0,
    );
    return [
      { key: 'podStatus', value: String(status['phase'] ?? '') },
      { key: 'node', value: String((item.spec ?? {})['nodeName'] ?? '') },
      { key: 'podIP', value: String(status['podIP'] ?? '') },
      { key: 'hostIP', value: String(status['hostIP'] ?? '') },
      { key: 'qosClass', value: qos === undefined ? '' : String(qos) },
      { key: 'restarts', value: String(restarts) },
    ];
  }
  if (kind === 'services') {
    const spec = (item.spec ?? {}) as Record<string, unknown>;
    const selector = (spec['selector'] ?? {}) as Record<string, string>;
    const external = (status['loadBalancer'] as Record<string, unknown> | undefined)?.['ingress'] as
      | Array<Record<string, unknown>>
      | undefined;
    return [
      { key: 'serviceType', value: String(spec['type'] ?? 'ClusterIP') },
      { key: 'clusterIP', value: String(spec['clusterIP'] ?? '') },
      { key: 'externalIP', value: String((external?.[0]?.['ip'] ?? spec['externalName'] ?? '') as string) },
      {
        key: 'selector',
        value: Object.entries(selector)
          .map(([key, value]) => `${key}=${value}`)
          .join(', '),
      },
      {
        key: 'sessionAffinity',
        value: String(spec['sessionAffinity'] ?? 'None'),
      },
    ];
  }
  return [];
}

/** `spec.ports` of a Service, normalised for display and editing. */
function servicePortsOf(item: KubeWorkload): Array<{ name: string; port: number; targetPort: string; nodePort?: number }> {
  const ports = (item.spec?.['ports'] ?? []) as Array<Record<string, unknown>>;
  return ports.map((entry) => {
    const nodePort = entry['nodePort'];
    return {
      name: String(entry['name'] ?? ''),
      port: Number(entry['port'] ?? 0),
      targetPort: String(entry['targetPort'] ?? entry['port'] ?? ''),
      // Only present for NodePort/LoadBalancer; spreading it conditionally keeps
      // `exactOptionalPropertyTypes` happy and the cell able to say `-`.
      ...(typeof nodePort === 'number' ? { nodePort } : {}),
    };
  });
}

export function toWorkloadSummary(kind: WorkloadKind, item: KubeWorkload): WorkloadSummary {
  const progress = workloadProgress(kind, item);
  return {
    ...baseOf(item),
    kind,
    status: workloadStatus(kind, item),
    app: appOf(item),
    replicas: replicasOf(item),
    ...(progress.ready !== undefined ? { ready: progress.ready } : {}),
    ...(progress.total !== undefined ? { total: progress.total } : {}),
    images: imagesOf(item),
    annotations: item.metadata?.annotations ?? {},
    serviceType: kind === 'services' ? String(item.spec?.['type'] ?? 'ClusterIP') : '',
    ports: kind === 'services' ? servicePortsOf(item) : [],
    rules: kind === 'ingresses' ? ingressRulesOf(item) : [],
    attributes: kindAttributes(kind, item),
  };
}

/** A workload as the detail page needs it. */
export interface WorkloadDetail extends WorkloadSummary {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  raw: KubeWorkload;
}

export function toWorkloadDetail(kind: WorkloadKind, item: KubeWorkload): WorkloadDetail {
  return {
    ...toWorkloadSummary(kind, item),
    labels: item.metadata?.labels ?? {},
    annotations: item.metadata?.annotations ?? {},
    raw: item,
  };
}

/** Annotation a restart writes; the same key `kubectl rollout restart` uses. */
export const RESTART_ANNOTATION = 'kubectl.kubernetes.io/restartedAt';

export function workloadsApi(client: Client, kind: WorkloadKind) {
  const api = resourceApi<KubeWorkload, WorkloadSummary, WorkloadDetail>(client, {
    resource: kind,
    toSummary: (item) => toWorkloadSummary(kind, item),
    toDetail: (item) => toWorkloadDetail(kind, item),
  });
  return {
    ...api,
    kind,
    /**
     * Restart the pods of a controller — the old console's 重新部署.
     *
     * Kubernetes has no "restart" verb: the convention is to stamp
     * `kubectl.kubernetes.io/restartedAt` onto the pod template, which changes the
     * template hash and makes the controller roll a new ReplicaSet. A merge patch
     * touches only that annotation, so concurrent edits to the rest of the object
     * are not clobbered (a PUT would be).
     *
     * Only the three controllers that own pods directly support it; a Job or a
     * Service has no template to roll, hence `allowRedeploy` on the descriptor.
     */
    /**
     * Rename the display alias / description (the old console's 编辑信息).
     *
     * Both are KubeSphere annotations, so this is a merge patch too: it must not
     * re-send the spec, or a concurrent scale from the HPA would be undone by an
     * edit that only meant to change the alias.
     */
    editInfo(params: {
      cluster: string;
      namespace: string;
      name: string;
      body: { alias?: string; description?: string };
    }): Promise<WorkloadDetail> {
      const annotations: Record<string, string> = {};
      if (params.body.alias !== undefined) annotations[annotationKeys.alias] = params.body.alias;
      if (params.body.description !== undefined) annotations[annotationKeys.description] = params.body.description;
      return api.patch({
        cluster: params.cluster,
        namespace: params.namespace,
        name: params.name,
        body: { metadata: { annotations } },
      });
    },

    /**
     * Stop or start a controller by scaling its replicas.
     *
     * The old console's 停止/启动. Scale to 0 keeps the object (and its history) and
     * lets Kubernetes drain the pods; deleting would lose both.
     */
    scale(params: { cluster: string; namespace: string; name: string; replicas: number }): Promise<WorkloadDetail> {
      return api.patch({
        cluster: params.cluster,
        namespace: params.namespace,
        name: params.name,
        body: { spec: { replicas: params.replicas } },
      });
    },

    /**
     * Suspend or resume a CronJob.
     *
     * `spec.suspend` is the field Kubernetes itself reads, so the scheduler honours
     * it immediately and `kubectl get cronjob` agrees with what the page shows.
     */
    setSuspended(params: { cluster: string; namespace: string; name: string; suspended: boolean }): Promise<WorkloadDetail> {
      return api.patch({
        cluster: params.cluster,
        namespace: params.namespace,
        name: params.name,
        body: { spec: { suspend: params.suspended } },
      });
    },

    /**
     * Create a controller.
     *
     * The pod template carries one container (the form's single image) and the `app`
     * label on both the selector and the template — a selector that does not match its
     * own template is the classic way a new workload never gets pods.
     */
    create(params: {
      cluster: string;
      namespace: string;
      name: string;
      image: string;
      app: string;
      replicas?: number;
    }): Promise<WorkloadDetail> {
      const spec: Record<string, unknown> = {
        selector: { matchLabels: { app: params.app } },
        template: {
          metadata: { labels: { app: params.app } },
          spec: { containers: [{ name: 'container', image: params.image }] },
        },
      };
      // A DaemonSet has no replicas; sending one is rejected upstream.
      if (kind !== 'daemonsets' && params.replicas !== undefined) spec['replicas'] = params.replicas;
      return api.create(
        {
          apiVersion: 'apps/v1',
          kind: kind === 'deployments' ? 'Deployment' : kind === 'statefulsets' ? 'StatefulSet' : 'DaemonSet',
          metadata: { name: params.name, namespace: params.namespace },
          spec,
        } as KubeObject,
        { cluster: params.cluster, namespace: params.namespace },
      );
    },

    /**
     * Replace a Service's ports.
     *
     * Kubernetes treats `spec.ports` as a whole list on patch with a merge strategy of
     * "replace" for the array — so sending the complete edited list is the correct
     * shape, and sending one port would drop the others. `targetPort` is kept as the
     * string the manifest used (it may be a name, not a number).
     */
    setServicePorts(params: {
      cluster: string;
      namespace: string;
      name: string;
      ports: Array<{ name: string; port: number; targetPort: string }>;
    }): Promise<WorkloadDetail> {
      return api.patch({
        cluster: params.cluster,
        namespace: params.namespace,
        name: params.name,
        body: {
          spec: {
            ports: params.ports.map((entry) => ({
              ...(entry.name ? { name: entry.name } : {}),
              port: entry.port,
              // A numeric targetPort must be sent as a number; a named one as a string.
              targetPort: /^[0-9]+$/.test(entry.targetPort) ? Number(entry.targetPort) : entry.targetPort,
            })),
          },
        },
      });
    },

    /**
     * Replace an Ingress's rules.
     *
     * `spec.rules` is replaced wholesale (a merge patch on an array replaces it), so
     * the editor sends the complete list. The backend keeps the `service.port.number`
     * form when the stored port was numeric and `name` when it was a name — sending
     * the wrong shape is rejected by the apiserver.
     */
    setIngressRules(params: {
      cluster: string;
      namespace: string;
      name: string;
      rules: Array<{ host: string; path: string; serviceName: string; servicePort: string }>;
    }): Promise<WorkloadDetail> {
      // Group flat rows back into the nested form Kubernetes expects.
      const byHost = new Map<string, Array<Record<string, unknown>>>();
      for (const rule of params.rules) {
        if (!rule.serviceName) continue;
        const paths = byHost.get(rule.host) ?? [];
        paths.push({
          path: rule.path || '/',
          pathType: 'Prefix',
          backend: {
            service: {
              name: rule.serviceName,
              port: /^[0-9]+$/.test(rule.servicePort) ? { number: Number(rule.servicePort) } : { name: rule.servicePort },
            },
          },
        });
        byHost.set(rule.host, paths);
      }
      const rules = [...byHost.entries()].map(([host, paths]) => ({
        ...(host ? { host } : {}),
        http: { paths },
      }));
      return api.patch({
        cluster: params.cluster,
        namespace: params.namespace,
        name: params.name,
        body: { spec: { rules } },
      });
    },

    /**
     * Pods belonging to one workload.
     *
     * Selected by the workload's own selector: a Deployment, StatefulSet and DaemonSet
     * all name their pods through `spec.selector.matchLabels`, and jobs/cronjobs and
     * standalone pods have no such selector (the list is then empty rather than
     * guessed from a name prefix, which is a convention, not a contract).
     */
    async pods(params: { cluster: string; namespace: string; name: string }): Promise<WorkloadPod[]> {
      const owner = await client.request<KubeWorkload>(workloadPath(params.cluster, kind, params.namespace, params.name));
      /*
       * Two selector shapes: a workload's is `{ matchLabels: {...} }`, a Service's is a
       * flat map. Reading the workload shape for a service yields `{}` and quietly
       * lists nothing, so both are handled explicitly.
       */
      const rawSelector = (owner?.spec ?? {})['selector'] as Record<string, unknown> | undefined;
      const selector = (
        kind === 'services' ? (rawSelector ?? {}) : ((rawSelector?.['matchLabels'] as Record<string, unknown> | undefined) ?? {})
      ) as Record<string, string>;
      const pairs = Object.entries(selector);
      if (pairs.length === 0) return [];
      const labelSelector = pairs.map(([key, value]) => `${key}=${value}`).join(',');
      const body = await client.request<{ items?: KubeWorkload[] }>(
        `${workloadPath(params.cluster, 'pods', params.namespace)}?labelSelector=${encodeURIComponent(labelSelector)}`,
      );
      return (body?.items ?? [])
        .map(toWorkloadPod)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },

    /**
     * The service a StatefulSet names through `spec.serviceName`.
     *
     * Returns `exists: false` when the field is empty or points at nothing, so the page
     * can say which of the two happened instead of showing an empty block.
     */
    async service(params: { cluster: string; namespace: string; name: string }): Promise<WorkloadService> {
      const owner = await client.request<KubeWorkload>(workloadPath(params.cluster, kind, params.namespace, params.name));
      const serviceName = String((owner?.spec ?? {})['serviceName'] ?? '');
      if (!serviceName) return toWorkloadService(undefined, '');
      const service = await client
        .request<KubeService>(workloadPath(params.cluster, 'services', params.namespace, serviceName))
        .catch(() => undefined);
      return toWorkloadService(service, serviceName);
    },

    /** ReplicaSets owned by a Deployment, newest revision first. */
    async revisions(params: { cluster: string; namespace: string; name: string }): Promise<WorkloadRevision[]> {
      // The raw objects are needed here (annotations, ownerReferences), so these two
      // calls go through the client rather than the summarising API.
      const deployment = await client.request<KubeWorkload>(workloadPath(params.cluster, 'deployments', params.namespace, params.name));
      const currentRevision = Number(
        ((deployment?.metadata?.annotations ?? {}) as Record<string, string>)['deployment.kubernetes.io/revision'] ?? 0,
      );
      const selector = (((deployment?.spec ?? {})['selector'] as Record<string, unknown> | undefined)?.['matchLabels'] ?? {}) as Record<
        string,
        string
      >;
      const labelSelector = Object.entries(selector)
        .map(([key, value]) => `${key}=${value}`)
        .join(',');
      const sets = await client.request<{ items?: KubeReplicaSet[] }>(
        `${workloadPath(params.cluster, 'replicasets', params.namespace)}?labelSelector=${encodeURIComponent(labelSelector)}`,
      );
      return (sets?.items ?? [])
        .filter((item) =>
          ((item.metadata as Record<string, unknown> | undefined)?.['ownerReferences'] as Array<Record<string, unknown>> | undefined ?? []).some(
            (owner) => owner['kind'] === 'Deployment' && owner['name'] === params.name,
          ),
        )
        .map((item) => toWorkloadRevision(item, currentRevision))
        .sort((a, b) => b.revision - a.revision || (a.createdAt < b.createdAt ? 1 : -1));
    },

    /**
     * Roll a Deployment back to one of its revisions.
     *
     * There is no rollback endpoint: Kubernetes performs one as a patch of the pod
     * template, so the revision's template is read from its ReplicaSet and written
     * back onto the Deployment. The Deployment's revision annotation is left alone, so
     * the rollback becomes a further revision instead of erasing the history it came
     * from.
     */
    async rollback(params: { cluster: string; namespace: string; name: string; replicaSet: string }): Promise<WorkloadDetail> {
      const target = await client.request<KubeReplicaSet>(
        workloadPath(params.cluster, 'replicasets', params.namespace, params.replicaSet),
      );
      const template = revisionTemplate(target ?? {});
      if (!template) throw new Error(`revision ${params.replicaSet} not found`);
      // Strip what the deployment controller stamps on; leaving it in makes the patch
      // fight the controller over the same fields.
      const clean: Record<string, unknown> = { ...template };
      const metadata = clean['metadata'] as Record<string, unknown> | undefined;
      if (metadata) {
        const { creationTimestamp: _drop, ...rest } = metadata;
        void _drop;
        clean['metadata'] = rest;
      }
      return api.patch({
        cluster: params.cluster,
        namespace: params.namespace,
        name: params.name,
        body: { spec: { template: clean } },
      });
    },

    restart(params: { cluster: string; namespace: string; name: string }): Promise<WorkloadDetail> {
      return api.patch({
        cluster: params.cluster,
        namespace: params.namespace,
        name: params.name,
        body: {
          spec: {
            template: {
              metadata: {
                annotations: { [RESTART_ANNOTATION]: new Date().toISOString() },
              },
            },
          },
        },
      });
    },
  };
}

export type WorkloadsApi = ReturnType<typeof workloadsApi>;

/**
 * Autoscaling attached to one workload.
 *
 * A HorizontalPodAutoscaler names its target through `scaleTargetRef`, so the detail
 * page finds it by listing the project's HPAs and matching the reference — Kubernetes
 * has no reverse index. "None" is a normal answer: most workloads are not autoscaled,
 * and the old console's 编辑自动伸缩 only appears when there is something to edit.
 */
export interface WorkloadAutoscaling {
  exists: boolean;
  name: string;
  minReplicas: number;
  maxReplicas: number;
  /** `cpu: 80%` style summary of the metrics that drive scaling. */
  metrics: string[];
  /** Replicas the autoscaler currently asks for. */
  currentReplicas: number;
  /** False when the autoscaler reports it cannot act (`ScalingActive=False`). */
  active: boolean;
}

interface KubeHpa extends KubeObject {
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

export function toWorkloadAutoscaling(item: KubeHpa | undefined): WorkloadAutoscaling {
  if (!item) {
    return { exists: false, name: '', minReplicas: 0, maxReplicas: 0, metrics: [], currentReplicas: 0, active: false };
  }
  const spec = (item.spec ?? {}) as Record<string, unknown>;
  const status = (item.status ?? {}) as Record<string, unknown>;
  const metrics = ((spec['metrics'] ?? []) as Array<Record<string, unknown>>).map((metric) => {
    const resource = metric['resource'] as Record<string, unknown> | undefined;
    const target = (resource?.['target'] as Record<string, unknown> | undefined) ?? {};
    const average = target['averageUtilization'];
    if (typeof average === 'number') return `${String(resource?.['name'] ?? '')}: ${average}%`;
    const value = target['averageValue'];
    if (value) return `${String(resource?.['name'] ?? '')}: ${String(value)}`;
    return metric['type'] ? String(metric['type']) : '';
  });
  const conditions = (status['conditions'] ?? []) as Array<Record<string, unknown>>;
  const activeCondition = conditions.find((condition) => condition['type'] === 'ScalingActive');
  return {
    exists: true,
    name: item.metadata?.name ?? '',
    minReplicas: Number(spec['minReplicas'] ?? 1),
    maxReplicas: Number(spec['maxReplicas'] ?? 0),
    metrics: metrics.filter(Boolean),
    currentReplicas: Number(status['currentReplicas'] ?? 0),
    active: activeCondition?.['status'] === 'True',
  };
}

/** Find the autoscaler that targets `kind/name`, if the project has one. */
export function hpaFor(item: KubeHpa, kind: WorkloadKind, name: string): boolean {
  const ref = ((item.spec ?? {})['scaleTargetRef'] ?? {}) as Record<string, unknown>;
  const targetKind = String(ref['kind'] ?? '').toLowerCase();
  const expected: Record<string, string> = {
    deployments: 'deployment',
    statefulsets: 'statefulset',
    daemonsets: 'daemonset',
  };
  return targetKind === expected[kind] && String(ref['name'] ?? '') === name;
}

/**
 * One revision of a Deployment.
 *
 * Kubernetes keeps a ReplicaSet per revision: the revision number and the pod
 * template it ran are in annotations, and a rollback is a patch of the Deployment's
 * template back to an older revision's template. There is no rollback API.
 */
export interface WorkloadRevision {
  /** The ReplicaSet's name; the row key. */
  replicaSet: string;
  /** `deployment.kubernetes.io/revision`; 0 when the annotation is missing. */
  revision: number;
  replicas: number;
  /** `deployment.kubernetes.io/revision-history` image list, flattened. */
  images: string[];
  /** When this revision was created. */
  createdAt: string;
  /** True for the revision the Deployment currently points at. */
  current: boolean;
}

interface KubeReplicaSet extends KubeObject {
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

export function toWorkloadRevision(item: KubeReplicaSet, currentRevision: number): WorkloadRevision {
  const annotations = (item.metadata?.annotations ?? {}) as Record<string, string>;
  const revision = Number(annotations['deployment.kubernetes.io/revision'] ?? 0);
  const template = ((item.spec ?? {})['template'] ?? {}) as Record<string, unknown>;
  const containers = (((template['spec'] as Record<string, unknown> | undefined)?.['containers'] ?? []) as Array<Record<string, unknown>>);
  return {
    replicaSet: item.metadata?.name ?? '',
    revision: Number.isFinite(revision) ? revision : 0,
    replicas: Number((item.spec ?? {})['replicas'] ?? 0),
    images: containers.map((container) => String(container['image'] ?? '')).filter(Boolean),
    createdAt: String(item.metadata?.creationTimestamp ?? ''),
    current: Number.isFinite(revision) && revision === currentRevision,
  };
}

/** The pod template of one revision, ready to be patched back onto the Deployment. */
export function revisionTemplate(item: KubeReplicaSet): Record<string, unknown> | undefined {
  const template = ((item.spec ?? {})['template'] ?? undefined) as Record<string, unknown> | undefined;
  return template;
}

/** Cluster/namespace-aware path for a core-group resource (deployments, replicasets). */
function workloadPath(cluster: string, resource: string, namespace: string, name?: string): string {
  const clusterSegment = cluster && cluster !== 'host' ? `clusters/${encodeURIComponent(cluster)}/` : '';
  const namespaceSegment = namespace ? `namespaces/${encodeURIComponent(namespace)}/` : '';
  const suffix = name ? `/${encodeURIComponent(name)}` : '';
  return `${kubePrefix(resource)}/${clusterSegment}${namespaceSegment}${resource}${suffix}`;
}

/** A pod owned by the workload being viewed. */
export interface WorkloadPod {
  name: string;
  phase: string;
  node: string;
  /** Container restart total; the first number an operator looks for. */
  restarts: number;
  createdAt: string;
  /** True when the pod is terminating; deleting pods stay listed until gone. */
  terminating: boolean;
}

export function toWorkloadPod(item: KubeWorkload): WorkloadPod {
  const status = (item.status ?? {}) as Record<string, unknown>;
  const containers = (status['containerStatuses'] ?? []) as Array<Record<string, unknown>>;
  return {
    name: item.metadata?.name ?? '',
    phase: String(status['phase'] ?? ''),
    node: String((item.spec ?? {})['nodeName'] ?? ''),
    restarts: containers.reduce((sum, container) => sum + Number(container['restartCount'] ?? 0), 0),
    createdAt: String(item.metadata?.creationTimestamp ?? ''),
    // `deletionTimestamp` is not in the shared metadata type; it is read through a record.
    terminating: Boolean((item.metadata as Record<string, unknown> | undefined)?.['deletionTimestamp']),
  };
}

/**
 * The headless service a StatefulSet points at.
 *
 * `spec.serviceName` is the field, not a selector match: a StatefulSet names the
 * service that governs its pod DNS (`<pod>.<service>`), so the relationship is declared
 * rather than inferred. `undefined` means "no such service", which is a normal answer —
 * the field can name something that was never created.
 */
export interface WorkloadService {
  name: string;
  /** `ClusterIP` / `Headless` (a `clusterIP: None` service) / other type. */
  type: string;
  /** The cluster IP, or `None` for a headless service. */
  clusterIP: string;
  ports: string[];
  /** False when `spec.serviceName` named a service that does not exist. */
  exists: boolean;
}

export function toWorkloadService(item: KubeService | undefined, name: string): WorkloadService {
  if (!item) return { name, exists: false, type: '', clusterIP: '', ports: [] };
  const spec = (item.spec ?? {}) as Record<string, unknown>;
  const ports = ((spec['ports'] ?? []) as Array<Record<string, unknown>>).map((port) =>
    port['port'] === undefined ? '' : `${String(port['port'])}/${String(port['protocol'] ?? 'TCP')}`,
  );
  const clusterIP = String(spec['clusterIP'] ?? '');
  return {
    name,
    exists: true,
    // `clusterIP: None` is how Kubernetes spells a headless service; showing "None"
    // as the type is clearer than calling it ClusterIP.
    type: clusterIP === 'None' ? 'Headless' : String(spec['type'] ?? 'ClusterIP'),
    clusterIP,
    ports: ports.filter(Boolean),
  };
}

interface KubeService extends KubeObject {
  spec?: Record<string, unknown>;
}

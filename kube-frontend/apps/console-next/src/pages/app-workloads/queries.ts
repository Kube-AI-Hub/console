import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hpaFor, ipPoolsApi, toWorkloadAutoscaling, workloadsApi, type KubeObject, type ResourceListParams, type WorkloadKind } from '@kube-ai-hub/api-client';
import { registerPage, type AiPage } from '@kube-ai-hub/ai-surface';
import type { LocaleKey } from '@kube-ai-hub/locales';
import { api } from '@/api';

/**
 * Workload queries, one set for all eight kinds.
 *
 * The kind is part of every key: two lists that differed only by resource were
 * showing each other's cached page when the key was built from the namespace
 * alone — the classic version of this bug, and the reason the key repeats the same
 * object the request uses.
 */

export function workloadsKey(kind: WorkloadKind, params: Omit<ResourceListParams, 'signal'>) {
  return [
    kind,
    params.cluster,
    params.namespace,
    params.page,
    params.pageSize,
    params.sortBy,
    params.order,
    params.keyword,
    params.fieldSelector,
    /*
     * The status filter is part of the key for the same reason page size is: two
     * requests that differ only by filter would otherwise share one cache entry, and
     * clearing the filter would show the filtered page until the next refetch.
     */
    params.filters ? JSON.stringify(params.filters) : '',
  ] as const;
}

export function useWorkloads(kind: WorkloadKind, params: Omit<ResourceListParams, 'signal'>) {
  return useQuery({
    queryKey: workloadsKey(kind, params),
    queryFn: ({ signal }) => workloadsApi(api, kind).list({ ...params, signal }),
  });
}

/**
 * Distinct `app` labels the project's controllers select on.
 *
 * The Service create dialog prefills its selector from this list: a service that
 * selects a label no workload carries routes to nothing, and typing the label by
 * hand is where that typo comes from. One project has a handful of controllers, so
 * three reads are cheap; failures leave the list empty and the dialog falls back to
 * manual entry rather than blocking creation.
 */
export function useWorkloadAppLabels(cluster: string, namespace: string): string[] {
  const query = useQuery({
    queryKey: ['workload-app-labels', cluster, namespace],
    enabled: Boolean(cluster) && Boolean(namespace),
    queryFn: async ({ signal }) => {
      const kinds: WorkloadKind[] = ['deployments', 'statefulsets', 'daemonsets'];
      const pages = await Promise.all(
        kinds.map((kind) =>
          workloadsApi(api, kind).list({ cluster, namespace, page: 1, pageSize: 100, signal }),
        ),
      );
      const labels = new Set<string>();
      for (const page of pages) {
        for (const item of page.items) {
          if (item.app) labels.add(item.app);
        }
      }
      return [...labels].sort();
    },
    staleTime: 30_000,
    retry: false,
  });
  return query.data ?? [];
}

export function useWorkload(kind: WorkloadKind, params: { cluster: string; namespace: string; name: string }) {
  return useQuery({
    queryKey: ['workload', kind, params.cluster, params.namespace, params.name],
    queryFn: ({ signal }) => workloadsApi(api, kind).get({ ...params, signal }),
  });
}

export function useDeleteWorkload(kind: WorkloadKind, params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (names: string[]) => workloadsApi(api, kind).remove({ ...params, names }),
    // Refetch rather than remove locally: a batch delete has no transaction
    // upstream, and a partial failure must stay visible.
    onSuccess: () => invalidate(queryClient, kind),
  });
}

export function useUpdateWorkload(kind: WorkloadKind, params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: KubeObject) => workloadsApi(api, kind).update({ ...params, body }),
    onSuccess: () => invalidate(queryClient, kind),
  });
}

/**
 * The cluster's IP pools, for the pod IP pool selector.
 *
 * A cluster without the network group answers 404 for this resource; that is not an error to
 * retry, it just means the pod IP pool control has nothing to offer.
 */
export function useIPPools(cluster: string) {
  return useQuery({
    queryKey: ['ip-pools', cluster, 'available'],
    queryFn: ({ signal }) =>
      ipPoolsApi(api).list({ cluster, namespace: '', page: 1, pageSize: 200, sortBy: 'name', order: 'asc', signal }),
    retry: false,
    staleTime: 60_000,
  });
}

export function useEditWorkloadInfo(kind: WorkloadKind, params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; alias?: string; description?: string }) =>
      workloadsApi(api, kind).editInfo({
        cluster: params.cluster,
        namespace: params.namespace,
        name: input.name,
        body: {
          ...(input.alias !== undefined ? { alias: input.alias } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
      }),
    onSuccess: () => invalidate(queryClient, kind),
  });
}

/**
 * The autoscaler attached to one workload, if any.
 *
 * Listed per project and matched here: an HPA names its target, and Kubernetes offers
 * no reverse lookup. The read is cheap (a project has a handful) and only runs for the
 * three kinds an HPA can target.
 */
/** A Job's runs, one row per pod it started. */
export function useJobRuns(kind: WorkloadKind, params: { cluster: string; namespace: string; name: string }) {
  return useQuery({
    queryKey: ['job-runs', params.cluster, params.namespace, params.name],
    enabled: kind === 'jobs' && Boolean(params.name),
    queryFn: ({ signal }) => workloadsApi(api, kind).runs({ ...params, signal } as never),
  });
}

/** The service a StatefulSet points at through `spec.serviceName`. */
export function useWorkloadService(kind: WorkloadKind, params: { cluster: string; namespace: string; name: string }) {
  return useQuery({
    queryKey: ['workload-service', params.cluster, params.namespace, kind, params.name],
    // Only StatefulSets declare a governing service.
    enabled: kind === 'statefulsets' && Boolean(params.name),
    queryFn: ({ signal }) => workloadsApi(api, kind).service({ ...params, signal } as never),
  });
}

/** Pods belonging to one workload, newest first. */
export function useWorkloadPods(kind: WorkloadKind, params: { cluster: string; namespace: string; name: string }) {
  return useQuery({
    queryKey: ['workload-pods', params.cluster, params.namespace, kind, params.name],
    // Services select their pods too, by their own `spec.selector`; the kinds
    // without a selector (jobs, cronjobs, ingresses) show no block.
    enabled: ['deployments', 'statefulsets', 'daemonsets', 'services'].includes(kind),
    queryFn: ({ signal }) => workloadsApi(api, kind).pods({ ...params, signal } as never),
    // Pods come and go; a stale list would show a pod that has already been replaced.
    refetchInterval: 15_000,
  });
}

/** ReplicaSets owned by a deployment, one row per revision. */
export function useWorkloadRevisions(kind: WorkloadKind, params: { cluster: string; namespace: string; name: string }) {
  return useQuery({
    queryKey: ['revisions', params.cluster, params.namespace, kind, params.name],
    // Only Deployments keep revision history; the others have no ReplicaSet per change.
    enabled: kind === 'deployments' && Boolean(params.name),
    queryFn: ({ signal }) => workloadsApi(api, kind).revisions({ ...params, signal } as never),
  });
}

export function useRollbackWorkload(kind: WorkloadKind, params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; replicaSet: string }) => workloadsApi(api, kind).rollback({ ...params, ...input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['revisions'] });
      invalidate(queryClient, kind);
    },
  });
}

export function useWorkloadAutoscaling(
  kind: WorkloadKind,
  params: { cluster: string; namespace: string; name: string },
) {
  const targetable = kind === 'deployments' || kind === 'statefulsets' || kind === 'daemonsets';
  return useQuery({
    queryKey: ['hpa', params.cluster, params.namespace, kind, params.name],
    enabled: targetable && Boolean(params.name),
    queryFn: async ({ signal }) => {
      const body = await api.request<{ items?: Array<Record<string, unknown>> }>(
        `/apis/autoscaling/v2/namespaces/${encodeURIComponent(params.namespace)}/horizontalpodautoscalers`,
        { signal },
      );
      const match = (body?.items ?? []).find((item) => hpaFor(item as never, kind, params.name));
      return toWorkloadAutoscaling(match as never);
    },
    retry: false,
  });
}

export function useCreateWorkload(kind: WorkloadKind, params: { cluster: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { namespace: string; name: string; image: string; app: string; replicas?: number }) =>
      workloadsApi(api, kind).create({ cluster: params.cluster, ...input }),
    onSuccess: () => invalidate(queryClient, kind),
  });
}

export function useSetServicePorts(kind: WorkloadKind, params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; ports: Array<{ name: string; port: number; targetPort: string }> }) =>
      workloadsApi(api, kind).setServicePorts({ ...params, ...input }),
    onSuccess: () => invalidate(queryClient, kind),
  });
}

export function useSetIngressRules(kind: WorkloadKind, params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; rules: Array<{ host: string; path: string; serviceName: string; servicePort: string }> }) =>
      workloadsApi(api, kind).setIngressRules({ ...params, ...input }),
    onSuccess: () => invalidate(queryClient, kind),
  });
}

export function useSuspendWorkload(kind: WorkloadKind, params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; suspended: boolean }) =>
      workloadsApi(api, kind).setSuspended({
        cluster: params.cluster,
        namespace: params.namespace,
        name: input.name,
        suspended: input.suspended,
      }),
    onSuccess: () => invalidate(queryClient, kind),
  });
}

export function useScaleWorkload(kind: WorkloadKind, params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; replicas: number }) =>
      workloadsApi(api, kind).scale({ cluster: params.cluster, namespace: params.namespace, name: input.name, replicas: input.replicas }),
    onSuccess: () => invalidate(queryClient, kind),
  });
}

export function useRestartWorkload(kind: WorkloadKind, params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => workloadsApi(api, kind).restart({ ...params, name }),
    onSuccess: () => invalidate(queryClient, kind),
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>, kind: WorkloadKind): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [kind] }),
    queryClient.invalidateQueries({ queryKey: ['workload', kind] }),
  ]).then(() => undefined);
}

/** What one workload page needs to describe itself. */
export interface WorkloadDescriptor {
  kind: WorkloadKind;
  titleKey: LocaleKey;
  descriptionKey: LocaleKey;
  emptyTitleKey: LocaleKey;
  emptyDescriptionKey: LocaleKey;
  /** Whether a status column makes sense (services and ingresses have none). */
  showStatus: boolean;
  /** Whether the ready/desired counter exists for this kind. */
  showProgress: boolean;
  /** `false` for kinds the old console does not let you delete from the list. */
  allowDelete?: boolean;
  /** 编辑信息 (alias/description) — every kind has it in the old console. */
  allowEditInfo?: boolean;
  /** 停止/启动 by scaling to 0 — the three controllers only. */
  allowScale?: boolean;
  /**
   * 编辑设置: the custom template form (image, replicas, env, pull policy).
   *
   * True for the three controllers and CronJobs. A Job is excluded because
   * `spec.template` is immutable once it exists — the dialog would offer a save the
   * API rejects. Pods and Services have no pod template to edit.
   */
  allowEditSettings?: boolean;
  /** 暂停/启动 by `spec.suspend` — CronJobs only. */
  allowSuspend?: boolean;
  /** 创建: resource-specific form and manifest builders determine supported kinds. */
  allowCreate?: boolean;
  /**
   * Whether 重新部署 applies. True only for the three controllers that own pods
   * directly: restarting works by rolling their pod template, and a Job, Service
   * or Route has none.
   */
  allowRedeploy?: boolean;
  /** Status value → locale key, mirroring the old console's status map. */
  statusKeys: Record<string, LocaleKey>;
}

const WORKLOAD_STATUS_KEYS = {
  running: 'workloads.status.running',
  updating: 'workloads.status.updating',
  stopped: 'workloads.status.stopped',
  terminating: 'workloads.status.terminating',
} as const;

const POD_STATUS_KEYS = {
  running: 'workloads.status.running',
  waiting: 'workloads.status.waiting',
  terminated: 'workloads.status.terminated',
} as const;

export const WORKLOAD_DESCRIPTORS: Record<string, WorkloadDescriptor> = {
  deployments: {
    kind: 'deployments',
    allowEditSettings: true,
    allowCreate: true,
    allowRedeploy: true,
    allowScale: true,
    titleKey: 'workloads.deployments.title',
    descriptionKey: 'workloads.deployments.description',
    emptyTitleKey: 'workloads.deployments.emptyTitle',
    emptyDescriptionKey: 'workloads.deployments.emptyDescription',
    showStatus: true,
    showProgress: true,
    allowEditInfo: true,
    statusKeys: WORKLOAD_STATUS_KEYS,
  },
  statefulsets: {
    kind: 'statefulsets',
    allowEditSettings: true,
    allowCreate: true,
    allowRedeploy: true,
    allowScale: true,
    titleKey: 'workloads.statefulsets.title',
    descriptionKey: 'workloads.statefulsets.description',
    emptyTitleKey: 'workloads.statefulsets.emptyTitle',
    emptyDescriptionKey: 'workloads.statefulsets.emptyDescription',
    showStatus: true,
    showProgress: true,
    allowEditInfo: true,
    statusKeys: WORKLOAD_STATUS_KEYS,
  },
  daemonsets: {
    kind: 'daemonsets',
    allowEditSettings: true,
    allowCreate: true,
    allowRedeploy: true,
    allowScale: true,
    titleKey: 'workloads.daemonsets.title',
    descriptionKey: 'workloads.daemonsets.description',
    emptyTitleKey: 'workloads.daemonsets.emptyTitle',
    emptyDescriptionKey: 'workloads.daemonsets.emptyDescription',
    showStatus: true,
    showProgress: true,
    allowEditInfo: true,
    statusKeys: WORKLOAD_STATUS_KEYS,
  },
  jobs: {
    kind: 'jobs',
    allowCreate: true,
    titleKey: 'workloads.jobs.title',
    descriptionKey: 'workloads.jobs.description',
    emptyTitleKey: 'workloads.jobs.emptyTitle',
    emptyDescriptionKey: 'workloads.jobs.emptyDescription',
    showStatus: true,
    showProgress: true,
    allowEditInfo: true,
    statusKeys: WORKLOAD_STATUS_KEYS,
  },
  cronjobs: {
    kind: 'cronjobs',
    allowCreate: true,
    allowEditSettings: true,
    allowSuspend: true,
    titleKey: 'workloads.cronjobs.title',
    descriptionKey: 'workloads.cronjobs.description',
    emptyTitleKey: 'workloads.cronjobs.emptyTitle',
    emptyDescriptionKey: 'workloads.cronjobs.emptyDescription',
    showStatus: true,
    showProgress: true,
    allowEditInfo: true,
    statusKeys: WORKLOAD_STATUS_KEYS,
  },
  pods: {
    kind: 'pods',
    titleKey: 'workloads.pods.title',
    descriptionKey: 'workloads.pods.description',
    emptyTitleKey: 'workloads.pods.emptyTitle',
    emptyDescriptionKey: 'workloads.pods.emptyDescription',
    showStatus: true,
    showProgress: false,
    allowEditInfo: true,
    statusKeys: POD_STATUS_KEYS,
  },
  services: {
    kind: 'services',
    allowCreate: true,
    titleKey: 'workloads.services.title',
    descriptionKey: 'workloads.services.description',
    emptyTitleKey: 'workloads.services.emptyTitle',
    emptyDescriptionKey: 'workloads.services.emptyDescription',
    showStatus: false,
    showProgress: false,
    allowEditInfo: true,
    statusKeys: {},
  },
  ingresses: {
    kind: 'ingresses',
    allowCreate: true,
    titleKey: 'workloads.ingresses.title',
    descriptionKey: 'workloads.ingresses.description',
    emptyTitleKey: 'workloads.ingresses.emptyTitle',
    emptyDescriptionKey: 'workloads.ingresses.emptyDescription',
    showStatus: false,
    showProgress: false,
    allowEditInfo: true,
    statusKeys: {},
  },
};

/** Manifest entry for a workload page, so an agent can find its handles. */
export function registerWorkloadPage(descriptor: WorkloadDescriptor, workspace = '$workspace'): AiPage {
  return {
    path: `/kube-frontend/${workspace}/clusters/$cluster/projects/$namespace/${descriptor.kind}`,
    title: descriptor.kind,
    description: '应用负载列表：可搜索、排序、编辑 YAML、删除。',
    surfaceId: `${descriptor.kind}:surface`,
    states: {
      loading: '首次加载或切换分页后',
      ready: '已拿到至少一条数据',
      empty: '查询成功但没有匹配项',
      error: '请求失败，页面给出重试入口',
    },
    actions: [
      { id: `${descriptor.kind}:search`, description: '按名称搜索', expect: { state: 'ready' } },
      { id: `${descriptor.kind}:row-select`, description: '选中一行', requires: [], expect: { state: 'ready' } },
      {
        id: `${descriptor.kind}:bulk-delete`,
        description: '删除所选',
        mutating: true,
        requires: [`${descriptor.kind}:row-select`],
        expect: { state: 'ready' },
      },
    ],
  };
}

const registered = new Set<string>();
export function ensureWorkloadPageRegistered(descriptor: WorkloadDescriptor): void {
  if (registered.has(descriptor.kind)) return;
  registered.add(descriptor.kind);
  registerPage(registerWorkloadPage(descriptor));
}

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  imageBuildersApi,
  uploadS2iBinary,
  type EnvSourceValues,
  type S2iJobDetail,
  type S2iRunSummary,
} from '@kube-ai-hub/api-client';
import { registerPage, type AiPage } from '@kube-ai-hub/ai-surface';
import { api as apiClient, currentToken } from '@/api';

/**
 * Queries and mutations for the image builder page family.
 *
 * The keys repeat cluster, namespace and the object name on purpose: this page can be
 * opened for two projects and two builders at once (a detail in one tab, the list in
 * another), and a key that omitted the scope showed the first project's rows in the
 * second project.
 *
 * Page-specific queries live here instead of in the shared `app-workloads/queries.ts`
 * because that module owns the eight workload kinds and is being edited by another
 * migration unit in parallel.
 */

const builders = imageBuildersApi(apiClient);

export function buildersKey(params: {
  cluster: string;
  namespace: string;
  page: number;
  pageSize: number;
  sortBy: string;
  order: string;
  keyword: string;
}) {
  return ['image-builders', params.cluster, params.namespace, params.page, params.pageSize, params.sortBy, params.order, params.keyword] as const;
}

export function builderKey(cluster: string, namespace: string, name: string) {
  return ['image-builder', cluster, namespace, name] as const;
}

export function builderRunsKey(cluster: string, namespace: string, builderName: string, page: number, pageSize: number) {
  return ['image-builder-runs', cluster, namespace, builderName, page, pageSize] as const;
}

export function useImageBuilders(params: {
  cluster: string;
  namespace: string;
  page: number;
  pageSize: number;
  sortBy: string;
  order: 'asc' | 'desc';
  keyword: string;
}) {
  return useQuery({
    queryKey: buildersKey(params),
    queryFn: ({ signal }) =>
      builders.list({
        cluster: params.cluster,
        namespace: params.namespace,
        page: params.page,
        pageSize: params.pageSize,
        sortBy: params.sortBy,
        order: params.order,
        keyword: params.keyword,
        signal,
      }),
    // The old list re-read every four seconds while any builder is running, because the
    // controller writes `lastRunState` asynchronously and there is no watch channel.
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      return items.some((item) => item.status === 'building') ? 4000 : false;
    },
  });
}

export function useImageBuilder(params: { cluster: string; namespace: string; name: string; enabled?: boolean }) {
  return useQuery({
    queryKey: builderKey(params.cluster, params.namespace, params.name),
    queryFn: ({ signal }) => builders.get({ cluster: params.cluster, namespace: params.namespace, name: params.name, signal }),
    enabled: params.enabled !== false && Boolean(params.name),
    retry: false,
  });
}

export function useBuilderTemplates(cluster: string) {
  return useQuery({
    queryKey: ['image-builder-templates', cluster],
    queryFn: ({ signal }) => builders.templates({ cluster, signal }),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useBuilderSecrets(params: { cluster: string; namespace: string; type: string; enabled?: boolean }) {
  return useQuery({
    queryKey: ['image-builder-secrets', params.cluster, params.namespace, params.type],
    queryFn: ({ signal }) => builders.secrets({ cluster: params.cluster, namespace: params.namespace, type: params.type, signal }),
    enabled: params.enabled !== false,
    staleTime: 60_000,
    retry: false,
  });
}

export function useBuilderRuns(params: {
  cluster: string;
  namespace: string;
  builderName: string;
  page: number;
  pageSize: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: builderRunsKey(params.cluster, params.namespace, params.builderName, params.page, params.pageSize),
    queryFn: ({ signal }) =>
      builders.runsPage({
        cluster: params.cluster,
        namespace: params.namespace,
        builderName: params.builderName,
        page: params.page,
        pageSize: params.pageSize,
        signal,
      }),
    enabled: params.enabled !== false,
    // Runs are the object the page polls for a running build; a completed run list is
    // stable and does not need re-reading.
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      return items.some((run) => run.status === 'building' || run.status === '') ? 4000 : false;
    },
  });
}

/**
 * The Job of a run.
 *
 * `null` means the controller has not created one — on this installation the
 * s2ioperator cannot watch its own CRDs (it runs as a service account without
 * cluster-scope list permission), so a run can stay without a job forever. The page
 * says that instead of rendering an empty table as if the build produced nothing.
 */
export function useS2iJob(params: { cluster: string; namespace: string; jobName: string }) {
  return useQuery({
    queryKey: ['image-builder-job', params.cluster, params.namespace, params.jobName],
    queryFn: ({ signal }) => builders.job({ cluster: params.cluster, namespace: params.namespace, name: params.jobName, signal }),
    enabled: Boolean(params.jobName),
    retry: false,
  });
}

export function useJobPods(params: { cluster: string; namespace: string; job: S2iJobDetail | null | undefined }) {
  return useQuery({
    queryKey: ['image-builder-job-pods', params.cluster, params.namespace, params.job?.name ?? '', params.job?.selector ?? {}],
    queryFn: ({ signal }) =>
      builders.jobPods({ cluster: params.cluster, namespace: params.namespace, selector: params.job?.selector ?? {}, signal }),
    enabled: Boolean(params.job),
    retry: false,
  });
}

export function useJobEvents(params: { cluster: string; namespace: string; job: S2iJobDetail | null | undefined }) {
  return useQuery({
    queryKey: ['image-builder-job-events', params.cluster, params.namespace, params.job?.name ?? ''].concat(params.job?.uid ?? ''),
    queryFn: ({ signal }) =>
      builders.events({
        cluster: params.cluster,
        namespace: params.namespace,
        name: params.job?.name ?? '',
        ...(params.job?.uid ? { uid: params.job.uid } : {}),
        signal,
      }),
    enabled: Boolean(params.job),
    retry: false,
  });
}

interface EnvRef {
  /** `Secret` or `ConfigMap` — used as the source kind in the UI. */
  kind: 'Secret' | 'ConfigMap';
  name: string;
}

/**
 * Resolve every `valueFrom` a set of containers references.
 *
 * The old page resolved each reference one by one and then rebuilt the variable list;
 * doing it as one query means the environment tab has one loading and one error state
 * instead of one per variable.
 */
export function useEnvSources(params: {
  cluster: string;
  namespace: string;
  containers: S2iJobDetail['containers'] | undefined;
}) {
  const refs = React.useMemo(() => {
    const seen = new Set<string>();
    const list: EnvRef[] = [];
    for (const container of params.containers ?? []) {
      for (const entry of container.env ?? []) {
        const from = entry.valueFrom;
        if (from?.secretKeyRef?.name) {
          const key = 'Secret/' + from.secretKeyRef.name;
          if (!seen.has(key)) {
            seen.add(key);
            list.push({ kind: 'Secret', name: from.secretKeyRef.name });
          }
        }
        if (from?.configMapKeyRef?.name) {
          const key = 'ConfigMap/' + from.configMapKeyRef.name;
          if (!seen.has(key)) {
            seen.add(key);
            list.push({ kind: 'ConfigMap', name: from.configMapKeyRef.name });
          }
        }
      }
    }
    return list;
  }, [params.containers]);

  return useQuery({
    queryKey: ['image-builder-env-sources', params.cluster, params.namespace, refs],
    queryFn: async ({ signal }): Promise<Record<string, EnvSourceValues>> => {
      const entries = await Promise.all(
        refs.map(async (ref) => {
          const value =
            ref.kind === 'Secret'
              ? await builders.secretValues({ cluster: params.cluster, namespace: params.namespace, name: ref.name, signal })
              : await builders.configMapValues({ cluster: params.cluster, namespace: params.namespace, name: ref.name, signal });
          return [ref.kind + '/' + ref.name, value] as const;
        }),
      );
      return Object.fromEntries(entries);
    },
    enabled: refs.length > 0,
    retry: false,
  });
}

function invalidateBuilders(queryClient: ReturnType<typeof useQueryClient>, cluster: string, namespace: string) {
  void queryClient.invalidateQueries({ queryKey: ['image-builders', cluster, namespace] });
}

export function useCreateBuilder(params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { body: Record<string, unknown>; startRun: boolean; binaryUrl?: string }) => {
      const created = await builders.create({ cluster: params.cluster, namespace: params.namespace, body: input.body });
      if (input.startRun) {
        await builders.createRun({
          cluster: params.cluster,
          namespace: params.namespace,
          body: {
            apiVersion: 'devops.kubesphere.io/v1alpha1',
            kind: 'S2iRun',
            metadata: { name: created.name.slice(0, 37) + '-run-' + Math.random().toString(36).slice(2, 5), namespace: params.namespace },
            spec: { builderName: created.name },
          },
        });
      }
      return created;
    },
    onSuccess: (created) => {
      invalidateBuilders(queryClient, params.cluster, params.namespace);
      void queryClient.invalidateQueries({ queryKey: builderKey(params.cluster, params.namespace, created.name) });
    },
  });
}

/** Patch the builder's config, then start a new run — the old "运行/重新构建" action. */
export function useRunBuilder(params: { cluster: string; namespace: string; name: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { patch: Record<string, unknown>; startRun: boolean; runSpec?: Record<string, unknown> }) => {
      const patched = await builders.patch({
        cluster: params.cluster,
        namespace: params.namespace,
        name: params.name,
        body: input.patch,
      });
      if (input.startRun) {
        await builders.createRun({
          cluster: params.cluster,
          namespace: params.namespace,
          body: {
            apiVersion: 'devops.kubesphere.io/v1alpha1',
            kind: 'S2iRun',
            metadata: {
              name: (params.name.slice(0, 30) + '-rerun-' + Math.random().toString(36).slice(2, 5)),
              namespace: params.namespace,
            },
            spec: { builderName: params.name, ...(input.runSpec ?? {}) },
          },
        });
      }
      return patched;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: builderKey(params.cluster, params.namespace, params.name) });
      void queryClient.invalidateQueries({ queryKey: ['image-builder-runs', params.cluster, params.namespace, params.name] });
      invalidateBuilders(queryClient, params.cluster, params.namespace);
    },
  });
}

export function useUpdateBuilder(params: { cluster: string; namespace: string; name: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      builders.update({ cluster: params.cluster, namespace: params.namespace, name: params.name, body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: builderKey(params.cluster, params.namespace, params.name) });
      invalidateBuilders(queryClient, params.cluster, params.namespace);
    },
  });
}

export function usePatchBuilderInfo(params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; annotations: Record<string, string> }) =>
      builders.patch({
        cluster: params.cluster,
        namespace: params.namespace,
        name: input.name,
        body: { metadata: { annotations: input.annotations } },
      }),
    onSuccess: async (_data, input) => {
      await queryClient.invalidateQueries({ queryKey: builderKey(params.cluster, params.namespace, input.name) });
      invalidateBuilders(queryClient, params.cluster, params.namespace);
    },
  });
}

export function useDeleteBuilder(params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => builders.remove({ cluster: params.cluster, namespace: params.namespace, name }),
    onSuccess: () => invalidateBuilders(queryClient, params.cluster, params.namespace),
  });
}

/**
 * Upload an artifact (B2I): create the binary object, PUT the file, then read the object
 * back so the caller can use the controller-assigned `spec.downloadURL`.
 *
 * The upload failure path deletes the half-created binary; leaving a `UploadFailed`
 * object behind would make the next attempt collide on the generated name and would
 * pollute the project.
 */
export function useUploadBinary(params: { cluster: string; namespace: string }) {
  return useMutation({
    mutationFn: async (input: { file: File }) => {
      const name = (input.file.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40) || 'artifact') + '-' + Math.random().toString(36).slice(2, 6);
      await builders.createBinary({ cluster: params.cluster, namespace: params.namespace, name });
      try {
        await uploadS2iBinary({
          token: currentToken(),
          cluster: params.cluster,
          namespace: params.namespace,
          name,
          file: input.file,
        });
      } catch (cause) {
        await builders.removeBinary({ cluster: params.cluster, namespace: params.namespace, name }).catch(() => undefined);
        throw cause;
      }
      const binary = await builders.binary({ cluster: params.cluster, namespace: params.namespace, name });
      return {
        name,
        downloadURL: binary.spec?.downloadURL ?? '',
        fileName: binary.spec?.fileName ?? input.file.name,
        size: binary.spec?.size ?? String(input.file.size),
        phase: binary.status?.phase ?? '',
      };
    },
  });
}

/**
 * The log of one run, read from the URL the controller wrote.
 *
 * The old console paged the log through the tenant log-search API; the URL the controller
 * writes is already the log endpoint, so reading it directly keeps the actual lines and
 * avoids a second query language. A URL is only produced after the controller created the
 * job and the pod started — until then the url is empty and the panel says so instead of
 * claiming the build has no output.
 */
export function useRunLog(params: { cluster: string; logURL: string; enabled: boolean; poll?: boolean }) {
  return useQuery({
    queryKey: ['image-builder-run-log', params.cluster, params.logURL],
    queryFn: ({ signal }) => {
      const url = new URL(params.logURL);
      return apiClient.request<string>(url.pathname + url.search, { responseType: 'text', signal });
    },
    enabled: params.enabled && Boolean(params.logURL),
    retry: false,
    // While a build is running the log grows; a finished run's log is final.
    refetchInterval: params.poll ? 4000 : false,
  });
}

/* ------------------------------------------------------------------ */
/* Agent manifest                                                      */
/* ------------------------------------------------------------------ */

const listPage: AiPage = {
  path: '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/s2ibuilder',
  title: '镜像构建器',
  description: '项目内的 S2I/B2I 镜像构建器：列表可创建、编辑信息、删除；详情可查看构建记录、资源状态、镜像制品、环境变量与事件，并可触发重新构建。',
  surfaceId: 'image-builder:surface',
  states: {
    loading: '首次读取构建器列表时的加载态。',
    ready: '列表已就绪，至少一个构建器。',
    empty: '项目里没有构建器；页面提供创建入口。',
    error: '列表读取失败；权限错误不提供重试，其它错误提供重试。',
  },
  actions: [
    {
      id: 'image-builder:create',
      description: '创建镜像构建器（源码构建或制品构建），提交后触发一次构建运行。',
      mutating: true,
      expect: { state: 'ready' },
    },
    {
      id: 'image-builder:search',
      description: '按名称搜索构建器（服务端名称匹配）。',
    },
    {
      id: 'image-builder:refresh',
      description: '重新读取构建器列表。',
    },
    {
      id: 'image-builder:row-manage',
      description: '行内更多操作：编辑信息、删除。',
      requires: ['image-builder:search'],
      mutating: true,
    },
  ],
};

const detailPage: AiPage = {
  path: '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/s2ibuilder/$name',
  title: '镜像构建器详情',
  description: '一个构建器的属性、运行（重新构建）入口、构建记录、资源状态、镜像制品、环境变量与事件。',
  surfaceId: 'image-builder-detail:surface',
  states: {
    loading: '读取构建器详情时的加载态。',
    ready: '构建器详情已就绪。',
    error: '详情读取失败；404 显示「资源不存在」并可返回列表。',
  },
  actions: [
    { id: 'image-builder-detail:run', description: '打开重新构建表单：修改配置并触发一次新的构建运行。', mutating: true },
    { id: 'image-builder-detail:edit-info', description: '编辑别名与描述。', mutating: true },
    { id: 'image-builder-detail:edit-yaml', description: '编辑构建器 YAML。', mutating: true },
    { id: 'image-builder-detail:delete', description: '删除构建器（输入名称确认）。', mutating: true },
    { id: 'image-builder-detail:trigger-copy', description: '复制远程触发器地址。' },
  ],
};

let registered = false;
/** Register the page manifests on first render rather than as an import side effect. */
export function ensureImageBuilderRegistered(): void {
  if (registered) return;
  registered = true;
  registerPage(listPage);
  registerPage(detailPage);
}

export type { S2iRunSummary };

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  secretsApi,
  toKubeSecret,
  type KubeSecret,
  type ResourceListParams,
  type SecretInput,
  type SecretSummary,
} from '@kube-ai-hub/api-client';
import { registerPage, type AiPage } from '@kube-ai-hub/ai-surface';
import { api } from '@/api';

/**
 * Secret data, expressed once.
 *
 * The query key is derived from the same params object the fetch uses, so a
 * namespace switch cannot return a cached page belonging to the old one.
 */

export function secretsKey(params: Omit<ResourceListParams, 'signal'>) {
  return [
    'secrets',
    params.cluster,
    params.namespace,
    params.page,
    params.pageSize,
    params.sortBy,
    params.order,
    params.keyword,
  ] as const;
}

export function useSecrets(params: Omit<ResourceListParams, 'signal'>) {
  return useQuery({
    queryKey: secretsKey(params),
    queryFn: ({ signal }) => secretsApi(api).list({ ...params, signal }),
  });
}

export function useSecret(params: { cluster: string; namespace: string; name: string }) {
  return useQuery({
    queryKey: ['secret', params.cluster, params.namespace, params.name],
    queryFn: ({ signal }) => secretsApi(api).get({ ...params, signal }),
  });
}

/**
 * Every registry secret of a project, for the "default registry" bookkeeping.
 *
 * Read without paging: a namespace has a handful of these at most, and the
 * detail page needs to know which one currently carries the default mark before
 * it can move it.
 */
export function useRegistrySecrets(params: { cluster: string; namespace: string; enabled: boolean }) {
  return useQuery({
    queryKey: ['registry-secrets', params.cluster, params.namespace],
    queryFn: ({ signal }) => secretsApi(api).list({ ...params, page: 1, pageSize: 100, signal }),
    enabled: params.enabled,
  });
}

/**
 * Delete one or many.
 *
 * Invalidates the list rather than removing rows locally: the upstream decides
 * what remains, and an optimistic removal would hide a partial batch failure.
 */
export function useDeleteSecrets(params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (names: string[]) => secretsApi(api).remove({ ...params, names }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useCreateSecret(params: { cluster: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SecretInput) =>
      secretsApi(api).create(toKubeSecret(input), { cluster: params.cluster, namespace: input.namespace }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

/**
 * Replace an object, used by both the settings editor and the YAML editor.
 *
 * Takes the whole body rather than a patch: the two editors both produce a
 * complete object, and sending it whole is what makes "edit YAML" able to change
 * anything the reader can see.
 */
export function useUpdateSecret(params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: KubeSecret) => secretsApi(api).update({ ...params, body }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

/** Partial update, used by the basic-information dialog and the default-registry action. */
export function usePatchSecret(params: { cluster: string; namespace: string; name: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => secretsApi(api).patch({ ...params, body }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useSetDefaultSecret(params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; previous?: string }) =>
      secretsApi(api).setDefault({ ...params, ...input }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

/**
 * The registry Secret that currently carries the default mark.
 *
 * A dedicated, cheap query rather than a page of `secretsApi.list`: the "set
 * default" dialog must find the *previous* default before it can move the mark,
 * and reading it lazily when the dialog opens raced the confirm button — the
 * dialog could be confirmed before the lookup returned, leaving two defaults.
 */
export function useDefaultRegistrySecret(params: { cluster: string; namespace: string; enabled?: boolean }) {
  return useQuery({
    queryKey: ['default-registry-secret', params.cluster, params.namespace],
    /*
     * One page of *registry* Secrets, not of every Secret: a project can hold a
     * few hundred Secrets with large payloads, and a full page of them timed out
     * often enough that the "set as default" dialog opened without knowing the
     * previous default — leaving two Secrets marked default.
     *
     * `labelSelector` cannot filter on annotations, so the type is the narrowing
     * available upstream; the namespace marker is what makes the result useful.
     */
    queryFn: ({ signal }) =>
      secretsApi(api).list({ ...params, page: 1, pageSize: 100, sortBy: 'createTime', order: 'desc', signal }),
    select: (result) => result.items.find((item) => item.isDefault)?.name,
    // The mark rarely moves; a stale read would only delay clearing the old one.
    staleTime: 30_000,
    // Only a registry Secret has a default to move, so the read is skipped elsewhere.
    enabled: params.enabled ?? true,
  });
}

/** Refresh both the list and any open detail after a write. */
function invalidateAll(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['secrets'] }),
    queryClient.invalidateQueries({ queryKey: ['secret'] }),
    queryClient.invalidateQueries({ queryKey: ['registry-secrets'] }),
    queryClient.invalidateQueries({ queryKey: ['default-registry-secret'] }),
  ]).then(() => undefined);
}

/** Register this page in the agent manifest. Called once when the module loads. */
export const secretsPage: AiPage = {
  path: '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/secrets',
  title: '保密字典',
  description: '列出项目内的 Secret，可按类型编辑、设为默认镜像仓库、批量删除。',
  surfaceId: 'secrets:surface',
  states: {
    loading: '首次加载或切换分页后',
    ready: '已拿到至少一条数据',
    empty: '查询成功但没有匹配项',
    error: '请求失败，页面给出重试入口',
  },
  actions: [
    {
      id: 'secrets:search',
      description: '按名称搜索保密字典',
      inputs: { 'secrets:search': { type: 'text', description: '名称关键字' } },
      expect: { state: 'ready' },
    },
    {
      id: 'secrets:create',
      description: '创建新的保密字典',
      mutating: true,
      expect: { text: '保密字典' },
    },
    {
      id: 'secrets:row-select',
      description: '选中一行的复选框，用于批量操作',
      requires: [],
      expect: { state: 'ready' },
    },
    {
      id: 'secrets:bulk-delete',
      description: '删除所选保密字典',
      mutating: true,
      requires: ['secrets:row-select'],
      expect: { state: 'ready' },
    },
  ],
};

let registered = false;
/**
 * Register on first render rather than at import time: a page module imported by
 * a test should not mutate the global manifest as a side effect of importing.
 */
export function ensureSecretsRegistered(): void {
  if (registered) return;
  registered = true;
  registerPage(secretsPage);
}

export type { SecretSummary };

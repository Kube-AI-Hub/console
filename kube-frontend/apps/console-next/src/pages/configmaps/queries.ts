import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configMapsApi, type ListParams, type ConfigMapSummary } from '@kube-ai-hub/api-client';
import { registerPage, type AiPage } from '@kube-ai-hub/ai-surface';
import { api } from '@/api';

/**
 * ConfigMap list data, expressed once.
 *
 * The query key is derived from the same params object the fetch uses, so a
 * namespace switch cannot return a cached page belonging to the old one — the
 * classic bug when the key is assembled separately from the request.
 */
export interface ConfigMapsQuery extends Omit<ListParams, 'signal'> {}

export function configMapsKey(params: ConfigMapsQuery) {
  return ['configmaps', params.cluster, params.namespace, params.page, params.pageSize, params.sortBy, params.order, params.keyword] as const;
}

export function useConfigMaps(params: ConfigMapsQuery) {
  return useQuery({
    queryKey: configMapsKey(params),
    queryFn: ({ signal }) => configMapsApi(api).list({ ...params, signal }),
  });
}

export function useConfigMap(params: { cluster: string; namespace: string; name: string }) {
  return useQuery({
    queryKey: ['configmap', params.cluster, params.namespace, params.name],
    queryFn: ({ signal }) => configMapsApi(api).get({ ...params, signal }),
  });
}

/**
 * Delete one or many.
 *
 * Invalidates the list rather than removing rows locally: the upstream decides
 * what remains, and an optimistic removal would hide a partial batch failure.
 */
export function useDeleteConfigMaps(params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (names: string[]) => configMapsApi(api).remove({ ...params, names }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['configmaps'] }),
  });
}

/** Register this page in the agent manifest. Called once when the module loads. */
export const configMapsPage: AiPage = {
  path: '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/configmaps',
  title: '配置字典',
  description: '列出项目内的 ConfigMap，可搜索、排序、批量删除。',
  surfaceId: 'configmaps:surface',
  states: {
    loading: '首次加载或切换分页后',
    ready: '已拿到至少一条数据',
    empty: '查询成功但没有匹配项',
    error: '请求失败，页面给出重试入口',
  },
  actions: [
    {
      id: 'configmaps:search',
      description: '按名称搜索配置字典',
      inputs: { 'configmaps:search': { type: 'text', description: '名称关键字' } },
      expect: { state: 'ready' },
    },
    {
      id: 'configmaps:create',
      description: '创建新的配置字典',
      mutating: true,
      expect: { text: '配置字典' },
    },
    {
      id: 'configmaps:row-select',
      description: '选中一行的复选框，用于批量操作',
      requires: [],
      expect: { state: 'ready' },
    },
    {
      id: 'configmaps:bulk-delete',
      description: '删除所选配置字典',
      mutating: true,
      requires: ['configmaps:row-select'],
      expect: { state: 'ready' },
    },
  ],
};

let registered = false;
/**
 * Register on first render rather than at import time: a page module imported by
 * a test should not mutate the global manifest as a side effect of importing.
 */
export function ensureConfigMapsRegistered(): void {
  if (registered) return;
  registered = true;
  registerPage(configMapsPage);
}

export type { ConfigMapSummary };

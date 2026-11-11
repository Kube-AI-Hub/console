import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  serviceAccountsApi,
  secretsApi,
  toKubeServiceAccount,
  type KubeServiceAccount,
  type ResourceListParams,
  type SecretDetail,
  type ServiceAccountInput,
  type ServiceAccountSummary,
} from '@kube-ai-hub/api-client';
import { registerPage, type AiPage } from '@kube-ai-hub/ai-surface';
import { ApiError } from '@kube-ai-hub/api-client';
import { api } from '@/api';

/**
 * ServiceAccount data, expressed once.
 *
 * The query key is derived from the same params object the fetch uses, so a
 * namespace switch cannot return a cached page belonging to the old one.
 */

export function serviceAccountsKey(params: Omit<ResourceListParams, 'signal'>) {
  return [
    'serviceaccounts',
    params.cluster,
    params.namespace,
    params.page,
    params.pageSize,
    params.sortBy,
    params.order,
    params.keyword,
  ] as const;
}

export function useServiceAccounts(params: Omit<ResourceListParams, 'signal'>) {
  return useQuery({
    queryKey: serviceAccountsKey(params),
    queryFn: ({ signal }) => serviceAccountsApi(api).list({ ...params, signal }),
  });
}

export function useServiceAccount(params: { cluster: string; namespace: string; name: string }) {
  return useQuery({
    queryKey: ['serviceaccount', params.cluster, params.namespace, params.name],
    queryFn: ({ signal }) => serviceAccountsApi(api).get({ ...params, signal }),
  });
}

/**
 * The token Secrets a ServiceAccount mounts, resolved one by one.
 *
 * The list page shows their names; the detail page needs their payload to build
 * the kubeconfig, and there is no endpoint that inlines a Secret into its
 * ServiceAccount, so each is fetched by name. `queries` keeps them parallel and
 * cached, and `enabled` holds them off until the account has loaded.
 */
export function useServiceAccountSecrets(params: { cluster: string; namespace: string; names: string[] }) {
  return useQuery({
    queryKey: ['serviceaccount-secrets', params.cluster, params.namespace, ...params.names],
    queryFn: async ({ signal }) => {
      const deadline = Date.now() + 15_000;
      for (;;) {
        const items = await Promise.all(
          params.names.map((name) =>
            secretsApi(api).get({ cluster: params.cluster, namespace: params.namespace, name, signal }),
          ),
        );
        // Wait for the api-server to finish populating the token; retrying the
        // whole query would restart the cache entry, so the wait lives here.
        const complete = items.every((item) => Boolean(item.data['token']));
        if (complete || Date.now() > deadline) return items;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    },
    /*
     * A token Secret can exist for a moment without its `token`/`ca.crt`: the
     * api-server fills them in asynchronously after creation, and a Secret bound to
     * the account a second ago may still be empty when this page reads it. The page
     * reads each Secret once, so an empty payload would leave the kubeconfig blank
     * until a reload — poll until every token looks like a JWT (or the wait runs out).
     */
    retry: (failureCount, error) => {
      if (failureCount >= 3) return false;
      return !(error instanceof ApiError) || error.retryable;
    },
    retryDelay: 500,
    enabled: params.names.length > 0,
  });
}

/** Project roles offered by the role picker (one fetch per project, cached). */
export function useProjectRoles(params: { cluster: string; namespace: string; enabled?: boolean }) {
  return useQuery({
    queryKey: ['project-roles', params.cluster, params.namespace],
    queryFn: ({ signal }) => serviceAccountsApi(api).roles({ cluster: params.cluster, namespace: params.namespace, signal }),
    // A project's roles change rarely within a session.
    staleTime: 5 * 60 * 1000,
    // `enabled` is a `useQuery` option; passing it through an options object of
    // its own silently left the query disabled and the picker with one entry.
    enabled: params.enabled ?? true,
  });
}

export function useDeleteServiceAccounts(params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (names: string[]) => serviceAccountsApi(api).remove({ ...params, names }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useCreateServiceAccount(params: { cluster: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ServiceAccountInput) =>
      serviceAccountsApi(api).create(toKubeServiceAccount(input), { cluster: params.cluster, namespace: input.namespace }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateServiceAccount(params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: KubeServiceAccount) => serviceAccountsApi(api).update({ ...params, body }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useSetServiceAccountRole(params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; role: string }) => serviceAccountsApi(api).setRole({ ...params, ...input }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

/** Refresh list, detail, and the Secret payloads a detail page renders. */
function invalidateAll(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['serviceaccounts'] }),
    queryClient.invalidateQueries({ queryKey: ['serviceaccount'] }),
    queryClient.invalidateQueries({ queryKey: ['serviceaccount-secrets'] }),
  ]).then(() => undefined);
}

/** Register this page in the agent manifest. Called once when the module loads. */
export const serviceAccountsPage: AiPage = {
  path: '/kube-frontend/$workspace/clusters/$cluster/projects/$namespace/serviceaccounts',
  title: '服务账户',
  description: '列出项目内的 ServiceAccount，可修改项目角色、查看/下载 kubeconfig、批量删除。',
  surfaceId: 'serviceaccounts:surface',
  states: {
    loading: '首次加载或切换分页后',
    ready: '已拿到至少一条数据',
    empty: '查询成功但没有匹配项',
    error: '请求失败，页面给出重试入口',
  },
  actions: [
    {
      id: 'serviceaccounts:search',
      description: '按名称搜索服务账户',
      inputs: { 'serviceaccounts:search': { type: 'text', description: '名称关键字' } },
      expect: { state: 'ready' },
    },
    {
      id: 'serviceaccounts:create',
      description: '创建新的服务账户',
      mutating: true,
      expect: { text: '服务账户' },
    },
    {
      id: 'serviceaccounts:row-select',
      description: '选中一行的复选框，用于批量操作',
      requires: [],
      expect: { state: 'ready' },
    },
    {
      id: 'serviceaccounts:bulk-delete',
      description: '删除所选服务账户',
      mutating: true,
      requires: ['serviceaccounts:row-select'],
      expect: { state: 'ready' },
    },
  ],
};

let registered = false;
export function ensureServiceAccountsRegistered(): void {
  if (registered) return;
  registered = true;
  registerPage(serviceAccountsPage);
}

export type { ServiceAccountSummary, SecretDetail };

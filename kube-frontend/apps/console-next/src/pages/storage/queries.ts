import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storageApi, type KubeObject, type ResourceListParams, type StorageKind } from '@kube-ai-hub/api-client';
import type { LocaleKey } from '@kube-ai-hub/locales';
import { api } from '@/api';

/**
 * Storage queries and descriptors.
 *
 * Same key discipline as the workloads: the kind is part of every key, because two
 * lists that differ only by resource must not share a cache entry.
 */

export function storageKey(kind: StorageKind, params: Omit<ResourceListParams, 'signal'>) {
  return [kind, params.cluster, params.namespace, params.page, params.pageSize, params.sortBy, params.order, params.keyword] as const;
}

export function useStorageList(kind: StorageKind, params: Omit<ResourceListParams, 'signal'>) {
  return useQuery({
    queryKey: storageKey(kind, params),
    queryFn: ({ signal }) => storageApi(api, kind).list({ ...params, signal }),
  });
}

export function useStorageOne(kind: StorageKind, params: { cluster: string; namespace: string; name: string }) {
  return useQuery({
    queryKey: ['storage-one', kind, params.cluster, params.namespace, params.name],
    queryFn: ({ signal }) => storageApi(api, kind).get({ ...params, signal }),
    // Empty name means "nothing is being edited"; do not fetch `/.../`.
    enabled: Boolean(params.name),
  });
}

export function useDeleteStorage(kind: StorageKind, params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (names: string[]) => storageApi(api, kind).remove({ ...params, names }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [kind] });
      void queryClient.invalidateQueries({ queryKey: ['storage-one', kind] });
    },
  });
}

export function useUpdateStorage(kind: StorageKind, params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: KubeObject) => storageApi(api, kind).update({ ...params, body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [kind] });
      void queryClient.invalidateQueries({ queryKey: ['storage-one', kind] });
    },
  });
}

/**
 * Storage classes, so the list knows which claims may be expanded.
 *
 * One cluster-wide read, cached for the session: a claim whose class has no
 * `allowVolumeExpansion` cannot be grown, and offering the control would produce a
 * rejected write that reads like a bug in the console.
 */
export function useExpandableClasses() {
  return useQuery({
    queryKey: ['storage-classes'],
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const body = await api.request<{ items?: Array<{ metadata?: { name?: string }; allowVolumeExpansion?: boolean }> }>(
        '/apis/storage.k8s.io/v1/storageclasses',
        { signal },
      );
      const out: Record<string, boolean> = {};
      for (const item of body?.items ?? []) {
        const name = item.metadata?.name;
        if (name) out[name] = item.allowVolumeExpansion === true;
      }
      return out;
    },
    retry: false,
  });
}

export function useExpandStorage(params: { cluster: string; namespace: string }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; storageClass: string; storage: string }) =>
      storageApi(api, 'persistentvolumeclaims').expand({
        cluster: params.cluster,
        namespace: params.namespace,
        name: input.name,
        storageClass: input.storageClass,
        storage: input.storage,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['persistentvolumeclaims'] });
      void queryClient.invalidateQueries({ queryKey: ['storage-one', 'persistentvolumeclaims'] });
    },
  });
}

export interface StorageDescriptor {
  titleKey: LocaleKey;
  descriptionKey: LocaleKey;
  emptyTitleKey: LocaleKey;
  emptyDescriptionKey: LocaleKey;
}

export const STORAGE_DESCRIPTORS: Record<StorageKind, StorageDescriptor> = {
  persistentvolumeclaims: {
    titleKey: 'storage.volumes.title',
    descriptionKey: 'storage.volumes.description',
    emptyTitleKey: 'storage.volumes.emptyTitle',
    emptyDescriptionKey: 'storage.volumes.emptyDescription',
  },
  volumesnapshots: {
    titleKey: 'storage.snapshots.title',
    descriptionKey: 'storage.snapshots.description',
    emptyTitleKey: 'storage.snapshots.emptyTitle',
    emptyDescriptionKey: 'storage.snapshots.emptyDescription',
  },
};

/**
 * Pods in a project, used to work out which claims are mounted.
 *
 * PERFORMANCE: this is the slowest call the storage pages make — the upstream API
 * takes ~11s for 35 pods and ~58s for 81 in this cluster, scaling with object count
 * rather than payload size. It is fetched once per project (cached for 60s) and the
 * mount column reads `计算中` until it lands, so the list itself is never blocked on it.
 * Optimising this (a cheaper source or a cached sweep) is a follow-up.
 */
export function useProjectPods(namespace: string) {
  return useQuery({
    queryKey: ['storage-pods', namespace],
    enabled: Boolean(namespace),
    staleTime: 60_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const body = await api.request<{ items?: Array<Record<string, unknown>> }>(
        `/api/v1/namespaces/${encodeURIComponent(namespace)}/pods`,
        { signal },
      );
      return body?.items ?? [];
    },
  });
}

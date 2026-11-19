import { useQuery } from '@tanstack/react-query';
import { platformConfigApi, type GpuKind } from '@kube-ai-hub/api-client';
import { api as apiClient } from '@/api';
import type { AcceleratorKind } from './acceleratorKinds';

/**
 * The accelerator kinds this installation knows about, from the platform itself.
 *
 * The list lives in the cluster's `ClusterConfiguration` (`gpu.kinds`) and is served at
 * `configs/gpu/kinds` — the same endpoint the old console's server read to build its
 * `supportGpuType` / `supportGpuTypeMetadata`. Reading it at runtime is what lets an
 * operator add a vendor to the installer and see correct names without a console
 * rebuild; a bundled copy would go stale silently.
 *
 * Cached for the session: which accelerators exist is an installation decision, not a
 * per-minute fact. While loading — and if the read fails — the list is empty, and the
 * node page falls back to printing each resource key as-is. That is the honest answer:
 * a name we cannot look up is not a name we should invent.
 */
export function useAcceleratorKinds(): { kinds: AcceleratorKind[]; loading: boolean } {
  const query = useQuery({
    queryKey: ['platform-gpu-kinds'],
    staleTime: 30 * 60_000,
    queryFn: ({ signal }) => platformConfigApi(apiClient).gpuKinds({ signal }),
    // A failed read is not worth an error banner on a node page: the page still has
    // every number, only the friendlier labels are missing.
    retry: false,
  });
  return { kinds: (query.data ?? []).map(toAcceleratorKind), loading: query.isPending };
}

/** `GpuKind` (API field names) → `AcceleratorKind` (this app's field names). */
function toAcceleratorKind(kind: GpuKind): AcceleratorKind {
  return {
    resourceName: kind.resourceName,
    displayName: kind.displayName,
    resourceType: kind.resourceType,
    isDefault: kind.isDefault,
    ...(kind.memoryUnit ? { memoryUnit: kind.memoryUnit } : {}),
    ...(kind.memoryName ? { memoryName: kind.memoryName } : {}),
    ...(kind.vcoresName ? { vcoresName: kind.vcoresName } : {}),
  };
}

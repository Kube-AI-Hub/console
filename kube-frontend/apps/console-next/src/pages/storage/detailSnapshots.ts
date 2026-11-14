import { useQuery } from '@tanstack/react-query';
import { api as apiClient } from '@/api';

/**
 * Snapshots of one persistent volume claim.
 *
 * The shared storage summary does not carry `spec.source`, so a claim's own
 * snapshots cannot be filtered from it; this reads the VolumeSnapshot objects of
 * the claim's project and keeps the ones whose source claim is this object. The
 * list has to stay readable when the snapshot CRD is installed but no object
 * exists (that is the B200 case): the page then renders an explicit empty state
 * rather than a spinner that never resolves.
 */
export interface ClaimSnapshot {
  name: string;
  namespace: string;
  /** `status.readyToUse` — the only field that says the snapshot can be restored. */
  ready: boolean;
  /** `status.restoreSize`, empty while the snapshot is not ready. */
  size: string;
  createdAt: string;
  raw: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

/** The claim a snapshot was taken from, from `spec.source.persistentVolumeClaimName`. */
export function snapshotSourceClaim(item: Record<string, unknown>): string {
  return text(asRecord(asRecord(item['spec'])['source'])['persistentVolumeClaimName']);
}

function toClaimSnapshot(item: Record<string, unknown>): ClaimSnapshot {
  const metadata = asRecord(item['metadata']);
  const status = asRecord(item['status']);
  return {
    name: text(metadata['name']),
    namespace: text(metadata['namespace']),
    ready: status['readyToUse'] === true,
    size: text(status['restoreSize']),
    createdAt: text(metadata['creationTimestamp']),
    raw: item,
  };
}

export function useClaimSnapshots(params: { cluster: string; namespace: string; claimName: string }) {
  return useQuery({
    queryKey: ['claim-snapshots', params.cluster, params.namespace, params.claimName],
    enabled: Boolean(params.claimName && params.namespace),
    queryFn: async ({ signal }) => {
      /*
       * Snapshots are namespaced and live in the claim's project. The cluster
       * segment goes before the namespace segment, the same shape resourceApi
       * builds for a member cluster; the host cluster has none.
       */
      const clusterSegment =
        params.cluster && params.cluster !== 'host' ? 'clusters/' + encodeURIComponent(params.cluster) + '/' : '';
      const path =
        '/kapis/resources.kubesphere.io/v1alpha3/' +
        clusterSegment +
        'namespaces/' +
        encodeURIComponent(params.namespace) +
        '/volumesnapshots';
      const body = await apiClient.request<{ items?: Array<Record<string, unknown>> }>(path, {
        query: { limit: -1 },
        ...(signal ? { signal } : {}),
      });
      return (body?.items ?? []).filter((item) => snapshotSourceClaim(item) === params.claimName).map(toClaimSnapshot);
    },
  });
}

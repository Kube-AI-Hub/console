import { useQuery } from '@tanstack/react-query';
import { platformConfigApi } from '@kube-ai-hub/api-client';
import { api as apiClient } from '@/api';

/**
 * Whether this installation runs as a federation of clusters.
 *
 * The old console reads `ksConfig.multicluster`, which its server injects into the page.
 * This app has no server-rendered config, so it asks the endpoint that config came from.
 * The flag decides two things: whether the cluster switcher appears, and whether
 * `/clusters` may redirect a single-cluster installation straight into its only cluster.
 *
 * Cached for the session: whether the platform is a federation is an installation
 * decision, not a per-minute fact. While it is loading the answer is treated as `true`,
 * which keeps the switcher visible rather than briefly hiding a control the reader used
 * a moment ago.
 */
export function useMulticluster(): { multicluster: boolean; loading: boolean } {
  const query = useQuery({
    queryKey: ['platform-configz'],
    staleTime: 30 * 60_000,
    queryFn: ({ signal }) => platformConfigApi(apiClient).configz({ signal }),
  });
  return { multicluster: query.data?.multicluster ?? true, loading: query.isPending };
}

import * as React from 'react';
import { useIsFetching, useQueryClient, type Query } from '@tanstack/react-query';

const LIVE = ['cluster-usage', 'kubernetes-status', 'node-ranking', 'overview-trends'];
const ALL = [...LIVE, 'cluster-detail', 'cluster-agent', 'components', 'node-ranking-info'];

/** One scheduler per overview; historical queries move their window through refreshAt. */
export function useOverviewRefresh(cluster: string) {
  const client = useQueryClient();
  const [auto, setAuto] = React.useState(true);
  const [visible, setVisible] = React.useState(() => document.visibilityState !== 'hidden');
  const [refreshAt, setRefreshAt] = React.useState(Date.now);
  const inFlight = React.useRef<symbol | null>(null);
  const owner = React.useRef(cluster);
  const belongs = React.useCallback((query: Query) => query.queryKey[1] === cluster && ALL.includes(String(query.queryKey[0])), [cluster]);
  const busy = useIsFetching({ predicate: belongs }) > 0;
  const refresh = React.useCallback(async (manual = true) => {
    if (inFlight.current || client.isFetching({ predicate: belongs }) > 0) return;
    const operation = Symbol('overview-refresh');
    inFlight.current = operation;
    setRefreshAt(Date.now());
    try {
      await Promise.all((manual ? ALL : LIVE).filter((key) => key !== 'overview-trends').map((key) =>
        client.refetchQueries({ queryKey: [key, cluster], type: 'active' })));
    } finally { if (inFlight.current === operation) inFlight.current = null; }
  }, [client, cluster, belongs]);
  React.useEffect(() => {
    if (owner.current === cluster) return;
    owner.current = cluster;
    inFlight.current = null;
    setRefreshAt(Date.now());
  }, [cluster]);
  React.useEffect(() => {
    const changed = () => {
      const next = document.visibilityState !== 'hidden';
      setVisible(next);
      if (next && auto) void refresh(false);
    };
    document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, [auto, refresh]);
  React.useEffect(() => {
    if (!auto || !visible) return;
    const timer = globalThis.setInterval(() => { void refresh(false); }, 30_000);
    return () => globalThis.clearInterval(timer);
  }, [auto, visible, refresh]);
  const queries = client.getQueryCache().findAll({ predicate: (query) => belongs(query) && query.isActive() && LIVE.includes(String(query.queryKey[0])) });
  const times = queries.map((query) => query.state.dataUpdatedAt).filter(Boolean);
  return {
    auto, setAuto, busy, refresh, refreshAt,
    lastRefresh: times.length ? Math.min(...times) : undefined,
    failed: queries.some((query) => query.state.status === 'error'),
  };
}

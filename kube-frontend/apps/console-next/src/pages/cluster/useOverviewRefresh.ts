import * as React from 'react';
import { useIsFetching, useQueryClient, type Query } from '@tanstack/react-query';

const LIVE = ['cluster-usage', 'kubernetes-status', 'node-ranking', 'overview-trends'];
const ALL = [...LIVE, 'cluster-detail', 'cluster-agent', 'components', 'node-ranking-info'];

/**
 * How long a member-cluster read may stay in flight before the page admits it is slow.
 *
 * A cluster reached through the tower agent crosses the public internet twice; measured
 * on mlu370 → A100 (2026-11-18) a single cluster-scoped metric read ranged from 0.1s to
 * 31s on the same endpoint. Below this threshold the normal skeleton is the right answer
 * (a spinner that always shows a warning is noise); above it the reader is looking at a
 * page that has not changed for long enough to think it is broken.
 */
export const SLOW_READ_MS = 8_000;

/** One scheduler per overview; historical queries move their window through refreshAt. */
export function useOverviewRefresh(cluster: string) {
  const client = useQueryClient();
  const [auto, setAuto] = React.useState(true);
  const [visible, setVisible] = React.useState(() => document.visibilityState !== 'hidden');
  const [refreshAt, setRefreshAt] = React.useState(Date.now);
  const [slow, setSlow] = React.useState(false);
  const inFlight = React.useRef<symbol | null>(null);
  const owner = React.useRef(cluster);
  const belongs = React.useCallback((query: Query) => query.queryKey[1] === cluster && ALL.includes(String(query.queryKey[0])), [cluster]);
  const busy = useIsFetching({ predicate: belongs }) > 0;
  /*
   * `busy` flips as soon as a query starts, so the timer is driven by it rather than by
   * each panel: one flag for the page, cleared the moment nothing is in flight. A read
   * that finishes at 7s must not leave the warning on screen.
   */
  React.useEffect(() => {
    if (!busy) { setSlow(false); return; }
    const timer = globalThis.setTimeout(() => setSlow(true), SLOW_READ_MS);
    return () => globalThis.clearTimeout(timer);
  }, [busy]);
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
    auto, setAuto, busy, refresh, refreshAt, slow,
    lastRefresh: times.length ? Math.min(...times) : undefined,
    failed: queries.some((query) => query.state.status === 'error'),
  };
}

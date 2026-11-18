import * as React from 'react';
import { NodeRankingPanel } from './NodeRankingPanel';
import type { MonitorTabState } from './monitorTabs';

/**
 * 资源用量排行 -- the old console's fifth 集群状态 page.
 *
 * It is the node-usage list, given its own tab so the monitor page keeps the old
 * console's information architecture. The panel is the same component the node-usage
 * page uses; `aiIdPrefix` renames its handles into this surface's namespace so tests
 * and agents can tell the two mounts apart. The export button lives in the panel, so
 * both mounts get it.
 */
export function ClusterRankingTab({
  cluster,
  live,
  onStateChange,
}: {
  cluster: string;
  /** The header's 自动刷新 switch; the ranking is a current-value read, so it polls. */
  live?: boolean;
  onStateChange?: (state: MonitorTabState) => void;
}): React.ReactElement {
  return (
    <section className="min-w-0" data-ai-id="cluster-monitor:ranking">
      <NodeRankingPanel
        cluster={cluster}
        aiIdPrefix="cluster-monitor:ranking:"
        {...(live ? { live } : {})}
        {...(onStateChange ? { onStateChange } : {})}
      />
    </section>
  );
}

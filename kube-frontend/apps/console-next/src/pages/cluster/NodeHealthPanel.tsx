import * as React from 'react';
import type { NodeDetail } from '@kube-ai-hub/api-client';
import { Badge } from '@kube-ai-hub/ui';
import { useT } from '@/i18n';
import { formatTimestamp } from '@/lib/time';
import { conditionTone } from './nodeDetailModel';
import { timeOffsets, useNodesTime } from './nodeListQueries';

export function NodeHealthPanel({ node, cluster }: { node: NodeDetail; cluster: string }): React.ReactElement {
  const t = useT();
  const time = useNodesTime(cluster);
  const clock = timeOffsets(time.data ?? {})[node.name];
  const clockSeconds = time.data?.[node.name]?.node_time_seconds;
  const clockDate = clockSeconds === undefined ? undefined : new Date(clockSeconds * 1000);
  const clockText = clockDate && Number.isFinite(clockDate.getTime()) ? formatTimestamp(clockDate.toISOString()) : '-';
  const keys: Record<string, string> = {
    Ready: 'node.condition.ready', MemoryPressure: 'node.condition.memory',
    DiskPressure: 'node.condition.disk', PIDPressure: 'node.condition.pid', NetworkUnavailable: 'node.condition.network',
  };
  return <section className="rounded-ai-lg border border-ai-line bg-ai-surface-1 p-4" data-ai-id="node-detail:conditions">
    <h2 className="mb-3 text-sm font-semibold">{t('node.detail.conditions')}</h2>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {node.conditions.map((condition) => {
        const tone = conditionTone(condition);
        return <div key={condition.type} className="rounded-ai-md border border-ai-line p-3"
          data-ai-id={`node-detail:condition:${condition.type}`} data-ai-tone={tone}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">{keys[condition.type] ? t(keys[condition.type] as never) : condition.type}</span>
            <Badge tone={tone}>{tone === 'neutral' ? condition.status || t('node.list.unknown') : t(tone === 'success' ? 'node.health.normal' : 'node.health.abnormal')}</Badge>
          </div>
          <p className="mt-2 truncate text-[11px] text-ai-fg-secondary" title={condition.message}>{condition.reason || condition.status}</p>
          <p className="mt-1 text-[10px] text-ai-fg-muted" title={`${condition.message}\n${t('node.health.heartbeat')}: ${formatTimestamp(condition.lastHeartbeatTime)}`}>
            {formatTimestamp(condition.lastTransitionTime)}
          </p>
        </div>;
      })}
      <div className="rounded-ai-md border border-ai-line p-3" data-ai-id="node-detail:ntp">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium">{t('node.list.ntp')}</span>
          <Badge tone={clock?.synced === true ? 'success' : clock?.synced === false ? 'warning' : 'neutral'}>
            {t(clock?.synced === true ? 'node.list.synced' : clock?.synced === false ? 'node.list.notSynced' : 'node.list.unknown')}
          </Badge>
        </div>
        <p className={`mt-2 text-xs tabular-nums ${Math.abs(clock?.offset ?? 0) >= 120 ? 'text-ai-danger' : Math.abs(clock?.offset ?? 0) >= 30 ? 'text-ai-warning' : 'text-ai-fg-secondary'}`}>
          {clock?.offset === undefined ? '-' : `${clock.offset > 0 ? '+' : ''}${clock.offset}s`}
        </p>
        <p className="mt-1 text-[10px] text-ai-fg-secondary">{clockText}</p>
      </div>
    </div>
    {clock?.offset !== undefined && Math.abs(clock.offset) >= 120 ?
      <p role="alert" className="mt-3 text-xs text-ai-danger">{t('node.list.timeWarning')}</p> : null}
    {time.isError ? <p className="mt-2 text-xs text-ai-warning">{t('node.list.metricsUnavailable')}</p> : null}
  </section>;
}

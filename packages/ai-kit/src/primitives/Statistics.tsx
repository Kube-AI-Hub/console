import * as React from 'react';
import { cn } from '../utils/cn';
import { Skeleton } from './Display';

export interface StatisticItem {
  key: string;
  label: React.ReactNode;
  value: React.ReactNode;
  description?: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  state?: 'ready' | 'loading' | 'error' | 'unknown';
}

export interface StatisticsGroupProps extends React.HTMLAttributes<HTMLDListElement> {
  items: StatisticItem[];
  unknownLabel: string;
}

/** Display-only summary: quantities and aggregation belong to the host. */
export function StatisticsGroup({ items, unknownLabel, className, ...attributes }: StatisticsGroupProps): React.ReactElement {
  return <dl className={cn('flex flex-wrap gap-x-8 gap-y-3 rounded-ai-lg border border-ai-line bg-ai-surface-1 px-4 py-3', className)} {...attributes}>
    {items.map((item) => <div key={item.key} className="min-w-24">
      <dt className="text-xs text-ai-fg-muted">{item.label}</dt>
      <dd className={cn('mt-1 text-lg font-semibold tabular-nums',
        item.tone === 'success' ? 'text-ai-success' : item.tone === 'warning' ? 'text-ai-warning' : item.tone === 'danger' ? 'text-ai-danger' : 'text-ai-fg')}
        data-stat-key={item.key} data-ai-state={item.state ?? 'ready'}>
        {item.state === 'loading' ? <Skeleton className="h-6 w-12" /> :
          item.state === 'unknown' || item.state === 'error' ? <span title={unknownLabel}>-</span> : item.value}
      </dd>
      {item.description ? <span className="text-[11px] text-ai-fg-muted">{item.description}</span> : null}
    </div>)}
  </dl>;
}

export interface MetricCellProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: React.ReactNode;
  detail?: React.ReactNode;
  allocation?: React.ReactNode;
  tone?: 'neutral' | 'warning' | 'danger';
}

/** Dense metric presentation shared by list hosts; no unit or percentage guessing. */
export function MetricCell({ value, detail, allocation, tone = 'neutral', className, ...attributes }: MetricCellProps): React.ReactElement {
  return <span className={cn('flex min-w-0 flex-col gap-0.5 tabular-nums', className)} {...attributes}>
    <span className={cn('text-xs font-medium', tone === 'danger' ? 'text-ai-danger' : tone === 'warning' ? 'text-ai-warning' : 'text-ai-fg')}>{value}</span>
    {detail != null ? <span className="whitespace-nowrap text-[11px] text-ai-fg-secondary">{detail}</span> : null}
    {allocation != null ? <span className="whitespace-nowrap text-[11px] text-ai-fg-muted">{allocation}</span> : null}
  </span>;
}

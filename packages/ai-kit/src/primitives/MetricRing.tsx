import * as React from 'react';
import { cn } from '../utils/cn';
import { resolveProgressTone, type ProgressTone } from './Display';

export interface MetricRingProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number | undefined;
  tone?: ProgressTone;
  children?: React.ReactNode;
}

/** A percentage ring; the host owns the metric, units and accompanying text. */
export function MetricRing({ value, tone = 'auto', children, className, ...attributes }: MetricRingProps): React.ReactElement {
  const known = value !== undefined && Number.isFinite(value) && value >= 0;
  const clamped = known ? Math.min(100, value) : 0;
  const resolved = tone === 'auto' ? resolveProgressTone(clamped) : tone;
  const color = { accent: 'text-ai-accent', success: 'text-ai-success', warning: 'text-ai-warning', danger: 'text-ai-danger' }[resolved];
  return <div {...attributes} className={cn('ai-metric-ring relative size-16 shrink-0', className)}
    data-ai-state={known ? 'ready' : 'unknown'} role={known ? 'progressbar' : 'img'}
    {...(known ? { 'aria-valuemin': 0, 'aria-valuemax': Math.max(100, value), 'aria-valuenow': value } : {})}>
    <svg viewBox="0 0 96 96" className="size-full -rotate-90" aria-hidden>
      <circle cx="48" cy="48" r="38" fill="none" stroke="currentColor" strokeWidth="7" className="text-ai-line" />
      {known ? <circle cx="48" cy="48" r="38" fill="none" stroke="currentColor" strokeWidth="7"
        data-ai-ring-value strokeLinecap="round" pathLength="100" strokeDasharray="100"
        strokeDashoffset={100 - clamped} className={cn('transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none', color)} /> : null}
    </svg>
    <span className={cn('absolute inset-0 grid place-items-center', known ? color : 'text-ai-fg-muted')} aria-hidden>{children}</span>
  </div>;
}

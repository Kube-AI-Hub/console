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
  /**
   * A glyph drawn beside the value.
   *
   * Optional and additive: a host that has nothing to show (a plain count) omits it
   * and the tile renders exactly as before. It exists so a summary can distinguish
   * *kinds* of thing — one accelerator vendor from another — where a bare number
   * cannot.
   */
  icon?: React.ReactNode;
  /** Draws the value larger, for the tile a reader should look at first. */
  emphasis?: boolean;
  /**
   * Turn the tile into a control.
   *
   * Omitted — which is the default and what every existing caller does — the tile is
   * a plain readout: a `<div>` with `dt`/`dd` inside the group's `<dl>`, no pointer
   * cursor, no hover. Given, the tile becomes a `<button>` and picks up the same
   * lift/spotlight/press treatment a clickable card has, because a tile that looks
   * inert but responds to a click is worse than one that does not respond at all.
   */
  onSelect?: () => void;
  /** Whether this tile's filter is currently applied. Only meaningful with `onSelect`. */
  selected?: boolean;
  /** Accessible name and tooltip for the action, e.g. "filter by this". */
  selectHint?: string;
}

export interface StatisticsGroupProps extends React.HTMLAttributes<HTMLDListElement> {
  items: StatisticItem[];
  unknownLabel: string;
}

/**
 * Display-only summary: quantities and aggregation belong to the host.
 *
 * A tile with `onSelect` is a real `<button>` — keyboard reachable, `aria-pressed`
 * carrying the applied state — but its text is `span`s rather than `dt`/`dd`,
 * because a `<button>` may only contain phrasing content. The accessible name is
 * built from the label and the value so a screen reader still hears
 * "control-plane nodes: 1" instead of an unlabelled button.
 */
export function StatisticsGroup({ items, unknownLabel, className, ...attributes }: StatisticsGroupProps): React.ReactElement {
  return <dl className={cn('flex flex-wrap gap-x-8 gap-y-3 rounded-ai-lg border border-ai-line bg-ai-surface-1 px-4 py-3', className)} {...attributes}>
    {items.map((item) => <StatisticTile key={item.key} item={item} unknownLabel={unknownLabel} />)}
  </dl>;
}

function StatisticTile({ item, unknownLabel }: { item: StatisticItem; unknownLabel: string }): React.ReactElement {
  /*
   * A local ref rather than the hook's own.
   *
   * `useSpotlight` types its ref as `RefObject<T | null>`, which this package's
   * React 18 typings will not accept on a JSX `ref` (they want `RefObject<T>`).
   * The hook's only need is "give me the element on pointer move", so the node is
   * held here and handed over by the handler instead of through its ref.
   */
  const node = React.useRef<HTMLDivElement>(null);
  const interactive = item.onSelect !== undefined;
  const onPointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const element = node.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    element.style.setProperty('--ai-mx', `${event.clientX - rect.left}px`);
    element.style.setProperty('--ai-my', `${event.clientY - rect.top}px`);
  }, []);
  const body = (
    <>
      {/*
        * The leading slot holds either a glyph or a chart.
        *
        * Both are drawn at the same height so a row of tiles keeps one baseline:
        * a 40px vendor mark next to a 40px health ring reads as two facts of equal
        * weight, which is the point of a summary band.
        */}
      {item.icon ? <span className="grid size-10 shrink-0 place-items-center text-ai-fg-secondary">{item.icon}</span> : null}
      <TileText item={item} unknownLabel={unknownLabel} as={interactive ? 'span' : 'dl'} />
    </>
  );

  if (!interactive) {
    return <div className="flex min-w-24 items-center gap-3" data-stat-key={item.key}>{body}</div>;
  }

  /*
   * `aria-label` rather than relying on the text: with the `dt`/`dd` replaced by
   * `span`s the name is still readable, but the value can be a skeleton or a dash
   * and the label is what the reader is choosing between. Spelling both out keeps
   * the control meaningful in every state.
   */
  const value = item.state === 'loading' ? '' : item.state === 'unknown' || item.state === 'error' ? unknownLabel : plainText(item.value);
  const label = plainText(item.label);
  /*
   * The ref sits on a wrapper, not on the button.
   *
   * `useSpotlight` owns its own `RefObject<T | null>`, and React 19 will not hand
   * that to a `<button>` whose ref wants `T`. A wrapper is also what the resource
   * cards on the overview do (`<div ref={spotlight.ref}><Card …/></div>`), so the
   * two clickable surfaces end up with the same shape.
   */
  return (
    <div ref={node} onPointerMove={onPointerMove} className="min-w-0">
      <button
        type="button"
        onClick={item.onSelect}
        aria-pressed={item.selected ?? false}
        aria-label={value ? `${label}: ${value}` : label}
        {...(item.selectHint ? { title: item.selectHint } : {})}
        className={cn(
          // A clickable tile wears the same motion vocabulary as a clickable card.
          'ai-lift ai-spotlight ai-pressable flex min-w-24 cursor-pointer items-center gap-3 rounded-ai-md border px-2 py-1 text-left',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring',
          item.selected ? 'border-ai-accent bg-ai-accent/5' : 'border-transparent hover:bg-ai-surface-2',
        )}
        data-stat-key={item.key}
        data-ai-state={item.state ?? 'ready'}
      >
        {body}
      </button>
    </div>
  );
}

/** The label/value pair, as `dt`/`dd` in a readout or `span`s inside a button. */
function TileText({ item, unknownLabel, as }: {
  item: StatisticItem; unknownLabel: string; as: 'dl' | 'span';
}): React.ReactElement {
  const Tag = as === 'dl' ? 'div' : 'span';
  const Label = as === 'dl' ? 'dt' : 'span';
  const Value = as === 'dl' ? 'dd' : 'span';
  const valueClass = cn('mt-1 tabular-nums', item.emphasis ? 'text-2xl font-semibold' : 'text-lg font-semibold',
    item.tone === 'success' ? 'text-ai-success' : item.tone === 'warning' ? 'text-ai-warning' : item.tone === 'danger' ? 'text-ai-danger' : 'text-ai-fg');
  return <Tag className="min-w-0">
    {/*
      * The readout branch keeps the exact markup it had before this component could
      * be clicked — no extra classes — so the other two call sites are untouched.
      * The button branch needs `block` because a `<span>` is inline.
      */}
    <Label className={as === 'dl' ? 'text-xs text-ai-fg-muted' : 'block text-xs text-ai-fg-muted'}>{item.label}</Label>
    <Value className={cn(as === 'dl' ? '' : 'block', valueClass)}
      {...(as === 'dl' ? { 'data-stat-key': item.key, 'data-ai-state': item.state ?? 'ready' } : {})}>
      {item.state === 'loading' ? <Skeleton className="h-6 w-12" /> :
        item.state === 'unknown' || item.state === 'error' ? <span title={unknownLabel}>-</span> : item.value}
    </Value>
    {item.description ? <span className={as === 'dl' ? 'text-[11px] text-ai-fg-muted' : 'block text-[11px] text-ai-fg-muted'}>{item.description}</span> : null}
  </Tag>;
}

/**
 * The readable text of a node, for the accessible name.
 *
 * `label` and `value` are `ReactNode`s because callers pass badges and formatted
 * numbers; a name has to be a string. React nodes are not walked in general — the
 * cases this component actually receives are strings and numbers, and anything else
 * contributes nothing rather than `[object Object]`.
 */
function plainText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(plainText).join('');
  return '';
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

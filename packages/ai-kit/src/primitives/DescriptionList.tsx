import * as React from 'react';
import { cn } from '../utils/cn';

/**
 * One label/value pair in a read-only definition list.
 *
 * The pair renders as a fragment of exactly `<dt>` and `<dd>`, with no wrapper
 * element: detail pages put these straight inside their own `<dl class="grid …">`
 * (a two-column grid, a single column, full-width fields). A wrapper would force
 * every caller into the same layout and break the `<dl>`/dt/dd semantics.
 */
export interface DescriptionItem {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Small muted line under the value. */
  hint?: React.ReactNode;
  /** data-ai-id placed on the value (matches the old DefinitionRow's aiId). */
  aiId?: string;
}

export interface DescriptionItemProps extends DescriptionItem {}

/**
 * A single `<dt>`/`<dd>` pair.
 *
 * The value colour and wrapping rule used to drift between detail pages (some
 * printed it in the primary colour, others in the secondary one); one
 * implementation keeps the same kind of fact looking the same everywhere.
 */
export function DescriptionItem({ label, value, hint, aiId }: DescriptionItemProps): React.ReactElement {
  // Empty means "there is no value for this field", not "the value is falsy":
  // 0 and false are real values and must stay visible.
  const empty = value === null || value === undefined || value === '';
  return (
    <>
      <dt className="text-ai-fg-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ai-fg-secondary">
        {
          /*
           * The handle sits on the value itself, not on the `<dd>`.
           *
           * Automation reads a field by its handle and asserts on its text; with the
           * handle on the `<dd>`, a row that also has a `hint` would return
           * "value + hint" and every exact-text assertion on that field would break.
           * The hint is explanatory text around the value, not part of it.
           */
        }
        <span className="block" data-ai-id={aiId}>{empty ? '-' : value}</span>
        {hint ? <span className="mt-0.5 block text-[11px] text-ai-fg-muted">{hint}</span> : null}
      </dd>
    </>
  );
}

export interface DescriptionListProps {
  items: DescriptionItem[];
  className?: string;
}

/**
 * Definition list for the facts about one object.
 *
 * The default layout is a label column sized to its content and a value column
 * that takes the rest of the width, stacking to one column on phones.
 */
export function DescriptionList({ items, className }: DescriptionListProps): React.ReactElement {
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-3 text-xs sm:grid-cols-[minmax(6rem,auto)_1fr]',
        className,
      )}
    >
      {items.map((item, index) => (
        <DescriptionItem key={index} {...item} />
      ))}
    </dl>
  );
}

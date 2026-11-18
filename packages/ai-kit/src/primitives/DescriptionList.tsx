import * as React from 'react';
import { cn } from '../utils/cn';
import { Tooltip } from './Feedback';
import { Icon } from './Icon/Icon';

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
  /**
   * Explanation of what the field means, shown from an info control beside the label.
   *
   * Different from `hint`, which annotates the value ("2 of 3 ready"). This one
   * explains the field itself — where the value comes from, what format it follows —
   * and belongs on the label because that is what a reader questions.
   */
  labelHint?: React.ReactNode;
  /** Accessible name for the label's info control when `labelHint` is not a string. */
  labelHintLabel?: string;
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
export function DescriptionItem({ label, value, hint, labelHint, labelHintLabel, aiId }: DescriptionItemProps): React.ReactElement {
  // Empty means "there is no value for this field", not "the value is falsy":
  // 0 and false are real values and must stay visible.
  const empty = value === null || value === undefined || value === '';
  return (
    <>
      <dt className="text-ai-fg-muted">
        {labelHint ? (
          <span className="inline-flex items-center gap-1">
            {label}
            <Tooltip content={labelHint}>
              {/*
               * A real control, not a `title` attribute: the explanation has to be
               * reachable by keyboard and by touch, and a header that only reveals
               * itself on hover is not an explanation for anyone using either.
               */}
              <button
                type="button"
                aria-label={labelHintLabel ?? (typeof labelHint === 'string' ? labelHint : undefined)}
                /*
                 * `cursor-pointer` is not inherited from the `<button>`: the browser's
                 * default is `default`, so the hint looked like part of the label until
                 * the pointer was already on it. Same size as the table header's hint so
                 * the two surfaces agree.
                 */
                className="grid size-4 shrink-0 cursor-pointer place-items-center rounded-full text-ai-fg-muted transition-colors duration-ai-fast hover:text-ai-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring"
              >
                <Icon name="information" size={12} />
              </button>
            </Tooltip>
          </span>
        ) : label}
      </dt>
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
  /**
   * Density and emphasis.
   *
   * `default` keeps the label above its value at the same size, which suits a
   * detail page where each fact is read on its own. `dense` turns the list into a
   * specification table: the label is the row's anchor at 14px medium, and the
   * value is the detail at 12px. The reader scans the left column to find the
   * field, then reads right for its value.
   */
  variant?: 'default' | 'dense';
  /**
   * Draw a hairline between rows.
   *
   * Only meaningful with `dense`: it turns the list into a specification table
   * (label left, value right) whose rows stay aligned across a whole panel
   * without adding vertical gaps. The rule is drawn on the row's own top edge
   * from the second pair onwards, so the first row does not double the panel
   * header's border.
   */
  divided?: boolean;
}

/**
 * Definition list for the facts about one object.
 *
 * The default layout is a label column sized to its content and a value column
 * that takes the rest of the width, stacking to one column on phones.
 */
export function DescriptionList({ items, className, variant = 'default', divided = false }: DescriptionListProps): React.ReactElement {
  const dense = variant === 'dense';
  return (
    <dl
      className={cn(
        'grid grid-cols-1 text-xs',
        /*
         * `dense` restyles the bare `dt`/`dd` fragments through the parent, which is
         * why `DescriptionItem` needs no variant prop of its own: the pair carries no
         * wrapper, so one class on the `<dl>` reaches every row and the 24 existing
         * call sites keep their current appearance.
         *
         * The label is the larger half: 14px medium in the primary colour, with the
         * value at 12px in the secondary one. A specification table is read by finding
         * the field first — "供应者" is what the reader is scanning for, and the provider
         * name is the answer they then glance at. Making the value the bigger of the two
         * reversed that: it drew the eye to a fact the reader had not asked about yet.
         * Tracking is normal, not wide: the label is already the louder half and wide
         * tracking would turn a two-column table into letterspaced small caps.
         */
        dense
          ? 'text-xs [&>dd]:text-ai-fg-secondary [&>dt]:text-sm [&>dt]:font-medium [&>dt]:text-ai-fg'
          : 'gap-3 sm:grid-cols-[minmax(6rem,auto)_1fr]',
        dense && (divided
          ? [
              'gap-y-0',
              // One rule per field. Below `sm` the pair stacks, so the rule sits on the
              // label of every field after the first; from `sm` the value cell carries it
              // too, which joins the two columns into one continuous line.
              '[&>dt:nth-child(n+3)]:border-t [&>dt:nth-child(n+3)]:border-ai-line',
              'sm:[&>dd:nth-child(n+4)]:border-t sm:[&>dd:nth-child(n+4)]:border-ai-line',
            ].join(' ')
          : 'gap-y-2'),
        /*
         * Two columns from `sm`, stacked only on a phone.
         *
         * The label column is capped rather than proportional: at 1024 the identity column
         * of the cluster overview is ~256px wide, and a 120px label still leaves ~104px for
         * the value. The longest label here ("Kube AI Hub 版本") needs ~108px at 14px
         * medium, so the cap keeps it on one line while a long value wraps instead —
         * wrapping a value is readable, wrapping a label beside a one-line value is not.
         *
         * `items-start`, not `items-baseline`. The rule between fields is drawn on both
         * cells, and baseline alignment starts them at different heights (measured: the
         * label's border sat 2.5px below the value's), which breaks one rule into two
         * offset segments. Grid rows start both cells at the same y, so the two halves meet.
         * It also matches a specification table: the label stays at the top when the value
         * wraps onto a second line.
         */
        dense && 'sm:grid-cols-[minmax(5.5rem,7.5rem)_1fr] sm:items-start sm:gap-x-4',
        // Row padding: one line of value plus breathing room. Below `sm` the pair is stacked,
        // so the label takes the top padding and the value the bottom one; doubling both
        // would turn each field into two full rows.
        dense && divided && 'sm:[&>dd]:py-2.5 sm:[&>dt]:py-2.5',
        dense && divided && 'max-sm:[&>dd]:pb-2.5 max-sm:[&>dd]:pt-0.5 max-sm:[&>dt]:pb-0 max-sm:[&>dt]:pt-2.5',
        className,
      )}
    >
      {items.map((item, index) => (
        <DescriptionItem key={index} {...item} />
      ))}
    </dl>
  );
}

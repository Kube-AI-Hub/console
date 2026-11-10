import * as React from 'react';
import { cn } from '../utils/cn';

export interface InputNumberProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'type'> {
  value?: number | null;
  defaultValue?: number;
  onChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Numeric input with stepper buttons.
 *
 * `type="number"` is deliberately avoided for the visible field: browsers
 * attach their own spinners and scroll-wheel behaviour, which fights the
 * design. The value is still parsed numerically and clamped to min/max.
 */
export const InputNumber = React.forwardRef<HTMLInputElement, InputNumberProps>(function InputNumber(
  { value, defaultValue, onChange, min, max, step = 1, className, disabled, ...props },
  ref,
) {
  const [internal, setInternal] = React.useState<number | null>(defaultValue ?? null);
  const current = value !== undefined ? value : internal;

  const commit = (next: number | null) => {
    let normalized = next;
    if (normalized !== null) {
      if (typeof min === 'number') normalized = Math.max(min, normalized);
      if (typeof max === 'number') normalized = Math.min(max, normalized);
    }
    if (value === undefined) setInternal(normalized);
    onChange?.(normalized);
  };

  const stepBy = (delta: number) => {
    if (disabled) return;
    commit((current ?? 0) + delta);
  };

  return (
    <div
      className={cn(
        'flex h-9 items-stretch overflow-hidden rounded-ai-md border border-ai-line bg-ai-surface-1',
        'transition-colors duration-ai-fast hover:border-ai-line-strong',
        'focus-within:border-ai-accent focus-within:ring-2 focus-within:ring-ai-accent/25',
        disabled && 'opacity-50',
        className,
      )}
    >
      <input
        ref={ref}
        data-ai-field-input=""
        inputMode="decimal"
        value={current ?? ''}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value.trim();
          if (raw === '') {
            commit(null);
            return;
          }
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) commit(parsed);
        }}
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-ai-fg outline-none focus-visible:outline-none"
        {...props}
      />
      <div className="flex flex-col border-l border-ai-line">
        <Stepper label="增加" onClick={() => stepBy(step)} disabled={disabled} direction="up" />
        <Stepper label="减少" onClick={() => stepBy(-step)} disabled={disabled} direction="down" />
      </div>
    </div>
  );
});

function Stepper({
  label,
  onClick,
  disabled,
  direction,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  direction: 'up' | 'down';
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      tabIndex={-1}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid h-1/2 w-6 place-items-center text-ai-fg-muted',
        'transition-colors duration-ai-fast hover:bg-ai-surface-2 hover:text-ai-fg',
        'disabled:cursor-not-allowed',
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-2.5">
        <path d={direction === 'up' ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
      </svg>
    </button>
  );
}

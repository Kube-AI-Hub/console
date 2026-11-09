import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '../utils/cn';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ai-bg';

export interface CheckboxProps
  extends Omit<React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>, 'onCheckedChange'> {
  onCheckedChange?: (checked: boolean) => void;
  /**
   * Third state for a parent checkbox whose children are partially selected.
   *
   * Radix accepts the flag but ships no visual for it, so the component draws a
   * dash itself; without it the box would look checked while the subtree is not.
   */
  indeterminate?: boolean;
}

export const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  function Checkbox({ className, onCheckedChange, indeterminate = false, checked, ...props }, ref) {
    return (
      <CheckboxPrimitive.Root
        ref={ref}
        // Pull `checked` out of the rest spread: leaving it in `props` let the
        // spread override this expression and the box never showed the third
        // state.
        checked={indeterminate ? 'indeterminate' : checked}
        onCheckedChange={(value) => onCheckedChange?.(value === true)}
        className={cn(
          'peer size-4 shrink-0 rounded-[4px] border border-ai-line-strong bg-ai-surface-1',
          'transition-colors duration-ai-fast hover:border-ai-accent',
          'data-[state=checked]:border-ai-accent data-[state=checked]:bg-ai-accent data-[state=checked]:text-ai-accent-fg',
          // Partial selection reads as "in progress": tinted fill, no checkmark.
          'data-[state=indeterminate]:border-ai-accent data-[state=indeterminate]:bg-ai-accent data-[state=indeterminate]:text-ai-accent-fg',
          'disabled:cursor-not-allowed disabled:opacity-50',
          focusRing,
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="grid place-items-center">
          {indeterminate ? <MinusIcon className="size-3" /> : <CheckIcon className="size-3" />}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );
  },
);

export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/* ---------------- CheckboxGroup ---------------- */

export interface CheckboxOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface CheckboxGroupProps {
  options: CheckboxOption[];
  value?: string[];
  defaultValue?: string[];
  onChange?: (values: string[]) => void;
  /**
   * Show a parent checkbox that selects or clears everything.
   *
   * It renders as `indeterminate` while only some children are selected, so the
   * parent never claims a state the subtree does not have.
   */
  withSelectAll?: boolean;
  /** Label for the parent checkbox; defaults to 全选. */
  selectAllLabel?: string;
  /** Lay the options out in a single column instead of wrapping. */
  direction?: 'horizontal' | 'vertical';
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}export interface RadioGroupProps extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> {
  /**
   * Options to render automatically. Omit it to supply `Radio` children
   * yourself, which is how card-style selections are laid out.
   */
  options?: RadioOption[];
  /**
   * `radio` renders the classic dot; `button` renders a segmented control where
   * the selected item is filled. Segmented controls are the right shape for two
   * to four mutually exclusive modes, which is how console uses them for
   * rollout strategy and time range.
   */
  variant?: 'radio' | 'button';
}

export function RadioGroup({
  options,
  variant = 'radio',
  className,
  children,
  ...props
}: RadioGroupProps): React.ReactElement {
  if (variant === 'button') {
    // The segmented variant needs options; children in this mode would lose the
    // shared border, so callers use `variant="radio"` for custom layouts.
    if (!options) return <>{children}</>;
    return (
      <RadioGroupPrimitive.Root
        className={cn(
          // Shared border with collapsed inner edges keeps the group reading as
          // one control instead of three adjacent buttons.
          'inline-flex overflow-hidden rounded-ai-md border border-ai-line bg-ai-surface-1',
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <RadioGroupPrimitive.Item
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={cn(
              'relative px-3 py-1.5 text-xs font-medium',
              'border-l border-ai-line first:border-l-0',
              'text-ai-fg-secondary transition-colors duration-ai-fast',
              'hover:bg-ai-surface-2 hover:text-ai-fg',
              'data-[state=checked]:bg-ai-accent data-[state=checked]:text-ai-accent-fg',
              'data-[state=checked]:hover:bg-ai-accent-hover',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'disabled:hover:bg-transparent disabled:hover:text-ai-fg-secondary',
              focusRing,
            )}
          >
            {option.label}
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
    );
  }

  return (
    <RadioGroupPrimitive.Root className={cn('flex flex-wrap gap-4', className)} {...props}>
      {options
        ? options.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm text-ai-fg-secondary">
              <RadioGroupPrimitive.Item
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  'size-4 shrink-0 rounded-full border border-ai-line-strong bg-ai-surface-1',
                  'transition-colors duration-ai-fast hover:border-ai-accent',
                  'data-[state=checked]:border-ai-accent',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  focusRing,
                )}
              >
                <RadioGroupPrimitive.Indicator className="grid place-items-center">
                  <span className="size-2 rounded-full bg-ai-accent" />
                </RadioGroupPrimitive.Indicator>
              </RadioGroupPrimitive.Item>
              {option.label}
            </label>
          ))
        : children}
    </RadioGroupPrimitive.Root>
  );
}

/**
 * A single radio.
 *
 * Only meaningful inside a `RadioGroup`, which owns the selection state — there
 * is no standalone checked radio. Kept as a named export because porting a page
 * that writes `<Radio value="a">` should not need rewriting.
 *
 * The styling lives here rather than only in `RadioGroup`'s auto-rendered path:
 * a raw `RadioGroupPrimitive.Item` has no intrinsic size, so a caller laying out
 * its own options got a zero-width dot that could not be seen or clicked.
 */
export const Radio = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(function Radio({ className, children, ...props }, ref) {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        'grid size-4 shrink-0 place-items-center rounded-full border border-ai-line-strong bg-ai-surface-1',
        'transition-colors duration-ai-fast hover:border-ai-accent',
        'data-[state=checked]:border-ai-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        focusRing,
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator>
        <span className="block size-2 rounded-full bg-ai-accent" />
      </RadioGroupPrimitive.Indicator>
      {children}
    </RadioGroupPrimitive.Item>
  );
});

/**
 * One option of a segmented control.
 *
 * `RadioGroup variant="button"` renders these automatically; the export exists
 * so a page can lay them out itself while keeping the shared border.
 */
export const RadioButton = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(function RadioButton({ className, ...props }, ref) {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        'relative px-3 py-1.5 text-xs font-medium',
        'border-l border-ai-line first:border-l-0',
        'text-ai-fg-secondary transition-colors duration-ai-fast',
        'hover:bg-ai-surface-2 hover:text-ai-fg',
        'data-[state=checked]:bg-ai-accent data-[state=checked]:text-ai-accent-fg',
        'data-[state=checked]:hover:bg-ai-accent-hover',
        'disabled:cursor-not-allowed disabled:opacity-50',
        focusRing,
        className,
      )}
      {...props}
    />
  );
});

export interface SwitchProps extends Omit<React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>, 'onCheckedChange'> {
  onCheckedChange?: (checked: boolean) => void;
  /**
   * Short label shown inside the track for each state.
   *
   * The track grows to fit the labels, so up to two CJK characters or three
   * latin ones stay legible. Longer text belongs beside the switch, not inside
   * it — the thumb needs room to travel.
   */
  onText?: React.ReactNode;
  offText?: React.ReactNode;
}

export const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, SwitchProps>(
  function Switch({ className, onCheckedChange, onText, offText, ...props }, ref) {
    const hasText = onText !== undefined || offText !== undefined;
    return (
      <SwitchPrimitive.Root
        ref={ref}
        onCheckedChange={onCheckedChange}
        className={cn(
          'peer group relative inline-flex h-5 shrink-0 cursor-pointer items-center rounded-ai-pill border-2 border-transparent',
          'transition-colors duration-ai-base',
          'data-[state=unchecked]:bg-ai-surface-3 data-[state=checked]:bg-ai-accent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          focusRing,
          // Plain switches keep the compact 36px form. With labels the track is
          // sized by its content: the label sits in normal flow and the thumb is
          // absolutely positioned, so nothing has to be measured in JS. The
          // horizontal padding reserves room for the thumb at either end, which
          // is what keeps the label from sliding underneath it.
          !hasText && 'w-9',
          hasText && 'px-5',
          className,
        )}
        {...props}
      >
        {hasText ? (
          /*
           * A single label slot that swaps text by state.
           *
           * Both previous attempts failed for the same reason: the thumb is
           * absolute and the label was absolute too, so they overlapped and the
           * travel distance had to be guessed. Here the label is the only thing
           * in flow — it defines the track width — and the thumb is pinned to
           * the opposite side with `left`/`right`, which needs no arithmetic.
           *
           * The slot keeps a minimum width so the track does not resize when the
           * text length changes between states.
           */
          <span
            aria-hidden="true"
            className={cn(
              'min-w-4 select-none text-[10px] font-medium leading-none',
              // Reserve the same slot in both states so the track does not
              // resize when the text changes length.
              'min-w-6',
              // The visible label sits on the side the thumb leaves free: to the
              // left of the track when off (thumb occupies the left), to the
              // right when on. Padding on the root already keeps it clear.
              'text-ai-fg-muted',
              'group-data-[state=checked]:text-ai-accent-fg',
            )}
          >
            <span className="block group-data-[state=checked]:hidden">{onText ?? '\u00a0'}</span>
            <span className="hidden group-data-[state=checked]:block">{offText ?? '\u00a0'}</span>
          </span>
        ) : null}
        <SwitchPrimitive.Thumb
          className={cn(
            // Vertical centring comes from `inset-y-0 my-auto`, not a top offset.
            // The root draws a 2px border with `border-box`, and an absolutely
            // positioned child measures from the padding box, so `top-0.5`
            // added the border a second time and left the thumb 2px low.
            'pointer-events-none absolute inset-y-0 z-10 my-auto block size-4 rounded-full bg-ai-bg-elevated shadow-sm',
            'transition-[left,right,transform] duration-ai-base ease-ai-out',
            /*
             * Anchor to opposite sides instead of translating.
             *
             * A pixel translate assumed the thumb could travel its own width, but
             * the content box is the track minus its borders, and with labels the
             * track width follows the text. In both cases the checked thumb ended
             * flush against the right border (rightGap 0 vs leftGap 4). Side
             * anchors give the two states the same inset regardless of width.
             */
            'left-0.5 group-data-[state=checked]:left-auto group-data-[state=checked]:right-0.5',
          )}
        />
      </SwitchPrimitive.Root>
    );
  },
);

export interface SliderProps extends Omit<React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>, 'value' | 'defaultValue' | 'onValueChange'> {
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  /**
   * Tick labels keyed by value, e.g. `{ 0: '0', 64: '64Gi' }`.
   *
   * Marks are positioned by percentage rather than by measuring the DOM, so
   * they stay aligned as the slider resizes.
   */
  marks?: Record<number, React.ReactNode>;
  /** Two thumbs for a `[from, to]` range; derives from the value length otherwise. */
  range?: boolean;
  /** Unit suffix shown next to the current value(s). */
  unit?: string;
  /** Show the current value(s) in a tooltip above the thumb(s). */
  hasTooltip?: boolean;
}

export const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  function Slider(
    {
      className,
      value,
      defaultValue,
      onValueChange,
      marks,
      range,
      unit,
      hasTooltip = false,
      min = 0,
      max = 100,
      ...props
    },
    ref,
  ) {
    const seed = value ?? defaultValue ?? [min];
    // An explicit `range` wins so a caller can start both thumbs at the same
    // value without the component collapsing back to one thumb.
    const thumbCount = range ? 2 : seed.length;
    const hasMarks = marks && Object.keys(marks).length > 0;

    return (
      <div className={cn('w-full', hasMarks && 'pb-5')}>
        <SliderPrimitive.Root
          ref={ref}
          value={value}
          defaultValue={defaultValue}
          onValueChange={onValueChange}
          min={min}
          max={max}
          className={cn('relative flex w-full touch-none select-none items-center py-2', className)}
          {...props}
        >
          <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-ai-pill bg-ai-surface-3">
            <SliderPrimitive.Range className="absolute h-full bg-ai-accent" />
          </SliderPrimitive.Track>
          {Array.from({ length: thumbCount }, (_, index) => (
            <SliderPrimitive.Thumb
              key={index}
              aria-label={`值 ${index + 1}`}
              className={cn(
                'group relative block size-4 rounded-full border-2 border-ai-accent bg-ai-bg-elevated',
                'transition-transform duration-ai-fast hover:scale-110',
                focusRing,
              )}
            >
              {hasTooltip ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap',
                    'rounded-ai-sm bg-ai-fg px-1.5 py-0.5 text-[10px] leading-4 text-ai-bg',
                    'opacity-0 transition-opacity duration-ai-fast group-hover:opacity-100 group-focus-visible:opacity-100',
                  )}
                >
                  {value?.[index] ?? defaultValue?.[index] ?? min}
                  {unit}
                </span>
              ) : null}
            </SliderPrimitive.Thumb>
          ))}
        </SliderPrimitive.Root>

        {hasMarks ? (
          <div className="relative mt-1 h-4" aria-hidden="true">
            {Object.entries(marks).map(([key, label]) => {
              const position = Math.max(0, Math.min(100, ((Number(key) - min) / (max - min)) * 100));
              // The first and last labels anchor to their own edge instead of
              // centring, otherwise half of "0 Gi" hangs outside the slider and
              // the row looks wider than the track it belongs to.
              const align = position === 0 ? 'translateX(0)' : position === 100 ? 'translateX(-100%)' : 'translateX(-50%)';
              return (
                <span
                  key={key}
                  className="absolute whitespace-nowrap text-[10px] leading-4 text-ai-fg-muted"
                  style={{ left: `${position}%`, transform: align }}
                >
                  {label}
                  {unit}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  },
);

function CheckIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true" className={className}>
      <path d="M5 12h14" />
    </svg>
  );
}

/**
 * A list of checkboxes with an optional select-all parent.
 *
 * Grouped selection is common enough in console (permissions, namespaces, GPU
 * types) that the three-way parent state was reimplemented on every page. The
 * group keeps the value as an array of keys so it maps directly onto API
 * payloads.
 */
export function CheckboxGroup({
  options,
  value: controlledValue,
  defaultValue = [],
  onChange,
  withSelectAll = false,
  selectAllLabel = '全选',
  direction = 'horizontal',
  disabled = false,
  className,
  ...aria
}: CheckboxGroupProps): React.ReactElement {
  const [internalValue, setInternalValue] = React.useState<string[]>(defaultValue);
  const value = controlledValue ?? internalValue;

  const commit = (next: string[]) => {
    if (controlledValue === undefined) setInternalValue(next);
    onChange?.(next);
  };

  const selectable = options.filter((option) => !option.disabled);
  const selectedCount = value.filter((item) => selectable.some((option) => option.value === item)).length;
  const allSelected = selectable.length > 0 && selectedCount === selectable.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const toggleOne = (option: CheckboxOption, checked: boolean) => {
    if (checked) commit([...new Set([...value, option.value])]);
    else commit(value.filter((item) => item !== option.value));
  };

  const toggleAll = (checked: boolean) => {
    const keys = selectable.map((option) => option.value);
    // Clearing the parent clears only the keys it owns, so a disabled or
    // externally supplied value is not silently dropped.
    commit(checked ? [...new Set([...value, ...keys])] : value.filter((item) => !keys.includes(item)));
  };

  return (
    <div
      role="group"
      aria-label={aria['aria-label']}
      className={cn('flex flex-col gap-2', className)}
    >
      {withSelectAll ? (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ai-fg-secondary">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            disabled={disabled || selectable.length === 0}
            onCheckedChange={(checked) => toggleAll(checked)}
            aria-label={selectAllLabel}
          />
          <span className="font-medium text-ai-fg">{selectAllLabel}</span>
        </label>
      ) : null}
      <div className={cn('flex gap-2', direction === 'vertical' ? 'flex-col' : 'flex-wrap gap-x-4')}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex items-center gap-2 text-sm',
              option.disabled || disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer text-ai-fg-secondary',
            )}
          >
            <Checkbox
              checked={value.includes(option.value)}
              disabled={disabled || option.disabled}
              onCheckedChange={(checked) => toggleOne(option, checked)}
              aria-label={typeof option.label === 'string' ? option.label : option.value}
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

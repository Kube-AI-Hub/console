import * as React from 'react';
import { cn } from '../utils/cn';
import { Button } from '../primitives/Button';
import { DatePicker } from '../primitives/DatePicker';
import { Popover } from '../primitives/Feedback';
import { Icon } from '../primitives/Icon/Icon';
import {
  RANGE_PRESET_KEYS,
  RANGE_PRESET_MS,
  formatRangeValue,
  parseRangeValue,
  presetRange,
  sameRange,
  stepForSpan,
  type RangePreset,
  type TimeRange,
} from './timeRange';

export interface TimeRangePickerLabels {
  /** Trigger label when nothing is selected yet. */
  placeholder: string;
  /** Heading of the preset column. */
  presets: string;
  /** Heading of the custom-range column. */
  custom: string;
  /** Placeholder of the range calendar. */
  rangePlaceholder: string;
  /** Heading of the sampling-step select. */
  step: string;
  /** Sentence explaining that the step follows the window. */
  stepHint: string;
  /** Sample-interval choices, keyed by the Prometheus duration. */
  stepOptions: ReadonlyArray<{ value: string; label: string }>;
  cancel: string;
  confirm: string;
  /** Error shown when the start is not before the end. */
  invalid: string;
}

export interface TimeRangePickerProps {
  value: TimeRange;
  onChange: (next: TimeRange) => void;
  /** Presets to offer; defaults to the standard set. */
  presets?: readonly RangePreset[];
  /**
   * Step the host is actually requesting. When supplied, the picker shows it and
   * the custom form can override it; omit it and the step is derived from the span.
   */
  step?: string;
  /** Called when the reader picks an explicit step (custom range only). */
  onStepChange?: (step: string) => void;
  labels: TimeRangePickerLabels;
  /** `HH:mm` / date-time pair for the trigger when a custom span is active. */
  formatAbsolute?: (start: number, end: number) => string;
  className?: string;
  aiId?: string;
}

/** The standard presets, labelled by the host. */
export function rangePresets(labelOf: (key: string) => string): RangePreset[] {
  return RANGE_PRESET_KEYS.map((key) => ({ key, ms: RANGE_PRESET_MS[key]!, label: labelOf(key) }));
}

/** `09:26 – 10:31` for a same-day span; a date-time pair otherwise. */
export function defaultFormatAbsolute(start: number, end: number): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const pad = (value: number): string => String(value).padStart(2, '0');
  const clock = (date: Date): string => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const sameDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();
  if (sameDay) return `${clock(startDate)} – ${clock(endDate)}`;
  const day = (date: Date): string => `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${clock(date)}`;
  return `${day(startDate)} – ${day(endDate)}`;
}

/**
 * The time-range control every monitoring surface uses.
 *
 * One control, two ways to answer "which period": a rolling preset (what an
 * operator watching a rollout wants — it always ends now, so auto-refresh keeps
 * moving it forward) and a fixed span (what an incident comparison needs — the axis
 * must stop moving). Both live in one popover because they are the same question,
 * and a reader who opens it to pick "last hour" should not have to discover a
 * second control for a custom range.
 *
 * The custom span is the shared `DatePicker` in `range withTime` mode, not two
 * hand-rolled inputs: that component already owns the two-month calendar, per-end
 * clocks, month/year navigation and the phone layout. Re-implementing a date form
 * here would be a second calendar with its own bugs.
 */
export function TimeRangePicker({
  value,
  onChange,
  presets,
  step,
  onStepChange,
  labels,
  formatAbsolute = defaultFormatAbsolute,
  className,
  aiId,
}: TimeRangePickerProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [draftRange, setDraftRange] = React.useState('');
  const [draftStep, setDraftStep] = React.useState(step ?? '');
  const [error, setError] = React.useState('');

  const options = React.useMemo(() => presets ?? rangePresets((key) => key), [presets]);

  /*
   * Seed the calendar from the current selection each time the panel opens.
   *
   * Re-seeding on every render would overwrite what the reader is picking; seeding
   * only on open means reopening always shows the window currently on screen.
   */
  const seed = React.useCallback(() => {
    const end = value.kind === 'absolute' ? value.end : Date.now();
    const start = value.kind === 'absolute' ? value.start : end - value.ms;
    setDraftRange(formatRangeValue(start, end));
    setDraftStep(step ?? stepForSpan(end - start));
    setError('');
  }, [value, step]);

  const triggerLabel = value.kind === 'absolute'
    ? formatAbsolute(value.start, value.end)
    : options.find((entry) => entry.ms === value.ms)?.label ?? value.key;

  const applyPreset = (key: string): void => {
    onChange(presetRange(key));
    setOpen(false);
  };

  const applyCustom = (): void => {
    const range = parseRangeValue(draftRange);
    if (!range) {
      // The message is visible in the panel, next to the field: a disabled button
      // with no explanation reads as a broken dialog.
      setError(labels.invalid);
      return;
    }
    onChange(range);
    if (onStepChange && draftStep) onStepChange(draftStep);
    setOpen(false);
  };

  const custom = parseRangeValue(draftRange);
  const draftSpan = custom ? custom.end - custom.start : undefined;

  return (
    <Popover
      align="end"
      className="w-[32rem] max-w-[calc(100vw-2rem)] p-0"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) seed();
      }}
      trigger={
        <Button
          size="sm"
          variant="secondary"
          className={cn('justify-between gap-2', className)}
          aria-label={triggerLabel}
          {...(aiId ? { 'data-ai-id': aiId } : {})}
          data-range-kind={value.kind}
        >
          <Icon name="clock" size={14} />
          <span className="truncate tabular-nums">{triggerLabel}</span>
          <Icon name="chevron-down" size={12} />
        </Button>
      }
    >
      <div className="flex flex-col">
        <div className="grid grid-cols-1 gap-4 p-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
          {/* ---- Rolling presets, as a grid: twelve entries in one column was a
                  scroll for the four that are used most. ------------------- */}
          <section className="flex min-w-0 flex-col gap-1.5" aria-label={labels.presets}>
            <h3 className="text-xs font-medium text-ai-fg-muted">{labels.presets}</h3>
            <div
              className="grid grid-cols-3 gap-1"
              role="listbox"
              aria-label={labels.presets}
              {...(aiId ? { 'data-ai-id': `${aiId}:presets` } : {})}
            >
              {options.map((entry) => {
                const selected = value.kind === 'relative' && value.ms === entry.ms;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-ai-preset={entry.key}
                    onClick={() => applyPreset(entry.key)}
                    className={cn(
                      'flex min-h-8 cursor-pointer items-center justify-center rounded-ai-sm px-1.5 text-center text-[11px] leading-tight transition-colors duration-ai-fast',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring',
                      selected
                        ? 'bg-ai-accent/12 font-medium text-ai-accent ring-1 ring-inset ring-ai-accent/40'
                        : 'text-ai-fg-secondary hover:bg-ai-surface-2 hover:text-ai-fg',
                    )}
                  >
                    {entry.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ---- Fixed span: the shared DatePicker in range mode ------------ */}
          <section className="flex min-w-0 flex-col gap-2" aria-label={labels.custom}>
            <h3 className="text-xs font-medium text-ai-fg-muted">{labels.custom}</h3>
            <DatePicker
              value={draftRange}
              onChange={(next) => {
                setDraftRange(next);
                setError('');
              }}
              range
              withTime
              clearable={false}
              placeholder={labels.rangePlaceholder}
              {...(aiId ? { id: `${aiId}:range` } : {})}
            />
            {onStepChange ? (
              <label className="flex flex-col gap-1 text-[11px] text-ai-fg-secondary">
                {labels.step}
                <select
                  value={draftStep}
                  onChange={(event) => setDraftStep(event.target.value)}
                  className="h-8 rounded-ai-md border border-ai-line bg-ai-surface px-2 text-[11px] text-ai-fg"
                  {...(aiId ? { 'data-ai-id': `${aiId}:step` } : {})}
                >
                  {labels.stepOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <p className="text-[11px] leading-relaxed text-ai-fg-muted">
              {draftSpan === undefined ? labels.stepHint : `${labels.stepHint} · ${stepForSpan(draftSpan)}`}
            </p>
            {error ? <p role="alert" className="text-[11px] text-ai-danger">{error}</p> : null}
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ai-line px-3 py-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{labels.cancel}</Button>
          <Button size="sm" variant="primary" onClick={applyCustom} {...(aiId ? { 'data-ai-id': `${aiId}:confirm` } : {})}>
            {labels.confirm}
          </Button>
        </div>
      </div>
    </Popover>
  );
}

/** Whether a selection equals another, for the host's own "did it change" checks. */
export { sameRange };

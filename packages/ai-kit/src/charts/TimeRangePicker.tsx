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
  /**
   * Heading above the rolling presets.
   *
   * Optional: the presets are the control's main body and their labels are
   * self-explanatory ("最近 1 小时"), so a heading is a line of chrome between the
   * trigger and the choice. Pass one only when the surrounding page needs the group
   * named for a screen reader in a longer form.
   */
  presets?: string;
  /**
   * Display text per preset key.
   *
   * Without it the menu shows the keys themselves (`1h`, `6h`), which reads as a
   * column of identifiers on a localised page. Optional so a story can stay terse;
   * every product page passes it.
   */
  presetLabels?: Readonly<Record<string, string>>;
  /** Heading of the custom-range section. Defaults to 自定义. */
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
 * Layout, and why:
 *
 * - The presets come **first and fill the panel**, two per row. They are what nine
 *   out of ten visits are for; putting them beside a calendar gave the calendar
 *   half the width and the presets a narrow column that wrapped "最近 30 分钟"
 *   onto two lines.
 * - No heading above them. "最近 1 小时" already says what the group is; a heading
 *   only pushes the first choice down.
 * - The custom span is a **collapsed section underneath**, styled as a quieter
 *   surface. A reader who wants a preset should not have their eye land on a date
 *   field, and a reader who wants a custom range gets the full width for it —
 *   the calendar needs two months side by side.
 * - The trigger carries a clock glyph with a rewind arrow (`timed-task`), not the
 *   plain `clock`: the plain one is a two-tone glyph whose dial and hands are both
 *   `currentColor`, so at 14px it renders as a solid dot.
 *
 * The custom span is the shared `DatePicker` in `range withTime` mode, not two
 * hand-rolled inputs: that component already owns the two-month calendar, per-end
 * clocks, month/year navigation and the phone layout.
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
  /*
   * Whether the custom section is expanded.
   *
   * Collapsed by default so the presets own the panel. It opens by itself when the
   * current selection *is* a custom span — otherwise the trigger would say
   * "11-06 10:01 – 11-21 23:59" and the panel would show neither that span nor
   * which one it replaced.
   */
  const [customOpen, setCustomOpen] = React.useState(value.kind === 'absolute');

  const options = React.useMemo(
    () => presets ?? rangePresets((key) => labels.presetLabels?.[key] ?? key),
    [presets, labels.presetLabels],
  );

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
    setCustomOpen(value.kind === 'absolute');
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
  const customSelected = value.kind === 'absolute';

  return (
    <Popover
      align="end"
      className="w-[21rem] max-w-[calc(100vw-2rem)] p-0"
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
          <Icon name="timed-task" size={14} className="text-ai-fg-muted" />
          <span className="truncate tabular-nums">{triggerLabel}</span>
          <Icon name="chevron-down" size={12} className="text-ai-fg-muted" />
        </Button>
      }
    >
      <div className="flex flex-col">
        {/* ---- Rolling presets: the panel's main body, two per row ---------- */}
        <section className="flex flex-col gap-2 p-2.5">
          <div
            className="grid grid-cols-2 gap-1.5"
            role="listbox"
            /*
             * The presets are a list of periods, not "custom range": naming the listbox
             * after the section below it made a screen reader announce the twelve
             * periods as part of the custom control. With no heading supplied the
             * attribute is omitted rather than borrowed from the neighbour.
             */
            {...(labels.presets ? { 'aria-label': labels.presets } : {})}
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
                    // 36px tall: two rows of twelve entries fit without scrolling, and
                    // the height is a comfortable click target without the panel
                    // becoming a list of buttons.
                    'flex h-9 cursor-pointer items-center justify-between gap-1.5 rounded-ai-md px-2.5 text-left text-xs',
                    'transition-colors duration-ai-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring',
                    selected
                      ? 'bg-ai-accent/12 font-medium text-ai-accent ring-1 ring-inset ring-ai-accent/40'
                      : 'text-ai-fg-secondary hover:bg-ai-surface-2 hover:text-ai-fg',
                  )}
                >
                  <span className="truncate">{entry.label}</span>
                  {/* The check marks the active window; the tint alone is easy to miss
                      beside a hovered row in the same palette. */}
                  {selected ? <Icon name="check" size={12} className="shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        </section>

        {/* ---- Custom span: collapsed, quieter, full width when open -------- */}
        <section
          className={cn(
            // A recessed surface: it reads as a secondary route into the same
            // question, which is what keeps the eye on the presets above it.
            'border-t border-ai-line bg-ai-surface-2/30',
            customOpen && 'pb-2.5',
          )}
          aria-label={labels.custom}
        >
          <button
            type="button"
            aria-expanded={customOpen}
            onClick={() => setCustomOpen((previous) => !previous)}
            className={cn(
              'flex w-full cursor-pointer items-center justify-between gap-2 px-2.5 py-2 text-left text-xs',
              'transition-colors duration-ai-fast hover:text-ai-fg',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai-ring',
              customSelected ? 'text-ai-accent' : 'text-ai-fg-secondary',
            )}
            {...(aiId ? { 'data-ai-id': `${aiId}:custom-toggle` } : {})}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <Icon name="calendar" size={13} className="shrink-0 text-ai-fg-muted" />
              <span className="shrink-0 font-medium">{labels.custom}</span>
              {/*
                A custom span is not one of the presets, so the trigger cannot show
                which one is active from the list above. Naming it here is what makes
                "the panel shows no selection" legible instead of looking broken.
              */}
              {customSelected && !customOpen ? (
                <span className="truncate tabular-nums text-[11px] text-ai-accent">{triggerLabel}</span>
              ) : null}
            </span>
            <Icon
              name="chevron-down"
              size={12}
              className={cn('shrink-0 text-ai-fg-muted transition-transform duration-ai-fast', customOpen && 'rotate-180')}
            />
          </button>

          {customOpen ? (
            <div className="flex flex-col gap-2 px-2.5">
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
                <label className="flex items-center gap-2 text-[11px] text-ai-fg-secondary">
                  <span className="shrink-0">{labels.step}</span>
                  <select
                    value={draftStep}
                    onChange={(event) => setDraftStep(event.target.value)}
                    className="h-7 flex-1 rounded-ai-sm border border-ai-line bg-ai-surface px-1.5 text-[11px] text-ai-fg"
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
              <div className="flex items-center justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setCustomOpen(false)}>{labels.cancel}</Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={applyCustom}
                  {...(aiId ? { 'data-ai-id': `${aiId}:confirm` } : {})}
                >
                  {labels.confirm}
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </Popover>
  );
}

/** Whether a selection equals another, for the host's own "did it change" checks. */
export { sameRange };

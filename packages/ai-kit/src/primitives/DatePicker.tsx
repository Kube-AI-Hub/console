import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '../utils/cn';
import { useIsMobile } from '../utils/useMediaQuery';
import {
  CalendarIcon,
  DayGrid,
  MonthGrid,
  NavButton,
  YearGrid,
  addMonths,
  datePart,
  parseIso,
  timePart,
  toIso,
} from './DatePicker.parts';

export interface DatePickerProps {
  /** ISO date string, `YYYY-MM-DD`, or `YYYY-MM-DD HH:mm` when `withTime`. */
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Add an hour/minute pair; the value gains a ` HH:mm` suffix. */
  withTime?: boolean;
  /**
   * Pick a start and an end instead of a single instant.
   *
   * The value becomes a comma-separated pair — two dates, or two date-times when
   * combined with `withTime` — which is the shape console's log and metric
   * filters already send to the API. Each end keeps its own time.
   */
  range?: boolean;
  /** Show a clear affordance once a value is set; defaults to true. */
  clearable?: boolean;
  /** Block specific days, e.g. dates outside a retention window. */
  disabledDate?: (date: Date) => boolean;
}

/**
 * Calendar popover.
 *
 * Implemented in-house rather than pulled from a date library: the console needs
 * day, month and year navigation with an optional range, and a dependency would
 * add locale data and a second formatting system alongside the host's.
 *
 * Range mode renders two consecutive months side by side. That is what makes a
 * cross-month selection possible: with a single panel the user had to page away
 * from the start they had just picked, losing sight of it.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = '选择日期',
  disabled,
  id,
  className,
  withTime = false,
  range = false,
  clearable = true,
  disabledDate,
}: DatePickerProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const mobile = useIsMobile();
  // On a phone only one calendar fits, so the pair becomes two tabs.
  const [mobileTab, setMobileTab] = React.useState<'start' | 'end'>('start');

  // Range values split on the comma the emit side writes.
  const parts = value ? value.split(',').map((item) => item.trim()) : [];
  const startValue = range ? (parts[0] ?? '') : (value ?? '');
  const endValue = range ? (parts[1] ?? '') : '';
  const startDate = parseIso(startValue);
  const endDate = parseIso(endValue);

  // Two independent clocks: a range usually starts and ends at different times
  // of day, which a single shared state made impossible.
  const [startTime, setStartTime] = React.useState(() => timePart(startValue) || '00:00');
  const [endTime, setEndTime] = React.useState(() => timePart(endValue) || '23:59');

  // Each calendar panel owns its month, so the range ends can live in different
  // months and years. The single-date case uses `month`.
  const [month, setMonth] = React.useState<Date>(() => parseIso(startValue) ?? new Date());
  const [startMonth, setStartMonth] = React.useState<Date>(() => parseIso(startValue) ?? new Date());
  const [endMonth, setEndMonth] = React.useState<Date>(() => {
    const end = parseIso(endValue);
    if (end) return end;
    // With no end yet, open one month ahead of the start so a typical
    // few-week range is visible without paging.
    return addMonths(parseIso(startValue) ?? new Date(), 1);
  });

  const selectedIso = !range && startValue ? datePart(startValue) : '';
  const startIso = range && startDate ? toIso(startDate) : '';
  const endIso = range && endDate ? toIso(endDate) : '';
  const waitingForEnd = range && Boolean(startIso) && !endIso;

  // Re-anchor the visible month when the selection changes from outside, and
  // when the panel opens, so it never shows an unrelated period.
  //
  // The end panel is only re-anchored when the *end* value itself changes:
  // picking a start writes `value`, and treating that as a reset dragged the end
  // panel back to "start + 1 month" — throwing away a year the user had just
  // navigated to.
  const lastEndRef = React.useRef(endValue);
  React.useEffect(() => {
    const anchor = parseIso(startValue);
    if (anchor) {
      setMonth(anchor);
      setStartMonth(anchor);
    }

    const endChanged = lastEndRef.current !== endValue;
    lastEndRef.current = endValue;
    const endAnchor = parseIso(endValue);
    if (endAnchor) setEndMonth(endAnchor);
    else if (endChanged || !anchor) setEndMonth(addMonths(anchor ?? new Date(), 1));

    setStartTime(timePart(startValue) || '00:00');
    setEndTime(timePart(endValue) || '23:59');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const formatted = (iso: string, nextTime: string) => (withTime ? `${iso} ${nextTime}` : iso);

  const emitRange = (start: string, end: string) => {
    if (!start && !end) return onChange?.('');
    if (start && end) return onChange?.(`${formatted(start, startTime)},${formatted(end, endTime)}`);
    // A half-finished range still carries the end's clock so the trigger shows
    // what will be applied once the second date is picked.
    return onChange?.(formatted(start || end, start ? startTime : endTime));
  };

  const pick = (iso: string) => {
    if (!range) {
      if (withTime) onChange?.(formatted(iso, startTime));
      else {
        onChange?.(iso);
        setOpen(false);
      }
      return;
    }

    // No start yet, or a finished range: this click starts over.
    if (!startIso || !waitingForEnd) {
      emitRange(iso, '');
      return;
    }

    // Completing the range. A click before the start is treated as the new
    // start so the pair can never be inverted.
    if (iso < startIso) emitRange(iso, startIso);
    else emitRange(startIso, iso);
  };

  const changeTime = (nextTime: string, edge: 'start' | 'end') => {
    const setter = edge === 'start' ? setStartTime : setEndTime;
    setter(nextTime);

    if (!range) {
      // Single date: commit immediately so the trigger reflects the edit.
      if (startDate) onChange?.(formatted(toIso(startDate), nextTime));
      return;
    }

    const start = startIso || (edge === 'start' ? '' : '');
    const end = endIso || '';
    const startClock = edge === 'start' ? nextTime : startTime;
    const endClock = edge === 'end' ? nextTime : endTime;
    if (!start && !end) return;
    if (start && end) onChange?.(`${formatted(start, startClock)},${formatted(end, endClock)}`);
    else onChange?.(formatted(start || end, start ? startClock : endClock));
  };

  const clear = (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange?.('');
  };

  const display = (() => {
    if (!value) return '';
    if (!range) return withTime ? value : datePart(value);
    const labels = parts.filter(Boolean);
    return labels.join(' ~ ');
  })();

  /* ---------------- Header state moved into CalendarPanel ---------------- */

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-ai-md border border-ai-line',
            'bg-ai-surface-1 px-3 text-sm',
            'transition-colors duration-ai-fast hover:border-ai-line-strong',
            'focus-visible:outline-none focus-visible:border-ai-accent focus-visible:ring-2 focus-visible:ring-ai-accent/25',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className={cn('truncate', display ? 'text-ai-fg' : 'text-ai-fg-faint')}>{display || placeholder}</span>
          <span className="flex shrink-0 items-center gap-1">
            {clearable && display && !disabled ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="清除日期"
                onClick={clear}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onChange?.('');
                  }
                }}
                className={cn(
                  'relative grid size-4 place-items-center rounded-full text-ai-fg-faint',
                  'transition-colors duration-ai-fast hover:bg-ai-surface-3 hover:text-ai-fg',
                  // Keep the glyph small but give it a 44px tap target.
                  'after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[""]',
                )}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="size-2.5">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </span>
            ) : null}
            <CalendarIcon className="size-4 text-ai-fg-muted" />
          </span>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className={cn(
            'z-50 rounded-ai-md border border-ai-line bg-ai-bg-overlay p-3 shadow-ai-pop animate-ai-scale-in',
            // Two months side by side need room, but the panel must never be
            // wider than the screen: at 544px it overflowed a 390px viewport and
            // the end calendar was unreachable.
            mobile ? 'w-[calc(100vw-2rem)]' : range ? 'w-[34rem]' : 'w-64',
          )}
        >
          {range ? (
            <p className="mb-1.5 text-[10px] text-ai-fg-muted">
              {!startIso ? '选择开始日期' : waitingForEnd ? '选择结束日期' : '已选完，点击任意日期重新开始'}
            </p>
          ) : null}

          {range ? (
            /*
             * Two independent calendars on desktop, one at a time on phones.
             *
             * Each side keeps its own month and view, so the start and the end
             * can sit in different months *and* years. Below the `sm` breakpoint
             * the pair cannot fit (544px against a 390px viewport), so the panel
             * switches tabs instead of overflowing off-screen.
             */
            <div className={cn(mobile ? 'block' : 'grid grid-cols-2 gap-4')}>
              {mobile ? (
                <div className="mb-2 grid grid-cols-2 gap-1 rounded-ai-md bg-ai-surface-2 p-0.5" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mobileTab === 'start'}
                    onClick={() => setMobileTab('start')}
                    className={cn(
                      'h-9 rounded-ai-sm text-xs font-medium transition-colors duration-ai-fast',
                      mobileTab === 'start' ? 'bg-ai-bg-elevated text-ai-fg shadow-sm' : 'text-ai-fg-muted',
                    )}
                  >
                    {startIso ? `开始 ${datePart(startIso)}` : '开始日期'}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mobileTab === 'end'}
                    onClick={() => setMobileTab('end')}
                    className={cn(
                      'h-9 rounded-ai-sm text-xs font-medium transition-colors duration-ai-fast',
                      mobileTab === 'end' ? 'bg-ai-bg-elevated text-ai-fg shadow-sm' : 'text-ai-fg-muted',
                    )}
                  >
                    {endIso ? `结束 ${datePart(endIso)}` : '结束日期'}
                  </button>
                </div>
              ) : null}

              {/* Only the active end is rendered on a phone. Keeping both in the
                  DOM left two calendars in the accessibility tree, so a screen
                  reader announced controls for the panel the user cannot see. */}
              {!mobile || mobileTab === 'start' ? (
                <div>
                  <CalendarPanel
                    label="开始"
                    month={startMonth}
                    onMonthChange={setStartMonth}
                    startIso={startIso}
                    endIso={endIso}
                    onPick={(iso) => {
                      pick(iso);
                      // On a phone only one calendar is visible, so advance to the
                      // other end automatically; otherwise the user has to notice
                      // the tab they need next.
                      if (mobile && !endIso) setMobileTab('end');
                    }}
                    disabledDate={disabledDate}
                    showLabel={!mobile}
                    compact={mobile}
                  />
                </div>
              ) : null}
              {!mobile || mobileTab === 'end' ? (
                <div>
                  <CalendarPanel
                    label={mobile ? '' : '结束'}
                    suffixLabel="结束"
                    month={endMonth}
                    onMonthChange={setEndMonth}
                    startIso={startIso}
                    endIso={endIso}
                    onPick={pick}
                    disabledDate={disabledDate}
                    showLabel={!mobile}
                    compact={mobile}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <CalendarPanel
              label=""
              month={month}
              onMonthChange={setMonth}
              startIso=""
              endIso=""
              selectedIso={selectedIso}
              onPick={pick}
              disabledDate={disabledDate}
              showBand={false}
              showLabel={false}
              compact={mobile}
            />
          )}

          {withTime ? (
            <div className="mt-3 flex flex-col gap-2 border-t border-ai-line pt-3">
              <label className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-[11px] text-ai-fg-muted">{range ? '开始时间' : '时间'}</span>
                <input
                  type="time"
                  aria-label={range ? '开始时间' : '时间'}
                  value={startTime}
                  onChange={(event) => changeTime(event.target.value, 'start')}
                  className="h-7 flex-1 rounded-ai-sm border border-ai-line bg-ai-surface-1 px-2 text-xs text-ai-fg focus-visible:border-ai-accent focus-visible:outline-none"
                />
              </label>
              {range ? (
                <label className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-[11px] text-ai-fg-muted">结束时间</span>
                  <input
                    type="time"
                    aria-label="结束时间"
                    value={endTime}
                    onChange={(event) => changeTime(event.target.value, 'end')}
                    className="h-7 flex-1 rounded-ai-sm border border-ai-line bg-ai-surface-1 px-2 text-xs text-ai-fg focus-visible:border-ai-accent focus-visible:outline-none"
                  />
                </label>
              ) : null}
            </div>
          ) : null}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Which grid a panel is showing. Changing it never changes the selection. */
type PanelView = 'days' | 'months' | 'years';

/** First year on a years page, aligned to a multiple of twelve. */
function yearPageStart(year: number): number {
  return Math.floor(year / 12) * 12;
}

interface CalendarPanelProps {
  /** Visible in the header, e.g. 开始 / 结束. Empty hides the caption. */
  label: string;
  /** Distinguishes two panels' aria labels when `label` is hidden. */
  suffixLabel?: string;
  month: Date;
  onMonthChange: (next: Date) => void;
  startIso?: string;
  endIso?: string;
  selectedIso?: string;
  onPick: (iso: string) => void;
  disabledDate?: (date: Date) => boolean;
  showBand?: boolean;
  showLabel?: boolean;
  /** Touch-sized controls; enabled below the `sm` breakpoint. */
  compact?: boolean;
}

/**
 * One calendar with its own month and view.
 *
 * Range mode renders two of these. Owning the month per panel is what allows the
 * start and the end of a range to sit in different years: a shared anchor could
 * only ever express "same month" or "next month".
 */
function CalendarPanel({
  label,
  suffixLabel,
  month,
  onMonthChange,
  startIso,
  endIso,
  selectedIso,
  onPick,
  disabledDate,
  showBand = true,
  showLabel = true,
  compact = false,
}: CalendarPanelProps): React.ReactElement {
  const [view, setView] = React.useState<PanelView>('days');

  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const step = (delta: number) => {
    if (view === 'days') onMonthChange(addMonths(month, delta));
    else if (view === 'months') onMonthChange(new Date(year + delta, monthIndex, 1));
    else onMonthChange(new Date(year + delta * 12, monthIndex, 1));
  };

  const headerTitle =
    view === 'days'
      ? `${year} 年 ${monthIndex + 1} 月`
      : view === 'months'
        ? `${year} 年`
        : `${yearPageStart(year)}–${yearPageStart(year) + 11}`;

  const headerLabel =
    view === 'days' ? '切换月份或年份' : view === 'months' ? '切换年份' : '切换年份区间';

  const stepLabel =
    view === 'days' ? ['上个月', '下个月'] : view === 'months' ? ['上一年', '下一年'] : ['上一个 12 年', '下一个 12 年'];

  // Two panels share the same aria labels, so screen-reader and test selectors
  // need to tell them apart. `suffixLabel` names the end even when the visible
  // caption is hidden on a phone; a single calendar simply says 日历.
  const suffix = suffixLabel ?? label;
  const suffixPart = `（${suffix}日历）`;
  const withSuffix = (text: string) => `${text}${suffixPart}`;

  return (
    <div>
      {showLabel && label ? (
        <p className="mb-1 text-center text-[11px] font-semibold text-ai-fg-secondary">{label}</p>
      ) : null}
      <div className="mb-2 flex items-center justify-between gap-1">
        <NavButton
          label={withSuffix(stepLabel[0]!)}
          onClick={() => step(-1)}
          direction="prev"
          size={compact ? 'touch' : 'default'}
        />
        <button
          type="button"
          aria-label={withSuffix(headerLabel)}
          onClick={() => setView(view === 'days' ? 'months' : 'years')}
          className={cn(
            'min-w-0 truncate rounded-ai-sm px-1.5 text-xs font-medium text-ai-fg transition-colors duration-ai-fast hover:bg-ai-surface-2',
            compact ? 'h-9 py-2' : 'py-0.5',
          )}
        >
          {headerTitle}
        </button>
        <NavButton
          label={withSuffix(stepLabel[1]!)}
          onClick={() => step(1)}
          direction="next"
          size={compact ? 'touch' : 'default'}
        />
      </div>

      {view === 'days' ? (
        <DayGrid
          month={month}
          startIso={startIso}
          endIso={endIso}
          selectedIso={selectedIso}
          onPick={onPick}
          disabledDate={disabledDate}
          showBand={showBand}
          compact={compact}
        />
      ) : null}

      {view === 'months' ? (
        <MonthGrid
          activeMonth={startIso && parseIso(startIso)?.getFullYear() === year ? parseIso(startIso)!.getMonth() : undefined}
          compact={compact}
          onPick={(pickedMonth) => {
            onMonthChange(new Date(year, pickedMonth, 1));
            // Back to the day grid so the click lands on a date, not a second
            // month choice.
            setView('days');
          }}
        />
      ) : null}

      {view === 'years' ? (
        <YearGrid
          pageStart={yearPageStart(year)}
          activeYear={parseIso(startIso)?.getFullYear()}
          onPick={(pickedYear) => {
            onMonthChange(new Date(pickedYear, monthIndex, 1));
            setView('months');
          }}
        />
      ) : null}
    </div>
  );
}

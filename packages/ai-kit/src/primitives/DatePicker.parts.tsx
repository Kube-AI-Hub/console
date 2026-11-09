import * as React from 'react';
import { cn } from '../utils/cn';

/**
 * Internal calendar building blocks for DatePicker.
 *
 * Split out because the picker now has three views (days, months, years) and a
 * two-panel range mode; keeping them in one file made the date logic hard to
 * follow. Nothing here is exported from the package.
 */

export const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

export function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** `YYYY-MM-DD` portion of a value that may carry a time suffix. */
export function datePart(value: string | undefined): string {
  return value ? value.slice(0, 10) : '';
}

export function timePart(value: string | undefined): string {
  if (!value) return '';
  const match = value.match(/\d{2}:\d{2}/);
  return match ? match[0] : '';
}

export function parseIso(value: string | undefined): Date | null {
  const iso = datePart(value);
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/* ---------------- Day grid ---------------- */

export interface DayGridProps {
  /** Any date inside the month to render. */
  month: Date;
  /** Currently controlled start / end for range mode. */
  startIso?: string;
  endIso?: string;
  /** Single-date selection, used when `startIso` is absent. */
  selectedIso?: string;
  onPick: (iso: string) => void;
  disabledDate?: (date: Date) => boolean;
  /** Days between the ends are tinted to show the chosen period. */
  showBand?: boolean;
  showWeekdays?: boolean;
  /**
   * Touch-sized cells.
   *
   * 28px rows are comfortable with a mouse and unusable with a thumb; below the
   * `sm` breakpoint the grid grows to a 44px minimum hit target.
   */
  compact?: boolean;
}

export function DayGrid({
  month,
  startIso = '',
  endIso = '',
  selectedIso,
  onPick,
  disabledDate,
  showBand = true,
  showWeekdays = true,
  compact = false,
}: DayGridProps): React.ReactElement {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const single = selectedIso ?? '';

  return (
    <div>
      {showWeekdays ? (
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((day) => (
            <span key={day} className="grid h-6 place-items-center text-[10px] text-ai-fg-faint">
              {day}
            </span>
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day === null) return <span key={`empty-${index}`} />;
          const cellDate = new Date(year, monthIndex, day);
          const iso = toIso(cellDate);
          const blocked = disabledDate?.(cellDate) ?? false;
          const isEdge = iso === startIso || iso === endIso || iso === single;
          const inBand =
            showBand && Boolean(startIso && endIso && iso > startIso && iso < endIso);
          return (
            <button
              key={day}
              type="button"
              disabled={blocked}
              onClick={() => onPick(iso)}
              aria-current={isEdge ? 'date' : undefined}
              data-in-range={inBand ? 'true' : undefined}
              className={cn(
                'grid place-items-center rounded-ai-sm text-xs text-ai-fg-secondary',
                compact ? 'h-11' : 'h-7',
                'transition-colors duration-ai-fast hover:bg-ai-surface-2 hover:text-ai-fg',
                'data-[in-range=true]:bg-ai-accent/15 data-[in-range=true]:text-ai-fg',
                'aria-[current=date]:bg-ai-accent aria-[current=date]:text-ai-accent-fg',
                'disabled:cursor-not-allowed disabled:opacity-30 disabled:line-through disabled:hover:bg-transparent',
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Month grid ---------------- */

export function MonthGrid({
  activeMonth,
  onPick,
  compact = false,
}: {
  /** 0-based month highlighted as current, if any. */
  activeMonth?: number;
  onPick: (monthIndex: number) => void;
  compact?: boolean;
}): React.ReactElement {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {Array.from({ length: 12 }, (_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onPick(index)}
          className={cn(
            'rounded-ai-sm text-xs transition-colors duration-ai-fast',
            compact ? 'h-11' : 'h-8',
            index === activeMonth
              ? 'bg-ai-accent text-ai-accent-fg'
              : 'text-ai-fg-secondary hover:bg-ai-surface-2 hover:text-ai-fg',
          )}
        >
          {index + 1} 月
        </button>
      ))}
    </div>
  );
}

/* ---------------- Year grid ---------------- */

/**
 * A decade of years ending on the current page.
 *
 * Paging by twelve keeps the grid aligned to round numbers instead of drifting
 * by whatever year the user happened to be on.
 */
export function YearGrid({
  activeYear,
  onPick,
  pageStart,
}: {
  activeYear?: number;
  onPick: (year: number) => void;
  pageStart: number;
}): React.ReactElement {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {Array.from({ length: 12 }, (_, index) => {
        const year = pageStart + index;
        return (
          <button
            key={year}
            type="button"
            onClick={() => onPick(year)}
            className={cn(
              'h-8 rounded-ai-sm text-xs transition-colors duration-ai-fast',
              year === activeYear
                ? 'bg-ai-accent text-ai-accent-fg'
                : 'text-ai-fg-secondary hover:bg-ai-surface-2 hover:text-ai-fg',
            )}
          >
            {year}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Nav ---------------- */

export function NavButton({
  label,
  onClick,
  direction,
  size = 'default',
}: {
  label: string;
  onClick: () => void;
  direction: 'prev' | 'next';
  size?: 'default' | 'touch';
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'grid shrink-0 place-items-center rounded-ai-sm text-ai-fg-muted transition-colors duration-ai-fast hover:bg-ai-surface-2 hover:text-ai-fg',
        size === 'touch' ? 'size-11' : 'size-7',
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-3.5"
      >
        <path d={direction === 'prev' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
      </svg>
    </button>
  );
}

export function CalendarIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </svg>
  );
}

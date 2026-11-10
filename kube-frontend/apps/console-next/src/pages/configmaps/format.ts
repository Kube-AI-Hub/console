/**
 * Timestamps the way the old console prints them.
 *
 * `YYYY-MM-DD HH:mm:ss` in the reader's own time zone, matching
 * `getLocalTime(...).format('YYYY-MM-DD HH:mm:ss')` in the old console. Not
 * `Intl.DateTimeFormat` with `dateStyle`/`timeStyle`: that renders `2026/11/10
 * 04:16` under `zh-CN` and `11/10/26, 4:16 AM` under `en-US`, so the same cell
 * read differently depending on the reader's browser — and neither matched the
 * console this page replaces.
 */
export function formatTimestamp(value: string | undefined | null): string {
  if (!value) return '-';
  const date = new Date(value);
  // An unparseable timestamp from upstream should not render `NaN-NaN-NaN`.
  if (Number.isNaN(date.getTime())) return '-';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

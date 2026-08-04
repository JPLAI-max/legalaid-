/**
 * Parse a date string for display purposes.
 *
 * - Date-only strings (YYYY-MM-DD) are parsed as **local midnight** so that
 *   `2025-02-10` always renders as "Feb 10" regardless of the viewer's timezone.
 *   Using `new Date("2025-02-10")` parses as UTC midnight, which rolls back to
 *   the previous day for any timezone west of UTC (e.g. −8 → Feb 9 4 pm local).
 *
 * - Full ISO strings (with time / timezone info) are passed to `new Date()`
 *   unchanged — the browser's normal UTC-to-local conversion applies.
 */
export function parseLocalDate(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
}

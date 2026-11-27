/**
 * Deadlines are stored as `YYYY-MM-DD` plus an optional 24-hour `HH:mm`.
 * Keeping the time separate means existing date-only records stay valid and
 * the Firestore rules for student task updates do not need to change.
 */
export const TIME_KEY = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string | null | undefined): value is string {
  return !!value && TIME_KEY.test(value);
}

/** `17:05` → `5:05 PM`; empty string for missing or malformed values. */
export function formatTime(value?: string | null): string {
  if (!isValidTime(value)) return '';
  const [hours, minutes] = value.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/** `Aug 04, 2026 · 5:05 PM`, or just the date when no time is set. */
export function formatDateTime(date: string, time?: string | null): string {
  const label = formatDateLabel(date);
  const clock = formatTime(time);
  return clock ? `${label} · ${clock}` : label;
}

/** Sortable key; untimed dates sit at the end of their own day. */
export function dueSortKey(date: string, time?: string | null): string {
  return `${date}T${isValidTime(time) ? time : '23:59'}`;
}

function formatDateLabel(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || 'No date';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });
}

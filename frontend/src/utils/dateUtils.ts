/**
 * Parses an ISO date string or Date object safely as UTC so the browser
 * converts it accurately into the user's local timezone (e.g. IST).
 */
export function parseUtcDate(value: string | number | Date | null | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);

  const str = String(value).trim();
  // If the ISO string lacks timezone offset (e.g. "2026-10-26T09:27:57"), append 'Z'
  if (str.includes('T') && !str.endsWith('Z') && !str.includes('+') && !/-\d\d:\d\d$/.test(str)) {
    return new Date(`${str}Z`);
  }
  return new Date(str);
}

/**
 * Formats a date/timestamp to the local time string (e.g. "3:27 PM" in IST).
 */
export function formatLocalTime(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
): string {
  if (!value) return '--:--';
  return parseUtcDate(value).toLocaleTimeString([], options);
}

/**
 * Formats a date/timestamp to the local date string (e.g. "10/26/2026").
 */
export function formatLocalDate(value: string | number | Date | null | undefined): string {
  if (!value) return '--/--/----';
  return parseUtcDate(value).toLocaleDateString();
}

/**
 * Formats a date/timestamp to full local date & time (e.g. "10/26/2026, 3:27:57 PM").
 */
export function formatLocalDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return '--';
  return parseUtcDate(value).toLocaleString();
}

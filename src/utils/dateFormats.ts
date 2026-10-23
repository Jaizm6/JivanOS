/**
 * OmniOS Unified Date-Time Formatters
 * Adheres strictly to user-prescribed specifications:
 * - DDMMYYYY (e.g. 24/09/2026)
 * - DDMM (e.g. 24/09)
 * - DDMMYYYY:HH:MM:SS (e.g. 24/09/2026 13:14:00)
 * - DDMMYYYY:HH:MM (e.g. 24/09/2026 13:14)
 * - DDMonthYYYY:HH:MM:SS (e.g. 24 Sep 2026 13:14:00)
 * - DDMonthYYYY:HH:MM (e.g. 24 Sep 2026 13:14)
 */

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function parseDateInput(input?: string | number | Date | null): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

  if (typeof input === 'string') {
    // If format is YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      const [y, m, d] = input.split('-').map(Number);
      return new Date(y, m - 1, d, 0, 0, 0);
    }
    // If format is YYYY-MM-DDTHH:mm or ISO
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** DDMM e.g. "24/09" */
export function formatDDMM(input?: string | number | Date | null): string {
  const d = parseDateInput(input);
  if (!d) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** DDMMYYYY e.g. "24/09/2026" */
export function formatDDMMYYYY(input?: string | number | Date | null): string {
  const d = parseDateInput(input);
  if (!d) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** DDMMYYYY:HH:MM e.g. "24/09/2026 13:14" */
export function formatDDMMYYYY_HHMM(
  input?: string | number | Date | null,
  timeFallback?: string
): string {
  const d = parseDateInput(input);
  if (!d) return '';
  let hours = pad(d.getHours());
  let minutes = pad(d.getMinutes());

  if (timeFallback && /^\d{1,2}:\d{2}$/.test(timeFallback)) {
    const [h, m] = timeFallback.split(':').map(Number);
    hours = pad(h);
    minutes = pad(m);
  }

  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${hours}:${minutes}`;
}

/** DDMMYYYY:HH:MM:SS e.g. "24/09/2026 13:14:00" */
export function formatDDMMYYYY_HHMMSS(input?: string | number | Date | null): string {
  const d = parseDateInput(input);
  if (!d) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** DDMonthYYYY:HH:MM e.g. "24 Sep 2026 13:14" */
export function formatDDMonthYYYY_HHMM(
  input?: string | number | Date | null,
  timeFallback?: string
): string {
  const d = parseDateInput(input);
  if (!d) return '';
  const month = MONTH_NAMES_SHORT[d.getMonth()] || pad(d.getMonth() + 1);
  let hours = pad(d.getHours());
  let minutes = pad(d.getMinutes());

  if (timeFallback && /^\d{1,2}:\d{2}$/.test(timeFallback)) {
    const [h, m] = timeFallback.split(':').map(Number);
    hours = pad(h);
    minutes = pad(m);
  }

  return `${pad(d.getDate())} ${month} ${d.getFullYear()} ${hours}:${minutes}`;
}

/** DDMonthYYYY:HH:MM:SS e.g. "24 Sep 2026 13:14:00" */
export function formatDDMonthYYYY_HHMMSS(input?: string | number | Date | null): string {
  const d = parseDateInput(input);
  if (!d) return '';
  const month = MONTH_NAMES_SHORT[d.getMonth()] || pad(d.getMonth() + 1);
  return `${pad(d.getDate())} ${month} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Adaptive formatter based on available space in the UI
 * - 'compact': DD/MM (24/09)
 * - 'date': DD/MM/YYYY (24/09/2026)
 * - 'dateTime': DD/MM/YYYY 13:14 (24/09/2026 13:14)
 * - 'namedDateTime': 24 Sep 2026 13:14
 */
export function formatOmniDate(
  input?: string | number | Date | null,
  variant: 'compact' | 'date' | 'dateTime' | 'namedDateTime' = 'date',
  timeFallback?: string
): string {
  if (!input) return '';
  switch (variant) {
    case 'compact':
      return formatDDMM(input);
    case 'dateTime':
      return formatDDMMYYYY_HHMM(input, timeFallback);
    case 'namedDateTime':
      return formatDDMonthYYYY_HHMM(input, timeFallback);
    case 'date':
    default:
      return formatDDMMYYYY(input);
  }
}

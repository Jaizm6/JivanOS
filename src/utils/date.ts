/**
 * Utility functions for timezone-safe date formatting and manipulation.
 * Avoids the classic bug where local midnight dates are shifted into the previous day
 * when serialized via .toISOString() in timezones east of UTC (e.g. Asia, Europe).
 */

export function getStoredTimezone(): string {
  try { return localStorage.getItem('omni_timezone') || 'Asia/Kolkata'; } catch { return 'Asia/Kolkata'; }
}

export function getNowInStoredTimezone(): Date {
  const tz = getStoredTimezone();
  const dateString = new Date().toLocaleString('en-US', { timeZone: tz });
  return new Date(dateString);
}

export function formatLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toDateString(year: number, month: number, day: number): string {
  const temp = new Date(year, month, day);
  const y = temp.getFullYear();
  const m = String(temp.getMonth() + 1).padStart(2, '0');
  const d = String(temp.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  if (dateStr.includes('T')) return new Date(dateStr);
  const parts = dateStr.split(/[-/]/).map(Number);
  if (parts.length === 3) {
    // If YYYY-MM-DD
    if (parts[0] > 1000) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    // If DD-MM-YYYY
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return new Date(dateStr);
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export type OSDateFormat =
  | 'DDMM'
  | 'DDMMYYYY'
  | 'DDMMYYYY:HH:MM'
  | 'DDMMYYYY:HH:MM:SS'
  | 'DDMonthYYYY'
  | 'DDMonthYYYY:HH:MM'
  | 'DDMonthYYYY:HH:MM:SS';

/**
 * Standard OS Date Formatter
 * Strict user formats:
 * - DDMM (e.g. "23/09")
 * - DDMMYYYY (e.g. "23/09/2026")
 * - DDMMYYYY:HH:MM (e.g. "23/09/2026:13:45")
 * - DDMMYYYY:HH:MM:SS (e.g. "23/09/2026:13:45:00")
 * - DDMonthYYYY:HH:MM (e.g. "23Sep2026:13:45")
 * - DDMonthYYYY:HH:MM:SS (e.g. "23Sep2026:13:45:00")
 * - DDMonthYYYY (e.g. "23Sep2026")
 */
export function formatOSDate(
  input?: string | number | Date | null,
  format: OSDateFormat = 'DDMMYYYY',
  timeInput?: string | null
): string {
  if (!input) return '';

  let d: Date;
  if (input instanceof Date) {
    d = input;
  } else if (typeof input === 'number') {
    d = new Date(input);
  } else {
    // String
    if (input.includes('T')) {
      d = new Date(input);
    } else if (input.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = input.split('-').map(Number);
      d = new Date(year, month - 1, day);
    } else {
      d = new Date(input);
    }
  }

  if (isNaN(d.getTime())) return String(input);

  let hours = d.getHours();
  let minutes = d.getMinutes();
  let seconds = d.getSeconds();

  // If external timeInput like "14:30" or "14:30:00" is provided
  if (timeInput) {
    const timeParts = timeInput.split(':').map(Number);
    if (!isNaN(timeParts[0])) hours = timeParts[0];
    if (!isNaN(timeParts[1])) minutes = timeParts[1];
    if (!isNaN(timeParts[2])) seconds = timeParts[2];
  }

  const DD = String(d.getDate()).padStart(2, '0');
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const YYYY = String(d.getFullYear());
  const Month = MONTH_NAMES_SHORT[d.getMonth()] || '';
  const HH = String(hours).padStart(2, '0');
  const MIN = String(minutes).padStart(2, '0');
  const SS = String(seconds).padStart(2, '0');

  switch (format) {
    case 'DDMM':
      return `${DD}/${MM}`;
    case 'DDMMYYYY':
      return `${DD}/${MM}/${YYYY}`;
    case 'DDMMYYYY:HH:MM':
      return `${DD}/${MM}/${YYYY}:${HH}:${MIN}`;
    case 'DDMMYYYY:HH:MM:SS':
      return `${DD}/${MM}/${YYYY}:${HH}:${MIN}:${SS}`;
    case 'DDMonthYYYY':
      return timeInput ? `${DD}/${Month}/${YYYY} ${HH}:${MIN}` : `${DD}/${Month}/${YYYY}`;
    case 'DDMonthYYYY:HH:MM':
      return `${DD}/${Month}/${YYYY}:${HH}:${MIN}`;
    case 'DDMonthYYYY:HH:MM:SS':
      return `${DD}/${Month}/${YYYY}:${HH}:${MIN}:${SS}`;
    default:
      return `${DD}/${MM}/${YYYY}`;
  }
}

/**
 * Accurately computes consecutive days streak for a habit from its completionHistory.
 */
export function calculateHabitStreak(
  completionHistory: Record<string, boolean> = {},
  referenceDateStr: string = formatLocalDate()
): { currentStreak: number; bestStreak: number } {
  if (!completionHistory) return { currentStreak: 0, bestStreak: 0 };

  const dates = Object.keys(completionHistory).filter(d => Boolean(completionHistory[d]));
  if (dates.length === 0) return { currentStreak: 0, bestStreak: 0 };

  // Calculate Best Streak across all completed dates chronologically
  const sortedDates = [...dates].sort();
  let bestStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;

  for (const dStr of sortedDates) {
    const parts = dStr.split('-').map(Number);
    if (parts.length < 3 || isNaN(parts[0])) continue;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    if (!prevDate) {
      tempStreak = 1;
    } else {
      const diffTime = d.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
      if (diffDays === 1) {
        tempStreak++;
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
    }
    if (tempStreak > bestStreak) {
      bestStreak = tempStreak;
    }
    prevDate = d;
  }

  // Calculate Current Streak counting backwards from referenceDateStr (today) or yesterday
  let currentStreak = 0;
  const refParts = referenceDateStr.split('-').map(Number);
  const refDate = new Date(refParts[0], refParts[1] - 1, refParts[2]);

  let checkDate = new Date(refDate);
  const checkStr = formatLocalDate(checkDate);

  if (completionHistory[checkStr]) {
    // Today is completed
    currentStreak = 1;
    checkDate.setDate(checkDate.getDate() - 1);
  } else {
    // Today is not completed yet, check if yesterday was completed
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = formatLocalDate(checkDate);
    if (completionHistory[yesterdayStr]) {
      currentStreak = 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      return { currentStreak: 0, bestStreak: Math.max(bestStreak, 0) };
    }
  }

  // Continue checking consecutive prior days
  while (true) {
    const dStr = formatLocalDate(checkDate);
    if (completionHistory[dStr]) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return { currentStreak, bestStreak: Math.max(bestStreak, currentStreak) };
}

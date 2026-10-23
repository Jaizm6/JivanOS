import { Habit } from '../types';

/**
 * Checks if a habit is scheduled for a specific date (YYYY-MM-DD format).
 */
export function isHabitScheduledForDate(habit: Habit, dateStr: string): boolean {
  if (!dateStr) return true;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return true;

  const dayIndex = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const shortName = dayNamesShort[dayIndex];
  const fullName = dayNamesFull[dayIndex];
  const isWeekend = dayIndex === 0 || dayIndex === 6;
  const isWeekday = dayIndex >= 1 && dayIndex <= 5;

  const freq = habit.frequency;

  if (freq === 'daily' || habit.targetDaysPerWeek === 7) {
    return true;
  }
  if (freq === 'weekdays') {
    return isWeekday;
  }
  if (freq === 'weekends') {
    return isWeekend;
  }
  if (freq === 'custom') {
    if (habit.customDays && habit.customDays.length > 0) {
      if (habit.customDays.length >= 7) return true;
      return habit.customDays.some(cd => {
        const normalized = cd.trim().toLowerCase();
        return (
          normalized === shortName.toLowerCase() ||
          normalized === fullName.toLowerCase() ||
          normalized === shortName.toLowerCase().slice(0, 2) ||
          normalized === shortName.toLowerCase().slice(0, 3)
        );
      });
    }
    // If targetDaysPerWeek is specified as 7
    if (habit.targetDaysPerWeek && habit.targetDaysPerWeek >= 7) {
      return true;
    }
    // If custom frequency without specified customDays, return true so habits aren't hidden
    return true;
  }

  return true;
}

/**
 * Returns a human-readable label for a habit's frequency schedule.
 */
export function getHabitFrequencyLabel(habit: Habit): string {
  if (habit.frequency === 'daily' || habit.targetDaysPerWeek === 7 || (habit.customDays && habit.customDays.length >= 7)) {
    return 'Daily';
  }
  if (habit.frequency === 'weekdays') {
    return 'Weekdays';
  }
  if (habit.frequency === 'weekends') {
    return 'Weekends';
  }
  if (habit.frequency === 'custom') {
    if (habit.customDays && habit.customDays.length > 0) {
      if (habit.customDays.length >= 7) return 'Daily';
      return habit.customDays.map(d => d.slice(0, 2)).join(', ');
    }
    if (habit.targetDaysPerWeek) {
      return `${habit.targetDaysPerWeek} Days/Week`;
    }
    return 'Specific Days';
  }
  return 'Daily';
}

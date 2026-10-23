import { ScheduleItem } from '../types';

/**
 * Checks if a ScheduleItem occurs on a given date (YYYY-MM-DD),
 * taking into account one-time and recurring schedule rules.
 */
export function isScheduleItemOnDate(item: ScheduleItem, targetDate: string): boolean {
  if (item.date === targetDate) {
    return true;
  }

  const repeat = item.repeatType;
  if (!repeat || repeat === 'none') {
    return false;
  }

  // Cannot repeat before the event's start date
  if (targetDate < item.date) {
    return false;
  }

  const startDate = new Date(item.date + 'T00:00:00');
  const target = new Date(targetDate + 'T00:00:00');
  if (isNaN(startDate.getTime()) || isNaN(target.getTime())) {
    return false;
  }

  // Check repeatUntil boundary
  const until = item.repeatUntil || 'forever';
  if (until !== 'forever') {
    let limitDays = 30;
    if (until === '3_months') limitDays = 90;
    else if (until === '6_months') limitDays = 180;
    else if (until === '1_year') limitDays = 365;

    const limitDate = new Date(startDate.getTime() + limitDays * 86400000);
    if (target.getTime() > limitDate.getTime()) {
      return false;
    }
  }

  const diffMs = target.getTime() - startDate.getTime();
  const diffDays = Math.round(diffMs / 86400000);

  switch (repeat) {
    case 'daily':
      return true;

    case 'weekdays': {
      const dayOfWeek = target.getDay(); // 0 = Sun, 6 = Sat
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    }

    case 'weekly':
      return diffDays % 7 === 0;

    case 'biweekly':
      return diffDays % 14 === 0;

    case 'monthly': {
      const startDay = startDate.getDate();
      const targetDay = target.getDate();
      return startDay === targetDay;
    }

    case 'yearly': {
      return (
        startDate.getMonth() === target.getMonth() &&
        startDate.getDate() === target.getDate()
      );
    }

    default:
      return false;
  }
}

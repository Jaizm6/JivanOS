import { TaskItem, EisenhowerQuadrant } from '../types';

export const getTaskQuadrantTier = (task: TaskItem): number => {
  if (!task) return 4;
  const q = task.quadrant;
  if (q === 'urgent_important') return 1;      // DO
  if (q === 'not_urgent_important') return 2;  // PLAN
  if (q === 'urgent_not_important') return 3;  // PASS
  if (q === 'not_urgent_not_important' || q === 'neither') return 4; // SKIP

  // Fallback based on priority if quadrant is empty
  if (task.priority === 'high') return 1;     // DO
  if (task.priority === 'medium') return 2;   // PLAN
  if (task.priority === 'low') return 3;      // PASS
  return 4;                                   // SKIP
};

export const getQuadrantLabel = (quadrant?: EisenhowerQuadrant | string): { name: string; tag: string; badgeBg: string; textCol: string } => {
  switch (quadrant) {
    case 'urgent_important':
      return { name: 'Do', tag: 'DO', badgeBg: 'bg-rose-500 text-white dark:bg-rose-600', textCol: 'text-rose-600 dark:text-rose-400' };
    case 'not_urgent_important':
      return { name: 'Plan', tag: 'PLAN', badgeBg: 'bg-amber-500 text-white dark:bg-amber-600', textCol: 'text-amber-600 dark:text-amber-400' };
    case 'urgent_not_important':
      return { name: 'Pass', tag: 'PASS', badgeBg: 'bg-blue-500 text-white dark:bg-blue-600', textCol: 'text-blue-600 dark:text-blue-400' };
    case 'not_urgent_not_important':
    case 'neither':
    default:
      return { name: 'Skip', tag: 'SKIP', badgeBg: 'bg-emerald-500 text-white dark:bg-emerald-600', textCol: 'text-emerald-600 dark:text-emerald-400' };
  }
};

/**
 * Sorts tasks strictly following:
 * Primary: Category Tier (DO = 1 -> PLAN = 2 -> PASS = 3 -> SKIP = 4)
 * Secondary: User Weight / Rank / Order number (descending: largest weight first)
 * Tertiary: Priority (High -> Medium -> Low)
 * Quaternary: Due date & time (Earlier first)
 * Quinary: Created timestamp (Newest first)
 */
export const getTaskWeight = (t?: Partial<TaskItem> | null): number => {
  if (!t) return 0;
  const w = Number(t.weight);
  if (!isNaN(w) && w > 0) return w;
  const r = Number(t.rank);
  if (!isNaN(r) && r > 0) return r;
  const o = Number(t.order);
  if (!isNaN(o) && o > 0) return o;
  const dr = Number((t as any)._displayRank);
  if (!isNaN(dr) && dr > 0) return dr;
  const er = Number((t as any)._effectiveRank);
  if (!isNaN(er) && er > 0) return er;
  return 0;
};

export const getSingleTaskDateReminder = (task: TaskItem) => {
  const primaryDate = task.dueDate || (task.dates && task.dates[0]) || (task.dateSchedules && task.dateSchedules[0]?.date);
  if (!primaryDate) return null;
  const primaryTime = task.dueTime || (task.dateSchedules && task.dateSchedules[0]?.dueTime) || (task.alerts && task.alerts[0]?.time);

  try {
    const [y, m, d] = primaryDate.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[m - 1] || '';
    const dateFormatted = `${d} ${month}`;
    const timeFormatted = primaryTime ? primaryTime : '';
    return {
      dateStr: primaryDate,
      display: timeFormatted ? `${dateFormatted} • ${timeFormatted}` : dateFormatted,
      isOverdue: !task.completed && primaryDate < new Date().toISOString().split('T')[0],
      hasReminder: !!primaryTime || (task.alerts && task.alerts.length > 0) || (task.dateSchedules && task.dateSchedules.some(ds => ds.alerts && ds.alerts.length > 0)),
    };
  } catch {
    return {
      dateStr: primaryDate,
      display: primaryDate,
      isOverdue: false,
      hasReminder: false,
    };
  }
};

export const compareTasksByDoPlanPassSkip = (a: TaskItem, b: TaskItem): number => {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const tierA = getTaskQuadrantTier(a);
  const tierB = getTaskQuadrantTier(b);

  // 1. Category Tier: DO (1) -> PLAN (2) -> PASS (3) -> SKIP (4)
  if (tierA !== tierB) {
    return tierA - tierB;
  }

  // 2. Weight inside quadrant: Biggest number = highest weight = FIRST in list (descending order)
  // Tasks with no assigned weight come LAST
  const weightA = getTaskWeight(a);
  const weightB = getTaskWeight(b);

  if (weightA !== weightB) {
    if (weightA === 0) return 1;  // a has no weight, goes after b
    if (weightB === 0) return -1; // b has no weight, goes after a
    return weightB - weightA;      // descending: larger weight first
  }

  // 3. Priority fallback (high -> medium -> low)
  const priorityOrder: Record<string, number> = { high: 1, medium: 2, low: 3 };
  const pA = (a.priority && priorityOrder[a.priority]) || 2;
  const pB = (b.priority && priorityOrder[b.priority]) || 2;
  if (pA !== pB) {
    return pA - pB;
  }

  // 4. Due Date
  const dueA = typeof a.dueDate === 'string' ? a.dueDate : '';
  const dueB = typeof b.dueDate === 'string' ? b.dueDate : '';
  if (dueA && dueB) {
    const dateDiff = dueA.localeCompare(dueB);
    if (dateDiff !== 0) return dateDiff;
    const timeA = typeof a.dueTime === 'string' ? a.dueTime : '';
    const timeB = typeof b.dueTime === 'string' ? b.dueTime : '';
    if (timeA && timeB) {
      const timeDiff = timeA.localeCompare(timeB);
      if (timeDiff !== 0) return timeDiff;
    }
  } else if (dueA) {
    return -1;
  } else if (dueB) {
    return 1;
  }

  // 5. Created Time
  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  const validTimeA = isNaN(timeA) ? 0 : timeA;
  const validTimeB = isNaN(timeB) ? 0 : timeB;
  return validTimeB - validTimeA;
};

export const sortTasksByDoPlanPassSkip = (taskList: TaskItem[]): TaskItem[] => {
  if (!Array.isArray(taskList)) return [];
  return [...taskList].sort(compareTasksByDoPlanPassSkip);
};

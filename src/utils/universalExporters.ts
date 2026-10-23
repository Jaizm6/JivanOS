import {
  TaskItem,
  JournalEntry,
  ScheduleItem,
  Habit,
  Medication,
  DoseLog,
  Bill,
  Goal,
  Quote,
} from '../types';

/**
 * Universal browser file download trigger
 */
export function triggerFileDownload(filename: string, content: string, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Escape CSV field values safely
 */
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// ==========================================
// 1. TASKS EXPORTERS
// ==========================================

/**
 * Super Productivity JSON format
 * Directly importable in Super Productivity (File -> Import -> Import from Super Productivity)
 */
export function exportTasksSuperProductivity(tasks: TaskItem[]): string {
  const taskEntities: Record<string, any> = {};
  const taskIds: string[] = [];

  tasks.forEach((t) => {
    taskIds.push(t.id);
    taskEntities[t.id] = {
      id: t.id,
      title: t.title,
      notes: t.notes || '',
      isDone: t.completed,
      subTaskIds: t.subtasks ? t.subtasks.map((s) => s.id) : [],
      timeEstimate: (t.estimatedPomodoros || 1) * 25 * 60 * 1000,
      timeSpent: (t.completedPomodoros || 0) * 25 * 60 * 1000,
      tagIds: t.tags || [],
      created: t.createdAt ? new Date(t.createdAt).getTime() : Date.now(),
      dueDate: t.dueDate || undefined,
      priority: t.priority === 'high' ? 1 : t.priority === 'medium' ? 2 : 3,
    };
  });

  const superProductivityData = {
    project: {
      projects: [
        {
          id: 'OMNI_LIFE_PROJECT',
          title: 'OmniLifeOS Tasks',
          taskIds: taskIds,
        },
      ],
    },
    task: {
      ids: taskIds,
      entities: taskEntities,
    },
    version: '10.0.0',
    exportedAt: new Date().toISOString(),
  };

  return JSON.stringify(superProductivityData, null, 2);
}

/**
 * Todoist CSV format
 * Formatted to match Todoist standard CSV import:
 * TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE
 */
export function exportTasksTodoist(tasks: TaskItem[]): string {
  const headers = ['TYPE', 'CONTENT', 'DESCRIPTION', 'PRIORITY', 'INDENT', 'AUTHOR', 'RESPONSIBLE', 'DATE', 'DATE_LANG', 'TIMEZONE'];
  const rows: string[] = [headers.join(',')];

  tasks.forEach((t) => {
    // Todoist priority: 4 is Urgent/High, 3 is Medium, 2 is Low, 1 is Natural
    const priority = t.priority === 'high' ? '4' : t.priority === 'medium' ? '3' : '1';
    const dateStr = t.dueDate ? (t.dueTime ? `${t.dueDate} ${t.dueTime}` : t.dueDate) : '';
    
    rows.push([
      escapeCsv('task'),
      escapeCsv(t.title),
      escapeCsv(t.notes || ''),
      escapeCsv(priority),
      escapeCsv('1'),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(dateStr),
      escapeCsv('en'),
      escapeCsv(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'),
    ].join(','));

    // Subtasks with indent 2
    if (t.subtasks && t.subtasks.length > 0) {
      t.subtasks.forEach((st) => {
        rows.push([
          escapeCsv('task'),
          escapeCsv(st.title),
          escapeCsv(''),
          escapeCsv('1'),
          escapeCsv('2'),
          escapeCsv(''),
          escapeCsv(''),
          escapeCsv(''),
          escapeCsv('en'),
          escapeCsv(''),
        ].join(','));
      });
    }
  });

  return rows.join('\r\n');
}

/**
 * Google Tasks JSON / CSV format
 */
export function exportTasksGoogleTasks(tasks: TaskItem[]): string {
  const formatted = {
    kind: 'tasks#tasks',
    items: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      notes: t.notes || '',
      status: t.completed ? 'completed' : 'needsAction',
      due: t.dueDate ? `${t.dueDate}T00:00:00.000Z` : undefined,
      completed: t.completedAt || (t.completed ? new Date().toISOString() : undefined),
      deleted: false,
      hidden: false,
      subtasks: t.subtasks?.map((s) => ({ title: s.title, completed: s.completed })) || [],
    })),
  };
  return JSON.stringify(formatted, null, 2);
}

/**
 * Markdown Checklist (.md) format
 * Compatible with Obsidian, Logseq, Notion, GitHub
 */
export function exportTasksMarkdown(tasks: TaskItem[]): string {
  const lines: string[] = [
    `# OmniLifeOS Tasks Export`,
    `> Exported on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
    ``,
    `## Pending Tasks`,
  ];

  const pending = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  if (pending.length === 0) {
    lines.push(`_No pending tasks._`);
  } else {
    pending.forEach((t) => {
      const meta: string[] = [];
      if (t.dueDate) meta.push(`due: ${t.dueDate}${t.dueTime ? ` ${t.dueTime}` : ''}`);
      if (t.priority) meta.push(`priority: ${t.priority}`);
      if (t.tags && t.tags.length > 0) meta.push(t.tags.map((tg) => `#${tg}`).join(' '));
      const metaStr = meta.length > 0 ? ` (${meta.join(' | ')})` : '';
      lines.push(`- [ ] **${t.title}**${metaStr}`);
      if (t.notes) lines.push(`  > ${t.notes.replace(/\n/g, '\n  > ')}`);
      if (t.subtasks && t.subtasks.length > 0) {
        t.subtasks.forEach((st) => {
          lines.push(`  - [${st.completed ? 'x' : ' '}] ${st.title}`);
        });
      }
    });
  }

  lines.push(``, `## Completed Tasks`);
  if (completed.length === 0) {
    lines.push(`_No completed tasks._`);
  } else {
    completed.forEach((t) => {
      lines.push(`- [x] ~~${t.title}~~ (completed on ${t.dueDate || 'archived'})`);
    });
  }

  return lines.join('\n');
}

// ==========================================
// 2. JOURNAL EXPORTERS
// ==========================================

/**
 * Obsidian / Logseq / Day One compatible Markdown Bundle (.md)
 */
export function exportJournalMarkdown(entries: JournalEntry[]): string {
  const parts: string[] = [
    `# Personal Journal Archive`,
    `> Total entries: ${entries.length} • Exported on ${new Date().toLocaleString()}`,
    ``,
  ];

  entries.forEach((e) => {
    parts.push(`---`);
    parts.push(`title: "${e.title.replace(/"/g, '\\"')}"`);
    parts.push(`date: ${e.date}`);
    parts.push(`mood: ${e.mood || 'neutral'}`);
    if (e.energyLevel) parts.push(`energy: ${e.energyLevel}`);
    if (e.tags && e.tags.length > 0) parts.push(`tags: [${e.tags.map((t) => `"${t}"`).join(', ')}]`);
    parts.push(`created: ${e.createdAt || e.date}`);
    parts.push(`---`);
    parts.push(``);
    parts.push(`# ${e.title}`);
    parts.push(`**Date:** ${e.date} | **Mood:** ${e.mood} | **Energy Level:** ${e.energyLevel || 'N/A'}`);
    parts.push(``);
    parts.push(e.content || '_No text written_');
    parts.push(``);
    if (e.gratitudeList && e.gratitudeList.length > 0) {
      parts.push(`### Gratitude`);
      e.gratitudeList.forEach((g) => parts.push(`- ${g}`));
      parts.push(``);
    }
    parts.push(``);
    parts.push(`***`);
    parts.push(``);
  });

  return parts.join('\n');
}

/**
 * iCalendar (.ics) for Journal Entries
 */
export function exportJournalICal(entries: JournalEntry[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OmniLifeOS//Personal Journal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:OmniLifeOS Journal',
  ];

  entries.forEach((entry) => {
    const dateFormatted = entry.date.replace(/-/g, '');
    const cleanTitle = (entry.title || 'Journal Entry').replace(/[,;\n]/g, ' ');
    const previewContent = (entry.content || '')
      .replace(/\r?\n/g, '\\n')
      .replace(/[,;]/g, ' ')
      .slice(0, 400);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:journal_${entry.id}_omnilife@local`);
    lines.push(`DTSTAMP:${dateFormatted}T090000Z`);
    lines.push(`DTSTART;VALUE=DATE:${dateFormatted}`);
    lines.push(`DTEND;VALUE=DATE:${dateFormatted}`);
    lines.push(`SUMMARY:📝 ${cleanTitle}`);
    lines.push(`DESCRIPTION:Mood: ${entry.mood || 'N/A'}\\nEnergy: ${entry.energyLevel || 'N/A'}\\n\\n${previewContent}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('CATEGORIES:Journal,Reflection');
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// ==========================================
// 3. PLANNER & CALENDAR EXPORTERS
// ==========================================

/**
 * RFC 5545 iCalendar (.ics)
 * Directly importable into Google Calendar, Apple Calendar, Outlook, Notion Calendar
 */
export function exportPlannerICal(items: ScheduleItem[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OmniLifeOS//Planner & Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:OmniLifeOS Schedule',
  ];

  items.forEach((item) => {
    const dateClean = item.date.replace(/-/g, '');
    const startHour = (item.startTime || '09:00').replace(':', '') + '00';
    const endHour = (item.endTime || '10:00').replace(':', '') + '00';

    const cleanTitle = (item.title || 'Scheduled Event').replace(/[,;\n]/g, ' ');
    const cleanNotes = (item.notes || '').replace(/\r?\n/g, '\\n').replace(/[,;]/g, ' ');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:event_${item.id}@omnilifeos`);
    lines.push(`DTSTAMP:${dateClean}T${startHour}Z`);
    if (item.isAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${dateClean}`);
      lines.push(`DTEND;VALUE=DATE:${dateClean}`);
    } else {
      lines.push(`DTSTART:${dateClean}T${startHour}`);
      lines.push(`DTEND:${dateClean}T${endHour}`);
    }
    lines.push(`SUMMARY:${cleanTitle}`);
    if (cleanNotes) lines.push(`DESCRIPTION:${cleanNotes}`);
    if (item.location) lines.push(`LOCATION:${item.location.replace(/[,;]/g, ' ')}`);
    lines.push(`CATEGORIES:${item.category || 'General'}`);
    lines.push(`STATUS:${item.completed ? 'COMPLETED' : 'CONFIRMED'}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Schedule Agenda CSV
 */
export function exportPlannerCsv(items: ScheduleItem[]): string {
  const headers = ['Date', 'Start Time', 'End Time', 'Title', 'Category', 'Priority', 'Completed', 'Notes', 'Location'];
  const rows: string[] = [headers.join(',')];

  items.forEach((item) => {
    rows.push([
      escapeCsv(item.date),
      escapeCsv(item.startTime),
      escapeCsv(item.endTime),
      escapeCsv(item.title),
      escapeCsv(item.category),
      escapeCsv(item.priority),
      escapeCsv(item.completed ? 'Yes' : 'No'),
      escapeCsv(item.notes || ''),
      escapeCsv(item.location || ''),
    ].join(','));
  });

  return rows.join('\r\n');
}

// ==========================================
// 4. HABITS EXPORTERS
// ==========================================

/**
 * Loop Habit Tracker / Habitica CSV
 */
export function exportHabitsCsv(habits: Habit[]): string {
  const headers = [
    'Habit Name',
    'Category',
    'Frequency',
    'Target Days Per Week',
    'Current Streak',
    'Best Streak',
    'Total Check-ins',
    'Created Date',
    'Notes',
  ];
  const rows: string[] = [headers.join(',')];

  habits.forEach((h) => {
    const totalCompletions = Object.values(h.completionHistory || {}).filter(Boolean).length;
    rows.push([
      escapeCsv(h.name),
      escapeCsv(h.category),
      escapeCsv(h.frequency),
      escapeCsv(h.targetDaysPerWeek),
      escapeCsv(h.currentStreak || 0),
      escapeCsv(h.bestStreak || 0),
      escapeCsv(totalCompletions),
      escapeCsv(h.createdAt || ''),
      escapeCsv(h.notes || ''),
    ].join(','));
  });

  return rows.join('\r\n');
}

// ==========================================
// 5. MEDICATIONS EXPORTERS
// ==========================================

/**
 * Medisafe / MyTherapy / Apple Health compatible CSV
 */
export function exportMedicationsCsv(medications: Medication[], doseLogs: DoseLog[] = []): string {
  const headers = [
    'Medication Name',
    'Dosage',
    'Instructions',
    'Frequency',
    'Scheduled Times',
    'Total Inventory',
    'Remaining Pills',
    'Refill Threshold',
    'Start Date',
    'Active Status',
  ];
  const rows: string[] = [headers.join(',')];

  medications.forEach((m) => {
    const schedulesStr = (m.schedules || []).map((s) => `${s.time} (${s.label})`).join('; ');
    rows.push([
      escapeCsv(m.name),
      escapeCsv(m.dosage),
      escapeCsv(m.instructions),
      escapeCsv(m.frequency),
      escapeCsv(schedulesStr),
      escapeCsv(m.totalPills),
      escapeCsv(m.remainingPills),
      escapeCsv(m.refillThreshold),
      escapeCsv(m.startDate),
      escapeCsv(m.active ? 'Active' : 'Inactive'),
    ].join(','));
  });

  return rows.join('\r\n');
}

/**
 * Printable Doctor Consultation Schedule
 */
export function exportMedicationsPrintable(medications: Medication[]): string {
  const lines: string[] = [
    `# Medical Prescriptions & Medication Schedule`,
    `> Generated from OmniLifeOS on ${new Date().toLocaleDateString()}`,
    ``,
    `| Medication | Dosage | Frequency & Times | Instructions | Stock Left |`,
    `| :--- | :--- | :--- | :--- | :--- |`,
  ];

  medications
    .filter((m) => m.active)
    .forEach((m) => {
      const times = (m.schedules || []).map((s) => s.time).join(', ');
      lines.push(
        `| **${m.name}** | ${m.dosage} | ${m.frequency} (${times}) | ${m.instructions || 'As prescribed'} | ${m.remainingPills} pills left |`
      );
    });

  lines.push(``, `---`, `*Note: Bring this list to your primary healthcare provider or pharmacist during consultations.*`);
  return lines.join('\n');
}

// ==========================================
// 6. BILLS & SUBSCRIPTIONS EXPORTERS
// ==========================================

/**
 * YNAB / Mint / Spreadsheet Personal Finance CSV
 */
export function exportBillsCsv(bills: Bill[]): string {
  const headers = ['Bill Name', 'Category', 'Amount', 'Currency', 'Due Date', 'Recurring Cycle', 'Auto Pay', 'Status', 'Notes'];
  const rows: string[] = [headers.join(',')];

  bills.forEach((b) => {
    rows.push([
      escapeCsv(b.title),
      escapeCsv(b.category),
      escapeCsv(b.amount),
      escapeCsv(b.currency || 'USD'),
      escapeCsv(b.dueDate),
      escapeCsv(b.recurring),
      escapeCsv(b.autoPay ? 'Yes' : 'No'),
      escapeCsv(b.isPaid ? 'Paid' : 'Unpaid'),
      escapeCsv(b.notes || ''),
    ].join(','));
  });

  return rows.join('\r\n');
}

// ==========================================
// 7. GOALS & OKRs EXPORTERS
// ==========================================

/**
 * Notion / ClickUp Goals CSV
 */
export function exportGoalsCsv(goals: Goal[]): string {
  const headers = ['Goal Title', 'Category', 'Progress (%)', 'Status', 'Target Date', 'Milestones Count', 'Description'];
  const rows: string[] = [headers.join(',')];

  goals.forEach((g) => {
    rows.push([
      escapeCsv(g.title),
      escapeCsv(g.category),
      escapeCsv(g.progress),
      escapeCsv(g.status),
      escapeCsv(g.targetDate),
      escapeCsv(g.milestones?.length || 0),
      escapeCsv(g.description || ''),
    ].join(','));
  });

  return rows.join('\r\n');
}

// ==========================================
// 8. QUOTES EXPORTERS
// ==========================================

export function exportQuotesCsv(quotes: Quote[]): string {
  const headers = ['Quote', 'Author', 'Category', 'Source'];
  const rows: string[] = [headers.join(',')];

  quotes.forEach((q) => {
    rows.push([
      escapeCsv(q.text),
      escapeCsv(q.author || 'Unknown'),
      escapeCsv(q.category || 'Wisdom'),
      escapeCsv(q.source || ''),
    ].join(','));
  });

  return rows.join('\r\n');
}

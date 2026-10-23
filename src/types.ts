export type AppTheme = 'dark' | 'light';
export type ThemeStyle = 'bento';
export type AccentTone = 'indigo' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'violet';

export type ActiveTab =
  | 'planner'
  | 'timeline'
  | 'tasks'
  | 'calendar'
  | 'schedule'
  | 'habits'
  | 'goals'
  | 'medications'
  | 'bills'
  | 'quotes'
  | 'journal'
  | 'analytics'
  | 'tools'
  | 'settings'
  | 'dashboard';

export type ReminderType = 'none' | 'notification' | 'alarm';
export type AlarmToneType = 'dual_bell' | 'melody' | 'urgent' | 'chime' | 'drop' | 'drip';

export type InboxItemType = 'task' | 'thought' | 'reminder' | 'note' | 'link';
export type InboxItemPriority = 'high' | 'medium' | 'low';

export interface InboxItem {
  id: string;
  title: string;
  details?: string;
  type: InboxItemType;
  priority: InboxItemPriority;
  contextTag?: string;
  createdAt: string;
  dueDate?: string;
  isCompleted?: boolean;
  isArchived?: boolean;
  isStarred?: boolean;
  convertedTo?: 'task' | 'goal' | 'journal';
}

export type ScheduleCategory =
  | 'work'
  | 'meeting'
  | 'health'
  | 'personal'
  | 'focus'
  | 'errand'
  | 'routine';

export type ScheduleViewTemplate = 'hourly' | 'priority' | 'deadline' | 'printable';

export interface ScheduleItem {
  id: string;
  title: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "08:00"
  endTime: string; // "09:00"
  category: ScheduleCategory;
  priority: Priority;
  completed: boolean;
  notes?: string;
  taskId?: string;
  goalId?: string;
  location?: string;
  isAllDay?: boolean;
  reminderType?: ReminderType;
  reminderTiming?: string;
  repeatType?: string; // 'none' | 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  repeatUntil?: string; // 'forever' | '1_month' | '3_months' | '6_months' | '1_year'
  createdAt: string;
}

export interface WorkflowStage {
  id: string;
  label: string;
  color: string;
  order?: number;
}

export type Priority = 'high' | 'medium' | 'low';

export type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'review' | 'done' | (string & {});

export type EisenhowerQuadrant =
  | 'urgent_important' // Q1: DO (Urg & Imp)
  | 'not_urgent_important' // Q2: PLAN (Imp)
  | 'urgent_not_important' // Q3: PASS (Urg)
  | 'not_urgent_not_important' // Q4: SKIP (Neither)
  | 'neither';

export type MedicationFrequency =
  | 'daily'
  | 'twice_daily'
  | 'thrice_daily'
  | 'alternate_days'
  | 'every_3_days'
  | 'every_4_days'
  | 'every_5_days'
  | 'every_6_days'
  | 'weekly_days'
  | 'weekly'
  | 'as_needed'
  | 'custom_dates';

export interface DoseSchedule {
  time: string; // "08:00"
  label: string; // "Morning Dose"
  reminderType?: ReminderType;
}

export interface DoseLog {
  id: string;
  medicationId: string;
  medicationName: string;
  scheduledTime: string;
  loggedAt: string;
  status: 'taken' | 'skipped' | 'snoozed';
  notes?: string;
}

export interface MedicationCustomDateTime {
  id: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  label?: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string; // "500 mg", "1 tablet", "5 ml"
  instructions: string; // "After food", "With water"
  frequency: MedicationFrequency;
  customDays?: string[]; // e.g. ['Mon', 'Wed', 'Fri']
  schedules: DoseSchedule[];
  color: string;
  iconType: 'pill' | 'capsule' | 'drop' | 'injection' | 'inhaler';
  totalPills: number;
  remainingPills: number;
  refillThreshold: number;
  startDate: string;
  endDate?: string; // Optional treatment end date / course completion
  active: boolean;
  reminderType?: ReminderType;
  customDateTimes?: MedicationCustomDateTime[];
}

export interface HydrationLog {
  id: string;
  amount: number;
  unit: string;
  amountMl: number; // Normalized for calculations
  timestamp: string;
}

export interface HydrationState {
  targetMl: number;
  preferredUnit: string; // User's logging preference ('ml' | 'litres')
  todayLogs: HydrationLog[];
  reminderIntervalHours: number;
  reminderEnabled: boolean;
  adaptiveRemindersEnabled?: boolean;
  lastAdaptiveReminderTime?: string;
  intakePerClick?: number;
}

export type TaskAlertType =
  | 'on_time'
  | '5m'
  | '10m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '1d'
  | 'custom';

export interface TaskAlert {
  id: string;
  type: TaskAlertType;
  time?: string;
  date?: string; // "YYYY-MM-DD"
  customDateTime?: string; // "YYYY-MM-DDTHH:mm"
  label?: string;
  triggered?: boolean;
  reminderType?: ReminderType;
}

export interface ListGroup {
  id: string;
  name: string;
  color?: string;
  collapsed?: boolean;
  order?: number;
}

export interface TodoList {
  id: string;
  name: string;
  groupId: string; // references ListGroup.id
  color: string;
  icon?: string;
  excludeFromAll?: boolean; // excluded from "All Focus" list (e.g. Someday / Backlog)
  isDefaultInbox?: boolean;
  defaultPriority?: Priority;
  order?: number;
  createdAt?: string;
}

export type SmartListPreset =
  | 'all'
  | 'inbox'
  | 'today'
  | 'upcoming'
  | 'starred'
  | 'recurring'
  | 'someday'
  | 'completed';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface DefaultSuggestedTag {
  name: string;
  color: string;
  icon: string;
}

export interface TaskCategory {
  id: string;
  name: string;
  color: string;
  bgColor?: string;
  textColor?: string;
  borderColor?: string;
  dotColor?: string;
  icon: string;
}

export const DEFAULT_SUGGESTED_TAGS: DefaultSuggestedTag[] = [
  { name: 'Work', color: '#3b82f6', icon: '💼' },
  { name: 'Personal', color: '#10b981', icon: '🏠' },
  { name: 'Health', color: '#f43f5e', icon: '❤️' },
  { name: 'Finance', color: '#f59e0b', icon: '💰' },
  { name: 'Education', color: '#8b5cf6', icon: '📚' },
  { name: 'Errands', color: '#06b6d4', icon: '🛒' },
];

export const DEFAULT_TASK_CATEGORIES: TaskCategory[] = [
  { id: 'work', name: 'Work', color: '#3b82f6', bgColor: 'bg-blue-50/50 dark:bg-blue-950/20', textColor: 'text-blue-700 dark:text-blue-400', borderColor: 'border-blue-100 dark:border-blue-900/50', dotColor: 'bg-blue-500', icon: '💼' },
  { id: 'personal', name: 'Personal', color: '#10b981', bgColor: 'bg-emerald-50/50 dark:bg-emerald-950/20', textColor: 'text-emerald-700 dark:text-emerald-400', borderColor: 'border-emerald-100 dark:border-emerald-900/50', dotColor: 'bg-emerald-500', icon: '🏠' },
  { id: 'health', name: 'Health', color: '#f43f5e', bgColor: 'bg-rose-50/50 dark:bg-rose-950/20', textColor: 'text-rose-700 dark:text-rose-400', borderColor: 'border-rose-100 dark:border-rose-900/50', dotColor: 'bg-rose-500', icon: '❤️' },
  { id: 'finance', name: 'Finance', color: '#f59e0b', bgColor: 'bg-amber-50/50 dark:bg-amber-950/20', textColor: 'text-amber-700 dark:text-amber-400', borderColor: 'border-amber-100 dark:border-amber-900/50', dotColor: 'bg-amber-500', icon: '💰' },
  { id: 'education', name: 'Education', color: '#8b5cf6', bgColor: 'bg-purple-50/50 dark:bg-purple-950/20', textColor: 'text-purple-700 dark:text-purple-400', borderColor: 'border-purple-100 dark:border-purple-900/50', dotColor: 'bg-purple-500', icon: '📚' },
  { id: 'errands', name: 'Errands', color: '#06b6d4', bgColor: 'bg-cyan-50/50 dark:bg-cyan-950/20', textColor: 'text-cyan-700 dark:text-cyan-400', borderColor: 'border-cyan-100 dark:border-cyan-900/50', dotColor: 'bg-cyan-500', icon: '🛒' },
];

export interface TaskItem {
  id: string;
  title: string;
  notes?: string;
  priority: Priority;
  status: TaskStatus;
  quadrant: EisenhowerQuadrant;
  weight?: number; // Task Weight (numerical priority score)
  goalId?: string;
  listId?: string; // Reference to TodoList
  category?: string;
  project?: string;
  projectId?: string;
  dueDate: string; // "YYYY-MM-DD"
  dueTime?: string; // "14:00"
  dates?: string[]; // Multiple selected dates (YYYY-MM-DD)
  dateSchedules?: Array<{
    date: string;
    dueTime?: string;
    isAllDay?: boolean;
    alerts?: TaskAlert[];
  }>;
  isAllDay?: boolean;
  completed: boolean;
  completedAt?: string;
  subtasks: Subtask[];
  checklist?: Subtask[];
  estimatedPomodoros: number;
  completedPomodoros: number;
  recurring: 'none' | 'daily' | 'weekly' | 'weekdays' | 'biweekly' | 'monthly' | 'yearly';
  repeatType?: 'none' | 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom';
  repeatUntil?: 'forever' | string;
  endDate?: string; // Optional specific recurrence end date
  recurringReminder?: boolean;
  reminderType?: ReminderType;
  reminderTiming?: 'on_time' | '5m' | '10m' | '15m' | '30m' | '1h' | '1d' | 'custom';
  alerts?: TaskAlert[];
  tags?: string[];
  isStarred?: boolean;
  isSomeday?: boolean;
  location?: string;
  durationMinutes?: number;
  timeSpentMinutes?: number;
  deadline?: string;
  links?: { id: string; title: string; url: string }[];
  lastDueRemindedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  taskType?: 'goal';
  streak?: number;
  order?: number;
  rank?: number;
  color?: string;
  accentColor?: string;
  fontColor?: string;
  fontSize?: number | string;
  fontType?: 'sans' | 'mono' | 'serif' | 'rounded';
  isBold?: boolean;
}

export type HabitCategory = 'health' | 'fitness' | 'mind' | 'productivity' | 'learning' | 'routine';
export type HabitFrequency = 'daily' | 'weekdays' | 'weekends' | 'custom';
export type HabitType = 'boolean' | 'timer' | 'counter' | 'quit' | 'measurement';

export interface RoutineItem {
  id: string;
  title: string;
  icon?: string;
  scheduledTime?: string; // e.g. "06:00"
  durationMinutes?: number; // e.g. 5, 10, 15
  completed?: boolean;
  color?: string;
  accentColor?: string;
  fontColor?: string;
  isBold?: boolean;
  cardTheme?: 'clean' | 'tinted' | 'gradient' | 'bordered';
  tags?: string[];
  reminderTime?: string;
  timerMinutes?: number;
}

export interface Routine {
  id: string;
  name: string;
  icon?: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'custom';
  items: RoutineItem[];
}

export interface HabitStep {
  id: string;
  text: string;
  completed?: boolean;
}

export interface Habit {
  id: string;
  name: string;
  icon?: string;
  category: HabitCategory;
  frequency: HabitFrequency;
  targetDaysPerWeek: number;
  targetTimeOfDay?: 'anytime' | 'morning' | 'afternoon' | 'evening';
  reminderTime?: string;
  reminderType?: ReminderType;
  timerMinutes?: number; // Optional duration (e.g. 15m meditation)
  durationMinutes?: number; // e.g. 30 min
  currentStreak: number;
  bestStreak: number;
  completionHistory: Record<string, boolean>; // "YYYY-MM-DD": true
  color: string;
  notes?: string;
  archived?: boolean;
  createdAt: string;
  goalId?: string;
  tags?: string[];
  // Habit type variants (quit habits, counters, timed habits)
  habitType?: HabitType;
  counterValue?: number;
  targetCount?: number;
  unit?: string;
  incrementStep?: number;
  syncHydration?: boolean;
  order?: number;
  logs?: { id: string; date: string; text: string }[];
  subSteps?: HabitStep[];
  doneWhen?: 'all' | 'any';
  customDays?: string[];
  customDateTimes?: MedicationCustomDateTime[];
  cardTheme?: 'clean' | 'tinted' | 'gradient' | 'bordered';
  periodicReminderEnabled?: boolean;
  periodicIntervalHours?: number;
  alertTone?: AlarmToneType;
  accentColor?: string;
  fontColor?: string;
  fontSize?: number | string;
  fontType?: 'sans' | 'mono' | 'serif' | 'rounded';
  isBold?: boolean;
}

export type GoalCategory = 'career' | 'health' | 'finance' | 'personal' | 'learning' | string;
export type GoalStatus = 'on_track' | 'at_risk' | 'completed' | 'behind';

export interface GoalMilestone {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  targetDate: string; // "YYYY-MM-DD"
  category: GoalCategory | string;
  tags?: string[];
  tag?: string;
  progress: number; // 0 - 100
  status: GoalStatus;
  milestones: GoalMilestone[];
  color: string;
  createdAt: string;
}

export interface AppTag {
  id: string;
  name: string;
  color?: string;
  description?: string;
  createdAt?: string;
}

export type BillCategory =
  | 'credit_card'
  | 'electricity'
  | 'water'
  | 'rent'
  | 'internet'
  | 'subscription'
  | 'insurance'
  | 'other';

export type BillRecurring = 'monthly' | 'yearly' | 'quarterly' | 'one_time';

export interface BillPaymentRecord {
  id: string;
  amount: number;
  paidAt: string;
  note?: string;
}

export interface Bill {
  id: string;
  title: string;
  category: BillCategory;
  amount: number;
  currency: string;
  dueDate: string; // "YYYY-MM-DD"
  recurring: BillRecurring;
  autoPay: boolean;
  isPaid: boolean;
  status?: 'unpaid' | 'paid' | 'overdue';
  paidDate?: string;
  accountNumberLast4?: string;
  notes?: string;
  reminderDaysBefore: number;
  reminderType?: ReminderType;
  paymentHistory: BillPaymentRecord[];
  color: string;
}

export type MoodType =
  | 'great'
  | 'good'
  | 'okay'
  | 'bad'
  | 'awful'
  | 'ecstatic'
  | 'calm'
  | 'neutral'
  | 'anxious'
  | 'down'
  | 'stressed';

export interface CBTEmotion {
  name: string;
  intensity: number; // 0 - 100
}

export interface CBTRecord {
  situation: string;
  automaticThoughts: string;
  emotions: CBTEmotion[];
  distortions: string[]; // e.g. ['Catastrophizing', 'Prediction', 'Black-and-white thinking']
  rationalReframe: string;
}

export interface JournalEntry {
  id: string;
  title: string;
  content: string; // Plain text or Markdown
  mood: MoodType;
  tags: string[];
  date: string; // "YYYY-MM-DD"
  createdAt: string;
  updatedAt: string;
  isEncrypted: boolean;
  cipherText?: string;
  iv?: string;
  salt?: string;
  isFavorite?: boolean;
  // Note-specific lock options
  isLocked?: boolean;
  lockType?: 'passcode' | 'pin' | 'biometric';
  itemPasscode?: string;
  // Gratitude and guided reflection
  gratitudeList?: string[];
  promptsUsed?: string[];
  selfCareChecked?: string[];
  // Draw and Paint doodle/sketch (Screenshot 3)
  drawingUrl?: string;
  // CBT Negative Mindsets Reframing (Screenshot 5)
  cbtRecord?: CBTRecord;
  // Energy options & media attachments (1=lowest, 5=highest)
  energyLevel?: 1 | 2 | 3 | 4 | 5 | 'very_high' | 'high' | 'medium' | 'low' | 'exhausted' | string;
  voiceNoteUrl?: string;
  voiceNoteDuration?: number;
  photoUrls?: string[];
  // Guided template type
  templateType?: 'morning' | 'evening' | 'positive' | 'cbt' | 'reflection' | 'freeform' | 'affirmation' | 'gratitude' | 'braindump';
}

export interface JournalAffirmation {
  id: string;
  text: string;
  category?: string;
  date: string;
  completedToday?: boolean;
  createdAt: string;
}

export interface AppLockConfig {
  isEnabled: boolean;
  lockType: 'passcode' | 'biometric' | 'both';
  type?: 'pin' | 'password' | 'biometric' | 'passcode' | 'both';
  passcode: string; // PIN e.g. "1234"
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  requireOnResume?: boolean;
  autoLockDelayMinutes: number; // 0 (instant), 1, 5, 15
  isLocked: boolean;
  systemEncryptionEnabled?: boolean;
  masterPassword?: string;
}

export type SupportedCurrency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'JPY' | 'CAD' | 'AUD';

export interface CurrencyItem {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  inrRate: number; // 1 unit in INR (e.g. 1 USD = ~86.5 INR)
}

export type ActionableItem =
  | {
      type: 'task';
      title: string;
      priority?: Priority;
      dueDate?: string;
      project?: string;
      notes?: string;
      subtasks?: string[];
      quadrant?: EisenhowerQuadrant;
    }
  | {
      type: 'habit';
      name: string;
      category?: HabitCategory;
      frequency?: HabitFrequency;
      targetDaysPerWeek?: number;
      timerMinutes?: number;
      color?: string;
      notes?: string;
    }
  | {
      type: 'bill';
      title: string;
      category?: BillCategory;
      amount?: number;
      currency?: string;
      dueDate?: string;
      recurring?: BillRecurring;
      autoPay?: boolean;
      notes?: string;
    }
  | {
      type: 'goal';
      title: string;
      category?: GoalCategory;
      targetDate?: string;
      milestones?: string[];
    };

export interface AIMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actionableItem?: ActionableItem;
}

export type WidgetId =
  | 'sync_status'
  | 'daily_summary'
  | 'meds_today'
  | 'hydration'
  | 'urgent_tasks'
  | 'habit_streaks'
  | 'upcoming_bills'
  | 'active_goals'
  | 'focus_timer'
  | 'quick_journal'
  | 'analytics_snapshot'
  | 'quote_stats';

export interface DashboardWidgetConfig {
  id: WidgetId;
  title: string;
  enabled: boolean;
  order: number;
  size: 'small' | 'medium' | 'large' | 'full';
}

export interface UserProfile {
  id: string;
  identifier: string;
  email?: string;
  name: string;
  nickname?: string;
  avatarPhoto?: string; // Compressed data URL (WebP/JPEG, ~10-25 KB)
  bio?: string;
  dateOfBirth?: string; // "YYYY-MM-DD"
  heightCm?: number;
  weightKg?: number;
  gender?: 'male' | 'female' | 'other' | 'unspecified';
  preferredCurrency?: SupportedCurrency;
  type: 'email' | 'phone';
  twoFactorEnabled: boolean;
  isPasscodeProtected: boolean;
  passcodeHash?: string;
  lastSyncedAt?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  category: 'medication' | 'water' | 'task' | 'journal' | 'bill' | 'bills' | 'habit' | 'system' | 'calendar' | 'quote';
  timestamp: string;
  scheduledTime?: string;
  read: boolean;
  actionUrl?: string;
  taskId?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface AlarmHistoryItem {
  id: string;
  alarmId: string;
  title: string;
  subtitle?: string;
  category: 'task' | 'medication' | 'bill' | 'habit' | 'schedule' | 'quote';
  triggeredAt: string;
  status: 'dismissed' | 'completed' | 'snoozed';
  snoozeCount?: number;
}

export type CloudBackupProvider =
  | 'firebase'
  | 'gdrive'
  | 'onedrive'
  | 'mega'
  | 'proton'
  | 'nextcloud'
  | 'webdav'
  | 'minio_s3'
  | 'omni_cloud'
  | 'local'
  | 'icloud'
  | 'dropbox';

export interface OpenSourceCloudConfig {
  provider: 'nextcloud' | 'webdav' | 'minio_s3';
  enabled: boolean;
  serverUrl: string;
  username: string;
  authSecret: string;
  s3AccessKey?: string;
  s3Bucket?: string;
  s3Region?: string;
  remotePath?: string;
  lastSyncedAt?: string;
}

export interface CloudBackupRecord {
  version: number;
  timestamp: string;
  source: 'manual' | 'auto';
  provider: CloudBackupProvider;
  sizeBytes: number;
}

export interface PomodoroSession {
  id: string;
  taskId?: string;
  taskTitle?: string;
  durationMinutes: number;
  mode: 'work' | 'break';
  completedAt: string;
}

export type { QuoteItem } from './data/quotes';
export type Quote = import('./data/quotes').QuoteItem;

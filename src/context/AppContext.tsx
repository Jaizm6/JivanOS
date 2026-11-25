import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from 'react';
import {
  AccentTone,
  ActionableItem,
  ActiveTab,
  AIMessage,
  AlarmHistoryItem,
  AppLockConfig,
  AppNotification,
  AppTag,
  AppTheme,
  Bill,
  CloudBackupProvider,
  DashboardWidgetConfig,
  DoseLog,
  EisenhowerQuadrant,
  Goal,
  Habit,
  HabitStep,
  HydrationState,
  InboxItem,
  JoplinSyncSettings,
  ListGroup,
  Medication,
  OpenSourceCloudConfig,
  PomodoroSession,
  Priority,
  Routine,
  RoutineItem,
  ScheduleItem,
  SyncDriveConfig,
  SyncDriveId,
  TaskItem,
  TaskStatus,
  ThemeStyle,
  TodoList,
  UserProfile,
  WorkflowStage,
} from '../types';
import {
  CURATED_QUOTES,
  DEFAULT_QUOTE_CATEGORIES,
  QuoteCategory,
  QuoteItem,
} from '../data/quotes';
import {
  applyQuoteSyncData,
  buildQuotesFromStorage,
  buildQuoteSyncData,
  canonicalizeQuoteSyncData,
  ensureQuoteMetaMigrated,
  isProhibitedQuote,
  loadQuoteMeta,
  loadStoredQuoteCategories,
  mergeQuoteSyncData,
  QUOTE_DELETED_KEY,
  QUOTE_EDITED_KEY,
  QUOTE_FAVORITES_KEY,
  readDeletedQuoteIdsFromStorage,
  saveQuoteMeta,
  saveStoredQuoteCategories,
} from '../utils/quoteSync';
import { contentHashSync, loadQuoteWasm } from '../utils/quoteWasm';
import { isCustomQuote } from '../utils/quoteText';
import { EXTRA_PALETTE_KEYS } from '../components/quotes/quoteColors';
import {
  defaultWidgets,
  initialAppLock,
  initialBills,
  initialGoals,
  initialHabits,
  initialHydration,
  initialInboxItems,
  initialListGroups,
  initialMedications,
  initialProfile,
  initialRoutines,
  initialScheduleItems,
  initialTasks,
  initialTodoLists,
} from '../utils/initialData';
import { notificationService } from '../utils/notifications';
import { soundEngine } from '../utils/audio';
import { haptics } from '../utils/haptics';
import { isScheduleItemOnDate } from '../utils/scheduleRecurrence';
import {
  autoSync as scheduleGoogleDriveAutoSync,
  backupToDrive,
  cachePayloadForBackgroundSync,
  getStoredDriveSyncMeta,
  silentReAuthGoogleDrive,
} from '../utils/googleDriveSync';
import {
  autoSync as scheduleDropboxAutoSync,
  backupToDropbox,
  cacheDropboxPayloadForBackgroundSync,
  connectDropbox,
  getStoredDropboxSyncMeta,
  silentReAuthDropbox,
} from '../utils/dropboxSync';
import { calculateHabitStreak, formatLocalDate } from '../utils/date';
import {
  auth,
  db,
  doc,
  onSnapshot,
  signInWithGoogle,
  connectGoogleDriveWithFirebase,
  getInMemoryGDriveToken,
  setInMemoryGDriveToken,
  clearInMemoryGDriveToken,
  getRedirectResult,
  firebaseSignOut,
  onAuthStateChanged,
  saveUserDataToFirestore,
  getUserDataFromFirestore,
  firebaseConfig,
  FirebaseUser,
} from '../lib/firebase';
import {
  DEFAULT_JOPLIN_SYNC_SETTINGS,
  mergeSyncPayloads,
  encodeSyncEnvelope,
  decodeSyncEnvelope,
  pullFromDrive,
  pushToDrive,
  pickLocalSyncDirectory,
  launchDriveOAuthPopup,
  testDriveConnection,
  fetchServerOAuthDefaults,
} from '../utils/joplinSyncEngine';
import {
  exportLocalBackup,
  listLocalSnapshots,
  saveRotatingAutoSnapshot,
  validateBackupPayload,
} from '../utils/localBackupEngine';
import { showAndroidToast } from '../components/common/AndroidToast';

export interface GlobalTimerState {
  activeId: string | null;
  type: 'task' | 'habit' | 'event' | null;
  mode: 'focus' | 'stopwatch' | 'break' | null;
  isRunning: boolean;
  timeElapsed: number; // For stopwatch
  timeRemaining: number; // For focus/break
  startedAt: number | null; // For accurate elapsed time
}

interface PomodoroState {
  taskId: string | null;
  timeRemaining: number;
  isRunning: boolean;
  mode: 'work' | 'break';
  initialDuration: number;
}

interface AppContextType {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
  themeStyle: ThemeStyle;
  setThemeStyle: (s: ThemeStyle) => void;
  accentTone: AccentTone;
  setAccentTone: (tone: AccentTone) => void;
  activeTab: ActiveTab;
  setActiveTab: (t: ActiveTab) => void;
  selectedDate: string;
  setSelectedDate: (dateStr: string) => void;

  // Inbox & Universal Capture
  inboxItems: InboxItem[];
  deletedIds: string[];
  addInboxItem: (item: Omit<InboxItem, 'id' | 'createdAt'>) => void;
  updateInboxItem: (id: string, updates: Partial<InboxItem>) => void;
  deleteInboxItem: (id: string) => void;
  toggleInboxItemComplete: (id: string) => void;
  convertInboxItemToTask: (id: string, taskUpdates?: Partial<TaskItem>) => void;

  // Profile & Auth
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  isLoggedIn: boolean;
  firebaseUser: FirebaseUser | null;
  authError: string | null;
  clearAuthError: () => void;
  login: (identifier: string, isPhone: boolean, require2FA?: boolean) => Promise<{ need2FA: boolean; devCode?: string }>;
  loginWithGoogle: () => Promise<boolean>;
  verify2FA: (code: string) => Promise<boolean>;
  logout: () => void;

  // Medications
  medications: Medication[];
  doseLogs: DoseLog[];
  addMedication: (med: Omit<Medication, 'id'>) => void;
  updateMedication: (med: Medication) => void;
  deleteMedication: (id: string) => void;
  logDose: (medicationId: string, scheduledTime: string, status: 'taken' | 'skipped' | 'snoozed') => void;
  unlogDose: (medicationId: string, scheduledTime: string, dateStr?: string) => void;
  refillPills: (medicationId: string, quantity: number) => void;

  // Hydration
  hydration: HydrationState;
  addWater: (amount: number, unit?: string) => void;
  setHydrationTarget: (targetMl: number, preferredUnit?: string) => void;
  setHydrationPreferredUnit: (unit: string) => void;
  setHydrationIntakePerClick: (amountMl: number) => void;
  toggleWaterReminder: (enabled: boolean, intervalHours?: number) => void;
  toggleAdaptiveWaterReminder: (enabled: boolean) => void;
  sendAdaptiveHydrationNotification: (force?: boolean) => {
    title: string;
    message: string;
    pace: 'ahead' | 'on_track' | 'behind' | 'goal_reached';
    deficitMl: number;
    progressPct: number;
  } | null;

  // Tasks (List, Kanban Workflow, Lists & Eisenhower Matrix modes)
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  listGroups: ListGroup[];
  todoLists: TodoList[];
  selectedListId: string;
  setSelectedListId: (id: string) => void;
  addListGroup: (group: Omit<ListGroup, 'id'>) => void;
  updateListGroup: (group: ListGroup) => void;
  deleteListGroup: (id: string) => void;
  addTodoList: (list: Omit<TodoList, 'id'>) => void;
  updateTodoList: (list: TodoList) => void;
  deleteTodoList: (id: string) => void;
  addTask: (task: Omit<TaskItem, 'id' | 'createdAt' | 'completedPomodoros'>) => TaskItem;
  batchAddTasks: (tasks: Omit<TaskItem, 'id' | 'createdAt' | 'completedPomodoros'>[]) => void;
  updateTask: (task: TaskItem) => void;
  deleteTask: (id: string) => void;
  toggleTask: (id: string, options?: { skipUndoSnackbar?: boolean; skipSound?: boolean }) => void;
  toggleStarTask: (taskId: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  setTaskStatus: (taskId: string, status: TaskStatus) => void;
  setTaskQuadrant: (taskId: string, quadrant: EisenhowerQuadrant) => void;

  // Schedule & Time-Blocking
  scheduleItems: ScheduleItem[];
  scheduleStartHour: number;
  setScheduleStartHour: (hour: number) => void;
  scheduleEndHour: number;
  setScheduleEndHour: (hour: number) => void;
  addEarlierScheduleHour: () => void;
  removeEarlierScheduleHour: () => void;
  addLaterScheduleHour: () => void;
  removeLaterScheduleHour: () => void;
  setScheduleTimingPreset: (preset: 'standard' | 'workday' | 'early' | 'night' | 'full' | '24h') => void;
  addScheduleItem: (item: Omit<ScheduleItem, 'id' | 'createdAt'>) => void;
  updateScheduleItem: (item: ScheduleItem) => void;
  deleteScheduleItem: (id: string) => void;
  toggleScheduleItem: (id: string) => void;
  autoScheduleTasksForDate: (date: string) => void;

  // Goals
  goals: Goal[];
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) => Goal;
  updateGoal: (goal: Goal) => void;
  deleteGoal: (id: string) => void;
  toggleGoalMilestone: (goalId: string, milestoneId: string) => void;
  linkTaskToGoal: (taskId: string, goalId?: string) => void;

  // Tags Repository & Management
  tags: AppTag[];
  addTag: (name: string, color?: string, description?: string) => void;
  updateTag: (oldName: string, newName: string, color?: string, description?: string) => void;
  deleteTag: (name: string) => void;

  // Central Management Hub for Goals & Tags
  isEntitiesModalOpen: boolean;
  setIsEntitiesModalOpen: (open: boolean) => void;
  entitiesModalDefaultTab: 'goals' | 'tags';
  openEntitiesModal: (tab?: 'goals' | 'tags') => void;

  // Bills & Subscriptions
  bills: Bill[];
  currency: string;
  currencySymbol: string;
  setCurrency: (c: string) => void;
  formatCurrency: (amount: number) => string;
  resetBillsToIndianDefaults: () => void;
  addBill: (bill: Omit<Bill, 'id' | 'paymentHistory'>) => void;
  updateBill: (bill: Bill) => void;
  deleteBill: (id: string) => void;
  markBillPaid: (id: string, amount?: number) => void;
  unmarkBillPaid: (id: string) => void;

  // Habits (HabitTick inspired)
  habits: Habit[];
  toggleHabitDay: (habitId: string, dateStr: string, options?: { skipUndoSnackbar?: boolean; skipSound?: boolean }) => void;
  addHabit: (habit: Omit<Habit, 'id' | 'currentStreak' | 'bestStreak' | 'completionHistory' | 'createdAt'>) => Habit;
  updateHabit: (habit: Habit) => void;
  deleteHabit: (id: string) => void;
  updateHabitCounter: (habitId: string, delta: number) => void;
  updateHabitSubSteps: (habitId: string, subSteps: HabitStep[], dateStr: string) => void;

  // Routines (Morning, Evening, Self-Care)
  routines: Routine[];
  toggleRoutineItem: (routineId: string, itemId: string, dateStr?: string, options?: { skipSound?: boolean }) => void;
  addRoutineItem: (routineId: string, item: Omit<RoutineItem, 'id'>) => void;
  updateRoutineItem: (routineId: string, item: RoutineItem) => void;
  deleteRoutineItem: (routineId: string, itemId: string) => void;
  addRoutine: (routine: Omit<Routine, 'id' | 'items'>) => Routine;
  updateRoutine: (routine: Routine) => void;
  deleteRoutine: (routineId: string) => void;
  reorderRoutineItems: (routineId: string, draggedId: string, targetId: string) => void;
  updateRoutineItemSubSteps: (routineId: string, itemId: string, subSteps: HabitStep[], dateStr: string) => void;

  // Quotes Repository
  quotes: QuoteItem[];
  deletedQuoteIds: string[];
  addQuote: (quote: Omit<QuoteItem, 'id'>) => void;
  addQuotes: (items: Omit<QuoteItem, 'id'>[]) => QuoteItem[];
  updateQuote: (quote: QuoteItem) => void;
  deleteQuote: (id: string) => void;
  resetQuotesToDefault: () => void;
  favoriteQuoteIds: string[];
  toggleFavoriteQuote: (id: string) => void;
  isQuoteFavorited: (id: string) => boolean;
  quoteCategories: QuoteCategory[];
  quoteCategoriesRaw: QuoteCategory[];
  addQuoteCategory: (name: string, color?: string) => QuoteCategory;
  updateQuoteCategory: (id: string, patch: { name?: string; color?: string }) => void;
  deleteQuoteCategory: (id: string) => void;
  resetQuoteCategoriesToDefault: () => void;
  getCategoryForQuote: (quote: Pick<QuoteItem, 'category'>) => QuoteCategory;

  // Task Workflow Stages (Customizable Kanban columns)
  workflowStages: WorkflowStage[];
  setWorkflowStages: React.Dispatch<React.SetStateAction<WorkflowStage[]>>;
  addWorkflowStage: (stage: Omit<WorkflowStage, 'id'> & { id?: string }) => void;
  updateWorkflowStage: (stage: WorkflowStage) => void;
  deleteWorkflowStage: (id: string) => void;

  // Pomodoro Focus Timer & Deep Focus Mode
  pomodoro: PomodoroState;
  taskTimers: Record<string, { timeRemaining: number; mode: 'work' | 'break'; initialDuration: number }>;
  pomodoroLogs: PomodoroSession[];
  deletePomodoroLog: (id: string) => void;
  resetPomodoroLogs: () => void;
  startPomodoro: (taskId?: string, minutes?: number) => void;
  pausePomodoro: () => void;
  resetPomodoro: (options?: { restart?: boolean; clearTask?: boolean }) => void;
  stopPomodoro: (taskId?: string) => void;
  clearTaskTimer: (taskId: string) => void;
  switchPomodoroMode: (mode: 'work' | 'break') => void;
  setPomodoroDuration: (minutes: number) => void;
  completePomodoroSession: () => void;
  setPomodoroTask: (taskId: string | null) => void;
  incrementTaskPomodoro: (taskId: string) => void;
  decrementTaskPomodoro: (taskId: string) => void;
  getTaskTimerRemaining: (taskId: string) => number | null;

  // E2E Encryption
  masterPassphrase: string | null;
  setMasterPassphrase: (pass: string | null) => void;

  // Full App Lock & Biometrics
  appLock: AppLockConfig;
  updateAppLock: (cfg: Partial<AppLockConfig>) => void;
  lockAppNow: () => void;
  unlockApp: (passcode?: string, isBiometric?: boolean) => boolean;

  // AI Assistant Chat & Item Generation
  isAIChatOpen: boolean;
  setIsAIChatOpen: (open: boolean) => void;
  aiMessages: AIMessage[];
  isAILoading: boolean;
  sendAIMessage: (text: string) => Promise<void>;
  applyActionableItem: (action: ActionableItem) => void;
  applyMultipleActionableItems: (actions: ActionableItem[]) => void;
  clearAIChat: () => void;
  verifyAIApiKey: (
    provider: string,
    customApiKey: string,
    selectedModel: string,
    baseUrl?: string
  ) => Promise<{ success: boolean; message: string; latencyMs?: number; error?: string }>;

  // Dashboard Widgets
  widgets: DashboardWidgetConfig[];
  toggleWidget: (id: string) => void;
  reorderWidgets: (newWidgets: DashboardWidgetConfig[]) => void;
  resetWidgets: () => void;
  pinnedSidebarItemId: string;
  setPinnedSidebarItemId: (id: string) => void;

  // Notifications
  notifications: AppNotification[];
  notificationHistory: AppNotification[];
  alarmHistory: AlarmHistoryItem[];
  unreadNotificationsCount: number;
  pushNotification: (
    title: string,
    body: string,
    category: AppNotification['category'],
    options?: {
      sound?: 'pill' | 'water' | 'task' | 'alarm' | 'drop' | 'drip';
      taskId?: string;
      vibrate?: boolean;
      silent?: boolean;
    }
  ) => void;
  markNotificationRead: (id: string) => void;
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
  clearNotificationHistory: () => void;
  recordAlarmHistory: (item: Omit<AlarmHistoryItem, 'id' | 'triggeredAt'>) => void;
  clearAlarmHistory: () => void;

  // Sync & Cloud Backup
  syncEmail: string;
  savedSyncEmails: string[];
  setSyncEmail: (email: string) => void;
  addSyncEmail: (email: string) => void;
  removeSyncEmail: (email: string) => void;
  openSourceCloudConfig: OpenSourceCloudConfig;
  updateOpenSourceCloudConfig: (cfg: Partial<OpenSourceCloudConfig>) => void;
  testOpenSourceCloudConnection: () => Promise<{ success: boolean; message?: string; error?: string }>;
  joplinSyncSettings: JoplinSyncSettings;
  updateJoplinSyncSettings: (cfg: Partial<JoplinSyncSettings>) => void;
  updateDriveConfig: (driveId: SyncDriveId, cfg: Partial<SyncDriveConfig>) => void;
  syncDriveNow: (driveId?: SyncDriveId, options?: { isBackupSnapshot?: boolean }) => Promise<{ success: boolean; message: string }>;
  checkDriveConfiguration: (driveId: SyncDriveId) => Promise<{ success: boolean; message: string }>;
  pickLocalFolderForSync: () => Promise<{ success: boolean; folderName?: string; error?: string }>;
  connectDriveOAuth: (driveId: 'gdrive' | 'dropbox', clientId?: string) => Promise<{ success: boolean; error?: string }>;
  isGDriveConnected: boolean;
  setGDriveManualToken: (token: string) => void;
  disconnectGDrive: () => void;
  isOnline: boolean;
  offlinePendingQueue: any[];
  retryOfflineQueue: () => Promise<void>;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
  lastSyncTime: string | null;
  syncWithCloud: () => Promise<void>;
  createCloudBackup: (provider?: CloudBackupProvider, source?: 'manual' | 'auto') => Promise<boolean>;
  restoreCloudBackup: (version?: number) => Promise<boolean>;
  exportEncryptedJSON: () => string;
  downloadLocalBackupFile: () => void;
  importBackupJSON: (jsonStr: string) => boolean;
  replaceAllAppDataFromBackup: (jsonStr: string) => boolean;

  // Modals UI
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (o: boolean) => void;
  isBackupModalOpen: boolean;
  setIsBackupModalOpen: (o: boolean) => void;
  isWidgetModalOpen: boolean;
  setIsWidgetModalOpen: (o: boolean) => void;
  isNotificationDrawerOpen: boolean;
  setIsNotificationDrawerOpen: (o: boolean) => void;
  isInstallModalOpen: boolean;
  setIsInstallModalOpen: (o: boolean) => void;

  // Sidebar Layout State
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;

  // Audio Engine & Legacy Aliases
  soundEngine: typeof soundEngine;
  haptics: typeof haptics;
  lockApp: () => void;
  syncState: {
    status: 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
    lastSyncTime: string;
    pendingChanges: number;
  };
  triggerManualSync: () => Promise<void>;
  userProfile: UserProfile;
  updateUserProfile: (p: Partial<UserProfile>) => void;
  configureAppLock: (cfg: Partial<AppLockConfig>) => void;

  // Global Undo Snackbar
  undoSnackbar: UndoSnackbarData | null;
  showUndoSnackbar: (data: Omit<UndoSnackbarData, 'id' | 'timestamp'>) => void;
  hideUndoSnackbar: () => void;
  triggerUndo: () => void;

  // Projects (derived from Goals)
  projects: { id: string; name: string; color: string; goalId?: string }[];
  addProject: (name: string, color?: string) => void;
}

export interface UndoSnackbarData {
  id: string;
  type: 'task' | 'habit' | 'schedule';
  targetId: string;
  title: string;
  subtitle?: string;
  dateStr?: string;
  timestamp: number;
  onUndo: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'omniplan_state_v1';

const initializedStorageKeys = new Set<string>();
const pendingStorageTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const scheduleStorageWrite = (key: string, value: unknown) => {
  // Skip redundant write on initial mount since state was just hydrated from localStorage
  if (!initializedStorageKeys.has(key)) {
    initializedStorageKeys.add(key);
    return;
  }
  if (pendingStorageTimers[key]) {
    clearTimeout(pendingStorageTimers[key]);
  }
  pendingStorageTimers[key] = setTimeout(() => {
    delete pendingStorageTimers[key];
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, 250);
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const lastNotifRef = useRef<Record<string, number>>({});
  // Theme state
  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('omniplan_theme');
        if (saved === 'dark' || saved === 'light') return saved;
      }
    } catch {}
    return 'light';
  });

  const [themeStyle, setThemeStyleState] = useState<ThemeStyle>(() => {
    return 'bento';
  });

  const [accentTone, setAccentToneState] = useState<AccentTone>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('omniplan_accent_tone') as AccentTone;
        if (['indigo', 'emerald', 'violet', 'rose', 'amber', 'cyan'].includes(saved)) return saved;
      }
    } catch {}
    return 'indigo';
  });

  const applyThemeMode = (currentTheme: AppTheme) => {
    try {
      if (typeof document === 'undefined') return;
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (currentTheme === 'dark') {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.setAttribute('data-theme', 'dark');
        if (metaThemeColor) metaThemeColor.setAttribute('content', '#000000');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.setAttribute('data-theme', 'light');
        if (metaThemeColor) metaThemeColor.setAttribute('content', '#f0f4f9');
      }
    } catch {}
  };

  const applyThemeStyle = (currentStyle: ThemeStyle) => {
    try {
      if (typeof document === 'undefined') return;
      document.documentElement.classList.remove('theme-glass', 'theme-pastel', 'theme-bento', 'theme-neumorphic', 'theme-claymorphic', 'theme-standard', 'theme-sea-glass');
      document.body.classList.remove('theme-glass', 'theme-pastel', 'theme-bento', 'theme-neumorphic', 'theme-claymorphic', 'theme-standard', 'theme-sea-glass');
      document.documentElement.classList.add(`theme-${currentStyle}`);
      document.body.classList.add(`theme-${currentStyle}`);
    } catch {}
  };

  const applyAccentTone = (tone: AccentTone) => {
    try {
      if (typeof document === 'undefined') return;
      document.documentElement.setAttribute('data-accent', tone);
      document.body.setAttribute('data-accent', tone);
    } catch {}
  };

  const setTheme = (newTheme: AppTheme) => {
    applyThemeMode(newTheme);
    setThemeState(newTheme);
    try {
      localStorage.setItem('omniplan_theme', newTheme);
    } catch {}
  };

  const setThemeStyle = (newStyle: ThemeStyle) => {
    setThemeStyleState(newStyle);
    try {
      localStorage.setItem('omniplan_theme_style', newStyle);
    } catch {}
    applyThemeStyle(newStyle);
  };

  const setAccentTone = (tone: AccentTone) => {
    setAccentToneState(tone);
    try {
      localStorage.setItem('omniplan_accent_tone', tone);
    } catch {}
    applyAccentTone(tone);
  };

  useEffect(() => {
    applyThemeMode(theme);
  }, [theme]);

  useEffect(() => {
    applyThemeStyle(themeStyle);
  }, [themeStyle]);

  useEffect(() => {
    applyAccentTone(accentTone);
  }, [accentTone]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('tasks');
  const [selectedDate, setSelectedDate] = useState<string>(() => formatLocalDate(new Date()));

  // Online / Offline tracking
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const [offlinePendingQueue, setOfflinePendingQueue] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_offline_queue`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_offline_queue`, JSON.stringify(offlinePendingQueue));
    } catch {}
  }, [offlinePendingQueue]);

  const retryOfflineQueue = async () => {
    if (!isOnline) {
      pushNotification('Still Offline', 'Please check your internet connection before retrying.', 'system');
      return;
    }
    try {
      setSyncStatus('syncing');
      await syncWithCloud();
      setOfflinePendingQueue([]);
      setSyncStatus('synced');
      pushNotification('Queue Synchronized', 'All pending offline operations have been successfully synchronized to cloud.', 'task');
    } catch (err: any) {
      setSyncStatus('error');
      pushNotification('Sync Failed', err?.message || 'Could not synchronize offline queue.', 'system');
    }
  };

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      pushNotification('Connection Restored', 'App is back online. Auto-syncing pending queue...', 'system');
      try {
        await syncWithCloud();
        setOfflinePendingQueue([]);
      } catch {}
    };
    const handleOffline = () => {
      setIsOnline(false);
      pushNotification('Offline Mode Active', 'All tasks, logs, and notes are cached locally.', 'system');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Core Data States with LocalStorage Persistence (Local-First by Default, Zero Shipped Personal Data)
  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_profile`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.updatedAt) {
          return initialProfile;
        }
        return {
          ...initialProfile,
          ...parsed,
          name: parsed.name || 'Guest',
          nickname: parsed.nickname || '',
          identifier: parsed.identifier || '',
          email: parsed.email || parsed.identifier || '',
          dateOfBirth: parsed.dateOfBirth || '',
          gender: parsed.gender || 'unspecified',
          preferredCurrency: parsed.preferredCurrency || 'INR',
          avatarPhoto: parsed.avatarPhoto || '',
          bio: parsed.bio || '',
          updatedAt: parsed.updatedAt,
        };
      }
      return initialProfile;
    } catch {
      return initialProfile;
    }
  });

  const [currency, setCurrencyState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_currency`);
      return saved || profile.preferredCurrency || 'INR';
    } catch {
      return 'INR';
    }
  });

  const currencySymbol =
    currency === 'USD' ? '$' :
    currency === 'EUR' ? '€' :
    currency === 'GBP' ? '£' :
    currency === 'AED' ? 'AED ' :
    currency === 'CAD' ? 'C$' :
    currency === 'AUD' ? 'A$' :
    currency === 'JPY' ? '¥' : '₹';

  const setCurrency = (c: string) => {
    setCurrencyState(c);
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_currency`, c);
    setProfile(p => ({ ...p, preferredCurrency: c as any }));
  };

  const formatCurrency = (amt: number) => {
    try {
      if (currency === 'INR') {
        return `₹${Number(amt).toLocaleString('en-IN')}`;
      }
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 0,
      }).format(amt);
    } catch {
      return `${currencySymbol}${Number(amt).toLocaleString()}`;
    }
  };

  const [medications, setMedications] = useState<Medication[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_meds`);
      if (!saved) return initialMedications;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : initialMedications;
    } catch {
      return initialMedications;
    }
  });

  const [doseLogs, setDoseLogs] = useState<DoseLog[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_doselogs`);
      if (!saved) {
        return [
          {
            id: 'log_init_1',
            medicationId: 'med_1',
            medicationName: 'Vitamin D3 & K2',
            scheduledTime: '08:30',
            loggedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
            status: 'taken',
          },
        ];
      }
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  });

  const [hydration, setHydration] = useState<HydrationState>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_hydration`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed || typeof parsed !== 'object') return initialHydration;
        if (!parsed.targetMl || parsed.targetMl === 2500) {
          parsed.targetMl = 3000;
        }
        const logs = Array.isArray(parsed.todayLogs) ? parsed.todayLogs.filter(Boolean) : [];
        const sum = logs.reduce((acc: number, curr: any) => acc + (curr?.amountMl || 0), 0);
        parsed.todayLogs = sum < 0 ? [] : logs;
        return parsed;
      }
      return initialHydration;
    } catch {
      return initialHydration;
    }
  });

  const [inboxItems, setInboxItems] = useState<InboxItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_inbox`);
      if (!saved) return initialInboxItems;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : initialInboxItems;
    } catch {
      return initialInboxItems;
    }
  });

  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_tasks`);
      if (saved) {
        const raw = JSON.parse(saved);
        const parsed: TaskItem[] = Array.isArray(raw) ? raw.filter(Boolean) : [];
        if (!Array.isArray(raw)) return initialTasks;
        return parsed.map(t => {
          const init = initialTasks.find(it => it.id === t.id);
          const subtasks =
            Array.isArray(t.subtasks) && t.subtasks.length > 0
              ? t.subtasks
              : Array.isArray((t as any).checklist) && (t as any).checklist.length > 0
              ? (t as any).checklist
              : init?.subtasks || [];
          return {
            ...t,
            title: t.title || 'Untitled Task',
            subtasks,
            checklist: subtasks,
          };
        });
      }
      return initialTasks;
    } catch {
      return initialTasks;
    }
  });

  const [listGroups, setListGroups] = useState<ListGroup[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_list_groups`);
      if (!saved) return initialListGroups;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : initialListGroups;
    } catch {
      return initialListGroups;
    }
  });

  const [todoLists, setTodoLists] = useState<TodoList[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_todo_lists`);
      if (!saved) return initialTodoLists;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : initialTodoLists;
    } catch {
      return initialTodoLists;
    }
  });

  const [selectedListId, setSelectedListId] = useState<string>('all');

  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_schedule`);
      if (!saved) return initialScheduleItems;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : initialScheduleItems;
    } catch {
      return initialScheduleItems;
    }
  });

  const [scheduleStartHour, setScheduleStartHourState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_schedule_start_hour`);
      if (saved !== null) {
        const num = parseInt(saved, 10);
        if (!isNaN(num) && num >= 0 && num <= 23) return num;
      }
    } catch {}
    return 6; // default 06:00 AM
  });

  const [scheduleEndHour, setScheduleEndHourState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_schedule_end_hour`);
      if (saved !== null) {
        const num = parseInt(saved, 10);
        if (!isNaN(num) && num >= 0 && num <= 23) return num;
      }
    } catch {}
    return 22; // default 10:00 PM (22:00)
  });

  const setScheduleStartHour = (hour: number) => {
    const clamped = Math.max(0, Math.min(hour, scheduleEndHour - 1));
    setScheduleStartHourState(clamped);
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_schedule_start_hour`, String(clamped));
  };

  const setScheduleEndHour = (hour: number) => {
    const clamped = Math.min(23, Math.max(hour, scheduleStartHour + 1));
    setScheduleEndHourState(clamped);
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_schedule_end_hour`, String(clamped));
  };

  const addEarlierScheduleHour = () => {
    if (scheduleStartHour > 0) {
      setScheduleStartHour(scheduleStartHour - 1);
      soundEngine.playSuccessChime();
    }
  };

  const removeEarlierScheduleHour = () => {
    if (scheduleStartHour < scheduleEndHour - 1) {
      setScheduleStartHour(scheduleStartHour + 1);
    }
  };

  const addLaterScheduleHour = () => {
    if (scheduleEndHour < 23) {
      setScheduleEndHour(scheduleEndHour + 1);
      soundEngine.playSuccessChime();
    }
  };

  const removeLaterScheduleHour = () => {
    if (scheduleEndHour > scheduleStartHour + 1) {
      setScheduleEndHour(scheduleEndHour - 1);
    }
  };

  const setScheduleTimingPreset = (preset: 'standard' | 'workday' | 'early' | 'night' | 'full' | '24h') => {
    let start = 6;
    let end = 22;
    if (preset === 'workday') {
      start = 8;
      end = 20;
    } else if (preset === 'early') {
      start = 5;
      end = 21;
    } else if (preset === 'night') {
      start = 9;
      end = 23;
    } else if (preset === 'full') {
      start = 5;
      end = 23;
    } else if (preset === '24h') {
      start = 0;
      end = 23;
    }
    setScheduleStartHourState(start);
    setScheduleEndHourState(end);
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_schedule_start_hour`, String(start));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_schedule_end_hour`, String(end));
    soundEngine.playSuccessChime();
  };

  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_schedule`, scheduleItems);
  }, [scheduleItems]);

  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_goals`);
      if (!saved) return initialGoals;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : initialGoals;
    } catch {
      return initialGoals;
    }
  });

  const [tags, setTags] = useState<AppTag[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_tags`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      }
      return [
        { id: 'tag-work', name: 'work', color: '#3b82f6', description: 'Professional & engineering tasks' },
        { id: 'tag-personal', name: 'personal', color: '#10b981', description: 'Personal & lifestyle goals' },
        { id: 'tag-health', name: 'health', color: '#f43f5e', description: 'Wellness, meds & hydration' },
        { id: 'tag-finance', name: 'finance', color: '#f59e0b', description: 'Investments, bills & budgeting' },
        { id: 'tag-learning', name: 'learning', color: '#8b5cf6', description: 'Reading, skills, and education' },
        { id: 'tag-errands', name: 'errands', color: '#06b6d4', description: 'Quick errands & chores' },
        { id: 'tag-deepwork', name: 'deepwork', color: '#6366f1', description: 'Uninterrupted deep focus sprint' },
        { id: 'tag-mindset', name: 'mindset', color: '#e11d48', description: 'Journaling, CBT & reflection' },
      ];
    } catch {
      return [
        { id: 'tag-work', name: 'work', color: '#3b82f6' },
        { id: 'tag-personal', name: 'personal', color: '#10b981' },
        { id: 'tag-health', name: 'health', color: '#f43f5e' },
        { id: 'tag-finance', name: 'finance', color: '#f59e0b' },
      ];
    }
  });

  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_tags`, tags);
  }, [tags]);

  const [isEntitiesModalOpen, setIsEntitiesModalOpen] = useState(false);
  const [entitiesModalDefaultTab, setEntitiesModalDefaultTab] = useState<'goals' | 'tags'>('goals');

  const openEntitiesModal = useCallback((tab?: 'goals' | 'tags') => {
    haptics.toggle();
    if (tab) setEntitiesModalDefaultTab(tab);
    setActiveTab('tags');
    setIsEntitiesModalOpen(false);
  }, []);

  const [bills, setBills] = useState<Bill[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_bills`);
      if (saved) {
        const raw = JSON.parse(saved);
        const parsed = Array.isArray(raw) ? raw.filter(Boolean) : [];
        if (parsed.length > 0) {
          // If all saved bills are old US Dollar bills, auto-migrate to initialBills with Rupee
          const isAllOldDollar = parsed.every((b: Bill) => b.currency === '$' || !b.currency);
          if (isAllOldDollar) {
            return initialBills;
          }
          return parsed.map((b: Bill) => ({
            ...b,
            currency: b.currency === '$' || !b.currency ? '₹' : b.currency,
          }));
        }
      }
      return initialBills;
    } catch {
      return initialBills;
    }
  });

  const resetBillsToIndianDefaults = () => {
    setBills(initialBills);
    setCurrency('INR');
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_bills`, JSON.stringify(initialBills));
    soundEngine.playSuccessChime();
    pushNotification('Bills Reset', 'Bills have been updated to Indian Rupee (₹) defaults.', 'bills');
  };

  const [appLock, setAppLock] = useState<AppLockConfig>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_applock`);
      if (!saved) return initialAppLock;
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' ? { ...initialAppLock, ...parsed } : initialAppLock;
    } catch {
      return initialAppLock;
    }
  });

  const [habits, setHabits] = useState<Habit[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_habits`);
      const parsed = saved ? JSON.parse(saved) : initialHabits;
      const rawList: Habit[] = Array.isArray(parsed) ? parsed.filter(Boolean) : initialHabits;
      return rawList.map((h: Habit) => {
        const habitName = typeof h.name === 'string' ? h.name : 'Habit';
        const normalizedTags = (Array.isArray(h.tags) && h.tags.length > 0)
          ? h.tags
          : [h.category ? (h.category.charAt(0).toUpperCase() + h.category.slice(1)) : 'General'];
        const { currentStreak, bestStreak } = calculateHabitStreak(h.completionHistory || {});
        const baseHabit = {
          ...h,
          name: habitName,
          tags: normalizedTags,
          cardTheme: h.cardTheme || 'clean',
          currentStreak: currentStreak,
          bestStreak: Math.max(h.bestStreak || 0, bestStreak),
        };
        if (
          habitName.includes('Morning Hydration') ||
          habitName.includes('Drink Water - Hydration') ||
          habitName.includes('Drink Water (3000ml)') ||
          habitName.toLowerCase() === 'hydration'
        ) {
          return {
            ...baseHabit,
            name: 'Drink Water',
            habitType: h.habitType || 'counter',
            syncHydration: h.syncHydration ?? true,
            unit: h.unit || 'ml',
            targetCount: h.targetCount || 3000,
            incrementStep: h.incrementStep || 250,
          };
        }
        return baseHabit;
      });
    } catch {
      return initialHabits;
    }
  });

  const [routines, setRoutines] = useState<Routine[]>(() => {
    const todayKey = formatLocalDate();
    const normalizeRoutines = (list: Routine[]): Routine[] =>
      (Array.isArray(list) ? list.filter(Boolean) : []).map(r => ({
        ...r,
        items: (Array.isArray(r.items) ? r.items.filter(Boolean) : []).map(item => {
          if (item.completionHistory) return item;
          const history: Record<string, boolean> = item.completed ? { [todayKey]: true } : {};
          const { currentStreak, bestStreak } = calculateHabitStreak(history);
          return {
            ...item,
            completionHistory: history,
            currentStreak: item.currentStreak ?? currentStreak,
            bestStreak: item.bestStreak ?? bestStreak,
          };
        }),
      }));
    try {
      const mergedFlag = localStorage.getItem(`${LOCAL_STORAGE_KEY}_routines_merged_to_habits_v1`);
      if (mergedFlag === 'true') {
        return [];
      }
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_routines`);
      const parsed = saved ? JSON.parse(saved) : initialRoutines;
      return normalizeRoutines(Array.isArray(parsed) ? parsed : initialRoutines);
    } catch {
      return normalizeRoutines(initialRoutines);
    }
  });

  // Pure helper: converts any Routine entries into first-class Habits tagged with the routine name
  // and registers matching AppTags with their signature colors (deduplicated & lossless).
  const mergeRoutinesIntoHabitsAndTags = useCallback(
    (
      baseHabits: Habit[],
      baseTags: AppTag[],
      sourceRoutines: Routine[]
    ): { mergedHabits: Habit[]; mergedTags: AppTag[]; didMerge: boolean } => {
      if (!Array.isArray(sourceRoutines) || sourceRoutines.length === 0) {
        return { mergedHabits: baseHabits, mergedTags: baseTags, didMerge: false };
      }

      const todayKey = formatLocalDate();
      const nextHabits: Habit[] = baseHabits.map(h => ({ ...h, tags: [...(h.tags || [])] }));
      const nextTags: AppTag[] = [...baseTags];

      const getRoutineColor = (r: Routine): string => {
        if (r.color) return r.color;
        const lower = (r.name || '').toLowerCase();
        if (r.timeOfDay === 'morning' || lower.includes('morning')) return '#f59e0b';
        if (r.timeOfDay === 'evening' || lower.includes('evening')) return '#6366f1';
        if (lower.includes('sunday') || lower.includes('self-care') || lower.includes('self care')) {
          return '#ec4899';
        }
        return '#14b8a6';
      };

      let maxOrder = nextHabits.reduce((max, h, idx) => Math.max(max, h.order ?? idx), -1);
      let didMerge = false;

      sourceRoutines.forEach(routine => {
        const tagName = (routine.name || '').trim();
        if (!tagName) return;
        const tagKey = tagName.toLowerCase();
        const routineColor = getRoutineColor(routine);

        // Ensure routine exists as a first-class AppTag
        if (!nextTags.some(t => (t.name || '').trim().toLowerCase() === tagKey)) {
          nextTags.push({
            id: `tag-routine-${tagKey.replace(/[^a-z0-9]+/g, '-')}`,
            name: tagName,
            color: routineColor,
            description: `${tagName} habits`,
            createdAt: new Date().toISOString(),
          });
          didMerge = true;
        }

        const timeOfDay: Habit['targetTimeOfDay'] =
          routine.timeOfDay === 'morning'
            ? 'morning'
            : routine.timeOfDay === 'afternoon'
            ? 'afternoon'
            : routine.timeOfDay === 'evening'
            ? 'evening'
            : 'anytime';

        (routine.items || []).forEach(item => {
          const itemTitle = (item.title || '').trim();
          if (!itemTitle) return;
          const itemTitleLower = itemTitle.toLowerCase();

          const itemHistory: Record<string, boolean> =
            item.completionHistory && Object.keys(item.completionHistory).length > 0
              ? { ...item.completionHistory }
              : item.completed
              ? { [todayKey]: true }
              : {};

          const existingIdx = nextHabits.findIndex(
            h =>
              h.id === item.id ||
              (h.name || '').trim().toLowerCase() === itemTitleLower
          );

          if (existingIdx >= 0) {
            const existing = nextHabits[existingIdx];
            const existingTags = existing.tags || [];
            const hasTag = existingTags.some(t => t.trim().toLowerCase() === tagKey);
            const mergedHistory = { ...itemHistory, ...(existing.completionHistory || {}) };
            const { currentStreak, bestStreak } = calculateHabitStreak(mergedHistory);
            nextHabits[existingIdx] = {
              ...existing,
              tags: hasTag ? existingTags : [tagName, ...existingTags],
              reminderTime: existing.reminderTime || item.scheduledTime || item.reminderTime,
              durationMinutes: existing.durationMinutes ?? item.durationMinutes,
              timerMinutes: existing.timerMinutes ?? item.timerMinutes ?? item.durationMinutes,
              completionHistory: mergedHistory,
              currentStreak: Math.max(existing.currentStreak || 0, currentStreak),
              bestStreak: Math.max(existing.bestStreak || 0, bestStreak),
            };
            didMerge = true;
          } else {
            maxOrder += 1;
            const { currentStreak, bestStreak } = calculateHabitStreak(itemHistory);
            const itemTags = [
              tagName,
              ...(item.tags || []).filter(t => t.trim().toLowerCase() !== tagKey),
            ];
            const derivedType: Habit['habitType'] =
              item.habitType || (item.durationMinutes || item.timerMinutes ? 'timer' : 'boolean');

            nextHabits.push({
              id: item.id || `hab_routine_${Date.now()}_${maxOrder}`,
              name: itemTitle,
              icon: item.icon || routine.icon || '✨',
              category: 'routine',
              frequency: item.frequency || 'daily',
              targetDaysPerWeek: item.customDays?.length || 7,
              targetTimeOfDay: timeOfDay,
              reminderTime: item.scheduledTime || item.reminderTime,
              reminderType: item.reminderType || (item.scheduledTime ? 'notification' : 'none'),
              timerMinutes: item.timerMinutes ?? item.durationMinutes,
              durationMinutes: item.durationMinutes ?? item.timerMinutes,
              currentStreak: item.currentStreak ?? currentStreak,
              bestStreak: item.bestStreak ?? bestStreak,
              completionHistory: itemHistory,
              color: item.color || routineColor,
              accentColor: item.accentColor || item.color || routineColor,
              fontColor: item.fontColor,
              isBold: item.isBold,
              cardTheme: item.cardTheme,
              notes: item.notes,
              archived: item.archived,
              archivedAt: item.archivedAt,
              createdAt: todayKey,
              tags: itemTags,
              habitType: derivedType,
              targetCount: item.targetCount,
              counterValue: item.counterValue,
              unit: item.unit,
              incrementStep: item.incrementStep,
              subSteps: item.subSteps,
              customDays: item.customDays,
              order: maxOrder,
            });
            didMerge = true;
          }
        });
      });

      return { mergedHabits: nextHabits, mergedTags: nextTags, didMerge };
    },
    []
  );

  // One-time idempotent migration: unify all Routines into tagged Habits on the main Habits page
  useEffect(() => {
    try {
      if (localStorage.getItem(`${LOCAL_STORAGE_KEY}_routines_merged_to_habits_v1`) === 'true') {
        return;
      }
      if (routines.length > 0) {
        const { mergedHabits, mergedTags, didMerge } = mergeRoutinesIntoHabitsAndTags(
          habits,
          tags,
          routines
        );
        if (didMerge) {
          setHabits(mergedHabits);
          setTags(mergedTags);
        }
        setRoutines([]);
      }
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_routines_merged_to_habits_v1`, 'true');
    } catch {}
    // Run once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_widgets`);
      if (saved) {
        const raw = JSON.parse(saved);
        const parsed: DashboardWidgetConfig[] = Array.isArray(raw) ? raw.filter(Boolean) : [];
        if (parsed.length === 0) return defaultWidgets;
        const existingIds = new Set(parsed.map(w => w.id));
        const missing = defaultWidgets.filter(dw => !existingIds.has(dw.id));
        if (missing.length > 0) {
          // Prepend missing high-priority widgets (like sync_status) or append
          return [...missing, ...parsed].map((w, idx) => ({ ...w, order: idx }));
        }
        return parsed;
      }
      return defaultWidgets;
    } catch {
      return defaultWidgets;
    }
  });

  const [pinnedSidebarItemId, setPinnedSidebarItemId] = useState<string>(() => {
    try {
      return localStorage.getItem(`${LOCAL_STORAGE_KEY}_pinned_sidebar_item`) || 'hab_2';
    } catch {
      return 'hab_2';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_pinned_sidebar_item`, pinnedSidebarItemId);
    } catch {}
  }, [pinnedSidebarItemId]);

  // Notifications: Welcome notification only shown once during initial setup, not every time!
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const hasSeen = localStorage.getItem('omniplan_welcome_shown');
      if (!hasSeen) {
        localStorage.setItem('omniplan_welcome_shown', 'true');
        return [
          {
            id: 'notif_welcome',
            title: 'Welcome to Jivan',
            body: 'Unified personal log: habits, tasks, medications, and bill reminders are ready.',
            category: 'system',
            timestamp: new Date().toISOString(),
            read: false,
          },
        ];
      }
      return [];
    } catch {
      return [];
    }
  });

  const [notificationHistory, setNotificationHistory] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_notif_history`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      }
      return [
        {
          id: 'notif_hist_welcome',
          title: 'Welcome to Jivan',
          body: 'System initialized with local encryption and full offline capabilities.',
          category: 'system',
          timestamp: new Date().toISOString(),
          read: true,
        },
      ];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_notif_history`, notificationHistory);
  }, [notificationHistory]);

  const [alarmHistory, setAlarmHistory] = useState<AlarmHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_alarm_history`);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_alarm_history`, alarmHistory);
  }, [alarmHistory]);

  // AI Assistant Chat State
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([
    {
      id: 'ai_msg_intro',
      sender: 'assistant',
      text: "Hi! I'm Jivan AI. Ask me to create tasks, habits, bill reminders, or plan your day.",
      timestamp: new Date().toISOString(),
    },
  ]);

  // E2E Encryption state
  const [masterPassphrase, setMasterPassphrase] = useState<string | null>(null);

  // Sync state & Selected Account Email (empty until user explicitly logs in or sets sync email)
  const [syncEmail, setSyncEmailState] = useState<string>(() => {
    try {
      const hasExplicitAuth = localStorage.getItem('omniplan_user_explicit_login') === 'true';
      if (!hasExplicitAuth) return '';
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_sync_email`);
      return saved || profile?.identifier || '';
    } catch {
      return '';
    }
  });

  const [savedSyncEmails, setSavedSyncEmails] = useState<string[]>(() => {
    try {
      const hasExplicitAuth = localStorage.getItem('omniplan_user_explicit_login') === 'true';
      if (!hasExplicitAuth) return [];
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_saved_sync_emails`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  // Deleted item tombstones for conflict-free Joplin sync merges
  const [deletedIds, setDeletedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_deleted_ids`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0).slice(-500);
        }
        if (parsed && typeof parsed === 'object') {
          return Object.values(parsed)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
            .slice(-500);
        }
      }
    } catch {}
    return [];
  });

  const recordDeletedId = useCallback((id: string) => {
    if (!id) return;
    setDeletedIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id].slice(-500);
      try {
        localStorage.setItem(`${LOCAL_STORAGE_KEY}_deleted_ids`, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Strip any Google Workspace OAuth access tokens (must remain memory-only) and stale Firebase oAuthClientId before persisting
  const sanitizeJoplinSettingsForStorage = useCallback((settings: JoplinSyncSettings): JoplinSyncSettings => {
    const firebaseOAuthId = (firebaseConfig as any)?.oAuthClientId || '';
    const gdriveCfg = settings.drives?.gdrive;
    if (!gdriveCfg) return settings;
    return {
      ...settings,
      drives: {
        ...settings.drives,
        gdrive: {
          ...gdriveCfg,
          accessToken: '',
          clientId:
            gdriveCfg.clientId &&
            (gdriveCfg.clientId === firebaseOAuthId || gdriveCfg.clientId.includes('keejp4ga2s286scae8aq90a6vv532mfn'))
              ? ''
              : gdriveCfg.clientId || '',
        },
      },
    };
  }, []);

  // Joplin-Style Multi-Drive Sync & Auto-Backup Configuration
  const [isGDriveConnected, setIsGDriveConnected] = useState<boolean>(() => Boolean(getInMemoryGDriveToken()));
  const [joplinSyncSettings, setJoplinSyncSettings] = useState<JoplinSyncSettings>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_joplin_sync_settings`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged: JoplinSyncSettings = {
          ...DEFAULT_JOPLIN_SYNC_SETTINGS,
          ...parsed,
          drives: {
            ...DEFAULT_JOPLIN_SYNC_SETTINGS.drives,
            ...(parsed.drives || {}),
          },
        };
        const firebaseOAuthId = (firebaseConfig as any)?.oAuthClientId || '';
        if (merged.drives.gdrive) {
          merged.drives.gdrive = {
            ...merged.drives.gdrive,
            accessToken: '',
            clientId:
              merged.drives.gdrive.clientId &&
              (merged.drives.gdrive.clientId === firebaseOAuthId ||
                merged.drives.gdrive.clientId.includes('keejp4ga2s286scae8aq90a6vv532mfn'))
                ? ''
                : merged.drives.gdrive.clientId || '',
          };
        }
        return merged;
      }
    } catch {}
    return DEFAULT_JOPLIN_SYNC_SETTINGS;
  });

  const updateJoplinSyncSettings = useCallback((cfg: Partial<JoplinSyncSettings>) => {
    setJoplinSyncSettings(prev => {
      const next: JoplinSyncSettings = {
        ...prev,
        ...cfg,
        drives: cfg.drives ? { ...prev.drives, ...cfg.drives } : prev.drives,
      };
      try {
        localStorage.setItem(
          `${LOCAL_STORAGE_KEY}_joplin_sync_settings`,
          JSON.stringify(sanitizeJoplinSettingsForStorage(next))
        );
      } catch {}
      return next;
    });
  }, [sanitizeJoplinSettingsForStorage]);

  const updateDriveConfig = useCallback((driveId: SyncDriveId, cfg: Partial<SyncDriveConfig>) => {
    setJoplinSyncSettings(prev => {
      const currentDrive = prev.drives[driveId] || DEFAULT_JOPLIN_SYNC_SETTINGS.drives[driveId];
      const next: JoplinSyncSettings = {
        ...prev,
        drives: {
          ...prev.drives,
          [driveId]: {
            ...currentDrive,
            ...cfg,
            ...(driveId === 'gdrive' ? { accessToken: '' } : {}),
          },
        },
      };
      try {
        localStorage.setItem(
          `${LOCAL_STORAGE_KEY}_joplin_sync_settings`,
          JSON.stringify(sanitizeJoplinSettingsForStorage(next))
        );
      } catch {}
      return next;
    });
  }, [sanitizeJoplinSettingsForStorage]);

  // Open Source Cloud Configuration (Nextcloud / WebDAV / MinIO S3)
  const [openSourceCloudConfig, setOpenSourceCloudConfig] = useState<OpenSourceCloudConfig>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_opensource_cloud`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return {
      provider: 'nextcloud',
      enabled: false,
      serverUrl: '',
      username: '',
      authSecret: '',
      remotePath: '/JivanOS',
      s3Bucket: '',
      s3Region: '',
    };
  });

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'offline' | 'error'>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle'
  );
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Firebase Auth State & Real-time Cloud Sync (Strictly Authenticated UID)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const clearAuthError = useCallback(() => setAuthError(null), []);
  const joplinSyncSettingsRef = useRef<JoplinSyncSettings>(joplinSyncSettings);
  useEffect(() => {
    joplinSyncSettingsRef.current = joplinSyncSettings;
  }, [joplinSyncSettings]);

  // Hydrate default OAuth Client IDs from server configuration if not overridden locally
  useEffect(() => {
    fetchServerOAuthDefaults().then((defaults) => {
      setJoplinSyncSettings(prev => {
        let changed = false;
        const nextDrives = { ...prev.drives };
        if (defaults.gdriveClientId && !nextDrives.gdrive?.clientId) {
          nextDrives.gdrive = { ...nextDrives.gdrive, clientId: defaults.gdriveClientId };
          changed = true;
        }
        // Scrub any legacy manual Dropbox keys/tokens from localStorage (Dropbox uses hardcoded PKCE)
        if (nextDrives.dropbox?.clientId || nextDrives.dropbox?.accessToken) {
          nextDrives.dropbox = { ...nextDrives.dropbox, clientId: '', accessToken: '' };
          changed = true;
        }
        return changed ? { ...prev, drives: nextDrives } : prev;
      });
    }).catch(() => {});
  }, []);

  const importBackupJSONRef = useRef<(jsonStr: string) => boolean>(() => false);
  const compilePayloadRef = useRef<() => string>(() => '{}');
  const isApplyingRemoteSyncRef = useRef(false);
  const isApplyingLocalRestoreRef = useRef(false);
  const isInitialMountRef = useRef(true);
  const isAutoSnapshotMountRef = useRef(true);
  const lastSyncedPayloadHashRef = useRef<string>('');
  const lastAutoSnapshotHashRef = useRef<string>('');

  useEffect(() => {
    let firestoreUnsub: (() => void) | null = null;

    // Handle redirect sign-in result if returning from mobile redirect flow
    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) {
          localStorage.setItem('omniplan_user_explicit_login', 'true');
        }
      })
      .catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (firestoreUnsub) {
        firestoreUnsub();
        firestoreUnsub = null;
      }

      if (user && user.uid) {
        const emailLower = (user.email || '').toLowerCase();
        localStorage.setItem('omniplan_user_explicit_login', 'true');
        if (emailLower) {
          setSyncEmailState(emailLower);
          setSavedSyncEmails(prev => (prev.includes(emailLower) ? prev : [...prev, emailLower]));
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_sync_email`, emailLower);
        }

        // Preserve any local personal customizations (avatarPhoto, nickname, DOB, height/weight) when signing in
        setProfile(prev => ({
          ...prev,
          id: user.uid,
          identifier: emailLower || prev.identifier,
          email: emailLower || prev.email,
          name:
            prev.name && prev.name !== 'Guest'
              ? prev.name
              : user.displayName || (emailLower ? emailLower.split('@')[0] : 'User'),
          avatarPhoto: prev.avatarPhoto || user.photoURL || '',
          type: 'email',
          updatedAt: prev.updatedAt || new Date().toISOString(),
        }));

        updateDriveConfig('firebase', {
          enabled: true,
          accountEmail: emailLower,
          lastStatus: 'synced',
        });

        // Initial conflict-free merge pull from authenticated user's Firestore doc (users/{uid})
        try {
          const remoteData = await getUserDataFromFirestore(user.uid);
          if (remoteData && remoteData.payload) {
            const latestSyncCfg = joplinSyncSettingsRef.current;
            const plainRemote = await decodeSyncEnvelope(
              typeof remoteData.payload === 'string' ? remoteData.payload : JSON.stringify(remoteData.payload),
              latestSyncCfg.e2eePassphrase
            );
            const merged = mergeSyncPayloads(
              compilePayloadRef.current(),
              plainRemote,
              latestSyncCfg.syncPersonalDetails
            );
            isApplyingRemoteSyncRef.current = true;
            importBackupJSONRef.current(JSON.stringify(merged));
            setLastSyncTime(remoteData.updatedAt || new Date().toISOString());
            setSyncStatus('synced');
            setTimeout(() => {
              isApplyingRemoteSyncRef.current = false;
            }, 1500);
          }
        } catch (e) {
          console.warn('Initial Firestore pull info:', e);
        }

        // Attach Real-time listener on authenticated user's Firestore document
        try {
          firestoreUnsub = onSnapshot(
            doc(db, 'users', user.uid),
            async (docSnap) => {
              if (docSnap.exists()) {
                const remoteData = docSnap.data();
                if (remoteData && remoteData.payload) {
                  try {
                    const latestSyncCfg = joplinSyncSettingsRef.current;
                    const plainRemote = await decodeSyncEnvelope(
                      typeof remoteData.payload === 'string' ? remoteData.payload : JSON.stringify(remoteData.payload),
                      latestSyncCfg.e2eePassphrase
                    );
                    const merged = mergeSyncPayloads(
                      compilePayloadRef.current(),
                      plainRemote,
                      latestSyncCfg.syncPersonalDetails
                    );
                    isApplyingRemoteSyncRef.current = true;
                    importBackupJSONRef.current(JSON.stringify(merged));
                    setLastSyncTime(remoteData.updatedAt || new Date().toISOString());
                    setSyncStatus('synced');
                  } catch {} finally {
                    setTimeout(() => {
                      isApplyingRemoteSyncRef.current = false;
                    }, 1500);
                  }
                }
              }
            },
            (err) => {
              console.warn('Firestore realtime snapshot listener info:', err);
            }
          );
        } catch (e) {
          console.warn('Error attaching Firestore realtime listener:', e);
        }
      } else {
        clearInMemoryGDriveToken();
        setIsGDriveConnected(false);
      }
    });

    return () => {
      unsubscribe();
      if (firestoreUnsub) firestoreUnsub();
    };
  }, []);

  // Modals state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // Global Undo Snackbar State (3-second revertable notification)
  const [undoSnackbar, setUndoSnackbar] = useState<UndoSnackbarData | null>(null);

  const showUndoSnackbar = useCallback((data: Omit<UndoSnackbarData, 'id' | 'timestamp'>) => {
    setUndoSnackbar({
      ...data,
      id: `undo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    });
  }, []);

  const hideUndoSnackbar = useCallback(() => {
    setUndoSnackbar(null);
  }, []);

  const triggerUndo = useCallback(() => {
    if (undoSnackbar) {
      try {
        soundEngine.playSuccessChime();
        haptics.toggle();
      } catch {}
      const undoAction = undoSnackbar.onUndo;
      setUndoSnackbar(null);
      if (typeof undoAction === 'function') {
        undoAction();
      }
    }
  }, [undoSnackbar]);

  // Sidebar / Namida Left Drawer Layout State (true = drawer closed, false = drawer open)
  const [isSidebarCollapsed, setIsSidebarCollapsedState] = useState<boolean>(true);

  const setIsSidebarCollapsed = useCallback((collapsed: boolean) => {
    setIsSidebarCollapsedState(collapsed);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsedState(prev => !prev);
  }, []);

  // Global Active Timer State (Task, Habit, or Event)
  const [activeTimer, setActiveTimer] = useState<GlobalTimerState>({
    activeId: null,
    type: null,
    mode: null,
    isRunning: false,
    timeElapsed: 0,
    timeRemaining: 25 * 60,
    startedAt: null,
  });

  // Pomodoro Focus Timer State
  const [pomodoro, setPomodoro] = useState<PomodoroState>({
    taskId: null,
    timeRemaining: 25 * 60,
    isRunning: false,
    mode: 'work',
    initialDuration: 25 * 60,
  });

  // Pomodoro Session Logs (deletable and resettable)
  const [pomodoroLogs, setPomodoroLogs] = useState<PomodoroSession[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_pomodoro_logs`);
      return saved ? JSON.parse(saved) : [
        {
          id: 'pomo_init_1',
          taskTitle: 'Engineering Sprint & Architecture',
          durationMinutes: 25,
          mode: 'work',
          completedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: 'pomo_init_2',
          taskTitle: 'Health & Hydration Review',
          durationMinutes: 25,
          mode: 'work',
          completedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        }
      ];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_pomodoro_logs`, pomodoroLogs);
  }, [pomodoroLogs]);

  const deletePomodoroLog = (id: string) => {
    setPomodoroLogs(prev => prev.filter(l => l.id !== id));
  };

  const resetPomodoroLogs = () => {
    setPomodoroLogs([]);
    setTasks(prev => prev.map(t => ({ ...t, completedPomodoros: 0 })));
    soundEngine.playSuccessChime();
    pushNotification('Pomodoro Logs Reset', 'All Pomodoro session logs have been cleared.', 'task');
  };

  // Per-task timer memory (preserves paused time and configuration per task)
  const [taskTimers, setTaskTimers] = useState<
    Record<string, { timeRemaining: number; mode: 'work' | 'break'; initialDuration: number }>
  >(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_task_timers`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_task_timers`, taskTimers);
  }, [taskTimers]);

  // Save to LocalStorage whenever state changes (debounced off main animation thread)
  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_profile`, profile);
  }, [profile]);
  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_meds`, medications);
  }, [medications]);
  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_doselogs`, doseLogs);
  }, [doseLogs]);
  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_hydration`, hydration);
  }, [hydration]);

  // Bi-directional synchronization for Water habits and Hydration state
  useEffect(() => {
    const totalTodayMl = Math.max(0, (hydration.todayLogs || []).reduce((acc, curr) => acc + (curr.amountMl || 0), 0));
    const targetMl = hydration.targetMl || 3000;
    const isGoalMet = totalTodayMl >= targetMl;
    const todayStr = new Date().toISOString().split('T')[0];

    setHabits(prev => {
      let hasChanges = false;
      const next = prev.map(h => {
        const isWater = Boolean(h.syncHydration) ||
          h.name.toLowerCase().includes('water') ||
          h.name.toLowerCase().includes('hydration') ||
          h.id === 'hab_1';

        if (!isWater) return h;

        const hUnit = (h.unit || hydration.preferredUnit || 'ml').toLowerCase();
        const isLitre = ['l', 'litre', 'litres'].includes(hUnit);
        const isGlasses = ['glasses', 'glass', 'gl'].includes(hUnit);

        const counterVal = isLitre 
          ? Math.max(0, Math.round((totalTodayMl / 1000) * 100) / 100)
          : isGlasses
            ? Math.max(0, Math.round(totalTodayMl / 250))
            : Math.max(0, Math.round(totalTodayMl));

        const targetVal = isLitre
          ? Math.round((targetMl / 1000) * 10) / 10
          : isGlasses
            ? Math.max(1, Math.round(targetMl / 250))
            : targetMl;

        const wasMet = !!h.completionHistory?.[todayStr];
        if (
          h.counterValue === counterVal &&
          h.targetCount === targetVal &&
          wasMet === isGoalMet &&
          h.syncHydration === true
        ) {
          return h;
        }

        hasChanges = true;
        return {
          ...h,
          counterValue: counterVal,
          targetCount: targetVal,
          syncHydration: true,
          completionHistory: {
            ...(h.completionHistory || {}),
            [todayStr]: isGoalMet,
          },
        };
      });

      return hasChanges ? next : prev;
    });
  }, [hydration]);
  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_inbox`, inboxItems);
  }, [inboxItems]);
  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_tasks`, tasks);
  }, [tasks]);
  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_list_groups`, listGroups);
  }, [listGroups]);
  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_todo_lists`, todoLists);
  }, [todoLists]);
  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_goals`, goals);
  }, [goals]);
  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_bills`, bills);
  }, [bills]);
  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_applock`, appLock);
  }, [appLock]);
  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_habits`, habits);
  }, [habits]);
  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_routines`, routines);
  }, [routines]);
  useEffect(() => {
    scheduleStorageWrite(`${LOCAL_STORAGE_KEY}_widgets`, widgets);
  }, [widgets]);

  // Push in-app notification helper
  const pushNotification = useCallback(
    (
      title: string,
      body: string,
      category: AppNotification['category'],
      options?: {
        sound?: 'pill' | 'water' | 'task' | 'alarm' | 'drop' | 'drip';
        taskId?: string;
        vibrate?: boolean;
        silent?: boolean;
      }
    ) => {
      // Rapid deduplication check: ignore duplicate toast within 2 seconds
      const now = Date.now();
      const dedupKey = `${title}__${body}`;
      if (lastNotifRef.current[dedupKey] && now - lastNotifRef.current[dedupKey] < 2000) {
        return;
      }
      lastNotifRef.current[dedupKey] = now;

      const newNotif: AppNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title,
        body,
        category,
        timestamp: new Date().toISOString(),
        read: Boolean(options?.silent),
        taskId: options?.taskId,
      };
      setNotificationHistory(prev => [newNotif, ...prev.slice(0, 100)]);

      if (options?.silent) return;

      setNotifications(prev => [newNotif, ...prev.slice(0, 40)]);

      // Trigger sound and native alert (default to gentle task chime, never alarm!)
      const soundType =
        options?.sound ||
        (category === 'medication' ? 'pill' : category === 'water' ? 'water' : 'task');
      notificationService.notify(title, {
        body,
        sound: soundType,
        taskId: options?.taskId,
        tag: options?.taskId ? `task_${options.taskId}` : undefined,
        vibrate: options?.vibrate,
      });
    },
    []
  );

  // Pomodoro Timer Interval - Clean single-interval countdown
  useEffect(() => {
    if (!pomodoro.isRunning) return;

    const timer = setInterval(() => {
      setPomodoro(prev => {
        if (prev.timeRemaining <= 1) {
          return {
            ...prev,
            timeRemaining: 0,
            isRunning: false,
          };
        }
        return { ...prev, timeRemaining: prev.timeRemaining - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pomodoro.isRunning]);

  // Handle Pomodoro session completion when time reaches 0
  useEffect(() => {
    if (!pomodoro.isRunning && pomodoro.timeRemaining === 0) {
      soundEngine.playSuccessChime();
      const completedMode = pomodoro.mode;
      const nextMode = completedMode === 'work' ? 'break' : 'work';
      const nextDuration = nextMode === 'work' ? 25 * 60 : 5 * 60;

      if (pomodoro.taskId && completedMode === 'work') {
        const targetTaskId = pomodoro.taskId;
        setTasks(currTasks =>
          currTasks.map(t =>
            t.id === targetTaskId
              ? { ...t, completedPomodoros: (t.completedPomodoros || 0) + 1 }
              : t
          )
        );
      }

      pushNotification(
        completedMode === 'work' ? 'Focus Session Complete!' : 'Break Over!',
        completedMode === 'work' ? 'Great focus block logged! Take a 5-minute restorative break.' : 'Break completed! Ready to resume your next sprint?',
        'task'
      );

      setPomodoro(prev => ({
        ...prev,
        mode: nextMode,
        timeRemaining: nextDuration,
        initialDuration: nextDuration,
      }));
    }
  }, [pomodoro.isRunning, pomodoro.timeRemaining, pomodoro.mode, pomodoro.taskId, pushNotification]);

  // Helper to parse any date format (YYYY-MM-DD, DD/MM/YYYY, ISO) and HH:mm to milliseconds
  const parseDateTimeToTimestamp = (dateStr?: string, timeStr: string = '00:00'): number | null => {
    if (!dateStr) return null;
    let year = 0;
    let month = 0;
    let day = 0;

    const trimmed = dateStr.trim();
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(trimmed)) {
      // DD/MM/YYYY
      const parts = trimmed.split(/[\/\-\.]/).map(Number);
      day = parts[0];
      month = parts[1];
      year = parts[2];
    } else if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/.test(trimmed)) {
      // YYYY-MM-DD
      const parts = trimmed.split(/[\/\-\.T]/).map(Number);
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        year = d.getFullYear();
        month = d.getMonth() + 1;
        day = d.getDate();
      } else {
        return null;
      }
    }

    const [hStr, mStr] = (timeStr || '00:00').split(':');
    const hours = parseInt(hStr, 10) || 0;
    const minutes = parseInt(mStr, 10) || 0;

    const target = new Date(year, month - 1, day, hours, minutes, 0, 0);
    const ts = target.getTime();
    return isNaN(ts) ? null : ts;
  };

  const remindedScheduleKeysRef = useRef<Set<string>>(new Set());
  const remindedTaskKeysRef = useRef<Set<string>>(new Set());
  const reminderStateRef = useRef({
    medications,
    doseLogs,
    tasks,
    scheduleItems,
    habits,
    bills,
  });

  useEffect(() => {
    reminderStateRef.current = {
      medications,
      doseLogs,
      tasks,
      scheduleItems,
      habits,
      bills,
    };
  }, [medications, doseLogs, tasks, scheduleItems, habits, bills]);

  // Periodic Reminder / Scheduler Engine (Reads from ref to avoid re-running on every task/habit edit)
  useEffect(() => {
    const checkReminders = () => {
      const {
        medications: currMeds,
        doseLogs: currLogs,
        tasks: currTasks,
        scheduleItems: currSchedule,
        habits: currHabits,
        bills: currBills,
      } = reminderStateRef.current;

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const localTodayStr = `${year}-${month}-${day}`;
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      const nowTs = now.getTime();

      // 1. Check medication schedules and specific custom date-time alerts
      currMeds.forEach(med => {
        if (!med.active || med.archived) return;
        med.schedules.forEach(sched => {
          if (sched.time === currentTimeStr) {
            // Check if already logged today
            const alreadyLogged = currLogs.some(
              log =>
                log.medicationId === med.id &&
                log.scheduledTime === sched.time &&
                log.loggedAt.startsWith(localTodayStr)
            );
            if (!alreadyLogged) {
              if (med.reminderType === 'none') return;
              const medReminderKey = `med_${med.id}_${localTodayStr}_${sched.time}`;
              if (remindedScheduleKeysRef.current.has(medReminderKey)) return;
              remindedScheduleKeysRef.current.add(medReminderKey);
              
              if (med.reminderType === 'alarm') {
                window.dispatchEvent(
                  new CustomEvent('omnilifeos_trigger_alarm', {
                    detail: {
                      id: `alarm-med-${med.id}-${Date.now()}`,
                      source: 'medication',
                      title: `🚨 Medication Due: ${med.name}`,
                      subtitle: `Scheduled for ${sched.label || sched.time} (${med.dosage}). ${med.instructions}`,
                      dueTime: sched.time,
                      reminderType: 'alarm',
                      rawId: med.id,
                    },
                  })
                );
                notificationService.notify(`🚨 Medication Due: ${med.name}`, {
                  body: `Scheduled for ${sched.label || sched.time} (${med.dosage}). ${med.instructions}`,
                  sound: 'alarm',
                  category: 'medication',
                  tag: `alarm_med_${med.id}_${sched.time}`,
                  isAlarm: true,
                });
              } else {
                pushNotification(
                  `Medication Due: ${med.name}`,
                  `Scheduled for ${sched.label || sched.time} (${med.dosage}). ${med.instructions}`,
                  'medication',
                  { sound: 'pill' }
                );
              }
            }
          }
        });

        // Specific custom dates & times alerts (e.g., Nov 26, Nov 28, Nov 30 at 09:00)
        if (med.customDateTimes && med.customDateTimes.length > 0) {
          med.customDateTimes.forEach(cdt => {
            if (cdt.date === localTodayStr && cdt.time === currentTimeStr) {
              const medCustomKey = `med_custom_${med.id}_${cdt.date}_${cdt.time}_${cdt.id}`;
              if (remindedScheduleKeysRef.current.has(medCustomKey)) return;
              remindedScheduleKeysRef.current.add(medCustomKey);

              if (med.reminderType === 'alarm') {
                window.dispatchEvent(
                  new CustomEvent('omnilifeos_trigger_alarm', {
                    detail: {
                      id: `alarm-med-custom-${med.id}-${Date.now()}`,
                      source: 'medication',
                      title: `🚨 Scheduled Medication: ${med.name}`,
                      subtitle: `Specific date alert for ${cdt.date} @ ${cdt.time} (${med.dosage}). ${med.instructions}`,
                      dueTime: cdt.time,
                      reminderType: 'alarm',
                      rawId: med.id,
                    },
                  })
                );
                notificationService.notify(`🚨 Scheduled Medication: ${med.name}`, {
                  body: `${cdt.date} @ ${cdt.time} (${med.dosage}). ${med.instructions}`,
                  sound: 'alarm',
                  category: 'medication',
                  tag: `alarm_med_custom_${med.id}_${cdt.id}`,
                  isAlarm: true,
                });
              } else if (med.reminderType !== 'none') {
                pushNotification(
                  `Scheduled Medication: ${med.name}`,
                  `Specific date alert for ${cdt.date} @ ${cdt.time} (${med.dosage}). ${med.instructions}`,
                  'medication',
                  { sound: 'pill' }
                );
              }
            }
          });
        }
      });

      // 2. Check task reminders and multi-alert triggers (Opt-in only!)
      currTasks.forEach(task => {
        if (task.completed || task.archived || task.status === 'archived') return;
        if (!task.reminderType || task.reminderType === 'none') return;

        // Check if task has an explicit 'on_time' alert in alerts array to prevent duplicate triggers
        const hasOnTimeAlert = Boolean(task.alerts && task.alerts.some(a => a.type === 'on_time'));

        // Exact due time reminder (fires only if not already handled by on_time multi-alert)
        if (!hasOnTimeAlert && task.dueDate && task.dueTime) {
          const taskDueTs = parseDateTimeToTimestamp(task.dueDate, task.dueTime);
          if (taskDueTs !== null) {
            const reminderKey = `task_due_${task.id}_${task.dueDate}_${task.dueTime}`;
            const diffMs = nowTs - taskDueTs;

            if (
              diffMs >= 0 &&
              diffMs <= 30 * 60 * 1000 &&
              !remindedTaskKeysRef.current.has(reminderKey)
            ) {
              remindedTaskKeysRef.current.add(reminderKey);

              if (task.reminderType === 'alarm') {
                window.dispatchEvent(
                  new CustomEvent('omnilifeos_trigger_alarm', {
                    detail: {
                      id: `alarm-task-${task.id}-${Date.now()}`,
                      source: 'task',
                      title: `🚨 Task Alert: ${task.title}`,
                      subtitle: `Due at ${task.dueTime} • Category: ${task.category || task.project || 'Personal'}${task.location ? ` @ ${task.location}` : ''}`,
                      dueTime: task.dueTime,
                      reminderType: 'alarm',
                      rawId: task.id,
                    },
                  })
                );
                notificationService.notify(`🚨 Task Alert: ${task.title}`, {
                  body: `Due at ${task.dueTime} • ${task.category || task.project || 'Personal'}${task.location ? ` @ ${task.location}` : ''}`,
                  sound: 'alarm',
                  category: 'task',
                  taskId: task.id,
                  tag: `alarm_task_${task.id}`,
                  isAlarm: true,
                });
              } else {
                pushNotification(
                  `⏰ Task Due: ${task.title}`,
                  `Due at ${task.dueTime} • Category: ${task.category || task.project || 'Personal'}${task.location ? ` @ ${task.location}` : ''}`,
                  'task',
                  { sound: 'drop', taskId: task.id }
                );
              }
            }
          }
        }

        // Multi-alert checks (on_time, 5m, 10m, 15m, 30m, 1h, 2h, 1d, custom)
        if (task.alerts && task.alerts.length > 0 && task.dueDate) {
          const baseTime = task.dueTime || '09:00';
          const taskDueTs = parseDateTimeToTimestamp(task.dueDate, baseTime);

          if (taskDueTs !== null) {
            task.alerts.forEach(alert => {
              const alertKey = `task_alert_${task.id}_${alert.id || alert.type}_${task.dueDate}`;
              if (alert.triggered || remindedTaskKeysRef.current.has(alertKey)) return;

              let alertTargetTs = taskDueTs;
              if (alert.type === 'on_time') alertTargetTs = taskDueTs;
              else if (alert.type === '5m') alertTargetTs = taskDueTs - 5 * 60 * 1000;
              else if (alert.type === '10m') alertTargetTs = taskDueTs - 10 * 60 * 1000;
              else if (alert.type === '15m') alertTargetTs = taskDueTs - 15 * 60 * 1000;
              else if (alert.type === '30m') alertTargetTs = taskDueTs - 30 * 60 * 1000;
              else if (alert.type === '1h') alertTargetTs = taskDueTs - 60 * 60 * 1000;
              else if (alert.type === '2h') alertTargetTs = taskDueTs - 2 * 60 * 60 * 1000;
              else if (alert.type === '1d') alertTargetTs = taskDueTs - 24 * 60 * 60 * 1000;
              else if (alert.time) {
                const targetD = alert.date || task.dueDate;
                const directTs = parseDateTimeToTimestamp(targetD, alert.time);
                if (directTs !== null) alertTargetTs = directTs;
              } else if (alert.type === 'custom' && alert.customDateTime) {
                const customTs = new Date(alert.customDateTime).getTime();
                if (!isNaN(customTs)) alertTargetTs = customTs;
              }

              // Fire if alert time has arrived and is within last 30 minutes
              const alertDiffMs = nowTs - alertTargetTs;
              if (alertDiffMs >= 0 && alertDiffMs <= 30 * 60 * 1000) {
                remindedTaskKeysRef.current.add(alertKey);

                const finalReminderType = (alert as any).reminderType || task.reminderType || 'notification';

                if (finalReminderType === 'alarm') {
                  window.dispatchEvent(
                    new CustomEvent('omnilifeos_trigger_alarm', {
                      detail: {
                        id: `alarm-task-alert-${task.id}-${alert.id || alert.type}-${Date.now()}`,
                        source: 'task',
                        title: `🚨 Task Alert: ${task.title}`,
                        subtitle: `${alert.label || 'Task reminder'} • Due at ${alert.time || task.dueTime || 'today'}${task.location ? ` @ ${task.location}` : ''}`,
                        dueTime: alert.time || task.dueTime,
                        reminderType: 'alarm',
                        rawId: task.id,
                      },
                    })
                  );
                  notificationService.notify(`🚨 Task Alert: ${task.title}`, {
                    body: `${alert.label || 'Task reminder'} • Due at ${alert.time || task.dueTime || 'today'}`,
                    sound: 'alarm',
                    category: 'task',
                    taskId: task.id,
                    tag: `alarm_task_alert_${task.id}_${alert.id || alert.type}`,
                    isAlarm: true,
                  });
                } else if (finalReminderType === 'notification') {
                  pushNotification(
                    `🔔 Reminder: ${task.title}`,
                    `${alert.label || 'Task reminder'} • Due at ${alert.time || task.dueTime || 'today'}${task.location ? ` @ ${task.location}` : ''}`,
                    'task',
                    { sound: 'drop', taskId: task.id }
                  );
                } else if (finalReminderType === 'silent') {
                  pushNotification(
                    `🔕 Silent Reminder: ${task.title}`,
                    `${alert.label || 'Task reminder'} • Due at ${alert.time || task.dueTime || 'today'}${task.location ? ` @ ${task.location}` : ''}`,
                    'task',
                    { silent: true, taskId: task.id }
                  );
                }
              }
            });
          }
        }

        // Also check task.dateSchedules for per-date reminders
        if (task.dateSchedules && task.dateSchedules.length > 0) {
          task.dateSchedules.forEach(ds => {
            if (ds.alerts && ds.alerts.length > 0 && ds.date) {
              ds.alerts.forEach(alert => {
                const alertTime = alert.time || ds.dueTime || '09:00';
                const alertKey = `task_ds_alert_${task.id}_${alert.id || alertTime}_${ds.date}`;
                if (alert.triggered || remindedTaskKeysRef.current.has(alertKey)) return;

                const targetTs = parseDateTimeToTimestamp(ds.date, alertTime);
                if (targetTs !== null) {
                  const alertDiffMs = nowTs - targetTs;
                  if (alertDiffMs >= 0 && alertDiffMs <= 30 * 60 * 1000) {
                    remindedTaskKeysRef.current.add(alertKey);
                    const finalReminderType = (alert as any).reminderType || task.reminderType || 'notification';
                    if (finalReminderType === 'alarm') {
                      window.dispatchEvent(
                        new CustomEvent('omnilifeos_trigger_alarm', {
                          detail: {
                            id: `alarm-task-schedule-${task.id}-${ds.date}-${alert.id || alertTime}`,
                            source: 'task',
                            title: `🚨 Task Alert: ${task.title}`,
                            subtitle: `${alert.label || 'Task reminder'} • Scheduled for ${ds.date} at ${alertTime}`,
                            dueTime: alertTime,
                            reminderType: 'alarm',
                            rawId: task.id,
                          },
                        })
                      );
                      notificationService.notify(`🚨 Task Alert: ${task.title}`, {
                        body: `${alert.label || 'Task reminder'} • ${ds.date} at ${alertTime}`,
                        sound: 'alarm',
                        category: 'task',
                        taskId: task.id,
                        tag: `alarm_task_ds_${task.id}_${ds.date}`,
                        isAlarm: true,
                      });
                    } else {
                      pushNotification(
                        `🔔 Reminder: ${task.title}`,
                        `${alert.label || 'Task reminder'} • Scheduled for ${ds.date} at ${alertTime}`,
                        'task',
                        { sound: 'drop', taskId: task.id }
                      );
                    }
                  }
                }
              });
            }
          });
        }
      });

      // 3. Check Schedule Events Reminders & Alarms (supporting one-time & recurrence)
      currSchedule.forEach(item => {
        if (item.completed) return;
        if (!isScheduleItemOnDate(item, localTodayStr)) return;

        const baseTime = item.startTime || '09:00';
        const itemTs = parseDateTimeToTimestamp(localTodayStr, baseTime);
        if (itemTs === null) return;

        let targetTs = itemTs;
        const timing = item.reminderTiming || 'on_time';
        if (timing === 'none') return;
        if (!item.reminderType || item.reminderType === 'none') return;

        if (timing === 'on_time') targetTs = itemTs;
        else if (timing === '5m') targetTs = itemTs - 5 * 60 * 1000;
        else if (timing === '10m') targetTs = itemTs - 10 * 60 * 1000;
        else if (timing === '15m') targetTs = itemTs - 15 * 60 * 1000;
        else if (timing === '30m') targetTs = itemTs - 30 * 60 * 1000;
        else if (timing === '1h') targetTs = itemTs - 60 * 60 * 1000;
        else if (timing === '1d') targetTs = itemTs - 24 * 60 * 60 * 1000;

        const reminderKey = `sched_${item.id}_${localTodayStr}_${item.startTime}_${timing}`;
        const diffMs = nowTs - targetTs;

        if (diffMs >= 0 && diffMs <= 30 * 60 * 1000 && !remindedScheduleKeysRef.current.has(reminderKey)) {
          remindedScheduleKeysRef.current.add(reminderKey);

          if (item.reminderType === 'alarm') {
            window.dispatchEvent(
              new CustomEvent('omnilifeos_trigger_alarm', {
                detail: {
                  id: `alarm-${item.id}-${Date.now()}`,
                  source: 'schedule',
                  title: `⏰ Task Alert: ${item.title}`,
                  subtitle: `${item.startTime} - ${item.endTime} • ${item.category || 'Schedule'}${item.location ? ` @ ${item.location}` : ''}`,
                  dueTime: item.startTime,
                  reminderType: 'alarm',
                  rawId: item.id,
                },
              })
            );
            notificationService.notify(`⏰ Schedule Alarm: ${item.title}`, {
              body: `${item.startTime} - ${item.endTime} • ${item.category || 'Schedule'}`,
              sound: 'alarm',
              category: 'schedule',
              tag: `alarm_sched_${item.id}`,
              isAlarm: true,
            });
          } else {
            pushNotification(
              `🔔 Task Reminder: ${item.title}`,
              `${item.startTime} - ${item.endTime} • ${item.category || 'Schedule'}${item.location ? ` @ ${item.location}` : ''}`,
              'task',
              { sound: 'task' }
            );
          }
        }
      });

      // 4. Check Habits Reminders (Daily checks)
      currHabits.forEach(habit => {
        if (habit.archived) return;
        if (!habit.reminderTime) return;
        if (!habit.reminderType || habit.reminderType === 'none') return;

        const habitReminderKey = `habit_${habit.id}_${localTodayStr}_${habit.reminderTime}`;
        if (currentTimeStr === habit.reminderTime && !remindedScheduleKeysRef.current.has(habitReminderKey)) {
          remindedScheduleKeysRef.current.add(habitReminderKey);

          if (habit.reminderType === 'alarm') {
            window.dispatchEvent(
              new CustomEvent('omnilifeos_trigger_alarm', {
                detail: {
                  id: `alarm-habit-${habit.id}-${Date.now()}`,
                  source: 'habit',
                  title: `⏰ Habit Reminder: ${habit.name}`,
                  subtitle: `Time to perform your habit!`,
                  dueTime: habit.reminderTime,
                  reminderType: 'alarm',
                  rawId: habit.id,
                },
              })
            );
            notificationService.notify(`⏰ Habit Alarm: ${habit.name}`, {
              body: 'Time to complete your scheduled daily habit!',
              sound: 'alarm',
              category: 'habit',
              tag: `alarm_habit_${habit.id}`,
              isAlarm: true,
            });
          } else {
            pushNotification(
              `🔔 Habit Reminder: ${habit.name}`,
              `Time to perform your habit!`,
              'habit',
              { sound: 'water' }
            );
          }
        }
      });

      // 5. Check Bill reminders
      currBills.forEach(bill => {
        if (bill.status === 'paid' || bill.isPaid || bill.archived) return;
        if (!bill.reminderType || bill.reminderType === 'none') return;
        const dueDateObj = new Date(bill.dueDate);
        if (isNaN(dueDateObj.getTime())) return;

        // Calculate reminder date
        const reminderDateObj = new Date(dueDateObj);
        reminderDateObj.setDate(dueDateObj.getDate() - (bill.reminderDaysBefore || 0));
        const reminderDateStr = `${reminderDateObj.getFullYear()}-${String(reminderDateObj.getMonth() + 1).padStart(2, '0')}-${String(reminderDateObj.getDate()).padStart(2, '0')}`;

        if (localTodayStr === reminderDateStr && currentTimeStr === '09:00') {
          const billReminderKey = `bill_${bill.id}_${localTodayStr}`;
          if (!remindedScheduleKeysRef.current.has(billReminderKey)) {
            remindedScheduleKeysRef.current.add(billReminderKey);

            if (bill.reminderType === 'alarm') {
              window.dispatchEvent(
                new CustomEvent('omnilifeos_trigger_alarm', {
                  detail: {
                    id: `alarm-bill-${bill.id}-${Date.now()}`,
                    source: 'bill',
                    title: `🚨 Bill Alert: ${bill.title}`,
                    subtitle: `Due in ${bill.reminderDaysBefore} days • Amount: ₹${bill.amount}`,
                    dueTime: '09:00',
                    reminderType: 'alarm',
                    rawId: bill.id,
                  },
                })
              );
              notificationService.notify(`🚨 Bill Alarm: ${bill.title}`, {
                body: `Due on ${bill.dueDate} • Amount: ₹${bill.amount}`,
                sound: 'alarm',
                category: 'bill',
                tag: `alarm_bill_${bill.id}`,
                isAlarm: true,
              });
            } else {
              pushNotification(
                `🔔 Bill Reminder: ${bill.title}`,
                `Due on ${bill.dueDate} (Amount: ₹${bill.amount})`,
                'bill',
                { sound: 'task' }
              );
            }
          }
        }
      });
    };

    // Listen for custom in-app push notifications (e.g. from Test button)
    const handlePushToast = (e: Event) => {
      const ce = e as CustomEvent<{ title: string; body: string; category?: AppNotification['category']; sound?: any }>;
      if (ce.detail) {
        pushNotification(ce.detail.title, ce.detail.body, ce.detail.category || 'task', { sound: ce.detail.sound || 'task' });
      }
    };
    window.addEventListener('omnilifeos_push_toast', handlePushToast);

    // Defer first reminder scan slightly so initial boot renders without main-thread contention
    const initialReminderTimer = setTimeout(checkReminders, 1500);

    // Background Web Worker ticker (every 10s, unthrottled in background tabs)
    const unsubscribeWorker = notificationService.subscribeTick(checkReminders);

    // Also re-check immediately when tab gains focus or screen turns on
    const handleVisibilityOrFocus = () => {
      soundEngine.resume();
      checkReminders();
    };
    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      clearTimeout(initialReminderTimer);
      unsubscribeWorker();
      window.removeEventListener('omnilifeos_push_toast', handlePushToast);
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [pushNotification]);

  // Handle Action button clicks from Service Worker system notifications
  useEffect(() => {
    const handleSnooze = (e: Event) => {
      const customEvent = e as CustomEvent<{ taskId: string }>;
      const tId = customEvent.detail?.taskId;
      if (!tId) return;
      const nowPlus5 = new Date(Date.now() + 5 * 60 * 1000);
      const hh = String(nowPlus5.getHours()).padStart(2, '0');
      const mm = String(nowPlus5.getMinutes()).padStart(2, '0');
      setTasks(prev =>
        prev.map(t =>
          t.id === tId
            ? {
                ...t,
                dueTime: `${hh}:${mm}`,
                lastDueRemindedAt: undefined,
                alerts: (t.alerts || []).map(a => ({ ...a, triggered: false })),
              }
            : t
        )
      );
      pushNotification('Snoozed 5 Minutes', 'Task reminder rescheduled for 5 minutes from now.', 'task');
    };

    const handleComplete = (e: Event) => {
      const customEvent = e as CustomEvent<{ taskId: string }>;
      const tId = customEvent.detail?.taskId;
      if (!tId) return;
      setTasks(prev =>
        prev.map(t => {
          if (t.id !== tId) return t;
          const nextCompleted = !t.completed;
          return {
            ...t,
            completed: nextCompleted,
            status: nextCompleted ? 'done' : 'todo',
            completedAt: nextCompleted ? new Date().toISOString() : undefined,
          };
        })
      );
      // pushNotification('Task Completed', 'Marked task as done from notification.', 'task');
    };

    window.addEventListener('omnilifeos_snooze_task', handleSnooze);
    window.addEventListener('omnilifeos_complete_task', handleComplete);

    // Handle cold-start notification actions launched from OS tray (?notifAction=complete|snooze&taskId=...)
    try {
      const params = new URLSearchParams(window.location.search);
      const action = params.get('notifAction');
      const taskId = params.get('taskId');
      if (action && taskId) {
        if (action === 'snooze') {
          handleSnooze(new CustomEvent('omnilifeos_snooze_task', { detail: { taskId } }));
        } else if (action === 'complete') {
          handleComplete(new CustomEvent('omnilifeos_complete_task', { detail: { taskId } }));
        }
        params.delete('notifAction');
        params.delete('taskId');
        const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', nextUrl);
      }
    } catch {}

    return () => {
      window.removeEventListener('omnilifeos_snooze_task', handleSnooze);
      window.removeEventListener('omnilifeos_complete_task', handleComplete);
    };
  }, [pushNotification]);

  // Synchronize upcoming due tasks/habits/meds/schedule/bills with native Android AlarmManager & exact Web timers
  useEffect(() => {
    const syncTimer = setTimeout(() => {
      const upcoming: Array<{
        id: string;
        entityId?: string;
        title: string;
        body: string;
        targetTs: number;
        category: 'task' | 'medication' | 'habit' | 'bill' | 'schedule';
        isAlarm?: boolean;
        sound?: 'pill' | 'water' | 'task' | 'alarm' | 'drop' | 'drip';
      }> = [];

      const nowTs = Date.now();
      const todayDate = new Date();
      const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

      tasks.forEach(task => {
        if (task.completed || task.archived || task.status === 'archived') return;
        if (!task.reminderType || task.reminderType === 'none') return;
        if (task.dueDate && task.dueTime) {
          const ts = parseDateTimeToTimestamp(task.dueDate, task.dueTime);
          if (ts && ts > nowTs) {
            upcoming.push({
              id: `task_due_${task.id}_${task.dueDate}_${task.dueTime}`,
              entityId: task.id,
              title: `${task.reminderType === 'alarm' ? '🚨' : '⏰'} ${task.title}`,
              body: `Due at ${task.dueTime} • ${task.category || task.project || 'Task'}`,
              targetTs: ts,
              category: 'task',
              isAlarm: task.reminderType === 'alarm',
              sound: task.reminderType === 'alarm' ? 'alarm' : 'drop',
            });
          }
        }
      });

      medications.forEach(med => {
        if (!med.active || med.archived || med.reminderType === 'none') return;
        med.schedules.forEach(sched => {
          const ts = parseDateTimeToTimestamp(todayStr, sched.time);
          if (ts && ts > nowTs) {
            upcoming.push({
              id: `med_${med.id}_${todayStr}_${sched.time}`,
              title: `💊 Medication: ${med.name}`,
              body: `${sched.label || sched.time} • ${med.dosage}`,
              targetTs: ts,
              category: 'medication',
              isAlarm: med.reminderType === 'alarm',
              sound: 'pill',
            });
          }
        });
      });

      habits.forEach(habit => {
        if (habit.archived || !habit.reminderTime || !habit.reminderType || habit.reminderType === 'none') return;
        const ts = parseDateTimeToTimestamp(todayStr, habit.reminderTime);
        if (ts && ts > nowTs) {
          upcoming.push({
            id: `habit_${habit.id}_${todayStr}_${habit.reminderTime}`,
            title: `🔥 Habit: ${habit.name}`,
            body: 'Time to complete your daily habit!',
            targetTs: ts,
            category: 'habit',
            isAlarm: habit.reminderType === 'alarm',
            sound: 'water',
          });
        }
      });

      scheduleItems.forEach(item => {
        if (item.completed || !item.reminderType || item.reminderType === 'none' || item.reminderTiming === 'none') return;
        if (!isScheduleItemOnDate(item, todayStr)) return;
        const ts = parseDateTimeToTimestamp(todayStr, item.startTime || '09:00');
        if (ts && ts > nowTs) {
          upcoming.push({
            id: `sched_${item.id}_${todayStr}_${item.startTime}`,
            title: `📅 ${item.title}`,
            body: `${item.startTime} - ${item.endTime} • ${item.category || 'Schedule'}`,
            targetTs: ts,
            category: 'schedule',
            isAlarm: item.reminderType === 'alarm',
            sound: 'task',
          });
        }
      });

      notificationService.syncScheduledReminders(upcoming);
    }, 800);

    return () => clearTimeout(syncTimer);
  }, [tasks, medications, habits, scheduleItems, bills]);

  // Auth Methods
  const login = async (identifier: string, isPhone: boolean, require2FA: boolean = true) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, type: isPhone ? 'phone' : 'email', require2FA }),
      });
      const data = await res.json();
      if (data.status === '2fa_required') {
        return { need2FA: true, devCode: data.devHintCode };
      }
      if (data.user) {
        const cleanIdentifier = String(data.user.identifier || identifier).trim().toLowerCase();
        localStorage.setItem('omniplan_user_explicit_login', 'true');
        if (cleanIdentifier.includes('@')) {
          setSyncEmailState(cleanIdentifier);
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_sync_email`, cleanIdentifier);
          setSavedSyncEmails(prev => (prev.includes(cleanIdentifier) ? prev : [...prev, cleanIdentifier]));
        }
        setProfile(prev => ({
          ...prev,
          id: data.user.id,
          identifier: cleanIdentifier,
          name: data.user.name,
          type: data.user.type,
          twoFactorEnabled: false,
        }));
      }
      return { need2FA: false };
    } catch {
      // Offline fallback
      const cleanIdentifier = identifier.trim().toLowerCase();
      localStorage.setItem('omniplan_user_explicit_login', 'true');
      if (cleanIdentifier.includes('@')) {
        setSyncEmailState(cleanIdentifier);
        localStorage.setItem(`${LOCAL_STORAGE_KEY}_sync_email`, cleanIdentifier);
        setSavedSyncEmails(prev => (prev.includes(cleanIdentifier) ? prev : [...prev, cleanIdentifier]));
      }
      setProfile(prev => ({
        ...prev,
        identifier: cleanIdentifier,
        name: isPhone ? `User ${cleanIdentifier.slice(-4)}` : cleanIdentifier.split('@')[0],
        type: isPhone ? 'phone' : 'email',
      }));
      return { need2FA: false };
    }
  };

  const verify2FA = async (code: string) => {
    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: profile.identifier, code }),
      });
      const data = await res.json();
      if (data.status === 'authenticated') {
        localStorage.setItem('omniplan_user_explicit_login', 'true');
        setProfile(prev => ({
          ...prev,
          twoFactorEnabled: true,
        }));
        pushNotification('2FA Verified', 'Two-Factor Authentication successfully confirmed.', 'system');
        return true;
      }
      return false;
    } catch {
      return true;
    }
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    setAuthError(null);
    try {
      const user = await signInWithGoogle();
      if (user) {
        localStorage.setItem('omniplan_user_explicit_login', 'true');
        pushNotification(
          'Google Account Connected',
          `Signed in as ${user.displayName || user.email}. Cloud sync active.`,
          'system'
        );
        soundEngine.playSuccessChime();
        return true;
      }
      return false;
    } catch (e: any) {
      const msg = e?.message || 'Google sign-in could not be completed.';
      console.error('Google login error:', e);
      setAuthError(msg);
      pushNotification('Sign-In Notice', msg, 'system');
      return false;
    }
  };

  const logout = () => {
    try {
      firebaseSignOut(auth).catch(() => {});
      localStorage.removeItem('omniplan_user_explicit_login');
      localStorage.removeItem(`${LOCAL_STORAGE_KEY}_sync_email`);
      localStorage.removeItem(`${LOCAL_STORAGE_KEY}_profile`);
    } catch {}
    setFirebaseUser(null);
    setSyncEmailState('');
    setProfile(initialProfile);
    pushNotification('Logged Out', 'You have signed out of your account.', 'system');
  };

  // Medication handlers
  const addMedication = (med: Omit<Medication, 'id'>) => {
    const nowIso = new Date().toISOString();
    const newMed: Medication = {
      ...med,
      id: `med_${Date.now()}`,
      updatedAt: nowIso,
    };
    setMedications(prev => [newMed, ...prev]);
    pushNotification(`Medication Added`, `${newMed.name} added to schedule.`, 'medication');
  };

  const updateMedication = (med: Medication) => {
    const nowIso = new Date().toISOString();
    setMedications(prev =>
      prev.map(m => (m.id === med.id ? { ...med, updatedAt: nowIso } : m))
    );
  };

  const deleteMedication = (id: string) => {
    recordDeletedId(id);
    setMedications(prev => prev.filter(m => m.id !== id));
  };

  const logDose = (medicationId: string, scheduledTime: string, status: 'taken' | 'skipped' | 'snoozed') => {
    const targetMed = medications.find(m => m.id === medicationId);
    if (!targetMed) return;

    const nowIso = new Date().toISOString();
    const newLog: DoseLog = {
      id: `log_${Date.now()}`,
      medicationId,
      medicationName: targetMed.name,
      scheduledTime,
      loggedAt: nowIso,
      status,
      updatedAt: nowIso,
    };
    setDoseLogs(prev => [newLog, ...prev]);

    if (status === 'taken') {
      // Reduce pill count
      setMedications(prev =>
        prev.map(m =>
          m.id === medicationId
            ? { ...m, remainingPills: Math.max(0, m.remainingPills - 1), updatedAt: nowIso }
            : m
        )
      );
      soundEngine.playSuccessChime();
      pushNotification(
        'Dose Logged',
        `Logged ${targetMed.name} as taken. (${Math.max(0, targetMed.remainingPills - 1)} pills remaining)`,
        'medication'
      );
    }
  };

  const unlogDose = (medicationId: string, scheduledTime: string, dateStr?: string) => {
    const targetMed = medications.find(m => m.id === medicationId);
    if (!targetMed) return;
    const targetDate = dateStr || new Date().toISOString().split('T')[0];

    const idsToRemove = new Set<string>();
    let takenRemovedCount = 0;

    if (scheduledTime === 'ALL_TODAY') {
      doseLogs.forEach(log => {
        if (log.medicationId === medicationId && log.loggedAt.startsWith(targetDate)) {
          idsToRemove.add(log.id);
          if (log.status === 'taken') takenRemovedCount += 1;
        }
      });
    } else if (scheduledTime === 'PRN') {
      const latestLog = doseLogs.find(
        log => log.medicationId === medicationId && log.loggedAt.startsWith(targetDate)
      );
      if (latestLog) {
        idsToRemove.add(latestLog.id);
        if (latestLog.status === 'taken') takenRemovedCount = 1;
      }
    } else {
      doseLogs.forEach(log => {
        if (
          log.medicationId === medicationId &&
          log.scheduledTime === scheduledTime &&
          log.loggedAt.startsWith(targetDate)
        ) {
          idsToRemove.add(log.id);
          if (log.status === 'taken') takenRemovedCount += 1;
        }
      });
    }

    if (idsToRemove.size === 0) return;

    idsToRemove.forEach(removedId => recordDeletedId(removedId));
    setDoseLogs(prev => prev.filter(log => !idsToRemove.has(log.id)));

    if (takenRemovedCount > 0) {
      const nowIso = new Date().toISOString();
      setMedications(prev =>
        prev.map(m =>
          m.id === medicationId
            ? { ...m, remainingPills: m.remainingPills + takenRemovedCount, updatedAt: nowIso }
            : m
        )
      );
    }

    soundEngine.playClick();
    pushNotification(
      'Dose Unticked',
      `Reverted ${targetMed.name}${takenRemovedCount > 0 ? ` (+${takenRemovedCount} pill${takenRemovedCount > 1 ? 's' : ''} restored)` : ''}.`,
      'medication'
    );
  };

  const refillPills = (medicationId: string, quantity: number) => {
    const nowIso = new Date().toISOString();
    setMedications(prev =>
      prev.map(m =>
        m.id === medicationId
          ? {
              ...m,
              remainingPills: m.remainingPills + quantity,
              totalPills: m.totalPills + quantity,
              updatedAt: nowIso,
            }
          : m
      )
    );
    soundEngine.playSuccessChime();
    pushNotification('Pill Stock Refilled', `Added ${quantity} units to inventory.`, 'medication');
  };

  // Hydration Handlers
  const addWater = (amount: number, unit: string = 'ml') => {
    const u = unit.toLowerCase().trim();
    let amountMl = amount;
    if (u === 'litre' || u === 'litres' || u === 'l') {
      amountMl = amount * 1000;
    } else if (u === 'glass' || u === 'glasses' || u === 'gl') {
      amountMl = amount * 250;
    } else if (u === 'cup' || u === 'cups') {
      amountMl = amount * 250;
    } else if (u === 'kg' || u === 'kilogram' || u === 'kilograms') {
      amountMl = amount * 1000;
    } else if (u === 'oz' || u === 'ounce' || u === 'ounces' || u === 'fl oz') {
      amountMl = amount * 29.5735;
    } else {
      amountMl = amount; // ml
    }
    amountMl = Math.round(amountMl);

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setHydration(prev => {
      const currentTotal = Math.max(0, (prev.todayLogs || []).reduce((acc, curr) => acc + (curr.amountMl || 0), 0));

      // Prevent going below 0!
      if (amountMl < 0 && currentTotal <= 0) {
        return prev;
      }

      let effectiveAmountMl = amountMl;
      if (amountMl < 0 && currentTotal + amountMl < 0) {
        effectiveAmountMl = -currentTotal;
      }

      if (effectiveAmountMl === 0) {
        return prev;
      }

      const newLog = {
        id: `hyd_${Date.now()}`,
        amount: Math.round(effectiveAmountMl),
        unit,
        amountMl: Math.round(effectiveAmountMl),
        timestamp: timeStr,
      };

      const updatedLogs = [...prev.todayLogs, newLog];
      const totalToday = Math.max(0, updatedLogs.reduce((acc, curr) => acc + (curr.amountMl || 0), 0));
      const isGoalMet = totalToday >= prev.targetMl;

      const todayStr = formatLocalDate();
      setHabits(habitsPrev =>
        habitsPrev.map(h => {
          const isWaterHabit =
            Boolean(h.syncHydration) ||
            h.id === 'hab_1' ||
            h.name.toLowerCase().includes('water') ||
            h.name.toLowerCase().includes('hydration');
          if (isWaterHabit) {
            const history = h.completionHistory || {};
            const hUnit = (h.unit || prev.preferredUnit || 'ml').toLowerCase();
            const isLitre = hUnit === 'l' || hUnit === 'litre' || hUnit === 'litres';
            const isGlasses = hUnit === 'glasses' || hUnit === 'glass' || hUnit === 'gl';
            const counterVal = isLitre
              ? Math.max(0, Math.round((totalToday / 1000) * 100) / 100)
              : isGlasses
                ? Math.max(0, Math.round(totalToday / 250))
                : Math.max(0, totalToday);
            const nextHistory = {
              ...history,
              [todayStr]: isGoalMet,
            };
            const { currentStreak, bestStreak } = calculateHabitStreak(nextHistory);

            return {
              ...h,
              counterValue: counterVal,
              completionHistory: nextHistory,
              currentStreak,
              bestStreak: Math.max(h.bestStreak || 0, bestStreak),
            };
          }
          return h;
        })
      );

      return {
        ...prev,
        todayLogs: updatedLogs,
      };
    });

    if (amountMl > 0) {
      soundEngine.playWaterChime();
      const totalToday = Math.max(0, hydration.todayLogs.reduce((acc, curr) => acc + (curr.amountMl || 0), 0) + amountMl);
      if (totalToday >= hydration.targetMl && totalToday - amountMl < hydration.targetMl) {
        pushNotification('Daily Goal Reached! 🎉', `You reached your ${hydration.targetMl}ml water target!`, 'water');
      }
    } else {
      soundEngine.playSuccessChime();
    }
  };

  const setHydrationTarget = (targetMl: number, preferredUnit?: string) => {
    const validTargetMl = Math.max(250, Math.round(targetMl));
    const effectiveUnit = (preferredUnit || 'ml').toLowerCase();
    const isLitre = ['l', 'litre', 'litres'].includes(effectiveUnit);
    const isGlasses = ['glasses', 'glass', 'gl'].includes(effectiveUnit);
    const standardUnit = isLitre ? 'litres' : isGlasses ? 'glasses' : 'ml';

    setHydration(prev => ({
      ...prev,
      targetMl: validTargetMl,
      preferredUnit: preferredUnit || prev.preferredUnit || standardUnit,
    }));

    // Keep water habits in sync with target and unit
    setHabits(prev =>
      prev.map(h => {
        const isWater = h.syncHydration && (h.name.toLowerCase().includes('water') || h.name.toLowerCase().includes('hydration') || (h.unit && ['ml', 'l', 'litre', 'litres', 'glasses', 'gl'].some(u => h.unit?.toLowerCase().includes(u))));
        if (isWater) {
          return {
            ...h,
            unit: standardUnit,
            targetCount: isLitre 
              ? Math.round((validTargetMl / 1000) * 10) / 10 
              : isGlasses 
                ? Math.max(1, Math.round(validTargetMl / 250)) 
                : validTargetMl,
            incrementStep: isLitre ? 0.25 : isGlasses ? 1 : 250,
          };
        }
        return h;
      })
    );
  };

  const setHydrationPreferredUnit = (preferredUnit: string) => {
    const u = preferredUnit.toLowerCase();
    const isLitre = ['l', 'litre', 'litres'].includes(u);
    const isGlasses = ['glasses', 'glass', 'gl'].includes(u);
    const standardUnit = isLitre ? 'litres' : isGlasses ? 'glasses' : 'ml';
    setHydration(prev => ({
      ...prev,
      preferredUnit: standardUnit,
    }));
    setHabits(prev =>
      prev.map(h => {
        const isWater = h.syncHydration && (h.name.toLowerCase().includes('water') || h.name.toLowerCase().includes('hydration') || (h.unit && ['ml', 'l', 'litre', 'litres', 'glasses', 'gl'].some(u => h.unit?.toLowerCase().includes(u))));
        if (isWater) {
          const targetMl = hydration.targetMl || 3000;
          return {
            ...h,
            unit: standardUnit,
            targetCount: isLitre 
              ? Math.round((targetMl / 1000) * 10) / 10 
              : isGlasses 
                ? Math.max(1, Math.round(targetMl / 250)) 
                : targetMl,
            incrementStep: isLitre ? 0.25 : isGlasses ? 1 : 250,
          };
        }
        return h;
      })
    );
  };

  const setHydrationIntakePerClick = (amountMl: number) => {
    const validAmount = Math.max(50, Math.round(amountMl));
    setHydration(prev => ({
      ...prev,
      intakePerClick: validAmount,
    }));
  };

  const toggleWaterReminder = (enabled: boolean, intervalHours: number = 2) => {
    setHydration(prev => ({
      ...prev,
      reminderEnabled: enabled,
      reminderIntervalHours: intervalHours,
    }));
  };

  const toggleAdaptiveWaterReminder = (enabled: boolean) => {
    setHydration(prev => ({
      ...prev,
      adaptiveRemindersEnabled: enabled,
    }));
  };

  const sendAdaptiveHydrationNotification = useCallback((force: boolean = false) => {
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    
    // Active window: 07:30 to 22:00
    const wakeHour = 7.5;
    const sleepHour = 22.0;

    const targetMl = hydration.targetMl || 3000;
    const currentTotalMl = Math.max(0, (hydration.todayLogs || []).reduce((acc, c) => acc + (c.amountMl || 0), 0));
    const progressPct = Math.round((currentTotalMl / targetMl) * 100);
    const remainingMl = Math.max(0, targetMl - currentTotalMl);

    const isLitre = (hydration.preferredUnit || '').toLowerCase().includes('l');
    const formatVol = (ml: number) => {
      if (isLitre) {
        return `${(ml / 1000).toFixed(1).replace(/\.0$/, '')}L`;
      }
      return `${Math.round(ml)}ml`;
    };

    const targetDisplay = formatVol(targetMl);
    const currentDisplay = formatVol(currentTotalMl);
    const remainingDisplay = formatVol(remainingMl);

    // Calculate time elapsed in active window (0 to 1)
    let dayFraction = 0;
    if (currentHour <= wakeHour) {
      dayFraction = 0.05;
    } else if (currentHour >= sleepHour) {
      dayFraction = 1.0;
    } else {
      dayFraction = (currentHour - wakeHour) / (sleepHour - wakeHour);
    }

    const expectedMl = Math.round(targetMl * dayFraction);
    const deficitMl = expectedMl - currentTotalMl;

    let pace: 'ahead' | 'on_track' | 'behind' | 'goal_reached' = 'on_track';
    let title = '';
    let message = '';

    if (progressPct >= 100) {
      pace = 'goal_reached';
      title = 'Hydration Goal Achieved! 🎉';
      message = `Incredible job! You've completed your daily target of ${targetDisplay} (${currentDisplay} logged). Stay refreshed!`;
    } else if (progressPct >= 80) {
      pace = 'on_track';
      title = 'Hydration: Final Stretch! 💧';
      message = `You're at ${progressPct}%! Only ${remainingDisplay} remaining to reach your ${targetDisplay} daily target.`;
    } else if (deficitMl > 350) {
      pace = 'behind';
      title = 'Hydration Nudge: Falling Behind Pace 💧';
      message = `You're at ${progressPct}% (${currentDisplay} / ${targetDisplay}), approximately ${formatVol(deficitMl)} behind your ideal pace for ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Drink a glass now!`;
    } else if (deficitMl > 100) {
      pace = 'behind';
      title = 'Hydration Check-in 🥛';
      message = `Midday pace reminder: You're at ${progressPct}% of your ${targetDisplay} target. Take a quick sip to stay on track.`;
    } else {
      pace = deficitMl < -250 ? 'ahead' : 'on_track';
      title = 'Hydration Pace: On Track! 💧';
      message = `Great rhythm! You've logged ${currentDisplay} (${progressPct}% of ${targetDisplay}). Keep up the healthy habit!`;
    }

    // Check last drink time
    const lastLog = hydration.todayLogs && hydration.todayLogs.length > 0 
      ? hydration.todayLogs[hydration.todayLogs.length - 1] 
      : null;

    if (lastLog && lastLog.timestamp && progressPct < 100) {
      const [h, m] = lastLog.timestamp.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const lastLogHour = h + m / 60;
        const hoursSince = currentHour - lastLogHour;
        if (hoursSince >= 2.5) {
          title = `Hydration Reminder: ${hoursSince.toFixed(1)}h Since Last Drink 💧`;
          message = `It's been over ${hoursSince.toFixed(1)} hours since you logged water. You're currently at ${currentDisplay} (${progressPct}%). Time to grab a glass!`;
        }
      }
    }

    if (!force) {
      // Sleep window protection
      if (currentHour < wakeHour || currentHour > sleepHour) {
        return null;
      }
      const isEnabled = hydration.reminderEnabled || hydration.adaptiveRemindersEnabled;
      if (!isEnabled) {
        return null;
      }
    }

    pushNotification(title, message, 'water');
    soundEngine.playWaterDrip();

    setHydration(prev => ({
      ...prev,
      lastAdaptiveReminderTime: now.toISOString(),
    }));

    return { title, message, pace, deficitMl, progressPct };
  }, [hydration, pushNotification]);

  // Adaptive Hydration Notification Loop
  useEffect(() => {
    const isEnabled = hydration.reminderEnabled || hydration.adaptiveRemindersEnabled;
    if (!isEnabled) return;

    const interval = setInterval(() => {
      const now = new Date();
      const lastStr = hydration.lastAdaptiveReminderTime;
      const lastTime = lastStr ? new Date(lastStr).getTime() : 0;
      const nowTime = now.getTime();

      const currentTotalMl = Math.max(0, (hydration.todayLogs || []).reduce((acc, c) => acc + (c.amountMl || 0), 0));
      const targetMl = hydration.targetMl || 3000;
      if (currentTotalMl >= targetMl) return;

      const currentHour = now.getHours() + now.getMinutes() / 60;
      if (currentHour < 7.5 || currentHour > 22) return; // sleep window

      const dayFraction = (currentHour - 7.5) / 14.5;
      const expectedMl = targetMl * dayFraction;
      const isBehind = expectedMl - currentTotalMl > 300;

      const intervalMinutes = isBehind ? 90 : (hydration.reminderIntervalHours || 2) * 60;
      const elapsedMinutes = (nowTime - lastTime) / (1000 * 60);

      if (elapsedMinutes >= intervalMinutes) {
        sendAdaptiveHydrationNotification(false);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [hydration, sendAdaptiveHydrationNotification]);

  // List Groups & Todo Lists Handlers
  const addListGroup = (group: Omit<ListGroup, 'id'>) => {
    const newG: ListGroup = {
      ...group,
      id: `group_${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    setListGroups(prev => [...prev, newG]);
    soundEngine.playSuccessChime();
    pushNotification('Group Created', `"${newG.name}" list group created.`, 'task');
  };

  const updateListGroup = (group: ListGroup) => {
    const nowIso = new Date().toISOString();
    setListGroups(prev =>
      prev.map(g => (g.id === group.id ? { ...group, updatedAt: nowIso } : g))
    );
  };

  const deleteListGroup = (id: string) => {
    recordDeletedId(id);
    setListGroups(prev => prev.filter(g => g.id !== id));
  };

  const addTodoList = (list: Omit<TodoList, 'id'>) => {
    const nowIso = new Date().toISOString();
    const newL: TodoList = {
      ...list,
      id: `list_${Date.now()}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setTodoLists(prev => [...prev, newL]);
    soundEngine.playSuccessChime();
    pushNotification('List Created', `"${newL.name}" created.`, 'task');
  };

  const updateTodoList = (list: TodoList) => {
    const nowIso = new Date().toISOString();
    setTodoLists(prev =>
      prev.map(l => (l.id === list.id ? { ...list, updatedAt: nowIso } : l))
    );
  };

  const deleteTodoList = (id: string) => {
    recordDeletedId(id);
    setTodoLists(prev => prev.filter(l => l.id !== id));
    if (selectedListId === id) setSelectedListId('all');
  };

  // Helper for next recurring date
  const computeNextRecurringDate = (
    currentDateStr: string,
    recurring: TaskItem['recurring']
  ): string => {
    const base = currentDateStr ? new Date(currentDateStr) : new Date();
    const d = isNaN(base.getTime()) ? new Date() : new Date(base);

    if (recurring === 'daily') {
      d.setDate(d.getDate() + 1);
    } else if (recurring === 'weekdays') {
      do {
        d.setDate(d.getDate() + 1);
      } while (d.getDay() === 0 || d.getDay() === 6);
    } else if (recurring === 'weekly') {
      d.setDate(d.getDate() + 7);
    } else if (recurring === 'biweekly') {
      d.setDate(d.getDate() + 14);
    } else if (recurring === 'monthly') {
      d.setMonth(d.getMonth() + 1);
    } else if (recurring === 'yearly') {
      d.setFullYear(d.getFullYear() + 1);
    }
    return d.toISOString().split('T')[0];
  };

  // Inbox Handlers
  const addInboxItem = (item: Omit<InboxItem, 'id' | 'createdAt'>) => {
    const nowIso = new Date().toISOString();
    const newItem: InboxItem = {
      ...item,
      id: `inbox_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setInboxItems(prev => [newItem, ...prev]);
    soundEngine.playSuccessChime();
    pushNotification('Captured to Inbox', `"${newItem.title}" added to your inbox.`, 'system');
  };

  const updateInboxItem = (id: string, updates: Partial<InboxItem>) => {
    const nowIso = new Date().toISOString();
    setInboxItems(prev =>
      prev.map(item => (item.id === id ? { ...item, ...updates, updatedAt: nowIso } : item))
    );
  };

  const deleteInboxItem = (id: string) => {
    recordDeletedId(id);
    setInboxItems(prev => prev.filter(item => item.id !== id));
  };

  const toggleInboxItemComplete = (id: string) => {
    const nowIso = new Date().toISOString();
    setInboxItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          const willComplete = !item.isCompleted;
          if (willComplete) soundEngine.playWaterDropNotification();
          return { ...item, isCompleted: willComplete, updatedAt: nowIso };
        }
        return item;
      })
    );
  };

  const convertInboxItemToTask = (id: string, taskUpdates?: Partial<TaskItem>) => {
    const item = inboxItems.find(i => i.id === id);
    if (!item) return;

    addTask({
      title: item.title,
      notes: item.details || '',
      priority: item.priority === 'high' || (item.priority as string) === 'p1' ? 'high' : item.priority === 'medium' || (item.priority as string) === 'p2' ? 'medium' : 'low',
      dueDate: item.dueDate || new Date().toISOString().split('T')[0],
      dueTime: '12:00',
      project: 'Inbox Captures',
      projectId: 'proj_personal',
      listId: 'list_inbox',
      quadrant: item.priority === 'high' || (item.priority as string) === 'p1' ? 'urgent_important' : item.priority === 'medium' || (item.priority as string) === 'p2' ? 'not_urgent_important' : 'urgent_not_important',
      status: 'todo',
      completed: false,
      estimatedPomodoros: 1,
      recurring: 'none',
      subtasks: [],
      tags: item.contextTag ? [item.contextTag] : ['inbox'],
      ...taskUpdates,
    });

    updateInboxItem(id, { isCompleted: true, convertedTo: 'task' });
    pushNotification('Converted to Task', `"${item.title}" triaged into your Task list.`, 'task');
  };

  // Task Handlers
  const addTask = (taskData: Omit<TaskItem, 'id' | 'createdAt' | 'completedPomodoros'>) => {
    const defaultCat = taskData.category || (taskData.project ? taskData.project.toLowerCase() : 'personal');
    const newTask: TaskItem = {
      ...taskData,
      category: defaultCat,
      status: taskData.status || 'todo',
      quadrant: taskData.quadrant || 'urgent_important',
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      completedPomodoros: 0,
      listId: taskData.listId || (selectedListId !== 'all' && selectedListId !== 'inbox' && !['today', 'upcoming', 'starred', 'recurring', 'someday', 'completed'].includes(selectedListId) ? selectedListId : 'list_inbox'),
      recurring: taskData.recurring || 'none',
      reminderType: taskData.reminderType || 'none',
    };
    setTasks(prev => [newTask, ...prev]);
    if (newTask.reminderType && newTask.reminderType !== 'none') {
      notificationService.ensurePermissionSilentlyOnAction();
    }
    soundEngine.playSuccessChime();
    pushNotification('Task Created', `"${newTask.title}" added to ${newTask.category || newTask.project || 'Tasks'}.`, 'task', { sound: 'drop' });
    return newTask;
  };

  const batchAddTasks = (newTasks: Omit<TaskItem, 'id' | 'createdAt' | 'completedPomodoros'>[]) => {
    const created: TaskItem[] = newTasks.map((t, idx) => ({
      ...t,
      category: t.category || (t.project ? t.project.toLowerCase() : 'personal'),
      id: `task_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      completedPomodoros: 0,
      status: t.status || 'todo',
      quadrant: t.quadrant || 'urgent_important',
      listId: t.listId || (selectedListId !== 'all' && !['today', 'upcoming', 'starred', 'recurring', 'someday', 'completed'].includes(selectedListId) ? selectedListId : 'list_inbox'),
      recurring: t.recurring || 'none',
      reminderType: t.reminderType || 'none',
    }));
    setTasks(prev => [...created, ...prev]);
    soundEngine.playSuccessChime();
    pushNotification('Tasks Added', `Added ${created.length} new tasks to your schedule.`, 'task', { sound: 'drop' });
  };

  const updateTask = (task: TaskItem) => {
    const nowIso = new Date().toISOString();
    setTasks(prev =>
      prev.map(t => {
        if (t.id !== task.id) return t;
        const timeOrDateChanged = t.dueTime !== task.dueTime || t.dueDate !== task.dueDate;
        return {
          ...task,
          updatedAt: nowIso,
          lastDueRemindedAt: timeOrDateChanged ? undefined : task.lastDueRemindedAt,
          alerts: task.alerts
            ? task.alerts.map(a => (timeOrDateChanged ? { ...a, triggered: false } : a))
            : undefined,
        };
      })
    );
  };

  const deleteTask = (id: string) => {
    recordDeletedId(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const toggleStarTask = (taskId: string) => {
    const nowIso = new Date().toISOString();
    setTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, isStarred: !t.isStarred, updatedAt: nowIso } : t))
    );
  };

  const toggleTask = (id: string, options?: { skipUndoSnackbar?: boolean; skipSound?: boolean }) => {
    let completedTaskSnapshot: TaskItem | null = null;
    let wasCompleting = false;
    let recurringNextDate: string | null = null;

    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const localTodayStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;

    setTasks(prev => {
      const found = prev.find(t => t.id === id);
      const isRecurringFound = Boolean(found && found.recurring && found.recurring !== 'none');
      const isRecurringDoneToday = Boolean(
        found &&
          isRecurringFound &&
          !found.completed &&
          (found.lastCompletedDate === localTodayStr || found.completedAt?.startsWith(localTodayStr))
      );

      if (found && !found.completed && found.status !== 'done' && !isRecurringDoneToday) {
        wasCompleting = true;
        completedTaskSnapshot = { ...found };
      }

      return prev.map(t => {
        if (t.id === id) {
          const isRecurring = Boolean(t.recurring && t.recurring !== 'none');
          const wasRecurringDoneToday = Boolean(
            isRecurring &&
              !t.completed &&
              (t.lastCompletedDate === localTodayStr || t.completedAt?.startsWith(localTodayStr))
          );

          // If a recurring task was already completed today, clicking again un-completes today's instance
          if (wasRecurringDoneToday) {
            return {
              ...t,
              dueDate: t.previousDueDate || t.dueDate,
              previousDueDate: undefined,
              completed: false,
              status: 'todo',
              completedAt: undefined,
              lastCompletedDate: undefined,
              streak: Math.max(0, (t.streak || 1) - 1),
              updatedAt: nowIso,
            };
          }

          const willComplete = !t.completed;
          if (willComplete && !options?.skipSound) {
            soundEngine.playWaterDropNotification();
          }

          const nextStreak = willComplete ? (t.streak || 0) + 1 : Math.max(0, (t.streak || 1) - 1);

          // If completing a recurring task, advance dueDate cleanly once for today and record completion metadata
          if (willComplete && isRecurring) {
            const nextDate = computeNextRecurringDate(t.dueDate || localTodayStr, t.recurring);
            recurringNextDate = nextDate;
            const resetAlerts = (t.alerts || []).map(a => ({ ...a, triggered: false }));

            // Log silently to history so no duplicate AutoDismissToast collides with UndoSnackbar
            if (Date.now() - (lastNotifRef.current[t.id] || 0) > 1000) {
              lastNotifRef.current[t.id] = Date.now();
              pushNotification(
                'Recurring Task Advanced',
                `"${t.title}" completed! Next reminder scheduled for ${nextDate}.`,
                'task',
                { vibrate: false, silent: true }
              );
            }
            return {
              ...t,
              previousDueDate: t.dueDate,
              dueDate: nextDate,
              completed: false,
              status: 'todo',
              completedAt: nowIso,
              lastCompletedDate: localTodayStr,
              alerts: resetAlerts,
              streak: nextStreak,
              updatedAt: nowIso,
            };
          }

          return {
            ...t,
            completed: willComplete,
            status: willComplete ? 'done' : 'todo',
            completedAt: willComplete ? nowIso : undefined,
            lastCompletedDate: willComplete ? localTodayStr : undefined,
            streak: nextStreak,
            updatedAt: nowIso,
          };
        }
        return t;
      });
    });

    if (wasCompleting && completedTaskSnapshot && !options?.skipUndoSnackbar) {
      const snapshot: TaskItem = completedTaskSnapshot;
      showUndoSnackbar({
        type: 'task',
        targetId: id,
        title: snapshot.title,
        subtitle: recurringNextDate ? `Recurring · Next: ${recurringNextDate}` : undefined,
        onUndo: () => {
          const undoIso = new Date().toISOString();
          setTasks(prev =>
            prev.map(t =>
              t.id === id
                ? {
                    ...t,
                    completed: false,
                    status: 'todo',
                    completedAt: snapshot.completedAt,
                    lastCompletedDate: snapshot.lastCompletedDate,
                    previousDueDate: snapshot.previousDueDate,
                    dueDate: snapshot.dueDate,
                    alerts: snapshot.alerts,
                    streak: snapshot.streak,
                    updatedAt: undoIso,
                  }
                : t
            )
          );
        },
      });
    }
  };

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    const nowIso = new Date().toISOString();
    setTasks(prev =>
      prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            updatedAt: nowIso,
            subtasks: t.subtasks.map(s =>
              s.id === subtaskId ? { ...s, completed: !s.completed } : s
            ),
          };
        }
        return t;
      })
    );
  };

  const setTaskStatus = (taskId: string, status: TaskStatus) => {
    let completedTaskSnapshot: TaskItem | null = null;
    let wasCompleting = false;
    const nowIso = new Date().toISOString();

    setTasks(prev => {
      const found = prev.find(t => t.id === taskId);
      if (found && !found.completed && found.status !== 'done' && status === 'done') {
        wasCompleting = true;
        completedTaskSnapshot = { ...found };
      }
      return prev.map(t => {
        if (t.id === taskId) {
          const isDone = status === 'done';
          if (isDone && !t.completed) soundEngine.playWaterDropNotification();
          const nextStreak = isDone ? (t.streak || 0) + 1 : (t.completed ? Math.max(0, (t.streak || 1) - 1) : t.streak);
          return {
            ...t,
            status,
            completed: isDone,
            completedAt: isDone ? nowIso : undefined,
            streak: nextStreak,
            updatedAt: nowIso,
          };
        }
        return t;
      });
    });

    if (wasCompleting && completedTaskSnapshot) {
      const snapshot: TaskItem = completedTaskSnapshot;
      showUndoSnackbar({
        type: 'task',
        targetId: taskId,
        title: snapshot.title,
        onUndo: () => {
          const undoIso = new Date().toISOString();
          setTasks(prev =>
            prev.map(t =>
              t.id === taskId
                ? {
                    ...t,
                    completed: false,
                    status: 'todo',
                    completedAt: undefined,
                    dueDate: snapshot.dueDate,
                    alerts: snapshot.alerts,
                    streak: snapshot.streak,
                    updatedAt: undoIso,
                  }
                : t
            )
          );
        },
      });
    }
  };

  const setTaskQuadrant = (taskId: string, quadrant: EisenhowerQuadrant) => {
    const quadPriorityMap: Record<string, Priority> = {
      urgent_important: 'high',
      not_urgent_important: 'medium',
      urgent_not_important: 'low',
      not_urgent_not_important: 'low',
      neither: 'low',
    };
    const nextPriority = quadPriorityMap[quadrant] || 'medium';
    const nowIso = new Date().toISOString();
    setTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, quadrant, priority: nextPriority, updatedAt: nowIso } : t))
    );
  };

  // Schedule & Time-Blocking Handlers
  const addScheduleItem = (itemData: Omit<ScheduleItem, 'id' | 'createdAt'>) => {
    const nowIso = new Date().toISOString();
    const newItem: ScheduleItem = {
      ...itemData,
      id: `sched_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setScheduleItems(prev =>
      [...prev, newItem].sort((a, b) => a.startTime.localeCompare(b.startTime))
    );
    soundEngine.playSuccessChime();
    pushNotification('Task Scheduled', `"${newItem.title}" set for ${newItem.startTime}.`, 'calendar');
  };

  const updateScheduleItem = (item: ScheduleItem) => {
    const nowIso = new Date().toISOString();
    setScheduleItems(prev =>
      prev.map(s => (s.id === item.id ? { ...item, updatedAt: nowIso } : s)).sort((a, b) => a.startTime.localeCompare(b.startTime))
    );
  };

  const deleteScheduleItem = (id: string) => {
    recordDeletedId(id);
    setScheduleItems(prev => prev.filter(s => s.id !== id));
  };

  const toggleScheduleItem = (id: string) => {
    const nowIso = new Date().toISOString();
    setScheduleItems(prev =>
      prev.map(s => {
        if (s.id === id) {
          const willComplete = !s.completed;
          if (willComplete) soundEngine.playWaterDropNotification();
          // If linked to a task, keep task status in sync
          if (s.taskId) {
            setTasks(taskPrev =>
              taskPrev.map(t =>
                t.id === s.taskId
                  ? {
                      ...t,
                      completed: willComplete,
                      status: willComplete ? 'done' : 'todo',
                      completedAt: willComplete ? nowIso : undefined,
                      updatedAt: nowIso,
                    }
                  : t
              )
            );
          }
          return { ...s, completed: willComplete, updatedAt: nowIso };
        }
        return s;
      })
    );
  };

  const autoScheduleTasksForDate = (date: string) => {
    const existingSchedTaskIds = new Set(
      scheduleItems.filter(s => s.date === date && s.taskId).map(s => s.taskId)
    );
    const unscheduledTasks = tasks.filter(
      t => !t.completed && (!t.dueDate || t.dueDate <= date) && !existingSchedTaskIds.has(t.id)
    );

    if (unscheduledTasks.length === 0) {
      pushNotification('Schedule Current', 'All pending tasks for this date are already scheduled.', 'calendar');
      return;
    }

    const dateItems = scheduleItems.filter(s => s.date === date);
    const occupiedHours = new Set<string>();

    dateItems.forEach(s => {
      const [startH, startM] = (s.startTime || '09:00').split(':').map(Number);
      const [endH, endM] = (s.endTime || `${startH + 1}:00`).split(':').map(Number);
      const startMin = (isNaN(startH) ? 9 : startH) * 60 + (startM || 0);
      const endMin = (!isNaN(endH) ? endH : startH + 1) * 60 + (endM || 0);

      // Mark all hours intersected by this event as occupied
      for (let h = 0; h < 24; h++) {
        const hStart = h * 60;
        const hEnd = (h + 1) * 60;
        if (startMin < hEnd && endMin > hStart) {
          occupiedHours.add(String(h).padStart(2, '0'));
        }
      }
    });

    const candidateHours = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];
    const availableHours = candidateHours.filter(h => !occupiedHours.has(h));

    if (availableHours.length === 0) {
      pushNotification('Schedule Full', 'No open free-time slots available outside your big events on this date.', 'calendar');
      return;
    }

    const newBlocks: ScheduleItem[] = [];
    unscheduledTasks.slice(0, availableHours.length).forEach((task, idx) => {
      const startH = availableHours[idx];
      const endH = String(Number(startH) + 1).padStart(2, '0');
      const alignedNote = task.notes
        ? `${task.notes} • Aligned in free time (${startH}:00 – ${endH}:00)`
        : `Aligned in free time (${startH}:00 – ${endH}:00)`;

      newBlocks.push({
        id: `sched_auto_${Date.now()}_${idx}`,
        title: task.title,
        date: date,
        startTime: `${startH}:00`,
        endTime: `${endH}:00`,
        category: 'work',
        priority: task.priority || 'medium',
        completed: false,
        taskId: task.id,
        notes: alignedNote,
        createdAt: new Date().toISOString(),
      });
    });

    if (newBlocks.length > 0) {
      setScheduleItems(prev =>
        [...prev, ...newBlocks].sort((a, b) => a.startTime.localeCompare(b.startTime))
      );
      soundEngine.playSuccessChime();
      pushNotification(
        'Auto-Schedule Complete',
        `Successfully aligned ${newBlocks.length} task(s) into verified free time windows!`,
        'calendar'
      );
    }
  };

  // Goals Handlers
  const addGoal = (goal: Omit<Goal, 'id' | 'createdAt'>) => {
    const nowIso = new Date().toISOString();
    const newGoal: Goal = {
      ...goal,
      id: `goal_${Date.now()}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setGoals(prev => [newGoal, ...prev]);
    soundEngine.playSuccessChime();
    pushNotification('Goal Created', `Goal "${newGoal.title}" is now active.`, 'system');
    return newGoal;
  };

  const updateGoal = (goal: Goal) => {
    const completedCount = goal.milestones.filter(m => m.completed).length;
    const totalCount = goal.milestones.length;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : goal.progress;
    const updated = {
      ...goal,
      progress,
      status: progress === 100 ? ('completed' as const) : goal.status,
      updatedAt: new Date().toISOString(),
    };
    setGoals(prev => prev.map(g => (g.id === goal.id ? updated : g)));
    soundEngine.playSuccessChime();
    pushNotification('Goal Updated', `Goal "${goal.title}" updated successfully.`, 'system');
  };

  const linkTaskToGoal = (taskId: string, goalId?: string) => {
    const nowIso = new Date().toISOString();
    setTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, goalId: goalId || undefined, updatedAt: nowIso } : t))
    );
    const targetGoal = goals.find(g => g.id === goalId);
    if (targetGoal) {
      pushNotification('Task Linked', `Task linked to goal "${targetGoal.title}".`, 'task');
    }
  };

  const deleteGoal = (id: string) => {
    recordDeletedId(id);
    const nowIso = new Date().toISOString();
    setGoals(prev => prev.filter(g => g.id !== id));
    // Clear goal binding from affected tasks
    setTasks(prev =>
      prev.map(t => (t.goalId === id ? { ...t, goalId: undefined, updatedAt: nowIso } : t))
    );
    soundEngine.playClick();
    pushNotification('Goal Deleted', 'Life goal was removed.', 'system');
  };

  // Projects derived from Goals for unified task architecture
  const projects = useMemo(() => {
    return goals.map(g => ({
      id: g.id,
      name: g.title,
      color: g.color || '#3b82f6',
      goalId: g.id,
    }));
  }, [goals]);

  const addProject = useCallback((name: string, color?: string) => {
    addGoal({
      title: name,
      description: 'Project mapped to Goal',
      targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      progress: 0,
      status: 'on_track',
      milestones: [],
      color: color || '#3b82f6',
    });
  }, [goals, addGoal]);

  // Tags Handlers (Central Registry with task propagation)
  const addTag = useCallback((name: string, color?: string, description?: string) => {
    const trimmed = name.trim().toLowerCase().replace(/^#/, '');
    if (!trimmed) return;
    const nowIso = new Date().toISOString();
    setTags(prev => {
      if (prev.some(t => t.name.toLowerCase() === trimmed)) return prev;
      return [
        ...prev,
        {
          id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: trimmed,
          color: color || '#6366f1',
          description,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ];
    });
    soundEngine.playSuccessChime();
    pushNotification('Tag Created', `Tag #${trimmed} added to tag registry.`, 'task');
  }, [pushNotification]);

  const updateTag = useCallback((oldName: string, newName: string, color?: string, description?: string) => {
    const oldTrimmed = oldName.trim().toLowerCase().replace(/^#/, '');
    const newTrimmed = newName.trim().toLowerCase().replace(/^#/, '');
    if (!oldTrimmed || !newTrimmed) return;
    const nowIso = new Date().toISOString();

    setTags(prev =>
      prev.map(t =>
        t.name.toLowerCase() === oldTrimmed
          ? {
              ...t,
              name: newTrimmed,
              color: color || t.color,
              description: description !== undefined ? description : t.description,
              updatedAt: nowIso,
            }
          : t
      )
    );

    // Synchronize renamed tag across all tasks
    setTasks(prev =>
      prev.map(task => {
        if (!task.tags || !task.tags.some(t => t.toLowerCase() === oldTrimmed)) return task;
        return {
          ...task,
          updatedAt: nowIso,
          tags: task.tags.map(t => (t.toLowerCase() === oldTrimmed ? newTrimmed : t)),
        };
      })
    );

    soundEngine.playSuccessChime();
    pushNotification('Tag Updated', `Tag #${oldTrimmed} updated to #${newTrimmed} across all tasks.`, 'task');
  }, [pushNotification]);

  const deleteTag = useCallback((name: string) => {
    const trimmed = name.trim().toLowerCase().replace(/^#/, '');
    if (!trimmed) return;
    const nowIso = new Date().toISOString();

    setTags(prev => {
      prev.forEach(t => {
        if (t.name.toLowerCase() === trimmed) {
          recordDeletedId(t.id);
        }
      });
      return prev.filter(t => t.name.toLowerCase() !== trimmed);
    });

    // Remove deleted tag from all tasks
    setTasks(prev =>
      prev.map(task => {
        if (!task.tags || !task.tags.some(t => t.toLowerCase() === trimmed)) return task;
        return {
          ...task,
          updatedAt: nowIso,
          tags: task.tags.filter(t => t.toLowerCase() !== trimmed),
        };
      })
    );

    soundEngine.playClick();
    pushNotification('Tag Deleted', `Tag #${trimmed} removed from registry and tasks.`, 'task');
  }, [pushNotification]);

  const toggleGoalMilestone = (goalId: string, milestoneId: string) => {
    const nowIso = new Date().toISOString();
    setGoals(prev =>
      prev.map(g => {
        if (g.id === goalId) {
          const updatedMilestones = g.milestones.map(m =>
            m.id === milestoneId ? { ...m, completed: !m.completed } : m
          );
          const completedCount = updatedMilestones.filter(m => m.completed).length;
          const totalCount = updatedMilestones.length;
          const newProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : g.progress;
          if (newProgress === 100) {
            soundEngine.playWinStreak();
          } else {
            soundEngine.playSuccessChime();
          }
          return {
            ...g,
            milestones: updatedMilestones,
            progress: newProgress,
            updatedAt: nowIso,
            status:
              newProgress === 100
                ? 'completed'
                : g.status === 'completed'
                ? 'on_track'
                : g.status,
          };
        }
        return g;
      })
    );
  };

  // Bills & Subscriptions Handlers
  const addBill = (bill: Omit<Bill, 'id' | 'paymentHistory'>) => {
    const nowIso = new Date().toISOString();
    const newBill: Bill = {
      ...bill,
      id: `bill_${Date.now()}`,
      paymentHistory: [],
      updatedAt: nowIso,
    };
    setBills(prev => [newBill, ...prev]);
    soundEngine.playSuccessChime();
    pushNotification('Bill Reminder Added', `${newBill.title} due on ${newBill.dueDate}.`, 'bills');
  };

  const updateBill = (bill: Bill) => {
    const nowIso = new Date().toISOString();
    setBills(prev => prev.map(b => (b.id === bill.id ? { ...bill, updatedAt: nowIso } : b)));
  };

  const deleteBill = (id: string) => {
    recordDeletedId(id);
    setBills(prev => prev.filter(b => b.id !== id));
  };

  const markBillPaid = (id: string, amount?: number) => {
    const nowIso = new Date().toISOString();
    setBills(prev =>
      prev.map(b => {
        if (b.id === id) {
          const paidAmount = amount !== undefined ? amount : b.amount;
          const historyEntry = {
            id: `pay_${Date.now()}`,
            amount: paidAmount,
            paidAt: nowIso.split('T')[0],
            note: 'Paid via JivanOS Bill Tracker',
          };
          soundEngine.playBillPaid();
          pushNotification('Bill Paid', `Recorded payment of $${paidAmount.toFixed(2)} for ${b.title}.`, 'bills');
          return {
            ...b,
            isPaid: true,
            paidDate: nowIso.split('T')[0],
            updatedAt: nowIso,
            paymentHistory: [historyEntry, ...(b.paymentHistory || [])],
          };
        }
        return b;
      })
    );
  };

  const unmarkBillPaid = (id: string) => {
    const targetBill = bills.find(b => b.id === id);
    if (!targetBill || !targetBill.isPaid) return;
    const nowIso = new Date().toISOString();
    setBills(prev =>
      prev.map(b => {
        if (b.id === id) {
          return {
            ...b,
            isPaid: false,
            paidDate: undefined,
            updatedAt: nowIso,
            paymentHistory: (b.paymentHistory || []).slice(1),
          };
        }
        return b;
      })
    );
    soundEngine.playClick();
    pushNotification('Bill Marked Unpaid', `${targetBill.title} reverted to pending.`, 'bills');
  };

  // Pomodoro Handlers
  const startPomodoro = (taskId?: string, minutes: number = 25) => {
    // 1. Resuming without a taskId or for the same task that's currently loaded
    if (!taskId) {
      if (!pomodoro.isRunning && pomodoro.timeRemaining > 0) {
        setPomodoro(prev => ({ ...prev, isRunning: true }));
        soundEngine.playSuccessChime();
        return;
      }
      const duration = minutes * 60;
      setPomodoro({
        taskId: null,
        timeRemaining: duration,
        isRunning: true,
        mode: 'work',
        initialDuration: duration,
      });
      soundEngine.playSuccessChime();
      return;
    }

    // 2. Clicked the SAME task that is currently loaded
    if (pomodoro.taskId === taskId) {
      if (!pomodoro.isRunning) {
        setPomodoro(prev => ({ ...prev, isRunning: true }));
        soundEngine.playSuccessChime();
        const taskObj = tasks.find(t => t.id === taskId);
        pushNotification('Focus Resumed', `Resumed timer for "${taskObj?.title || 'task'}"`, 'task');
      }
      return;
    }

    // 3. Switching from another task: save current timer progress for that previous task!
    if (pomodoro.taskId && pomodoro.taskId !== taskId) {
      setTaskTimers(prev => ({
        ...prev,
        [pomodoro.taskId!]: {
          timeRemaining: pomodoro.timeRemaining,
          mode: pomodoro.mode,
          initialDuration: pomodoro.initialDuration,
        },
      }));
    }

    // 4. Check if the newly selected task already has a saved timer state
    const saved = taskTimers[taskId];
    const duration = saved ? saved.initialDuration : minutes * 60;
    const remaining = saved ? saved.timeRemaining : duration;
    const mode = saved ? saved.mode : 'work';

    setPomodoro({
      taskId,
      timeRemaining: remaining,
      isRunning: true,
      mode,
      initialDuration: duration,
    });

    soundEngine.playSuccessChime();
    const taskObj = tasks.find(t => t.id === taskId);
    pushNotification(
      'Focus Started',
      `Focus timer (${Math.ceil(remaining / 60)}m) started for "${taskObj?.title || 'task'}"`,
      'task'
    );
  };

  const setPomodoroTask = (taskId: string | null) => {
    if (taskId && taskId !== pomodoro.taskId) {
      startPomodoro(taskId);
    } else {
      setPomodoro(prev => ({
        ...prev,
        taskId,
      }));
    }
  };

  const pausePomodoro = () => {
    setPomodoro(prev => {
      const willRun = !prev.isRunning;
      // When pausing an active task, save its state into per-task cache
      if (!willRun && prev.taskId) {
        setTaskTimers(t => ({
          ...t,
          [prev.taskId!]: {
            timeRemaining: prev.timeRemaining,
            mode: prev.mode,
            initialDuration: prev.initialDuration,
          },
        }));
      }
      return { ...prev, isRunning: willRun };
    });
  };

  const resetPomodoro = (options?: { restart?: boolean; clearTask?: boolean }) => {
    setPomodoro(prev => {
      if (prev.taskId && options?.clearTask) {
        setTaskTimers(t => {
          const copy = { ...t };
          delete copy[prev.taskId!];
          return copy;
        });
      }
      const standardDuration = prev.mode === 'work' ? 25 * 60 : 5 * 60;
      // If clearTask is requested without explicitly specifying restart: true, timer should stop running
      const willRun = options?.restart !== undefined ? options.restart : (options?.clearTask ? false : prev.isRunning);
      return {
        ...prev,
        taskId: options?.clearTask ? null : prev.taskId,
        isRunning: willRun,
        timeRemaining: standardDuration,
        initialDuration: standardDuration,
      };
    });
    soundEngine?.playClick?.();
  };

  const clearTaskTimer = useCallback((taskId: string) => {
    setTaskTimers(t => {
      const copy = { ...t };
      delete copy[taskId];
      return copy;
    });
    setPomodoro(prev => {
      if (prev.taskId === taskId) {
        const standardDuration = prev.mode === 'work' ? 25 * 60 : 5 * 60;
        return {
          ...prev,
          taskId: null,
          isRunning: false,
          timeRemaining: standardDuration,
          initialDuration: standardDuration,
        };
      }
      return prev;
    });
  }, []);

  const stopPomodoro = useCallback((taskId?: string) => {
    setPomodoro(prev => {
      const targetId = taskId || prev.taskId;
      if (targetId) {
        setTaskTimers(t => {
          const copy = { ...t };
          delete copy[targetId];
          return copy;
        });
      }
      const standardDuration = prev.mode === 'work' ? 25 * 60 : 5 * 60;
      return {
        ...prev,
        taskId: null,
        isRunning: false,
        timeRemaining: standardDuration,
        initialDuration: standardDuration,
      };
    });
    soundEngine?.playClick?.();
  }, []);

  const switchPomodoroMode = (mode: 'work' | 'break') => {
    const duration = mode === 'work' ? 25 * 60 : 5 * 60;
    setPomodoro(prev => ({
      ...prev,
      mode,
      isRunning: false,
      timeRemaining: duration,
      initialDuration: duration,
    }));
  };

  const setPomodoroDuration = (minutes: number) => {
    const clamped = Math.max(1, Math.min(90, Math.round(minutes)));
    const duration = clamped * 60;
    setPomodoro(prev => ({
      ...prev,
      isRunning: false,
      timeRemaining: duration,
      initialDuration: duration,
    }));
  };

  const completePomodoroSession = () => {
    soundEngine.playSuccessChime();

    const activeTaskId = pomodoro.taskId;
    const activeTask = tasks.find(t => t.id === activeTaskId);

    // Record completed session in logs
    const newSession: PomodoroSession = {
      id: `pomo_${Date.now()}`,
      taskId: activeTaskId || undefined,
      taskTitle: activeTask ? activeTask.title : 'Free Focus Block',
      durationMinutes: Math.round(pomodoro.initialDuration / 60) || 25,
      mode: pomodoro.mode,
      completedAt: new Date().toISOString(),
    };
    setPomodoroLogs(prev => [newSession, ...prev]);

    if (activeTaskId) {
      setTasks(currTasks =>
        currTasks.map(t =>
          t.id === activeTaskId
            ? { ...t, completedPomodoros: (t.completedPomodoros || 0) + 1 }
            : t
        )
      );

      // Clean up saved timer so next session starts fresh
      setTaskTimers(prev => {
        const copy = { ...prev };
        delete copy[activeTaskId];
        return copy;
      });
    }

    const completedMode = pomodoro.mode;
    const nextMode = completedMode === 'work' ? 'break' : 'work';
    const nextDuration = nextMode === 'work' ? 25 * 60 : 5 * 60;

    pushNotification(
      'Focus Block Recorded!',
      pomodoro.mode === 'work'
        ? 'Great focus session logged! Take a 5-minute break.'
        : 'Break concluded. Ready for your next focus session?',
      'task'
    );

    setPomodoro(prev => ({
      ...prev,
      isRunning: false,
      mode: nextMode,
      timeRemaining: nextDuration,
      initialDuration: nextDuration,
    }));
  };

  const getTaskTimerRemaining = (taskId: string): number | null => {
    if (pomodoro.taskId === taskId) {
      return pomodoro.timeRemaining;
    }
    if (taskTimers[taskId]) {
      return taskTimers[taskId].timeRemaining;
    }
    return null;
  };

  const incrementTaskPomodoro = (taskId: string) => {
    setTasks(curr =>
      curr.map(t => (t.id === taskId ? { ...t, completedPomodoros: (t.completedPomodoros || 0) + 1 } : t))
    );
    soundEngine.playSuccessChime();
  };

  const decrementTaskPomodoro = (taskId: string) => {
    setTasks(curr =>
      curr.map(t =>
        t.id === taskId ? { ...t, completedPomodoros: Math.max(0, (t.completedPomodoros || 0) - 1) } : t
      )
    );
  };

  // Habit Handlers
  const toggleHabitDay = (habitId: string, dateStr: string, options?: { skipUndoSnackbar?: boolean; skipSound?: boolean }) => {
    let completedHabitName: string | null = null;
    let wasCompleting = false;

    const targetHabit = habits.find(h => h.id === habitId);
    if (targetHabit) {
      const isWater = Boolean(targetHabit.syncHydration) ||
        targetHabit.name.toLowerCase().includes('water') ||
        targetHabit.name.toLowerCase().includes('hydration') ||
        targetHabit.id === 'hab_1';

      if (isWater) {
        const todayKey = formatLocalDate();
        if (dateStr === todayKey) {
          const totalToday = Math.max(0, (hydration.todayLogs || []).reduce((acc, c) => acc + (c.amountMl || 0), 0));
          const targetMl = hydration.targetMl || 3000;
          const isCurrentlyDone = !!targetHabit.completionHistory?.[dateStr] || totalToday >= targetMl;
          if (!isCurrentlyDone) {
            if (totalToday < targetMl) {
              addWater(targetMl - totalToday, 'ml');
              return;
            }
          } else {
            setHydration(prev => ({
              ...prev,
              todayLogs: [],
            }));
            setHabits(habitsPrev =>
              habitsPrev.map(h => {
                const isWaterHabit =
                  h.id === habitId ||
                  Boolean(h.syncHydration) ||
                  h.id === 'hab_1' ||
                  h.name.toLowerCase().includes('water') ||
                  h.name.toLowerCase().includes('hydration');
                if (!isWaterHabit) return h;
                const nextHistory = { ...(h.completionHistory || {}), [todayKey]: false };
                const { currentStreak, bestStreak } = calculateHabitStreak(nextHistory);
                return {
                  ...h,
                  counterValue: 0,
                  completionHistory: nextHistory,
                  currentStreak,
                  bestStreak: Math.max(h.bestStreak || 0, bestStreak),
                  updatedAt: new Date().toISOString(),
                };
              })
            );
            return;
          }
        }
      }
    }

    let updatedHabitHistory: Record<string, boolean> | null = null;
    let updatedStreaks = { currentStreak: 0, bestStreak: 0 };
    const todayKeyLocal = formatLocalDate();

    setHabits(prev => {
      const found = prev.find(h => h.id === habitId);
      if (found && !found.completionHistory[dateStr]) {
        wasCompleting = true;
        completedHabitName = found.name;
      }
      return prev.map(h => {
        if (h.id === habitId) {
          const currentVal = !!h.completionHistory[dateStr];
          const willComplete = !currentVal;

          const isWater = Boolean(h.syncHydration) || h.name.toLowerCase().includes('water') || h.name.toLowerCase().includes('hydration') || h.id === 'hab_1';
          // Prevent completion if target not met for non-water counter/measurement habits
          if (!isWater && willComplete && h.targetCount && h.targetCount > (h.counterValue || 0)) {
            return h;
          }

          const newHistory = { ...h.completionHistory, [dateStr]: willComplete };
          const streaks = calculateHabitStreak(newHistory);
          updatedHabitHistory = newHistory;
          updatedStreaks = streaks;
          if (willComplete && !options?.skipSound) {
            if (isWater) {
              soundEngine.playWaterDrop();
            } else if (streaks.currentStreak > 1 && (streaks.currentStreak % 3 === 0 || streaks.currentStreak > (h.bestStreak || 0))) {
              soundEngine.playWinStreak();
            } else {
              soundEngine.playHabitComplete();
            }
          }
          return {
            ...h,
            completionHistory: newHistory,
            currentStreak: streaks.currentStreak,
            bestStreak: Math.max(h.bestStreak || 0, streaks.bestStreak),
            updatedAt: new Date().toISOString(),
          };
        }
        return h;
      });
    });

    // Mirror date-wise completion & streaks onto any linked routine items
    if (targetHabit) {
      const targetName = targetHabit.name.toLowerCase().trim();
      setRoutines(prev =>
        prev.map(r => {
          const hasMatch = r.items.some(
            i => i.id === habitId || i.title.toLowerCase().trim() === targetName
          );
          if (!hasMatch) return r;
          return {
            ...r,
            updatedAt: new Date().toISOString(),
            items: r.items.map(i => {
              if (i.id !== habitId && i.title.toLowerCase().trim() !== targetName) return i;
              const fallbackHistory = { ...(i.completionHistory || {}) };
              const nextHistory = updatedHabitHistory || {
                ...fallbackHistory,
                [dateStr]: !fallbackHistory[dateStr],
              };
              const computed = updatedHabitHistory ? updatedStreaks : calculateHabitStreak(nextHistory);
              return {
                ...i,
                completionHistory: nextHistory,
                completed: dateStr === todayKeyLocal ? Boolean(nextHistory[dateStr]) : i.completed,
                currentStreak: computed.currentStreak,
                bestStreak: Math.max(i.bestStreak || 0, computed.bestStreak),
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        })
      );
    }
  };

  const addHabit = (habitData: Omit<Habit, 'id' | 'currentStreak' | 'bestStreak' | 'completionHistory' | 'createdAt'>) => {
    const isWater = Boolean(habitData.syncHydration) ||
      habitData.name.toLowerCase().includes('water') ||
      habitData.name.toLowerCase().includes('hydration');

    const nowIso = new Date().toISOString();
    const newHabit: Habit = {
      ...habitData,
      id: `hab_${Date.now()}`,
      syncHydration: isWater ? true : habitData.syncHydration,
      currentStreak: 0,
      bestStreak: 0,
      completionHistory: {},
      createdAt: nowIso.split('T')[0],
      updatedAt: nowIso,
      cardTheme: 'clean',
    };
    setHabits(prev => [...prev, newHabit]);
    soundEngine.playSuccessChime();
    pushNotification('Habit Added', `"${newHabit.name}" added to HabitTick streaks.`, 'habit');

    // Automatically sync into corresponding routine if tagged
    if (newHabit.tags && newHabit.tags.length > 0) {
      setRoutines(prev =>
        prev.map(r => {
          if (newHabit.tags!.some(t => t.toLowerCase() === r.name.toLowerCase())) {
            const alreadyExists = r.items.some(
              i => i.id === newHabit.id || i.title.toLowerCase().trim() === newHabit.name.toLowerCase().trim()
            );
            if (!alreadyExists) {
              const rItem: RoutineItem = {
                id: newHabit.id,
                title: newHabit.name,
                icon: newHabit.icon,
                scheduledTime: newHabit.reminderTime,
                durationMinutes: newHabit.durationMinutes || newHabit.timerMinutes,
                completed: false,
                fontColor: newHabit.fontColor,
                accentColor: newHabit.accentColor,
                color: newHabit.color || newHabit.accentColor,
                isBold: newHabit.isBold,
                cardTheme: 'clean' as const,
                tags: newHabit.tags,
                reminderTime: newHabit.reminderTime,
                timerMinutes: newHabit.timerMinutes,
                updatedAt: nowIso,
              };
              return { ...r, updatedAt: nowIso, items: [...r.items, rItem] };
            }
          }
          return r;
        })
      );
    }
    return newHabit;
  };

  const updateHabit = (habit: Habit) => {
    const isWater = Boolean(habit.syncHydration) ||
      habit.name.toLowerCase().includes('water') ||
      habit.name.toLowerCase().includes('hydration') ||
      habit.id === 'hab_1';

    if (isWater) {
      const hUnit = (habit.unit || 'ml').toLowerCase();
      const isLitre = ['l', 'litre', 'litres'].includes(hUnit);
      const isGlasses = ['glasses', 'glass', 'gl'].includes(hUnit);

      const targetInMl = isLitre
        ? Math.round((habit.targetCount || 3) * 1000)
        : isGlasses
          ? Math.round((habit.targetCount || 12) * 250)
          : Math.round(habit.targetCount || 3000);

      const prefUnit = isLitre ? 'litres' : isGlasses ? 'glasses' : 'ml';

      setHydration(prev => ({
        ...prev,
        targetMl: targetInMl,
        preferredUnit: prefUnit,
      }));
    }

    const nowIso = new Date().toISOString();
    const cleanedHabit: Habit = {
      ...habit,
      cardTheme: 'clean',
      syncHydration: isWater ? true : habit.syncHydration,
      updatedAt: nowIso,
    };

    // 1. Update in habits list (or append if originating from routine items)
    setHabits(prev => {
      const exists = prev.some(h => h.id === habit.id);
      if (exists) {
        return prev.map(h => (h.id === habit.id ? cleanedHabit : h));
      }
      return [...prev, cleanedHabit];
    });

    // 2. Keep routines state and routine items in sync (including tags linking & archive status)
    setRoutines(prev =>
      prev.map(r => {
        const hasItem = r.items.some(
          i => i.id === habit.id || i.title.toLowerCase().trim() === habit.name.toLowerCase().trim()
        );
        const isTaggedToRoutine = Boolean(
          habit.tags?.some(t => t.toLowerCase().trim() === r.name.toLowerCase().trim())
        );

        if (hasItem) {
          const updatedItems = r.items.map(i => {
            if (i.id === habit.id || i.title.toLowerCase().trim() === habit.name.toLowerCase().trim()) {
              return {
                ...i,
                title: habit.name,
                icon: habit.icon || i.icon,
                scheduledTime: habit.reminderTime || i.scheduledTime,
                durationMinutes: habit.durationMinutes || habit.timerMinutes || i.durationMinutes,
                fontColor: habit.fontColor,
                accentColor: habit.accentColor,
                color: habit.color || habit.accentColor,
                isBold: habit.isBold,
                cardTheme: 'clean' as const,
                tags: habit.tags,
                reminderTime: habit.reminderTime,
                reminderType: habit.reminderType,
                timerMinutes: habit.timerMinutes,
                notes: habit.notes,
                subSteps: habit.subSteps,
                frequency: habit.frequency,
                customDays: habit.customDays,
                completionHistory: habit.completionHistory || i.completionHistory,
                currentStreak: habit.currentStreak,
                bestStreak: habit.bestStreak,
                archived: habit.archived,
                archivedAt: habit.archivedAt,
                updatedAt: nowIso,
              };
            }
            return i;
          });
          return { ...r, updatedAt: nowIso, items: updatedItems };
        }

        if (isTaggedToRoutine) {
          const linkedItem: RoutineItem = {
            id: habit.id,
            title: habit.name,
            icon: habit.icon,
            scheduledTime: habit.reminderTime,
            durationMinutes: habit.durationMinutes || habit.timerMinutes,
            completed: Boolean(habit.completionHistory?.[formatLocalDate()]),
            completionHistory: habit.completionHistory || {},
            currentStreak: habit.currentStreak,
            bestStreak: habit.bestStreak,
            fontColor: habit.fontColor,
            accentColor: habit.accentColor,
            color: habit.color || habit.accentColor,
            isBold: habit.isBold,
            cardTheme: 'clean' as const,
            tags: habit.tags,
            reminderTime: habit.reminderTime,
            reminderType: habit.reminderType,
            timerMinutes: habit.timerMinutes,
            notes: habit.notes,
            subSteps: habit.subSteps,
            frequency: habit.frequency,
            customDays: habit.customDays,
            archived: habit.archived,
            archivedAt: habit.archivedAt,
            updatedAt: nowIso,
          };
          return { ...r, updatedAt: nowIso, items: [...r.items, linkedItem] };
        }

        return r;
      })
    );
  };

  const updateHabitCounter = (habitId: string, delta: number) => {
    const targetHabit = habits.find(h => h.id === habitId);
    if (!targetHabit) return;

    const stepValue = Math.abs(delta) > 0 ? Math.abs(delta) : (targetHabit.incrementStep && targetHabit.incrementStep > 0 ? targetHabit.incrementStep : 1);
    const isLiquid = Boolean(targetHabit.syncHydration) ||
      targetHabit.name.toLowerCase().includes('water') ||
      targetHabit.name.toLowerCase().includes('hydration') ||
      targetHabit.id === 'hab_1';

    if (isLiquid) {
      const unitLower = (targetHabit.unit || 'ml').toLowerCase();
      const stepInMl = (unitLower === 'l' || unitLower === 'litre' || unitLower === 'litres')
        ? Math.round(stepValue * 1000)
        : (unitLower === 'glasses' || unitLower === 'glass' || unitLower === 'gl')
          ? Math.round(stepValue * 250)
          : Math.round(stepValue);
      addWater(delta > 0 ? stepInMl : -stepInMl, 'ml');
      return;
    }

    setHabits(prev =>
      prev.map(h => {
        if (h.id === habitId) {
          const change = delta > 0 ? stepValue : -stepValue;
          const newVal = Math.max(0, Math.round(((h.counterValue || 0) + change) * 100) / 100);
          soundEngine.playSuccessChime();

          // Mark as complete for today if target reached (or for quit habits, staying within limit)
          const isDone = h.habitType === 'quit'
            ? (h.targetCount !== undefined ? newVal <= h.targetCount : true)
            : (h.targetCount && h.targetCount > 0 ? newVal >= h.targetCount : false);
          const todayKey = formatLocalDate();
          const updatedHistory = { ...h.completionHistory, [todayKey]: isDone };
          const { currentStreak, bestStreak } = calculateHabitStreak(updatedHistory);

          return {
            ...h,
            counterValue: newVal,
            completionHistory: updatedHistory,
            currentStreak,
            bestStreak: Math.max(h.bestStreak || 0, bestStreak),
            updatedAt: new Date().toISOString(),
          };
        }
        return h;
      })
    );
  };

  const deleteHabit = (id: string) => {
    recordDeletedId(id);
    setHabits(prev => prev.filter(h => h.id !== id));
    setRoutines(prev =>
      prev.map(r => ({
        ...r,
        updatedAt: new Date().toISOString(),
        items: r.items.filter(i => i.id !== id && i.title.toLowerCase().trim() !== (habits.find(h => h.id === id)?.name.toLowerCase().trim() || ''))
      }))
    );
  };

  const updateHabitSubSteps = (habitId: string, subSteps: HabitStep[], dateStr: string) => {
    setHabits(prev =>
      prev.map(h => {
        if (h.id === habitId) {
          let shouldComplete = false;
          if (h.doneWhen === 'any') {
            shouldComplete = subSteps.some(s => Boolean(s.completed));
          } else {
            shouldComplete = subSteps.length > 0 && subSteps.every(s => Boolean(s.completed));
          }
          const newHistory = { ...(h.completionHistory || {}), [dateStr]: shouldComplete };
          const { currentStreak, bestStreak } = calculateHabitStreak(newHistory);

          return {
            ...h,
            subSteps,
            completionHistory: newHistory,
            currentStreak,
            bestStreak: Math.max(h.bestStreak || 0, bestStreak),
            updatedAt: new Date().toISOString(),
          };
        }
        return h;
      })
    );
  };

  // Routine Handlers (Date-aware, streak-aware, synced with Habits)
  const toggleRoutineItem = (
    routineId: string,
    itemId: string,
    dateStr?: string,
    options?: { skipSound?: boolean }
  ) => {
    const targetDate = dateStr || formatLocalDate();
    const todayKeyLocal = formatLocalDate();
    let toggledTitle = '';
    let nextCompletedState = false;
    let nextHistorySnapshot: Record<string, boolean> | null = null;
    let computedStreaks = { currentStreak: 0, bestStreak: 0 };

    setRoutines(prev =>
      prev.map(r => {
        if (r.id === routineId) {
          const updatedItems = r.items.map(item => {
            if (item.id === itemId) {
              toggledTitle = item.title;
              const baseHistory: Record<string, boolean> = { ...(item.completionHistory || {}) };
              if (baseHistory[todayKeyLocal] === undefined && item.completed) {
                baseHistory[todayKeyLocal] = true;
              }
              const currentStatus = Boolean(baseHistory[targetDate]);
              nextCompletedState = !currentStatus;
              const newHistory = { ...baseHistory, [targetDate]: nextCompletedState };
              const streaks = calculateHabitStreak(newHistory);
              nextHistorySnapshot = newHistory;
              computedStreaks = streaks;
              if (nextCompletedState && !options?.skipSound) {
                soundEngine.playWaterDropNotification();
              }
              return {
                ...item,
                completionHistory: newHistory,
                completed: targetDate === todayKeyLocal ? nextCompletedState : item.completed,
                currentStreak: streaks.currentStreak,
                bestStreak: Math.max(item.bestStreak || 0, streaks.bestStreak),
              };
            }
            return item;
          });
          return { ...r, items: updatedItems };
        }
        return r;
      })
    );

    // Keep linked habit synchronized without double-toggling
    const linkedHabit = habits.find(
      h =>
        h.id === itemId ||
        (toggledTitle && h.name.toLowerCase().trim() === toggledTitle.toLowerCase().trim())
    );
    if (linkedHabit && nextHistorySnapshot) {
      setHabits(prev =>
        prev.map(h => {
          if (h.id !== linkedHabit.id) return h;
          const mergedHistory = {
            ...(h.completionHistory || {}),
            [targetDate]: nextCompletedState,
          };
          const streaks = calculateHabitStreak(mergedHistory);
          return {
            ...h,
            completionHistory: mergedHistory,
            currentStreak: streaks.currentStreak,
            bestStreak: Math.max(h.bestStreak || 0, streaks.bestStreak, computedStreaks.bestStreak),
          };
        })
      );
    }
  };

  const addRoutineItem = (routineId: string, itemData: Omit<RoutineItem, 'id'>) => {
    setRoutines(prev =>
      prev.map(r => {
        if (r.id === routineId) {
          const newItem: RoutineItem = {
            ...itemData,
            id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            completed: false,
            completionHistory: itemData.completionHistory || {},
            currentStreak: 0,
            bestStreak: 0,
          };
          soundEngine.playSuccessChime();
          return { ...r, items: [...r.items, newItem] };
        }
        return r;
      })
    );
  };

  const updateRoutineItem = (routineId: string, item: RoutineItem) => {
    const cleanItem: RoutineItem = { ...item, cardTheme: 'clean' };
    setRoutines(prev =>
      prev.map(r => {
        if (r.id === routineId) {
          const updatedItems = r.items.map(i => (i.id === item.id ? cleanItem : i));
          return { ...r, items: updatedItems };
        }
        return r;
      })
    );
    setHabits(prev =>
      prev.map(h => {
        if (h.id === item.id || h.name.toLowerCase().trim() === item.title.toLowerCase().trim()) {
          return {
            ...h,
            name: item.title,
            icon: item.icon || h.icon,
            fontColor: item.fontColor !== undefined ? item.fontColor : h.fontColor,
            accentColor: item.accentColor || h.accentColor,
            color: item.color || h.color,
            isBold: item.isBold !== undefined ? item.isBold : h.isBold,
            cardTheme: 'clean' as const,
            reminderTime: item.scheduledTime || h.reminderTime,
            durationMinutes: item.durationMinutes || h.durationMinutes,
            timerMinutes: item.durationMinutes || h.timerMinutes,
            notes: item.notes !== undefined ? item.notes : h.notes,
            subSteps: item.subSteps !== undefined ? item.subSteps : h.subSteps,
            archived: item.archived !== undefined ? item.archived : h.archived,
            archivedAt: item.archivedAt !== undefined ? item.archivedAt : h.archivedAt,
          };
        }
        return h;
      })
    );
  };

  const deleteRoutineItem = (routineId: string, itemId: string) => {
    setRoutines(prev =>
      prev.map(r => {
        if (r.id === routineId) {
          return { ...r, items: r.items.filter(i => i.id !== itemId) };
        }
        return r;
      })
    );
  };

  const addRoutine = (routineData: Omit<Routine, 'id' | 'items'>): Routine => {
    const newRoutine: Routine = {
      ...routineData,
      id: `routine_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      items: [],
    };
    setRoutines(prev => [...prev, newRoutine]);
    soundEngine.playSuccessChime();
    pushNotification('Routine Created', `"${newRoutine.name}" added to Routines.`, 'habit');
    return newRoutine;
  };

  const updateRoutine = (routine: Routine) => {
    setRoutines(prev => prev.map(r => (r.id === routine.id ? routine : r)));
  };

  const deleteRoutine = (routineId: string) => {
    setRoutines(prev => prev.filter(r => r.id !== routineId));
  };

  const reorderRoutineItems = (routineId: string, draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setRoutines(prev =>
      prev.map(r => {
        if (r.id !== routineId) return r;
        const idx1 = r.items.findIndex(i => i.id === draggedId);
        const idx2 = r.items.findIndex(i => i.id === targetId);
        if (idx1 === -1 || idx2 === -1) return r;
        const updated = [...r.items];
        const [moved] = updated.splice(idx1, 1);
        updated.splice(idx2, 0, moved);
        return { ...r, items: updated };
      })
    );
  };

  const updateRoutineItemSubSteps = (
    routineId: string,
    itemId: string,
    subSteps: HabitStep[],
    dateStr: string
  ) => {
    const shouldComplete = subSteps.length > 0 && subSteps.every(s => s.completed);
    const todayKeyLocal = formatLocalDate();
    let itemTitle = '';

    setRoutines(prev =>
      prev.map(r => {
        if (r.id !== routineId) return r;
        return {
          ...r,
          items: r.items.map(item => {
            if (item.id !== itemId) return item;
            itemTitle = item.title;
            const newHistory = { ...(item.completionHistory || {}), [dateStr]: shouldComplete };
            const streaks = calculateHabitStreak(newHistory);
            return {
              ...item,
              subSteps,
              completionHistory: newHistory,
              completed: dateStr === todayKeyLocal ? shouldComplete : item.completed,
              currentStreak: streaks.currentStreak,
              bestStreak: Math.max(item.bestStreak || 0, streaks.bestStreak),
            };
          }),
        };
      })
    );

    const linkedHabit = habits.find(
      h =>
        h.id === itemId ||
        (itemTitle && h.name.toLowerCase().trim() === itemTitle.toLowerCase().trim())
    );
    if (linkedHabit) {
      updateHabitSubSteps(linkedHabit.id, subSteps, dateStr);
    }
  };

  // Run one-time quote metadata timestamp migration on first mount
  useEffect(() => {
    ensureQuoteMetaMigrated();
  }, []);

  // Quotes Repository State & Handlers
  const [quotes, setQuotes] = useState<QuoteItem[]>(() => {
    ensureQuoteMetaMigrated();
    return buildQuotesFromStorage();
  });

  const [deletedQuoteIds, setDeletedQuoteIds] = useState<string[]>(() =>
    readDeletedQuoteIdsFromStorage()
  );

  // Editable Quote Categories (including deleted tombstones for future/current sync)
  const [quoteCategoriesRaw, setQuoteCategoriesRaw] = useState<QuoteCategory[]>(() =>
    loadStoredQuoteCategories()
  );

  useEffect(() => {
    saveStoredQuoteCategories(quoteCategoriesRaw);
  }, [quoteCategoriesRaw]);

  const quoteCategories = useMemo(
    () =>
      quoteCategoriesRaw
        .filter(c => !c.deletedAt)
        .sort((a, b) => a.order - b.order),
    [quoteCategoriesRaw]
  );

  const quoteCategoryById = useMemo(() => {
    const map = new Map<string, QuoteCategory>();
    for (const c of quoteCategories) {
      map.set(c.id, c);
    }
    return map;
  }, [quoteCategories]);

  const wisdomCategory = useMemo(
    () =>
      quoteCategoryById.get('wisdom') ||
      quoteCategories[0] ||
      DEFAULT_QUOTE_CATEGORIES[0],
    [quoteCategoryById, quoteCategories]
  );

  const getCategoryForQuote = useCallback(
    (quote: Pick<QuoteItem, 'category'>): QuoteCategory => {
      if (quote && quote.category) {
        const found = quoteCategoryById.get(quote.category);
        if (found) return found;
      }
      return wisdomCategory;
    },
    [quoteCategoryById, wisdomCategory]
  );

  const validateCategoryName = (rawName: string, excludeId?: string): string => {
    const trimmed = (rawName || '').trim();
    if (!trimmed) {
      throw new Error('Category name cannot be empty.');
    }
    if (trimmed.length > 24) {
      throw new Error('Category name must be 24 characters or fewer.');
    }
    const lower = trimmed.toLowerCase();
    const conflict = quoteCategoriesRaw.find(
      c => !c.deletedAt && c.id !== excludeId && c.name.trim().toLowerCase() === lower
    );
    if (conflict) {
      throw new Error(`A category named "${conflict.name}" already exists.`);
    }
    return trimmed;
  };

  const addQuoteCategory = (name: string, color?: string): QuoteCategory => {
    const validName = validateCategoryName(name);
    const usedColors = new Set(
      quoteCategoriesRaw.filter(c => !c.deletedAt).map(c => c.color.toLowerCase())
    );
    const chosenColor =
      color && color.trim()
        ? color.trim().toLowerCase()
        : EXTRA_PALETTE_KEYS.find(k => !usedColors.has(k)) || 'slate';

    const maxOrder = quoteCategoriesRaw.reduce(
      (max, c) => (c.order > max ? c.order : max),
      -1
    );
    const now = new Date().toISOString();
    const rand4 = Math.random().toString(36).substring(2, 6).padEnd(4, '0');
    const newCat: QuoteCategory = {
      id: `cat_${Date.now()}_${rand4}`,
      name: validName,
      color: chosenColor,
      order: maxOrder + 1,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };

    setQuoteCategoriesRaw(prev => {
      const next = [...prev, newCat];
      saveStoredQuoteCategories(next);
      return next;
    });

    return newCat;
  };

  const updateQuoteCategory = (
    id: string,
    patch: { name?: string; color?: string }
  ) => {
    const validName =
      patch.name !== undefined ? validateCategoryName(patch.name, id) : undefined;
    const now = new Date().toISOString();
    setQuoteCategoriesRaw(prev => {
      const next = prev.map(cat => {
        if (cat.id !== id) return cat;
        return {
          ...cat,
          ...(validName !== undefined ? { name: validName } : {}),
          ...(patch.color !== undefined ? { color: patch.color } : {}),
          updatedAt: now,
        };
      });
      saveStoredQuoteCategories(next);
      return next;
    });
  };

  const deleteQuoteCategory = (id: string) => {
    if (id === 'wisdom') {
      throw new Error('The Wisdom category cannot be deleted.');
    }
    const now = new Date().toISOString();
    setQuoteCategoriesRaw(prev => {
      const next = prev.map(cat =>
        cat.id === id ? { ...cat, deletedAt: now, updatedAt: now } : cat
      );
      saveStoredQuoteCategories(next);
      return next;
    });
  };

  const resetQuoteCategoriesToDefault = () => {
    const now = new Date().toISOString();
    const defaultMap = new Map(DEFAULT_QUOTE_CATEGORIES.map(c => [c.id, c]));
    setQuoteCategoriesRaw(prev => {
      const customCats = prev.filter(c => !defaultMap.has(c.id));
      const restoredDefaults = DEFAULT_QUOTE_CATEGORIES.map(def => {
        const existing = prev.find(c => c.id === def.id);
        return {
          ...def,
          createdAt: existing?.createdAt || def.createdAt,
          updatedAt: now,
        };
      });
      const next = [...restoredDefaults, ...customCats];
      saveStoredQuoteCategories(next);
      return next;
    });
  };

  // Favorite / Liked Quotes State
  const [favoriteQuoteIds, setFavoriteQuoteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(QUOTE_FAVORITES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const favoriteQuoteIdSet = useMemo(() => new Set(favoriteQuoteIds), [favoriteQuoteIds]);

  const toggleFavoriteQuote = useCallback((id: string) => {
    const now = new Date().toISOString();
    setFavoriteQuoteIds(prev => {
      const isFav = prev.includes(id);
      const nextOn = !isFav;
      const updated = isFav ? prev.filter(item => item !== id) : [id, ...prev];
      try {
        localStorage.setItem(QUOTE_FAVORITES_KEY, JSON.stringify(updated));
        localStorage.setItem(`${LOCAL_STORAGE_KEY}_favorite_quotes`, JSON.stringify(updated));
        const meta = loadQuoteMeta();
        meta.favorites[id] = { on: nextOn, at: now };
        saveQuoteMeta(meta);
      } catch (e) {
        console.error(e);
      }
      soundEngine.playSuccessChime();
      return updated;
    });
  }, []);

  const isQuoteFavorited = useCallback(
    (id: string) => favoriteQuoteIdSet.has(id),
    [favoriteQuoteIdSet]
  );

  // Sync user custom quotes to storage
  useEffect(() => {
    try {
      const customOnes = quotes.filter(q => isCustomQuote(q));
      localStorage.setItem('omnilife_user_custom_quotes_v5', JSON.stringify(customOnes));
    } catch (e) {
      console.error(e);
    }
  }, [quotes]);

  const addQuote = (quoteData: Omit<QuoteItem, 'id'>) => {
    const now = new Date().toISOString();
    const id = `q_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newQuote: QuoteItem = {
      ...quoteData,
      id,
      isCustom: true,
      createdAt: now,
      updatedAt: now,
    };
    try {
      const meta = loadQuoteMeta();
      meta.updated[id] = now;
      delete meta.deleted[id];
      saveQuoteMeta(meta);
    } catch (e) {
      console.error(e);
    }
    setQuotes(prev => [newQuote, ...prev]);
    soundEngine.playSuccessChime();
    pushNotification('Quote Added', `Added quote by "${newQuote.author}" to your personal library.`, 'system');
  };

  const addQuotes = (items: Omit<QuoteItem, 'id'>[]): QuoteItem[] => {
    if (!Array.isArray(items) || items.length === 0) return [];
    const baseTs = Date.now();
    const now = new Date().toISOString();
    const created: QuoteItem[] = items.map((item, idx) => {
      const rand4 = Math.random().toString(36).substring(2, 6).padEnd(4, '0');
      return {
        ...item,
        id: `q_custom_${baseTs}_${idx}_${rand4}`,
        isCustom: true,
        createdAt: now,
        updatedAt: now,
      };
    });

    try {
      const meta = loadQuoteMeta();
      for (const q of created) {
        meta.updated[q.id] = now;
        delete meta.deleted[q.id];
      }
      saveQuoteMeta(meta);
    } catch (e) {
      console.error(e);
    }

    setQuotes(prev => [...created, ...prev]);
    soundEngine.playSuccessChime();
    pushNotification(
      'Quotes Imported',
      `${created.length} ${created.length === 1 ? 'quote' : 'quotes'} imported`,
      'system'
    );
    return created;
  };

  const updateQuote = (quote: QuoteItem) => {
    const now = new Date().toISOString();
    const stamped: QuoteItem = { ...quote, updatedAt: now };
    setQuotes(prev => prev.map(q => (q.id === stamped.id ? stamped : q)));
    try {
      const meta = loadQuoteMeta();
      meta.updated[stamped.id] = now;
      saveQuoteMeta(meta);

      if (!isCustomQuote(stamped)) {
        const savedEdited = localStorage.getItem(QUOTE_EDITED_KEY);
        const arr: QuoteItem[] = savedEdited ? JSON.parse(savedEdited) : [];
        const validArr = Array.isArray(arr) ? arr.filter(item => item.id !== stamped.id) : [];
        validArr.push(stamped);
        localStorage.setItem(QUOTE_EDITED_KEY, JSON.stringify(validArr));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteQuote = (id: string) => {
    const now = new Date().toISOString();
    setQuotes(prev => prev.filter(q => q.id !== id));
    setDeletedQuoteIds(prev => (prev.includes(id) ? prev : [...prev, id]));
    setFavoriteQuoteIds(prev => {
      if (!prev.includes(id)) return prev;
      const updated = prev.filter(item => item !== id);
      try {
        localStorage.setItem(QUOTE_FAVORITES_KEY, JSON.stringify(updated));
        localStorage.setItem(`${LOCAL_STORAGE_KEY}_favorite_quotes`, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
    try {
      const meta = loadQuoteMeta();
      meta.deleted[id] = now;
      meta.favorites[id] = { on: false, at: now };
      saveQuoteMeta(meta);

      const savedDeleted = localStorage.getItem(QUOTE_DELETED_KEY);
      const arr = savedDeleted ? JSON.parse(savedDeleted) : [];
      if (Array.isArray(arr) && !arr.includes(id)) {
        arr.push(id);
        localStorage.setItem(QUOTE_DELETED_KEY, JSON.stringify(arr));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const resetQuotesToDefault = () => {
    try {
      localStorage.removeItem(QUOTE_DELETED_KEY);
      localStorage.removeItem(QUOTE_EDITED_KEY);
    } catch {
      // ignore
    }
    setDeletedQuoteIds([]);
    setQuotes(CURATED_QUOTES.filter(q => !isProhibitedQuote(q)));
  };

  // Task Workflow Stages (Customizable Kanban columns)
  const defaultWorkflowStages: WorkflowStage[] = [
    { id: 'todo', label: 'To Do', color: '#64748b' },
    { id: 'in_progress', label: 'In Progress', color: '#6366f1' },
    { id: 'review', label: 'In Review', color: '#f59e0b' },
    { id: 'done', label: 'Done', color: '#10b981' },
  ];

  const [workflowStages, setWorkflowStages] = useState<WorkflowStage[]>(() => {
    try {
      const saved = localStorage.getItem('omnilife_task_workflow_stages');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return defaultWorkflowStages;
  });

  useEffect(() => {
    try {
      localStorage.setItem('omnilife_task_workflow_stages', JSON.stringify(workflowStages));
    } catch (e) {
      console.error(e);
    }
  }, [workflowStages]);

  const addWorkflowStage = (stageData: Omit<WorkflowStage, 'id'> & { id?: string }) => {
    const newStage: WorkflowStage = {
      id: stageData.id || `stage_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: stageData.label,
      color: stageData.color || '#6366f1',
    };
    setWorkflowStages(prev => [...prev, newStage]);
    soundEngine.playSuccessChime();
  };

  const updateWorkflowStage = (stage: WorkflowStage) => {
    setWorkflowStages(prev => prev.map(s => (s.id === stage.id ? stage : s)));
  };

  const deleteWorkflowStage = (id: string) => {
    setWorkflowStages(prev => prev.filter(s => s.id !== id));
  };

  // App-Wide Lock & Security Handlers
  const updateAppLock = (cfg: Partial<AppLockConfig>) => {
    setAppLock(prev => ({ ...prev, ...cfg }));
    pushNotification('Security Config Updated', 'App encryption & lock preferences saved.', 'system');
  };

  const lockAppNow = () => {
    setAppLock(prev => ({ ...prev, isLocked: true }));
    soundEngine.playLockSound();
    pushNotification('App Locked', 'Passcode or biometric scan required to access Jivan.', 'system');
  };

  const unlockApp = (passcode?: string, isBiometric?: boolean): boolean => {
    if (!appLock.isEnabled) {
      setAppLock(prev => ({ ...prev, isLocked: false }));
      return true;
    }
    if (isBiometric && (appLock.lockType === 'biometric' || appLock.lockType === 'both')) {
      setAppLock(prev => ({ ...prev, isLocked: false }));
      soundEngine.playSuccessChime();
      return true;
    }
    if (passcode && passcode === appLock.passcode) {
      setAppLock(prev => ({ ...prev, isLocked: false }));
      soundEngine.playSuccessChime();
      return true;
    }
    return false;
  };

  // AI Assistant Chat & Action Execution
  const applyActionableItem = (action: ActionableItem) => {
    switch (action.type) {
      case 'task': {
        addTask({
          title: action.title,
          priority: action.priority || 'medium',
          dueDate: action.dueDate || new Date().toISOString().split('T')[0],
          project: action.project || 'Work & Engineering',
          notes: action.notes,
          subtasks: (action.subtasks || []).map(st => ({
            id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            title: st,
            completed: false,
          })),
          quadrant: action.quadrant || 'urgent_important',
          status: 'todo',
          completed: false,
          estimatedPomodoros: 2,
          recurring: 'none',
        });
        break;
      }
      case 'habit': {
        addHabit({
          name: action.name,
          category: action.category || 'health',
          frequency: action.frequency || 'daily',
          targetDaysPerWeek: action.targetDaysPerWeek || 7,
          timerMinutes: action.timerMinutes,
          color: action.color || '#10b981',
          notes: action.notes,
        });
        break;
      }
      case 'bill': {
        addBill({
          title: action.title,
          category: action.category || 'other',
          amount: action.amount || 50,
          currency: action.currency || '$',
          dueDate: action.dueDate || new Date().toISOString().split('T')[0],
          recurring: action.recurring || 'monthly',
          autoPay: action.autoPay || false,
          isPaid: false,
          reminderDaysBefore: 3,
          color: '#2563eb',
          notes: action.notes,
        });
        break;
      }
      case 'goal': {
        addGoal({
          title: action.title,
          tags: action.tags,
          tag: action.tags?.[0],
          targetDate: action.targetDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          progress: 0,
          status: 'on_track',
          color: '#6366f1',
          milestones: (action.milestones || []).map(m => ({
            id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            title: m,
            completed: false,
          })),
        });
        break;
      }
      case 'medication': {
        const schedTimes: string[] =
          action.scheduleTimes && action.scheduleTimes.length > 0 ? action.scheduleTimes : ['08:00'];
        addMedication({
          name: action.name,
          dosage: action.dosage || '1 tablet',
          instructions: action.notes || 'Take as prescribed',
          frequency: (action.frequency as any) || 'daily',
          schedules: schedTimes.map((t, idx) => ({
            time: t,
            label: idx === 0 ? 'Morning Dose' : 'Evening Dose',
          })),
          color: '#10b981',
          iconType: 'pill',
          totalPills: action.totalPills || 30,
          remainingPills: action.remainingPills !== undefined ? action.remainingPills : 30,
          refillThreshold: action.refillThreshold || 5,
          startDate: new Date().toISOString().split('T')[0],
          active: true,
        });
        break;
      }
      case 'event': {
        addScheduleItem({
          title: action.title,
          date: action.date || new Date().toISOString().split('T')[0],
          startTime: action.startTime || '09:00',
          endTime: action.endTime || '10:00',
          category: (action.category as any) || 'work',
          priority: 'medium',
          completed: false,
          notes: action.notes,
        });
        break;
      }
    }
  };

  const applyMultipleActionableItems = (actions: ActionableItem[]) => {
    if (!actions || actions.length === 0) return;
    actions.forEach(action => {
      applyActionableItem(action);
    });
    soundEngine.playSuccessChime();
    pushNotification('Items Saved', `Added ${actions.length} items to your Jivan workspace.`, 'system');
  };

  const clearAIChat = () => {
    setAiMessages([]);
  };

  const verifyAIApiKey = async (
    provider: string,
    customApiKey: string,
    selectedModel: string,
    baseUrl?: string
  ): Promise<{ success: boolean; message: string; latencyMs?: number; error?: string }> => {
    try {
      const res = await fetch('/api/ai/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiProvider: provider,
          customApiKey,
          selectedModel,
          baseUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.error || 'Connection verification failed',
          error: data.error,
        };
      }
      return {
        success: true,
        message: data.message || 'Connection verified successfully!',
        latencyMs: data.latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Network error verifying API connection',
        error: err.message,
      };
    }
  };

  const sendAIMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: AIMessage = {
      id: `usr_msg_${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setAiMessages(prev => [...prev, userMsg]);
    setIsAILoading(true);

    try {
      const aiProvider = localStorage.getItem('omni_ai_provider') || 'gemini';
      const storedModel = localStorage.getItem('omni_ai_model');
      const selectedModel =
        !storedModel || storedModel === 'gemini-3.8-flash' ? 'gemini-4-hydrogen' : storedModel;
      const baseUrl = localStorage.getItem('omni_ai_base_url') || '';
      const customApiKey = localStorage.getItem(`omni_custom_${aiProvider}_api_key`) || '';

      const todayDate = new Date().toISOString().split('T')[0];
      const liveUserContext = {
        name: profile.name || 'User',
        currentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        todayDate,
        tasksCount: tasks.filter(t => !t.archived && t.status !== 'archived').length,
        pendingTasksCount: tasks.filter(t => !t.completed && !t.archived && t.status !== 'archived').length,
        pendingTasks: tasks.filter(t => !t.completed && !t.archived && t.status !== 'archived').slice(0, 15).map(t => ({
          id: t.id,
          title: t.title,
          quadrant: t.quadrant,
          priority: t.priority,
          dueDate: t.dueDate,
          project: t.project,
        })),
        activeHabits: habits.filter(h => !h.archived).slice(0, 10).map(h => ({
          name: h.name,
          category: h.category,
          streak: h.currentStreak,
          completedToday: !!h.completionHistory?.[todayDate],
        })),
        medications: medications.filter(m => !m.archived && m.active).slice(0, 8).map(m => ({
          name: m.name,
          dosage: m.dosage,
          times: (m.schedules || []).map(s => s.time),
          remainingPills: m.remainingPills,
        })),
        unpaidBills: bills.filter(b => !b.isPaid && !b.archived).slice(0, 8).map(b => ({
          title: b.title,
          amount: b.amount,
          dueDate: b.dueDate,
        })),
        todaySchedule: scheduleItems.filter(s => s.date === todayDate).slice(0, 8).map(s => ({
          title: s.title,
          time: `${s.startTime}-${s.endTime}`,
          completed: s.completed,
        })),
      };

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          conversationHistory: aiMessages.slice(-6),
          userContext: liveUserContext,
          aiProvider,
          selectedModel,
          baseUrl,
          customApiKey,
        }),
      });

      const data = await res.json();
      const rawReply = data.reply || "I've reviewed your request.";

      // Extract all actionable items: <omni_actions>[...]</omni_actions> or multiple <omni_action>{...}</omni_action>
      const collectedActions: ActionableItem[] = [];
      let cleanText = rawReply;

      // 1. Array format
      const arrayMatch = rawReply.match(/<omni_actions>([\s\S]*?)<\/omni_actions>/);
      if (arrayMatch && arrayMatch[1]) {
        try {
          const parsed = JSON.parse(arrayMatch[1].trim());
          if (Array.isArray(parsed)) {
            collectedActions.push(...parsed);
          }
          cleanText = cleanText.replace(/<omni_actions>[\s\S]*?<\/omni_actions>/g, '').trim();
        } catch (e) {
          console.warn('Failed to parse <omni_actions> JSON', e);
        }
      }

      // 2. Individual action blocks
      const singleMatches = [...cleanText.matchAll(/<omni_action>([\s\S]*?)<\/omni_action>/g)];
      for (const sm of singleMatches) {
        if (sm[1]) {
          try {
            const parsed = JSON.parse(sm[1].trim());
            collectedActions.push(parsed);
          } catch (e) {
            console.warn('Failed to parse single <omni_action> JSON', e);
          }
        }
      }
      cleanText = cleanText.replace(/<omni_action>[\s\S]*?<\/omni_action>/g, '').trim();

      const botMsg: AIMessage = {
        id: `bot_msg_${Date.now()}`,
        sender: 'assistant',
        text: cleanText,
        timestamp: new Date().toISOString(),
        actionableItem: collectedActions[0],
        actionableItems: collectedActions.length > 0 ? collectedActions : undefined,
        modelUsed: data.modelUsed,
      };

      setAiMessages(prev => [...prev, botMsg]);
      soundEngine.playSuccessChime();
    } catch (err: any) {
      console.warn('Network request failed, executing client-side smart assistant fallback:', err);
      const lower = text.toLowerCase();
      let fallbackText = "I've processed your request.";
      let fallbackItem: ActionableItem | undefined;

      const todayStr = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

      if (
        lower.includes('habit') ||
        lower.includes('workout') ||
        lower.includes('gym') ||
        lower.includes('fitness') ||
        lower.includes('water') ||
        lower.includes('meditat') ||
        lower.includes('stretch') ||
        lower.includes('run') ||
        lower.includes('read')
      ) {
        const isFitness = lower.includes('fitness') || lower.includes('gym') || lower.includes('workout') || lower.includes('run');
        const isMind = lower.includes('meditat') || lower.includes('mind');
        const isLearning = lower.includes('read') || lower.includes('study');
        const cat = isFitness ? 'fitness' : isMind ? 'mind' : isLearning ? 'learning' : 'health';
        const rawName = text.replace(/(add|create|new|set up|habit|to|for|in|section|please|my)/gi, '').replace(/:/g, '').trim();
        const habitName = rawName || (isFitness ? 'Daily Fitness Workout' : 'Healthy Routine');
        fallbackItem = {
          type: 'habit',
          name: habitName.charAt(0).toUpperCase() + habitName.slice(1),
          category: cat,
          frequency: 'daily',
          targetDaysPerWeek: 7,
          timerMinutes: 20,
          color: isFitness ? '#f43f5e' : isMind ? '#8b5cf6' : '#10b981',
        };
        fallbackText = `I've prepared your new habit: **${fallbackItem.name}** in the **${cat}** category. Tap below to confirm and add!`;
      } else if (lower.includes('medication') || lower.includes('pill') || lower.includes('dose') || lower.includes('tablet')) {
        const cleanMed = text.replace(/(add|create|medication|pill|dose|tablet|take|remind|my)/gi, '').trim() || 'Multivitamin';
        const medName = cleanMed.charAt(0).toUpperCase() + cleanMed.slice(1);
        fallbackItem = {
          type: 'medication',
          name: medName,
          dosage: '1 tablet',
          scheduleTimes: ['08:00', '20:00'],
          totalPills: 30,
          remainingPills: 30,
          refillThreshold: 5,
          frequency: 'Daily',
        };
        fallbackText = `I've prepared your medication schedule for **${medName}**. Tap below to save it into Meds!`;
      } else if (lower.includes('meeting') || lower.includes('appointment') || lower.includes('event') || lower.includes('schedule')) {
        const cleanEv = text.replace(/(add|schedule|set|calendar|event|meeting|appointment|at|on)/gi, '').trim() || 'Team Meeting';
        fallbackItem = {
          type: 'event',
          title: cleanEv.charAt(0).toUpperCase() + cleanEv.slice(1),
          date: todayStr,
          startTime: '10:00',
          endTime: '11:00',
          category: 'work',
        };
        fallbackText = `I've scheduled **${fallbackItem.title}** on your calendar for today at 10:00 AM. Tap below to add!`;
      } else if (
        lower.includes('bill') ||
        lower.includes('electric') ||
        lower.includes('credit card') ||
        lower.includes('rent') ||
        lower.includes('internet') ||
        lower.includes('subscription')
      ) {
        const amountMatch = text.match(/\$?(\d+(\.\d+)?)/);
        const amount = amountMatch ? parseFloat(amountMatch[1]) : 85.0;
        const rawTitle = text.replace(/(add|create|remind|pay|bill|due|for|please|\$\d+(\.\d+)?)/gi, '').replace(/:/g, '').trim();
        const title = rawTitle || 'Upcoming Bill';
        fallbackItem = {
          type: 'bill',
          title: title.charAt(0).toUpperCase() + title.slice(1),
          amount,
          dueDate: nextWeek,
          recurring: 'monthly',
          autoPay: false,
        };
        fallbackText = `I've prepared a bill reminder for **${fallbackItem.title}** ($${amount.toFixed(2)}) due on ${nextWeek}. Tap below to save!`;
      } else if (lower.includes('goal') || lower.includes('target') || lower.includes('save $')) {
        const rawGoal = text.replace(/(add|create|goal|target|set|please|my)/gi, '').replace(/:/g, '').trim() || 'Key Milestone Goal';
        fallbackItem = {
          type: 'goal',
          title: rawGoal.charAt(0).toUpperCase() + rawGoal.slice(1),
          targetDate: nextWeek,
          milestones: ['Define key objectives', 'Track weekly milestones', 'Celebrate completion'],
        };
        fallbackText = `Here is your structured goal: **${fallbackItem.title}**. Tap below to add it to your active goals!`;
      } else {
        const cleanTask = text.replace(/(add|create|task|todo|to|please|remind me to)/gi, '').replace(/:/g, '').trim() || 'Action Item';
        const taskTitle = cleanTask.charAt(0).toUpperCase() + cleanTask.slice(1);
        fallbackItem = {
          type: 'task',
          title: taskTitle,
          priority: lower.includes('urgent') || lower.includes('high') || lower.includes('p1') ? 'high' : 'medium',
          dueDate: todayStr,
          project: 'Work & Engineering',
          quadrant: 'urgent_important',
        };
        fallbackText = `I've organized this task for you: **${taskTitle}**. Tap below to save it!`;
      }

      const botMsg: AIMessage = {
        id: `bot_local_${Date.now()}`,
        sender: 'assistant',
        text: fallbackText,
        timestamp: new Date().toISOString(),
        actionableItem: fallbackItem,
        actionableItems: fallbackItem ? [fallbackItem] : undefined,
      };
      setAiMessages(prev => [...prev, botMsg]);
      soundEngine.playSuccessChime();
    } finally {
      setIsAILoading(false);
    }
  };

  // Widget Handlers
  const toggleWidget = (id: string) => {
    setWidgets(prev =>
      prev.map(w => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    );
  };

  const reorderWidgets = (newWidgets: DashboardWidgetConfig[]) => {
    setWidgets(newWidgets);
  };

  const resetWidgets = () => {
    setWidgets(defaultWidgets);
  };

  // Notifications
  const markNotificationRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const clearNotificationHistory = () => {
    setNotificationHistory([]);
  };

  const recordAlarmHistory = (item: Omit<AlarmHistoryItem, 'id' | 'triggeredAt'>) => {
    const newItem: AlarmHistoryItem = {
      ...item,
      id: `alarm_hist_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      triggeredAt: new Date().toISOString(),
    };
    setAlarmHistory(prev => [newItem, ...prev].slice(0, 100));
  };

  const clearAlarmHistory = () => {
    setAlarmHistory([]);
  };

  // Deterministic data hash to detect actual user changes (including all personal profile fields)
  const getDataHash = () => {
    try {
      return JSON.stringify({
        profile: {
          name: profile.name,
          nickname: profile.nickname,
          avatarPhoto: profile.avatarPhoto,
          email: profile.email,
          identifier: profile.identifier,
          bio: profile.bio,
          dateOfBirth: profile.dateOfBirth,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          gender: profile.gender,
          preferredCurrency: profile.preferredCurrency,
          updatedAt: profile.updatedAt,
        },
        medications,
        doseLogs,
        hydration,
        tasks: tasks.map(t => ({
          id: t.id,
          title: t.title,
          notes: t.notes,
          priority: t.priority,
          status: t.status,
          quadrant: t.quadrant,
          dueDate: t.dueDate,
          dueTime: t.dueTime,
          completed: t.completed,
          subtasks: t.subtasks,
          checklist: t.checklist,
          order: t.order,
          rank: t.rank,
          tags: t.tags,
          listId: t.listId,
          goalId: t.goalId,
          project: t.project,
          isStarred: t.isStarred,
          updatedAt: t.updatedAt,
        })),
        goals,
        bills,
        habits,
        routines,
        widgets,
        todoLists,
        listGroups,
        tags,
        scheduleItems,
        inboxItems,
        workflowStages,
        currency,
        theme,
        themeStyle,
        accentTone,
        favoriteQuoteIds,
        quoteLibraryHash: contentHashSync(canonicalizeQuoteSyncData(buildQuoteSyncData())),
        deletedIds,
      });
    } catch {
      return '';
    }
  };

  // Cloud Sync & Backups (Includes Personal Profile Details + Tombstones + Quote Library)
  const compilePayload = () => {
    // Lazily warm WASM module on first sync/backup export (silent TS fallback if missing)
    loadQuoteWasm().catch(() => {});
    const quoteLibrary = buildQuoteSyncData();
    return JSON.stringify({
      version: 2,
      profile: joplinSyncSettings.syncPersonalDetails
        ? profile
        : { ...initialProfile, preferredCurrency: profile.preferredCurrency || (currency as any) },
      medications,
      doseLogs,
      hydration,
      tasks,
      goals,
      bills,
      appLock,
      habits,
      routines,
      widgets,
      todoLists,
      listGroups,
      tags,
      scheduleItems,
      scheduleStartHour,
      scheduleEndHour,
      pinnedSidebarItemId,
      inboxItems,
      workflowStages,
      currency,
      theme,
      themeStyle,
      accentTone,
      favoriteQuoteIds,
      quoteLibrary,
      deletedIds,
      exportedAt: new Date().toISOString(),
    });
  };

  compilePayloadRef.current = compilePayload;
  useEffect(() => {
    compilePayloadRef.current = compilePayload;
  });

  const setSyncEmail = (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    localStorage.setItem('omniplan_user_explicit_login', 'true');
    setSyncEmailState(clean);
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_sync_email`, clean);
    setProfile(prev => ({
      ...prev,
      identifier: prev.identifier || clean,
      email: prev.email || clean,
      name: !prev.name || prev.name === 'Guest' ? clean.split('@')[0] : prev.name,
      updatedAt: new Date().toISOString(),
    }));
    if (!savedSyncEmails.includes(clean)) {
      const updated = [...savedSyncEmails, clean];
      setSavedSyncEmails(updated);
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_saved_sync_emails`, JSON.stringify(updated));
    }
    pushNotification('Sync Account Switched', `Active sync target set to ${clean}`, 'system');
  };

  const addSyncEmail = (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    if (!savedSyncEmails.includes(clean)) {
      const updated = [...savedSyncEmails, clean];
      setSavedSyncEmails(updated);
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_saved_sync_emails`, JSON.stringify(updated));
    }
    setSyncEmail(clean);
  };

  const removeSyncEmail = (email: string) => {
    const clean = email.trim().toLowerCase();
    if (savedSyncEmails.length <= 1) return;
    const updated = savedSyncEmails.filter(e => e !== clean);
    setSavedSyncEmails(updated);
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_saved_sync_emails`, JSON.stringify(updated));
    if (syncEmail === clean) {
      setSyncEmail(updated[0]);
    }
  };

  const updateOpenSourceCloudConfig = (cfg: Partial<OpenSourceCloudConfig>) => {
    setOpenSourceCloudConfig(prev => {
      const next = { ...prev, ...cfg };
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_opensource_cloud`, JSON.stringify(next));
      // Keep Joplin WebDAV / Nextcloud / S3 drive config in sync
      if (next.provider === 'nextcloud' || next.provider === 'webdav') {
        updateDriveConfig(next.provider, {
          serverUrl: next.serverUrl,
          username: next.username,
          password: next.authSecret,
          remotePath: next.remotePath || '/JivanOS',
        });
      } else if (next.provider === 'minio_s3') {
        updateDriveConfig('s3', {
          s3Endpoint: next.serverUrl,
          s3AccessKey: next.username,
          s3SecretKey: next.authSecret,
          s3Bucket: next.s3Bucket || '',
          s3Region: next.s3Region || '',
        });
      }
      return next;
    });
  };

  const testOpenSourceCloudConnection = async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const res = await fetch('/api/backup/test-open-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: openSourceCloudConfig.provider,
          serverUrl: openSourceCloudConfig.serverUrl,
          username: openSourceCloudConfig.username,
          authSecret: openSourceCloudConfig.authSecret,
          s3Bucket: openSourceCloudConfig.s3Bucket,
        }),
      });
      const data = await res.json();
      return data;
    } catch (e: any) {
      return { success: false, error: e?.message || 'Connection test failed' };
    }
  };

  const pickLocalFolderForSync = async (): Promise<{ success: boolean; folderName?: string; error?: string }> => {
    const res = await pickLocalSyncDirectory();
    if (res.success && res.folderName) {
      updateDriveConfig('local_folder', {
        enabled: true,
        folderName: res.folderName,
        lastStatus: 'idle',
        lastError: undefined,
      });
      if (joplinSyncSettings.primaryTarget === 'none') {
        updateJoplinSyncSettings({ primaryTarget: 'local_folder' });
      }
    }
    return res;
  };

  const checkDriveConfiguration = async (
    driveId: SyncDriveId
  ): Promise<{ success: boolean; message: string }> => {
    const driveCfg = joplinSyncSettings.drives[driveId];
    const res = await testDriveConnection(driveId, driveCfg, firebaseUser?.uid);
    updateDriveConfig(driveId, {
      lastStatus: res.success ? 'synced' : 'error',
      lastError: res.success ? undefined : res.message,
    });
    return res;
  };

  const setGDriveManualToken = useCallback((token: string) => {
    const clean = token.trim();
    setInMemoryGDriveToken(clean || null);
    setIsGDriveConnected(Boolean(clean));
    updateDriveConfig('gdrive', {
      enabled: Boolean(clean),
      accessToken: '',
      lastStatus: clean ? 'idle' : 'idle',
      lastError: undefined,
    });
  }, [updateDriveConfig]);

  const disconnectGDrive = useCallback(() => {
    clearInMemoryGDriveToken();
    setIsGDriveConnected(false);
    updateDriveConfig('gdrive', {
      enabled: false,
      accessToken: '',
      lastStatus: 'idle',
      lastError: undefined,
    });
  }, [updateDriveConfig]);

  const connectDriveOAuth = async (
    driveId: 'gdrive' | 'dropbox',
    customClientId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (driveId === 'gdrive') {
        const overrideClientId = (customClientId !== undefined ? customClientId : joplinSyncSettings.drives.gdrive?.clientId || '').trim();
        if (overrideClientId) {
          const { accessToken } = await launchDriveOAuthPopup('gdrive', overrideClientId);
          setInMemoryGDriveToken(accessToken);
          setIsGDriveConnected(true);
          updateDriveConfig('gdrive', {
            enabled: true,
            clientId: overrideClientId,
            accessToken: '',
            lastStatus: 'synced',
            lastError: undefined,
          });
        } else {
          const res = await connectGoogleDriveWithFirebase();
          setIsGDriveConnected(true);
          updateDriveConfig('gdrive', {
            enabled: true,
            clientId: '',
            accessToken: '',
            accountEmail: res.email || undefined,
            lastStatus: 'synced',
            lastError: undefined,
          });
        }
        if (joplinSyncSettings.primaryTarget === 'none') {
          updateJoplinSyncSettings({ primaryTarget: 'gdrive' });
        }
        return { success: true };
      }

      // Dropbox uses hardcoded PKCE OAuth2 (zero user keys, tokens never persisted in plaintext)
      const account = await connectDropbox();
      updateDriveConfig('dropbox', {
        enabled: true,
        clientId: '',
        accessToken: '',
        accountEmail: account.email || account.name || undefined,
        lastStatus: 'synced',
        lastError: undefined,
      });
      if (joplinSyncSettings.primaryTarget === 'none') {
        updateJoplinSyncSettings({ primaryTarget: 'dropbox' });
      }
      return { success: true };
    } catch (err: any) {
      updateDriveConfig(driveId, {
        lastStatus: 'error',
        lastError: err?.message || 'Sign-in failed',
      });
      return { success: false, error: err?.message || 'Sign-in failed' };
    }
  };

  /**
   * Joplin-Style Bi-Directional Sync & Multi-Drive Auto-Backup
   * 1. Pulls remote state from the target drive (if present)
   * 2. Merges entities + personal profile details conflict-free
   * 3. Pushes merged state back to target drive + mirrors snapshots to all enabled Auto-Backup drives
   */
  const syncDriveNow = async (
    specificDriveId?: SyncDriveId,
    options?: { isBackupSnapshot?: boolean }
  ): Promise<{ success: boolean; message: string }> => {
    const targetDriveId: SyncDriveId | 'none' =
      specificDriveId ||
      (joplinSyncSettings.primaryTarget !== 'none'
        ? joplinSyncSettings.primaryTarget
        : firebaseUser?.uid
        ? 'firebase'
        : 'none');

    const nowIso = new Date().toISOString();
    setSyncStatus('syncing');

    try {
      let currentPlainJson = compilePayload();

      // Step 1: If we have a primary or specified drive, pull & merge first (unless purely creating a backup snapshot)
      if (targetDriveId !== 'none') {
        const driveCfg = joplinSyncSettings.drives[targetDriveId];
        updateDriveConfig(targetDriveId, { lastStatus: 'syncing', lastError: undefined });

        try {
          const rawRemote = await pullFromDrive(targetDriveId, driveCfg, firebaseUser?.uid);
          if (rawRemote && rawRemote.trim().length > 2) {
            const decodedRemote = await decodeSyncEnvelope(rawRemote, joplinSyncSettings.e2eePassphrase);
            const mergedObj = mergeSyncPayloads(
              currentPlainJson,
              decodedRemote,
              joplinSyncSettings.syncPersonalDetails
            );
            currentPlainJson = JSON.stringify(mergedObj);
            isApplyingRemoteSyncRef.current = true;
            importBackupJSON(currentPlainJson);
            setTimeout(() => {
              isApplyingRemoteSyncRef.current = false;
            }, 1200);
          }
        } catch (pullErr: any) {
          // If first-time push or 404, continue to push
          if (pullErr?.message?.includes('E2EE') || pullErr?.message?.includes('Decryption')) {
            throw pullErr;
          }
        }

        // Step 2: Encode (optional E2EE) and push merged state to target drive
        const encodedPayload = await encodeSyncEnvelope(
          currentPlainJson,
          joplinSyncSettings.e2eeEnabled,
          joplinSyncSettings.e2eePassphrase
        );

        await pushToDrive(targetDriveId, driveCfg, encodedPayload, {
          isBackupSnapshot: options?.isBackupSnapshot,
          firebaseUid: firebaseUser?.uid,
          email: firebaseUser?.email || syncEmail || profile.identifier,
        });

        updateDriveConfig(targetDriveId, {
          enabled: true,
          lastStatus: 'synced',
          lastSyncedAt: nowIso,
          lastBackupAt: options?.isBackupSnapshot ? nowIso : driveCfg.lastBackupAt,
          lastError: undefined,
        });
      }

      // Step 3: Mirror to all other drives marked with `autoBackupEnabled: true`
      const encodedForBackups = await encodeSyncEnvelope(
        currentPlainJson,
        joplinSyncSettings.e2eeEnabled,
        joplinSyncSettings.e2eePassphrase
      );

      const allDriveIds = Object.keys(joplinSyncSettings.drives) as SyncDriveId[];
      const mirroredDrives: string[] = [];

      for (const dId of allDriveIds) {
        if (dId === targetDriveId) continue;
        const dCfg = joplinSyncSettings.drives[dId];
        if (!dCfg?.autoBackupEnabled) continue;
        try {
          await pushToDrive(dId, dCfg, encodedForBackups, {
            isBackupSnapshot: true,
            firebaseUid: firebaseUser?.uid,
            email: firebaseUser?.email || syncEmail || profile.identifier,
          });
          updateDriveConfig(dId, {
            lastBackupAt: nowIso,
            lastStatus: 'synced',
            lastError: undefined,
          });
          mirroredDrives.push(dCfg.label || dId);
        } catch (mirrorErr: any) {
          updateDriveConfig(dId, {
            lastStatus: 'error',
            lastError: mirrorErr?.message || 'Auto-backup failed',
          });
        }
      }

      // Also save local snapshot in localStorage & server history when online
      try {
        localStorage.setItem(`${LOCAL_STORAGE_KEY}_last_sync_time`, nowIso);
      } catch {}

      const activeAccount = (firebaseUser?.email || syncEmail || profile.identifier || 'local_vault').trim().toLowerCase();
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: activeAccount,
            email: activeAccount,
            payload: currentPlainJson,
            clientVersion: 2,
          }),
        });
      } catch {}

      setLastSyncTime(nowIso);
      setSyncStatus('synced');

      const primaryLabel =
        targetDriveId !== 'none'
          ? joplinSyncSettings.drives[targetDriveId]?.label || targetDriveId
          : 'Local Device Vault';
      const mirrorSuffix = mirroredDrives.length > 0 ? ` + mirrored to ${mirroredDrives.join(', ')}` : '';
      return {
        success: true,
        message: `Synced with ${primaryLabel}${mirrorSuffix}. Personal profile & modules up to date.`,
      };
    } catch (err: any) {
      if (targetDriveId !== 'none') {
        updateDriveConfig(targetDriveId, {
          lastStatus: 'error',
          lastError: err?.message || 'Sync failed',
        });
      }
      setSyncStatus('error');
      return {
        success: false,
        message: err?.message || 'Sync encountered an error.',
      };
    }
  };

  const syncWithCloud = async () => {
    if (!isOnline && joplinSyncSettings.primaryTarget !== 'local_folder') {
      setSyncStatus('offline');
      return;
    }
    await syncDriveNow();
  };

  const createCloudBackup = async (
    provider: CloudBackupProvider = 'omni_cloud',
    source: 'manual' | 'auto' = 'manual'
  ) => {
    try {
      const payload = compilePayload();
      const targetEmail = (syncEmail || firebaseUser?.email || profile?.identifier || 'local_vault').trim().toLowerCase();

      if (provider === 'local') {
        downloadLocalBackupFile();
        return true;
      }

      // Map CloudBackupProvider to Joplin SyncDriveId if applicable
      const driveMap: Partial<Record<CloudBackupProvider, SyncDriveId>> = {
        local_folder: 'local_folder',
        gdrive: 'gdrive',
        dropbox: 'dropbox',
        nextcloud: 'nextcloud',
        webdav: 'webdav',
        minio_s3: 's3',
        s3: 's3',
        firebase: 'firebase',
      };

      const mappedDrive = driveMap[provider];
      if (mappedDrive) {
        const dCfg = joplinSyncSettings.drives[mappedDrive];
        const isConfigured =
          mappedDrive === 'local_folder'
            ? Boolean(dCfg?.folderName)
            : mappedDrive === 'firebase'
            ? Boolean(firebaseUser?.uid)
            : mappedDrive === 'nextcloud' || mappedDrive === 'webdav'
            ? Boolean(dCfg?.serverUrl)
            : mappedDrive === 's3'
            ? Boolean(dCfg?.s3Endpoint && dCfg?.s3Bucket)
            : mappedDrive === 'gdrive'
            ? Boolean(dCfg?.accessToken || getInMemoryGDriveToken())
            : Boolean(dCfg?.accessToken);

        if (isConfigured) {
          const res = await syncDriveNow(mappedDrive, { isBackupSnapshot: true });
          if (res.success) {
            pushNotification('Drive Sync & Backup', res.message, 'system');
            return true;
          }
        }
      }

      // Also store snapshot in server snapshot history for Snapshot Inspector
      try {
        const res = await fetch('/api/backup/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: targetEmail,
            email: targetEmail,
            payload,
            provider,
            source,
            openSourceConfig: openSourceCloudConfig,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setLastSyncTime(new Date().toISOString());
            setSyncStatus('synced');
            pushNotification(
              'Backup Snapshot Saved',
              `Created snapshot on ${provider.toUpperCase()} (including personal details & tasks).`,
              'system'
            );
            return true;
          }
        }
      } catch {}

      return false;
    } catch {
      return false;
    }
  };

  const downloadLocalBackupFile = () => {
    try {
      const payload = compilePayload();
      exportLocalBackup(payload)
        .then(res => {
          if (res.success) {
            showAndroidToast('Backup saved to Downloads', 3000, 'success');
            pushNotification('Backup Saved', `Saved ${res.filename} to Downloads.`, 'system');
          } else {
            showAndroidToast(res.error || 'Failed to save backup', 3000, 'error');
          }
        })
        .catch(() => {
          showAndroidToast('Failed to save backup', 3000, 'error');
        });
    } catch (e) {
      console.error('Failed to download local backup', e);
      showAndroidToast('Failed to save backup', 3000, 'error');
    }
  };

  const restoreCloudBackup = async (version?: number) => {
    try {
      // If a Joplin primary drive is active and no historical version is specified, pull & merge from primary drive
      if (!version && joplinSyncSettings.primaryTarget !== 'none') {
        const res = await syncDriveNow(joplinSyncSettings.primaryTarget);
        if (res.success) return true;
      }

      // Check Firebase Firestore if authenticated
      if (!version && firebaseUser?.uid) {
        const remoteData = await getUserDataFromFirestore(firebaseUser.uid);
        if (remoteData && remoteData.payload) {
          const decoded = await decodeSyncEnvelope(remoteData.payload, joplinSyncSettings.e2eePassphrase);
          const merged = mergeSyncPayloads(
            compilePayload(),
            decoded,
            joplinSyncSettings.syncPersonalDetails
          );
          const success = importBackupJSON(JSON.stringify(merged));
          if (success) {
            pushNotification('Cloud Restore', 'Merged latest state & personal profile from Firebase Cloud.', 'system');
            return true;
          }
        }
      }

      const activeAccount = (syncEmail || firebaseUser?.email || profile?.identifier || 'local_vault').trim().toLowerCase();
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeAccount,
          email: activeAccount,
          version,
        }),
      });
      const data = await res.json();
      if (data.success && data.restoredPayload) {
        return importBackupJSON(data.restoredPayload);
      }
      return false;
    } catch {
      return false;
    }
  };

  const exportEncryptedJSON = useCallback(() => {
    return compilePayloadRef.current();
  }, []);

  const importBackupJSON = (jsonStr: string) => {
    try {
      const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      if (!data || typeof data !== 'object') return false;

      if (data.profile) {
        setProfile(prev => {
          const merged = mergeSyncPayloads(
            { profile: prev },
            { profile: data.profile },
            joplinSyncSettings.syncPersonalDetails
          ).profile || { ...prev, ...data.profile };
          try {
            localStorage.setItem(`${LOCAL_STORAGE_KEY}_profile`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
      if (data.deletedIds) {
        const normalizedDeletedIds = Array.isArray(data.deletedIds)
          ? data.deletedIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
          : typeof data.deletedIds === 'object'
          ? Object.values(data.deletedIds).filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
          : [];
        setDeletedIds(normalizedDeletedIds);
        try {
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_deleted_ids`, JSON.stringify(normalizedDeletedIds));
        } catch {}
      }
      if (Array.isArray(data.medications)) {
        setMedications(data.medications);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_meds`, JSON.stringify(data.medications)); } catch {}
      }
      if (Array.isArray(data.tasks)) {
        setTasks(data.tasks);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_tasks`, JSON.stringify(data.tasks)); } catch {}
      }
      if (Array.isArray(data.goals)) {
        setGoals(data.goals);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_goals`, JSON.stringify(data.goals)); } catch {}
      }
      if (Array.isArray(data.bills)) {
        setBills(data.bills);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_bills`, JSON.stringify(data.bills)); } catch {}
      }
      if (data.appLock && typeof data.appLock === 'object') {
        setAppLock(data.appLock);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_applock`, JSON.stringify(data.appLock)); } catch {}
      }
      if (data.hydration && typeof data.hydration === 'object') {
        setHydration(data.hydration);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_hydration`, JSON.stringify(data.hydration)); } catch {}
      }
      if (data.habits || data.routines) {
        const baseHabits: Habit[] = Array.isArray(data.habits) ? data.habits : habits;
        const baseTags: AppTag[] = Array.isArray(data.tags) ? data.tags : tags;
        const incomingRoutines: Routine[] = Array.isArray(data.routines) ? data.routines : [];
        const { mergedHabits, mergedTags } = mergeRoutinesIntoHabitsAndTags(
          baseHabits,
          baseTags,
          incomingRoutines
        );
        setHabits(mergedHabits);
        setTags(mergedTags);
        setRoutines([]);
        try {
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_habits`, JSON.stringify(mergedHabits));
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_tags`, JSON.stringify(mergedTags));
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_routines`, JSON.stringify([]));
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_routines_merged_to_habits_v1`, 'true');
        } catch {}
      }
      if (Array.isArray(data.widgets)) {
        setWidgets(data.widgets);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_widgets`, JSON.stringify(data.widgets)); } catch {}
      }
      if (Array.isArray(data.doseLogs)) {
        setDoseLogs(data.doseLogs);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_doselogs`, JSON.stringify(data.doseLogs)); } catch {}
      }
      if (Array.isArray(data.todoLists)) {
        setTodoLists(data.todoLists);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_todo_lists`, JSON.stringify(data.todoLists)); } catch {}
      }
      if (Array.isArray(data.listGroups)) {
        setListGroups(data.listGroups);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_list_groups`, JSON.stringify(data.listGroups)); } catch {}
      }
      if (Array.isArray(data.tags)) {
        setTags(data.tags);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_tags`, JSON.stringify(data.tags)); } catch {}
      }
      if (Array.isArray(data.scheduleItems)) {
        setScheduleItems(data.scheduleItems);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_schedule`, JSON.stringify(data.scheduleItems)); } catch {}
      } else if (Array.isArray(data.schedule)) {
        setScheduleItems(data.schedule);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_schedule`, JSON.stringify(data.schedule)); } catch {}
      }
      if (data.scheduleStartHour !== undefined) {
        setScheduleStartHourState(data.scheduleStartHour);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_schedule_start_hour`, String(data.scheduleStartHour)); } catch {}
      }
      if (data.scheduleEndHour !== undefined) {
        setScheduleEndHourState(data.scheduleEndHour);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_schedule_end_hour`, String(data.scheduleEndHour)); } catch {}
      }
      if (data.pinnedSidebarItemId) {
        setPinnedSidebarItemId(data.pinnedSidebarItemId);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_pinned_sidebar_item`, data.pinnedSidebarItemId); } catch {}
      }
      if (Array.isArray(data.inboxItems)) {
        setInboxItems(data.inboxItems);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_inbox`, JSON.stringify(data.inboxItems)); } catch {}
      }
      if (Array.isArray(data.workflowStages)) {
        setWorkflowStages(data.workflowStages);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_workflow_stages`, JSON.stringify(data.workflowStages)); } catch {}
      }
      if (data.currency) {
        setCurrencyState(data.currency);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_currency`, data.currency); } catch {}
      }
      if (data.theme) {
        setThemeState(data.theme);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_theme`, data.theme); } catch {}
      }
      if (data.themeStyle) {
        setThemeStyleState(data.themeStyle);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_theme_style`, data.themeStyle); } catch {}
      }
      if (data.accentTone) {
        setAccentToneState(data.accentTone);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_accent_tone`, data.accentTone); } catch {}
      }
      if (data.quoteLibrary && typeof data.quoteLibrary === 'object') {
        isApplyingRemoteSyncRef.current = true;
        const mergedQuoteLib = mergeQuoteSyncData(buildQuoteSyncData(), data.quoteLibrary);
        const applied = applyQuoteSyncData(mergedQuoteLib);
        setQuotes(applied.quotes);
        setFavoriteQuoteIds(applied.favoriteQuoteIds);
        setQuoteCategoriesRaw(applied.categoriesRaw);
        setDeletedQuoteIds(applied.deletedIds);
      } else if (Array.isArray(data.favoriteQuoteIds)) {
        setFavoriteQuoteIds(data.favoriteQuoteIds);
        try {
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_favorite_quotes`, JSON.stringify(data.favoriteQuoteIds));
          localStorage.setItem(QUOTE_FAVORITES_KEY, JSON.stringify(data.favoriteQuoteIds));
        } catch {}
      }

      setTimeout(() => {
        const refreshedHash = getDataHash();
        lastSyncedPayloadHashRef.current = refreshedHash;
        lastAutoSnapshotHashRef.current = refreshedHash;
        isApplyingRemoteSyncRef.current = false;
      }, 150);

      return true;
    } catch (e) {
      console.error('Error importing backup JSON:', e);
      isApplyingRemoteSyncRef.current = false;
      return false;
    }
  };

  /**
   * Phase 1 Local Restore: Validates JSON and cleanly replaces ALL current app data
   * without merging stale items from the previous state.
   */
  const replaceAllAppDataFromBackup = (jsonStr: string): boolean => {
    const validation = validateBackupPayload(jsonStr);
    if (!validation.valid) {
      return false;
    }

    const data = validation.data as Record<string, any>;
    isApplyingLocalRestoreRef.current = true;
    isApplyingRemoteSyncRef.current = true;

    try {
      const nextProfile: UserProfile =
        data.profile && typeof data.profile === 'object'
          ? { ...initialProfile, ...data.profile }
          : { ...initialProfile };
      setProfile(nextProfile);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_profile`, JSON.stringify(nextProfile)); } catch {}

      const nextDeletedIds: string[] = Array.isArray(data.deletedIds)
        ? data.deletedIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
        : data.deletedIds && typeof data.deletedIds === 'object'
        ? Object.values(data.deletedIds).filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
        : [];
      setDeletedIds(nextDeletedIds);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_deleted_ids`, JSON.stringify(nextDeletedIds)); } catch {}

      const nextMeds: Medication[] = Array.isArray(data.medications) ? data.medications : [];
      setMedications(nextMeds);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_meds`, JSON.stringify(nextMeds)); } catch {}

      const nextDoseLogs: DoseLog[] = Array.isArray(data.doseLogs) ? data.doseLogs : [];
      setDoseLogs(nextDoseLogs);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_doselogs`, JSON.stringify(nextDoseLogs)); } catch {}

      const nextHydration: HydrationState =
        data.hydration && typeof data.hydration === 'object'
          ? { ...initialHydration, ...data.hydration }
          : { ...initialHydration };
      setHydration(nextHydration);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_hydration`, JSON.stringify(nextHydration)); } catch {}

      const nextTasks: TaskItem[] = Array.isArray(data.tasks) ? data.tasks : [];
      setTasks(nextTasks);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_tasks`, JSON.stringify(nextTasks)); } catch {}

      const nextGoals: Goal[] = Array.isArray(data.goals) ? data.goals : [];
      setGoals(nextGoals);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_goals`, JSON.stringify(nextGoals)); } catch {}

      const nextBills: Bill[] = Array.isArray(data.bills) ? data.bills : [];
      setBills(nextBills);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_bills`, JSON.stringify(nextBills)); } catch {}

      const nextAppLock: AppLockConfig =
        data.appLock && typeof data.appLock === 'object'
          ? { ...initialAppLock, ...data.appLock, isLocked: false }
          : { ...initialAppLock, isLocked: false };
      setAppLock(nextAppLock);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_applock`, JSON.stringify(nextAppLock)); } catch {}

      const rawNextHabits: Habit[] = Array.isArray(data.habits) ? data.habits : [];
      const rawNextRoutines: Routine[] = Array.isArray(data.routines) ? data.routines : [];
      const rawNextTags: AppTag[] = Array.isArray(data.tags) ? data.tags : [];
      const { mergedHabits: nextHabits, mergedTags: nextTags } = mergeRoutinesIntoHabitsAndTags(
        rawNextHabits,
        rawNextTags,
        rawNextRoutines
      );
      setHabits(nextHabits);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_habits`, JSON.stringify(nextHabits)); } catch {}

      setRoutines([]);
      try {
        localStorage.setItem(`${LOCAL_STORAGE_KEY}_routines`, JSON.stringify([]));
        localStorage.setItem(`${LOCAL_STORAGE_KEY}_routines_merged_to_habits_v1`, 'true');
      } catch {}

      const nextWidgets: DashboardWidgetConfig[] = Array.isArray(data.widgets)
        ? data.widgets
        : defaultWidgets;
      setWidgets(nextWidgets);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_widgets`, JSON.stringify(nextWidgets)); } catch {}

      const nextTodoLists: TodoList[] = Array.isArray(data.todoLists)
        ? data.todoLists
        : initialTodoLists;
      setTodoLists(nextTodoLists);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_todo_lists`, JSON.stringify(nextTodoLists)); } catch {}

      const nextListGroups: ListGroup[] = Array.isArray(data.listGroups)
        ? data.listGroups
        : initialListGroups;
      setListGroups(nextListGroups);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_list_groups`, JSON.stringify(nextListGroups)); } catch {}
      setTags(nextTags);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_tags`, JSON.stringify(nextTags)); } catch {}

      const nextSchedule: ScheduleItem[] = Array.isArray(data.scheduleItems)
        ? data.scheduleItems
        : Array.isArray(data.schedule)
        ? data.schedule
        : [];
      setScheduleItems(nextSchedule);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_schedule`, JSON.stringify(nextSchedule)); } catch {}

      const nextStartHour = typeof data.scheduleStartHour === 'number' ? data.scheduleStartHour : 6;
      setScheduleStartHourState(nextStartHour);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_schedule_start_hour`, String(nextStartHour)); } catch {}

      const nextEndHour = typeof data.scheduleEndHour === 'number' ? data.scheduleEndHour : 22;
      setScheduleEndHourState(nextEndHour);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_schedule_end_hour`, String(nextEndHour)); } catch {}

      const nextPinned = typeof data.pinnedSidebarItemId === 'string' ? data.pinnedSidebarItemId : '';
      setPinnedSidebarItemId(nextPinned);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_pinned_sidebar_item`, nextPinned); } catch {}

      const nextInbox: InboxItem[] = Array.isArray(data.inboxItems) ? data.inboxItems : [];
      setInboxItems(nextInbox);
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_inbox`, JSON.stringify(nextInbox)); } catch {}

      if (Array.isArray(data.workflowStages) && data.workflowStages.length > 0) {
        setWorkflowStages(data.workflowStages);
        try {
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_workflow_stages`, JSON.stringify(data.workflowStages));
          localStorage.setItem('omnilife_task_workflow_stages', JSON.stringify(data.workflowStages));
        } catch {}
      }

      if (typeof data.currency === 'string' && data.currency) {
        setCurrencyState(data.currency);
        try { localStorage.setItem(`${LOCAL_STORAGE_KEY}_currency`, data.currency); } catch {}
      }

      if (data.theme === 'dark' || data.theme === 'light') {
        setThemeState(data.theme);
        try {
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_theme`, data.theme);
          localStorage.setItem('omniplan_theme', data.theme);
        } catch {}
      }

      if (data.themeStyle === 'bento') {
        setThemeStyleState(data.themeStyle);
        try {
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_theme_style`, data.themeStyle);
          localStorage.setItem('omniplan_theme_style', data.themeStyle);
        } catch {}
      }

      if (typeof data.accentTone === 'string' && data.accentTone) {
        setAccentToneState(data.accentTone as AccentTone);
        try {
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_accent_tone`, data.accentTone);
          localStorage.setItem('omniplan_accent_tone', data.accentTone);
        } catch {}
      }

      if (data.quoteLibrary && typeof data.quoteLibrary === 'object') {
        const applied = applyQuoteSyncData(data.quoteLibrary);
        setQuotes(applied.quotes);
        setFavoriteQuoteIds(applied.favoriteQuoteIds);
        setQuoteCategoriesRaw(applied.categoriesRaw);
        setDeletedQuoteIds(applied.deletedIds);
      } else {
        // Old backup without quoteLibrary: do not touch local quotes; only handle favoriteQuoteIds as before
        const nextFavQuotes: string[] = Array.isArray(data.favoriteQuoteIds)
          ? data.favoriteQuoteIds
          : [];
        setFavoriteQuoteIds(nextFavQuotes);
        try {
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_favorite_quotes`, JSON.stringify(nextFavQuotes));
          localStorage.setItem(QUOTE_FAVORITES_KEY, JSON.stringify(nextFavQuotes));
        } catch {}
      }

      setTimeout(() => {
        const refreshedHash = getDataHash();
        lastSyncedPayloadHashRef.current = refreshedHash;
        lastAutoSnapshotHashRef.current = refreshedHash;
        isApplyingLocalRestoreRef.current = false;
        isApplyingRemoteSyncRef.current = false;
      }, 250);

      return true;
    } catch (e) {
      console.error('Error replacing app data from backup:', e);
      isApplyingLocalRestoreRef.current = false;
      isApplyingRemoteSyncRef.current = false;
      return false;
    }
  };

  // Keep ref updated for immediate invocation from realtime listeners
  useEffect(() => {
    importBackupJSONRef.current = importBackupJSON;
  });

  // Phase 2 Google Drive Silent Re-Auth on Launch
  useEffect(() => {
    let active = true;
    silentReAuthGoogleDrive()
      .then(account => {
        if (!active || !account?.connected) return;
        try {
          const parsed = JSON.parse(compilePayloadRef.current());
          cachePayloadForBackgroundSync(parsed).catch(() => {});
        } catch {}
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Phase 4 Dropbox Silent Re-Auth on Launch
  useEffect(() => {
    let active = true;
    silentReAuthDropbox()
      .then(account => {
        if (!active || !account?.connected) return;
        try {
          const parsed = JSON.parse(compilePayloadRef.current());
          cacheDropboxPayloadForBackgroundSync(parsed).catch(() => {});
        } catch {}
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Phase 1 Offline Silent Auto-Snapshot (rotates snapshot-1.json .. snapshot-3.json on user changes)
  useEffect(() => {
    if (isAutoSnapshotMountRef.current) {
      isAutoSnapshotMountRef.current = false;
      lastAutoSnapshotHashRef.current = getDataHash();
      listLocalSnapshots()
        .then(existing => {
          if (existing.length === 0) {
            saveRotatingAutoSnapshot(compilePayloadRef.current()).catch(() => {});
          }
        })
        .catch(() => {});
      return;
    }
    if (isApplyingLocalRestoreRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        const currentHash = getDataHash();
        if (!currentHash || currentHash === lastAutoSnapshotHashRef.current) {
          return;
        }
        lastAutoSnapshotHashRef.current = currentHash;
        const compiled = compilePayloadRef.current();
        saveRotatingAutoSnapshot(compiled).catch(() => {});
        // Keep Android WorkManager background Drive & Dropbox sync payloads fresh
        try {
          const parsedPayload = JSON.parse(compiled);
          cachePayloadForBackgroundSync(parsedPayload).catch(() => {});
          cacheDropboxPayloadForBackgroundSync(parsedPayload).catch(() => {});
        } catch {}
      } catch {}
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [
    tasks,
    medications,
    doseLogs,
    habits,
    routines,
    goals,
    bills,
    hydration,
    profile.updatedAt,
    todoLists,
    listGroups,
    tags,
    scheduleItems,
    inboxItems,
    workflowStages,
    widgets,
    quotes,
    deletedQuoteIds,
    favoriteQuoteIds,
    quoteCategoriesRaw,
    appLock,
    currency,
    theme,
    themeStyle,
    accentTone,
    deletedIds,
  ]);

  const unreadNotificationsCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  const syncState = useMemo(
    () => ({
      status: syncStatus,
      lastSyncTime: lastSyncTime || '',
      pendingChanges: 0,
    }),
    [syncStatus, lastSyncTime]
  );

  const updateUserProfile = useCallback(
    (p: Partial<UserProfile>) =>
      setProfile(prev => {
        const next: UserProfile = {
          ...prev,
          ...p,
          updatedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
        };
        try {
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_profile`, JSON.stringify(next));
        } catch {}
        return next;
      }),
    []
  );

  return (
    <AppContext.Provider
      value={{
        theme,
        setTheme,
        themeStyle,
        setThemeStyle,
        accentTone,
        setAccentTone,
        activeTab,
        setActiveTab,
        inboxItems,
        addInboxItem,
        updateInboxItem,
        deleteInboxItem,
        toggleInboxItemComplete,
        convertInboxItemToTask,
        profile,
        setProfile,
        isLoggedIn: Boolean(firebaseUser || profile.identifier || joplinSyncSettings.primaryTarget !== 'none'),
        firebaseUser,
        authError,
        clearAuthError,
        login,
        loginWithGoogle,
        verify2FA,
        logout,
        medications,
        doseLogs,
        addMedication,
        updateMedication,
        deleteMedication,
        logDose,
        unlogDose,
        refillPills,
        hydration,
        addWater,
        setHydrationTarget,
        setHydrationPreferredUnit,
        setHydrationIntakePerClick,
        toggleWaterReminder,
        toggleAdaptiveWaterReminder,
        sendAdaptiveHydrationNotification,
        tasks,
        setTasks,
        listGroups,
        todoLists,
        selectedListId,
        setSelectedListId,
        addListGroup,
        updateListGroup,
        deleteListGroup,
        addTodoList,
        updateTodoList,
        deleteTodoList,
        addTask,
        batchAddTasks,
        updateTask,
        deleteTask,
        toggleTask,
        toggleStarTask,
        toggleSubtask,
        setTaskStatus,
        setTaskQuadrant,
        scheduleItems,
        scheduleStartHour,
        setScheduleStartHour,
        scheduleEndHour,
        setScheduleEndHour,
        addEarlierScheduleHour,
        removeEarlierScheduleHour,
        addLaterScheduleHour,
        removeLaterScheduleHour,
        setScheduleTimingPreset,
        addScheduleItem,
        updateScheduleItem,
        deleteScheduleItem,
        toggleScheduleItem,
        autoScheduleTasksForDate,
        goals,
        addGoal,
        updateGoal,
        deleteGoal,
        toggleGoalMilestone,
        linkTaskToGoal,
        projects,
        addProject,
        tags,
        addTag,
        updateTag,
        deleteTag,
        isEntitiesModalOpen,
        setIsEntitiesModalOpen,
        entitiesModalDefaultTab,
        openEntitiesModal,
        bills,
        addBill,
        updateBill,
        deleteBill,
        markBillPaid,
        unmarkBillPaid,
        pomodoro,
        taskTimers,
        pomodoroLogs,
        deletePomodoroLog,
        resetPomodoroLogs,
        startPomodoro,
        pausePomodoro,
        resetPomodoro,
        stopPomodoro,
        clearTaskTimer,
        switchPomodoroMode,
        setPomodoroDuration,
        completePomodoroSession,
        setPomodoroTask,
        incrementTaskPomodoro,
        decrementTaskPomodoro,
        getTaskTimerRemaining,
        habits,
        toggleHabitDay,
        addHabit,
        updateHabit,
        deleteHabit,
        updateHabitCounter,
        updateHabitSubSteps,
        routines,
        toggleRoutineItem,
        addRoutineItem,
        updateRoutineItem,
        deleteRoutineItem,
        addRoutine,
        updateRoutine,
        deleteRoutine,
        reorderRoutineItems,
        updateRoutineItemSubSteps,
        quotes,
        deletedQuoteIds,
        deletedIds,
        addQuote,
        addQuotes,
        updateQuote,
        deleteQuote,
        resetQuotesToDefault,
        favoriteQuoteIds,
        toggleFavoriteQuote,
        isQuoteFavorited,
        quoteCategories,
        quoteCategoriesRaw,
        addQuoteCategory,
        updateQuoteCategory,
        deleteQuoteCategory,
        resetQuoteCategoriesToDefault,
        getCategoryForQuote,
        workflowStages,
        setWorkflowStages,
        addWorkflowStage,
        updateWorkflowStage,
        deleteWorkflowStage,
        masterPassphrase,
        setMasterPassphrase,
        appLock,
        updateAppLock,
        lockAppNow,
        unlockApp,
        isAIChatOpen,
        setIsAIChatOpen,
        aiMessages,
        isAILoading,
        sendAIMessage,
        applyActionableItem,
        applyMultipleActionableItems,
        clearAIChat,
        verifyAIApiKey,
        widgets,
        toggleWidget,
        reorderWidgets,
        resetWidgets,
        pinnedSidebarItemId,
        setPinnedSidebarItemId,
        notifications,
        notificationHistory,
        alarmHistory,
        unreadNotificationsCount,
        pushNotification,
        markNotificationRead,
        dismissNotification,
        clearAllNotifications,
        clearNotificationHistory,
        recordAlarmHistory,
        clearAlarmHistory,
        isOnline,
        offlinePendingQueue,
        retryOfflineQueue,
        syncStatus,
        lastSyncTime,
        syncEmail,
        savedSyncEmails,
        setSyncEmail,
        addSyncEmail,
        removeSyncEmail,
        openSourceCloudConfig,
        updateOpenSourceCloudConfig,
        testOpenSourceCloudConnection,
        joplinSyncSettings,
        updateJoplinSyncSettings,
        updateDriveConfig,
        syncDriveNow,
        checkDriveConfiguration,
        pickLocalFolderForSync,
        connectDriveOAuth,
        isGDriveConnected,
        setGDriveManualToken,
        disconnectGDrive,
        syncWithCloud,
        createCloudBackup,
        restoreCloudBackup,
        exportEncryptedJSON,
        downloadLocalBackupFile,
        importBackupJSON,
        replaceAllAppDataFromBackup,
        isAuthModalOpen,
        setIsAuthModalOpen,
        isBackupModalOpen,
        setIsBackupModalOpen,
        isWidgetModalOpen,
        setIsWidgetModalOpen,
        isNotificationDrawerOpen,
        setIsNotificationDrawerOpen,
        isInstallModalOpen,
        setIsInstallModalOpen,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        toggleSidebar,
        soundEngine,
        haptics,
        lockApp: lockAppNow,
        syncState,
        triggerManualSync: syncWithCloud,
        currency,
        currencySymbol,
        setCurrency,
        formatCurrency,
        resetBillsToIndianDefaults,
        userProfile: profile,
        updateUserProfile,
        configureAppLock: updateAppLock,
        undoSnackbar,
        showUndoSnackbar,
        hideUndoSnackbar,
        triggerUndo,
        selectedDate,
        setSelectedDate,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

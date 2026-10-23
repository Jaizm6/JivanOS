import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookLock,
  Lock,
  Plus,
  Key,
  Star,
  Trash2,
  Edit3,
  Search,
  Tag,
  Calendar as CalendarIcon,
  Smile,
  ShieldCheck,
  Eye,
  EyeOff,
  Check,
  X,
  FileText,
  CalendarDays,
  ListFilter,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Download,
  Share2,
  ExternalLink,
  Copy,
  Sun,
  Sparkles,
  Fingerprint,
  KeyRound,
  Unlock,
  Heart,
  TrendingUp,
  BarChart3,
  Paintbrush,
  Brain,
  PenTool,
  ChevronDown,
  MoreHorizontal,
  Mic,
  Zap,
  Battery,
  BatteryCharging,
  Camera,
  Image as ImageIcon,
  Volume2,
  Bell,
  Paperclip,
  LayoutTemplate,
  CheckCircle2,
  Radio,
  Play,
  Pause,
  Square,
  Flame,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { JournalEntry, MoodType, CBTRecord } from '../../types';
import { encryptText, decryptText } from '../../utils/crypto';
import { NoteLockModal } from './NoteLockModal';
import { JournalReportSection } from './JournalReportSection';
import { JournalDrawingModal } from './JournalDrawingModal';
import { CBTThoughtModal } from './CBTThoughtModal';
import { ActivityManager } from '../common/ActivityManager';

export const JournalManager: React.FC = () => {
  const {
    journalEntries,
    addJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
    toggleFavoriteJournal,
    masterPassphrase,
    setMasterPassphrase,
    isJournalLocked,
    setIsJournalLocked,
    pushNotification,
    soundEngine,
    tasks,
    goals,
    habits,
  } = useApp();

  // View mode: 'calendar' | 'timeline' | 'affirmations' | 'reports'
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline' | 'affirmations' | 'reports'>('calendar');

  // Calendar state & appearance
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [calendarSize, setCalendarSize] = useState<'compact' | 'standard'>('standard');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Sync / Export Modal
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [copiedFeedUrl, setCopiedFeedUrl] = useState(false);

  // Note Lock & Unlock modal states
  const [unlockedNoteIds, setUnlockedNoteIds] = useState<Record<string, boolean>>({});
  const [lockModalTarget, setLockModalTarget] = useState<{
    entry: JournalEntry;
    mode: 'lock' | 'unlock';
  } | null>(null);

  // Common filters & states
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string>('all');
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState('');
  const [passphraseError, setPassphraseError] = useState('');

  // Editor form state
  const [journalFormStep, setJournalFormStep] = useState<1 | 2>(1);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<MoodType>('calm');
  const [energyLevel, setEnergyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [voiceNoteUrl, setVoiceNoteUrl] = useState<string | undefined>(undefined);
  const [voiceNoteDuration, setVoiceNoteDuration] = useState<number>(0);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [mediaRecorderObj, setMediaRecorderObj] = useState<MediaRecorder | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [tagsInput, setTagsInput] = useState('Reflection');
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [encryptThisEntry, setEncryptThisEntry] = useState(false);

  // 5 Color-coded energy options (1 to 5: Low to High)
  const ENERGY_OPTIONS: {
    level: 1 | 2 | 3 | 4 | 5;
    label: string;
    name: string;
    color: string;
    activeClass: string;
    badgeClass: string;
  }[] = [
    {
      level: 1,
      label: '1',
      name: 'Very Low',
      color: 'text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100',
      activeClass: 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-400 shadow-rose-500/30 shadow-xs font-black',
      badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800',
    },
    {
      level: 2,
      label: '2',
      name: 'Low',
      color: 'text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100',
      activeClass: 'bg-orange-500 text-white border-orange-500 ring-2 ring-orange-400 shadow-orange-500/30 shadow-xs font-black',
      badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-950/80 dark:text-orange-300 border border-orange-300 dark:border-orange-800',
    },
    {
      level: 3,
      label: '3',
      name: 'Moderate',
      color: 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100',
      activeClass: 'bg-amber-500 text-white border-amber-500 ring-2 ring-amber-400 shadow-amber-500/30 shadow-xs font-black',
      badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800',
    },
    {
      level: 4,
      label: '4',
      name: 'High',
      color: 'text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100',
      activeClass: 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-400 shadow-emerald-500/30 shadow-xs font-black',
      badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800',
    },
    {
      level: 5,
      label: '5',
      name: 'Peak',
      color: 'text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100',
      activeClass: 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-400 shadow-indigo-500/30 shadow-xs font-black',
      badgeClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800',
    },
  ];

  const parseEnergyLevel = (val: any): 1 | 2 | 3 | 4 | 5 => {
    if (val === 1 || val === '1' || val === 'exhausted') return 1;
    if (val === 2 || val === '2' || val === 'low') return 2;
    if (val === 3 || val === '3' || val === 'medium') return 3;
    if (val === 4 || val === '4' || val === 'high') return 4;
    if (val === 5 || val === '5' || val === 'very_high') return 5;
    return 3;
  };

  // Drawing & CBT Modal states
  const [showDrawingModal, setShowDrawingModal] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState<string | undefined>(undefined);
  const [showCBTModal, setShowCBTModal] = useState(false);
  const [isUniversalAddOpen, setIsUniversalAddOpen] = useState(false);
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  // Daily Affirmations state
  const DEFAULT_AFFIRMATIONS = [
    { id: 'aff_1', text: 'I am capable, resilient, and ready to make meaningful progress today.', category: 'Confidence', date: new Date().toISOString().split('T')[0], completedToday: false },
    { id: 'aff_2', text: 'I focus on what I can control and release the rest with calm energy.', category: 'Calm', date: new Date().toISOString().split('T')[0], completedToday: false },
    { id: 'aff_3', text: 'My potential is unlimited, and I trust my unique journey.', category: 'Growth', date: new Date().toISOString().split('T')[0], completedToday: false },
    { id: 'aff_4', text: 'I choose clarity, focus, and self-compassion in every decision.', category: 'Mindfulness', date: new Date().toISOString().split('T')[0], completedToday: false },
  ];

  const [affirmations, setAffirmations] = useState<Array<{ id: string; text: string; category?: string; date: string; completedToday?: boolean }>>(() => {
    const saved = localStorage.getItem('omni_journal_affirmations');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return DEFAULT_AFFIRMATIONS;
  });

  const [newAffirmationText, setNewAffirmationText] = useState('');

  useEffect(() => {
    localStorage.setItem('omni_journal_affirmations', JSON.stringify(affirmations));
  }, [affirmations]);

  // Recurring Reminder state
  const [reminderTime, setReminderTime] = useState<string>(() => {
    return localStorage.getItem('omni_journal_reminder_time') || '21:00';
  });
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(() => {
    return localStorage.getItem('omni_journal_reminder_enabled') === 'true';
  });
  const [showReminderModal, setShowReminderModal] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('omni_journal_reminder_time', reminderTime);
    localStorage.setItem('omni_journal_reminder_enabled', String(reminderEnabled));
  }, [reminderTime, reminderEnabled]);

  // System Tags collected across Tasks, Goals, and Habits
  const systemTags = useMemo(() => {
    const tagsSet = new Set<string>([
      'Reflection', 'Work', 'Personal', 'Health', 'Finance', 'Education', 'Errands', 'Gratitude', 'Focus'
    ]);
    tasks?.forEach(t => t.tags?.forEach(tag => tagsSet.add(tag)));
    goals?.forEach(g => g.category && tagsSet.add(g.category));
    habits?.forEach(h => h.category && tagsSet.add(h.category));
    return Array.from(tagsSet);
  }, [tasks, goals, habits]);

  // Clean, effective, natural templates without markdown symbol clutter (no ###, no **)
  const JOURNAL_TEMPLATES = [
    {
      id: 'focus_intentions',
      label: 'Focus & Priorities',
      title: 'Daily Focus & Priorities',
      content: `Daily Focus & Priorities\n\nCore Priority: \nKey Outcomes:\n1. \n2. \n3. \n\nMindset & Focus: `
    },
    {
      id: 'evening_review',
      label: 'Evening Review',
      title: 'Evening Review & Wins',
      content: `Evening Review\n\nAccomplishments: \nObstacles Handled: \nKey Insight: \nTomorrow Focus: `
    },
    {
      id: 'gratitude_perspective',
      label: 'Gratitude & Wins',
      title: 'Gratitude & Wins',
      content: `Gratitude & Wins\n\nMoments Appreciated Today: \nPeople or Interactions Valued: \nGrowth or Win Note: `
    },
    {
      id: 'braindump',
      label: 'Brain Dump',
      title: 'Thoughts & Action Items',
      content: `Brain Dump\n\nNotes & Thoughts:\n- \n\nAction Items:\n- `
    },
    {
      id: 'cbt',
      label: 'Cognitive Reframing',
      title: 'Cognitive Reframing',
      content: `Cognitive Reframing\n\nSituation: \nAutomatic Thought: \nObjective Facts: \nBalanced Perspective: \nNext Step: `
    },
    {
      id: 'weekly_alignment',
      label: 'Weekly Review',
      title: 'Weekly Review & Alignment',
      content: `Weekly Review\n\nMajor Highlights: \nCore Lesson: \nHabit Consistency: \nNext Week Focus: `
    }
  ];

  // Decrypted contents cache (entryId -> decrypted text)
  const [decryptedCache, setDecryptedCache] = useState<Record<string, string>>({});

  // Quick Gratitude state
  const [quickGratitudeInput, setQuickGratitudeInput] = useState('');

  // Auto-select first entry if none selected in timeline mode
  useEffect(() => {
    if (!selectedEntryId && journalEntries.length > 0) {
      setSelectedEntryId(journalEntries[0].id);
    }
  }, [journalEntries, selectedEntryId]);

  const moods: { type: MoodType; emoji: string; label: string; score: number }[] = [
    { type: 'great', emoji: '🤩', label: 'Great', score: 5 },
    { type: 'good', emoji: '😊', label: 'Good', score: 4 },
    { type: 'okay', emoji: '😐', label: 'Okay', score: 3 },
    { type: 'bad', emoji: '😔', label: 'Bad', score: 2 },
    { type: 'awful', emoji: '😢', label: 'Awful', score: 1 },
    { type: 'ecstatic', emoji: '🤩', label: 'Ecstatic', score: 5 },
    { type: 'calm', emoji: '😌', label: 'Calm', score: 4 },
    { type: 'anxious', emoji: '😰', label: 'Anxious', score: 2 },
    { type: 'down', emoji: '😔', label: 'Down', score: 2 },
  ];

  const primaryMoods = moods.slice(0, 5);

  // Quick Mood Log handler for selectedCalendarDate
  const handleQuickMoodLog = (moodType: MoodType) => {
    const existing = journalEntries.find(
      e => (e.date || e.createdAt.split('T')[0]) === selectedCalendarDate
    );
    if (existing) {
      updateJournalEntry({
        ...existing,
        mood: moodType,
      });
      soundEngine.playSuccessChime();
      pushNotification('Mood Logged', `Updated mood to ${moodType} for ${selectedCalendarDate}`, 'journal');
    } else {
      addJournalEntry({
        title: `Reflection - ${new Date(selectedCalendarDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        content: '',
        mood: moodType,
        tags: ['DailyMood'],
        date: selectedCalendarDate,
        isEncrypted: false,
      });
      soundEngine.playSuccessChime();
      pushNotification('Mood Logged', `Recorded mood as ${moodType} for ${selectedCalendarDate}`, 'journal');
    }
  };

  // Add gratitude item to selected date
  const handleAddGratitude = () => {
    if (!quickGratitudeInput.trim()) return;
    const text = quickGratitudeInput.trim();
    const existing = journalEntries.find(
      e => (e.date || e.createdAt.split('T')[0]) === selectedCalendarDate
    );
    if (existing) {
      const currentList = existing.gratitudeList || [];
      updateJournalEntry({
        ...existing,
        gratitudeList: [...currentList, text],
      });
    } else {
      addJournalEntry({
        title: `Gratitude & Reflection - ${selectedCalendarDate}`,
        content: '',
        mood: 'good',
        tags: ['Gratitude'],
        date: selectedCalendarDate,
        gratitudeList: [text],
        isEncrypted: false,
      });
    }
    setQuickGratitudeInput('');
    soundEngine.playSuccessChime();
  };

  // Remove gratitude item from an entry
  const handleRemoveGratitude = (entryId: string, itemIdx: number) => {
    const entry = journalEntries.find(e => e.id === entryId);
    if (entry && entry.gratitudeList) {
      const updated = entry.gratitudeList.filter((_, idx) => idx !== itemIdx);
      updateJournalEntry({
        ...entry,
        gratitudeList: updated,
      });
    }
  };

  // Mood Statistics calculations
  const moodStats = useMemo(() => {
    const entriesWithMood = journalEntries.filter(e => !!e.mood);
    if (entriesWithMood.length === 0) {
      return { avgScore: 4.0, totalLogged: 0, breakdown: [] };
    }
    let totalScore = 0;
    const counts: Record<string, number> = { great: 0, good: 0, okay: 0, bad: 0, awful: 0 };

    entriesWithMood.forEach(e => {
      const mObj = moods.find(m => m.type === e.mood);
      totalScore += mObj ? mObj.score : 3;
      const normalizedType =
        e.mood === 'ecstatic' ? 'great' :
        e.mood === 'calm' ? 'good' :
        e.mood === 'anxious' || e.mood === 'down' ? 'bad' :
        e.mood;
      if (counts[normalizedType] !== undefined) {
        counts[normalizedType]++;
      }
    });

    const avgScore = Number((totalScore / entriesWithMood.length).toFixed(1));
    const breakdown = [
      { type: 'great', label: 'Great', emoji: '🤩', count: counts['great'] },
      { type: 'good', label: 'Good', emoji: '😊', count: counts['good'] },
      { type: 'okay', label: 'Okay', emoji: '😐', count: counts['okay'] },
      { type: 'bad', label: 'Bad', emoji: '😔', count: counts['bad'] },
      { type: 'awful', label: 'Awful', emoji: '😢', count: counts['awful'] },
    ];

    return { avgScore, totalLogged: entriesWithMood.length, breakdown };
  }, [journalEntries]);

  // Passphrase Unlock / Setup
  const handlePassphraseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphraseInput.trim()) return;

    try {
      setMasterPassphrase(passphraseInput.trim());
      setIsJournalLocked(false);
      setShowPassphraseModal(false);
      setPassphraseError('');
      pushNotification('Vault Unlocked', 'End-to-end encrypted journal decrypted.', 'journal');

      // Attempt decrypting all encrypted entries with this key
      const newCache: Record<string, string> = {};
      for (const entry of journalEntries) {
        if (entry.isEncrypted && entry.cipherText && entry.iv && entry.salt) {
          try {
            const dec = await decryptText(
              { cipherText: entry.cipherText, iv: entry.iv, salt: entry.salt },
              passphraseInput.trim()
            );
            newCache[entry.id] = dec;
          } catch {
            // Decryption failure for that entry
          }
        }
      }
      setDecryptedCache(prev => ({ ...prev, ...newCache }));
    } catch {
      setPassphraseError('Invalid passphrase. Unable to unlock.');
    }
  };

  const handleLockVault = () => {
    setIsJournalLocked(true);
    setDecryptedCache({});
    pushNotification('Vault Locked', 'Journal entries are securely encrypted in memory.', 'journal');
  };

  const openNewEntry = (
    presetDate?: string,
    templateType?: 'morning' | 'evening' | 'positive' | 'cbt' | 'reflection' | 'freeform',
    customTitle?: string,
    customContent?: string,
    startVoiceImmediately: boolean = false
  ) => {
    setEditId(null);
    setCurrentDrawing(undefined);
    setTitle(customTitle || '');
    setContent(customContent || '');
    setMood('calm');
    setEnergyLevel(3);
    setTagsInput(templateType ? `Reflection, ${templateType.toUpperCase()}` : 'Reflection, Focus');
    setEntryDate(presetDate || selectedCalendarDate || new Date().toISOString().split('T')[0]);
    setEncryptThisEntry(false);
    setShowEditorModal(true);
  };


  // CBT Reframing Save handler (Screenshot 5)
  const handleSaveCBT = (cbtData: {
    title: string;
    content: string;
    cbtRecord: CBTRecord;
    mood: MoodType;
    tags: string[];
    date: string;
  }) => {
    addJournalEntry({
      title: cbtData.title,
      content: cbtData.content,
      cbtRecord: cbtData.cbtRecord,
      mood: cbtData.mood,
      tags: cbtData.tags,
      date: cbtData.date,
      templateType: 'cbt',
      isEncrypted: false,
    });
    pushNotification('CBT Record Saved', 'Negative situation reframed successfully.', 'journal');
  };

  // Permanent Decryption Handler (replaces encrypted cipher with plaintext)
  const handlePermanentlyDecrypt = (entry: JournalEntry) => {
    const plain = decryptedCache[entry.id] || entry.content;
    if (!plain || plain.startsWith('🔒 [AES-256 Encrypted')) {
      setShowPassphraseModal(true);
      setPassphraseError('Unlock vault first before decrypting this entry.');
      return;
    }
    updateJournalEntry({
      ...entry,
      isEncrypted: false,
      isLocked: false,
      content: plain,
      cipherText: undefined,
      iv: undefined,
      salt: undefined,
    });
    pushNotification('Note Decrypted', `"${entry.title}" is now permanently unencrypted.`, 'journal');
  };

  // Note Lock Handlers (PIN, Passcode, Fingerprint)
  const handleConfirmNoteLock = (
    entryId: string,
    lockType: 'pin' | 'passcode' | 'biometric',
    passcode?: string
  ) => {
    const target = journalEntries.find(e => e.id === entryId);
    if (!target) return;
    updateJournalEntry({
      ...target,
      isLocked: true,
      lockType,
      itemPasscode: passcode,
    });
    setUnlockedNoteIds(prev => ({ ...prev, [entryId]: false }));
    pushNotification('Note Protected', `"${target.title}" is locked with ${lockType}.`, 'journal');
  };

  const handleSuccessNoteUnlock = (entryId: string) => {
    setUnlockedNoteIds(prev => ({ ...prev, [entryId]: true }));
    pushNotification('Note Unlocked', 'Private note unlocked for this session.', 'journal');
  };

  const handleRemoveNoteLock = (entry: JournalEntry) => {
    updateJournalEntry({
      ...entry,
      isLocked: false,
      lockType: undefined,
      itemPasscode: undefined,
    });
    setUnlockedNoteIds(prev => {
      const copy = { ...prev };
      delete copy[entry.id];
      return copy;
    });
    pushNotification('Lock Removed', `"${entry.title}" is now unlocked.`, 'journal');
  };

  const handleOpenNewEntry = (defaultTitle = '', defaultContent = '') => {
    setEditId(null);
    setJournalFormStep(1);
    setTitle(defaultTitle || '');
    setContent(defaultContent || '');
    setMood('calm');
    setEnergyLevel(3);
    setVoiceNoteUrl(undefined);
    setVoiceNoteDuration(0);
    setPhotoUrls([]);
    setTagsInput('Reflection');
    setEntryDate(selectedCalendarDate || new Date().toISOString().split('T')[0]);
    setEncryptThisEntry(false);
    setCurrentDrawing(undefined);
    setSelectedTemplate('');
    setShowEditorModal(true);
  };

  const openEditEntry = (entry: JournalEntry) => {
    setEditId(entry.id);
    setJournalFormStep(2);
    setTitle(entry.title);
    const text = entry.isEncrypted ? decryptedCache[entry.id] || entry.content : entry.content;
    setContent(text);
    setMood(entry.mood);
    setEnergyLevel(parseEnergyLevel(entry.energyLevel));
    setVoiceNoteUrl(entry.voiceNoteUrl);
    setVoiceNoteDuration(entry.voiceNoteDuration || 0);
    setPhotoUrls(entry.photoUrls || []);
    setTagsInput(entry.tags.join(', '));
    setEntryDate(entry.date || entry.createdAt.split('T')[0]);
    setEncryptThisEntry(entry.isEncrypted);
    setCurrentDrawing(entry.drawingUrl);
    setSelectedTemplate('');
    setShowEditorModal(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setPhotoUrls(prev => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startAudioRecording = async () => {
    setMicPermissionDenied(false);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone API not supported in this browser environment');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          setVoiceNoteUrl(result);
          soundEngine?.playSuccessChime?.();
          pushNotification('Voice Note Attached', 'Your live voice recording has been attached.', 'journal');
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorderObj(recorder);
      setIsRecordingAudio(true);
      setRecordingSeconds(0);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Microphone access notice:', err?.message || err);
      setIsRecordingAudio(false);
      setMicPermissionDenied(true);
    }
  };

  const handleGenerateDemoAudioNote = () => {
    const demoAudioBase64 = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    setVoiceNoteUrl(demoAudioBase64);
    setMicPermissionDenied(false);
    soundEngine?.playSuccessChime?.();
    pushNotification('Demo Voice Note Attached', 'Sample voice note attached successfully.', 'journal');
  };

  const stopAudioRecording = () => {
    if (mediaRecorderObj && isRecordingAudio) {
      mediaRecorderObj.stop();
      setIsRecordingAudio(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  const formatAudioTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setVoiceNoteUrl(result);
        setVoiceNoteDuration(15);
        soundEngine?.playSuccessChime?.();
        pushNotification('Voice Note Attached', 'Voice note added to entry.', 'journal');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const tmpl = JOURNAL_TEMPLATES.find(t => t.id === templateId);
    if (!tmpl) return;

    if (!title.trim() || title === 'Reflection') {
      setTitle(tmpl.title);
    }
    if (!content.trim()) {
      setContent(tmpl.content);
    } else {
      setContent(prev => prev + '\n\n' + tmpl.content);
    }
    soundEngine?.playClick?.();
  };

  const handleToggleAffirmation = (id: string) => {
    setAffirmations(prev => prev.map(a => a.id === id ? { ...a, completedToday: !a.completedToday } : a));
    soundEngine?.playSuccessChime?.();
  };

  const handleAddAffirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAffirmationText.trim()) return;
    const newAff = {
      id: `aff_${Date.now()}`,
      text: newAffirmationText.trim(),
      category: 'Personal',
      date: new Date().toISOString().split('T')[0],
      completedToday: false,
    };
    setAffirmations(prev => [newAff, ...prev]);
    setNewAffirmationText('');
    soundEngine?.playSuccessChime?.();
    pushNotification('Affirmation Added', 'New daily affirmation created.', 'journal');
  };

  const handleLogAffirmationAsJournalNote = (affText: string) => {
    handleOpenNewEntry(
      `Affirmation: ${affText.slice(0, 32)}...`,
      `Daily Affirmation Reflection\n"${affText}"\n\nHow I am embodying this today:\n`
    );
    setJournalFormStep(2);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setJournalFormStep(1);
      return;
    }

    const parsedTags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const targetDate = entryDate || new Date().toISOString().split('T')[0];

    let cipherText: string | undefined;
    let iv: string | undefined;
    let salt: string | undefined;
    const isEncrypted = encryptThisEntry;

    if (isEncrypted) {
      if (!masterPassphrase) {
        setShowPassphraseModal(true);
        setPassphraseError('You must set a master passphrase before creating encrypted entries.');
        return;
      }
      try {
        const encrypted = await encryptText(content, masterPassphrase);
        cipherText = encrypted.cipherText;
        iv = encrypted.iv;
        salt = encrypted.salt;
      } catch (err) {
        console.error('Encryption failed:', err);
        return;
      }
    }

    if (editId) {
      const existing = journalEntries.find(j => j.id === editId);
      if (!existing) return;

      updateJournalEntry({
        ...existing,
        title: title.trim(),
        content: isEncrypted ? '🔒 [AES-256 Encrypted Private Entry]' : content,
        mood,
        energyLevel,
        voiceNoteUrl,
        voiceNoteDuration,
        photoUrls,
        tags: parsedTags,
        date: targetDate,
        drawingUrl: currentDrawing,
        isEncrypted,
        cipherText,
        iv,
        salt,
      });

      if (isEncrypted) {
        setDecryptedCache(prev => ({ ...prev, [editId]: content }));
      }
    } else {
      const newId = `entry_${Date.now()}`;
      addJournalEntry({
        title: title.trim(),
        content: isEncrypted ? '🔒 [AES-256 Encrypted Private Entry]' : content,
        mood,
        energyLevel,
        voiceNoteUrl,
        voiceNoteDuration,
        photoUrls,
        tags: parsedTags,
        date: targetDate,
        drawingUrl: currentDrawing,
        isEncrypted,
        cipherText,
        iv,
        salt,
      });
      if (isEncrypted) {
        setDecryptedCache(prev => ({ ...prev, [newId]: content }));
      }
    }

    setShowEditorModal(false);
  };

  // Group entries by date
  const entriesByDate = useMemo(() => {
    const map: Record<string, JournalEntry[]> = {};
    for (const entry of journalEntries) {
      const d = entry.date || entry.createdAt.split('T')[0];
      if (!map[d]) map[d] = [];
      map[d].push(entry);
    }
    return map;
  }, [journalEntries]);

  // Selected Day's entries
  const selectedDayEntries = useMemo(() => {
    return entriesByDate[selectedCalendarDate] || [];
  }, [entriesByDate, selectedCalendarDate]);

  // Calendar calculations
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth(); // 0-11
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays = useMemo(() => {
    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean }[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // Padding for previous month
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({ dateStr: dStr, dayNum, isCurrentMonth: false, isToday: dStr === todayStr });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dateStr: dStr, dayNum: d, isCurrentMonth: true, isToday: dStr === todayStr });
    }

    // Trailing days for grid completion (multiple of 7)
    const totalCells = Math.ceil(days.length / 7) * 7;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dateStr: dStr, dayNum: d, isCurrentMonth: false, isToday: dStr === todayStr });
    }

    return days;
  }, [year, month, firstDayOfMonth, daysInMonth, daysInPrevMonth]);

  const handlePrevMonth = () => {
    setCalendarMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(new Date(year, month + 1, 1));
  };

  const handleJumpToday = () => {
    const today = new Date();
    setCalendarMonth(today);
    setSelectedCalendarDate(today.toISOString().split('T')[0]);
  };

  // Export .ICS calendar file for Google Calendar, Notion Calendar, Apple Calendar
  const handleDownloadIcs = () => {
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//OmniLifeOS//Journal Calendar v2.0//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:OmniLifeOS Journal & Reflections',
      'X-WR-TIMEZONE:UTC',
    ];

    journalEntries.forEach(entry => {
      const cleanDate = (entry.date || entry.createdAt.split('T')[0]).replace(/-/g, '');
      const dtStart = `${cleanDate}T080000Z`;
      const dtEnd = `${cleanDate}T083000Z`;
      const text = entry.isEncrypted
        ? decryptedCache[entry.id] || '[AES-256 Encrypted Private Reflection]'
        : entry.content;
      const sanitizedDesc = text.replace(/[\r\n]+/g, ' ').replace(/,/g, '\\,').slice(0, 300);

      lines.push(
        'BEGIN:VEVENT',
        `UID:journal-${entry.id}@omnilifeos.app`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:[Journal] ${entry.title.replace(/,/g, '\\,')} (${entry.mood})`,
        `DESCRIPTION:${sanitizedDesc}`,
        `CATEGORIES:Journal,Reflection,${entry.tags.join(',')}`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      );
    });

    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `OmniLifeOS_Journal_Calendar_${new Date().toISOString().split('T')[0]}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    pushNotification('Calendar Exported', 'Downloaded .ics file ready for Google or Notion Calendar.', 'calendar');
  };

  // 1-Click Open in Google Calendar
  const handleOpenGoogleCalendar = (entry?: JournalEntry) => {
    const target = entry || journalEntries[0];
    if (!target) return;
    const dateStr = (target.date || target.createdAt.split('T')[0]).replace(/-/g, '');
    const titleParam = encodeURIComponent(`[Journal] ${target.title}`);
    const detailsParam = encodeURIComponent(
      `Daily Reflection from OmniLifeOS\nMood: ${target.mood}\nTags: ${target.tags.join(', ')}`
    );
    const gCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titleParam}&dates=${dateStr}T090000Z/${dateStr}T093000Z&details=${detailsParam}`;
    window.open(gCalUrl, '_blank', 'noopener,noreferrer');
  };

  // Filtered entries for timeline view
  const allTags = Array.from(new Set(journalEntries.flatMap(e => e.tags)));
  const filteredEntries = journalEntries.filter(entry => {
    const matchesSearch =
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTag = selectedTag === 'all' || entry.tags.includes(selectedTag);
    const matchesMood = selectedMoodFilter === 'all' || entry.mood === selectedMoodFilter;
    return matchesSearch && matchesTag && matchesMood;
  });

  const selectedEntry = journalEntries.find(e => e.id === selectedEntryId);

  return (
    <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-200 pb-4">
      {/* 1. Primary Personal Journal Card with ONLY '+' write button in top right corner */}
      <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-2xs">
            <BookLock className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                Personal Journal
              </h2>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 shrink-0">
                <ShieldCheck className="w-3 h-3" />
                <span>Private</span>
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-normal leading-tight truncate">
              Daily thoughts, reflections, and notes
            </p>
          </div>
        </div>

        {/* Top-Right Corner: ONLY '+' Icon Button */}
        <button
          id="btn-journal-write-top-right"
          type="button"
          onClick={() => handleOpenNewEntry()}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white flex items-center justify-center shadow-2xs cursor-pointer transition shrink-0"
          title="New Journal Reflection"
          aria-label="New Journal Reflection"
        >
          <Plus className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.8]" />
        </button>
      </div>

      {/* 2. Separate Card for Navigation Views, Reminders & Tools */}
      <div className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 relative z-30">
        {/* View Mode Switcher Tabs (Icon-Only: Merged Calendar/Timeline, Affirmations Sparkles, Reports) */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold shrink-0">
          {/* Merged Calendar & Timeline Icon Button */}
          <button
            type="button"
            id="btn-view-calendar-timeline"
            onClick={() => {
              if (viewMode === 'calendar') {
                setViewMode('timeline');
              } else if (viewMode === 'timeline') {
                setViewMode('calendar');
              } else {
                setViewMode('calendar');
              }
              soundEngine?.playClick?.();
            }}
            className={`flex items-center justify-center p-2 rounded-lg transition cursor-pointer ${
              viewMode === 'calendar' || viewMode === 'timeline'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-750'
            }`}
            title={
              viewMode === 'timeline'
                ? 'Timeline Mode (Click to switch to Calendar)'
                : 'Calendar Mode (Click to switch to Timeline)'
            }
            aria-label="Calendar and Timeline"
          >
            {viewMode === 'timeline' ? (
              <ListFilter className="w-4 h-4 stroke-[2.2]" />
            ) : (
              <CalendarDays className="w-4 h-4 stroke-[2.2]" />
            )}
          </button>

          {/* Daily Affirmations Icon Button (Sun Icon) */}
          <button
            type="button"
            id="btn-view-affirmations"
            onClick={() => {
              setViewMode('affirmations');
              soundEngine?.playClick?.();
            }}
            className={`flex items-center justify-center p-2 rounded-lg transition cursor-pointer ${
              viewMode === 'affirmations'
                ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-2xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-750'
            }`}
            title="Daily Mindset Affirmations"
            aria-label="Daily Mindset Affirmations"
          >
            <Sun className="w-4 h-4 stroke-[2.2] text-amber-500" />
          </button>

          {/* Reports & Analytics Icon Button */}
          <button
            type="button"
            id="btn-view-reports"
            onClick={() => {
              setViewMode('reports');
              soundEngine?.playClick?.();
            }}
            className={`flex items-center justify-center p-2 rounded-lg transition cursor-pointer ${
              viewMode === 'reports'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-750'
            }`}
            title="Reports & Analytics"
            aria-label="Reports and Analytics"
          >
            <BarChart3 className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>

        {/* Tools and Reminders Group */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {/* Direct Reminder Button (Icon + Time only, no 'Reminder' title) */}
          <button
            id="btn-journal-top-reminder"
            type="button"
            onClick={() => setShowReminderModal(true)}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl border flex items-center gap-1.5 shadow-2xs cursor-pointer transition active:scale-95 ${
              reminderEnabled
                ? 'bg-amber-50 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 font-bold'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-amber-600 hover:border-amber-300'
            }`}
            title={reminderEnabled ? `Reminder: ${reminderTime}` : 'Set Daily Reminder'}
            aria-label={reminderEnabled ? `Reminder: ${reminderTime}` : 'Set Daily Reminder'}
          >
            <Bell className={`w-3.5 h-3.5 ${reminderEnabled ? 'text-amber-600 dark:text-amber-400 fill-amber-500/20' : 'text-slate-500 dark:text-slate-400'}`} />
            {reminderEnabled && <span className="font-mono text-xs">{reminderTime}</span>}
          </button>

          {/* Calendar Sync Button */}
          <button
            id="btn-journal-sync"
            type="button"
            onClick={() => setShowSyncModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition shadow-2xs cursor-pointer active:scale-95"
            title="Google Calendar & Sync"
            aria-label="Google Calendar & Sync"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* COMBINED MOOD TRACKER & MOOD ANALYTICS BAR (Compact & 1-row layout) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-2.5 sm:p-3 shadow-2xs space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Smile className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <h3 className="font-bold text-slate-900 dark:text-white text-xs truncate">
              Daily Mood Log ({selectedCalendarDate === new Date().toISOString().split('T')[0] ? 'Today' : selectedCalendarDate})
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-medium shrink-0">
            Avg: <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold">⭐ {moodStats.avgScore}</strong> ({moodStats.totalLogged} logged)
          </span>
        </div>

        {/* 5-Tier Emoji Mood Buttons in exactly 1 ROW */}
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5 w-full">
          {primaryMoods.map(m => {
            const dateEntry = journalEntries.find(
              e => (e.date || e.createdAt.split('T')[0]) === selectedCalendarDate
            );
            const isSelectedMood = dateEntry?.mood === m.type;

            return (
              <button
                key={m.type}
                type="button"
                onClick={() => handleQuickMoodLog(m.type)}
                className={`flex items-center justify-center gap-0.5 sm:gap-1 px-1 py-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-[10px] sm:text-xs font-bold transition-all active:scale-95 min-w-0 w-full cursor-pointer ${
                  isSelectedMood
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30 shadow-2xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-amber-300 text-slate-700 dark:text-slate-300 bg-slate-50/60 dark:bg-slate-800/40'
                }`}
              >
                <span className="text-xs sm:text-sm shrink-0">{m.emoji}</span>
                <span className="truncate">{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mood Stats Mini Bar */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-1.5 text-[10px] sm:text-xs text-slate-500">
          <div className="flex items-center gap-2 sm:gap-3">
            <span>
              Avg: <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold">⭐ {moodStats.avgScore}</strong>
            </span>
            <span>
              Logged: <strong className="text-slate-800 dark:text-slate-200 font-mono font-bold">{moodStats.totalLogged}d</strong>
            </span>
          </div>

          {/* Mini 5-bar distribution */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {moodStats.breakdown.map(b => (
              <div
                key={b.type}
                title={`${b.label}: ${b.count} entries`}
                className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[9px] sm:text-[10px] font-semibold text-slate-600 dark:text-slate-300"
              >
                <span>{b.emoji}</span>
                <span className="font-mono">{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* VIEW MODE 1: CALENDAR VIEW */}
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Calendar Grid (6 cols) */}
          <div className="lg:col-span-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-3.5">
            {/* Calendar Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  {monthNames[month]} {year}
                </span>
                <button
                  onClick={handleJumpToday}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"
                >
                  Today
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Compact / Normal Size Switcher */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevMonth}
                    aria-label="Previous Month"
                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    aria-label="Next Month"
                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('timeline');
                      soundEngine?.playClick?.();
                    }}
                    title="Switch to Timeline list view"
                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer ml-1"
                  >
                    <ListFilter className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Weekday Names (Clean, single-letter, zero font leaking) */}
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span>S</span>
              <span>M</span>
              <span>T</span>
              <span>W</span>
              <span>T</span>
              <span>F</span>
              <span>S</span>
            </div>

            {/* Days Grid (aspect-square leak-free layout) */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {calendarDays.map((day, idx) => {
                const dayEntries = entriesByDate[day.dateStr] || [];
                const isSelected = selectedCalendarDate === day.dateStr;
                const hasEntries = dayEntries.length > 0;
                const dominantMood = hasEntries ? dayEntries[0].mood : null;
                const moodObj = moods.find(m => m.type === dominantMood);
                const isFavorited = dayEntries.some(e => e.isFavorite);

                return (
                  <button
                    key={`journal-day-${day.dateStr}-${idx}`}
                    type="button"
                    onClick={() => setSelectedCalendarDate(day.dateStr)}
                    className={`${calendarSize === 'compact' ? 'aspect-square p-0.5' : 'aspect-square p-2'} w-full rounded-2xl flex flex-col items-center justify-center relative border transition-all ${
                      isSelected
                        ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/60 font-bold'
                        : hasEntries
                        ? 'border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 hover:border-indigo-400'
                        : 'border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                    } ${!day.isCurrentMonth ? 'opacity-30' : ''}`}
                  >
                    <span
                      className={`${calendarSize === 'compact' ? 'text-[10px] w-5 h-5' : 'text-xs sm:text-sm w-6 h-6'} font-semibold rounded-full flex items-center justify-center ${
                        day.isToday
                          ? 'bg-indigo-600 text-white font-bold shadow-xs'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {day.dayNum}
                    </span>

                    <div className={`flex items-center justify-center mt-0.5 ${calendarSize === 'compact' ? 'h-3' : 'h-4'}`}>
                      {hasEntries ? (
                        <span className={`${calendarSize === 'compact' ? 'text-xs' : 'text-sm'} leading-none`}>{moodObj?.emoji || '📝'}</span>
                      ) : (
                        <span className="w-1 h-1 rounded-full bg-transparent" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Calendar Footer Legend */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <span>Today</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs">😊</span>
                  <span>Daily Mood</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <span>Starred</span>
                </div>
              </div>
              <span className="font-mono text-[11px]">{journalEntries.length} total reflections</span>
            </div>
          </div>

          {/* Selected Date Detail Panel (6 cols) */}
          <div className="lg:col-span-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-indigo-500" />
                    <span>
                      {new Date(selectedCalendarDate + 'T00:00:00').toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedDayEntries.length} reflection{selectedDayEntries.length === 1 ? '' : 's'} recorded
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openNewEntry(selectedCalendarDate)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Write</span>
                  </button>
                </div>
              </div>

              {/* Compact Gratitude Section */}
              <div className="p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs font-bold text-indigo-900 dark:text-indigo-300 shrink-0">
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                    <span>Gratitude:</span>
                  </span>
                  <div className="flex-1 flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Add something you are grateful for today..."
                      value={quickGratitudeInput}
                      onChange={e => setQuickGratitudeInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddGratitude();
                        }
                      }}
                      className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddGratitude}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs cursor-pointer shrink-0"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Gratitude Chips from selected day entries */}
                {selectedDayEntries.some(e => e.gratitudeList && e.gratitudeList.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {selectedDayEntries.map(entry =>
                      (entry.gratitudeList || []).map((item, idx) => (
                        <span
                          key={`${entry.id}_grat_${idx}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        >
                          <span>{item}</span>
                          <button
                            onClick={() => handleRemoveGratitude(entry.id, idx)}
                            className="text-slate-400 hover:text-rose-500 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Day's Entries List */}
              <div className="space-y-3 mt-4 max-h-[460px] overflow-y-auto pr-1">
                {selectedDayEntries.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 mx-auto flex items-center justify-center">
                      <FileText className="w-6 h-6 opacity-60" />
                    </div>
                    <p className="text-xs text-slate-500">No reflections recorded for this date.</p>
                    <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                      <button
                        onClick={() => openNewEntry(selectedCalendarDate)}
                        className="px-3.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition"
                      >
                        + Write for this day
                      </button>
                    </div>
                  </div>
                ) : (
                  selectedDayEntries.map(entry => {
                    const moodObj = moods.find(m => m.type === entry.mood);
                    const isNoteLocked = entry.isLocked && !unlockedNoteIds[entry.id];
                    const isDecrypted = !entry.isEncrypted || !!decryptedCache[entry.id];
                    const displayText = isNoteLocked
                      ? null
                      : entry.isEncrypted
                      ? decryptedCache[entry.id] || '🔒 [AES-256 Encrypted. Click to Unlock.]'
                      : entry.content;

                    return (
                      <div
                        key={entry.id}
                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5 transition hover:border-indigo-300 dark:hover:border-indigo-700"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-lg">{moodObj?.emoji || '📝'}</span>
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {entry.title}
                            </h4>
                            {entry.energyLevel && (() => {
                              const lvl = parseEnergyLevel(entry.energyLevel);
                              const opt = ENERGY_OPTIONS.find(o => o.level === lvl);
                              return (
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${opt?.badgeClass || 'bg-slate-100 text-slate-700'}`}>
                                  ⚡ {lvl}/5
                                </span>
                              );
                            })()}
                            {entry.isLocked && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center gap-0.5">
                                <Lock className="w-2.5 h-2.5" />
                                <span>{entry.lockType || 'Locked'}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Star */}
                            <button
                              onClick={() => toggleFavoriteJournal(entry.id)}
                              aria-label="Star reflection"
                              className="p-1 text-slate-400 hover:text-amber-500"
                            >
                              <Star
                                className={`w-3.5 h-3.5 ${
                                  entry.isFavorite ? 'text-amber-500 fill-amber-500' : ''
                                }`}
                              />
                            </button>

                            {/* Edit */}
                            {!isNoteLocked && (
                              <button
                                onClick={() => openEditEntry(entry)}
                                aria-label="Edit reflection"
                                className="p-1 text-slate-400 hover:text-indigo-600"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              onClick={() => deleteJournalEntry(entry.id)}
                              aria-label="Delete reflection"
                              className="p-1 text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Note locked placeholder vs. Content */}
                        {isNoteLocked ? (
                          <div className="p-3 rounded-xl border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                              {entry.lockType === 'biometric' ? (
                                <Fingerprint className="w-4 h-4 text-amber-600" />
                              ) : (
                                <KeyRound className="w-4 h-4 text-amber-600" />
                              )}
                              <span>Locked note ({entry.lockType || 'Private'})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setLockModalTarget({ entry, mode: 'unlock' })}
                              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] transition"
                            >
                              Unlock
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-4 leading-relaxed font-sans whitespace-pre-wrap">
                              {displayText}
                            </p>

                            {/* Attached Drawing thumbnail (Screenshot 3) */}
                            {entry.drawingUrl && (
                              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white p-1 max-w-[200px] shadow-2xs">
                                <img
                                  src={entry.drawingUrl}
                                  alt="Attached doodle"
                                  className="w-full h-auto rounded-lg object-contain max-h-32"
                                />
                              </div>
                            )}

                            {/* CBT Insight pill if present (Screenshot 5) */}
                            {entry.cbtRecord && (
                              <div className="p-2 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/60 text-[11px] space-y-1">
                                <div className="flex items-center gap-1 font-bold text-purple-800 dark:text-purple-300">
                                  <Brain className="w-3 h-3" />
                                  <span>CBT Thought Reframed</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {entry.cbtRecord.distortions?.map((d: string) => (
                                    <span
                                      key={d}
                                      className="px-1.5 py-0.2 rounded text-[10px] bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-medium"
                                    >
                                      {d}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tags, Security & Lock action controls */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1">
                          <div className="flex flex-wrap gap-1">
                            {entry.tags.map(t => (
                              <span
                                key={t}
                                className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-600"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Decrypt option for encrypted entries */}
                            {entry.isEncrypted && (
                              <button
                                type="button"
                                onClick={() => handlePermanentlyDecrypt(entry)}
                                className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                                title="Permanently decrypt and save plaintext"
                              >
                                <Unlock className="w-3 h-3" />
                                <span>Decrypt</span>
                              </button>
                            )}

                            {/* Lock / Protect option */}
                            {entry.isLocked ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveNoteLock(entry)}
                                  className="text-[10px] font-semibold text-slate-500 hover:text-rose-500 flex items-center gap-0.5"
                                  title="Remove PIN/Passcode protection"
                                >
                                  <Unlock className="w-3 h-3" />
                                  <span>Remove Lock</span>
                                </button>
                                {!isNoteLocked && (
                                  <button
                                    type="button"
                                    onClick={() => setUnlockedNoteIds(prev => ({ ...prev, [entry.id]: false }))}
                                    className="text-[10px] font-semibold text-amber-600 flex items-center gap-0.5"
                                    title="Lock now"
                                  >
                                    <Lock className="w-3 h-3" />
                                    <span>Lock</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setLockModalTarget({ entry, mode: 'lock' })}
                                className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                                title="Protect this note with PIN, passcode or fingerprint"
                              >
                                <Lock className="w-3 h-3" />
                                <span>Lock Note</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Quick Actions at bottom */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <button
                onClick={() => handleOpenGoogleCalendar(selectedDayEntries[0])}
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Google Calendar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: TIMELINE VIEW */}
      {viewMode === 'timeline' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[500px]">
          {/* Left Column: List & Filters (5 cols) */}
          <div className="lg:col-span-5 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
            {/* Search bar */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search entries, tags, or reflections..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            {/* Tags & Mood filters */}
            <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-2 text-xs">
              <button
                onClick={() => setSelectedTag('all')}
                className={`px-2.5 py-1 rounded-lg shrink-0 transition ${
                  selectedTag === 'all'
                    ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                All Tags
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-2.5 py-1 rounded-lg shrink-0 transition flex items-center gap-1 ${
                    selectedTag === tag
                      ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Tag className="w-3 h-3" />
                  <span>{tag}</span>
                </button>
              ))}
            </div>

            {/* Entries list */}
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[520px]">
              {filteredEntries.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No entries match your search.
                </div>
              ) : (
                filteredEntries.map(entry => {
                  const isSelected = selectedEntry?.id === entry.id;
                  const moodMeta = moods.find(m => m.type === entry.mood);

                  return (
                    <div
                      key={entry.id}
                      onClick={() => setSelectedEntryId(entry.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition text-left ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40'
                          : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-base">{moodMeta?.emoji}</span>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {entry.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {entry.isFavorite && (
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          )}
                          {entry.isEncrypted && (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {entry.isEncrypted
                          ? decryptedCache[entry.id] || '🔒 [Encrypted Private Entry]'
                          : entry.content}
                      </p>

                      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                        <span>{entry.date || entry.createdAt.split('T')[0]}</span>
                        <div className="flex items-center gap-1">
                          {entry.tags.slice(0, 2).map(t => (
                            <span key={t} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Markdown Reader / Details (7 cols) */}
          <div className="lg:col-span-7 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
            {selectedEntry ? (
              <div className="flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  {/* Top Bar with metadata and actions */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl shrink-0">
                          {moods.find(m => m.type === selectedEntry.mood)?.emoji}
                        </span>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white break-words">
                          {selectedEntry.title}
                        </h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-xs text-slate-400">
                        <span className="whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                          {selectedEntry.date || selectedEntry.createdAt.split('T')[0]}
                        </span>
                        <span>•</span>
                        <span className="capitalize whitespace-nowrap">{selectedEntry.mood} mood</span>
                        {selectedEntry.energyLevel && (() => {
                          const lvl = parseEnergyLevel(selectedEntry.energyLevel);
                          const opt = ENERGY_OPTIONS.find(o => o.level === lvl);
                          return (
                            <>
                              <span>•</span>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold text-[10px] ${opt?.badgeClass || 'bg-slate-100 text-slate-700'}`}>
                                <span>⚡ Energy: {lvl}/5</span>
                                <span className="font-normal opacity-85">({opt?.name})</span>
                              </span>
                            </>
                          );
                        })()}
                        {selectedEntry.isEncrypted && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-500 font-mono flex items-center gap-1 whitespace-nowrap">
                              <ShieldCheck className="w-3 h-3" />
                              AES-256
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center flex-wrap gap-1.5 shrink-0 self-start sm:self-auto">
                      {/* Decrypt Permanently button if encrypted */}
                      {selectedEntry.isEncrypted && (
                        <button
                          type="button"
                          onClick={() => handlePermanentlyDecrypt(selectedEntry)}
                          title="Permanently decrypt and save plaintext"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 transition"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Decrypt</span>
                        </button>
                      )}

                      {/* Lock / Unlock Note controls */}
                      {selectedEntry.isLocked ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleRemoveNoteLock(selectedEntry)}
                            title="Remove PIN/Passcode lock"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-xs font-semibold transition"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Remove Lock</span>
                          </button>
                          {unlockedNoteIds[selectedEntry.id] && (
                            <button
                              type="button"
                              onClick={() => setUnlockedNoteIds(prev => ({ ...prev, [selectedEntry.id]: false }))}
                              title="Re-lock note"
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-500 transition"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setLockModalTarget({ entry: selectedEntry, mode: 'lock' })}
                          title="Protect this note with PIN, passcode or fingerprint"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-semibold transition"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Lock Note</span>
                        </button>
                      )}

                      <button
                        onClick={() => toggleFavoriteJournal(selectedEntry.id)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            selectedEntry.isFavorite ? 'text-amber-500 fill-amber-500' : ''
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => openEditEntry(selectedEntry)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteJournalEntry(selectedEntry.id)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 text-rose-500 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Reflection Body */}
                  <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 font-sans whitespace-pre-wrap">
                    {selectedEntry.isLocked && !unlockedNoteIds[selectedEntry.id] ? (
                      <div className="p-8 rounded-2xl border border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
                          {selectedEntry.lockType === 'biometric' ? (
                            <Fingerprint className="w-6 h-6" />
                          ) : (
                            <KeyRound className="w-6 h-6" />
                          )}
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          Locked Private Note
                        </h4>
                        <p className="text-slate-500 max-w-xs mx-auto">
                          This entry is locked with {selectedEntry.lockType === 'biometric' ? 'fingerprint / biometric sensor' : selectedEntry.lockType === 'pin' ? 'a 4-digit PIN' : 'a passcode'}.
                        </p>
                        <button
                          type="button"
                          onClick={() => setLockModalTarget({ entry: selectedEntry, mode: 'unlock' })}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition active:scale-95"
                        >
                          Unlock Note
                        </button>
                      </div>
                    ) : selectedEntry.isEncrypted && isJournalLocked && !decryptedCache[selectedEntry.id] ? (
                      <div className="p-8 rounded-2xl border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 text-center space-y-3">
                        <Lock className="w-8 h-8 text-amber-500 mx-auto" />
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          Encrypted Reflection
                        </h4>
                        <p className="text-slate-500 max-w-xs mx-auto">
                          Unlock with your master passphrase to read or edit this entry.
                        </p>
                        <button
                          onClick={() => setShowPassphraseModal(true)}
                          className="px-4 py-1.5 rounded-xl bg-amber-500 text-white font-semibold text-xs"
                        >
                          Unlock Vault
                        </button>
                      </div>
                    ) : selectedEntry.isEncrypted ? (
                      decryptedCache[selectedEntry.id] || selectedEntry.content
                    ) : (
                      <div className="space-y-4">
                        <p>{selectedEntry.content}</p>

                        {/* Voice Note Player */}
                        {selectedEntry.voiceNoteUrl && (
                          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 my-2">
                            <Volume2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                            <audio controls src={selectedEntry.voiceNoteUrl} className="h-7 w-full max-w-xs" />
                          </div>
                        )}

                        {/* Photo Attachments Grid */}
                        {selectedEntry.photoUrls && selectedEntry.photoUrls.length > 0 && (
                          <div className="space-y-1.5 my-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Attached Photos ({selectedEntry.photoUrls.length})</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {selectedEntry.photoUrls.map((imgUrl, idx) => (
                                <div key={idx} className="aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                                  <img src={imgUrl} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Attached Drawing Preview (Screenshot 3) */}
                        {selectedEntry.drawingUrl && (
                          <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white p-2 max-w-sm shadow-2xs">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                              <Paintbrush className="w-3 h-3 text-pink-500" />
                              <span>Attached Doodle / Sketch</span>
                            </div>
                            <img
                              src={selectedEntry.drawingUrl}
                              alt="Attached doodle"
                              className="w-full h-auto rounded-xl object-contain max-h-64"
                            />
                          </div>
                        )}

                        {/* CBT Record Breakdown (Screenshot 5) */}
                        {selectedEntry.cbtRecord && (
                          <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 space-y-2 text-xs">
                            <div className="flex items-center gap-2 font-bold text-purple-900 dark:text-purple-200">
                              <Brain className="w-4 h-4 text-purple-600" />
                              <span>CBT Thought Reframing Record</span>
                            </div>
                            <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
                              <div>
                                <span className="font-semibold text-slate-900 dark:text-white">Situation: </span>
                                <span>{selectedEntry.cbtRecord.situation}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-rose-600 dark:text-rose-400">Automatic Thought: </span>
                                <span>{selectedEntry.cbtRecord.automaticThoughts}</span>
                              </div>
                              <div className="flex flex-wrap gap-1 py-0.5">
                                {selectedEntry.cbtRecord.distortions?.map((d: string) => (
                                  <span
                                    key={d}
                                    className="px-2 py-0.5 rounded-md text-[10px] bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 font-semibold"
                                  >
                                    {d}
                                  </span>
                                ))}
                              </div>
                              <div className="pt-1.5 border-t border-purple-200/60 dark:border-purple-800/60">
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Rational Reframe: </span>
                                <span>{selectedEntry.cbtRecord.rationalReframe}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer tags */}
                <div className="flex flex-wrap gap-1.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                  {selectedEntry.tags.map(t => (
                    <span
                      key={t}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-xs text-slate-400">
                <FileText className="w-10 h-10 mb-2 opacity-40" />
                <span>Select a reflection from the left to read or edit.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 4: DAILY AFFIRMATIONS TAB */}
      {viewMode === 'affirmations' && (
        <div className="space-y-3">
          {/* Prominent Daily Affirmation Reminder Card */}
          <div className="bg-amber-50/80 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800/80 p-3 sm:p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Bell className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                    Daily Affirmation Reminder
                  </h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    reminderEnabled
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {reminderEnabled ? `Active at ${reminderTime}` : 'Disabled'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Recurring daily chime & notification reminder to practice your mindset affirmations.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <input
                type="time"
                value={reminderTime}
                onChange={e => {
                  setReminderTime(e.target.value);
                  setReminderEnabled(true);
                  soundEngine?.playClick?.();
                  pushNotification('Affirmation Reminder Updated', `Daily reminder set for ${e.target.value}`, 'journal');
                }}
                className="px-2.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs shadow-2xs"
                title="Select reminder time"
              />
              <button
                type="button"
                id="btn-affirmation-reminder-toggle"
                onClick={() => {
                  const next = !reminderEnabled;
                  setReminderEnabled(next);
                  if (next) soundEngine?.playSuccessChime?.();
                  else soundEngine?.playClick?.();
                  pushNotification(
                    'Affirmation Reminder',
                    next ? `Daily notification scheduled for ${reminderTime}` : 'Daily affirmation reminder turned off',
                    'journal'
                  );
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${
                  reminderEnabled
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                {reminderEnabled ? 'Enabled ✓' : 'Enable'}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 shadow-2xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>Daily Mindset Affirmations</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Empowering statements to build focus, confidence, and mental clarity.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  id="btn-affirmation-reminder"
                  onClick={() => setShowReminderModal(true)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition cursor-pointer ${
                    reminderEnabled
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 font-bold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  title="Configure daily affirmation reminder"
                >
                  <Bell className="w-3.5 h-3.5 text-amber-500" />
                  <span>{reminderEnabled ? `Reminder: ${reminderTime}` : 'Set Reminder'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenNewEntry('Daily Affirmations Log', 'Daily Affirmation Reflection\n\n- ')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Note</span>
                </button>
              </div>
            </div>

            {/* Add Custom Affirmation Form */}
            <form onSubmit={handleAddAffirmation} className="flex items-center gap-2 pt-0.5">
              <input
                type="text"
                placeholder="Write a custom daily affirmation..."
                value={newAffirmationText}
                onChange={e => setNewAffirmationText(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shrink-0 cursor-pointer shadow-2xs"
              >
                Add Affirmation
              </button>
            </form>
          </div>

          {/* Affirmation Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {affirmations.map(aff => (
              <div
                key={aff.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  aff.completedToday
                    ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/80 shadow-2xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-amber-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold tracking-wide uppercase">
                      {aff.category || 'Affirmation'}
                    </span>
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 leading-relaxed italic">
                      "{aff.text}"
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleAffirmation(aff.id)}
                    className={`w-7 h-7 rounded-xl flex items-center justify-center transition shrink-0 cursor-pointer ${
                      aff.completedToday
                        ? 'bg-amber-500 text-white shadow-amber-500/30 shadow-2xs'
                        : 'border border-slate-200 dark:border-slate-700 hover:border-amber-400 text-slate-400'
                    }`}
                    title={aff.completedToday ? 'Affirmed today!' : 'Mark affirmed today'}
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">
                    {aff.completedToday ? '✨ Affirmed today' : 'Tap checkmark to affirm'}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowReminderModal(true)}
                      className="text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 font-semibold flex items-center gap-1 cursor-pointer"
                      title="Set reminder for affirmations"
                    >
                      <Bell className="w-3 h-3 text-amber-500" />
                      <span>Reminder</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLogAffirmationAsJournalNote(aff.text)}
                      className="text-amber-600 dark:text-amber-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <PenTool className="w-3 h-3" />
                      <span>Note in Journal</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW MODE 3: REPORTS & ANALYTICS VIEW */}
      {viewMode === 'reports' && (
        <JournalReportSection entries={journalEntries} />
      )}

      {/* Editor Modal - 2-Page Flow (Page 1: Context/Mood/Attachments/Tags, Page 2: Full-Size Note Taking Canvas) */}
      {showEditorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-xl sm:max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 sm:p-5 my-auto h-[88vh] sm:h-[90vh] flex flex-col">
            {/* Modal Header with 2-Page Stepper */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0 gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                  <BookLock className="w-4 h-4 text-amber-500" />
                  <span>{editId ? 'Edit Reflection' : 'New Journal Entry'}</span>
                </div>

                {/* 2-Page Stepper Pills */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl ml-1 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setJournalFormStep(1)}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                      journalFormStep === 1
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <span>1. Details</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setJournalFormStep(2)}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                      journalFormStep === 2
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <span>2. Note</span>
                    {content.trim() && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowEditorModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="flex-1 flex flex-col min-h-0 mt-3">
              {/* PAGE 1: DETAILS, MOOD, ENERGY, ATTACHMENTS, TAGS & LOCK */}
              {journalFormStep === 1 && (
                <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 text-xs">
                  {/* Row 1: Title, Date, & Template Dropdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-7">
                      <input
                        type="text"
                        required
                        placeholder="Entry title (e.g. Daily Review, Focus Milestone)..."
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="date"
                        required
                        value={entryDate}
                        onChange={e => setEntryDate(e.target.value)}
                        className="w-full px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-center text-[11px]"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <select
                        value={selectedTemplate}
                        onChange={e => {
                          handleSelectTemplate(e.target.value);
                          if (e.target.value) {
                            setJournalFormStep(2);
                          }
                        }}
                        className="w-full px-2 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/40 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 cursor-pointer truncate"
                      >
                        <option value="">Templates... ▾</option>
                        {JOURNAL_TEMPLATES.map(t => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Mood on Top, Energy Below (Dedicated space for each) */}
                  <div className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                    {/* Mood Selector on Top */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mood:</span>
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 capitalize">
                          {primaryMoods.find(m => m.type === mood)?.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5 w-full">
                        {primaryMoods.map(m => (
                          <button
                            key={m.type}
                            type="button"
                            onClick={() => setMood(m.type)}
                            className={`py-1.5 px-1 sm:px-2 rounded-xl border transition cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 text-xs font-semibold ${
                              mood === m.type
                                ? 'border-amber-500 bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 font-bold shadow-2xs ring-1 ring-amber-400/50'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                            }`}
                            title={m.label}
                          >
                            <span className="text-sm shrink-0">{m.emoji}</span>
                            <span className="capitalize text-[11px] truncate">{m.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Energy Selector Below Mood (Dedicated space) */}
                    <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Energy:</span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          ENERGY_OPTIONS.find(o => o.level === energyLevel)?.badgeClass || 'bg-slate-100'
                        }`}>
                          {energyLevel}/5 • {ENERGY_OPTIONS.find(o => o.level === energyLevel)?.name}
                        </span>
                      </div>

                      {/* Numbered color-coded buttons with properly aligned Low / High labels */}
                      <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none shrink-0 w-8 text-left">
                          Low
                        </span>
                        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-1">
                          {ENERGY_OPTIONS.map(opt => {
                            const isSelected = energyLevel === opt.level;
                            return (
                              <button
                                key={opt.level}
                                type="button"
                                onClick={() => setEnergyLevel(opt.level)}
                                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs font-black flex items-center justify-center transition-all cursor-pointer border ${
                                  isSelected
                                    ? `${opt.activeClass} scale-110 shadow-sm`
                                    : `${opt.color} hover:scale-105`
                                }`}
                                title={`Energy Level ${opt.level}: ${opt.name}`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none shrink-0 w-8 text-right">
                          High
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Attachments Toolbar (Voice + Media + Sketch) */}
                  <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Attachments & Media:
                      </span>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Voice Record / Stop */}
                        {isRecordingAudio ? (
                          <button
                            type="button"
                            onClick={stopAudioRecording}
                            className="px-2 py-1 rounded-lg bg-rose-500 text-white font-bold text-xs flex items-center gap-1 animate-pulse cursor-pointer shadow-xs"
                          >
                            <Square className="w-3 h-3 fill-white" />
                            <span>Stop ({formatAudioTimer(recordingSeconds)})</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={startAudioRecording}
                            className="px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 font-semibold text-xs flex items-center gap-1 cursor-pointer transition"
                          >
                            <Mic className="w-3.5 h-3.5" />
                            <span>Voice</span>
                          </button>
                        )}

                        {/* Audio Upload */}
                        <label className="px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-semibold cursor-pointer hover:bg-purple-100 transition">
                          <Paperclip className="w-3 h-3 inline mr-1" />
                          Audio File
                          <input type="file" accept="audio/*" onChange={handleAudioFileUpload} className="hidden" />
                        </label>

                        {/* Camera */}
                        <label className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold cursor-pointer hover:bg-indigo-100 transition">
                          <Camera className="w-3 h-3 inline mr-1" />
                          Camera
                          <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" />
                        </label>

                        {/* Gallery Photos */}
                        <label className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-200 transition">
                          <ImageIcon className="w-3 h-3 inline mr-1" />
                          Photos {photoUrls.length > 0 && `(${photoUrls.length})`}
                          <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                        </label>

                        {/* Draw / Sketch */}
                        <button
                          type="button"
                          onClick={() => setShowDrawingModal(true)}
                          className="px-2 py-1 rounded-lg bg-pink-50 dark:bg-pink-950 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800 hover:bg-pink-100 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                        >
                          <PenTool className="w-3 h-3" />
                          <span>{currentDrawing ? 'Sketch ✓' : 'Sketch'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Mic Permission Restricted Notice */}
                    {micPermissionDenied && (
                      <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[11px] flex items-center justify-between gap-2 text-amber-800 dark:text-amber-300">
                        <span>Mic restricted in iframe. Use "Audio File" or attach a demo sample:</span>
                        <button
                          type="button"
                          onClick={handleGenerateDemoAudioNote}
                          className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-bold text-[10px] shrink-0"
                        >
                          Sample Audio
                        </button>
                      </div>
                    )}

                    {/* Attached Audio Player Preview */}
                    {voiceNoteUrl && (
                      <div className="flex items-center justify-between p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-1.5">
                          <Volume2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <audio controls src={voiceNoteUrl} className="h-6 w-52 sm:w-64" />
                        </div>
                        <button
                          type="button"
                          onClick={() => setVoiceNoteUrl(undefined)}
                          className="text-rose-500 hover:text-rose-700 px-2 py-0.5 text-xs font-bold cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}

                    {/* Attached Photo Previews & Canvas Drawing */}
                    {(photoUrls.length > 0 || currentDrawing) && (
                      <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
                        {photoUrls.map((url, idx) => (
                          <div key={idx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 group">
                            <img src={url} alt="Attachment" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setPhotoUrls(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center text-[10px] hover:bg-rose-600 transition cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {currentDrawing && (
                          <div className="relative w-14 h-12 rounded-lg overflow-hidden border border-pink-300 dark:border-pink-800 bg-white shrink-0 group p-0.5">
                            <img src={currentDrawing} alt="Sketch" className="w-full h-full object-contain" />
                            <button
                              type="button"
                              onClick={() => setCurrentDrawing(undefined)}
                              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center text-[10px] hover:bg-rose-600 transition cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Row 4: Tags & Encryption */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700">
                    {/* Tags Dropdown + Active Chips */}
                    <div className="flex-1 flex items-center gap-2 flex-wrap min-w-0">
                      <select
                        value=""
                        onChange={(e) => {
                          const selected = e.target.value;
                          if (!selected) return;
                          const currentArr = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
                          if (!currentArr.map(t => t.toLowerCase()).includes(selected.toLowerCase())) {
                            setTagsInput([...currentArr, selected].join(', '));
                          }
                          e.target.value = '';
                        }}
                        className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium cursor-pointer"
                      >
                        <option value="">+ Add Tag... ▾</option>
                        {systemTags.map(tag => (
                          <option key={tag} value={tag}>#{tag}</option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1 flex-wrap">
                        {tagsInput
                          .split(',')
                          .map(t => t.trim())
                          .filter(Boolean)
                          .map(tag => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold"
                            >
                              <span>#{tag}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const currentArr = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
                                  const nextArr = currentArr.filter(t => t.toLowerCase() !== tag.toLowerCase());
                                  setTagsInput(nextArr.join(', '));
                                }}
                                className="text-indigo-400 hover:text-rose-500 cursor-pointer ml-0.5"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                      </div>
                    </div>

                    {/* Encryption Toggle */}
                    <label className="flex items-center gap-1.5 cursor-pointer shrink-0 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>AES-256 Lock</span>
                      <input
                        type="checkbox"
                        checked={encryptThisEntry}
                        onChange={e => setEncryptThisEntry(e.target.checked)}
                        className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer ml-0.5"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* PAGE 2: NOTE TAKING PART ONLY (FULL JOURNALFORM SIZE) */}
              {journalFormStep === 2 && (
                <div className="flex-1 flex flex-col min-h-0 space-y-2">
                  {/* Top Bar for Note Taking Canvas */}
                  <div className="flex items-center justify-between text-xs text-slate-500 px-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setJournalFormStep(1)}
                      className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                    >
                      <span>← Back to Details</span>
                    </button>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>
                        {content.trim() ? `${content.trim().split(/\s+/).length} words` : '0 words'}
                      </span>
                      <span>•</span>
                      <span>{content.length} characters</span>
                    </div>
                  </div>

                  {/* FULL JOURNALFORM SIZE TEXTAREA */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <textarea
                      placeholder="Write your note, full thoughts, reflections, progress observations, or details..."
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      className="w-full flex-1 h-full min-h-[360px] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-sans leading-relaxed text-sm sm:text-base focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-hidden resize-none transition"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* Form Footer Action Buttons */}
              <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
                {journalFormStep === 1 ? (
                  <>
                    <button
                      type="button"
                      id="btn-modal-set-reminder"
                      onClick={() => setShowReminderModal(true)}
                      className="px-2.5 py-1 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1.5 text-xs font-semibold cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Configure daily affirmation & journal reminder"
                    >
                      <Bell className="w-3.5 h-3.5 text-amber-500" />
                      <span>{reminderEnabled ? `${reminderTime}` : 'Reminder'}</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowEditorModal(false)}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => setJournalFormStep(2)}
                        className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs active:scale-95 transition cursor-pointer text-xs flex items-center gap-1.5"
                      >
                        <span>Next: Write Note</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setJournalFormStep(1)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer text-xs flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      <span>← Back</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowEditorModal(false)}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs active:scale-95 transition cursor-pointer text-xs flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Save Entry</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Calendar Sync & Integration Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Calendar Sync & Export
                </h3>
              </div>
              <button
                onClick={() => setShowSyncModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Sync your private reflections and daily journaling habits directly with Google Calendar, Notion Calendar, Apple Calendar, or any standard iCal application.
            </p>

            <div className="space-y-3">
              {/* Option 1: Download Standard .ICS */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                    <Download className="w-4 h-4 text-emerald-500" />
                    <span>Download iCalendar (.ics)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Standard RFC 5545 calendar file. Import once into Google Calendar or Notion Calendar.
                  </p>
                </div>
                <button
                  onClick={handleDownloadIcs}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shrink-0 transition"
                >
                  Download .ics
                </button>
              </div>

              {/* Option 2: 1-Click Google Calendar */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                    <ExternalLink className="w-4 h-4 text-indigo-500" />
                    <span>Google Calendar Event</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Open Google Calendar in a new tab to create a recurring daily reflection slot.
                  </p>
                </div>
                <button
                  onClick={() => handleOpenGoogleCalendar()}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0 transition"
                >
                  Add to G-Cal
                </button>
              </div>

              {/* Option 3: Notion Calendar instructions */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  <span>Notion Calendar Setup Guide</span>
                </div>
                <ol className="list-decimal list-inside text-[11px] text-slate-500 space-y-1 pl-1">
                  <li>Download the <strong>.ics file</strong> using the button above.</li>
                  <li>Import it into your Google Calendar under <em>Settings &gt; Import &amp; Export</em>.</li>
                  <li>In <strong>Notion Calendar</strong>, connect your Google Calendar account to see all reflections synced automatically.</li>
                </ol>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowSyncModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vault Passphrase Modal */}
      {showPassphraseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" />
                Master Vault Passphrase
              </h3>
              <button
                onClick={() => setShowPassphraseModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePassphraseSubmit} className="mt-4 space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-400 text-xs">
                Enter your secret master passphrase to derive the AES-256 cryptographic key:
              </p>
              <input
                type="password"
                required
                placeholder="Enter passphrase (e.g. secret-vault-123)"
                value={passphraseInput}
                onChange={e => setPassphraseInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
              {passphraseError && (
                <p className="text-rose-500 font-medium text-[11px]">{passphraseError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPassphraseModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold"
                >
                  Unlock Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Note Lock & Unlock Modal */}
      <NoteLockModal
        isOpen={!!lockModalTarget}
        entry={lockModalTarget?.entry || null}
        mode={lockModalTarget?.mode || 'lock'}
        onClose={() => setLockModalTarget(null)}
        onConfirmLock={handleConfirmNoteLock}
        onSuccessUnlock={handleSuccessNoteUnlock}
      />

      {/* Draw and Paint Modal (Screenshot 3) */}
      <JournalDrawingModal
        isOpen={showDrawingModal}
        initialDrawing={currentDrawing}
        onClose={() => setShowDrawingModal(false)}
        onSave={(dataUrl) => {
          setCurrentDrawing(dataUrl);
          setShowDrawingModal(false);
          // If editor is not open, open it so user can save or describe the sketch
          if (!showEditorModal) {
            setShowEditorModal(true);
            setTitle(prev => prev || 'Visual Sketch & Reflection');
          }
        }}
      />

      {/* CBT Thought Record Modal (Screenshot 5) */}
      <CBTThoughtModal
        isOpen={showCBTModal}
        onClose={() => setShowCBTModal(false)}
        onSaveCBT={handleSaveCBT}
      />

      {/* Universal ActivityManager Modal for New Journal Entry */}
      {isUniversalAddOpen && (
        <ActivityManager
          isOpen={isUniversalAddOpen}
          onClose={() => setIsUniversalAddOpen(false)}
          type="journal"
        />
      )}

      {/* Recurring Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Daily Affirmations & Journal Reminder
                </h3>
              </div>
              <button
                onClick={() => setShowReminderModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">Enable Daily Reminder</span>
                  <p className="text-[11px] text-slate-500">Scheduled notification for daily mindset affirmations & reflections</p>
                </div>
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={e => setReminderEnabled(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Reminder Time
                </label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={e => setReminderTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowReminderModal(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReminderModal(false);
                  soundEngine?.playSuccessChime?.();
                  pushNotification(
                    'Affirmation & Journal Reminder Updated',
                    reminderEnabled ? `Daily notification set for ${reminderTime}` : 'Daily reminder disabled',
                    'journal'
                  );
                }}
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-2xs cursor-pointer"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

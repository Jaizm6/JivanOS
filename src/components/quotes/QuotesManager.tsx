import React, { useState, useMemo, useEffect } from 'react';
import {
  Quote,
  Search,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Share2,
  Check,
  Sparkles,
  BookOpen,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  User,
  Heart,
  Download,
  Upload,
  Sun,
  Moon,
  Bell,
  BellRing,
  Volume2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { QuoteItem } from '../../data/quotes';
import { notificationService } from '../../utils/notifications';
import {
  UnifiedFormModal,
  FormHeroTitleCard,
  UnifiedSubModal,
} from '../common/FormPrimitives';
import {
  PetalShapeBadge,
  M3SegmentedGroup,
  getHabitExpressiveShape,
  getPetalGroupRadiusClass,
} from '../common/PetalExpressive';

type CategoryFilter = 'all' | 'discipline' | 'mindset' | 'focus' | 'stoicism' | 'health' | 'wisdom' | 'habits';
type SourceFilter = 'all' | 'favorites' | 'custom';
type SearchScope = 'all' | 'body' | 'author' | 'source';

const QUOTE_CATEGORIES: QuoteItem['category'][] = [
  'wisdom',
  'discipline',
  'mindset',
  'focus',
  'stoicism',
  'health',
  'habits',
];

export const QuotesManager: React.FC = () => {
  const {
    quotes,
    addQuote,
    updateQuote,
    deleteQuote,
    soundEngine,
    favoriteQuoteIds,
    toggleFavoriteQuote,
    isQuoteFavorited,
    theme,
    pushNotification,
  } = useApp();

  const isDark =
    theme === 'dark' ||
    (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Focused quote opened from WisdomQuote banner
  const [focusedQuoteId, setFocusedQuoteId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('omni_focused_quote_id');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleFocusQuote = (e: any) => {
      const id = e?.detail?.quoteId;
      if (id) {
        setFocusedQuoteId(id);
      }
    };
    window.addEventListener('omni_focus_quote', handleFocusQuote);
    return () => window.removeEventListener('omni_focus_quote', handleFocusQuote);
  }, []);

  const clearFocusedQuote = () => {
    setFocusedQuoteId(null);
    try {
      localStorage.removeItem('omni_focused_quote_id');
    } catch {}
  };

  const focusedQuote = useMemo(() => {
    if (!focusedQuoteId) return null;
    return quotes.find(q => q.id === focusedQuoteId) || null;
  }, [quotes, focusedQuoteId]);

  // Modals & Confirmation States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [editingQuote, setEditingQuote] = useState<QuoteItem | null>(null);
  const [deletingQuote, setDeletingQuote] = useState<QuoteItem | null>(null);
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [transitionStyle, setTransitionStyle] = useState<'fade' | 'slide' | 'scale'>(() => {
    try {
      return (
        (localStorage.getItem('omni_quote_transition_style') as 'fade' | 'slide' | 'scale') ||
        'fade'
      );
    } catch {
      return 'fade';
    }
  });
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  const triggerVibration = (pattern: number = 20) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  // Global Quote Reminder Preferences (Persisted in localStorage)
  const [isReminderEnabled, setIsReminderEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('omni_quote_reminder_enabled') === 'true';
    } catch {
      return false;
    }
  });

  // Typography preferences (cards always stay Pure White in light mode / M3 dark surface in dark mode)
  const [quoteFontScale, setQuoteFontScale] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('omni_quote_font_scale')) || 1;
    } catch {
      return 1;
    }
  });

  const [quoteFontFamily, setQuoteFontFamily] = useState<string>(() => {
    try {
      return localStorage.getItem('omni_quote_font_family') || 'sans-serif';
    } catch {
      return 'sans-serif';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('omni_quote_card_bg', 'default');
    } catch {}
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--quote-font-scale', String(quoteFontScale));
      document.documentElement.style.setProperty('--quote-font-family', quoteFontFamily);
      document.documentElement.style.setProperty('--quote-card-bg', isDark ? '#111319' : '#ffffff');
      document.documentElement.style.setProperty('--quote-card-border', isDark ? '#2e3444' : '#c4cddb');
    }
  }, [quoteFontScale, quoteFontFamily, isDark]);

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e.detail) {
        if (e.detail.fontScale !== undefined) setQuoteFontScale(e.detail.fontScale);
        if (e.detail.fontFamily !== undefined) setQuoteFontFamily(e.detail.fontFamily);
        if (e.detail.transitionStyle !== undefined) setTransitionStyle(e.detail.transitionStyle);
      }
    };
    window.addEventListener('omni_quote_theme_changed', handleThemeChange);
    return () => window.removeEventListener('omni_quote_theme_changed', handleThemeChange);
  }, []);

  const [morningReminderTime, setMorningReminderTime] = useState<string>(() => {
    try {
      return localStorage.getItem('omni_quote_reminder_morning') || '08:00';
    } catch {
      return '08:00';
    }
  });

  const [eveningReminderTime, setEveningReminderTime] = useState<string>(() => {
    try {
      return localStorage.getItem('omni_quote_reminder_evening') || '20:00';
    } catch {
      return '20:00';
    }
  });

  const formatTime12h = (time24: string) => {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m < 10 ? '0' : ''}${m} ${period}`;
  };

  const [notifPermission, setNotifPermission] = useState<string>(() => {
    return notificationService.getPermission();
  });

  const handleRequestNotifPermission = async () => {
    const granted = await notificationService.requestPermission();
    setNotifPermission(notificationService.getPermission());
    if (granted) {
      soundEngine.playSuccessChime();
    }
  };

  const toSentenceCase = (text: string) => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const handleTestNotification = async () => {
    if (quotes.length === 0) return;
    const randomIndex = Math.floor(Math.random() * quotes.length);
    const selectedQuote = quotes[randomIndex] || quotes[0];
    const formattedQuoteText = toSentenceCase(selectedQuote.text);

    if (notifPermission !== 'granted' && notificationService.isSupported()) {
      await notificationService.requestPermission();
      setNotifPermission(notificationService.getPermission());
    }

    notificationService.notify('🔔 Daily Wisdom Test Reminder', {
      body: `"${formattedQuoteText}" — ${selectedQuote.author}`,
      sound: 'task',
      tag: 'quote_test_alert',
    });
  };

  useEffect(() => {
    if (!isReminderEnabled) return;

    let lastFiredKey = '';

    const checkAndTriggerReminder = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${hours}:${mins}`;
      const minuteKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}_${currentTimeStr}`;

      if (lastFiredKey === minuteKey) return;

      let label = '';
      if (currentTimeStr === morningReminderTime) {
        label = 'Morning Wisdom';
      } else if (currentTimeStr === eveningReminderTime) {
        label = 'Evening Wisdom';
      }

      if (label && quotes.length > 0) {
        lastFiredKey = minuteKey;
        const randomIndex = Math.floor(Math.random() * quotes.length);
        const selectedQuote = quotes[randomIndex] || quotes[0];
        const formattedQuoteText = toSentenceCase(selectedQuote.text);

        notificationService.notify(`🌅 ${label}`, {
          body: `"${formattedQuoteText}" — ${selectedQuote.author}`,
          sound: 'task',
          tag: `quote_reminder_${minuteKey}`,
        });
      }
    };

    const unsubscribe = notificationService.subscribeTick(checkAndTriggerReminder);
    checkAndTriggerReminder();

    return () => {
      unsubscribe();
    };
  }, [isReminderEnabled, morningReminderTime, eveningReminderTime, quotes]);

  const handleSaveReminderPreferences = (enabled: boolean, morning: string, evening: string) => {
    setIsReminderEnabled(enabled);
    setMorningReminderTime(morning);
    setEveningReminderTime(evening);

    try {
      localStorage.setItem('omni_quote_reminder_enabled', String(enabled));
      localStorage.setItem('omni_quote_reminder_morning', morning);
      localStorage.setItem('omni_quote_reminder_evening', evening);
    } catch (e) {
      console.error('Failed to save quote reminder preferences to localStorage', e);
    }

    soundEngine.playSuccessChime();
    setSaveSuccessMsg(true);
    setTimeout(() => {
      setSaveSuccessMsg(false);
      setShowReminderSettings(false);
    }, 800);
  };

  // Form fields
  const [formText, setFormText] = useState('');
  const [formAuthor, setFormAuthor] = useState('');
  const [formCategory, setFormCategory] = useState<QuoteItem['category']>('wisdom');
  const [formSource, setFormSource] = useState('');

  const categories: { id: CategoryFilter; label: string }[] = [
    { id: 'all', label: 'All Categories' },
    { id: 'wisdom', label: 'Wisdom' },
    { id: 'discipline', label: 'Discipline' },
    { id: 'mindset', label: 'Mindset' },
    { id: 'focus', label: 'Focus' },
    { id: 'stoicism', label: 'Stoicism' },
    { id: 'health', label: 'Health' },
    { id: 'habits', label: 'Habits' },
  ];

  const isUserQuote = (q: QuoteItem) => {
    return Boolean(
      q.isCustom || q.id.startsWith('q_custom_') || (q.id.startsWith('q_') && q.id.length > 10)
    );
  };

  const customQuotesCount = useMemo(() => quotes.filter(isUserQuote).length, [quotes]);

  const quoteIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    quotes.forEach((q, idx) => {
      map.set(q.id, idx + 1);
    });
    return map;
  }, [quotes]);

  const favoriteQuotesCount = useMemo(() => favoriteQuoteIds.length, [favoriteQuoteIds]);

  const filteredQuotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return quotes.filter(q => {
      if (sourceFilter === 'custom' && !isUserQuote(q)) {
        return false;
      }
      if (sourceFilter === 'favorites' && !favoriteQuoteIds.includes(q.id)) {
        return false;
      }

      const matchCat = selectedCategory === 'all' || q.category === selectedCategory;
      if (!matchCat) return false;

      if (!query) return true;

      if (searchScope === 'body') {
        return q.text.toLowerCase().includes(query);
      } else if (searchScope === 'author') {
        return q.author.toLowerCase().includes(query);
      } else if (searchScope === 'source') {
        return Boolean(q.source && q.source.toLowerCase().includes(query));
      } else {
        return (
          q.text.toLowerCase().includes(query) ||
          q.author.toLowerCase().includes(query) ||
          Boolean(q.source && q.source.toLowerCase().includes(query))
        );
      }
    });
  }, [quotes, selectedCategory, searchQuery, searchScope, sourceFilter, favoriteQuoteIds]);

  const totalPages = Math.ceil(filteredQuotes.length / itemsPerPage) || 1;
  const paginatedQuotes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredQuotes.slice(start, start + itemsPerPage);
  }, [filteredQuotes, currentPage, itemsPerPage]);

  const handleShare = async (id: string, text: string, author: string) => {
    const shareText = `"${text}" — ${author}`;

    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch {
        // Fallback to copy
      }
    }

    await navigator.clipboard.writeText(shareText);
    setCopiedId(id);
    soundEngine.playSuccessChime();
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleCopy = async (id: string, text: string, author: string, source?: string) => {
    const copyText = `"${text}" — ${author}${source ? ` (${source})` : ''}`;
    await navigator.clipboard.writeText(copyText);
    setCopiedId(id);
    soundEngine.playSuccessChime();
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleExportJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(quotes, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute(
      'download',
      `quotes_backup_${new Date().toISOString().split('T')[0]}.json`
    );
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    soundEngine.playSuccessChime();
  };

  const openAddModal = () => {
    setFormText('');
    setFormAuthor('');
    setFormCategory('wisdom');
    setFormSource('');
    setShowAddModal(true);
  };

  const openEditModal = (q: QuoteItem) => {
    setEditingQuote(q);
    setFormText(q.text);
    setFormAuthor(q.author);
    setFormCategory(q.category);
    setFormSource(q.source || '');
  };

  const handleSubmitAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formText.trim() || !formAuthor.trim()) return;

    addQuote({
      text: formText.trim(),
      author: formAuthor.trim(),
      category: formCategory,
      source: formSource.trim() || undefined,
    });
    soundEngine.playSuccessChime();
    setShowAddModal(false);
  };

  const handleSubmitEdit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingQuote || !formText.trim() || !formAuthor.trim()) return;

    updateQuote({
      ...editingQuote,
      text: formText.trim(),
      author: formAuthor.trim(),
      category: formCategory,
      source: formSource.trim() || undefined,
    });
    soundEngine.playSuccessChime();
    setEditingQuote(null);
  };

  const confirmDeleteQuote = () => {
    if (!deletingQuote) return;
    deleteQuote(deletingQuote.id);
    if (focusedQuoteId === deletingQuote.id) {
      clearFocusedQuote();
    }
    soundEngine.playSuccessChime();
    setDeletingQuote(null);
  };

  const getCategoryTheme = (cat: string) => {
    switch (cat) {
      case 'habits':
        return {
          text: 'text-emerald-600 dark:text-emerald-400',
          dot: 'bg-emerald-500',
          hex: '#10b981',
        };
      case 'discipline':
        return {
          text: 'text-rose-600 dark:text-rose-400',
          dot: 'bg-rose-500',
          hex: '#f43f5e',
        };
      case 'stoicism':
        return {
          text: 'text-purple-600 dark:text-purple-400',
          dot: 'bg-purple-500',
          hex: '#a855f7',
        };
      case 'focus':
        return {
          text: 'text-sky-600 dark:text-sky-400',
          dot: 'bg-sky-500',
          hex: '#0ea5e9',
        };
      case 'health':
        return {
          text: 'text-teal-600 dark:text-teal-400',
          dot: 'bg-teal-500',
          hex: '#14b8a6',
        };
      case 'mindset':
        return {
          text: 'text-indigo-600 dark:text-indigo-400',
          dot: 'bg-indigo-500',
          hex: '#6366f1',
        };
      case 'wisdom':
      default:
        return {
          text: 'text-amber-600 dark:text-amber-400',
          dot: 'bg-amber-500',
          hex: '#f59e0b',
        };
    }
  };

  const cycleSearchScope = () => {
    const scopes: SearchScope[] = ['all', 'body', 'author', 'source'];
    const nextIdx = (scopes.indexOf(searchScope) + 1) % scopes.length;
    setSearchScope(scopes[nextIdx]);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-1.5 flex-1 flex flex-col min-h-full pb-24 sm:pb-10 w-full min-w-0 animate-in fade-in duration-200">
      {/* Focused Quote Spotlight (when opened via 3-dot or tap from WisdomQuote Banner) */}
      {focusedQuote && (
        <div
          data-m3-tonal-card="true"
          data-tonal-tone="neutral"
          className="relative w-full min-w-0 overflow-hidden rounded-[16px] ring-1 ring-indigo-500/35 p-2 sm:p-2.5 space-y-1 animate-view-enter"
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[9.5px] font-bold shrink-0">
                <Sparkles className="w-2.5 h-2.5" />
                <span>Selected</span>
              </span>
              <span className="text-[10.5px] font-semibold text-slate-500 dark:text-zinc-400 tabular-nums shrink-0">
                #{quoteIndexMap.get(focusedQuote.id) || 1}
              </span>
            </div>
            <button
              type="button"
              onClick={clearFocusedQuote}
              className="w-6 h-6 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
              title="Dismiss focused quote"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p
            className="text-slate-900 dark:text-white font-semibold leading-[1.35] text-[12.5px] sm:text-[13px] break-words"
            style={{ fontFamily: quoteFontFamily }}
          >
            “{toSentenceCase(focusedQuote.text)}”
          </p>

          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-200/75 dark:border-zinc-800/70">
            <div className="flex items-center gap-1 text-[11px] text-slate-700 dark:text-zinc-300 min-w-0 flex-wrap">
              <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate">
                — {focusedQuote.author}
              </span>
              {focusedQuote.source && (
                <span className="text-slate-500 dark:text-zinc-400 text-[10.5px] break-words">
                  ({focusedQuote.source})
                </span>
              )}
              <span aria-hidden="true" className="opacity-45">·</span>
              <span className={`text-[10.5px] font-semibold capitalize shrink-0 ${getCategoryTheme(focusedQuote.category).text}`}>
                {focusedQuote.category}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => openEditModal(focusedQuote)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-[10.5px] font-bold transition cursor-pointer shadow-2xs whitespace-nowrap"
              >
                <Edit2 className="w-2.5 h-2.5" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    focusedQuote.id,
                    focusedQuote.text,
                    focusedQuote.author,
                    focusedQuote.source
                  )
                }
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f3f6fc] dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 text-[10.5px] font-semibold hover:bg-slate-200/70 dark:hover:bg-zinc-700 transition cursor-pointer whitespace-nowrap"
              >
                {copiedId === focusedQuote.id ? (
                  <>
                    <Check className="w-2.5 h-2.5 text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-2.5 h-2.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => toggleFavoriteQuote(focusedQuote.id)}
                className={`w-6 h-6 rounded-full flex items-center justify-center border transition cursor-pointer ${
                  isQuoteFavorited(focusedQuote.id)
                    ? 'bg-rose-100 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-600'
                    : 'bg-[#f3f6fc] dark:bg-zinc-800 border-slate-200/80 dark:border-zinc-700 text-slate-500 hover:text-rose-500'
                }`}
                title="Save Quote"
              >
                <Heart
                  className={`w-3 h-3 ${
                    isQuoteFavorited(focusedQuote.id) ? 'fill-rose-500 text-rose-500' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Material 3 Expressive Compact Control Card */}
      <div
        data-m3-tonal-card="true"
        data-tonal-tone="neutral"
        className="w-full min-w-0 max-w-full overflow-hidden p-1.5 sm:p-2 rounded-[18px] space-y-1"
      >
        {/* Row 1: Compact Search Pill + Reminders / Style / Compact Colored + Button */}
        <div className="flex items-center gap-1.5 w-full min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={`Search ${quotes.length.toLocaleString()} quotes, authors...`}
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-8 pl-8 pr-16 rounded-full bg-[#f3f6fc] dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700/80 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/35 transition"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="p-1 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={cycleSearchScope}
                className="px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 border border-slate-200/90 dark:border-zinc-700 shadow-2xs text-[10px] font-bold text-slate-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer shrink-0 whitespace-nowrap"
                title="Tap to change search scope (All / Quote Text / Author / Source)"
              >
                {searchScope === 'all' ? 'All' : searchScope === 'body' ? 'Text' : searchScope === 'author' ? 'Author' : 'Source'}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowReminderSettings(true)}
            className={`h-8 w-8 sm:w-auto sm:px-2.5 rounded-xl inline-flex items-center justify-center gap-1 text-xs font-bold border transition cursor-pointer shrink-0 whitespace-nowrap ${
              isReminderEnabled
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300/80 dark:border-amber-700/60'
                : 'bg-[#f3f6fc] dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 border-slate-200/80 dark:border-zinc-700/80 hover:bg-slate-200/70 dark:hover:bg-zinc-800'
            }`}
            title="Daily Quote Reminders"
          >
            <Bell
              className={`w-3.5 h-3.5 ${
                isReminderEnabled ? 'text-amber-500 fill-amber-500/20' : ''
              }`}
            />
            <span className="hidden md:inline text-[11px]">
              {isReminderEnabled ? formatTime12h(morningReminderTime) : 'Reminders'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowBulkImportModal(true)}
            className="h-8 w-8 rounded-xl inline-flex items-center justify-center bg-[#f3f6fc] dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-700/80 hover:bg-slate-200/70 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
            title="Import Quotes"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          </button>

          <button
            type="button"
            onClick={handleExportJSON}
            className="h-8 w-8 rounded-xl inline-flex items-center justify-center bg-[#f3f6fc] dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-700/80 hover:bg-slate-200/70 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
            title="Export Quotes JSON"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </button>

          <button
            id="btn-add-quote"
            type="button"
            onClick={openAddModal}
            className="h-8 w-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-2xs transition shrink-0 cursor-pointer flex items-center justify-center"
            title="Add New Quote"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Row 2: M3 Expressive Segmented Source Filter + Topic Chips */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 min-w-0">
          <M3SegmentedGroup<SourceFilter>
            value={sourceFilter}
            onChange={val => {
              setSourceFilter(val);
              setCurrentPage(1);
            }}
            className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex"
            options={[
              {
                id: 'all',
                label: 'All',
                badge: quotes.length.toLocaleString(),
              },
              {
                id: 'favorites',
                label: 'Saved',
                icon: (
                  <Heart
                    className={`w-3 h-3 ${
                      sourceFilter === 'favorites'
                        ? 'fill-current'
                        : 'text-rose-500 fill-rose-500'
                    }`}
                  />
                ),
                badge: favoriteQuotesCount,
              },
              {
                id: 'custom',
                label: 'Custom',
                icon: <User className="w-3 h-3" />,
                badge: customQuotesCount,
              },
            ]}
          />

          {/* Horizontally Scrollable M3 Topic Chips */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0 flex-1">
            {categories.map(cat => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setCurrentPage(1);
                  }}
                  className={`h-7 px-2.5 text-[11px] font-bold transition-all shrink-0 cursor-pointer whitespace-nowrap inline-flex items-center gap-1 border ${
                    active
                      ? 'rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 border-indigo-500/40 dark:border-indigo-400/40 shadow-2xs'
                      : 'rounded-[11px] bg-[#f3f6fc] dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200/80 dark:border-zinc-700/80 hover:bg-slate-200/70 dark:hover:bg-zinc-800'
                  }`}
                >
                  {active && <Check className="w-3 h-3 stroke-[2.75] shrink-0" />}
                  <span>{cat.id === 'all' ? 'All Topics' : cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Compact Results & M3 Pagination Strip */}
      <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-zinc-400 px-1 w-full min-w-0 tabular-nums">
        <span>
          Showing{' '}
          <strong className="text-slate-900 dark:text-zinc-100 font-bold">
            {filteredQuotes.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}–
            {Math.min(currentPage * itemsPerPage, filteredQuotes.length)}
          </strong>{' '}
          of <strong className="text-slate-900 dark:text-zinc-100 font-bold">{filteredQuotes.length.toLocaleString()}</strong>
        </span>

        {totalPages > 1 && (
          <div
            data-m3-tonal-card="true"
            data-tonal-tone="neutral"
            className="inline-flex items-center gap-0.5 p-0.5 rounded-full"
          >
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="w-6.5 h-6.5 rounded-full flex items-center justify-center text-slate-700 dark:text-zinc-200 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[11px] font-bold text-slate-800 dark:text-zinc-200 tabular-nums whitespace-nowrap">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="w-6.5 h-6.5 rounded-full flex items-center justify-center text-slate-700 dark:text-zinc-200 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Quotes List / Grid */}
      {paginatedQuotes.length === 0 ? (
        sourceFilter === 'favorites' && favoriteQuotesCount === 0 ? (
          <div
            data-m3-tonal-card="true"
            data-tonal-tone="neutral"
            className="text-center py-10 rounded-[20px] p-5 space-y-2.5"
          >
            <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center mx-auto">
              <Heart className="w-5 h-5 fill-rose-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                No Saved Quotes Yet
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 max-w-sm mx-auto">
                Tap the heart icon on any quote to save your favorite wisdom here.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSourceFilter('all');
                setCurrentPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Browse All Quotes</span>
            </button>
          </div>
        ) : sourceFilter === 'custom' && customQuotesCount === 0 ? (
          <div
            data-m3-tonal-card="true"
            data-tonal-tone="neutral"
            className="text-center py-10 rounded-[20px] p-5 space-y-2.5"
          >
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                No Custom Quotes Yet
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 max-w-sm mx-auto">
                Add your own personal mottos, book highlights, or daily affirmations.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add First Quote</span>
            </button>
          </div>
        ) : (
          <div
            data-m3-tonal-card="true"
            data-tonal-tone="neutral"
            className="text-center py-10 rounded-[20px] p-5"
          >
            <BookOpen className="w-9 h-9 text-slate-400 dark:text-zinc-500 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              No matching quotes
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Try clearing your search or switching category filters.
            </p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-[3px] sm:gap-1.5 w-full min-w-0">
          {paginatedQuotes.map((q, idx) => {
            const isCopied = copiedId === q.id;
            const isFav = isQuoteFavorited(q.id);
            const catTheme = getCategoryTheme(q.category);
            const quoteNum = quoteIndexMap.get(q.id) || 1;
            const isFocused = focusedQuoteId === q.id;
            const badgeShape = getHabitExpressiveShape(q.category, idx);
            const petalRadius = getPetalGroupRadiusClass(idx, paginatedQuotes.length, true);

            return (
              <article
                key={`${q.id}-${transitionStyle}`}
                data-m3-tonal-card="true"
                data-tonal-tone="neutral"
                style={{
                  borderLeftWidth: '2.5px',
                  borderLeftColor: catTheme.hex,
                }}
                className={`group relative w-full min-w-0 overflow-hidden flex flex-col justify-between p-2.5 sm:p-3.5 lg:p-4 ${petalRadius} sm:rounded-[20px] lg:rounded-[22px] gap-1.5 sm:gap-2.5 transition-all duration-200 text-left hover:shadow-xs ${
                  isFocused ? 'ring-2 ring-indigo-500' : ''
                }`}
              >
                {/* Compact Material 3 Expressive Header: Petal Badge + Category & Unclipped Source + Index */}
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <PetalShapeBadge
                      shape={badgeShape}
                      sizeClass="w-6 h-6 sm:w-7 sm:h-7"
                      fillColor={`${catTheme.hex}${isDark ? '26' : '18'}`}
                      strokeColor={`${catTheme.hex}${isDark ? '60' : '42'}`}
                    >
                      <Quote
                        className="w-2.5 h-2.5 sm:w-3 sm:h-3"
                        style={{ color: catTheme.hex }}
                      />
                    </PetalShapeBadge>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0 min-w-0 flex-1 pr-1 leading-tight">
                      <span className={`text-[10.5px] sm:text-[11px] font-bold capitalize tracking-tight shrink-0 ${catTheme.text}`}>
                        {q.category}
                      </span>
                      {q.source && (
                        <>
                          <span aria-hidden="true" className="text-slate-300 dark:text-zinc-600 text-[10.5px] shrink-0">·</span>
                          <span
                            className="text-[10.5px] sm:text-[11px] font-medium text-slate-500 dark:text-zinc-400 break-words leading-tight"
                            title={q.source}
                          >
                            {q.source}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-slate-400 dark:text-zinc-500 tabular-nums shrink-0">
                    #{quoteNum}
                  </span>
                </div>

                {/* Editorial Quote Body (Compact on phone, expressive on PC) */}
                <p
                  className="font-medium text-slate-900 dark:text-zinc-50 leading-[1.38] sm:leading-[1.46] break-words px-0.5"
                  style={{
                    fontSize: `${Math.max(0.8, quoteFontScale * 0.84)}rem`,
                    fontFamily: quoteFontFamily,
                  }}
                >
                  “{toSentenceCase(q.text)}”
                </p>

                {/* Slim Material 3 Tonal Action & Attribution Strip */}
                <div className="flex items-center justify-between gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-[12px] bg-[#f4f7fc] dark:bg-zinc-900/90 border border-slate-200/60 dark:border-zinc-800/80 min-w-0 w-full">
                  <span className="text-[11px] sm:text-[11.5px] font-bold text-slate-800 dark:text-zinc-200 truncate min-w-0 flex-1">
                    — {q.author}
                  </span>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        triggerVibration();
                        toggleFavoriteQuote(q.id);
                      }}
                      className={`h-6 px-1.5 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                        isFav
                          ? 'text-rose-600 dark:text-rose-400 bg-rose-500/15 font-bold'
                          : 'w-6 px-0 text-slate-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 hover:text-rose-600'
                      }`}
                      title={isFav ? 'Remove from Saved' : 'Save Quote'}
                    >
                      <Heart
                        className={`w-3 h-3 ${
                          isFav ? 'fill-rose-500 text-rose-500' : ''
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerVibration();
                        handleCopy(q.id, q.text, q.author, q.source);
                      }}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                        isCopied
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 hover:text-indigo-600 dark:hover:text-indigo-400'
                      }`}
                      title="Copy Quote"
                    >
                      {isCopied ? (
                        <Check className="w-3 h-3 stroke-[2.5]" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerVibration();
                        handleShare(q.id, q.text, q.author);
                      }}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                      title="Share Quote"
                    >
                      <Share2 className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerVibration();
                        openEditModal(q);
                      }}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                      title="Edit Quote"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerVibration();
                        setDeletingQuote(q);
                      }}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      title="Delete Quote"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Compact Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1.5">
          <button
            type="button"
            disabled={currentPage === 1}
            data-m3-tonal-card="true"
            data-tonal-tone="neutral"
            onClick={() => {
              setCurrentPage(prev => Math.max(1, prev - 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-800 dark:text-zinc-200 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer whitespace-nowrap"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <span className="text-xs font-bold text-slate-600 dark:text-zinc-300 px-2 tabular-nums whitespace-nowrap">
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage === totalPages}
            data-m3-tonal-card="true"
            data-tonal-tone="neutral"
            onClick={() => {
              setCurrentPage(prev => Math.min(totalPages, prev + 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-800 dark:text-zinc-200 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer whitespace-nowrap"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Unified Add / Edit Quote Modal (Single-Screen, Fast & Clean) */}
      <UnifiedFormModal
        isOpen={showAddModal || Boolean(editingQuote)}
        onClose={() => {
          setShowAddModal(false);
          setEditingQuote(null);
        }}
        title={editingQuote ? 'Edit Quote' : 'New Quote'}
        accentColor="#4f46e5"
        headerIcon={
          <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Quote size={14} />
          </div>
        }
        footer={
          <div className="flex items-center justify-between gap-2">
            <div>
              {editingQuote && (
                <button
                  type="button"
                  onClick={() => {
                    const target = editingQuote;
                    setEditingQuote(null);
                    setDeletingQuote(target);
                  }}
                  className="px-3.5 py-2 rounded-full font-bold text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Delete Quote"
                >
                  <Trash2 size={13.5} />
                  <span>Delete</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingQuote(null);
                }}
                className="px-4 py-2 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-[#eff2f9] dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!formText.trim() || !formAuthor.trim()}
                onClick={() => (editingQuote ? handleSubmitEdit() : handleSubmitAdd())}
                className="px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-40 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check size={14} className="stroke-[2.5]" />
                <span>Save</span>
              </button>
            </div>
          </div>
        }
      >
        <FormHeroTitleCard
          value={formText}
          onChange={setFormText}
          placeholder="Write an inspiring quote, stoic reflection, or personal mantra..."
          accentColor="#4f46e5"
          icon={<Quote size={16} />}
          multiline
          rows={3}
          bottomSlot={
            <div className="space-y-2">
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  required
                  placeholder="Author / Speaker (e.g. Marcus Aurelius) *"
                  value={formAuthor}
                  onChange={e => setFormAuthor(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-[14px] bg-[#f3f6fc] dark:bg-[#111116] ring-1 ring-black/[0.05] dark:ring-white/[0.08] text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/35"
                />
              </div>
              <div className="relative">
                <BookOpen size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Book / Source (optional, e.g. Meditations)"
                  value={formSource}
                  onChange={e => setFormSource(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-[14px] bg-[#f3f6fc] dark:bg-[#111116] ring-1 ring-black/[0.05] dark:ring-white/[0.08] text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/35"
                />
              </div>
            </div>
          }
        />

        {/* Direct Inline Category Picker */}
        <div className="bg-white dark:bg-[#18181e] p-3.5 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07] space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            <Sparkles size={12} className="text-indigo-500" />
            <span>Wisdom Category</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUOTE_CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setFormCategory(cat)}
                className={`px-3 py-1.5 text-xs font-bold capitalize transition cursor-pointer ${
                  formCategory === cat
                    ? 'rounded-full bg-indigo-600 text-white shadow-2xs'
                    : 'rounded-[12px] bg-[#f3f6fc] dark:bg-[#111116] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </UnifiedFormModal>

      {/* Lightweight Delete Quote Confirmation Modal */}
      <UnifiedSubModal
        isOpen={Boolean(deletingQuote)}
        onClose={() => setDeletingQuote(null)}
        title="Delete Quote"
        icon={<AlertTriangle size={16} className="text-rose-500" />}
      >
        <div className="bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.05] dark:ring-white/[0.08] space-y-3">
          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
            Remove this quote by{' '}
            <strong className="text-zinc-900 dark:text-white">{deletingQuote?.author}</strong> from
            your library?
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDeletingQuote(null)}
              className="px-4 py-2 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-[#eff2f9] dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteQuote}
              className="px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer"
            >
              Delete Quote
            </button>
          </div>
        </div>
      </UnifiedSubModal>

      {/* Daily Quote Reminder Settings Modal */}
      <UnifiedFormModal
        isOpen={showReminderSettings}
        onClose={() => setShowReminderSettings(false)}
        title="Daily Quote Reminders"
        subtitle="Morning & evening wisdom notifications"
        accentColor="#f59e0b"
        headerIcon={
          <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Bell size={14} />
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowReminderSettings(false)}
              className="px-4 py-2 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-[#eff2f9] dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                handleSaveReminderPreferences(
                  isReminderEnabled,
                  morningReminderTime,
                  eveningReminderTime
                )
              }
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              {saveSuccessMsg ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Schedule</span>
              )}
            </button>
          </div>
        }
      >
        <div className="p-3.5 rounded-[20px] bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07] flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-zinc-900 dark:text-white block">
              Enable Daily Wisdom Alerts
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
              Receive inspiring quotes twice daily
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsReminderEnabled(!isReminderEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
              isReminderEnabled ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                isReminderEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-[20px] bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                <Sun className="w-3.5 h-3.5" />
                <span>Morning</span>
              </div>
              <span className="text-[10.5px] font-bold text-zinc-500 tabular-nums">
                {formatTime12h(morningReminderTime)}
              </span>
            </div>
            <input
              type="time"
              value={morningReminderTime}
              onChange={e => setMorningReminderTime(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-[12px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-semibold text-zinc-900 dark:text-white cursor-pointer outline-none"
            />
          </div>

          <div className="p-3 rounded-[20px] bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                <Moon className="w-3.5 h-3.5" />
                <span>Evening</span>
              </div>
              <span className="text-[10.5px] font-bold text-zinc-500 tabular-nums">
                {formatTime12h(eveningReminderTime)}
              </span>
            </div>
            <input
              type="time"
              value={eveningReminderTime}
              onChange={e => setEveningReminderTime(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-[12px] bg-[#f3f5fa] dark:bg-[#111116] text-xs font-semibold text-zinc-900 dark:text-white cursor-pointer outline-none"
            />
          </div>
        </div>

        <div className="p-3 rounded-[20px] bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07] flex items-center justify-between gap-2">
          {notifPermission === 'granted' ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <Check className="w-3.5 h-3.5" />
              <span>Browser alerts active</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleRequestNotifPermission}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Enable Browser Popups</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleTestNotification}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold transition cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Test Alert</span>
          </button>
        </div>
      </UnifiedFormModal>


      {/* Unified Bulk Import Modal */}
      <UnifiedFormModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        title="Bulk Import Quotes"
        accentColor="#4f46e5"
        headerIcon={
          <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Upload size={14} />
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowBulkImportModal(false)}
              className="px-4 py-2 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-[#eff2f9] dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!bulkImportText.trim()}
              onClick={() => {
                const lines = bulkImportText.split('\n');
                lines.forEach(line => {
                  const parts = line.split(' - ');
                  if (parts.length >= 2) {
                    addQuote({
                      text: parts[0].trim().replace(/^"|"$/g, ''),
                      author: parts[1].trim(),
                      category: 'wisdom',
                    });
                  }
                });
                setBulkImportText('');
                setShowBulkImportModal(false);
                soundEngine.playSuccessChime();
              }}
              className="px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold transition cursor-pointer"
            >
              Import Quotes
            </button>
          </div>
        }
      >
        <div className="bg-white dark:bg-[#18181e] p-3.5 rounded-[22px] ring-1 ring-black/[0.05] dark:ring-white/[0.08] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Paste quotes (Quote - Author per line)
            </span>
            <label className="px-3 py-1 rounded-full bg-[#f3f6fc] dark:bg-zinc-800 text-xs font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer shrink-0">
              <span>Upload JSON/TXT</span>
              <input
                type="file"
                accept=".csv,.json,.txt"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = event => {
                    const content = event.target?.result as string;
                    if (!content) return;
                    if (file.name.endsWith('.json')) {
                      try {
                        const parsed = JSON.parse(content);
                        if (Array.isArray(parsed)) {
                          parsed.forEach(q => {
                            if (q.text && q.author) {
                              addQuote({
                                text: q.text,
                                author: q.author,
                                category: q.category || 'wisdom',
                                source: q.source,
                              });
                            }
                          });
                          setShowBulkImportModal(false);
                          soundEngine.playSuccessChime();
                        }
                      } catch {
                        pushNotification('Import Error', 'Invalid JSON file format.', 'quote');
                      }
                    } else {
                      setBulkImportText(content);
                    }
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
          <textarea
            value={bulkImportText}
            onChange={e => setBulkImportText(e.target.value)}
            placeholder={'Example:\n"Education is the best friend." - Chanakya'}
            className="w-full h-40 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none"
          />
        </div>
      </UnifiedFormModal>
    </div>
  );
};

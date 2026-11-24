import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Quote,
  Search,
  Plus,
  Trash2,
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
  Palette,
  Gauge,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CURATED_QUOTES, QuoteItem } from '../../data/quotes';
import { notificationService } from '../../utils/notifications';
import {
  UnifiedFormModal,
  FormHeroTitleCard,
  UnifiedSubModal,
} from '../common/FormPrimitives';
import { M3SegmentedGroup } from '../common/PetalExpressive';
import { QuoteCard } from './QuoteCard';
import { QuoteHeroCard } from './QuoteHeroCard';
import { CategoryManagerModal } from './CategoryManagerModal';
import { getPaletteByKey } from './quoteColors';
import { buildQuoteNumberMap } from '../../utils/quoteNumbers';
import { formatQuoteForShare, isCustomQuote, toSentenceCase } from '../../utils/quoteText';
import {
  MAX_IMPORT_FILE_BYTES,
  QuoteImportPreview,
} from '../../utils/quoteImport';
import {
  loadQuoteWasm,
  parseAndDeduplicateImportFast,
} from '../../utils/quoteWasm';
import { runQuoteBenchmarks } from '../../utils/perfBench';
import { showAndroidToast } from '../common/AndroidToast';
import {
  QUOTE_REMINDER_ENABLED_KEY,
  QUOTE_REMINDER_EVENING_KEY,
  QUOTE_REMINDER_MORNING_KEY,
  QUOTE_REMINDER_PREFS_EVENT,
} from './QuoteReminderService';

type CategoryFilter = string;
type SourceFilter = 'all' | 'favorites' | 'custom';
type SearchScope = 'all' | 'body' | 'author' | 'source';

const BUILT_IN_QUOTE_IDS = CURATED_QUOTES.map(q => q.id);

export const QuotesManager: React.FC = () => {
  const {
    quotes,
    deletedQuoteIds,
    addQuote,
    addQuotes,
    updateQuote,
    deleteQuote,
    soundEngine,
    favoriteQuoteIds,
    toggleFavoriteQuote,
    quoteCategories,
    getCategoryForQuote,
    theme,
  } = useApp();

  const isDark =
    theme === 'dark' ||
    (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // Debounce search input by 200ms
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Single document-level listener for whichever card/hero popover menu is currently open
  useEffect(() => {
    if (!openMenuKey) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(`[data-quote-menu-root="${openMenuKey}"]`)) {
        return;
      }
      setOpenMenuKey(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuKey(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuKey]);

  const handleToggleMenu = useCallback((menuKey: string) => {
    setOpenMenuKey(prev => (prev === menuKey ? null : menuKey));
  }, []);

  const handleCloseMenu = useCallback(() => {
    setOpenMenuKey(null);
  }, []);

  // Hero offset synced with QuoteBanner.tsx via localStorage
  const [quoteOffset, setQuoteOffset] = useState<number>(() => {
    try {
      const savedOffset = localStorage.getItem('omni_quote_pair_offset');
      const parsed = savedOffset ? parseInt(savedOffset, 10) : 0;
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  });

  // Focused quote opened from WisdomQuote banner
  const [focusedQuoteId, setFocusedQuoteId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('omni_focused_quote_id');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleFocusQuote = (e: Event) => {
      const id = (e as CustomEvent<{ quoteId?: string }>)?.detail?.quoteId;
      if (id) {
        setFocusedQuoteId(id);
      }
    };
    window.addEventListener('omni_focus_quote', handleFocusQuote);
    return () => window.removeEventListener('omni_focus_quote', handleFocusQuote);
  }, []);

  const clearFocusedQuote = useCallback(() => {
    setFocusedQuoteId(null);
    try {
      localStorage.removeItem('omni_focused_quote_id');
    } catch {
      // ignore
    }
  }, []);

  const focusedQuote = useMemo(() => {
    if (!focusedQuoteId) return null;
    return quotes.find(q => q.id === focusedQuoteId) || null;
  }, [quotes, focusedQuoteId]);

  const dayOfYear = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now.getTime() - start.getTime()) / 86400000);
  }, []);

  const heroQuote = useMemo<QuoteItem | null>(() => {
    if (quotes.length === 0) return null;
    if (focusedQuote) return focusedQuote;
    const total = quotes.length;
    const idx = (((dayOfYear + quoteOffset) % total) + total) % total;
    return quotes[idx] || quotes[0];
  }, [quotes, focusedQuote, dayOfYear, quoteOffset]);

  const stepHeroQuote = useCallback(
    (delta: -1 | 1) => {
      const total = quotes.length;
      if (total === 0) return;

      if (focusedQuote) {
        const curIdx = quotes.findIndex(q => q.id === focusedQuote.id);
        const baseIdx = curIdx >= 0 ? curIdx : 0;
        const nextIdx = (((baseIdx + delta) % total) + total) % total;
        const nextOffset = nextIdx - dayOfYear;
        setQuoteOffset(nextOffset);
        try {
          localStorage.setItem('omni_quote_pair_offset', String(nextOffset));
        } catch {
          // ignore
        }
        clearFocusedQuote();
        return;
      }

      setQuoteOffset(prev => {
        const next = prev + delta;
        try {
          localStorage.setItem('omni_quote_pair_offset', String(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [quotes, focusedQuote, dayOfYear, clearFocusedQuote]
  );

  // Modals & Confirmation States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [bulkImportFilename, setBulkImportFilename] = useState<string | undefined>(undefined);
  const [bulkImportPreview, setBulkImportPreview] = useState<QuoteImportPreview | null>(null);
  const [bulkImportError, setBulkImportError] = useState<string | null>(null);
  const [isParsingImport, setIsParsingImport] = useState(false);
  const [editingQuote, setEditingQuote] = useState<QuoteItem | null>(null);
  const [deletingQuote, setDeletingQuote] = useState<QuoteItem | null>(null);
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [isBenchmarkRunning, setIsBenchmarkRunning] = useState(false);

  const triggerVibration = useCallback((pattern: number = 20) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  // Global Quote Reminder Preferences (Persisted in localStorage; firing runs in QuoteReminderService)
  const [isReminderEnabled, setIsReminderEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(QUOTE_REMINDER_ENABLED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [morningReminderTime, setMorningReminderTime] = useState<string>(() => {
    try {
      return localStorage.getItem(QUOTE_REMINDER_MORNING_KEY) || '08:00';
    } catch {
      return '08:00';
    }
  });

  const [eveningReminderTime, setEveningReminderTime] = useState<string>(() => {
    try {
      return localStorage.getItem(QUOTE_REMINDER_EVENING_KEY) || '20:00';
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

  const handleSaveReminderPreferences = (enabled: boolean, morning: string, evening: string) => {
    setIsReminderEnabled(enabled);
    setMorningReminderTime(morning);
    setEveningReminderTime(evening);

    try {
      localStorage.setItem(QUOTE_REMINDER_ENABLED_KEY, String(enabled));
      localStorage.setItem(QUOTE_REMINDER_MORNING_KEY, morning);
      localStorage.setItem(QUOTE_REMINDER_EVENING_KEY, evening);
    } catch (e) {
      console.error('Failed to save quote reminder preferences to localStorage', e);
    }

    window.dispatchEvent(new Event(QUOTE_REMINDER_PREFS_EVENT));

    soundEngine.playSuccessChime();
    setSaveSuccessMsg(true);
    setTimeout(() => {
      setSaveSuccessMsg(false);
      setShowReminderSettings(false);
    }, 800);
  };

  const handleRunBenchmarks = () => {
    if (isBenchmarkRunning) return;
    setIsBenchmarkRunning(true);
    window.setTimeout(() => {
      try {
        const result = runQuoteBenchmarks(quotes, quoteCategories);
        showAndroidToast(result.summary, 4200);
      } catch (err) {
        showAndroidToast(
          err instanceof Error ? err.message : 'Benchmark failed',
          3000
        );
      } finally {
        setIsBenchmarkRunning(false);
      }
    }, 30);
  };

  // Form fields
  const [formText, setFormText] = useState('');
  const [formAuthor, setFormAuthor] = useState('');
  const [formCategory, setFormCategory] = useState<string>('wisdom');
  const [formSource, setFormSource] = useState('');

  // Lazily warm WASM when bulk import modal opens
  useEffect(() => {
    if (showBulkImportModal) {
      loadQuoteWasm().catch(() => {});
    }
  }, [showBulkImportModal]);

  // Parse bulk import preview off the main thread whenever text/filename changes
  useEffect(() => {
    if (!showBulkImportModal) return;
    if (!bulkImportText.trim()) {
      setBulkImportPreview(null);
      setIsParsingImport(false);
      return;
    }

    let cancelled = false;
    setIsParsingImport(true);
    setBulkImportError(null);

    const timer = window.setTimeout(() => {
      parseAndDeduplicateImportFast(
        bulkImportText,
        bulkImportFilename,
        quotes,
        quoteCategories
      )
        .then(preview => {
          if (cancelled) return;
          if (preview.error) {
            setBulkImportError(preview.error);
            setBulkImportPreview(null);
          } else {
            setBulkImportPreview(preview);
          }
          setIsParsingImport(false);
        })
        .catch(() => {
          if (cancelled) return;
          setBulkImportError('Could not read the import text.');
          setBulkImportPreview(null);
          setIsParsingImport(false);
        });
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [showBulkImportModal, bulkImportText, bulkImportFilename, quotes, quoteCategories]);

  // Compute O(1) Set for favourites, counts, stable numbering, and pre-lowercased search index ONCE
  const favoriteQuoteSet = useMemo(() => new Set(favoriteQuoteIds), [favoriteQuoteIds]);

  const quoteIdSet = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < quotes.length; i++) {
      set.add(quotes[i].id);
    }
    return set;
  }, [quotes]);

  // Count only favourites that still exist in the live quotes list
  const favoriteQuotesCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < favoriteQuoteIds.length; i++) {
      if (quoteIdSet.has(favoriteQuoteIds[i])) count++;
    }
    return count;
  }, [favoriteQuoteIds, quoteIdSet]);

  const customQuotesCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < quotes.length; i++) {
      if (isCustomQuote(quotes[i])) count++;
    }
    return count;
  }, [quotes]);

  // Stable deterministic quote numbering (built-in 1..2822, custom 2823+ ranked by creation timestamp)
  const quoteNumberMap = useMemo(() => {
    const customIds: string[] = [];
    for (let i = 0; i < quotes.length; i++) {
      const id = quotes[i].id;
      if (id.startsWith('q_custom_')) {
        customIds.push(id);
      }
    }
    return buildQuoteNumberMap(BUILT_IN_QUOTE_IDS, customIds, deletedQuoteIds);
  }, [quotes, deletedQuoteIds]);

  // Category counts computed once for CategoryManagerModal
  const categoryQuoteCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (let i = 0; i < quotes.length; i++) {
      const resolvedId = getCategoryForQuote(quotes[i]).id;
      counts.set(resolvedId, (counts.get(resolvedId) || 0) + 1);
    }
    return counts;
  }, [quotes, getCategoryForQuote]);

  // Pre-lowercased search index computed once per quotes list change
  const searchIndex = useMemo(() => {
    return quotes.map(q => ({
      quote: q,
      isCustom: isCustomQuote(q),
      textLower: (q.text || '').toLowerCase(),
      authorLower: (q.author || '').toLowerCase(),
      sourceLower: (q.source || '').toLowerCase(),
    }));
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();
    const out: QuoteItem[] = [];

    for (let i = 0; i < searchIndex.length; i++) {
      const entry = searchIndex[i];
      const q = entry.quote;

      if (sourceFilter === 'custom' && !entry.isCustom) {
        continue;
      }
      if (sourceFilter === 'favorites' && !favoriteQuoteSet.has(q.id)) {
        continue;
      }

      if (selectedCategory !== 'all') {
        const resolvedCat = getCategoryForQuote(q);
        if (resolvedCat.id !== selectedCategory) continue;
      }

      if (query) {
        if (searchScope === 'body') {
          if (!entry.textLower.includes(query)) continue;
        } else if (searchScope === 'author') {
          if (!entry.authorLower.includes(query)) continue;
        } else if (searchScope === 'source') {
          if (!entry.sourceLower.includes(query)) continue;
        } else {
          if (
            !entry.textLower.includes(query) &&
            !entry.authorLower.includes(query) &&
            !entry.sourceLower.includes(query)
          ) {
            continue;
          }
        }
      }

      out.push(q);
    }

    return out;
  }, [
    searchIndex,
    selectedCategory,
    debouncedSearchQuery,
    searchScope,
    sourceFilter,
    favoriteQuoteSet,
    getCategoryForQuote,
  ]);

  const totalPages = Math.ceil(filteredQuotes.length / itemsPerPage) || 1;
  const paginatedQuotes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredQuotes.slice(start, start + itemsPerPage);
  }, [filteredQuotes, currentPage, itemsPerPage]);

  // Clamp current page if filtered count shrinks
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleShare = useCallback(
    async (id: string, text: string, author: string, source?: string) => {
      const shareText = formatQuoteForShare({ text, author, source });

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
    },
    [soundEngine]
  );

  const handleCopy = useCallback(
    async (id: string, text: string, author: string, source?: string) => {
      const copyText = formatQuoteForShare({ text, author, source });
      await navigator.clipboard.writeText(copyText);
      setCopiedId(id);
      soundEngine.playSuccessChime();
      setTimeout(() => setCopiedId(null), 1800);
    },
    [soundEngine]
  );

  const handleFavoriteCard = useCallback(
    (id: string) => {
      triggerVibration();
      toggleFavoriteQuote(id);
    },
    [triggerVibration, toggleFavoriteQuote]
  );

  const handleCopyCard = useCallback(
    (q: QuoteItem) => {
      triggerVibration();
      handleCopy(q.id, q.text, q.author, q.source);
    },
    [triggerVibration, handleCopy]
  );

  const handleShareCard = useCallback(
    (q: QuoteItem) => {
      triggerVibration();
      handleShare(q.id, q.text, q.author, q.source);
    },
    [triggerVibration, handleShare]
  );

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

  const openEditModal = useCallback(
    (q: QuoteItem) => {
      setEditingQuote(q);
      setFormText(q.text);
      setFormAuthor(q.author);
      setFormCategory(getCategoryForQuote(q).id);
      setFormSource(q.source || '');
    },
    [getCategoryForQuote]
  );

  const handleRequestDeleteCard = useCallback(
    (q: QuoteItem) => {
      triggerVibration();
      setDeletingQuote(q);
    },
    [triggerVibration]
  );

  const handleSubmitAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formText.trim() || !formAuthor.trim()) return;

    addQuote({
      text: formText.trim(),
      author: formAuthor.trim(),
      category: formCategory || 'wisdom',
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
      category: formCategory || 'wisdom',
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

  // Kept for backward compatibility; quote cards now use quoteColors.ts + quoteCategories
  const getCategoryTheme = (cat: string) => {
    switch (cat) {
      case 'habits':
        return {
          text: 'text-emerald-600 dark:text-emerald-400',
          hex: '#10b981',
        };
      case 'discipline':
        return {
          text: 'text-rose-600 dark:text-rose-400',
          hex: '#f43f5e',
        };
      case 'stoicism':
        return {
          text: 'text-purple-600 dark:text-purple-400',
          hex: '#a855f7',
        };
      case 'focus':
        return {
          text: 'text-sky-600 dark:text-sky-400',
          hex: '#0ea5e9',
        };
      case 'health':
        return {
          text: 'text-teal-600 dark:text-teal-400',
          hex: '#14b8a6',
        };
      case 'mindset':
        return {
          text: 'text-indigo-600 dark:text-indigo-400',
          hex: '#6366f1',
        };
      case 'wisdom':
      default:
        return {
          text: 'text-amber-600 dark:text-amber-400',
          hex: '#f59e0b',
        };
    }
  };
  void getCategoryTheme;

  const cycleSearchScope = () => {
    const scopes: SearchScope[] = ['all', 'body', 'author', 'source'];
    const nextIdx = (scopes.indexOf(searchScope) + 1) % scopes.length;
    setSearchScope(scopes[nextIdx]);
    setCurrentPage(1);
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setBulkImportError('File is larger than 2 MB. Please split it into a smaller file.');
      setBulkImportPreview(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      const content = typeof event.target?.result === 'string' ? event.target.result : '';
      if (!content) {
        setBulkImportError('File is empty or could not be read.');
        return;
      }
      setBulkImportError(null);
      setBulkImportFilename(file.name);
      setBulkImportText(content);
    };
    reader.onerror = () => {
      setBulkImportError('Failed to read the selected file.');
    };
    reader.readAsText(file);
  };

  const handleConfirmBulkImport = () => {
    if (!bulkImportPreview || bulkImportPreview.items.length === 0) return;
    addQuotes(bulkImportPreview.items);
    setBulkImportText('');
    setBulkImportFilename(undefined);
    setBulkImportPreview(null);
    setBulkImportError(null);
    setShowBulkImportModal(false);
  };

  const heroCategory = heroQuote ? getCategoryForQuote(heroQuote) : null;

  return (
    <div className="space-y-1.5 flex-1 flex flex-col min-h-full pb-24 sm:pb-10 w-full min-w-0 animate-in fade-in duration-200">
      {/* Large Featured Hero Quote Card (Always shown above control card with 8px gap below) */}
      {heroQuote && heroCategory && (
        <QuoteHeroCard
          quote={heroQuote}
          number={quoteNumberMap.get(heroQuote.id)}
          categoryName={heroCategory.name}
          colorKey={heroCategory.color}
          isFavorite={favoriteQuoteSet.has(heroQuote.id)}
          isCopied={copiedId === heroQuote.id}
          isDark={isDark}
          isMenuOpen={openMenuKey === `hero:${heroQuote.id}`}
          onToggleMenu={handleToggleMenu}
          onCloseMenu={handleCloseMenu}
          onPrev={() => stepHeroQuote(-1)}
          onNext={() => stepHeroQuote(1)}
          onFavorite={handleFavoriteCard}
          onCopy={handleCopyCard}
          onShare={handleShareCard}
          onEdit={openEditModal}
          onDelete={handleRequestDeleteCard}
        />
      )}

      {/* Material 3 Expressive Compact Control Card */}
      <div
        data-m3-tonal-card="true"
        data-tonal-tone="neutral"
        className="w-full min-w-0 max-w-full overflow-hidden p-1.5 sm:p-2 rounded-[18px] space-y-1"
      >
        {/* Row 1: Compact Search Pill + Reminders / Import / Export / + Button */}
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
                    setDebouncedSearchQuery('');
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

        {/* Row 2: M3 Expressive Segmented Source Filter + Dynamic Topic Chips + Manage Categories */}
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

          {/* Horizontally Scrollable Dynamic M3 Topic Chips */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setCurrentPage(1);
              }}
              className={`h-7 px-2.5 text-[11px] font-bold transition-all shrink-0 cursor-pointer whitespace-nowrap inline-flex items-center gap-1 border ${
                selectedCategory === 'all'
                  ? 'rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 border-indigo-500/40 dark:border-indigo-400/40 shadow-2xs'
                  : 'rounded-[11px] bg-[#f3f6fc] dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200/80 dark:border-zinc-700/80 hover:bg-slate-200/70 dark:hover:bg-zinc-800'
              }`}
            >
              {selectedCategory === 'all' && <Check className="w-3 h-3 stroke-[2.75] shrink-0" />}
              <span>All Topics</span>
            </button>

            {quoteCategories.map(cat => {
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
                  <span>{cat.name}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setShowCategoryManager(true)}
              className="h-7 px-2.5 text-[11px] font-bold transition-all shrink-0 cursor-pointer whitespace-nowrap inline-flex items-center gap-1 border rounded-[11px] bg-[#f3f6fc] dark:bg-zinc-900 text-indigo-600 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/70 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
            >
              <Palette className="w-3 h-3 shrink-0" />
              <span>Manage categories</span>
            </button>
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

      {/* Quotes Adaptive Dense Grid */}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-4 gap-[10px] [grid-auto-flow:dense] w-full min-w-0">
          {paginatedQuotes.map(q => {
            const resolvedCat = getCategoryForQuote(q);
            return (
              <QuoteCard
                key={q.id}
                quote={q}
                number={quoteNumberMap.get(q.id)}
                categoryName={resolvedCat.name}
                colorKey={resolvedCat.color}
                isFavorite={favoriteQuoteSet.has(q.id)}
                isCopied={copiedId === q.id}
                isDark={isDark}
                isMenuOpen={openMenuKey === `card:${q.id}`}
                onToggleMenu={handleToggleMenu}
                onCloseMenu={handleCloseMenu}
                onFavorite={handleFavoriteCard}
                onCopy={handleCopyCard}
                onShare={handleShareCard}
                onEdit={openEditModal}
                onDelete={handleRequestDeleteCard}
              />
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

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        isDark={isDark}
        categoryQuoteCounts={categoryQuoteCounts}
        onCategoryDeleted={deletedId => {
          if (selectedCategory === deletedId) {
            setSelectedCategory('all');
            setCurrentPage(1);
          }
        }}
      />

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

        {/* Dynamic Live Category Picker (with colour dot + name) */}
        <div className="bg-white dark:bg-[#18181e] p-3.5 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07] space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            <Sparkles size={12} className="text-indigo-500" />
            <span>Wisdom Category</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quoteCategories.map(cat => {
              const p = getPaletteByKey(cat.color);
              const selected = formCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFormCategory(cat.id)}
                  className={`px-3 py-1.5 text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${
                    selected
                      ? 'rounded-full bg-indigo-600 text-white shadow-2xs'
                      : 'rounded-[12px] bg-[#f3f6fc] dark:bg-[#111116] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: isDark ? p.bgDark : p.bg,
                      border: selected
                        ? '1px solid rgba(255,255,255,0.65)'
                        : isDark
                        ? '1px solid rgba(255,255,255,0.25)'
                        : '1px solid rgba(0,0,0,0.2)',
                    }}
                    aria-hidden="true"
                  />
                  <span>{cat.name}</span>
                </button>
              );
            })}
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

        {/* Hidden developer-only benchmark trigger */}
        <details className="px-1 pt-1">
          <summary className="text-[10.5px] text-zinc-400 dark:text-zinc-500 cursor-pointer select-none">
            Developer diagnostics
          </summary>
          <div className="mt-2">
            <button
              type="button"
              disabled={isBenchmarkRunning}
              onClick={handleRunBenchmarks}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-[11px] font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>{isBenchmarkRunning ? 'Running benchmark…' : 'Run quote benchmark'}</span>
            </button>
          </div>
        </details>
      </UnifiedFormModal>

      {/* Unified Bulk Import Modal (Real CSV / JSON / TXT with Preview & Deduplication) */}
      <UnifiedFormModal
        isOpen={showBulkImportModal}
        onClose={() => {
          setShowBulkImportModal(false);
          setBulkImportError(null);
        }}
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
              onClick={() => {
                setShowBulkImportModal(false);
                setBulkImportError(null);
              }}
              className="px-4 py-2 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-[#eff2f9] dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                isParsingImport ||
                !bulkImportPreview ||
                bulkImportPreview.items.length === 0
              }
              onClick={handleConfirmBulkImport}
              className="px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold transition cursor-pointer"
            >
              {bulkImportPreview && bulkImportPreview.items.length > 0
                ? `Import ${bulkImportPreview.items.length.toLocaleString()} ${
                    bulkImportPreview.items.length === 1 ? 'quote' : 'quotes'
                  }`
                : 'Import Quotes'}
            </button>
          </div>
        }
      >
        <div className="bg-white dark:bg-[#18181e] p-3.5 rounded-[22px] ring-1 ring-black/[0.05] dark:ring-white/[0.08] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Paste quotes or upload CSV / JSON / TXT
            </span>
            <label className="px-3 py-1 rounded-full bg-[#f3f6fc] dark:bg-zinc-800 text-xs font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer shrink-0">
              <span>Upload CSV/JSON/TXT</span>
              <input
                type="file"
                accept=".csv,.json,.txt"
                className="hidden"
                onChange={handleBulkFileChange}
              />
            </label>
          </div>

          <textarea
            value={bulkImportText}
            onChange={e => {
              setBulkImportFilename(undefined);
              setBulkImportError(null);
              setBulkImportText(e.target.value);
            }}
            placeholder={
              'Examples:\n"Education is the best friend." - Chanakya | Wisdom | Chanakya Neeti\nQuote,Author,Category,Source\n"Stay focused.",Marcus Aurelius,Stoicism,Meditations'
            }
            className="w-full h-36 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none"
          />

          {bulkImportError && (
            <p className="text-[11.5px] font-semibold text-rose-600 dark:text-rose-400">
              {bulkImportError}
            </p>
          )}

          {isParsingImport && (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Scanning quotes and checking duplicates…
            </p>
          )}

          {!isParsingImport && bulkImportPreview && (
            <div className="p-2.5 rounded-xl bg-[#f3f6fc] dark:bg-[#111116] ring-1 ring-black/[0.05] dark:ring-white/[0.07] space-y-1.5">
              <p className="text-[11.5px] font-bold text-zinc-800 dark:text-zinc-100 tabular-nums">
                Found {bulkImportPreview.items.length.toLocaleString()}{' '}
                {bulkImportPreview.items.length === 1 ? 'quote' : 'quotes'}, skipped{' '}
                {bulkImportPreview.skippedCount.toLocaleString()} (duplicates or empty)
              </p>

              {bulkImportPreview.items.length > 0 && (
                <ul className="space-y-1 max-h-36 overflow-y-auto">
                  {bulkImportPreview.items.slice(0, 5).map((item, idx) => (
                    <li
                      key={idx}
                      className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-snug border-t border-zinc-200/70 dark:border-zinc-800 pt-1 first:border-t-0 first:pt-0"
                    >
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        “{item.text}”
                      </span>{' '}
                      <span className="opacity-80">— {item.author}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </UnifiedFormModal>
    </div>
  );
};

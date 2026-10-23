import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ColorThemeService } from '../../utils/ColorThemeService';
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
  Filter,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  User,
  Heart,
  Clock,
  Download,
  Upload,
  Palette,
  Type,
  Sliders,
  Sun,
  Moon,
  Bell,
  BellRing,
  Volume2,
  Settings,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { QuoteItem } from '../../data/quotes';
import { QuoteBanner } from '../common/QuoteBanner';
import { notificationService } from '../../utils/notifications';

type CategoryFilter = 'all' | 'discipline' | 'mindset' | 'focus' | 'stoicism' | 'health' | 'wisdom' | 'habits';
type SourceFilter = 'all' | 'favorites' | 'custom';
type SearchScope = 'all' | 'body' | 'author' | 'source';

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
  } = useApp();

  const isDark = theme === 'dark' || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals & Confirmation States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [editingQuote, setEditingQuote] = useState<QuoteItem | null>(null);
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [showViewSettings, setShowViewSettings] = useState(false);
  const [showGlobalCustomization, setShowGlobalCustomization] = useState(false);
  const [activeTab, setActiveTab] = useState<'quotes' | 'categories' | 'settings'>('quotes');
  const [transitionStyle, setTransitionStyle] = useState<'fade' | 'slide' | 'scale'>(() => {
    try {
      return (localStorage.getItem('omni_quote_transition_style') as 'fade' | 'slide' | 'scale') || 'fade';
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

  // Customization Settings State
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

  const [quoteCardBg, setQuoteCardBg] = useState<string>(() => {
    try {
      return localStorage.getItem('omni_quote_card_bg') || '';
    } catch {
      return '';
    }
  });

  // Staging / Draft state for View Settings modal (so main cards don't change until Done)
  const [draftFontScale, setDraftFontScale] = useState<number>(quoteFontScale);
  const [draftFontFamily, setDraftFontFamily] = useState<string>(quoteFontFamily);
  const [draftCardBg, setDraftCardBg] = useState<string>(quoteCardBg);
  const [draftTransitionStyle, setDraftTransitionStyle] = useState<'fade' | 'slide' | 'scale'>(transitionStyle);
  const [animTrigger, setAnimTrigger] = useState(0);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--quote-font-scale', String(quoteFontScale));
      document.documentElement.style.setProperty('--quote-font-family', quoteFontFamily);
      if (quoteCardBg && quoteCardBg !== 'default') {
        const resolved = ColorThemeService.resolveColor(quoteCardBg, isDark);
        const resolvedBorder = ColorThemeService.resolveBorderColor(quoteCardBg, isDark);
        document.documentElement.style.setProperty('--quote-card-bg', resolved);
        document.documentElement.style.setProperty('--quote-card-border', resolvedBorder);
      } else {
        document.documentElement.style.removeProperty('--quote-card-bg');
        document.documentElement.style.removeProperty('--quote-card-border');
      }
    }
  }, [quoteFontScale, quoteFontFamily, quoteCardBg, isDark]);

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e.detail) {
        if (e.detail.fontScale !== undefined) {
          setQuoteFontScale(e.detail.fontScale);
          setDraftFontScale(e.detail.fontScale);
        }
        if (e.detail.fontFamily !== undefined) {
          setQuoteFontFamily(e.detail.fontFamily);
          setDraftFontFamily(e.detail.fontFamily);
        }
        if (e.detail.cardBg !== undefined) {
          setQuoteCardBg(e.detail.cardBg);
          setDraftCardBg(e.detail.cardBg);
        }
        if (e.detail.transitionStyle !== undefined) {
          setTransitionStyle(e.detail.transitionStyle);
          setDraftTransitionStyle(e.detail.transitionStyle);
        }
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

  // 12-Hour Format Helper
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

  // Active Quote Reminder Scheduler Effect - ticks continuously to check exact HH:MM
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
    }, 1000);
  };

  // Form fields
  const [formText, setFormText] = useState('');
  const [formAuthor, setFormAuthor] = useState('');
  const [formCategory, setFormCategory] = useState<QuoteItem['category']>('wisdom');
  const [formSource, setFormSource] = useState('');

  // Confirmation state: holds pending action details
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    type: 'add' | 'edit' | 'delete';
    title: string;
    message: string;
    quoteId?: string;
    payload?: Partial<QuoteItem>;
  } | null>(null);
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false);

  const categories: { id: CategoryFilter; label: string; color: string }[] = [
    { id: 'all', label: 'All Quotes', color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
    { id: 'discipline', label: 'Discipline', color: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' },
    { id: 'mindset', label: 'Mindset', color: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300' },
    { id: 'focus', label: 'Focus', color: 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300' },
    { id: 'stoicism', label: 'Stoicism', color: 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300' },
    { id: 'health', label: 'Health', color: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' },
    { id: 'wisdom', label: 'Wisdom', color: 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300' },
    { id: 'habits', label: 'Habits', color: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300' },
  ];

  const isUserQuote = (q: QuoteItem) => {
    return Boolean(q.isCustom || q.id.startsWith('q_custom_') || (q.id.startsWith('q_') && q.id.length > 10));
  };

  const customQuotesCount = useMemo(() => quotes.filter(isUserQuote).length, [quotes]);

  // Index map to quickly display quote position out of total (e.g. 213/2849)
  const quoteIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    quotes.forEach((q, idx) => {
      map.set(q.id, idx + 1);
    });
    return map;
  }, [quotes]);

  const favoriteQuotesCount = useMemo(() => favoriteQuoteIds.length, [favoriteQuoteIds]);

  // Filter & Search
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
        // 'all'
        return (
          q.text.toLowerCase().includes(query) ||
          q.author.toLowerCase().includes(query) ||
          Boolean(q.source && q.source.toLowerCase().includes(query))
        );
      }
    });
  }, [quotes, selectedCategory, searchQuery, searchScope, sourceFilter, favoriteQuoteIds]);

  // Pagination
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
      } catch (err) {
        // Fallback to copy if share cancelled or failed
      }
    }
    
    await navigator.clipboard.writeText(shareText);
    setCopiedId(id);
    soundEngine.playSuccessChime();
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(quotes, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `quotes_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    soundEngine.playSuccessChime();
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Text", "Author", "Category", "Source"];
    const rows = quotes.map(q => [
      q.id,
      `"${q.text.replace(/"/g, '""')}"`,
      `"${q.author.replace(/"/g, '""')}"`,
      q.category,
      `"${(q.source || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `quotes_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    soundEngine.playSuccessChime();
  };

  const handleExportHTML = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>OmniLifeOS - Quotes Library</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b; background: #f8fafc; }
  h1 { font-size: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
  .quote-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .quote-text { font-size: 16px; font-weight: 600; line-height: 1.4; margin-bottom: 8px; }
  .quote-meta { font-size: 12px; color: #64748b; display: flex; gap: 8px; align-items: center; }
  .badge { background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 9999px; font-weight: 700; text-transform: uppercase; font-size: 10px; }
</style>
</head>
<body>
  <h1>Quotes & Daily Wisdom (${quotes.length})</h1>
  ${quotes.map(q => `
    <div class="quote-card">
      <div class="quote-text">"${q.text}"</div>
      <div class="quote-meta">
        <span class="badge">${q.category}</span>
        <span>— ${q.author}</span>
        ${q.source ? `<span>• ${q.source}</span>` : ''}
      </div>
    </div>
  `).join('')}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `quotes_export_${new Date().toISOString().split('T')[0]}.html`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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

  // Submit Add Form -> Triggers Confirmation
  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formText.trim() || !formAuthor.trim()) return;

    setPendingConfirmation({
      type: 'add',
      title: 'Confirm New Quote',
      message: `Are you sure you want to add this quote by "${formAuthor.trim()}" to your wisdom library?`,
      payload: {
        text: formText.trim(),
        author: formAuthor.trim(),
        category: formCategory,
        source: formSource.trim() || undefined,
      },
    });
  };

  // Submit Edit Form -> Triggers Confirmation
  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuote || !formText.trim() || !formAuthor.trim()) return;

    setPendingConfirmation({
      type: 'edit',
      title: 'Confirm Quote Changes',
      message: `Are you sure you want to save your updates to this quote by "${formAuthor.trim()}"?`,
      quoteId: editingQuote.id,
      payload: {
        text: formText.trim(),
        author: formAuthor.trim(),
        category: formCategory,
        source: formSource.trim() || undefined,
      },
    });
  };

  // Click Delete -> Triggers Confirmation
  const requestDelete = (q: QuoteItem) => {
    setIsDeleteConfirmed(false);
    setPendingConfirmation({
      type: 'delete',
      title: 'Delete Quote Confirmation',
      message: `Are you sure you want to permanently delete this quote by "${q.author}"? This action cannot be undone.`,
      quoteId: q.id,
    });
  };

  // Execute Confirmed Action
  const executePendingAction = () => {
    if (!pendingConfirmation) return;

    if (pendingConfirmation.type === 'add' && pendingConfirmation.payload) {
      addQuote({
        text: pendingConfirmation.payload.text || '',
        author: pendingConfirmation.payload.author || '',
        category: (pendingConfirmation.payload.category as QuoteItem['category']) || 'wisdom',
        source: pendingConfirmation.payload.source,
      });
      setShowAddModal(false);
    } else if (pendingConfirmation.type === 'edit' && pendingConfirmation.quoteId && pendingConfirmation.payload) {
      updateQuote({
        id: pendingConfirmation.quoteId,
        text: pendingConfirmation.payload.text || '',
        author: pendingConfirmation.payload.author || '',
        category: (pendingConfirmation.payload.category as QuoteItem['category']) || 'wisdom',
        source: pendingConfirmation.payload.source,
      });
      setEditingQuote(null);
    } else if (pendingConfirmation.type === 'delete' && pendingConfirmation.quoteId) {
      deleteQuote(pendingConfirmation.quoteId);
    }

    setPendingConfirmation(null);
    setIsDeleteConfirmed(false);
  };

  const getCategoryTheme = (cat: string) => {
    switch (cat) {
      case 'habits':
        return {
          badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
          dot: 'bg-emerald-500',
        };
      case 'discipline':
        return {
          badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
          dot: 'bg-rose-500',
        };
      case 'stoicism':
        return {
          badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
          dot: 'bg-purple-500',
        };
      case 'focus':
        return {
          badge: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
          dot: 'bg-cyan-500',
        };
      case 'health':
        return {
          badge: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20',
          dot: 'bg-teal-500',
        };
      case 'mindset':
        return {
          badge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
          dot: 'bg-indigo-500',
        };
      case 'wisdom':
      default:
        return {
          badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
          dot: 'bg-amber-500',
        };
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'discipline':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'mindset':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case 'focus':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'stoicism':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'health':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'habits':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800';
    }
  };

  // Helper to convert text to sentence case
  const toSentenceCase = (text: string) => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  return (
    <div className="space-y-2 sm:space-y-3 max-w-7xl mx-auto pb-8 px-2 sm:px-4">
      {/* Top Header */}
      <div className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-row items-center justify-between gap-2 w-full min-w-0 max-w-full relative z-20">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-600/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-2xs">
            <Quote className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                Quotes & Inspiration
              </h2>
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                {quotes.length.toLocaleString()} Quotes
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-normal leading-tight truncate">
              Daily wisdom and motivating quotes
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5 shrink-0 ml-auto">
          <button
            onClick={() => setShowReminderSettings(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold shadow-xs transition active:scale-95 shrink-0 whitespace-nowrap cursor-pointer ${
              isReminderEnabled
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
            }`}
            title="Configure morning and evening quote reminder times"
          >
            <Bell className={`w-3.5 h-3.5 ${isReminderEnabled ? 'text-amber-600 dark:text-amber-400 fill-amber-500/20' : ''}`} />
            <span>
              {isReminderEnabled
                ? `Reminders On (${formatTime12h(morningReminderTime)} & ${formatTime12h(eveningReminderTime)})`
                : 'Set Reminders'}
            </span>
          </button>
          <button
            onClick={() => {
              setDraftFontScale(quoteFontScale);
              setDraftFontFamily(quoteFontFamily);
              setDraftCardBg(quoteCardBg);
              setDraftTransitionStyle(transitionStyle);
              setShowViewSettings(true);
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] sm:text-xs font-semibold shadow-xs transition active:scale-95 shrink-0 whitespace-nowrap"
            title="Configure settings"
          >
            <Settings className="w-3 h-3" />
            <span>Settings</span>
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition active:scale-95 shrink-0 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Quote</span>
          </button>
        </div>
      </div>

      {/* Daily Wisdom Widget (Positioned under the top quotes header) */}
      <QuoteBanner />

      {/* Search & Category Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-2 sm:p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2 overflow-x-hidden">
        {/* Source Filter: All Quotes vs Favorites vs User-Added Quotes */}
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 overflow-x-auto">
          <div className="flex items-center gap-1.5 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs shrink-0">
            <button
              id="filter-all-quotes"
              type="button"
              onClick={() => {
                setSourceFilter('all');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition ${
                sourceFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
              <span>All Quotes</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 font-mono">
                {quotes.length.toLocaleString()}
              </span>
            </button>

            <button
              id="filter-favorite-quotes"
              type="button"
              onClick={() => {
                setSourceFilter('favorites');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition ${
                sourceFilter === 'favorites'
                  ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 text-rose-500 ${
                  favoriteQuotesCount > 0 ? 'fill-rose-500' : ''
                }`}
              />
              <span>Saved</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  favoriteQuotesCount > 0
                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}
              >
                {favoriteQuotesCount}
              </span>
            </button>

            <button
              id="filter-user-quotes"
              type="button"
              onClick={() => {
                setSourceFilter('custom');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition ${
                sourceFilter === 'custom'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Custom</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  customQuotesCount > 0
                    ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}
              >
                {customQuotesCount}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {sourceFilter === 'favorites' && (
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <Heart className="w-3 h-3 fill-rose-500" />
                <span>Showing {favoriteQuotesCount} liked & favorite {favoriteQuotesCount === 1 ? 'quote' : 'quotes'}</span>
              </span>
            )}
            {sourceFilter === 'custom' && (
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                Showing {customQuotesCount} manually added {customQuotesCount === 1 ? 'quote' : 'quotes'}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  searchScope === 'body'
                    ? 'Search quote body text only...'
                    : searchScope === 'author'
                    ? 'Search by name of the person who said it...'
                    : searchScope === 'source'
                    ? 'Search by book, parva, chapter, or origin...'
                    : 'Search quotes by quote body, person, or book...'
                }
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Search Target Scope Filter: All Fields | Quote Body | Person / Author | Book / Source */}
          <div className="flex items-center gap-1.5 overflow-x-auto scroll-contain pb-2 pt-1 text-xs whitespace-nowrap">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mr-1 flex items-center gap-1 shrink-0">
              <Filter className="w-3 h-3" />
              <span>Search in:</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchScope('all');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition text-xs ${
                searchScope === 'all'
                  ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All Fields
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchScope('body');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition text-xs ${
                searchScope === 'body'
                  ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Quote Body
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchScope('author');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition text-xs ${
                searchScope === 'author'
                  ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Person / Author
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchScope('source');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition text-xs ${
                searchScope === 'source'
                  ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Book / Source
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 pt-1 text-xs">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Meta & Pagination Header */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-2">
        <span>
          Showing{' '}
          <strong className="text-slate-900 dark:text-white">
            {filteredQuotes.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} -{' '}
            {Math.min(currentPage * itemsPerPage, filteredQuotes.length)}
          </strong>{' '}
          of <strong className="text-slate-900 dark:text-white">{filteredQuotes.length}</strong> matching quotes
        </span>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-semibold text-slate-700 dark:text-slate-300">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Quote Grid */}
      {paginatedQuotes.length === 0 ? (
        sourceFilter === 'favorites' && favoriteQuotesCount === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-rose-200 dark:border-rose-900/60 p-8 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
              <Heart className="w-8 h-8 fill-rose-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Favorite Quotes Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                Click the heart micro-button on any quote card across the library to save and organize your favorite inspiring quotes right here.
              </p>
            </div>
            <button
              onClick={() => {
                setSourceFilter('all');
                setCurrentPage(1);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-white text-xs font-bold transition active:scale-95 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Explore All Quotes</span>
            </button>
          </div>
        ) : sourceFilter === 'custom' && customQuotesCount === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-indigo-200 dark:border-indigo-900/60 p-8 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">No User-Added Quotes Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                You haven't manually added any quotes yet. Add your favorite book passages, personal mottos, or affirmations to expand your personal wisdom library.
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Your First Quote</span>
            </button>
          </div>
        ) : (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8">
            <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No quotes found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Try adjusting your search query, changing the search scope, or clearing filters.
            </p>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-1 max-w-4xl mx-auto w-full">
          {paginatedQuotes.map(q => {
            const isCopied = copiedId === q.id;
            const isFav = isQuoteFavorited(q.id);
            const theme = getCategoryTheme(q.category);
            const quoteNum = quoteIndexMap.get(q.id) || 1;
            return (
              <div
                key={`${q.id}-${transitionStyle}`}
                data-quote-card="true"
                data-custom-bg="true"
                className={`group relative flex flex-col justify-center p-2 rounded border transition-all text-left shadow-2xs ${
                  transitionStyle === 'slide'
                    ? 'quote-transition-slide'
                    : transitionStyle === 'scale'
                      ? 'quote-transition-scale'
                      : 'quote-transition-fade'
                } duration-300 hover:border-indigo-400 dark:hover:border-indigo-500`}
                style={{
                  backgroundColor: ColorThemeService.resolveColor(quoteCardBg, isDark),
                  borderColor: ColorThemeService.resolveBorderColor(quoteCardBg, isDark),
                  '--preview-card-bg': ColorThemeService.resolveColor(quoteCardBg, isDark),
                  '--preview-card-border': ColorThemeService.resolveBorderColor(quoteCardBg, isDark),
                } as React.CSSProperties}
              >
                {/* Top line metadata: Category + Number + Author */}
                <div className="flex items-center justify-between gap-1 text-[9px] mb-0.5">
                  <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                    <span
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.1 rounded-full text-[9px] font-bold border ${theme.badge} capitalize shrink-0`}
                    >
                      <span className={`w-1 h-1 rounded-full ${theme.dot}`} />
                      {q.category}
                    </span>
                    <span className="inline-flex items-center px-1 py-0.1 rounded-full text-[9px] font-mono font-bold bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-300/70 dark:border-slate-600/70 shrink-0">
                      {quoteNum}/{quotes.length}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600 shrink-0">•</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate text-[10px]" title={`— ${q.author}`}>
                      {q.author}
                    </span>
                    {q.source && (
                      <span className="text-[9px] text-slate-400 not-italic truncate hidden lg:inline shrink-0" title={q.source}>
                        ({q.source})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        triggerVibration();
                        toggleFavoriteQuote(q.id);
                      }}
                      className={`p-0.5 rounded-sm transition shrink-0 cursor-pointer ${
                        isFav
                          ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60'
                          : 'text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                      title={isFav ? 'Saved' : 'Save'}
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
                        handleShare(q.id, q.text, q.author);
                      }}
                      className="p-0.5 rounded-sm text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition shrink-0 cursor-pointer"
                      title="Share quote"
                    >
                      {isCopied ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Share2 className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerVibration();
                        openEditModal(q);
                      }}
                      className="p-0.5 rounded-sm text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition shrink-0 cursor-pointer"
                      title="Edit Quote"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerVibration();
                        requestDelete(q);
                      }}
                      className="p-0.5 rounded-sm text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition shrink-0 cursor-pointer"
                      title="Delete Quote"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <p 
                  className="font-bold text-slate-800 dark:text-slate-100 leading-tight transition-all duration-300 ease-out"
                  style={{
                    fontSize: `${quoteFontScale * 0.75}rem`,
                    fontFamily: quoteFontFamily
                  }}
                >
                  "{toSentenceCase(q.text)}"
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            disabled={currentPage === 1}
            onClick={() => {
              setCurrentPage(prev => Math.max(1, prev - 1));
            }}
            className="flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-3">
            Page {currentPage} of {totalPages}
          </span>

          <button
            disabled={currentPage === totalPages}
            onClick={() => {
              setCurrentPage(prev => Math.min(totalPages, prev + 1));
            }}
            className="flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add Quote Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add New Quote</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Quote Text *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter inspirational quote..."
                  value={formText}
                  onChange={e => setFormText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Author *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Marcus Aurelius"
                    value={formAuthor}
                    onChange={e => setFormAuthor(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as QuoteItem['category'])}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                  >
                    <option value="discipline">Discipline</option>
                    <option value="mindset">Mindset</option>
                    <option value="focus">Focus</option>
                    <option value="stoicism">Stoicism</option>
                    <option value="health">Health</option>
                    <option value="wisdom">Wisdom</option>
                    <option value="habits">Habits</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Source / Book (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Meditations, Atomic Habits"
                  value={formSource}
                  onChange={e => setFormSource(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition"
                >
                  Proceed to Confirmation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Quote Modal */}
      {editingQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Quote</h3>
              </div>
              <button
                onClick={() => setEditingQuote(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Quote Text *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formText}
                  onChange={e => setFormText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Author *
                  </label>
                  <input
                    type="text"
                    required
                    value={formAuthor}
                    onChange={e => setFormAuthor(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as QuoteItem['category'])}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="discipline">Discipline</option>
                    <option value="mindset">Mindset</option>
                    <option value="focus">Focus</option>
                    <option value="stoicism">Stoicism</option>
                    <option value="health">Health</option>
                    <option value="wisdom">Wisdom</option>
                    <option value="habits">Habits</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Source / Book
                </label>
                <input
                  type="text"
                  value={formSource}
                  onChange={e => setFormSource(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingQuote(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
                >
                  Proceed to Confirmation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daily Quote Reminder Settings Modal */}
      {showReminderSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Bell className="w-4 h-4 fill-amber-500/20" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    Daily Quote Reminders
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Schedule automatic morning & evening wisdom notifications
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReminderSettings(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Master Toggle */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850/80 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Enable Global Notifications
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  Receive inspiring quotes twice a day at your chosen times
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsReminderEnabled(!isReminderEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  isReminderEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                    isReminderEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Time Pickers Grid */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Notification Schedule
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Morning Time Picker */}
                <div className="p-3 rounded-2xl bg-amber-500/5 dark:bg-amber-950/30 border border-amber-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                      <span>Morning Quote</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                      {formatTime12h(morningReminderTime)}
                    </span>
                  </div>
                  <input
                    type="time"
                    value={morningReminderTime}
                    onChange={(e) => setMorningReminderTime(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
                  />
                </div>

                {/* Evening Time Picker */}
                <div className="p-3 rounded-2xl bg-indigo-500/5 dark:bg-indigo-950/30 border border-indigo-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      <Moon className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Evening Quote</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200">
                      {formatTime12h(eveningReminderTime)}
                    </span>
                  </div>
                  <input
                    type="time"
                    value={eveningReminderTime}
                    onChange={(e) => setEveningReminderTime(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Active Schedule Preview Banner & Test Button */}
            <div className="space-y-2">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-800/70 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                <span>Status:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {isReminderEnabled
                    ? `Active • ${formatTime12h(morningReminderTime)} & ${formatTime12h(eveningReminderTime)}`
                    : 'Disabled'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                {notifPermission === 'granted' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>Browser popups enabled</span>
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
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 text-[11px] font-bold transition active:scale-95 cursor-pointer"
                  title="Trigger an immediate test quote reminder with audio chime"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Test Notification Now</span>
                </button>
              </div>
            </div>

            {/* Modal Action Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowReminderSettings(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
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
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
              >
                {saveSuccessMsg ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Saved Preferences!</span>
                  </>
                ) : (
                  <span>Save Preferences</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Customization Modal */}
      {showGlobalCustomization && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Global Customization</h3>
              <button onClick={() => setShowGlobalCustomization(false)} className="p-1 rounded-xl text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-slate-500">Apply these styles to all your quotes.</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700">Themes</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {['minimalist', 'parchment', 'gradient', 'sunset'].map(theme => (
                    <button key={theme} onClick={() => {}} className="p-2 rounded-xl bg-slate-100 text-xs font-semibold capitalize">{theme}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Typography</label>
                <div className="flex gap-2 mt-1">
                  {['Sans', 'Serif', 'Hand'].map(f => (
                    <button key={f} className="p-2 rounded-xl bg-slate-100 text-xs font-semibold">{f}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setShowGlobalCustomization(false);
                  triggerVibration();
                }}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
              >
                Apply All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Settings Modal */}
      {showViewSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">View &amp; Card Settings</h3>
                <p className="text-xs text-slate-400">Configure quote cards appearance and library import</p>
              </div>
              <button onClick={() => setShowViewSettings(false)} className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Quick Actions (Import) */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowViewSettings(false);
                  setShowBulkImportModal(true);
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer transition"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import Quotes Collection</span>
              </button>
            </div>

            {/* Customization Grid: Controls Left, Live Preview Card Bottom-Right */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                {/* Controls (Font Size, Font Style, Card Background, Transition Effects) */}
                <div className="md:col-span-6 space-y-3.5 text-xs">
                  {/* Font Size Scaling */}
                  <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Font Size Scale</span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {Math.round(draftFontScale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.8"
                      max="1.4"
                      step="0.05"
                      value={draftFontScale}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-indigo-600 transition-all duration-200"
                      onChange={(e) => {
                        setDraftFontScale(Number(e.target.value));
                      }}
                    />
                  </div>

                  {/* Font Style Selection (3 Styles) */}
                  <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Font Style</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'sans', label: 'Sans', family: 'sans-serif' },
                        { id: 'serif', label: 'Serif', family: 'serif' },
                        { id: 'mono', label: 'Mono', family: 'monospace' }
                      ].map((font) => (
                        <button
                          key={font.id}
                          type="button"
                          onClick={() => {
                            setDraftFontFamily(font.family);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 active:scale-95 cursor-pointer ${
                            draftFontFamily === font.family
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span style={{ fontFamily: font.family }}>{font.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card Background Color Presets */}
                  <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Card Background Theme</label>
                      <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                        {ColorThemeService.getPreset(draftCardBg)?.name || (draftCardBg && draftCardBg !== 'default' ? 'Custom' : 'Default White')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {ColorThemeService.getPresets().map((preset) => {
                        const isSelected =
                          draftCardBg === preset.id ||
                          ((!draftCardBg || draftCardBg === 'default') && preset.id === 'default') ||
                          draftCardBg === preset.lightBg ||
                          draftCardBg === preset.darkBg;

                        return (
                          <button
                            key={preset.id}
                            type="button"
                            title={preset.name}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDraftCardBg(preset.id);
                            }}
                            className={`w-7 h-7 rounded-full border shadow-xs shrink-0 transition-transform active:scale-95 cursor-pointer relative flex items-center justify-center ${
                              isSelected
                                ? 'ring-2 ring-indigo-600 ring-offset-2 border-indigo-600 scale-110'
                                : 'border-slate-300 dark:border-slate-600 hover:scale-105'
                            }`}
                            style={{ backgroundColor: preset.swatch }}
                          >
                            {isSelected && (
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Transition Effect */}
                  <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Transition Effect
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['fade', 'slide', 'scale'] as const).map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => {
                            setDraftTransitionStyle(style);
                            setAnimTrigger(prev => prev + 1);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${
                            draftTransitionStyle === style
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {style.charAt(0).toUpperCase() + style.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Clear Bottom-Right Live Preview Card Layout */}
                <div className="md:col-span-6 flex flex-col justify-end space-y-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/80 dark:border-slate-700/60">
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">Live Preview Card</span>
                        <p className="text-[10px] text-slate-400">Modifying Quote Card Style</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAnimTrigger(prev => prev + 1)}
                          className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 cursor-pointer bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-indigo-200/80 dark:border-indigo-800/80 transition active:scale-95 shadow-2xs"
                          title="Click to replay transition effect on preview card"
                        >
                          <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
                          <span>Replay</span>
                        </button>
                        <span className="capitalize font-mono text-[9px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-800/60 uppercase">
                          {draftTransitionStyle}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tapping options only modifies this preview card until you click <strong>Done</strong>.
                    </p>

                    {/* Visual Preview Card below Transition Effect with animated preview */}
                    {(() => {
                      const resolvedBg = ColorThemeService.resolveColor(draftCardBg, isDark);
                      const resolvedBorder = ColorThemeService.resolveBorderColor(draftCardBg, isDark);
                      const currentPreset = ColorThemeService.getPreset(draftCardBg);
                      return (
                        <div 
                          key={`preview-${draftTransitionStyle}-${draftFontScale}-${draftFontFamily}-${draftCardBg}-${animTrigger}`}
                          id="quote-preview-card"
                          data-quote-card="true"
                          data-custom-bg="true"
                          className={`p-3.5 rounded-2xl border shadow-md text-left transition-all ${
                            draftTransitionStyle === 'slide'
                              ? 'quote-transition-slide'
                              : draftTransitionStyle === 'scale'
                                ? 'quote-transition-scale'
                                : 'quote-transition-fade'
                          }`}
                          style={{
                            backgroundColor: resolvedBg,
                            borderColor: resolvedBorder,
                            '--preview-card-bg': resolvedBg,
                            '--preview-card-border': resolvedBorder,
                          } as React.CSSProperties}
                        >
                          <div className="flex items-center justify-between text-[9px] text-slate-400 mb-1.5">
                            <span className="font-medium">1/1 • Bhagavad Gita</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[9px] bg-indigo-50/90 dark:bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-200/50 dark:border-indigo-800/50">
                              Wisdom
                            </span>
                          </div>
                          <p 
                            id="quote-preview-text"
                            className="font-bold leading-snug transition-all duration-150"
                            style={{
                              fontSize: `${draftFontScale * 0.8}rem`,
                              fontFamily: draftFontFamily,
                              color: isDark ? '#f8fafc' : '#0f172a'
                            }}
                          >
                            "You have a right to perform your prescribed duty, but never to the fruits of action."
                          </p>
                          <div className="mt-2.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/70 flex items-center justify-between text-[9px]">
                            <span className="italic font-serif text-slate-500 dark:text-slate-400">Chapter 2, Verse 47</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-indigo-500 font-semibold">
                                Scale: {Math.round(draftFontScale * 100)}%
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                                {currentPreset?.name || 'Default White'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        id="btn-done-quote-settings"
                        onClick={() => {
                          setQuoteFontScale(draftFontScale);
                          setQuoteFontFamily(draftFontFamily);
                          setQuoteCardBg(draftCardBg);
                          setTransitionStyle(draftTransitionStyle);

                          localStorage.setItem('omni_quote_font_scale', String(draftFontScale));
                          localStorage.setItem('omni_quote_font_family', draftFontFamily);
                          localStorage.setItem('omni_quote_card_bg', draftCardBg);
                          localStorage.setItem('omni_quote_transition_style', draftTransitionStyle);

                          if (typeof document !== 'undefined') {
                            document.documentElement.style.setProperty('--quote-font-scale', String(draftFontScale));
                            document.documentElement.style.setProperty('--quote-font-family', draftFontFamily);
                            if (draftCardBg && draftCardBg !== 'default') {
                              const resolved = ColorThemeService.resolveColor(draftCardBg, isDark);
                              const resolvedBorder = ColorThemeService.resolveBorderColor(draftCardBg, isDark);
                              document.documentElement.style.setProperty('--quote-card-bg', resolved);
                              document.documentElement.style.setProperty('--quote-card-border', resolvedBorder);
                            } else {
                              document.documentElement.style.removeProperty('--quote-card-bg');
                              document.documentElement.style.removeProperty('--quote-card-border');
                            }
                          }

                          window.dispatchEvent(new CustomEvent('omni_quote_theme_changed', {
                            detail: {
                              fontScale: draftFontScale,
                              fontFamily: draftFontFamily,
                              cardBg: draftCardBg,
                              transitionStyle: draftTransitionStyle,
                            }
                          }));

                          soundEngine.playSuccessChime();
                          triggerVibration();
                          setShowViewSettings(false);
                        }}
                        className="w-full sm:w-auto px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Done</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Bulk Import Quotes</h3>
              <button onClick={() => setShowBulkImportModal(false)} className="p-1 rounded-xl text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Paste quotes or upload CSV/JSON file
                </label>
                <label className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer">
                  <span>Upload File</span>
                  <input
                    type="file"
                    accept=".csv,.json,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
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
                          } catch (err) {
                            alert('Invalid JSON file format.');
                          }
                        } else {
                          // CSV or text parsing
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
                onChange={(e) => setBulkImportText(e.target.value)}
                placeholder='Example: "Be yourself - Oscar Wilde"'
                className="w-full h-48 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-4">
              <button onClick={() => setShowBulkImportModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-600">Cancel</button>
              <button 
                onClick={() => {
                  const lines = bulkImportText.split('\n');
                  lines.forEach(line => {
                    const parts = line.split(' - ');
                    if (parts.length >= 2) {
                      addQuote({
                        text: parts[0].trim().replace(/^"|"$/g, ''),
                        author: parts[1].trim(),
                        category: 'wisdom', // Default category
                      });
                    }
                  });
                  setBulkImportText('');
                  setShowBulkImportModal(false);
                  soundEngine.playSuccessChime();
                }}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
              >
                Import Quotes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Action Confirmation Dialog (For Add, Edit, Delete) */}
      {pendingConfirmation && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  pendingConfirmation.type === 'delete'
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                    : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  {pendingConfirmation.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Confirmation required before executing this change.
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
              {pendingConfirmation.message}
            </p>

            {pendingConfirmation.type === 'delete' && (
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDeleteConfirmed}
                  onChange={(e) => setIsDeleteConfirmed(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                I am absolutely sure I want to delete this quote.
              </label>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingConfirmation(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executePendingAction}
                disabled={pendingConfirmation.type === 'delete' && !isDeleteConfirmed}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition active:scale-95 ${
                  pendingConfirmation.type === 'delete'
                    ? isDeleteConfirmed
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {pendingConfirmation.type === 'delete'
                  ? 'Yes, Delete'
                  : pendingConfirmation.type === 'edit'
                  ? 'Yes, Save Changes'
                  : 'Yes, Add Quote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

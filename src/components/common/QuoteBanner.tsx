import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Heart,
  Share2,
  MoreHorizontal,
  BookOpen,
  Edit2,
  ExternalLink,
  Quote,
  User,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { CURATED_QUOTES, QuoteItem } from '../../data/quotes';
import { useApp } from '../../context/AppContext';
import {
  UnifiedFormModal,
  FormHeroTitleCard,
} from './FormPrimitives';

interface QuoteBannerProps {
  className?: string;
}

const QUOTE_CATEGORIES: QuoteItem['category'][] = [
  'wisdom',
  'discipline',
  'mindset',
  'focus',
  'stoicism',
  'health',
  'habits',
];

export const QuoteBanner: React.FC<QuoteBannerProps> = ({ className = '' }) => {
  const {
    quotes,
    activeTab,
    setActiveTab,
    toggleFavoriteQuote,
    isQuoteFavorited,
    updateQuote,
    soundEngine,
  } = useApp();
  const allQuotes = quotes && quotes.length > 0 ? quotes : CURATED_QUOTES;

  const [quoteOffset, setQuoteOffset] = useState(() => {
    try {
      const savedOffset = localStorage.getItem('omni_quote_pair_offset');
      return savedOffset ? parseInt(savedOffset, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [copied, setCopied] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const bannerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Direct inline Edit Modal state for the current Wisdom Quote
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormText, setEditFormText] = useState('');
  const [editFormAuthor, setEditFormAuthor] = useState('');
  const [editFormCategory, setEditFormCategory] = useState<QuoteItem['category']>('wisdom');
  const [editFormSource, setEditFormSource] = useState('');

  // Auto-minimize expanded quote or dropdown menu when interacting with anything outside
  useEffect(() => {
    if (!isExpanded && !isMenuOpen) return;

    const handleOutsideInteraction = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      // If user clicked inside the dropdown itself, don't dismiss
      if (dropdownRef.current && dropdownRef.current.contains(target)) {
        return;
      }
      // If user clicked inside the toggle button, let toggle handler manage it
      if (menuRef.current && menuRef.current.contains(target)) {
        return;
      }
      // If user clicked completely outside the banner, close both menu and expanded text
      if (bannerRef.current && !bannerRef.current.contains(target)) {
        setIsExpanded(false);
        setIsMenuOpen(false);
      } else if (isMenuOpen) {
        // If user clicked inside the banner (e.g. quote text) while menu was open, close menu
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideInteraction);
    document.addEventListener('touchstart', handleOutsideInteraction, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideInteraction);
      document.removeEventListener('touchstart', handleOutsideInteraction);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded, isMenuOpen]);

  // Reset expanded state when navigating between tabs
  useEffect(() => {
    setIsExpanded(false);
    setIsMenuOpen(false);
  }, [activeTab]);

  if (activeTab === 'quotes') {
    return null;
  }

  const dayOfYear = (() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now.getTime() - start.getTime()) / 86400000);
  })();

  const totalQuotes = allQuotes.length || 1;
  const currentIdx = ((dayOfYear + quoteOffset) % totalQuotes + totalQuotes) % totalQuotes;
  const currentQuote: QuoteItem = allQuotes[currentIdx] || CURATED_QUOTES[0];
  const isFav = isQuoteFavorited(currentQuote.id);

  const toSentenceCase = (text: string) => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const handleNextQuote = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuoteOffset(prev => {
      const next = prev + 1;
      try {
        localStorage.setItem('omni_quote_pair_offset', next.toString());
      } catch {}
      return next;
    });
  };

  const handlePrevQuote = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuoteOffset(prev => {
      const next = prev - 1;
      try {
        localStorage.setItem('omni_quote_pair_offset', next.toString());
      } catch {}
      return next;
    });
  };

  const handleToggleCombinedMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !isMenuOpen;
    setIsMenuOpen(nextState);
    setIsExpanded(nextState);
  };

  const handleCopyQuote = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `"${currentQuote.text}" — ${currentQuote.author}${currentQuote.source ? ` (${currentQuote.source})` : ''}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    soundEngine?.playSuccessChime?.();
    setTimeout(() => {
      setCopied(false);
      setIsMenuOpen(false);
    }, 1200);
  };

  const handleShareQuote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    const shareText = `"${currentQuote.text}" — ${currentQuote.author}${currentQuote.source ? ` (${currentQuote.source})` : ''}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Daily Quote',
          text: shareText,
        });
        return;
      } catch {}
    }
    navigator.clipboard?.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const handleOpenParticularQuote = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsMenuOpen(false);
    setIsExpanded(false);
    try {
      localStorage.setItem('omni_focused_quote_id', currentQuote.id);
    } catch {}
    setActiveTab('quotes');
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('omni_focus_quote', { detail: { quoteId: currentQuote.id } })
      );
    }, 50);
  };

  const handleOpenEditQuote = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    setIsExpanded(false);
    setEditFormText(currentQuote.text);
    setEditFormAuthor(currentQuote.author);
    setEditFormCategory(currentQuote.category || 'wisdom');
    setEditFormSource(currentQuote.source || '');
    setIsEditModalOpen(true);
  };

  const handleSaveEditedQuote = () => {
    if (!editFormText.trim() || !editFormAuthor.trim()) return;
    updateQuote({
      ...currentQuote,
      text: editFormText.trim(),
      author: editFormAuthor.trim(),
      category: editFormCategory,
      source: editFormSource.trim() || undefined,
    });
    soundEngine?.playSuccessChime?.();
    setIsEditModalOpen(false);
  };

  return (
    <>
      <div
        ref={bannerRef}
        className={`relative rounded-xl border border-slate-200/80 dark:border-zinc-800/90 bg-slate-50/70 dark:bg-zinc-900/90 px-2.5 sm:px-3 py-1 transition-all duration-200 w-full max-w-full flex ${
          isExpanded ? 'items-start' : 'items-center'
        } justify-between gap-1.5 ${className}`}
      >
        {/* Quote Text Area: Compact 1-line by default, expands when arrow or text is clicked */}
        <div
          onClick={() => setIsExpanded(prev => !prev)}
          className="flex-1 min-w-0 cursor-pointer select-none py-0.5"
          title={isExpanded ? 'Tap to minimize quote' : 'Tap to expand full quote'}
        >
          <p
            className={`text-slate-700 dark:text-zinc-200 font-medium leading-snug text-[11.5px] sm:text-xs transition-all ${
              isExpanded ? 'break-words whitespace-normal' : 'truncate'
            }`}
          >
            <span>“{toSentenceCase(currentQuote.text)}”</span>
            <span className="text-indigo-600/85 dark:text-indigo-400/90 font-semibold ml-1.5">
              — {currentQuote.author}
              {isExpanded && currentQuote.source ? (
                <span className="text-slate-400 dark:text-zinc-500 font-normal ml-1">
                  ({currentQuote.source})
                </span>
              ) : null}
            </span>
          </p>
        </div>

        {/* Right Controls: Unified Combined Dropdown Chevron + 3-Dot Menu Button */}
        <div className="flex items-center gap-1 shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={handleToggleCombinedMenu}
            className={`h-7 px-2 rounded-xl inline-flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-2xs border ${
              isMenuOpen || isExpanded
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800'
                : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border-slate-200/80 dark:border-zinc-800 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
            title="Expand Quote & Open Actions Menu"
            aria-label="Expand Quote & Open Actions Menu"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-indigo-500' : ''}`} />
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dropdown Menu Anchored to Bottom Edge of ENTIRE QuoteBanner Box (Never overlaps expanded quote text) */}
        {isMenuOpen && (
          <div
            ref={dropdownRef}
            onClick={e => e.stopPropagation()}
            className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl z-[120] p-1.5 text-xs space-y-1.5 animate-view-enter"
          >
            {/* Top Header Row: Quote Navigation (< Prev | Next >) */}
            <div className="flex items-center justify-between px-1 py-1 rounded-xl bg-slate-100/80 dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 text-[11px] font-semibold text-slate-600 dark:text-zinc-300 select-none">
              <button
                type="button"
                onClick={handlePrevQuote}
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 transition cursor-pointer active:scale-95"
                title="Previous Quote"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Prev</span>
              </button>

              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono font-bold">
                #{currentIdx + 1}/{totalQuotes}
              </span>

              <button
                type="button"
                onClick={handleNextQuote}
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 transition cursor-pointer active:scale-95"
                title="Next Quote"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              </button>
            </div>

            {/* 2-Column Quick Action Row 1: [Edit] & [Share] */}
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={handleOpenEditQuote}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-900/90 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-zinc-200 border border-slate-200/70 dark:border-zinc-800 transition font-semibold text-[11.5px] cursor-pointer"
                title="Edit text, author, or category"
              >
                <Edit2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Edit</span>
              </button>

              <button
                type="button"
                onClick={handleShareQuote}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-900/90 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-zinc-200 border border-slate-200/70 dark:border-zinc-800 transition font-semibold text-[11.5px] cursor-pointer"
                title="Share text"
              >
                <Share2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Share</span>
              </button>
            </div>

            {/* 2-Column Quick Action Row 2: [Copy] & [Save] */}
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={handleCopyQuote}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-900/90 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-zinc-200 border border-slate-200/70 dark:border-zinc-800 transition font-semibold text-[11.5px] cursor-pointer"
                title="Copy to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  toggleFavoriteQuote(currentQuote.id);
                }}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition font-semibold text-[11.5px] cursor-pointer ${
                  isFav
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50'
                    : 'bg-slate-50 dark:bg-zinc-900/90 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-zinc-200 border-slate-200/70 dark:border-zinc-800'
                }`}
                title={isFav ? 'Remove from saved' : 'Save to favorites'}
              >
                <Heart className={`w-3.5 h-3.5 shrink-0 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-rose-500'}`} />
                <span>{isFav ? 'Saved' : 'Save'}</span>
              </button>
            </div>

            <div className="border-t border-slate-100 dark:border-zinc-800/80 pt-1" />

            {/* View Links */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={handleOpenParticularQuote}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-900/90 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200/60 dark:border-zinc-800/80 transition font-medium text-[11.5px] cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Open View</span>
                </span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsExpanded(false);
                  try {
                    localStorage.removeItem('omni_focused_quote_id');
                  } catch {}
                  setActiveTab('quotes');
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 transition font-semibold text-[11.5px] cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>All Quotes</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 font-bold">
                  {totalQuotes}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Direct Edit Modal for the Current Wisdom Quote */}
      <UnifiedFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={
          <div className="inline-flex items-center gap-2">
            <span>Edit</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/70">
              Quote
            </span>
          </div>
        }
        accentColor="#4f46e5"
        headerIcon={
          <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Quote size={14} />
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!editFormText.trim() || !editFormAuthor.trim()}
              onClick={handleSaveEditedQuote}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Check size={14} />
              <span>Save</span>
            </button>
          </div>
        }
      >
        <FormHeroTitleCard
          value={editFormText}
          onChange={setEditFormText}
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
                  placeholder="Author / Speaker (e.g. Chanakya) *"
                  value={editFormAuthor}
                  onChange={e => setEditFormAuthor(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <div className="relative">
                <BookOpen size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Book / Source (optional, e.g. Chanakya Neeti)"
                  value={editFormSource}
                  onChange={e => setEditFormSource(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            </div>
          }
        />

        <div className="bg-white dark:bg-[#18181b] p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            <Sparkles size={12} className="text-indigo-500" />
            <span>Category</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUOTE_CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setEditFormCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition cursor-pointer ${
                  editFormCategory === cat
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </UnifiedFormModal>
    </>
  );
};

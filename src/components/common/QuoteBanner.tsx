import React, { useState, useEffect } from 'react';
import { Quote, RefreshCw, Copy, Check, ChevronDown, ChevronUp, Sparkles, BookOpen, ExternalLink, Heart, Share2 } from 'lucide-react';
import { CURATED_QUOTES, QuoteItem } from '../../data/quotes';
import { useApp } from '../../context/AppContext';

interface QuoteBannerProps {
  className?: string;
}

export const QuoteBanner: React.FC<QuoteBannerProps> = ({ className = '' }) => {
  const { quotes, activeTab, setActiveTab, toggleFavoriteQuote, isQuoteFavorited } = useApp();
  const allQuotes = quotes && quotes.length > 0 ? quotes : CURATED_QUOTES;

  if (activeTab === 'quotes') {
    return null;
  }

  // Deterministic daily pair based on day of year, plus user offset
  const [pairOffset, setPairOffset] = useState(() => {
    try {
      const savedOffset = localStorage.getItem('omni_quote_pair_offset');
      return savedOffset ? parseInt(savedOffset, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [fontScale, setFontScale] = useState(1);
  const [fontFamily, setFontFamily] = useState('sans-serif');

  useEffect(() => {
    const loadSettings = () => {
      try {
        setFontScale(Number(localStorage.getItem('omni_quote_font_scale')) || 1);
        setFontFamily(localStorage.getItem('omni_quote_font_family') || 'sans-serif');
      } catch (e) {
        console.error('Failed to load font settings:', e);
      }
    };
    loadSettings();
    window.addEventListener('omni_quote_theme_changed', loadSettings);
    return () => window.removeEventListener('omni_quote_theme_changed', loadSettings);
  }, []);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('omni_quotes_compact_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Calculate base daily pair index
  const dayOfYear = (() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now.getTime() - start.getTime()) / 86400000);
  })();

  const totalQuotes = allQuotes.length || 1;
  const idx1 = Math.abs((dayOfYear * 2) + (pairOffset * 2)) % totalQuotes;
  const idx2 = Math.abs((dayOfYear * 2) + (pairOffset * 2) + 1) % totalQuotes;

  const quote1: QuoteItem = allQuotes[idx1] || CURATED_QUOTES[0];
  const quote2: QuoteItem = allQuotes[idx2] || CURATED_QUOTES[1] || allQuotes[0];

  const handleNextPair = () => {
    setPairOffset(prev => {
      const next = prev + 1;
      try {
        localStorage.setItem('omni_quote_pair_offset', next.toString());
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleCopyQuote = (q: QuoteItem) => {
    const text = `"${q.text}" — ${q.author}${q.source ? ` (${q.source})` : ''}`;
    navigator.clipboard?.writeText(text);
    setCopiedId(q.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShareQuote = async (q: QuoteItem) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Wisdom Quote',
          text: `"${q.text}" — ${q.author}${q.source ? ` (${q.source})` : ''}`,
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // User canceled, ignore
          return;
        }
        console.error('Error sharing:', err);
      }
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('omni_quotes_compact_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
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

  // Helper to convert text to sentence case
  const toSentenceCase = (text: string) => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // Render compact Super Productivity inspired quote card item
  const renderQuoteCard = (q: QuoteItem, quoteNum: 1 | 2, quoteIndex: number, extraClass: string = '') => {
    const theme = getCategoryTheme(q.category);
    const isCopied = copiedId === q.id;

    return (
      <div
        key={q.id || quoteNum}
        className={`group relative flex flex-col justify-between p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all text-left shadow-2xs w-full min-w-0 max-w-full overflow-hidden ${extraClass}`}
      >
        {/* Top line metadata: Category + Number + Author */}
        <div className="flex items-center justify-between gap-1 text-[9px] mb-0.5 min-w-0 max-w-full overflow-hidden">
          <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.1 rounded-full text-[9px] font-bold border ${theme.badge} capitalize shrink-0`}
            >
              <span className={`w-1 h-1 rounded-full ${theme.dot}`} />
              {q.category}
            </span>
            <span className="inline-flex items-center px-1 py-0.1 rounded-full text-[9px] font-mono font-bold bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-300/70 dark:border-slate-600/70 shrink-0">
              {quoteIndex + 1}/{totalQuotes}
            </span>
            <span className="text-slate-300 dark:text-slate-600 shrink-0">•</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate text-[10px] max-w-[100px] sm:max-w-none" title={`— ${q.author}`}>
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
              onClick={() => toggleFavoriteQuote(q.id)}
              className={`p-0.5 rounded-sm transition shrink-0 cursor-pointer ${
                isQuoteFavorited(q.id)
                  ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60'
                  : 'text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title={isQuoteFavorited(q.id) ? 'Remove from favorites' : 'Add to favorites & liked'}
            >
              <Heart
                className={`w-3 h-3 ${
                  isQuoteFavorited(q.id) ? 'fill-rose-500 text-rose-500' : ''
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => handleCopyQuote(q)}
              className="p-0.5 rounded-sm text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition shrink-0 cursor-pointer"
              title="Copy quote"
            >
              {isCopied ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleShareQuote(q)}
              className="p-0.5 rounded-sm text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition shrink-0 cursor-pointer"
              title="Share quote"
            >
              <Share2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Crisp readable quote text - Super Productivity compact typography */}
        <p 
          className="font-bold text-slate-800 dark:text-slate-100 leading-tight"
          style={{
            fontSize: `${fontScale * 0.75}rem`,
            fontFamily: fontFamily
          }}
        >
          "{toSentenceCase(q.text)}"
        </p>
      </div>
    );
  };

  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 sm:px-2.5 sm:py-2 shadow-2xs transition-all w-full max-w-full overflow-hidden ${className}`}
    >
      {/* Micro Header */}
      <div className="flex items-center justify-between gap-2 pb-0.5">
        <div
          onClick={() => setActiveTab('quotes')}
          className="flex items-center gap-1.5 min-w-0 cursor-pointer group"
          title="Click to open dedicated Quotes Page"
        >
          <div className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-100/60 dark:border-indigo-900/60 shrink-0 group-hover:scale-105 transition-transform">
            <Quote className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
            <span className="group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Daily Wisdom</span>
            <span className="text-[9.5px] font-medium font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded-full border border-indigo-200/50 dark:border-indigo-800/50 hidden sm:inline">
              {totalQuotes.toLocaleString()} Quotes
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleNextPair}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-semibold transition shrink-0 cursor-pointer"
            title="Shuffle next 2 daily quotes"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            <span>Next Pair</span>
          </button>

          <button
            type="button"
            onClick={toggleCollapse}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer"
            title={isCollapsed ? 'Expand quotes' : 'Minimize quotes'}
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Body: 2 Quotes stacked vertically (1 box per row) */}
      {!isCollapsed ? (
        <div className="flex flex-col gap-1 mt-0.5">
          {renderQuoteCard(quote1, 1, idx1)}
          {renderQuoteCard(quote2, 2, idx2)}
        </div>
      ) : (
        <div
          onClick={toggleCollapse}
          className="cursor-pointer text-xs not-italic text-slate-800 dark:text-slate-100 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 transition truncate shadow-2xs mt-1"
        >
          <span className="truncate font-medium text-xs">
            "{quote1.text}" — <strong className="not-italic text-slate-800 dark:text-slate-200 font-semibold">{quote1.author}</strong>
          </span>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold shrink-0">Expand (2 Quotes)</span>
        </div>
      )}
    </div>
  );
};

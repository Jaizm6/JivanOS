import React from 'react';
import {
  Quote,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
  Heart,
  Copy,
  Check,
  Share2,
} from 'lucide-react';
import { QuoteItem } from '../../data/quotes';
import { getPaletteByKey, getQuotePalette } from './quoteColors';
import { toSentenceCase } from '../../utils/quoteText';

export interface QuoteHeroCardProps {
  quote: QuoteItem;
  number?: number;
  categoryName?: string;
  colorKey?: string;
  isFavorite: boolean;
  isCopied: boolean;
  isDark: boolean;
  isMenuOpen?: boolean;
  onToggleMenu?: (menuKey: string) => void;
  onCloseMenu?: () => void;
  onPrev: () => void;
  onNext: () => void;
  onFavorite: (id: string) => void;
  onCopy: (quote: QuoteItem) => void;
  onShare: (quote: QuoteItem) => void;
  onEdit: (quote: QuoteItem) => void;
  onDelete: (quote: QuoteItem) => void;
}

const SLAB_SERIF_STYLE: React.CSSProperties = {
  fontFamily: '"Zilla Slab", Georgia, Cambria, "Times New Roman", serif',
};

export const QuoteHeroCard: React.FC<QuoteHeroCardProps> = ({
  quote,
  number,
  categoryName,
  colorKey,
  isFavorite,
  isCopied,
  isDark,
  isMenuOpen = false,
  onToggleMenu,
  onCloseMenu,
  onPrev,
  onNext,
  onFavorite,
  onCopy,
  onShare,
  onEdit,
  onDelete,
}) => {
  const palette = colorKey ? getPaletteByKey(colorKey) : getQuotePalette(quote.category);
  const bg = isDark ? palette.bgDark : palette.bg;
  const ink = isDark ? palette.inkDark : palette.ink;
  const metaInk = isDark ? palette.metaInkDark : palette.metaInk;
  const quoteTextColor = isDark ? '#F7F8FA' : '#141218';
  const displayCategory = categoryName || quote.category;

  const iconHoverClass = isDark
    ? 'hover:bg-white/[0.12] active:bg-white/[0.18]'
    : 'hover:bg-black/[0.08] active:bg-black/[0.14]';

  const navBtnBg = isDark
    ? 'rgba(255, 255, 255, 0.14)'
    : '#FFFFFF';

  const cardStyle: React.CSSProperties = {
    backgroundColor: bg,
    color: metaInk,
    ...(palette.hasBorder
      ? {
          border: isDark
            ? '1px solid #2e3444'
            : '1px solid var(--m3-card-border, #c4cddb)',
        }
      : {}),
  };

  const heroMenuKey = `hero:${quote.id}`;

  return (
    <article
      style={cardStyle}
      className={`relative min-w-0 w-full rounded-[26px] px-[18px] pt-[18px] pb-[14px] flex flex-col justify-between gap-[12px] text-left mb-[10px] motion-reduce:transition-none ${
        isMenuOpen ? 'z-30' : 'z-10'
      }`}
    >
      {/* Top Row: Solid White Quote Badge + Category/Source on Left | Prev, Next, #Number, 3-Dot on Right */}
      <div className="flex items-center gap-[10px] min-w-0">
        <div
          className="w-[36px] h-[36px] rounded-full shrink-0 flex items-center justify-center"
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.13)' : '#FFFFFF',
            color: ink,
          }}
          aria-hidden="true"
        >
          <Quote size={17} strokeWidth={2.2} />
        </div>

        <div className="flex-1 min-w-0 leading-[1.22]">
          <div
            className="text-[12.5px] font-semibold capitalize break-words"
            style={{ color: ink }}
          >
            {displayCategory}
          </div>
          {quote.source && (
            <div
              className="text-[11.5px] font-medium break-words mt-[1px]"
              style={{ color: metaInk }}
            >
              {quote.source}
            </div>
          )}
        </div>

        <div className="flex items-center gap-[5px] shrink-0">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous featured quote"
            style={{ backgroundColor: navBtnBg, color: ink }}
            className="w-[32px] h-[32px] rounded-full border-0 shadow-none flex items-center justify-center transition-opacity duration-150 motion-reduce:transition-none hover:opacity-85 active:opacity-70 cursor-pointer shrink-0"
          >
            <ChevronLeft size={18} strokeWidth={2.2} />
          </button>

          <button
            type="button"
            onClick={onNext}
            aria-label="Next featured quote"
            style={{ backgroundColor: navBtnBg, color: ink }}
            className="w-[32px] h-[32px] rounded-full border-0 shadow-none flex items-center justify-center transition-opacity duration-150 motion-reduce:transition-none hover:opacity-85 active:opacity-70 cursor-pointer shrink-0"
          >
            <ChevronRight size={18} strokeWidth={2.2} />
          </button>

          {typeof number === 'number' && (
            <span
              className="font-mono text-[12px] font-semibold tabular-nums shrink-0 pl-[4px]"
              style={{ color: metaInk }}
            >
              #{number}
            </span>
          )}

          <div className="relative shrink-0" data-quote-menu-root={heroMenuKey}>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onToggleMenu?.(heroMenuKey);
              }}
              aria-label="More featured quote actions"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              style={{ color: metaInk }}
              className={`w-[30px] h-[30px] -mr-[4px] rounded-full border-0 bg-transparent shadow-none flex items-center justify-center transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${iconHoverClass}`}
            >
              <MoreVertical size={17} strokeWidth={2} />
            </button>

            {isMenuOpen && (
              <div
                role="menu"
                onClick={e => e.stopPropagation()}
                style={{
                  backgroundColor: isDark ? '#18181e' : '#ffffff',
                  border: isDark
                    ? '1px solid rgba(255, 255, 255, 0.12)'
                    : '1px solid var(--m3-card-border, #c4cddb)',
                  boxShadow: isDark
                    ? '0 10px 28px -4px rgba(0, 0, 0, 0.75)'
                    : '0 8px 24px -4px rgba(15, 23, 42, 0.18)',
                }}
                className="absolute right-0 top-full mt-1 z-50 rounded-[14px] p-[4px] min-w-[120px]"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onCloseMenu?.();
                    onEdit(quote);
                  }}
                  style={{ color: isDark ? '#f4f4f5' : '#141218' }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-[10px] text-[12.5px] font-medium cursor-pointer transition-colors ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/[0.06]'
                  }`}
                >
                  <Pencil size={14} className="shrink-0" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onCloseMenu?.();
                    onDelete(quote);
                  }}
                  style={{ color: isDark ? '#fb7185' : '#e11d48' }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-[10px] text-[12.5px] font-medium cursor-pointer transition-colors ${
                    isDark ? 'hover:bg-rose-500/15' : 'hover:bg-rose-50'
                  }`}
                >
                  <Trash2 size={14} className="shrink-0" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Middle: Large Expressive Slab-Serif Quote Body */}
      <p
        style={{ ...SLAB_SERIF_STYLE, color: quoteTextColor }}
        className="text-[21px] sm:text-[24px] font-semibold leading-[1.3] tracking-[-0.012em] break-words m-0"
      >
        “{toSentenceCase(quote.text)}”
      </p>

      {/* Footer Row: Author on Left + Heart / Copy / Share on Right */}
      <div className="flex items-center gap-[6px] min-w-0 pt-[2px]">
        <span
          style={{ color: metaInk }}
          className="text-[13.5px] font-medium flex-1 min-w-0 break-words leading-snug"
        >
          {quote.author}
        </span>

        <div className="flex items-center shrink-0 -mr-[4px]">
          <button
            type="button"
            onClick={() => onFavorite(quote.id)}
            aria-label={isFavorite ? 'Remove featured quote from saved' : 'Save featured quote'}
            aria-pressed={isFavorite}
            style={{ color: isFavorite ? '#E11D48' : metaInk }}
            className={`w-[32px] h-[32px] rounded-full border-0 bg-transparent shadow-none flex items-center justify-center transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${iconHoverClass}`}
          >
            <Heart
              size={18}
              strokeWidth={2}
              fill={isFavorite ? '#E11D48' : 'none'}
              color={isFavorite ? '#E11D48' : 'currentColor'}
            />
          </button>

          <button
            type="button"
            onClick={() => onCopy(quote)}
            aria-label={isCopied ? 'Featured quote copied' : 'Copy featured quote'}
            style={{ color: metaInk }}
            className={`w-[32px] h-[32px] rounded-full border-0 bg-transparent shadow-none flex items-center justify-center transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${iconHoverClass}`}
          >
            {isCopied ? <Check size={18} strokeWidth={2.4} /> : <Copy size={18} strokeWidth={2} />}
          </button>

          <button
            type="button"
            onClick={() => onShare(quote)}
            aria-label="Share featured quote"
            style={{ color: metaInk }}
            className={`w-[32px] h-[32px] rounded-full border-0 bg-transparent shadow-none flex items-center justify-center transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${iconHoverClass}`}
          >
            <Share2 size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </article>
  );
};

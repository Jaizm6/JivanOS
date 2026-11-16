import React, { useState, useMemo } from 'react';
import { Search, MoreHorizontal, X, Palette } from 'lucide-react';
import {
  STRUCTURED_PRIMARY_COLORS,
  STRUCTURED_EXTENDED_COLORS,
  STRUCTURED_ICON_CATEGORIES,
  StructuredIconCategory,
} from '../../constants/structuredCatalog';
import { soundEngine } from '../../utils/audio';

export interface StructuredIconColorPickerProps {
  selectedColor: string;
  onSelectColor: (hex: string) => void;
  selectedIcon: string;
  onSelectIcon: (iconKey: string) => void;
  onClose?: () => void;
  className?: string;
}

const POPULAR_EMOJI_OPTIONS = [
  '🔥', '💧', '📖', '🧘', '🏋️', '🏃', '🚴', '🍎', '😴', '🌅', '🌙', '🧠',
  '💻', '✍️', '🎯', '💊', '💰', '🎵', '🎨', '🌱', '🧹', '🤝', '☕', '🚫',
];

export const StructuredIconColorPicker: React.FC<StructuredIconColorPickerProps> = ({
  selectedColor,
  onSelectColor,
  selectedIcon,
  onSelectIcon,
  onClose,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<StructuredIconCategory['id'] | 'all'>(
    'weather_objects'
  );
  const [showExtendedColors, setShowExtendedColors] = useState(false);

  const normalizedSelectedColor = (selectedColor || '#55789b').toLowerCase();
  const normalizedSelectedIcon = (selectedIcon || '').trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return STRUCTURED_ICON_CATEGORIES.map(cat => ({
        ...cat,
        icons: cat.icons.filter(
          ic =>
            ic.label.toLowerCase().includes(q) ||
            ic.key.toLowerCase().includes(q) ||
            ic.keywords.some(kw => kw.toLowerCase().includes(q))
        ),
      })).filter(cat => cat.icons.length > 0);
    }

    // Reorder so the active category appears first at the top of the scroll container,
    // followed by the remaining categories (matching Structured.app's continuous scroll with section headers!)
    if (activeCategoryId === 'all') {
      return STRUCTURED_ICON_CATEGORIES;
    }

    const activeCat = STRUCTURED_ICON_CATEGORIES.find(c => c.id === activeCategoryId);
    const otherCats = STRUCTURED_ICON_CATEGORIES.filter(c => c.id !== activeCategoryId);
    return activeCat ? [activeCat, ...otherCats] : STRUCTURED_ICON_CATEGORIES;
  }, [searchQuery, activeCategoryId]);

  const handleColorClick = (hex: string) => {
    onSelectColor(hex);
    try {
      soundEngine?.playPill?.();
    } catch {}
  };

  const handleIconClick = (key: string) => {
    onSelectIcon(key);
    try {
      soundEngine?.playPill?.();
    } catch {}
  };

  return (
    <div
      onClick={e => e.stopPropagation()}
      className={`rounded-[26px] bg-white dark:bg-[#16161a] border border-slate-200/90 dark:border-zinc-800 shadow-xl p-3.5 sm:p-4 space-y-3 select-none w-full ${className}`}
    >
      {/* 1. HEADER: "Color & Icon" + "..." Extended Palette Toggle + "×" Close */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[15px] font-extrabold text-slate-900 dark:text-white tracking-tight">
          Color &amp; Icon
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowExtendedColors(prev => !prev)}
            className={`w-7 h-7 rounded-full border flex items-center justify-center transition cursor-pointer ${
              showExtendedColors
                ? 'border-slate-400 bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white'
                : 'border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
            }`}
            title="Toggle extended colors & custom color picker"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer"
              title="Close Color & Icon Picker"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. STRUCTURED 9-COLOR PILL BAR */}
      <div className="rounded-full border border-slate-200/90 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/50 px-2 py-1.5 flex items-center justify-between gap-1">
        {STRUCTURED_PRIMARY_COLORS.map(c => {
          const isSelected = normalizedSelectedColor === c.hex.toLowerCase();
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => handleColorClick(c.hex)}
              style={{ backgroundColor: c.hex }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0 shadow-2xs"
              title={c.label}
            >
              {isSelected && (
                <span className="w-5 h-5 sm:w-[22px] sm:h-[22px] rounded-full border-2 border-white block" />
              )}
            </button>
          );
        })}
      </div>

      {/* OPTIONAL EXTENDED COLOR SWATCHES & CUSTOM HEX PICKER (Toggled via '...' button) */}
      {showExtendedColors && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/60 p-2.5 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center flex-wrap gap-1.5">
            {STRUCTURED_EXTENDED_COLORS.map(c => {
              const isSelected = normalizedSelectedColor === c.hex.toLowerCase();
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleColorClick(c.hex)}
                  style={{ backgroundColor: c.hex }}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0 shadow-2xs"
                  title={c.label}
                >
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full border-2 border-white block" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-zinc-800 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" />
              <span>Custom Hex Color:</span>
            </span>
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 cursor-pointer text-[11px] font-mono font-bold text-slate-700 dark:text-zinc-200">
              <span
                className="w-3.5 h-3.5 rounded-full border border-black/10"
                style={{ backgroundColor: selectedColor || '#55789b' }}
              />
              <span>{(selectedColor || '#55789b').toUpperCase()}</span>
              <input
                type="color"
                value={selectedColor || '#55789b'}
                onChange={e => handleColorClick(e.target.value)}
                className="sr-only"
              />
            </label>
          </div>
        </div>
      )}

      {/* 3. SEARCH ICONS PILL INPUT */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search Icons"
          className="w-full pl-9 pr-8 py-2 rounded-full border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-zinc-700"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 4. 7-CATEGORY PILL BAR (Shower, Shirt, Home, GraduationCap, Monitor, Bike, Flame) */}
      <div className="rounded-full border border-slate-200/90 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/50 p-1 grid grid-cols-7 gap-1">
        {STRUCTURED_ICON_CATEGORIES.map(cat => {
          const TabIcon = cat.TabIcon;
          const isActive = activeCategoryId === cat.id && !searchQuery;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveCategoryId(cat.id);
              }}
              style={isActive ? { backgroundColor: selectedColor || '#55789b' } : undefined}
              className={`h-7 sm:h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isActive
                  ? 'text-white shadow-2xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
              title={cat.label}
            >
              <TabIcon className="w-4 h-4 stroke-[2.2]" />
            </button>
          );
        })}
      </div>

      {/* 5. SCROLLABLE 6-COLUMN CIRCULAR ICON GRID WITH SECTION HEADERS */}
      <div className="max-h-[250px] overflow-y-auto pr-1 space-y-4 custom-scrollbar">
        {filteredCategories.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500">
            No icons found matching &ldquo;{searchQuery}&rdquo;
          </div>
        ) : (
          filteredCategories.map((cat, cIdx) => {
            const SectionIcon = cat.SectionIcon;
            return (
              <div key={cat.id} className="space-y-2">
                {cIdx > 0 && (
                  <div className="flex items-center gap-1.5 pt-1 text-xs font-bold text-slate-500 dark:text-zinc-400">
                    <SectionIcon className="w-3.5 h-3.5" />
                    <span>{cat.sectionTitle}</span>
                  </div>
                )}

                <div className="grid grid-cols-6 gap-2 sm:gap-2.5 place-items-center">
                  {cat.icons.map(ic => {
                    const IconComp = ic.Icon;
                    const isSelected = normalizedSelectedIcon === ic.key.toLowerCase();
                    return (
                      <button
                        key={`${cat.id}-${ic.key}`}
                        type="button"
                        onClick={() => handleIconClick(ic.key)}
                        style={
                          isSelected
                            ? {
                                backgroundColor: selectedColor || '#55789b',
                                borderColor: selectedColor || '#55789b',
                              }
                            : undefined
                        }
                        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xs ${
                          isSelected
                            ? 'text-white shadow-sm ring-2 ring-offset-1 ring-slate-300 dark:ring-zinc-700'
                            : 'bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 hover:border-slate-300 dark:hover:border-zinc-700'
                        }`}
                        title={ic.label}
                      >
                        <IconComp className="w-4 h-4 sm:w-[18px] sm:h-[18px] stroke-[2.2]" />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        {/* Quick Emoji Section at Bottom of Scroll */}
        {!searchQuery && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-zinc-400">
              <span>✨ Classic Emojis</span>
            </div>
            <div className="grid grid-cols-6 gap-2 sm:gap-2.5 place-items-center">
              {POPULAR_EMOJI_OPTIONS.map(em => {
                const isSelected = selectedIcon === em;
                return (
                  <button
                    key={em}
                    type="button"
                    onClick={() => handleIconClick(em)}
                    style={
                      isSelected
                        ? {
                            backgroundColor: selectedColor || '#55789b',
                            borderColor: selectedColor || '#55789b',
                          }
                        : undefined
                    }
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border flex items-center justify-center text-base transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xs ${
                      isSelected
                        ? 'text-white shadow-sm'
                        : 'bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 hover:border-slate-300'
                    }`}
                  >
                    {em}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

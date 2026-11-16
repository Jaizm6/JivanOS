import React from 'react';
import { Check, Tag } from 'lucide-react';
import { AppTag } from '../../types';

const SEMANTIC_TAG_COLORS: Record<string, string> = {
  work: '#3b82f6',
  personal: '#10b981',
  health: '#f43f5e',
  fitness: '#0ea5e9',
  finance: '#f59e0b',
  learning: '#8b5cf6',
  study: '#8b5cf6',
  errands: '#06b6d4',
  deepwork: '#6366f1',
  'deep work': '#6366f1',
  mindset: '#ec4899',
  focus: '#6366f1',
  productivity: '#4f46e5',
  routine: '#14b8a6',
  selfcare: '#ec4899',
  'self care': '#ec4899',
  urgent: '#ef4444',
  wishlist: '#d946ef',
  shopping: '#f97316',
  birthday: '#f43f5e',
  engineering: '#0284c7',
  general: '#64748b',
  inbox: '#64748b',
};

const FALLBACK_TAG_PALETTE = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#0ea5e9', // Sky
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#14b8a6', // Teal
  '#ec4899', // Pink
];

const SPECIAL_CASE_MAP: Record<string, string> = {
  deepwork: 'Deep Work',
  selfcare: 'Self Care',
  ai: 'AI',
  ui: 'UI',
  ux: 'UX',
  cbt: 'CBT',
  todo: 'To-Do',
};

/** Strips leading `#` and extra whitespace */
export function cleanTagName(raw: string): string {
  return (raw || '').trim().replace(/^#+/, '').trim();
}

/** Normalizes any raw tag string into clean Title Case without all-caps shouting */
export function formatTagLabel(raw: string): string {
  const cleaned = cleanTagName(raw);
  if (!cleaned) return 'General';

  const lower = cleaned.toLowerCase();
  if (SPECIAL_CASE_MAP[lower]) return SPECIAL_CASE_MAP[lower];

  return cleaned
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(word => {
      const wLower = word.toLowerCase();
      if (SPECIAL_CASE_MAP[wLower]) return SPECIAL_CASE_MAP[wLower];
      if (word.length <= 3 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/** Case-insensitive tag array check */
export function hasTagCaseInsensitive(tags: string[] | undefined, target: string): boolean {
  const norm = cleanTagName(target).toLowerCase();
  if (!norm || !tags) return false;
  return tags.some(t => cleanTagName(t).toLowerCase() === norm);
}

/** Toggle a tag inside an array without creating case duplicates */
export function toggleTagCaseInsensitive(tags: string[], target: string): string[] {
  const cleanTarget = cleanTagName(target);
  const norm = cleanTarget.toLowerCase();
  if (!norm) return tags;
  const exists = tags.some(t => cleanTagName(t).toLowerCase() === norm);
  if (exists) {
    return tags.filter(t => cleanTagName(t).toLowerCase() !== norm);
  }
  return [...tags, cleanTarget];
}

/** Deduplicate raw tag candidates case-insensitively while preserving order */
export function dedupeTagsCaseInsensitive(candidates: string[]): string[] {
  const seen = new Map<string, string>();
  candidates.forEach(raw => {
    const clean = cleanTagName(raw);
    if (!clean) return;
    const key = clean.toLowerCase();
    const existing = seen.get(key);
    // Prefer properly capitalized / formatted version if we encounter both 'health' and 'Health'
    if (!existing) {
      seen.set(key, clean);
    } else if (existing === existing.toLowerCase() && clean !== clean.toLowerCase()) {
      seen.set(key, clean);
    }
  });
  return Array.from(seen.values());
}

/** Resolves a curated M3 expressive color from AppTag registry, semantic map, or deterministic hash */
export function getTagColor(rawTag: string, appTags?: AppTag[]): string {
  const key = cleanTagName(rawTag).toLowerCase();
  if (!key) return '#6366f1';

  if (appTags && appTags.length > 0) {
    const matched = appTags.find(t => cleanTagName(t.name).toLowerCase() === key);
    if (matched?.color) return matched.color;
  }

  if (SEMANTIC_TAG_COLORS[key]) {
    return SEMANTIC_TAG_COLORS[key];
  }

  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_TAG_PALETTE[Math.abs(hash) % FALLBACK_TAG_PALETTE.length];
}

/**
 * Big seamless Tag-shaped logo badge containing the colored `TagName` inside it.
 * Classic angled tag silhouette with circular eyelet hole — no hashtag prefix.
 */
export const TagLogoBadge: React.FC<{
  tag: string;
  appTags?: AppTag[];
  size?: 'md' | 'lg';
  className?: string;
}> = ({ tag, appTags, size = 'lg', className = '' }) => {
  const color = getTagColor(tag, appTags);
  const label = formatTagLabel(tag);
  const isLg = size === 'lg';

  return (
    <span
      className={`inline-flex items-center shrink-0 select-none rounded-r-[11px] ${
        isLg ? 'h-8 pl-[14px] pr-3 gap-1.5 text-[13px]' : 'h-7 pl-[12px] pr-2.5 gap-1.5 text-[12px]'
      } font-extrabold tracking-tight whitespace-nowrap ${className}`}
      style={{
        backgroundColor: `${color}1a`,
        clipPath: isLg
          ? 'polygon(13px 0%, 100% 0%, 100% 100%, 13px 100%, 0% 50%)'
          : 'polygon(11px 0%, 100% 0%, 100% 100%, 11px 100%, 0% 50%)',
      }}
    >
      <span
        className={`rounded-full shrink-0 ring-2 ring-white/80 dark:ring-black/50 ${
          isLg ? 'w-2 h-2' : 'w-1.5 h-1.5'
        }`}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="truncate" style={{ color }}>
        {label}
      </span>
    </span>
  );
};

/**
 * Material 3 Expressive Grouped Section Header (used inside Tag Cards).
 * Renders the big TagLogoBadge (colored TagName inside a physical Tag logo) and tabular progress count.
 */
export const TagSectionHeader: React.FC<{
  tag: string;
  completedCount: number;
  totalCount: number;
  appTags?: AppTag[];
  className?: string;
}> = ({ tag, completedCount, totalCount, appTags, className = '' }) => {
  const isAllDone = totalCount > 0 && completedCount >= totalCount;

  return (
    <div className={`flex items-center justify-between gap-2.5 min-w-0 ${className}`}>
      <TagLogoBadge tag={tag} appTags={appTags} size="lg" className="max-w-[78%]" />

      <span
        className={`text-xs font-bold tabular-nums whitespace-nowrap shrink-0 inline-flex items-center gap-1 px-1 ${
          isAllDone
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-slate-500 dark:text-zinc-400'
        }`}
      >
        {isAllDone && <Check className="w-3.5 h-3.5 stroke-[2.8]" />}
        <span>
          {completedCount}/{totalCount}
        </span>
      </span>
    </div>
  );
};

/**
 * Interactive M3 Expressive Tag Button (used inside forms, filter bars, and clickable card filters).
 * Morphs from rounded-[12px] unselected to rounded-full selected with semantic tag color dot.
 */
export const InteractiveTagButton: React.FC<{
  tag: string;
  selected?: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  appTags?: AppTag[];
  variant?: 'form' | 'card';
  title?: string;
  className?: string;
}> = ({
  tag,
  selected = false,
  onClick,
  appTags,
  variant = 'form',
  title,
  className = '',
}) => {
  const color = getTagColor(tag, appTags);
  const label = formatTagLabel(tag);

  if (variant === 'card') {
    return (
      <button
        type="button"
        data-no-press-scale="true"
        onClick={onClick}
        title={title || `Filter by ${label}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
          selected
            ? 'rounded-full text-white shadow-2xs'
            : 'rounded-full bg-slate-100/90 dark:bg-zinc-800/90 text-slate-700 dark:text-zinc-200 hover:bg-slate-200/80 dark:hover:bg-zinc-700/80'
        } ${className}`}
        style={selected ? { backgroundColor: color } : undefined}
      >
        <Tag
          className="w-2.5 h-2.5 shrink-0 stroke-[2.4]"
          style={{ color: selected ? '#ffffff' : color }}
        />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-no-press-scale="true"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
        selected
          ? 'rounded-full text-white shadow-xs'
          : 'rounded-[12px] bg-[#f1f4fa] dark:bg-[#111116] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
      } ${className}`}
      style={
        selected
          ? { backgroundColor: color }
          : undefined
      }
    >
      {selected ? (
        <Check className="w-3 h-3 stroke-[3] text-white shrink-0" />
      ) : (
        <Tag
          className="w-3 h-3 shrink-0 stroke-[2.3]"
          style={{ color }}
        />
      )}
      <span>{label}</span>
    </button>
  );
};

/**
 * Unboxed static tag metadata item (respects Zero-Pill rule for static card/header text).
 */
export const InlineTagMeta: React.FC<{
  tag: string;
  appTags?: AppTag[];
  className?: string;
  showIcon?: boolean;
}> = ({ tag, appTags, className = '', showIcon = true }) => {
  const color = getTagColor(tag, appTags);
  const label = formatTagLabel(tag);

  return (
    <span className={`inline-flex items-center gap-1 font-semibold whitespace-nowrap ${className}`}>
      {showIcon && (
        <Tag
          className="w-2.5 h-2.5 shrink-0 stroke-[2.4]"
          style={{ color }}
        />
      )}
      <span className="text-slate-700 dark:text-zinc-300">{label}</span>
    </span>
  );
};

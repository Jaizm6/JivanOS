import React, { useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronRight,
  Pencil,
  Check,
  Bell,
  BellOff,
  AlarmClock,
  Volume2,
  Plus,
  Trash2,
  Clock,
} from 'lucide-react';
import { ReminderType } from '../../types';
import { getAvailableAccentColors } from '../../utils/activityStyles';
import { useApp } from '../../context/AppContext';
import { PetalShapeBadge, PetalExpressiveShape } from './PetalExpressive';

// Material 3 Expressive / ColorOS fluid emphasized motion curves
export const FORM_EASE: [number, number, number, number] = [0.05, 0.7, 0.1, 1.0];
export const FORM_EXIT_EASE: [number, number, number, number] = [0.3, 0.0, 0.8, 0.15];

export const FORM_SPRING = {
  duration: 0.24,
  ease: FORM_EASE,
};

export const FORM_EXIT_TRANSITION = {
  duration: 0.17,
  ease: FORM_EXIT_EASE,
};

export const SUB_MODAL_SPRING = {
  duration: 0.2,
  ease: FORM_EASE,
};

let activeModalLockCount = 0;
let prevHtmlOverflow = '';
let prevBodyOverflow = '';
let prevHtmlOverscroll = '';
let prevBodyOverscroll = '';
let prevBodyPaddingRight = '';

/**
 * Reference-counted pre-paint background scroll lock so stacked modals/sub-modals
 * never cause Frame-1 layout jumps or allow touch-swipes/wheel scrolling to leak.
 */
export function useModalScrollLock(isOpen: boolean) {
  useLayoutEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    if (activeModalLockCount === 0) {
      prevHtmlOverflow = document.documentElement.style.overflow;
      prevBodyOverflow = document.body.style.overflow;
      prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
      prevBodyOverscroll = document.body.style.overscrollBehavior;
      prevBodyPaddingRight = document.body.style.paddingRight;

      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehavior = 'none';
      document.body.style.overscrollBehavior = 'none';
    }
    activeModalLockCount += 1;

    return () => {
      activeModalLockCount = Math.max(0, activeModalLockCount - 1);
      if (activeModalLockCount === 0 && typeof document !== 'undefined') {
        document.documentElement.style.overflow = prevHtmlOverflow;
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
        document.body.style.overscrollBehavior = prevBodyOverscroll;
        document.body.style.paddingRight = prevBodyPaddingRight;
      }
    };
  }, [isOpen]);
}

/**
 * Shared screen placement for EVERY form modal and contextual sub-modal:
 * - Mobile (<640px): Bottom sheet anchored cleanly at bottom (`items-end`)
 * - Desktop (>=640px): Top-aligned at `sm:pt-[7dvh]` and horizontally centered (`sm:items-start justify-center`)
 *   so that every single form and contextual menu opens at the EXACT same screen coordinates without vertical jumping.
 */
export const UNIFIED_MODAL_POSITION_CLASS =
  'fixed inset-0 z-[200] h-[100dvh] w-full flex items-end sm:items-start sm:pt-[7dvh] justify-center p-0 sm:p-4 overflow-hidden select-none touch-none overscroll-none';

export const UNIFIED_CARD_SHELL_CLASS =
  'relative z-10 w-full sm:max-w-md max-h-[92dvh] sm:max-h-[86dvh] min-h-0 bg-[#f6f8fc] dark:bg-[#0d0d11] text-zinc-900 dark:text-zinc-100 rounded-t-[28px] sm:rounded-[28px] ring-1 ring-black/[0.06] dark:ring-white/[0.08] shadow-2xl flex flex-col overflow-hidden touch-auto';

export const UNIFIED_FORM_SHEET_CLASS =
  'relative z-10 w-full sm:max-w-md h-[84dvh] max-h-[92dvh] sm:h-[min(650px,86dvh)] sm:max-h-[86dvh] min-h-0 bg-[#f6f8fc] dark:bg-[#0d0d11] text-zinc-900 dark:text-zinc-100 rounded-t-[28px] sm:rounded-[28px] ring-1 ring-black/[0.06] dark:ring-white/[0.08] shadow-2xl flex flex-col overflow-hidden touch-auto';

export interface UnifiedFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: string;
  accentColor?: string;
  headerIcon?: React.ReactNode;
  headerShape?: PetalExpressiveShape;
  headerCenter?: React.ReactNode;
  headerRight?: React.ReactNode;
  onSave?: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  footer?: React.ReactNode;
  maxWidthClass?: string;
  children: React.ReactNode;
  zIndexClass?: string;
}

export const UnifiedFormModal: React.FC<UnifiedFormModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  accentColor = '#4f46e5',
  headerIcon,
  headerShape = 'cookie12',
  headerCenter,
  headerRight,
  onSave,
  saveLabel = 'Save',
  saveDisabled = false,
  footer,
  maxWidthClass = 'sm:max-w-md',
  children,
  zIndexClass = 'z-[200]',
}) => {
  useModalScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  const effectiveAccent = accentColor === '#ffffff' ? '#6366f1' : accentColor;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          key="unified-form-modal-root"
          data-unified-modal="true"
          className={`${UNIFIED_MODAL_POSITION_CLASS} ${zIndexClass}`}
        >
          {/* Separate GPU-light Backdrop Scrim */}
          <motion.div
            data-unified-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2, ease: FORM_EASE } }}
            exit={{ opacity: 0, transition: FORM_EXIT_TRANSITION }}
            style={{ willChange: 'opacity' }}
            className="fixed inset-0 bg-black/55 dark:bg-black/75 touch-none overscroll-none"
            onClick={onClose}
          />

          {/* Separate Composited Sheet / Modal Container */}
          <motion.div
            data-unified-modal="true"
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: FORM_SPRING }}
            exit={{ opacity: 0, y: 16, scale: 0.97, transition: FORM_EXIT_TRANSITION }}
            style={{ willChange: 'transform, opacity' }}
            onClick={e => e.stopPropagation()}
            className={`relative z-10 w-full ${maxWidthClass} h-[84dvh] max-h-[92dvh] sm:h-[min(650px,86dvh)] sm:max-h-[86dvh] min-h-0 bg-[#f6f8fc] dark:bg-[#0d0d11] text-zinc-900 dark:text-zinc-100 rounded-t-[28px] sm:rounded-[28px] ring-1 ring-black/[0.06] dark:ring-white/[0.08] shadow-2xl flex flex-col overflow-hidden touch-auto`}
          >
            {/* Mobile Drag Handle Pill */}
            <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-white/95 dark:bg-[#141418]/95 shrink-0">
              <div className="w-10 h-1 rounded-full bg-zinc-300/90 dark:bg-zinc-700/90" />
            </div>

            {/* Sticky M3 Expressive Header */}
            <div className="flex items-center justify-between px-4 py-2.5 min-h-[52px] bg-white/95 dark:bg-[#141418]/95 border-b border-zinc-200/60 dark:border-zinc-800/70 shrink-0 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <PetalShapeBadge
                  shape={headerShape}
                  sizeClass="w-8 h-8"
                  fillColor={`${effectiveAccent}1f`}
                  strokeColor={`${effectiveAccent}42`}
                >
                  {headerIcon || (
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: effectiveAccent }}
                    />
                  )}
                </PetalShapeBadge>
                <div className="min-w-0">
                  <div className="font-extrabold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                    {title}
                  </div>
                  {subtitle && (
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              {headerCenter && <div className="shrink-0">{headerCenter}</div>}

              <div className="flex items-center gap-1.5 shrink-0">
                {headerRight}
                {onSave && (
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={saveDisabled}
                    className="px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                    title={saveLabel}
                  >
                    <Check size={13} className="stroke-[2.5]" />
                    <span>{saveLabel}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-[#f1f4fa] dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-3 sm:px-3.5 py-3 space-y-2.5 custom-scrollbar [scrollbar-gutter:stable] bg-[#f6f8fc] dark:bg-[#0d0d11]">
              {children}
            </div>

            {/* Sticky Footer */}
            {footer && (
              <div className="shrink-0 bg-white/95 dark:bg-[#141418]/95 border-t border-zinc-200/60 dark:border-zinc-800/70 px-4 py-2.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] z-10">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export interface UnifiedSubModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  iconShape?: PetalExpressiveShape;
  children: React.ReactNode;
  doneLabel?: string;
  maxWidthClass?: string;
}

/**
 * Unified Contextual Menu / Sub-Modal:
 * Opens in the EXACT same screen position and width (`sm:max-w-md` at `sm:pt-[7dvh]`) as the parent form
 * so contextual menus never jump around the screen.
 */
export const UnifiedSubModal: React.FC<UnifiedSubModalProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  iconShape = 'cookie9',
  children,
  doneLabel = 'Done',
  maxWidthClass = 'sm:max-w-md',
}) => {
  useModalScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          key="unified-sub-modal-root"
          data-unified-modal="true"
          className={`${UNIFIED_MODAL_POSITION_CLASS} z-[230]`}
        >
          <motion.div
            data-unified-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18, ease: FORM_EASE } }}
            exit={{ opacity: 0, transition: FORM_EXIT_TRANSITION }}
            style={{ willChange: 'opacity' }}
            className="fixed inset-0 bg-black/55 dark:bg-black/75 touch-none overscroll-none"
            onClick={onClose}
          />

          <motion.div
            data-unified-modal="true"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: SUB_MODAL_SPRING }}
            exit={{ opacity: 0, y: 14, scale: 0.97, transition: FORM_EXIT_TRANSITION }}
            style={{ willChange: 'transform, opacity' }}
            onClick={e => e.stopPropagation()}
            className={`relative z-10 w-full ${maxWidthClass} h-[58dvh] max-h-[86dvh] sm:h-[min(460px,82dvh)] sm:max-h-[82dvh] min-h-0 bg-[#f6f8fc] dark:bg-[#0d0d11] text-zinc-900 dark:text-zinc-100 rounded-t-[28px] sm:rounded-[26px] ring-1 ring-black/[0.06] dark:ring-white/[0.08] shadow-2xl flex flex-col overflow-hidden touch-auto`}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-white/95 dark:bg-[#141418]/95 shrink-0">
              <div className="w-9 h-1 rounded-full bg-zinc-300/90 dark:bg-zinc-700/90" />
            </div>

            {/* Sub-Modal Header */}
            <div className="flex items-center justify-between px-4 py-2.5 min-h-[50px] border-b border-zinc-200/60 dark:border-zinc-800/70 bg-white/95 dark:bg-[#141418]/95 shrink-0 gap-2">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 min-w-0">
                {icon && (
                  <PetalShapeBadge
                    shape={iconShape}
                    sizeClass="w-7 h-7"
                    fillClass="text-slate-100 dark:text-zinc-800"
                    strokeClass="text-slate-200/90 dark:text-zinc-700/80"
                  >
                    {icon}
                  </PetalShapeBadge>
                )}
                <span className="truncate">{title}</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Check size={13} className="stroke-[2.5]" />
                <span>{doneLabel}</span>
              </button>
            </div>

            {/* Sub-Modal Scrollable Body */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-3.5 sm:p-4 space-y-3 custom-scrollbar [scrollbar-gutter:stable] bg-[#f6f8fc] dark:bg-[#0d0d11] pb-[max(1rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export interface FormHeroTitleCardProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  accentColor?: string;
  icon?: React.ReactNode;
  iconShape?: PetalExpressiveShape;
  onIconClick?: () => void;
  iconTooltip?: string;
  rightActionSlot?: React.ReactNode;
  onOpenStyle?: () => void;
  fontColor?: string;
  fontType?: 'sans' | 'mono' | 'serif' | 'rounded';
  isBold?: boolean;
  isDarkMode?: boolean;
  multiline?: boolean;
  rows?: number;
  autoFocus?: boolean;
  onEnterSubmit?: () => void;
  onSubmit?: () => void;
  middleSlot?: React.ReactNode;
  bottomSlot?: React.ReactNode;
}

export const FormHeroTitleCard: React.FC<FormHeroTitleCardProps> = ({
  value,
  onChange,
  placeholder,
  accentColor = '#4f46e5',
  icon,
  iconShape = 'cookie9',
  onIconClick,
  iconTooltip,
  rightActionSlot,
  onOpenStyle,
  autoFocus = false,
  onEnterSubmit,
  onSubmit,
  middleSlot,
  bottomSlot,
}) => {
  const handleEnter = onEnterSubmit || onSubmit;
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const fullTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [isExpanded, setIsExpanded] = React.useState<boolean>(false);
  const [isOverflowing, setIsOverflowing] = React.useState<boolean>(false);

  const effectiveAccent = accentColor === '#ffffff' ? '#6366f1' : accentColor;

  // Never auto-focus on mobile viewports (<640px) so the virtual keyboard doesn't cover 55% of the form immediately
  const shouldAutoFocus =
    Boolean(autoFocus) &&
    typeof window !== 'undefined' &&
    window.innerWidth >= 640;

  const checkOverflow = React.useCallback(() => {
    const el = inputRef.current;
    if (!el) {
      setIsOverflowing(Boolean(value && value.trim().length > 18));
      return;
    }
    const hasHorizontalOverflow =
      el.scrollWidth > el.clientWidth + 2 || Boolean(value && value.trim().length > 18);
    setIsOverflowing(hasHorizontalOverflow);
  }, [value]);

  useEffect(() => {
    checkOverflow();
    const timer = setTimeout(checkOverflow, 120);
    return () => clearTimeout(timer);
  }, [checkOverflow]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [checkOverflow]);

  // Auto-size the full-width textarea above the card whenever it opens or value changes
  useEffect(() => {
    if (!isExpanded || !fullTextareaRef.current) return;
    const el = fullTextareaRef.current;
    el.style.height = 'auto';
    el.style.height = `${Math.max(28, el.scrollHeight)}px`;
  }, [isExpanded, value]);

  const showToggleBtn = isOverflowing || isExpanded || Boolean(value && value.trim().length > 14);

  return (
    <div className="space-y-2 shrink-0">
      {/* Full-width Title Bar ABOVE the card (100% horizontal width, unobstructed by action buttons) */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 4, height: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div
              className="relative w-full rounded-[22px] bg-white dark:bg-[#18181e] ring-1 px-3.5 py-2.5 shadow-xs"
              style={{
                ['--tw-ring-color' as string]: `${effectiveAccent}55`,
              }}
            >
              <div
                className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
                style={{ backgroundColor: effectiveAccent }}
              />
              <div className="flex items-start justify-between gap-2 pl-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: effectiveAccent }}
                    >
                      Full Title
                    </span>
                  </div>
                  <textarea
                    ref={fullTextareaRef}
                    rows={1}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        setIsExpanded(false);
                      }
                    }}
                    placeholder={placeholder}
                    className="w-full bg-transparent text-[15px] sm:text-base font-semibold font-sans text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none resize-none leading-snug break-words overflow-hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="w-7 h-7 rounded-full bg-[#f1f4fa] dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                  title="Close full title view"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Expressive M3 Hero Card */}
      <div className="relative overflow-hidden bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07] rounded-[24px] p-3.5 shadow-2xs space-y-2.5">
        {/* Subtle tonal corner aura tinted by item accent */}
        <div
          className="pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-[0.09] blur-xl"
          style={{ backgroundColor: effectiveAccent }}
        />

        {/* Row 1: Expressive Scalloped Icon Trigger + Title Input */}
        <div className="relative flex items-center gap-3 w-full min-w-0">
          {icon && (
            <button
              type="button"
              data-no-press-scale="true"
              onClick={onIconClick}
              disabled={!onIconClick}
              title={iconTooltip}
              className={`group shrink-0 focus:outline-none ${
                onIconClick ? 'cursor-pointer transition-colors' : 'cursor-default'
              }`}
            >
              <PetalShapeBadge
                shape={iconShape}
                sizeClass="w-10 h-10"
                fillColor={accentColor === '#ffffff' ? '#27272a' : `${effectiveAccent}1d`}
                strokeColor={accentColor === '#ffffff' ? '#52525b' : `${effectiveAccent}42`}
              >
                <span style={{ color: accentColor === '#ffffff' ? '#ffffff' : effectiveAccent }}>
                  {icon}
                </span>
              </PetalShapeBadge>
            </button>
          )}

          <div className="flex-1 min-w-0">
            <input
              ref={inputRef}
              type="text"
              required
              autoFocus={shouldAutoFocus}
              value={value}
              onChange={e => onChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && handleEnter && value.trim()) {
                  e.preventDefault();
                  handleEnter();
                }
              }}
              placeholder={placeholder}
              title={value || undefined}
              className="w-full bg-transparent text-[15.5px] sm:text-[17px] tracking-tight placeholder:text-zinc-400 focus:outline-none leading-snug text-zinc-900 dark:text-zinc-100 font-bold font-sans truncate"
            />
          </div>
        </div>

        {/* Row 2: Tonal Action Chips (Zero harsh borders) */}
        {(showToggleBtn || rightActionSlot || onOpenStyle) && (
          <div className={`relative flex items-center flex-wrap gap-1.5 ${icon ? 'pl-[52px]' : ''}`}>
            {showToggleBtn && (
              <button
                type="button"
                data-no-press-scale="true"
                onClick={() => setIsExpanded(prev => !prev)}
                className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold inline-flex items-center gap-0.5 transition-colors cursor-pointer shrink-0 ${
                  isExpanded
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-[#eff2f9] dark:bg-zinc-800/90 text-zinc-600 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-300'
                }`}
                title={isExpanded ? 'Hide full title bar' : 'Show full title above card'}
              >
                <span>{isExpanded ? 'Hide' : 'Full'}</span>
                <ChevronRight
                  size={11}
                  className={`transition-transform duration-150 ${isExpanded ? 'rotate-90' : '-rotate-90'}`}
                />
              </button>
            )}

            {rightActionSlot ? (
              rightActionSlot
            ) : onOpenStyle ? (
              <button
                type="button"
                data-no-press-scale="true"
                onClick={onOpenStyle}
                className="px-2.5 py-1 rounded-full bg-[#eff2f9] dark:bg-zinc-800/90 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 transition-colors shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
                title="Customize Accent Color"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/15 dark:ring-white/25"
                  style={{ backgroundColor: accentColor }}
                />
                <Pencil size={10} className="text-zinc-400" />
                <span className="text-[10.5px] font-bold">Color</span>
              </button>
            ) : null}
          </div>
        )}

        {middleSlot && <div className="relative pt-0.5">{middleSlot}</div>}

        {bottomSlot && (
          <div className="relative pt-2 border-t border-zinc-100/90 dark:border-zinc-800/70">
            {bottomSlot}
          </div>
        )}
      </div>
    </div>
  );
};

export const FormSectionGroup: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div
    className={`bg-white dark:bg-[#18181e] ring-1 ring-black/[0.045] dark:ring-white/[0.07] rounded-[24px] divide-y-[3px] divide-[#f6f8fc] dark:divide-[#0d0d11] overflow-hidden shadow-2xs ${className}`}
  >
    {children}
  </div>
);

export interface FormDisclosureRowProps {
  icon: React.ReactNode;
  iconBgClass?: string;
  iconShape?: PetalExpressiveShape;
  label: string;
  subtitle?: string;
  value?: React.ReactNode;
  badgeText?: React.ReactNode;
  valueClass?: string;
  badgeClass?: string;
  onClick: () => void;
  rightSlot?: React.ReactNode;
}

const DISCLOSURE_FILL_TONES: Record<string, string> = {
  indigo: 'text-indigo-100/90 dark:text-indigo-950/70',
  blue: 'text-blue-100/90 dark:text-blue-950/70',
  violet: 'text-violet-100/90 dark:text-violet-950/70',
  purple: 'text-purple-100/90 dark:text-purple-950/70',
  amber: 'text-amber-100/90 dark:text-amber-950/70',
  orange: 'text-orange-100/90 dark:text-orange-950/70',
  rose: 'text-rose-100/90 dark:text-rose-950/70',
  pink: 'text-pink-100/90 dark:text-pink-950/70',
  emerald: 'text-emerald-100/90 dark:text-emerald-950/70',
  teal: 'text-teal-100/90 dark:text-teal-950/70',
  cyan: 'text-cyan-100/90 dark:text-cyan-950/70',
  sky: 'text-sky-100/90 dark:text-sky-950/70',
  slate: 'text-slate-100/90 dark:text-slate-800/80',
  zinc: 'text-zinc-100/90 dark:text-zinc-800/80',
};

export const FormDisclosureRow: React.FC<FormDisclosureRowProps> = ({
  icon,
  iconBgClass = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  iconShape = 'squircle',
  label,
  subtitle,
  value,
  badgeText,
  valueClass,
  badgeClass,
  onClick,
  rightSlot,
}) => {
  const displayValue = badgeText !== undefined ? badgeText : value;
  const resolvedValueClass =
    badgeClass ||
    valueClass ||
    'text-zinc-600 dark:text-zinc-300';

  const textToneMatch = iconBgClass.match(/text-[^\s]+(\s+dark:text-[^\s]+)?/);
  const iconTextTone = textToneMatch ? textToneMatch[0] : 'text-indigo-600 dark:text-indigo-400';
  const colorKeyMatch = iconBgClass.match(/(?:bg|text)-([a-z]+)-/);
  const badgeFillTone =
    (colorKeyMatch && DISCLOSURE_FILL_TONES[colorKeyMatch[1]]) ||
    DISCLOSURE_FILL_TONES.indigo;

  return (
    <button
      type="button"
      data-no-press-scale="true"
      onClick={onClick}
      className="group w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-[#f2f5fc] dark:hover:bg-zinc-800/60 active:bg-[#e8eef9] dark:active:bg-zinc-800 transition-colors text-left cursor-pointer gap-2.5"
    >
      <div className="flex items-center gap-3 min-w-0">
        <PetalShapeBadge
          shape={iconShape}
          sizeClass="w-8 h-8"
          fillClass={badgeFillTone}
          strokeClass="text-black/[0.04] dark:text-white/[0.07]"
        >
          <span className={iconTextTone}>{icon}</span>
        </PetalShapeBadge>
        <div className="min-w-0">
          <div className="text-[12.5px] font-bold text-zinc-800 dark:text-zinc-100 truncate">
            {label}
          </div>
          {subtitle && (
            <div className="text-[10.5px] text-zinc-500 dark:text-zinc-400 truncate">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 max-w-[56%]">
        {rightSlot}
        {displayValue !== undefined && (
          <span
            className={`text-[11.5px] font-semibold tabular-nums truncate ${resolvedValueClass}`}
          >
            {displayValue}
          </span>
        )}
        <ChevronRight size={14} className="text-zinc-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
};

export interface FormStylePopoverContentProps {
  accentColor: string;
  onChangeAccentColor?: (color: string) => void;
  setAccentColor?: (color: string) => void;
  fontColor?: string;
  onChangeFontColor?: (color: string) => void;
  setFontColor?: (color: string) => void;
  fontType?: 'sans' | 'mono' | 'serif' | 'rounded';
  onChangeFontType?: (font: 'sans' | 'mono' | 'serif' | 'rounded') => void;
  setFontType?: (font: 'sans' | 'mono' | 'serif' | 'rounded') => void;
  isBold?: boolean;
  onChangeIsBold?: (bold: boolean) => void;
  setIsBold?: (bold: boolean) => void;
  isDarkMode: boolean;
}

export const FormStylePopoverContent: React.FC<FormStylePopoverContentProps> = ({
  accentColor,
  onChangeAccentColor,
  setAccentColor,
  isDarkMode,
}) => {
  const handleAccentChange = onChangeAccentColor || setAccentColor || (() => {});

  return (
    <div className="space-y-3 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
      <div>
        <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-2.5 block">
          Expressive Accent Color
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          {getAvailableAccentColors(isDarkMode).map(c => {
            const isSelected = accentColor === c;
            return (
              <button
                key={c}
                type="button"
                data-no-press-scale="true"
                onClick={() => handleAccentChange(c)}
                className="group relative w-8 h-8 flex items-center justify-center shrink-0 cursor-pointer"
              >
                {isSelected ? (
                  <PetalShapeBadge
                    shape="cookie12"
                    sizeClass="w-8 h-8"
                    fillColor={c}
                    strokeColor={c === '#ffffff' ? '#d4d4d8' : c}
                  >
                    <Check
                      size={13}
                      strokeWidth={3}
                      className={c === '#ffffff' ? 'text-zinc-900' : 'text-white'}
                    />
                  </PetalShapeBadge>
                ) : (
                  <span
                    className={`w-7 h-7 rounded-full block transition-colors ${
                      c === '#ffffff' ? 'ring-1 ring-zinc-300 dark:ring-zinc-600' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                )}
              </button>
            );
          })}
          <input
            type="color"
            value={accentColor.startsWith('#') && accentColor.length === 7 ? accentColor : '#4f46e5'}
            onChange={e => handleAccentChange(e.target.value)}
            className="w-8 h-8 rounded-full border-none cursor-pointer p-0 bg-transparent shrink-0"
            title="Custom Color"
          />
        </div>
      </div>
    </div>
  );
};

export interface CentralizedReminderPickerProps {
  reminderType: ReminderType;
  onChangeReminderType: (type: ReminderType) => void;
  /** Mode 1: Relative offset ('none' | 'on_time' | '5m' | '15m' | '30m' | '1h' | '1d') */
  timingMode?: 'offset' | 'days_before' | 'daily_times' | 'none';
  reminderTiming?: string;
  onChangeReminderTiming?: (timing: string) => void;
  /** Mode 2: Days before due date (Bills) */
  daysBefore?: number;
  onChangeDaysBefore?: (days: number) => void;
  /** Mode 3: Daily reminder time slots (Habits / Meds / Affirmations / Quotes) */
  dailyTimes?: string[];
  onChangeDailyTimes?: (times: string[]) => void;
  /** Context label for Test Alert */
  testTitle?: string;
  testCategory?: string;
}

export const CentralizedReminderPicker: React.FC<CentralizedReminderPickerProps> = ({
  reminderType,
  onChangeReminderType,
  timingMode = 'offset',
  reminderTiming = '15m',
  onChangeReminderTiming,
  daysBefore = 3,
  onChangeDaysBefore,
  dailyTimes = [],
  onChangeDailyTimes,
  testTitle = 'Reminder Preview',
  testCategory = 'task',
}) => {
  const { soundEngine } = useApp();
  const [newTimeSlot, setNewTimeSlot] = React.useState('09:00');

  const handleTestAlert = () => {
    const activeType = reminderType === 'none' ? 'notification' : reminderType;
    if (activeType === 'alarm') {
      soundEngine.playAlarmChime('urgent');
    } else {
      soundEngine.playSuccessChime();
    }
    window.dispatchEvent(
      new CustomEvent('omnilifeos_trigger_alarm', {
        detail: {
          id: `test_${Date.now()}`,
          source: testCategory,
          title: testTitle || 'Sample Reminder Alert',
          subtitle:
            activeType === 'alarm'
              ? 'Persistent Alarm Ringing (Test)'
              : 'Standard Notification Chime (Test)',
          reminderType: activeType,
        },
      })
    );
  };

  return (
    <div className="space-y-4 bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.045] dark:ring-white/[0.07]">
      {/* 1. Expressive Connected Delivery Mode Selector */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
            Alert Delivery Style
          </label>
          <button
            type="button"
            onClick={handleTestAlert}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 text-[10.5px] font-bold hover:bg-indigo-100 transition cursor-pointer"
          >
            <Volume2 size={11} />
            <span>Test Alert</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-[3px] p-1 rounded-[22px] bg-[#f1f4fa] dark:bg-zinc-900">
          {[
            {
              id: 'none' as ReminderType,
              label: 'Silent',
              desc: 'No sound',
              icon: <BellOff size={15} />,
              activeClass:
                'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 shadow-xs',
            },
            {
              id: 'notification' as ReminderType,
              label: 'Chime',
              desc: 'Banner + beep',
              icon: <Bell size={15} />,
              activeClass:
                'bg-indigo-600 text-white shadow-xs',
            },
            {
              id: 'alarm' as ReminderType,
              label: 'Alarm',
              desc: 'Persistent',
              icon: <AlarmClock size={15} />,
              activeClass:
                'bg-rose-600 text-white shadow-xs',
            },
          ].map((opt, idx) => {
            const isSelected = reminderType === opt.id;
            const radiusCls = isSelected
              ? 'rounded-full'
              : idx === 0
              ? 'rounded-l-[18px] rounded-r-[6px]'
              : idx === 2
              ? 'rounded-r-[18px] rounded-l-[6px]'
              : 'rounded-[6px]';
            return (
              <button
                key={opt.id}
                type="button"
                data-no-press-scale="true"
                onClick={() => onChangeReminderType(opt.id)}
                className={`${radiusCls} py-2.5 px-2 text-center flex flex-col items-center gap-0.5 transition-colors duration-150 cursor-pointer ${
                  isSelected
                    ? `${opt.activeClass} font-bold`
                    : 'bg-white/80 dark:bg-[#1b1b22] text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800'
                }`}
              >
                {opt.icon}
                <span className="text-xs leading-tight mt-0.5">{opt.label}</span>
                <span className={`text-[9.5px] ${isSelected ? 'opacity-85' : 'opacity-65'}`}>
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Timing Configuration based on Domain Mode (Stable container prevents jump when Silent is toggled) */}
      {(timingMode === 'offset' || timingMode === 'daily_times') && reminderType === 'none' && (
        <div className="p-3.5 rounded-[16px] bg-[#f3f5fa] dark:bg-[#111116] text-xs text-zinc-500 dark:text-zinc-400 text-center">
          Alerts are silenced. Choose <strong className="text-zinc-700 dark:text-zinc-200">Chime</strong> or{' '}
          <strong className="text-zinc-700 dark:text-zinc-200">Alarm</strong> above to schedule reminder timing.
        </div>
      )}

      {timingMode === 'offset' && onChangeReminderTiming && reminderType !== 'none' && (
        <div>
          <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-2 block">
            When to Remind
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'on_time', label: 'At Time' },
              { id: '5m', label: '5m Before' },
              { id: '15m', label: '15m Before' },
              { id: '30m', label: '30m Before' },
              { id: '1h', label: '1h Before' },
              { id: '1d', label: '1d Before' },
            ].map(item => {
              const active = reminderTiming === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeReminderTiming(item.id)}
                  className={`py-2 px-2 text-xs transition-all cursor-pointer tabular-nums ${
                    active
                      ? 'rounded-full bg-indigo-600 text-white font-bold shadow-xs'
                      : 'rounded-[12px] bg-[#f1f4fa] dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 font-semibold hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {timingMode === 'days_before' && onChangeDaysBefore && (
        <div>
          <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-2 block">
            Advance Notice ({daysBefore === 0 ? 'On due date' : `${daysBefore}d before due`})
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { days: 0, label: 'Same Day' },
              { days: 1, label: '1 Day' },
              { days: 2, label: '2 Days' },
              { days: 3, label: '3 Days' },
              { days: 5, label: '5 Days' },
              { days: 7, label: '1 Week' },
              { days: 10, label: '10 Days' },
              { days: 14, label: '2 Weeks' },
            ].map(item => {
              const active = daysBefore === item.days;
              return (
                <button
                  key={item.days}
                  type="button"
                  onClick={() => onChangeDaysBefore(item.days)}
                  className={`py-2 px-1.5 text-[11.5px] transition-all cursor-pointer tabular-nums ${
                    active
                      ? 'rounded-full bg-indigo-600 text-white font-bold shadow-xs'
                      : 'rounded-[12px] bg-[#f1f4fa] dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 font-semibold hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {timingMode === 'daily_times' && onChangeDailyTimes && reminderType !== 'none' && (
        <div className="space-y-2.5">
          <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
            Daily Reminder Times
          </label>

          {/* Quick 1-Tap Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { time: '08:00', label: '8:00 AM' },
              { time: '13:00', label: '1:00 PM' },
              { time: '20:00', label: '8:00 PM' },
            ].map(preset => {
              const hasTime = dailyTimes.includes(preset.time);
              return (
                <button
                  key={preset.time}
                  type="button"
                  onClick={() => {
                    if (hasTime) {
                      onChangeDailyTimes(dailyTimes.filter(t => t !== preset.time));
                    } else {
                      onChangeDailyTimes([...dailyTimes, preset.time].sort());
                    }
                  }}
                  className={`px-3 py-1 text-[11px] font-bold transition-all cursor-pointer tabular-nums ${
                    hasTime
                      ? 'rounded-full bg-indigo-600 text-white shadow-xs'
                      : 'rounded-[12px] bg-[#f1f4fa] dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Custom Time Picker Input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="time"
                value={newTimeSlot}
                onChange={e => setNewTimeSlot(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-[14px] bg-[#f1f4fa] dark:bg-zinc-900 text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (newTimeSlot && !dailyTimes.includes(newTimeSlot)) {
                  onChangeDailyTimes([...dailyTimes, newTimeSlot].sort());
                }
              }}
              className="px-3.5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
            >
              <Plus size={13} />
              <span>Add</span>
            </button>
          </div>

          {/* Active Time Chips */}
          {dailyTimes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {dailyTimes.map(t => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-mono font-bold tabular-nums"
                >
                  <Clock size={11} />
                  <span>{t}</span>
                  <button
                    type="button"
                    onClick={() => onChangeDailyTimes(dailyTimes.filter(x => x !== t))}
                    className="text-indigo-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

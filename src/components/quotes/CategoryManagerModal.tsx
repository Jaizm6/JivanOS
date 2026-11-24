import React, { useState, useRef, useEffect } from 'react';
import {
  Palette,
  Pencil,
  Trash2,
  Plus,
  RotateCcw,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { QuoteCategory } from '../../data/quotes';
import { useApp } from '../../context/AppContext';
import { UnifiedFormModal, UnifiedSubModal } from '../common/FormPrimitives';
import {
  PALETTE_DISPLAY_NAMES,
  PALETTE_KEYS_FOR_PICKER,
  getPaletteByKey,
} from './quoteColors';

export interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  categoryQuoteCounts: Map<string, number>;
  onCategoryDeleted?: (deletedId: string) => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  isDark,
  categoryQuoteCounts,
  onCategoryDeleted,
}) => {
  const {
    quoteCategories,
    addQuoteCategory,
    updateQuoteCategory,
    deleteQuoteCategory,
    resetQuoteCategoriesToDefault,
    soundEngine,
  } = useApp();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<QuoteCategory | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const editInputRef = useRef<HTMLInputElement | null>(null);
  const shouldSelectAllRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setEditingId(null);
      setDraftName('');
      setNameError(null);
      setDeletingCategory(null);
      setConfirmResetOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      if (shouldSelectAllRef.current) {
        editInputRef.current.select();
        shouldSelectAllRef.current = false;
      }
    }
  }, [editingId]);

  const startEditing = (cat: QuoteCategory, selectAll = false) => {
    if (editingId && editingId !== cat.id) {
      // Save any pending name change on previously open row if valid
      try {
        updateQuoteCategory(editingId, { name: draftName });
      } catch {
        // Ignore invalid draft when switching rows
      }
    }
    shouldSelectAllRef.current = selectAll;
    setEditingId(cat.id);
    setDraftName(cat.name);
    setNameError(null);
  };

  const saveDraftName = (catId: string, closeAfter: boolean): boolean => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setNameError('Name cannot be empty.');
      return false;
    }
    if (trimmed.length > 24) {
      setNameError('Maximum 24 characters.');
      return false;
    }
    try {
      updateQuoteCategory(catId, { name: trimmed });
      setNameError(null);
      if (closeAfter) {
        setEditingId(null);
      }
      return true;
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Invalid category name.');
      return false;
    }
  };

  const handleAddCategory = () => {
    // Generate a unique initial name so it is immediately created and opened in inline Edit mode
    const existingLower = new Set(quoteCategories.map(c => c.name.trim().toLowerCase()));
    let candidate = 'New category';
    let counter = 2;
    while (existingLower.has(candidate.toLowerCase())) {
      candidate = `New category ${counter++}`;
    }

    try {
      const created = addQuoteCategory(candidate);
      soundEngine.playSuccessChime();
      startEditing(created, true);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Could not add category.');
    }
  };

  const handleConfirmDelete = () => {
    if (!deletingCategory) return;
    const targetId = deletingCategory.id;
    try {
      deleteQuoteCategory(targetId);
      if (editingId === targetId) {
        setEditingId(null);
        setNameError(null);
      }
      onCategoryDeleted?.(targetId);
      soundEngine.playSuccessChime();
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Could not delete category.');
    } finally {
      setDeletingCategory(null);
    }
  };

  const handleConfirmReset = () => {
    resetQuoteCategoriesToDefault();
    setEditingId(null);
    setNameError(null);
    setConfirmResetOpen(false);
    soundEngine.playSuccessChime();
  };

  const deletingQuoteCount = deletingCategory
    ? categoryQuoteCounts.get(deletingCategory.id) || 0
    : 0;

  return (
    <>
      <UnifiedFormModal
        isOpen={isOpen}
        onClose={onClose}
        title="Categories"
        subtitle="Colour follows category"
        accentColor="#4f46e5"
        maxWidthClass="sm:max-w-md"
        headerIcon={
          <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Palette size={14} />
          </div>
        }
        footer={
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-full text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Reset default categories</span>
            </button>

            <button
              type="button"
              onClick={handleAddCategory}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold shadow-xs transition cursor-pointer shrink-0"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>Add category</span>
            </button>
          </div>
        }
      >
        <div className="space-y-1.5">
          {quoteCategories.map(cat => {
            const palette = getPaletteByKey(cat.color);
            const dotBg = isDark ? palette.bgDark : palette.bg;
            const count = categoryQuoteCounts.get(cat.id) || 0;
            const isEditing = editingId === cat.id;
            const isWisdom = cat.id === 'wisdom';

            return (
              <div
                key={cat.id}
                className="rounded-[18px] bg-white dark:bg-[#18181e] ring-1 ring-black/[0.05] dark:ring-white/[0.08] overflow-hidden"
              >
                {/* Category Summary Row (at least 44px tall for touch) */}
                <div className="min-h-[48px] px-3 py-2 flex items-center gap-2.5">
                  <span
                    className="w-[18px] h-[18px] rounded-full shrink-0"
                    style={{
                      backgroundColor: dotBg,
                      border: isDark
                        ? '1px solid rgba(255, 255, 255, 0.24)'
                        : '1px solid rgba(0, 0, 0, 0.18)',
                    }}
                    aria-hidden="true"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {cat.name}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                      {count.toLocaleString()} {count === 1 ? 'quote' : 'quotes'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditing) {
                          saveDraftName(cat.id, true);
                        } else {
                          startEditing(cat);
                        }
                      }}
                      aria-label={isEditing ? `Done editing ${cat.name}` : `Edit ${cat.name}`}
                      className={`h-9 px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer ${
                        isEditing
                          ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                          : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {isEditing ? (
                        <>
                          <Check size={13} strokeWidth={2.5} />
                          <span>Done</span>
                        </>
                      ) : (
                        <>
                          <Pencil size={13} />
                          <span>Edit</span>
                        </>
                      )}
                    </button>

                    {!isWisdom && (
                      <button
                        type="button"
                        onClick={() => setDeletingCategory(cat)}
                        aria-label={`Delete ${cat.name}`}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Expanded Editor */}
                {isEditing && (
                  <div className="px-3 pb-3 pt-2 border-t border-zinc-200/70 dark:border-zinc-800 space-y-3">
                    <div>
                      <input
                        ref={editInputRef}
                        type="text"
                        maxLength={24}
                        placeholder="New category"
                        value={draftName}
                        onChange={e => {
                          setDraftName(e.target.value);
                          if (nameError) setNameError(null);
                        }}
                        onBlur={() => {
                          saveDraftName(cat.id, false);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            saveDraftName(cat.id, true);
                          }
                        }}
                        className="w-full h-10 px-3 rounded-[12px] bg-[#f3f6fc] dark:bg-[#111116] ring-1 ring-black/[0.08] dark:ring-white/[0.1] text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      {nameError && (
                        <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                          {nameError}
                        </p>
                      )}
                    </div>

                    {/* 28px Round Colour Swatches */}
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category colour">
                      {PALETTE_KEYS_FOR_PICKER.map(key => {
                        const swatch = getPaletteByKey(key);
                        const isSelected = cat.color === key;
                        const label = PALETTE_DISPLAY_NAMES[key] || key;
                        return (
                          <button
                            key={key}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            aria-label={label}
                            title={label}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              updateQuoteCategory(cat.id, { color: key });
                            }}
                            style={{
                              backgroundColor: isDark ? swatch.bgDark : swatch.bg,
                              border: isDark
                                ? '1px solid rgba(255, 255, 255, 0.2)'
                                : '1px solid rgba(0, 0, 0, 0.16)',
                              ...(isSelected
                                ? {
                                    outline: '2px solid #4F46E5',
                                    outlineOffset: '2px',
                                  }
                                : {}),
                            }}
                            className="w-[28px] h-[28px] rounded-full cursor-pointer transition-transform active:scale-95 shrink-0"
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </UnifiedFormModal>

      {/* Delete Category Confirmation Sub-Modal */}
      <UnifiedSubModal
        isOpen={Boolean(deletingCategory)}
        onClose={() => setDeletingCategory(null)}
        title="Delete Category"
        icon={<AlertTriangle size={16} className="text-rose-500" />}
      >
        <div className="bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.05] dark:ring-white/[0.08] space-y-3">
          <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
            Delete{' '}
            <strong className="text-zinc-900 dark:text-white">
              {deletingCategory?.name}
            </strong>
            ? {deletingQuoteCount.toLocaleString()}{' '}
            {deletingQuoteCount === 1 ? 'quote' : 'quotes'} will show under Wisdom.
            Your quotes are not deleted.
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDeletingCategory(null)}
              className="px-4 py-2 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-[#eff2f9] dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>
      </UnifiedSubModal>

      {/* Reset Default Categories Confirmation Sub-Modal */}
      <UnifiedSubModal
        isOpen={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        title="Reset Default Categories"
        icon={<RotateCcw size={16} className="text-indigo-500" />}
      >
        <div className="bg-white dark:bg-[#18181e] p-4 rounded-[22px] ring-1 ring-black/[0.05] dark:ring-white/[0.08] space-y-3">
          <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
            Restore the 7 built-in categories to their original names and colours? Any custom categories you created will be kept.
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setConfirmResetOpen(false)}
              className="px-4 py-2 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-[#eff2f9] dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReset}
              className="px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
            >
              Reset defaults
            </button>
          </div>
        </div>
      </UnifiedSubModal>
    </>
  );
};

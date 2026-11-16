import React, { useState } from 'react';
import {
  X,
  Plus,
  Tag,
  Edit2,
  Trash2,
  Search,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AppTag } from '../../types';
import { PetalShapeBadge } from './PetalExpressive';
import { TagLogoBadge, cleanTagName, formatTagLabel, getTagColor } from './TagVisuals';

interface EntitiesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'goals' | 'tags';
}

const PRESET_TAG_COLORS = [
  '#6366f1', // Indigo
  '#0ea5e9', // Sky
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
];

export const EntitiesManagerModal: React.FC<EntitiesManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    tags,
    addTag,
    updateTag,
    deleteTag,
    tasks,
    habits = [],
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');

  // New / Edit Tag state
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [editingTag, setEditingTag] = useState<AppTag | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('#6366f1');

  if (!isOpen) return null;

  // Count tasks and habits per tag
  const getUsageCountForTag = (tagName: string) => {
    const clean = cleanTagName(tagName).toLowerCase();
    const taskCount = tasks.filter(t =>
      t.tags?.some(tag => cleanTagName(tag).toLowerCase() === clean)
    ).length;
    const habitCount = habits.filter(h =>
      h.tags?.some(tag => cleanTagName(tag).toLowerCase() === clean)
    ).length;
    return { taskCount, habitCount, total: taskCount + habitCount };
  };

  // Handle Tag Creation
  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanTagName(newTagName);
    if (!cleaned) return;
    addTag(cleaned, newTagColor);
    setNewTagName('');
    setIsAddingTag(false);
  };

  // Handle Tag Update
  const handleSaveTagEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanTagName(editTagName);
    if (!editingTag || !cleaned) return;
    updateTag(editingTag.name, cleaned, editTagColor);
    setEditingTag(null);
  };

  const filteredTags = tags.filter(t =>
    formatTagLabel(t.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[90vh] bg-[#f4f7fc] dark:bg-[#09090b] rounded-[28px] border border-black/[0.06] dark:border-white/[0.08] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Material 3 Expressive Header */}
        <div className="px-5 py-4 bg-white dark:bg-[#121217] border-b border-black/[0.045] dark:border-white/[0.06] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <PetalShapeBadge
              shape="clover"
              sizeClass="w-10 h-10"
              fillColor="rgba(99, 102, 241, 0.14)"
              strokeColor="rgba(99, 102, 241, 0.3)"
            >
              <Tag className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
            </PetalShapeBadge>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                Workspace Tags
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 tabular-nums truncate">
                {tags.length} active tag{tags.length === 1 ? '' : 's'} across tasks, habits & goals
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-[#f1f4fa] dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
            title="Close Tags Hub"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Search & Add Bar */}
        <div className="px-5 py-3 bg-[#eef2f9]/70 dark:bg-[#111116] border-b border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between gap-2.5 shrink-0">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tags..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs font-medium rounded-full bg-white dark:bg-[#18181e] text-slate-900 dark:text-white ring-1 ring-black/[0.05] dark:ring-white/[0.07] focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setIsAddingTag(!isAddingTag);
              setEditingTag(null);
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0 whitespace-nowrap ${
              isAddingTag
                ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            <Plus className={`w-3.5 h-3.5 transition-transform ${isAddingTag ? 'rotate-45' : ''}`} />
            <span>{isAddingTag ? 'Cancel' : 'New Tag'}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* New Tag Form */}
          {isAddingTag && (
            <form
              onSubmit={handleCreateTag}
              className="p-4 rounded-[22px] bg-white dark:bg-[#16161c] ring-1 ring-emerald-500/25 space-y-3 shadow-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Tag Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Engineering, Deep Work, Self Care"
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-semibold rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Color
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PRESET_TAG_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewTagColor(c)}
                        className={`w-5.5 h-5.5 rounded-full transition-transform shrink-0 cursor-pointer ${
                          newTagColor === c ? 'scale-115 ring-2 ring-offset-2 ring-indigo-500/50 dark:ring-offset-[#16161c]' : 'opacity-75 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs cursor-pointer"
                >
                  Create Tag
                </button>
              </div>
            </form>
          )}

          {/* Edit Tag Inline Form */}
          {editingTag && (
            <form
              onSubmit={handleSaveTagEdit}
              className="p-4 rounded-[22px] bg-white dark:bg-[#16161c] ring-1 ring-amber-500/30 space-y-3 shadow-xs"
            >
              <h5 className="text-xs font-bold text-amber-600 dark:text-amber-400">
                Rename Tag · {formatTagLabel(editingTag.name)}
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    New Tag Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editTagName}
                    onChange={e => setEditTagName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-semibold rounded-[14px] bg-[#f3f5fa] dark:bg-[#111116] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Color
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PRESET_TAG_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditTagColor(c)}
                        className={`w-5.5 h-5.5 rounded-full transition-transform shrink-0 cursor-pointer ${
                          editTagColor === c ? 'scale-115 ring-2 ring-offset-2 ring-indigo-500/50 dark:ring-offset-[#16161c]' : 'opacity-75 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setEditingTag(null)}
                  className="px-4 py-2 rounded-full text-xs font-bold bg-[#f1f4fa] dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-full text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition shadow-xs cursor-pointer"
                >
                  Save Rename
                </button>
              </div>
            </form>
          )}

          {/* Tags List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {filteredTags.map(tagItem => {
              const { taskCount, habitCount } = getUsageCountForTag(tagItem.name);
              const tagColor = getTagColor(tagItem.name, tags);
              const label = formatTagLabel(tagItem.name);

              return (
                <div
                  key={tagItem.id || tagItem.name}
                  className="group p-3.5 rounded-[20px] bg-white dark:bg-[#14141a] ring-1 ring-black/[0.045] dark:ring-white/[0.06] hover:ring-indigo-500/30 transition-all flex items-center justify-between gap-2.5 shadow-2xs"
                >
                  <div className="min-w-0 space-y-1">
                    <TagLogoBadge tag={tagItem.name} appTags={tags} size="md" className="max-w-full" />
                    <span className="text-[10.5px] font-medium text-slate-400 dark:text-zinc-500 tabular-nums truncate block pl-1">
                      {taskCount} task{taskCount !== 1 ? 's' : ''}
                      {habitCount > 0 ? ` · ${habitCount} habit${habitCount !== 1 ? 's' : ''}` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTag(tagItem);
                        setEditTagName(tagItem.name);
                        setEditTagColor(tagColor);
                        setIsAddingTag(false);
                      }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-[#f1f4fa] dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      title="Rename / Modify Tag"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            `Delete tag "${label}"? This will remove it from ${taskCount} task(s).`
                          )
                        ) {
                          deleteTag(tagItem.name);
                        }
                      }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Delete Tag"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredTags.length === 0 && (
              <div className="col-span-full py-10 text-center space-y-2 rounded-[22px] bg-white/60 dark:bg-[#14141a]/60">
                <Tag className="w-8 h-8 text-slate-300 dark:text-zinc-700 mx-auto" />
                <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                  No tags match "{searchQuery}"
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

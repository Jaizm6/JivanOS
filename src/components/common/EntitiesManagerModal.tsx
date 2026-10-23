import React, { useState } from 'react';
import {
  X,
  Plus,
  Tag,
  Edit2,
  Trash2,
  Layers,
  Search,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AppTag } from '../../types';

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
  '#ef4444', // Rose
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
];

export const EntitiesManagerModal: React.FC<EntitiesManagerModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'tags',
}) => {
  const {
    tags,
    addTag,
    updateTag,
    deleteTag,
    tasks,
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

  // Count tasks per tag
  const getTasksCountForTag = (tagName: string) => {
    const clean = tagName.toLowerCase();
    return tasks.filter(t => t.tags?.some(tag => tag.toLowerCase() === clean)).length;
  };

  // Handle Tag Creation
  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    addTag(newTagName.trim(), newTagColor);
    setNewTagName('');
    setIsAddingTag(false);
  };

  // Handle Tag Update
  const handleSaveTagEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTag || !editTagName.trim()) return;
    updateTag(editingTag.name, editTagName.trim(), editTagColor);
    setEditingTag(null);
  };

  const filteredTags = tags.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                Workspace Tags Hub ({tags.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Central management for categorized topics and labels
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Close Hub"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tags..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setIsAddingTag(!isAddingTag);
              setEditingTag(null);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAddingTag ? 'Cancel' : 'New Tag'}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* New Tag Form */}
          {isAddingTag && (
            <form
              onSubmit={handleCreateTag}
              className="p-4 rounded-2xl border border-emerald-100 dark:border-emerald-950/80 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Tag Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. engineering, chore, self-care"
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:outline-hidden"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Color</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {PRESET_TAG_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewTagColor(c)}
                        className={`w-5 h-5 rounded-full border transition shrink-0 ${
                          newTagColor === c ? 'scale-115 ring-2 ring-indigo-500/30' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800/60">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs cursor-pointer"
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
              className="p-4 rounded-2xl border border-amber-100 dark:border-amber-950/80 bg-amber-50/10 dark:bg-amber-950/10 space-y-3"
            >
              <h5 className="text-xs font-bold text-amber-700 dark:text-amber-400">
                Rename Tag: #{editingTag.name}
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    New Tag Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editTagName}
                    onChange={e => setEditTagName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:outline-hidden"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Color</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {PRESET_TAG_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditTagColor(c)}
                        className={`w-5 h-5 rounded-full border transition shrink-0 ${
                          editTagColor === c ? 'scale-115 ring-2 ring-indigo-500/30' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setEditingTag(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition shadow-xs cursor-pointer"
                >
                  Save Rename
                </button>
              </div>
            </form>
          )}

          {/* Tags List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {filteredTags.map(tagItem => {
              const taskCount = getTasksCountForTag(tagItem.name);

              return (
                <div
                  key={tagItem.id || tagItem.name}
                  className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition flex items-center justify-between gap-2 shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: tagItem.color || '#6366f1' }}
                    />
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate block">
                        #{tagItem.name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {taskCount} task{taskCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTag(tagItem);
                        setEditTagName(tagItem.name);
                        setEditTagColor(tagItem.color || '#6366f1');
                        setIsAddingTag(false);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Rename / Modify Tag"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete tag #${tagItem.name}? This will remove it from all ${taskCount} task(s).`)) {
                          deleteTag(tagItem.name);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Delete Tag"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

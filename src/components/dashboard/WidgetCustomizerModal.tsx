import React from 'react';
import { X, ArrowUp, ArrowDown, RotateCcw, Check, Sliders, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DashboardWidgetConfig } from '../../types';

export const WidgetCustomizerModal: React.FC = () => {
  const { isWidgetModalOpen, setIsWidgetModalOpen, widgets, reorderWidgets, toggleWidget, resetWidgets } = useApp();

  if (!isWidgetModalOpen) return null;

  const moveWidget = (index: number, direction: 'up' | 'down') => {
    const newWidgets = [...widgets];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newWidgets.length) return;

    const temp = newWidgets[index];
    newWidgets[index] = newWidgets[targetIndex];
    newWidgets[targetIndex] = temp;

    // update order numbers
    newWidgets.forEach((w, idx) => {
      w.order = idx;
    });

    reorderWidgets(newWidgets);
  };

  const handleSizeChange = (id: string, size: DashboardWidgetConfig['size']) => {
    const updated = widgets.map(w => (w.id === id ? { ...w, size } : w));
    reorderWidgets(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Customize Dashboard Widgets
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Show, hide, resize, and reorder modular cards
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsWidgetModalOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Widgets List */}
        <div className="mt-4 space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {widgets.map((widget, index) => (
            <div
              key={widget.id}
              className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                widget.enabled
                  ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                  : 'bg-slate-100/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800 opacity-60'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => toggleWidget(widget.id)}
                  title={widget.enabled ? 'Disable widget' : 'Enable widget'}
                  className={`p-1.5 rounded-lg transition ${
                    widget.enabled
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'border border-slate-300 dark:border-slate-600 text-slate-400'
                  }`}
                >
                  {widget.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {widget.title}
                  </p>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                    ID: {widget.id}
                  </span>
                </div>
              </div>

              {/* Controls: Size selector & Order buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  value={widget.size}
                  onChange={e => handleSizeChange(widget.id, e.target.value as DashboardWidgetConfig['size'])}
                  className="px-2 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                >
                  <option value="small">Small (1 col)</option>
                  <option value="medium">Medium (2 cols)</option>
                  <option value="full">Full width</option>
                </select>

                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveWidget(index, 'up')}
                    className="p-1 rounded bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-300"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={index === widgets.length - 1}
                    onClick={() => moveWidget(index, 'down')}
                    className="p-1 rounded bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-300"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={resetWidgets}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Default</span>
          </button>

          <button
            type="button"
            onClick={() => setIsWidgetModalOpen(false)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Download,
  Copy,
  Check,
  Calendar,
  CheckSquare,
  Activity,
  ReceiptText,
  BookLock,
  Quote,
  Target,
  FileCode,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { ProviderLogo } from './ProviderLogo';

interface SnapshotInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  version: number | null;
  accountEmail: string;
  onRestore?: (version: number) => void;
}

export const SnapshotInspectorModal: React.FC<SnapshotInspectorModalProps> = ({
  isOpen,
  onClose,
  version,
  accountEmail,
  onRestore,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snapshotData, setSnapshotData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'raw'>('summary');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || version === null) return;

    let isMounted = true;
    setLoading(true);
    setError('');

    fetch(`/api/backup/inspect/${encodeURIComponent(accountEmail)}/${version}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load snapshot #${version}`);
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setSnapshotData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Error fetching snapshot details.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, version, accountEmail]);

  if (!isOpen || version === null) return null;

  const data = snapshotData?.data || {};

  // Compute item counts safely
  const taskCount = Array.isArray(data.tasks) ? data.tasks.length : 0;
  const habitCount = Array.isArray(data.habits) ? data.habits.length : 0;
  const medCount = Array.isArray(data.medications) ? data.medications.length : 0;
  const billCount = Array.isArray(data.bills) ? data.bills.length : 0;
  const goalCount = Array.isArray(data.goals) ? data.goals.length : 0;
  const quoteCount = Array.isArray(data.quotes) ? data.quotes.length : 0;
  const journalCount = Array.isArray(data.journal) ? data.journal.length : 0;

  const rawJsonString = snapshotData
    ? JSON.stringify(snapshotData.data || snapshotData.raw, null, 2)
    : '';

  const handleCopyJson = () => {
    navigator.clipboard.writeText(rawJsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    window.open(
      `/api/backup/download/${encodeURIComponent(accountEmail)}/${version}`,
      '_blank'
    );
  };

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-black/65 backdrop-blur-xs p-3 sm:p-4 flex min-h-full items-center justify-center animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Inspect Backup Snapshot #{version}
                </h3>
                {snapshotData?.provider && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    <ProviderLogo provider={snapshotData.provider} className="w-3 h-3" />
                    <span>{snapshotData.provider}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verified payload stored for {accountEmail} &bull;{' '}
                {snapshotData?.timestamp
                  ? new Date(snapshotData.timestamp).toLocaleString()
                  : 'Recent'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Tabs */}
        <div className="px-5 pt-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('summary')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'summary'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Contents Summary</span>
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'raw'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Raw JSON Data</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {loading && (
            <div className="py-12 text-center text-xs text-slate-500 space-y-2">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Loading snapshot payload...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {!loading && !error && activeTab === 'summary' && (
            <div className="space-y-4">
              {/* Informational GDrive clarification card */}
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <ProviderLogo provider="gdrive" className="w-4 h-4 shrink-0" />
                  <span>Looking for this file in your personal Google Drive?</span>
                </div>
                <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                  Your snapshot is safely stored and encrypted in the Jivan cloud backup repository for account <strong>{accountEmail}</strong>. To keep a direct copy in your Google Drive drive.google.com root folder, click <strong>Download JSON File</strong> below and drop it into Drive.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href="https://drive.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-[11px] shadow-2xs transition"
                  >
                    <span>Open Google Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    onClick={handleDownloadFile}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-semibold text-[11px] hover:bg-amber-50 dark:hover:bg-slate-700 transition"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download JSON File</span>
                  </button>
                </div>
              </div>

              {/* Verified Item Counts Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Tasks & Todos', count: taskCount, icon: CheckSquare, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60' },
                  { label: 'Habits & Streaks', count: habitCount, icon: Activity, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60' },
                  { label: 'Medications & Doses', count: medCount, icon: Sparkles, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60' },
                  { label: 'Bills & Subscriptions', count: billCount, icon: ReceiptText, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60' },
                  { label: 'Long-term Goals', count: goalCount, icon: Target, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60' },
                  { label: 'Encrypted Journals', count: journalCount, icon: BookLock, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/60' },
                  { label: 'Daily Quotes', count: quoteCount, icon: Quote, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/60' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-2.5"
                  >
                    <div className={`w-8 h-8 rounded-xl ${item.color} flex items-center justify-center shrink-0`}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-base font-black text-slate-900 dark:text-white block leading-tight">
                        {item.count}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block">
                        {item.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Profile Snapshot Details */}
              {data.profile && (
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs space-y-2">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Profile Info in Snapshot</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <div>Name: <strong className="text-slate-900 dark:text-white">{data.profile.name || 'Jaiprakash'}</strong></div>
                    <div>Nickname: <strong className="text-slate-900 dark:text-white">{data.profile.nickname || 'Jaiz'}</strong></div>
                    <div>Email: <strong className="text-slate-900 dark:text-white">{data.profile.identifier || accountEmail}</strong></div>
                    <div>Currency: <strong className="text-slate-900 dark:text-white">{data.profile.preferredCurrency || 'INR'}</strong></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && !error && activeTab === 'raw' && (
            <div className="relative">
              <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-[11px] font-semibold flex items-center gap-1 shadow-xs transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-2xl bg-slate-900 text-slate-200 text-[11px] font-mono overflow-x-auto max-h-[360px] border border-slate-800">
                {rawJsonString}
              </pre>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0 text-xs">
          <button
            type="button"
            onClick={handleDownloadFile}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .json Backup</span>
          </button>

          <div className="flex items-center gap-2">
            {onRestore && (
              <button
                type="button"
                onClick={() => {
                  onRestore(version);
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore to System</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

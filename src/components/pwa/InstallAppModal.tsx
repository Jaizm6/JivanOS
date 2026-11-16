import React, { useState } from 'react';
import {
  Smartphone,
  Laptop,
  Apple,
  Share2,
  Copy,
  Check,
  Download,
  X,
  ExternalLink,
  ShieldCheck,
  Wifi,
  Sparkles,
  QrCode,
  CheckCircle2,
  Globe,
  Package,
} from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'apk' | 'android' | 'ios' | 'web'>('apk');

  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(true);

  if (!isOpen) return null;

  const appUrl =
    typeof window !== 'undefined' && window.location.origin.includes('localhost')
      ? 'https://ais-pre-yrafffgams5ziro4or5dgz-892337589346.asia-southeast1.run.app'
      : typeof window !== 'undefined' && !window.location.href.includes('localhost')
        ? window.location.href.split('?')[0].split('#')[0]
        : 'https://ais-pre-yrafffgams5ziro4or5dgz-892337589346.asia-southeast1.run.app';

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(appUrl)}&margin=4`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const input = document.createElement('input');
      input.value = appUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'JivanOS',
          text: 'Open and install JivanOS on your phone with full offline & cloud sync!',
          url: appUrl,
        });
      } catch {
        // Cancelled or ignored
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 my-auto space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Smartphone className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Android APK &amp; Phone Install
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Capacitor APK + WebAPK Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Get a standalone offline <code className="font-mono">JivanOS.apk</code> or install directly via Chrome
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1-Click Install Banner (Chromium, Android Chrome, Edge, Desktop Chrome) */}
        {isInstallable && (
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-300 dark:border-indigo-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Direct 1-Click Native WebAPK Install Ready
              </span>
              <p className="text-[11.5px] text-slate-600 dark:text-slate-300 leading-snug">
                Tap below to mint and install a signed Android package directly onto your device.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await install();
                onClose();
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/25 shrink-0 cursor-pointer transition"
            >
              <Download className="w-4 h-4 stroke-[2.3]" />
              <span>Install App Now</span>
            </button>
          </div>
        )}

        {isInstalled && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">
              JivanOS is currently running in installed standalone mode!
            </span>
          </div>
        )}

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('apk')}
            className={`py-2 px-1.5 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
              activeTab === 'apk'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Package className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">.APK File</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('android')}
            className={`py-2 px-1.5 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
              activeTab === 'android'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Android</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ios')}
            className={`py-2 px-1.5 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
              activeTab === 'ios'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Apple className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">iOS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('web')}
            className={`py-2 px-1.5 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
              activeTab === 'web'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Laptop className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Desktop</span>
          </button>
        </div>

        {/* Tab 0: Dedicated Standalone .APK File via GitHub Actions + Capacitor */}
        {activeTab === 'apk' && (
          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-2.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Automated Native Android APK Builder (Capacitor + Gradle)</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                Why did PWABuilder get stuck earlier? Because AI Studio preview URLs (<code className="font-mono">ais-dev-...</code>) require your Google session cookies, so external crawlers like PWABuilder cannot read the manifest from the preview URL.
              </p>
              <p className="text-[11.5px] leading-relaxed text-slate-700 dark:text-slate-200 font-medium">
                Instead, this project now includes a pre-configured <strong>Capacitor Android configuration</strong> (<code className="font-mono">capacitor.config.json</code>) and an automated <strong>GitHub Actions APK Compiler</strong> (<code className="font-mono">.github/workflows/build-android-apk.yml</code>) that bundles the entire app offline into a real <code className="font-mono">JivanOS.apk</code> file!
              </p>
              <ol className="space-y-2 text-[11.5px] leading-relaxed pt-1">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Click the <strong>GitHub icon</strong> in the top-right bar of AI Studio to push this project to your GitHub repository (large video files have been cleaned up so the push succeeds).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Open your GitHub repository. GitHub Actions will automatically run the <strong>&quot;Build JivanOS Android APK&quot;</strong> workflow using JDK 21, Android SDK, and Capacitor.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Once complete (~2 minutes), go to the <strong>Releases</strong> section (or the <strong>Actions</strong> tab &rarr; Artifacts) on your GitHub repo and download <strong><code className="font-mono">JivanOS.apk</code></strong> straight to your Android phone!
                  </span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Tab 1: Android Chrome WebAPK Instructions */}
        {activeTab === 'android' && (
          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                <span>Instant Chrome WebAPK Installation (10 Seconds)</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                When you tap &quot;Install app&quot; in Chrome on Android, Google Play Services automatically compiles and installs a real signed WebAPK on your phone:
              </p>
              <ol className="space-y-2 text-[11.5px] leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Open the Shared URL below in <strong>Google Chrome</strong> on your Android phone.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Tap the <strong>three dots (⋮)</strong> in Chrome&apos;s top-right corner and select <strong>&quot;Install app&quot;</strong> (or &quot;Add to Home screen&quot;).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Confirm <strong>Install</strong>. Android installs JivanOS into your system app drawer with full-screen standalone mode and offline storage!
                  </span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Tab 2: iPhone / iPad Instructions */}
        {activeTab === 'ios' && (
          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                <span>How to Install on iPhone / iPad (Safari)</span>
              </div>
              <ol className="space-y-2 text-[11.5px] leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Open the link in <strong>Safari</strong> on your iPhone or iPad.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Tap the <strong>Share</strong> button in the bottom toolbar and tap <strong>&quot;Add to Home Screen&quot;</strong>.
                  </span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Tab 3: Web / Desktop Instructions */}
        {activeTab === 'web' && (
          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Desktop App Window Mode (PC, Mac, Linux)</span>
              </div>
              <p className="text-[11.5px] leading-relaxed">
                In Chrome, Edge, or Brave, click the <strong>Install</strong> icon on the right side of the address bar to install JivanOS as a standalone desktop app window.
              </p>
            </div>
          </div>
        )}

        {/* QR Code & Direct Link Box */}
        <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Direct App Link &amp; QR Code
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowQR(!showQR)}
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              {showQR ? 'Hide QR' : 'Show QR'}
            </button>
          </div>

          {showQR && (
            <div className="flex items-center gap-3 pt-1">
              <div className="p-1.5 bg-white rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0">
                <img
                  src={qrCodeUrl}
                  alt="QR Code to open JivanOS on phone"
                  className="w-24 h-24 rounded-lg object-contain"
                  loading="lazy"
                />
              </div>
              <div className="space-y-1.5 text-xs flex-1 min-w-0">
                <div className="flex items-center gap-1.5 p-1.5 pl-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <span className="font-mono text-[11px] text-slate-700 dark:text-slate-200 truncate flex-1 select-all">
                    {appUrl}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition shrink-0 ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
                    title="Share link"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <a
                  href={appUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <span>Open Standalone Link in New Tab</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>100% Offline-Capable &bull; Firebase Cloud Sync</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

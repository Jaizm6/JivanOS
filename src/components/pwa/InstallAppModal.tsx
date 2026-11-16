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
  ArrowRight,
  Info,
} from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'web'>(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(ua)) return 'ios';
      if (/android/.test(ua)) return 'android';
    }
    return 'android';
  });

  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(true);

  if (!isOpen) return null;

  // The permanent accessible public web app URL (live deployment preview or current origin)
  const appUrl = typeof window !== 'undefined' && window.location.origin.includes('localhost')
    ? 'https://ais-pre-yrafffgams5ziro4or5dgz-892337589346.asia-southeast1.run.app'
    : (typeof window !== 'undefined' && !window.location.href.includes('localhost')
        ? window.location.href.split('?')[0].split('#')[0]
        : 'https://ais-pre-yrafffgams5ziro4or5dgz-892337589346.asia-southeast1.run.app');

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
          title: 'Jivan: Simple Life System',
          text: 'Open and install Jivan on your phone with full offline & cloud sync!',
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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 my-auto space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Smartphone className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Install on Phone & Web Access
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  PWA Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Install as a native phone app and access seamlessly on any web browser
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
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-emerald-500/15 border border-indigo-300 dark:border-indigo-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Direct 1-Click Installation Ready
              </span>
              <p className="text-[11.5px] text-slate-600 dark:text-slate-300 leading-snug">
                Your browser supports direct installation. Add Jivan straight to your home screen or apps folder now!
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
              <span>Install to Device</span>
            </button>
          </div>
        )}

        {isInstalled && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">
              Jivan is already running in installed standalone mode!
            </span>
          </div>
        )}

        {/* Scan QR Code to Open on Phone Immediately */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Scan with Phone Camera to Open Immediately
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
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
              <div className="p-2 bg-white rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                <img
                  src={qrCodeUrl}
                  alt="QR Code to open Jivan on phone"
                  className="w-32 h-32 sm:w-36 sm:h-36 rounded-lg object-contain"
                  loading="lazy"
                />
              </div>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed text-center sm:text-left">
                <p className="font-semibold text-slate-900 dark:text-white">
                  📱 Point your phone&apos;s camera at the QR code.
                </p>
                <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
                  1. Open your phone camera or QR scanner.<br />
                  2. Tap the link banner to open Jivan.<br />
                  3. Tap <strong>Install</strong> or <strong>Add to Home Screen</strong>.
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-1.5 pt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Works both Online &amp; Offline with Cloud Sync</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Direct Link Box with Open, Copy & Share */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Direct Web &amp; Phone URL (Standalone)
            </label>
            <a
              href={appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Open in New Tab (Outside AI Studio)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex items-center gap-2 p-1.5 pl-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            <span className="font-mono text-xs text-slate-700 dark:text-slate-200 truncate flex-1 select-all">
              {appUrl}
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shrink-0 ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition"
              title="Share link to phone or friends"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <div className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>How Standalone &amp; User Login Works</span>
            </div>
            <p className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
              When opened in your phone or computer browser outside AI Studio, tap <strong>&quot;Add to Home Screen&quot;</strong> or <strong>&quot;Install&quot;</strong>. The app installs with its own icon on your home screen or desktop. Then, simply click the <strong>Account / Profile</strong> button to log in with your email or ID, and your data syncs automatically across all your devices!
            </p>
          </div>
        </div>

        {/* Device Switcher Tabs */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Installation Guide by Device
          </span>
          <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('android')}
              className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'android'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ios')}
              className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'ios'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Apple className="w-3.5 h-3.5" />
              <span>iPhone / iPad</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('web')}
              className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'web'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Web / Desktop</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Android Instructions */}
        {activeTab === 'android' && (
          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                <span>How to Install on Android (Chrome, Edge, Samsung Internet)</span>
              </div>
              <ol className="space-y-2 text-[11.5px] leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Open the link in <strong>Google Chrome</strong> or your default browser on your Android phone.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Look for the <strong>&quot;Add Jivan to Home screen&quot;</strong> prompt banner at the bottom, or tap the <strong>three dots (⋮)</strong> in Chrome&apos;s top-right corner.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Tap <strong>&quot;Install app&quot;</strong> (or &quot;Add to Home screen&quot;).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    4
                  </span>
                  <span>
                    Jivan appears on your phone screen as a full native app with offline support, alarms, and zero address bar!
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
                    Tap the <strong>Share</strong> button (the square with an arrow pointing upward) in the bottom toolbar.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Scroll down in the share sheet and tap <strong>&quot;Add to Home Screen&quot;</strong> (with the <strong>+</strong> icon).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                    4
                  </span>
                  <span>
                    Tap <strong>Add</strong> in the top-right corner. Jivan launches in full-screen standalone mode like a native iOS application!
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
                <span>Access &amp; Install on Web / Desktop (PC, Mac, Linux)</span>
              </div>
              <p className="text-[11.5px] leading-relaxed">
                You can bookmark and use Jivan anytime from any web browser on desktop.
              </p>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-[11px] space-y-1">
                <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" />
                  Desktop App Window Mode:
                </span>
                <p className="text-slate-600 dark:text-slate-400 leading-snug">
                  In Chrome, Edge, or Brave, click the <strong>Install</strong> icon on the right side of the URL bar (or click Chrome Menu &gt; Save and share &gt; Install Jivan). It runs as its own clean desktop window!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Reassurance Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Offline First</span>
            </div>
            <span>&bull;</span>
            <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
              <Wifi className="w-3.5 h-3.5" />
              <span>Cross-Device Cloud Sync</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer transition text-center"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

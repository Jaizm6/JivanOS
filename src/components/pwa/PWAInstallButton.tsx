import React from 'react';
import { Download, Smartphone, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';
import { useApp } from '../../context/AppContext';

interface PWAInstallButtonProps {
  compact?: boolean;
  className?: string;
  showTextOnMobile?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  className = '',
  showTextOnMobile = false,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const { setIsInstallModalOpen } = useApp();

  // If already installed and running standalone, show a subtle status or suppress
  if (isInstalled) {
    return (
      <button
        type="button"
        id="btn-pwa-installed"
        onClick={() => setIsInstallModalOpen(true)}
        title="OmniLifeOS is installed as a PWA. Click for device sync & info."
        className={`flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-full px-2 py-0.5 transition cursor-pointer hover:bg-emerald-100 ${className}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span className={compact ? 'hidden lg:inline' : ''}>Installed</span>
      </button>
    );
  }

  // If direct browser 1-click install is available
  if (isInstallable) {
    return (
      <button
        type="button"
        id="btn-pwa-install-direct"
        onClick={async () => {
          const success = await install();
          if (!success) {
            setIsInstallModalOpen(true);
          }
        }}
        title="1-Click Install OmniLifeOS directly to your device (PWA)"
        className={`flex items-center gap-1.5 font-bold rounded-full transition shadow-xs cursor-pointer active:scale-95 ${
          compact
            ? 'p-1.5 sm:px-2.5 sm:py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs'
            : 'px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs'
        } ${className}`}
      >
        <Download className="w-3.5 h-3.5 stroke-[2.3]" />
        <span className={compact && !showTextOnMobile ? 'hidden sm:inline' : ''}>
          Install App
        </span>
      </button>
    );
  }

  // Universal fallback: opens device setup modal (QR code, Android, iOS Safari, and Desktop Web access)
  return (
    <button
      type="button"
      id="btn-pwa-install-modal"
      onClick={() => setIsInstallModalOpen(true)}
      title="Install on Phone & Access on Web (Android, iPhone, Desktop)"
      className={`flex items-center gap-1.5 font-semibold rounded-full border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer active:scale-95 shadow-2xs ${
        compact
          ? 'p-1.5 sm:px-2.5 sm:py-1 text-xs'
          : 'px-3 py-1 text-xs'
      } ${className}`}
    >
      <Smartphone className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
      <span className={compact && !showTextOnMobile ? 'hidden sm:inline' : ''}>
        Install on Phone
      </span>
    </button>
  );
};

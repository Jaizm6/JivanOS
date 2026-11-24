import React, { useEffect, useState } from 'react';
import {
  Bell,
  ChevronRight,
  Cloud,
  ExternalLink,
  Globe,
  Monitor,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  Volume2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { JivanLogoMark } from '../layout/Sidebar';
import { APP_GITHUB_REPO, APP_VERSION } from '../../utils/appVersion';
import { soundEngine } from '../../utils/audio';
import { NotificationSettingsModal } from '../notifications/NotificationSettingsModal';
import { BackupSyncScreen } from './BackupSyncScreen';
import { PersonalProfileScreen } from './PersonalProfileScreen';
import { SettingsSubpageHeader } from './SettingsSubpageHeader';
import { AppearanceSettingsSection } from './AppearanceSettingsSection';
import { NotificationsSettingsSection } from './NotificationsSettingsSection';
import { SoundHapticsSettingsSection } from './SoundHapticsSettingsSection';
import {
  AiSettingsSection,
  RegionalScheduleSection,
  SecuritySettingsSection,
} from './SecurityAiSystemSections';
import {
  NAVIGATE_SETTINGS_SECTION_EVENT,
  getRealSyncOverview,
} from '../../sync/syncConnectionState';
import { DRIVE_SYNC_STATE_EVENT } from '../../utils/googleDriveSync';
import { DROPBOX_SYNC_STATE_EVENT } from '../../utils/dropboxSync';
import { TELEGRAM_SYNC_STATE_EVENT } from '../../sync/providers/TelegramSyncProvider';
import { MEGA_SYNC_STATE_EVENT } from '../../sync/providers/MEGASyncProvider';
import { JIVANOS_CLOUD_STATE_EVENT } from '../../sync/providers/FirestoreSyncProvider';
import {
  M3Switch,
  PetalExpressiveShape,
  PetalShapeBadge,
  getSavedExpressiveShapes,
} from '../common/PetalExpressive';
import { showAndroidToast } from '../common/AndroidToast';
import { isDesktop } from '../../desktop/KeychainService';
import { TrayService } from '../../desktop/TrayService';

export type SettingsSectionId =
  | 'backup_sync'
  | 'profile'
  | 'security'
  | 'appearance'
  | 'notifications'
  | 'sound'
  | 'ai'
  | 'system';

interface SettingsRowItem {
  id: SettingsSectionId;
  group: 'personalize' | 'data' | 'preferences';
  title: string;
  rightValue?: string;
  keywords: string;
  icon: React.ReactNode;
  circleBg: string;
  fillClass: string;
  strokeClass: string;
  shape: PetalExpressiveShape;
}

export const SettingsManager: React.FC = () => {
  const { theme, userProfile, appLock, joplinSyncSettings, firebaseUser } = useApp();

  const [expressiveShapes, setExpressiveShapes] = useState<boolean>(() =>
    getSavedExpressiveShapes()
  );
  const [isNotifSettingsOpen, setIsNotifSettingsOpen] = useState(false);
  const desktopRuntime = isDesktop();
  const [autoLaunchEnabled, setAutoLaunchEnabled] = useState(false);
  const [isUpdatingAutoLaunch, setIsUpdatingAutoLaunch] = useState(false);

  useEffect(() => {
    if (!desktopRuntime) return;
    let active = true;
    TrayService.getAutoLaunchEnabled()
      .then((enabled) => {
        if (active) setAutoLaunchEnabled(enabled);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [desktopRuntime]);

  const handleToggleAutoLaunch = async (next: boolean) => {
    if (!desktopRuntime || isUpdatingAutoLaunch) return;
    setIsUpdatingAutoLaunch(true);
    try {
      const actual = await TrayService.setAutoLaunchEnabled(next);
      setAutoLaunchEnabled(actual);
      showAndroidToast(
        actual ? 'JivanOS will launch on startup' : 'Auto-launch on startup disabled',
        2200,
        'default'
      );
    } catch {
      showAndroidToast('Could not update startup preference', 2600, 'error');
    } finally {
      setIsUpdatingAutoLaunch(false);
    }
  };

  // Dedicated section navigation state (supports deep-linking directly to Backup & Sync in 1 tap)
  const [activeSection, setActiveSection] = useState<SettingsSectionId | null>(() => {
    try {
      const pending = sessionStorage.getItem('jivanos_pending_settings_section');
      if (pending === 'backup_sync' || pending === 'profile') {
        sessionStorage.removeItem('jivanos_pending_settings_section');
        return pending;
      }
    } catch {}
    return null;
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Keep real provider sync overview live
  const [, setSyncStateTick] = useState(0);
  useEffect(() => {
    const handleNavigateEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.section === 'backup_sync' || detail?.section === 'profile') {
        setActiveSection(detail.section);
        try {
          sessionStorage.removeItem('jivanos_pending_settings_section');
        } catch {}
      }
    };
    const bump = () => setSyncStateTick((t) => t + 1);
    window.addEventListener(NAVIGATE_SETTINGS_SECTION_EVENT, handleNavigateEvent);
    window.addEventListener(DRIVE_SYNC_STATE_EVENT, bump);
    window.addEventListener(DROPBOX_SYNC_STATE_EVENT, bump);
    window.addEventListener(TELEGRAM_SYNC_STATE_EVENT, bump);
    window.addEventListener(MEGA_SYNC_STATE_EVENT, bump);
    window.addEventListener(JIVANOS_CLOUD_STATE_EVENT, bump);
    return () => {
      window.removeEventListener(NAVIGATE_SETTINGS_SECTION_EVENT, handleNavigateEvent);
      window.removeEventListener(DRIVE_SYNC_STATE_EVENT, bump);
      window.removeEventListener(DROPBOX_SYNC_STATE_EVENT, bump);
      window.removeEventListener(TELEGRAM_SYNC_STATE_EVENT, bump);
      window.removeEventListener(MEGA_SYNC_STATE_EVENT, bump);
      window.removeEventListener(JIVANOS_CLOUD_STATE_EVENT, bump);
    };
  }, []);

  const realSyncOverview = getRealSyncOverview(firebaseUser, joplinSyncSettings);

  const [aiProviderInput, setAiProviderInput] = useState(() => {
    try {
      return localStorage.getItem('omni_ai_provider') || 'gemini';
    } catch {
      return 'gemini';
    }
  });
  const [selectedAiModelInput, setSelectedAiModelInput] = useState(() => {
    try {
      const m = localStorage.getItem('omni_ai_model');
      return !m || m === 'gemini-3.8-flash' ? 'gemini-4-hydrogen' : m;
    } catch {
      return 'gemini-4-hydrogen';
    }
  });
  const [timezoneInput, setTimezoneInput] = useState(() => {
    try {
      return localStorage.getItem('omni_timezone') || 'Asia/Kolkata';
    } catch {
      return 'Asia/Kolkata';
    }
  });

  const notifPerm =
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  const volumePct = Math.round((soundEngine.getVolume?.() ?? 0.8) * 100);
  const shortTz = timezoneInput.split('/').pop()?.replace(/_/g, ' ') || timezoneInput;
  const providerLabel =
    aiProviderInput === 'gemini'
      ? 'Gemini'
      : aiProviderInput === 'openai'
        ? 'OpenAI'
        : aiProviderInput === 'deepseek'
          ? 'DeepSeek'
          : aiProviderInput === 'qwen'
            ? 'Qwen'
            : 'Local';

  // Compact grouped rows — Personal Profile is ONLY the top card (never duplicated below)
  const settingsRows: SettingsRowItem[] = [
    // Group 1: Personalize
    {
      id: 'appearance',
      group: 'personalize',
      title: 'Display & appearance',
      rightValue: theme === 'dark' ? 'Dark' : 'Light',
      keywords: 'theme dark light amoled oled palette color harmony shapes appearance',
      icon: <Palette className="w-4 h-4 text-white" />,
      circleBg: 'bg-amber-500',
      fillClass: 'text-amber-500',
      strokeClass: 'text-amber-500',
      shape: 'cookie12',
    },
    {
      id: 'sound',
      group: 'personalize',
      title: 'Sound & vibration',
      rightValue: volumePct === 0 ? 'Muted' : `${volumePct}%`,
      keywords: 'audio volume mute vibration haptics chimes ringtones tones sound',
      icon: <Volume2 className="w-4 h-4 text-white" />,
      circleBg: 'bg-emerald-500',
      fillClass: 'text-emerald-500',
      strokeClass: 'text-emerald-500',
      shape: 'clover',
    },
    {
      id: 'notifications',
      group: 'personalize',
      title: 'Notifications & alarms',
      rightValue: notifPerm === 'granted' ? 'On' : undefined,
      keywords: 'alarms snooze hydration water banner popup toast permission notifications',
      icon: <Bell className="w-4 h-4 text-white" />,
      circleBg: 'bg-blue-500',
      fillClass: 'text-blue-500',
      strokeClass: 'text-blue-500',
      shape: 'cookie9',
    },

    // Group 2: Data & Privacy
    {
      id: 'backup_sync',
      group: 'data',
      title: 'Backup & sync',
      rightValue: realSyncOverview.hasAnyConnected
        ? `${realSyncOverview.connectedCount} connected`
        : 'Not connected',
      keywords: 'cloud google drive dropbox telegram webdav nextcloud s3 export restore snapshot',
      icon: <Cloud className="w-4 h-4 text-white" />,
      circleBg: 'bg-sky-500',
      fillClass: 'text-sky-500',
      strokeClass: 'text-sky-500',
      shape: 'cookie12',
    },
    {
      id: 'security',
      group: 'data',
      title: 'Security & privacy',
      rightValue: appLock.isEnabled ? 'Locked' : 'Off',
      keywords: 'lock pin passcode fingerprint biometric aes encryption passphrase vault security',
      icon: <ShieldCheck className="w-4 h-4 text-white" />,
      circleBg: 'bg-indigo-600',
      fillClass: 'text-indigo-600',
      strokeClass: 'text-indigo-600',
      shape: 'scallop',
    },

    // Group 3: Preferences
    {
      id: 'ai',
      group: 'preferences',
      title: 'Jivan AI',
      rightValue: providerLabel,
      keywords: 'gemini openai deepseek qwen ollama local model api key ai assistant',
      icon: <Sparkles className="w-4 h-4 text-white" />,
      circleBg: 'bg-violet-500',
      fillClass: 'text-violet-500',
      strokeClass: 'text-violet-500',
      shape: 'cookie9',
    },
    {
      id: 'system',
      group: 'preferences',
      title: 'Regional & schedule',
      rightValue: shortTz,
      keywords: 'timezone clock time schedule timeline hours regional system',
      icon: <Globe className="w-4 h-4 text-white" />,
      circleBg: 'bg-slate-600 dark:bg-zinc-600',
      fillClass: 'text-slate-600 dark:text-zinc-600',
      strokeClass: 'text-slate-600 dark:text-zinc-600',
      shape: 'cookie12',
    },
  ];

  const searchableRows: SettingsRowItem[] = [
    {
      id: 'profile',
      group: 'personalize',
      title: 'Personal profile',
      rightValue: userProfile.preferredCurrency || 'INR',
      keywords: 'profile account name nickname email avatar photo dob gender currency bio',
      icon: <User className="w-4 h-4 text-white" />,
      circleBg: 'bg-orange-500',
      fillClass: 'text-orange-500',
      strokeClass: 'text-orange-500',
      shape: 'cookie9',
    },
    ...settingsRows,
  ];

  const filteredRows = searchableRows.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.rightValue || '').toLowerCase().includes(q) ||
      item.keywords.toLowerCase().includes(q)
    );
  });

  const currentSectionConfig = settingsRows.find((s) => s.id === activeSection);
  const displayName =
    userProfile.nickname && userProfile.nickname !== 'User'
      ? userProfile.nickname
      : userProfile.name && userProfile.name !== 'Guest'
        ? userProfile.name
        : 'Personal Profile';

  const renderIcon = (item: SettingsRowItem) => {
    if (expressiveShapes) {
      return (
        <PetalShapeBadge
          shape={item.shape}
          fillClass={item.fillClass}
          strokeClass={item.strokeClass}
          sizeClass="w-8 h-8"
        >
          {item.icon}
        </PetalShapeBadge>
      );
    }
    return (
      <span
        className={`w-8 h-8 rounded-full ${item.circleBg} flex items-center justify-center shrink-0`}
      >
        {item.icon}
      </span>
    );
  };

  const renderGroupCard = (items: SettingsRowItem[]) => (
    <div className="rounded-[22px] bg-white dark:bg-zinc-900 border border-[#E5E7EB]/80 dark:border-zinc-800/90 overflow-hidden">
      {items.map((item, idx) => (
        <div key={item.id} className="relative">
          {idx > 0 && (
            <div className="ml-[56px] mr-4 border-t border-slate-100 dark:border-zinc-800/80" />
          )}
          <button
            type="button"
            onClick={() => {
              setActiveSection(item.id);
              setSearchQuery('');
            }}
            className="w-full min-h-[54px] px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-800/60 active:bg-slate-100/80 dark:active:bg-zinc-800 transition flex items-center justify-between gap-3 text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {renderIcon(item)}
              <span className="text-[15px] font-medium text-slate-900 dark:text-zinc-100 truncate">
                {item.title}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {item.rightValue && (
                <span className="text-[13px] text-slate-400 dark:text-zinc-500 tabular-nums whitespace-nowrap">
                  {item.rightValue}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-zinc-600 group-hover:text-slate-500 dark:group-hover:text-zinc-400 transition shrink-0" />
            </div>
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="w-full min-w-0 max-w-3xl mx-auto pb-8 overflow-x-hidden">
      {activeSection === null ? (
        <div className="px-3.5 sm:px-5 pt-2.5 pb-4 space-y-3 w-full min-w-0 animate-view-enter">
          {/* Compact Borderless Settings Title + Elevated M3 Search Pill */}
          <div className="space-y-2 w-full min-w-0">
            <div className="flex items-center justify-between px-1">
              <h1 className="text-[22px] sm:text-[24px] font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                Settings
              </h1>
            </div>

            <div
              data-m3-tonal-card="true"
              className="relative flex items-center w-full h-10 rounded-full px-3.5 gap-2.5 transition-all focus-within:ring-2 focus-within:ring-[var(--primary-accent-ring,rgba(79,70,229,0.22))] focus-within:border-[var(--primary-accent,#4f46e5)]"
            >
              <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search settings"
                aria-label="Search settings"
                className="w-full h-full bg-transparent border-0 text-[14px] text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none focus:outline-none focus:ring-0"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="w-6 h-6 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 flex items-center justify-center shrink-0 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {searchQuery ? (
            filteredRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded-[22px] border border-[#E5E7EB]/80 dark:border-zinc-800">
                No settings matching &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              renderGroupCard(filteredRows)
            )
          ) : (
            <div className="space-y-3 w-full min-w-0">
              {/* Single Compact Account / Profile Card (Never duplicated in list) */}
              <button
                type="button"
                data-m3-tonal-card="true"
                onClick={() => setActiveSection('profile')}
                className="w-full rounded-[22px] px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/60 active:bg-slate-100/80 dark:active:bg-zinc-800 transition flex items-center justify-between gap-3 text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {userProfile.avatarPhoto ? (
                    <img
                      src={userProfile.avatarPhoto}
                      alt={displayName}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                    />
                  ) : (
                    <span className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-950 text-[#4F46E5] dark:text-indigo-300 font-semibold text-base flex items-center justify-center shrink-0">
                      {(userProfile.nickname || userProfile.name || 'J').charAt(0).toUpperCase()}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-semibold text-slate-900 dark:text-white leading-tight truncate">
                      {displayName}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                      {userProfile.email || firebaseUser?.email || 'Manage profile, currency & account'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-zinc-600 group-hover:text-slate-500 transition shrink-0" />
              </button>

              {/* Group 1: Display, Sound, Notifications */}
              {renderGroupCard(settingsRows.filter((r) => r.group === 'personalize'))}

              {/* Group 2: Backup & Sync, Security & Privacy */}
              {renderGroupCard(settingsRows.filter((r) => r.group === 'data'))}

              {/* Group 3: AI, Regional & Schedule */}
              {renderGroupCard(settingsRows.filter((r) => r.group === 'preferences'))}

              {/* Desktop-Only Auto-Launch Toggle (Tauri v2 Windows/Linux) */}
              {desktopRuntime && (
                <div className="w-full min-h-[54px] rounded-[22px] px-4 py-2.5 bg-white dark:bg-zinc-900 border border-[#E5E7EB]/80 dark:border-zinc-800/90 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0">
                      <Monitor className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium text-slate-900 dark:text-zinc-100 truncate">
                        Launch on startup
                      </div>
                      <div className="text-[11.5px] text-slate-500 dark:text-zinc-400 truncate">
                        Start JivanOS automatically when you sign in
                      </div>
                    </div>
                  </div>
                  <M3Switch
                    id="toggle-desktop-autostart"
                    checked={autoLaunchEnabled}
                    onChange={(next) => {
                      void handleToggleAutoLaunch(next);
                    }}
                    disabled={isUpdatingAutoLaunch}
                  />
                </div>
              )}

              {/* Compact About Card */}
              <a
                href={APP_GITHUB_REPO}
                target="_blank"
                rel="noopener noreferrer"
                data-m3-tonal-card="true"
                className="w-full min-h-[54px] rounded-[22px] px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <JivanLogoMark withFrame className="w-8 h-8 shrink-0" />
                  <span className="text-[15px] font-medium text-slate-900 dark:text-zinc-100 truncate">
                    About JivanOS
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-[13px] text-slate-400 dark:text-zinc-500 tabular-nums">
                  <span>v{APP_VERSION}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600 group-hover:text-slate-500 transition" />
                </div>
              </a>
            </div>
          )}
        </div>
      ) : activeSection === 'backup_sync' ? (
        <BackupSyncScreen onBack={() => setActiveSection(null)} />
      ) : activeSection === 'profile' ? (
        <PersonalProfileScreen
          onBack={() => setActiveSection(null)}
          onManageSync={() => setActiveSection('backup_sync')}
        />
      ) : (
        <div className="px-3.5 sm:px-5 pt-1 pb-8 space-y-4 w-full min-w-0 animate-view-enter">
          <SettingsSubpageHeader
            title={currentSectionConfig?.title || 'Settings'}
            onBack={() => setActiveSection(null)}
          />

          {activeSection === 'appearance' && (
            <AppearanceSettingsSection onExpressiveShapesChange={setExpressiveShapes} />
          )}

          {activeSection === 'notifications' && (
            <NotificationsSettingsSection
              onOpenAlarmStudio={() => setIsNotifSettingsOpen(true)}
            />
          )}

          {activeSection === 'sound' && <SoundHapticsSettingsSection />}

          {activeSection === 'security' && <SecuritySettingsSection />}

          {activeSection === 'ai' && (
            <AiSettingsSection
              aiProviderInput={aiProviderInput}
              selectedAiModelInput={selectedAiModelInput}
              onAiSummaryChange={(nextProvider, nextModel) => {
                setAiProviderInput(nextProvider);
                setSelectedAiModelInput(nextModel);
              }}
            />
          )}

          {activeSection === 'system' && (
            <RegionalScheduleSection
              timezoneInput={timezoneInput}
              onTimezoneChange={setTimezoneInput}
            />
          )}
        </div>
      )}

      <NotificationSettingsModal
        isOpen={isNotifSettingsOpen}
        onClose={() => setIsNotifSettingsOpen(false)}
      />
    </div>
  );
};

export { SettingsManager as SettingsScreen };

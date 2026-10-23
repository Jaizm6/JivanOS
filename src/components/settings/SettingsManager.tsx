import React, { useState } from 'react';
import {
  Settings,
  Cloud,
  Shield,
  Bell,
  Volume2,
  Database,
  Lock,
  Unlock,
  Key,
  Smartphone,
  RefreshCw,
  Download,
  Upload,
  HardDrive,
  Check,
  AlertTriangle,
  User,
  Fingerprint,
  KeyRound,
  ShieldCheck,
  Mail,
  Server,
  Plus,
  Camera,
  Trash2,
  Image as ImageIcon,
  Palette,
  Type,
  Sliders,
  Eye,
  Sparkles,
  ExternalLink,
  ArrowLeft,
  Search,
  ChevronRight,
  Archive,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { soundEngine, playLockSound } from '../../utils/audio';
import { ProviderLogo } from '../common/ProviderLogo';
import { compressProfilePhoto } from '../../utils/imageCompressor';
import { ColorThemeService } from '../../utils/ColorThemeService';
import { NotificationSettingsModal } from '../notifications/NotificationSettingsModal';
import { UniversalExportHub } from './UniversalExportHub';
import { LiquidGlassStudio } from './LiquidGlassStudio';

export type SettingsSectionId =
  | 'phone_install'
  | 'export'
  | 'sync'
  | 'profile'
  | 'security'
  | 'appearance'
  | 'liquid_glass'
  | 'notifications'
  | 'sound'
  | 'ai'
  | 'system';

export const SettingsManager: React.FC = () => {
  const {
    syncState,
    triggerManualSync,
    createCloudBackup,
    downloadLocalBackupFile,
    setIsBackupModalOpen,
    syncEmail,
    savedSyncEmails,
    setSyncEmail,
    addSyncEmail,
    userProfile,
    updateUserProfile,
    masterPassphrase,
    setMasterPassphrase,
    isJournalLocked,
    setIsJournalLocked,
    pushNotification,
    appLock,
    configureAppLock,
    lockApp,
    theme,
    setIsInstallModalOpen,
  } = useApp();

  const isDark = theme === 'dark' || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  const [emailInput, setEmailInput] = useState(userProfile.email);
  const [nameInput, setNameInput] = useState(userProfile.name);
  const [nicknameInput, setNicknameInput] = useState(userProfile.nickname || '');
  const [avatarPhoto, setAvatarPhoto] = useState(userProfile.avatarPhoto || '');
  const [bioInput, setBioInput] = useState(userProfile.bio || '');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [twoFactorActive, setTwoFactorActive] = useState(userProfile.twoFactorEnabled);
  const [newPassphrase, setNewPassphrase] = useState('');
  const [showPassModal, setShowPassModal] = useState(false);
  const [backupStatusMsg, setBackupStatusMsg] = useState('');

  // App Lock State in Settings
  const [appLockEnabled, setAppLockEnabled] = useState(appLock.isEnabled);
  const [lockType, setLockType] = useState(appLock.type || appLock.lockType || 'passcode');
  const [lockPasscode, setLockPasscode] = useState(appLock.passcode);
  const [requireOnResume, setRequireOnResume] = useState(appLock.requireOnResume ?? false);
  const [saveLockMsg, setSaveLockMsg] = useState('');
  const [isNotifSettingsOpen, setIsNotifSettingsOpen] = useState(false);

  // Android-style dedicated section navigation state
  const [activeSection, setActiveSection] = useState<SettingsSectionId | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // AI Models & Provider State
  const [aiProviderInput, setAiProviderInput] = useState(() => {
    try { return localStorage.getItem('omni_ai_provider') || 'gemini'; } catch { return 'gemini'; }
  });
  const [selectedAiModelInput, setSelectedAiModelInput] = useState(() => {
    try { return localStorage.getItem('omni_ai_model') || 'gemini-3.8-flash'; } catch { return 'gemini-3.8-flash'; }
  });
  const [baseUrlInput, setBaseUrlInput] = useState(() => {
    try { return localStorage.getItem('omni_ai_base_url') || 'https://api.openai.com/v1'; } catch { return 'https://api.openai.com/v1'; }
  });
  const [customGeminiKey, setCustomGeminiKey] = useState(() => {
    try { return localStorage.getItem('omni_custom_gemini_api_key') || ''; } catch { return ''; }
  });
  const [customOpenaiKey, setCustomOpenaiKey] = useState(() => {
    try { return localStorage.getItem('omni_custom_openai_api_key') || ''; } catch { return ''; }
  });
  const [customDeepseekKey, setCustomDeepseekKey] = useState(() => {
    try { return localStorage.getItem('omni_custom_deepseek_api_key') || ''; } catch { return ''; }
  });
  const [customQwenKey, setCustomQwenKey] = useState(() => {
    try { return localStorage.getItem('omni_custom_qwen_api_key') || ''; } catch { return ''; }
  });
  const [customLocalKey, setCustomLocalKey] = useState(() => {
    try { return localStorage.getItem('omni_custom_local_api_key') || 'ollama'; } catch { return 'ollama'; }
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiSettingsMsg, setAiSettingsMsg] = useState('');

  // Timezone State
  const [timezoneInput, setTimezoneInput] = useState(() => {
    try { return localStorage.getItem('omni_timezone') || 'Asia/Kolkata'; } catch { return 'Asia/Kolkata'; }
  });
  const [timezoneMsg, setTimezoneMsg] = useState('');

  const handleProviderChange = (provider: string) => {
    setAiProviderInput(provider);
    if (provider === 'gemini') {
      setSelectedAiModelInput('gemini-3.8-flash');
      setBaseUrlInput('https://generativelanguage.googleapis.com');
    } else if (provider === 'openai') {
      setSelectedAiModelInput('gpt-4o-mini');
      setBaseUrlInput('https://api.openai.com/v1');
    } else if (provider === 'deepseek') {
      setSelectedAiModelInput('deepseek-chat');
      setBaseUrlInput('https://api.deepseek.com');
    } else if (provider === 'qwen') {
      setSelectedAiModelInput('qwen-max');
      setBaseUrlInput('https://dashscope-intl.aliyuncs.com/compatible-mode/v1');
    } else if (provider === 'local') {
      setSelectedAiModelInput('llama3');
      setBaseUrlInput('http://localhost:11434/v1');
    }
  };

  const handleSaveAiSettings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('omni_ai_provider', aiProviderInput);
      localStorage.setItem('omni_ai_model', selectedAiModelInput);
      localStorage.setItem('omni_ai_base_url', baseUrlInput.trim());
      localStorage.setItem('omni_custom_gemini_api_key', customGeminiKey.trim());
      localStorage.setItem('omni_custom_openai_api_key', customOpenaiKey.trim());
      localStorage.setItem('omni_custom_deepseek_api_key', customDeepseekKey.trim());
      localStorage.setItem('omni_custom_qwen_api_key', customQwenKey.trim());
      localStorage.setItem('omni_custom_local_api_key', customLocalKey.trim());

      setAiSettingsMsg(`AI provider (${aiProviderInput}) and model preferences saved successfully.`);
      setTimeout(() => setAiSettingsMsg(''), 3500);
      pushNotification('AI Settings Updated', `Active provider: ${aiProviderInput.toUpperCase()} (${selectedAiModelInput})`, 'system');
    } catch (err: any) {
      setAiSettingsMsg('Failed to save AI preferences.');
    }
  };
  
  const handleSaveTimezone = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('omni_timezone', timezoneInput);
      setTimezoneMsg(`Timezone set to ${timezoneInput}.`);
      setTimeout(() => setTimezoneMsg(''), 3500);
      pushNotification('Time Settings Updated', `Timezone updated to ${timezoneInput}`, 'system');
    } catch (err: any) {
      setTimezoneMsg('Failed to save timezone preference.');
    }
  };

  // Quote Card Typography, Transitions & Live Preview Staging State (isolated from global app state until 'Done')
  const [draftCardBg, setDraftCardBg] = useState<string>(() => {
    try { return localStorage.getItem('omni_quote_card_bg') || 'default'; } catch { return 'default'; }
  });
  const [draftTransitionStyle, setDraftTransitionStyle] = useState<'fade' | 'slide' | 'scale'>(() => {
    try { return (localStorage.getItem('omni_quote_transition_style') as 'fade' | 'slide' | 'scale') || 'fade'; } catch { return 'fade'; }
  });
  const [draftFontScale, setDraftFontScale] = useState<number>(() => {
    try { return Number(localStorage.getItem('omni_quote_font_scale')) || 1; } catch { return 1; }
  });
  const [draftFontFamily, setDraftFontFamily] = useState<string>(() => {
    try { return localStorage.getItem('omni_quote_font_family') || 'sans-serif'; } catch { return 'sans-serif'; }
  });
  const [animTrigger, setAnimTrigger] = useState(0);
  const [cardSettingsMsg, setCardSettingsMsg] = useState('');

  // Sync initial state if updated elsewhere
  React.useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e.detail) {
        if (e.detail.fontScale !== undefined) setDraftFontScale(e.detail.fontScale);
        if (e.detail.fontFamily !== undefined) setDraftFontFamily(e.detail.fontFamily);
        if (e.detail.cardBg !== undefined) setDraftCardBg(e.detail.cardBg);
        if (e.detail.transitionStyle !== undefined) setDraftTransitionStyle(e.detail.transitionStyle);
      }
    };
    window.addEventListener('omni_quote_theme_changed', handleThemeChange);
    return () => window.removeEventListener('omni_quote_theme_changed', handleThemeChange);
  }, []);

  const handleApplyCardSettings = () => {
    try {
      localStorage.setItem('omni_quote_font_scale', String(draftFontScale));
      localStorage.setItem('omni_quote_font_family', draftFontFamily);
      localStorage.setItem('omni_quote_card_bg', draftCardBg);
      localStorage.setItem('omni_quote_transition_style', draftTransitionStyle);

      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--quote-font-scale', String(draftFontScale));
        document.documentElement.style.setProperty('--quote-font-family', draftFontFamily);
        if (draftCardBg && draftCardBg !== 'default') {
          const resolved = ColorThemeService.resolveColor(draftCardBg, isDark);
          const resolvedBorder = ColorThemeService.resolveBorderColor(draftCardBg, isDark);
          document.documentElement.style.setProperty('--quote-card-bg', resolved);
          document.documentElement.style.setProperty('--quote-card-border', resolvedBorder);
        } else {
          document.documentElement.style.removeProperty('--quote-card-bg');
          document.documentElement.style.removeProperty('--quote-card-border');
        }
      }

      window.dispatchEvent(new CustomEvent('omni_quote_theme_changed', {
        detail: {
          fontScale: draftFontScale,
          fontFamily: draftFontFamily,
          cardBg: draftCardBg,
          transitionStyle: draftTransitionStyle,
        }
      }));

      soundEngine.playSuccessChime();
      try { navigator.vibrate?.(40); } catch {}
      setCardSettingsMsg('Quote card styles and global CSS variables applied successfully.');
      setTimeout(() => setCardSettingsMsg(''), 3500);
      pushNotification('Card Style Applied', 'Global typography scale, font family, and card background updated.', 'system');
    } catch {
      setCardSettingsMsg('Failed to apply card styling preferences.');
    }
  };

  React.useEffect(() => {
    setNameInput(userProfile.name);
    setNicknameInput(userProfile.nickname || '');
    setEmailInput(userProfile.email || userProfile.identifier || '');
    setAvatarPhoto(userProfile.avatarPhoto || '');
    setBioInput(userProfile.bio || '');
    setTwoFactorActive(userProfile.twoFactorEnabled);
  }, [userProfile]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    try {
      setIsCompressingPhoto(true);
      setPhotoError('');
      const compressedResult = await compressProfilePhoto(file);
      setAvatarPhoto(compressedResult.dataUrl);
    } catch (err: any) {
      setPhotoError(err.message || 'Failed to process image');
    } finally {
      setIsCompressingPhoto(false);
      e.target.value = '';
    }
  };

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile({
      name: nameInput,
      nickname: nicknameInput.trim(),
      email: emailInput,
      avatarPhoto,
      bio: bioInput.trim(),
      twoFactorEnabled: twoFactorActive,
    });
    pushNotification('Profile Updated', 'Profile photo, display nickname, and credentials saved.', 'system');
  };

  const handleManualBackup = async () => {
    await triggerManualSync();
    setBackupStatusMsg('Cloud backup synchronized successfully.');
    setTimeout(() => setBackupStatusMsg(''), 3500);
  };

  const handleSavePassphrase = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassphrase.trim()) {
      setMasterPassphrase(newPassphrase.trim());
      setIsJournalLocked(false);
      setShowPassModal(false);
      setNewPassphrase('');
      pushNotification('Security Updated', 'Master encryption passphrase updated.', 'journal');
    }
  };

  const handleSaveAppLock = (e: React.FormEvent) => {
    e.preventDefault();
    configureAppLock({
      isEnabled: appLockEnabled,
      type: lockType,
      passcode: lockPasscode || '1234',
      requireOnResume,
    });
    setSaveLockMsg('App Lock & Biometric settings updated.');
    setTimeout(() => setSaveLockMsg(''), 3000);
    pushNotification('Security Guard', 'App lock security configuration updated.', 'system');
  };

  const settingsSections = [
    {
      id: 'phone_install' as SettingsSectionId,
      category: 'Apps & Portability',
      title: 'Phone Installation & Web Access',
      subtitle: 'Install standalone app on Android or iOS, QR code, desktop PWA',
      icon: <Smartphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80',
      badge: 'PWA Ready',
    },
    {
      id: 'export' as SettingsSectionId,
      category: 'Apps & Portability',
      title: 'Universal Data Export Hub',
      subtitle: 'Super Productivity, Todoist, Google Tasks, iCal, Obsidian, backups',
      icon: <Archive className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80',
      badge: 'Multi-App',
    },
    {
      id: 'sync' as SettingsSectionId,
      category: 'Apps & Portability',
      title: 'Cloud Synchronization & Storage',
      subtitle: `${syncEmail ? syncEmail : 'Local device storage'} • Remote sync & conflict resolution`,
      icon: <Cloud className="w-5 h-5 text-sky-600 dark:text-sky-400" />,
      iconBg: 'bg-sky-50 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800/80',
    },
    {
      id: 'profile' as SettingsSectionId,
      category: 'Personal & Security',
      title: 'Account Profile & Preferences',
      subtitle: `${userProfile.name || 'Jivan User'} • Avatar, nickname, bio & 2FA protection`,
      icon: <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
      iconBg: 'bg-purple-50 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800/80',
    },
    {
      id: 'security' as SettingsSectionId,
      category: 'Personal & Security',
      title: 'Security, App Lock & Vault',
      subtitle: `${appLock.isEnabled ? 'App Lock Protected (PIN)' : 'Not configured'} • Vault master key & AES encryption`,
      icon: <ShieldCheck className="w-5 h-5 text-rose-600 dark:text-rose-400" />,
      iconBg: 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800/80',
      badge: appLock.isEnabled ? 'Active' : undefined,
    },
    {
      id: 'appearance' as SettingsSectionId,
      category: 'Device Experience',
      title: 'Appearance & Themes Engine',
      subtitle: `${theme === 'dark' ? 'Dark Theme' : 'Light Theme'} • Dynamic color palettes, typography & transitions`,
      icon: <Palette className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      iconBg: 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/80',
    },
    {
      id: 'liquid_glass' as SettingsSectionId,
      category: 'Device Experience',
      title: 'Liquid Glass & Motion Customization',
      subtitle: 'Refraction, depth, chromatic aberration & spring button motion physics',
      icon: <Sparkles className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />,
      iconBg: 'bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200/80 dark:border-cyan-800/80',
      badge: 'Theme Studio',
    },
    {
      id: 'notifications' as SettingsSectionId,
      category: 'Device Experience',
      title: 'Notifications & Alarms',
      subtitle: 'Habit pings, water reminder scheduler & exact-time alarms',
      icon: <Bell className="w-5 h-5 text-orange-600 dark:text-orange-400" />,
      iconBg: 'bg-orange-50 dark:bg-orange-950/60 border border-orange-200/80 dark:border-orange-800/80',
    },
    {
      id: 'sound' as SettingsSectionId,
      category: 'Device Experience',
      title: 'Sound Effects & Haptics',
      subtitle: 'Audio chimes, task completion feedback & sound engine testers',
      icon: <Volume2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />,
      iconBg: 'bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200/80 dark:border-cyan-800/80',
    },
    {
      id: 'ai' as SettingsSectionId,
      category: 'Intelligence & System',
      title: 'AI Engine & Intelligence Providers',
      subtitle: `${aiProviderInput.toUpperCase()} (${selectedAiModelInput}) • Custom API endpoints & keys`,
      icon: <Sparkles className="w-5 h-5 text-fuchsia-600 dark:text-fuchsia-400" />,
      iconBg: 'bg-fuchsia-50 dark:bg-fuchsia-950/60 border border-fuchsia-200/80 dark:border-fuchsia-800/80',
    },
    {
      id: 'system' as SettingsSectionId,
      category: 'Intelligence & System',
      title: 'System, Timezone & Storage',
      subtitle: `Timezone: ${timezoneInput} • Cache status, local database & data reset`,
      icon: <HardDrive className="w-5 h-5 text-slate-600 dark:text-slate-400" />,
      iconBg: 'bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80',
    },
  ];

  const filteredSections = settingsSections.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.subtitle.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
  });

  const categories = Array.from(new Set(settingsSections.map(s => s.category)));
  const currentSectionConfig = settingsSections.find(s => s.id === activeSection);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-6">
      {/* If no section is selected, render Android Settings Overview List */}
      {activeSection === null ? (
        <div className="space-y-5 max-w-3xl mx-auto animate-in fade-in duration-150">
          {/* Android Settings Header */}
          <div className="pt-1 pb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Settings
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              System preferences, accounts, device configuration &amp; data management
            </p>
          </div>

          {/* Android Settings Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search settings (e.g. export, dark mode, backup, pin)..."
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800/90 border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 transition outline-hidden shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* User Account Top Tile (Android / Google Account style) */}
          {!searchQuery && (
            <div
              onClick={() => setActiveSection('profile')}
              className="p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-700 transition flex items-center justify-between gap-3 cursor-pointer group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {avatarPhoto ? (
                  <img
                    src={avatarPhoto}
                    alt={userProfile.name}
                    className="w-12 h-12 rounded-2xl object-cover ring-2 ring-indigo-500/30 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-xs">
                    {(userProfile.name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                      {userProfile.name || 'Jivan Account'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                      {syncEmail ? 'Synced' : 'Local'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {userProfile.email || syncEmail || 'Local Offline Profile'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition shrink-0" />
            </div>
          )}

          {/* Categorized Settings List */}
          {searchQuery ? (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 block">
                Search Results ({filteredSections.length})
              </span>
              {filteredSections.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                  No settings found matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 shadow-2xs overflow-hidden">
                  {filteredSections.map(item => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setActiveSection(item.id);
                        setSearchQuery('');
                      }}
                      className="p-3.5 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition flex items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${item.iconBg}`}>
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate">
                              {item.title}
                            </span>
                            {item.badge && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {categories.map(cat => {
                const items = settingsSections.filter(s => s.category === cat);
                return (
                  <div key={cat} className="space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 block">
                      {cat}
                    </span>
                    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 shadow-2xs overflow-hidden">
                      {items.map(item => (
                        <div
                          key={item.id}
                          onClick={() => setActiveSection(item.id)}
                          className="p-3.5 sm:p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition flex items-center justify-between gap-3 cursor-pointer group"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${item.iconBg}`}>
                              {item.icon}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate">
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {item.subtitle}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Dedicated Subpage Page View */
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Subpage Header with Android Back Arrow */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800 gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSection(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer shadow-2xs shrink-0 active:scale-95"
                title="Return to Settings Overview"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                <span>Settings</span>
              </button>

              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${currentSectionConfig?.iconBg}`}>
                  {currentSectionConfig?.icon}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
                    {currentSectionConfig?.title}
                  </h2>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {currentSectionConfig?.category}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveSection(null)}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer hidden sm:inline"
            >
              All Settings
            </button>
          </div>

          {/* Dedicated Section Configuration */}
          {activeSection === 'phone_install' && (
            <div className="rounded-2xl border border-indigo-200/90 dark:border-indigo-800/80 bg-gradient-to-br from-indigo-50/40 via-white to-emerald-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-indigo-100 dark:border-indigo-900/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Phone Installation &amp; Web Access
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        Universal PWA
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Install as a standalone mobile app on Android or iOS, and access from any computer web browser
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={typeof window !== 'undefined' ? window.location.origin : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                    title="Open Jivan in a clean standalone browser tab outside the AI Studio frame"
                  >
                    <span>Open Standalone</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    id="btn-settings-open-install-modal"
                    onClick={() => setIsInstallModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Install / QR Code</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    📱 Android Phone
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Open link in Chrome &gt; tap &quot;Add to Home Screen&quot; or &quot;Install app&quot; for full standalone app experience.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    🍏 iPhone &amp; iPad
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Open link in Safari &gt; tap Share button &gt; tap &quot;Add to Home Screen&quot;.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    💻 Web Browser / PC
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Instant access in any modern desktop browser. Click the Install icon in the address bar.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'export' && (
            <UniversalExportHub />
          )}

          {activeSection === 'sync' && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Cloud Synchronization & Storage
              </h3>
              <p className="text-xs text-slate-400">
                Encrypted remote backups with automatic conflict resolution
              </p>
            </div>
          </div>
          <button
            id="btn-trigger-cloud-sync"
            onClick={handleManualBackup}
            disabled={syncState.status === 'syncing'}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
            <span>Sync Now</span>
          </button>
        </div>

        {/* Target Sync Account Banner */}
        <div className="mt-3.5 p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Mail className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Target Sync & Backup Account:
                </span>
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 truncate">
                  {syncEmail}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={syncEmail}
              onChange={(e) => setSyncEmail(e.target.value)}
              className="text-xs font-semibold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-indigo-200 dark:border-indigo-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer"
            >
              {savedSyncEmails.map((em) => (
                <option key={em} value={em}>
                  {em}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsBackupModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1 shrink-0"
              title="Manage sync emails & open source storage"
            >
              <span>Manage</span>
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Sync Status</span>
            <div className="mt-1 font-bold text-slate-900 dark:text-white capitalize flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  syncState.status === 'synced'
                    ? 'bg-emerald-500'
                    : syncState.status === 'syncing'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-rose-500'
                }`}
              />
              {syncState.status}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Last Successful Sync</span>
            <div className="mt-1 font-mono font-bold text-slate-900 dark:text-white">
              {new Date(syncState.lastSyncTime).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Pending Changes</span>
            <div className="mt-1 font-bold text-slate-900 dark:text-white">
              {syncState.pendingChanges} items queued
            </div>
          </div>
        </div>

        {/* One-Click Drive & Local Backup Options */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-indigo-500" />
              <span>One-Click Cloud Backup (Commercial & Open Source)</span>
            </span>
            <button
              type="button"
              onClick={() => setIsBackupModalOpen(true)}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>Configure Providers & History</span>
              <span>→</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
            <button
              type="button"
              onClick={async () => {
                await createCloudBackup('gdrive', 'manual');
                setBackupStatusMsg(`Snapshot backed up to Google Drive for ${syncEmail}.`);
                setTimeout(() => setBackupStatusMsg(''), 3500);
              }}
              className="p-2 rounded-xl border border-amber-200/70 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/50 text-amber-800 dark:text-amber-300 font-semibold flex flex-col items-center gap-1.5 text-center transition"
            >
              <ProviderLogo provider="gdrive" className="w-5 h-5" />
              <span className="text-[11px] leading-tight">Google Drive</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await createCloudBackup('onedrive', 'manual');
                setBackupStatusMsg(`Snapshot backed up to OneDrive for ${syncEmail}.`);
                setTimeout(() => setBackupStatusMsg(''), 3500);
              }}
              className="p-2 rounded-xl border border-blue-200/70 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-100/50 text-blue-800 dark:text-blue-300 font-semibold flex flex-col items-center gap-1.5 text-center transition"
            >
              <ProviderLogo provider="onedrive" className="w-5 h-5" />
              <span className="text-[11px] leading-tight">OneDrive</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await createCloudBackup('nextcloud', 'manual');
                setBackupStatusMsg(`Encrypted snapshot synced to Nextcloud for ${syncEmail}.`);
                setTimeout(() => setBackupStatusMsg(''), 3500);
              }}
              className="p-2 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100/50 text-emerald-800 dark:text-emerald-300 font-semibold flex flex-col items-center gap-1.5 text-center transition"
            >
              <ProviderLogo provider="nextcloud" className="w-5 h-5" />
              <span className="text-[11px] leading-tight">Nextcloud</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await createCloudBackup('minio_s3', 'manual');
                setBackupStatusMsg(`Encrypted snapshot uploaded to MinIO S3 for ${syncEmail}.`);
                setTimeout(() => setBackupStatusMsg(''), 3500);
              }}
              className="p-2 rounded-xl border border-teal-200/80 dark:border-teal-800/60 bg-teal-50/50 dark:bg-teal-950/30 hover:bg-teal-100/50 text-teal-800 dark:text-teal-300 font-semibold flex flex-col items-center gap-1.5 text-center transition"
            >
              <ProviderLogo provider="minio_s3" className="w-5 h-5" />
              <span className="text-[11px] leading-tight">MinIO S3</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await createCloudBackup('mega', 'manual');
                setBackupStatusMsg(`Encrypted snapshot uploaded to MEGA for ${syncEmail}.`);
                setTimeout(() => setBackupStatusMsg(''), 3500);
              }}
              className="p-2 rounded-xl border border-rose-200/70 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-100/50 text-rose-800 dark:text-rose-300 font-semibold flex flex-col items-center gap-1.5 text-center transition"
            >
              <ProviderLogo provider="mega" className="w-5 h-5" />
              <span className="text-[11px] leading-tight">MEGA</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await createCloudBackup('proton', 'manual');
                setBackupStatusMsg(`Zero-access backup created on Proton Drive for ${syncEmail}.`);
                setTimeout(() => setBackupStatusMsg(''), 3500);
              }}
              className="p-2 rounded-xl border border-purple-200/70 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20 hover:bg-purple-100/50 text-purple-800 dark:text-purple-300 font-semibold flex flex-col items-center gap-1.5 text-center transition"
            >
              <ProviderLogo provider="proton" className="w-5 h-5" />
              <span className="text-[11px] leading-tight">Proton</span>
            </button>

            <button
              type="button"
              onClick={() => {
                downloadLocalBackupFile();
                setBackupStatusMsg('Local JSON backup exported to downloads.');
                setTimeout(() => setBackupStatusMsg(''), 3500);
              }}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold flex flex-col items-center gap-1.5 text-center transition"
            >
              <ProviderLogo provider="local" className="w-5 h-5" />
              <span className="text-[11px] leading-tight">Local JSON</span>
            </button>
          </div>
        </div>

        {backupStatusMsg && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
            <Check className="w-4 h-4" />
            <span>{backupStatusMsg}</span>
          </div>
        )}
            </div>
          )}

          {/* Alarms, Notifications & Audio Chimes Card */}
          {activeSection === 'notifications' && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Alarms, Notifications &amp; Audio Chimes
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configure exact-time reminders, audible alarms, notification permissions, and chime tones across all modules
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNotifSettingsOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition shrink-0 cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Configure Alarms</span>
              </button>
            </div>
          )}

          {/* AI Models & Providers Configuration Card */}
          {activeSection === 'ai' && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                AI Models &amp; Provider API Keys (Gemini, ChatGPT, DeepSeek, Qwen)
              </h3>
              <p className="text-xs text-slate-400">
                Select your preferred AI provider and model, and input your API key to bypass rate limits
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveAiSettings} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Select AI Provider
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'gemini', label: 'Google Gemini' },
                { id: 'openai', label: 'OpenAI ChatGPT' },
                { id: 'deepseek', label: 'DeepSeek' },
                { id: 'qwen', label: 'Qwen (Alibaba)' },
                { id: 'local', label: 'Local AI / Ollama' },
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProviderChange(p.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition text-center cursor-pointer ${
                    aiProviderInput === p.id
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Model for {aiProviderInput.toUpperCase()}
            </label>
            <select
              value={selectedAiModelInput}
              onChange={(e) => setSelectedAiModelInput(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer"
            >
              {aiProviderInput === 'gemini' && (
                <>
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash (Gemini 1.5 Flash Equivalent - Recommended)</option>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Gemini 1.5 Pro Equivalent - Advanced Reasoning)</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Ultra-Low Latency)</option>
                </>
              )}
              {aiProviderInput === 'openai' && (
                <>
                  <option value="gpt-4o">GPT-4o (Flagship Multimodal)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini (Fast &amp; Cost-Effective)</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </>
              )}
              {aiProviderInput === 'deepseek' && (
                <>
                  <option value="deepseek-chat">DeepSeek Chat (V3)</option>
                  <option value="deepseek-reasoner">DeepSeek Reasoner (R1 - Advanced Logic)</option>
                </>
              )}
              {aiProviderInput === 'qwen' && (
                <>
                  <option value="qwen-max">Qwen Max (Flagship)</option>
                  <option value="qwen-plus">Qwen Plus</option>
                  <option value="qwen-turbo">Qwen Turbo</option>
                </>
              )}
              {aiProviderInput === 'local' && (
                <>
                  <option value="llama3">Llama 3</option>
                  <option value="llama3.1">Llama 3.1</option>
                  <option value="mistral">Mistral</option>
                  <option value="phi3">Phi-3</option>
                  <option value="qwen2.5">Qwen 2.5</option>
                  <option value="custom">Custom Model Name</option>
                </>
              )}
            </select>
          </div>

          {aiProviderInput !== 'gemini' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                API Base URL (OpenAI-compatible / Ollama endpoint)
              </label>
              <input
                type="text"
                value={baseUrlInput}
                onChange={(e) => setBaseUrlInput(e.target.value)}
                placeholder="https://api.openai.com/v1 or http://localhost:11434/v1"
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono shadow-xs"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Endpoint base URL for DeepSeek, Qwen, Ollama (`http://localhost:11434/v1`), or LM Studio.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              API Key for {aiProviderInput.toUpperCase()}
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={
                  aiProviderInput === 'gemini' ? customGeminiKey :
                  aiProviderInput === 'openai' ? customOpenaiKey :
                  aiProviderInput === 'deepseek' ? customDeepseekKey :
                  aiProviderInput === 'qwen' ? customQwenKey : customLocalKey
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (aiProviderInput === 'gemini') setCustomGeminiKey(val);
                  else if (aiProviderInput === 'openai') setCustomOpenaiKey(val);
                  else if (aiProviderInput === 'deepseek') setCustomDeepseekKey(val);
                  else if (aiProviderInput === 'qwen') setCustomQwenKey(val);
                  else if (aiProviderInput === 'local') setCustomLocalKey(val);
                }}
                placeholder={`Enter API key for ${aiProviderInput}...`}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 pr-16 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono shadow-xs"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1"
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Persisted securely in browser storage. For local Ollama instances, leave default or enter any token.
            </p>
          </div>

          {aiSettingsMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{aiSettingsMsg}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save AI Provider &amp; API Key</span>
            </button>
          </div>
        </form>
            </div>
          )}

          {/* Timezone Configuration Card */}
          {activeSection === 'system' && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Regional Time Settings
                    </h3>
                    <p className="text-xs text-slate-400">
                      Set your timezone for consistent alarms and scheduling.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveTimezone} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Timezone
                  </label>
                  <select
                    value={timezoneInput}
                    onChange={(e) => setTimezoneInput(e.target.value)}
                    className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                  </select>
                </div>
                
                {timezoneMsg && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{timezoneMsg}</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Timezone</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Quote Cards & Theme Appearance Customization Card */}
          {activeSection === 'appearance' && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Quote Cards &amp; Theme Appearance
              </h3>
              <p className="text-xs text-slate-400">
                Customize typography scaling, typeface, card background colors, and transition effects
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Controls (Font Size, Font Style, Card Colors, Transition Effects) */}
          <div className="lg:col-span-7 space-y-4 text-xs">
            {/* Font Size Scaling Selector */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Font Size Scale</span>
                </span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  {Math.round(draftFontScale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.4"
                step="0.05"
                value={draftFontScale}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-indigo-600 transition-all duration-200"
                onChange={(e) => setDraftFontScale(Number(e.target.value))}
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>80% (Compact)</span>
                <span>100% (Default)</span>
                <span>140% (Large)</span>
              </div>
            </div>

            {/* Font Style Selector (Sans, Serif, Mono) */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-indigo-500" />
                <span>Font Style</span>
              </label>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { id: 'sans', label: 'Sans', family: 'sans-serif' },
                  { id: 'serif', label: 'Serif', family: 'serif' },
                  { id: 'mono', label: 'Mono', family: 'monospace' }
                ].map((font) => (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => setDraftFontFamily(font.family)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 active:scale-95 cursor-pointer ${
                      draftFontFamily === font.family
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span style={{ fontFamily: font.family }}>{font.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Card Background Color Presets */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Card Background Theme</span>
                </label>
                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                  {ColorThemeService.getPreset(draftCardBg)?.name || (draftCardBg && draftCardBg !== 'default' ? 'Custom' : 'Default White')}
                </span>
              </div>
              <div className="flex items-center gap-3 pt-2 flex-wrap">
                {ColorThemeService.getPresets().map((preset) => {
                  const isSelected =
                    draftCardBg === preset.id ||
                    ((!draftCardBg || draftCardBg === 'default') && preset.id === 'default') ||
                    draftCardBg === preset.lightBg ||
                    draftCardBg === preset.darkBg;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      title={preset.name}
                      onClick={() => setDraftCardBg(preset.id)}
                      className={`w-8 h-8 rounded-full border shadow-xs shrink-0 transition-transform active:scale-95 cursor-pointer relative flex items-center justify-center ${
                        isSelected
                          ? 'ring-2 ring-indigo-600 ring-offset-2 border-indigo-600 scale-110'
                          : 'border-slate-300 dark:border-slate-600 hover:scale-105'
                      }`}
                      style={{ backgroundColor: preset.swatch }}
                    >
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transition Effect Settings */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Transition Effect</span>
              </label>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {(['fade', 'slide', 'scale'] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => {
                      setDraftTransitionStyle(style);
                      setAnimTrigger(prev => prev + 1);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                      draftTransitionStyle === style
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{style.charAt(0).toUpperCase() + style.slice(1)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Clear Bottom-Right Live Preview Card Layout */}
          <div className="lg:col-span-5 flex flex-col justify-end space-y-3">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Eye className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Live Preview Card
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Modifying Quote Card Style
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAnimTrigger(prev => prev + 1)}
                    className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 cursor-pointer bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-indigo-200/80 dark:border-indigo-800/80 transition active:scale-95 shadow-2xs"
                    title="Click to replay transition effect on preview card"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
                    <span>Replay Effect</span>
                  </button>
                  <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-800/60 uppercase">
                    {draftTransitionStyle}
                  </span>
                </div>
              </div>

              {/* Informative helper text for state isolation */}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                Clicking color or transition options above updates <strong>only this local preview card</strong>. Changes will apply to all cards in the app when you click <strong>Done</strong>.
              </p>

              {/* Visual Preview Card below Transition Effect with animated preview */}
              {(() => {
                const resolvedBg = ColorThemeService.resolveColor(draftCardBg, isDark);
                const resolvedBorder = ColorThemeService.resolveBorderColor(draftCardBg, isDark);
                const currentPreset = ColorThemeService.getPreset(draftCardBg);
                return (
                  <div
                    key={`settings-preview-${draftTransitionStyle}-${draftFontScale}-${draftFontFamily}-${draftCardBg}-${animTrigger}`}
                    id="quote-preview-card"
                    data-quote-card="true"
                    data-custom-bg="true"
                    className={`p-4 rounded-2xl border shadow-md text-left transition-all ${
                      draftTransitionStyle === 'slide'
                        ? 'quote-transition-slide'
                        : draftTransitionStyle === 'scale'
                          ? 'quote-transition-scale'
                          : 'quote-transition-fade'
                    }`}
                    style={{
                      backgroundColor: resolvedBg,
                      borderColor: resolvedBorder,
                      '--preview-card-bg': resolvedBg,
                      '--preview-card-border': resolvedBorder,
                    } as React.CSSProperties}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2">
                      <span className="font-medium">1/1 • Bhagavad Gita</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider text-[9px] bg-indigo-50/90 dark:bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-200/50 dark:border-indigo-800/50">
                        Wisdom
                      </span>
                    </div>
                    <p
                      id="quote-preview-text"
                      className="font-bold leading-snug transition-all duration-150"
                      style={{
                        fontSize: `${draftFontScale * 0.85}rem`,
                        fontFamily: draftFontFamily,
                        color: isDark ? '#f8fafc' : '#0f172a'
                      }}
                    >
                      "You have a right to perform your prescribed duty, but never to the fruits of action."
                    </p>
                    <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/70 flex items-center justify-between text-[10px]">
                      <span className="italic font-serif text-slate-500 dark:text-slate-400">Chapter 2, Verse 47</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[9px] text-indigo-500 font-semibold">
                          Scale: {Math.round(draftFontScale * 100)}%
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                          {currentPreset?.name || 'Default White'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {cardSettingsMsg && (
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{cardSettingsMsg}</span>
                </div>
              )}

              {/* Done / Apply Global State Button */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  id="btn-apply-card-theme"
                  onClick={() => handleApplyCardSettings()}
                  className="w-full sm:w-auto px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Done</span>
                </button>
              </div>
            </div>
          </div>
        </div>
            </div>
          )}

          {activeSection === 'liquid_glass' && (
            <LiquidGlassStudio />
          )}

          {/* Profile & 2FA Security Card */}
          {activeSection === 'profile' && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              User Profile, Photo &amp; Security
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Personalized nickname, compressed avatar, and TOTP 2FA protection
            </p>
          </div>
        </div>

        <form onSubmit={handleProfileSave} className="mt-4 space-y-4 text-xs">
          {/* Profile Photo Upload Row */}
          <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="relative shrink-0">
              {avatarPhoto ? (
                <img
                  src={avatarPhoto}
                  alt="Profile"
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-xl flex items-center justify-center shadow-xs">
                  {nameInput ? nameInput.charAt(0).toUpperCase() : 'J'}
                </div>
              )}
              <label
                htmlFor="settings-photo-upload"
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-xs cursor-pointer transition"
                title="Upload Photo"
              >
                <Camera className="w-3 h-3" />
                <input
                  id="settings-photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white text-xs">
                  Profile Photo
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
                  Auto-Compressed
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Images are automatically cropped and compressed to lightweight 256x256 WebP to preserve storage.
              </p>
              {photoError && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1">{photoError}</p>
              )}
            </div>

            {avatarPhoto && (
              <button
                type="button"
                onClick={() => setAvatarPhoto('')}
                className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shrink-0"
                title="Remove photo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="Jaiprakash"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Nickname / Display Name
              </label>
              <input
                type="text"
                value={nicknameInput}
                onChange={e => setNicknameInput(e.target.value)}
                placeholder="Jaiz (example)"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                Account Email
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Personal Bio / Philosophy
            </label>
            <input
              type="text"
              value={bioInput}
              onChange={e => setBioInput(e.target.value)}
              placeholder="Focusing on health, mindfulness, and productive consistency."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-4 h-4 text-emerald-500" />
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">
                  Two-Factor Authentication (2FA / TOTP)
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Require one-time verification code on new devices
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={twoFactorActive}
              onChange={e => setTwoFactorActive(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 rounded"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isCompressingPhoto}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-xs disabled:opacity-50"
            >
              Save Profile
            </button>
          </div>
        </form>
            </div>
          )}

          {/* Security, App Lock & Vault */}
          {activeSection === 'security' && (
            <div className="space-y-5">
              {/* App-wide Passcode & Fingerprint Lock Card */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Fingerprint className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        App Lock, Passcode &amp; Fingerprint
                      </h3>
                      <p className="text-xs text-slate-400">
                        Lock whole app with fingerprint / biometrics or custom PIN passcode
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      playLockSound();
                      lockApp();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold hover:bg-rose-100 transition shadow-2xs cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Lock App Now</span>
                  </button>
                </div>

                <form onSubmit={handleSaveAppLock} className="mt-4 space-y-4 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white block">
                        Enable App Security Lock
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Require biometric fingerprint or PIN whenever opening or returning to Jivan
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={appLockEnabled}
                      onChange={e => setAppLockEnabled(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 rounded"
                    />
                  </div>

                  {appLockEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-150">
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                          Authentication Method
                        </label>
                        <select
                          value={lockType}
                          onChange={e => setLockType(e.target.value as any)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        >
                          <option value="both">Fingerprint &amp; Passcode (Recommended)</option>
                          <option value="biometric">Fingerprint / Face ID Only</option>
                          <option value="passcode">PIN Passcode Only</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                          PIN Passcode (4-8 digits)
                        </label>
                        <input
                          type="password"
                          maxLength={8}
                          placeholder="e.g. 1234"
                          value={lockPasscode}
                          onChange={e => setLockPasscode(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono tracking-widest"
                        />
                      </div>

                      <div className="col-span-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            Auto-Lock On App Resume / Tab Switch
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Immediately require authentication when switching back from other apps
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={requireOnResume}
                          onChange={e => setRequireOnResume(e.target.checked)}
                          className="w-4 h-4 accent-indigo-600 rounded"
                        />
                      </div>
                    </div>
                  )}

                  {saveLockMsg && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      <span>{saveLockMsg}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition shadow-xs cursor-pointer"
                    >
                      Save Lock Settings
                    </button>
                  </div>
                </form>
              </div>

              {/* End-to-End Encryption */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
                      <Lock className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Client-Side Encryption Vault
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    All journal entries and sensitive medical notes are encrypted using 256-bit AES-GCM
                    derived via PBKDF2 with 100,000 iterations.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Status:{' '}
                    <strong className={isJournalLocked ? 'text-amber-500' : 'text-emerald-500'}>
                      {isJournalLocked ? 'Locked' : 'Unlocked'}
                    </strong>
                  </span>
                  <button
                    onClick={() => setShowPassModal(true)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Change Key
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sound & Web Audio Chimes */}
          {activeSection === 'sound' && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Web Audio Synthesizer
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Synthesized micro-tones provide pleasant, low-distraction haptic sound feedback for
                  doses, completions, and focus timers.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <button
                  onClick={() => soundEngine.playMedicationDose()}
                  className="flex-1 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 transition cursor-pointer"
                >
                  Test Dose Chime
                </button>
                <button
                  onClick={() => soundEngine.playWaterDrip()}
                  className="flex-1 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 transition cursor-pointer"
                >
                  Test Water Drip
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Change Passphrase Modal */}
      {showPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
              Update Master Passphrase
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              This secret phrase never leaves your browser device.
            </p>
            <form onSubmit={handleSavePassphrase} className="space-y-3">
              <input
                type="password"
                required
                placeholder="New secret passphrase"
                value={newPassphrase}
                onChange={e => setNewPassphrase(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPassModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                >
                  Save Passphrase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <NotificationSettingsModal
        isOpen={isNotifSettingsOpen}
        onClose={() => setIsNotifSettingsOpen(false)}
      />
    </div>
  );
};

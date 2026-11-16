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
  Sun,
  Moon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  soundEngine,
  playLockSound,
  AlarmToneType,
  NotificationSoundType,
  EventSoundCategory,
  NotificationPopupStyle,
  AlarmPopupStyle,
  NOTIFICATION_SOUND_OPTIONS,
  ALARM_TONE_OPTIONS,
  EVENT_SOUND_ITEMS,
} from '../../utils/audio';
import { haptics } from '../../utils/haptics';
import { notificationService } from '../../utils/notifications';
import { ProviderLogo } from '../common/ProviderLogo';
import { compressProfilePhoto } from '../../utils/imageCompressor';
import { ColorThemeService } from '../../utils/ColorThemeService';
import { NotificationSettingsModal } from '../notifications/NotificationSettingsModal';
import { UniversalExportHub } from './UniversalExportHub';
import {
  getVisualPaletteMode,
  setVisualPaletteMode,
  VisualPaletteMode,
} from '../../utils/activityStyles';
import {
  PetalShapeBadge,
  getPetalGroupRadiusClass,
  PetalFourQuadrantSwatch,
  PETAL_PALETTE_OPTIONS,
  PETAL_COLOR_STYLES,
  PetalColorStyleId,
  PetalExpressiveShape,
  getSavedPetalColorStyle,
  setSavedPetalColorStyle,
  getSavedAmoledBlack,
  setSavedAmoledBlack,
  getSavedExpressiveShapes,
  setSavedExpressiveShapes,
  M3Switch,
} from '../common/PetalExpressive';

export type SettingsSectionId =
  | 'phone_install'
  | 'export'
  | 'sync'
  | 'profile'
  | 'security'
  | 'appearance'
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
    pushNotification,
    appLock,
    configureAppLock,
    lockApp,
    theme,
    setTheme,
    accentTone,
    setAccentTone,
    setIsInstallModalOpen,
    hydration,
    toggleWaterReminder,
    toggleAdaptiveWaterReminder,
    sendAdaptiveHydrationNotification,
    currency,
    setCurrency,
    scheduleStartHour,
    scheduleEndHour,
    setScheduleTimingPreset,
  } = useApp();

  const isDark = theme === 'dark' || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  // Petal v4.4 Theme, Color Style, AMOLED & Expressive Shapes State
  const [paletteMode, setPaletteModeState] = useState<VisualPaletteMode>(() => getVisualPaletteMode());
  const [colorStyle, setColorStyleState] = useState<PetalColorStyleId>(() => getSavedPetalColorStyle());
  const [amoledBlack, setAmoledBlackState] = useState<boolean>(() => getSavedAmoledBlack());
  const [expressiveShapes, setExpressiveShapesState] = useState<boolean>(() => getSavedExpressiveShapes());

  const handleSelectPetalPalette = (opt: typeof PETAL_PALETTE_OPTIONS[number]) => {
    if (opt.accentTone) {
      setAccentTone(opt.accentTone);
    }
    const nextMode: VisualPaletteMode = opt.paletteMode || 'colorful';
    setVisualPaletteMode(nextMode);
    setPaletteModeState(nextMode);
    try { soundEngine.playClick?.(); } catch {}
  };

  const handleSelectColorStyle = (style: PetalColorStyleId) => {
    setColorStyleState(style);
    setSavedPetalColorStyle(style);
    try { soundEngine.playClick?.(); } catch {}
  };

  const handleToggleAmoled = (enabled: boolean) => {
    setAmoledBlackState(enabled);
    setSavedAmoledBlack(enabled);
    try { soundEngine.playClick?.(); } catch {}
  };

  const handleToggleExpressiveShapes = (enabled: boolean) => {
    setExpressiveShapesState(enabled);
    setSavedExpressiveShapes(enabled);
    try { soundEngine.playClick?.(); } catch {}
  };

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
    try {
      const m = localStorage.getItem('omni_ai_model');
      return !m || m === 'gemini-3.8-flash' ? 'gemini-4-hydrogen' : m;
    } catch {
      return 'gemini-4-hydrogen';
    }
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
      setSelectedAiModelInput('gemini-4-hydrogen');
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
  const draftCardBg = 'default';
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
        if (e.detail.transitionStyle !== undefined) setDraftTransitionStyle(e.detail.transitionStyle);
      }
    };
    window.addEventListener('omni_quote_theme_changed', handleThemeChange);
    return () => window.removeEventListener('omni_quote_theme_changed', handleThemeChange);
  }, []);

  // Sound, Haptics & Notification Permission State
  const [masterVolume, setMasterVolume] = useState<number>(() => soundEngine.getVolume());
  const [selectedTone, setSelectedTone] = useState<AlarmToneType>(() => soundEngine.getTone());
  const [selectedNotificationSound, setSelectedNotificationSound] = useState<NotificationSoundType>(() => soundEngine.getNotificationSound());
  const [eventSounds, setEventSounds] = useState<Record<EventSoundCategory, string>>(() => soundEngine.getAllEventSounds());
  const [notifPopupStyle, setNotifPopupStyle] = useState<NotificationPopupStyle>(() => soundEngine.getNotificationPopupStyle());
  const [alarmPopupStyle, setAlarmPopupStyle] = useState<AlarmPopupStyle>(() => soundEngine.getAlarmPopupStyle());
  const [alarmCategoryFilter, setAlarmCategoryFilter] = useState<'all' | 'ticktick' | 'tickit'>('all');
  const [soundToggles, setSoundToggles] = useState<Record<string, boolean>>(() => soundEngine.getAllSoundToggles());
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(() => haptics.getEnabled());
  const [notifPermission, setNotifPermission] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  // Auto-sync quote card styling to localStorage and CSS variables whenever adjusted
  React.useEffect(() => {
    try {
      localStorage.setItem('omni_quote_font_scale', String(draftFontScale));
      localStorage.setItem('omni_quote_font_family', draftFontFamily);
      localStorage.setItem('omni_quote_card_bg', draftCardBg);
      localStorage.setItem('omni_quote_transition_style', draftTransitionStyle);

      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--quote-font-scale', String(draftFontScale));
        document.documentElement.style.setProperty('--quote-font-family', draftFontFamily);
        ColorThemeService.applyTheme(draftCardBg, isDark);
      }
    } catch {}
  }, [draftFontScale, draftFontFamily, draftCardBg, draftTransitionStyle, isDark]);

  const handleApplyCardSettings = () => {
    try {
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
      setShowPassModal(false);
      setNewPassphrase('');
      pushNotification('Security Updated', 'Master encryption passphrase updated.', 'system');
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

  const settingsSections: {
    id: SettingsSectionId;
    category: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    iconBg: string;
    fillClass: string;
    strokeClass: string;
    shape: PetalExpressiveShape;
    badge?: string;
  }[] = [
    {
      id: 'appearance',
      category: 'Material 4 / Material You Experience',
      title: 'Appearance, Themes & Color Styles',
      subtitle: `${theme === 'dark' ? (amoledBlack ? 'AMOLED Black' : 'Dark Slate') : 'Light'} • ${accentTone.toUpperCase()} • Material You 4-Quadrant Palettes`,
      icon: <Palette className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      iconBg: 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/80',
      fillClass: 'text-amber-100/90 dark:text-amber-950/80',
      strokeClass: 'text-amber-300/80 dark:text-amber-800/80',
      shape: 'cookie12',
      badge: 'Material 4',
    },
    {
      id: 'notifications',
      category: 'Material 4 / Material You Experience',
      title: 'Notifications & Exact Alarms',
      subtitle: 'Habit pings, water reminder scheduler & audible alarm chimes',
      icon: <Bell className="w-5 h-5 text-orange-600 dark:text-orange-400" />,
      iconBg: 'bg-orange-50 dark:bg-orange-950/60 border border-orange-200/80 dark:border-orange-800/80',
      fillClass: 'text-orange-100/90 dark:text-orange-950/80',
      strokeClass: 'text-orange-300/80 dark:text-orange-800/80',
      shape: 'cookie9',
    },
    {
      id: 'sound',
      category: 'Material 4 / Material You Experience',
      title: 'Sound Synthesizer & Haptics',
      subtitle: 'Micro-tone chimes, completion water-drop audio & haptic testers',
      icon: <Volume2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80',
      fillClass: 'text-indigo-100/90 dark:text-indigo-950/80',
      strokeClass: 'text-indigo-300/80 dark:text-indigo-800/80',
      shape: 'clover',
    },
    {
      id: 'phone_install',
      category: 'Apps, Cloud & Portability',
      title: 'Phone Installation & Web Access',
      subtitle: 'Install standalone app on Android or iOS, QR code, desktop PWA',
      icon: <Smartphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80',
      fillClass: 'text-emerald-100/90 dark:text-emerald-950/80',
      strokeClass: 'text-emerald-300/80 dark:text-emerald-800/80',
      shape: 'cookie9',
      badge: 'PWA Ready',
    },
    {
      id: 'export',
      category: 'Apps, Cloud & Portability',
      title: 'Universal Data Export Hub',
      subtitle: 'Super Productivity, Todoist, Google Tasks, iCal, Obsidian, backups',
      icon: <Archive className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80',
      fillClass: 'text-indigo-100/90 dark:text-indigo-950/80',
      strokeClass: 'text-indigo-300/80 dark:text-indigo-800/80',
      shape: 'scallop',
      badge: 'Multi-App',
    },
    {
      id: 'sync',
      category: 'Apps, Cloud & Portability',
      title: 'Cloud Synchronization & Storage',
      subtitle: `${syncEmail ? syncEmail : 'Local device storage'} • Remote sync & conflict resolution`,
      icon: <Cloud className="w-5 h-5 text-sky-600 dark:text-sky-400" />,
      iconBg: 'bg-sky-50 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800/80',
      fillClass: 'text-sky-100/90 dark:text-sky-950/80',
      strokeClass: 'text-sky-300/80 dark:text-sky-800/80',
      shape: 'clover',
    },
    {
      id: 'profile',
      category: 'Personal & Security',
      title: 'Account Profile & Preferences',
      subtitle: `${userProfile.name || 'Jivan User'} • Avatar, nickname, bio & 2FA protection`,
      icon: <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
      iconBg: 'bg-purple-50 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800/80',
      fillClass: 'text-purple-100/90 dark:text-purple-950/80',
      strokeClass: 'text-purple-300/80 dark:text-purple-800/80',
      shape: 'cookie12',
    },
    {
      id: 'security',
      category: 'Personal & Security',
      title: 'Security, App Lock & Vault',
      subtitle: `${appLock.isEnabled ? 'App Lock Protected (PIN)' : 'Not configured'} • Vault master key & AES encryption`,
      icon: <ShieldCheck className="w-5 h-5 text-rose-600 dark:text-rose-400" />,
      iconBg: 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800/80',
      fillClass: 'text-rose-100/90 dark:text-rose-950/80',
      strokeClass: 'text-rose-300/80 dark:text-rose-800/80',
      shape: 'scallop',
      badge: appLock.isEnabled ? 'Active' : undefined,
    },
    {
      id: 'ai',
      category: 'Intelligence & System',
      title: 'AI Engine & Intelligence Providers',
      subtitle: `${aiProviderInput.toUpperCase()} (${selectedAiModelInput}) • Custom API endpoints & keys`,
      icon: <Sparkles className="w-5 h-5 text-fuchsia-600 dark:text-fuchsia-400" />,
      iconBg: 'bg-fuchsia-50 dark:bg-fuchsia-950/60 border border-fuchsia-200/80 dark:border-fuchsia-800/80',
      fillClass: 'text-fuchsia-100/90 dark:text-fuchsia-950/80',
      strokeClass: 'text-fuchsia-300/80 dark:text-fuchsia-800/80',
      shape: 'cookie9',
    },
    {
      id: 'system',
      category: 'Intelligence & System',
      title: 'System, Timezone & Storage',
      subtitle: `Timezone: ${timezoneInput} • Cache status, local database & data reset`,
      icon: <HardDrive className="w-5 h-5 text-slate-600 dark:text-slate-400" />,
      iconBg: 'bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80',
      fillClass: 'text-slate-200/90 dark:text-zinc-800/90',
      strokeClass: 'text-slate-300 dark:text-zinc-700',
      shape: 'cookie12',
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
    <div className="space-y-4 w-full min-w-0 max-w-4xl mx-auto pb-6 overflow-x-hidden">
      {/* If no section is selected, render Petal v4.4 Material Expressive Settings Hub */}
      {activeSection === null ? (
        <div className="space-y-3.5 w-full min-w-0 max-w-3xl mx-auto animate-view-enter">
          {/* Petal Expressive Settings Header with Material Gear Badge */}
          <div className="pt-0.5 pb-0.5 flex items-center justify-between gap-2 w-full min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <PetalShapeBadge
                shape={expressiveShapes ? 'cookie12' : 'squircle'}
                fillClass="text-indigo-100 dark:text-indigo-950/90"
                strokeClass="text-indigo-300/80 dark:text-indigo-800/80"
                sizeClass="w-9 h-9"
              >
                <Settings className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
              </PetalShapeBadge>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none truncate">
                  Settings
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                  Compact Material 4 / Material You, Cloud &amp; Security
                </p>
              </div>
            </div>

            {/* Quick Light / Dark Pill */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-slate-200/80 dark:bg-zinc-900 border border-slate-300/60 dark:border-zinc-800 shrink-0">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`px-2 py-1 rounded-full text-[10.5px] font-bold flex items-center gap-1 transition cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Light</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`px-2 py-1 rounded-full text-[10.5px] font-bold flex items-center gap-1 transition cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dark</span>
              </button>
            </div>
          </div>

          {/* Petal Search Bar */}
          <div className="relative w-full min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search settings (theme, palette, export, backup)..."
              className="w-full pl-9 pr-8 py-2 rounded-[18px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 focus:border-indigo-500 text-xs font-medium text-slate-800 dark:text-zinc-200 placeholder-slate-400 transition outline-hidden shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Petal Status Hero + Instant Material You 4-Quadrant Palette Bar */}
          {!searchQuery && (
            <div className="space-y-[3px] w-full min-w-0">
              {/* Top Card: User Account & Sync Status */}
              <div
                onClick={() => setActiveSection('profile')}
                className="rounded-[20px] p-2.5 sm:p-3.5 bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800/90 shadow-2xs hover:bg-slate-50/70 dark:hover:bg-zinc-800/60 transition flex items-center justify-between gap-2.5 cursor-pointer group active:scale-[0.99] w-full min-w-0"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {avatarPhoto ? (
                    <img
                      src={avatarPhoto}
                      alt={userProfile.name}
                      className="w-11 h-11 rounded-2xl object-cover ring-2 ring-indigo-500/30 shrink-0"
                    />
                  ) : (
                    <PetalShapeBadge
                      shape={expressiveShapes ? 'cookie9' : 'squircle'}
                      fillClass="text-indigo-600 dark:text-indigo-500"
                      strokeClass="text-indigo-400/40"
                      sizeClass="w-11 h-11"
                    >
                      <span className="text-white font-extrabold text-sm">
                        {(userProfile.name || 'U').charAt(0).toUpperCase()}
                      </span>
                    </PetalShapeBadge>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                        {userProfile.name || 'Jivan Account'}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                        {syncEmail ? 'Cloud Synced' : 'Local'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                      {userProfile.email || syncEmail || 'Tap to customize profile, avatar & 2FA'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition shrink-0" />
              </div>
            </div>
          )}

          {/* Categorized Petal Grouped Containment Cards */}
          {searchQuery ? (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 px-3 block">
                Search Results ({filteredSections.length})
              </span>
              {filteredSections.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-zinc-900 rounded-[24px] border border-slate-200 dark:border-zinc-800">
                  No settings found matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                <div className="space-y-[3px]">
                  {filteredSections.map((item, idx) => {
                    const radiusClass = getPetalGroupRadiusClass(idx, filteredSections.length);
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setActiveSection(item.id);
                          setSearchQuery('');
                        }}
                        className={`${radiusClass} bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800/90 p-3.5 sm:p-4 hover:bg-slate-50/90 dark:hover:bg-zinc-800/60 active:scale-[0.985] transition flex items-center justify-between gap-3 cursor-pointer group shadow-2xs`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <PetalShapeBadge
                            shape={expressiveShapes ? item.shape : 'squircle'}
                            fillClass={item.fillClass}
                            strokeClass={item.strokeClass}
                            sizeClass="w-10 h-10"
                          >
                            {item.icon}
                          </PetalShapeBadge>
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
                            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                              {item.subtitle}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3.5 w-full min-w-0">
              {categories.map(cat => {
                const items = settingsSections.filter(s => s.category === cat);
                return (
                  <div key={cat} className="space-y-1 w-full min-w-0">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 px-2.5 block">
                      {cat}
                    </span>
                    <div className="space-y-[3px] w-full min-w-0">
                      {items.map((item, idx) => {
                        const radiusClass = getPetalGroupRadiusClass(idx, items.length);
                        return (
                          <div
                            key={item.id}
                            onClick={() => setActiveSection(item.id)}
                            className={`${radiusClass} bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800/90 p-2.5 sm:p-3.5 hover:bg-slate-50/90 dark:hover:bg-zinc-800/60 active:scale-[0.985] transition flex items-center justify-between gap-2.5 cursor-pointer group shadow-2xs select-none w-full min-w-0`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <PetalShapeBadge
                                shape={expressiveShapes ? item.shape : 'squircle'}
                                fillClass={item.fillClass}
                                strokeClass={item.strokeClass}
                                sizeClass="w-9 h-9"
                              >
                                {item.icon}
                              </PetalShapeBadge>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate">
                                    {item.title}
                                  </span>
                                  {item.badge && (
                                    <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 shrink-0">
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10.5px] sm:text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                                  {item.subtitle}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Dedicated Subpage Page View */
        <div className="space-y-4 w-full min-w-0 max-w-full overflow-x-hidden animate-view-enter">
          {/* Subpage Header with Back Button & Expressive Shape Badge */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80 dark:border-zinc-800 gap-2 w-full min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setActiveSection(null)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-[11px] font-bold transition cursor-pointer shadow-2xs shrink-0 active:scale-95"
                title="Return to Settings Overview"
              >
                <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Settings</span>
              </button>

              <div className="flex items-center gap-2 min-w-0 flex-1">
                <PetalShapeBadge
                  shape={expressiveShapes && currentSectionConfig ? currentSectionConfig.shape : 'squircle'}
                  fillClass={currentSectionConfig?.fillClass}
                  strokeClass={currentSectionConfig?.strokeClass}
                  sizeClass="w-8 h-8"
                >
                  {currentSectionConfig?.icon}
                </PetalShapeBadge>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                    {currentSectionConfig?.title}
                  </h2>
                  <span className="text-[10.5px] text-slate-500 dark:text-zinc-400 block truncate">
                    {currentSectionConfig?.category}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveSection(null)}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer hidden sm:inline shrink-0"
            >
              All Settings
            </button>
          </div>

          {/* Dedicated Section Configuration */}
          {activeSection === 'phone_install' && (
            <div className="rounded-2xl border border-indigo-200/90 dark:border-indigo-800/80 bg-gradient-to-br from-indigo-50/40 via-white to-emerald-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 p-3.5 sm:p-5 shadow-2xs space-y-3.5 w-full min-w-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-indigo-100 dark:border-indigo-900/40">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Smartphone className="w-4.5 h-4.5 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        Phone Installation &amp; Web Access
                      </h3>
                      <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        Universal PWA
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Install as a standalone mobile app on Android or iOS, and access from any browser
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={typeof window !== 'undefined' ? window.location.origin : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                    title="Open Jivan in a clean standalone browser tab outside the AI Studio frame"
                  >
                    <span>Open Standalone</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    type="button"
                    id="btn-settings-open-install-modal"
                    onClick={() => setIsInstallModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[11px] font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Download className="w-3 h-3" />
                    <span>Install / QR Code</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    📱 Android Phone
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Open link in Chrome &gt; tap &quot;Add to Home Screen&quot; or &quot;Install app&quot; for full standalone app experience.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    🍏 iPhone &amp; iPad
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Open link in Safari &gt; tap Share button &gt; tap &quot;Add to Home Screen&quot;.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
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
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 shadow-xs w-full min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Cloud className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                Cloud Synchronization &amp; Storage
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Encrypted remote backups with conflict resolution
              </p>
            </div>
          </div>
          <button
            id="btn-trigger-cloud-sync"
            onClick={handleManualBackup}
            disabled={syncState.status === 'syncing'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-semibold shadow-xs transition shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
            <span>Sync Now</span>
          </button>
        </div>

        {/* Target Sync Account Banner */}
        <div className="mt-3 p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Mail className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                  Target Sync Account:
                </span>
                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 truncate max-w-[180px] sm:max-w-none">
                  {syncEmail}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto min-w-0">
            <select
              value={syncEmail}
              onChange={(e) => setSyncEmail(e.target.value)}
              className="flex-1 sm:flex-none min-w-0 text-[11px] font-semibold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-indigo-200 dark:border-indigo-800 rounded-lg px-2 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer truncate"
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
                  syncState.status === 'synced' || syncState.status === 'idle'
                    ? 'bg-emerald-500'
                    : syncState.status === 'syncing'
                    ? 'bg-amber-500 animate-pulse'
                    : syncState.status === 'offline'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
              {syncState.status === 'idle' ? 'Synced' : syncState.status}
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

          {/* Alarms, Notifications & Hydration Reminders Section */}
          {activeSection === 'notifications' && (
            <div className="space-y-4 w-full min-w-0 overflow-hidden">
              {/* Card 1: Exact Alarms & Audio Chimes Modal Launcher */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-4 w-full min-w-0 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Bell className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        Alarms, Notifications &amp; Audio Chimes
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Configure exact-time reminders, snooze intervals, and alarm stack behavior
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNotifSettingsOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition shrink-0 cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Open Alarm Studio</span>
                  </button>
                </div>

                {/* Browser Push Permission Row */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2.5">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>System Browser Notification Permission</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase ${
                          notifPermission === 'granted'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {notifPermission}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Required for background desktop &amp; mobile banner alerts when Jivan is minimized
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {notifPermission !== 'granted' && (
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await notificationService.requestPermission();
                          setNotifPermission(ok ? 'granted' : 'denied');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition cursor-pointer"
                      >
                        Grant Permission
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playAlarmChime();
                        pushNotification('Test Reminder Alert', 'Exact-time notification and chime verified!', 'task');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 text-[11px] font-bold transition cursor-pointer"
                    >
                      Send Test Alert
                    </button>
                  </div>
                </div>

                {/* Notification Pop-Up Style (Dynamic Island / Android Heads-Up / Compact Card) */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Notification Pop-Up Style (TickTick Task Card / Camera Pill / Android)
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Choose how in-app notifications pop up on your screen
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        pushNotification(
                          'YouTube Task',
                          'Search about what value I can provide on YouTube',
                          'task',
                          { sound: 'task' }
                        );
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-bold transition cursor-pointer"
                    >
                      Test Notification Pop-Up
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {[
                      {
                        id: 'ticktick_card' as NotificationPopupStyle,
                        title: 'TickTick Task Pop-Up',
                        desc: 'Dark bottom-sheet card with schedule range, Focus target ◉, Snooze & Complete',
                        badge: 'Task Pop-Up',
                      },
                      {
                        id: 'dynamic_island' as NotificationPopupStyle,
                        title: 'Dynamic Island / Pill',
                        desc: 'Camera cutout pill that expands into an interactive capsule',
                        badge: 'Camera Pill',
                      },
                      {
                        id: 'android_heads_up' as NotificationPopupStyle,
                        title: 'Android Heads-Up',
                        desc: 'Material 3 pop-up card with Mark Done & Snooze bar',
                        badge: 'Android',
                      },
                      {
                        id: 'compact_card' as NotificationPopupStyle,
                        title: 'Compact Card',
                        desc: 'Classic JivanOS compact swipeable toast card',
                        badge: 'Classic',
                      },
                    ].map((opt) => {
                      const active = notifPopupStyle === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setNotifPopupStyle(opt.id);
                            soundEngine.setNotificationPopupStyle(opt.id);
                            haptics.toggle();
                          }}
                          className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between gap-1 cursor-pointer ${
                            active
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 ring-2 ring-indigo-500/30'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                              {opt.badge}
                            </span>
                            {active && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              {opt.title}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                              {opt.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active Alarm Display Style Selector */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Active Alarm Display Style (TickTick Task Pop-Up / Floating PiP Card)
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Display the TickTick Bottom Task Pop-Up Card or a draggable Floating PiP Card when an alarm triggers
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent('omnilifeos_trigger_alarm', {
                            detail: {
                              id: `settings_pip_alarm_${Date.now()}`,
                              source: 'task',
                              title: 'YouTube Task',
                              subtitle: 'Search about what value I can provide on YouTube',
                              dueDateLabel: 'Yesterday, 9:00am - 9:20am',
                              listIcon: '👋',
                              listLabel: 'Welcome',
                              dueTime: '09:00',
                              reminderType: 'alarm',
                            },
                          })
                        );
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10.5px] font-bold transition cursor-pointer"
                    >
                      Test Task Pop-Up Card
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      {
                        id: 'ticktick_card' as AlarmPopupStyle,
                        title: 'TickTick Task Pop-Up',
                        desc: 'Bottom-sheet task reminder card with schedule time, ◉ Focus, Snooze & Complete',
                        badge: 'TickTick Card',
                      },
                      {
                        id: 'pip_card' as AlarmPopupStyle,
                        title: 'Floating PiP Alarm Card',
                        desc: 'Draggable Picture-in-Picture card with live active timer, minimize to pill/bar, snooze & complete',
                        badge: 'PiP Active Card',
                      },
                      {
                        id: 'classic_banner' as AlarmPopupStyle,
                        title: 'Classic Top Alarm Banner',
                        desc: 'Standard top-center grouped alarm stack banner',
                        badge: 'Top Banner',
                      },
                    ].map((opt) => {
                      const active = alarmPopupStyle === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setAlarmPopupStyle(opt.id);
                            soundEngine.setAlarmPopupStyle(opt.id);
                            haptics.toggle();
                          }}
                          className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between gap-1 cursor-pointer ${
                            active
                              ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 ring-2 ring-rose-500/30'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                              {opt.badge}
                            </span>
                            {active && <span className="w-2 h-2 rounded-full bg-rose-500" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              {opt.title}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                              {opt.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Card 2: Smart Hydration & Water Reminder Scheduler */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-3.5 w-full min-w-0 overflow-hidden">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      Smart Hydration &amp; Water Reminders
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Automatic water intake alerts with liquid water-drop chime
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(hydration.reminderEnabled)}
                    onChange={(e) => toggleWaterReminder(e.target.checked, hydration.reminderIntervalHours || 2)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Reminder Frequency Interval
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 4].map((hrs) => {
                        const active = (hydration.reminderIntervalHours || 2) === hrs;
                        return (
                          <button
                            key={hrs}
                            type="button"
                            onClick={() => toggleWaterReminder(true, hrs)}
                            className={`py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                              active
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            Every {hrs}h
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Adaptive Pace Coaching
                      </div>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                        Adjusts reminder urgency based on daily {hydration.targetMl}ml target
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(hydration.adaptiveRemindersEnabled)}
                      onChange={(e) => toggleAdaptiveWaterReminder(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playWaterDropNotification();
                      sendAdaptiveHydrationNotification(true);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-800/70 text-[11px] font-bold hover:bg-sky-100 transition cursor-pointer"
                  >
                    Test Water Drop Reminder
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AI Models & Providers Configuration Card */}
          {activeSection === 'ai' && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 shadow-xs w-full min-w-0 overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Key className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                AI Models &amp; Provider API Keys
              </h3>
              <p className="text-[11px] text-slate-400">
                Select your preferred AI provider and model, and input your API key
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
                  <option value="gemini-4-hydrogen">Gemini 4 Hydrogen (Fast &amp; Balanced - Recommended)</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Ultra-Low Latency)</option>
                  <option value="gemini-4-argon">Gemini 4 Argon (Complex Reasoning - Paid)</option>
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

          {/* System, Regional Timezone, Currency & Schedule Defaults */}
          {activeSection === 'system' && (
            <div className="space-y-4 w-full min-w-0 overflow-hidden">
              {/* Card 1: Regional Timezone */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Regional Time &amp; Timezone
                      </h3>
                      <p className="text-xs text-slate-400">
                        Set your timezone for exact-time alarms, daily streaks, and timeline blocks
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
                        if (detected) {
                          setTimezoneInput(detected);
                          localStorage.setItem('omni_timezone', detected);
                          setTimezoneMsg(`Auto-detected device timezone: ${detected}`);
                          setTimeout(() => setTimezoneMsg(''), 3500);
                        }
                      } catch {}
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70 text-[11px] font-bold hover:bg-amber-100 transition cursor-pointer"
                  >
                    Auto-Detect Timezone
                  </button>
                </div>

                <form onSubmit={handleSaveTimezone} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Active Timezone
                    </label>
                    <select
                      value={timezoneInput}
                      onChange={(e) => setTimezoneInput(e.target.value)}
                      className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+05:30)</option>
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      <option value="America/New_York">America/New_York (EST/EDT)</option>
                      <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                      <option value="America/Denver">America/Denver (MST/MDT)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                      <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                      <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GST - UTC+04:00)</option>
                      <option value="Asia/Singapore">Asia/Singapore (SGT - UTC+08:00)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (JST - UTC+09:00)</option>
                      <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                    </select>
                  </div>

                  {timezoneMsg && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{timezoneMsg}</span>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
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

              {/* Card 2: Regional Currency & Timeline Day Hours */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Currency &amp; Timeline Day Window
                  </h4>
                  <p className="text-xs text-slate-400">
                    Configure default currency for Bills &amp; Subscriptions and default hours for Task Timeline
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Default Currency (Bills &amp; Finance)
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { code: 'INR', label: '₹ INR' },
                        { code: 'USD', label: '$ USD' },
                        { code: 'EUR', label: '€ EUR' },
                        { code: 'GBP', label: '£ GBP' },
                      ].map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setCurrency(c.code);
                            soundEngine.playClick();
                          }}
                          className={`py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            currency === c.code
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Timeline Day Grid Hours
                      </label>
                      <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {scheduleStartHour}:00 – {scheduleEndHour}:00
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'standard' as const, label: 'Standard (6h–22h)' },
                        { id: 'workday' as const, label: 'Workday (8h–18h)' },
                        { id: 'early' as const, label: 'Early (5h–21h)' },
                        { id: '24h' as const, label: 'Full 24 Hours' },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setScheduleTimingPreset(preset.id);
                            soundEngine.playClick();
                          }}
                          className="py-1.5 px-2 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer truncate"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Petal v4.4 Appearance, Themes Engine & Quote Cards Customization */}
          {activeSection === 'appearance' && (
            <div className="space-y-4 w-full min-w-0 overflow-hidden">
              {/* SECTION 1: PETAL THEME MODE, 4-QUADRANT MATERIAL YOU PALETTES & COLOR STYLES */}
              <div className="space-y-[3px] w-full min-w-0">
                {/* Card 1 (TOP): Theme Mode & AMOLED Pure Black */}
                <div className="rounded-t-[20px] rounded-b-[6px] border border-slate-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 p-3 sm:p-4 shadow-2xs space-y-3 w-full min-w-0 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 w-full min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <PetalShapeBadge
                        shape={expressiveShapes ? 'cookie12' : 'squircle'}
                        fillClass="text-indigo-100 dark:text-indigo-950/90"
                        strokeClass="text-indigo-300 dark:text-indigo-800"
                        sizeClass="w-9 h-9"
                      >
                        <Settings className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                      </PetalShapeBadge>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                          Theme Mode &amp; OLED Canvas
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                          Light, Dark, or 0-nit AMOLED Pure Black mode
                        </p>
                      </div>
                    </div>

                    {/* Light / Dark Segmented Switch */}
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 shrink-0">
                      <button
                        type="button"
                        onClick={() => setTheme('light')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                          theme === 'light'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-500 dark:text-zinc-400'
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>Light</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme('dark')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                          theme === 'dark'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-500 dark:text-zinc-400'
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5" />
                        <span>Dark</span>
                      </button>
                    </div>
                  </div>

                  {/* AMOLED Black & Expressive Shapes Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                    <div
                      onClick={() => handleToggleAmoled(!amoledBlack)}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80 flex items-center justify-between gap-2.5 cursor-pointer min-w-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          AMOLED Pure Black (#000000)
                        </div>
                        <div className="text-[10.5px] text-slate-500 dark:text-zinc-400 truncate">
                          True pitch-black background in Dark Mode
                        </div>
                      </div>
                      <M3Switch
                        checked={amoledBlack}
                        onChange={(val) => handleToggleAmoled(val)}
                        size="sm"
                      />
                    </div>

                    <div
                      onClick={() => handleToggleExpressiveShapes(!expressiveShapes)}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80 flex items-center justify-between gap-2.5 cursor-pointer min-w-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          Material Expressive Shapes
                        </div>
                        <div className="text-[10.5px] text-slate-500 dark:text-zinc-400 truncate">
                          Cookie, Scallop, Clover &amp; Squircle badges
                        </div>
                      </div>
                      <M3Switch
                        checked={expressiveShapes}
                        onChange={(val) => handleToggleExpressiveShapes(val)}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Card 2 (MIDDLE): Material You 4-Quadrant Color Palettes */}
                <div className="rounded-[6px] border border-slate-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 p-3 sm:p-4 shadow-2xs space-y-2.5 w-full min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                        Material You 4-Quadrant Color Palettes
                      </h4>
                      <p className="text-[10.5px] text-slate-500 dark:text-zinc-400 truncate">
                        Vibrant Material 3 seed palette or Mono + Color
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 uppercase shrink-0">
                      {paletteMode === 'mono_accent' ? 'Mono+Color' : accentTone}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 pt-0.5 justify-items-center">
                    {PETAL_PALETTE_OPTIONS.map((opt) => {
                      const isSelected =
                        (opt.id === 'mono_accent' && paletteMode === 'mono_accent') ||
                        (opt.accentTone && paletteMode === 'colorful' && accentTone === opt.accentTone);
                      return (
                        <PetalFourQuadrantSwatch
                          key={opt.id}
                          option={opt}
                          selected={Boolean(isSelected)}
                          onSelect={() => handleSelectPetalPalette(opt)}
                          size="sm"
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Card 3 (BOTTOM): Petal Color Style Variants */}
                <div className="rounded-t-[6px] rounded-b-[20px] border border-slate-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 p-3 sm:p-4 shadow-2xs space-y-2.5 w-full min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                        Petal Color Style Variant
                      </h4>
                      <p className="text-[10.5px] text-slate-500 dark:text-zinc-400 truncate">
                        Fine-tune chroma saturation and tonal contrast across the app
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PETAL_COLOR_STYLES.map((st) => {
                      const isActive = colorStyle === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleSelectColorStyle(st.id)}
                          className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-0.5 ${
                            isActive
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-slate-50 dark:bg-zinc-800/80 text-slate-800 dark:text-zinc-200 border-slate-200/80 dark:border-zinc-700/80 hover:bg-slate-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-extrabold truncate">{st.label}</span>
                            {isActive && <Check className="w-3 h-3 shrink-0" />}
                          </div>
                          <span
                            className={`text-[9.5px] leading-snug line-clamp-2 ${
                              isActive ? 'text-white/85' : 'text-slate-500 dark:text-zinc-400'
                            }`}
                          >
                            {st.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* SECTION 2: QUOTE CARDS & TYPOGRAPHY APPEARANCE */}
              <div className="rounded-[20px] border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-5 shadow-2xs w-full min-w-0 overflow-hidden">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
              <Palette className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                Wisdom Quote Cards &amp; Typography
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Customize typography scaling, typeface, and transition effects
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
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
                          {currentPreset?.name || 'Pure White'}
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
            </div>
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
            <div className="space-y-4 w-full min-w-0 overflow-hidden">
              {/* App-wide Passcode & Fingerprint Lock Card */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 shadow-xs w-full min-w-0 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Fingerprint className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        App Lock, Passcode &amp; Fingerprint
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate">
                        Lock whole app with biometrics or custom PIN passcode
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      playLockSound();
                      lockApp();
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 text-[11px] font-semibold hover:bg-rose-100 transition shadow-2xs cursor-pointer shrink-0"
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
                    Sensitive medical notes and private data are encrypted using 256-bit AES-GCM
                    derived via PBKDF2 with 100,000 iterations.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Status:{' '}
                    <strong className="text-emerald-500">
                      Protected
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

          {/* Sound Synthesizer, Chime Tones & Haptics */}
          {activeSection === 'sound' && (
            <div className="space-y-4 w-full min-w-0 overflow-hidden">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Volume2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        Web Audio Synthesizer &amp; Tactile Haptics
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Zero-latency offline sound synthesis and 10ms tactile micro-vibrations
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-lg border border-indigo-200/60 dark:border-indigo-800/60">
                    {Math.round(masterVolume * 100)}%
                  </span>
                </div>

                {/* Master Volume Slider */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      Master Synthesizer Volume
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = masterVolume > 0 ? 0 : 0.8;
                        setMasterVolume(next);
                        soundEngine.setVolume(next);
                        if (next > 0) soundEngine.playClick();
                      }}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      {masterVolume === 0 ? 'Unmute (80%)' : 'Mute All'}
                    </button>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={masterVolume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setMasterVolume(val);
                      soundEngine.setVolume(val);
                    }}
                    onMouseUp={() => soundEngine.playClick()}
                    onTouchEnd={() => soundEngine.playClick()}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                {/* Tactile Haptics Toggle */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Tactile Haptic Feedback (10ms Pulse)
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Subtle device vibration when completing tasks, habits, or switching tabs
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        haptics.setEnabled(true);
                        setHapticsEnabled(true);
                        haptics.trigger(20);
                        soundEngine.playClick();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10.5px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Test Pulse
                    </button>
                    <input
                      type="checkbox"
                      checked={hapticsEnabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setHapticsEnabled(enabled);
                        haptics.setEnabled(enabled);
                        if (enabled) haptics.trigger(15);
                      }}
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                </div>

                {/* 0. Per-Action & Event Tone Assignment (Notification, Alarm, Win Streak, etc.) */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                        Custom Tone per Feature (Notification, Alarm, Win Streak, Habit, etc.)
                      </label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Assign any sound or ringtone to each specific action in JivanOS
                      </p>
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                      Per-Action Matrix
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {EVENT_SOUND_ITEMS.map((item) => {
                      const currentVal = eventSounds[item.id] || item.defaultTone;
                      const options = item.pool === 'alarm' ? ALARM_TONE_OPTIONS : NOTIFICATION_SOUND_OPTIONS;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-base shrink-0">{item.icon}</span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {item.label}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {item.desc}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <select
                              value={currentVal}
                              onChange={(e) => {
                                const val = e.target.value;
                                soundEngine.setEventSound(item.id, val);
                                setEventSounds(soundEngine.getAllEventSounds());
                                setSelectedTone(soundEngine.getTone());
                                setSelectedNotificationSound(soundEngine.getNotificationSound());
                                soundEngine.playEventSound(item.id);
                              }}
                              className="max-w-[155px] px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[11px] font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                            >
                              {options.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.icon} {opt.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => soundEngine.playEventSound(item.id)}
                              className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-[10px] font-bold border border-indigo-200/60 dark:border-indigo-800/60 cursor-pointer"
                              title={`Preview ${item.label}`}
                            >
                              Play
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 1. Check-Off & Notification Sound Picker */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                        Check-Off, Notification &amp; Win Sound Library ({NOTIFICATION_SOUND_OPTIONS.length})
                      </label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Plays instantly on task completion, habit logging, wins, or quick actions
                      </p>
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                      TickTick &bull; Tickit
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {NOTIFICATION_SOUND_OPTIONS.map((opt) => {
                      const isSelected = selectedNotificationSound === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSelectedNotificationSound(opt.id);
                            soundEngine.setNotificationSound(opt.id);
                            setEventSounds(soundEngine.getAllEventSounds());
                            soundEngine.playNotificationSound(opt.id);
                          }}
                          className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1 ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-base">{opt.icon}</span>
                            <span
                              className={`text-[9px] font-bold uppercase px-1 rounded ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {opt.source}
                            </span>
                          </div>
                          <div>
                            <div className="text-xs font-bold truncate flex items-center justify-between">
                              <span>{opt.name}</span>
                              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <span
                              className={`text-[9.5px] line-clamp-1 leading-tight ${
                                isSelected ? 'text-white/80' : 'text-slate-400 dark:text-slate-400'
                              }`}
                            >
                              {opt.desc}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Default Alarm & Reminder Ringtone Selector */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                        Alarm &amp; Reminder Ringtone Library ({ALARM_TONE_OPTIONS.length})
                      </label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Includes Classic Phone Ring, Twin Bell, Rooster, TickTick &amp; Tickit tones (no vibration)
                      </p>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-900 p-0.5 rounded-lg text-[10px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setAlarmCategoryFilter('all')}
                        className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                          alarmCategoryFilter === 'all'
                            ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        All ({ALARM_TONE_OPTIONS.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAlarmCategoryFilter('ticktick')}
                        className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                          alarmCategoryFilter === 'ticktick'
                            ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        TickTick
                      </button>
                      <button
                        type="button"
                        onClick={() => setAlarmCategoryFilter('tickit')}
                        className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                          alarmCategoryFilter === 'tickit'
                            ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        Tickit
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
                    {ALARM_TONE_OPTIONS.filter((t) => {
                      if (alarmCategoryFilter === 'ticktick') return t.source === 'TickTick';
                      if (alarmCategoryFilter === 'tickit') return t.source === 'Tickit';
                      return true;
                    }).map((t) => {
                      const isSelected = selectedTone === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setSelectedTone(t.id);
                            soundEngine.setTone(t.id);
                            setEventSounds(soundEngine.getAllEventSounds());
                            soundEngine.playAlarmChime(t.id);
                          }}
                          className={`p-2 rounded-xl text-left border transition cursor-pointer truncate flex flex-col justify-between gap-1 ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-base">{t.icon}</span>
                            <span
                              className={`text-[9px] font-bold px-1 rounded ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {t.source}
                            </span>
                          </div>
                          <div>
                            <div className="text-xs font-bold truncate flex items-center justify-between">
                              <span className="truncate">{t.name}</span>
                              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white ml-1 shrink-0" />}
                            </div>
                            <span
                              className={`text-[9.5px] line-clamp-1 leading-tight ${
                                isSelected ? 'text-white/80' : 'text-slate-400 dark:text-slate-400'
                              }`}
                            >
                              {t.desc}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Per-Category Sound Toggles */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Category Sound Channels
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { key: 'task', label: 'Tasks & Subtasks' },
                      { key: 'habit', label: 'Habit Streaks' },
                      { key: 'schedule', label: 'Timeline Tasks' },
                      { key: 'medication', label: 'Medication Doses' },
                      { key: 'water', label: 'Water & Hydration' },
                      { key: 'bill', label: 'Bills & Finance' },
                    ].map((cat) => {
                      const isOn = soundToggles[cat.key] !== false;
                      return (
                        <label
                          key={cat.key}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          <span className="truncate">{cat.label}</span>
                          <input
                            type="checkbox"
                            checked={isOn}
                            onChange={(e) => {
                              const next = e.target.checked;
                              soundEngine.setSoundEnabled(cat.key, next);
                              setSoundToggles(soundEngine.getAllSoundToggles());
                              if (next) soundEngine.playClick();
                            }}
                            className="w-3.5 h-3.5 accent-indigo-600 rounded shrink-0"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Synthesizer Quick Test Row */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playNotificationSound('tick');
                      haptics.tick();
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 transition cursor-pointer"
                  >
                    Test TickTick Tick
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playNotificationSound('bubble_pop');
                      haptics.pop();
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 transition cursor-pointer"
                  >
                    Test Habit Bubble Pop
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playNotificationSound('streak_fanfare');
                      haptics.celebration();
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950 text-[11px] font-bold text-amber-600 dark:text-amber-400 transition cursor-pointer"
                  >
                    Test Streak Fanfare
                  </button>
                </div>
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

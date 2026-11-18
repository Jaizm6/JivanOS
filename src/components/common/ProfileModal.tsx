import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  User,
  Camera,
  Upload,
  Trash2,
  Check,
  Shield,
  Sparkles,
  Activity,
  Mail,
  Cloud,
  Flame,
  LogOut,
  FolderSync,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { compressProfilePhoto, formatFileSize } from '../../utils/imageCompressor';
import { SupportedCurrency } from '../../types';
import { DEFAULT_AVATAR_PHOTO } from '../../utils/initialData';

export const ProfileModal: React.FC = () => {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    userProfile,
    updateUserProfile,
    pushNotification,
    setIsBackupModalOpen,
    currency,
    setCurrency,
    firebaseUser,
    loginWithGoogle,
    logout,
    joplinSyncSettings,
    updateJoplinSyncSettings,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states initialized cleanly from userProfile without any hardcoded developer personal data
  const [fullName, setFullName] = useState(
    userProfile.name && userProfile.name !== 'Guest' ? userProfile.name : ''
  );
  const [nickname, setNickname] = useState(
    userProfile.nickname && userProfile.nickname !== 'User' ? userProfile.nickname : ''
  );
  const [email, setEmail] = useState(userProfile.identifier || userProfile.email || '');
  const [bio, setBio] = useState(userProfile.bio || '');
  const [dob, setDob] = useState(userProfile.dateOfBirth || '');
  const [heightCm, setHeightCm] = useState<string>(
    userProfile.heightCm ? String(userProfile.heightCm) : ''
  );
  const [weightKg, setWeightKg] = useState<string>(
    userProfile.weightKg ? String(userProfile.weightKg) : ''
  );
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'unspecified'>(
    userProfile.gender || 'unspecified'
  );
  const [avatarPhoto, setAvatarPhoto] = useState<string>(userProfile.avatarPhoto || '');
  const [twoFactor, setTwoFactor] = useState(Boolean(userProfile.twoFactorEnabled));
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>(
    ((userProfile.preferredCurrency || currency || 'INR') as SupportedCurrency)
  );

  // Sync local state when modal opens or userProfile updates from remote drive sync
  useEffect(() => {
    if (isAuthModalOpen) {
      setFullName(userProfile.name && userProfile.name !== 'Guest' ? userProfile.name : '');
      setNickname(userProfile.nickname && userProfile.nickname !== 'User' ? userProfile.nickname : '');
      setEmail(userProfile.identifier || userProfile.email || '');
      setBio(userProfile.bio || '');
      setDob(userProfile.dateOfBirth || '');
      setHeightCm(userProfile.heightCm ? String(userProfile.heightCm) : '');
      setWeightKg(userProfile.weightKg ? String(userProfile.weightKg) : '');
      setGender(userProfile.gender || 'unspecified');
      setAvatarPhoto(userProfile.avatarPhoto || '');
      setTwoFactor(Boolean(userProfile.twoFactorEnabled));
      setSelectedCurrency(
        ((userProfile.preferredCurrency || currency || 'INR') as SupportedCurrency)
      );
      setErrorMsg('');
    }
  }, [isAuthModalOpen, userProfile, currency]);

  // Compression status feedback
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionStats, setCompressionStats] = useState<{
    original: string;
    compressed: string;
    reduction: number;
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (!isAuthModalOpen) return null;

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    try {
      setIsCompressing(true);
      setErrorMsg('');
      const res = await compressProfilePhoto(file, 256, 0.82);
      setAvatarPhoto(res.dataUrl);
      setCompressionStats({
        original: formatFileSize(res.originalSizeBytes),
        compressed: formatFileSize(res.compressedSizeBytes),
        reduction: res.reductionPercentage,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to compress image.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = () => {
    setAvatarPhoto('');
    setCompressionStats(null);
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          'Google sign-in could not complete in this browser context. You can continue using Local-First mode or connect OneDrive, Google Drive, Dropbox, WebDAV, S3, or a Local Folder in Multi-Drive Sync.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const nowIso = new Date().toISOString();
    updateUserProfile({
      name: fullName.trim() || 'Guest',
      nickname: nickname.trim() || fullName.trim().split(' ')[0] || 'User',
      identifier: email.trim(),
      email: email.trim(),
      avatarPhoto,
      bio: bio.trim(),
      dateOfBirth: dob,
      heightCm: heightCm ? Number(heightCm) : undefined,
      weightKg: weightKg ? Number(weightKg) : undefined,
      gender,
      twoFactorEnabled: twoFactor,
      preferredCurrency: selectedCurrency,
      updatedAt: nowIso,
      lastSyncedAt: nowIso,
    });

    if (setCurrency && selectedCurrency) {
      setCurrency(selectedCurrency);
    }

    setSaveSuccess(true);
    pushNotification(
      'Profile Saved & Queued for Sync',
      `Updated profile for ${nickname.trim() || fullName.trim() || 'Local Vault'}.`,
      'system'
    );

    setTimeout(() => {
      setSaveSuccess(false);
      setIsAuthModalOpen(false);
    }, 800);
  };

  const displayName = nickname.trim() || fullName.trim().split(' ')[0] || 'User';
  const enabledDrivesCount = Object.values(joplinSyncSettings.drives).filter(
    (d) => d.enabled || d.autoBackupEnabled
  ).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-3 sm:p-4 md:p-6 flex min-h-full items-center justify-center animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Personal Profile &amp; Local-First Identity
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Stored locally on your device first &bull; Automatically synced across your connected drives
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* Joplin-Style Local-First + Multi-Drive Personal Details Sync Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-transparent border border-indigo-200/80 dark:border-indigo-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <FolderSync className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Local-First Vault + Multi-Drive Profile Sync
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    {enabledDrivesCount > 0
                      ? `${enabledDrivesCount} Drive${enabledDrivesCount > 1 ? 's' : ''} Active`
                      : '100% On-Device'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                  No account is required to use JivanOS. Any photo, name, DOB, or health details you enter below stay private on your device and sync automatically to your chosen drives (OneDrive, Google Drive, Dropbox, Nextcloud, WebDAV, S3, or Local Folder).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={joplinSyncSettings.syncPersonalDetails}
                  onChange={(e) =>
                    updateJoplinSyncSettings({ syncPersonalDetails: e.target.checked })
                  }
                  className="w-3.5 h-3.5 accent-indigo-600 rounded"
                />
                <span>Sync Profile</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setIsAuthModalOpen(false);
                  setIsBackupModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                Configure Drives
              </button>
            </div>
          </div>

          {/* Avatar Photo Upload & Compression Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70 flex flex-col sm:flex-row items-center gap-4">
            {/* Avatar Preview */}
            <div className="relative group shrink-0">
              {avatarPhoto ? (
                <img
                  src={avatarPhoto}
                  alt={displayName}
                  className="w-20 h-20 rounded-full object-cover ring-3 ring-indigo-500/60 shadow-md"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-2xl shadow-md ring-3 ring-indigo-300 dark:ring-indigo-700">
                  {nickname ? nickname[0].toUpperCase() : fullName[0]?.toUpperCase() || 'U'}
                </div>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isCompressing}
                title="Upload & compress photo"
                className="absolute bottom-0 right-0 p-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition border-2 border-white dark:border-slate-900 cursor-pointer active:scale-95"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Photo Details & Controls */}
            <div className="flex-1 text-center sm:text-left space-y-1.5">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Display Photo
                </h4>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                  Auto-Compressed &bull; Syncs Across Drives
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Photos are cropped to square, resized to 256&times;256, and compressed to ~15–25 KB so your multi-drive sync bundle stays fast on mobile and desktop.
              </p>

              {compressionStats && (
                <div className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  <span>
                    Compressed: {compressionStats.original} &rarr; <strong>{compressionStats.compressed}</strong> ({compressionStats.reduction}% lighter)
                  </span>
                </div>
              )}

              <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isCompressing}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isCompressing ? 'Compressing...' : 'Choose Photo'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAvatarPhoto(DEFAULT_AVATAR_PHOTO);
                    setCompressionStats(null);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-semibold text-xs border border-emerald-200 dark:border-emerald-800 transition flex items-center gap-1 cursor-pointer"
                  title="Use default illustrated avatar"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Preset</span>
                </button>

                {avatarPhoto && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950 dark:hover:text-rose-400 text-slate-700 dark:text-slate-200 font-semibold text-xs transition flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Core Names Grid: Full Name & Nickname / Display Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Full Name (Optional)
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your name"
                className="w-full text-xs px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">Synced with your personal profile</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nickname / Display Name
                </label>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.2 rounded">
                  Shown in Sidebar
                </span>
              </div>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full text-xs px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ring-1 ring-indigo-500/20"
              />
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400">
                Displayed in top greeting &ldquo;Hello {displayName}&rdquo;
              </span>
            </div>
          </div>

          {/* Email & Bio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Contact / Backup Identifier (Optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full text-xs px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                <span>Personal Bio / Focus Mantra</span>
              </label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="e.g. Focus, execute, stay mindful"
                className="w-full text-xs px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Physical Stats & Currency Section */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/30 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span>Personal Details, DOB &amp; Currency (Synced Across Drives)</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="unspecified">Unspecified</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  value={heightCm}
                  placeholder="Optional"
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  value={weightKg}
                  placeholder="Optional"
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                />
              </div>
            </div>

            {/* Currency Selector */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Preferred Currency
                </span>
                <span className="text-[10px] text-slate-500">
                  Used for Bills, Subscriptions &amp; Expense tracking
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {[
                  { code: 'INR' as const, label: '₹ INR' },
                  { code: 'USD' as const, label: '$ USD' },
                  { code: 'EUR' as const, label: '€ EUR' },
                  { code: 'GBP' as const, label: '£ GBP' },
                ].map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setSelectedCurrency(c.code)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      selectedCurrency === c.code
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Optional JivanOS Cloud (Firebase Auth) Row */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Flame className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Optional JivanOS Cloud Account (Firebase)
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {firebaseUser
                    ? `Signed in as ${firebaseUser.email || firebaseUser.displayName}`
                    : 'Optional: Sign in with Google, or use Joplin-style OneDrive/Drive/Dropbox/WebDAV sync instead'}
                </p>
              </div>
            </div>
            {firebaseUser ? (
              <button
                type="button"
                onClick={logout}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-xs font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isLoggingIn}
                onClick={handleGoogleSignIn}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google'}</span>
              </button>
            )}
          </div>

          {/* 2FA Security Row */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  App Lock / Two-Factor Protection
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Enable extra verification for sensitive vault operations
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={twoFactor}
              onChange={(e) => setTwoFactor(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => {
                setIsAuthModalOpen(false);
                setIsBackupModalOpen(true);
              }}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Open Multi-Drive Sync &amp; Backup &rarr;</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save Profile</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

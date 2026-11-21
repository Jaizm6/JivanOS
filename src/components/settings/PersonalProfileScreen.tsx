import React, { useEffect, useState } from 'react';
import { AlertCircle, Camera, Check, Cloud, LogOut, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SupportedCurrency } from '../../types';
import { compressProfilePhoto } from '../../utils/imageCompressor';
import { SettingsSubpageHeader } from './SettingsSubpageHeader';

interface PersonalProfileScreenProps {
  onBack: () => void;
  onManageSync: () => void;
}

export const PersonalProfileScreen: React.FC<PersonalProfileScreenProps> = ({
  onBack,
  onManageSync,
}) => {
  const {
    userProfile,
    updateUserProfile,
    currency,
    setCurrency,
    firebaseUser,
    loginWithGoogle,
    logout,
    authError,
    clearAuthError,
    pushNotification,
  } = useApp();

  const [nameInput, setNameInput] = useState(
    userProfile.name === 'Guest' ? '' : userProfile.name || ''
  );
  const [nicknameInput, setNicknameInput] = useState(userProfile.nickname || '');
  const [emailInput, setEmailInput] = useState(userProfile.email || userProfile.identifier || '');
  const [avatarPhoto, setAvatarPhoto] = useState(userProfile.avatarPhoto || '');
  const [dobInput, setDobInput] = useState(userProfile.dateOfBirth || '');
  const [genderInput, setGenderInput] = useState<'male' | 'female' | 'other' | 'unspecified'>(
    userProfile.gender || 'unspecified'
  );
  const [currencyInput, setCurrencyInput] = useState<SupportedCurrency>(
    (userProfile.preferredCurrency || currency || 'INR') as SupportedCurrency
  );
  const [bioInput, setBioInput] = useState(userProfile.bio || '');

  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [profileSavedMsg, setProfileSavedMsg] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [profileAuthError, setProfileAuthError] = useState('');

  useEffect(() => {
    setNameInput(userProfile.name === 'Guest' ? '' : userProfile.name || '');
    setNicknameInput(userProfile.nickname || '');
    setEmailInput(userProfile.email || userProfile.identifier || '');
    setAvatarPhoto(userProfile.avatarPhoto || '');
    setDobInput(userProfile.dateOfBirth || '');
    setGenderInput(userProfile.gender || 'unspecified');
    setCurrencyInput((userProfile.preferredCurrency || currency || 'INR') as SupportedCurrency);
    setBioInput(userProfile.bio || '');
  }, [userProfile, currency]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select a JPG, PNG, or WebP image.');
      return;
    }
    try {
      setIsCompressingPhoto(true);
      setPhotoError('');
      const compressed = await compressProfilePhoto(file);
      setAvatarPhoto(compressed.dataUrl);
    } catch (err: any) {
      setPhotoError(err?.message || 'Failed to process image');
    } finally {
      setIsCompressingPhoto(false);
      e.target.value = '';
    }
  };

  const handleGoogleSignIn = async () => {
    setProfileAuthError('');
    clearAuthError();
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setProfileAuthError(err?.message || 'Google sign-in could not complete in this context.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const nowIso = new Date().toISOString();
    updateUserProfile({
      name: nameInput.trim() || 'Guest',
      nickname: nicknameInput.trim(),
      identifier: emailInput.trim(),
      email: emailInput.trim(),
      avatarPhoto,
      dateOfBirth: dobInput,
      gender: genderInput,
      preferredCurrency: currencyInput,
      bio: bioInput.trim(),
      updatedAt: nowIso,
    });
    if (currencyInput && currencyInput !== currency) {
      setCurrency(currencyInput);
    }
    setProfileSavedMsg('Saved');
    setTimeout(() => setProfileSavedMsg(''), 2500);
    pushNotification(
      'Profile Updated',
      'Your personal profile and currency preferences were saved.',
      'system'
    );
  };

  return (
    <div className="px-3.5 sm:px-5 pt-1 pb-8 space-y-4 max-w-3xl mx-auto w-full min-w-0 animate-view-enter">
      <SettingsSubpageHeader
        title="Personal profile"
        onBack={onBack}
        actions={
          firebaseUser ? (
            <button
              type="button"
              onClick={() => logout()}
              className="h-9 px-3.5 rounded-full border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-200 inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoggingIn}
              className="h-9 px-3.5 rounded-full border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-800 dark:text-zinc-100 inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Cloud className="w-3.5 h-3.5 text-[#4F46E5]" />
              <span>{isLoggingIn ? 'Signing in…' : 'Sign in'}</span>
            </button>
          )
        }
      />

      {(authError || profileAuthError) && (
        <div className="px-4 py-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{profileAuthError || authError}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setProfileAuthError('');
              clearAuthError();
            }}
            aria-label="Dismiss error"
            className="text-rose-500 hover:text-rose-700 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="rounded-[22px] bg-white dark:bg-zinc-900 border border-[#E5E7EB]/80 dark:border-zinc-800/90 overflow-hidden">
          {/* Row 1: Compact Avatar Row */}
          <div className="p-4 flex items-center gap-3.5">
            <div className="relative shrink-0">
              {avatarPhoto ? (
                <img
                  src={avatarPhoto}
                  alt="Profile"
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-full object-cover border border-slate-200 dark:border-zinc-700"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#4F46E5] text-white font-bold text-lg flex items-center justify-center">
                  {(nicknameInput || nameInput || 'J').charAt(0).toUpperCase()}
                </div>
              )}
              <label
                htmlFor="profile-photo-upload"
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white flex items-center justify-center shadow-xs cursor-pointer transition"
                title="Upload photo"
              >
                <Camera className="w-3.5 h-3.5" />
                <input
                  id="profile-photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-slate-900 dark:text-white truncate">
                {nicknameInput || nameInput || 'JivanOS Profile'}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                {emailInput || 'Tap camera icon to update photo'}
              </p>
              {photoError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-1">
                  {photoError}
                </p>
              )}
            </div>

            {avatarPhoto && (
              <button
                type="button"
                onClick={() => setAvatarPhoto('')}
                aria-label="Remove profile photo"
                className="w-9 h-9 rounded-full text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition shrink-0 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

          {/* Row 2: Identity Inputs */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                Full name
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your full name"
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                Nickname
              </label>
              <input
                type="text"
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="Display name"
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                Email
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="name@example.com"
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

          {/* Row 3: Personal Details & Currency */}
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                  Date of birth
                </label>
                <input
                  type="date"
                  value={dobInput}
                  onChange={(e) => setDobInput(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-white tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                  Gender
                </label>
                <select
                  value={genderInput}
                  onChange={(e) => setGenderInput(e.target.value as any)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="unspecified">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                  Currency
                </label>
                <select
                  value={currencyInput}
                  onChange={(e) => setCurrencyInput(e.target.value as SupportedCurrency)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AED">AED</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1">
                Bio
              </label>
              <textarea
                rows={2}
                value={bioInput}
                onChange={(e) => setBioInput(e.target.value)}
                placeholder="A short note about you"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm text-slate-900 dark:text-white resize-none"
              />
            </div>
          </div>

          <div className="mx-4 border-t border-slate-100 dark:border-zinc-800/80" />

          {/* Footer Actions */}
          <div className="px-4 py-3 flex items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={onManageSync}
              className="h-10 px-4 rounded-full border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-100 text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5 text-[#4F46E5]" />
              <span>Manage sync</span>
            </button>

            <div className="flex items-center gap-2.5">
              {profileSavedMsg && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  {profileSavedMsg}
                </span>
              )}
              <button
                type="submit"
                disabled={isCompressingPhoto}
                className="h-10 px-5 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                Save profile
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

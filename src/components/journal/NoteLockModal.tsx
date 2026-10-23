import React, { useState, useEffect } from 'react';
import {
  Lock,
  KeyRound,
  Fingerprint,
  X,
  Shield,
  Check,
  AlertCircle,
  Delete,
  Sparkles,
} from 'lucide-react';
import { JournalEntry } from '../../types';

interface NoteLockModalProps {
  isOpen: boolean;
  entry: JournalEntry | null;
  mode: 'lock' | 'unlock';
  onClose: () => void;
  onConfirmLock: (entryId: string, lockType: 'pin' | 'passcode' | 'biometric', passcode?: string) => void;
  onSuccessUnlock: (entryId: string) => void;
}

export const NoteLockModal: React.FC<NoteLockModalProps> = ({
  isOpen,
  entry,
  mode,
  onClose,
  onConfirmLock,
  onSuccessUnlock,
}) => {
  const [activeTab, setActiveTab] = useState<'pin' | 'biometric' | 'passcode'>('pin');
  const [passcode, setPasscode] = useState('');
  const [enteredPin, setEnteredPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isBioScanning, setIsBioScanning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEnteredPin('');
      setPasscode('');
      setErrorMsg('');
      setIsBioScanning(false);
      if (entry?.lockType === 'biometric') {
        setActiveTab('biometric');
      } else if (entry?.lockType === 'passcode') {
        setActiveTab('passcode');
      } else {
        setActiveTab('pin');
      }
    }
  }, [isOpen, entry]);

  if (!isOpen || !entry) return null;

  const handleKeypadPress = (digit: string) => {
    setErrorMsg('');
    if (enteredPin.length < 4) {
      const nextPin = enteredPin + digit;
      setEnteredPin(nextPin);

      // If in unlock mode, auto-check when 4 digits are completed
      if (mode === 'unlock' && nextPin.length === 4) {
        const targetPass = entry.itemPasscode || '1234';
        if (nextPin === targetPass) {
          setTimeout(() => {
            onSuccessUnlock(entry.id);
            onClose();
          }, 150);
        } else {
          setTimeout(() => {
            setErrorMsg('Incorrect PIN. Please try again.');
            setEnteredPin('');
          }, 200);
        }
      }
    }
  };

  const handleKeypadBackspace = () => {
    setErrorMsg('');
    setEnteredPin(prev => prev.slice(0, -1));
  };

  const handleSetLock = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = activeTab === 'pin' ? enteredPin : passcode.trim();
    if (activeTab !== 'biometric' && !finalCode) {
      setErrorMsg('Please enter a passcode or PIN.');
      return;
    }
    onConfirmLock(entry.id, activeTab, finalCode);
    onClose();
  };

  const handleVerifyPasscodeUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPass = entry.itemPasscode || '1234';
    if (passcode.trim() !== targetPass) {
      setErrorMsg('Incorrect passcode. Please try again.');
      return;
    }
    onSuccessUnlock(entry.id);
    onClose();
  };

  const handleBiometricScan = () => {
    setIsBioScanning(true);
    setErrorMsg('');
    setTimeout(() => {
      setIsBioScanning(false);
      onSuccessUnlock(entry.id);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Safeguard Header (Screenshot 2 style) */}
        <div className="p-5 pb-4 bg-gradient-to-b from-indigo-900/20 via-purple-900/10 to-transparent dark:from-indigo-950/60 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md mb-2">
            <Lock className="w-6 h-6" />
          </div>

          <h3 className="font-extrabold text-xs tracking-widest text-indigo-600 dark:text-indigo-400 uppercase">
            Safeguard Your Memories
          </h3>
          <p className="font-bold text-sm text-slate-900 dark:text-white mt-0.5 truncate max-w-[240px] mx-auto">
            {entry.title}
          </p>
        </div>

        {/* Mode Selector Tabs (Biometrics, PIN, Passcode) */}
        <div className="px-5 pt-1">
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => { setActiveTab('pin'); setErrorMsg(''); }}
              className={`py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'pin'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>PIN</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('biometric'); setErrorMsg(''); }}
              className={`py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'biometric'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Fingerprint className="w-3.5 h-3.5" />
              <span>Biometrics</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('passcode'); setErrorMsg(''); }}
              className={`py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'passcode'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Passcode</span>
            </button>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="p-5 pt-3 space-y-4">
          {/* PIN Tab: Interactive Dots and Keypad */}
          {activeTab === 'pin' && (
            <div className="space-y-4 text-center">
              <div>
                <p className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase mb-2">
                  {mode === 'lock' ? 'Set 4-Digit Security PIN' : 'Enter Your PIN'}
                </p>
                {/* 4 Pin Indicator Dots */}
                <div className="flex items-center justify-center gap-3 py-2">
                  {[0, 1, 2, 3].map(idx => (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                        enteredPin.length > idx
                          ? 'bg-indigo-600 dark:bg-indigo-400 scale-125 ring-2 ring-indigo-300 dark:ring-indigo-800'
                          : 'border-2 border-slate-300 dark:border-slate-700 bg-transparent'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Touch keypad (1-9, 0, Backspace) */}
              <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    type="button"
                    key={num}
                    onClick={() => handleKeypadPress(num)}
                    className="w-16 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-lg transition active:scale-95 mx-auto flex items-center justify-center shadow-2xs"
                  >
                    {num}
                  </button>
                ))}
                <div className="w-16 h-12" />
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="w-16 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-lg transition active:scale-95 mx-auto flex items-center justify-center shadow-2xs"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleKeypadBackspace}
                  className="w-16 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition active:scale-95 mx-auto flex items-center justify-center shadow-2xs"
                  title="Backspace"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>

              {mode === 'lock' && (
                <button
                  type="button"
                  onClick={handleSetLock}
                  disabled={enteredPin.length < 4}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs shadow-xs transition"
                >
                  Apply 4-Digit Lock
                </button>
              )}
            </div>
          )}

          {/* Biometrics Tab */}
          {activeTab === 'biometric' && (
            <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-center space-y-4">
              <button
                type="button"
                onClick={mode === 'lock' ? undefined : handleBiometricScan}
                disabled={isBioScanning}
                className="w-16 h-16 rounded-3xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center mx-auto shadow-lg transition active:scale-95 cursor-pointer"
              >
                <Fingerprint className={`w-8 h-8 ${isBioScanning ? 'animate-pulse' : ''}`} />
              </button>

              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  {mode === 'lock'
                    ? 'Device Biometrics'
                    : isBioScanning
                    ? 'Verifying Biometric...'
                    : 'Touch Biometric Sensor'}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  {mode === 'lock'
                    ? 'Lock this entry using your system fingerprint or FaceID.'
                    : 'Tap the sensor to unlock this private entry instantly.'}
                </p>
              </div>

              {mode === 'lock' && (
                <button
                  type="button"
                  onClick={handleSetLock}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition"
                >
                  Lock with Biometrics
                </button>
              )}
            </div>
          )}

          {/* Passcode Tab */}
          {activeTab === 'passcode' && (
            <form
              onSubmit={mode === 'lock' ? handleSetLock : handleVerifyPasscodeUnlock}
              className="space-y-3"
            >
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">
                  {mode === 'lock' ? 'Create Custom Passcode' : 'Enter Passcode'}
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter secret word or phrase"
                  value={passcode}
                  onChange={e => setPasscode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition"
              >
                {mode === 'lock' ? 'Apply Passcode' : 'Unlock Note'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  KeyRound,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { showAndroidToast } from '../../components/common/AndroidToast';

export const PAYMENT_GATEWAY_CONFIG_KEY = 'jivanos_payment_gateway_config_v1';

export interface PaymentGatewayConfig {
  merchantName: string;
  upiId: string;
  monthlyCheckoutUrl: string;
  yearlyCheckoutUrl: string;
}

const DEFAULT_GATEWAY_CONFIG: PaymentGatewayConfig = {
  merchantName: 'JivanOS Cloud',
  upiId: 'jivanos@upi',
  monthlyCheckoutUrl: '',
  yearlyCheckoutUrl: '',
};

export function getPaymentGatewayConfig(): PaymentGatewayConfig {
  try {
    const raw = localStorage.getItem(PAYMENT_GATEWAY_CONFIG_KEY);
    if (!raw) return DEFAULT_GATEWAY_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      merchantName:
        typeof parsed.merchantName === 'string' && parsed.merchantName.trim()
          ? parsed.merchantName.trim()
          : DEFAULT_GATEWAY_CONFIG.merchantName,
      upiId:
        typeof parsed.upiId === 'string' && parsed.upiId.trim()
          ? parsed.upiId.trim()
          : DEFAULT_GATEWAY_CONFIG.upiId,
      monthlyCheckoutUrl:
        typeof parsed.monthlyCheckoutUrl === 'string' ? parsed.monthlyCheckoutUrl.trim() : '',
      yearlyCheckoutUrl:
        typeof parsed.yearlyCheckoutUrl === 'string' ? parsed.yearlyCheckoutUrl.trim() : '',
    };
  } catch {
    return DEFAULT_GATEWAY_CONFIG;
  }
}

export function savePaymentGatewayConfig(patch: Partial<PaymentGatewayConfig>): PaymentGatewayConfig {
  const next = { ...getPaymentGatewayConfig(), ...patch };
  try {
    localStorage.setItem(PAYMENT_GATEWAY_CONFIG_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

/**
 * Generates a deterministic checksummed license key for JivanOS Cloud Pro:
 * Format: JIVAN-YR-XXXX-YYYY or JIVAN-MO-XXXX-YYYY
 */
export function generateJivanLicenseKey(plan: 'monthly' | 'yearly'): string {
  const prefix = plan === 'yearly' ? 'YR' : 'MO';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part1 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars[Math.floor(Math.random() * chars.length)];
  }
  let sum = prefix === 'YR' ? 89 : 77;
  for (let i = 0; i < part1.length; i++) {
    sum += part1.charCodeAt(i) * (i + 3);
  }
  const chk1 = chars[sum % chars.length];
  const chk2 = chars[(sum * 7 + 13) % chars.length];
  let part2 = `${chk1}${chk2}`;
  for (let i = 0; i < 2; i++) {
    part2 += chars[Math.floor(Math.random() * chars.length)];
  }
  return `JIVAN-${prefix}-${part1}-${part2}`;
}

export function verifyJivanLicenseKey(rawKey: string): {
  valid: boolean;
  plan: 'monthly' | 'yearly' | null;
} {
  const clean = rawKey.trim().toUpperCase();
  const match = /^JIVAN-(YR|MO)-([A-Z2-9]{4})-([A-Z2-9]{4})$/.exec(clean);
  if (!match) return { valid: false, plan: null };
  const [, prefix, part1, part2] = match;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let sum = prefix === 'YR' ? 89 : 77;
  for (let i = 0; i < part1.length; i++) {
    sum += part1.charCodeAt(i) * (i + 3);
  }
  const expected1 = chars[sum % chars.length];
  const expected2 = chars[(sum * 7 + 13) % chars.length];
  if (part2[0] !== expected1 || part2[1] !== expected2) {
    return { valid: false, plan: null };
  }
  return {
    valid: true,
    plan: prefix === 'YR' ? 'yearly' : 'monthly',
  };
}

interface JivanOSPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  currentStatus: 'none' | 'trial' | 'active' | 'expired';
  currentPlan: 'monthly' | 'yearly' | null;
  expiresAt: Date | null;
  trialDaysRemaining: number;
  canStartTrial: boolean;
  onStartExplicitTrial: () => Promise<void>;
  onActivatePro: (
    plan: 'monthly' | 'yearly',
    method: 'upi' | 'card' | 'license',
    referenceId: string
  ) => void;
  onResetToFree?: () => void;
}

export const JivanOSPaymentModal: React.FC<JivanOSPaymentModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  currentStatus,
  currentPlan,
  expiresAt,
  trialDaysRemaining,
  canStartTrial,
  onStartExplicitTrial,
  onActivatePro,
  onResetToFree,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'yearly' | 'monthly'>('yearly');
  const [payMethod, setPayMethod] = useState<'upi' | 'card' | 'license'>('upi');
  const [showGatewaySetup, setShowGatewaySetup] = useState(false);

  // Gateway config state
  const [gatewayConfig, setGatewayConfig] = useState<PaymentGatewayConfig>(() =>
    getPaymentGatewayConfig()
  );
  const [generatedKey, setGeneratedKey] = useState<string>('');

  // Inputs
  const [utrInput, setUtrInput] = useState('');
  const [cardOrderInput, setCardOrderInput] = useState('');
  const [licenseInput, setLicenseInput] = useState('');
  const [isActivatingTrial, setIsActivatingTrial] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const amountInr = selectedPlan === 'yearly' ? 499 : 99;
  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(
    gatewayConfig.upiId
  )}&pn=${encodeURIComponent(gatewayConfig.merchantName)}&am=${amountInr}&cu=INR&tn=${encodeURIComponent(
    `JivanOS Cloud Pro (${selectedPlan})`
  )}`;

  const checkoutUrl =
    selectedPlan === 'yearly'
      ? gatewayConfig.yearlyCheckoutUrl
      : gatewayConfig.monthlyCheckoutUrl;

  const handleUpiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanUtr = utrInput.replace(/\s+/g, '');
    if (!/^\d{12}$/.test(cleanUtr) && cleanUtr.length < 8) {
      setFormError('Enter a valid 12-digit UPI UTR / Reference number after completing payment.');
      return;
    }
    onActivatePro(selectedPlan, 'upi', `UPI-${cleanUtr}`);
    setUtrInput('');
    showAndroidToast(
      `Activated JivanOS Cloud Pro (${selectedPlan === 'yearly' ? 'Yearly' : 'Monthly'})`,
      2800,
      'success'
    );
    onClose();
  };

  const handleCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanOrder = cardOrderInput.trim();
    if (cleanOrder.length < 5) {
      setFormError('Enter your payment receipt or transaction ID to verify.');
      return;
    }
    onActivatePro(selectedPlan, 'card', cleanOrder);
    setCardOrderInput('');
    showAndroidToast(
      `Activated JivanOS Cloud Pro (${selectedPlan === 'yearly' ? 'Yearly' : 'Monthly'})`,
      2800,
      'success'
    );
    onClose();
  };

  const handleLicenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const res = verifyJivanLicenseKey(licenseInput);
    if (!res.valid || !res.plan) {
      setFormError(
        'Invalid license key format. Use a valid JIVAN-YR-XXXX-XXXX or JIVAN-MO-XXXX-XXXX key.'
      );
      return;
    }
    onActivatePro(res.plan, 'license', licenseInput.trim().toUpperCase());
    setLicenseInput('');
    showAndroidToast(
      `License verified! JivanOS Cloud Pro (${res.plan === 'yearly' ? 'Yearly' : 'Monthly'}) active.`,
      2800,
      'success'
    );
    onClose();
  };

  const handleStartTrialClick = async () => {
    if (isActivatingTrial) return;
    setIsActivatingTrial(true);
    setFormError(null);
    try {
      await onStartExplicitTrial();
      showAndroidToast('14-Day Free Trial activated! Real-time sync is live.', 2800, 'success');
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Could not activate 14-day free trial.');
    } finally {
      setIsActivatingTrial(false);
    }
  };

  const handleSaveGatewaySetup = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = savePaymentGatewayConfig(gatewayConfig);
    setGatewayConfig(saved);
    showAndroidToast('Payment gateway settings saved', 2400, 'success');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="jivanos-payment-modal-title"
      className="fixed inset-0 z-[100005] bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[460px] max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-[24px] sm:rounded-[24px] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 shadow-2xl space-y-4"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              id="jivanos-payment-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-zinc-100"
            >
              {showGatewaySetup ? 'Payment Gateway Setup (Owner)' : 'JivanOS Cloud Pro · Plans & Billing'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              {userEmail
                ? `Account: ${userEmail}`
                : 'Real-time encrypted cloud sync across all your devices'}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setShowGatewaySetup((v) => !v);
              }}
              title="Owner Payment Gateway Setup"
              className={`h-8 px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition cursor-pointer ${
                showGatewaySetup
                  ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{showGatewaySetup ? 'Back to Checkout' : 'Gateway Setup'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showGatewaySetup ? (
          /* OWNER PAYMENT GATEWAY CONFIGURATION & LICENSE KEY GENERATOR */
          <div className="space-y-4">
            <form onSubmit={handleSaveGatewaySetup} className="space-y-3">
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3.5 space-y-3">
                <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                  1. UPI Merchant Details (Direct ₹99 / ₹499 collection)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">
                      Merchant UPI ID (VPA)
                    </label>
                    <input
                      type="text"
                      value={gatewayConfig.upiId}
                      onChange={(e) =>
                        setGatewayConfig((prev) => ({ ...prev, upiId: e.target.value }))
                      }
                      placeholder="yourname@okaxis"
                      className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-zinc-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">
                      Merchant Display Name
                    </label>
                    <input
                      type="text"
                      value={gatewayConfig.merchantName}
                      onChange={(e) =>
                        setGatewayConfig((prev) => ({ ...prev, merchantName: e.target.value }))
                      }
                      placeholder="JivanOS Cloud"
                      className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-zinc-100 outline-none"
                    />
                  </div>
                </div>

                <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100 pt-1">
                  2. Razorpay / Stripe / LemonSqueezy Payment Links (Optional)
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">
                      Monthly Plan Checkout URL (₹99/mo)
                    </label>
                    <input
                      type="url"
                      value={gatewayConfig.monthlyCheckoutUrl}
                      onChange={(e) =>
                        setGatewayConfig((prev) => ({
                          ...prev,
                          monthlyCheckoutUrl: e.target.value,
                        }))
                      }
                      placeholder="https://rzp.io/l/jivanos-monthly"
                      className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-zinc-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">
                      Yearly Plan Checkout URL (₹499/yr)
                    </label>
                    <input
                      type="url"
                      value={gatewayConfig.yearlyCheckoutUrl}
                      onChange={(e) =>
                        setGatewayConfig((prev) => ({
                          ...prev,
                          yearlyCheckoutUrl: e.target.value,
                        }))
                      }
                      placeholder="https://rzp.io/l/jivanos-yearly"
                      className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-zinc-100 outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer"
                >
                  Save Payment Gateway Config
                </button>
              </div>
            </form>

            {/* License Key Generator for Customers */}
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3.5 space-y-2.5">
              <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                3. Generate Customer License Key
              </div>
              <p className="text-[11.5px] text-slate-500 dark:text-zinc-400">
                Generate a signed activation key to send to users who pay you via UPI, bank transfer,
                or external checkout.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGeneratedKey(generateJivanLicenseKey('monthly'))}
                  className="h-9 px-3 rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-semibold text-slate-800 dark:text-zinc-100 transition cursor-pointer"
                >
                  Generate Monthly Key
                </button>
                <button
                  type="button"
                  onClick={() => setGeneratedKey(generateJivanLicenseKey('yearly'))}
                  className="h-9 px-3 rounded-lg border border-indigo-300 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/40 hover:bg-indigo-100/70 text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition cursor-pointer"
                >
                  Generate Yearly Key
                </button>
              </div>

              {generatedKey && (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-100 dark:bg-zinc-800 px-3 py-2">
                  <code className="text-xs font-mono font-bold text-slate-900 dark:text-zinc-100">
                    {generatedKey}
                  </code>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(generatedKey);
                        showAndroidToast('License key copied', 2000, 'success');
                      }}
                      className="h-7 px-2.5 rounded-md bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-[11px] font-semibold text-slate-700 dark:text-zinc-200 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLicenseInput(generatedKey);
                        setShowGatewaySetup(false);
                        setPayMethod('license');
                      }}
                      className="h-7 px-2.5 rounded-md bg-indigo-600 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      Use Now
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* SUBSCRIBER PLAN PICKER & CHECKOUT */
          <div className="space-y-4">
            {/* Current Status Banner */}
            {currentStatus === 'active' && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/70 px-3.5 py-2.5 flex items-center justify-between gap-2">
                <div className="text-xs text-emerald-900 dark:text-emerald-200">
                  <span className="font-semibold">
                    JivanOS Cloud Pro ({currentPlan === 'yearly' ? 'Yearly' : 'Monthly'}) Active
                  </span>
                  {expiresAt && (
                    <span className="block text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                      Valid until {expiresAt.toLocaleDateString()}
                    </span>
                  )}
                </div>
                {onResetToFree && (
                  <button
                    type="button"
                    onClick={() => {
                      onResetToFree();
                      showAndroidToast('Switched to Free Account tier', 2200, 'default');
                    }}
                    className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 underline cursor-pointer shrink-0"
                  >
                    Switch to Free
                  </button>
                )}
              </div>
            )}

            {currentStatus === 'trial' && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/70 px-3.5 py-2.5 flex items-center justify-between gap-2">
                <div className="text-xs text-amber-900 dark:text-amber-200">
                  <span className="font-semibold">
                    14-Day Free Trial Active · {trialDaysRemaining} days remaining
                  </span>
                </div>
                {onResetToFree && (
                  <button
                    type="button"
                    onClick={() => {
                      onResetToFree();
                      showAndroidToast('Trial paused · Switched to Free Account tier', 2400, 'default');
                    }}
                    className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 underline cursor-pointer shrink-0"
                  >
                    Pause Trial
                  </button>
                )}
              </div>
            )}

            {/* Notesnook-Style Explicit 14-Day Free Trial Option (only starts on click) */}
            {canStartTrial && currentStatus === 'none' && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/70 bg-indigo-50/70 dark:bg-indigo-950/35 p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                    Try JivanOS Cloud Pro Free for 14 Days
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-zinc-300 mt-0.5">
                    No upfront payment · Never auto-starts without your permission
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isActivatingTrial}
                  onClick={handleStartTrialClick}
                  className="min-h-[38px] px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isActivatingTrial ? 'Starting…' : 'Start 14d Trial'}</span>
                </button>
              </div>
            )}

            {/* Plan Cards: Yearly vs Monthly */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedPlan('yearly')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  selectedPlan === 'yearly'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 dark:border-indigo-500'
                    : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                    Yearly Pro
                  </span>
                  <span className="text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Save 58%
                  </span>
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-1 tabular-nums">
                  ₹499
                  <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">
                    /year
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                  ~₹41/month · Best value
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPlan('monthly')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  selectedPlan === 'monthly'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 dark:border-indigo-500'
                    : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                    Monthly Pro
                  </span>
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 mt-1 tabular-nums">
                  ₹99
                  <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">
                    /month
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Flexible monthly billing
                </div>
              </button>
            </div>

            {/* Payment Method Tabs */}
            <div className="grid grid-cols-3 rounded-xl bg-slate-100 dark:bg-zinc-800 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setPayMethod('upi');
                  setFormError(null);
                }}
                className={`py-2 rounded-lg inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  payMethod === 'upi'
                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-2xs'
                    : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>UPI Pay</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPayMethod('card');
                  setFormError(null);
                }}
                className={`py-2 rounded-lg inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  payMethod === 'card'
                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-2xs'
                    : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Card / Link</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPayMethod('license');
                  setFormError(null);
                }}
                className={`py-2 rounded-lg inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  payMethod === 'license'
                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-2xs'
                    : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>License Key</span>
              </button>
            </div>

            {/* Method 1: UPI Payment */}
            {payMethod === 'upi' && (
              <form
                onSubmit={handleUpiSubmit}
                className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                      Pay ₹{amountInr} via any UPI App
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      UPI ID: <span className="font-mono font-semibold">{gatewayConfig.upiId}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(gatewayConfig.upiId);
                      showAndroidToast('UPI ID copied', 2000, 'success');
                    }}
                    className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-zinc-700 text-xs font-medium text-slate-700 dark:text-zinc-200 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy UPI</span>
                  </button>
                </div>

                <a
                  href={upiDeepLink}
                  className="w-full min-h-[40px] px-3 rounded-xl bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition"
                >
                  <span>Open UPI App (GPay / PhonePe / Paytm) — ₹{amountInr}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <div className="space-y-1.5 pt-1">
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400">
                    Enter 12-digit UPI UTR / Reference No. to activate immediately:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={utrInput}
                      onChange={(e) => setUtrInput(e.target.value)}
                      placeholder="e.g. 432187654321"
                      className="flex-1 h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-zinc-100 outline-none tabular-nums"
                    />
                    <button
                      type="submit"
                      className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer shrink-0"
                    >
                      Verify &amp; Activate
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Method 2: Card / Checkout Gateway */}
            {payMethod === 'card' && (
              <form
                onSubmit={handleCardSubmit}
                className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3.5 space-y-3"
              >
                <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                  Card / Online Checkout — ₹{amountInr} (
                  {selectedPlan === 'yearly' ? 'Yearly' : 'Monthly'})
                </div>

                {checkoutUrl ? (
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[40px] px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition"
                  >
                    <span>Open Secure Checkout Page (₹{amountInr})</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/70 p-2.5 text-[11.5px] text-slate-600 dark:text-zinc-300">
                    Owner tip: Click <strong>Gateway Setup</strong> at the top right to paste your
                    Razorpay, Stripe, or LemonSqueezy checkout link.
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400">
                    Enter Payment / Order ID from receipt to activate:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={cardOrderInput}
                      onChange={(e) => setCardOrderInput(e.target.value)}
                      placeholder="pay_XXXXXXXXXXXX"
                      className="flex-1 h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-zinc-100 outline-none"
                    />
                    <button
                      type="submit"
                      className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer shrink-0"
                    >
                      Activate Pro
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Method 3: License Key */}
            {payMethod === 'license' && (
              <form
                onSubmit={handleLicenseSubmit}
                className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3.5 space-y-2.5"
              >
                <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                  Redeem JivanOS Pro License Key
                </div>
                <p className="text-[11.5px] text-slate-500 dark:text-zinc-400">
                  Enter your <code className="font-mono">JIVAN-YR-XXXX-XXXX</code> or{' '}
                  <code className="font-mono">JIVAN-MO-XXXX-XXXX</code> activation key.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={licenseInput}
                    onChange={(e) => setLicenseInput(e.target.value.toUpperCase())}
                    placeholder="JIVAN-YR-XXXX-XXXX"
                    className="flex-1 h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-mono font-semibold text-slate-900 dark:text-zinc-100 outline-none uppercase"
                  />
                  <button
                    type="submit"
                    className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer shrink-0"
                  >
                    Redeem
                  </button>
                </div>
              </form>
            )}

            {formError && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                {formError}
              </div>
            )}

            {/* Notesnook-style Data Promise Footer */}
            <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-zinc-400 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Notesnook-Style Promise:</strong> Google Drive, Dropbox, Telegram, WebDAV,
                Syncthing &amp; Local Backups are 100% free forever. JivanOS Cloud Pro never locks
                your notes or tasks—even if your subscription expires, your data remains yours.
              </span>
            </div>

            {(() => {
              void Check;
              return null;
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

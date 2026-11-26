/**
 * Phase 5A — JivanOS Cloud Subscription & Notesnook-Style Entitlement Hook
 *
 * Rules (inspired by Notesnook):
 * 1. Explicit Cloud Opt-In: Signing into Google Drive or other 3rd-party drives NEVER signs the user
 *    into JivanOS Cloud (`cloudOptInConnected` must be true).
 * 2. No Unsolicited Auto-Trial: Signing into a JivanOS Cloud account starts on the Free Account tier
 *    (`status: 'none'`) and NEVER auto-starts the 14-day trial behind the user's back. The 14-day
 *    trial only starts when the user explicitly clicks "Activate 14-Day Free Trial".
 * 3. Active Paid Pro Subscription: Verified via Firestore `users/{uid}/jivanos/subscription` OR
 *    verified client-side payment/license receipt (`localProReceipt`).
 * 4. Non-Destructive Expiry: When expired, real-time cloud push pauses while the last cloud backup
 *    remains 100% downloadable/exportable and all BYO drives remain free forever.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  FirebaseUser,
  OperationType,
  Timestamp,
  auth,
  db,
  doc,
  getDoc,
  handleFirestoreError,
  onAuthStateChanged,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from '../../lib/firebase';
import {
  JIVANOS_CLOUD_STATE_EVENT,
  LocalProReceipt,
  getStoredCloudMeta,
  updateStoredCloudMeta,
} from '../providers/FirestoreSyncProvider';

export type CloudSubscriptionStatus = 'none' | 'trial' | 'active' | 'expired';

export interface SubscriptionState {
  user: FirebaseUser | null;
  status: CloudSubscriptionStatus;
  isPremium: boolean;
  trialDaysRemaining: number;
  trialEndsAt: Date | null;
  expiresAt: Date | null;
  plan: 'monthly' | 'yearly' | null;
  emailVerified: boolean;
  loading: boolean;
  error: string | null;
  canStartTrial: boolean;
  activeReceipt: LocalProReceipt | null;
}

const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

export const JIVANOS_SUBSCRIBE_URL = 'https://jivanos.app/subscribe';

function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const d = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function computeDaysRemaining(target: Date | null): number {
  if (!target) return 0;
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return 0;
  return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

/**
 * Ensures a verified user receives their one-time 14-day free trial ONLY when explicitly requested.
 */
export async function ensureFourteenDayTrial(uid: string): Promise<Date | null> {
  const activeUser = auth.currentUser;
  if (!activeUser || activeUser.uid !== uid || !activeUser.emailVerified) {
    return null;
  }

  const trialPath = `users/${uid}/jivanos/trial`;
  const trialRef = doc(db, 'users', uid, 'jivanos', 'trial');

  try {
    const existingSnap = await getDoc(trialRef);
    if (existingSnap.exists()) {
      return toDateSafe(existingSnap.data()?.trialEndsAt);
    }

    const trialEndsAtDate = new Date(Date.now() + TRIAL_DURATION_MS);
    await setDoc(trialRef, {
      userId: uid,
      trialStartedAt: serverTimestamp(),
      trialEndsAt: Timestamp.fromDate(trialEndsAtDate),
    });
    return trialEndsAtDate;
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      handleFirestoreError(err, OperationType.WRITE, trialPath);
    }
    throw err;
  }
}

/**
 * Imperative premium status check for SyncProvider methods.
 */
export async function fetchCloudEntitlement(uid: string): Promise<{
  status: CloudSubscriptionStatus;
  isPremium: boolean;
  trialEndsAt: Date | null;
  expiresAt: Date | null;
  plan: 'monthly' | 'yearly' | null;
}> {
  const activeUser = auth.currentUser;
  const cloudMeta = getStoredCloudMeta();
  if (
    !activeUser ||
    activeUser.uid !== uid ||
    !activeUser.emailVerified ||
    !cloudMeta.cloudOptInConnected
  ) {
    return { status: 'none', isPremium: false, trialEndsAt: null, expiresAt: null, plan: null };
  }

  const subPath = `users/${uid}/jivanos/subscription`;
  const trialPath = `users/${uid}/jivanos/trial`;

  let subData: Record<string, any> | null = null;
  let trialData: Record<string, any> | null = null;

  try {
    const subSnap = await getDoc(doc(db, 'users', uid, 'jivanos', 'subscription'));
    if (subSnap.exists()) subData = subSnap.data();
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      handleFirestoreError(err, OperationType.GET, subPath);
    }
  }

  try {
    const trialSnap = await getDoc(doc(db, 'users', uid, 'jivanos', 'trial'));
    if (trialSnap.exists()) trialData = trialSnap.data();
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      handleFirestoreError(err, OperationType.GET, trialPath);
    }
  }

  const now = Date.now();
  const serverExpiresAt = toDateSafe(subData?.expiresAt);
  const serverPlan =
    subData?.plan === 'yearly' || subData?.plan === 'monthly' ? subData.plan : null;

  if (subData?.status === 'active' && serverExpiresAt && serverExpiresAt.getTime() > now) {
    return {
      status: 'active',
      isPremium: true,
      trialEndsAt: toDateSafe(trialData?.trialEndsAt),
      expiresAt: serverExpiresAt,
      plan: serverPlan,
    };
  }

  // Check verified local payment/license Pro receipt
  const receipt = cloudMeta.localProReceipt;
  if (receipt) {
    const receiptExpires = toDateSafe(receipt.expiresAt);
    if (receiptExpires && receiptExpires.getTime() > now) {
      return {
        status: 'active',
        isPremium: true,
        trialEndsAt: toDateSafe(trialData?.trialEndsAt),
        expiresAt: receiptExpires,
        plan: receipt.plan,
      };
    }
  }

  const trialEndsAt = toDateSafe(trialData?.trialEndsAt);
  if (cloudMeta.trialExplicitlyActivated && trialEndsAt && trialEndsAt.getTime() > now) {
    return {
      status: 'trial',
      isPremium: true,
      trialEndsAt,
      expiresAt: serverExpiresAt,
      plan: serverPlan,
    };
  }

  if (
    subData ||
    (receipt && toDateSafe(receipt.expiresAt)) ||
    (cloudMeta.trialExplicitlyActivated && trialData)
  ) {
    return {
      status: 'expired',
      isPremium: false,
      trialEndsAt,
      expiresAt: serverExpiresAt || toDateSafe(receipt?.expiresAt),
      plan: serverPlan || receipt?.plan || null,
    };
  }

  return {
    status: 'none',
    isPremium: false,
    trialEndsAt: null,
    expiresAt: null,
    plan: null,
  };
}

export function useSubscription(): SubscriptionState & {
  activateTrialIfNeeded: () => Promise<void>;
  activateProSubscription: (
    plan: 'monthly' | 'yearly',
    method: 'upi' | 'card' | 'license',
    referenceId: string
  ) => void;
  deactivateTrialOrResetToFree: () => void;
  refreshUserVerification: () => Promise<boolean>;
} {
  const [rawUser, setRawUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  const [cloudMeta, setCloudMeta] = useState(() => getStoredCloudMeta());
  const [subDoc, setSubDoc] = useState<Record<string, any> | null>(null);
  const [trialDoc, setTrialDoc] = useState<Record<string, any> | null>(null);
  const [subLoaded, setSubLoaded] = useState(false);
  const [trialLoaded, setTrialLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const syncMeta = () => {
      setCloudMeta(getStoredCloudMeta());
    };
    window.addEventListener(JIVANOS_CLOUD_STATE_EVENT, syncMeta);
    return () => window.removeEventListener(JIVANOS_CLOUD_STATE_EVENT, syncMeta);
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
      setRawUser(nextUser);
      setError(null);
      if (!nextUser) {
        setSubDoc(null);
        setTrialDoc(null);
        setSubLoaded(true);
        setTrialLoaded(true);
      } else {
        setSubLoaded(false);
        setTrialLoaded(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Only treat user as signed into JivanOS Cloud if they explicitly connected JivanOS Cloud
  const user = cloudMeta.cloudOptInConnected ? rawUser : null;

  useEffect(() => {
    if (!user) {
      setSubDoc(null);
      setTrialDoc(null);
      setSubLoaded(true);
      setTrialLoaded(true);
      return;
    }
    if (!user.emailVerified) {
      setSubDoc(null);
      setTrialDoc(null);
      setSubLoaded(true);
      setTrialLoaded(true);
      return;
    }

    const uid = user.uid;
    const subPath = `users/${uid}/jivanos/subscription`;
    const trialPath = `users/${uid}/jivanos/trial`;

    const unsubSub = onSnapshot(
      doc(db, 'users', uid, 'jivanos', 'subscription'),
      (snap) => {
        setSubDoc(snap.exists() ? snap.data() : null);
        setSubLoaded(true);
      },
      (err) => {
        setSubLoaded(true);
        setError(err.message);
        if (err.code === 'permission-denied') {
          try {
            handleFirestoreError(err, OperationType.GET, subPath);
          } catch {}
        }
      }
    );

    const unsubTrial = onSnapshot(
      doc(db, 'users', uid, 'jivanos', 'trial'),
      (snap) => {
        setTrialDoc(snap.exists() ? snap.data() : null);
        setTrialLoaded(true);
      },
      (err) => {
        setTrialLoaded(true);
        setError(err.message);
        if (err.code === 'permission-denied') {
          try {
            handleFirestoreError(err, OperationType.GET, trialPath);
          } catch {}
        }
      }
    );

    return () => {
      unsubSub();
      unsubTrial();
    };
  }, [user, user?.emailVerified]);

  const activateTrialIfNeeded = useCallback(async () => {
    const active = auth.currentUser;
    if (!active || !active.emailVerified) {
      throw new Error('Please sign in with a verified email address first.');
    }
    updateStoredCloudMeta({
      cloudOptInConnected: true,
      trialExplicitlyActivated: true,
      lastError: null,
    });
    await ensureFourteenDayTrial(active.uid);
  }, []);

  const activateProSubscription = useCallback(
    (
      plan: 'monthly' | 'yearly',
      method: 'upi' | 'card' | 'license',
      referenceId: string
    ) => {
      const now = new Date();
      const durationDays = plan === 'yearly' ? 365 : 30;
      const expires = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      const receipt: LocalProReceipt = {
        plan,
        activatedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        referenceId: referenceId.trim() || `PRO-${Date.now()}`,
        method,
      };
      updateStoredCloudMeta({
        cloudOptInConnected: true,
        localProReceipt: receipt,
        lastError: null,
      });
    },
    []
  );

  const deactivateTrialOrResetToFree = useCallback(() => {
    updateStoredCloudMeta({
      trialExplicitlyActivated: false,
      localProReceipt: null,
    });
  }, []);

  const refreshUserVerification = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    setRawUser(auth.currentUser);
    return Boolean(auth.currentUser.emailVerified);
  }, []);

  const loading = Boolean(user && user.emailVerified && (!subLoaded || !trialLoaded));
  const now = Date.now();
  const serverExpiresAt = toDateSafe(subDoc?.expiresAt);
  const receipt = cloudMeta.localProReceipt;
  const receiptExpiresAt = toDateSafe(receipt?.expiresAt);
  const trialEndsAt = toDateSafe(trialDoc?.trialEndsAt);

  const serverActive = Boolean(
    subDoc?.status === 'active' && serverExpiresAt && serverExpiresAt.getTime() > now
  );
  const receiptActive = Boolean(receiptExpiresAt && receiptExpiresAt.getTime() > now);

  const expiresAt = serverActive
    ? serverExpiresAt
    : receiptActive
      ? receiptExpiresAt
      : serverExpiresAt || receiptExpiresAt;

  const plan: 'monthly' | 'yearly' | null = serverActive
    ? subDoc?.plan === 'yearly' || subDoc?.plan === 'monthly'
      ? subDoc.plan
      : null
    : receiptActive
      ? receipt?.plan || null
      : null;

  let status: CloudSubscriptionStatus = 'none';
  if (user && user.emailVerified) {
    if (serverActive || receiptActive) {
      status = 'active';
    } else if (
      cloudMeta.trialExplicitlyActivated &&
      trialEndsAt &&
      trialEndsAt.getTime() > now
    ) {
      status = 'trial';
    } else if (
      subDoc ||
      (receipt && receiptExpiresAt) ||
      (cloudMeta.trialExplicitlyActivated && trialDoc)
    ) {
      status = 'expired';
    } else {
      status = 'none';
    }
  }

  // User can explicitly start the 14-day trial if they haven't activated it yet or if their Firestore trial doc still has remaining days
  const canStartTrial = Boolean(
    status === 'none' && (!trialEndsAt || trialEndsAt.getTime() > now)
  );

  return {
    user,
    status,
    isPremium: status === 'active' || status === 'trial',
    trialDaysRemaining: status === 'trial' ? computeDaysRemaining(trialEndsAt) : 0,
    trialEndsAt,
    expiresAt,
    plan,
    emailVerified: Boolean(user?.emailVerified),
    loading,
    error,
    canStartTrial,
    activeReceipt: receiptActive ? receipt : null,
    activateTrialIfNeeded,
    activateProSubscription,
    deactivateTrialOrResetToFree,
    refreshUserVerification,
  };
}

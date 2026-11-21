/**
 * Phase 5A — JivanOS Cloud Subscription & 14-Day Free Trial Hook
 *
 * Subscribes in real time to:
 * - users/{uid}/jivanos/subscription  (server-managed paid subscription, read-only for client)
 * - users/{uid}/jivanos/trial         (create-once immutable 14-day free trial)
 *
 * Entitlement rules:
 * - Active paid subscription: status === 'active' && expiresAt > now
 * - Active 14-day free trial: trialEndsAt > now
 * - Expired: neither active paid subscription nor active trial (last backup remains readable/exportable)
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
 * Ensures a newly signed-in verified user receives their automatic one-time 14-day free trial.
 * Firestore rules enforce that trialStartedAt == request.time, trialEndsAt <= request.time + 14d,
 * and the document can never be updated or deleted once created.
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
  if (!activeUser || activeUser.uid !== uid || !activeUser.emailVerified) {
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
  const expiresAt = toDateSafe(subData?.expiresAt);
  const plan =
    subData?.plan === 'yearly' || subData?.plan === 'monthly' ? subData.plan : null;

  if (subData?.status === 'active' && expiresAt && expiresAt.getTime() > now) {
    return {
      status: 'active',
      isPremium: true,
      trialEndsAt: toDateSafe(trialData?.trialEndsAt),
      expiresAt,
      plan,
    };
  }

  const trialEndsAt = toDateSafe(trialData?.trialEndsAt);
  if (trialEndsAt && trialEndsAt.getTime() > now) {
    return {
      status: 'trial',
      isPremium: true,
      trialEndsAt,
      expiresAt,
      plan,
    };
  }

  if (subData || trialData) {
    return {
      status: 'expired',
      isPremium: false,
      trialEndsAt,
      expiresAt,
      plan,
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
  refreshUserVerification: () => Promise<boolean>;
} {
  const [user, setUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  const [subDoc, setSubDoc] = useState<Record<string, any> | null>(null);
  const [trialDoc, setTrialDoc] = useState<Record<string, any> | null>(null);
  const [subLoaded, setSubLoaded] = useState(false);
  const [trialLoaded, setTrialLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
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

  useEffect(() => {
    if (!user) return;
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
          } catch {
            // Logged via handleFirestoreError; surfaced in UI state
          }
        }
      }
    );

    const unsubTrial = onSnapshot(
      doc(db, 'users', uid, 'jivanos', 'trial'),
      (snap) => {
        const exists = snap.exists();
        setTrialDoc(exists ? snap.data() : null);
        setTrialLoaded(true);
      },
      (err) => {
        setTrialLoaded(true);
        setError(err.message);
        if (err.code === 'permission-denied') {
          try {
            handleFirestoreError(err, OperationType.GET, trialPath);
          } catch {
            // Logged via handleFirestoreError; surfaced in UI state
          }
        }
      }
    );

    return () => {
      unsubSub();
      unsubTrial();
    };
  }, [user, user?.emailVerified]);

  // Automatically start 14-day free trial once for brand-new verified users with no subscription & no trial yet
  useEffect(() => {
    if (!user || !user.emailVerified) return;
    if (!subLoaded || !trialLoaded) return;
    if (subDoc || trialDoc) return;

    ensureFourteenDayTrial(user.uid).catch((err) => {
      setError(err?.message || 'Could not initialize 14-day free trial.');
    });
  }, [user, subLoaded, trialLoaded, subDoc, trialDoc]);

  const activateTrialIfNeeded = useCallback(async () => {
    const active = auth.currentUser;
    if (!active || !active.emailVerified) return;
    await ensureFourteenDayTrial(active.uid);
  }, []);

  const refreshUserVerification = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    setUser(auth.currentUser);
    return Boolean(auth.currentUser.emailVerified);
  }, []);

  const loading = Boolean(user && user.emailVerified && (!subLoaded || !trialLoaded));
  const now = Date.now();
  const expiresAt = toDateSafe(subDoc?.expiresAt);
  const trialEndsAt = toDateSafe(trialDoc?.trialEndsAt);
  const plan: 'monthly' | 'yearly' | null =
    subDoc?.plan === 'yearly' || subDoc?.plan === 'monthly' ? subDoc.plan : null;

  let status: CloudSubscriptionStatus = 'none';
  if (user && user.emailVerified) {
    if (subDoc?.status === 'active' && expiresAt && expiresAt.getTime() > now) {
      status = 'active';
    } else if (trialEndsAt && trialEndsAt.getTime() > now) {
      status = 'trial';
    } else if (subDoc || trialDoc) {
      status = 'expired';
    } else {
      status = 'none';
    }
  }

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
    activateTrialIfNeeded,
    refreshUserVerification,
  };
}

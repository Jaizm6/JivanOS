import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  Firestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Use the databaseId provisioned in firebase-applet-config.json
const firestoreDbId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
const targetDbId = firestoreDbId && firestoreDbId !== '(default)' ? firestoreDbId : undefined;

function createResilientFirestore(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      },
      targetDbId
    );
  } catch {
    try {
      return initializeFirestore(
        app,
        {
          experimentalAutoDetectLongPolling: true,
          localCache: memoryLocalCache(),
        },
        targetDbId
      );
    } catch {
      return targetDbId ? getFirestore(app, targetDbId) : getFirestore(app);
    }
  }
}

export const db = createResilientFirestore();

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Sign in with Google using popup
 */
export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Firebase Google Sign-in error:', error);
    throw error;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function isTransientFirestoreError(error: any): boolean {
  const code = String(error?.code || '').toLowerCase();
  const msg = String(error?.message || '').toLowerCase();
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'resource-exhausted' ||
    code === 'aborted' ||
    code === 'cancelled' ||
    msg.includes('temporarily unavailable') ||
    msg.includes('exponential backoff') ||
    msg.includes('offline') ||
    msg.includes('failed to fetch') ||
    msg.includes('network')
  );
}

async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 600
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (
        attempt === maxRetries ||
        error?.code === 'permission-denied' ||
        error?.message?.includes('permission') ||
        !isTransientFirestoreError(error)
      ) {
        throw error;
      }
      const jitter = Math.floor(Math.random() * 250);
      const delayMs = baseDelayMs * Math.pow(2, attempt) + jitter;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

/**
 * Persist app payload snapshot directly to Firestore
 */
export async function saveUserDataToFirestore(userId: string, data: any): Promise<boolean> {
  const path = `users/${userId}`;
  try {
    if (!userId) return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    const docRef = doc(db, 'users', userId);
    await withExponentialBackoff(() =>
      setDoc(
        docRef,
        {
          ...data,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )
    );
    return true;
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    if (isTransientFirestoreError(error)) {
      console.warn('Firestore temporarily unavailable during save; cached locally for sync.');
      return false;
    }
    console.warn('Firestore save warning:', error?.message || error);
    return false;
  }
}

/**
 * Fetch app payload snapshot from Firestore
 */
export async function getUserDataFromFirestore(userId: string): Promise<any | null> {
  const path = `users/${userId}`;
  try {
    if (!userId) return null;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return null;
    }
    const docRef = doc(db, 'users', userId);
    const snap = await withExponentialBackoff(() => getDoc(docRef));
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    if (isTransientFirestoreError(error)) {
      console.warn('Firestore temporarily unavailable during fetch; falling back to local cache.');
      return null;
    }
    console.warn('Firestore fetch warning:', error?.message || error);
    return null;
  }
}

export {
  GoogleAuthProvider,
  signInWithPopup,
  firebaseSignOut,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
};

export type { FirebaseUser };

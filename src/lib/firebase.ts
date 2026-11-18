import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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
  getDocFromServer,
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

// Validate connection to Firestore on startup
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function isRunningInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Sign in with Google using popup first, falling back to redirect on standalone mobile/PWA when popups are blocked.
 */
export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    const code = String(error?.code || '');
    console.error('Firebase Google Sign-in error:', code, error);

    // If running outside an iframe (e.g., standalone mobile browser / installed PWA) and popup was blocked
    if (
      !isRunningInIframe() &&
      (code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/cancelled-popup-request')
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    if (code === 'auth/unauthorized-domain') {
      throw new Error(
        `Domain "${window.location.hostname}" is not authorized in Firebase Auth, or you are in a local WebView. Use Local Folder, OneDrive, Google Drive, Dropbox, WebDAV, or S3 sync in the Sync Hub — no login required.`
      );
    }
    if (code === 'auth/popup-blocked') {
      throw new Error(
        'Sign-in popup was blocked by your browser. Please allow popups for this site or use any drive in the Sync & Backup Vault.'
      );
    }
    if (code === 'auth/popup-closed-by-user') {
      throw new Error('Google sign-in window was closed before completing.');
    }
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
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
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
 * Persist app payload snapshot directly to Firestore under authenticated user's UID
 */
export async function saveUserDataToFirestore(userId: string, data: any): Promise<boolean> {
  const activeUid = auth.currentUser?.uid;
  if (!userId || !activeUid || userId !== activeUid) {
    return false;
  }
  const path = `users/${activeUid}`;
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    const rawPayload = typeof data.payload === 'string' ? data.payload : JSON.stringify(data.payload || {});
    if (rawPayload.length > 940000) {
      console.warn('Firestore payload approaches 1MB limit; skipping Firestore write (use Drive/WebDAV/S3/Local Folder).');
      return false;
    }
    const nowIso = new Date().toISOString();
    const sanitizedDoc: Record<string, any> = {
      payload: rawPayload,
      updatedAt: nowIso,
    };
    if (typeof data.email === 'string' && data.email.length <= 320) {
      sanitizedDoc.email = data.email;
    }
    if (typeof data.clientVersion === 'number') {
      sanitizedDoc.clientVersion = Math.min(1000, Math.max(0, data.clientVersion));
    }
    if (typeof data.provider === 'string' && data.provider.length <= 64) {
      sanitizedDoc.provider = data.provider;
    }
    if (typeof data.source === 'string' && data.source.length <= 32) {
      sanitizedDoc.source = data.source;
    }
    if (typeof data.timestamp === 'string' && data.timestamp.length <= 64) {
      sanitizedDoc.timestamp = data.timestamp;
    }

    const docRef = doc(db, 'users', activeUid);
    await withExponentialBackoff(() => setDoc(docRef, sanitizedDoc, { merge: true }));
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
 * Fetch app payload snapshot from Firestore under authenticated user's UID
 */
export async function getUserDataFromFirestore(userId: string): Promise<any | null> {
  const activeUid = auth.currentUser?.uid;
  if (!userId || !activeUid || userId !== activeUid) {
    return null;
  }
  const path = `users/${activeUid}`;
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return null;
    }
    const docRef = doc(db, 'users', activeUid);
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
  signInWithRedirect,
  getRedirectResult,
  firebaseSignOut,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  firebaseConfig,
};

export type { FirebaseUser };

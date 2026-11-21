import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
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
  collection,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  getDocFromServer,
  onSnapshot,
  serverTimestamp,
  Timestamp,
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

export const GOOGLE_DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.appdata'] as const;
export const googleDriveProvider = new GoogleAuthProvider();
GOOGLE_DRIVE_SCOPES.forEach((scope) => googleDriveProvider.addScope(scope));
googleDriveProvider.setCustomParameters({ prompt: 'select_account' });

// Strict in-memory cache for Google Workspace OAuth access tokens (never stored in localStorage/sessionStorage)
let cachedGDriveAccessToken: string | null = null;
let cachedGDriveEmail: string | null = null;
let cachedGDriveDisplayName: string | null = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    cachedGDriveAccessToken = null;
    cachedGDriveEmail = null;
    cachedGDriveDisplayName = null;
  }
});

export function getInMemoryGDriveToken(): string | null {
  return cachedGDriveAccessToken;
}

export function getInMemoryGDriveEmail(): string | null {
  return cachedGDriveEmail;
}

export function getInMemoryGDriveDisplayName(): string | null {
  return cachedGDriveDisplayName;
}

export function setInMemoryGDriveToken(
  token: string | null,
  email?: string | null,
  displayName?: string | null
): void {
  const clean = token ? token.trim() : '';
  cachedGDriveAccessToken = clean || null;
  cachedGDriveEmail = clean ? (email ?? cachedGDriveEmail) : null;
  cachedGDriveDisplayName = clean ? (displayName ?? cachedGDriveDisplayName) : null;
}

export function clearInMemoryGDriveToken(): void {
  cachedGDriveAccessToken = null;
  cachedGDriveEmail = null;
  cachedGDriveDisplayName = null;
}

export async function revokeWebGDriveToken(): Promise<void> {
  const token = cachedGDriveAccessToken;
  clearInMemoryGDriveToken();
  if (!token) return;
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch {
    // Best-effort revocation; local in-memory token is already cleared
  }
}

export function isRunningInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

export function isCapacitorNative(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) return true;
    return window.location.protocol === 'capacitor:' || (window.location.hostname === 'localhost' && !window.location.port);
  } catch {
    return false;
  }
}

/**
 * Sign in with Google using popup first, falling back to redirect on standalone mobile/PWA when popups are blocked.
 */
export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  if (isCapacitorNative()) {
    throw new Error(
      'Google Sign-In popup is restricted inside the Android APK WebView (https://localhost). Connect JivanOS Private Vault, Google Drive, Dropbox, Nextcloud, WebDAV, or Syncthing Folder in Multi-Drive Sync — works identically across Android, PC & iOS with zero Google login required.'
    );
  }

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
        `Domain "${window.location.hostname}" is not authorized in Firebase Auth. Use JivanOS Private Vault, Local Folder, Google Drive, Dropbox, WebDAV, or S3 sync in Multi-Drive Sync — no Google login required.`
      );
    }
    if (code === 'auth/popup-blocked') {
      throw new Error(
        'Sign-in popup was blocked by your browser. Please allow popups for this site or use JivanOS Private Vault / any drive in Multi-Drive Sync.'
      );
    }
    if (code === 'auth/popup-closed-by-user') {
      throw new Error('Google sign-in window was closed before completing.');
    }
    throw error;
  }
}

/**
 * Connect Google Drive via Firebase Auth GoogleAuthProvider using least-privilege drive.appdata scope ONLY.
 * Avoids redirect_uri_mismatch on dynamic preview URLs and keeps the access token strictly in memory.
 */
export async function connectGoogleDriveWithFirebase(): Promise<{
  accessToken: string;
  user: FirebaseUser;
  email: string;
  displayName: string;
}> {
  if (isCapacitorNative()) {
    throw new Error(
      'On Android APK, Google Drive uses the native Google Sign-In SDK (JivanGoogleDrive plugin).'
    );
  }

  try {
    const result = await signInWithPopup(auth, googleDriveProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'Google Drive AppData permission was not returned. Please grant access when signing in.'
      );
    }
    cachedGDriveAccessToken = credential.accessToken;
    cachedGDriveEmail = result.user?.email || '';
    cachedGDriveDisplayName =
      result.user?.displayName || (cachedGDriveEmail ? cachedGDriveEmail.split('@')[0] : 'Google User');
    return {
      accessToken: cachedGDriveAccessToken,
      user: result.user,
      email: cachedGDriveEmail,
      displayName: cachedGDriveDisplayName,
    };
  } catch (error: any) {
    const code = String(error?.code || '');
    console.error('Google Drive Firebase Auth error:', code, error);

    if (code === 'auth/popup-blocked') {
      throw new Error(
        'Google Drive sign-in popup was blocked by your browser. Please allow popups for this site and try again.'
      );
    }
    if (code === 'auth/popup-closed-by-user') {
      throw new Error('Google Drive sign-in window was closed before completing.');
    }
    if (code === 'auth/unauthorized-domain') {
      throw new Error(
        `Domain "${window.location.hostname}" is not authorized for Google Sign-In. Use JivanOS Private Vault or Local Folder instead.`
      );
    }
    throw error;
  }
}

/**
 * Sign in to JivanOS Cloud using Email & Password.
 */
export async function signInWithEmail(email: string, password: string): Promise<FirebaseUser> {
  const cleanEmail = email.trim();
  if (!cleanEmail || !password) {
    throw new Error('Please enter both your email address and password.');
  }
  const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
  return cred.user;
}

/**
 * Create a new JivanOS Cloud account using Email & Password and trigger email verification.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<FirebaseUser> {
  const cleanEmail = email.trim();
  if (!cleanEmail || password.length < 6) {
    throw new Error('Enter a valid email address and a password of at least 6 characters.');
  }
  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  if (displayName?.trim()) {
    await updateProfile(cred.user, { displayName: displayName.trim().slice(0, 80) }).catch(() => {});
  }
  await sendEmailVerification(cred.user).catch(() => {});
  return cred.user;
}

export async function resendEmailVerification(): Promise<void> {
  if (!auth.currentUser) throw new Error('Sign in first to resend verification email.');
  await sendEmailVerification(auth.currentUser);
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
  collection,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  firebaseConfig,
};

export type { FirebaseUser };

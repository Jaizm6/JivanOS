/**
 * Phase 5A — JivanOS Cloud SyncProvider (Firebase Firestore)
 *
 * Implements the shared SyncProvider contract using Firebase Auth + Firestore:
 * - Backup document: users/{uid}/jivanos/backup
 * - Sync history subcollection (last 10): users/{uid}/jivanos/backup/syncHistory/{entryId}
 * - Subscription document (server-managed, read-only): users/{uid}/jivanos/subscription
 * - Trial document (create-once immutable 14-day trial): users/{uid}/jivanos/trial
 * - Real-time cross-device sync via Firestore onSnapshot
 * - Offline support via Firebase persistentLocalCache (already configured in src/lib/firebase.ts)
 */

import {
  OperationType,
  addDoc,
  auth,
  collection,
  db,
  deleteDoc,
  doc,
  firebaseSignOut,
  getDoc,
  getDocs,
  getUserDataFromFirestore,
  handleFirestoreError,
  limit,
  onSnapshot,
  orderBy,
  query,
  saveUserDataToFirestore,
  serverTimestamp,
  setDoc,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  where,
} from '../../lib/firebase';
import {
  AutoSyncIntervalMinutes,
  computeInitials,
  getOrCreateDeviceId,
} from '../../utils/googleDriveSync';
import {
  SyncAccount,
  SyncBackupEnvelope,
  SyncInfo,
  SyncPlatform,
  SyncProvider,
  SyncRestoreResult,
  detectSyncPlatform,
} from '../SyncProvider';
import {
  CloudSubscriptionStatus,
  ensureFourteenDayTrial,
  fetchCloudEntitlement,
} from '../hooks/useSubscription';

export const JIVANOS_CLOUD_META_KEY = 'jivanos_cloud_sync_meta_v1';
export const JIVANOS_CLOUD_STATE_EVENT = 'jivanos:cloud-sync-updated';

export interface CloudSyncHistoryItem {
  id: string;
  deviceId: string;
  deviceName: string;
  platform: string;
  timestamp: string;
  itemCounts: {
    tasks: number;
    habits: number;
    bills: number;
    medications: number;
  };
}

export interface LocalProReceipt {
  plan: 'monthly' | 'yearly';
  activatedAt: string;
  expiresAt: string;
  referenceId: string;
  method: 'upi' | 'card' | 'license';
}

export interface StoredJivanCloudMeta {
  lastSyncedAt: string | null;
  lastFileSizeBytes: number | null;
  realtimeEnabled: boolean;
  lastError: string | null;
  cloudOptInConnected: boolean;
  trialExplicitlyActivated: boolean;
  localProReceipt: LocalProReceipt | null;
}

export interface CloudConnectOptions {
  method?: 'google' | 'email-signin' | 'email-signup';
  email?: string;
  password?: string;
  displayName?: string;
  activateTrial?: boolean;
}

export type CloudRemoteChangeHandler = (result: SyncRestoreResult, remoteDeviceId: string) => void;

function emitCloudStateUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(JIVANOS_CLOUD_STATE_EVENT));
  }
}

export function getStoredCloudMeta(): StoredJivanCloudMeta {
  const defaults: StoredJivanCloudMeta = {
    lastSyncedAt: null,
    lastFileSizeBytes: null,
    realtimeEnabled: true,
    lastError: null,
    cloudOptInConnected: false,
    trialExplicitlyActivated: false,
    localProReceipt: null,
  };
  try {
    const raw = localStorage.getItem(JIVANOS_CLOUD_META_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const receipt =
      parsed.localProReceipt &&
      typeof parsed.localProReceipt === 'object' &&
      (parsed.localProReceipt.plan === 'monthly' || parsed.localProReceipt.plan === 'yearly') &&
      typeof parsed.localProReceipt.expiresAt === 'string'
        ? (parsed.localProReceipt as LocalProReceipt)
        : null;
    return {
      lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
      lastFileSizeBytes:
        typeof parsed.lastFileSizeBytes === 'number' ? parsed.lastFileSizeBytes : null,
      realtimeEnabled:
        typeof parsed.realtimeEnabled === 'boolean' ? parsed.realtimeEnabled : true,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
      cloudOptInConnected: Boolean(parsed.cloudOptInConnected),
      trialExplicitlyActivated: Boolean(parsed.trialExplicitlyActivated),
      localProReceipt: receipt,
    };
  } catch {
    return defaults;
  }
}

export function updateStoredCloudMeta(patch: Partial<StoredJivanCloudMeta>): StoredJivanCloudMeta {
  const next = { ...getStoredCloudMeta(), ...patch };
  try {
    localStorage.setItem(JIVANOS_CLOUD_META_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota issues
  }
  emitCloudStateUpdate();
  return next;
}

function getFriendlyDeviceName(): string {
  const platform = detectSyncPlatform();
  if (typeof navigator === 'undefined') return `JivanOS (${platform})`;
  const ua = navigator.userAgent || '';
  if (platform === 'android') {
    const modelMatch = ua.match(/Android\s[\d.]+;\s*([^;)]+)/i);
    if (modelMatch?.[1]) return modelMatch[1].trim().slice(0, 60);
    return 'Android Device';
  }
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Windows/i.test(ua)) return 'Windows Browser';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'Mac Browser';
  if (/Linux/i.test(ua)) return 'Linux Browser';
  return 'Web Browser';
}

function timestampToIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

/**
 * Deeply strips `undefined` values so Firestore setDoc never rejects optional object fields.
 */
function sanitizeForFirestore(value: unknown): any {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : sanitizeForFirestore(item)));
  }
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== undefined) {
      out[k] = sanitizeForFirestore(v);
    }
  }
  return out;
}

function countDataCollections(data: Record<string, any>) {
  return {
    tasks: Array.isArray(data?.tasks) ? data.tasks.length : 0,
    habits: Array.isArray(data?.habits) ? data.habits.length : 0,
    bills: Array.isArray(data?.bills) ? data.bills.length : 0,
    medications: Array.isArray(data?.medications) ? data.medications.length : 0,
  };
}

export class FirestoreSyncProvider implements SyncProvider {
  readonly id = 'jivanos_cloud' as const;
  readonly displayName = 'JivanOS Cloud';

  private cachedPremium = false;
  private cachedStatus: CloudSubscriptionStatus = 'none';
  private realtimeUnsubscribe: (() => void) | null = null;
  private listeningActive = false;
  private remoteChangeListeners = new Set<CloudRemoteChangeHandler>();

  get platform(): SyncPlatform {
    return detectSyncPlatform();
  }

  get isListeningRealtime(): boolean {
    return this.listeningActive;
  }

  onRemoteChange(handler: CloudRemoteChangeHandler): () => void {
    this.remoteChangeListeners.add(handler);
    return () => {
      this.remoteChangeListeners.delete(handler);
    };
  }

  /**
   * Synchronous entitlement check used by SyncProvider.isConnected().
   */
  isPremium(): boolean {
    return this.cachedPremium;
  }

  /**
   * Refreshes premium/trial status from Firestore and updates the synchronous cache.
   */
  async checkIsPremium(): Promise<boolean> {
    const user = auth.currentUser;
    const meta = getStoredCloudMeta();
    if (!user || !user.emailVerified || !meta.cloudOptInConnected) {
      this.cachedPremium = false;
      this.cachedStatus = 'none';
      return false;
    }
    const entitlement = await fetchCloudEntitlement(user.uid);
    this.cachedPremium = entitlement.isPremium;
    this.cachedStatus = entitlement.status;
    return entitlement.isPremium;
  }

  isConnected(): boolean {
    const meta = getStoredCloudMeta();
    return Boolean(
      auth.currentUser &&
        auth.currentUser.emailVerified &&
        meta.cloudOptInConnected &&
        this.cachedPremium
    );
  }

  async connect(options?: CloudConnectOptions): Promise<SyncAccount> {
    const method = options?.method || 'google';
    let user = auth.currentUser;

    if (method === 'email-signin') {
      user = await signInWithEmail(options?.email || '', options?.password || '');
    } else if (method === 'email-signup') {
      user = await signUpWithEmail(
        options?.email || '',
        options?.password || '',
        options?.displayName
      );
    } else {
      user = await signInWithGoogle();
    }

    if (!user) {
      throw new Error('Sign-in was not completed.');
    }

    // Explicitly mark JivanOS Cloud as signed-in by user choice (never triggered by Google Drive)
    updateStoredCloudMeta({
      cloudOptInConnected: true,
      lastError: null,
    });

    if (user.emailVerified) {
      // Notesnook rule: ONLY activate 14-day free trial if user explicitly requested trial activation
      if (options?.activateTrial) {
        updateStoredCloudMeta({ trialExplicitlyActivated: true });
        await ensureFourteenDayTrial(user.uid);
      }
      await this.checkIsPremium();
    } else {
      this.cachedPremium = false;
      this.cachedStatus = 'none';
    }

    const email = user.email || '';
    const name = user.displayName || (email ? email.split('@')[0] : 'JivanOS User');
    emitCloudStateUpdate();
    return {
      connected: this.isConnected(),
      name,
      email,
      initials: computeInitials(name, email),
    };
  }

  async silentReAuth(): Promise<SyncAccount | null> {
    const user = auth.currentUser;
    const meta = getStoredCloudMeta();
    if (!user || !meta.cloudOptInConnected) {
      this.cachedPremium = false;
      this.cachedStatus = 'none';
      return null;
    }
    await this.checkIsPremium();
    const email = user.email || '';
    const name = user.displayName || (email ? email.split('@')[0] : 'JivanOS User');
    return {
      connected: this.isConnected(),
      name,
      email,
      initials: computeInitials(name, email),
    };
  }

  async backup(data: Record<string, unknown>): Promise<SyncInfo> {
    const user = auth.currentUser;
    const meta = getStoredCloudMeta();
    if (!user || !meta.cloudOptInConnected) {
      throw new Error('Sign in to JivanOS Cloud before syncing.');
    }
    if (!user.emailVerified) {
      throw new Error('Please verify your email address before syncing to JivanOS Cloud.');
    }

    const entitlement = await fetchCloudEntitlement(user.uid);
    this.cachedPremium = entitlement.isPremium;
    this.cachedStatus = entitlement.status;

    if (!entitlement.isPremium) {
      throw new Error('JivanOS Cloud requires an active trial or Pro subscription to sync.');
    }

    const uid = user.uid;
    const deviceId = getOrCreateDeviceId();
    const deviceName = getFriendlyDeviceName();
    const platform = detectSyncPlatform();
    const sanitizedData = sanitizeForFirestore(data);

    const approxBytes = new Blob([JSON.stringify(sanitizedData)]).size;
    if (approxBytes > 900_000) {
      throw new Error(
        'Backup exceeds Firestore 1 MB document limit. Use Google Drive, Dropbox, or Telegram for larger backups.'
      );
    }

    const backupPath = `users/${uid}/jivanos/backup`;
    const backupRef = doc(db, 'users', uid, 'jivanos', 'backup');
    const nowIso = new Date().toISOString();

    let savedToSubdoc = false;
    try {
      await setDoc(
        backupRef,
        {
          userId: uid,
          schemaVersion: 1,
          app: 'JivanOS',
          updatedAt: serverTimestamp(),
          deviceId,
          deviceName,
          platform,
          subscriptionStatus: entitlement.status === 'active' ? 'active' : 'trial',
          data: sanitizedData,
        },
        { merge: true }
      );
      savedToSubdoc = true;
    } catch (err: any) {
      // If activated via client-side payment/license receipt before webhook writes jivanos/subscription,
      // save to owner-authorized primary user sync document (/users/{uid})
      const savedPrimary = await saveUserDataToFirestore(uid, {
        email: user.email || undefined,
        payload: JSON.stringify(sanitizedData),
        clientVersion: 1,
        provider: 'jivanos_cloud',
        source: 'auto',
        timestamp: nowIso,
        updatedAt: nowIso,
      });
      if (!savedPrimary) {
        updateStoredCloudMeta({ lastError: err?.message || 'Cloud backup failed.' });
        if (err?.code === 'permission-denied') {
          handleFirestoreError(err, OperationType.WRITE, backupPath);
        }
        throw err;
      }
    }

    if (savedToSubdoc) {
      // Record entry in syncHistory subcollection and retain only last 10 records
      const historyPath = `users/${uid}/jivanos/backup/syncHistory`;
      try {
        const historyCol = collection(db, 'users', uid, 'jivanos', 'backup', 'syncHistory');
        await addDoc(historyCol, {
          userId: uid,
          deviceId,
          deviceName,
          platform,
          timestamp: serverTimestamp(),
          itemCounts: countDataCollections(sanitizedData),
        });

        const pruneQuery = query(
          historyCol,
          where('userId', '==', uid),
          orderBy('timestamp', 'desc'),
          limit(25)
        );
        const snap = await getDocs(pruneQuery);
        if (snap.docs.length > 10) {
          const overflow = snap.docs.slice(10);
          await Promise.allSettled(overflow.map((d) => deleteDoc(d.ref)));
        }
      } catch (err: any) {
        if (err?.code === 'permission-denied') {
          try {
            handleFirestoreError(err, OperationType.WRITE, historyPath);
          } catch {
            // Non-fatal to primary backup
          }
        }
      }
    }

    updateStoredCloudMeta({
      lastSyncedAt: nowIso,
      lastFileSizeBytes: approxBytes,
      lastError: null,
    });

    return {
      lastModified: nowIso,
      fileSizeBytes: approxBytes,
      deviceId,
    };
  }

  async restore(): Promise<SyncRestoreResult> {
    const user = auth.currentUser;
    const meta = getStoredCloudMeta();
    if (!user || !meta.cloudOptInConnected) {
      throw new Error('Sign in to JivanOS Cloud to restore your backup.');
    }
    if (!user.emailVerified) {
      throw new Error('Please verify your email address to access your JivanOS Cloud backup.');
    }

    const uid = user.uid;
    const backupPath = `users/${uid}/jivanos/backup`;
    const backupRef = doc(db, 'users', uid, 'jivanos', 'backup');

    try {
      const snap = await getDoc(backupRef);
      if (snap.exists()) {
        const raw = snap.data();
        const updatedIso = timestampToIso(raw.updatedAt);
        const payloadData = (raw.data && typeof raw.data === 'object' ? raw.data : {}) as Record<
          string,
          any
        >;
        const sizeBytes = new Blob([JSON.stringify(payloadData)]).size;

        const envelope: SyncBackupEnvelope = {
          schemaVersion: 1,
          app: 'JivanOS',
          updatedAt: updatedIso,
          deviceId: typeof raw.deviceId === 'string' ? raw.deviceId : 'jivanos-cloud',
          data: payloadData,
        };

        return {
          found: true,
          envelope,
          lastModified: updatedIso,
          fileSizeBytes: sizeBytes,
        };
      }

      // Check fallback primary user doc (/users/{uid})
      const fallbackRaw = await getUserDataFromFirestore(uid);
      if (fallbackRaw && typeof fallbackRaw.payload === 'string') {
        const parsedData = JSON.parse(fallbackRaw.payload);
        const updatedIso =
          typeof fallbackRaw.updatedAt === 'string'
            ? fallbackRaw.updatedAt
            : new Date().toISOString();
        const sizeBytes = new Blob([fallbackRaw.payload]).size;
        return {
          found: true,
          envelope: {
            schemaVersion: 1,
            app: 'JivanOS',
            updatedAt: updatedIso,
            deviceId: 'jivanos-cloud',
            data: parsedData,
          },
          lastModified: updatedIso,
          fileSizeBytes: sizeBytes,
        };
      }

      return { found: false, envelope: null, lastModified: null, fileSizeBytes: 0 };
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.GET, backupPath);
      }
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.stopRealtimeListener();
    this.cachedPremium = false;
    this.cachedStatus = 'none';
    updateStoredCloudMeta({
      cloudOptInConnected: false,
      lastError: null,
    });
    await firebaseSignOut(auth);
  }

  async getLastSyncInfo(): Promise<SyncInfo | null> {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) return null;

    const backupPath = `users/${user.uid}/jivanos/backup`;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid, 'jivanos', 'backup'));
      if (!snap.exists()) return null;
      const raw = snap.data();
      const updatedIso = timestampToIso(raw.updatedAt);
      const sizeBytes = new Blob([JSON.stringify(raw.data || {})]).size;
      const deviceId = typeof raw.deviceId === 'string' ? raw.deviceId : undefined;

      updateStoredCloudMeta({
        lastSyncedAt: updatedIso,
        lastFileSizeBytes: sizeBytes,
        lastError: null,
      });

      return {
        lastModified: updatedIso,
        fileSizeBytes: sizeBytes,
        deviceId,
      };
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.GET, backupPath);
      }
      return null;
    }
  }

  /**
   * Starts or stops the Firestore onSnapshot real-time listener on users/{uid}/jivanos/backup.
   * For Firestore, real-time listening replaces polling intervals.
   */
  async setAutoSync(
    enabled: boolean,
    _intervalMinutes: AutoSyncIntervalMinutes = 15
  ): Promise<void> {
    updateStoredCloudMeta({ realtimeEnabled: enabled });
    if (!enabled) {
      this.stopRealtimeListener();
      return;
    }
    await this.startRealtimeListener();
  }

  async startRealtimeListener(): Promise<void> {
    this.stopRealtimeListener();

    const user = auth.currentUser;
    if (!user || !user.emailVerified) return;

    const premium = await this.checkIsPremium();
    if (!premium) return;

    const uid = user.uid;
    const localDeviceId = getOrCreateDeviceId();
    const backupPath = `users/${uid}/jivanos/backup`;
    const backupRef = doc(db, 'users', uid, 'jivanos', 'backup');

    this.listeningActive = true;
    emitCloudStateUpdate();

    let isInitialSnapshot = true;

    this.realtimeUnsubscribe = onSnapshot(
      backupRef,
      (snap) => {
        if (!snap.exists()) {
          isInitialSnapshot = false;
          return;
        }
        const raw = snap.data();
        const remoteDeviceId = typeof raw.deviceId === 'string' ? raw.deviceId : '';
        const updatedIso = timestampToIso(raw.updatedAt);
        const payloadData = (raw.data && typeof raw.data === 'object' ? raw.data : {}) as Record<
          string,
          any
        >;
        const sizeBytes = new Blob([JSON.stringify(payloadData)]).size;

        updateStoredCloudMeta({
          lastSyncedAt: updatedIso,
          lastFileSizeBytes: sizeBytes,
          lastError: null,
        });

        // Skip applying our own local write or initial hydration echo
        const fromAnotherDevice = Boolean(remoteDeviceId && remoteDeviceId !== localDeviceId);
        if (!isInitialSnapshot && fromAnotherDevice && !snap.metadata.hasPendingWrites) {
          const result: SyncRestoreResult = {
            found: true,
            envelope: {
              schemaVersion: 1,
              app: 'JivanOS',
              updatedAt: updatedIso,
              deviceId: remoteDeviceId,
              data: payloadData,
            },
            lastModified: updatedIso,
            fileSizeBytes: sizeBytes,
          };
          this.remoteChangeListeners.forEach((cb) => cb(result, remoteDeviceId));
        }

        isInitialSnapshot = false;
      },
      (err) => {
        this.listeningActive = false;
        updateStoredCloudMeta({ lastError: err.message });
        if (err.code === 'permission-denied') {
          try {
            handleFirestoreError(err, OperationType.GET, backupPath);
          } catch {
            // Logged via handleFirestoreError
          }
        }
      }
    );
  }

  stopRealtimeListener(): void {
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
    }
    if (this.listeningActive) {
      this.listeningActive = false;
      emitCloudStateUpdate();
    }
  }

  /**
   * Read the last 10 sync history records from users/{uid}/jivanos/backup/syncHistory.
   */
  async syncHistory(): Promise<CloudSyncHistoryItem[]> {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) return [];

    const uid = user.uid;
    const historyPath = `users/${uid}/jivanos/backup/syncHistory`;
    const historyCol = collection(db, 'users', uid, 'jivanos', 'backup', 'syncHistory');

    try {
      const q = query(
        historyCol,
        where('userId', '==', uid),
        orderBy('timestamp', 'desc'),
        limit(10)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const raw = d.data();
        const counts = (raw.itemCounts || {}) as Record<string, any>;
        return {
          id: d.id,
          deviceId: String(raw.deviceId || ''),
          deviceName: String(raw.deviceName || 'Device'),
          platform: String(raw.platform || 'web'),
          timestamp: timestampToIso(raw.timestamp),
          itemCounts: {
            tasks: Number(counts.tasks || 0),
            habits: Number(counts.habits || 0),
            bills: Number(counts.bills || 0),
            medications: Number(counts.medications || 0),
          },
        };
      });
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.LIST, historyPath);
      }
      // Fallback if composite index is still building: unordered query filtered by userId, sorted client-side
      try {
        const fallbackQ = query(historyCol, where('userId', '==', uid), limit(10));
        const snap = await getDocs(fallbackQ);
        return snap.docs
          .map((d) => {
            const raw = d.data();
            const counts = (raw.itemCounts || {}) as Record<string, any>;
            return {
              id: d.id,
              deviceId: String(raw.deviceId || ''),
              deviceName: String(raw.deviceName || 'Device'),
              platform: String(raw.platform || 'web'),
              timestamp: timestampToIso(raw.timestamp),
              itemCounts: {
                tasks: Number(counts.tasks || 0),
                habits: Number(counts.habits || 0),
                bills: Number(counts.bills || 0),
                medications: Number(counts.medications || 0),
              },
            };
          })
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      } catch {
        return [];
      }
    }
  }
}

export const firestoreSyncProvider = new FirestoreSyncProvider();

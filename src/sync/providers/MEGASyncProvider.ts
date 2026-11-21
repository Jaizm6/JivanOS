/**
 * Phase 8 — MEGA Cloud SyncProvider (20 GB Free, End-to-End Encrypted by Default)
 *
 * Uses `megajs` (lightweight browser-compatible JS library wrapping MEGA's REST API
 * and client-side PBKDF2-SHA512 / AES crypto — no heavy native MEGA SDK).
 *
 * SECURITY MODEL:
 * - User's MEGA password is NEVER stored in localStorage, sessionStorage, or retained
 *   in memory after the login call finishes (immediately scrubbed from Storage options).
 * - Session credentials (`sid` + derived session master key) are stored ONLY in
 *   `sessionStorage` so they clear automatically when the browser/app closes.
 * - `localStorage` (`jivanos_mega_auth`) stores strictly non-secret metadata:
 *   `{ email, nodeHandle, lastSyncedAt, lastFileSizeBytes, autoSyncEnabled, autoSyncIntervalMinutes, lastError }`.
 * - On a new app session (`sessionStorage` cleared), `isConnected()` returns `false`
 *   and `silentReAuth()` signals a session-expired state so the user re-enters their
 *   password once for the new session.
 */

import {
  AutoSyncIntervalMinutes,
  buildDriveBackupEnvelope,
  computeInitials,
  formatRelativeSyncTime,
  parseDriveBackupEnvelope,
} from '../../utils/googleDriveSync';
import {
  SyncAccount,
  SyncInfo,
  SyncPlatform,
  SyncProvider,
  SyncRestoreResult,
  detectSyncPlatform,
} from '../SyncProvider';
import { isDesktop } from '../../desktop/KeychainService';
import { sendDesktopSyncNotification, updateTraySyncTooltip } from '../../desktop/TrayService';

export const MEGA_AUTH_STORAGE_KEY = 'jivanos_mega_auth';
export const MEGA_SESSION_STORAGE_KEY = 'jivanos_mega_session';
export const MEGA_SYNC_STATE_EVENT = 'jivanos:mega-sync-updated';

const MEGA_FOLDER_NAME = 'JivanOS';
const MEGA_BACKUP_FILENAME = 'backup.json';

export interface StoredMegaAuth {
  email: string;
  nodeHandle: string | null;
  lastSyncedAt: string | null;
  lastFileSizeBytes: number | null;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: AutoSyncIntervalMinutes;
  lastError: string | null;
}

interface StoredMegaSession {
  sid: string;
  key: string;
  name: string;
  user: string;
  email: string;
}

type MegaModule = {
  Storage: {
    new (options: Record<string, any>): any;
    fromJSON(json: Record<string, any>): any;
  };
};

let cachedMegaModulePromise: Promise<MegaModule> | null = null;

async function loadMegaModule(): Promise<MegaModule> {
  if (!cachedMegaModulePromise) {
    // Explicitly load the browser ES build of megajs as a lazy chunk (no Node streams/crypto)
    cachedMegaModulePromise = import('megajs/dist/main.browser-es.mjs') as unknown as Promise<MegaModule>;
  }
  return cachedMegaModulePromise;
}

function emitMegaStateUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MEGA_SYNC_STATE_EVENT));
  }
}

function sanitizeMegaError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'MEGA sync error. Please check your credentials and connection.';

  if (/ENOENT/i.test(raw)) {
    return 'Incorrect MEGA email or password. Please check your credentials and try again.';
  }
  if (/EMFAREQUIRED/i.test(raw)) {
    return 'This MEGA account has 2FA enabled. Please enter your 2FA code or disable 2FA for app sync.';
  }
  if (/EBLOCKED|EACCESS/i.test(raw)) {
    return 'MEGA account access was temporarily restricted. Please sign in on mega.nz to verify.';
  }
  if (/ESID/i.test(raw)) {
    return 'MEGA session expired. Re-enter your MEGA password to continue syncing.';
  }
  if (/EAGAIN|ERATELIMIT|ETEMPUNAVAIL/i.test(raw)) {
    return 'MEGA servers are temporarily busy. Please try again in a moment.';
  }
  if (/EOVERQUOTA/i.test(raw)) {
    return 'Your MEGA storage quota is full. Free up space on MEGA to continue backing up.';
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) {
    return 'Could not reach MEGA servers. Check your internet connection.';
  }

  return raw.replace(/sid=[^&\s]+/gi, 'sid=[REDACTED]');
}

export function getStoredMegaAuth(): StoredMegaAuth | null {
  try {
    const raw = localStorage.getItem(MEGA_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.email) return null;
    return {
      email: String(parsed.email),
      nodeHandle: typeof parsed.nodeHandle === 'string' ? parsed.nodeHandle : null,
      lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
      lastFileSizeBytes:
        typeof parsed.lastFileSizeBytes === 'number' ? parsed.lastFileSizeBytes : null,
      autoSyncEnabled: Boolean(parsed.autoSyncEnabled),
      autoSyncIntervalMinutes:
        parsed.autoSyncIntervalMinutes === 15 ||
        parsed.autoSyncIntervalMinutes === 30 ||
        parsed.autoSyncIntervalMinutes === 60
          ? parsed.autoSyncIntervalMinutes
          : 0,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
    };
  } catch {
    return null;
  }
}

function saveStoredMegaAuth(auth: StoredMegaAuth | null): void {
  try {
    if (!auth) {
      localStorage.removeItem(MEGA_AUTH_STORAGE_KEY);
    } else {
      // Strictly non-secret metadata only — never write password, sid, or key to localStorage
      localStorage.setItem(
        MEGA_AUTH_STORAGE_KEY,
        JSON.stringify({
          email: auth.email,
          nodeHandle: auth.nodeHandle,
          lastSyncedAt: auth.lastSyncedAt,
          lastFileSizeBytes: auth.lastFileSizeBytes,
          autoSyncEnabled: auth.autoSyncEnabled,
          autoSyncIntervalMinutes: auth.autoSyncIntervalMinutes,
          lastError: auth.lastError,
        })
      );
    }
  } catch {
    // Ignore storage quota errors
  }
  emitMegaStateUpdate();
}

function patchStoredMegaAuth(patch: Partial<StoredMegaAuth>): StoredMegaAuth | null {
  const existing = getStoredMegaAuth();
  if (!existing) return null;
  const next = { ...existing, ...patch };
  saveStoredMegaAuth(next);
  return next;
}

function getStoredMegaSession(): StoredMegaSession | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(MEGA_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.sid || !parsed.key) return null;
    return {
      sid: String(parsed.sid),
      key: String(parsed.key),
      name: String(parsed.name || ''),
      user: String(parsed.user || ''),
      email: String(parsed.email || ''),
    };
  } catch {
    return null;
  }
}

function saveStoredMegaSession(session: StoredMegaSession | null): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (!session) {
      sessionStorage.removeItem(MEGA_SESSION_STORAGE_KEY);
    } else {
      // Explicitly omit password — only store session-scoped sid + session key
      sessionStorage.setItem(
        MEGA_SESSION_STORAGE_KEY,
        JSON.stringify({
          sid: session.sid,
          key: session.key,
          name: session.name,
          user: session.user,
          email: session.email,
        })
      );
    }
  } catch {
    // Ignore sessionStorage errors
  }
  emitMegaStateUpdate();
}

export function hasActiveMegaSession(): boolean {
  const session = getStoredMegaSession();
  return Boolean(session?.sid && session?.key);
}

/**
 * True when the user previously connected MEGA (`localStorage` has their email)
 * but the browser/app session restarted so `sessionStorage` no longer has a session.
 */
export function isMegaSessionExpired(): boolean {
  const auth = getStoredMegaAuth();
  return Boolean(auth?.email && !hasActiveMegaSession());
}

function decodeMegaBufferToUtf8(buf: unknown): string {
  if (typeof buf === 'string') return buf;
  if (buf instanceof Uint8Array) {
    return new TextDecoder('utf-8').decode(buf);
  }
  if (buf instanceof ArrayBuffer) {
    return new TextDecoder('utf-8').decode(new Uint8Array(buf));
  }
  if (buf && typeof (buf as any).toString === 'function') {
    return String((buf as any).toString('utf8'));
  }
  return '';
}

function findChildFolder(root: any, folderName: string): any | null {
  const children: any[] = Array.isArray(root?.children) ? root.children : [];
  return (
    children.find(
      (child) =>
        Boolean(child?.directory) &&
        typeof child?.name === 'string' &&
        child.name.toLowerCase() === folderName.toLowerCase()
    ) || null
  );
}

function findBackupFiles(folder: any): any[] {
  const children: any[] = Array.isArray(folder?.children) ? folder.children : [];
  return children
    .filter(
      (child) =>
        !child?.directory &&
        typeof child?.name === 'string' &&
        child.name.toLowerCase() === MEGA_BACKUP_FILENAME
    )
    .sort((a, b) => Number(b?.timestamp || 0) - Number(a?.timestamp || 0));
}

export class MEGASyncProvider implements SyncProvider {
  readonly id = 'mega' as const;
  readonly displayName = 'MEGA';

  private activeStorage: any | null = null;
  private autoSyncTimer: ReturnType<typeof setInterval> | null = null;

  get platform(): SyncPlatform {
    return detectSyncPlatform();
  }

  /**
   * Connected only when both the non-secret email metadata exists in localStorage
   * AND an active session token exists in sessionStorage.
   */
  isConnected(): boolean {
    const auth = getStoredMegaAuth();
    return Boolean(auth?.email && hasActiveMegaSession());
  }

  /**
   * Authenticates directly against MEGA using `megajs` (PBKDF2-SHA512 + client-side E2EE).
   * Password is used only inside this call and immediately scrubbed from memory.
   */
  async connect(email?: string, password?: string): Promise<SyncAccount> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const rawPassword = password || '';

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Enter a valid MEGA email address.');
    }
    if (!rawPassword) {
      throw new Error('Enter your MEGA password to connect.');
    }

    const { Storage } = await loadMegaModule();

    // Close any prior in-memory Storage handle before opening a new session
    this.closeActiveStorage();

    const storage = new Storage({
      email: cleanEmail,
      password: rawPassword,
      keepalive: false,
      autoload: true,
      autologin: true,
    });

    try {
      await storage.ready;
    } catch (err) {
      // Ensure password is wiped even on failed auth
      if (storage?.options) storage.options.password = '';
      try {
        storage.close?.();
      } catch {}
      throw new Error(sanitizeMegaError(err));
    }

    // Immediately scrub password from memory so it never persists anywhere
    if (storage?.options) {
      storage.options.password = '';
    }

    // Ensure /JivanOS/ folder exists
    let folder = findChildFolder(storage.root, MEGA_FOLDER_NAME);
    if (!folder) {
      try {
        folder = await storage.mkdir(MEGA_FOLDER_NAME);
      } catch (err) {
        try {
          storage.close?.();
        } catch {}
        throw new Error(sanitizeMegaError(err));
      }
    }

    const serialized = storage.toJSON();
    if (!serialized?.sid || !serialized?.key) {
      try {
        storage.close?.();
      } catch {}
      throw new Error('MEGA did not return an active session token.');
    }

    // Preserve previous auto-sync settings if re-authenticating same email
    const prev = getStoredMegaAuth();
    const sameEmail = prev?.email?.toLowerCase() === cleanEmail;

    // 1. Store session ONLY in sessionStorage (clears when browser/app closes)
    saveStoredMegaSession({
      sid: String(serialized.sid),
      key: String(serialized.key),
      name: String(serialized.name || ''),
      user: String(serialized.user || ''),
      email: cleanEmail,
    });

    // 2. Store strictly non-secret metadata in localStorage (jivanos_mega_auth)
    saveStoredMegaAuth({
      email: cleanEmail,
      nodeHandle: folder?.nodeId ? String(folder.nodeId) : null,
      lastSyncedAt: sameEmail ? prev?.lastSyncedAt || null : null,
      lastFileSizeBytes: sameEmail ? prev?.lastFileSizeBytes ?? null : null,
      autoSyncEnabled: sameEmail ? Boolean(prev?.autoSyncEnabled) : false,
      autoSyncIntervalMinutes: sameEmail ? prev?.autoSyncIntervalMinutes || 0 : 0,
      lastError: null,
    });

    this.activeStorage = storage;

    const displayName = serialized.name ? String(serialized.name) : cleanEmail.split('@')[0];
    return {
      connected: true,
      name: displayName || cleanEmail,
      email: cleanEmail,
      initials: computeInitials(displayName || cleanEmail, 'MG'),
    };
  }

  /**
   * Restores the active MEGA session within the current browser session only.
   * On a new app session (sessionStorage cleared), returns null and marks
   * `isConnected() === false` so the UI prompts the user to re-enter their password.
   */
  async silentReAuth(): Promise<SyncAccount | null> {
    const auth = getStoredMegaAuth();
    if (!auth?.email) return null;

    const session = getStoredMegaSession();
    if (!session?.sid || !session?.key) {
      // New app session — password is never stored, so prompt user to re-enter
      this.closeActiveStorage();
      emitMegaStateUpdate();
      return null;
    }

    try {
      const storage = await this.ensureActiveStorage(false);
      const displayName = storage?.name || session.name || auth.email.split('@')[0];
      return {
        connected: true,
        name: String(displayName),
        email: auth.email,
        initials: computeInitials(String(displayName), 'MG'),
      };
    } catch (err: any) {
      const msg = sanitizeMegaError(err);
      if (/session expired/i.test(msg)) {
        saveStoredMegaSession(null);
        this.closeActiveStorage();
        return null;
      }
      // If temporarily offline within same session, keep session indicator intact
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return {
          connected: true,
          name: session.name || auth.email.split('@')[0],
          email: auth.email,
          initials: computeInitials(session.name || auth.email, 'MG'),
        };
      }
      return null;
    }
  }

  private closeActiveStorage(): void {
    if (this.activeStorage) {
      try {
        this.activeStorage.close?.();
      } catch {}
      this.activeStorage = null;
    }
  }

  private async ensureActiveStorage(forceReload = true): Promise<any> {
    const auth = getStoredMegaAuth();
    const session = getStoredMegaSession();
    if (!auth?.email || !session?.sid || !session?.key) {
      this.closeActiveStorage();
      saveStoredMegaSession(null);
      throw new Error('Session expired. Re-enter MEGA password to continue syncing.');
    }

    if (!this.activeStorage) {
      const { Storage } = await loadMegaModule();
      this.activeStorage = Storage.fromJSON({
        sid: session.sid,
        key: session.key,
        name: session.name,
        user: session.user,
        options: {
          email: auth.email,
          password: '',
          keepalive: false,
          autoload: false,
          autologin: false,
        },
      });
    }

    if (forceReload || !this.activeStorage.root) {
      try {
        await this.activeStorage.reload(true);
      } catch (err) {
        const msg = sanitizeMegaError(err);
        if (/session expired|ESID/i.test(msg)) {
          this.closeActiveStorage();
          saveStoredMegaSession(null);
        }
        throw new Error(msg);
      }
    }

    return this.activeStorage;
  }

  private async ensureJivanOSFolder(storage: any): Promise<any> {
    const auth = getStoredMegaAuth();
    let folder: any = null;

    if (auth?.nodeHandle && storage.files?.[auth.nodeHandle]?.directory) {
      folder = storage.files[auth.nodeHandle];
    }
    if (!folder) {
      folder = findChildFolder(storage.root, MEGA_FOLDER_NAME);
    }
    if (!folder) {
      folder = await storage.mkdir(MEGA_FOLDER_NAME);
    }
    if (folder?.nodeId && folder.nodeId !== auth?.nodeHandle) {
      patchStoredMegaAuth({ nodeHandle: String(folder.nodeId) });
    }
    return folder;
  }

  /**
   * Uploads /JivanOS/backup.json to MEGA (client-side E2EE via megajs) and
   * removes previous backup.json copies once the new upload completes.
   */
  async backup(data: Record<string, unknown>): Promise<SyncInfo> {
    const storage = await this.ensureActiveStorage(true);
    const folder = await this.ensureJivanOSFolder(storage);

    const envelope = buildDriveBackupEnvelope(data);
    const payloadJson = JSON.stringify(envelope, null, 2);
    const payloadBytes = new TextEncoder().encode(payloadJson);
    const sizeBytes = payloadBytes.byteLength;

    const existingBackups = findBackupFiles(folder);

    try {
      const uploadStream = folder.upload(
        {
          name: MEGA_BACKUP_FILENAME,
          size: sizeBytes,
        },
        payloadJson
      );

      const uploadedFile = await uploadStream.complete;

      // Remove previous backup.json nodes after successful upload (safe overwrite)
      for (const oldFile of existingBackups) {
        if (oldFile?.nodeId && oldFile.nodeId !== uploadedFile?.nodeId) {
          try {
            await oldFile.delete(true);
          } catch {
            // Non-fatal if cleanup fails
          }
        }
      }

      const iso =
        typeof uploadedFile?.timestamp === 'number' && uploadedFile.timestamp > 0
          ? new Date(uploadedFile.timestamp * 1000).toISOString()
          : envelope.updatedAt;
      const reportedSize = Number(uploadedFile?.size || sizeBytes);

      patchStoredMegaAuth({
        nodeHandle: folder?.nodeId ? String(folder.nodeId) : getStoredMegaAuth()?.nodeHandle || null,
        lastSyncedAt: iso,
        lastFileSizeBytes: reportedSize,
        lastError: null,
      });

      if (isDesktop()) {
        void updateTraySyncTooltip(`Synced ${formatRelativeSyncTime(iso)}`);
        void sendDesktopSyncNotification(true);
      }

      return {
        lastModified: iso,
        fileSizeBytes: reportedSize,
        deviceId: envelope.deviceId,
      };
    } catch (err) {
      const safeMsg = sanitizeMegaError(err);
      patchStoredMegaAuth({ lastError: safeMsg });
      if (isDesktop()) {
        void sendDesktopSyncNotification(false);
      }
      throw new Error(safeMsg);
    }
  }

  /**
   * Downloads and decrypts /JivanOS/backup.json from MEGA and returns the parsed envelope.
   */
  async restore(): Promise<SyncRestoreResult> {
    const storage = await this.ensureActiveStorage(true);
    const folder = findChildFolder(storage.root, MEGA_FOLDER_NAME);
    if (!folder) {
      return { found: false, envelope: null, lastModified: null, fileSizeBytes: 0 };
    }

    const backups = findBackupFiles(folder);
    if (backups.length === 0) {
      return { found: false, envelope: null, lastModified: null, fileSizeBytes: 0 };
    }

    const latestFile = backups[0];
    try {
      const rawBuffer = await latestFile.downloadBuffer({});
      const rawText = decodeMegaBufferToUtf8(rawBuffer);
      const envelope = parseDriveBackupEnvelope(rawText);
      if (!envelope) {
        throw new Error('Downloaded MEGA file is not a valid JivanOS JSON backup.');
      }

      const resolvedTimestamp =
        typeof latestFile?.timestamp === 'number' && latestFile.timestamp > 0
          ? new Date(latestFile.timestamp * 1000).toISOString()
          : envelope.updatedAt;
      const resolvedSize = Number(latestFile?.size || new TextEncoder().encode(rawText).byteLength);

      patchStoredMegaAuth({
        lastSyncedAt: resolvedTimestamp,
        lastFileSizeBytes: resolvedSize,
        lastError: null,
      });

      return {
        found: true,
        envelope,
        lastModified: resolvedTimestamp,
        fileSizeBytes: resolvedSize,
      };
    } catch (err) {
      const safeMsg = sanitizeMegaError(err);
      patchStoredMegaAuth({ lastError: safeMsg });
      throw new Error(safeMsg);
    }
  }

  /**
   * Clears both localStorage and sessionStorage MEGA keys and cancels auto-sync.
   */
  async disconnect(): Promise<void> {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
    this.closeActiveStorage();
    saveStoredMegaSession(null);
    saveStoredMegaAuth(null);
  }

  /**
   * Returns `{ lastModified, fileSizeBytes }` from /JivanOS/backup.json node metadata.
   */
  async getLastSyncInfo(): Promise<SyncInfo | null> {
    if (!this.isConnected()) return null;

    try {
      const storage = await this.ensureActiveStorage(true);
      const folder = findChildFolder(storage.root, MEGA_FOLDER_NAME);
      if (!folder) return null;

      const backups = findBackupFiles(folder);
      if (backups.length === 0) return null;

      const latest = backups[0];
      const lastModified =
        typeof latest?.timestamp === 'number' && latest.timestamp > 0
          ? new Date(latest.timestamp * 1000).toISOString()
          : getStoredMegaAuth()?.lastSyncedAt || new Date().toISOString();
      const fileSizeBytes = Number(latest?.size || 0);

      return {
        lastModified,
        fileSizeBytes,
      };
    } catch {
      const stored = getStoredMegaAuth();
      if (stored?.lastSyncedAt) {
        return {
          lastModified: stored.lastSyncedAt,
          fileSizeBytes: stored.lastFileSizeBytes || 0,
        };
      }
      return null;
    }
  }

  async setAutoSync(
    enabled: boolean,
    intervalMinutes: AutoSyncIntervalMinutes,
    getCurrentData?: () => Record<string, unknown>
  ): Promise<void> {
    const normalized: AutoSyncIntervalMinutes =
      enabled && (intervalMinutes === 15 || intervalMinutes === 30 || intervalMinutes === 60)
        ? intervalMinutes
        : 0;

    patchStoredMegaAuth({
      autoSyncEnabled: normalized > 0,
      autoSyncIntervalMinutes: normalized,
    });

    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }

    if (normalized > 0 && getCurrentData) {
      this.autoSyncTimer = setInterval(() => {
        if (this.isConnected() && (typeof navigator === 'undefined' || navigator.onLine)) {
          this.backup(getCurrentData()).catch(() => {});
        }
      }, normalized * 60 * 1000);
    }
  }
}

export const megaSyncProvider = new MEGASyncProvider();

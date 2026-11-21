/**
 * Phase 1: Pure Offline Local Export, Import & 3-Slot Auto-Snapshot Engine
 *
 * - Zero cloud services, zero external libraries, zero network calls.
 * - Android APK: uses window.JivanAndroidBackup (MediaStore.Downloads + legacy
 *   Environment.getExternalStoragePublicDirectory + context.getFilesDir() +
 *   native Android Share Sheet via Intent.ACTION_SEND).
 * - Web / Windows / Linux / Mac / PWA: triggers browser download + optional Web Share,
 *   and persists rotating snapshot-1.json..snapshot-3.json in offline IndexedDB
 *   (with automatic localStorage fallback).
 */

export type SnapshotFilename = 'snapshot-1.json' | 'snapshot-2.json' | 'snapshot-3.json';

export interface LocalSnapshotMeta {
  slot: 1 | 2 | 3;
  filename: SnapshotFilename;
  timestamp: string;
  sizeBytes: number;
}

export interface BackupValidationSummary {
  version: number;
  exportedAt?: string;
  tasksCount: number;
  habitsCount: number;
  billsCount: number;
  medicationsCount: number;
  goalsCount: number;
  sizeBytes: number;
}

export type BackupValidationResult =
  | {
      valid: true;
      data: Record<string, unknown>;
      summary: BackupValidationSummary;
    }
  | {
      valid: false;
      error: string;
    };

export interface LocalExportResult {
  success: boolean;
  filename: string;
  sizeBytes: number;
  platform: 'android' | 'web';
  shared: boolean;
  message: string;
  error?: string;
}

interface AndroidLocalBackupBridge {
  exportBackup: (filename: string, jsonContent: string) => string;
  saveAutoSnapshot: (jsonContent: string) => string;
  listSnapshots: () => string;
  readSnapshot: (filename: string) => string;
}

declare global {
  interface Window {
    JivanAndroidBackup?: AndroidLocalBackupBridge;
  }
}

export const LOCAL_SNAPSHOTS_UPDATED_EVENT = 'jivan_local_snapshots_updated';

const IDB_NAME = 'jivanos_offline_snapshots_db';
const IDB_STORE = 'snapshots';
const LS_FALLBACK_KEY = 'jivanos_local_snapshots_fallback_v1';
const SNAPSHOT_SLOTS: SnapshotFilename[] = [
  'snapshot-1.json',
  'snapshot-2.json',
  'snapshot-3.json',
];

interface StoredSnapshotRecord {
  filename: SnapshotFilename;
  slot: 1 | 2 | 3;
  timestamp: string;
  sizeBytes: number;
  content: string;
}

function getAndroidBridge(): AndroidLocalBackupBridge | null {
  if (typeof window === 'undefined') return null;
  const bridge = window.JivanAndroidBackup;
  if (bridge && typeof bridge.exportBackup === 'function') {
    return bridge;
  }
  return null;
}

export function isAndroidNativeBackupAvailable(): boolean {
  return getAndroidBridge() !== null;
}

export function getUtf8ByteSize(text: string): number {
  try {
    return new TextEncoder().encode(text).length;
  } catch {
    return text.length * 2;
  }
}

/**
 * Generates exact backup filename: JivanOS-backup-YYYY-MM-DD-HHmm.json
 */
export function buildBackupFilename(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `JivanOS-backup-${yyyy}-${mm}-${dd}-${hh}${min}.json`;
}

export function formatSnapshotSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function formatSnapshotTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    const datePart = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${datePart} · ${timePart}`;
  } catch {
    return isoString;
  }
}

/**
 * Validates that a JSON string matches JivanOS's expected backup structure.
 */
export function validateBackupPayload(rawJson: string): BackupValidationResult {
  if (!rawJson || typeof rawJson !== 'string') {
    return { valid: false, error: 'Invalid backup file' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { valid: false, error: 'Invalid backup file' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, error: 'Invalid backup file' };
  }

  const obj = parsed as Record<string, unknown>;

  const arrayKeys = [
    'tasks',
    'habits',
    'routines',
    'goals',
    'medications',
    'doseLogs',
    'bills',
    'scheduleItems',
    'inboxItems',
    'todoLists',
    'listGroups',
    'tags',
    'workflowStages',
    'widgets',
    'favoriteQuoteIds',
    'deletedIds',
  ] as const;

  const objectKeys = ['profile', 'hydration', 'appLock'] as const;

  // Reject if any present core collection has the wrong data type
  for (const key of arrayKeys) {
    if (key in obj && obj[key] !== undefined && !Array.isArray(obj[key])) {
      return { valid: false, error: 'Invalid backup file' };
    }
  }
  for (const key of objectKeys) {
    if (
      key in obj &&
      obj[key] !== undefined &&
      (typeof obj[key] !== 'object' || obj[key] === null || Array.isArray(obj[key]))
    ) {
      return { valid: false, error: 'Invalid backup file' };
    }
  }

  // Must contain core JivanOS collections (tasks/habits/bills/medications) to avoid importing unrelated JSON files
  const coreDomainKeys = ['tasks', 'habits', 'bills', 'medications', 'goals', 'profile', 'routines', 'scheduleItems'];
  const presentCoreCount = coreDomainKeys.filter(k => k in obj).length;
  const hasCoreArrays =
    Array.isArray(obj.tasks) ||
    Array.isArray(obj.habits) ||
    Array.isArray(obj.bills) ||
    Array.isArray(obj.medications);

  if (presentCoreCount < 3 || !hasCoreArrays) {
    return { valid: false, error: 'Invalid backup file' };
  }

  return {
    valid: true,
    data: obj,
    summary: {
      version: typeof obj.version === 'number' ? obj.version : 2,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : undefined,
      tasksCount: Array.isArray(obj.tasks) ? obj.tasks.length : 0,
      habitsCount: Array.isArray(obj.habits) ? obj.habits.length : 0,
      billsCount: Array.isArray(obj.bills) ? obj.bills.length : 0,
      medicationsCount: Array.isArray(obj.medications) ? obj.medications.length : 0,
      goalsCount: Array.isArray(obj.goals) ? obj.goals.length : 0,
      sizeBytes: getUtf8ByteSize(rawJson),
    },
  };
}

/**
 * 1. EXPORT BACKUP
 * - Saves as JivanOS-backup-YYYY-MM-DD-HHmm.json
 * - On Android APK: uses MediaStore API (API 29+) / legacy Downloads fallback + Android Share Sheet
 * - On Desktop / Web: triggers standard file download (and offers Web Share when sharing explicitly)
 */
export async function exportLocalBackup(jsonContent: string): Promise<LocalExportResult> {
  const filename = buildBackupFilename(new Date());
  const sizeBytes = getUtf8ByteSize(jsonContent);

  // Native Android APK path (pure Android MediaStore + Share Sheet)
  const androidBridge = getAndroidBridge();
  if (androidBridge) {
    try {
      const rawRes = androidBridge.exportBackup(filename, jsonContent);
      const parsed = JSON.parse(rawRes || '{}');
      if (parsed.success) {
        return {
          success: true,
          filename: parsed.filename || filename,
          sizeBytes: typeof parsed.sizeBytes === 'number' ? parsed.sizeBytes : sizeBytes,
          platform: 'android',
          shared: Boolean(parsed.shared),
          message: 'Backup saved to Downloads',
        };
      }
      return {
        success: false,
        filename,
        sizeBytes,
        platform: 'android',
        shared: false,
        message: 'Failed to save backup',
        error: parsed.error || 'Android export failed',
      };
    } catch (err: unknown) {
      return {
        success: false,
        filename,
        sizeBytes,
        platform: 'android',
        shared: false,
        message: 'Failed to save backup',
        error: err instanceof Error ? err.message : 'Android export failed',
      };
    }
  }

  // Desktop / Web path: trigger browser download cleanly
  try {
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);

    // Optional native mobile-browser Web Share sheet if supported for files
    let shared = false;
    try {
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof File !== 'undefined'
      ) {
        const shareFile = new File([blob], filename, { type: 'application/json' });
        if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [shareFile] })) {
          // Only trigger Web Share on touch mobile devices where users expect share sheets
          const isMobileUa = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
          if (isMobileUa) {
            await navigator.share({
              title: 'JivanOS Backup',
              text: `JivanOS backup file: ${filename}`,
              files: [shareFile],
            });
            shared = true;
          }
        }
      }
    } catch {
      // User dismissed share sheet or share unavailable; download already succeeded
    }

    return {
      success: true,
      filename,
      sizeBytes,
      platform: 'web',
      shared,
      message: 'Backup saved to Downloads',
    };
  } catch (err: unknown) {
    return {
      success: false,
      filename,
      sizeBytes,
      platform: 'web',
      shared: false,
      message: 'Failed to save backup',
      error: err instanceof Error ? err.message : 'Download failed',
    };
  }
}

// ---------------------------------------------------------------------------
// Offline IndexedDB storage for Web / Desktop 3-slot rotating snapshots
// ---------------------------------------------------------------------------

function openSnapshotsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'filename' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

async function readAllIdbSnapshots(): Promise<StoredSnapshotRecord[]> {
  try {
    const db = await openSnapshotsDb();
    return await new Promise<StoredSnapshotRecord[]>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = (req.result || []) as StoredSnapshotRecord[];
        resolve(rows.sort((a, b) => a.slot - b.slot));
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    // Fallback to localStorage if IndexedDB is blocked (e.g. private browsing)
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? (parsed as StoredSnapshotRecord[]).sort((a, b) => a.slot - b.slot)
        : [];
    } catch {
      return [];
    }
  }
}

async function writeAllIdbSnapshots(records: StoredSnapshotRecord[]): Promise<void> {
  const trimmed = records.slice(0, 3);
  try {
    const db = await openSnapshotsDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.clear();
      for (const rec of trimmed) {
        store.put(rec);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    try {
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore storage quota error on fallback
    }
  }
}

function notifySnapshotsUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LOCAL_SNAPSHOTS_UPDATED_EVENT));
  }
}

/**
 * 3. AUTO-SNAPSHOT (silent, rotating 3 slots)
 * Always keeps at most 3 snapshots:
 *   snapshot-1.json (newest) -> snapshot-2.json -> snapshot-3.json (oldest)
 */
export async function saveRotatingAutoSnapshot(jsonContent: string): Promise<LocalSnapshotMeta[]> {
  if (!jsonContent) return listLocalSnapshots();

  // Native Android private storage (context.getFilesDir())
  const androidBridge = getAndroidBridge();
  if (androidBridge) {
    try {
      const rawRes = androidBridge.saveAutoSnapshot(jsonContent);
      const parsed = JSON.parse(rawRes || '{}');
      notifySnapshotsUpdated();
      if (Array.isArray(parsed.snapshots)) {
        return parsed.snapshots as LocalSnapshotMeta[];
      }
    } catch {
      // Fall through to listSnapshots
    }
    return listLocalSnapshots();
  }

  // Web / Desktop offline IndexedDB rotating 3 slots
  const existing = await readAllIdbSnapshots();
  const byName = new Map<SnapshotFilename, StoredSnapshotRecord>();
  for (const item of existing) {
    byName.set(item.filename, item);
  }

  const nextRecords: StoredSnapshotRecord[] = [];

  // Slot 1: newest snapshot
  nextRecords.push({
    slot: 1,
    filename: 'snapshot-1.json',
    timestamp: new Date().toISOString(),
    sizeBytes: getUtf8ByteSize(jsonContent),
    content: jsonContent,
  });

  // Previous snapshot-1 -> snapshot-2
  const prev1 = byName.get('snapshot-1.json');
  if (prev1) {
    nextRecords.push({
      ...prev1,
      slot: 2,
      filename: 'snapshot-2.json',
    });
  }

  // Previous snapshot-2 -> snapshot-3 (previous snapshot-3 is automatically dropped)
  const prev2 = byName.get('snapshot-2.json');
  if (prev2) {
    nextRecords.push({
      ...prev2,
      slot: 3,
      filename: 'snapshot-3.json',
    });
  }

  await writeAllIdbSnapshots(nextRecords);
  notifySnapshotsUpdated();

  return nextRecords.map(({ slot, filename, timestamp, sizeBytes }) => ({
    slot,
    filename,
    timestamp,
    sizeBytes,
  }));
}

/**
 * 4. LIST LAST 3 LOCAL SNAPSHOTS
 */
export async function listLocalSnapshots(): Promise<LocalSnapshotMeta[]> {
  const androidBridge = getAndroidBridge();
  if (androidBridge) {
    try {
      const raw = androidBridge.listSnapshots();
      const parsed = JSON.parse(raw || '[]');
      if (Array.isArray(parsed)) {
        return (parsed as LocalSnapshotMeta[])
          .filter(item => SNAPSHOT_SLOTS.includes(item.filename))
          .sort((a, b) => a.slot - b.slot)
          .slice(0, 3);
      }
    } catch {
      return [];
    }
    return [];
  }

  const records = await readAllIdbSnapshots();
  return records
    .filter(item => SNAPSHOT_SLOTS.includes(item.filename))
    .sort((a, b) => a.slot - b.slot)
    .slice(0, 3)
    .map(({ slot, filename, timestamp, sizeBytes }) => ({
      slot,
      filename,
      timestamp,
      sizeBytes,
    }));
}

/**
 * 4. READ A SPECIFIC SNAPSHOT FOR RESTORE
 */
export async function readLocalSnapshot(filename: SnapshotFilename): Promise<string | null> {
  if (!SNAPSHOT_SLOTS.includes(filename)) return null;

  const androidBridge = getAndroidBridge();
  if (androidBridge) {
    try {
      const content = androidBridge.readSnapshot(filename);
      return content && content.trim().length > 0 ? content : null;
    } catch {
      return null;
    }
  }

  const records = await readAllIdbSnapshots();
  const match = records.find(r => r.filename === filename);
  return match?.content || null;
}

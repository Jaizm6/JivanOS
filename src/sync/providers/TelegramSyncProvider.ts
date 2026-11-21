/**
 * Phase 5B — Telegram Bot SyncProvider (FREE, Private Bot Chat Storage)
 *
 * How it works:
 * 1. User creates a private bot via @BotFather and pastes only the Bot Token.
 * 2. JivanOS validates via GET api.telegram.org/bot{token}/getMe, auto-detects chat.id
 *    via getUpdates, and sends "✅ JivanOS connected".
 * 3. Backups are uploaded as `backup.json` documents via POST sendDocument.
 * 4. Restores inspect recent getUpdates (.json documents) and fall back to the cached
 *    `lastBackupFileId` in localStorage when backups are older than Telegram's 24h update window.
 *
 * SECURITY:
 * - Never logs `botToken` to console or includes it in thrown error messages.
 * - All data remains inside the user's own private Telegram bot chat.
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
import { KeychainService, isDesktop } from '../../desktop/KeychainService';
import { sendDesktopSyncNotification, updateTraySyncTooltip } from '../../desktop/TrayService';

export const TELEGRAM_AUTH_STORAGE_KEY = 'jivanos_telegram_auth';
export const TELEGRAM_SYNC_STATE_EVENT = 'jivanos:telegram-sync-updated';

export interface StoredTelegramAuth {
  botToken: string;
  chatId: string;
  botUsername: string;
  lastSyncedAt: string | null;
  lastBackupFileId: string | null;
  lastFileSizeBytes: number | null;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: AutoSyncIntervalMinutes;
  lastError: string | null;
}

function emitTelegramStateUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TELEGRAM_SYNC_STATE_EVENT));
  }
}

/**
 * Redacts any Telegram bot token pattern before exposing an error message to UI/logs.
 */
function sanitizeTelegramError(message: string): string {
  return String(message || 'Telegram sync error.')
    .replace(/bot\d+:[A-Za-z0-9_-]+/gi, 'bot[REDACTED]')
    .replace(/\d{6,}:[A-Za-z0-9_-]{20,}/g, '[REDACTED]');
}

export function getStoredTelegramAuth(): StoredTelegramAuth | null {
  try {
    const raw = localStorage.getItem(TELEGRAM_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    // On Tauri desktop, botToken is stored in OS Keychain (mirrored in memory cache after hydrate)
    const tokenFromKeychain = isDesktop() ? KeychainService.getCachedTokenSync('telegram') : null;
    const resolvedToken = tokenFromKeychain || (typeof parsed.botToken === 'string' ? parsed.botToken : '');
    if (!parsed.chatId || (!resolvedToken && !isDesktop())) return null;

    return {
      botToken: resolvedToken,
      chatId: String(parsed.chatId),
      botUsername: String(parsed.botUsername || 'JivanOSBot'),
      lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
      lastBackupFileId:
        typeof parsed.lastBackupFileId === 'string' ? parsed.lastBackupFileId : null,
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

function saveStoredTelegramAuth(authData: StoredTelegramAuth | null): void {
  try {
    if (!authData) {
      localStorage.removeItem(TELEGRAM_AUTH_STORAGE_KEY);
    } else {
      // On desktop, omit raw botToken from localStorage because it lives in OS Keychain
      const payloadToPersist = isDesktop() ? { ...authData, botToken: '' } : authData;
      localStorage.setItem(TELEGRAM_AUTH_STORAGE_KEY, JSON.stringify(payloadToPersist));
    }
  } catch {
    // Ignore storage quota errors
  }
  emitTelegramStateUpdate();
}

async function resolveTelegramBotToken(stored: StoredTelegramAuth | null): Promise<string | null> {
  if (!stored) return null;
  if (isDesktop()) {
    const keychainToken = await KeychainService.getToken('telegram');
    if (keychainToken) return keychainToken;
  }
  return stored.botToken || null;
}

function patchStoredTelegramAuth(patch: Partial<StoredTelegramAuth>): StoredTelegramAuth | null {
  const existing = getStoredTelegramAuth();
  if (!existing) return null;
  const next = { ...existing, ...patch };
  saveStoredTelegramAuth(next);
  return next;
}

function parseTimestampFromCaption(caption?: string | null): string | null {
  if (!caption) return null;
  const isoMatch = caption.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/);
  return isoMatch ? isoMatch[0] : null;
}

async function telegramApiJson<T = any>(
  botToken: string,
  method: string,
  init?: RequestInit
): Promise<T> {
  const cleanToken = botToken.trim();
  const url = `https://api.telegram.org/bot${cleanToken}/${method}`;
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error('Could not reach Telegram Bot API. Check your internet connection.');
  }
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Telegram API returned HTTP ${res.status}.`);
  }
  if (!res.ok || !json?.ok) {
    const desc = sanitizeTelegramError(json?.description || `HTTP ${res.status}`);
    if (res.status === 401 || res.status === 404) {
      throw new Error('Invalid Telegram Bot Token. Double-check the token from @BotFather.');
    }
    throw new Error(`Telegram error: ${desc}`);
  }
  return json.result as T;
}

async function downloadTelegramFileText(botToken: string, filePath: string): Promise<string> {
  const cleanToken = botToken.trim();
  const cleanPath = filePath.replace(/^\/+/, '');
  const directUrl = `https://api.telegram.org/file/bot${cleanToken}/${cleanPath}`;

  try {
    const directRes = await fetch(directUrl);
    if (directRes.ok) {
      return await directRes.text();
    }
  } catch {
    // Browser CORS can block api.telegram.org/file downloads; fall back to stateless server proxy
  }

  const proxyRes = await fetch('/api/sync/telegram-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ botToken: cleanToken, filePath: cleanPath }),
  });
  if (!proxyRes.ok) {
    throw new Error(`Could not download backup file from Telegram (HTTP ${proxyRes.status}).`);
  }
  return await proxyRes.text();
}

export class TelegramSyncProvider implements SyncProvider {
  readonly id = 'telegram' as const;
  readonly displayName = 'Telegram';

  private autoSyncTimer: ReturnType<typeof setInterval> | null = null;

  get platform(): SyncPlatform {
    return detectSyncPlatform();
  }

  isConnected(): boolean {
    const stored = getStoredTelegramAuth();
    return Boolean(stored?.botToken && stored?.chatId);
  }

  /**
   * Connects a Telegram bot using ONLY the Bot Token from @BotFather:
   * 1. Verifies token via getMe
   * 2. Auto-detects private chat.id via getUpdates
   * 3. Sends "✅ JivanOS connected" confirmation message
   * 4. Stores { botToken, chatId, botUsername } in localStorage
   */
  async connect(botToken?: string): Promise<SyncAccount> {
    const cleanToken = (botToken || '').trim();
    if (!cleanToken) {
      throw new Error('Paste your Bot Token from @BotFather to connect Telegram.');
    }
    if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(cleanToken)) {
      throw new Error('Bot Token format looks invalid. Copy the full token from @BotFather.');
    }

    // 1. Verify bot token via getMe
    const me = await telegramApiJson<{ id: number; username?: string; first_name?: string }>(
      cleanToken,
      'getMe'
    );
    const botUsername = me.username || me.first_name || 'JivanOSBot';

    // 2. Auto-detect user's Chat ID via getUpdates
    const updates = await telegramApiJson<any[]>(cleanToken, 'getUpdates?limit=100');
    let detectedChatId: string | null = null;
    if (Array.isArray(updates) && updates.length > 0) {
      // Prefer the first private message chat, falling back to any update's chat.id
      for (const upd of updates) {
        const msg = upd?.message || upd?.edited_message || upd?.channel_post;
        if (msg?.chat?.id !== undefined && msg?.chat?.type === 'private') {
          detectedChatId = String(msg.chat.id);
          break;
        }
      }
      if (!detectedChatId) {
        for (const upd of updates) {
          const msg = upd?.message || upd?.edited_message || upd?.channel_post;
          if (msg?.chat?.id !== undefined) {
            detectedChatId = String(msg.chat.id);
            break;
          }
        }
      }
    }

    if (!detectedChatId) {
      throw new Error(
        `Open @${botUsername} in Telegram and tap "Start" (or send /start) once, then tap Connect again so JivanOS can auto-detect your private chat.`
      );
    }

    // 3. Send welcome confirmation message
    await telegramApiJson(cleanToken, 'sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: detectedChatId,
        text: '✅ JivanOS connected',
      }),
    });

    // 4. Persist botToken in OS Keychain on desktop (or localStorage on web/Android)
    if (isDesktop()) {
      await KeychainService.setToken('telegram', cleanToken);
    }
    saveStoredTelegramAuth({
      botToken: cleanToken,
      chatId: detectedChatId,
      botUsername,
      lastSyncedAt: null,
      lastBackupFileId: null,
      lastFileSizeBytes: null,
      autoSyncEnabled: false,
      autoSyncIntervalMinutes: 0,
      lastError: null,
    });

    const handle = `@${botUsername}`;
    return {
      connected: true,
      name: handle,
      email: 'Private Telegram Bot Chat',
      initials: computeInitials(botUsername, 'TG'),
    };
  }

  /**
   * Verifies stored bot token via getMe (hydrates from OS Keychain on desktop).
   */
  async silentReAuth(): Promise<SyncAccount | null> {
    const stored = getStoredTelegramAuth();
    const botToken = await resolveTelegramBotToken(stored);
    if (!stored || !botToken) return null;

    try {
      const me = await telegramApiJson<{ username?: string; first_name?: string }>(
        botToken,
        'getMe'
      );
      const botUsername = me.username || stored.botUsername;
      if (botUsername !== stored.botUsername) {
        patchStoredTelegramAuth({ botUsername, lastError: null });
      }
      return {
        connected: true,
        name: `@${botUsername}`,
        email: 'Private Telegram Bot Chat',
        initials: computeInitials(botUsername, 'TG'),
      };
    } catch {
      // If temporarily offline, keep stored account state usable until next sync
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return {
          connected: true,
          name: `@${stored.botUsername}`,
          email: 'Private Telegram Bot Chat',
          initials: computeInitials(stored.botUsername, 'TG'),
        };
      }
      return null;
    }
  }

  /**
   * Uploads backup.json via POST sendDocument to the user's private bot chat.
   */
  async backup(data: Record<string, unknown>): Promise<SyncInfo> {
    const stored = getStoredTelegramAuth();
    const botToken = await resolveTelegramBotToken(stored);
    if (!stored || !botToken) {
      throw new Error('Connect Telegram first before backing up.');
    }

    const envelope = buildDriveBackupEnvelope(data);
    const payloadJson = JSON.stringify(envelope, null, 2);
    const blob = new Blob([payloadJson], { type: 'application/json' });
    const sizeBytes = blob.size;

    if (sizeBytes > 19 * 1024 * 1024) {
      throw new Error('Backup exceeds Telegram Bot API 20 MB document limit.');
    }

    const iso = envelope.updatedAt;
    const caption = `🔄 JivanOS Backup · ${iso} · ${this.platform}`;

    const formData = new FormData();
    formData.append('chat_id', stored.chatId);
    formData.append('caption', caption);
    formData.append('document', blob, 'backup.json');

    try {
      const sentMessage = await telegramApiJson<{
        document?: { file_id?: string; file_size?: number };
      }>(botToken, 'sendDocument', {
        method: 'POST',
        body: formData,
      });

      const fileId = sentMessage?.document?.file_id || stored.lastBackupFileId;
      const reportedSize = sentMessage?.document?.file_size || sizeBytes;

      patchStoredTelegramAuth({
        lastSyncedAt: iso,
        lastBackupFileId: fileId,
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
    } catch (err: any) {
      const safeMessage = sanitizeTelegramError(err?.message || 'Telegram upload failed.');
      patchStoredTelegramAuth({ lastError: safeMessage });
      if (isDesktop()) {
        void sendDesktopSyncNotification(false);
      }
      throw new Error(safeMessage);
    }
  }

  /**
   * Restores the latest backup.json from Telegram:
   * 1. Checks getUpdates (limit=100) for recent messages with .json document
   * 2. Falls back to stored lastBackupFileId if older than Telegram's 24h update window
   * 3. Calls getFile -> downloads file content -> parses JivanOS backup envelope
   */
  async restore(): Promise<SyncRestoreResult> {
    const stored = getStoredTelegramAuth();
    const botToken = await resolveTelegramBotToken(stored);
    if (!stored || !botToken) {
      throw new Error('Connect Telegram first before restoring.');
    }

    let targetFileId: string | null = null;
    let targetTimestamp: string | null = stored.lastSyncedAt;
    let targetSize = stored.lastFileSizeBytes || 0;

    try {
      const updates = await telegramApiJson<any[]>(botToken, 'getUpdates?limit=100');
      if (Array.isArray(updates)) {
        const jsonDocs = updates
          .map((u) => u?.message || u?.edited_message || u?.channel_post)
          .filter((m) => {
            const fileName = String(m?.document?.file_name || '').toLowerCase();
            return fileName.endsWith('.json') && Boolean(m?.document?.file_id);
          });

        if (jsonDocs.length > 0) {
          const latest = jsonDocs[jsonDocs.length - 1];
          targetFileId = String(latest.document.file_id);
          targetSize = Number(latest.document.file_size || targetSize);
          const parsedCaptionIso = parseTimestampFromCaption(latest.caption);
          if (parsedCaptionIso) {
            targetTimestamp = parsedCaptionIso;
          } else if (typeof latest.date === 'number') {
            targetTimestamp = new Date(latest.date * 1000).toISOString();
          }
        }
      }
    } catch {
      // Fall through to cached lastBackupFileId if getUpdates had a transient issue
    }

    // Fallback for backups older than Telegram's 24h getUpdates window
    if (!targetFileId && stored.lastBackupFileId) {
      targetFileId = stored.lastBackupFileId;
    }

    if (!targetFileId) {
      return { found: false, envelope: null, lastModified: null, fileSizeBytes: 0 };
    }

    const fileMeta = await telegramApiJson<{ file_path?: string; file_size?: number }>(
      botToken,
      `getFile?file_id=${encodeURIComponent(targetFileId)}`
    );
    if (!fileMeta?.file_path) {
      throw new Error('Telegram did not return a downloadable file path for this backup.');
    }

    const rawText = await downloadTelegramFileText(botToken, fileMeta.file_path);
    const envelope = parseDriveBackupEnvelope(rawText);
    if (!envelope) {
      throw new Error('Downloaded Telegram file is not a valid JivanOS JSON backup.');
    }

    const resolvedSize = Number(fileMeta.file_size || targetSize || new Blob([rawText]).size);
    const resolvedTimestamp = targetTimestamp || envelope.updatedAt;

    patchStoredTelegramAuth({
      lastBackupFileId: targetFileId,
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
  }

  async disconnect(): Promise<void> {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }

    const stored = getStoredTelegramAuth();
    const botToken = await resolveTelegramBotToken(stored);
    // Clear OS keychain & local metadata immediately, then send goodbye message best-effort
    if (isDesktop()) {
      await KeychainService.deleteToken('telegram');
    }
    saveStoredTelegramAuth(null);

    if (botToken && stored?.chatId) {
      try {
        await telegramApiJson(botToken, 'sendMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: stored.chatId,
            text: '👋 JivanOS disconnected',
          }),
        });
      } catch {
        // Ignore network errors during disconnect
      }
    }
  }

  async getLastSyncInfo(): Promise<SyncInfo | null> {
    const stored = getStoredTelegramAuth();
    const botToken = await resolveTelegramBotToken(stored);
    if (!stored || !botToken) return null;

    try {
      const updates = await telegramApiJson<any[]>(botToken, 'getUpdates?limit=100');
      if (Array.isArray(updates)) {
        const jsonDocs = updates
          .map((u) => u?.message || u?.edited_message || u?.channel_post)
          .filter((m) => String(m?.document?.file_name || '').toLowerCase().endsWith('.json'));

        if (jsonDocs.length > 0) {
          const latest = jsonDocs[jsonDocs.length - 1];
          const captionTs =
            parseTimestampFromCaption(latest.caption) ||
            (typeof latest.date === 'number'
              ? new Date(latest.date * 1000).toISOString()
              : stored.lastSyncedAt);
          const sizeBytes = Number(latest?.document?.file_size || stored.lastFileSizeBytes || 0);
          const fileId = latest?.document?.file_id
            ? String(latest.document.file_id)
            : stored.lastBackupFileId;

          if (captionTs) {
            patchStoredTelegramAuth({
              lastSyncedAt: captionTs,
              lastFileSizeBytes: sizeBytes,
              lastBackupFileId: fileId,
              lastError: null,
            });
            return { lastModified: captionTs, fileSizeBytes: sizeBytes };
          }
        }
      }
    } catch {
      // Fall back to cached localStorage sync info
    }

    if (stored.lastSyncedAt) {
      return {
        lastModified: stored.lastSyncedAt,
        fileSizeBytes: stored.lastFileSizeBytes || 0,
      };
    }
    return null;
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

    patchStoredTelegramAuth({
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

export const telegramSyncProvider = new TelegramSyncProvider();

/**
 * Phase 5B — Telegram Bot SyncProvider (Direct-First Transport for Android Capacitor, Desktop & Web)
 *
 * How it works:
 * 1. Direct-first transport: calls https://api.telegram.org directly with a 12-second
 *    AbortController timeout (routed natively through CapacitorHttp on Android, direct fetch
 *    on Desktop and Web). Uses /api/sync/telegram-api only as a fallback if direct fetch fails
 *    and the backend proxy endpoint exists.
 * 2. Setup: verifies token via getMe, auto-recovers 409 webhook conflicts via deleteWebhook + retry,
 *    and auto-detects chat.id from getUpdates (with manual Chat ID fallback).
 * 3. Cross-device Backup & Restore: uploads backup.json via sendDocument, pins the backup message
 *    via pinChatMessage (best-effort), and restores via getChat(pinned_message.document.file_id) ->
 *    getUpdates newest .json document -> local lastBackupFileId / lastBackupMessageId fallback.
 *
 * SECURITY:
 * - Never logs `botToken` to console or includes it in thrown error messages.
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
import { isCapacitorNative } from '../../lib/firebase';

export const TELEGRAM_AUTH_STORAGE_KEY = 'jivanos_telegram_auth';
export const TELEGRAM_SYNC_STATE_EVENT = 'jivanos:telegram-sync-updated';

export const TELEGRAM_NO_MESSAGES_PROMPT =
  'Open your bot in Telegram, tap Start, then tap Detect again.';
export const TELEGRAM_NO_BACKUP_FOUND_MESSAGE =
  'No backup found. Send your backup file to the bot, then tap Restore again.';

const DIRECT_TIMEOUT_MS = 12000;

export const TELEGRAM_SYNC_MIN_PUSH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface StoredTelegramAuth {
  botToken: string;
  chatId: string;
  botUsername: string;
  lastSyncedAt: string | null;
  lastBackupFileId: string | null;
  lastBackupMessageId: number | null;
  pinnedSyncMessageId?: number | null;
  lastSyncPushEpochMs?: number | null;
  backupHistoryMessageIds?: number[];
  lastFileSizeBytes: number | null;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: AutoSyncIntervalMinutes;
  lastError: string | null;
}

class TelegramApiError extends Error {
  readonly status: number;
  botUsername?: string;

  constructor(message: string, status = 0, botUsername?: string) {
    super(sanitizeTelegramError(message));
    this.name = 'TelegramApiError';
    this.status = status;
    this.botUsername = botUsername;
  }
}

function emitTelegramStateUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TELEGRAM_SYNC_STATE_EVENT));
  }
}

/**
 * Redacts any Telegram bot token pattern before exposing an error message to UI/logs.
 */
export function sanitizeTelegramError(message: string): string {
  return String(message || 'Telegram sync error.')
    .replace(/bot\d+:[A-Za-z0-9_-]+/gi, 'bot[REDACTED]')
    .replace(/\d{5,}:[A-Za-z0-9_-]{15,}/g, '[REDACTED]');
}

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function mapTelegramHttpError(status: number, rawDescription?: string): TelegramApiError {
  const desc = sanitizeTelegramError(rawDescription || `HTTP ${status}`);

  if (status === 401 || status === 404 || /unauthorized/i.test(desc)) {
    return new TelegramApiError(
      'Invalid bot token (401). Please check your token from @BotFather.',
      401
    );
  }

  if (
    /chat not found|bot can't initiate|bot was blocked|user is deactivated|peer_id_invalid/i.test(
      desc
    )
  ) {
    return new TelegramApiError(
      'Bot not started (chat not found). Open your bot in Telegram and tap Start first.',
      status || 400
    );
  }

  if (status === 409 || /conflict.*webhook/i.test(desc)) {
    return new TelegramApiError(
      'Webhook conflict (409) detected on this bot.',
      409
    );
  }

  return new TelegramApiError(`Telegram error: ${desc}`, status);
}

function mapNetworkOrTimeoutError(err: unknown): TelegramApiError {
  if (err instanceof TelegramApiError) return err;
  if (isBrowserOffline()) {
    return new TelegramApiError(
      'You appear to be offline. Check your internet connection and try again.',
      0
    );
  }
  const name = (err as { name?: string })?.name || '';
  const msg = String((err as { message?: string })?.message || '');
  if (name === 'AbortError' || name === 'TimeoutError' || /timed?\s*out|abort/i.test(msg)) {
    return new TelegramApiError(
      'Telegram connection timed out after 12 seconds. Check your network and try again.',
      408
    );
  }
  return new TelegramApiError(
    'Could not reach Telegram Bot API. Check your internet connection and try again.',
    0
  );
}

export function getStoredTelegramAuth(): StoredTelegramAuth | null {
  try {
    const raw = localStorage.getItem(TELEGRAM_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    // On Tauri desktop, botToken is stored in OS Keychain (mirrored in memory cache after hydrate)
    const tokenFromKeychain = isDesktop() ? KeychainService.getCachedTokenSync('telegram') : null;
    const resolvedToken =
      tokenFromKeychain || (typeof parsed.botToken === 'string' ? parsed.botToken : '');
    if (!parsed.chatId || (!resolvedToken && !isDesktop())) return null;

    const rawHistoryIds = Array.isArray(parsed.backupHistoryMessageIds)
      ? parsed.backupHistoryMessageIds.filter(
          (id: unknown): id is number => typeof id === 'number' && Number.isFinite(id)
        )
      : [];

    return {
      botToken: resolvedToken,
      chatId: String(parsed.chatId),
      botUsername: String(parsed.botUsername || 'JivanOSBot'),
      lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
      lastBackupFileId:
        typeof parsed.lastBackupFileId === 'string' ? parsed.lastBackupFileId : null,
      lastBackupMessageId:
        typeof parsed.lastBackupMessageId === 'number' &&
        Number.isFinite(parsed.lastBackupMessageId)
          ? parsed.lastBackupMessageId
          : null,
      pinnedSyncMessageId:
        typeof parsed.pinnedSyncMessageId === 'number' &&
        Number.isFinite(parsed.pinnedSyncMessageId)
          ? parsed.pinnedSyncMessageId
          : typeof parsed.lastBackupMessageId === 'number' &&
            Number.isFinite(parsed.lastBackupMessageId)
          ? parsed.lastBackupMessageId
          : null,
      lastSyncPushEpochMs:
        typeof parsed.lastSyncPushEpochMs === 'number' &&
        Number.isFinite(parsed.lastSyncPushEpochMs)
          ? parsed.lastSyncPushEpochMs
          : null,
      backupHistoryMessageIds: rawHistoryIds,
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

async function fetchWithTimeout(
  url: string,
  init: RequestInit | undefined,
  timeoutMs = DIRECT_TIMEOUT_MS
): Promise<Response> {
  if (isBrowserOffline()) {
    throw new TelegramApiError(
      'You appear to be offline. Check your internet connection and try again.',
      0
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Backend proxy is strictly a fallback for web browser sessions (never used on Android Capacitor or Desktop).
 */
function canUseServerTelegramProxyFallback(): boolean {
  if (typeof window === 'undefined') return false;
  if (isCapacitorNative() || isDesktop()) return false;
  const proto = window.location?.protocol || '';
  return proto === 'http:' || proto === 'https:';
}

function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const rawBin = atob(base64);
  const bytes = new Uint8Array(rawBin.length);
  for (let i = 0; i < rawBin.length; i++) {
    bytes[i] = rawBin.charCodeAt(i);
  }
  return bytes;
}

interface TelegramRequestOptions {
  params?: Record<string, unknown>;
  file?: { name: string; contentBase64: string; mimeType: string };
}

function buildDirectTelegramInit(
  cleanMethod: string,
  mergedParams: Record<string, unknown>,
  file?: { name: string; contentBase64: string; mimeType: string }
): RequestInit {
  if ((cleanMethod === 'sendDocument' || cleanMethod === 'editMessageMedia') && file) {
    const bytes = base64ToUint8Array(file.contentBase64);
    const fd = new FormData();
    if (cleanMethod === 'editMessageMedia') {
      if (mergedParams.chat_id !== undefined) fd.append('chat_id', String(mergedParams.chat_id));
      if (mergedParams.message_id !== undefined) {
        fd.append('message_id', String(mergedParams.message_id));
      }
      const mediaPayload = {
        type: 'document',
        media: 'attach://document',
        caption: typeof mergedParams.caption === 'string' ? mergedParams.caption : '',
      };
      fd.append('media', JSON.stringify(mediaPayload));
    } else {
      Object.entries(mergedParams).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          fd.append(k, String(v));
        }
      });
    }
    // Use File constructor when available so CapacitorHttp's native FormData bridge
    // preserves fileName ("backup.json") and contentType ("application/json") on Android.
    const filePart =
      typeof File !== 'undefined'
        ? new File([bytes], file.name, { type: file.mimeType })
        : new Blob([bytes], { type: file.mimeType });
    fd.append('document', filePart, file.name);
    return { method: 'POST', body: fd };
  }

  if (Object.keys(mergedParams).length > 0) {
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mergedParams),
    };
  }

  return { method: 'GET' };
}

/**
 * Calls https://api.telegram.org directly FIRST with a 12-second AbortController timeout.
 * Falls back to /api/sync/telegram-api ONLY if the direct call fails with a network/timeout/CORS
 * error and the proxy route exists on the current web host.
 */
async function telegramApiJson<T = any>(
  botToken: string,
  method: string,
  options?: TelegramRequestOptions
): Promise<T> {
  const cleanToken = botToken.trim();
  const [cleanMethod, queryStr] = method.split('?');
  const mergedParams: Record<string, unknown> = { ...(options?.params || {}) };
  if (queryStr) {
    const sp = new URLSearchParams(queryStr);
    sp.forEach((v, k) => {
      if (mergedParams[k] === undefined) {
        const num = Number(v);
        mergedParams[k] = Number.isFinite(num) && v !== '' ? num : v;
      }
    });
  }

  const directUrl = `https://api.telegram.org/bot${cleanToken}/${cleanMethod}`;
  const directInit = buildDirectTelegramInit(cleanMethod, mergedParams, options?.file);

  let res: Response | null = null;
  let directError: unknown = null;

  // 1. Primary path on ALL platforms (Android CapacitorHttp, Desktop, Web): direct call to api.telegram.org
  try {
    res = await fetchWithTimeout(directUrl, directInit, DIRECT_TIMEOUT_MS);
  } catch (err) {
    directError = err;
  }

  // 2. Fallback path: use /api/sync/telegram-api ONLY if direct call failed and proxy exists
  if (!res && canUseServerTelegramProxyFallback() && !isBrowserOffline()) {
    try {
      const proxyRes = await fetchWithTimeout(
        '/api/sync/telegram-api',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botToken: cleanToken,
            method: cleanMethod,
            params: Object.keys(mergedParams).length > 0 ? mergedParams : undefined,
            file: options?.file,
          }),
        },
        DIRECT_TIMEOUT_MS
      );
      if (proxyRes.status !== 404 && proxyRes.status !== 405) {
        res = proxyRes;
      }
    } catch {
      // Preserve original directError below
    }
  }

  if (!res) {
    throw mapNetworkOrTimeoutError(directError);
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    throw mapTelegramHttpError(res.status);
  }

  if (!res.ok || !json?.ok) {
    const errCode = typeof json?.error_code === 'number' ? json.error_code : res.status;
    throw mapTelegramHttpError(errCode, json?.description);
  }

  return json.result as T;
}

/**
 * Downloads a Telegram file directly from https://api.telegram.org/file/bot{token}/{filePath}
 * with a 12-second timeout, using /api/sync/telegram-file only as a fallback if direct fetch fails.
 */
async function downloadTelegramFileText(botToken: string, filePath: string): Promise<string> {
  const cleanToken = botToken.trim();
  const cleanPath = filePath.replace(/^\/+/, '');
  const directUrl = `https://api.telegram.org/file/bot${cleanToken}/${cleanPath}`;

  let directError: unknown = null;
  try {
    const directRes = await fetchWithTimeout(directUrl, { method: 'GET' }, DIRECT_TIMEOUT_MS);
    if (directRes.ok) {
      return await directRes.text();
    }
    if (directRes.status === 401 || directRes.status === 404) {
      throw mapTelegramHttpError(directRes.status);
    }
    directError = new TelegramApiError(
      `Could not download backup file from Telegram (HTTP ${directRes.status}).`,
      directRes.status
    );
  } catch (err) {
    if (err instanceof TelegramApiError && err.status === 401) {
      throw err;
    }
    directError = err;
  }

  // Fallback to server proxy ONLY when direct file download fails (e.g. browser CORS on api.telegram.org/file)
  if (canUseServerTelegramProxyFallback() && !isBrowserOffline()) {
    try {
      const proxyRes = await fetchWithTimeout(
        '/api/sync/telegram-file',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ botToken: cleanToken, filePath: cleanPath }),
        },
        DIRECT_TIMEOUT_MS
      );
      if (proxyRes.ok) {
        return await proxyRes.text();
      }
    } catch {
      // Rethrow directError below
    }
  }

  throw mapNetworkOrTimeoutError(directError);
}

/**
 * Calls getUpdates and automatically recovers from HTTP 409 webhook conflicts by calling
 * deleteWebhook once and retrying getUpdates.
 */
async function fetchUpdatesWithWebhookRecovery(botToken: string): Promise<any[]> {
  try {
    const updates = await telegramApiJson<any[]>(botToken, 'getUpdates', {
      params: { limit: 100 },
    });
    return Array.isArray(updates) ? updates : [];
  } catch (err: any) {
    const isConflict =
      (err instanceof TelegramApiError && err.status === 409) ||
      /409|webhook|conflict/i.test(String(err?.message || ''));
    if (!isConflict) {
      throw err;
    }
    await telegramApiJson(botToken, 'deleteWebhook', {
      params: { drop_pending_updates: false },
    });
    const retried = await telegramApiJson<any[]>(botToken, 'getUpdates', {
      params: { limit: 100 },
    });
    return Array.isArray(retried) ? retried : [];
  }
}

interface TelegramPinnedOrRecentDoc {
  fileId: string;
  messageId: number | null;
  fileSizeBytes: number;
  timestampIso: string | null;
}

/**
 * Resolves the latest backup document across devices:
 * 1. Calls getChat and reads pinned_message.document.file_id
 * 2. Falls back to the newest .json document in getUpdates
 * 3. Falls back to locally saved lastBackupFileId / lastBackupMessageId
 */
async function resolveLatestTelegramBackupDoc(
  botToken: string,
  stored: StoredTelegramAuth
): Promise<TelegramPinnedOrRecentDoc | null> {
  // 1. Check pinned_message via getChat (works across devices even after 24h getUpdates expiry)
  try {
    const chat = await telegramApiJson<{
      pinned_message?: {
        message_id?: number;
        date?: number;
        caption?: string;
        document?: {
          file_id?: string;
          file_name?: string;
          file_size?: number;
        };
      };
    }>(botToken, 'getChat', {
      params: { chat_id: stored.chatId },
    });

    const pinned = chat?.pinned_message;
    const pinnedFileId = pinned?.document?.file_id;
    if (pinnedFileId) {
      const ts =
        parseTimestampFromCaption(pinned?.caption) ||
        (typeof pinned?.date === 'number'
          ? new Date(pinned.date * 1000).toISOString()
          : stored.lastSyncedAt);
      return {
        fileId: String(pinnedFileId),
        messageId: typeof pinned?.message_id === 'number' ? pinned.message_id : stored.lastBackupMessageId,
        fileSizeBytes: Number(pinned?.document?.file_size || stored.lastFileSizeBytes || 0),
        timestampIso: ts,
      };
    }
  } catch {
    // Proceed to getUpdates fallback if getChat fails or has no pinned message
  }

  // 2. Fall back to newest .json document in getUpdates
  try {
    const updates = await fetchUpdatesWithWebhookRecovery(botToken);
    const jsonDocs = updates
      .map((u) => u?.message || u?.edited_message || u?.channel_post)
      .filter((m) => {
        const fileName = String(m?.document?.file_name || '').toLowerCase();
        return fileName.endsWith('.json') && Boolean(m?.document?.file_id);
      });

    if (jsonDocs.length > 0) {
      const latest = jsonDocs[jsonDocs.length - 1];
      const ts =
        parseTimestampFromCaption(latest.caption) ||
        (typeof latest.date === 'number'
          ? new Date(latest.date * 1000).toISOString()
          : stored.lastSyncedAt);
      return {
        fileId: String(latest.document.file_id),
        messageId:
          typeof latest.message_id === 'number' ? latest.message_id : stored.lastBackupMessageId,
        fileSizeBytes: Number(latest.document.file_size || stored.lastFileSizeBytes || 0),
        timestampIso: ts,
      };
    }
  } catch {
    // Proceed to local lastBackupFileId fallback
  }

  // 3. Second fallback: locally saved lastBackupFileId and lastBackupMessageId
  if (stored.lastBackupFileId) {
    return {
      fileId: stored.lastBackupFileId,
      messageId: stored.lastBackupMessageId,
      fileSizeBytes: stored.lastFileSizeBytes || 0,
      timestampIso: stored.lastSyncedAt,
    };
  }

  return null;
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
   * Verifies a Bot Token via getMe so the UI can display @botUsername.
   */
  async verifyBotToken(botToken: string): Promise<{ botUsername: string; firstName: string }> {
    const cleanToken = (botToken || '').trim();
    if (!cleanToken) {
      throw new TelegramApiError('Paste your Bot Token from @BotFather first.', 400);
    }
    if (!/^\d{5,}:[A-Za-z0-9_-]{20,128}$/.test(cleanToken)) {
      throw new TelegramApiError(
        'Invalid bot token (401). Please check your token from @BotFather.',
        401
      );
    }
    const me = await telegramApiJson<{ id: number; username?: string; first_name?: string }>(
      cleanToken,
      'getMe'
    );
    return {
      botUsername: me.username || '',
      firstName: me.first_name || me.username || 'JivanOSBot',
    };
  }

  /**
   * Connects a Telegram bot using the Bot Token (and optional manual Chat ID fallback):
   * 1. Verifies token via getMe
   * 2. Auto-detects private chat.id via getUpdates (auto-clearing 409 webhook conflicts via deleteWebhook)
   * 3. Sends "✅ JivanOS connected" confirmation message
   * 4. Stores { botToken, chatId, botUsername }
   */
  async connect(botToken?: string, manualChatId?: string): Promise<SyncAccount> {
    const cleanToken = (botToken || '').trim();
    if (!cleanToken) {
      throw new TelegramApiError('Paste your Bot Token from @BotFather to connect Telegram.', 400);
    }
    if (!/^\d{5,}:[A-Za-z0-9_-]{20,128}$/.test(cleanToken)) {
      throw new TelegramApiError(
        'Invalid bot token (401). Please check your token from @BotFather.',
        401
      );
    }

    // 1. Verify bot token via getMe
    const me = await telegramApiJson<{ id: number; username?: string; first_name?: string }>(
      cleanToken,
      'getMe'
    );
    const botUsername = me.username || me.first_name || 'JivanOSBot';

    // 2. Use manual Chat ID if entered, otherwise auto-detect via getUpdates (with 409 deleteWebhook retry)
    let detectedChatId: string | null = null;
    const cleanManualChat = (manualChatId || '').trim();
    if (cleanManualChat) {
      if (!/^-?\d{5,20}$/.test(cleanManualChat)) {
        throw new TelegramApiError(
          'Chat ID should be a number (for example 123456789). Leave it blank to auto-detect.',
          400,
          botUsername
        );
      }
      detectedChatId = cleanManualChat;
    } else {
      const updates = await fetchUpdatesWithWebhookRecovery(cleanToken);
      if (updates.length > 0) {
        for (let i = updates.length - 1; i >= 0; i--) {
          const upd = updates[i];
          const msg = upd?.message || upd?.edited_message || upd?.channel_post;
          if (msg?.chat?.id !== undefined && msg?.chat?.type === 'private') {
            detectedChatId = String(msg.chat.id);
            break;
          }
        }
        if (!detectedChatId) {
          for (let i = updates.length - 1; i >= 0; i--) {
            const upd = updates[i];
            const msg = upd?.message || upd?.edited_message || upd?.channel_post;
            if (msg?.chat?.id !== undefined) {
              detectedChatId = String(msg.chat.id);
              break;
            }
          }
        }
      }
    }

    if (!detectedChatId) {
      throw new TelegramApiError(TELEGRAM_NO_MESSAGES_PROMPT, 404, botUsername);
    }

    // 3. Send welcome confirmation message
    try {
      await telegramApiJson(cleanToken, 'sendMessage', {
        params: {
          chat_id: detectedChatId,
          text: '✅ JivanOS connected! Your encrypted JivanOS backups will be saved in this private chat.',
        },
      });
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (/chat not found|bot not started|bot can't initiate|forbidden/i.test(msg)) {
        throw new TelegramApiError(
          'Bot not started (chat not found). Open your bot in Telegram and tap Start first.',
          400,
          botUsername
        );
      }
      throw err;
    }

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
      lastBackupMessageId: null,
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
      if (isBrowserOffline()) {
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
   * Telegram as SYNC (Push):
   * - Keeps ONE pinned live message with caption "JivanOS sync · <updatedAt> · <deviceId>".
   * - On first sync, sends backup.json and pins it once.
   * - On later syncs, replaces its file in-place with editMessageMedia.
   * - If editMessageMedia fails, sends a new document, pins it, and unpins the old one.
   * - Enforces a maximum push frequency of once every 5 minutes unless force=true.
   */
  async syncPush(
    data: Record<string, unknown>,
    options?: { force?: boolean }
  ): Promise<SyncInfo & { rateLimited?: boolean; nextAllowedInMs?: number }> {
    const stored = getStoredTelegramAuth();
    const botToken = await resolveTelegramBotToken(stored);
    if (!stored || !botToken) {
      throw new Error('Connect Telegram first before syncing.');
    }

    const nowMs = Date.now();
    const lastPushMs = stored.lastSyncPushEpochMs || 0;
    const elapsedMs = nowMs - lastPushMs;
    if (!options?.force && lastPushMs > 0 && elapsedMs < TELEGRAM_SYNC_MIN_PUSH_INTERVAL_MS) {
      const remainingMs = TELEGRAM_SYNC_MIN_PUSH_INTERVAL_MS - elapsedMs;
      return {
        lastModified: stored.lastSyncedAt || new Date().toISOString(),
        fileSizeBytes: stored.lastFileSizeBytes || 0,
        rateLimited: true,
        nextAllowedInMs: remainingMs,
      };
    }

    const envelope = buildDriveBackupEnvelope(data);
    const payloadJson = JSON.stringify(envelope, null, 2);
    const blob = new Blob([payloadJson], { type: 'application/json' });
    const sizeBytes = blob.size;

    if (sizeBytes > 19 * 1024 * 1024) {
      throw new Error('Sync file exceeds Telegram Bot API 20 MB document limit.');
    }

    const iso = envelope.updatedAt;
    const caption = `JivanOS sync · ${iso} · ${envelope.deviceId}`;
    const bytes = new TextEncoder().encode(payloadJson);
    const contentBase64 = arrayBufferToBase64(bytes);

    try {
      // Determine existing pinned sync message ID (from local state or getChat().pinned_message)
      let targetPinnedMsgId: number | null =
        typeof stored.pinnedSyncMessageId === 'number' ? stored.pinnedSyncMessageId : null;

      if (!targetPinnedMsgId) {
        try {
          const chatInfo = await telegramApiJson<{
            pinned_message?: { message_id?: number; caption?: string; document?: { file_id?: string } };
          }>(botToken, 'getChat', { params: { chat_id: stored.chatId } });
          const pinned = chatInfo?.pinned_message;
          if (
            typeof pinned?.message_id === 'number' &&
            pinned?.document?.file_id &&
            (!pinned.caption || /JivanOS/i.test(pinned.caption))
          ) {
            targetPinnedMsgId = pinned.message_id;
          }
        } catch {
          // Ignore getChat failure and proceed to sendDocument
        }
      }

      let finalFileId: string | null = stored.lastBackupFileId;
      let finalMessageId: number | null = targetPinnedMsgId;
      let reportedSize = sizeBytes;
      let editedInPlace = false;

      // 1. Try replacing the pinned live message in-place via editMessageMedia
      if (typeof targetPinnedMsgId === 'number') {
        try {
          const editedMsg = await telegramApiJson<{
            message_id?: number;
            document?: { file_id?: string; file_size?: number };
          }>(botToken, 'editMessageMedia', {
            params: {
              chat_id: stored.chatId,
              message_id: targetPinnedMsgId,
              caption,
            },
            file: {
              name: 'backup.json',
              contentBase64,
              mimeType: 'application/json',
            },
          });
          if (editedMsg) {
            editedInPlace = true;
            finalFileId = editedMsg?.document?.file_id || finalFileId;
            finalMessageId =
              typeof editedMsg?.message_id === 'number' ? editedMsg.message_id : targetPinnedMsgId;
            reportedSize = editedMsg?.document?.file_size || sizeBytes;
          }
        } catch {
          editedInPlace = false;
        }
      }

      // 2. If editMessageMedia failed or no pinned message existed, send new document, pin it, and unpin old one
      if (!editedInPlace) {
        const sentMessage = await telegramApiJson<{
          message_id?: number;
          document?: { file_id?: string; file_size?: number };
        }>(botToken, 'sendDocument', {
          params: {
            chat_id: stored.chatId,
            caption,
          },
          file: {
            name: 'backup.json',
            contentBase64,
            mimeType: 'application/json',
          },
        });

        finalFileId = sentMessage?.document?.file_id || stored.lastBackupFileId;
        finalMessageId =
          typeof sentMessage?.message_id === 'number'
            ? sentMessage.message_id
            : stored.lastBackupMessageId;
        reportedSize = sentMessage?.document?.file_size || sizeBytes;

        if (typeof sentMessage?.message_id === 'number') {
          try {
            await telegramApiJson(botToken, 'pinChatMessage', {
              params: {
                chat_id: stored.chatId,
                message_id: sentMessage.message_id,
                disable_notification: true,
              },
            });
          } catch {
            // If Telegram refuses pinChatMessage in this chat, skip without error
          }

          if (
            typeof targetPinnedMsgId === 'number' &&
            targetPinnedMsgId !== sentMessage.message_id
          ) {
            try {
              await telegramApiJson(botToken, 'unpinChatMessage', {
                params: {
                  chat_id: stored.chatId,
                  message_id: targetPinnedMsgId,
                },
              });
            } catch {
              // Ignore unpin failure
            }
          }
        }
      }

      patchStoredTelegramAuth({
        lastSyncedAt: iso,
        lastBackupFileId: finalFileId,
        lastBackupMessageId: finalMessageId,
        pinnedSyncMessageId: finalMessageId,
        lastSyncPushEpochMs: Date.now(),
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
   * Telegram as SYNC (Pull):
   * - Never calls getUpdates.
   * - Calls getChat, reads pinned_message, compares caption's updatedAt with localLastSyncedAt,
   *   and downloads via getFile ONLY if newer.
   */
  async syncPull(localLastSyncedAt?: string | null): Promise<SyncRestoreResult & { skippedNotNewer?: boolean }> {
    const stored = getStoredTelegramAuth();
    const botToken = await resolveTelegramBotToken(stored);
    if (!stored || !botToken) {
      throw new Error('Connect Telegram first before syncing.');
    }

    const chatInfo = await telegramApiJson<{
      pinned_message?: {
        message_id?: number;
        date?: number;
        edit_date?: number;
        caption?: string;
        document?: {
          file_id?: string;
          file_name?: string;
          file_size?: number;
        };
      };
    }>(botToken, 'getChat', { params: { chat_id: stored.chatId } });

    const pinned = chatInfo?.pinned_message;
    const pinnedDoc = pinned?.document;
    if (!pinned || !pinnedDoc?.file_id) {
      return { found: false, envelope: null, lastModified: null, fileSizeBytes: 0 };
    }

    const captionIso = parseTimestampFromCaption(pinned.caption);
    const fallbackEpoch = pinned.edit_date || pinned.date;
    const remoteIso =
      captionIso ||
      (typeof fallbackEpoch === 'number' ? new Date(fallbackEpoch * 1000).toISOString() : null);

    if (localLastSyncedAt && remoteIso) {
      const localMs = Date.parse(localLastSyncedAt);
      const remoteMs = Date.parse(remoteIso);
      if (Number.isFinite(localMs) && Number.isFinite(remoteMs) && remoteMs <= localMs) {
        return {
          found: true,
          envelope: null,
          lastModified: remoteIso,
          fileSizeBytes: Number(pinnedDoc.file_size || stored.lastFileSizeBytes || 0),
          skippedNotNewer: true,
        };
      }
    }

    const fileMeta = await telegramApiJson<{ file_path?: string; file_size?: number }>(
      botToken,
      'getFile',
      { params: { file_id: pinnedDoc.file_id } }
    );
    if (!fileMeta?.file_path) {
      return { found: false, envelope: null, lastModified: null, fileSizeBytes: 0 };
    }

    const rawText = await downloadTelegramFileText(botToken, fileMeta.file_path);
    const envelope = parseDriveBackupEnvelope(rawText);
    if (!envelope) {
      throw new Error('Pinned Telegram sync file is not a valid JivanOS JSON envelope.');
    }

    const resolvedSize = Number(
      fileMeta.file_size || pinnedDoc.file_size || new Blob([rawText]).size
    );
    const resolvedTimestamp = remoteIso || envelope.updatedAt;

    patchStoredTelegramAuth({
      lastBackupFileId: pinnedDoc.file_id,
      lastBackupMessageId: typeof pinned.message_id === 'number' ? pinned.message_id : stored.lastBackupMessageId,
      pinnedSyncMessageId: typeof pinned.message_id === 'number' ? pinned.message_id : stored.pinnedSyncMessageId,
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

  /**
   * Telegram as BACKUP (History copies, separate from sync):
   * - Sends JivanOS-YYYY-MM-DD-HHmm.json via sendDocument without pinning (never touches the pinned sync message).
   * - Keeps the last 4 backups and calls deleteMessage on older ones (ignoring failures).
   */
  async createHistoryBackup(
    filename: string,
    fileContentString: string
  ): Promise<{ messageId: number | null; fileId: string | null; fileSizeBytes: number }> {
    const stored = getStoredTelegramAuth();
    const botToken = await resolveTelegramBotToken(stored);
    if (!stored || !botToken) {
      throw new Error('Connect Telegram first before backing up.');
    }

    const bytes = new TextEncoder().encode(fileContentString);
    const sizeBytes = bytes.byteLength;
    if (sizeBytes > 19 * 1024 * 1024) {
      throw new Error('Backup exceeds Telegram Bot API 20 MB document limit.');
    }

    const contentBase64 = arrayBufferToBase64(bytes);
    const caption = `📦 JivanOS Backup · ${filename} · ${new Date().toISOString()}`;

    const sentMessage = await telegramApiJson<{
      message_id?: number;
      document?: { file_id?: string; file_size?: number };
    }>(botToken, 'sendDocument', {
      params: {
        chat_id: stored.chatId,
        caption,
      },
      file: {
        name: filename,
        contentBase64,
        mimeType: 'application/json',
      },
    });

    const msgId = typeof sentMessage?.message_id === 'number' ? sentMessage.message_id : null;
    const fileId = sentMessage?.document?.file_id || null;
    const reportedSize = sentMessage?.document?.file_size || sizeBytes;

    // Retention: keep last 4 backup messages; try deleteMessage on older ones and ignore failures
    const existingIds = Array.isArray(stored.backupHistoryMessageIds)
      ? stored.backupHistoryMessageIds.slice()
      : [];
    if (msgId !== null && !existingIds.includes(msgId)) {
      existingIds.push(msgId);
    }

    while (existingIds.length > 4) {
      const oldestMsgId = existingIds.shift();
      if (typeof oldestMsgId === 'number' && oldestMsgId !== stored.pinnedSyncMessageId) {
        try {
          await telegramApiJson(botToken, 'deleteMessage', {
            params: {
              chat_id: stored.chatId,
              message_id: oldestMsgId,
            },
          });
        } catch {
          // Ignore deleteMessage failure (Telegram bots can only delete messages < 48h old)
        }
      }
    }

    patchStoredTelegramAuth({
      backupHistoryMessageIds: existingIds,
      lastError: null,
    });

    return {
      messageId: msgId,
      fileId,
      fileSizeBytes: reportedSize,
    };
  }

  /**
   * Standard SyncProvider.backup() delegates to syncPush with force=true for manual trigger compatibility.
   */
  async backup(data: Record<string, unknown>): Promise<SyncInfo> {
    return this.syncPush(data, { force: true });
  }

  /**
   * Restores the latest backup.json from Telegram across devices:
   * 1. Calls getChat and reads pinned_message.document.file_id
   * 2. If no pinned message, falls back to the newest .json document in getUpdates
   * 3. Uses locally stored lastBackupFileId / lastBackupMessageId as a second fallback
   * 4. Calls getFile -> downloads file content -> parses JivanOS backup envelope
   */
  async restore(): Promise<SyncRestoreResult> {
    const stored = getStoredTelegramAuth();
    const botToken = await resolveTelegramBotToken(stored);
    if (!stored || !botToken) {
      throw new Error('Connect Telegram first before restoring.');
    }

    const resolvedDoc = await resolveLatestTelegramBackupDoc(botToken, stored);
    if (!resolvedDoc?.fileId) {
      return { found: false, envelope: null, lastModified: null, fileSizeBytes: 0 };
    }

    const fileMeta = await telegramApiJson<{ file_path?: string; file_size?: number }>(
      botToken,
      'getFile',
      { params: { file_id: resolvedDoc.fileId } }
    );
    if (!fileMeta?.file_path) {
      throw new Error(TELEGRAM_NO_BACKUP_FOUND_MESSAGE);
    }

    const rawText = await downloadTelegramFileText(botToken, fileMeta.file_path);
    const envelope = parseDriveBackupEnvelope(rawText);
    if (!envelope) {
      throw new Error('Downloaded Telegram file is not a valid JivanOS JSON backup.');
    }

    const resolvedSize = Number(
      fileMeta.file_size || resolvedDoc.fileSizeBytes || new Blob([rawText]).size
    );
    const resolvedTimestamp = resolvedDoc.timestampIso || envelope.updatedAt;

    patchStoredTelegramAuth({
      lastBackupFileId: resolvedDoc.fileId,
      lastBackupMessageId: resolvedDoc.messageId,
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
    if (isDesktop()) {
      await KeychainService.deleteToken('telegram');
    }
    saveStoredTelegramAuth(null);

    if (botToken && stored?.chatId) {
      try {
        await telegramApiJson(botToken, 'sendMessage', {
          params: {
            chat_id: stored.chatId,
            text: '👋 JivanOS disconnected',
          },
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
      const resolved = await resolveLatestTelegramBackupDoc(botToken, stored);
      if (resolved && resolved.timestampIso) {
        patchStoredTelegramAuth({
          lastSyncedAt: resolved.timestampIso,
          lastFileSizeBytes: resolved.fileSizeBytes,
          lastBackupFileId: resolved.fileId,
          lastBackupMessageId: resolved.messageId,
          lastError: null,
        });
        return {
          lastModified: resolved.timestampIso,
          fileSizeBytes: resolved.fileSizeBytes,
        };
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
        if (this.isConnected() && !isBrowserOffline()) {
          this.backup(getCurrentData()).catch(() => {});
        }
      }, normalized * 60 * 1000);
    }
  }
}

export const telegramSyncProvider = new TelegramSyncProvider();

import { CURATED_QUOTES, DEFAULT_QUOTE_CATEGORIES, QuoteCategory, QuoteItem } from '../data/quotes';
import { isCustomQuote } from './quoteText';

export const QUOTE_CUSTOM_KEY = 'omnilife_user_custom_quotes_v5';
export const QUOTE_EDITED_KEY = 'omnilife_edited_quotes_v5';
export const QUOTE_DELETED_KEY = 'omnilife_deleted_quote_ids_v5';
export const QUOTE_FAVORITES_KEY = 'omnilife_favorite_quotes';
export const QUOTE_FAVORITES_LEGACY_KEY = 'omniplan_state_v1_favorite_quotes';
export const QUOTE_CATEGORIES_KEY = 'jivanos_quote_categories_v1';
export const QUOTE_META_KEY = 'jivanos_quote_meta_v1';
export const QUOTE_SAFETY_COPY_KEY = 'jivanos_quote_safety_copy_v1';

const EPOCH_ISO = '1970-01-01T00:00:00.000Z';

export interface QuoteMeta {
  updated: Record<string, string>;
  deleted: Record<string, string>;
  favorites: Record<string, { on: boolean; at: string }>;
}

export interface QuoteSyncData {
  version: 1;
  custom: Record<string, QuoteItem>;
  edits: Record<string, QuoteItem & { updatedAt: string }>;
  deleted: Record<string, string>;
  favorites: Record<string, { on: boolean; at: string }>;
  categories: QuoteCategory[];
}

export interface AppliedQuoteState {
  quotes: QuoteItem[];
  favoriteQuoteIds: string[];
  categoriesRaw: QuoteCategory[];
  deletedIds: string[];
  meta: QuoteMeta;
}

const DEFAULT_CATEGORY_IDS = new Set(DEFAULT_QUOTE_CATEGORIES.map(c => c.id));

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    // Ignore quota / restricted storage errors gracefully
  }
}

function parseIsoMs(iso?: string): number {
  if (!iso || typeof iso !== 'string') return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

export function isProhibitedQuote(q: QuoteItem): boolean {
  const author = (q.author || '').toLowerCase().trim();
  const text = (q.text || '').toLowerCase();
  const source = (q.source || '').toLowerCase();
  if (/abdul\s*kalam/i.test(author)) return false;
  if (
    /\b(mother\s*teresa|ali\s+ibn|ali\s+bin|imam\s+ali|hazrat\s+ali|abi\s+talib|nahj|abu\s+bakr|umar\s+ibn|uthman|rumi|kahlil\s+gibran|khalil\s+gibran|saleh|ahmed\s+yassin|muhammad\s+iqbal|omar\s+khayyam|avicenna|ibn\s+sina|al-ghazali|ghazali)\b/i.test(
      author
    )
  ) {
    return true;
  }
  if (
    /\b(nahj\s+al-balagha|nahjul\s+balagha|quran|hadith|sunnah)\b/i.test(source) ||
    /\b(nahj\s+al-balagha|nahjul\s+balagha|quran|hadith|mother\s*teresa)\b/i.test(text)
  ) {
    return true;
  }
  return false;
}

/**
 * Ensures all 7 default categories exist without overwriting user edits.
 */
export function normalizeQuoteCategories(input: unknown): QuoteCategory[] {
  const byId = new Map<string, QuoteCategory>();

  if (Array.isArray(input)) {
    for (const item of input) {
      if (!item || typeof item !== 'object') continue;
      const raw = item as Partial<QuoteCategory>;
      if (typeof raw.id !== 'string' || !raw.id.trim()) continue;
      const isDef = DEFAULT_CATEGORY_IDS.has(raw.id) || Boolean(raw.isDefault);
      const fallbackDef = DEFAULT_QUOTE_CATEGORIES.find(d => d.id === raw.id);
      const normalized: QuoteCategory = {
        id: raw.id,
        name:
          typeof raw.name === 'string' && raw.name.trim()
            ? raw.name.trim()
            : fallbackDef?.name || raw.id,
        color:
          typeof raw.color === 'string' && raw.color.trim()
            ? raw.color.trim()
            : fallbackDef?.color || 'white',
        order:
          typeof raw.order === 'number' && Number.isFinite(raw.order)
            ? raw.order
            : fallbackDef?.order ?? byId.size,
        isDefault: isDef,
        createdAt:
          typeof raw.createdAt === 'string' && raw.createdAt
            ? raw.createdAt
            : fallbackDef?.createdAt || new Date().toISOString(),
        updatedAt:
          typeof raw.updatedAt === 'string' && raw.updatedAt
            ? raw.updatedAt
            : fallbackDef?.updatedAt || new Date().toISOString(),
      };
      if (typeof raw.deletedAt === 'string' && raw.deletedAt && !isDef) {
        normalized.deletedAt = raw.deletedAt;
      }
      byId.set(normalized.id, normalized);
    }
  }

  for (const def of DEFAULT_QUOTE_CATEGORIES) {
    if (!byId.has(def.id)) {
      byId.set(def.id, { ...def });
    } else {
      const existing = byId.get(def.id)!;
      // Default categories are never removed
      if (existing.deletedAt) {
        const clean = { ...existing, isDefault: true };
        delete clean.deletedAt;
        byId.set(def.id, clean);
      }
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.order - b.order);
}

export function loadStoredQuoteCategories(): QuoteCategory[] {
  const parsed = safeParseJson<unknown>(safeGetItem(QUOTE_CATEGORIES_KEY));
  if (!Array.isArray(parsed)) {
    return DEFAULT_QUOTE_CATEGORIES.map(c => ({ ...c }));
  }
  return normalizeQuoteCategories(parsed);
}

export function saveStoredQuoteCategories(categories: QuoteCategory[]): void {
  safeSetItem(QUOTE_CATEGORIES_KEY, JSON.stringify(categories));
}

export function loadQuoteMeta(): QuoteMeta {
  const parsed = safeParseJson<Partial<QuoteMeta>>(safeGetItem(QUOTE_META_KEY));
  return {
    updated: parsed?.updated && typeof parsed.updated === 'object' ? { ...parsed.updated } : {},
    deleted: parsed?.deleted && typeof parsed.deleted === 'object' ? { ...parsed.deleted } : {},
    favorites:
      parsed?.favorites && typeof parsed.favorites === 'object' ? { ...parsed.favorites } : {},
  };
}

export function saveQuoteMeta(meta: QuoteMeta): void {
  safeSetItem(QUOTE_META_KEY, JSON.stringify(meta));
}

/**
 * One-time safe migration on first load so existing custom quotes, edits,
 * deleted IDs and favourites have deterministic metadata timestamps.
 */
export function ensureQuoteMetaMigrated(): QuoteMeta {
  const meta = loadQuoteMeta();
  const migrationTime = new Date().toISOString();
  let changed = false;

  const deletedArr = safeParseJson<unknown>(safeGetItem(QUOTE_DELETED_KEY));
  if (Array.isArray(deletedArr)) {
    for (const id of deletedArr) {
      if (typeof id === 'string' && id && !meta.deleted[id]) {
        meta.deleted[id] = migrationTime;
        changed = true;
      }
    }
  }

  const favArr = safeParseJson<unknown>(safeGetItem(QUOTE_FAVORITES_KEY));
  if (Array.isArray(favArr)) {
    for (const id of favArr) {
      if (typeof id === 'string' && id && !meta.favorites[id]) {
        meta.favorites[id] = { on: true, at: EPOCH_ISO };
        changed = true;
      }
    }
  }

  const customArr = safeParseJson<unknown>(safeGetItem(QUOTE_CUSTOM_KEY));
  if (Array.isArray(customArr)) {
    let customUpdated = false;
    const normalizedCustom: QuoteItem[] = [];
    for (const raw of customArr) {
      if (!raw || typeof raw !== 'object') continue;
      const q = raw as QuoteItem;
      if (!q.id) continue;
      const effectiveUpdated = q.updatedAt || meta.updated[q.id] || q.createdAt || migrationTime;
      if (!meta.updated[q.id]) {
        meta.updated[q.id] = effectiveUpdated;
        changed = true;
      }
      if (!q.updatedAt) {
        normalizedCustom.push({ ...q, updatedAt: effectiveUpdated });
        customUpdated = true;
      } else {
        normalizedCustom.push(q);
      }
    }
    if (customUpdated) {
      safeSetItem(QUOTE_CUSTOM_KEY, JSON.stringify(normalizedCustom));
    }
  }

  const editedArr = safeParseJson<unknown>(safeGetItem(QUOTE_EDITED_KEY));
  if (Array.isArray(editedArr)) {
    for (const raw of editedArr) {
      if (!raw || typeof raw !== 'object') continue;
      const q = raw as QuoteItem;
      if (!q.id) continue;
      if (!meta.updated[q.id]) {
        meta.updated[q.id] = q.updatedAt || migrationTime;
        changed = true;
      }
    }
  }

  if (changed || safeGetItem(QUOTE_META_KEY) === null) {
    saveQuoteMeta(meta);
  }

  return meta;
}

/**
 * Rebuilds the live quotes array from localStorage + bundled CURATED_QUOTES.
 * Used on initial app mount and after applying a synced/restored QuoteSyncData payload.
 */
export function buildQuotesFromStorage(): QuoteItem[] {
  try {
    try {
      localStorage.removeItem('omnilife_quotes_v3');
      localStorage.removeItem('omnilife_quotes_v2');
      localStorage.removeItem('omnilife_quotes');
    } catch {
      // ignore
    }

    let userCustomQuotes: QuoteItem[] = [];
    const parsedCustom = safeParseJson<unknown>(safeGetItem(QUOTE_CUSTOM_KEY));
    if (Array.isArray(parsedCustom)) {
      userCustomQuotes = (parsedCustom as QuoteItem[]).filter(
        q => q && typeof q.id === 'string' && !isProhibitedQuote(q)
      );
    }

    const editedQuotesMap = new Map<string, QuoteItem>();
    const parsedEdits = safeParseJson<unknown>(safeGetItem(QUOTE_EDITED_KEY));
    if (Array.isArray(parsedEdits)) {
      for (const eq of parsedEdits as QuoteItem[]) {
        if (eq && typeof eq.id === 'string' && !isProhibitedQuote(eq)) {
          editedQuotesMap.set(eq.id, eq);
        }
      }
    }

    const deletedQuoteIds = new Set<string>();
    const parsedDel = safeParseJson<unknown>(safeGetItem(QUOTE_DELETED_KEY));
    if (Array.isArray(parsedDel)) {
      for (const id of parsedDel) {
        if (typeof id === 'string') deletedQuoteIds.add(id);
      }
    }

    const activeCustom = userCustomQuotes.filter(q => !deletedQuoteIds.has(q.id));
    const activeCurated = CURATED_QUOTES.filter(
      q => !isProhibitedQuote(q) && !deletedQuoteIds.has(q.id)
    ).map(q => editedQuotesMap.get(q.id) || q);

    return [...activeCustom, ...activeCurated];
  } catch (e) {
    console.error(e);
    return CURATED_QUOTES.filter(q => !isProhibitedQuote(q));
  }
}

export function readDeletedQuoteIdsFromStorage(): string[] {
  const parsed = safeParseJson<unknown>(safeGetItem(QUOTE_DELETED_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/**
 * 64-bit FNV-1a hash over UTF-8 bytes returning a 16-character lowercase hex string.
 * Designed to match the Rust `content_hash` implementation bit-for-bit.
 */
export function computeFnv1a64Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= BigInt(bytes[i]);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

/**
 * Produces a deterministic canonical JSON string for QuoteSyncData so identical
 * logical states always hash to the exact same value regardless of key order.
 */
export function canonicalizeQuoteSyncData(data: QuoteSyncData): string {
  const customKeys = Object.keys(data.custom || {}).sort();
  const customSorted: Record<string, unknown> = {};
  for (const k of customKeys) {
    const q = data.custom[k];
    if (!q) continue;
    customSorted[k] = {
      id: q.id,
      text: q.text,
      author: q.author,
      category: q.category,
      source: q.source ?? null,
      isCustom: Boolean(q.isCustom),
      createdAt: q.createdAt ?? null,
      updatedAt: q.updatedAt ?? null,
    };
  }

  const editKeys = Object.keys(data.edits || {}).sort();
  const editsSorted: Record<string, unknown> = {};
  for (const k of editKeys) {
    const q = data.edits[k];
    if (!q) continue;
    editsSorted[k] = {
      id: q.id,
      text: q.text,
      author: q.author,
      category: q.category,
      source: q.source ?? null,
      updatedAt: q.updatedAt ?? null,
    };
  }

  const deletedKeys = Object.keys(data.deleted || {}).sort();
  const deletedSorted: Record<string, string> = {};
  for (const k of deletedKeys) {
    deletedSorted[k] = data.deleted[k];
  }

  const favKeys = Object.keys(data.favorites || {}).sort();
  const favSorted: Record<string, { on: boolean; at: string }> = {};
  for (const k of favKeys) {
    const entry = data.favorites[k];
    if (entry) {
      favSorted[k] = { on: Boolean(entry.on), at: String(entry.at || '') };
    }
  }

  const catsSorted = [...(data.categories || [])]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(c => ({
      id: c.id,
      name: c.name,
      color: c.color,
      order: c.order,
      isDefault: Boolean(c.isDefault),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      deletedAt: c.deletedAt ?? null,
    }));

  return JSON.stringify({
    version: 1,
    custom: customSorted,
    edits: editsSorted,
    deleted: deletedSorted,
    favorites: favSorted,
    categories: catsSorted,
  });
}

export function hashQuoteSyncData(data: QuoteSyncData): string {
  return computeFnv1a64Hex(canonicalizeQuoteSyncData(data));
}

/**
 * Builds the QuoteSyncData payload from localStorage (excluding the 2,822 built-in quotes).
 */
export function buildQuoteSyncData(): QuoteSyncData {
  const meta = ensureQuoteMetaMigrated();
  const nowFallback = new Date().toISOString();

  const custom: Record<string, QuoteItem> = {};
  const parsedCustom = safeParseJson<unknown>(safeGetItem(QUOTE_CUSTOM_KEY));
  if (Array.isArray(parsedCustom)) {
    for (const raw of parsedCustom) {
      if (!raw || typeof raw !== 'object') continue;
      const q = raw as QuoteItem;
      if (!q.id || !isCustomQuote(q)) continue;
      const updatedAt = q.updatedAt || meta.updated[q.id] || q.createdAt || nowFallback;
      custom[q.id] = {
        ...q,
        isCustom: true,
        updatedAt,
      };
    }
  }

  const edits: Record<string, QuoteItem & { updatedAt: string }> = {};
  const parsedEdits = safeParseJson<unknown>(safeGetItem(QUOTE_EDITED_KEY));
  if (Array.isArray(parsedEdits)) {
    for (const raw of parsedEdits) {
      if (!raw || typeof raw !== 'object') continue;
      const q = raw as QuoteItem;
      if (!q.id || isCustomQuote(q)) continue;
      const updatedAt = q.updatedAt || meta.updated[q.id] || nowFallback;
      edits[q.id] = {
        ...q,
        updatedAt,
      };
    }
  }

  const deleted: Record<string, string> = { ...meta.deleted };
  const parsedDel = safeParseJson<unknown>(safeGetItem(QUOTE_DELETED_KEY));
  if (Array.isArray(parsedDel)) {
    for (const id of parsedDel) {
      if (typeof id === 'string' && id && !deleted[id]) {
        deleted[id] = nowFallback;
      }
    }
  }

  const favorites: Record<string, { on: boolean; at: string }> = { ...meta.favorites };
  const parsedFavs = safeParseJson<unknown>(safeGetItem(QUOTE_FAVORITES_KEY));
  if (Array.isArray(parsedFavs)) {
    for (const id of parsedFavs) {
      if (typeof id === 'string' && id && !favorites[id]) {
        favorites[id] = { on: true, at: EPOCH_ISO };
      }
    }
  }

  const categories = loadStoredQuoteCategories();

  return {
    version: 1,
    custom,
    edits,
    deleted,
    favorites,
    categories,
  };
}

function isValidQuoteSyncData(val: unknown): val is QuoteSyncData {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  const obj = val as Record<string, unknown>;
  return (
    obj.version === 1 ||
    (typeof obj.custom === 'object' && obj.custom !== null) ||
    (typeof obj.edits === 'object' && obj.edits !== null) ||
    (typeof obj.deleted === 'object' && obj.deleted !== null) ||
    (typeof obj.favorites === 'object' && obj.favorites !== null) ||
    Array.isArray(obj.categories)
  );
}

function sanitizeQuoteSyncData(raw: Partial<QuoteSyncData>): QuoteSyncData {
  const custom: Record<string, QuoteItem> = {};
  if (raw.custom && typeof raw.custom === 'object') {
    for (const [id, q] of Object.entries(raw.custom)) {
      if (q && typeof q === 'object' && typeof q.id === 'string' && typeof q.text === 'string') {
        custom[id] = { ...q, isCustom: true };
      }
    }
  }

  const edits: Record<string, QuoteItem & { updatedAt: string }> = {};
  if (raw.edits && typeof raw.edits === 'object') {
    for (const [id, q] of Object.entries(raw.edits)) {
      if (q && typeof q === 'object' && typeof q.id === 'string' && typeof q.text === 'string') {
        edits[id] = {
          ...q,
          updatedAt: typeof q.updatedAt === 'string' && q.updatedAt ? q.updatedAt : EPOCH_ISO,
        };
      }
    }
  }

  const deleted: Record<string, string> = {};
  if (raw.deleted && typeof raw.deleted === 'object') {
    for (const [id, ts] of Object.entries(raw.deleted)) {
      if (typeof id === 'string' && id && typeof ts === 'string' && ts) {
        deleted[id] = ts;
      }
    }
  }

  const favorites: Record<string, { on: boolean; at: string }> = {};
  if (raw.favorites && typeof raw.favorites === 'object') {
    for (const [id, entry] of Object.entries(raw.favorites)) {
      if (
        typeof id === 'string' &&
        id &&
        entry &&
        typeof entry === 'object' &&
        typeof entry.on === 'boolean'
      ) {
        favorites[id] = {
          on: entry.on,
          at: typeof entry.at === 'string' && entry.at ? entry.at : EPOCH_ISO,
        };
      }
    }
  }

  const categories = normalizeQuoteCategories(raw.categories);

  return {
    version: 1,
    custom,
    edits,
    deleted,
    favorites,
    categories,
  };
}

/**
 * Pure last-change-wins merge for two QuoteSyncData objects.
 * Never throws; if either side is missing or invalid, returns the other side unchanged.
 */
export function mergeQuoteSyncData(
  local: QuoteSyncData | null | undefined,
  remote: QuoteSyncData | null | undefined
): QuoteSyncData {
  try {
    const localValid = isValidQuoteSyncData(local);
    const remoteValid = isValidQuoteSyncData(remote);

    if (!localValid && !remoteValid) {
      return sanitizeQuoteSyncData({});
    }
    if (!localValid && remoteValid) {
      return sanitizeQuoteSyncData(remote);
    }
    if (localValid && !remoteValid) {
      return sanitizeQuoteSyncData(local);
    }

    const L = sanitizeQuoteSyncData(local!);
    const R = sanitizeQuoteSyncData(remote!);

    // 1. Custom quotes: newer updatedAt wins
    const mergedCustom: Record<string, QuoteItem> = { ...L.custom };
    for (const [id, rItem] of Object.entries(R.custom)) {
      const lItem = mergedCustom[id];
      if (!lItem) {
        mergedCustom[id] = rItem;
      } else {
        const lTs = parseIsoMs(lItem.updatedAt || lItem.createdAt);
        const rTs = parseIsoMs(rItem.updatedAt || rItem.createdAt);
        if (rTs > lTs) {
          mergedCustom[id] = rItem;
        }
      }
    }

    // 1b. Edits to built-in quotes: newer updatedAt wins
    const mergedEdits: Record<string, QuoteItem & { updatedAt: string }> = { ...L.edits };
    for (const [id, rItem] of Object.entries(R.edits)) {
      const lItem = mergedEdits[id];
      if (!lItem) {
        mergedEdits[id] = rItem;
      } else {
        const lTs = parseIsoMs(lItem.updatedAt);
        const rTs = parseIsoMs(rItem.updatedAt);
        if (rTs > lTs) {
          mergedEdits[id] = rItem;
        }
      }
    }

    // 2. Deleted: keep OLDEST deletedAt across both sides.
    // A deletion beats a custom quote or edit only if deletedAt >= updatedAt.
    // If the item was re-edited strictly later (updatedAt > deletedAt), the item wins and deletion is dropped.
    const mergedDeleted: Record<string, string> = {};
    const allDeletedIds = new Set([...Object.keys(L.deleted), ...Object.keys(R.deleted)]);
    for (const id of allDeletedIds) {
      const lDel = L.deleted[id];
      const rDel = R.deleted[id];
      let chosenDel: string;
      if (lDel && rDel) {
        chosenDel = parseIsoMs(lDel) <= parseIsoMs(rDel) ? lDel : rDel;
      } else {
        chosenDel = (lDel || rDel)!;
      }

      const delMs = parseIsoMs(chosenDel);
      const customItem = mergedCustom[id];
      const editItem = mergedEdits[id];

      let resurrected = false;
      if (customItem) {
        const itemMs = parseIsoMs(customItem.updatedAt || customItem.createdAt);
        if (itemMs > delMs) {
          resurrected = true;
        } else {
          delete mergedCustom[id];
        }
      }
      if (editItem) {
        const itemMs = parseIsoMs(editItem.updatedAt);
        if (itemMs > delMs) {
          resurrected = true;
        } else {
          delete mergedEdits[id];
        }
      }

      if (!resurrected) {
        mergedDeleted[id] = chosenDel;
      }
    }

    // 3. Favourites: per id, newer 'at' wins (enables unfavouriting sync)
    const mergedFavorites: Record<string, { on: boolean; at: string }> = { ...L.favorites };
    for (const [id, rFav] of Object.entries(R.favorites)) {
      const lFav = mergedFavorites[id];
      if (!lFav) {
        mergedFavorites[id] = rFav;
      } else {
        const lTs = parseIsoMs(lFav.at);
        const rTs = parseIsoMs(rFav.at);
        if (rTs > lTs) {
          mergedFavorites[id] = rFav;
        }
      }
    }

    // 4. Categories: merge by id, newer updatedAt wins; deletedAt on winning side counts as deleted.
    // Default categories (isDefault true) are never removed; if a default arrives deleted, ignore deletion.
    const catMap = new Map<string, QuoteCategory>();
    for (const c of L.categories) {
      catMap.set(c.id, { ...c });
    }
    for (const rCat of R.categories) {
      const lCat = catMap.get(rCat.id);
      if (!lCat) {
        catMap.set(rCat.id, { ...rCat });
      } else {
        const lTs = parseIsoMs(lCat.updatedAt);
        const rTs = parseIsoMs(rCat.updatedAt);
        if (rTs > lTs) {
          catMap.set(rCat.id, { ...rCat });
        }
      }
    }

    const mergedCategories = normalizeQuoteCategories(Array.from(catMap.values()));

    return {
      version: 1,
      custom: mergedCustom,
      edits: mergedEdits,
      deleted: mergedDeleted,
      favorites: mergedFavorites,
      categories: mergedCategories,
    };
  } catch (e) {
    console.error('mergeQuoteSyncData error:', e);
    return isValidQuoteSyncData(local)
      ? sanitizeQuoteSyncData(local)
      : isValidQuoteSyncData(remote)
      ? sanitizeQuoteSyncData(remote)
      : sanitizeQuoteSyncData({});
  }
}

/**
 * Saves a safety snapshot of all raw quote localStorage keys before overwriting.
 */
export function saveQuoteSafetyCopy(): void {
  try {
    const keys = [
      QUOTE_CUSTOM_KEY,
      QUOTE_EDITED_KEY,
      QUOTE_DELETED_KEY,
      QUOTE_FAVORITES_KEY,
      QUOTE_FAVORITES_LEGACY_KEY,
      QUOTE_CATEGORIES_KEY,
      QUOTE_META_KEY,
    ];
    const values: Record<string, string | null> = {};
    for (const k of keys) {
      values[k] = safeGetItem(k);
    }
    safeSetItem(
      QUOTE_SAFETY_COPY_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        values,
      })
    );
  } catch {
    // Non-fatal
  }
}

/**
 * Extracts active favourite quote IDs from a QuoteSyncData object (excluding deleted quotes).
 */
export function deriveFavoriteIdsFromQuoteSyncData(data: QuoteSyncData): string[] {
  const deletedSet = new Set(Object.keys(data.deleted || {}));
  const active: string[] = [];
  for (const [id, entry] of Object.entries(data.favorites || {})) {
    if (entry && entry.on && !deletedSet.has(id)) {
      active.push(id);
    }
  }
  return active;
}

/**
 * Writes merged/restored QuoteSyncData back into localStorage (after saving a safety copy)
 * and returns fresh lists so AppContext can refresh React state without a page reload.
 */
export function applyQuoteSyncData(rawData: QuoteSyncData): AppliedQuoteState {
  const data = sanitizeQuoteSyncData(rawData);

  // Always save safety copy first
  saveQuoteSafetyCopy();

  const customList = Object.values(data.custom).sort((a, b) => {
    const aTs = parseIsoMs(a.createdAt || a.updatedAt);
    const bTs = parseIsoMs(b.createdAt || b.updatedAt);
    return bTs - aTs;
  });
  const editsList = Object.values(data.edits);
  const deletedIds = Object.keys(data.deleted);
  const favoriteQuoteIds = deriveFavoriteIdsFromQuoteSyncData(data);

  const metaUpdated: Record<string, string> = {};
  for (const q of customList) {
    if (q.updatedAt || q.createdAt) {
      metaUpdated[q.id] = q.updatedAt || q.createdAt!;
    }
  }
  for (const q of editsList) {
    if (q.updatedAt) {
      metaUpdated[q.id] = q.updatedAt;
    }
  }

  const meta: QuoteMeta = {
    updated: metaUpdated,
    deleted: { ...data.deleted },
    favorites: { ...data.favorites },
  };

  safeSetItem(QUOTE_CUSTOM_KEY, JSON.stringify(customList));
  safeSetItem(QUOTE_EDITED_KEY, JSON.stringify(editsList));
  safeSetItem(QUOTE_DELETED_KEY, JSON.stringify(deletedIds));
  safeSetItem(QUOTE_FAVORITES_KEY, JSON.stringify(favoriteQuoteIds));
  safeSetItem(QUOTE_FAVORITES_LEGACY_KEY, JSON.stringify(favoriteQuoteIds));
  safeSetItem(QUOTE_CATEGORIES_KEY, JSON.stringify(data.categories));
  safeSetItem(QUOTE_META_KEY, JSON.stringify(meta));

  const quotes = buildQuotesFromStorage();

  return {
    quotes,
    favoriteQuoteIds,
    categoriesRaw: data.categories,
    deletedIds,
    meta,
  };
}

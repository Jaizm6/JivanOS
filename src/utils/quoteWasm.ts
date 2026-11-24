/// <reference types="vite/client" />
import { QuoteCategory, QuoteItem } from '../data/quotes';
import {
  ParsedImportQuote,
  QuoteImportPreview,
  findDuplicateIndicesTS,
  normalizeDuplicateKey,
  parseRawQuoteImportTS,
} from './quoteImport';
import { computeFnv1a64Hex } from './quoteSync';

export interface QuoteWasmModule {
  default: (moduleOrPath?: unknown) => Promise<unknown>;
  parse_import: (text: string, knownCategoriesJson: string) => string;
  find_duplicates: (existingKeys: string[], newKeys: string[]) => Uint32Array;
  content_hash: (json: string) => string;
}

// Vite globs resolve to empty maps when src/wasm has not been compiled yet,
// and automatically bundle the .wasm asset with ?url when present.
const wasmGlueLoaders = import.meta.glob('../wasm/quotes_wasm.js');
const wasmBinaryLoaders = import.meta.glob('../wasm/quotes_wasm_bg.wasm', {
  query: '?url',
  import: 'default',
});

let wasmInstance: QuoteWasmModule | null = null;
let wasmLoadPromise: Promise<QuoteWasmModule | null> | null = null;
let wasmDisabledForSession = false;
let warnedOnce = false;

function warnFallbackOnce(reason: string): void {
  if (warnedOnce) return;
  warnedOnce = true;
  console.warn(`[JivanOS Quotes WASM] Falling back to TypeScript: ${reason}`);
}

const HASH_SELF_TEST_SAMPLES = [
  '',
  '{"version":1,"custom":{},"edits":{},"deleted":{},"favorites":{},"categories":[]}',
  'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन — Bhagavad Gita — naïve café 🚀',
];

function verifyWasmHashParity(mod: QuoteWasmModule): boolean {
  try {
    for (const sample of HASH_SELF_TEST_SAMPLES) {
      const tsHash = computeFnv1a64Hex(sample);
      const wasmHash = mod.content_hash(sample);
      if (tsHash !== wasmHash) {
        warnFallbackOnce(
          `Hash parity mismatch (TS=${tsHash} vs WASM=${wasmHash}); disabling WASM for session.`
        );
        return false;
      }
    }
    return true;
  } catch (err) {
    warnFallbackOnce(`Self-test failed (${err instanceof Error ? err.message : 'unknown error'}).`);
    return false;
  }
}

/**
 * Lazily loads the compiled Rust WASM module once and caches it.
 * Never runs at app startup; returns null and falls back silently to TS on any error.
 */
export async function loadQuoteWasm(): Promise<QuoteWasmModule | null> {
  if (wasmDisabledForSession) return null;
  if (wasmInstance) return wasmInstance;
  if (wasmLoadPromise) return wasmLoadPromise;

  wasmLoadPromise = (async () => {
    try {
      const glueLoader = wasmGlueLoaders['../wasm/quotes_wasm.js'];
      const binLoader = wasmBinaryLoaders['../wasm/quotes_wasm_bg.wasm'];

      if (!glueLoader || !binLoader) {
        wasmDisabledForSession = true;
        warnFallbackOnce('Compiled WASM files are not present in src/wasm/.');
        return null;
      }

      const [glueMod, wasmUrl] = await Promise.all([
        glueLoader() as Promise<QuoteWasmModule>,
        binLoader() as Promise<string>,
      ]);

      if (!glueMod || typeof glueMod.default !== 'function') {
        wasmDisabledForSession = true;
        warnFallbackOnce('WASM glue module is invalid.');
        return null;
      }

      await glueMod.default(wasmUrl);

      if (!verifyWasmHashParity(glueMod)) {
        wasmDisabledForSession = true;
        return null;
      }

      wasmInstance = glueMod;
      return wasmInstance;
    } catch (err) {
      wasmDisabledForSession = true;
      warnFallbackOnce(err instanceof Error ? err.message : 'Failed to initialize WASM module.');
      return null;
    }
  })();

  return wasmLoadPromise;
}

export function isQuoteWasmLoaded(): boolean {
  return wasmInstance !== null && !wasmDisabledForSession;
}

// ============================================================================
// Off-Main-Thread Web Worker Bridge (keeps UI responsive for heavy jobs)
// ============================================================================

type WorkerRequestPayload =
  | {
      type: 'parseImport';
      content: string;
      filename?: string;
      categories: Array<{ id: string; name: string }>;
    }
  | {
      type: 'findDuplicates';
      existingKeys: string[];
      newKeys: string[];
    }
  | {
      type: 'contentHash';
      json: string;
    };

interface WorkerResponseMessage {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

let quoteWorker: Worker | null = null;
let workerFailed = false;
let nextRequestId = 1;
const pendingRequests = new Map<
  number,
  { resolve: (val: unknown) => void; reject: (err: Error) => void }
>();

function getOrCreateWorker(): Worker | null {
  if (workerFailed || typeof window === 'undefined' || typeof Worker === 'undefined') {
    return null;
  }
  if (quoteWorker) return quoteWorker;

  try {
    const worker = new Worker(new URL('../workers/quoteWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<WorkerResponseMessage>) => {
      const msg = e.data;
      if (!msg || typeof msg.id !== 'number') return;
      const pending = pendingRequests.get(msg.id);
      if (!pending) return;
      pendingRequests.delete(msg.id);
      if (msg.ok) {
        pending.resolve(msg.result);
      } else {
        pending.reject(new Error(msg.error || 'Worker job failed'));
      }
    };
    worker.onerror = () => {
      workerFailed = true;
      quoteWorker = null;
      pendingRequests.forEach(p => p.reject(new Error('Quote worker error')));
      pendingRequests.clear();
    };
    quoteWorker = worker;
    return worker;
  } catch {
    workerFailed = true;
    return null;
  }
}

function callQuoteWorker<T>(payload: WorkerRequestPayload): Promise<T | null> {
  const worker = getOrCreateWorker();
  if (!worker) return Promise.resolve(null);

  return new Promise<T | null>(resolve => {
    const id = nextRequestId++;
    pendingRequests.set(id, {
      resolve: val => resolve(val as T),
      reject: () => resolve(null),
    });
    try {
      worker.postMessage({ id, ...payload });
    } catch {
      pendingRequests.delete(id);
      resolve(null);
    }
  });
}

// ============================================================================
// Public Fast Wrappers (Identical Output in WASM and TypeScript Fallback)
// ============================================================================

export async function parseImportFast(
  content: string,
  filename: string | undefined,
  categories: Pick<QuoteCategory, 'id' | 'name'>[]
): Promise<{ rows: ParsedImportQuote[]; emptyCount: number; error?: string }> {
  const catList = categories.map(c => ({ id: c.id, name: c.name }));

  const workerResult = await callQuoteWorker<{
    rows: ParsedImportQuote[];
    emptyCount: number;
    error?: string;
  }>({
    type: 'parseImport',
    content,
    filename,
    categories: catList,
  });
  if (workerResult) {
    return workerResult;
  }

  // Main-thread fallback (try WASM if loaded, else pure TS)
  const mod = await loadQuoteWasm();
  if (mod && !filename?.toLowerCase().endsWith('.json') && !content.trim().startsWith('[')) {
    try {
      const parsedJson = mod.parse_import(content, JSON.stringify(catList));
      const parsed = JSON.parse(parsedJson) as {
        rows?: ParsedImportQuote[];
        emptyCount?: number;
        error?: string;
      };
      if (parsed && Array.isArray(parsed.rows)) {
        return {
          rows: parsed.rows,
          emptyCount: parsed.emptyCount || 0,
          error: parsed.error,
        };
      }
    } catch {
      // Fall through to TypeScript
    }
  }

  return parseRawQuoteImportTS(content, filename, categories);
}

export async function findDuplicatesFast(
  existingKeys: string[],
  newKeys: string[]
): Promise<number[]> {
  const workerResult = await callQuoteWorker<number[]>({
    type: 'findDuplicates',
    existingKeys,
    newKeys,
  });
  if (Array.isArray(workerResult)) {
    return workerResult;
  }

  const mod = await loadQuoteWasm();
  if (mod) {
    try {
      return Array.from(mod.find_duplicates(existingKeys, newKeys));
    } catch {
      // Fall through to TypeScript
    }
  }

  return findDuplicateIndicesTS(existingKeys, newKeys);
}

export async function contentHashFast(json: string): Promise<string> {
  // Always stays synchronous-fast for small strings; uses worker/WASM for larger payloads
  if (json.length >= 16_384) {
    const workerResult = await callQuoteWorker<string>({
      type: 'contentHash',
      json,
    });
    if (typeof workerResult === 'string' && workerResult.length === 16) {
      return workerResult;
    }
  }

  const mod = await loadQuoteWasm();
  if (mod) {
    try {
      const h = mod.content_hash(json);
      if (typeof h === 'string' && h.length === 16) {
        return h;
      }
    } catch {
      // Fall through to TypeScript
    }
  }

  return computeFnv1a64Hex(json);
}

/**
 * Synchronous hash helper that uses WASM immediately if already loaded & verified,
 * otherwise uses the exact same TypeScript FNV-1a 64-bit hash.
 */
export function contentHashSync(json: string): string {
  if (wasmInstance && !wasmDisabledForSession) {
    try {
      const h = wasmInstance.content_hash(json);
      if (typeof h === 'string' && h.length === 16) {
        return h;
      }
    } catch {
      // Fall through to TypeScript
    }
  }
  return computeFnv1a64Hex(json);
}

/**
 * Complete off-main-thread import + duplicate detection pipeline used by the Bulk Import modal.
 */
export async function parseAndDeduplicateImportFast(
  content: string,
  filename: string | undefined,
  existingQuotes: Pick<QuoteItem, 'text' | 'author'>[],
  categories: Pick<QuoteCategory, 'id' | 'name'>[]
): Promise<QuoteImportPreview> {
  const raw = await parseImportFast(content, filename, categories);
  if (raw.error) {
    return {
      items: [],
      skippedCount: 0,
      duplicateCount: 0,
      emptyCount: 0,
      error: raw.error,
    };
  }

  const existingKeys = existingQuotes.map(q => normalizeDuplicateKey(q.text, q.author));
  const newKeys = raw.rows.map(r => normalizeDuplicateKey(r.text, r.author));
  const dupIndices = await findDuplicatesFast(existingKeys, newKeys);
  const dupSet = new Set(dupIndices);

  const items: ParsedImportQuote[] = [];
  for (let i = 0; i < raw.rows.length; i++) {
    if (!dupSet.has(i)) {
      items.push(raw.rows[i]);
    }
  }

  return {
    items,
    duplicateCount: dupSet.size,
    emptyCount: raw.emptyCount,
    skippedCount: dupSet.size + raw.emptyCount,
  };
}

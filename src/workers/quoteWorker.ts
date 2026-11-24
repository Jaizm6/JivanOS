/// <reference types="vite/client" />
import {
  ParsedImportQuote,
  findDuplicateIndicesTS,
  parseRawQuoteImportTS,
} from '../utils/quoteImport';
import { computeFnv1a64Hex } from '../utils/quoteSync';

interface QuoteWasmModule {
  default: (moduleOrPath?: unknown) => Promise<unknown>;
  parse_import: (text: string, knownCategoriesJson: string) => string;
  find_duplicates: (existingKeys: string[], newKeys: string[]) => Uint32Array;
  content_hash: (json: string) => string;
}

const wasmGlueLoaders = import.meta.glob('../wasm/quotes_wasm.js');
const wasmBinaryLoaders = import.meta.glob('../wasm/quotes_wasm_bg.wasm', {
  query: '?url',
  import: 'default',
});

let wasmMod: QuoteWasmModule | null = null;
let wasmInitTried = false;
let wasmDisabled = false;
let warnedOnce = false;

const SELF_TEST_SAMPLES = [
  '',
  '{"version":1,"custom":{},"edits":{},"deleted":{},"favorites":{},"categories":[]}',
  'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन — Bhagavad Gita — naïve café 🚀',
];

function warnOnce(msg: string) {
  if (warnedOnce) return;
  warnedOnce = true;
  console.warn(`[JivanOS QuoteWorker] ${msg}`);
}

async function ensureWorkerWasm(): Promise<QuoteWasmModule | null> {
  if (wasmDisabled) return null;
  if (wasmMod) return wasmMod;
  if (wasmInitTried) return null;
  wasmInitTried = true;

  try {
    const glueLoader = wasmGlueLoaders['../wasm/quotes_wasm.js'];
    const binLoader = wasmBinaryLoaders['../wasm/quotes_wasm_bg.wasm'];
    if (!glueLoader || !binLoader) {
      wasmDisabled = true;
      warnOnce('WASM files not present; using TypeScript inside worker.');
      return null;
    }

    const [glue, wasmUrl] = await Promise.all([
      glueLoader() as Promise<QuoteWasmModule>,
      binLoader() as Promise<string>,
    ]);

    await glue.default(wasmUrl);

    // Startup self-test comparing Rust & TS hashes
    for (const sample of SELF_TEST_SAMPLES) {
      const tsHash = computeFnv1a64Hex(sample);
      const rsHash = glue.content_hash(sample);
      if (tsHash !== rsHash) {
        wasmDisabled = true;
        warnOnce(`Hash parity mismatch (${tsHash} vs ${rsHash}); disabling WASM for session.`);
        return null;
      }
    }

    wasmMod = glue;
    return wasmMod;
  } catch (err) {
    wasmDisabled = true;
    warnOnce(
      `Failed to load WASM (${err instanceof Error ? err.message : 'unknown'}); using TypeScript fallback.`
    );
    return null;
  }
}

type WorkerRequest =
  | {
      id: number;
      type: 'parseImport';
      content: string;
      filename?: string;
      categories: Array<{ id: string; name: string }>;
    }
  | {
      id: number;
      type: 'findDuplicates';
      existingKeys: string[];
      newKeys: string[];
    }
  | {
      id: number;
      type: 'contentHash';
      json: string;
    };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  if (!req || typeof req.id !== 'number') return;
  const reqId = req.id;

  try {
    const mod = await ensureWorkerWasm();

    if (req.type === 'parseImport') {
      const isJson =
        (req.filename || '').toLowerCase().endsWith('.json') || req.content.trim().startsWith('[');
      if (mod && !isJson) {
        try {
          const out = mod.parse_import(req.content, JSON.stringify(req.categories));
          const parsed = JSON.parse(out) as {
            rows?: ParsedImportQuote[];
            emptyCount?: number;
            error?: string;
          };
          if (parsed && Array.isArray(parsed.rows)) {
            self.postMessage({
              id: req.id,
              ok: true,
              result: {
                rows: parsed.rows,
                emptyCount: parsed.emptyCount || 0,
                error: parsed.error,
              },
            });
            return;
          }
        } catch {
          // Fall back to TS below
        }
      }

      const tsResult = parseRawQuoteImportTS(req.content, req.filename, req.categories);
      self.postMessage({ id: req.id, ok: true, result: tsResult });
      return;
    }

    if (req.type === 'findDuplicates') {
      if (mod) {
        try {
          const indices = Array.from(mod.find_duplicates(req.existingKeys, req.newKeys));
          self.postMessage({ id: req.id, ok: true, result: indices });
          return;
        } catch {
          // Fall back to TS below
        }
      }
      const indices = findDuplicateIndicesTS(req.existingKeys, req.newKeys);
      self.postMessage({ id: req.id, ok: true, result: indices });
      return;
    }

    if (req.type === 'contentHash') {
      if (mod) {
        try {
          const h = mod.content_hash(req.json);
          if (typeof h === 'string' && h.length === 16) {
            self.postMessage({ id: req.id, ok: true, result: h });
            return;
          }
        } catch {
          // Fall back to TS below
        }
      }
      const h = computeFnv1a64Hex(req.json);
      self.postMessage({ id: req.id, ok: true, result: h });
      return;
    }

    self.postMessage({ id: reqId, ok: false, error: 'Unknown worker request type' });
  } catch (err) {
    self.postMessage({
      id: reqId,
      ok: false,
      error: err instanceof Error ? err.message : 'Worker execution failed',
    });
  }
};

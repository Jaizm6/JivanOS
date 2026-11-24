/* tslint:disable */
/* eslint-disable */

/**
 * Computes the 64-bit FNV-1a hash of a UTF-8 string and formats it as 16 lowercase hex chars.
 * Matches `computeFnv1a64Hex` in `src/utils/quoteSync.ts` bit-for-bit.
 */
export function content_hash(json: string): string;

/**
 * Returns the 0-based indices into `new_keys` that duplicate any entry in `existing_keys`
 * or an earlier entry in `new_keys`.
 */
export function find_duplicates(existing_keys: string[], new_keys: string[]): Uint32Array;

/**
 * Parses CSV or plain-text quote imports into JSON `{"rows":[...],"emptyCount":N}`.
 * Never panics on malformed input.
 */
export function parse_import(text: string, known_categories_json: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly content_hash: (a: number, b: number, c: number) => void;
    readonly find_duplicates: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly parse_import: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export4: () => number;
    readonly __wbindgen_export5: (a: number, b: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

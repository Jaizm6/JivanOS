import { QuoteCategory, QuoteItem } from '../data/quotes';

export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

export interface ParsedImportQuote {
  text: string;
  author: string;
  category: string;
  source?: string;
}

export interface QuoteImportPreview {
  items: ParsedImportQuote[];
  skippedCount: number;
  duplicateCount: number;
  emptyCount: number;
  error?: string;
}

export function normalizeDuplicateKey(text: string, author: string): string {
  const normText = (text || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const normAuthor = (author || 'Unknown').trim().replace(/\s+/g, ' ').toLowerCase();
  return `${normText}\u0000${normAuthor}`;
}

export function resolveCategoryId(
  raw: string | undefined,
  categories: Pick<QuoteCategory, 'id' | 'name'>[]
): string {
  const trimmed = (raw || '').trim().toLowerCase();
  if (!trimmed) return 'wisdom';
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    if (c.id.toLowerCase() === trimmed || c.name.trim().toLowerCase() === trimmed) {
      return c.id;
    }
  }
  return 'wisdom';
}

/**
 * Returns indices into `newKeys` that duplicate an entry in `existingKeys`
 * or an earlier entry in `newKeys`. Pure TypeScript fallback matching Rust `find_duplicates`.
 */
export function findDuplicateIndicesTS(existingKeys: string[], newKeys: string[]): number[] {
  const seen = new Set<string>(existingKeys);
  const dupIndices: number[] = [];
  for (let i = 0; i < newKeys.length; i++) {
    const key = newKeys[i];
    if (seen.has(key)) {
      dupIndices.push(i);
    } else {
      seen.add(key);
    }
  }
  return dupIndices;
}

function detectCsvDelimiter(content: string): ',' | ';' {
  let inQuotes = false;
  let commaCount = 0;
  let semiCount = 0;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '"') {
      if (inQuotes && content[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes) {
      if (ch === '\n' || ch === '\r') {
        if (commaCount > 0 || semiCount > 0) break;
      } else if (ch === ',') {
        commaCount++;
      } else if (ch === ';') {
        semiCount++;
      }
    }
  }

  return semiCount > commaCount ? ';' : ',';
}

/**
 * RFC-4180 compliant CSV parser supporting:
 * - quoted fields containing commas/semicolons
 * - doubled quotes ("") inside quoted fields
 * - embedded line breaks (\n / \r\n) inside quoted fields
 * - comma or semicolon delimiter
 */
export function parseCsvRows(content: string): string[][] {
  if (!content) return [];
  const clean = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const delimiter = detectCsvDelimiter(clean);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = clean.length;

  while (i < len) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && clean[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
    } else {
      if (ch === '"' && field.length === 0) {
        inQuotes = true;
        i++;
      } else if (ch === delimiter) {
        row.push(field);
        field = '';
        i++;
      } else if (ch === '\r') {
        if (i + 1 < len && clean[i + 1] === '\n') {
          i += 2;
        } else {
          i++;
        }
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

const HEADER_ALIASES: Record<string, 'text' | 'author' | 'category' | 'source'> = {
  quote: 'text',
  text: 'text',
  content: 'text',
  body: 'text',
  author: 'author',
  speaker: 'author',
  by: 'author',
  category: 'category',
  topic: 'category',
  source: 'source',
  book: 'source',
  reference: 'source',
};

interface RawParsedRow {
  text: string;
  author: string;
  category?: string;
  source?: string;
}

function parsePlainTextLines(content: string): { rows: RawParsedRow[]; emptyCount: number } {
  const lines = content.split(/\r?\n/);
  const rows: RawParsedRow[] = [];
  let emptyCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }

    // Split optional "| Category | Source" metadata after author
    let quoteAndAuthor = line;
    let category: string | undefined;
    let source: string | undefined;

    // Split by spaced dash or em/en dash first, then parse trailing | Category | Source from the author segment
    let sepIdx = -1;
    let sepLen = 0;
    const candidates = [' — ', ' – ', ' - ', '—', '–'];
    for (const sep of candidates) {
      const idx = quoteAndAuthor.lastIndexOf(sep);
      if (idx > 0) {
        sepIdx = idx;
        sepLen = sep.length;
        break;
      }
    }

    let textPart = '';
    let authorPart = '';

    if (sepIdx > 0) {
      textPart = quoteAndAuthor.slice(0, sepIdx).trim();
      const tail = quoteAndAuthor.slice(sepIdx + sepLen).trim();
      const pipeParts = tail.split('|').map(p => p.trim());
      authorPart = pipeParts[0] || '';
      if (pipeParts[1]) category = pipeParts[1];
      if (pipeParts[2]) source = pipeParts[2];
    } else {
      const pipeParts = line.split('|').map(p => p.trim());
      textPart = pipeParts[0] || '';
      if (pipeParts[1]) category = pipeParts[1];
      if (pipeParts[2]) source = pipeParts[2];
    }

    textPart = textPart.replace(/^["""]|["""]$/g, '').trim();
    if (!textPart) {
      emptyCount++;
      continue;
    }

    rows.push({
      text: textPart,
      author: authorPart || 'Unknown',
      category,
      source: source || undefined,
    });
  }

  return { rows, emptyCount };
}

function looksLikeCsvHeader(row: string[]): boolean {
  if (!row || row.length < 2) return false;
  let matches = 0;
  for (const cell of row) {
    const key = cell.trim().toLowerCase();
    if (key in HEADER_ALIASES) matches++;
  }
  return matches >= 2;
}

/**
 * Pure TypeScript parser for .csv, .json, .txt, and pasted plain text.
 * Returns normalized rows ready for duplicate filtering.
 */
export function parseRawQuoteImportTS(
  content: string,
  filename: string | undefined,
  categories: Pick<QuoteCategory, 'id' | 'name'>[]
): { rows: ParsedImportQuote[]; emptyCount: number; error?: string } {
  const trimmed = (content || '').trim();
  if (!trimmed) {
    return { rows: [], emptyCount: 0 };
  }

  const lowerName = (filename || '').toLowerCase();

  // 1. JSON mode
  if (lowerName.endsWith('.json') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) {
        return {
          rows: [],
          emptyCount: 0,
          error: 'JSON file must contain an array of quote objects.',
        };
      }
      const rows: ParsedImportQuote[] = [];
      let emptyCount = 0;
      for (const item of parsed) {
        if (!item || typeof item !== 'object') {
          emptyCount++;
          continue;
        }
        const obj = item as Record<string, unknown>;
        const rawText =
          typeof obj.text === 'string'
            ? obj.text
            : typeof obj.quote === 'string'
            ? obj.quote
            : typeof obj.content === 'string'
            ? obj.content
            : '';
        const text = rawText.trim();
        if (!text) {
          emptyCount++;
          continue;
        }
        const author =
          typeof obj.author === 'string' && obj.author.trim() ? obj.author.trim() : 'Unknown';
        const rawCat = typeof obj.category === 'string' ? obj.category : undefined;
        const rawSrc = typeof obj.source === 'string' && obj.source.trim() ? obj.source.trim() : undefined;

        rows.push({
          text,
          author,
          category: resolveCategoryId(rawCat, categories),
          source: rawSrc,
        });
      }
      return { rows, emptyCount };
    } catch {
      return {
        rows: [],
        emptyCount: 0,
        error: 'Could not read JSON file. Please check that it is valid JSON.',
      };
    }
  }

  // 2. CSV mode (explicit .csv extension, or detected CSV header)
  const isCsvFile = lowerName.endsWith('.csv');
  const csvRows = parseCsvRows(content);
  const firstNonEmptyIdx = csvRows.findIndex(r => r.some(cell => cell.trim().length > 0));
  const hasCsvHeader = firstNonEmptyIdx >= 0 && looksLikeCsvHeader(csvRows[firstNonEmptyIdx]);

  if (isCsvFile || hasCsvHeader) {
    const rows: ParsedImportQuote[] = [];
    let emptyCount = 0;

    let textIdx = 0;
    let authorIdx = 1;
    let categoryIdx = 2;
    let sourceIdx = 3;
    let startRow = firstNonEmptyIdx >= 0 ? firstNonEmptyIdx : 0;

    if (hasCsvHeader) {
      const header = csvRows[firstNonEmptyIdx];
      textIdx = -1;
      authorIdx = -1;
      categoryIdx = -1;
      sourceIdx = -1;
      header.forEach((cell, idx) => {
        const mapped = HEADER_ALIASES[cell.trim().toLowerCase()];
        if (mapped === 'text' && textIdx === -1) textIdx = idx;
        else if (mapped === 'author' && authorIdx === -1) authorIdx = idx;
        else if (mapped === 'category' && categoryIdx === -1) categoryIdx = idx;
        else if (mapped === 'source' && sourceIdx === -1) sourceIdx = idx;
      });
      if (textIdx === -1) textIdx = 0;
      startRow = firstNonEmptyIdx + 1;
    }

    for (let r = startRow; r < csvRows.length; r++) {
      const cols = csvRows[r];
      const allBlank = cols.every(c => !c || !c.trim());
      if (allBlank) continue;

      const text = (textIdx >= 0 ? cols[textIdx] || '' : '').trim();
      if (!text) {
        emptyCount++;
        continue;
      }

      const rawAuthor = authorIdx >= 0 ? (cols[authorIdx] || '').trim() : '';
      const rawCat = categoryIdx >= 0 ? (cols[categoryIdx] || '').trim() : '';
      const rawSrc = sourceIdx >= 0 ? (cols[sourceIdx] || '').trim() : '';

      rows.push({
        text,
        author: rawAuthor || 'Unknown',
        category: resolveCategoryId(rawCat, categories),
        source: rawSrc || undefined,
      });
    }

    return { rows, emptyCount };
  }

  // 3. Plain text (.txt or pasted lines)
  const { rows: plainRows, emptyCount } = parsePlainTextLines(content);
  return {
    rows: plainRows.map(r => ({
      text: r.text,
      author: r.author || 'Unknown',
      category: resolveCategoryId(r.category, categories),
      source: r.source,
    })),
    emptyCount,
  };
}

/**
 * Full TypeScript import pipeline: parses content + removes duplicates against
 * existingQuotes and earlier rows in the same batch.
 */
export function parseQuoteImport(
  content: string,
  filename: string | undefined,
  existingQuotes: Pick<QuoteItem, 'text' | 'author'>[],
  categories: Pick<QuoteCategory, 'id' | 'name'>[]
): QuoteImportPreview {
  const raw = parseRawQuoteImportTS(content, filename, categories);
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
  const dupSet = new Set(findDuplicateIndicesTS(existingKeys, newKeys));

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

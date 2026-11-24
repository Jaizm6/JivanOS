import { DEFAULT_QUOTE_CATEGORIES, QuoteCategory, QuoteItem } from '../data/quotes';
import {
  findDuplicateIndicesTS,
  normalizeDuplicateKey,
  parseQuoteImport,
} from './quoteImport';
import { computeFnv1a64Hex } from './quoteSync';

export interface QuoteBenchmarkRow {
  job: string;
  size: number;
  ms: number;
}

function generateSyntheticQuotes(count: number, seedQuotes: QuoteItem[]): QuoteItem[] {
  const base =
    seedQuotes.length > 0
      ? seedQuotes
      : [
          {
            id: 'q_seed_1',
            text: 'Arise, awake, and stop not until the goal is reached.',
            author: 'Swami Vivekananda',
            category: 'discipline',
            source: 'Karma Yoga',
          },
        ];

  const out: QuoteItem[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const template = base[i % base.length];
    out[i] = {
      id: `q_bench_${i + 1}`,
      text: i < base.length ? template.text : `${template.text} (#${i + 1})`,
      author: template.author,
      category: template.category,
      source: template.source,
    };
  }
  return out;
}

function buildCsvSample(quotes: QuoteItem[]): string {
  const lines: string[] = ['Quote,Author,Category,Source'];
  for (let i = 0; i < quotes.length; i++) {
    const q = quotes[i];
    const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
    lines.push(`${esc(q.text)},${esc(q.author)},${esc(q.category)},${esc(q.source || '')}`);
  }
  return lines.join('\n');
}

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/**
 * Benchmarks the TypeScript implementations of all 4 quote-processing jobs
 * at 3 library sizes: the real library (~2,822), 20,000, and 100,000 quotes.
 */
export function runQuoteBenchmarks(
  realQuotes: QuoteItem[],
  categories: QuoteCategory[] = DEFAULT_QUOTE_CATEGORIES
): { rows: QuoteBenchmarkRow[]; summary: string } {
  const realSize = realQuotes.length || 2822;
  const sizes = [realSize, 20_000, 100_000];
  const rows: QuoteBenchmarkRow[] = [];

  for (const size of sizes) {
    const dataset =
      size === realQuotes.length ? realQuotes : generateSyntheticQuotes(size, realQuotes);

    // a) CSV import parse (including duplicate check against empty set)
    const csvSample = buildCsvSample(dataset);
    const tParseStart = nowMs();
    parseQuoteImport(csvSample, 'bench.csv', [], categories);
    const parseMs = Number((nowMs() - tParseStart).toFixed(2));
    rows.push({ job: 'CSV Import Parse', size, ms: parseMs });

    // b) Duplicate detection of N imported rows against N existing quotes
    const existingKeys = dataset.map(q => normalizeDuplicateKey(q.text, q.author));
    const newKeys = dataset.map((q, i) =>
      i % 2 === 0
        ? existingKeys[i]
        : normalizeDuplicateKey(`${q.text} fresh`, q.author)
    );
    const tDupStart = nowMs();
    findDuplicateIndicesTS(existingKeys, newKeys);
    const dupMs = Number((nowMs() - tDupStart).toFixed(2));
    rows.push({ job: 'Duplicate Detection', size, ms: dupMs });

    // c) Stable 64-bit FNV-1a content hash of serialized quote library
    const serialized = JSON.stringify(dataset);
    const tHashStart = nowMs();
    computeFnv1a64Hex(serialized);
    const hashMs = Number((nowMs() - tHashStart).toFixed(2));
    rows.push({ job: 'Content Hash (FNV-1a)', size, ms: hashMs });

    // d) Case-insensitive search across text, author, source (pre-lowercased index)
    const indexed = dataset.map(q => ({
      text: q.text.toLowerCase(),
      author: q.author.toLowerCase(),
      source: (q.source || '').toLowerCase(),
    }));
    const query = 'wisdom';
    const tSearchStart = nowMs();
    let hits = 0;
    for (let i = 0; i < indexed.length; i++) {
      const item = indexed[i];
      if (
        item.text.includes(query) ||
        item.author.includes(query) ||
        item.source.includes(query)
      ) {
        hits++;
      }
    }
    const searchMs = Number((nowMs() - tSearchStart).toFixed(2));
    // Prevent dead-code elimination
    if (hits < 0) console.log(hits);
    rows.push({ job: 'Search (Pre-lowercased)', size, ms: searchMs });
  }

  console.table(rows);

  const at20k = rows.filter(r => r.size === 20_000);
  const summary = at20k.map(r => `${r.job}: ${r.ms}ms`).join(' · ');

  return { rows, summary: `20k bench — ${summary}` };
}

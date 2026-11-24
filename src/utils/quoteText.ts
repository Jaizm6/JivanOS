import { QuoteItem } from '../data/quotes';

export function toSentenceCase(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Formats a quote consistently for sharing and clipboard copying:
 * "<text>" — <author> (<source>)
 * Omits the parenthetical source when none is present.
 */
export function formatQuoteForShare(
  quote: Pick<QuoteItem, 'text' | 'author' | 'source'>
): string {
  const sourcePart = quote.source && quote.source.trim() ? ` (${quote.source.trim()})` : '';
  return `"${quote.text}" — ${quote.author}${sourcePart}`;
}

/**
 * Single source of truth for distinguishing user-created quotes from bundled built-ins.
 */
export function isCustomQuote(q: Pick<QuoteItem, 'id' | 'isCustom'>): boolean {
  return Boolean(q.isCustom || (typeof q.id === 'string' && q.id.startsWith('q_custom_')));
}

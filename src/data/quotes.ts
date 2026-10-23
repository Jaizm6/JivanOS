import rawQuotes from './quotesData.json';

export interface QuoteItem {
  id: string;
  text: string;
  author: string;
  category: 'discipline' | 'mindset' | 'focus' | 'stoicism' | 'health' | 'wisdom' | 'habits';
  source?: string;
  isCustom?: boolean;
  createdAt?: string;
}

export const CURATED_QUOTES: QuoteItem[] = rawQuotes as QuoteItem[];

export const TOTAL_QUOTES_COUNT = CURATED_QUOTES.length;

/**
 * Returns a deterministic pair of 2 daily quotes based on the current date,
 * ensuring 2 fresh, impactful quotes every single day.
 */
export function getDailyQuotesPair(offset: number = 0): [QuoteItem, QuoteItem] {
  if (CURATED_QUOTES.length === 0) {
    const fallback: QuoteItem = {
      id: 'q_fallback',
      text: 'Every action you take is a vote for the person you wish to become.',
      author: 'James Clear',
      category: 'habits',
      source: 'Atomic Habits',
    };
    return [fallback, fallback];
  }

  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );

  const idx1 = (dayOfYear * 2 + offset) % CURATED_QUOTES.length;
  const idx2 = (dayOfYear * 2 + 1 + offset) % CURATED_QUOTES.length;

  return [CURATED_QUOTES[idx1], CURATED_QUOTES[idx2]];
}

export function getRandomQuote(): QuoteItem {
  const index = Math.floor(Math.random() * CURATED_QUOTES.length);
  return CURATED_QUOTES[index];
}

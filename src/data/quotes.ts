import rawQuotes from './quotesData.json';

export interface QuoteItem {
  id: string;
  text: string;
  author: string;
  category: string;
  source?: string;
  isCustom?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface QuoteCategory {
  id: string;
  name: string;
  color: string;
  order: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

const DEFAULT_CATEGORY_SHIP_DATE = '2026-11-23T00:00:00.000Z';

export const DEFAULT_QUOTE_CATEGORIES: QuoteCategory[] = [
  {
    id: 'wisdom',
    name: 'Wisdom',
    color: 'amber',
    order: 0,
    isDefault: true,
    createdAt: DEFAULT_CATEGORY_SHIP_DATE,
    updatedAt: DEFAULT_CATEGORY_SHIP_DATE,
  },
  {
    id: 'discipline',
    name: 'Discipline',
    color: 'rose',
    order: 1,
    isDefault: true,
    createdAt: DEFAULT_CATEGORY_SHIP_DATE,
    updatedAt: DEFAULT_CATEGORY_SHIP_DATE,
  },
  {
    id: 'health',
    name: 'Health',
    color: 'mint',
    order: 2,
    isDefault: true,
    createdAt: DEFAULT_CATEGORY_SHIP_DATE,
    updatedAt: DEFAULT_CATEGORY_SHIP_DATE,
  },
  {
    id: 'focus',
    name: 'Focus',
    color: 'sky',
    order: 3,
    isDefault: true,
    createdAt: DEFAULT_CATEGORY_SHIP_DATE,
    updatedAt: DEFAULT_CATEGORY_SHIP_DATE,
  },
  {
    id: 'mindset',
    name: 'Mindset',
    color: 'lavender',
    order: 4,
    isDefault: true,
    createdAt: DEFAULT_CATEGORY_SHIP_DATE,
    updatedAt: DEFAULT_CATEGORY_SHIP_DATE,
  },
  {
    id: 'stoicism',
    name: 'Stoicism',
    color: 'orchid',
    order: 5,
    isDefault: true,
    createdAt: DEFAULT_CATEGORY_SHIP_DATE,
    updatedAt: DEFAULT_CATEGORY_SHIP_DATE,
  },
  {
    id: 'habits',
    name: 'Habits',
    color: 'peach',
    order: 6,
    isDefault: true,
    createdAt: DEFAULT_CATEGORY_SHIP_DATE,
    updatedAt: DEFAULT_CATEGORY_SHIP_DATE,
  },
];

export const CURATED_QUOTES: QuoteItem[] = (rawQuotes as QuoteItem[]).filter(
  q => !/mother\s*teresa/i.test(q.author || '') && !/mother\s*teresa/i.test(q.text || '')
);

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

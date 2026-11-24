function extractCustomTimestamp(id: string): number {
  if (!id.startsWith('q_custom_')) return Number.MAX_SAFE_INTEGER;
  const parts = id.split('_');
  if (parts.length < 3) return Number.MAX_SAFE_INTEGER;
  const ts = Number(parts[2]);
  return Number.isFinite(ts) ? ts : Number.MAX_SAFE_INTEGER;
}

/**
 * Builds a stable quote ID -> display number map that never shifts when quotes
 * are added, edited, or deleted and remains identical across synced devices.
 *
 * - Built-in quotes keep their 1-based position in the original bundled array (1..builtInIds.length).
 * - Custom quotes (q_custom_<timestamp>_...) are ranked starting at builtInIds.length + 1
 *   across ALL custom IDs ever created (including deleted ones), ordered by creation timestamp
 *   with lexicographical full-ID tie-break.
 * - Unknown ID formats are omitted so cards display no "#" label rather than a wrong number.
 */
export function buildQuoteNumberMap(
  builtInIds: string[],
  customIds: string[],
  deletedIds: string[]
): Map<string, number> {
  const map = new Map<string, number>();

  for (let i = 0; i < builtInIds.length; i++) {
    const id = builtInIds[i];
    if (id) {
      map.set(id, i + 1);
    }
  }

  const allCustomSet = new Set<string>();
  for (let i = 0; i < customIds.length; i++) {
    const id = customIds[i];
    if (id && id.startsWith('q_custom_')) {
      allCustomSet.add(id);
    }
  }
  for (let i = 0; i < deletedIds.length; i++) {
    const id = deletedIds[i];
    if (id && id.startsWith('q_custom_')) {
      allCustomSet.add(id);
    }
  }

  const sortedCustom = Array.from(allCustomSet).sort((a, b) => {
    const tsA = extractCustomTimestamp(a);
    const tsB = extractCustomTimestamp(b);
    if (tsA !== tsB) return tsA - tsB;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const baseOffset = builtInIds.length;
  for (let i = 0; i < sortedCustom.length; i++) {
    map.set(sortedCustom[i], baseOffset + i + 1);
  }

  return map;
}

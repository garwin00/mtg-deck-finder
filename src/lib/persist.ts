import type { CollectionRows } from "./collection";

const KEY = "deck-finder:collection";
const SCORES_KEY = "deck-finder:scores";
const VERSION = 1;

export type StoredCollection = {
  version: number;
  savedAt: number;
  fileName: string;
  /**
   * Card names, not card indices.
   *
   * `owned` is keyed by position in cards.json, and those positions are not
   * stable across builds — inserting one card renumbers everything after it, so
   * a stored index map would silently claim the wrong cards after a weekly data
   * refresh. Names cost more bytes and survive.
   */
  entries: [string, number][];
  added: [string, number][];
  rows: number;
  totalCards: number;
};

/**
 * Written to this device only, never sent anywhere. Every access is guarded:
 * private windows, disabled storage and quota all throw rather than return
 * empty, and none of them should break the app.
 */
export function saveCollection(fileName: string, parsed: CollectionRows): void {
  try {
    const stored: StoredCollection = {
      version: VERSION,
      savedAt: Date.now(),
      fileName,
      entries: [...parsed.entries],
      added: [...parsed.added],
      rows: parsed.rows,
      totalCards: parsed.totalCards,
    };
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Not being able to save is not a reason to fail the upload.
  }
}

export function loadCollection(): StoredCollection | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredCollection;
    if (stored.version !== VERSION || !Array.isArray(stored.entries)) return null;
    return stored;
  } catch {
    return null;
  }
}

export function forgetCollection(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do; the in-memory reset still happens.
  }
}

/** Rows in the shape resolveCollection wants, rebuilt from what was stored. */
export function rowsFrom(stored: StoredCollection): CollectionRows {
  return {
    entries: new Map(stored.entries),
    added: new Map(stored.added),
    rows: stored.rows,
    totalCards: stored.totalCards,
  };
}


/**
 * A content fingerprint of the collection, plus the card index it was resolved
 * against. Cached scores are stored under it, so adding cards — or a weekly
 * data rebuild that moves EDHREC's decklists on — simply misses the cache and
 * the scores are recomputed. Sorted, so a reordered export still matches.
 */
export function fingerprint(parsed: CollectionRows, indexGeneratedAt: string): string {
  const canonical = [...parsed.entries]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([name, count]) => `${name}:${count}`)
    .join("\n");

  // FNV-1a. Not cryptographic, and doesn't need to be: a collision would only
  // reuse scores for a collection that is byte-identical in all but name.
  let hash = 0x811c9dc5;
  const input = `${indexGeneratedAt}\n${canonical}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(36)}-${parsed.entries.size}`;
}

type StoredScores = { version: number; fingerprint: string; scores: [string, number][] };

export function saveScores(key: string, scores: Map<string, number>): void {
  try {
    const stored: StoredScores = { version: VERSION, fingerprint: key, scores: [...scores] };
    localStorage.setItem(SCORES_KEY, JSON.stringify(stored));
  } catch {
    // Scores are a cache; failing to write one is not an error.
  }
}

/** Only returns scores computed for this exact collection and card index. */
export function loadScores(key: string): Map<string, number> | null {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredScores;
    if (stored.version !== VERSION || stored.fingerprint !== key) return null;
    return new Map(stored.scores);
  } catch {
    return null;
  }
}

export function forgetScores(): void {
  try {
    localStorage.removeItem(SCORES_KEY);
  } catch {
    // Nothing to do.
  }
}

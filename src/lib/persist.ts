import type { CollectionRows } from "./collection";

const KEY = "deck-finder:collection";
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

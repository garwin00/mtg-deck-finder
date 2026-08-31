import Papa from "papaparse";
import { lookupKeys, normalise } from "./normalise";
import type { CardIndex } from "./types";

export type Collection = {
  /** Card index -> total quantity owned across every printing and finish. */
  owned: Map<number, number>;
  /** Rows read from the CSV. */
  rows: number;
  /** Sum of quantities. */
  totalCards: number;
  /** Distinct names we couldn't place in the card index (mostly irrelevant cards). */
  unknown: string[];
  /** Names that resolved to a card. */
  distinctMatched: number;
};

const NAME_HEADERS = ["name", "card name", "card", "cardname"];
const QTY_HEADERS = ["quantity", "qty", "count", "amount", "number of copies"];

export class CsvShapeError extends Error {}

/** Find the header a column of interest is under, case- and space-insensitively. */
function pickHeader(headers: string[], candidates: string[]): string | undefined {
  const cleaned = headers.map((h) => ({ raw: h, key: h.trim().toLowerCase() }));
  for (const candidate of candidates) {
    const hit = cleaned.find((h) => h.key === candidate);
    if (hit) return hit.raw;
  }
  // Fall back to a contains match ("Card Name (EN)" and friends).
  for (const candidate of candidates) {
    const hit = cleaned.find((h) => h.key.includes(candidate));
    if (hit) return hit.raw;
  }
  return undefined;
}

type Row = Record<string, string | undefined>;

/**
 * Stream-parse a collection export in a worker and aggregate it against the
 * card index. Multiple printings and finishes of one card collapse into a
 * single owned quantity.
 */
export function parseCollection(file: File, index: CardIndex): Promise<Collection> {
  return new Promise((resolve, reject) => {
    const owned = new Map<number, number>();
    const unknown = new Set<string>();
    let rows = 0;
    let totalCards = 0;
    let nameHeader: string | undefined;
    let qtyHeader: string | undefined;
    let failed = false;

    Papa.parse<Row>(file, {
      header: true,
      worker: true,
      skipEmptyLines: "greedy",
      chunk: (results, parser) => {
        if (!nameHeader) {
          const headers = results.meta.fields ?? [];
          nameHeader = pickHeader(headers, NAME_HEADERS);
          qtyHeader = pickHeader(headers, QTY_HEADERS);
          if (!nameHeader) {
            failed = true;
            parser.abort();
            reject(
              new CsvShapeError(
                `No card-name column found. Looked for one of: ${NAME_HEADERS.join(", ")}. Saw: ${headers.join(", ")}`
              )
            );
            return;
          }
        }
        for (const row of results.data) {
          const rawName = row[nameHeader]?.trim();
          if (!rawName) continue;
          rows++;
          const qty = qtyHeader ? Number.parseInt(row[qtyHeader] ?? "1", 10) : 1;
          const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
          totalCards += quantity;

          const cardIndex = resolve_(rawName, index);
          if (cardIndex === undefined) {
            unknown.add(rawName);
            continue;
          }
          owned.set(cardIndex, (owned.get(cardIndex) ?? 0) + quantity);
        }
      },
      complete: () => {
        if (failed) return;
        resolve({
          owned,
          rows,
          totalCards,
          unknown: [...unknown],
          distinctMatched: owned.size,
        });
      },
      error: (err) => reject(err),
    });
  });
}

/** Resolve one collection name to a card index, tolerating DFC name variants. */
function resolve_(rawName: string, index: CardIndex): number | undefined {
  // ManaBox and friends sometimes use a single slash or an en dash for DFCs.
  const candidates = [rawName, rawName.replace(/\s+[/|–—]\s+/g, " // ")];
  for (const candidate of candidates) {
    for (const key of lookupKeys(candidate)) {
      const hit = index.aliases[key];
      if (hit !== undefined) return hit;
    }
  }
  // Last resort: the leading face of a name we failed to split.
  const firstFace = normalise(rawName.split(/\/\/|\s+[/|]\s+/)[0] ?? "");
  return firstFace ? index.aliases[firstFace] : undefined;
}

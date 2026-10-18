"use client";

import { useState } from "react";
import type { DeckMatch } from "@/lib/match";
import { missingAsText } from "@/lib/match";
import { formatGbp, formatUsd, gbpPrice, tixPrice, usdPrice, type PriceIndex } from "@/lib/prices";
import { button, buttonGhost } from "./ui";

const CARDMARKET_WANTS = "https://www.cardmarket.com/en/Magic/Wants";
const TCGPLAYER_MASSENTRY = "https://www.tcgplayer.com/massentry?productline=Magic";

/**
 * Where to buy the missing cards.
 *
 * Scryfall report prices from three affiliates — Cardmarket, TCGplayer and
 * Cardhoarder — so all three totals come from the bulk file already streamed.
 * Only two have a usable handoff: TCGplayer takes a list in the URL, Cardmarket
 * takes a paste. Cardhoarder is shown as a reference price rather than a button
 * that would promise a handoff there isn't one for.
 */
export function BuyPanel({ match, prices }: { match: DeckMatch; prices: PriceIndex | null }) {
  const [copied, setCopied] = useState(false);
  if (!prices || match.missing.length === 0) return null;

  const totals = { gbp: 0, usd: 0, tix: 0 };
  for (const entry of match.missing) {
    const copies = entry.needed - entry.have;
    totals.gbp += (gbpPrice(prices, entry.cardIndex) ?? 0) * copies;
    totals.usd += (usdPrice(prices, entry.cardIndex) ?? 0) * copies;
    totals.tix += (tixPrice(prices, entry.cardIndex) ?? 0) * copies;
  }

  const list = missingAsText(match);

  const openCardmarket = async () => {
    try {
      await navigator.clipboard.writeText(list);
      setCopied(true);
      setTimeout(() => setCopied(false), 8000);
    } catch {
      // The page is still worth opening without the clipboard.
    }
    window.open(CARDMARKET_WANTS, "_blank", "noopener,noreferrer");
  };

  // TCGplayer reads the list straight from the URL, one entry per `||`.
  const tcgplayerUrl = `${TCGPLAYER_MASSENTRY}&c=${encodeURIComponent(list.split("\n").join("||"))}`;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={openCardmarket}
        className={`w-full justify-between! ${button}`}
      >
        <span>Buy on Cardmarket</span>
        <span className="tabular-nums">~{formatGbp(totals.gbp)}</span>
      </button>
      {copied && (
        <p className="text-xs font-semibold">
          List copied — paste it into the wants field on the tab that just opened, then use their
          Shopping Wizard to spread it across the fewest sellers.
        </p>
      )}

      <a
        href={tcgplayerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`w-full justify-between! ${buttonGhost}`}
      >
        <span>
          Buy on TCGplayer <span className="text-xs text-muted">US</span>
        </span>
        <span className="tabular-nums">~{formatUsd(totals.usd)}</span>
      </a>

      {totals.tix > 0 && (
        <div className="flex h-9 w-full items-center justify-between gap-3 px-3.5 text-sm text-muted outline outline-1 -outline-offset-1 outline-rule">
          <span>
            Cardhoarder <span className="text-xs">MTGO</span>
          </span>
          <span className="tabular-nums">~{totals.tix.toFixed(1)} tix</span>
        </div>
      )}

      <p className="text-xs text-muted">
        Prices are the cheapest listed printing at each, from Scryfall&apos;s affiliate data.
        Shipping, condition and import duty are not included.
      </p>
    </div>
  );
}

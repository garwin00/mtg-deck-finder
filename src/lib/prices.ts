/**
 * Cheapest EUR printing per card, indexed the same way as cards.json.
 * Written by scripts/build-prices.mjs.
 */
export type PriceIndex = {
  generatedAt: string;
  /** ECB daily reference rate. */
  gbpPerEur: number;
  rateDate: string | null;
  /**
   * Cheapest printing per retailer, in cents. Scryfall source these from their
   * affiliates: cents is Cardmarket, usd is TCGplayer, tix is Cardhoarder.
   * 0 where no printing has a price.
   */
  cents: number[];
  usd: number[];
  tix: number[];
  /** Cardmarket idProduct for the printing quoted, 0 if unknown. */
  product: number[];
};

/** Price of one copy in pounds, or undefined if the card has no EUR price. */
export function gbpPrice(prices: PriceIndex, cardIndex: number): number | undefined {
  const cents = prices.cents[cardIndex];
  if (!cents) return undefined;
  return (cents / 100) * prices.gbpPerEur;
}

/** TCGplayer price in dollars, or undefined. */
export function usdPrice(prices: PriceIndex, cardIndex: number): number | undefined {
  const cents = prices.usd[cardIndex];
  return cents ? cents / 100 : undefined;
}

/** Cardhoarder price in MTGO tickets, or undefined. */
export function tixPrice(prices: PriceIndex, cardIndex: number): number | undefined {
  const cents = prices.tix[cardIndex];
  return cents ? cents / 100 : undefined;
}

export function cardmarketUrl(prices: PriceIndex, cardIndex: number): string | undefined {
  const id = prices.product[cardIndex];
  return id ? `https://www.cardmarket.com/en/Magic/Products?idProduct=${id}` : undefined;
}

export function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  });
}

export function formatGbp(amount: number): string {
  return amount.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  });
}

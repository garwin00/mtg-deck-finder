/**
 * Cheapest EUR printing per card, indexed the same way as cards.json.
 * Written by scripts/build-prices.mjs.
 */
export type PriceIndex = {
  generatedAt: string;
  /** ECB daily reference rate. */
  gbpPerEur: number;
  rateDate: string | null;
  /** EUR cents, 0 where Scryfall has no price for any printing. */
  cents: number[];
  /** Cardmarket idProduct for the printing quoted, 0 if unknown. */
  product: number[];
};

/** Price of one copy in pounds, or undefined if the card has no EUR price. */
export function gbpPrice(prices: PriceIndex, cardIndex: number): number | undefined {
  const cents = prices.cents[cardIndex];
  if (!cents) return undefined;
  return (cents / 100) * prices.gbpPerEur;
}

export function cardmarketUrl(prices: PriceIndex, cardIndex: number): string | undefined {
  const id = prices.product[cardIndex];
  return id ? `https://www.cardmarket.com/en/Magic/Products?idProduct=${id}` : undefined;
}

export function formatGbp(amount: number): string {
  return amount.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  });
}

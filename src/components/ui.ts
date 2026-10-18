/**
 * Class strings for the controls every page shares, so a button or a page
 * title reads the same everywhere without a component per element.
 */

/** Page titles are big and heavy; everything under them stays small. */
export const pageTitle = "text-5xl font-extrabold leading-[0.9] tracking-[-0.045em] sm:text-7xl";
export const lede = "mt-3 max-w-2xl text-muted";

export const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-[2px] border border-ink bg-ink px-3.5 text-sm font-semibold text-sheet hover:bg-ink/85 disabled:opacity-40";
export const buttonGhost =
  "inline-flex h-9 items-center justify-center gap-2 rounded-[2px] border border-ink bg-sheet px-3.5 text-sm font-semibold text-ink hover:bg-wash disabled:opacity-40";

export const input =
  "h-9 rounded-[2px] border border-ink bg-sheet px-3 text-sm outline-none placeholder:text-quiet focus:ring-2 focus:ring-ink/15";
export const select =
  "h-9 rounded-[2px] border border-ink bg-sheet px-2 text-sm outline-none focus:ring-2 focus:ring-ink/15";

/** A segmented control: wrap the buttons in `segmented`, give each `segment(on)`. */
export const segmented = "flex h-9 overflow-hidden rounded-[2px] border border-ink bg-sheet";
export const segment = (on: boolean) =>
  `border-l border-rule px-3 text-sm font-semibold first:border-l-0 ${
    on ? "bg-ink text-sheet" : "text-ink hover:bg-wash"
  }`;

/** A small rule-topped heading for a group of things on a page. */
export const sectionHead =
  "flex items-baseline justify-between border-b border-ink pb-1.5 text-xs font-bold";

/** A sheet of paper on the page: tiles, lists, panels. */
export const sheet = "bg-sheet outline outline-1 outline-rule";
export const sheetLink = `${sheet} transition-[outline-color] hover:outline-ink`;

/** Red is reserved for what's missing or costs money; errors borrow it. */
export const errorBox = "border border-signal/40 bg-signal/5 p-4 text-sm";

export const backLink = "text-sm text-muted hover:text-ink";

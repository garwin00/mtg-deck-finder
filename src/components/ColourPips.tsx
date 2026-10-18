import Image from "next/image";

/**
 * Scryfall's own mana symbols, served from their CDN like the set icons, so
 * colour identity reads the way it does on a card.
 */
export function manaSymbolUrl(symbol: string): string {
  return `https://svgs.scryfall.io/card-symbols/${symbol}.svg`;
}

/** Colour identity as WUBRG mana symbols; colourless gets the colourless symbol. */
export function ColourPips({ colours, size = 16 }: { colours: string; size?: number }) {
  const letters = colours ? "WUBRG".split("").filter((c) => colours.includes(c)) : ["C"];
  return (
    <span className="flex shrink-0 gap-0.5" aria-label={`Colour identity ${colours || "colourless"}`}>
      {letters.map((letter) => (
        <Image
          key={letter}
          src={manaSymbolUrl(letter)}
          alt=""
          width={size}
          height={size}
          unoptimized
          // Both dimensions are set because Tailwind's preflight applies
          // height:auto to images, which Next flags as a broken aspect ratio.
          style={{ width: size, height: size }}
        />
      ))}
    </span>
  );
}

const FILTER_COLOURS = [
  { key: "W", label: "White" },
  { key: "U", label: "Blue" },
  { key: "B", label: "Black" },
  { key: "R", label: "Red" },
  { key: "G", label: "Green" },
  { key: "C", label: "Colourless" },
];

/** Bare mana symbols as toggles: faded until picked. */
export function ColourFilter({
  selected,
  onToggle,
}: {
  selected: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex h-9 items-center gap-2.5 px-1">
      {FILTER_COLOURS.map(({ key, label }) => {
        const on = selected.has(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            aria-pressed={on}
            aria-label={label}
            title={label}
            className={`transition-opacity ${on ? "opacity-100" : "opacity-30 hover:opacity-70"}`}
          >
            <Image
              src={manaSymbolUrl(key)}
              alt=""
              width={22}
              height={22}
              unoptimized
              style={{ width: 22, height: 22 }}
            />
          </button>
        );
      })}
    </div>
  );
}

/** The exact-identity rule every colour filter shares. */
export function matchesColours(identity: string, selected: Set<string>): boolean {
  if (selected.size === 0) return true;
  // Exactly the selection: picking U, B and R gives Grixis only, not every
  // mono-black and Dimir card that also fits inside it. Colourless is its own
  // identity, so C alongside a colour matches nothing.
  const letters = identity === "" ? ["C"] : [...identity];
  return letters.length === selected.size && letters.every((c) => selected.has(c));
}

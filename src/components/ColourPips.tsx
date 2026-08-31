const PIP_STYLES: Record<string, string> = {
  W: "bg-[#f8f2df] text-[#3b3428]",
  U: "bg-[#9cd3f2] text-[#0e3348]",
  B: "bg-[#4b4453] text-[#e6dff0]",
  R: "bg-[#e78a72] text-[#4a1710]",
  G: "bg-[#8fc79a] text-[#12351c]",
};

/** Colour identity as WUBRG pips; colourless decks get a single grey pip. */
export function ColourPips({ colours }: { colours: string }) {
  const letters = colours ? colours.split("") : ["C"];
  return (
    <span className="flex gap-1" aria-label={`Colour identity ${colours || "colourless"}`}>
      {letters.map((letter) => (
        <span
          key={letter}
          className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${
            PIP_STYLES[letter] ?? "bg-surface-2 text-muted"
          }`}
        >
          {letter}
        </span>
      ))}
    </span>
  );
}

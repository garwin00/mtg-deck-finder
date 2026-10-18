import Link from "next/link";

/** The two ways into a commander: EDHREC's decks, or one built from the collection. */
export function CommanderTabs({ slug, active }: { slug: string; active: "decks" | "build" }) {
  const tabs = [
    { key: "decks", href: `/commander/${slug}`, label: "Decks" },
    { key: "build", href: `/commander/${slug}/build`, label: "Build from collection" },
  ] as const;

  return (
    <nav className="mt-8 flex gap-6 border-b border-ink">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`-mb-px border-b-2 py-2.5 text-sm font-semibold transition-colors ${
            tab.key === active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

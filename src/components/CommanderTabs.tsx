import Link from "next/link";

/** The two ways into a commander: EDHREC's decks, or one built from the collection. */
export function CommanderTabs({ slug, active }: { slug: string; active: "decks" | "build" }) {
  const tabs = [
    { key: "decks", href: `/commander/${slug}`, label: "Decks" },
    { key: "build", href: `/commander/${slug}/build`, label: "Build from collection" },
  ] as const;

  return (
    <nav className="mt-4 flex gap-1 border-b border-border">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
            tab.key === active
              ? "border-accent text-foreground"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

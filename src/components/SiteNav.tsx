"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCollection } from "@/lib/collection-context";

const TABS = [
  { href: "/", label: "Decks" },
  { href: "/collection", label: "Collection" },
  { href: "/popular", label: "Popular" },
];

/** Only useful once there's a collection to look at, so it hides until then. */
export function SiteNav() {
  const { collection } = useCollection();
  const pathname = usePathname();
  if (!collection) return null;

  return (
    <nav className="border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl gap-1 px-6">
        {TABS.map(({ href, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`-mb-px border-b-2 px-3 py-3 text-sm transition ${
                active
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

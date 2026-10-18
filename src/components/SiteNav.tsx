"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCollection } from "@/lib/collection-context";

const TABS = [
  { href: "/", label: "Commanders" },
  { href: "/collection", label: "Collection" },
  { href: "/popular", label: "Popular" },
];

/**
 * The mark always shows; the tabs and the collection's details only once there
 * is a collection to look at.
 */
export function SiteNav() {
  const { collection, fileName, savedAt, reset, forget } = useCollection();
  const pathname = usePathname();

  return (
    <header className="border-b border-ink bg-sheet">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-7 px-6">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-extrabold tracking-[-0.02em]">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="text-signal">
            <path d="M1 8V1h7M13 6v7H6" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          Deck Finder
        </Link>

        {collection && (
          <nav className="flex h-full gap-6">
            {TABS.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" || pathname.startsWith("/commander") || pathname.startsWith("/precon") : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`-mb-px flex items-center border-b-2 text-sm font-semibold transition-colors ${
                    active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        )}

        {collection && (
          <div className="ml-auto hidden items-center gap-3 text-xs text-muted md:flex">
            <span className="truncate">
              {fileName && <span className="font-semibold text-ink">{fileName}</span>}
              {fileName && " · "}
              {collection.distinctMatched.toLocaleString()} cards
              {/* Stored collections go stale as cards are bought; saying when
                  makes that visible rather than quietly wrong. */}
              {savedAt &&
                ` · saved ${new Date(savedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
            </span>
            <button type="button" onClick={reset} className="underline hover:text-ink">
              Replace
            </button>
            <button type="button" onClick={forget} className="underline hover:text-signal">
              Forget
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

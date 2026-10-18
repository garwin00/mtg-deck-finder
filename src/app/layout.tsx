import type { Metadata } from "next";
import { Funnel_Display } from "next/font/google";
import "./globals.css";
import { CollectionProvider } from "@/lib/collection-context";
import { SiteNav } from "@/components/SiteNav";

const funnel = Funnel_Display({ variable: "--font-funnel", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Deck Finder — which Commander decks is your collection closest to?",
  description:
    "Upload a Magic: The Gathering collection export and see which Commander decks you already almost own.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${funnel.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Holds the collection so it survives navigation between routes. */}
        <CollectionProvider>
          <SiteNav />
          {children}
        </CollectionProvider>
      </body>
    </html>
  );
}

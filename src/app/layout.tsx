import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CollectionProvider } from "@/lib/collection-context";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Deck Finder — which Commander decks is your collection closest to?",
  description:
    "Upload a Magic: The Gathering collection export and see which Commander decks you already almost own.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Holds the collection so it survives navigation between routes. */}
        <CollectionProvider>{children}</CollectionProvider>
      </body>
    </html>
  );
}

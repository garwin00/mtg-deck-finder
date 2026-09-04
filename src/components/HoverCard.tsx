"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const WIDTH = 260;
const HEIGHT = Math.round((WIDTH * 680) / 488);
const OFFSET = 18;

/**
 * Shows the full card at the cursor while a target is hovered.
 *
 * Rendered through a portal so the sidebar's own scroll container can't clip
 * it, and positioned with `fixed` against the viewport rather than the page.
 */
export function HoverCard({
  image,
  name,
  children,
  className,
}: {
  image?: string;
  name: string;
  children: ReactNode;
  className?: string;
}) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);

  const track = (e: { clientX: number; clientY: number }) => {
    if (!image) return;
    setPoint({ x: e.clientX, y: e.clientY });
  };

  // Flip to the other side of the cursor near an edge rather than overflowing.
  const style = point
    ? {
        left:
          point.x + OFFSET + WIDTH > window.innerWidth
            ? Math.max(8, point.x - OFFSET - WIDTH)
            : point.x + OFFSET,
        top: Math.min(Math.max(8, point.y - HEIGHT / 2), window.innerHeight - HEIGHT - 8),
      }
    : undefined;

  return (
    <div
      className={className}
      onMouseEnter={track}
      onMouseMove={track}
      onMouseLeave={() => setPoint(null)}
    >
      {children}
      {point &&
        image &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 overflow-hidden rounded-xl shadow-2xl shadow-black/60 ring-1 ring-border"
            style={{ ...style, width: WIDTH, height: HEIGHT }}
          >
            {/* Scryfall rejects Next's image optimiser, hence unoptimized. */}
            <Image
              src={image}
              alt={name}
              width={WIDTH}
              height={HEIGHT}
              unoptimized
              // Explicit size for the same preflight reason as the set icons.
              className="block h-full w-full"
            />
          </div>,
          document.body
        )}
    </div>
  );
}

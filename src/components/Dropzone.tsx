"use client";

import { useRef, useState } from "react";
import { button } from "./ui";

type Props = {
  onFile: (file: File) => void;
  busy: boolean;
};

/** Collection CSV drop target. Nothing leaves the browser. */
export function Dropzone({ onFile, busy }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      // The crop marks frame it as the sheet's cutting area.
      className={`crop-marks relative px-8 py-20 text-center outline-dashed outline-1 transition-colors before:h-5! before:w-5! before:border-t-2! before:border-l-2! after:h-5! after:w-5! after:border-r-2! after:border-b-2! ${
        dragging ? "bg-wash outline-ink" : "bg-sheet outline-quiet"
      }`}
    >
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <p className="text-xl font-bold tracking-[-0.02em]">Drop your collection export here</p>
      <p className="mt-1.5 text-muted">
        ManaBox CSV, or anything with a card-name and quantity column.
      </p>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className={`mt-6 ${button}`}
      >
        {busy ? "Working…" : "Choose a file"}
      </button>
      <p className="mx-auto mt-8 max-w-md text-xs text-muted">
        Read entirely in your browser and never uploaded. It&apos;s saved on this device so it&apos;s
        still here next time, and you can forget it whenever you like.
      </p>
    </div>
  );
}

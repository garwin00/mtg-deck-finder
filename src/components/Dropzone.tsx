"use client";

import { useRef, useState } from "react";

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
      className={`rounded-xl border-2 border-dashed p-10 text-center transition ${
        dragging ? "border-accent bg-surface-2" : "border-border bg-surface"
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
      <p className="text-lg font-medium">Drop your collection export here</p>
      <p className="mt-1 text-sm text-muted">
        ManaBox CSV, or anything with a card-name and quantity column.
      </p>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="mt-5 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-[#241c05] disabled:opacity-50"
      >
        {busy ? "Working…" : "Choose a file"}
      </button>
      <p className="mt-6 text-xs text-muted">
        Parsing happens entirely in your browser. Your collection is never uploaded or stored.
      </p>
    </div>
  );
}

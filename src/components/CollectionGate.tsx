"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCollection } from "@/lib/collection-context";

/**
 * Nothing is persisted, so a refresh or a shared link arrives with no
 * collection in memory. Send those back to the upload screen rather than
 * rendering an empty deck.
 */
export function useRequireCollection() {
  const state = useCollection();
  const router = useRouter();
  const ready = Boolean(state.collection && state.index);

  useEffect(() => {
    if (!ready && !state.busy) router.replace("/");
  }, [ready, state.busy, router]);

  return ready ? state : null;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCollection, type CollectionState } from "@/lib/collection-context";
import type { Collection } from "@/lib/collection";
import type { CardIndex } from "@/lib/types";

/** The state once a collection is loaded, so callers don't assert non-null. */
export type ReadyCollection = Omit<CollectionState, "collection" | "index"> & {
  collection: Collection;
  index: CardIndex;
};

/**
 * A refresh or a shared link arrives before the stored collection has been read
 * back, and someone else's link arrives with nothing stored at all. Wait while
 * the status is still unknown — redirecting then would bounce every deep link
 * to the upload screen before the collection had a chance to restore.
 */
export function useRequireCollection(): ReadyCollection | null {
  const state = useCollection();
  const router = useRouter();
  const ready = Boolean(state.collection && state.index);
  const settled = state.status !== "unknown" && !state.busy;

  useEffect(() => {
    if (!ready && settled) router.replace("/");
  }, [ready, settled, router]);

  // `ready` is exactly the check that makes both fields non-null, so this is
  // the one place the narrowing belongs.
  return ready ? (state as ReadyCollection) : null;
}

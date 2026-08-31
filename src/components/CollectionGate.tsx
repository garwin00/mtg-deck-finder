"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCollection } from "@/lib/collection-context";

/**
 * A refresh or a shared link arrives before the stored collection has been read
 * back, and someone else's link arrives with nothing stored at all. Wait while
 * the status is still unknown — redirecting then would bounce every deep link
 * to the upload screen before the collection had a chance to restore.
 */
export function useRequireCollection() {
  const state = useCollection();
  const router = useRouter();
  const ready = Boolean(state.collection && state.index);
  const settled = state.status !== "unknown" && !state.busy;

  useEffect(() => {
    if (!ready && settled) router.replace("/");
  }, [ready, settled, router]);

  return ready ? state : null;
}

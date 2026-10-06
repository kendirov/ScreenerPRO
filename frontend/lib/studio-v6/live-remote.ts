import { isSharedStudio, type SharedStudio } from "@/lib/studio-v6/shared-live";
import { readCanonicalLive, writeCanonicalLive } from "@/lib/studio-v6/canonical-live";

export async function readSharedLive(): Promise<SharedStudio | null> {
  try {
    const state = await readCanonicalLive();
    return isSharedStudio(state) ? state : null;
  } catch {
    return null;
  }
}

export async function writeSharedLive(state: SharedStudio, baseUpdatedAt = "") {
  const saved = await writeCanonicalLive(state, baseUpdatedAt);
  if (saved.conflict) return { ok: false as const, conflict: true, state: saved.state };
  return { ok: true as const, conflict: false, state: saved.state };
}

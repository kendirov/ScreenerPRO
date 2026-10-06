import { get, put } from "@vercel/blob";
import { isSharedStudio, type SharedStudio } from "@/lib/studio-v6/shared-live";

const PATH = "tqs-studio/live.json";

function token() {
  return process.env.BLOB_READ_WRITE_TOKEN || "";
}

export async function readSharedLive(): Promise<SharedStudio | null> {
  if (!token()) return null;
  try {
    const result = await get(PATH, { access: "private", token: token(), useCache: false });
    if (!result || result.statusCode !== 200) return null;
    const parsed = JSON.parse(await new Response(result.stream).text()) as unknown;
    return isSharedStudio(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeSharedLive(state: SharedStudio, baseUpdatedAt = "") {
  const current = await readSharedLive();
  if (baseUpdatedAt && current && current.updatedAt !== baseUpdatedAt) {
    return { ok: false as const, conflict: true, state: current };
  }
  if (!token()) return { ok: false as const, conflict: false, state: current };
  await put(PATH, JSON.stringify(state), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: token(),
  });
  return { ok: true as const, conflict: false, state };
}

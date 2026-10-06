import { readCanonicalLive, writeCanonicalLive } from "@/lib/studio-v6/canonical-live";
import { applySharedAction, isSharedStudio, sharedToMarkdown } from "@/lib/studio-v6/shared-live";
import { buildStudioContext } from "@/lib/studio-v6/studio-context";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function noStore(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  try {
    const state = await readCanonicalLive();
    const format = new URL(request.url).searchParams.get("format");
    if (format === "md") {
      return new Response(sharedToMarkdown(state), {
        headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" },
      });
    }
    if (format === "context") {
      const url = new URL(request.url);
      return noStore(buildStudioContext({ overview: state.overview, documents: state.documents, blocks: state.blocks }, {
        frameId: url.searchParams.get("frame"),
        objectIds: (url.searchParams.get("objects") || "").split(",").filter(Boolean),
      }));
    }
    return noStore(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return noStore({ ok: false, remote: false, error: message }, 503);
  }
}

export async function PUT(request: Request) {
  let parsed: any;
  try {
    parsed = await request.json();
  } catch {
    return noStore({ ok: false }, 400);
  }
  const baseUpdatedAt = typeof parsed?.baseUpdatedAt === "string" ? parsed.baseUpdatedAt : "";
  if (parsed && typeof parsed === "object") delete parsed.baseUpdatedAt;
  if (!isSharedStudio(parsed)) return noStore({ ok: false }, 400);
  try {
    const saved = await writeCanonicalLive(parsed, baseUpdatedAt);
    if (saved.conflict) return noStore({ ok: false, error: "CONFLICT", state: saved.state }, 409);
    return noStore({ ok: true, remote: true, updatedAt: saved.state.updatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return noStore({ ok: false, remote: false, error: message }, 503);
  }
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return noStore({ ok: false, error: "BAD_JSON" }, 400);
  }
  try {
    const current = await readCanonicalLive();
    const result = applySharedAction(current, body);
    if (body?.action === "getStudioContext") {
      return noStore({ ok: true, remote: true, updatedAt: current.updatedAt, result });
    }
    const saved = await writeCanonicalLive(result.state, current.updatedAt);
    if (saved.conflict) return noStore({ ok: false, error: "CONFLICT", state: saved.state }, 409);
    return noStore({ ok: true, remote: true, updatedAt: saved.state.updatedAt, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.endsWith("_NOT_FOUND") ? 404 : message === "SHARED_ACTION_UNSUPPORTED" || message.endsWith("_REQUIRED") ? 400 : 503;
    return noStore({ ok: false, error: message }, status);
  }
}

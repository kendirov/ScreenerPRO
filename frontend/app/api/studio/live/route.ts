import { get, put } from "@vercel/blob";
import { isStudioLive, liveToMarkdown, type StudioLive } from "@/lib/studio-fresh/live-state";
import { writeSharedLive } from "@/lib/studio-v6/live-remote";
import { applySharedAction, isSharedStudio, sharedToMarkdown, type SharedStudio } from "@/lib/studio-v6/shared-live";
import { buildStudioContext } from "@/lib/studio-v6/studio-context";

const PATH = "tqs-studio/live.json";

export const dynamic = "force-dynamic";

function token() {
  return process.env.BLOB_READ_WRITE_TOKEN || "";
}

async function readRemote(): Promise<SharedStudio | StudioLive | null> {
  if (!token()) return null;
  try {
    const result = await get(PATH, { access: "private", token: token(), useCache: false });
    if (!result || result.statusCode !== 200) return null;
    const parsed = JSON.parse(await new Response(result.stream).text()) as unknown;
    if (isSharedStudio(parsed)) return parsed;
    return isStudioLive(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeRemote(state: SharedStudio | StudioLive) {
  if (!token()) return false;
  await put(PATH, JSON.stringify(state), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: token(),
  });
  return true;
}

function markdown(state: SharedStudio | StudioLive) {
  return isSharedStudio(state) ? sharedToMarkdown(state) : liveToMarkdown(state);
}

export async function GET(request: Request) {
  const state = await readRemote();
  if (!state) return Response.json({ ok: false, remote: false }, { status: 404 });
  const format = new URL(request.url).searchParams.get("format");
  if (format === "md") {
    return new Response(markdown(state), {
      headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" },
    });
  }
  if (format === "context" && isSharedStudio(state)) {
    const url = new URL(request.url);
    return Response.json(buildStudioContext({ overview: state.overview, documents: state.documents }, {
      frameId: url.searchParams.get("frame"),
      objectIds: (url.searchParams.get("objects") || "").split(",").filter(Boolean),
    }), { headers: { "cache-control": "no-store" } });
  }
  return Response.json(state, { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request) {
  let parsed: any;
  try {
    parsed = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const baseUpdatedAt = typeof parsed?.baseUpdatedAt === "string" ? parsed.baseUpdatedAt : "";
  if (parsed && typeof parsed === "object") delete parsed.baseUpdatedAt;
  if (!isSharedStudio(parsed) && !isStudioLive(parsed)) return Response.json({ ok: false }, { status: 400 });
  if (isSharedStudio(parsed)) {
    const saved = await writeSharedLive(parsed, baseUpdatedAt);
    if (saved.conflict) return Response.json({ ok: false, error: "CONFLICT", state: saved.state }, { status: 409 });
    return Response.json({ ok: saved.ok, remote: saved.ok, updatedAt: parsed.updatedAt });
  }
  const remote = await writeRemote(parsed);
  return Response.json({ ok: true, remote, updatedAt: parsed.updatedAt });
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "BAD_JSON" }, { status: 400 });
  }
  const current = await readRemote();
  if (!isSharedStudio(current)) return Response.json({ ok: false, error: "STUDIO_NOT_PUBLISHED" }, { status: 409 });
  try {
    const result = applySharedAction(current, body);
    if (body?.action === "getStudioContext") return Response.json({ ok: true, remote: true, updatedAt: current.updatedAt, result }, { headers: { "cache-control": "no-store" } });
    const remote = await writeRemote(result.state);
    return Response.json({ ok: true, remote, updatedAt: result.state.updatedAt, result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.endsWith("_NOT_FOUND") ? 404 : message === "SHARED_ACTION_UNSUPPORTED" || message.endsWith("_REQUIRED") ? 400 : 500;
    return Response.json({ ok: false, error: message }, { status });
  }
}

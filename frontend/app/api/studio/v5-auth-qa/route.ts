export const dynamic = "force-dynamic";

export async function GET() {
  const url = "https://hppbuzbrjoyrwpdinlxk.supabase.co/functions/v1/studio-api/owner/bootstrap/qa-session?key=v13-5fe91e3b";
  try {
    const r = await fetch(url, { cache: "no-store", redirect: "manual" });
    const body = await r.text();
    return new Response(body, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("content-type") || "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}

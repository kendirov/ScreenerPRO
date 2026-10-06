import { readCanonicalLive, writeCanonicalLive } from "../lib/studio-v6/canonical-live";

async function main() {
  const before = await readCanonicalLive();
  const marker = before.overview.objects.find(object => object.id === "lesson-miro-l101");
  if (!marker) throw new Error("marker object missing");
  const original = marker.title;
  const nextTitle = original.endsWith(" · проверка") ? original : `${original} · проверка`;
  const updatedAt = new Date().toISOString();
  const edited = {
    ...before,
    updatedAt,
    overview: {
      ...before.overview,
      objects: before.overview.objects.map(object => object.id === marker.id ? { ...object, title: nextTitle } : object),
    },
  };
  const saved = await writeCanonicalLive(edited, before.updatedAt);
  if (!saved.ok) throw new Error("write conflict");
  const seen = await readCanonicalLive();
  const row = seen.overview.objects.find(object => object.id === marker.id);
  if (row?.title !== nextTitle) throw new Error(`readback title ${row?.title}`);
  const revertedAt = new Date().toISOString();
  const reverted = await writeCanonicalLive({
    ...seen,
    updatedAt: revertedAt,
    overview: {
      ...seen.overview,
      objects: seen.overview.objects.map(object => object.id === marker.id ? { ...object, title: original } : object),
    },
  }, seen.updatedAt);
  if (!reverted.ok) throw new Error("revert conflict");
  const after = await readCanonicalLive();
  const back = after.overview.objects.find(object => object.id === marker.id);
  if (back?.title !== original) throw new Error(`revert title ${back?.title}`);
  const stale = await writeCanonicalLive({ ...after, updatedAt: new Date().toISOString() }, "2000-01-01T00:00:00.000Z");
  if (!stale.conflict) throw new Error("expected conflict");
  console.log(JSON.stringify({
    ok: true,
    objects: after.overview.objects.length,
    documents: after.documents.length,
    blocks: after.blocks.length,
    before: before.updatedAt,
    after: after.updatedAt,
    title: back?.title,
  }));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

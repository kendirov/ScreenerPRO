import assert from "node:assert/strict";
import { TRADER_DECK_ID, TRADER_ROADMAP_ID, TRADER_ROOM_ID, traderDeckSlides, traderRoadmapScene } from "../lib/studio-v6/visual-artifact";

const base = process.env.STUDIO_QA_BASE || "http://127.0.0.1:3210";

async function live() {
  const response = await fetch(`${base}/api/studio/live`, { cache: "no-store" });
  assert.equal(response.status, 200);
  return response.json();
}

async function act(body: Record<string, unknown>) {
  const response = await fetch(`${base}/api/studio/live`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${payload.error || "LIVE_ACTION_FAILED"}`);
  return payload;
}

function object(id: string, kind: string, title: string, body: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    id,
    world_key: "tqs-studio-world",
    kind,
    title,
    semantic_path: `Обучение/Подготовка трейдера/${title}`,
    parent_id: TRADER_ROOM_ID,
    x: 10420,
    y: 420,
    w: kind === "deck" ? 980 : kind === "frame" ? 1280 : 1180,
    h: kind === "deck" ? 560 : kind === "frame" ? 860 : 680,
    z: kind === "frame" ? 2 : 8,
    body,
    relations: [],
    hidden: false,
    revision: 1,
    ...extra,
  };
}

async function main() {
  const before = await live();
  const marker = `qa-cross-device-${Date.now()}`;
  await act({
    action: "createWorldObject",
    actor: "cursor",
    summary: "Проверка общей доски",
    object: object(marker, "text", "Проверка устройства", { html: "<p>Браузер A</p>" }, { parent_id: "lesson-miro-scene", semantic_path: "Обучение/Бесплатный курс/Занятие 1/Проверка", x: 6200, y: 1500, w: 280, h: 80 }),
  });
  const seen = await live();
  assert.equal(seen.overview.objects.some((item: { id: string }) => item.id === marker), true, "fresh read sees object");
  await act({ action: "updateObject", id: marker, actor: "cursor", summary: "Правка со второго устройства", patch: { title: "Проверка устройства B", body: { html: "<p>Браузер B</p>" } } });
  const changed = await live();
  const row = changed.overview.objects.find((item: { id: string; title: string }) => item.id === marker);
  assert.equal(row.title, "Проверка устройства B");
  await act({ action: "updateObject", id: marker, patch: { hidden: true } });
  const hidden = await live();
  const cleaned = {
    ...hidden,
    updatedAt: new Date().toISOString(),
    overview: { ...hidden.overview, objects: hidden.overview.objects.filter((item: { id: string }) => item.id !== marker) },
  };
  const removed = await fetch(`${base}/api/studio/live`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...cleaned, baseUpdatedAt: hidden.updatedAt }),
  });
  assert.equal(removed.status, 200);
  const gone = await live();
  assert.equal(gone.overview.objects.some((item: { id: string }) => item.id === marker), false);

  const stale = await fetch(`${base}/api/studio/live`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...gone, baseUpdatedAt: "2000-01-01T00:00:00.000Z" }),
  });
  assert.equal(stale.status, 409);
  const afterConflict = await live();
  assert.equal(afterConflict.updatedAt, gone.updatedAt);

  const scene = traderRoadmapScene();
  const slides = traderDeckSlides();
  await act({
    action: "createWorldObject",
    actor: "cursor",
    summary: "Комната подготовки трейдера",
    object: object(TRADER_ROOM_ID, "frame", "Подготовка трейдера", { workspaceCard: true }, { parent_id: "frame-learning", semantic_path: "Обучение/Подготовка трейдера", x: 10040, y: 220, w: 1320, h: 1480 }),
  });
  await act({
    action: "createWorldObject",
    actor: "cursor",
    summary: "Roadmap становления трейдера",
    object: object(TRADER_ROADMAP_ID, "artifact", "Roadmap становления трейдера", { scene, selectedNodeId: "stage-place" }, { x: 10120, y: 360 }),
  });
  await act({
    action: "createWorldObject",
    actor: "cursor",
    summary: "Шесть слайдов из roadmap",
    object: object(TRADER_DECK_ID, "deck", "Шесть слайдов подготовки", { slides, sourceArtifactId: TRADER_ROADMAP_ID }, { x: 10120, y: 1080 }),
  });
  const original = scene.nodes.find(node => node.id === "stage-place")!;
  const edited = await act({
    action: "updateArtifactNode",
    actor: "chatgpt",
    id: TRADER_ROADMAP_ID,
    nodeId: "stage-place",
    summary: "Этап места стал точнее",
    patch: { text: "Один экран держит график в центре. Стакан остаётся у цены, лишняя панель не возвращается." },
  });
  assert.equal(edited.result.node.text.includes("лишняя панель"), true);
  assert.equal(edited.result.unchanged.some((node: { id: string; text: string }) => node.id === "stage-read" && node.text === scene.nodes.find(item => item.id === "stage-read")!.text), true);
  await act({ action: "updateArtifactNode", actor: "cursor", id: TRADER_ROADMAP_ID, nodeId: "stage-place", summary: "Этап места возвращён", patch: { text: original.text } });
  const restored = await live();
  const artifact = restored.overview.objects.find((item: { id: string }) => item.id === TRADER_ROADMAP_ID);
  const deck = restored.overview.objects.find((item: { id: string }) => item.id === TRADER_DECK_ID);
  assert.equal(artifact.body.scene.nodes.find((node: { id: string; text: string }) => node.id === "stage-place").text, original.text);
  assert.equal(deck.body.slides.length, 6);
  assert.equal(restored.overview.objects.some((item: { id: string }) => item.id === marker), false);
  assert.notEqual(restored.updatedAt, before.updatedAt);

  const page = await fetch(`${base}/a/${TRADER_ROADMAP_ID}?embed=1`, { cache: "no-store" });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Становление трейдера/);
  assert.match(html, /visual-artifact|vs-scene|Ложный пробой/);
  const deckPage = await fetch(`${base}/a/${TRADER_DECK_ID}?slide=2`, { cache: "no-store" });
  assert.equal(deckPage.status, 200);
  const deckHtml = await deckPage.text();
  assert.match(deckHtml, /Место|Один экран/);
  console.log("PASS canonical world + roadmap + deck + embed");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

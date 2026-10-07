import assert from "node:assert/strict";

const memory = new Map<string, string>();
const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
  removeItem: (key: string) => { memory.delete(key); },
};
Object.defineProperty(globalThis, "window", {value: {localStorage: storage}, configurable: true});
Object.defineProperty(globalThis, "localStorage", {value: storage, configurable: true});

async function main() {
const model = await import("../lib/studio-v6/document-model");
const store = await import("../lib/studio-v5/local-store");

const empty = [
  {block_id:"image", document_id:"doc", ordinal:1, block_type:"image", content:{title:"Пусто"}, data_spec:null, asset_id:null, revision:1},
  {block_id:"video", document_id:"doc", ordinal:2, block_type:"video", content:{url:""}, data_spec:null, asset_id:null, revision:1},
  {block_id:"text", document_id:"doc", ordinal:3, block_type:"rich_text", content:{html:"<p>Есть текст</p>"}, data_spec:null, asset_id:null, revision:1},
];
assert.deepEqual(model.publicationBlocks(empty).map((block: {block_id: string}) => block.block_id), ["text"]);

const handout = model.handoutBlocks([
  {block_id:"h", document_id:"doc", ordinal:1, block_type:"heading", content:{text:"Занятие"}, data_spec:null, asset_id:null, revision:1},
  {block_id:"embed", document_id:"doc", ordinal:2, block_type:"interactive", content:{view:"embed", url:"", title:"График", columns:["Элемент","Зачем"], rows:[["График","Контекст"]]}, data_spec:null, asset_id:null, revision:1},
  {block_id:"chart", document_id:"doc", ordinal:3, block_type:"interactive_chart", content:{title:"Si"}, data_spec:null, asset_id:null, revision:1},
  {block_id:"live", document_id:"doc", ordinal:4, block_type:"live_data", content:{title:"Si"}, data_spec:null, asset_id:null, revision:1},
  {block_id:"qa", document_id:"doc", ordinal:5, block_type:"rich_text", content:{html:"<p>Проверь: вставку между блоками, drag reorder, share и PDF.</p>"}, data_spec:null, asset_id:null, revision:1},
  {block_id:"body", document_id:"doc", ordinal:6, block_type:"rich_text", content:{html:"<p>График, стакан и лента.</p>"}, data_spec:null, asset_id:null, revision:1},
]);
assert.deepEqual(handout.map((block: {block_id: string}) => block.block_id), ["h", "embed", "body"]);
assert.equal(handout.find((block: {block_id: string; content?: {view?: string}}) => block.block_id === "embed")?.content?.view, "table");
assert.equal(model.isFixtureDocument({id:"qa-doc-1", title:"QA V5 temporary document", semantic_path:"QA/V5"}), true);
assert.equal(model.isFixtureDocument({id:"doc-lesson-workspace", title:"Занятие 1 — Рабочее пространство", semantic_path:"Обучение/Бесплатный курс/Занятие 1"}), false);

assert.match(model.resolveVideoEmbed("https://www.youtube.com/watch?v=abcdefghijk"), /youtube\.com\/embed\/abcdefghijk/);
assert.match(model.resolveVideoEmbed("https://rutube.ru/video/sample-id/"), /rutube\.ru\/play\/embed\/sample-id/);
assert.match(model.resolveVideoEmbed("https://vimeo.com/123456"), /player\.vimeo\.com\/video\/123456/);
assert.match(model.resolveVideoEmbed("https://vk.com/video-100_200"), /video_ext\.php\?oid=-100&id=200/);
assert.match(model.resolveVideoEmbed("https://vkvideo.ru/video-100_200"), /video_ext\.php\?oid=-100&id=200/);

const before = await store.localStudioAction("getDocument", {documentId:"doc-lesson-workspace"});
const table = before.blocks.find((block: {block_id: string; ordinal: number}) => block.block_id === "lesson-table");
const end = before.blocks.find((block: {block_id: string; ordinal: number}) => block.block_id === "lesson-end");
const context = await store.localStudioAction("getDocumentAuthoringContext", {documentId:"doc-lesson-workspace", ordinal:table.ordinal, insert:"after"});
assert.equal(context.target.block_id, "lesson-table");
assert.equal(context.target.ordinal, table.ordinal);
assert.equal(context.target.after_block_id, "lesson-table");
assert.equal(context.document_id, "doc-lesson-workspace");

const created = await store.localStudioAction("applyDocumentAuthoring", {
  documentId:"doc-lesson-workspace",
  generationRunId:"run-doc-1",
  actor:"chatgpt",
  summary:"после блока занятия",
  mutations:[{operation:"insert", blockType:"image", blockId:"qa-image", content:{title:"После таблицы", url:""}, target:{ordinal:table.ordinal, insert:"after"}}],
});
const image = created.blocks.find((block: {block_id: string}) => block.block_id === "qa-image");
const shifted = created.blocks.find((block: {block_id: string}) => block.block_id === "lesson-end");
assert.equal(image.ordinal, table.ordinal + 1);
assert.equal(image.block_type, "image");
assert.equal(shifted.ordinal, end.ordinal + 1);
assert.equal(created.blocks.find((block: {block_id: string}) => block.block_id === "lesson-table").ordinal, table.ordinal);
assert.equal(image.content.provenance.runId, "run-doc-1");

const undone = await store.localStudioAction("undoDocumentAuthoring", {generationRunId:"run-doc-1"});
assert.equal(undone.blocks.some((block: {block_id: string}) => block.block_id === "qa-image"), false);
assert.equal(undone.blocks.find((block: {block_id: string}) => block.block_id === "lesson-end").ordinal, end.ordinal);

const docs = [
  {id:"doc-lesson-workspace", world_key:"tqs-studio-world", slug:"lesson", kind:"lesson", title:"Занятие 1", semantic_path:"Обучение/Бесплатный курс/Занятие 1", frame_id:null, revision:1, status:"DRAFT", share_mode:"private", metadata:{}},
  {id:"doc-si", world_key:"tqs-studio-world", slug:"si", kind:"article", title:"Si", semantic_path:"Статьи/Si", frame_id:null, revision:1, status:"DRAFT", share_mode:"private", metadata:{}},
];
const ids: string[] = [];
const walk = (nodes: Array<{documentId?: string; children: typeof nodes}>) => { for (const node of nodes) { if (node.documentId) ids.push(node.documentId); walk(node.children); } };
walk(model.libraryTree(docs));
assert.deepEqual(ids, ["doc-lesson-workspace", "doc-si"]);
assert.equal(new Set(ids).size, ids.length);

const shared = await import("../lib/studio-v6/shared-live");
const local = store.readLocalStudio();
const beforeRev = local.overview.world.revision;
const moved = await store.localStudioAction("updateObjects", {patches:[
  {id:"lesson-miro-l101", patch:{x:6100, y:760}, eventType:"semantic_move", summary:"Материал сдвинут"},
  {id:"lesson-miro-l102", patch:{x:6900, y:700}, eventType:"semantic_move", summary:"Тема сдвинута"},
]});
assert.equal(moved.objects.length, 2);
assert.equal(moved.worldRevision, beforeRev + 1);
const saved = store.readLocalStudio().overview.objects.find((item: {id: string; x: number}) => item.id === "lesson-miro-l101");
assert.equal(saved?.x, 6100);

const state = shared.makeSharedStudio({theme:"dark", activeDocumentId:"doc-lesson-workspace", overview:store.readLocalStudio().overview, documents:store.readLocalStudio().documents, blocks:store.readLocalStudio().blocks, operator:{intent:"redesign", frame_title:"ЗАНЯТИЕ 1 · РАБОЧЕЕ ПРОСТРАНСТВО", semantic_path:"Обучение"}});
const markdown = shared.sharedToMarkdown(state);
assert.match(markdown, /Обучение/);
assert.match(markdown, /Занятие 1/);
assert.match(markdown, /Стакан не уезжает/);
assert.match(markdown, /applyDocumentAuthoring/);
const acted = shared.applySharedAction(state, {action:"applyDocumentAuthoring", documentId:"doc-lesson-workspace", actor:"cursor", mutations:[{operation:"insert", blockType:"rich_text", content:{html:"<p>Проверка оператора</p>"}, target:{ordinal:2, insert:"after"}}]});
assert.equal(acted.state.blocks.some((block: {content?: {html?: string}}) => String(block.content?.html || "").includes("Проверка оператора")), true);
assert.equal(shared.shouldAdoptRemote({stamp:"", localRevision:40, remoteRevision:101, remoteUpdatedAt:"2026-10-06T05:00:00.000Z"}), true);
assert.equal(shared.shouldAdoptRemote({stamp:"", localRevision:1, remoteRevision:101, remoteUpdatedAt:"2026-10-06T05:00:00.000Z"}), true);
assert.equal(shared.shouldAdoptRemote({stamp:"2026-10-06T04:00:00.000Z", localRevision:10, remoteRevision:11, remoteUpdatedAt:"2026-10-06T05:00:00.000Z"}), true);
assert.equal(shared.shouldAdoptRemote({stamp:"2026-10-06T04:00:00.000Z", localRevision:900, remoteRevision:3, remoteUpdatedAt:"2026-10-06T05:00:00.000Z"}), true);
assert.equal(shared.shouldAdoptRemote({stamp:"2026-10-06T06:00:00.000Z", localRevision:1, remoteRevision:99, remoteUpdatedAt:"2026-10-06T05:00:00.000Z"}), false);
assert.equal(shared.shouldAdoptRemote({stamp:"", localRevision:1, remoteRevision:1, remoteUpdatedAt:"2026-10-06T05:00:00.000Z", pendingLocal:true}), false);
const artifact = shared.applySharedAction(state, {action:"createWorldObject", actor:"cursor", summary:"Roadmap", object:{id:"artifact-qa", kind:"artifact", title:"Путь", semantic_path:"Обучение/Путь", parent_id:null, x:0, y:0, w:100, h:100, z:4, body:{scene:{grammar:"trajectory", title:"Путь", thesis:"Проверка", nodes:[{id:"stage-a", role:"stage", title:"Смотреть", text:"Первый", x:10, y:50},{id:"stage-b", role:"stage", title:"Читать", text:"Второй", x:40, y:50}]}}, relations:[], hidden:false, revision:1}});
const revised = shared.applySharedAction(artifact.state, {action:"updateArtifactNode", actor:"chatgpt", id:"artifact-qa", nodeId:"stage-a", summary:"Этап сильнее", patch:{text:"Первый этап стал точнее"}});
const revisedObject = revised.state.overview.objects.find((item: {id: string}) => item.id === "artifact-qa");
if (!revisedObject) throw new Error("artifact-qa missing");
const revisedNode = revisedObject.body.scene.nodes;
assert.equal(revisedNode.find((node: {id: string; text: string}) => node.id === "stage-a").text, "Первый этап стал точнее");
assert.equal(revisedNode.find((node: {id: string; text: string}) => node.id === "stage-b").text, "Второй");
assert.match(shared.sharedToMarkdown(revised.state), /голос:|artifact-qa|Путь/);
const kept = shared.keepLocalFiles({previewUrl:"data:image/png;base64,AAAA"}, {previewUrl:""});
assert.equal(kept.previewUrl, "data:image/png;base64,AAAA");
assert.equal(shared.keepLocalFiles({previewUrl:"data:image/png;base64,AAAA"}, {previewUrl:"https://example.com/a.png"}).previewUrl, "https://example.com/a.png");

console.log("PASS studio documents");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

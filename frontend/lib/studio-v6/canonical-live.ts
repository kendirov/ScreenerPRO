import type { StudioDocument, StudioDocumentBlock, StudioObject, WorldOverview } from "@/lib/studio-v5/types";
import type { SharedStudio } from "@/lib/studio-v6/shared-live";

const EDGE = "https://hppbuzbrjoyrwpdinlxk.supabase.co/functions/v1/studio-api/public/action";
const ENVELOPE_ID = "studio-live-envelope";

type Model = {
  overview: WorldOverview;
  documents: StudioDocument[];
  blocks: StudioDocumentBlock[];
  envelope: StudioObject | null;
  storedAt: string;
};

export type CanonicalWrite =
  | { ok: true; conflict: false; state: SharedStudio }
  | { ok: false; conflict: true; state: SharedStudio };

async function studioCall<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(EDGE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, payload }),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || `STUDIO_${response.status}`);
  }
  return body.data as T;
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function shapeObject(row: any): StudioObject {
  return {
    id: String(row.id),
    world_key: String(row.world_key || "tqs-studio-world"),
    kind: String(row.kind || "text"),
    semantic_path: String(row.semantic_path || ""),
    parent_id: row.parent_id ? String(row.parent_id) : null,
    x: num(row.x),
    y: num(row.y),
    w: num(row.w),
    h: num(row.h),
    z: num(row.z),
    title: String(row.title || ""),
    body: row.body && typeof row.body === "object" ? row.body : {},
    relations: Array.isArray(row.relations) ? row.relations : [],
    status: row.status ?? null,
    hidden: Boolean(row.hidden),
    revision: num(row.revision || 1),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function shapeDocument(row: any): StudioDocument {
  return {
    id: String(row.id),
    world_key: String(row.world_key || "tqs-studio-world"),
    slug: String(row.slug || ""),
    kind: String(row.kind || "instruction"),
    title: String(row.title || ""),
    semantic_path: String(row.semantic_path || ""),
    frame_id: row.frame_id ? String(row.frame_id) : null,
    revision: num(row.revision || 1),
    status: String(row.status || "DRAFT"),
    share_mode: String(row.share_mode || "private"),
    metadata: row.metadata || {},
  };
}

function shapeBlock(row: any): StudioDocumentBlock {
  return {
    block_id: String(row.block_id),
    document_id: String(row.document_id),
    ordinal: num(row.ordinal),
    block_type: String(row.block_type || "rich_text"),
    content: row.content && typeof row.content === "object" ? row.content : {},
    data_spec: row.data_spec ?? null,
    asset_id: row.asset_id ?? null,
    revision: num(row.revision || 1),
  };
}

function preserveStoredFiles(incoming: unknown, stored: unknown): unknown {
  if (typeof stored === "string" && stored.startsWith("data:") && (incoming === "" || incoming == null)) return stored;
  if (typeof incoming !== "object" || !incoming || typeof stored !== "object" || !stored || Array.isArray(incoming) || Array.isArray(stored)) return incoming;
  const out: Record<string, unknown> = { ...(incoming as Record<string, unknown>) };
  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    if (key in out) out[key] = preserveStoredFiles(out[key], value);
    else if (typeof value === "string" && value.startsWith("data:")) out[key] = value;
  }
  return out;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map(key => [key, stable((value as Record<string, unknown>)[key])]));
  }
  return value;
}

function sameJson(a: unknown, b: unknown) {
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}

function objectPatch(incoming: StudioObject, stored: StudioObject | undefined) {
  const body = preserveStoredFiles(incoming.body || {}, stored?.body || {}) as StudioObject["body"];
  const next = {
    kind: incoming.kind,
    semantic_path: incoming.semantic_path,
    parent_id: incoming.parent_id,
    x: num(incoming.x),
    y: num(incoming.y),
    w: num(incoming.w),
    h: num(incoming.h),
    z: num(incoming.z),
    title: incoming.title,
    body,
    relations: incoming.relations || [],
    status: incoming.status ?? null,
    hidden: Boolean(incoming.hidden),
  };
  if (!stored) return next;
  const current = {
    kind: stored.kind,
    semantic_path: stored.semantic_path,
    parent_id: stored.parent_id,
    x: num(stored.x),
    y: num(stored.y),
    w: num(stored.w),
    h: num(stored.h),
    z: num(stored.z),
    title: stored.title,
    body: stored.body || {},
    relations: stored.relations || [],
    status: stored.status ?? null,
    hidden: Boolean(stored.hidden),
  };
  return sameJson(next, current) ? null : next;
}

async function pool<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await task(item);
    }
  });
  await Promise.all(workers);
}

async function loadModel(): Promise<Model> {
  const [overviewRaw, documentsRaw] = await Promise.all([
    studioCall<any>("getWorldOverview"),
    studioCall<any[]>("listDocuments"),
  ]);
  const documents: StudioDocument[] = (documentsRaw || []).map(shapeDocument);
  const bundles = await Promise.all(documents.map(async document => {
    const bundle = await studioCall<any>("getDocument", { documentId: document.id });
    return (bundle?.blocks || []).map(shapeBlock);
  }));
  const objects: StudioObject[] = (overviewRaw?.objects || []).map(shapeObject);
  const envelope = objects.find(object => object.id === ENVELOPE_ID) || null;
  return {
    overview: {
      world: {
        world_key: overviewRaw?.world?.world_key || "tqs-studio-world",
        revision: num(overviewRaw?.world?.revision || 1),
        title: overviewRaw?.world?.title || "TQS Studio World",
        metadata: overviewRaw?.world?.metadata || {},
      },
      objects,
      activity: overviewRaw?.activity || [],
    },
    documents,
    blocks: bundles.flat(),
    envelope,
    storedAt: String(overviewRaw?.world?.updated_at || ""),
  };
}

function project(model: Model): SharedStudio {
  const body = model.envelope?.body || {};
  const theme = body.theme === "dark" ? "dark" : "light";
  const updatedAt = typeof body.updatedAt === "string" && body.updatedAt
    ? body.updatedAt
    : model.overview.world.metadata?.updated_at || new Date(0).toISOString();
  const state: SharedStudio = {
    version: 2,
    updatedAt,
    theme,
    activeDocumentId: body.activeDocumentId ? String(body.activeDocumentId) : null,
    overview: {
      ...model.overview,
      objects: model.overview.objects.filter(object => object.id !== ENVELOPE_ID && !object.hidden),
    },
    documents: model.documents,
    blocks: model.blocks,
    operator: body.operator || null,
  };
  if (state.version !== 2 || !state.overview || !Array.isArray(state.documents) || !Array.isArray(state.blocks)) {
    throw new Error("CANONICAL_STATE_INVALID");
  }
  return state;
}

export async function readCanonicalLive(): Promise<SharedStudio> {
  const model = await loadModel();
  return project({ ...model, envelope: withStamp(model.envelope, readStamp(model)) });
}

function withStamp(envelope: StudioObject | null, updatedAt: string): StudioObject | null {
  if (!envelope) {
    if (!updatedAt) return null;
    return {
      id: ENVELOPE_ID,
      world_key: "tqs-studio-world",
      kind: "note",
      semantic_path: "system/live",
      parent_id: null,
      x: 0, y: 0, w: 1, h: 1, z: 0,
      title: "Служебное состояние",
      body: { role: "live-envelope", updatedAt },
      relations: [],
      status: null,
      hidden: true,
      revision: 1,
    };
  }
  return { ...envelope, body: { ...(envelope.body || {}), updatedAt: updatedAt || envelope.body?.updatedAt } };
}

function readStamp(model: Model) {
  const stamped = model.envelope?.body?.updatedAt;
  if (typeof stamped === "string" && stamped) return stamped;
  return model.storedAt || new Date(0).toISOString();
}

async function writeEnvelope(model: Model, state: SharedStudio) {
  const body = {
    role: "live-envelope",
    theme: state.theme,
    activeDocumentId: state.activeDocumentId,
    operator: state.operator || null,
    updatedAt: state.updatedAt,
  };
  if (!model.envelope) {
    await studioCall("createWorldObject", {
      object: {
        id: ENVELOPE_ID,
        kind: "note",
        semantic_path: "system/live",
        parent_id: null,
        x: 0, y: 0, w: 1, h: 1, z: 0,
        title: "Служебное состояние",
        body,
        relations: [],
        status: null,
        hidden: true,
      },
    });
    return;
  }
  const patch = objectPatch({ ...model.envelope, body, hidden: true, title: model.envelope.title || "Служебное состояние" }, model.envelope);
  if (!patch && model.envelope.body?.updatedAt === state.updatedAt && model.envelope.body?.theme === state.theme) return;
  await studioCall("updateObject", { id: ENVELOPE_ID, revision: model.envelope.revision, patch: { ...patch, body, hidden: true } });
}

async function writeObjects(model: Model, state: SharedStudio) {
  const stored = new Map(model.overview.objects.filter(object => object.id !== ENVELOPE_ID).map(object => [object.id, object]));
  const incoming = state.overview.objects.filter(object => object.id !== ENVELOPE_ID);
  const jobs: Array<() => Promise<void>> = [];
  for (const object of incoming) {
    const patch = objectPatch(object, stored.get(object.id));
    if (!patch) continue;
    if (!stored.has(object.id)) {
      jobs.push(() => studioCall("createWorldObject", { object: { ...object, ...patch, id: object.id } }));
    } else {
      jobs.push(() => studioCall("updateObject", { id: object.id, revision: stored.get(object.id)?.revision, patch }));
    }
  }
  for (const object of stored.values()) {
    if (incoming.some(item => item.id === object.id) || object.hidden) continue;
    jobs.push(() => studioCall("updateObject", { id: object.id, revision: object.revision, patch: { hidden: true } }));
  }
  await pool(jobs, 6, job => job());
}

function blockSignature(block: StudioDocumentBlock) {
  return {
    block_type: block.block_type,
    content: block.content || {},
    data_spec: block.data_spec ?? null,
  };
}

type RankedBlock = { block_id: string; ordinal: number };

function reorderRanks(blocks: RankedBlock[], blockId: string, targetOrdinal: number) {
  const target = Math.max(1, Math.min(targetOrdinal, blocks.length));
  return blocks
    .map(block => ({
      ...block,
      sortKey: block.block_id === blockId ? target : block.ordinal >= target ? block.ordinal + 0.5 : block.ordinal,
    }))
    .sort((a, b) => a.sortKey - b.sortKey || a.ordinal - b.ordinal || (a.block_id < b.block_id ? -1 : a.block_id > b.block_id ? 1 : 0))
    .map((block, index) => ({ block_id: block.block_id, ordinal: index + 1 }));
}

async function alignOrdinals(documentId: string, current: RankedBlock[], desired: RankedBlock[]) {
  let ranks = [...current].sort((a, b) => a.ordinal - b.ordinal || (a.block_id < b.block_id ? -1 : 1));
  const order = [...desired].sort((a, b) => a.ordinal - b.ordinal || (a.block_id < b.block_id ? -1 : 1));
  if (ranks.length !== order.length || ranks.some(block => !order.some(item => item.block_id === block.block_id))) return;
  for (let index = 0; index < order.length; index += 1) {
    if (ranks[index]?.block_id === order[index].block_id) continue;
    const blockId = order[index].block_id;
    await studioCall("reorderDocumentBlock", { documentId, blockId, targetOrdinal: index + 1 });
    ranks = reorderRanks(ranks, blockId, index + 1);
  }
}

async function writeDocuments(model: Model, state: SharedStudio) {
  const storedDocs = new Map(model.documents.map(document => [document.id, document]));
  for (const document of state.documents) {
    if (!storedDocs.has(document.id)) {
      await studioCall("createDocument", {
        id: document.id,
        title: document.title,
        slug: document.slug,
        kind: document.kind,
        semanticPath: document.semantic_path,
        frameId: document.frame_id,
      });
    }
    const storedBlocks = model.blocks.filter(block => block.document_id === document.id);
    const incomingBlocks = state.blocks.filter(block => block.document_id === document.id);
    const storedById = new Map(storedBlocks.map(block => [block.block_id, block]));
    for (const block of incomingBlocks) {
      const stored = storedById.get(block.block_id);
      const content = preserveStoredFiles(block.content || {}, stored?.content || {}) as StudioDocumentBlock["content"];
      const changed = !stored || !sameJson(blockSignature({ ...block, content }), blockSignature(stored));
      if (changed) {
        await studioCall("upsertDocumentBlock", {
          documentId: document.id,
          blockId: block.block_id,
          blockType: block.block_type,
          content,
          dataSpec: block.data_spec ?? null,
          semanticPath: document.semantic_path,
        });
      }
    }
    let ranks: RankedBlock[] = storedBlocks.map(block => ({ block_id: block.block_id, ordinal: num(block.ordinal) }));
    let nextOrdinal = ranks.reduce((max, block) => Math.max(max, block.ordinal), 0) + 1;
    for (const block of incomingBlocks) {
      if (ranks.some(item => item.block_id === block.block_id)) continue;
      ranks.push({ block_id: block.block_id, ordinal: nextOrdinal });
      nextOrdinal += 1;
    }
    await alignOrdinals(document.id, ranks, incomingBlocks.map(block => ({ block_id: block.block_id, ordinal: num(block.ordinal) })));
    for (const block of storedBlocks) {
      if (incomingBlocks.some(item => item.block_id === block.block_id) || block.content?.hidden) continue;
      await studioCall("upsertDocumentBlock", {
        documentId: document.id,
        blockId: block.block_id,
        blockType: block.block_type,
        content: { ...(block.content || {}), hidden: true },
        dataSpec: block.data_spec ?? null,
      });
    }
  }
}

export async function writeCanonicalLive(state: SharedStudio, baseUpdatedAt = ""): Promise<CanonicalWrite> {
  const model = await loadModel();
  const currentStamp = readStamp(model);
  const current = project({ ...model, envelope: withStamp(model.envelope, currentStamp) });
  if (baseUpdatedAt && current.updatedAt && baseUpdatedAt !== current.updatedAt) {
    return { ok: false, conflict: true, state: current };
  }
  await writeObjects(model, state);
  await writeDocuments(model, state);
  await writeEnvelope(model, state);
  const saved = await readCanonicalLive();
  if (saved.updatedAt !== state.updatedAt) {
    throw new Error("CANONICAL_READBACK_MISMATCH");
  }
  return { ok: true, conflict: false, state: saved };
}

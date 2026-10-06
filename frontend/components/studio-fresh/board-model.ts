export type BoardKind = "frame" | "text" | "note" | "card";
export type FrameRole = "area" | "course" | "lesson" | "shelf";
export type BoardItem = {
  id: string;
  kind: BoardKind;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color?: string;
  parentId?: string;
  locked?: boolean;
  role?: FrameRole;
  src?: string;
};

export type Camera = { x: number; y: number; z: number };

export const BOARD_LAYOUT = 1;

export type BoardFile = {
  kind: "studio-board";
  version: 1 | 2;
  layout: number;
  camera: Camera | null;
  items: BoardItem[];
};

const NOTE_W = 220;
const NOTE_H = 156;

export function starterBoard(): BoardFile {
  const items: BoardItem[] = [];
  const rooms: Array<[string, string, string]> = [
    ["dev", "Разработка", "Код и сборка. Сюда — то, что меняет продукт."],
    ["agent", "Агент", "Что агент должен сделать сам, без ручной очереди."],
    ["intel", "TQS Intelligence", "Исследования, из которых потом получается правило."],
    ["trading", "Трейдинг", "Подготовка к сессии и решение до входа."],
  ];
  rooms.forEach(([id, title, copy], index) => {
    const x = index * 792;
    items.push(frame(id, x, 0, 720, 520, title, "area"));
    items.push(text(`${id}-line`, x + 24, 64, 520, 96, copy, id));
  });

  const learningX = 3280;
  const pad = 40;
  const gap = 48;
  const courseW = 1640;
  const courseH = 1760;
  const shelfH = 200;
  const learningW = pad + courseW + gap + courseW + pad;
  const learningH = 52 + courseH + 36 + shelfH + 36;
  items.push(frame("learning", learningX, 0, learningW, learningH, "Обучение", "area"));

  const courseY = 52;
  buildCourse(items, {
    id: "course-ru",
    title: "Бесплатный курс",
    x: learningX + pad,
    y: courseY,
    w: courseW,
    h: courseH,
    parentId: "learning",
    lesson: "workspace",
  });
  buildCourse(items, {
    id: "course-scalp",
    title: "Скальпинг по стаканам",
    x: learningX + pad + courseW + gap,
    y: courseY,
    w: courseW,
    h: courseH,
    parentId: "learning",
    lesson: "book",
  });

  const shelfY = courseY + courseH + 36;
  const shelfGap = 28;
  const shelfW = (learningW - pad * 2 - shelfGap * 2) / 3;
  const shelves: Array<[string, string, string]> = [
    ["crypto", "Крипта", "Отдельная полка. Не смешивать с курсом по российскому рынку."],
    ["stocks", "Акции", "Акции и материалы, которые относятся только к ним."],
    ["kb", "База знаний", "То, что уже решено и можно просто перечитать."],
  ];
  shelves.forEach(([id, title, copy], index) => {
    const x = learningX + pad + index * (shelfW + shelfGap);
    items.push(frame(id, x, shelfY, shelfW, shelfH, title, "shelf", "learning"));
    items.push(text(`${id}-line`, x + 20, shelfY + 52, shelfW - 40, 88, copy, id));
  });

  return { kind: "studio-board", version: 2, layout: BOARD_LAYOUT, camera: null, items };
}

export function readBoard(value: unknown): { file: BoardFile; upgraded: boolean } {
  if (isFile(value, 1) || isFile(value, 2)) {
    const items = value.items.flatMap((item) => {
      const next = asItem(item);
      return next ? [next] : [];
    });
    const layout = num((value as { layout?: unknown }).layout, 0);
    const current = layout >= BOARD_LAYOUT && items.some((item) => item.id === "course-scalp");
    if (current) {
      return { file: { kind: "studio-board", version: 2, layout: BOARD_LAYOUT, camera: asCamera(value.camera), items: items.length ? items : starterBoard().items }, upgraded: false };
    }
    if (value.version === 2) return { file: relayout(items), upgraded: true };
    return { file: migrate({ camera: value.camera, items }), upgraded: true };
  }
  const imported = fromTldraw(value);
  if (imported.length) return { file: { kind: "studio-board", version: 2, layout: BOARD_LAYOUT, camera: null, items: nest(imported) }, upgraded: true };
  return { file: starterBoard(), upgraded: false };
}

export function hostFrame(items: BoardItem[], x: number, y: number, kind: "lesson" | "material") {
  if (kind === "lesson") return frameAt(items, x, y, ["course"]) ?? nearest(items.filter((item) => item.role === "course"), x, y) ?? frameAt(items, x, y, ["area"]);
  const direct = frameAt(items, x, y);
  if (!direct) return null;
  if (direct.role === "lesson" || direct.role === "shelf") return direct;
  if (direct.role === "course") return nearest(items.filter((item) => item.role === "lesson" && item.parentId === direct.id), x, y) ?? direct;
  const child = nearest(items.filter((item) => item.kind === "frame" && item.parentId === direct.id), x, y);
  if (!child) return direct;
  if (child.role === "course") return nearest(items.filter((item) => item.role === "lesson" && item.parentId === child.id), x, y) ?? child;
  return child;
}

export function frameAt(items: BoardItem[], x: number, y: number, roles?: FrameRole[]) {
  const hits = items.filter((item) => item.kind === "frame" && contains(item, x, y) && (!roles || (item.role ? roles.includes(item.role) : false)));
  hits.sort((a, b) => a.w * a.h - b.w * b.h);
  return hits[0] ?? null;
}

export function childIds(items: BoardItem[], rootId: string) {
  const byParent = new Map<string, string[]>();
  for (const item of items) {
    if (!item.parentId) continue;
    const list = byParent.get(item.parentId) ?? [];
    list.push(item.id);
    byParent.set(item.parentId, list);
  }
  const out: string[] = [];
  const stack = [...(byParent.get(rootId) ?? [])];
  const seen = new Set<string>([rootId]);
  while (stack.length) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const child of byParent.get(id) ?? []) stack.push(child);
  }
  return out;
}

export function shiftGroup(items: BoardItem[], rootId: string, dx: number, dy: number) {
  const ids = new Set([rootId, ...childIds(items, rootId)]);
  return items.map((item) => (ids.has(item.id) ? { ...item, x: item.x + dx, y: item.y + dy } : item));
}

export function rehost(items: BoardItem[], id: string) {
  const item = items.find((row) => row.id === id);
  if (!item) return items;
  const banned = new Set([item.id, ...childIds(items, item.id)]);
  const pointX = item.x + item.w / 2;
  const pointY = item.y + Math.min(36, item.h / 2);
  const hosts = items.filter((row) => row.kind === "frame" && !banned.has(row.id) && contains(row, pointX, pointY));
  hosts.sort((a, b) => a.w * a.h - b.w * b.h);
  const nextParent = pickHost(item, hosts);
  if (!nextParent || nextParent.id === item.parentId) return items;
  return items.map((row) => (row.id === id ? { ...row, parentId: nextParent.id } : row));
}

function pickHost(item: BoardItem, hosts: BoardItem[]) {
  if (item.role === "lesson") return hosts.find((host) => host.role === "course") ?? null;
  if (item.role === "course" || item.role === "shelf") return hosts.find((host) => host.role === "area") ?? null;
  if (item.kind === "frame") return null;
  return hosts.find((host) => host.role === "lesson" || host.role === "shelf") ?? hosts.find((host) => host.role === "course") ?? hosts[0] ?? null;
}

export function boardProblems(board: BoardFile) {
  const problems: string[] = [];
  const byId = new Map(board.items.map((item) => [item.id, item]));
  const learning = byId.get("learning");
  const course = byId.get("course-ru");
  const scalp = byId.get("course-scalp");
  const lesson = byId.get("lesson-1");
  if (!learning || !course || !scalp || !lesson) {
    problems.push("нет обучения, двух курсов или занятия 1");
    return problems;
  }
  if (course.w !== scalp.w || course.h !== scalp.h) problems.push("курсы разного размера");
  if (course.parentId !== "learning" || scalp.parentId !== "learning") problems.push("курс лежит не в обучении");
  if (!inside(learning, course) || !inside(learning, scalp)) problems.push("курс вылезает из обучения");
  if (lesson.parentId !== "course-ru" || !inside(course, lesson)) problems.push("занятие 1 не в бесплатном курсе");
  const scalpLessons = board.items.filter((item) => item.parentId === "course-scalp" && item.role === "lesson");
  if (scalpLessons.length < 3) problems.push("в скальпинге меньше трёх занятий");
  const materials = board.items.filter((item) => item.parentId === "lesson-1");
  if (!materials.some((item) => item.kind === "text") || !materials.some((item) => item.kind === "note") || !materials.some((item) => item.kind === "card")) {
    problems.push("в занятии 1 нет текста, заметки и карточки");
  }
  for (const item of board.items) {
    if (!item.parentId) continue;
    const parent = byId.get(item.parentId);
    if (!parent) {
      problems.push(`битый родитель у ${item.id}`);
      continue;
    }
    if (!inside(parent, item)) problems.push(`${item.id} не помещается в ${parent.id}`);
    if (item.kind !== "frame" && item.y < parent.y + 40) problems.push(`${item.id} заезжает на название`);
  }
  return problems;
}

export function fitCamera(item: BoardItem, width: number, height: number, inset = 72): Camera {
  const z = Math.max(0.08, Math.min(1.4, Math.min((width - inset * 2) / item.w, (height - inset * 2) / item.h)));
  return {
    x: (width - item.w * z) / 2 - item.x * z,
    y: (height - item.h * z) / 2 - item.y * z,
    z,
  };
}

function buildCourse(items: BoardItem[], course: { id: string; title: string; x: number; y: number; w: number; h: number; parentId: string; lesson: "workspace" | "book" }) {
  items.push(frame(course.id, course.x, course.y, course.w, course.h, course.title, "course", course.parentId));
  const ip = 28;
  const lessonW = course.w - ip * 2;
  const lessonH = 980;
  const lessonX = course.x + ip;
  const lessonY = course.y + 44;
  const rowY = lessonY + lessonH + 20;
  const rowH = course.y + course.h - ip - rowY;
  const smallW = (lessonW - 20) / 2;
  if (course.lesson === "workspace") {
    items.push(frame("lesson-1", lessonX, lessonY, lessonW, lessonH, "Занятие 1", "lesson", course.id));
    workspaceLesson(items, lessonX, lessonY, lessonW);
    lessonShell(items, "lesson-2", "Занятие 2", "Стакан и лента", "Стакан — ликвидность сейчас. Лента — кто уже ударил по цене.", lessonX, rowY, smallW, rowH, course.id);
    lessonShell(items, "lesson-3", "Занятие 3", "Базовая подготовка", "Перед сессией: контекст, уровни и то, что отменяет идею.", lessonX + smallW + 20, rowY, smallW, rowH, course.id);
    return;
  }
  items.push(frame("scalp-1", lessonX, lessonY, lessonW, lessonH, "Занятие 1", "lesson", course.id));
  bookLesson(items, lessonX, lessonY, lessonW);
  lessonShell(items, "scalp-2", "Занятие 2", "Лента подтверждает", "Лента показывает, съели уровень или только постояли рядом.", lessonX, rowY, smallW, rowH, course.id);
  lessonShell(items, "scalp-3", "Занятие 3", "Вход и отмена", "Нет подтверждения лентой — нет входа. Отмена заранее, не по чувству.", lessonX + smallW + 20, rowY, smallW, rowH, course.id);
}

function workspaceLesson(items: BoardItem[], x: number, y: number, w: number) {
  const col = x + 250;
  const right = x + w - 16 - 230;
  items.push(text("l-intro", col, y + 52, 740, 108, "Занятие 1\nНастраиваем экран так, чтобы он помогал решению, а не отвлекал.", "lesson-1", "l"));
  items.push(text("l-1", col, y + 176, 740, 116, "1. Один экран — одно решение\nГрафик занимает центр. Всё остальное появляется, только если влияет на сделку.", "lesson-1"));
  items.push(text("l-2", col, y + 308, 740, 112, "2. Рядом с ценой\nСтакан и лента стоят у графика. Заметки не закрывают цену.", "lesson-1"));
  items.push(text("l-3", col, y + 436, 740, 112, "3. Убрать лишнее\nЕсли панель не отвечает на вопрос «что делать», её нет на экране.", "lesson-1"));
  items.push(card("l-shot", col, y + 564, 740, 380, "Скриншот рабочего пространства\nСюда кладётся картинка и пометки поверх неё", "lesson-1"));
  items.push(note("l-left", x + 16, y + 176, "Слева, пока готовлю урок\nЧто сказать вслух на этом шаге", "amber", "lesson-1"));
  items.push(note("l-right", right, y + 176, "Справа, правка\nСтакан ближе к графику. Лишнюю панель убрать до занятия.", "violet", "lesson-1"));
  items.push(note("l-doc", right, y + 352, "Конспект этого занятия лежит в разделе «Документы». Блок 6 — картинка рабочего места.", "cyan", "lesson-1"));
}

function bookLesson(items: BoardItem[], x: number, y: number, w: number) {
  const col = x + 250;
  items.push(text("s-intro", col, y + 52, 740, 120, "Занятие 1\nСтакан — это очередь, не стрелка. Смотрим, где ликвидность стоит и кто её снимает.", "scalp-1", "l"));
  items.push(text("s-1", col, y + 188, 740, 120, "Лучший bid и ask — намерение. Сделка появляется только в ленте.", "scalp-1"));
  items.push(card("s-shot", col, y + 340, 740, 400, "Схема стакана\nСюда — картинка очереди и пометки поверх неё.", "scalp-1"));
  items.push(note("s-left", x + 16, y + 188, "На занятии\nПоказать лучший bid и ask. Очередь — намерение, не сделка.", "amber", "scalp-1"));
  items.push(note("s-right", x + w - 16 - 230, y + 188, "Не называть уровень сигналом, пока лента его не подтвердила.", "cyan", "scalp-1"));
}

function lessonShell(items: BoardItem[], id: string, title: string, name: string, copy: string, x: number, y: number, w: number, h: number, parentId: string) {
  items.push(frame(id, x, y, w, h, title, "lesson", parentId));
  items.push(text(`${id}-title`, x + 20, y + 52, w - 40, 88, name, id, "l"));
  items.push(text(`${id}-body`, x + 20, y + 156, w - 40, 110, copy, id));
  items.push(note(`${id}-note`, x + 20, y + 286, "Заметки к этому занятию кладутся сюда.", "amber", id));
}

function migrate(file: { camera?: unknown; items: unknown[] }): BoardFile {
  const old = file.items.flatMap((item) => {
    const next = asItem(item);
    return next ? [next] : [];
  });
  const ids = new Set(old.map((item) => item.id));
  const known = ids.has("learning") && ids.has("course-ru") && ids.has("lesson-1") && !ids.has("course-scalp");
  if (!known) return { kind: "studio-board", version: 2, layout: BOARD_LAYOUT, camera: asCamera(file.camera), items: nest(old) };
  return relayout(old);
}

function relayout(old: BoardItem[]): BoardFile {
  const fresh = starterBoard();
  const previous = new Map(old.map((item) => [item.id, item]));
  for (const item of fresh.items) {
    const prev = previous.get(item.id);
    if (prev && prev.kind !== "frame" && prev.text.trim()) item.text = prev.text;
    if (prev?.src) item.src = prev.src;
  }
  const knownIds = new Set(fresh.items.map((item) => item.id));
  for (const prev of old) {
    if (knownIds.has(prev.id)) continue;
    const parent = frameAt(fresh.items, prev.x + prev.w / 2, prev.y + prev.h / 2);
    fresh.items.push({ ...prev, parentId: parent?.id });
  }
  return fresh;
}

function nest(items: BoardItem[]) {
  const frames = items.filter((item) => item.kind === "frame");
  return items.map((item) => {
    const point = { x: item.x + Math.min(24, item.w / 2), y: item.y + Math.min(24, item.h / 2) };
    const containers = frames.filter((frame) => frame.id !== item.id && contains(frame, point.x, point.y));
    containers.sort((a, b) => a.w * a.h - b.w * b.h);
    const parent = containers[0];
    return parent ? { ...item, parentId: parent.id } : item;
  });
}

function frame(id: string, x: number, y: number, w: number, h: number, text: string, role: FrameRole, parentId?: string, locked = false): BoardItem {
  return { id, kind: "frame", x, y, w, h, text, role, parentId, locked };
}

function text(id: string, x: number, y: number, w: number, h: number, value: string, parentId?: string, size?: "l"): BoardItem {
  return { id, kind: "text", x, y, w, h, text: value, parentId, color: size };
}

function note(id: string, x: number, y: number, value: string, color: string, parentId?: string): BoardItem {
  return { id, kind: "note", x, y, w: NOTE_W, h: NOTE_H, text: value, color, parentId };
}

function card(id: string, x: number, y: number, w: number, h: number, value: string, parentId?: string): BoardItem {
  return { id, kind: "card", x, y, w, h, text: value, parentId };
}

function nearest(frames: BoardItem[], x: number, y: number) {
  let best: BoardItem | null = null;
  let score = Infinity;
  for (const frame of frames) {
    const cx = Math.min(Math.max(x, frame.x), frame.x + frame.w);
    const cy = Math.min(Math.max(y, frame.y), frame.y + frame.h);
    const rank = ((cx - x) ** 2 + (cy - y) ** 2) * 1000 + frame.w * frame.h;
    if (rank < score) {
      score = rank;
      best = frame;
    }
  }
  return best;
}

function inside(parent: BoardItem, child: BoardItem) {
  return child.x >= parent.x && child.y >= parent.y && child.x + child.w <= parent.x + parent.w + 0.5 && child.y + child.h <= parent.y + parent.h + 0.5;
}

function contains(item: BoardItem, x: number, y: number) {
  return x >= item.x && y >= item.y && x <= item.x + item.w && y <= item.y + item.h;
}

function isFile(value: unknown, version: 1 | 2): value is { kind: "studio-board"; version: 1 | 2; camera?: unknown; items: unknown[] } {
  if (!value || typeof value !== "object") return false;
  const board = value as { kind?: string; version?: number; items?: unknown };
  return board.kind === "studio-board" && board.version === version && Array.isArray(board.items);
}

function asItem(value: unknown): BoardItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<BoardItem> & { kind?: string };
  const kindRaw = (value as { kind?: string }).kind;
  const kind = kindRaw === "box" ? "card" : row.kind;
  if (typeof row.id !== "string" || (kind !== "frame" && kind !== "text" && kind !== "note" && kind !== "card")) return null;
  const role = row.role === "area" || row.role === "course" || row.role === "lesson" || row.role === "shelf" ? row.role : undefined;
  return {
    id: row.id,
    kind,
    x: num(row.x, 0),
    y: num(row.y, 0),
    w: Math.max(40, num(row.w, 160)),
    h: Math.max(32, num(row.h, 80)),
    text: typeof row.text === "string" ? row.text : "",
    color: typeof row.color === "string" ? row.color : undefined,
    parentId: typeof row.parentId === "string" ? row.parentId : undefined,
    locked: row.locked === true,
    role,
    src: typeof row.src === "string" && row.src.trim() ? row.src : undefined,
  };
}

function asCamera(value: unknown): Camera | null {
  if (!value || typeof value !== "object") return null;
  const camera = value as Camera;
  if (![camera.x, camera.y, camera.z].every((part) => typeof part === "number" && Number.isFinite(part))) return null;
  return { x: camera.x, y: camera.y, z: camera.z };
}

function fromTldraw(value: unknown) {
  const store = (value as { document?: { store?: Record<string, RawShape> } } | null)?.document?.store;
  if (!store) return [];
  const shapes = Object.values(store).filter((row) => row?.typeName === "shape" && row.id);
  const byId = new Map(shapes.map((row) => [row.id, row]));
  const items: BoardItem[] = [];
  for (const row of shapes) {
    const point = absolute(row, byId);
    const textValue = richToText(row.props?.richText) || row.props?.name || "";
    if (row.type === "frame") items.push(frame(plain(row.id), point.x, point.y, num(row.props?.w, 200), num(row.props?.h, 120), row.props?.name || textValue, "area"));
    else if (row.type === "text") {
      const large = row.props?.size === "l" || row.props?.size === "xl";
      items.push(text(plain(row.id), point.x, point.y, num(row.props?.w, 320), Math.max(1, textValue.split("\n").length) * (large ? 36 : 26) + 28, textValue, undefined, large ? "l" : undefined));
    } else if (row.type === "note") items.push(note(plain(row.id), point.x, point.y, textValue, row.props?.color || "amber"));
    else if (row.type === "geo") items.push(card(plain(row.id), point.x, point.y, num(row.props?.w, 200), num(row.props?.h, 120), textValue));
  }
  return items;
}

type RawShape = {
  id: string;
  type?: string;
  typeName?: string;
  parentId?: string;
  x?: number;
  y?: number;
  props?: { w?: number; h?: number; name?: string; richText?: unknown; color?: string; size?: string };
};

function absolute(row: RawShape, byId: Map<string, RawShape>) {
  let x = row.x || 0;
  let y = row.y || 0;
  let parent = row.parentId ? byId.get(row.parentId) : undefined;
  const seen = new Set<string>([row.id]);
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    x += parent.x || 0;
    y += parent.y || 0;
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return { x, y };
}

function richToText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const row = node as { type?: string; text?: string; content?: unknown[] };
  if (typeof row.text === "string") return row.text;
  const parts = Array.isArray(row.content) ? row.content.map(richToText) : [];
  if (row.type === "doc") return parts.filter(Boolean).join("\n");
  return parts.join("");
}

function plain(id: string) {
  return id.replace(/^shape:/, "");
}

function num(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export type HandoutKind = "heading" | "text" | "callout" | "video" | "image";
export type BlockTone = "amber" | "blue" | "green" | "rose";
export type HandoutBlock = {
  id: string;
  kind: HandoutKind;
  text: string;
  src?: string;
  tone?: BlockTone;
  hidden?: boolean;
  comment?: string;
};
export type StudioTheme = "light" | "dark";

export type StudioLive = {
  version: 1;
  updatedAt: string;
  theme: StudioTheme;
  handout: HandoutBlock[];
  board: unknown;
};

export const LIVE_KEY = "tqs-studio-live-v1";

export const HANDOUT_STARTER: HandoutBlock[] = [
  { id: "h", kind: "heading", text: "Занятие 1 — Настройка рабочего пространства" },
  { id: "p1", kind: "text", text: "Конспект к занятию. Экран собирается так, чтобы график, стакан и лента отвечали на один вопрос: что делать с ценой." },
  { id: "c1", kind: "callout", text: "Практика: оставьте на экране только то, что влияет на торговое решение." },
  { id: "p2", kind: "text", text: "График — контекст цены. Стакан — текущая ликвидность. Лента — агрессор и темп." },
  { id: "p3", kind: "text", text: "Дальше место для картинки. Фраза «блок 6» означает следующий блок." },
  { id: "img", kind: "image", text: "Как должно выглядеть рабочее пространство: график в центре, стакан и лента рядом." },
  { id: "p4", kind: "text", text: "Живой пример на занятии — фьючерс Si. На доске рядом с этим шагом лежит график." },
  { id: "vid", kind: "video", text: "" },
];

const KINDS = new Set<HandoutKind>(["heading", "text", "callout", "video", "image"]);
const TONES = new Set<BlockTone>(["amber", "blue", "green", "rose"]);

export function plainBlockText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function isStudioLive(value: unknown): value is StudioLive {
  if (!value || typeof value !== "object") return false;
  const row = value as StudioLive;
  return row.version === 1 && typeof row.updatedAt === "string" && (row.theme === "light" || row.theme === "dark") && Array.isArray(row.handout);
}

export function readLegacyLive(): { theme?: StudioTheme; handout?: HandoutBlock[] } | null {
  try {
    const theme = localStorage.getItem("tqs-studio-theme");
    const handout = normalizeHandout(JSON.parse(localStorage.getItem("tqs-studio-handout-v1") || "null"));
    const hasHandout = localStorage.getItem("tqs-studio-handout-v1");
    if (theme !== "light" && theme !== "dark" && !hasHandout) return null;
    return {
      theme: theme === "light" || theme === "dark" ? theme : undefined,
      handout: hasHandout ? handout : undefined,
    };
  } catch {
    return null;
  }
}

export function readLocalLive(): StudioLive | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(LIVE_KEY) || "");
    return isStudioLive(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLocalLive(state: StudioLive) {
  localStorage.setItem(LIVE_KEY, JSON.stringify(state));
}

export function newerLive(a: StudioLive | null, b: StudioLive | null) {
  if (!a) return b;
  if (!b) return a;
  return a.updatedAt >= b.updatedAt ? a : b;
}

export async function pullLive(): Promise<StudioLive | null> {
  try {
    const response = await fetch("/api/studio/live", { cache: "no-store" });
    if (!response.ok) return null;
    const parsed = await response.json();
    return isStudioLive(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function pushLive(state: StudioLive): Promise<"remote" | "local"> {
  writeLocalLive(state);
  try {
    const response = await fetch("/api/studio/live", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state),
    });
    const parsed = await response.json().catch(() => null);
    return response.ok && parsed?.remote ? "remote" : "local";
  } catch {
    return "local";
  }
}

export function liveToMarkdown(state: StudioLive) {
  const frames = frameNames(state.board);
  const blocks = state.handout
    .map((block, index) => {
      const body = block.kind === "image"
        ? [plainBlockText(block.text) || "Изображение", block.src ? (block.src.startsWith("data:") ? "файл внутри документа" : block.src) : "файла пока нет"].join("\n\n")
        : plainBlockText(block.text) || "—";
      const notes = [
        block.hidden ? "Скрыт в раздатке." : "",
        block.comment?.trim() ? `Комментарий автора: ${block.comment.trim()}` : "",
      ].filter(Boolean);
      return `### Блок ${index + 1} · ${block.kind}\n\n${body}${notes.length ? `\n\n${notes.join(" ")}` : ""}`;
    })
    .join("\n\n");
  return [
    "# TQS Studio — живое состояние",
    "",
    `Обновлено: ${state.updatedAt}`,
    `Тема: ${state.theme === "dark" ? "тёмная" : "светлая"}`,
    "",
    "## Рамки на доске",
    "",
    frames.length ? frames.map((name) => `- ${name}`).join("\n") : "- пока пусто",
    "",
    "## Конспект",
    "",
    blocks || "Конспект пуст.",
    "",
  ].join("\n");
}

function frameNames(board: unknown) {
  const own = (board as { kind?: string; items?: Array<{ kind?: string; text?: string }> } | null)?.items;
  if ((board as { kind?: string } | null)?.kind === "studio-board" && Array.isArray(own)) {
    return own.filter((item) => item.kind === "frame" && item.text).map((item) => item.text as string);
  }
  const names: string[] = [];
  const store = (board as { document?: { store?: Record<string, unknown> } } | null)?.document?.store;
  if (!store) return names;
  for (const record of Object.values(store)) {
    const shape = record as { typeName?: string; type?: string; props?: { name?: string } };
    if (shape?.typeName === "shape" && shape.type === "frame" && shape.props?.name) names.push(shape.props.name);
  }
  return names;
}

export function normalizeHandout(value: unknown): HandoutBlock[] {
  if (!Array.isArray(value)) return HANDOUT_STARTER;
  const blocks = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const block = item as HandoutBlock;
    if (typeof block.id !== "string" || !KINDS.has(block.kind) || typeof block.text !== "string") return [];
    const next: HandoutBlock = { id: block.id, kind: block.kind, text: block.text };
    if (typeof block.src === "string" && block.src.trim()) next.src = block.src.trim();
    if (block.tone && TONES.has(block.tone)) next.tone = block.tone;
    if (block.hidden === true) next.hidden = true;
    if (typeof block.comment === "string" && block.comment.trim()) next.comment = block.comment;
    return [next];
  });
  return blocks.length ? blocks : HANDOUT_STARTER;
}

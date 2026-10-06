export type SceneNode = {
  id: string;
  role: "stage" | "risk" | "check";
  title: string;
  text: string;
  x: number;
  y: number;
};

export type VisualSceneModel = {
  grammar: "trajectory";
  title: string;
  thesis: string;
  nodes: SceneNode[];
  interaction: "stage-detail";
  sources: Array<{ id: string; title: string; kind: string }>;
};

export type SlideLayer = { id: string; kind: "kicker" | "idea" | "mark" | "note"; text: string; x: number; y: number };
export type SlideModel = { id: string; idea: string; layers: SlideLayer[] };

export const TRADER_ROADMAP_ID = "artifact-trader-roadmap";
export const TRADER_DECK_ID = "deck-trader-roadmap";
export const TRADER_ROOM_ID = "room-trader-roadmap";

export function traderRoadmapScene(): VisualSceneModel {
  return {
    grammar: "trajectory",
    title: "Становление трейдера",
    thesis: "Следующая способность открывается только после проверки предыдущей. Это путь, а не список тем.",
    interaction: "stage-detail",
    sources: [
      { id: "lesson-miro-scene", title: "Занятие 1 · рабочее пространство", kind: "lesson" },
      { id: "lesson-miro-l101", title: "Один экран — одно решение", kind: "text" },
      { id: "lesson-miro-chart", title: "Si · объём", kind: "chart" },
      { id: "lesson-miro-voice", title: "Голос про стакан", kind: "voice" },
    ],
    nodes: [
      { id: "stage-watch", role: "stage", title: "Смотреть", text: "Рынок виден целиком: инструмент, сессия, цена. Сделок ещё нет. Задача — не пропустить контекст, а не найти вход.", x: 8, y: 62 },
      { id: "stage-read", role: "stage", title: "Читать", text: "Цена, объём и стакан стоят рядом с решением. Отдельная панель, которая не влияет на сделку, убирается.", x: 26, y: 46 },
      { id: "risk-false-break", role: "risk", title: "Ложный пробой", text: "Движение без продолжения не является входом. Сначала назвать, чего не хватило: объёма, удержания уровня или ответа стакана.", x: 38, y: 74 },
      { id: "stage-place", role: "stage", title: "Место", text: "Один экран — одно решение. График в центре. Стакан и лента у цены, а не в другом окне.", x: 48, y: 38 },
      { id: "check-place", role: "check", title: "Проверка места", text: "Скрин рабочего места. Лишняя панель убрана до занятия, а не после убытка.", x: 58, y: 70 },
      { id: "stage-replay", role: "stage", title: "История", text: "Одна идея прогоняется на прошлых сессиях. Ошибка называется вслух: где глаз увидел вход, которого не было.", x: 70, y: 44 },
      { id: "stage-size", role: "stage", title: "Малый риск", text: "Размер и дневной предел потерь известны до заявки. Одна идея на сессию, не набор поводов.", x: 78, y: 34 },
      { id: "stage-repeat", role: "stage", title: "Повторять", text: "Тот же процесс на следующей сессии. После серии убытков — пауза и разбор, а не новая схема.", x: 90, y: 48 },
    ],
  };
}

export function traderDeckSlides(): SlideModel[] {
  const scene = traderRoadmapScene();
  const pick = (id: string) => scene.nodes.find(node => node.id === id)!;
  const slide = (id: string, idea: string, mark: string, note: string): SlideModel => ({
    id,
    idea,
    layers: [
      { id: `${id}-kicker`, kind: "kicker", text: "Подготовка трейдера", x: 8, y: 14 },
      { id: `${id}-idea`, kind: "idea", text: idea, x: 8, y: 28 },
      { id: `${id}-mark`, kind: "mark", text: mark, x: 8, y: 58 },
      { id: `${id}-note`, kind: "note", text: note, x: 58, y: 62 },
    ],
  });
  return [
    slide("slide-path", "Становление — это последовательность проверок, а не набор тем.", "Смотреть → читать → место → история → малый риск → повтор", scene.thesis),
    slide("slide-place", pick("stage-place").title, pick("stage-place").text, "Источник: занятие 1, один экран."),
    slide("slide-read", pick("stage-read").title, "Цена и объём стоят рядом с решением. Стакан не уезжает в отдельное окно.", "Источник: график Si и голосовая заметка занятия 1."),
    slide("slide-false-break", pick("risk-false-break").title, pick("risk-false-break").text, "Это риск между чтением рынка и собственным местом, не декоративная плашка."),
    slide("slide-size", pick("stage-size").title, pick("stage-size").text, "Проверка: предел потерь записан до заявки."),
    slide("slide-repeat", pick("stage-repeat").title, pick("stage-repeat").text, "Если процесс нельзя повторить завтра, уровня ещё нет."),
  ];
}

export function patchSceneNode(scene: VisualSceneModel, nodeId: string, patch: Partial<SceneNode>) {
  const nodes = scene.nodes.map(node => node.id === nodeId ? { ...node, ...patch } : node);
  if (!nodes.some(node => node.id === nodeId)) throw new Error("NODE_NOT_FOUND");
  return { ...scene, nodes };
}

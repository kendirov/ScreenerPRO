import { createShapeId, toRichText, type Editor, type TLShapeId } from "tldraw";

const shape = (name: string) => createShapeId(name);

function text(
  name: string,
  parent: TLShapeId,
  x: number,
  y: number,
  w: number,
  value: string,
  size: "s" | "m" | "l" | "xl" = "m",
) {
  return {
    id: shape(name),
    type: "text" as const,
    parentId: parent,
    x,
    y,
    props: {
      richText: toRichText(value),
      autoSize: false,
      w,
      font: "sans" as const,
      size,
      textAlign: "start" as const,
      color: "black" as const,
    },
  };
}

function note(
  name: string,
  parent: TLShapeId,
  x: number,
  y: number,
  value: string,
  color: "yellow" | "violet" | "light-blue",
) {
  return {
    id: shape(name),
    type: "note" as const,
    parentId: parent,
    x,
    y,
    props: {
      richText: toRichText(value),
      color,
      size: "m" as const,
      font: "sans" as const,
      align: "start" as const,
      verticalAlign: "start" as const,
      growY: 48,
    },
  };
}

function frame(
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  parent?: TLShapeId,
) {
  return {
    id: shape(name),
    type: "frame" as const,
    parentId: parent,
    x,
    y,
    props: { w, h, name: title, color: "black" as const },
  };
}

export function seedWorld(editor: Editor) {
  const learning = shape("learning");
  const course = shape("course-ru");
  const lesson = shape("lesson-1");

  editor.createShapes([
    frame("dev", 0, 0, 980, 720, "Разработка"),
    frame("agent", 1120, 0, 980, 720, "Агент"),
    frame("intel", 2240, 0, 1100, 720, "TQS Intelligence"),
    frame("trading", 3480, 0, 980, 720, "Трейдинг"),
    frame("learning", 4600, 0, 2560, 2520, "Обучение"),
  ]);

  editor.createShapes([
    frame("course-ru", 48, 96, 1520, 2280, "Бесплатный курс · российский рынок", learning),
    frame("crypto", 1620, 96, 820, 520, "Крипта", learning),
    frame("stocks", 1620, 700, 820, 520, "Акции", learning),
    frame("kb", 1620, 1300, 820, 640, "База знаний", learning),
    frame("lesson-1", 56, 240, 1400, 1320, "Занятие 1 — Настройка рабочего пространства", course),
    frame("lesson-2", 56, 1680, 660, 360, "Занятие 2 — Стакан и лента", course),
    frame("lesson-3", 760, 1680, 680, 360, "Занятие 3 — Базовая подготовка", course),
  ]);

  editor.createShapes([
    text("l-intro", lesson, 390, 28, 620, "Занятие 1\nНастраиваем экран так, чтобы он помогал решению, а не отвлекал.", "l"),
    text("l-1", lesson, 390, 190, 620, "1. Один экран — одно решение\nГрафик занимает центр. Всё остальное появляется, только если влияет на сделку.", "m"),
    text("l-2", lesson, 390, 390, 620, "2. Рядом с ценой\nСтакан и лента стоят у графика. Заметки не закрывают цену.", "m"),
    text("l-3", lesson, 390, 570, 620, "3. Убрать лишнее\nЕсли панель не отвечает на вопрос «что делать», её нет на экране.", "m"),
    {
      id: shape("l-shot"),
      type: "geo" as const,
      parentId: lesson,
      x: 390,
      y: 790,
      props: {
        geo: "rectangle" as const,
        w: 620,
        h: 360,
        richText: toRichText("Скриншот рабочего пространства\nСюда кладётся картинка и пометки поверх неё"),
        color: "light-blue" as const,
        fill: "solid" as const,
        dash: "draw" as const,
        font: "sans" as const,
        size: "m" as const,
        align: "middle" as const,
        verticalAlign: "middle" as const,
      },
    },
    note("l-left", lesson, 28, 200, "Слева, пока готовлю урок\nЧто сказать вслух на этом шаге", "yellow"),
    note("l-right", lesson, 1060, 200, "Справа, правка\nСтакан ближе к графику. Лишнюю панель убрать до занятия.", "violet"),
    note("l-doc", lesson, 1060, 560, "Конспект этого занятия лежит в разделе «Документы». Блок 6 — картинка рабочего места.", "light-blue"),
  ]);

  const bounds = editor.getShapePageBounds(lesson);
  if (bounds) editor.zoomToBounds(bounds, { inset: 72, animation: { duration: 0 } });
  editor.selectNone();
}

export function focusShape(editor: Editor, name: string) {
  const bounds = editor.getShapePageBounds(shape(name));
  if (bounds) editor.zoomToBounds(bounds, { inset: 64, animation: { duration: 280 } });
  editor.selectNone();
}

export function revealIfLost(editor: Editor) {
  const screen = editor.getViewportScreenBounds();
  if (screen.w < 40 || screen.h < 40) return false;
  const page = editor.getCurrentPageBounds();
  if (!page) return true;
  const view = editor.getViewportPageBounds();
  if (page.collides(view)) return true;
  const lesson = editor.getShapePageBounds(shape("lesson-1"));
  editor.zoomToBounds(lesson ?? page, { inset: 72, animation: { duration: 0 } });
  editor.selectNone();
  return true;
}

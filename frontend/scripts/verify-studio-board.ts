import { boardProblems, childIds, hostFrame, readBoard, rehost, shiftGroup, starterBoard } from "../components/studio-fresh/board-model";

const board = starterBoard();
const problems = boardProblems(board);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

const lesson = board.items.find((item) => item.id === "lesson-1");
const moved = shiftGroup(board.items, "lesson-1", 40, -15);
const movedLesson = moved.find((item) => item.id === "lesson-1");
const movedNote = moved.find((item) => item.id === "l-left");
if (!lesson || !movedLesson || !movedNote || movedLesson.x !== lesson.x + 40 || movedNote.x !== (board.items.find((item) => item.id === "l-left")?.x ?? 0) + 40) {
  console.error("рамка занятия не уводит свои материалы");
  process.exit(1);
}
const learning = board.items.find((item) => item.id === "learning");
if (!learning || hostFrame(board.items, learning.x + learning.w / 2, learning.y + learning.h / 2, "material")?.id !== "lesson-1") {
  console.error("новый материал с общего вида не попадает в занятие 1");
  process.exit(1);
}
if (!childIds(board.items, "course-ru").includes("l-shot")) {
  console.error("карточка занятия не в дереве курса");
  process.exit(1);
}
const course = board.items.find((item) => item.id === "course-ru");
const scalp = board.items.find((item) => item.id === "course-scalp");
const shiftedCourse = shiftGroup(board.items, "course-ru", 120, 30);
const shiftedLearning = shiftedCourse.find((item) => item.id === "learning");
const shiftedScalp = shiftedCourse.find((item) => item.id === "course-scalp");
const shiftedLesson = shiftedCourse.find((item) => item.id === "lesson-1");
if (!course || !scalp || !learning || !shiftedLearning || !shiftedScalp || !shiftedLesson) process.exit(1);
if (shiftedLearning.x !== learning.x || shiftedScalp.x !== scalp.x || shiftedLesson.x !== (lesson?.x ?? 0) + 120) {
  console.error("курс уводит чужие доски");
  process.exit(1);
}
const parked = shiftedCourse.map((item) => (item.id === "lesson-2" ? { ...item, x: scalp.x + 40, y: scalp.y + 80 } : item));
const rehoused = rehost(parked, "lesson-2");
if (rehoused.find((item) => item.id === "lesson-2")?.parentId !== "course-scalp") {
  console.error("занятие не переходит на доску другого курса");
  process.exit(1);
}

const legacy = {
  kind: "studio-board",
  version: 1,
  camera: { x: 10, y: 10, z: 1 },
  items: [
    { id: "learning", kind: "frame", x: 0, y: 0, w: 100, h: 100, text: "Обучение" },
    { id: "course-ru", kind: "frame", x: 10, y: 10, w: 80, h: 80, text: "Старый курс" },
    { id: "lesson-1", kind: "frame", x: 20, y: 20, w: 40, h: 40, text: "Занятие 1 — длинное" },
    { id: "l-1", kind: "text", x: 24, y: 24, w: 20, h: 20, text: "Моя правка шага" },
    { id: "extra", kind: "note", x: 4000, y: 80, w: 40, h: 40, text: "Своя заметка" },
  ],
};
const upgraded = readBoard(legacy);
if (!upgraded.upgraded || upgraded.file.version !== 2 || !upgraded.file.items.some((item) => item.id === "course-scalp")) {
  console.error("старая доска не собрала второй курс");
  process.exit(1);
}
if (upgraded.file.items.find((item) => item.id === "l-1")?.text !== "Моя правка шага") {
  console.error("правка текста занятия потерялась");
  process.exit(1);
}
if (!upgraded.file.items.some((item) => item.id === "extra")) {
  console.error("своя заметка пропала");
  process.exit(1);
}
const again = readBoard(upgraded.file);
if (again.upgraded) {
  console.error("готовая доска пересобирается заново");
  process.exit(1);
}
const stampedOld = readBoard({ ...legacy, layout: 1 });
if (!stampedOld.upgraded || !stampedOld.file.items.some((item) => item.id === "course-scalp")) {
  console.error("старая доска с меткой раскладки осталась без скальпинга");
  process.exit(1);
}
const stored = { ...upgraded.file, version: 1 };
const reread = readBoard(stored);
if (reread.upgraded || !reread.file.items.some((item) => item.id === "course-scalp")) {
  console.error("сохранённая доска открывается заново и теряет курс");
  process.exit(1);
}

console.log("studio board ok");

import assert from "node:assert/strict";
import { annotationStyle, formatDuration, relativePoints, strokeBounds } from "../lib/studio-v6/annotations";
import { buildStudioContext } from "../lib/studio-v6/studio-context";
import type { StudioObject, WorldOverview } from "../lib/studio-v5/types";

const points = [{ x: 10, y: 20 }, { x: 40, y: 50 }];
const box = strokeBounds(points);
assert.deepEqual(box, { x: 10, y: 20, w: 30, h: 30 });
assert.deepEqual(relativePoints(points, box), [{ x: 0, y: 0 }, { x: 30, y: 30 }]);
assert.equal(formatDuration(65), "1:05");
assert.equal(annotationStyle("marker").opacity, 0.38);

const shot: StudioObject = {
  id: "shot", world_key: "tqs-studio-world", kind: "image", title: "Скрин", semantic_path: "Обучение/Занятие 1/Скрин",
  parent_id: "lesson", x: 100, y: 100, w: 200, h: 120, z: 4, body: {}, relations: [], status: null, hidden: false, revision: 1,
};
const mark: StudioObject = {
  id: "mark", world_key: "tqs-studio-world", kind: "annotation", title: "Пометка", semantic_path: "Обучение/Занятие 1/Пометка",
  parent_id: "lesson", x: 120, y: 140, w: 40, h: 16, z: 8,
  body: { annotationKind: "pen", points: [{ x: 0, y: 8 }, { x: 40, y: 8 }], style: annotationStyle("pen"), annotates: "shot" },
  relations: [{ type: "annotates", targetId: "shot" }], status: null, hidden: false, revision: 1,
};
const overview = { world: { world_key: "tqs-studio-world", revision: 1, title: "World", metadata: {} }, objects: [shot, mark], activity: [] } as WorldOverview;
const context = buildStudioContext({ overview, documents: [] }, { objectIds: ["shot"] });
const entity = context.entities[0] as { annotation_marks?: Array<{ id: string; target_id: string; points: unknown[] }> };
assert.equal(entity.annotation_marks?.[0]?.id, "mark");
assert.equal(entity.annotation_marks?.[0]?.target_id, "shot");
assert.equal(entity.annotation_marks?.[0]?.points.length, 2);
console.log("PASS annotation context");

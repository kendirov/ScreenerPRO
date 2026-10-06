export type StrokePoint = { x: number; y: number };

export function strokeBounds(points: StrokePoint[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    w: Math.max(8, Math.max(...xs) - x),
    h: Math.max(8, Math.max(...ys) - y),
  };
}

export function relativePoints(points: StrokePoint[], origin: StrokePoint) {
  return points.map((point) => ({ x: point.x - origin.x, y: point.y - origin.y }));
}

export function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function annotationStyle(kind: string) {
  if (kind === "marker") return { color: "#e0b15a", width: 16, opacity: 0.38 };
  if (kind === "arrow") return { color: "#c84e48", width: 2.2, opacity: 1 };
  if (kind === "shape") return { color: "#3f8f9e", width: 1.6, opacity: 1 };
  return { color: "#c84e48", width: 2.4, opacity: 1 };
}

export function annotationTitle(kind: string) {
  if (kind === "marker") return "Маркер";
  if (kind === "arrow") return "Стрелка";
  if (kind === "shape") return "Область";
  return "Пометка";
}

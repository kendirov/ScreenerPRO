"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type Ref } from "react";
import { BOARD_LAYOUT, childIds, fitCamera, hostFrame, rehost, shiftGroup, type BoardFile, type BoardItem, type BoardKind, type Camera } from "./board-model";

export type BoardHandle = {
  focus: (id: string) => void;
  zoom: (direction: 1 | -1) => void;
  snapshot: () => BoardFile;
};

type Menu = { x: number; y: number; wx: number; wy: number; id: string | null };
type Drag =
  | { mode: "pan"; px: number; py: number; cx: number; cy: number; moved: boolean }
  | { mode: "move"; id: string; px: number; py: number; origin: BoardItem[]; moved: boolean }
  | { mode: "resize"; id: string; px: number; py: number; w: number; h: number; moved: boolean };

const ADD: Array<[BoardKind | "lesson", string]> = [
  ["text", "Текст"],
  ["note", "Заметка"],
  ["card", "Карточка"],
  ["lesson", "Занятие"],
];

export function Board({
  file,
  active,
  onChange,
  handle,
}: {
  file: BoardFile;
  active: boolean;
  onChange: (file: BoardFile) => void;
  handle: Ref<BoardHandle>;
}) {
  const viewRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const camera = useRef<Camera>(file.camera ?? { x: 40, y: 40, z: 0.35 });
  const itemsRef = useRef<BoardItem[]>(file.items);
  const drag = useRef<Drag | null>(null);
  const onChangeRef = useRef(onChange);
  const settle = useRef<number | null>(null);
  const fitted = useRef(Boolean(file.camera));
  const selectedRef = useRef<string | null>(null);
  const editingRef = useRef<string | null>(null);
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [anchor, setAnchor] = useState("Доска");
  onChangeRef.current = onChange;
  selectedRef.current = selected;
  editingRef.current = editing;
  void tick;

  const paint = () => {
    const world = worldRef.current;
    const cam = camera.current;
    if (world) world.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})`;
  };
  const redraw = () => setTick((value) => value + 1);
  const snapshot = (): BoardFile => ({ kind: "studio-board", version: 1, layout: BOARD_LAYOUT, camera: { ...camera.current }, items: itemsRef.current.map((item) => ({ ...item })) });
  const commit = () => onChangeRef.current(snapshot());
  const commitSoon = () => {
    if (settle.current) window.clearTimeout(settle.current);
    settle.current = window.setTimeout(commit, 350);
  };
  const worldPoint = (clientX: number, clientY: number) => {
    const view = viewRef.current;
    const cam = camera.current;
    const rect = view?.getBoundingClientRect();
    return {
      x: ((clientX - (rect?.left ?? 0)) - cam.x) / cam.z,
      y: ((clientY - (rect?.top ?? 0)) - cam.y) / cam.z,
    };
  };
  const refreshAnchor = () => {
    const view = viewRef.current;
    if (!view) return;
    const cam = camera.current;
    const hit = hostFrame(itemsRef.current, (view.clientWidth / 2 - cam.x) / cam.z, (view.clientHeight / 2 - cam.y) / cam.z, "material");
    setAnchor(hit?.text || "Доска");
  };
  const focus = (id: string) => {
    const view = viewRef.current;
    const item = itemsRef.current.find((row) => row.id === id);
    if (!view || !item) return;
    camera.current = fitCamera(item, view.clientWidth, view.clientHeight);
    paint();
    commit();
    refreshAnchor();
  };
  const placeNode = (item: BoardItem) => {
    const node = worldRef.current?.querySelector(`[data-node="${item.id}"]`) as HTMLElement | null;
    if (!node) return;
    node.style.left = `${item.x}px`;
    node.style.top = `${item.y}px`;
    node.style.width = `${item.w}px`;
    node.style.height = `${item.h}px`;
  };

  const addAt = (kind: BoardKind | "lesson", x: number, y: number) => {
    const items = itemsRef.current;
    const parent = hostFrame(items, x, y, kind === "lesson" ? "lesson" : "material");
    const id = `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const size = kind === "lesson" ? { w: 640, h: 420 } : kind === "card" ? { w: 360, h: 240 } : kind === "note" ? { w: 220, h: 156 } : { w: 320, h: 140 };
    let left = x - size.w / 2;
    let top = y - size.h / 2;
    if (parent && parent.w > size.w + 48 && parent.h > size.h + 72) {
      left = Math.min(Math.max(left, parent.x + 16), parent.x + parent.w - size.w - 16);
      top = Math.min(Math.max(top, parent.y + 48), parent.y + parent.h - size.h - 16);
    }
    const copy = kind === "note" ? "Заметка" : kind === "card" ? "Материал\nКартинка, схема или файл" : kind === "lesson" ? "Новое занятие" : "Текст";
    const next: BoardItem = {
      id,
      kind: kind === "lesson" ? "frame" : kind,
      x: left,
      y: top,
      w: size.w,
      h: size.h,
      text: copy,
      parentId: parent?.id,
      role: kind === "lesson" ? "lesson" : undefined,
      color: kind === "note" ? "amber" : undefined,
    };
    const created = [next];
    if (kind === "lesson") {
      created.push({ id: `${id}-body`, kind: "text", x: left + 20, y: top + 56, w: size.w - 40, h: 96, text: "О чём это занятие", parentId: id, color: "l" });
    }
    itemsRef.current = [...items, ...created];
    setSelected(id);
    setEditing(kind === "lesson" ? id : id);
    setMenu(null);
    redraw();
    commit();
  };

  const remove = (id: string) => {
    const item = itemsRef.current.find((row) => row.id === id);
    if (!item || item.locked || item.role === "area") return;
    const nested = childIds(itemsRef.current, id);
    if (item.kind === "frame" && nested.length && !window.confirm(`Удалить «${item.text}» вместе с тем, что внутри?`)) return;
    const ids = new Set([id, ...nested]);
    itemsRef.current = itemsRef.current.filter((row) => !ids.has(row.id));
    setSelected(null);
    setEditing(null);
    setMenu(null);
    redraw();
    commit();
  };

  const toggleLock = (id: string) => {
    itemsRef.current = itemsRef.current.map((item) => (item.id === id ? { ...item, locked: !item.locked } : item));
    setMenu(null);
    redraw();
    commit();
  };

  useImperativeHandle(handle, () => ({
    focus,
    zoom: (direction) => {
      const view = viewRef.current;
      if (!view) return;
      const cam = camera.current;
      const cx = view.clientWidth / 2;
      const cy = view.clientHeight / 2;
      const pageX = (cx - cam.x) / cam.z;
      const pageY = (cy - cam.y) / cam.z;
      const z = Math.min(2.4, Math.max(0.08, cam.z * (direction > 0 ? 1.15 : 1 / 1.15)));
      camera.current = { x: cx - pageX * z, y: cy - pageY * z, z };
      paint();
      commit();
      refreshAnchor();
    },
    snapshot,
  }));

  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const place = () => {
      if (fitted.current || view.clientWidth < 40 || view.clientHeight < 40) return;
      const home = itemsRef.current.find((item) => item.id === "learning") ?? itemsRef.current.find((item) => item.id === "lesson-1") ?? itemsRef.current[0];
      if (!home) return;
      camera.current = fitCamera(home, view.clientWidth, view.clientHeight);
      fitted.current = true;
      paint();
      refreshAnchor();
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(view);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    paint();
  });

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const onWheel = (event: WheelEvent) => {
      if (!active) return;
      event.preventDefault();
      const cam = camera.current;
      const rect = view.getBoundingClientRect();
      const cx = event.clientX - rect.left;
      const cy = event.clientY - rect.top;
      if (event.ctrlKey || event.metaKey) {
        const pageX = (cx - cam.x) / cam.z;
        const pageY = (cy - cam.y) / cam.z;
        const z = Math.min(2.4, Math.max(0.08, cam.z * Math.exp(-event.deltaY * 0.01)));
        camera.current = { x: cx - pageX * z, y: cy - pageY * z, z };
      } else {
        camera.current = { ...cam, x: cam.x - event.deltaX, y: cam.y - event.deltaY };
      }
      paint();
      commitSoon();
      refreshAnchor();
    };
    view.addEventListener("wheel", onWheel, { passive: false });
    return () => view.removeEventListener("wheel", onWheel);
  }, [active]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!active) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (event.key === "Escape") {
        setMenu(null);
        setEditing(null);
      }
      if ((event.key === "Backspace" || event.key === "Delete") && selectedRef.current && !editingRef.current && tag !== "INPUT" && tag !== "TEXTAREA") {
        event.preventDefault();
        remove(selectedRef.current);
      }
    };
    const onPaste = (event: ClipboardEvent) => {
      if (!active || editingRef.current) return;
      const image = [...(event.clipboardData?.items ?? [])].find((item) => item.type.startsWith("image/"));
      if (image) {
        const file = image.getAsFile();
        if (!file) return;
        event.preventDefault();
        const reader = new FileReader();
        reader.onload = () => {
          const view = viewRef.current;
          if (!view || typeof reader.result !== "string") return;
          const cam = camera.current;
          const x = (view.clientWidth / 2 - cam.x) / cam.z;
          const y = (view.clientHeight / 2 - cam.y) / cam.z;
          const parent = hostFrame(itemsRef.current, x, y, "material");
          const id = `img-${Date.now().toString(36)}`;
          const item: BoardItem = { id, kind: "card", x: x - 220, y: y - 150, w: 440, h: 300, text: "Материал", src: reader.result, parentId: parent?.id };
          itemsRef.current = [...itemsRef.current, item];
          setSelected(id);
          redraw();
          commit();
        };
        reader.readAsDataURL(file);
        return;
      }
      const text = event.clipboardData?.getData("text/plain")?.trim();
      if (!text || (event.target as HTMLElement | null)?.closest("textarea, input")) return;
      event.preventDefault();
      const view = viewRef.current;
      if (!view) return;
      const cam = camera.current;
      addAt("text", (view.clientWidth / 2 - cam.x) / cam.z, (view.clientHeight / 2 - cam.y) / cam.z);
      const created = itemsRef.current[itemsRef.current.length - 1];
      if (created?.kind === "text") {
        itemsRef.current = itemsRef.current.map((item) => (item.id === created.id ? { ...item, text } : item));
        redraw();
        commit();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [active]);

  const onPointerDown = (event: ReactPointerEvent) => {
    if ((event.target as HTMLElement).closest(".board-dock, .board-menu")) return;
    if ((event.target as HTMLElement).closest("[data-action='pin']")) {
      const id = (event.target as HTMLElement).closest("[data-id]")?.getAttribute("data-id");
      if (id) toggleLock(id);
      return;
    }
    if ((event.target as HTMLElement).closest("textarea")) return;
    if (event.button === 1) {
      drag.current = { mode: "pan", px: event.clientX, py: event.clientY, cx: camera.current.x, cy: camera.current.y, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) return;
    const action = (event.target as HTMLElement).closest("[data-action]")?.getAttribute("data-action");
    const id = (event.target as HTMLElement).closest("[data-id]")?.getAttribute("data-id") ?? null;
    setMenu(null);
    if (action === "resize" && id) {
      const item = itemsRef.current.find((row) => row.id === id);
      if (!item || item.locked) return;
      drag.current = { mode: "resize", id, px: event.clientX, py: event.clientY, w: item.w, h: item.h, moved: false };
      setSelected(id);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const item = id ? itemsRef.current.find((row) => row.id === id) : undefined;
    if (!item) {
      setSelected(null);
      drag.current = { mode: "pan", px: event.clientX, py: event.clientY, cx: camera.current.x, cy: camera.current.y, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    setSelected(item.id);
    if (item.locked) return;
    drag.current = { mode: "move", id: item.id, px: event.clientX, py: event.clientY, origin: itemsRef.current.map((row) => ({ ...row })), moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.px;
    const dy = event.clientY - current.py;
    if (Math.hypot(dx, dy) > 3) current.moved = true;
    if (current.mode === "pan") {
      camera.current = { ...camera.current, x: current.cx + dx, y: current.cy + dy };
      paint();
      return;
    }
    if (current.mode === "move") {
      itemsRef.current = shiftGroup(current.origin, current.id, dx / camera.current.z, dy / camera.current.z);
      const ids = new Set([current.id, ...childIds(current.origin, current.id)]);
      for (const item of itemsRef.current) if (ids.has(item.id)) placeNode(item);
      return;
    }
    const item = itemsRef.current.find((row) => row.id === current.id);
    if (!item) return;
    item.w = Math.max(item.kind === "frame" ? 280 : 160, current.w + dx / camera.current.z);
    item.h = Math.max(item.kind === "frame" ? 180 : 80, current.h + dy / camera.current.z);
    placeNode(item);
  };

  const onPointerUp = () => {
    const current = drag.current;
    if (current?.moved) {
      if (current.mode === "move") itemsRef.current = rehost(itemsRef.current, current.id);
      redraw();
      commit();
      refreshAnchor();
    }
    drag.current = null;
  };

  const onDoubleClick = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest(".board-dock, .board-menu, textarea")) return;
    const point = worldPoint(event.clientX, event.clientY);
    const id = (event.target as HTMLElement).closest("[data-id]")?.getAttribute("data-id");
    const onTitle = Boolean((event.target as HTMLElement).closest(".frame-title"));
    const item = id ? itemsRef.current.find((row) => row.id === id) : undefined;
    if (item?.kind === "frame" && !onTitle) {
      addAt("text", point.x, point.y);
      return;
    }
    if (id) {
      setSelected(id);
      setEditing(id);
      return;
    }
    addAt("text", point.x, point.y);
  };

  const items = itemsRef.current;
  const menuItem = menu?.id ? items.find((item) => item.id === menu.id) : undefined;

  return (
    <div
      className="board"
      ref={viewRef}
      aria-label="Доска студии"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
        if (!file) return;
        const point = worldPoint(event.clientX, event.clientY);
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result !== "string") return;
          const parent = hostFrame(itemsRef.current, point.x, point.y, "material");
          const id = `img-${Date.now().toString(36)}`;
          itemsRef.current = [...itemsRef.current, { id, kind: "card", x: point.x, y: point.y, w: 440, h: 300, text: file.name, src: reader.result, parentId: parent?.id }];
          setSelected(id);
          redraw();
          commit();
        };
        reader.readAsDataURL(file);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        const id = (event.target as HTMLElement).closest("[data-id]")?.getAttribute("data-id") ?? null;
        const point = worldPoint(event.clientX, event.clientY);
        setMenu({ x: event.clientX, y: event.clientY, wx: point.x, wy: point.y, id });
        if (id) setSelected(id);
      }}
    >
      <div className="board-world" ref={worldRef}>
        {[...items].sort((a, b) => b.w * b.h - a.w * a.h).map((item) => (
          <article
            key={item.id}
            data-node={item.id}
            data-id={item.id}
            data-role={item.role || undefined}
            data-color={item.color || undefined}
            data-locked={item.locked ? "true" : undefined}
            className={`board-item kind-${item.kind}${item.color === "l" ? " is-large" : ""}${item.role ? ` role-${item.role}` : ""}${selected === item.id ? " is-selected" : ""}${item.locked ? " is-locked" : ""}`}
            style={{ left: item.x, top: item.y, width: item.w, height: item.h }}
          >
            {item.kind === "frame" ? (
              <>
                <i className="frame-edge edge-n" data-id={item.id} />
                <i className="frame-edge edge-e" data-id={item.id} />
                <i className="frame-edge edge-s" data-id={item.id} />
                <i className="frame-edge edge-w" data-id={item.id} />
                <header className="frame-title" data-id={item.id}>
                  <i className="neon-dot" />
                  {editing === item.id ? (
                    <textarea
                      autoFocus
                      value={item.text}
                      aria-label="Название"
                      onChange={(event) => {
                        itemsRef.current = itemsRef.current.map((row) => (row.id === item.id ? { ...row, text: event.target.value } : row));
                        redraw();
                        commitSoon();
                      }}
                      onBlur={() => setEditing(null)}
                      onPointerDown={(event) => event.stopPropagation()}
                    />
                  ) : (
                    <b>{item.text}</b>
                  )}
                  <button type="button" data-action="pin" data-id={item.id} className={item.locked ? "pin is-on" : "pin"} aria-label={item.locked ? "Открепить" : "Закрепить"}>
                    <Pin on={Boolean(item.locked)} />
                  </button>
                </header>
              </>
            ) : editing === item.id ? (
              <textarea
                autoFocus
                value={item.text}
                aria-label="Текст"
                onChange={(event) => {
                  itemsRef.current = itemsRef.current.map((row) => (row.id === item.id ? { ...row, text: event.target.value } : row));
                  redraw();
                  commitSoon();
                }}
                onBlur={() => setEditing(null)}
                onPointerDown={(event) => event.stopPropagation()}
              />
            ) : (
              <>
                {item.kind === "card" && <em>Материал</em>}
                {item.src && <img src={item.src} alt="" />}
                <p>{item.text}</p>
              </>
            )}
            {selected === item.id && !item.locked && <i className="resize" data-action="resize" data-id={item.id} />}
          </article>
        ))}
      </div>
      <div className="board-dock" title={anchor === "Доска" ? "Новый материал ляжет на доску" : `Новый материал попадёт в «${anchor}»`} onPointerDown={(event) => event.stopPropagation()}>
        <span>{anchor}</span>
        {ADD.map(([kind, label]) => (
          <button key={kind} type="button" onClick={() => {
            const view = viewRef.current;
            if (!view) return;
            const cam = camera.current;
            addAt(kind, (view.clientWidth / 2 - cam.x) / cam.z, (view.clientHeight / 2 - cam.y) / cam.z);
          }}>{label}</button>
        ))}
      </div>
      {menu && (
        <div className="board-menu" style={{ left: Math.min(menu.x, window.innerWidth - 230), top: Math.min(menu.y, window.innerHeight - 280) }} onPointerDown={(event) => event.stopPropagation()}>
          {menuItem && <button type="button" onClick={() => { setEditing(menuItem.id); setMenu(null); }}>Править</button>}
          {menuItem && <button type="button" onClick={() => toggleLock(menuItem.id)}>{menuItem.locked ? "Открепить" : "Закрепить"}</button>}
          {menuItem && <button type="button" disabled={menuItem.locked || menuItem.role === "area"} onClick={() => remove(menuItem.id)}>Удалить</button>}
          {ADD.map(([kind, label]) => (
            <button key={kind} type="button" onClick={() => addAt(kind, menu.wx, menu.wy)}>{label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Pin({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      <path d="M8 1.6v8.2M5.2 4.2h5.6L9.2 7.4 8 13.2 6.8 7.4 5.2 4.2z" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

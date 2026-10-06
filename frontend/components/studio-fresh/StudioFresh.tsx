"use client";

import { useEffect, useRef, useState } from "react";
import { HANDOUT_STARTER, newerLive, normalizeHandout, pullLive, pushLive, readLegacyLive, readLocalLive, type HandoutBlock, type StudioLive, type StudioTheme } from "@/lib/studio-fresh/live-state";
import { Board, type BoardHandle } from "./Board";
import { readBoard, type BoardFile, type BoardItem } from "./board-model";
import { Handout } from "./Handout";
import "./studio-fresh.css";

type Surface = "world" | "doc";
type Scheme = StudioTheme;
type SaveState = "idle" | "opening" | "saving" | "saved" | "local";

export default function StudioFresh() {
  const boardRef = useRef<BoardHandle>(null);
  const schemeRef = useRef<Scheme>("dark");
  const blocksRef = useRef<HandoutBlock[]>(HANDOUT_STARTER);
  const booted = useRef(false);
  const timer = useRef<number | null>(null);
  const [publicReading] = useState(() => new URLSearchParams(window.location.search).get("view") === "handout");
  const [surface, setSurface] = useState<Surface>(publicReading ? "doc" : "world");
  const [scheme, setScheme] = useState<Scheme>("dark");
  const [blocks, setBlocks] = useState<HandoutBlock[]>(HANDOUT_STARTER);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("opening");
  const [file, setFile] = useState<BoardFile | null>(null);

  schemeRef.current = scheme;
  blocksRef.current = blocks;

  const persist = (nextBlocks = blocksRef.current, nextScheme = schemeRef.current) => {
    const board = boardRef.current?.snapshot();
    if (!board || board.items.length === 0 || !booted.current) return;
    const state: StudioLive = {
      version: 1,
      updatedAt: new Date().toISOString(),
      theme: nextScheme,
      handout: nextBlocks,
      board,
    };
    setSaveState("saving");
    void pushLive(state).then((mode) => setSaveState(mode === "remote" ? "saved" : "local"));
  };

  const schedule = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => persist(), 700);
  };

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const best = newerLive(await pullLive(), readLocalLive());
      if (cancel) return;
      const loaded = readBoard(best?.board);
      const board = loaded.file;
      const legacy = best ? null : readLegacyLive();
      const handout = normalizeHandout(best?.handout || legacy?.handout);
      if (best?.handout || legacy?.handout) {
        blocksRef.current = handout;
        setBlocks(handout);
      }
      const theme = best?.theme || legacy?.theme;
      if (theme) {
        schemeRef.current = theme;
        setScheme(theme);
      }
      const own = (best?.board as { kind?: string } | undefined)?.kind === "studio-board";
      setFile(board);
      const finish = () => {
        if (cancel) return;
        if (!boardRef.current) {
          requestAnimationFrame(finish);
          return;
        }
        booted.current = true;
        if (!own || loaded.upgraded) persist();
        else setSaveState("saved");
      };
      requestAnimationFrame(finish);
    })();
    return () => {
      cancel = true;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <main className={publicReading ? "fresh is-public" : "fresh"} data-theme={scheme}>
      {!publicReading && <header className="fresh-bar">
        <strong>TQS Studio</strong>
        <nav>
          <button type="button" className={surface === "world" ? "is-on" : ""} onClick={() => setSurface("world")}>Мир</button>
          <button type="button" className={surface === "doc" ? "is-on" : ""} onClick={() => setSurface("doc")}>Документы</button>
        </nav>
        {surface === "world" && (
          <div className="fresh-places">
            <button type="button" onClick={() => setPlacesOpen((v) => !v)}>Куда смотреть</button>
            {placesOpen && file && (
              <div>
                <PlaceList items={file.items} depth={0} parentId="" onPick={(id) => { boardRef.current?.focus(id); setPlacesOpen(false); }} />
              </div>
            )}
          </div>
        )}
        <p className="fresh-hint">Поле берётся за своё название и едет вместе со своим. Колесо двигает доску. Двойной щелчок пишет текст.</p>
        {surface === "world" && (
          <div className="fresh-zoom">
            <button type="button" onClick={() => boardRef.current?.zoom(-1)}>−</button>
            <button type="button" onClick={() => boardRef.current?.focus("learning")}>Обучение</button>
            <button type="button" onClick={() => boardRef.current?.focus("lesson-1")}>Занятие 1</button>
            <button type="button" onClick={() => boardRef.current?.zoom(1)}>+</button>
          </div>
        )}
        <span className="fresh-save">{saveState === "saving" ? "Сохраняю…" : saveState === "opening" ? "Открываю…" : saveState === "local" ? "Сохранено здесь" : saveState === "saved" ? "Сохранено" : ""}</span>
        <button type="button" className="fresh-theme" onClick={() => setScheme((v) => {
          const next = v === "dark" ? "light" : "dark";
          persist(blocksRef.current, next);
          return next;
        })}>
          {scheme === "dark" ? "Светлая" : "Тёмная"}
        </button>
      </header>}
      <section className="fresh-stage">
        <div className={surface === "world" ? "fresh-world" : "fresh-world is-hidden"}>
          {file && <Board file={file} active={surface === "world"} handle={boardRef} onChange={schedule} />}
        </div>
        {(surface === "doc" || publicReading) && (
          <Handout
            publicReading={publicReading}
            onBoard={() => setSurface("world")}
            blocks={blocks}
            onChange={(next) => {
              blocksRef.current = next;
              setBlocks(next);
              persist(next);
            }}
          />
        )}
      </section>
    </main>
  );
}

function PlaceList({ items, parentId, depth, onPick }: { items: BoardItem[]; parentId: string; depth: number; onPick: (id: string) => void }) {
  const frames = items
    .filter((item) => item.kind === "frame" && (item.parentId || "") === parentId)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  return frames.map((frame) => (
    <span key={frame.id}>
      <button type="button" style={{ paddingLeft: 10 + depth * 14 }} onClick={() => onPick(frame.id)}>
        {frame.text}
      </button>
      <PlaceList items={items} parentId={frame.id} depth={depth + 1} onPick={onPick} />
    </span>
  ));
}

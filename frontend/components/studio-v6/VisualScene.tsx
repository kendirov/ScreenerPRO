"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { StudioObject } from "@/lib/studio-v5/types";
import type { SceneNode, SlideModel, VisualSceneModel } from "@/lib/studio-v6/visual-artifact";
import "./visual-scene.css";

type Props = {
  object: StudioObject;
  publish?: boolean;
  initialSlide?: number;
  onChange?: (body: Record<string, unknown>, summary: string) => void;
};

export function VisualScene({ object, publish = false, initialSlide = 0, onChange }: Props) {
  if (object.kind === "deck") return <DeckView object={object} publish={publish} initialSlide={initialSlide} onChange={onChange} />;
  return <TrajectoryView object={object} publish={publish} onChange={onChange} />;
}

function TrajectoryView({ object, publish, onChange }: Props) {
  const incoming = object.body?.scene as VisualSceneModel | undefined;
  const [scene, setScene] = useState<VisualSceneModel | undefined>(incoming);
  const [selected, setSelected] = useState<string>(object.body?.selectedNodeId || incoming?.nodes.find(node => node.role === "stage")?.id || "");
  const drag = useRef<{ id: string; pointer: number; moved: boolean } | null>(null);
  const editTimer = useRef<number | null>(null);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!drag.current && incoming) setScene(incoming);
  }, [incoming]);
  const stages = useMemo(() => (scene?.nodes || []).filter(node => node.role === "stage"), [scene]);
  const active = scene?.nodes.find(node => node.id === selected) || null;
  if (!scene) return null;
  const path = stages.map(node => `${node.x * 10},${node.y * 4.6}`).join(" ");

  const select = (id: string) => {
    setSelected(id);
    onChange?.({ ...object.body, selectedNodeId: id }, "Выбран этап");
  };
  const edit = (patch: Partial<SceneNode>) => {
    if (!active) return;
    const nodes = scene.nodes.map(node => node.id === active.id ? { ...node, ...patch } : node);
    const next = { ...scene, nodes };
    setScene(next);
    if (editTimer.current) window.clearTimeout(editTimer.current);
    editTimer.current = window.setTimeout(() => {
      onChange?.({ ...object.body, scene: next, selectedNodeId: active.id }, `Этап «${next.nodes.find(node => node.id === active.id)?.title || active.title}» изменён`);
    }, 420);
  };
  const place = (id: string, clientX: number, clientY: number) => {
    const rect = host.current?.getBoundingClientRect();
    if (!rect || !scene) return null;
    const x = Math.min(96, Math.max(4, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(86, Math.max(18, ((clientY - rect.top) / rect.height) * 100));
    const nodes = scene.nodes.map(node => node.id === id ? { ...node, x: Math.round(x), y: Math.round(y) } : node);
    const next = { ...scene, nodes };
    setScene(next);
    return next;
  };

  return (
    <div className={`vs-scene${publish ? " is-publish" : ""}`} data-testid="visual-artifact" data-artifact-id={object.id} data-selected={selected}>
      <header className="vs-head">
        <small>Путь</small>
        <strong>{scene.title}</strong>
        <p>{scene.thesis}</p>
      </header>
      <div ref={host} className="vs-map">
      <svg className="vs-road" viewBox="0 0 1000 460" aria-hidden>
        <polyline points={path} />
      </svg>
      {scene.nodes.map(node => node.role === "stage" ? (
        <button
          key={node.id}
          type="button"
          className={`vs-station${selected === node.id ? " is-on" : ""}`}
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          data-node-id={node.id}
          onPointerDown={event => {
            if (!onChange || event.button !== 0) return;
            drag.current = { id: node.id, pointer: event.pointerId, moved: false };
            (event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
            setSelected(node.id);
          }}
          onPointerMove={event => {
            if (drag.current?.id !== node.id || drag.current.pointer !== event.pointerId) return;
            drag.current.moved = true;
            place(node.id, event.clientX, event.clientY);
          }}
          onPointerUp={event => {
            const current = drag.current;
            drag.current = null;
            if (!current) return;
            if (!current.moved) { select(node.id); return; }
            const next = place(node.id, event.clientX, event.clientY);
            if (next) onChange?.({ ...object.body, scene: next, selectedNodeId: node.id }, "Этап передвинут");
          }}
          onClick={() => { if (!drag.current) select(node.id); }}
        >
          <i>{stages.findIndex(item => item.id === node.id) + 1}</i>
          <b>{node.title}</b>
        </button>
      ) : (
        <button key={node.id} type="button" className={`vs-gate role-${node.role}${selected === node.id ? " is-on" : ""}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} data-node-id={node.id} onClick={() => select(node.id)}>
          <em>{node.role === "risk" ? "Риск" : "Проверка"}</em>
          <b>{node.title}</b>
        </button>
      ))}
      </div>
      {active && (
        <aside className="vs-detail" data-testid="visual-detail">
          <em>{active.role === "stage" ? "Этап" : active.role === "risk" ? "Риск" : "Проверка"}</em>
          {onChange && !publish ? (
            <>
              <input aria-label="Название этапа" value={active.title} onChange={event => edit({ title: event.target.value })} />
              <textarea aria-label="Текст этапа" value={active.text} onChange={event => edit({ text: event.target.value })} />
            </>
          ) : (
            <>
              <strong>{active.title}</strong>
              <p>{active.text}</p>
            </>
          )}
        </aside>
      )}
    </div>
  );
}

function DeckView({ object, publish, initialSlide = 0, onChange }: Props) {
  const slides = (object.body?.slides || []) as SlideModel[];
  const [index, setIndex] = useState(Math.min(Math.max(initialSlide > 0 ? initialSlide - 1 : 0, 0), Math.max(slides.length - 1, 0)));
  const slide = slides[index];
  if (!slide) return null;
  const edit = (layerId: string, text: string) => {
    const next = slides.map(item => item.id === slide.id ? { ...item, layers: item.layers.map(layer => layer.id === layerId ? { ...layer, text } : layer) } : item);
    onChange?.({ ...object.body, slides: next, selectedSlideId: slide.id }, "Слайд изменён");
  };
  return (
    <div className={`vs-deck${publish ? " is-publish" : ""}`} data-testid="visual-deck" data-deck-id={object.id} data-slide-id={slide.id}>
      <div className="vs-slide">
        {slide.layers.map(layer => onChange && !publish && (layer.kind === "idea" || layer.kind === "mark") ? (
          <textarea key={layer.id} className={`vs-layer kind-${layer.kind}`} style={{ left: `${layer.x}%`, top: `${layer.y}%` }} aria-label={layer.kind} value={layer.text} onChange={event => edit(layer.id, event.target.value)} />
        ) : (
          <p key={layer.id} className={`vs-layer kind-${layer.kind}`} style={{ left: `${layer.x}%`, top: `${layer.y}%` }}>{layer.text}</p>
        ))}
      </div>
      <nav className="vs-pager" aria-label="Слайды">
        {slides.map((item, itemIndex) => (
          <button key={item.id} type="button" className={itemIndex === index ? "is-on" : ""} aria-label={`Слайд ${itemIndex + 1}`} onClick={() => setIndex(itemIndex)}>{itemIndex + 1}</button>
        ))}
      </nav>
    </div>
  );
}

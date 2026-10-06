"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, Hand, Highlighter, Image as ImageIcon, Link2, Mic, Minus, MoreHorizontal, MousePointer2, PenLine, Shapes, Square, SquareCheck, StickyNote, Type } from "lucide-react";
import type { StudioObject } from "@/lib/studio-v5/types";
import { formatDuration } from "@/lib/studio-v6/annotations";

export type BoardTool = "select" | "hand" | "text" | "pen" | "marker" | "arrow" | "shape" | "erase";

type Point = { x: number; y: number };

export function BoardPalette({ tool, more, onTool, onMore, onCreate, onVoice }: {
  tool: BoardTool;
  more: boolean;
  onTool: (tool: BoardTool) => void;
  onMore: (open: boolean) => void;
  onCreate: (kind: string) => void;
  onVoice: () => void;
}) {
  const primary: Array<{ id: BoardTool | "note" | "task" | "voice" | "image"; label: string; icon: ReactNode }> = [
    { id: "select", label: "Выбор", icon: <MousePointer2 size={15} /> },
    { id: "hand", label: "Рука", icon: <Hand size={15} /> },
    { id: "text", label: "Текст", icon: <Type size={15} /> },
    { id: "note", label: "Заметка", icon: <StickyNote size={15} /> },
    { id: "task", label: "Задача", icon: <SquareCheck size={15} /> },
    { id: "voice", label: "Голос", icon: <Mic size={15} /> },
    { id: "image", label: "Изображение", icon: <ImageIcon size={15} /> },
    { id: "pen", label: "Карандаш", icon: <PenLine size={15} /> },
    { id: "marker", label: "Маркер", icon: <Highlighter size={15} /> },
    { id: "arrow", label: "Стрелка", icon: <ArrowUpRight size={15} /> },
  ];
  return <div className="rf-tool-palette" data-studio-ui data-testid="board-tools">
    {primary.map((item) => <button
      key={item.id}
      type="button"
      className={tool === item.id ? "is-on" : ""}
      aria-label={item.label}
      title={item.label}
      onClick={() => {
        if (item.id === "note" || item.id === "task" || item.id === "image") { onCreate(item.id); return; }
        if (item.id === "voice") { onVoice(); return; }
        onTool(item.id);
      }}
    >{item.icon}</button>)}
    <button type="button" aria-label="Ещё инструменты" title="Ещё инструменты" className={more ? "is-on" : ""} onClick={() => onMore(!more)}><MoreHorizontal size={15} /></button>
    {more && <div className="rf-tool-more" data-testid="board-tools-more">
      <button type="button" onClick={() => onTool("shape")}><Square size={14} />Область</button>
      <button type="button" onClick={() => onTool("erase")}><Minus size={14} />Ластик</button>
      <button type="button" onClick={() => onCreate("frame")}><Shapes size={14} />Комната</button>
      <button type="button" onClick={() => onCreate("link")}><Link2 size={14} />Вставка</button>
      <button type="button" onClick={() => onCreate("chart")}>График</button>
      <button type="button" onClick={() => onCreate("file")}>Файл</button>
    </div>}
  </div>;
}

export function AnnotationLayer({ objects, selectedId, draft, erasing, onSelect, onErase }: {
  objects: StudioObject[];
  selectedId: string | null;
  draft: { kind: string; points: Point[] } | null;
  erasing: boolean;
  onSelect: (id: string) => void;
  onErase: (id: string) => void;
}) {
  const marks = objects.filter((object) => !object.hidden && object.kind === "annotation" && (object.body?.points?.length || object.body?.annotationKind === "shape"));
  return <svg className="rf-annotation-layer" data-testid="annotation-layer">
    <defs>
      <marker id="rf-arrow-head" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L7,3 L0,6 Z" fill="#c84e48" />
      </marker>
    </defs>
    {marks.map((object) => {
      const kind = String(object.body?.annotationKind || "pen");
      const style = object.body?.style || {};
      const selected = selectedId === object.id;
      const color = String(style.color || (kind === "marker" ? "#e0b15a" : kind === "shape" ? "#3f8f9e" : "#c84e48"));
      const width = Number(style.width || (kind === "marker" ? 16 : 2.2));
      const opacity = Number(style.opacity ?? (kind === "marker" ? 0.38 : 1));
      const common = {
        stroke: selected ? "#e0b15a" : color,
        strokeWidth: selected ? width + 1 : width,
        opacity,
        fill: kind === "shape" ? "transparent" : "none",
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        className: "rf-annotation",
        "data-annotation-id": object.id,
        "data-annotates": object.body?.annotates || object.relations?.find((relation: { type?: string }) => relation.type === "annotates")?.targetId || "",
        onPointerDown: (event: React.PointerEvent) => {
          event.stopPropagation();
          if (erasing) onErase(object.id);
          else onSelect(object.id);
        },
      };
      if (kind === "shape") {
        return <rect key={object.id} x={object.x} y={object.y} width={Math.max(8, object.w)} height={Math.max(8, object.h)} rx={8} {...common} />;
      }
      const points = (object.body?.points || []) as Point[];
      const d = points.map((point, index) => `${index ? "L" : "M"}${object.x + point.x} ${object.y + point.y}`).join(" ");
      return <path key={object.id} d={d} markerEnd={kind === "arrow" ? "url(#rf-arrow-head)" : undefined} {...common} />;
    })}
    {draft && draft.points.length > 1 && <path
      d={draft.points.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" ")}
      fill="none"
      stroke={draft.kind === "marker" ? "#e0b15a" : "#c84e48"}
      strokeWidth={draft.kind === "marker" ? 16 : 2.4}
      opacity={draft.kind === "marker" ? 0.38 : 1}
      strokeLinecap="round"
    />}
  </svg>;
}

type SpeechCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

export function VoiceCapture({ onCancel, onSave }: {
  onCancel: () => void;
  onSave: (payload: { dataUrl: string; filename: string; mimeType: string; durationSec: number; durationLabel: string; transcript: string; waveform: number[] }) => Promise<void>;
}) {
  const [phase, setPhase] = useState<"permission" | "recording" | "saving" | "error">("permission");
  const [message, setMessage] = useState("Разрешите микрофон, чтобы записать голос.");
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(Array.from({ length: 24 }, () => 4));
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const started = useRef(0);
  const transcript = useRef("");
  const speech = useRef<{ stop: () => void } | null>(null);
  const peaks = useRef<number[]>([]);
  const retryBlob = useRef<{ blob: Blob; durationSec: number; transcript: string; waveform: number[] } | null>(null);

  const stopTracks = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    try { speech.current?.stop(); } catch { /* already stopped */ }
    speech.current = null;
  };

  const begin = async () => {
    setPhase("permission");
    setMessage("Запрашиваю микрофон…");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const audio = new AudioContext();
      const source = audio.createMediaStreamSource(media);
      const analyser = audio.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const paint = window.setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let energy = 0;
        for (const value of data) energy += Math.abs(value - 128);
        const level = Math.max(3, Math.min(18, energy / data.length));
        peaks.current = [...peaks.current, level].slice(-24);
        setLevels(peaks.current.concat(Array.from({ length: Math.max(0, 24 - peaks.current.length) }, () => 4)).slice(-24));
      }, 120);
      const Speech = ((window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor }).SpeechRecognition
        || (window as unknown as { webkitSpeechRecognition?: SpeechCtor }).webkitSpeechRecognition);
      transcript.current = "";
      if (Speech) {
        const recognition = new Speech();
        recognition.lang = "ru-RU";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          let text = "";
          for (let index = 0; index < event.results.length; index += 1) text += event.results[index][0]?.transcript || "";
          transcript.current = text.trim();
        };
        recognition.onerror = () => { /* recording still stands without a live transcript */ };
        try { recognition.start(); speech.current = recognition; } catch { speech.current = null; }
      }
      const recorder = new MediaRecorder(media);
      chunks.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      recorder.onstop = () => {
        window.clearInterval(paint);
        void audio.close().catch(() => undefined);
        stopTracks();
        const durationSec = Math.max(0, (Date.now() - started.current) / 1000);
        const blob = new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" });
        if (durationSec < 0.4 || blob.size < 80) {
          setPhase("error");
          setMessage("Запись не сохранилась. Говорите хотя бы секунду и нажмите «Стоп».");
          return;
        }
        retryBlob.current = { blob, durationSec, transcript: transcript.current, waveform: peaks.current.slice(-24) };
        void finish(retryBlob.current);
      };
      started.current = Date.now();
      recorder.start(200);
      rec.current = recorder;
      setSeconds(0);
      setPhase("recording");
      setMessage("");
    } catch (error) {
      stopTracks();
      const name = error instanceof DOMException ? error.name : "";
      setPhase("error");
      setMessage(name === "NotAllowedError" || name === "SecurityError"
        ? "Доступ к микрофону закрыт. Разрешите его в браузере и повторите."
        : "Микрофон недоступен. Проверьте устройство и повторите.");
    }
  };

  const finish = async (payload: { blob: Blob; durationSec: number; transcript: string; waveform: number[] }) => {
    setPhase("saving");
    setMessage("Сохраняю запись…");
    try {
      const dataUrl = await blobToDataUrl(payload.blob);
      await onSave({
        dataUrl,
        filename: `voice-${Date.now()}.webm`,
        mimeType: payload.blob.type || "audio/webm",
        durationSec: payload.durationSec,
        durationLabel: formatDuration(payload.durationSec),
        transcript: payload.transcript,
        waveform: payload.waveform,
      });
    } catch {
      setPhase("error");
      setMessage("Запись не отправилась. Звук остался в этой попытке — можно повторить отправку.");
    }
  };

  useEffect(() => {
    void begin();
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => {
      window.clearInterval(timer);
      if (rec.current && rec.current.state === "recording") rec.current.stop();
      else stopTracks();
    };
    // The recorder owns its lifecycle; restarting it on every render would drop audio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = () => {
    if (rec.current && rec.current.state === "recording") rec.current.stop();
  };
  const cancel = () => {
    retryBlob.current = null;
    if (rec.current && rec.current.state === "recording") {
      rec.current.onstop = () => stopTracks();
      rec.current.stop();
    } else stopTracks();
    onCancel();
  };

  return <div className={"rf-voice-capture" + (phase === "recording" ? " is-rec" : "")} data-testid="voice-capture" data-phase={phase} data-studio-ui>
    <span className="rf-rec-dot" aria-hidden />
    <strong>{phase === "recording" ? "Запись" : phase === "saving" ? "Сохранение" : phase === "error" ? "Голос" : "Микрофон"}</strong>
    <b>{formatDuration(seconds)}</b>
    <span className="rf-wave" aria-hidden>{levels.map((level, index) => <i key={index} style={{ height: level }} />)}</span>
    {message && <small>{message}</small>}
    {phase === "recording" && <button type="button" onClick={stop}>Стоп</button>}
    {phase === "error" && <button type="button" onClick={() => { if (retryBlob.current) void finish(retryBlob.current); else void begin(); }}>Повторить</button>}
    <button type="button" onClick={cancel}>Отмена</button>
  </div>;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

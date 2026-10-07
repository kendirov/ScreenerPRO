"use client";

import {useEffect, useRef, useState, type MouseEvent} from "react";
import type {DocumentBundle, StudioDocumentBlock} from "@/lib/studio-v5/types";
import {studioAction} from "@/lib/studio-v6/api";
import {editorBlocks, resolveVideoEmbed} from "@/lib/studio-v6/document-model";
import {RichEditor} from "./RichEditor";

export type DocumentMode = "edit" | "preview";
export type AuthoringFocus = {blockId: string; ordinal: number; blockType: string};
type InsertKind = "rich_text" | "heading" | "subheading" | "image" | "video" | "callout" | "interactive_gpt";
type ContextMenu = {x: number; y: number; blockId: string | null};

const INSERTS: Array<{kind: InsertKind; label: string; hint: string}> = [
  {kind: "rich_text", label: "Текст", hint: "Абзац"},
  {kind: "heading", label: "Заголовок", hint: "Крупный"},
  {kind: "subheading", label: "Подзаголовок", hint: "Раздел"},
  {kind: "image", label: "Изображение", hint: "Из буфера или файла"},
  {kind: "video", label: "Видео", hint: "Плеер"},
  {kind: "callout", label: "Выноска", hint: "Практика"},
  {kind: "interactive_gpt", label: "Interactive GPT", hint: "Адрес для ChatGPT"},
];
const CLIP_KEY = "tqs-studio-doc-clip";
const GPT_KINDS = [
  ["note", "Заметка"],
  ["chart", "График"],
  ["correlation", "Корреляция"],
  ["image", "Изображение"],
  ["video", "Видео"],
] as const;

function storedType(kind: InsertKind) {
  return kind === "subheading" ? "heading" : kind;
}

function freshContent(kind: InsertKind, blockId: string) {
  if (kind === "heading") return {text: "Новый раздел", level: 1, align: "left"};
  if (kind === "subheading") return {text: "Подзаголовок", level: 2, align: "left"};
  if (kind === "image") return {title: "Изображение", url: "", align: "wide", caption: ""};
  if (kind === "video") return {title: "Видео", url: "", checkpoints: [{id: "cp-" + crypto.randomUUID().slice(0, 8), at: "0:30", prompt: "Что здесь важно увидеть?", answer: ""}]};
  if (kind === "callout") return {text: "Практика", tone: "practice"};
  if (kind === "interactive_gpt") return {title: "Interactive GPT", kind: "note", note: "", address: blockId};
  return {html: "<p></p>", align: "left"};
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function clipboardImage(data: DataTransfer | null) {
  if (!data) return null;
  const direct = [...data.files].find(file => file.type.startsWith("image/"));
  if (direct) return direct;
  for (const item of data.items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

function blockUnderPointer(y: number, ignoreId: string) {
  const nodes = [...document.querySelectorAll<HTMLElement>("[data-block-id]")];
  for (const node of nodes) {
    const id = node.getAttribute("data-block-id") || "";
    if (!id || id === ignoreId) continue;
    const rect = node.getBoundingClientRect();
    if (y >= rect.top && y <= rect.bottom) return id;
  }
  return null;
}

function plain(block: StudioDocumentBlock) {
  const c = block.content || {};
  return String(c.text || c.html || c.caption || c.title || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function studyKey(documentId: string) {
  return "tqs-studio-study-v1:" + documentId;
}

function cloneBlocks(blocks: StudioDocumentBlock[], documentId: string) {
  return structuredClone(blocks.filter(block => block.document_id === documentId));
}

function clockLabel(total: number) {
  const seconds = Math.max(0, Math.floor(total));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function clockSeconds(value: string) {
  const parts = String(value || "0:00").split(":").map(part => Number(part) || 0);
  return parts.length > 1 ? parts[0] * 60 + parts[1] : parts[0];
}

const LESSON_CHAPTERS = [
  {id: "ch-desk", at: "0:00", title: "Рабочее место", text: "На экране остаются график, стакан и лента."},
  {id: "ch-chart", at: "0:30", title: "График", text: "График задаёт контекст цены."},
  {id: "ch-tape", at: "1:00", title: "Стакан и лента", text: "Стакан показывает ликвидность, лента показывает темп."},
];

const LESSON_POSTER = "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 440'><rect width='800' height='440' fill='#1B1D20'/><polyline points='40,300 180,220 300,250 460,120 620,160 760,80' fill='none' stroke='#3B82F6' stroke-width='4'/><rect x='48' y='48' width='220' height='120' fill='none' stroke='#8B939C'/><rect x='290' y='48' width='180' height='120' fill='none' stroke='#8B939C'/></svg>");

export function DocumentEditorV6({bundle, mode, onBundle, onFocus}: {bundle: DocumentBundle; onBundle?: (value: DocumentBundle) => void; mode: DocumentMode; onFocus?: (focus: AuthoringFocus | null) => void}) {
  const study = mode === "preview";
  const blocks = editorBlocks(bundle.blocks);
  const [selected, setSelected] = useState<string | null>(blocks[0]?.block_id || null);
  const [menuAt, setMenuAt] = useState<string | null>(null);
  const [headingOpen, setHeadingOpen] = useState(false);
  const [context, setContext] = useState<ContextMenu | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [passed, setPassed] = useState<Record<string, boolean>>({});
  const documentId = bundle.document.id;
  const blocksRef = useRef(bundle.blocks);
  const selectedRef = useRef(selected);
  const dragId = useRef<string | null>(null);
  const undoStack = useRef<StudioDocumentBlock[][]>([]);
  const redoStack = useRef<StudioDocumentBlock[][]>([]);
  const snapFor = useRef("");
  blocksRef.current = bundle.blocks;
  selectedRef.current = selected;

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(studyKey(documentId)) || "{}");
      setPassed(raw && typeof raw === "object" ? raw : {});
    } catch {
      setPassed({});
    }
  }, [documentId]);

  const refresh = async () => {
    const fresh = await studioAction<DocumentBundle>("getDocument", {documentId});
    onBundle?.(fresh);
    return fresh;
  };
  const remember = (key: string) => {
    if (snapFor.current === key) return;
    undoStack.current.push(cloneBlocks(blocksRef.current, documentId));
    if (undoStack.current.length > 40) undoStack.current.shift();
    redoStack.current = [];
    snapFor.current = key;
    window.setTimeout(() => { if (snapFor.current === key) snapFor.current = ""; }, 700);
  };
  const restore = async (stack: StudioDocumentBlock[][], other: StudioDocumentBlock[][]) => {
    const snap = stack.pop();
    if (!snap) return;
    other.push(cloneBlocks(blocksRef.current, documentId));
    snapFor.current = "";
    await studioAction("restoreDocumentBlocks", {documentId, blocks: snap});
    await refresh();
  };
  const persist = async (blockId: string, blockType: string, content: Record<string, unknown>, afterBlockId?: string) => {
    await studioAction("upsertDocumentBlock", {documentId, blockId, blockType, content, afterBlockId});
    await refresh();
  };
  const write = async (blockId: string, blockType: string, content: Record<string, unknown>, afterBlockId?: string) => {
    remember(blockId);
    await persist(blockId, blockType, content, afterBlockId);
  };
  const insert = async (afterBlockId: string | null, kind: InsertKind) => {
    remember("insert-" + crypto.randomUUID());
    const blockId = (kind === "interactive_gpt" ? "gpt-" : "block-") + crypto.randomUUID();
    const blockType = storedType(kind);
    setMenuAt(null);
    setHeadingOpen(false);
    setContext(null);
    setSelected(blockId);
    await persist(blockId, blockType, freshContent(kind, blockId), afterBlockId || undefined);
    const ordinal = editorBlocks((await studioAction<DocumentBundle>("getDocument", {documentId})).blocks).findIndex(block => block.block_id === blockId) + 1;
    onFocus?.({blockId, ordinal, blockType});
  };
  const reorderTo = async (fromId: string, targetId: string) => {
    if (!fromId || fromId === targetId) return;
    const all = [...blocksRef.current].filter(block => block.document_id === documentId).sort((a, b) => a.ordinal - b.ordinal);
    const toIndex = all.findIndex(block => block.block_id === targetId);
    if (toIndex < 0) return;
    remember("reorder-" + fromId + "-" + targetId);
    await studioAction("reorderDocumentBlock", {documentId, blockId: fromId, targetOrdinal: toIndex + 1});
    await refresh();
  };
  const hide = async (block: StudioDocumentBlock) => {
    remember("hide-" + block.block_id);
    await persist(block.block_id, block.block_type, {...(block.content || {}), hidden: true});
  };
  const copyBlock = async (block: StudioDocumentBlock) => {
    const payload = JSON.stringify({block_type: block.block_type, content: block.content || {}});
    try { localStorage.setItem(CLIP_KEY, payload); } catch {}
    try { await navigator.clipboard.writeText(plain(block) || payload); } catch {}
  };
  const pasteAfter = async (afterBlockId: string | null) => {
    let raw = "";
    try { raw = localStorage.getItem(CLIP_KEY) || ""; } catch {}
    if (!raw) {
      try { raw = await navigator.clipboard.readText(); } catch { raw = ""; }
    }
    let parsed: {block_type?: string; content?: Record<string, unknown>} | null = null;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
    const blockType = parsed?.block_type || "rich_text";
    const content = parsed?.content || {html: `<p>${raw.replace(/[<>]/g, "")}</p>`};
    if (!raw.trim()) return;
    await insertRaw(afterBlockId, blockType, content);
  };
  const insertRaw = async (afterBlockId: string | null, blockType: string, content: Record<string, unknown>) => {
    remember("paste-" + crypto.randomUUID());
    const blockId = (blockType === "interactive_gpt" ? "gpt-" : "block-") + crypto.randomUUID();
    setSelected(blockId);
    setContext(null);
    await persist(blockId, blockType, {...content, ...(blockType === "interactive_gpt" ? {address: blockId} : {})}, afterBlockId || undefined);
    return blockId;
  };
  const placeImage = async (afterBlockId: string | null, file: File) => {
    const url = await readFile(file);
    let stored = url;
    let assetId = "";
    try {
      const asset = await studioAction<any>("attachAsset", {dataUrl: url, filename: file.name || "clipboard.png"});
      stored = asset.signedUrl || url;
      assetId = asset.asset?.id || "";
    } catch {
      stored = url;
    }
    await insertRaw(afterBlockId, "image", {title: file.name || "Изображение", url: stored, previewUrl: url, assetId, align: "wide", caption: "", scale: 1, rotate: 0});
  };
  const choose = (blockId: string) => {
    setSelected(blockId);
    const ordinal = blocks.findIndex(block => block.block_id === blockId) + 1;
    const block = blocks.find(item => item.block_id === blockId);
    if (block && ordinal > 0) onFocus?.({blockId, ordinal, blockType: block.block_type});
  };
  const openMenu = (event: MouseEvent, blockId: string | null) => {
    if (study) return;
    event.preventDefault();
    event.stopPropagation();
    if (blockId) choose(blockId);
    setMenuAt(null);
    setContext({x: Math.min(event.clientX, window.innerWidth - 220), y: Math.min(event.clientY, window.innerHeight - 280), blockId});
  };

  useEffect(() => {
    const api = {
      canUndo: () => undoStack.current.length > 0,
      canRedo: () => redoStack.current.length > 0,
      undo: () => void restore(undoStack.current, redoStack.current),
      redo: () => void restore(redoStack.current, undoStack.current),
    };
    (window as any).__tqsDocumentHistory = api;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      if (document.querySelector(".v6-shell")?.getAttribute("data-surface") !== "documents") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, .tiptap, .tqs-rich-editor")) return;
      event.preventDefault();
      event.stopPropagation();
      void restore(event.shiftKey ? redoStack.current : undoStack.current, event.shiftKey ? undoStack.current : redoStack.current);
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if ((window as any).__tqsDocumentHistory === api) delete (window as any).__tqsDocumentHistory;
    };
  }, [documentId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (study) return;
      if (event.key === "Escape") setContext(null);
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, .tiptap, .tqs-rich-editor")) return;
      const block = editorBlocks(blocksRef.current).find(item => item.block_id === selectedRef.current);
      if (!block) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") { event.preventDefault(); void copyBlock(block); }
      if (event.key === "Backspace" || event.key === "Delete") { event.preventDefault(); void hide(block); }
    };
    const onPaste = (event: ClipboardEvent) => {
      if (study) return;
      if (document.querySelector(".v6-shell")?.getAttribute("data-surface") !== "documents") return;
      const file = clipboardImage(event.clipboardData);
      if (!file) return;
      event.preventDefault();
      event.stopPropagation();
      void placeImage(selectedRef.current, file);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste, true);
    };
  }, [documentId, study]);

  const gateIndex = blocks.findIndex(block => block.block_type === "video" && Array.isArray(block.content?.checkpoints) && block.content.checkpoints.length && !passed[block.block_id]);
  const done = blocks.filter(block => block.block_type === "video" && block.content?.checkpoints?.length).length;
  const cleared = Object.values(passed).filter(Boolean).length;

  const contextBlock = context?.blockId ? blocks.find(block => block.block_id === context.blockId) || null : null;
  const menu = (afterBlockId: string | null) => <InsertMenu headingOpen={headingOpen} onHeading={() => setHeadingOpen(value => !value)} onPick={kind => void insert(afterBlockId, kind)}/>;

  return <div className="studio-publication v6-doc-preview v6-handout v6-article" data-testid={study ? "document-preview" : "ordered-block-editor-v6"} data-handout="page" data-mode={study ? "study" : "edit"} data-document-id={documentId} onContextMenu={event => openMenu(event, (event.target as HTMLElement).closest("[data-block-id]")?.getAttribute("data-block-id") || null)} onMouseDown={() => { if (context) setContext(null); }}>
    {study && <p className="v6-study-progress" data-testid="study-progress">{done ? `Проверка ${Math.min(cleared, done)} из ${done}` : "Занятие без отдельной проверки"}</p>}
    {blocks.map((block, index) => {
      const locked = study && gateIndex >= 0 && index > gateIndex;
      const align = block.content?.align === "center" || block.content?.align === "right" ? block.content.align : "left";
      const level = Number(block.content?.level) === 2 ? 2 : 1;
      return <article key={block.block_id} className={["v6-block", selected === block.block_id ? "is-selected" : "", dropOn === block.block_id ? "is-drop" : ""].filter(Boolean).join(" ")} data-block-id={block.block_id} data-block-ordinal={index + 1} data-block-type={block.block_type} data-align={block.block_type === "rich_text" || block.block_type === "heading" ? align : undefined} data-level={block.block_type === "heading" ? level : undefined} data-locked={locked ? "true" : "false"} data-selected={selected === block.block_id ? "true" : "false"} onPointerDown={event => { if (event.button === 0) choose(block.block_id); }}>
        {!study && <div className="v6-block-gutter">
          <button type="button" className="v6-block-handle" aria-label={`Переместить блок ${index + 1}`} onPointerDown={event => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            dragId.current = block.block_id;
            choose(block.block_id);
            event.currentTarget.setPointerCapture(event.pointerId);
          }} onPointerMove={event => {
            if (dragId.current !== block.block_id) return;
            setDropOn(blockUnderPointer(event.clientY, block.block_id));
          }} onPointerUp={event => {
            if (dragId.current !== block.block_id) return;
            const target = blockUnderPointer(event.clientY, block.block_id);
            dragId.current = null;
            setDropOn(null);
            if (target) void reorderTo(block.block_id, target);
          }}>⋮⋮</button>
          <span>блок {index + 1}</span>
        </div>}
        <BlockBody block={block} study={study} selected={selected === block.block_id} locked={locked} passed={Boolean(passed[block.block_id])} onPass={() => {
          const next = {...passed, [block.block_id]: true};
          setPassed(next);
          try { localStorage.setItem(studyKey(documentId), JSON.stringify(next)); } catch {}
        }} onChange={content => void write(block.block_id, block.block_type, content)}/>
        {!study && <div className="v6-insert">
          <button type="button" aria-label="Добавить блок" aria-expanded={menuAt === block.block_id} onClick={event => { event.stopPropagation(); setHeadingOpen(false); setMenuAt(menuAt === block.block_id ? null : block.block_id); }}>+</button>
          {menuAt === block.block_id && menu(block.block_id)}
        </div>}
      </article>;
    })}
    {!blocks.length && !study && <div className="v6-insert is-empty"><button type="button" aria-label="Добавить блок" onClick={() => setMenuAt("start")}>+</button>{menuAt === "start" && menu(null)}</div>}
    {context && !study && <div className="v6-doc-context" role="menu" data-testid="doc-context-menu" style={{left: context.x, top: context.y}} onMouseDown={event => event.stopPropagation()} onContextMenu={event => event.preventDefault()}>
      <button type="button" role="menuitem" disabled={!contextBlock} onClick={() => contextBlock && void copyBlock(contextBlock)}>Копировать</button>
      <button type="button" role="menuitem" onClick={() => void pasteAfter(context.blockId)}>Вставить</button>
      <button type="button" role="menuitem" disabled={!contextBlock} onClick={() => contextBlock && void insertRaw(contextBlock.block_id, contextBlock.block_type, {...(contextBlock.content || {})})}>Дублировать</button>
      <button type="button" role="menuitem" disabled={!contextBlock} onClick={() => contextBlock && void hide(contextBlock)}>Удалить</button>
      <button type="button" role="menuitem" onClick={() => { const after = context.blockId || selected || blocks[blocks.length - 1]?.block_id || null; setContext(null); setHeadingOpen(false); setMenuAt(after || "start"); }}>Вставить блок</button>
    </div>}
  </div>;
}

function InsertMenu({headingOpen, onHeading, onPick}: {headingOpen: boolean; onHeading: () => void; onPick: (kind: InsertKind) => void}) {
  return <div className="v6-insert-menu" role="menu">
    {INSERTS.filter(item => item.kind !== "heading" && item.kind !== "subheading").slice(0, 1).map(item => <button type="button" key={item.kind} role="menuitem" onClick={() => onPick(item.kind)}><b>{item.label}</b><small>{item.hint}</small></button>)}
    <button type="button" role="menuitem" aria-expanded={headingOpen} className={headingOpen ? "is-on" : ""} onClick={onHeading}><b>Заголовок</b><small>Два уровня</small></button>
    {headingOpen && <>
      <button type="button" role="menuitem" onClick={() => onPick("heading")}><b>Заголовок</b><small>Крупный</small></button>
      <button type="button" role="menuitem" onClick={() => onPick("subheading")}><b>Подзаголовок</b><small>Раздел</small></button>
    </>}
    {INSERTS.filter(item => !["rich_text", "heading", "subheading"].includes(item.kind)).map(item => <button type="button" key={item.kind} role="menuitem" onClick={() => onPick(item.kind)}><b>{item.label}</b><small>{item.hint}</small></button>)}
  </div>;
}

function AlignRow({value, onChange}: {value: string; onChange: (align: string) => void}) {
  const current = value === "center" || value === "right" ? value : "left";
  return <div className="v6-align" role="group" aria-label="Выравнивание">
    {(["left", "center", "right"] as const).map(align => <button type="button" key={align} className={current === align ? "is-on" : ""} aria-label={align === "left" ? "По левому краю" : align === "center" ? "По центру" : "По правому краю"} onClick={event => { event.stopPropagation(); onChange(align); }}>{align === "left" ? "Слева" : align === "center" ? "Центр" : "Справа"}</button>)}
  </div>;
}

function BlockBody({block, study, selected, locked, passed, onPass, onChange}: {block: StudioDocumentBlock; study: boolean; selected: boolean; locked: boolean; passed: boolean; onPass: () => void; onChange: (content: Record<string, unknown>) => void}) {
  const c = block.content || {};
  if (locked) return <p className="v6-locked">Дальше откроется после проверки.</p>;
  if (block.block_type === "heading") {
    const sub = Number(c.level) === 2;
    if (study) return sub ? <h3>{c.text || ""}</h3> : <h2>{c.text || ""}</h2>;
    const field = <input aria-label={sub ? "Подзаголовок" : "Заголовок"} value={c.text || ""} onChange={event => onChange({...c, text: event.target.value})}/>;
    return <>{selected && <AlignRow value={String(c.align || "left")} onChange={align => onChange({...c, align})}/>}{sub ? <h3>{field}</h3> : <h2>{field}</h2>}</>;
  }
  if (block.block_type === "rich_text") {
    if (study) return <div className="studio-rich" dangerouslySetInnerHTML={{__html: c.html || ""}}/>;
    return <>{selected && <AlignRow value={String(c.align || "left")} onChange={align => onChange({...c, align, html: c.html || "<p></p>"})}/>}<RichEditor html={c.html || "<p></p>"} onBlur={html => onChange({...c, html})}/></>;
  }
  if (block.block_type === "interactive_gpt") return <GptBlock block={block} study={study} onChange={onChange}/>;
  if (block.block_type === "callout" || block.block_type === "quote") {
    return <aside className="studio-callout"><small>Практика</small>{study ? <p>{c.text || ""}</p> : <textarea aria-label="Выноска" value={c.text || ""} onChange={event => onChange({...c, text: event.target.value})}/>}</aside>;
  }
  if (block.block_type === "image") return <ImageBlock content={c} study={study} selected={selected} onChange={onChange}/>;
  if (block.block_type === "video") return <VideoBlock content={c} study={study} passed={passed} onPass={onPass} onChange={onChange}/>;
  if (block.block_type === "interactive" || block.block_type === "table") {
    const columns = c.columns || [];
    const rows = c.rows || [];
    return <table><thead><tr>{columns.map((cell: string, index: number) => <th key={index}>{cell}</th>)}</tr></thead><tbody>{rows.map((row: string[], index: number) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>;
  }
  if (study) return <p>{c.text || c.title || ""}</p>;
  return <p>{plain(block)}</p>;
}

function GptBlock({block, study, onChange}: {block: StudioDocumentBlock; study: boolean; onChange: (content: Record<string, unknown>) => void}) {
  const c = block.content || {};
  const kind = GPT_KINDS.some(item => item[0] === c.kind) ? String(c.kind) : "note";
  const [driveNote, setDriveNote] = useState("Блок хранится в Studio.");
  useEffect(() => {
    let stop = false;
    void studioAction<any>("driveStatus").then(value => {
      if (stop) return;
      const connected = value?.connection?.status === "CONNECTED";
      setDriveNote(connected ? "Диск подключён: медиа этого блока можно держать и там." : "Google Drive не подключён. Блок сохранён в Studio.");
    }).catch(() => { if (!stop) setDriveNote("Google Drive не подключён. Блок сохранён в Studio."); });
    return () => { stop = true; };
  }, []);
  const setKind = (next: string) => onChange({...c, kind: next, address: block.block_id, title: "Interactive GPT"});
  return <section className="v6-gpt" data-testid="interactive-gpt" data-gpt-id={block.block_id}>
    <header><strong>Interactive GPT</strong><code>{block.block_id}</code></header>
    {!study && <div className="v6-gpt-kinds" role="group" aria-label="Содержимое блока">{GPT_KINDS.map(([id, label]) => <button type="button" key={id} className={kind === id ? "is-on" : ""} onClick={() => setKind(id)}>{label}</button>)}</div>}
    {kind === "image" ? <ImageBlock content={c} study={study} selected onChange={onChange}/> : kind === "video" ? <label>Адрес видео<input aria-label="Адрес видео в блоке" value={c.url || ""} placeholder="https://" onChange={event => onChange({...c, url: event.target.value, address: block.block_id})}/></label> : <textarea aria-label={kind === "chart" ? "Заметка к графику" : kind === "correlation" ? "Корреляция" : "Заметка"} value={c.note || c.text || ""} placeholder={kind === "chart" ? "Что показать на графике" : kind === "correlation" ? "Какие ряды сравнить" : "Заметка для ChatGPT"} onChange={event => onChange({...c, note: event.target.value, address: block.block_id})}/>}
    <small>{driveNote}</small>
    {!study && <button type="button" onClick={() => setDriveNote("Диск не подключён. Этот блок уже записан в Studio по id " + block.block_id + ". Подключение — в настройках, без него блок не пропадает.")}>Подключить диск</button>}
  </section>;
}

function ImageBlock({content, study, selected, onChange}: {content: any; study: boolean; selected?: boolean; onChange: (content: Record<string, unknown>) => void}) {
  const align = content.align === "left" || content.align === "right" || content.align === "wide" ? content.align : "wide";
  const scale = Number(content.scale) > 0 ? Number(content.scale) : 1;
  const rotate = Number(content.rotate) || 0;
  const src = String(content.url || content.previewUrl || "");
  const pick = async (file: File) => {
    const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
    const asset = await studioAction<any>("attachAsset", {dataUrl: url, filename: file.name});
    onChange({...content, url: asset.signedUrl || url, assetId: asset.asset?.id, title: content.title || file.name});
  };
  return <figure className={selected ? "v6-figure is-selected" : "v6-figure"} data-align={align} data-scale={scale} data-rotate={rotate} data-selected={selected ? "true" : "false"} style={{["--fig-scale" as string]: String(scale), ["--fig-rotate" as string]: `${rotate}deg`}}>
    {src ? <img src={src} alt={content.caption || content.title || "Изображение"}/> : <div className="v6-figure-empty">Вставьте изображение</div>}
    {study ? content.caption && <figcaption>{content.caption}</figcaption> : <figcaption>
      <input aria-label="Подпись" value={content.caption || ""} placeholder="Подпись" onChange={event => onChange({...content, caption: event.target.value})}/>
      <span>
        <button type="button" className={align === "left" ? "is-on" : ""} onClick={() => onChange({...content, align: "left"})}>Слева</button>
        <button type="button" className={align === "right" ? "is-on" : ""} onClick={() => onChange({...content, align: "right"})}>Справа</button>
        <button type="button" className={align === "wide" ? "is-on" : ""} onClick={() => onChange({...content, align: "wide"})}>Шире</button>
        <button type="button" onClick={() => onChange({...content, scale: scale <= 0.8 ? 1 : scale < 1.2 ? 1.35 : 0.75})}>{scale < 0.9 ? "Мелко" : scale > 1.15 ? "Крупно" : "Масштаб"}</button>
        <button type="button" onClick={() => onChange({...content, rotate: (rotate + 90) % 360})}>Повернуть</button>
        <button type="button" className="v6-file-pick" onClick={event => event.currentTarget.nextElementSibling && (event.currentTarget.nextElementSibling as HTMLInputElement).click()}>Заменить</button>
        <input className="v6-file-input" aria-label="Выбрать изображение" type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) void pick(file); }}/>
      </span>
    </figcaption>}
  </figure>;
}

function VideoBlock({content, study, passed, onPass, onChange}: {content: any; study: boolean; passed: boolean; onPass: () => void; onChange: (content: Record<string, unknown>) => void}) {
  const checkpoint = Array.isArray(content.checkpoints) ? content.checkpoints[0] : null;
  const chapters = Array.isArray(content.chapters) && content.chapters.length ? content.chapters : LESSON_CHAPTERS;
  const embed = resolveVideoEmbed(String(content.url || ""));
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const end = Math.max(...chapters.map((chapter: {at?: string}) => clockSeconds(chapter.at || "0:00")), 60);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setSeconds(value => value >= end ? end : value + 1), 700);
    return () => window.clearInterval(id);
  }, [playing, end]);
  const active = [...chapters].reverse().find((chapter: {at?: string}) => clockSeconds(chapter.at || "0:00") <= seconds) || chapters[0];
  const check = () => {
    const expected = String(checkpoint?.answer || "").trim().toLowerCase();
    const given = answer.trim().toLowerCase();
    if (!given) return;
    if (expected && !given.includes(expected) && !expected.includes(given)) { setWrong(true); return; }
    setWrong(false);
    onPass();
  };
  return <section className="v6-video" data-testid="document-video">
    <strong>{content.title || "Видео"}</strong>
    <div className="v6-player-stage" data-playing={playing ? "true" : "false"}>
      {embed ? <iframe title={content.title || "Видео"} src={embed} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/> : content.url ? <video controls src={content.url}/> : <img src={content.poster || LESSON_POSTER} alt=""/>}
      <p className="v6-player-caption" data-testid="video-subtitle">{active?.text || content.transcript || ""}</p>
      <div className="v6-player-bar">
        <button type="button" aria-label={playing ? "Пауза" : "Слушать"} onClick={() => setPlaying(value => !value)}>{playing ? "II" : "▶"}</button>
        <span>{clockLabel(seconds)}</span>
        <span>{active?.title}</span>
      </div>
    </div>
    <ol className="v6-chapters" data-testid="video-chapters">{chapters.map((chapter: {id?: string; at?: string; title?: string}) => <li key={chapter.id || chapter.at}><button type="button" className={chapter === active ? "is-on" : ""} onClick={() => { setSeconds(clockSeconds(chapter.at || "0:00")); setPlaying(false); }}><small>{chapter.at}</small><span>{chapter.title}</span></button></li>)}</ol>
    {!study && <label>Адрес видео<input aria-label="Адрес видео" value={content.url || ""} placeholder="https://" onChange={event => onChange({...content, url: event.target.value, chapters})} /></label>}
    {!study && <textarea aria-label="Текст видео" value={content.transcript || chapters.map((chapter: {text?: string}) => chapter.text).filter(Boolean).join(" ")} onChange={event => onChange({...content, transcript: event.target.value, chapters})}/>}
    {checkpoint && <div className="v6-checkpoint" data-testid="video-checkpoint">
      <small>{checkpoint.at ? `Метка ${checkpoint.at}` : "Проверка"}</small>
      {study ? <>
        <p>{checkpoint.prompt}</p>
        {passed ? <b>Ответ принят</b> : <><input aria-label="Ответ на проверку" value={answer} onChange={event => setAnswer(event.target.value)}/><button type="button" onClick={check}>Проверить</button>{wrong && <span>Ответ не совпал.</span>}</>}
      </> : <>
        <input aria-label="Метка времени" value={checkpoint.at || ""} onChange={event => onChange({...content, checkpoints: [{...checkpoint, at: event.target.value}]})}/>
        <textarea aria-label="Вопрос к видео" value={checkpoint.prompt || ""} onChange={event => onChange({...content, checkpoints: [{...checkpoint, prompt: event.target.value}]})}/>
        <input aria-label="Ожидаемый ответ" value={checkpoint.answer || ""} placeholder="Ответ, если его нужно сверить" onChange={event => onChange({...content, checkpoints: [{...checkpoint, answer: event.target.value}]})}/>
      </>}
    </div>}
  </section>;
}

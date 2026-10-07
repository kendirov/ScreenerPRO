"use client";

import {useEffect, useState} from "react";
import type {DocumentBundle, StudioDocumentBlock} from "@/lib/studio-v5/types";
import {studioAction} from "@/lib/studio-v6/api";
import {editorBlocks, resolveVideoEmbed} from "@/lib/studio-v6/document-model";
import {RichEditor} from "./RichEditor";

export type DocumentMode = "edit" | "preview";
export type AuthoringFocus = {blockId: string; ordinal: number; blockType: string};
type InsertKind = "rich_text" | "heading" | "image" | "video" | "callout";

const INSERTS: Array<[InsertKind, string]> = [
  ["rich_text", "Текст"],
  ["heading", "Заголовок"],
  ["image", "Изображение"],
  ["video", "Видео"],
  ["callout", "Выноска"],
];
const CLIP_KEY = "tqs-studio-doc-clip";

function freshContent(kind: InsertKind) {
  if (kind === "heading") return {text: "Новый раздел"};
  if (kind === "image") return {title: "Изображение", url: "", align: "center", caption: ""};
  if (kind === "video") return {title: "Видео", url: "", checkpoints: [{id: "cp-" + crypto.randomUUID().slice(0, 8), at: "0:30", prompt: "Что здесь важно увидеть?", answer: ""}]};
  if (kind === "callout") return {text: "Практика", tone: "practice"};
  return {html: "<p></p>"};
}

function plain(block: StudioDocumentBlock) {
  const c = block.content || {};
  return String(c.text || c.html || c.caption || c.title || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function studyKey(documentId: string) {
  return "tqs-studio-study-v1:" + documentId;
}

export function DocumentEditorV6({bundle, mode, onBundle, onFocus}: {bundle: DocumentBundle; onBundle?: (value: DocumentBundle) => void; mode: DocumentMode; onFocus?: (focus: AuthoringFocus | null) => void}) {
  const study = mode === "preview";
  const blocks = editorBlocks(bundle.blocks);
  const [selected, setSelected] = useState<string | null>(blocks[0]?.block_id || null);
  const [menuAt, setMenuAt] = useState<string | null>(null);
  const [passed, setPassed] = useState<Record<string, boolean>>({});
  const documentId = bundle.document.id;

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
  const write = async (blockId: string, blockType: string, content: Record<string, unknown>, afterBlockId?: string) => {
    await studioAction("upsertDocumentBlock", {documentId, blockId, blockType, content, afterBlockId});
    await refresh();
  };
  const insert = async (afterBlockId: string | null, kind: InsertKind) => {
    const blockId = "block-" + crypto.randomUUID();
    setMenuAt(null);
    setSelected(blockId);
    await write(blockId, kind, freshContent(kind), afterBlockId || undefined);
    const ordinal = editorBlocks((await studioAction<DocumentBundle>("getDocument", {documentId})).blocks).findIndex(block => block.block_id === blockId) + 1;
    onFocus?.({blockId, ordinal, blockType: kind});
  };
  const reorder = async (blockId: string, targetOrdinal: number) => {
    await studioAction("reorderDocumentBlock", {documentId, blockId, targetOrdinal});
    await refresh();
  };
  const hide = async (block: StudioDocumentBlock) => {
    await write(block.block_id, block.block_type, {...(block.content || {}), hidden: true});
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
    const blockId = "block-" + crypto.randomUUID();
    setSelected(blockId);
    await write(blockId, blockType, content, afterBlockId || undefined);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, .tiptap, .tqs-rich-editor")) return;
      const block = blocks.find(item => item.block_id === selected);
      if (!block || study) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") { event.preventDefault(); void copyBlock(block); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") { event.preventDefault(); void pasteAfter(block.block_id); }
      if (event.key === "Backspace" || event.key === "Delete") { event.preventDefault(); void hide(block); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blocks, selected, study]);

  const gateIndex = blocks.findIndex(block => block.block_type === "video" && Array.isArray(block.content?.checkpoints) && block.content.checkpoints.length && !passed[block.block_id]);
  const done = blocks.filter(block => block.block_type === "video" && block.content?.checkpoints?.length).length;
  const cleared = Object.values(passed).filter(Boolean).length;

  return <div className="studio-publication v6-doc-preview v6-handout v6-article" data-testid={study ? "document-preview" : "ordered-block-editor-v6"} data-handout="page" data-mode={study ? "study" : "edit"} data-document-id={documentId}>
    {study && <p className="v6-study-progress" data-testid="study-progress">{done ? `Проверка ${Math.min(cleared, done)} из ${done}` : "Занятие без отдельной проверки"}</p>}
    {blocks.map((block, index) => {
      const locked = study && gateIndex >= 0 && index > gateIndex;
      return <article key={block.block_id} className={selected === block.block_id ? "v6-block is-selected" : "v6-block"} data-block-id={block.block_id} data-block-ordinal={index + 1} data-block-type={block.block_type} data-locked={locked ? "true" : "false"} onClick={() => { setSelected(block.block_id); onFocus?.({blockId: block.block_id, ordinal: index + 1, blockType: block.block_type}); }}>
        {!study && <div className="v6-block-gutter">
          <button type="button" className="v6-block-handle" draggable aria-label={`Переместить блок ${index + 1}`} onDragStart={event => event.dataTransfer.setData("text/plain", block.block_id)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const from = event.dataTransfer.getData("text/plain"); if (from && from !== block.block_id) void reorder(from, index + 1); }}>⋮⋮</button>
          <span>блок {index + 1}</span>
          <button type="button" aria-label="Копировать блок" onClick={() => void copyBlock(block)}>Копировать</button>
          <button type="button" aria-label="Вставить блок" onClick={() => void pasteAfter(block.block_id)}>Вставить</button>
        </div>}
        <BlockBody block={block} study={study} locked={locked} passed={Boolean(passed[block.block_id])} onPass={() => {
          const next = {...passed, [block.block_id]: true};
          setPassed(next);
          try { localStorage.setItem(studyKey(documentId), JSON.stringify(next)); } catch {}
        }} onChange={content => void write(block.block_id, block.block_type, content)}/>
        {!study && <div className="v6-insert">
          <button type="button" aria-label="Добавить блок" aria-expanded={menuAt === block.block_id} onClick={() => setMenuAt(menuAt === block.block_id ? null : block.block_id)}>+</button>
          {menuAt === block.block_id && <div className="v6-insert-menu" role="menu">{INSERTS.map(([kind, label]) => <button type="button" key={kind} role="menuitem" onClick={() => void insert(block.block_id, kind)}>{label}</button>)}</div>}
        </div>}
      </article>;
    })}
    {!blocks.length && !study && <div className="v6-insert is-empty"><button type="button" aria-label="Добавить блок" onClick={() => setMenuAt("start")}>+</button>{menuAt === "start" && <div className="v6-insert-menu" role="menu">{INSERTS.map(([kind, label]) => <button type="button" key={kind} onClick={() => void insert(null, kind)}>{label}</button>)}</div>}</div>}
  </div>;
}

function BlockBody({block, study, locked, passed, onPass, onChange}: {block: StudioDocumentBlock; study: boolean; locked: boolean; passed: boolean; onPass: () => void; onChange: (content: Record<string, unknown>) => void}) {
  const c = block.content || {};
  if (locked) return <p className="v6-locked">Дальше откроется после проверки.</p>;
  if (block.block_type === "heading") {
    if (study) return <h2>{c.text || ""}</h2>;
    return <h2><input aria-label={`Заголовок блока`} value={c.text || ""} onChange={event => onChange({...c, text: event.target.value})}/></h2>;
  }
  if (block.block_type === "rich_text") {
    if (study) return <div className="studio-rich" dangerouslySetInnerHTML={{__html: c.html || ""}}/>;
    return <RichEditor html={c.html || "<p></p>"} onBlur={html => onChange({...c, html})}/>;
  }
  if (block.block_type === "callout" || block.block_type === "quote") {
    return <aside className="studio-callout"><small>Практика</small>{study ? <p>{c.text || ""}</p> : <textarea aria-label="Выноска" value={c.text || ""} onChange={event => onChange({...c, text: event.target.value})}/>}</aside>;
  }
  if (block.block_type === "image") return <ImageBlock content={c} study={study} onChange={onChange}/>;
  if (block.block_type === "video") return <VideoBlock content={c} study={study} passed={passed} onPass={onPass} onChange={onChange}/>;
  if (block.block_type === "interactive" || block.block_type === "table") {
    const columns = c.columns || [];
    const rows = c.rows || [];
    return <table><thead><tr>{columns.map((cell: string, index: number) => <th key={index}>{cell}</th>)}</tr></thead><tbody>{rows.map((row: string[], index: number) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>;
  }
  if (study) return <p>{c.text || c.title || ""}</p>;
  return <p>{plain(block)}</p>;
}

function ImageBlock({content, study, onChange}: {content: any; study: boolean; onChange: (content: Record<string, unknown>) => void}) {
  const align = content.align === "left" || content.align === "wide" ? content.align : "center";
  const pick = async (file: File) => {
    const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
    const asset = await studioAction<any>("attachAsset", {dataUrl: url, filename: file.name});
    onChange({...content, url: asset.signedUrl || url, assetId: asset.asset?.id, title: content.title || file.name});
  };
  return <figure className="v6-figure" data-align={align}>
    {content.url ? <img src={content.url} alt={content.caption || content.title || ""}/> : <div className="v6-figure-empty">Изображение</div>}
    {study ? content.caption && <figcaption>{content.caption}</figcaption> : <figcaption>
      <input aria-label="Подпись" value={content.caption || ""} placeholder="Подпись" onChange={event => onChange({...content, caption: event.target.value})}/>
      <span>
        <button type="button" className={align === "left" ? "is-on" : ""} onClick={() => onChange({...content, align: "left"})}>Слева</button>
        <button type="button" className={align === "center" ? "is-on" : ""} onClick={() => onChange({...content, align: "center"})}>Центр</button>
        <button type="button" className={align === "wide" ? "is-on" : ""} onClick={() => onChange({...content, align: "wide"})}>Шире</button>
        <label>Файл<input aria-label="Выбрать изображение" type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) void pick(file); }}/></label>
      </span>
    </figcaption>}
  </figure>;
}

function VideoBlock({content, study, passed, onPass, onChange}: {content: any; study: boolean; passed: boolean; onPass: () => void; onChange: (content: Record<string, unknown>) => void}) {
  const checkpoint = Array.isArray(content.checkpoints) ? content.checkpoints[0] : null;
  const embed = resolveVideoEmbed(String(content.url || ""));
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState(false);
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
    {embed ? <iframe title={content.title || "Видео"} src={embed} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/> : content.url ? <video controls src={content.url}/> : <div className="v6-figure-empty">Видео появится по адресу</div>}
    {!study && <label>Адрес видео<input aria-label="Адрес видео" value={content.url || ""} placeholder="https://" onChange={event => onChange({...content, url: event.target.value})} /></label>}
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

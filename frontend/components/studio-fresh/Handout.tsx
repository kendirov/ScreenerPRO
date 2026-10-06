"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { type HandoutBlock, type HandoutKind } from "@/lib/studio-fresh/live-state";

type Block = HandoutBlock;
type Kind = HandoutKind;

const INKS = [
  ["amber", "Янтарный"],
  ["blue", "Синий"],
  ["green", "Зелёный"],
  ["rose", "Розовый"],
] as const;

const GROUPS: { title: string; items: [Kind, string][] }[] = [
  { title: "Текст", items: [["heading", "Заголовок"], ["text", "Текст"], ["callout", "Заметка"]] },
  { title: "Медиа", items: [["image", "Изображение"], ["video", "Видео"]] },
];

export function Handout({
  onBoard,
  blocks,
  onChange,
  publicReading = false,
}: {
  onBoard: () => void;
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  publicReading?: boolean;
}) {
  const [reading, setReading] = useState(publicReading);
  const [menu, setMenu] = useState<number | null>(null);
  const [blockMenu, setBlockMenu] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [printQueued, setPrintQueued] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [lift, setLift] = useState(0);
  const [over, setOver] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const overRef = useRef<number | null>(null);

  const edit = !reading && !publicReading;
  const visible = reading || publicReading ? blocks.filter((block) => !block.hidden && hasHandoutContent(block)) : blocks;

  const patch = (id: string, next: Partial<Block>) => onChange(blocks.map((block) => (block.id === id ? { ...block, ...next } : block)));
  const add = (index: number, kind: Kind) => {
    const block: Block = {
      id: crypto.randomUUID(),
      kind,
      text: kind === "heading" ? "Новый заголовок" : kind === "callout" ? "Заметка к этому месту" : "",
      tone: kind === "callout" ? "amber" : undefined,
    };
    const copy = [...blocks];
    copy.splice(index, 0, block);
    onChange(copy);
    setMenu(null);
  };
  const remove = (id: string) => onChange(blocks.filter((block) => block.id !== id));
  const duplicate = (id: string) => {
    const index = blocks.findIndex((block) => block.id === id);
    if (index < 0) return;
    const copy = [...blocks];
    copy.splice(index + 1, 0, { ...blocks[index], id: crypto.randomUUID() });
    onChange(copy);
  };
  const dropAt = (index: number, id = dragId) => {
    if (!id) return;
    const from = blocks.findIndex((block) => block.id === id);
    setDragId(null);
    setLift(0);
    setOver(null);
    overRef.current = null;
    if (from < 0) return;
    const target = from < index ? index - 1 : index;
    if (target === from) return;
    const copy = [...blocks];
    const [item] = copy.splice(from, 1);
    copy.splice(target, 0, item);
    onChange(copy);
  };
  const slotAt = (clientY: number, id: string) => {
    const rows = [...(sheetRef.current?.querySelectorAll<HTMLElement>("[data-block]") ?? [])].filter((row) => row.dataset.id !== id);
    let next = blocks.length;
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        next = Number(row.dataset.index);
        break;
      }
    }
    return next;
  };
  const liftBlock = (id: string, event: ReactPointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const index = blocks.findIndex((block) => block.id === id);
    overRef.current = index;
    setDragId(id);
    setOver(index);
    setLift(0);
    const move = (pointer: PointerEvent) => {
      const next = slotAt(pointer.clientY, id);
      overRef.current = next;
      setOver(next);
      setLift(pointer.clientY - startY);
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      dropAt(overRef.current ?? index, id);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  };
  const handoutUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "handout");
    return url.toString();
  };
  const copyLink = async () => {
    await navigator.clipboard.writeText(handoutUrl());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  const printSheet = () => {
    setShareOpen(false);
    setReading(true);
    setPrintQueued(true);
  };

  useEffect(() => {
    const close = () => {
      setMenu(null);
      setBlockMenu(null);
      setShareOpen(false);
    };
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, []);

  useEffect(() => {
    if (!printQueued || (!reading && !publicReading)) return;
    const id = window.setTimeout(() => {
      window.print();
      setPrintQueued(false);
    }, 80);
    return () => window.clearTimeout(id);
  }, [printQueued, reading, publicReading]);

  return (
    <article className={edit ? "handout" : "handout is-reading"} onClick={() => { setMenu(null); setBlockMenu(null); }}>
      <header className="handout-bar">
        <div>
          <p>Документ</p>
          <h1>Конспект занятия 1</h1>
        </div>
        <div className="handout-actions">
          {!publicReading && <button type="button" onClick={onBoard}>На доске</button>}
          {!publicReading && (
            <button type="button" className={reading ? "is-on" : ""} onClick={() => { setReading((value) => !value); setShareOpen(false); }}>
              {reading ? "Редактор" : "Раздатка"}
            </button>
          )}
          {(reading || publicReading) && (
            <div className="handout-share">
              <button type="button" className={shareOpen ? "is-on" : ""} onClick={(event) => { event.stopPropagation(); publicReading ? printSheet() : setShareOpen((value) => !value); }}>
                {publicReading ? "PDF" : copied ? "Ссылка скопирована" : "Ссылка и PDF"}
              </button>
              {shareOpen && (
                <div onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => void copyLink()}>Скопировать ссылку на раздатку</button>
                  <button type="button" onClick={printSheet}>Сохранить PDF этой раздатки</button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      <div
        className="handout-sheet"
        ref={sheetRef}
        onDragOver={(event) => event.preventDefault()}
      >
        {visible.map((block) => {
          const index = blocks.findIndex((item) => item.id === block.id);
          return (
            <div key={block.id}>
            {edit && over === index && dragId && dragId !== block.id && <div className="drop-line" />}
            <section
              data-block
              data-id={block.id}
              data-index={index}
              className={`handout-block kind-${block.kind}${block.hidden ? " is-hidden" : ""}${block.tone ? ` tone-${block.tone}` : ""}${dragId === block.id ? " is-lifting" : ""}`}
              style={dragId === block.id ? { transform: `translateY(${lift}px)`, zIndex: 4 } : undefined}
              onContextMenu={(event) => {
                if (!edit) return;
                event.preventDefault();
                setBlockMenu(block.id);
                setMenu(null);
              }}
            >
              {edit && (
                <div
                  className="handout-gutter"
                  onPointerDown={(event) => {
                    if ((event.target as HTMLElement).closest("button")) return;
                    setBlockMenu(null);
                    liftBlock(block.id, event);
                  }}
                >
                  <button
                    type="button"
                    className="grip"
                    aria-label="Переместить блок"
                    onPointerDown={(event) => {
                      setBlockMenu(null);
                      liftBlock(block.id, event);
                    }}
                  >
                    <span />
                  </button>
                  <span className="ordinal">{index + 1}</span>
                  <button type="button" aria-label="Действия блока" onClick={(event) => { event.stopPropagation(); setBlockMenu(blockMenu === block.id ? null : block.id); setMenu(null); }}>···</button>
                  {blockMenu === block.id && (
                    <div className="block-menu" onClick={(event) => event.stopPropagation()}>
                      <button type="button" onClick={() => { setNoteFor(block.id); setBlockMenu(null); }}>Комментарий</button>
                      <button type="button" onClick={() => { patch(block.id, { hidden: !block.hidden }); setBlockMenu(null); }}>{block.hidden ? "Показать в раздатке" : "Скрыть из раздатки"}</button>
                      <button type="button" onClick={() => { duplicate(block.id); setBlockMenu(null); }}>Дублировать</button>
                      <button type="button" onClick={() => { remove(block.id); setBlockMenu(null); }}>Удалить</button>
                    </div>
                  )}
                </div>
              )}
              <div className="handout-body">
                {block.hidden && edit && <em className="hidden-flag">Только в редакторе</em>}
                <BlockView block={block} edit={edit} onPatch={(next) => patch(block.id, next)} />
                {edit && (block.comment || noteFor === block.id) && (
                  <label className="owner-note">
                    <span>Комментарий себе, не для раздатки</span>
                    <textarea
                      rows={3}
                      autoFocus={noteFor === block.id}
                      placeholder="Виден только в редакторе"
                      value={block.comment || ""}
                      onChange={(event) => patch(block.id, { comment: event.target.value })}
                      onBlur={(event) => { if (!event.target.value.trim()) setNoteFor(null); }}
                    />
                  </label>
                )}
              </div>
              {edit && (
                <div className="handout-insert">
                  <button type="button" onClick={(event) => { event.stopPropagation(); setMenu(menu === index + 1 ? null : index + 1); setBlockMenu(null); }}>+</button>
                  {menu === index + 1 && (
                    <div className="handout-kinds" onClick={(event) => event.stopPropagation()}>
                      {GROUPS.map((group) => (
                        <div key={group.title}>
                          <p>{group.title}</p>
                          {group.items.map(([kind, label]) => (
                            <button key={kind} type="button" onClick={() => add(index + 1, kind)}>{label}</button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
            </div>
          );
        })}
        {edit && over === blocks.length && dragId && <div className="drop-line" />}
        {edit && visible.length === 0 && (
          <button type="button" className="empty-add" onClick={(event) => { event.stopPropagation(); setMenu(0); }}>Добавить первый блок</button>
        )}
        {edit && menu === 0 && visible.length === 0 && (
          <div className="handout-kinds" onClick={(event) => event.stopPropagation()}>
            {GROUPS.map((group) => (
              <div key={group.title}>
                <p>{group.title}</p>
                {group.items.map(([kind, label]) => (
                  <button key={kind} type="button" onClick={() => add(0, kind)}>{label}</button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function BlockView({ block, edit, onPatch }: { block: Block; edit: boolean; onPatch: (next: Partial<Block>) => void }) {
  if (block.kind === "image") return <ImageBlock block={block} edit={edit} onPatch={onPatch} />;
  if (block.kind === "video") return <VideoBlock block={block} edit={edit} onPatch={onPatch} />;
  return (
    <div className={`rich-wrap kind-${block.kind}`}>
      {edit && block.kind === "callout" && (
        <div className="tone-row" aria-label="Цвет заметки">
          {INKS.map(([tone, label]) => (
            <button key={tone} type="button" className={`swatch tone-${tone}${block.tone === tone ? " is-on" : ""}`} aria-label={label} onClick={() => onPatch({ tone })} />
          ))}
        </div>
      )}
      <RichText
        html={block.text}
        editing={edit}
        className={block.kind === "heading" ? "rich rich-heading" : block.kind === "callout" ? "rich rich-callout" : "rich"}
        placeholder={block.kind === "heading" ? "Заголовок" : block.kind === "callout" ? "Заметка" : "Текст"}
        onChange={(text) => onPatch({ text })}
      />
    </div>
  );
}

function RichText({ html, editing, className, placeholder, onChange }: { html: string; editing: boolean; className: string; placeholder: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  const [bar, setBar] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || focused.current) return;
    const next = looksRich(html) ? html : escapeText(html);
    if (node.innerHTML !== next) node.innerHTML = next;
  }, [html]);

  useEffect(() => {
    if (!editing) return;
    const place = () => {
      const sel = window.getSelection();
      const node = ref.current;
      if (!sel || sel.isCollapsed || !sel.rangeCount || !node || !node.contains(sel.anchorNode)) {
        setBar(null);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setBar({ x: rect.left + rect.width / 2, y: rect.top });
    };
    document.addEventListener("selectionchange", place);
    return () => document.removeEventListener("selectionchange", place);
  }, [editing]);

  const commit = () => {
    const node = ref.current;
    if (!node) return;
    onChange(sanitizeRich(node.innerHTML));
  };

  return (
    <>
      <div
        ref={ref}
        className={className}
        contentEditable={editing}
        role={editing ? "textbox" : undefined}
        aria-placeholder={editing ? placeholder : undefined}
        data-empty={!html.trim() ? "true" : "false"}
        suppressContentEditableWarning
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; setBar(null); commit(); }}
        onInput={commit}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
      />
      {editing && bar && (
        <div className="format-bar" style={{ left: bar.x, top: bar.y }} onMouseDown={(event) => event.preventDefault()}>
          <button type="button" onClick={() => toggleTag("strong", commit)}>Ж</button>
          <button type="button" onClick={() => toggleTag("em", commit)}>К</button>
          <button type="button" onClick={() => toggleTag("u", commit)}>Ч</button>
          <span />
          {INKS.map(([tone, label]) => (
            <button key={tone} type="button" className={`swatch tone-${tone}`} aria-label={label} onClick={() => paint("ink", tone, commit)} />
          ))}
          <span />
          {INKS.map(([tone, label]) => (
            <button key={`wash-${tone}`} type="button" className={`wash-swatch tone-${tone}`} aria-label={`Фон ${label}`} onClick={() => paint("wash", tone, commit)} />
          ))}
        </div>
      )}
    </>
  );
}

function ImageBlock({ block, edit, onPatch }: { block: Block; edit: boolean; onPatch: (next: Partial<Block>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const take = async (file: File) => {
    const src = await fileToImage(file);
    onPatch({ src });
  };
  return (
    <figure
      className="media-frame"
      onDragOver={(event) => { if (edit && event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
      onDrop={(event) => {
        if (!edit) return;
        const file = event.dataTransfer.files?.[0];
        if (!file || !file.type.startsWith("image/")) return;
        event.preventDefault();
        event.stopPropagation();
        void take(file);
      }}
    >
      {block.src ? <img src={block.src} alt="" /> : edit ? <div className="media-empty">Изображение</div> : null}
      {edit && (
        <div className="media-tools">
          <button type="button" onClick={() => fileRef.current?.click()}>{block.src ? "Заменить" : "Выбрать файл"}</button>
          <input
            value={block.src?.startsWith("data:") ? "" : block.src || ""}
            placeholder="или ссылка на картинку"
            onChange={(event) => onPatch({ src: event.target.value })}
          />
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void take(file);
            event.target.value = "";
          }} />
        </div>
      )}
      <RichText html={block.text} editing={edit} className="rich rich-caption" placeholder="Подпись" onChange={(text) => onPatch({ text })} />
    </figure>
  );
}

function VideoBlock({ block, edit, onPatch }: { block: Block; edit: boolean; onPatch: (next: Partial<Block>) => void }) {
  const embed = embedVideo(block.text);
  return (
    <figure className="media-frame">
      {embed ? (
        <iframe title="Видео занятия" src={embed} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      ) : (
        <div className="media-empty">{block.text.trim() ? "Эту ссылку нельзя встроить. Оставьте YouTube, RuTube или Vimeo." : "Видео"}</div>
      )}
      {edit && (
        <input
          className="video-url"
          value={plainUrl(block.text)}
          placeholder="Ссылка YouTube, RuTube или Vimeo"
          onChange={(event) => onPatch({ text: event.target.value })}
        />
      )}
    </figure>
  );
}

function toggleTag(tag: "strong" | "em" | "u", commit: () => void) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const origin = range.commonAncestorContainer;
  const parent = (origin.nodeType === Node.ELEMENT_NODE ? origin as HTMLElement : origin.parentElement)?.closest(tag);
  if (parent) {
    const frag = document.createDocumentFragment();
    while (parent.firstChild) frag.appendChild(parent.firstChild);
    parent.replaceWith(frag);
  } else {
    const el = document.createElement(tag);
    try {
      range.surroundContents(el);
    } catch {
      el.appendChild(range.extractContents());
      range.insertNode(el);
    }
  }
  sel.removeAllRanges();
  commit();
}

function paint(kind: "ink" | "wash", tone: string, commit: () => void) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const el = document.createElement(kind === "ink" ? "span" : "mark");
  el.className = kind === "ink" ? `ink ink-${tone}` : `wash wash-${tone}`;
  try {
    range.surroundContents(el);
  } catch {
    el.appendChild(range.extractContents());
    range.insertNode(el);
  }
  sel.removeAllRanges();
  commit();
}

function hasHandoutContent(block: Block) {
  const plain = block.text.replace(/<[^>]+>/g, "").trim();
  if (block.kind === "image") return Boolean(block.src?.trim() || plain);
  if (block.kind === "video") return Boolean(embedVideo(block.text));
  return Boolean(plain);
}

function looksRich(value: string) {
  return /<\/?(strong|em|u|mark|span|br)\b/i.test(value);
}

function escapeText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

function plainUrl(value: string) {
  return value.replace(/<[^>]+>/g, "").trim();
}

export function sanitizeRich(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  const out = document.createElement("div");
  const walk = (node: Node, parent: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(document.createTextNode(node.textContent || ""));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName;
    let next: HTMLElement | null = null;
    if (tag === "B" || tag === "STRONG") next = document.createElement("strong");
    else if (tag === "I" || tag === "EM") next = document.createElement("em");
    else if (tag === "U") next = document.createElement("u");
    else if (tag === "BR") {
      parent.appendChild(document.createElement("br"));
      return;
    } else if (tag === "MARK") {
      const tone = el.className.match(/wash-(amber|blue|green|rose)/)?.[1];
      next = document.createElement("mark");
      if (tone) next.className = `wash wash-${tone}`;
    } else if (tag === "SPAN") {
      const tone = el.className.match(/ink-(amber|blue|green|rose)/)?.[1];
      if (tone) {
        next = document.createElement("span");
        next.className = `ink ink-${tone}`;
      }
    }
    const target = next ?? parent;
    if (next) parent.appendChild(next);
    for (const child of [...el.childNodes]) walk(child, target);
  };
  for (const child of [...root.childNodes]) walk(child, out);
  return out.innerHTML.replace(/^(<br>)+|(<br>)+$/g, "");
}

async function fileToImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const max = 1400;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

function embedVideo(raw: string) {
  try {
    const u = new URL(plainUrl(raw));
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be" && u.pathname.length > 1) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (host.endsWith("youtube.com")) {
      const id = u.searchParams.get("v") || u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host.endsWith("rutube.ru")) {
      const id = u.pathname.match(/\/(?:video|shorts|embed)\/([^/]+)/)?.[1];
      if (id) return `https://rutube.ru/play/embed/${id}`;
    }
    if (host.endsWith("vimeo.com")) {
      const id = u.pathname.match(/\/([0-9]+)/)?.[1];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {}
  return "";
}

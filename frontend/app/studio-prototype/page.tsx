"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Copy,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import styles from "./studio-prototype.module.css";

type Mode = "edit" | "preview";
type Span = "full" | "twoThird" | "half" | "third";
type BlockType =
  | "heading"
  | "text"
  | "data"
  | "comparison"
  | "timeline"
  | "image"
  | "video"
  | "source"
  | "callout";

type ChartPoint = {
  label: string;
  rts?: number;
  si?: number;
  cny?: number;
};

type StudioBlock = {
  id: string;
  type: BlockType;
  span: Span;
  visible: boolean;
  section: string;
  content: {
    title?: string;
    body?: string;
    caption?: string;
    points?: ChartPoint[];
  };
};

const STORAGE_KEY = "tqs-studio-prototype-si-v1";

const DEFAULT_BLOCKS: StudioBlock[] = [
  {
    id: "si-title",
    type: "heading",
    span: "full",
    visible: true,
    section: "Основной материал",
    content: {
      title: "Si — доллар/рубль: история ликвидности и объёмов",
      body: "Как менялось лидерство срочного рынка и почему структура ликвидности важнее одной красивой цифры.",
    },
  },
  {
    id: "si-before-2014",
    type: "text",
    span: "twoThird",
    visible: true,
    section: "Основной материал",
    content: {
      title: "До 2014 — RTS был лидером",
      body: "До валютного сдвига основной фокус активного спекулятивного потока был заметно сильнее связан с индексным фьючерсом RTS. Si постепенно набирал вес, но ещё не определял ритм всего срочного рынка.",
    },
  },
  {
    id: "si-author-note",
    type: "callout",
    span: "third",
    visible: true,
    section: "Основной материал",
    content: {
      title: "Что смотреть",
      body: "Не только абсолютный объём. Важно, где появляется устойчивый поток: цена, число сделок, открытый интерес и реакция на стресс.",
    },
  },
  {
    id: "si-shift-2014",
    type: "data",
    span: "half",
    visible: true,
    section: "Данные",
    content: {
      title: "2014: смена лидерства RTS → Si",
      caption: "Prototype control points · индекс относительной активности, 2014 Si = 100",
      points: [
        { label: "2012", rts: 100, si: 58 },
        { label: "2014", rts: 82, si: 100 },
        { label: "2022", rts: 36, si: 148 },
        { label: "2024", rts: 31, si: 134 },
      ],
    },
  },
  {
    id: "si-compare",
    type: "comparison",
    span: "half",
    visible: true,
    section: "Данные",
    content: {
      title: "Si / RTS / CNY",
      caption: "Prototype control points · нормализованный индекс активности",
      points: [
        { label: "2014", rts: 82, si: 100, cny: 14 },
        { label: "2022", rts: 36, si: 148, cny: 71 },
        { label: "2024", rts: 31, si: 134, cny: 112 },
      ],
    },
  },
  {
    id: "si-timeline",
    type: "timeline",
    span: "full",
    visible: true,
    section: "История",
    content: {
      title: "Три точки перелома",
      body: "2014 — валютная волатильность выводит Si в центр внимания. · 2022 — структура валютного рынка резко меняется. · 2024 — CNY становится обязательной частью сравнения ликвидности.",
    },
  },
  {
    id: "si-screenshot",
    type: "image",
    span: "twoThird",
    visible: true,
    section: "Источники",
    content: {
      title: "Скриншот терминала: профиль объёма",
      caption: "Demo media block · в production здесь будет исходный screenshot/asset с provenance.",
    },
  },
  {
    id: "si-video",
    type: "video",
    span: "third",
    visible: true,
    section: "Источники",
    content: {
      title: "Фрагмент разбора",
      caption: "Demo embed · 03:18",
    },
  },
  {
    id: "si-source",
    type: "source",
    span: "half",
    visible: true,
    section: "Источники",
    content: {
      title: "Источники и provenance",
      body: "MOEX futures history · TQS research notes · owner screenshots. В прототипе это только UX-представление, без ingestion backend.",
    },
  },
  {
    id: "si-conclusion",
    type: "callout",
    span: "half",
    visible: true,
    section: "Вывод",
    content: {
      title: "Авторский вывод",
      body: "Лидерство инструмента меняется не в один день. Для практики важен переход устойчивого внимания и ликвидности между рынками — именно его надо видеть на одном полотне.",
    },
  },
];

const spanLabels: Record<Span, string> = {
  full: "Full",
  twoThird: "2/3",
  half: "1/2",
  third: "1/3",
};

const typeLabels: Record<BlockType, string> = {
  heading: "Heading",
  text: "Text",
  data: "Data demo",
  comparison: "Comparison",
  timeline: "Timeline",
  image: "Image",
  video: "Video",
  source: "Source",
  callout: "Callout",
};

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_BLOCKS)) as StudioBlock[];
}

function newId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}`;
}

function EditableText({
  value,
  onChange,
  className,
  rows = 2,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  className: string;
  rows?: number;
  label: string;
}) {
  return (
    <textarea
      aria-label={label}
      className={className}
      value={value}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
      onInput={(event) => {
        const node = event.currentTarget;
        node.style.height = "auto";
        node.style.height = `${node.scrollHeight}px`;
      }}
    />
  );
}

function MiniBars({ points }: { points: ChartPoint[] }) {
  const max = Math.max(
    1,
    ...points.flatMap((point) => [point.rts ?? 0, point.si ?? 0, point.cny ?? 0]),
  );

  return (
    <div className={styles.chart} data-testid="demo-chart">
      <div className={styles.chartLegend}>
        <span><i className={styles.legendDark} />RTS</span>
        <span><i className={styles.legendMid} />Si</span>
        {points.some((point) => point.cny !== undefined) ? (
          <span><i className={styles.legendLight} />CNY</span>
        ) : null}
      </div>
      {points.map((point) => (
        <div className={styles.chartRow} key={point.label}>
          <div className={styles.chartYear}>{point.label}</div>
          <div className={styles.chartBars}>
            {point.rts !== undefined ? (
              <div className={styles.barLine}>
                <div className={styles.barDark} style={{ width: `${(point.rts / max) * 100}%` }} />
                <span>{point.rts}</span>
              </div>
            ) : null}
            {point.si !== undefined ? (
              <div className={styles.barLine}>
                <div className={styles.barMid} style={{ width: `${(point.si / max) * 100}%` }} />
                <span>{point.si}</span>
              </div>
            ) : null}
            {point.cny !== undefined ? (
              <div className={styles.barLine}>
                <div className={styles.barLight} style={{ width: `${(point.cny / max) * 100}%` }} />
                <span>{point.cny}</span>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function MediaSketch() {
  return (
    <div className={styles.mediaSketch} aria-label="Demo screenshot placeholder">
      <div className={styles.mediaTopline}>
        <span>Si · 5m</span>
        <span>объём / профиль</span>
      </div>
      <div className={styles.mediaBody}>
        <div className={styles.fakeChart}>
          {[42, 58, 36, 72, 64, 82, 54, 88, 68, 94, 76, 61].map((height, index) => (
            <span key={index} style={{ height: `${height}%` }} />
          ))}
        </div>
        <div className={styles.fakeProfile}>
          {[72, 48, 88, 56, 42, 76, 62, 34].map((width, index) => (
            <span key={index} style={{ width: `${width}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StudioPrototypePage() {
  const [mode, setMode] = useState<Mode>("edit");
  const [blocks, setBlocks] = useState<StudioBlock[]>(cloneDefaults);
  const [selectedId, setSelectedId] = useState<string | null>("si-before-2014");
  const [draggedId, setDraggedId] = useState<string | null>(null);\n  const draggedIdRef = useRef<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StudioBlock[];
        if (Array.isArray(parsed) && parsed.length > 0) setBlocks(parsed);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
  }, [blocks, hydrated]);

  const selected = useMemo(
    () => blocks.find((block) => block.id === selectedId) ?? null,
    [blocks, selectedId],
  );

  const visibleBlocks = mode === "preview" ? blocks.filter((block) => block.visible) : blocks;

  const updateBlock = (id: string, patch: Partial<StudioBlock>) => {
    setBlocks((current) =>
      current.map((block) => (block.id === id ? { ...block, ...patch } : block)),
    );
  };

  const updateContent = (id: string, patch: Partial<StudioBlock["content"]>) => {
    setBlocks((current) =>
      current.map((block) =>
        block.id === id ? { ...block, content: { ...block.content, ...patch } } : block,
      ),
    );
  };

  const addBlock = (type: "text" | "callout" | "image" | "data") => {
    const id = newId(type);
    const presets: Record<typeof type, StudioBlock> = {
      text: {
        id,
        type: "text",
        span: "full",
        visible: true,
        section: "Новый блок",
        content: {
          title: "Новый текстовый блок",
          body: "Нажмите сюда и отредактируйте текст прямо в документе.",
        },
      },
      callout: {
        id,
        type: "callout",
        span: "half",
        visible: true,
        section: "Новый блок",
        content: {
          title: "Новый вывод",
          body: "Короткая авторская мысль или вывод.",
        },
      },
      image: {
        id,
        type: "image",
        span: "half",
        visible: true,
        section: "Новый блок",
        content: {
          title: "Новый image placeholder",
          caption: "Prototype media block",
        },
      },
      data: {
        id,
        type: "data",
        span: "half",
        visible: true,
        section: "Новый блок",
        content: {
          title: "Новый data demo",
          caption: "Prototype control points",
          points: [
            { label: "2022", si: 100, rts: 34 },
            { label: "2023", si: 118, rts: 38 },
            { label: "2024", si: 126, rts: 31 },
          ],
        },
      },
    };
    setBlocks((current) => [...current, presets[type]]);
    setSelectedId(id);
    setAddOpen(false);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy: StudioBlock = {
      ...selected,
      id: newId(selected.type),
      content: { ...selected.content },
    };
    const index = blocks.findIndex((block) => block.id === selected.id);
    setBlocks((current) => {
      const next = [...current];
      next.splice(index + 1, 0, copy);
      return next;
    });
    setSelectedId(copy.id);
  };

  const deleteSelected = () => {
    if (!selected) return;
    setBlocks((current) => current.filter((block) => block.id !== selected.id));
    setSelectedId(null);
  };

  const resetDemo = () => {
    const next = cloneDefaults();
    setBlocks(next);
    setSelectedId("si-before-2014");
    setMode("edit");
    setAddOpen(false);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const moveBlock = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    setBlocks((current) => {
      const next = [...current];
      const from = next.findIndex((block) => block.id === activeDraggedId);
      if (from < 0) return current;
      const [moved] = next.splice(from, 1);
      const target = next.findIndex((block) => block.id === targetId);
      next.splice(Math.max(target, 0), 0, moved);
      return next;
    });
    setSelectedId(draggedId);
    setDraggedId(null);
  };

  const renderBlockContent = (block: StudioBlock) => {
    const editing = mode === "edit";

    if (block.type === "heading") {
      return (
        <div className={styles.headingBlock}>
          {editing ? (
            <>
              <EditableText
                label="Заголовок"
                value={block.content.title ?? ""}
                onChange={(value) => updateContent(block.id, { title: value })}
                className={styles.headingInput}
                rows={2}
              />
              <EditableText
                label="Лид"
                value={block.content.body ?? ""}
                onChange={(value) => updateContent(block.id, { body: value })}
                className={styles.leadInput}
                rows={2}
              />
            </>
          ) : (
            <>
              <h1>{block.content.title}</h1>
              <p>{block.content.body}</p>
            </>
          )}
        </div>
      );
    }

    if (block.type === "text") {
      return (
        <div className={styles.textBlock}>
          {editing ? (
            <>
              <EditableText
                label="Заголовок текста"
                value={block.content.title ?? ""}
                onChange={(value) => updateContent(block.id, { title: value })}
                className={styles.blockTitleInput}
                rows={1}
              />
              <EditableText
                label="Текст блока"
                value={block.content.body ?? ""}
                onChange={(value) => updateContent(block.id, { body: value })}
                className={styles.bodyInput}
                rows={5}
              />
            </>
          ) : (
            <>
              <h2>{block.content.title}</h2>
              <p>{block.content.body}</p>
            </>
          )}
        </div>
      );
    }

    if (block.type === "callout") {
      return (
        <div className={styles.calloutBlock}>
          {editing ? (
            <>
              <EditableText
                label="Заголовок вывода"
                value={block.content.title ?? ""}
                onChange={(value) => updateContent(block.id, { title: value })}
                className={styles.calloutTitleInput}
                rows={1}
              />
              <EditableText
                label="Текст вывода"
                value={block.content.body ?? ""}
                onChange={(value) => updateContent(block.id, { body: value })}
                className={styles.calloutBodyInput}
                rows={4}
              />
            </>
          ) : (
            <>
              <div className={styles.eyebrow}>Вывод</div>
              <h3>{block.content.title}</h3>
              <p>{block.content.body}</p>
            </>
          )}
        </div>
      );
    }

    if (block.type === "data" || block.type === "comparison") {
      return (
        <figure className={styles.dataBlock}>
          <figcaption>
            <strong>{block.content.title}</strong>
            <span>{block.content.caption}</span>
          </figcaption>
          <MiniBars points={block.content.points ?? []} />
        </figure>
      );
    }

    if (block.type === "timeline") {
      const chunks = (block.content.body ?? "").split(" · ");
      return (
        <section className={styles.timelineBlock}>
          <h2>{block.content.title}</h2>
          <div className={styles.timeline}>
            {chunks.map((chunk) => {
              const [year, ...rest] = chunk.split(" — ");
              return (
                <div className={styles.timelineItem} key={chunk}>
                  <span>{year}</span>
                  <p>{rest.join(" — ")}</p>
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    if (block.type === "image") {
      return (
        <figure className={styles.imageBlock}>
          <MediaSketch />
          <figcaption>
            <strong>{block.content.title}</strong>
            <span>{block.content.caption}</span>
          </figcaption>
        </figure>
      );
    }

    if (block.type === "video") {
      return (
        <figure className={styles.videoBlock}>
          <div className={styles.videoStage}>
            <div className={styles.playButton}>▶</div>
            <div className={styles.videoTime}>03:18</div>
          </div>
          <figcaption>
            <strong>{block.content.title}</strong>
            <span>{block.content.caption}</span>
          </figcaption>
        </figure>
      );
    }

    return (
      <section className={styles.sourceBlock}>
        <div className={styles.sourceIcon}><FileText size={18} /></div>
        <div>
          <div className={styles.eyebrow}>Source / reference</div>
          <h3>{block.content.title}</h3>
          <p>{block.content.body}</p>
        </div>
      </section>
    );
  };

  return (
    <main className={styles.page} data-mode={mode}>
      <header className={styles.topbar}>
        <div>
          <div className={styles.productMark}>TQS Studio · Prototype</div>
          <div className={styles.documentName}>Si — доллар/рубль</div>
        </div>
        <div className={styles.topActions}>
          <div className={styles.modeSwitch} aria-label="Режим">
            <button
              type="button"
              className={mode === "edit" ? styles.activeMode : ""}
              onClick={() => setMode("edit")}
              data-testid="mode-edit"
            >
              Edit
            </button>
            <button
              type="button"
              className={mode === "preview" ? styles.activeMode : ""}
              onClick={() => {
                setMode("preview");
                setSelectedId(null);
                setAddOpen(false);
              }}
              data-testid="mode-preview"
            >
              Preview
            </button>
          </div>
          <button type="button" className={styles.resetButton} onClick={resetDemo} data-testid="reset-demo">
            <RotateCcw size={14} />
            Reset demo
          </button>
        </div>
      </header>

      <div className={mode === "edit" && selected ? styles.workspaceWithInspector : styles.workspace}>
        <article className={styles.document} aria-label="TQS Studio Si prototype document">
          {mode === "edit" ? (
            <div className={styles.addRow}>
              <div className={styles.addWrap}>
                <button
                  type="button"
                  className={styles.addButton}
                  onClick={() => setAddOpen((value) => !value)}
                  data-testid="add-block"
                >
                  <Plus size={15} />
                  Добавить блок
                </button>
                {addOpen ? (
                  <div className={styles.addMenu} data-testid="add-menu">
                    <button type="button" onClick={() => addBlock("text")}><FileText size={15} />Text</button>
                    <button type="button" onClick={() => addBlock("callout")}><Eye size={15} />Callout</button>
                    <button type="button" onClick={() => addBlock("image")}><ImageIcon size={15} />Image placeholder</button>
                    <button type="button" onClick={() => addBlock("data")}><BarChart3 size={15} />Data demo</button>
                  </div>
                ) : null}
              </div>
              <span className={styles.persistNote}>
                {hydrated ? "Состояние сохраняется в этом браузере" : "Загрузка demo state…"}
              </span>
            </div>
          ) : null}

          <div className={styles.blockGrid} data-testid="block-grid">
            {visibleBlocks.map((block) => {
              const selectedBlock = mode === "edit" && selectedId === block.id;
              return (
                <section
                  key={block.id}
                  className={[
                    styles.blockShell,
                    selectedBlock ? styles.blockSelected : "",
                    mode === "preview" ? styles.blockPreview : "",
                  ].filter(Boolean).join(" ")}
                  style={{ "--block-span": block.span === "full" ? 12 : block.span === "twoThird" ? 8 : block.span === "half" ? 6 : 4 } as React.CSSProperties}
                  onClick={() => mode === "edit" && setSelectedId(block.id)}
                  onDragOver={(event) => {
                    if (mode === "edit" && draggedId) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    moveBlock(block.id);
                  }}
                  data-block-id={block.id}
                  data-block-type={block.type}
                  data-span={block.span}
                  data-visible={block.visible ? "true" : "false"}
                >
                  {mode === "edit" ? (
                    <div className={styles.blockControls}>
                      <button
                        type="button"
                        className={styles.dragHandle}
                        draggable
                        aria-label={`Перетащить блок ${block.content.title ?? block.type}`}
                        onDragStart={(event) => {
                          setDraggedId(block.id);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", block.id);
                        }}
                        onDragEnd={() => {\n                          draggedIdRef.current = null;\n                          setDraggedId(null);\n                        }}
                        data-testid={`drag-${block.id}`}
                      >
                        <GripVertical size={16} />
                      </button>
                      {!block.visible ? (
                        <span className={styles.hiddenBadge}><EyeOff size={12} /> hidden</span>
                      ) : null}
                    </div>
                  ) : null}
                  {renderBlockContent(block)}
                </section>
              );
            })}
          </div>
        </article>

        {mode === "edit" && selected ? (
          <aside className={styles.inspector} data-testid="inspector">
            <div className={styles.inspectorHeader}>
              <div>
                <div className={styles.eyebrow}>Inspector</div>
                <strong>{selected.content.title || typeLabels[selected.type]}</strong>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} aria-label="Закрыть Inspector">×</button>
            </div>

            <div className={styles.field}>
              <span>Type</span>
              <div className={styles.readonlyValue}>{typeLabels[selected.type]}</div>
            </div>

            <div className={styles.field}>
              <span>Width</span>
              <div className={styles.spanChoices}>
                {(Object.keys(spanLabels) as Span[]).map((span) => (
                  <button
                    type="button"
                    key={span}
                    className={selected.span === span ? styles.spanActive : ""}
                    onClick={() => updateBlock(selected.id, { span })}
                    data-testid={`span-${span}`}
                  >
                    {spanLabels[span]}
                  </button>
                ))}
              </div>
            </div>

            <label className={styles.visibilityToggle}>
              <div>
                <span>Visible in Preview</span>
                <small>Скрытые блоки остаются в Edit</small>
              </div>
              <input
                type="checkbox"
                checked={selected.visible}
                onChange={(event) => updateBlock(selected.id, { visible: event.target.checked })}
                data-testid="visible-toggle"
              />
            </label>

            <div className={styles.field}>
              <span>Section</span>
              <div className={styles.readonlyValue}>{selected.section}</div>
            </div>

            <div className={styles.inspectorActions}>
              <button type="button" onClick={duplicateSelected} data-testid="duplicate-block">
                <Copy size={14} /> Duplicate
              </button>
              <button type="button" onClick={deleteSelected} data-testid="delete-block">
                <Trash2 size={14} /> Delete
              </button>
            </div>

            <div className={styles.blockId}>
              <span>block_id</span>
              <code>{selected.id}</code>
            </div>
          </aside>
        ) : null}
      </div>
    </main>
  );
}

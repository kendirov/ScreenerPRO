"use client";

import { useEditor as useTiptapEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as echarts from "echarts";
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  TLShape,
  TLShapeId,
  Tldraw,
  createShapeId,
  track,
  useEditor,
} from "tldraw";
import {
  BarChart3,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Lock,
  Maximize2,
  Play,
  RotateCcw,
  Search,
  Trash2,
  Type,
  Unlock,
  Video,
} from "lucide-react";
import {
  createContext,
  CSSProperties,
  DragEvent,
  MouseEvent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./studio-spatial.module.css";

const SHAPE_TYPE = "tqs-studio-block" as const;
const STORAGE_KEY = "tqs-studio-spatial-v2";
const PDF_BASE64 = "PDFBASE64PLACEHOLDER";

type BlockKind = "text" | "chart" | "image" | "video" | "pdf" | "callout";
type AppMode = "edit" | "preview" | "present";

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    [SHAPE_TYPE]: {
      w: number;
      h: number;
      kind: string;
      title: string;
      body: string;
      config: string;
      hidden: boolean;
    };
  }
}

type StudioShape = TLShape<typeof SHAPE_TYPE>;

type RuntimeValue = {
  interactId: TLShapeId | null;
  setInteractId: (id: TLShapeId | null) => void;
};

const RuntimeContext = createContext<RuntimeValue>({
  interactId: null,
  setInteractId: () => undefined,
});

let enterInteraction: ((id: TLShapeId) => void) | null = null;

const chartData = {
  short: [
    ["2021", 76, 54],
    ["2022", 148, 36],
    ["2023", 139, 34],
    ["2024", 134, 31],
  ],
  long: [
    ["2012", 58, 100],
    ["2014", 100, 82],
    ["2017", 116, 62],
    ["2020", 108, 48],
    ["2022", 148, 36],
    ["2024", 134, 31],
  ],
} as const;

function parseConfig(shape: StudioShape) {
  try {
    return JSON.parse(shape.props.config || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function updateConfig(editor: ReturnType<typeof useEditor>, shape: StudioShape, patch: Record<string, unknown>) {
  const next = { ...parseConfig(shape), ...patch };
  editor.updateShape<StudioShape>({
    id: shape.id,
    type: SHAPE_TYPE,
    props: { config: JSON.stringify(next) },
  });
}

function RichTextBlock({ shape, active }: { shape: StudioShape; active: boolean }) {
  const editor = useEditor();
  const tiptap = useTiptapEditor({
    extensions: [StarterKit],
    content: shape.props.body,
    editable: active,
    immediatelyRender: false,
    onUpdate: ({ editor: textEditor }) => {
      editor.updateShape<StudioShape>({
        id: shape.id,
        type: SHAPE_TYPE,
        props: { body: textEditor.getHTML() },
      });
    },
  });

  useEffect(() => {
    if (!tiptap) return;
    tiptap.setEditable(active);
  }, [active, tiptap]);

  useEffect(() => {
    if (!tiptap || tiptap.getHTML() === shape.props.body) return;
    tiptap.commands.setContent(shape.props.body, { emitUpdate: false });
  }, [shape.props.body, tiptap]);

  return (
    <div className={styles.richTextBlock} data-testid="rich-text-block">
      {active && tiptap ? (
        <div className={styles.textToolbar} data-testid="text-toolbar">
          <button type="button" onClick={() => tiptap.chain().focus().toggleBold().run()} data-testid="format-bold">
            B
          </button>
          <button type="button" onClick={() => tiptap.chain().focus().toggleItalic().run()} data-testid="format-italic">
            I
          </button>
          <button type="button" onClick={() => tiptap.chain().focus().toggleHeading({ level: 2 }).run()} data-testid="format-heading">
            H2
          </button>
          <button type="button" onClick={() => tiptap.chain().focus().toggleBulletList().run()} data-testid="format-list">
            • list
          </button>
        </div>
      ) : null}
      <EditorContent editor={tiptap} className={styles.editorContent} />
    </div>
  );
}

function ChartBlock({ shape, active }: { shape: StudioShape; active: boolean }) {
  const editor = useEditor();
  const chartRef = useRef<HTMLDivElement>(null);
  const config = parseConfig(shape);
  const period = config.period === "short" ? "short" : "long";
  const showRts = config.showRts !== false;

  useEffect(() => {
    if (!chartRef.current) return;
    const instance = echarts.init(chartRef.current, undefined, { renderer: "canvas" });
    const source = chartData[period];
    instance.setOption({
      animation: false,
      grid: { top: 28, right: 18, bottom: 30, left: 42 },
      tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
      legend: { top: 0, left: 0, textStyle: { color: "#666", fontSize: 10 } },
      xAxis: {
        type: "category",
        data: source.map((row) => row[0]),
        axisLine: { lineStyle: { color: "#bcbcbc" } },
        axisLabel: { color: "#747474", fontSize: 10 },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#747474", fontSize: 9 },
        splitLine: { lineStyle: { color: "#eeeeeb" } },
      },
      series: [
        {
          name: "Si",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: source.map((row) => row[1]),
          lineStyle: { width: 2, color: "#171717" },
          itemStyle: { color: "#171717" },
        },
        ...(showRts
          ? [{
              name: "RTS",
              type: "line",
              smooth: true,
              showSymbol: false,
              data: source.map((row) => row[2]),
              lineStyle: { width: 1.5, color: "#90908a" },
              itemStyle: { color: "#90908a" },
            }]
          : []),
      ],
    });
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(chartRef.current);
    return () => {
      observer.disconnect();
      instance.dispose();
    };
  }, [period, showRts]);

  return (
    <div className={styles.chartBlock} data-testid="market-chart">
      <div className={styles.blockHeading}>
        <div>
          <span className={styles.kicker}>Market data · control points</span>
          <strong>{shape.props.title}</strong>
        </div>
        {active ? (
          <div className={styles.localControls} data-testid="chart-controls">
            <button
              type="button"
              className={period === "short" ? styles.activeControl : ""}
              onClick={() => updateConfig(editor, shape, { period: "short" })}
              data-testid="chart-period-short"
            >
              2021–24
            </button>
            <button
              type="button"
              className={period === "long" ? styles.activeControl : ""}
              onClick={() => updateConfig(editor, shape, { period: "long" })}
              data-testid="chart-period-long"
            >
              2012–24
            </button>
            <button
              type="button"
              className={showRts ? styles.activeControl : ""}
              onClick={() => updateConfig(editor, shape, { showRts: !showRts })}
              data-testid="chart-series-rts"
            >
              RTS
            </button>
          </div>
        ) : null}
      </div>
      <div ref={chartRef} className={styles.echart} data-testid="chart-surface" />
      <p className={styles.caption}>Hover for tooltip/crosshair · double-click block to interact</p>
    </div>
  );
}

function ImageBlock({ shape }: { shape: StudioShape }) {
  return (
    <figure className={styles.imageBlock} data-testid="image-block">
      <svg viewBox="0 0 640 360" role="img" aria-label="Si terminal screenshot study">
        <rect width="640" height="360" fill="#f4f4f1" />
        <rect x="18" y="18" width="604" height="324" rx="6" fill="#111" />
        <path d="M42 248 C 92 236, 112 265, 164 220 S 250 160, 302 186 S 392 126, 448 146 S 528 86, 596 102" fill="none" stroke="#efefef" strokeWidth="3" />
        {[72, 118, 164, 210, 256, 302, 348, 394, 440, 486, 532, 578].map((x, i) => (
          <rect key={x} x={x} y={282 - (i % 5) * 13} width="18" height={38 + (i % 5) * 13} fill={i % 2 ? "#8d8d87" : "#d7d7d2"} />
        ))}
        <text x="42" y="54" fill="#f1f1ed" fontSize="16">Si · 5m · volume / price</text>
        <text x="42" y="79" fill="#8f8f89" fontSize="11">terminal research capture · prototype asset</text>
      </svg>
      <figcaption>{shape.props.title}</figcaption>
    </figure>
  );
}

function VideoBlock({ shape, active }: { shape: StudioShape; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const seek = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = seconds;
    void videoRef.current.play();
  };
  return (
    <div className={styles.videoBlock} data-testid="video-block">
      <div className={styles.blockHeading}>
        <div>
          <span className={styles.kicker}>Video note</span>
          <strong>{shape.props.title}</strong>
        </div>
      </div>
      <video
        ref={videoRef}
        controls={active}
        muted
        preload="metadata"
        src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
        data-testid="video-player"
      />
      <div className={styles.transcript} data-testid="video-transcript">
        <button type="button" disabled={!active} onClick={() => seek(0)} data-testid="transcript-0">
          <span>00:00</span> Почему Si стал центром валютной ликвидности
        </button>
        <button type="button" disabled={!active} onClick={() => seek(2)} data-testid="transcript-2">
          <span>00:02</span> Смена структуры после 2022 года
        </button>
        <button type="button" disabled={!active} onClick={() => seek(4)} data-testid="transcript-4">
          <span>00:04</span> Что сравнивать с CNY
        </button>
      </div>
    </div>
  );
}

function PdfBlock({ shape, active }: { shape: StudioShape; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(2);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const raw = Uint8Array.from(atob(PDF_BASE64), (ch) => ch.charCodeAt(0));
      const pdf = await pdfjs.getDocument({ data: raw }).promise;
      if (cancelled) return;
      setPages(pdf.numPages);
      const pdfPage = await pdf.getPage(page);
      const viewport = pdfPage.getViewport({ scale: 1.15 });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await pdfPage.render({ canvas, canvasContext: context, viewport }).promise;
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <div className={styles.pdfBlock} data-testid="pdf-block">
      <div className={styles.blockHeading}>
        <div>
          <span className={styles.kicker}>PDF research memo</span>
          <strong>{shape.props.title}</strong>
        </div>
        <span className={styles.pageCount}>page {page} / {pages}</span>
      </div>
      <div className={styles.pdfViewport}>
        <canvas ref={canvasRef} />
      </div>
      {active ? (
        <div className={styles.pdfControls} data-testid="pdf-controls">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} data-testid="pdf-prev">
            Previous
          </button>
          <button type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages} data-testid="pdf-next">
            Next page
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CalloutBlock({ shape }: { shape: StudioShape }) {
  return (
    <div className={styles.calloutBlock} data-testid="callout-block">
      <span className={styles.kicker}>Owner note</span>
      <strong>{shape.props.title}</strong>
      <p>{shape.props.body}</p>
    </div>
  );
}

const StudioShapeRenderer = track(function StudioShapeRenderer({ shape }: { shape: StudioShape }) {
  const editor = useEditor();
  const runtime = useContext(RuntimeContext);
  const active = runtime.interactId === shape.id;
  const selected = editor.getSelectedShapeIds().includes(shape.id);

  const duplicate = (event: MouseEvent) => {
    event.stopPropagation();
    editor.duplicateShapes([shape.id], { x: 28, y: 28 });
  };
  const remove = (event: MouseEvent) => {
    event.stopPropagation();
    editor.deleteShapes([shape.id]);
    runtime.setInteractId(null);
  };
  const toggleHidden = (event: MouseEvent) => {
    event.stopPropagation();
    editor.updateShape<StudioShape>({
      id: shape.id,
      type: SHAPE_TYPE,
      props: { hidden: !shape.props.hidden },
    });
  };
  const toggleLock = (event: MouseEvent) => {
    event.stopPropagation();
    editor.updateShape({ id: shape.id, type: SHAPE_TYPE, isLocked: !shape.isLocked });
  };

  let body: ReactNode = null;
  if (shape.props.kind === "text") body = <RichTextBlock shape={shape} active={active} />;
  if (shape.props.kind === "chart") body = <ChartBlock shape={shape} active={active} />;
  if (shape.props.kind === "image") body = <ImageBlock shape={shape} />;
  if (shape.props.kind === "video") body = <VideoBlock shape={shape} active={active} />;
  if (shape.props.kind === "pdf") body = <PdfBlock shape={shape} active={active} />;
  if (shape.props.kind === "callout") body = <CalloutBlock shape={shape} />;

  return (
    <HTMLContainer
      id={shape.id}
      className={[
        styles.shapeContainer,
        active ? styles.interacting : "",
        shape.props.hidden ? styles.hiddenShape : "",
      ].join(" ")}
      style={{ overflow: "visible" }}
    >
      {selected && !active ? (
        <div className={styles.floatingToolbar} data-testid="floating-toolbar">
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={duplicate} aria-label="Duplicate">
            <Copy size={14} />
          </button>
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={toggleHidden} aria-label="Hide or show">
            {shape.props.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={toggleLock} aria-label="Lock or unlock">
            {shape.isLocked ? <Unlock size={14} /> : <Lock size={14} />}
          </button>
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={remove} aria-label="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      ) : null}
      {active ? <div className={styles.interactBadge}>INTERACT · Esc to move</div> : null}
      <div
        className={styles.shapeBody}
        style={{ pointerEvents: active ? "auto" : "none" }}
        data-testid={"block-" + shape.props.kind}
      >
        {body}
      </div>
    </HTMLContainer>
  );
});

class StudioShapeUtil extends BaseBoxShapeUtil<StudioShape> {
  static override type = SHAPE_TYPE;
  static override props = {
    w: T.number,
    h: T.number,
    kind: T.string,
    title: T.string,
    body: T.string,
    config: T.string,
    hidden: T.boolean,
  };

  override getDefaultProps(): StudioShape["props"] {
    return {
      w: 420,
      h: 260,
      kind: "text",
      title: "New block",
      body: "<p>Double-click to interact.</p>",
      config: "{}",
      hidden: false,
    };
  }

  override canEdit() {
    return false;
  }

  override canResize() {
    return true;
  }

  override canSnap() {
    return true;
  }

  override onDoubleClick(shape: StudioShape) {
    enterInteraction?.(shape.id);
  }

  override component(shape: StudioShape) {
    return <StudioShapeRenderer shape={shape} />;
  }

  override getIndicatorPath(shape: StudioShape) {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }
}

const shapeUtils = [StudioShapeUtil];

function studioShape(
  id: string,
  kind: BlockKind,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  body = "",
  parentId?: TLShapeId,
) {
  return {
    id: createShapeId(id),
    type: SHAPE_TYPE,
    x,
    y,
    parentId,
    props: {
      w,
      h,
      kind,
      title,
      body,
      config: kind === "chart" ? JSON.stringify({ period: "long", showRts: true }) : "{}",
      hidden: false,
    },
  } as const;
}

function createCanonicalBoard(editor: ReturnType<typeof useEditor>) {
  const frame1 = createShapeId("frame-article");
  const frame2 = createShapeId("frame-slide");
  editor.createShape({
    id: frame1,
    type: "frame",
    x: 140,
    y: 120,
    props: { w: 1120, h: 780, name: "01 · Article section / Research" },
  });
  editor.createShape({
    id: frame2,
    type: "frame",
    x: 1380,
    y: 120,
    props: { w: 1120, h: 780, name: "02 · Slide / Lesson scene" },
  });
  editor.createShapes([
    studioShape(
      "lead",
      "text",
      42,
      72,
      500,
      250,
      "Si — доллар/рубль",
      "<h2>Si — история ликвидности и объёмов</h2><p>Свободная исследовательская композиция: текст, данные и источники живут на одной доске.</p>",
      frame1,
    ),
    studioShape("chart-main", "chart", 580, 72, 490, 360, "2014 → 2024: Si vs RTS", "", frame1),
    studioShape(
      "owner-note",
      "callout",
      42,
      370,
      500,
      190,
      "Смотреть не только объём",
      "Важно видеть устойчивый поток: цену, число сделок, OI и реакцию на стресс.",
      frame1,
    ),
    studioShape("image-terminal", "image", 42, 84, 500, 315, "Терминал: профиль Si", "", frame2),
    studioShape("video-note", "video", 580, 84, 480, 420, "Фрагмент разбора Si", "", frame2),
    studioShape("pdf-memo", "pdf", 42, 455, 500, 260, "Research memo · Si", "", frame2),
    studioShape(
      "scratch-note",
      "callout",
      2620,
      220,
      430,
      190,
      "Scratch / private",
      "Этот объект вне Frames демонстрирует приватную исследовательскую область.",
    ),
  ]);
  editor.zoomToFit({ animation: { duration: 250 } });
}

function LibraryItem({ kind, icon, label }: { kind: BlockKind; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      className={styles.libraryItem}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-tqs-studio-block", kind);
        event.dataTransfer.effectAllowed = "copy";
      }}
      data-kind={kind}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Library({ collapsed, onToggle, onInsert }: { collapsed: boolean; onToggle: () => void; onInsert: (kind: BlockKind) => void }) {
  if (collapsed) {
    return (
      <button type="button" className={styles.libraryCollapsed} onClick={onToggle} data-testid="library-open">
        Library
      </button>
    );
  }
  return (
    <aside className={styles.library} data-testid="library">
      <div className={styles.libraryHeader}>
        <strong>Library</strong>
        <button type="button" onClick={onToggle} aria-label="Collapse Library">‹</button>
      </div>
      <label className={styles.librarySearch}>
        <Search size={14} />
        <input aria-label="Search Library" placeholder="Search blocks" />
      </label>
      <div className={styles.libraryGroup}>
        <span>BASIC</span>
        <div onClick={(event) => {
          const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-kind]");
          if (button) onInsert(button.dataset.kind as BlockKind);
        }}>
          <LibraryItem kind="text" icon={<Type size={15} />} label="Rich Text" />
          <LibraryItem kind="callout" icon={<Maximize2 size={15} />} label="Callout" />
        </div>
      </div>
      <div className={styles.libraryGroup}>
        <span>DATA</span>
        <div onClick={(event) => {
          const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-kind]");
          if (button) onInsert(button.dataset.kind as BlockKind);
        }}>
          <LibraryItem kind="chart" icon={<BarChart3 size={15} />} label="Market Chart" />
        </div>
      </div>
      <div className={styles.libraryGroup}>
        <span>MEDIA</span>
        <div onClick={(event) => {
          const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-kind]");
          if (button) onInsert(button.dataset.kind as BlockKind);
        }}>
          <LibraryItem kind="image" icon={<ImageIcon size={15} />} label="Image" />
          <LibraryItem kind="video" icon={<Video size={15} />} label="Video + transcript" />
        </div>
      </div>
      <div className={styles.libraryGroup}>
        <span>DOCS</span>
        <div onClick={(event) => {
          const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-kind]");
          if (button) onInsert(button.dataset.kind as BlockKind);
        }}>
          <LibraryItem kind="pdf" icon={<FileText size={15} />} label="PDF" />
        </div>
      </div>
      <div className={styles.libraryHint}>Drag to place · click to add at viewport center</div>
    </aside>
  );
}

function StaticPreviewBlock({ shape }: { shape: StudioShape }) {
  if (shape.props.hidden) return null;
  if (shape.props.kind === "text") {
    return <div className={styles.previewText} dangerouslySetInnerHTML={{ __html: shape.props.body }} />;
  }
  if (shape.props.kind === "chart") {
    return (
      <div className={styles.previewChart}>
        <strong>{shape.props.title}</strong>
        <div className={styles.previewChartLine}>
          {chartData.long.map((row) => <i key={row[0]} style={{ height: String(row[1] / 1.7) + "%" }} />)}
        </div>
      </div>
    );
  }
  if (shape.props.kind === "image") return <ImageBlock shape={shape} />;
  if (shape.props.kind === "video") return (
    <div className={styles.previewVideo}>
      <Play size={24} />
      <strong>{shape.props.title}</strong>
      <span>Video + transcript object</span>
    </div>
  );
  if (shape.props.kind === "pdf") return (
    <div className={styles.previewPdf}>
      <FileText size={28} />
      <strong>{shape.props.title}</strong>
      <span>2-page research memo</span>
    </div>
  );
  return <CalloutBlock shape={shape} />;
}

function RenderFrame({ frame, shapes }: { frame: TLShape; shapes: StudioShape[] }) {
  const children = shapes.filter((shape) => shape.parentId === frame.id && !shape.props.hidden);
  return (
    <section className={styles.outputFrame}>
      <div className={styles.outputFrameLabel}>{frame.type === "frame" ? (frame.props as { name?: string }).name : "Frame"}</div>
      <div className={styles.outputGrid}>
        {children.map((shape) => <StaticPreviewBlock key={shape.id} shape={shape} />)}
      </div>
    </section>
  );
}

const OutputOverlay = track(function OutputOverlay({
  mode,
  presentIndex,
  setPresentIndex,
  onEdit,
}: {
  mode: AppMode;
  presentIndex: number;
  setPresentIndex: (value: number) => void;
  onEdit: () => void;
}) {
  const editor = useEditor();
  const all = editor.getCurrentPageShapes();
  const frames = all.filter((shape) => shape.type === "frame").sort((a, b) => a.x - b.x);
  const studio = all.filter((shape): shape is StudioShape => shape.type === SHAPE_TYPE);

  if (mode === "edit") return null;

  if (mode === "present") {
    const frame = frames[Math.min(presentIndex, Math.max(0, frames.length - 1))];
    return (
      <div className={styles.presentOverlay} data-testid="present-mode">
        <div className={styles.presentTop}>
          <span>Present · {presentIndex + 1} / {frames.length}</span>
          <button type="button" onClick={onEdit}>Exit</button>
        </div>
        {frame ? <RenderFrame frame={frame} shapes={studio} /> : null}
        <div className={styles.presentNav}>
          <button type="button" onClick={() => setPresentIndex(Math.max(0, presentIndex - 1))} disabled={presentIndex <= 0} data-testid="present-prev">
            Previous
          </button>
          <button type="button" onClick={() => setPresentIndex(Math.min(frames.length - 1, presentIndex + 1))} disabled={presentIndex >= frames.length - 1} data-testid="present-next">
            Next
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.previewOverlay} data-testid="preview-mode">
      <div className={styles.previewHeader}>
        <div>
          <span>TQS Studio · Preview</span>
          <strong>Si — доллар/рубль: история ликвидности и объёмов</strong>
        </div>
        <button type="button" onClick={onEdit}>Back to Edit</button>
      </div>
      <div className={styles.previewFrames}>
        {frames.map((frame) => <RenderFrame key={frame.id} frame={frame} shapes={studio} />)}
      </div>
    </div>
  );
});

function StudioInner() {
  const editor = useEditor();
  const [mode, setMode] = useState<AppMode>("edit");
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [interactId, setInteractId] = useState<TLShapeId | null>(null);
  const [presentIndex, setPresentIndex] = useState(0);
  const [contextPoint, setContextPoint] = useState({ x: 480, y: 320 });

  useEffect(() => {
    enterInteraction = setInteractId;
    editor.user.updateUserPreferences({ isSnapMode: true, colorScheme: "light" });
    const timer = window.setTimeout(() => {
      const hasStudio = editor.getCurrentPageShapes().some((shape) => shape.type === SHAPE_TYPE);
      if (!hasStudio) createCanonicalBoard(editor);
    }, 120);
    return () => {
      window.clearTimeout(timer);
      if (enterInteraction === setInteractId) enterInteraction = null;
    };
  }, [editor]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && interactId) {
        setInteractId(null);
        editor.setCurrentTool("select");
        return;
      }
      if (event.key === "Enter" && !interactId) {
        const selected = editor.getSelectedShapeIds()[0];
        const shape = selected ? editor.getShape(selected) : undefined;
        if (shape?.type === SHAPE_TYPE) setInteractId(shape.id);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [editor, interactId]);

  const createAtScreenPoint = useCallback((kind: BlockKind, point: { x: number; y: number }) => {
    const pagePoint = editor.screenToPage(point);
    const id = createShapeId();
    const dimensions: Record<BlockKind, [number, number]> = {
      text: [440, 250],
      chart: [500, 360],
      image: [480, 310],
      video: [500, 430],
      pdf: [500, 330],
      callout: [420, 190],
    };
    const titles: Record<BlockKind, string> = {
      text: "Новый Rich Text",
      chart: "Si / RTS — interactive chart",
      image: "Terminal image",
      video: "Video + transcript",
      pdf: "PDF research memo",
      callout: "Новая заметка",
    };
    const bodies: Record<BlockKind, string> = {
      text: "<h2>Новый текстовый блок</h2><p>Двойной клик — редактировать, Esc — снова двигать.</p>",
      callout: "Контекстная заметка прямо на исследовательской доске.",
      chart: "",
      image: "",
      video: "",
      pdf: "",
    };
    const [w, h] = dimensions[kind];
    editor.createShape<StudioShape>({
      id,
      type: SHAPE_TYPE,
      x: pagePoint.x - w / 2,
      y: pagePoint.y - 40,
      props: {
        w,
        h,
        kind,
        title: titles[kind],
        body: bodies[kind],
        config: kind === "chart" ? JSON.stringify({ period: "long", showRts: true }) : "{}",
        hidden: false,
      },
    });
    editor.select(id);
  }, [editor]);

  const insertAtCenter = useCallback((kind: BlockKind) => {
    const bounds = editor.getViewportScreenBounds();
    createAtScreenPoint(kind, { x: bounds.center.x, y: bounds.center.y });
  }, [createAtScreenPoint, editor]);

  const resetDemo = () => {
    setInteractId(null);
    const ids = Array.from(editor.getCurrentPageShapeIds());
    if (ids.length) editor.deleteShapes(ids);
    window.setTimeout(() => createCanonicalBoard(editor), 20);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const kind = event.dataTransfer.getData("application/x-tqs-studio-block") as BlockKind;
    if (!kind) return;
    event.preventDefault();
    event.stopPropagation();
    createAtScreenPoint(kind, { x: event.clientX, y: event.clientY });
  };

  return (
    <RuntimeContext.Provider value={{ interactId, setInteractId }}>
      <div className={styles.app} data-mode={mode} data-testid="studio-spatial-v2">
        <header className={styles.topbar}>
          <div>
            <span>TQS Studio · Spatial prototype V2</span>
            <strong>Si — доллар/рубль: история ликвидности и объёмов</strong>
          </div>
          <div className={styles.modeSwitch}>
            {(["edit", "preview", "present"] as AppMode[]).map((value) => (
              <button
                type="button"
                key={value}
                className={mode === value ? styles.activeMode : ""}
                onClick={() => {
                  setMode(value);
                  setInteractId(null);
                  if (value === "present") setPresentIndex(0);
                }}
                data-testid={"mode-" + value}
              >
                {value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
            <button type="button" className={styles.resetButton} onClick={resetDemo} data-testid="reset-demo">
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        </header>

        {mode === "edit" ? (
          <Library
            collapsed={libraryCollapsed}
            onToggle={() => setLibraryCollapsed((value) => !value)}
            onInsert={insertAtCenter}
          />
        ) : null}

        <ContextMenu.Root>
          <ContextMenu.Trigger asChild>
            <div
              className={styles.canvasShell}
              onContextMenu={(event) => {
                const point = editor.screenToPage({ x: event.clientX, y: event.clientY });
                if (editor.getShapeAtPoint(point)) return;
                setContextPoint({ x: event.clientX, y: event.clientY });
              }}
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes("application/x-tqs-studio-block")) event.preventDefault();
              }}
              onDropCapture={handleDrop}
              data-testid="canvas-shell"
            />
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Content className={styles.contextMenu} data-testid="insert-menu">
              <ContextMenu.Label>Insert at cursor</ContextMenu.Label>
              {([
                ["text", "Rich Text"],
                ["chart", "Market Chart"],
                ["image", "Image"],
                ["video", "Video"],
                ["pdf", "PDF"],
                ["callout", "Callout"],
              ] as [BlockKind, string][]).map(([kind, label]) => (
                <ContextMenu.Item key={kind} onSelect={() => createAtScreenPoint(kind, contextPoint)} data-testid={"insert-" + kind}>
                  {label}
                </ContextMenu.Item>
              ))}
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu.Root>

        <div className={styles.canvasLayer} data-testid="tldraw-canvas-note">
          <div className={styles.canvasStatus}>
            <span>Move mode</span>
            <span>double-click / Enter → interact</span>
            <span>snap on</span>
          </div>
        </div>

        <OutputOverlay
          mode={mode}
          presentIndex={presentIndex}
          setPresentIndex={setPresentIndex}
          onEdit={() => setMode("edit")}
        />
      </div>
    </RuntimeContext.Provider>
  );
}

export default function StudioSpatialPrototype() {
  return (
    <div className={styles.root}>
      <Tldraw shapeUtils={shapeUtils} persistenceKey={STORAGE_KEY} hideUi>
        <StudioInner />
      </Tldraw>
    </div>
  );
}

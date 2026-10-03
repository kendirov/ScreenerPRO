"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BaseBoxShapeUtil,
  Editor,
  HTMLContainer,
  T,
  TLShape,
  Tldraw,
  createShapeId,
  useValue,
} from "tldraw";
import "tldraw/tldraw.css";
import { EditorContent, useEditor as useTiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import * as echarts from "echarts";
import * as ContextMenu from "@radix-ui/react-context-menu";
import {
  BarChart3,
  FileText,
  Frame,
  Image as ImageIcon,
  Maximize2,
  Move,
  Play,
  Presentation,
  RotateCcw,
  Type,
  Video,
} from "lucide-react";
import styles from "./studio-spatial-prototype.module.css";

const SHAPE_TYPE = "tqs-studio-block" as const;
const STORAGE_KEY = "tqs-studio-spatial-v2";
const ARTICLE_FRAME = createShapeId("tqs-article-frame");
const LESSON_FRAME = createShapeId("tqs-lesson-frame");

type Mode = "edit" | "preview" | "present";
type BlockKind = "richText" | "chart" | "image" | "video" | "pdf";

type BlockData = {
  title: string;
  body?: string;
  caption?: string;
  period?: "1Y" | "3Y" | "ALL";
  series?: "SI" | "RTS" | "BOTH";
  page?: number;
  hidden?: boolean;
};

declare module "tldraw" {
  export interface TLGlobalShapePropsMap {
    [SHAPE_TYPE]: { w: number; h: number; kind: BlockKind; data: string };
  }
}

type StudioShape = TLShape<typeof SHAPE_TYPE>;

const RuntimeContext = React.createContext<{ mode: Mode }>({ mode: "edit" });

function parseData(shape: StudioShape): BlockData {
  try {
    return JSON.parse(shape.props.data) as BlockData;
  } catch {
    return { title: "Block" };
  }
}

function patchShape(editor: Editor, shape: StudioShape, patch: Partial<BlockData>) {
  editor.updateShape({
    id: shape.id,
    type: SHAPE_TYPE,
    props: { data: JSON.stringify({ ...parseData(shape), ...patch }) },
  });
}

function RichTextBlock({ shape, editor, interactive }: { shape: StudioShape; editor: Editor; interactive: boolean }) {
  const data = parseData(shape);
  const tiptap = useTiptapEditor({
    extensions: [StarterKit],
    content: data.body || "<h2>Si — ликвидность и смена лидерства</h2><p>Двойной клик или Enter переводит блок в режим редактирования. Сам блок в Move mode перетаскивается целиком.</p>",
    immediatelyRender: false,
    editable: interactive,
    onUpdate: ({ editor: e }) => patchShape(editor, shape, { body: e.getHTML() }),
  });

  useEffect(() => {
    tiptap?.setEditable(interactive);
  }, [interactive, tiptap]);

  return (
    <div className={styles.richText}>
      {interactive ? (
        <div className={styles.formatBar} data-testid="rich-text-toolbar" onPointerDown={(e) => e.stopPropagation()}>
          <button data-testid="format-bold" onClick={() => tiptap?.chain().focus().toggleBold().run()}>B</button>
          <button onClick={() => tiptap?.chain().focus().toggleItalic().run()}><i>I</i></button>
          <button onClick={() => tiptap?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
          <button onClick={() => tiptap?.chain().focus().toggleBulletList().run()}>• List</button>
        </div>
      ) : null}
      <EditorContent editor={tiptap} data-testid="rich-text-editor" />
    </div>
  );
}

const CHART_DATA = {
  "1Y": [
    ["Jan", 82, 64], ["Mar", 91, 61], ["May", 105, 59], ["Jul", 118, 54], ["Sep", 112, 48], ["Nov", 126, 45],
  ],
  "3Y": [
    ["2024 H1", 82, 69], ["2024 H2", 96, 63], ["2025 H1", 111, 57], ["2025 H2", 122, 51], ["2026 H1", 137, 46], ["2026 H2", 129, 42],
  ],
  ALL: [
    ["2012", 58, 100], ["2014", 100, 82], ["2018", 119, 62], ["2022", 148, 36], ["2024", 134, 31], ["2026", 129, 42],
  ],
} as const;

function ChartBlock({ shape, editor, interactive }: { shape: StudioShape; editor: Editor; interactive: boolean }) {
  const data = parseData(shape);
  const period = data.period || "ALL";
  const series = data.series || "BOTH";
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const rows = CHART_DATA[period];
    chart.setOption({
      animation: false,
      grid: { left: 38, right: 16, top: 22, bottom: 28 },
      tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
      xAxis: { type: "category", data: rows.map((r) => r[0]), axisLine: { lineStyle: { color: "#aaa" } } },
      yAxis: { type: "value", splitLine: { lineStyle: { color: "#ececea" } } },
      series: [
        ...(series !== "RTS" ? [{ name: "Si", type: "line", smooth: true, showSymbol: false, data: rows.map((r) => r[1]), lineStyle: { width: 2, color: "#111" }, itemStyle: { color: "#111" } }] : []),
        ...(series !== "SI" ? [{ name: "RTS", type: "line", smooth: true, showSymbol: false, data: rows.map((r) => r[2]), lineStyle: { width: 1.5, color: "#888" }, itemStyle: { color: "#888" } }] : []),
      ],
    });
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(ref.current);
    return () => { ro.disconnect(); chart.dispose(); };
  }, [period, series]);

  return (
    <div className={styles.chartBlock}>
      <div className={styles.blockHead}><strong>{data.title}</strong><span>tooltip + crosshair</span></div>
      <div className={styles.chartControls} onPointerDown={(e) => e.stopPropagation()}>
        {(["1Y", "3Y", "ALL"] as const).map((p) => (
          <button data-testid={`chart-period-${p}`} className={period === p ? styles.controlActive : ""} disabled={!interactive} onClick={() => patchShape(editor, shape, { period: p })}>{p}</button>
        ))}
        {(["SI", "RTS", "BOTH"] as const).map((s) => (
          <button data-testid={`chart-series-${s}`} className={series === s ? styles.controlActive : ""} disabled={!interactive} onClick={() => patchShape(editor, shape, { series: s })}>{s}</button>
        ))}
      </div>
      <div ref={ref} className={styles.chartStage} data-testid="market-chart" />
    </div>
  );
}

function ImageBlock({ shape }: { shape: StudioShape }) {
  const data = parseData(shape);
  return (
    <figure className={styles.imageBlock}>
      <div className={styles.marketImage} role="img" aria-label="Si terminal volume profile">
        <div className={styles.imageTop}><span>Si · 5m</span><span>Volume profile</span></div>
        <div className={styles.candles}>{[44,68,52,79,61,88,72,93,66,84,58,90,76,97].map((h,i)=><i key={i} style={{height:`${h}%`}} />)}</div>
      </div>
      <figcaption><strong>{data.title}</strong><span>{data.caption}</span></figcaption>
    </figure>
  );
}

const VIDEO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const TRANSCRIPT = [
  { t: 0, label: "00:00", text: "Контекст: почему абсолютный объём сам по себе мало что объясняет." },
  { t: 4, label: "00:04", text: "Смотрим переход внимания между RTS и Si." },
  { t: 8, label: "00:08", text: "Важна связка цена, поток сделок и открытый интерес." },
  { t: 12, label: "00:12", text: "Этот же блок позже сможет хранить расшифровку урока." },
];

function VideoBlock({ shape, interactive }: { shape: StudioShape; interactive: boolean }) {
  const data = parseData(shape);
  const videoRef = useRef<HTMLVideoElement>(null);
  const seek = (time: number) => {
    if (!interactive || !videoRef.current) return;
    videoRef.current.currentTime = time;
    void videoRef.current.play();
  };
  return (
    <div className={styles.videoBlock}>
      <div className={styles.blockHead}><strong>{data.title}</strong><span>click transcript → seek</span></div>
      <video ref={videoRef} data-testid="studio-video" src={VIDEO_URL} controls={interactive} muted playsInline />
      <div className={styles.transcript}>
        {TRANSCRIPT.map((line) => (
          <button key={line.t} data-testid={`transcript-${line.t}`} disabled={!interactive} onClick={() => seek(line.t)} onPointerDown={(e)=>e.stopPropagation()}>
            <b>{line.label}</b><span>{line.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const PDF_BASE64 = "JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUgo+PgplbmRvYmoKMiAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYSAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjEgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZGJqCjMgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EtQm9sZCAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjIgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZGJqCjQgMCBvYmoKPDwKL0NvbnRlbnRzIDkgMCBSIC9NZWRpYUJveCBbIDAgMCA2MTIgNzkyIF0gL1BhcmVudCA4IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKPj4gL1R5cGUgL1BhZ2UKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0NvbnRlbnRzIDEwIDAgUiAvTWVkaWFCb3ggWyAwIDAgNjEyIDc5MiBdIC9QYXJlbnQgOCAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cj4+IC9UeXBlIC9QYWdlCj4+CmVuZGJqCjYgMCBvYmoKPDwKL1BhZ2VNb2RlIC9Vc2VOb25lIC9QYWdlcyA4IDAgUiAvVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoKNyAwIG9iago8PAovQXV0aG9yIChhbm9ueW1vdXMpIC9DcmVhdG9yIChSZXBvcnRMYWIpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5KSAvVGl0bGUgKFRRUyBTdHVkaW8gVjIpCj4+CmVuZGJqCjggMCBvYmoKPDwKL0NvdW50IDIgL0tpZHMgWyA0IDAgUiA1IDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKOSAwIG9iago8PAovTGVuZ3RoIDEyMgo+PgpzdHJlYW0KQlQgL0YyIDE4IFRmIDcyIDcyMCBUZCAoU2k6IGZ1dHVyZXMgbGlxdWlkaXR5IG5vdGVzIC0gUGFnZSAxKSBUaiAvRjEgMTEgVGYgMCAzMCBUZCAoVFFTIFN0dWRpbyBWMiBwcm90b3R5cGUgZG9jdW1lbnQpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKMTAgMCBvYmoKPDwKL0xlbmd0aCAxMjYKPj4Kc3RyZWFtCkJUIC9GMiAxOCBUZiA3MiA3MjAgVGQgKFRpbWVsaW5lOiAyMDE0IC8gMjAyMiAvIDIwMjQgLSBQYWdlIDIpIFRqIC9GMSAxMSBUZiAwIDMwIFRkIChUUVMgU3R1ZGlvIFYyIHByb3RvdHlwZSBkb2N1bWVudCkgVGogRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMTEKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAxMDIgMDAwMDAgbiAKMDAwMDAwMDIwOSAwMDAwIG4gCjAwMDAwMDAzMjEgMDAwMDAgbiAKMDAwMDAwMDUxNCAwMDAwMCBuIAowMDAwMDAwNzA4IDAwMDAwIG4gCjAwMDAwMDA3NzYgMDAwMDAgbiAKMDAwMDAwMDkxNyAwMDAwMCBuIAowMDAwMDAwOTgyIDAwMDAwIG4gCjAwMDAwMDEwNTQgMDAwMDAgbiAKdHJhaWxlcgo8PAovUm9vdCA2IDAgUgovSW5mbyA3IDAgUgovU2l6ZSAxMQo+PgpzdGFydHhyZWYKMTEzMQolJUVPRgo=";

function PdfBlock({ shape, editor, interactive }: { shape: StudioShape; editor: Editor; interactive: boolean }) {
  const data = parseData(shape);
  const pageNumber = data.page || 1;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pages, setPages] = useState(2);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs";
      const bytes = Uint8Array.from(atob(PDF_BASE64), (c) => c.charCodeAt(0));
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      if (cancelled) return;
      setPages(pdf.numPages);
      const page = await pdf.getPage(Math.min(pageNumber, pdf.numPages));
      const viewport = page.getViewport({ scale: 1.15 });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    })();
    return () => { cancelled = true; };
  }, [pageNumber]);

  return (
    <div className={styles.pdfBlock}>
      <div className={styles.blockHead}><strong>{data.title}</strong><span>PDF.js · {pageNumber}/{pages}</span></div>
      <canvas ref={canvasRef} data-testid="pdf-canvas" />
      <div className={styles.pdfControls} onPointerDown={(e)=>e.stopPropagation()}>
        <button data-testid="pdf-prev" disabled={!interactive || pageNumber <= 1} onClick={()=>patchShape(editor,shape,{page:pageNumber-1})}>← Prev</button>
        <span>Page {pageNumber}</span>
        <button data-testid="pdf-next" disabled={!interactive || pageNumber >= pages} onClick={()=>patchShape(editor,shape,{page:pageNumber+1})}>Next →</button>
      </div>
    </div>
  );
}

function StudioShapeBody({ shape, editor }: { shape: StudioShape; editor: Editor }) {
  const { mode } = React.useContext(RuntimeContext);
  const editing = useValue("editing", () => editor.getEditingShapeId() === shape.id, [editor, shape.id]);
  const data = parseData(shape);
  const interactive = editing || mode !== "edit";
  if (data.hidden && mode !== "edit") return <HTMLContainer style={{ display: "none" }} />;
  return (
    <HTMLContainer
      id={shape.id}
      className={`${styles.shape} ${editing ? styles.shapeEditing : ""} ${data.hidden ? styles.shapeHidden : ""}`}
      style={{ width: shape.props.w, height: shape.props.h, pointerEvents: interactive ? "all" : "none" }}
    >
      <div className={styles.shapeLabel}><Move size={12}/><span>{shape.props.kind}</span>{editing ? <b>INTERACT</b> : null}</div>
      <div className={styles.shapeContent}>
        {shape.props.kind === "richText" ? <RichTextBlock shape={shape} editor={editor} interactive={interactive}/> : null}
        {shape.props.kind === "chart" ? <ChartBlock shape={shape} editor={editor} interactive={interactive}/> : null}
        {shape.props.kind === "image" ? <ImageBlock shape={shape}/> : null}
        {shape.props.kind === "video" ? <VideoBlock shape={shape} interactive={interactive}/> : null}
        {shape.props.kind === "pdf" ? <PdfBlock shape={shape} editor={editor} interactive={interactive}/> : null}
      </div>
    </HTMLContainer>
  );
}

class StudioShapeUtil extends BaseBoxShapeUtil<StudioShape> {
  static override type = SHAPE_TYPE;
  static override props = { w: T.number, h: T.number, kind: T.string, data: T.string };

  getDefaultProps(): StudioShape["props"] {
    return { w: 380, h: 260, kind: "richText", data: JSON.stringify({ title: "New block" }) };
  }
  override canEdit() { return true; }
  override canResize() { return true; }
  override isAspectRatioLocked() { return false; }
  component(shape: StudioShape) { return <StudioShapeBody shape={shape} editor={this.editor}/>; }
  getIndicatorPath(shape: StudioShape) {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }
}

const shapeUtils = [StudioShapeUtil];

function blockProps(kind: BlockKind): StudioShape["props"] {
  const base: Record<BlockKind, StudioShape["props"]> = {
    richText: { w: 430, h: 270, kind, data: JSON.stringify({ title: "Rich Text", body: "<h2>Свободный текст на доске</h2><p>Выделите блок и нажмите Enter или дважды кликните, чтобы форматировать текст.</p>" }) },
    chart: { w: 480, h: 330, kind, data: JSON.stringify({ title: "Si / RTS liquidity shift", period: "ALL", series: "BOTH" }) },
    image: { w: 400, h: 300, kind, data: JSON.stringify({ title: "Terminal image", caption: "Image block · volume profile reference" }) },
    video: { w: 430, h: 410, kind, data: JSON.stringify({ title: "Разбор Si — видео + transcript" }) },
    pdf: { w: 390, h: 430, kind, data: JSON.stringify({ title: "Research PDF", page: 1 }) },
  };
  return base[kind];
}

function seedDemo(editor: Editor) {
  if (editor.getShape(ARTICLE_FRAME)) return;
  editor.createShapes([
    { id: ARTICLE_FRAME, type: "frame", x: 120, y: 120, props: { w: 1060, h: 760, name: "Frame 01 · Article / Briefing" } },
    { id: LESSON_FRAME, type: "frame", x: 1280, y: 180, props: { w: 980, h: 720, name: "Frame 02 · Lesson / Presentation" } },
    { id: createShapeId("article-text"), type: SHAPE_TYPE, parentId: ARTICLE_FRAME, x: 50, y: 70, props: blockProps("richText") },
    { id: createShapeId("article-chart"), type: SHAPE_TYPE, parentId: ARTICLE_FRAME, x: 500, y: 70, props: blockProps("chart") },
    { id: createShapeId("article-image"), type: SHAPE_TYPE, parentId: ARTICLE_FRAME, x: 50, y: 380, props: blockProps("image") },
    { id: createShapeId("lesson-video"), type: SHAPE_TYPE, parentId: LESSON_FRAME, x: 45, y: 70, props: blockProps("video") },
    { id: createShapeId("lesson-pdf"), type: SHAPE_TYPE, parentId: LESSON_FRAME, x: 515, y: 70, props: blockProps("pdf") },
  ] as any);
  editor.zoomToFit({ animation: { duration: 200 } });
}

const LIBRARY: { kind: BlockKind; label: string; icon: React.ReactNode }[] = [
  { kind: "richText", label: "Rich Text", icon: <Type size={16}/> },
  { kind: "chart", label: "Market Chart", icon: <BarChart3 size={16}/> },
  { kind: "image", label: "Image", icon: <ImageIcon size={16}/> },
  { kind: "video", label: "Video + transcript", icon: <Video size={16}/> },
  { kind: "pdf", label: "PDF", icon: <FileText size={16}/> },
];

export default function StudioSpatialPrototype() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [mode, setMode] = useState<Mode>("edit");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextPoint, setContextPoint] = useState<{x:number;y:number;clientX:number;clientY:number}|null>(null);
  const [presentFrame, setPresentFrame] = useState<"article"|"lesson">("article");
  const [cameraTick, setCameraTick] = useState(0);

  const createBlockAt = useCallback((kind: BlockKind, point: {x:number;y:number}) => {
    if (!editor) return;
    const props = blockProps(kind);
    const id = createShapeId();
    editor.createShape({ id, type: SHAPE_TYPE, x: point.x - props.w / 2, y: point.y - 30, props } as any);
    editor.select(id);
    setSelectedId(id);
  }, [editor]);

  const setModeAndCamera = (next: Mode) => {
    setMode(next);
    if (!editor) return;
    editor.setEditingShape(null);
    editor.updateInstanceState({ isReadonly: next !== "edit" });
    if (next === "preview") editor.zoomToFit({ animation: { duration: 250 } });
    if (next === "present") {
      const id = presentFrame === "article" ? ARTICLE_FRAME : LESSON_FRAME;
      const bounds = editor.getShapePageBounds(id);
      if (bounds) editor.zoomToBounds(bounds, { animation: { duration: 280 } });
    }
  };

  useEffect(() => {
    if (!editor) return;
    const handler = (info: any) => {
      if (info.name === "pointer_down" || info.name === "pointer_up" || info.name === "wheel" || info.name === "pinch") {
        const only = editor.getOnlySelectedShape();
        setSelectedId(only?.type === SHAPE_TYPE ? only.id : null);
        setCameraTick((v) => v + 1);
      }
    };
    editor.on("event", handler);
    return () => { editor.off("event", handler); };
  }, [editor]);

  useEffect(() => {
    if (!editor || mode !== "present") return;
    const id = presentFrame === "article" ? ARTICLE_FRAME : LESSON_FRAME;
    const bounds = editor.getShapePageBounds(id);
    if (bounds) editor.zoomToBounds(bounds, { animation: { duration: 240 } });
  }, [editor, mode, presentFrame]);

  const toolbarStyle = useMemo(() => {
    void cameraTick;
    if (!editor || !selectedId || mode !== "edit") return null;
    const bounds = editor.getShapePageBounds(selectedId as any);
    if (!bounds) return null;
    const p = editor.pageToScreen({ x: bounds.x + bounds.w / 2, y: bounds.y });
    return { left: p.x, top: p.y - 12 };
  }, [editor, selectedId, mode, cameraTick]);

  const selectedShape = editor && selectedId ? editor.getShape(selectedId as any) as StudioShape | undefined : undefined;

  const actionDuplicate = () => {
    if (!editor || !selectedShape) return;
    const id = createShapeId();
    editor.createShape({ ...selectedShape, id, x: selectedShape.x + 36, y: selectedShape.y + 36 } as any);
    editor.select(id);
    setSelectedId(id);
  };
  const actionHidden = () => {
    if (!editor || !selectedShape) return;
    const d = parseData(selectedShape);
    patchShape(editor, selectedShape, { hidden: !d.hidden });
  };
  const actionLock = () => {
    if (!editor || !selectedShape) return;
    editor.toggleLock([selectedShape.id]);
  };
  const actionDelete = () => {
    if (!editor || !selectedShape) return;
    editor.deleteShape(selectedShape);
    setSelectedId(null);
  };

  const reset = () => {
    if (!editor) return;
    editor.run(() => {
      editor.deleteShapes(Array.from(editor.getCurrentPageShapeIds()));
      seedDemo(editor);
    }, { ignoreShapeLock: true });
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <RuntimeContext.Provider value={{ mode }}>
      <main className={styles.page} data-mode={mode}>
        <header className={styles.topbar}>
          <div><div className={styles.kicker}>TQS Studio · Spatial Prototype V2</div><strong>Si — interactive canvas</strong></div>
          <div className={styles.modeSwitch} data-testid="mode-switch">
            {(["edit","preview","present"] as Mode[]).map((m)=><button key={m} data-testid={`mode-${m}`} className={mode===m?styles.activeMode:""} onClick={()=>setModeAndCamera(m)}>{m[0].toUpperCase()+m.slice(1)}</button>)}
          </div>
          <div className={styles.topActions}>
            {mode==="present" ? (
              <div className={styles.frameNav}>
                <button data-testid="present-frame-article" className={presentFrame==="article"?styles.activeMode:""} onClick={()=>setPresentFrame("article")}>01 Article</button>
                <button data-testid="present-frame-lesson" className={presentFrame==="lesson"?styles.activeMode:""} onClick={()=>setPresentFrame("lesson")}>02 Lesson</button>
              </div>
            ):null}
            <button className={styles.reset} data-testid="reset-demo" onClick={reset}><RotateCcw size={14}/> Reset</button>
          </div>
        </header>

        <div className={styles.workspace}>
          {mode==="edit" ? (
            <aside className={styles.library} data-testid="library">
              <div className={styles.libraryTitle}>Library</div>
              <p>Drag to canvas or click to add in viewport center.</p>
              {LIBRARY.map((item)=>(
                <button key={item.kind} draggable data-testid={`library-${item.kind}`}
                  onDragStart={(e)=>e.dataTransfer.setData("text/tqs-block",item.kind)}
                  onClick={()=>{
                    if (!editor) return;
                    const b=editor.getViewportPageBounds();
                    createBlockAt(item.kind,{x:b.x+b.w/2,y:b.y+b.h/2});
                  }}>
                  {item.icon}<span>{item.label}</span>
                </button>
              ))}
              <div className={styles.libraryDivider}/>
              <div className={styles.libraryHint}><Frame size={15}/><span>Frames are spatial parents: move a Frame → children follow. Select a child → move it independently.</span></div>
              <div className={styles.libraryHint}><Maximize2 size={15}/><span>Wheel / trackpad zoom + pan. Resize from selection handles. tldraw snapping stays active.</span></div>
            </aside>
          ):null}

          <ContextMenu.Root open={!!contextPoint} onOpenChange={(open)=>{if(!open)setContextPoint(null)}}>
            <ContextMenu.Trigger asChild>
              <section className={styles.canvasWrap}
                data-testid="spatial-canvas"
                onContextMenu={(e)=>{
                  if(mode!=="edit"||!editor)return;
                  e.preventDefault();
                  const p=editor.screenToPage({x:e.clientX,y:e.clientY});
                  setContextPoint({x:p.x,y:p.y,clientX:e.clientX,clientY:e.clientY});
                }}
                onDragOver={(e)=>{ if(mode==="edit") e.preventDefault(); }}
                onDrop={(e)=>{
                  if(!editor||mode!=="edit")return;
                  e.preventDefault();
                  const kind=e.dataTransfer.getData("text/tqs-block") as BlockKind;
                  if(!kind)return;
                  const p=editor.screenToPage({x:e.clientX,y:e.clientY});
                  createBlockAt(kind,p);
                }}>
                <Tldraw
                  shapeUtils={shapeUtils}
                  persistenceKey={STORAGE_KEY}
                  hideUi
                  options={{ camera: { wheelBehavior: "zoom", panSpeed: 1, zoomSpeed: 1 } }}
                  onMount={(ed)=>{
                    setEditor(ed);
                    ed.updateInstanceState({ isReadonly: false });
                    seedDemo(ed);
                  }}
                />
                {toolbarStyle && selectedShape ? (
                  <div className={styles.selectionToolbar} data-testid="selection-toolbar" style={{left:toolbarStyle.left,top:toolbarStyle.top}}>
                    <span>{selectedShape.props.kind}</span>
                    <button onClick={actionDuplicate}>Duplicate</button>
                    <button data-testid="toggle-hidden" onClick={actionHidden}>{parseData(selectedShape).hidden?"Show":"Hide"}</button>
                    <button onClick={actionLock}>{selectedShape.isLocked?"Unlock":"Lock"}</button>
                    <button onClick={actionDelete}>Delete</button>
                  </div>
                ):null}
                {mode==="edit" ? <div className={styles.moveHint}><Move size={13}/> Move mode · double-click / Enter to interact · Esc to exit</div>:null}
                {mode==="present" ? <div className={styles.presentBadge}><Presentation size={14}/> Present · {presentFrame==="article"?"Article / Briefing":"Lesson / Presentation"}</div>:null}
              </section>
            </ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Content className={styles.contextMenu} data-testid="canvas-context-menu">
                <ContextMenu.Label>Insert here</ContextMenu.Label>
                {LIBRARY.map((item)=>(
                  <ContextMenu.Item key={item.kind} onSelect={()=>{if(contextPoint)createBlockAt(item.kind,contextPoint);setContextPoint(null)}}>
                    {item.icon}<span>{item.label}</span>
                  </ContextMenu.Item>
                ))}
              </ContextMenu.Content>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        </div>
      </main>
    </RuntimeContext.Provider>
  );
}

import React from "react";

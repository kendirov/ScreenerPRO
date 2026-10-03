"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor as useTiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import * as echarts from "echarts";
import {
  BarChart3, BookOpen, FileDown, FileJson, FileText,
  Frame, Image as ImageIcon, Maximize2, MousePointer2, Move, PanelLeftClose,
  PanelLeftOpen, Presentation, RotateCcw, Search, Sparkles, Type, Upload, Video
} from "lucide-react";
import styles from "./studio-spatial-prototype.module.css";

type Mode = "edit" | "preview" | "present";
type ThemeMode = "light" | "dark" | "system";
type NavMode = "auto" | "mouse" | "trackpad";
type PagePreset = "article" | "a4";
type BlockKind = "richText" | "page" | "chart" | "image" | "video" | "pdf";
type ItemKind = BlockKind | "frame";
type LibraryTab = "create" | "board" | "drive" | "knowledge";
type BlockData = {
  title: string;
  body?: string;
  caption?: string;
  period?: "1Y"|"3Y"|"ALL";
  series?: "SI"|"RTS"|"BOTH";
  page?: number;
  pagePreset?: PagePreset;
  sourceRefs?: string[];
  assetRef?: string;
  dataRef?: string;
  configRef?: string;
};
type StudioItem = {
  id: string;
  kind: ItemKind;
  x: number; y: number; w: number; h: number; z: number;
  parentId?: string;
  hidden?: boolean;
  locked?: boolean;
  data: BlockData;
};
type BoardSnapshot = {
  schemaVersion: "tqs-studio-board/v1";
  boardId: "si-liquidity-history";
  revision: number;
  theme: ThemeMode;
  navigation: NavMode;
  frames: StudioItem[];
  blocks: StudioItem[];
  assets: {id:string;ref:string}[];
  sourceRefs: string[];
  updatedAt: string;
};

declare global {
  interface Window {
    __TQS_STUDIO_V3__?: {
      exportSnapshot: () => BoardSnapshot;
      importSnapshot: (snapshot: BoardSnapshot) => boolean;
      reset: () => void;
      getState: () => {items: StudioItem[]; theme:ThemeMode; navigation:NavMode; revision:number};
    };
  }
}

const STORAGE_KEY = "tqs-studio-spatial-v3-dom";
const LEGACY_STORAGE_KEY = "tqs-studio-spatial-v2-dom";
const THEME_KEY = "tqs-studio-v3-theme";
const NAV_KEY = "tqs-studio-v3-navigation";
const LIBRARY_KEY = "tqs-studio-v3-library-collapsed";
const ARTICLE_FRAME = "frame-article";
const LESSON_FRAME = "frame-lesson";
const SNAP = 10;
const BOARD_ID = "si-liquidity-history" as const;
const DRIVE_BOARD_FOLDER = "1UJVJUBPt5pEHmjmb79Pllm-hyIij0DkD";
const DRIVE_MANIFEST = "1MKbooBi7ndxK8uc2OZ5fbZIC4Rx8BfW4hU82WyyvPmw";
const DRIVE_ASSETS = "1QtWUqxnmsxHSd-AL3Zkn5v37dWh2BGXe";
const DRIVE_SOURCES = "1W-BygF4cR1TNjtPESOfbMNtC1OotPTus";
const DRIVE_EXPORTS = "1OJX0qM37NaN-8uNDe-S16uwkg7RRt1as";
const DRIVE_AUTH_BLOCKER = "No reusable app-level Google Drive OAuth/service-account write integration exists in ScreenerPRO. The ChatGPT Drive connector is not a TQS runtime credential; automatic board.snapshot writes remain blocked until a TQS-owned Drive write credential path is provisioned.";

const initialItems: StudioItem[] = [
  { id: ARTICLE_FRAME, kind:"frame", x:120, y:120, w:1060, h:760, z:1, data:{title:"Frame 01 · Article / Briefing"} },
  { id: LESSON_FRAME, kind:"frame", x:1280, y:180, w:980, h:720, z:1, data:{title:"Frame 02 · Lesson / Presentation"} },
  { id:"article-text", kind:"richText", parentId:ARTICLE_FRAME, x:170, y:190, w:430, h:270, z:5, data:{title:"Rich Text",body:"<h2>Свободный текст на доске</h2><p>Выберите блок; текст редактируется внутри, а перенос — за верхнюю grab-зону.</p>"} },
  { id:"article-chart", kind:"chart", parentId:ARTICLE_FRAME, x:620, y:190, w:480, h:330, z:5, data:{title:"Si / RTS liquidity shift",period:"ALL",series:"BOTH",dataRef:"demo:si-rts-liquidity"} },
  { id:"article-image", kind:"image", parentId:ARTICLE_FRAME, x:170, y:500, w:400, h:300, z:5, data:{title:"Terminal image",caption:"Image block · volume profile reference",assetRef:"demo:terminal-image"} },
  { id:"lesson-video", kind:"video", parentId:LESSON_FRAME, x:1325, y:250, w:430, h:410, z:5, data:{title:"Разбор Si — видео + transcript",sourceRefs:["https://www.w3schools.com/html/mov_bbb.mp4"]} },
  { id:"lesson-pdf", kind:"pdf", parentId:LESSON_FRAME, x:1795, y:250, w:390, h:430, z:5, data:{title:"Research PDF",page:1,assetRef:"demo:research-pdf"} },
];

const LIBRARY_GROUPS: {title:string;items:{kind:BlockKind|"frame";label:string;icon:React.ReactNode;preset?:PagePreset}[]}[] = [
  {title:"Text & Page",items:[
    {kind:"richText",label:"Rich Text",icon:<Type size={15}/>},
    {kind:"page",preset:"article",label:"Article Page",icon:<BookOpen size={15}/>},
    {kind:"page",preset:"a4",label:"A4 / Document Page",icon:<FileText size={15}/>},
  ]},
  {title:"Data",items:[{kind:"chart",label:"Market Chart",icon:<BarChart3 size={15}/>} ]},
  {title:"Media",items:[
    {kind:"image",label:"Image",icon:<ImageIcon size={15}/>},
    {kind:"video",label:"Video + transcript",icon:<Video size={15}/>},
  ]},
  {title:"Documents",items:[{kind:"pdf",label:"PDF",icon:<FileText size={15}/>} ]},
  {title:"Layout",items:[{kind:"frame",label:"Frame / Scene",icon:<Frame size={15}/>} ]},
];

const CHART_DATA = {
  "1Y":[["Jan",82,64],["Mar",91,61],["May",105,59],["Jul",118,54],["Sep",112,48],["Nov",126,45]],
  "3Y":[["2024 H1",82,69],["2024 H2",96,63],["2025 H1",111,57],["2025 H2",122,51],["2026 H1",137,46],["2026 H2",129,42]],
  ALL:[["2012",58,100],["2014",100,82],["2018",119,62],["2022",148,36],["2024",134,31],["2026",129,42]],
} as const;

function uid(kind:BlockKind|"frame"){ return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`; }
function snap(v:number){ return Math.round(v / SNAP) * SNAP; }
function normalizeItems(raw:unknown): StudioItem[] {
  if(!Array.isArray(raw)) return initialItems.map(i=>({...i,data:{...i.data}}));
  return raw.filter(Boolean).map((item:any,index)=>({
    ...item,
    z:Number.isFinite(item.z)?item.z:(item.kind==="frame"?1:5+index),
    data:{...(item.data||{title:String(item.kind||"Block")})},
  }));
}
function blockDefaults(kind:BlockKind,preset:PagePreset="article"): Pick<StudioItem,"w"|"h"|"data"> {
  const all = {
    richText:{w:430,h:270,data:{title:"Rich Text",body:"<h2>Новый текст</h2><p>Кликните в текст для редактирования; переносите блок за верхнюю полосу.</p>"}},
    page:preset==="a4"
      ? {w:620,h:877,data:{title:"A4 / Document Page",pagePreset:"a4" as const,body:"<h1>Si — документ</h1><p>Полноценная A4-подобная страница внутри пространственной доски.</p><h2>Раздел</h2><p>Добавьте текст, списки, цитаты, ссылки и callout.</p>"}}
      : {w:720,h:860,data:{title:"Article Page",pagePreset:"article" as const,body:"<h1>Si — история ликвидности и объёмов</h1><p>Article Page соединяет свободную исследовательскую доску с будущей статьёй и PDF.</p><h2>Ключевая идея</h2><blockquote>Доска остаётся свободной; Page становится управляемой редакционной поверхностью.</blockquote>"}},
    chart:{w:480,h:330,data:{title:"Si / RTS liquidity shift",period:"ALL" as const,series:"BOTH" as const,dataRef:"demo:si-rts-liquidity"}},
    image:{w:400,h:300,data:{title:"Terminal image",caption:"Image block · volume profile reference",assetRef:"demo:terminal-image"}},
    video:{w:430,h:410,data:{title:"Разбор Si — видео + transcript",sourceRefs:["https://www.w3schools.com/html/mov_bbb.mp4"]}},
    pdf:{w:390,h:430,data:{title:"Research PDF",page:1,assetRef:"demo:research-pdf"}},
  };
  return all[kind];
}

function execEditor(command:string,value?:string) {
  document.execCommand(command,false,value);
}

function MiniFormatBar({onCommit}:{onCommit:()=>void}) {
  const link=()=>{
    const url=window.prompt("Link URL","https://");
    if(url) execEditor("createLink",url);
    onCommit();
  };
  return <div className={styles.formatBar} data-testid="page-format-toolbar" onPointerDown={e=>e.stopPropagation()}>
    <button data-testid="page-bold" onMouseDown={e=>e.preventDefault()} onClick={()=>{execEditor("bold");onCommit()}}>B</button>
    <button data-testid="page-italic" onMouseDown={e=>e.preventDefault()} onClick={()=>{execEditor("italic");onCommit()}}><i>I</i></button>
    <button data-testid="page-h2" onMouseDown={e=>e.preventDefault()} onClick={()=>{execEditor("formatBlock","h2");onCommit()}}>H2</button>
    <button data-testid="page-list" onMouseDown={e=>e.preventDefault()} onClick={()=>{execEditor("insertUnorderedList");onCommit()}}>• List</button>
    <button data-testid="page-quote" onMouseDown={e=>e.preventDefault()} onClick={()=>{execEditor("formatBlock","blockquote");onCommit()}}>Quote</button>
    <button data-testid="page-link" onMouseDown={e=>e.preventDefault()} onClick={link}>Link</button>
    <button data-testid="page-callout" onMouseDown={e=>e.preventDefault()} onClick={()=>{execEditor("insertHTML",'<aside data-callout="true"><strong>Callout</strong><p>Добавьте важную мысль.</p></aside><p><br></p>');onCommit()}}>Callout</button>
  </div>;
}

function PageBlock({item,editable,onData}:{item:StudioItem;editable:boolean;onData:(d:Partial<BlockData>)=>void}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(ref.current && document.activeElement!==ref.current && ref.current.innerHTML!==(item.data.body||"")) ref.current.innerHTML=item.data.body||"";
  },[item.data.body]);
  const commit=()=>{if(ref.current)onData({body:ref.current.innerHTML})};
  return <article className={`${styles.pageBlock} ${item.data.pagePreset==="a4"?styles.pageA4:styles.pageArticle}`} data-testid={`page-${item.data.pagePreset||"article"}`}>
    {editable?<MiniFormatBar onCommit={commit}/>:null}
    <div ref={ref} className={styles.pageEditor} contentEditable={editable} suppressContentEditableWarning
      data-testid="page-editor" onInput={commit} onPointerDown={e=>e.stopPropagation()} onBlur={commit}/>
  </article>;
}

function RichTextBlock({item,interactive,onData}:{item:StudioItem;interactive:boolean;onData:(d:Partial<BlockData>)=>void}) {
  const editor=useTiptapEditor({
    extensions:[StarterKit], content:item.data.body || "<p>Text</p>", immediatelyRender:false, editable:interactive,
    onUpdate:({editor:e})=>onData({body:e.getHTML()}),
  });
  useEffect(()=>{editor?.setEditable(interactive)},[editor,interactive]);
  useEffect(()=>{
    if(editor && !editor.isFocused && item.data.body && editor.getHTML()!==item.data.body) editor.commands.setContent(item.data.body,{ emitUpdate:false });
  },[editor,item.data.body]);
  return <div className={styles.richText} onPointerDown={e=>e.stopPropagation()}>
    {interactive?<div className={styles.formatBar} data-testid="rich-text-toolbar">
      <button data-testid="format-bold" onClick={()=>editor?.chain().focus().toggleBold().run()}>B</button>
      <button onClick={()=>editor?.chain().focus().toggleItalic().run()}><i>I</i></button>
      <button onClick={()=>editor?.chain().focus().toggleHeading({level:2}).run()}>H2</button>
      <button onClick={()=>editor?.chain().focus().toggleBulletList().run()}>• List</button>
      <button onClick={()=>editor?.chain().focus().toggleBlockquote().run()}>Quote</button>
    </div>:null}
    <EditorContent editor={editor} data-testid="rich-text-editor"/>
  </div>;
}

function ChartBlock({item,interactive,onData,theme}:{item:StudioItem;interactive:boolean;onData:(d:Partial<BlockData>)=>void;theme:"light"|"dark"}) {
  const period=item.data.period||"ALL", series=item.data.series||"BOTH", ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    let chart:echarts.ECharts|null=null;
    const raf=requestAnimationFrame(()=>{
      if(!ref.current||!ref.current.clientWidth||!ref.current.clientHeight)return;
      chart=echarts.init(ref.current);
      const rows=CHART_DATA[period], dark=theme==="dark";
      chart.setOption({
        animation:false, backgroundColor:"transparent", grid:{left:38,right:16,top:22,bottom:28},
        tooltip:{trigger:"axis",axisPointer:{type:"cross"},backgroundColor:dark?"#24231f":"#fffdf7",borderColor:dark?"#4a4638":"#d8d1bb",textStyle:{color:dark?"#f3eee0":"#24231f"}},
        xAxis:{type:"category",data:rows.map(r=>r[0]),axisLine:{lineStyle:{color:dark?"#736d5d":"#aaa394"}},axisLabel:{color:dark?"#a8a08e":"#746f64"}},
        yAxis:{type:"value",axisLabel:{color:dark?"#a8a08e":"#746f64"},splitLine:{lineStyle:{color:dark?"#2e2c27":"#ece8dc"}}},
        series:[
          ...(series!=="RTS"?[{name:"Si",type:"line",smooth:true,showSymbol:false,data:rows.map(r=>r[1]),lineStyle:{width:2,color:"#d9a928"},itemStyle:{color:"#d9a928"}}]:[]),
          ...(series!=="SI"?[{name:"RTS",type:"line",smooth:true,showSymbol:false,data:rows.map(r=>r[2]),lineStyle:{width:1.5,color:dark?"#989487":"#77746d"},itemStyle:{color:dark?"#989487":"#77746d"}}]:[]),
        ],
      });
    });
    const ro=new ResizeObserver(()=>chart?.resize()); if(ref.current)ro.observe(ref.current);
    return()=>{cancelAnimationFrame(raf);ro.disconnect();chart?.dispose()};
  },[period,series,theme]);
  return <div className={styles.chartBlock} onPointerDown={e=>e.stopPropagation()}>
    <div className={styles.blockHead}><strong>{item.data.title}</strong><span>direct interaction</span></div>
    <div className={styles.chartControls}>
      {(["1Y","3Y","ALL"] as const).map(p=><button key={p} data-testid={`chart-period-${p}`} className={period===p?styles.controlActive:""} disabled={!interactive} onClick={()=>onData({period:p})}>{p}</button>)}
      {(["SI","RTS","BOTH"] as const).map(s=><button key={s} data-testid={`chart-series-${s}`} className={series===s?styles.controlActive:""} disabled={!interactive} onClick={()=>onData({series:s})}>{s}</button>)}
    </div>
    <div ref={ref} className={styles.chartStage} data-testid="market-chart"/>
  </div>;
}

function ImageBlock({item}:{item:StudioItem}) {
  return <figure className={styles.imageBlock} onPointerDown={e=>e.stopPropagation()}><div className={styles.marketImage} role="img" aria-label="Si terminal volume profile">
    <div className={styles.imageTop}><span>Si · 5m</span><span>Volume profile</span></div>
    <div className={styles.candles}>{[44,68,52,79,61,88,72,93,66,84,58,90,76,97].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div>
  </div><figcaption><strong>{item.data.title}</strong><span>{item.data.caption}</span></figcaption></figure>;
}

const VIDEO_URL="https://www.w3schools.com/html/mov_bbb.mp4";
const TRANSCRIPT=[
  {t:0,label:"00:00",text:"Контекст: почему абсолютный объём сам по себе мало что объясняет."},
  {t:4,label:"00:04",text:"Смотрим переход внимания между RTS и Si."},
  {t:8,label:"00:08",text:"Важна связка цена, поток сделок и открытый интерес."},
  {t:9,label:"00:09",text:"Этот же блок позже сможет хранить расшифровку урока."},
];
function VideoBlock({item,interactive}:{item:StudioItem;interactive:boolean}) {
  const ref=useRef<HTMLVideoElement>(null);
  return <div className={styles.videoBlock} onPointerDown={e=>e.stopPropagation()}>
    <div className={styles.blockHead}><strong>{item.data.title}</strong><span>click transcript → seek</span></div>
    <video ref={ref} data-testid="studio-video" src={VIDEO_URL} controls={interactive} muted playsInline/>
    <div className={styles.transcript}>{TRANSCRIPT.map(line=><button key={line.t} data-testid={`transcript-${line.t}`} disabled={!interactive}
      onClick={()=>{if(ref.current&&interactive){ref.current.currentTime=line.t;void ref.current.play().catch(()=>{})}}}>
      <b>{line.label}</b><span>{line.text}</span></button>)}</div>
  </div>;
}

const PDF_BASE64="JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUgo+PgplbmRvYmoKMiAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYSAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjEgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZGJqCjMgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EtQm9sZCAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjIgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZGJqCjQgMCBvYmoKPDwKL0NvbnRlbnRzIDkgMCBSIC9NZWRpYUJveCBbIDAgMCA2MTIgNzkyIF0gL1BhcmVudCA4IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKPj4gL1R5cGUgL1BhZ2UKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0NvbnRlbnRzIDEwIDAgUiAvTWVkaWFCb3ggWyAwIDAgNjEyIDc5MiBdIC9QYXJlbnQgOCAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cj4+IC9UeXBlIC9QYWdlCj4+CmVuZGJqCjYgMCBvYmoKPDwKL1BhZ2VNb2RlIC9Vc2VOb25lIC9QYWdlcyA4IDAgUiAvVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoKNyAwIG9iago8PAovQXV0aG9yIChhbm9ueW1vdXMpIC9DcmVhdG9yIChSZXBvcnRMYWIpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5KSAvVGl0bGUgKFRRUyBTdHVkaW8gVjIpCj4+CmVuZGJqCjggMCBvYmoKPDwKL0NvdW50IDIgL0tpZHMgWyA0IDAgUiA1IDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKOSAwIG9iago8PAovTGVuZ3RoIDEyMgo+PgpzdHJlYW0KQlQgL0YyIDE4IFRmIDcyIDcyMCBUZCAoU2k6IGZ1dHVyZXMgbGlxdWlkaXR5IG5vdGVzIC0gUGFnZSAxKSBUaiAvRjEgMTEgVGYgMCAzMCBUZCAoVFFTIFN0dWRpbyBWMiBwcm90b3R5cGUgZG9jdW1lbnQpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKMTAgMCBvYmoKPDwKL0xlbmd0aCAxMjYKPj4Kc3RyZWFtCkJUIC9GMiAxOCBUZiA3MiA3MjAgVGQgKFRpbWVsaW5lOiAyMDE0IC8gMjAyMiAvIDIwMjQgLSBQYWdlIDIpIFRqIC9GMSAxMSBUZiAwIDMwIFRkIChUUVMgU3R1ZGlvIFYyIHByb3RvdHlwZSBkb2N1bWVudCkgVGogRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMTEKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAxMDIgMDAwMDAgbiAKMDAwMDAwMDIwOSAwMDAwIG4gCjAwMDAwMDAzMjEgMDAwMDAgbiAKMDAwMDAwMDUxNCAwMDAwMCBuIAowMDAwMDAwNzA4IDAwMDAwIG4gCjAwMDAwMDA3NzYgMDAwMDAgbiAKMDAwMDAwMDkxNyAwMDAwMCBuIAowMDAwMDAwOTgyIDAwMDAwIG4gCjAwMDAwMDEwNTQgMDAwMDAgbiAKdHJhaWxlcgo8PAovUm9vdCA2IDAgUgovSW5mbyA3IDAgUgovU2l6ZSAxMQo+PgpzdGFydHhyZWYKMTEzMQolJUVPRgo=";

function PdfBlock({item,interactive,onData}:{item:StudioItem;interactive:boolean;onData:(d:Partial<BlockData>)=>void}) {
  const pageNumber=item.data.page||1, ref=useRef<HTMLCanvasElement>(null), [pages,setPages]=useState(2);
  useEffect(()=>{let cancelled=false;(async()=>{
    const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc=`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
    const bytes=Uint8Array.from(atob(PDF_BASE64),c=>c.charCodeAt(0));
    const pdf=await pdfjs.getDocument({data:bytes}).promise;if(cancelled)return;setPages(pdf.numPages);
    const p=await pdf.getPage(Math.min(pageNumber,pdf.numPages)), viewport=p.getViewport({scale:1.15}), canvas=ref.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");if(!ctx)return;canvas.width=viewport.width;canvas.height=viewport.height;
    await p.render({canvas,canvasContext:ctx,viewport}).promise;
  })();return()=>{cancelled=true}},[pageNumber]);
  return <div className={styles.pdfBlock} onPointerDown={e=>e.stopPropagation()}>
    <div className={styles.blockHead}><strong>{item.data.title}</strong><span>PDF.js · {pageNumber}/{pages}</span></div>
    <canvas ref={ref} data-testid="pdf-canvas"/>
    <div className={styles.pdfControls}>
      <button data-testid="pdf-prev" disabled={!interactive||pageNumber<=1} onClick={()=>onData({page:pageNumber-1})}>← Prev</button>
      <span>Page {pageNumber}</span>
      <button data-testid="pdf-next" disabled={!interactive||pageNumber>=pages} onClick={()=>onData({page:pageNumber+1})}>Next →</button>
    </div>
  </div>;
}

export default function StudioSpatialDomPrototype() {
  const canvasRef=useRef<HTMLElement>(null);
  const importRef=useRef<HTMLInputElement>(null);
  const [items,setItems]=useState<StudioItem[]>(initialItems);
  const [hydrated,setHydrated]=useState(false);
  const [mode,setMode]=useState<Mode>("edit");
  const [themeMode,setThemeMode]=useState<ThemeMode>("system");
  const [systemDark,setSystemDark]=useState(false);
  const [navMode,setNavMode]=useState<NavMode>("auto");
  const [detectedNav,setDetectedNav]=useState<"mouse"|"trackpad">("mouse");
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [interactingId,setInteractingId]=useState<string|null>(null);
  const [camera,setCamera]=useState({x:40,y:35,zoom:.66});
  const [presentFrame,setPresentFrame]=useState<"article"|"lesson">("article");
  const [context,setContext]=useState<{sx:number;sy:number;wx:number;wy:number}|null>(null);
  const [gesture,setGesture]=useState<null|{type:"move"|"resize"|"pan";id?:string;startX:number;startY:number;originX:number;originY:number;originW?:number;originH?:number}>(null);
  const [spaceDown,setSpaceDown]=useState(false);
  const [libraryCollapsed,setLibraryCollapsed]=useState(false);
  const [libraryTab,setLibraryTab]=useState<LibraryTab>("create");
  const [librarySearch,setLibrarySearch]=useState("");
  const [revision,setRevision]=useState(1);

  const resolvedTheme: "light"|"dark" = themeMode==="system"?(systemDark?"dark":"light"):themeMode;
  const effectiveNav = navMode==="auto"?detectedNav:navMode;

  useEffect(()=>{
    const media=window.matchMedia("(prefers-color-scheme: dark)");
    const sync=()=>setSystemDark(media.matches); sync(); media.addEventListener("change",sync);
    try{
      const raw=localStorage.getItem(STORAGE_KEY)||localStorage.getItem(LEGACY_STORAGE_KEY);
      if(raw)setItems(normalizeItems(JSON.parse(raw)));
      const th=localStorage.getItem(THEME_KEY) as ThemeMode|null;if(th&&["light","dark","system"].includes(th))setThemeMode(th);
      const nv=localStorage.getItem(NAV_KEY) as NavMode|null;if(nv&&["auto","mouse","trackpad"].includes(nv))setNavMode(nv);
      setLibraryCollapsed(localStorage.getItem(LIBRARY_KEY)==="1");
    }catch{}
    setHydrated(true);
    return()=>media.removeEventListener("change",sync);
  },[]);
  useEffect(()=>{if(hydrated)localStorage.setItem(STORAGE_KEY,JSON.stringify(items))},[items,hydrated]);
  useEffect(()=>{if(hydrated)localStorage.setItem(THEME_KEY,themeMode)},[themeMode,hydrated]);
  useEffect(()=>{if(hydrated)localStorage.setItem(NAV_KEY,navMode)},[navMode,hydrated]);
  useEffect(()=>{if(hydrated)localStorage.setItem(LIBRARY_KEY,libraryCollapsed?"1":"0")},[libraryCollapsed,hydrated]);

  const mutateItems=useCallback((fn:(prev:StudioItem[])=>StudioItem[])=>{
    setItems(prev=>fn(prev));
    setRevision(r=>r+1);
  },[]);
  const patchItem=useCallback((id:string,patch:Partial<StudioItem>)=>mutateItems(v=>v.map(i=>i.id===id?{...i,...patch}:i)),[mutateItems]);
  const patchData=useCallback((id:string,patch:Partial<BlockData>)=>mutateItems(v=>v.map(i=>i.id===id?{...i,data:{...i.data,...patch}}:i)),[mutateItems]);

  const addBlock=useCallback((kind:BlockKind,x:number,y:number,preset:PagePreset="article")=>{
    const d=blockDefaults(kind,preset), id=uid(kind), px=snap(x), py=snap(y);
    mutateItems(v=>{
      const parent=v.filter(i=>i.kind==="frame"&&px>=i.x&&py>=i.y&&px+d.w<=i.x+i.w&&py+d.h<=i.y+i.h)
        .sort((a,b)=>(a.w*a.h)-(b.w*b.h))[0];
      return [...v,{id,kind,x:px,y:py,w:d.w,h:d.h,z:Math.max(5,...v.map(i=>i.z||0))+1,parentId:parent?.id,data:d.data}];
    });
    setSelectedId(id);setInteractingId(null);setContext(null);
  },[mutateItems]);
  const addFrame=useCallback((x:number,y:number)=>{
    const id=uid("frame");
    mutateItems(v=>[...v,{id,kind:"frame",x:snap(x),y:snap(y),w:900,h:620,z:1,data:{title:"Frame · Scene"}}]);
    setSelectedId(id);setContext(null);
  },[mutateItems]);

  const moveItem=useCallback((id:string,nx:number,ny:number)=>{
    mutateItems(prev=>{
      const item=prev.find(i=>i.id===id); if(!item)return prev;
      const dx=snap(nx)-item.x,dy=snap(ny)-item.y;
      if(item.kind==="frame") return prev.map(i=>i.id===id?{...i,x:item.x+dx,y:item.y+dy}:i.parentId===id?{...i,x:i.x+dx,y:i.y+dy}:i);
      return prev.map(i=>i.id===id?{...i,x:snap(nx),y:snap(ny)}:i);
    });
  },[mutateItems]);

  const reset=useCallback(()=>{
    const clean=initialItems.map(i=>({...i,data:{...i.data}}));
    setItems(clean);setSelectedId(null);setInteractingId(null);setCamera({x:40,y:35,zoom:.66});setRevision(1);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(clean));
  },[]);

  const buildSnapshot=useCallback(():BoardSnapshot=>{
    const normalized=[...items].map(i=>({...i,data:{...i.data}})).sort((a,b)=>(a.z-b.z)||a.id.localeCompare(b.id));
    const sourceRefs=Array.from(new Set(normalized.flatMap(i=>i.data.sourceRefs||[]))).sort();
    const assets=normalized.flatMap(i=>i.data.assetRef?[{id:i.id,ref:i.data.assetRef}]:[]);
    return {
      schemaVersion:"tqs-studio-board/v1",boardId:BOARD_ID,revision,theme:themeMode,navigation:navMode,
      frames:normalized.filter(i=>i.kind==="frame"),blocks:normalized.filter(i=>i.kind!=="frame"),
      assets,sourceRefs,updatedAt:new Date().toISOString()
    };
  },[items,revision,themeMode,navMode]);

  const importSnapshot=useCallback((snapshot:BoardSnapshot)=>{
    if(!snapshot||snapshot.schemaVersion!=="tqs-studio-board/v1"||snapshot.boardId!==BOARD_ID||!Array.isArray(snapshot.frames)||!Array.isArray(snapshot.blocks)) return false;
    const restored=normalizeItems([...snapshot.frames,...snapshot.blocks]);
    setItems(restored);setThemeMode(snapshot.theme||"system");setNavMode(snapshot.navigation||"auto");setRevision(Number(snapshot.revision)||1);
    setSelectedId(null);setInteractingId(null);setContext(null);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(restored));
    return true;
  },[]);

  const downloadSnapshot=useCallback(()=>{
    const snapShot=buildSnapshot(), blob=new Blob([JSON.stringify(snapShot,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob), a=document.createElement("a");a.href=url;a.download="si-liquidity-history.board.snapshot.json";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),0);
  },[buildSnapshot]);

  useEffect(()=>{
    window.__TQS_STUDIO_V3__={exportSnapshot:buildSnapshot,importSnapshot,reset,getState:()=>({items,theme:themeMode,navigation:navMode,revision})};
    return()=>{delete window.__TQS_STUDIO_V3__};
  },[buildSnapshot,importSnapshot,reset,items,themeMode,navMode,revision]);

  const screenToWorld=(clientX:number,clientY:number)=>{
    const r=canvasRef.current!.getBoundingClientRect();
    return {x:(clientX-r.left-camera.x)/camera.zoom,y:(clientY-r.top-camera.y)/camera.zoom};
  };
  const startMove=(e:React.PointerEvent,item:StudioItem)=>{
    if(mode!=="edit"||item.locked||e.button!==0)return;
    e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);setSelectedId(item.id);setInteractingId(null);
    setGesture({type:"move",id:item.id,startX:e.clientX,startY:e.clientY,originX:item.x,originY:item.y});
  };
  const startResize=(e:React.PointerEvent,item:StudioItem)=>{
    if(mode!=="edit"||item.locked)return;e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setGesture({type:"resize",id:item.id,startX:e.clientX,startY:e.clientY,originX:item.x,originY:item.y,originW:item.w,originH:item.h});
  };
  const onPointerMove=(e:React.PointerEvent)=>{
    if(!gesture)return;
    if(gesture.type==="pan"){setCamera(c=>({...c,x:gesture.originX+(e.clientX-gesture.startX),y:gesture.originY+(e.clientY-gesture.startY)}));return}
    const id=gesture.id!, dx=(e.clientX-gesture.startX)/camera.zoom,dy=(e.clientY-gesture.startY)/camera.zoom;
    if(gesture.type==="move")moveItem(id,gesture.originX+dx,gesture.originY+dy);
    else patchItem(id,{w:Math.max(220,snap((gesture.originW||0)+dx)),h:Math.max(160,snap((gesture.originH||0)+dy))});
  };
  const onPointerUp=()=>setGesture(null);

  const zoomAt=useCallback((clientX:number,clientY:number,factor:number)=>{
    const el=canvasRef.current;if(!el)return;
    const r=el.getBoundingClientRect(),sx=clientX-r.left,sy=clientY-r.top;
    setCamera(c=>{
      const wx=(sx-c.x)/c.zoom,wy=(sy-c.y)/c.zoom;
      const nz=Math.max(.2,Math.min(2.8,c.zoom*factor));
      return {zoom:nz,x:sx-wx*nz,y:sy-wy*nz};
    });
  },[]);
  useEffect(()=>{
    const el=canvasRef.current;if(!el)return;
    const onWheel=(e:WheelEvent)=>{
      e.preventDefault();
      const looksTrackpad=e.ctrlKey||Math.abs(e.deltaX)>1||Math.abs(e.deltaY)<28;
      if(navMode==="auto")setDetectedNav(looksTrackpad?"trackpad":"mouse");
      const active=navMode==="auto"?(looksTrackpad?"trackpad":"mouse"):navMode;
      if(active==="trackpad"){
        if(e.ctrlKey) zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*.008));
        else setCamera(c=>({...c,x:c.x-e.deltaX,y:c.y-e.deltaY}));
        return;
      }
      if(e.shiftKey){setCamera(c=>({...c,x:c.x-e.deltaY}));return}
      zoomAt(e.clientX,e.clientY,e.deltaY<0?1.12:.89);
    };
    el.addEventListener("wheel",onWheel,{passive:false});
    return()=>el.removeEventListener("wheel",onWheel);
  },[navMode,zoomAt]);

  const fitBounds=useCallback((bounds:{x:number;y:number;w:number;h:number})=>{
    const el=canvasRef.current;if(!el)return;
    const r=el.getBoundingClientRect(),z=Math.max(.2,Math.min(1.4,Math.min((r.width-90)/bounds.w,(r.height-90)/bounds.h)));
    setCamera({zoom:z,x:(r.width-bounds.w*z)/2-bounds.x*z,y:(r.height-bounds.h*z)/2-bounds.y*z});
  },[]);
  const fitFrame=useCallback((id:string)=>{
    const item=items.find(i=>i.id===id);if(item)fitBounds(item);
  },[items,fitBounds]);
  const fitBoard=useCallback(()=>{
    const visible=items.filter(i=>!i.hidden);if(!visible.length)return;
    const minX=Math.min(...visible.map(i=>i.x)),minY=Math.min(...visible.map(i=>i.y));
    const maxX=Math.max(...visible.map(i=>i.x+i.w)),maxY=Math.max(...visible.map(i=>i.y+i.h));
    fitBounds({x:minX,y:minY,w:maxX-minX,h:maxY-minY});
  },[items,fitBounds]);
  const fitSelection=()=>{const i=items.find(x=>x.id===selectedId);if(i)fitBounds(i)};

  useEffect(()=>{if(mode==="present")fitFrame(presentFrame==="article"?ARTICLE_FRAME:LESSON_FRAME)},[mode,presentFrame,fitFrame]);
  useEffect(()=>{
    const isTyping=()=>{const el=document.activeElement as HTMLElement|null;return !!el&&(el.isContentEditable||["INPUT","TEXTAREA","SELECT"].includes(el.tagName))};
    const down=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){setInteractingId(null);setContext(null);return}
      if(e.key===" "&&!isTyping()){setSpaceDown(true);e.preventDefault()}
      if(e.key==="Enter"&&selectedId&&mode==="edit"&&!isTyping()){const i=items.find(x=>x.id===selectedId);if(i&&i.kind!=="frame")setInteractingId(selectedId)}
    };
    const up=(e:KeyboardEvent)=>{if(e.key===" ")setSpaceDown(false)};
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up)};
  },[selectedId,items,mode]);

  const selected=items.find(i=>i.id===selectedId)||null;
  const toolbar=useMemo(()=>selected?{left:camera.x+(selected.x+selected.w/2)*camera.zoom,top:camera.y+selected.y*camera.zoom}:null,[selected,camera]);
  const allLibraryItems=LIBRARY_GROUPS.flatMap(g=>g.items);
  const filteredGroups=LIBRARY_GROUPS.map(g=>({...g,items:g.items.filter(x=>x.label.toLowerCase().includes(librarySearch.toLowerCase()))})).filter(g=>g.items.length);

  const createAtCenter=(kind:BlockKind|"frame",preset?:PagePreset)=>{
    const r=canvasRef.current!.getBoundingClientRect(),p=screenToWorld(r.left+r.width/2,r.top+r.height/2);
    if(kind==="frame")addFrame(p.x,p.y); else addBlock(kind,p.x,p.y,preset||"article");
  };

  return <main className={styles.page} data-mode={mode} data-theme={resolvedTheme} data-theme-setting={themeMode}>
    <header className={styles.topbar}>
      <div className={styles.brand}><div className={styles.kicker}>TQS Studio · Spatial V3</div><strong>Si — liquidity history board</strong></div>
      <div className={styles.modeSwitch} data-testid="mode-switch">
        {(["edit","preview","present"] as Mode[]).map(m=><button key={m} data-testid={`mode-${m}`} className={mode===m?styles.activeMode:""} onClick={()=>{setMode(m);setInteractingId(null);if(m==="preview")fitBoard()}}>{m[0].toUpperCase()+m.slice(1)}</button>)}
      </div>
      <div className={styles.topActions}>
        <div className={styles.themeSwitch} data-testid="theme-switch">{(["light","dark","system"] as ThemeMode[]).map(t=><button key={t} data-testid={`theme-${t}`} className={themeMode===t?styles.activeTiny:""} onClick={()=>setThemeMode(t)}>{t==="system"?"System":t[0].toUpperCase()+t.slice(1)}</button>)}</div>
        {mode==="present"?<div className={styles.frameNav}>
          <button data-testid="present-frame-article" className={presentFrame==="article"?styles.activeMode:""} onClick={()=>setPresentFrame("article")}>01 Article</button>
          <button data-testid="present-frame-lesson" className={presentFrame==="lesson"?styles.activeMode:""} onClick={()=>setPresentFrame("lesson")}>02 Lesson</button>
        </div>:null}
        <button className={styles.iconAction} data-testid="fit-board" onClick={fitBoard} title="Fit board"><Maximize2 size={14}/></button>
        <button className={styles.reset} data-testid="reset-demo" onClick={reset}><RotateCcw size={14}/> Reset</button>
      </div>
    </header>

    <div className={styles.workspace}>
      {mode==="edit"?<aside className={`${styles.library} ${libraryCollapsed?styles.libraryCollapsed:""}`} data-testid="library" data-collapsed={libraryCollapsed?"true":"false"}>
        <div className={styles.libraryTop}>
          {!libraryCollapsed?<><div><div className={styles.libraryTitle}>Library</div><small>Board / Page / Frame</small></div></>:null}
          <button data-testid="library-collapse" className={styles.collapseButton} onClick={()=>setLibraryCollapsed(v=>!v)}>{libraryCollapsed?<PanelLeftOpen size={16}/>:<PanelLeftClose size={16}/>}</button>
        </div>
        <div className={styles.libraryTabs}>
          {(["create","board","drive","knowledge"] as LibraryTab[]).map(tab=><button key={tab} data-testid={`library-tab-${tab}`} title={tab.toUpperCase()} className={libraryTab===tab?styles.libraryTabActive:""} onClick={()=>{setLibraryTab(tab);if(libraryCollapsed)setLibraryCollapsed(false)}}>
            {tab==="create"?<Sparkles size={14}/>:tab==="board"?<Frame size={14}/>:tab==="drive"?<FileDown size={14}/>:<BookOpen size={14}/>}
            {!libraryCollapsed?<span>{tab.toUpperCase()}</span>:null}
          </button>)}
        </div>
        {!libraryCollapsed?<div className={styles.libraryBody}>
          {libraryTab==="create"?<>
            <label className={styles.librarySearch}><Search size={13}/><input data-testid="library-search" value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)} placeholder="Search blocks"/></label>
            {filteredGroups.map(group=><section key={group.title} className={styles.libraryGroup}><div>{group.title}</div>{group.items.map(x=><button key={x.kind+x.label} draggable data-testid={`library-${x.kind}${x.preset?"-"+x.preset:""}`}
              onDragStart={e=>{e.dataTransfer.setData("text/tqs-block",x.kind);if(x.preset)e.dataTransfer.setData("text/tqs-page-preset",x.preset)}}
              onClick={()=>createAtCenter(x.kind,x.preset)}>{x.icon}<span>{x.label}</span></button>)}</section>)}
            <div className={styles.libraryGroup}><div>Learning</div><span className={styles.placeholderText}>Lesson / Quiz · later gate</span></div>
          </>:null}
          {libraryTab==="board"?<div className={styles.boardList}>
            {items.slice().sort((a,b)=>a.id.localeCompare(b.id)).map(i=><button key={i.id} onClick={()=>{setSelectedId(i.id);fitBounds(i)}}><span>{i.kind}</span><b>{i.data.title}</b></button>)}
          </div>:null}
          {libraryTab==="drive"?<div className={styles.drivePanel} data-testid="drive-package-status">
            <strong>TQS STUDIO — BOARDS / Si</strong>
            <p>Folder <code>{DRIVE_BOARD_FOLDER}</code></p>
            <p>Manifest <code>{DRIVE_MANIFEST}</code></p>
            <div className={styles.driveFolders}><span>Assets · {DRIVE_ASSETS.slice(0,8)}…</span><span>Sources · {DRIVE_SOURCES.slice(0,8)}…</span><span>Exports · {DRIVE_EXPORTS.slice(0,8)}…</span></div>
            <div className={styles.driveStatus}>Drive sync: manual package fallback</div>
            <p className={styles.blockerText}>{DRIVE_AUTH_BLOCKER}</p>
            <button data-testid="export-board-package" onClick={downloadSnapshot}><FileJson size={14}/> Export Board Package</button>
            <button data-testid="import-board-package" onClick={()=>importRef.current?.click()}><Upload size={14}/> Import Board Package</button>
            <input ref={importRef} data-testid="import-board-file" hidden type="file" accept="application/json" onChange={async e=>{
              const file=e.target.files?.[0];if(!file)return;
              try{const parsed=JSON.parse(await file.text()) as BoardSnapshot;importSnapshot(parsed)}catch{}
              e.currentTarget.value="";
            }}/>
          </div>:null}
          {libraryTab==="knowledge"?<div className={styles.knowledgePanel}><BookOpen size={20}/><strong>TQS Knowledge</strong><p>Verified knowledge search is reserved for the production connector gate. V3 keeps the surface and source-ref contract without creating a duplicate backend.</p></div>:null}
        </div>:null}
      </aside>:null}

      <section ref={canvasRef} className={`${styles.canvasWrap} ${styles.domCanvas} ${spaceDown?styles.handActive:""}`} data-testid="spatial-canvas"
        onPointerDown={e=>{
          if(e.button===1||(spaceDown&&e.button===0)){e.preventDefault();setGesture({type:"pan",startX:e.clientX,startY:e.clientY,originX:camera.x,originY:camera.y});return}
          if(e.button===0&&e.target===e.currentTarget){setSelectedId(null);setInteractingId(null)}
        }}
        onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onContextMenu={e=>{if(mode!=="edit"||(e.target as HTMLElement).closest("[data-studio-item]"))return;e.preventDefault();const r=e.currentTarget.getBoundingClientRect(),p=screenToWorld(e.clientX,e.clientY);setContext({sx:e.clientX-r.left,sy:e.clientY-r.top,wx:p.x,wy:p.y})}}
        onDragOver={e=>{if(mode==="edit")e.preventDefault()}}
        onDrop={e=>{if(mode!=="edit")return;e.preventDefault();const k=e.dataTransfer.getData("text/tqs-block") as BlockKind|"frame";const preset=(e.dataTransfer.getData("text/tqs-page-preset")||"article") as PagePreset;if(k){const p=screenToWorld(e.clientX,e.clientY);if(k==="frame")addFrame(p.x,p.y);else addBlock(k,p.x,p.y,preset)}}}>

        <div data-testid="editor-bridge-ready" data-shape-count={items.length} data-snap-mode="on" data-engine="dom-spatial-v3" data-theme={themeMode} data-navigation={navMode} data-effective-navigation={effectiveNav} data-revision={revision} style={{display:"none"}}/>
        <div className={styles.canvasHud}>
          <div className={styles.navSwitch} data-testid="navigation-switch"><MousePointer2 size={13}/>{(["auto","mouse","trackpad"] as NavMode[]).map(n=><button key={n} data-testid={`nav-${n}`} className={navMode===n?styles.activeTiny:""} onClick={()=>setNavMode(n)}>{n.toUpperCase()}</button>)}</div>
          <button data-testid="fit-selection" disabled={!selectedId} onClick={fitSelection}>Fit selection</button>
          <span>{Math.round(camera.zoom*100)}%</span>
        </div>

        <div className={styles.domWorld} style={{transform:`translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})`}}>
          {items.filter(i=>i.kind==="frame").sort((a,b)=>a.z-b.z).map(item=><div key={item.id} data-studio-item data-testid={item.id===ARTICLE_FRAME?"studio-frame-article":item.id===LESSON_FRAME?"studio-frame-lesson":"studio-frame"}
            className={`${styles.domFrame} ${selectedId===item.id?styles.domSelected:""}`}
            style={{left:item.x,top:item.y,width:item.w,height:item.h,zIndex:item.z}}
            onPointerDownCapture={e=>{if(mode==="edit"&&e.button===0)setSelectedId(item.id)}}>
              {mode==="edit"?<div className={styles.domFrameTitle} data-testid="grab-zone" onPointerDown={e=>startMove(e,item)}><Frame size={13}/>{item.data.title}<span>grab</span></div>:null}
              {selectedId===item.id&&mode==="edit"?<span data-testid="resize-se" className={styles.resizeSE} onPointerDown={e=>startResize(e,item)}/>:null}
          </div>)}

          {items.filter(i=>i.kind!=="frame" && !(i.hidden&&mode!=="edit")).sort((a,b)=>a.z-b.z).map(item=>{
            const contentInteractive=mode!=="edit"||selectedId===item.id||item.kind==="chart"||item.kind==="video"||item.kind==="pdf";
            return <div key={item.id} data-studio-item data-testid={`studio-item-${item.kind}`} data-item-id={item.id}
              className={`${styles.domItem} ${selectedId===item.id?styles.domSelected:""} ${gesture?.id===item.id?styles.domDragging:""} ${item.hidden?styles.domHidden:""}`}
              style={{left:item.x,top:item.y,width:item.w,height:item.h,zIndex:item.z}}
              onPointerDownCapture={e=>{if(mode==="edit"&&e.button===0&&!spaceDown)setSelectedId(item.id)}}
              onDoubleClick={()=>{if(mode==="edit"){setSelectedId(item.id);setInteractingId(item.id)}}}>
              <div className={styles.shape}>
                {mode==="edit"?<div className={styles.grabZone} data-testid="grab-zone" onPointerDown={e=>startMove(e,item)}>
                  <Move size={12}/><span>{item.kind==="page"?(item.data.pagePreset==="a4"?"A4 Page":"Article Page"):item.kind}</span><b>DRAG</b>
                </div>:null}
                <div className={`${styles.shapeContent} ${mode!=="edit"?styles.shapeContentPreview:""}`}>
                  {item.kind==="richText"?<RichTextBlock item={item} interactive={mode!=="edit"||selectedId===item.id||interactingId===item.id} onData={d=>patchData(item.id,d)}/>:null}
                  {item.kind==="page"?<PageBlock item={item} editable={mode==="edit"&&(selectedId===item.id||interactingId===item.id)} onData={d=>patchData(item.id,d)}/>:null}
                  {item.kind==="chart"?<ChartBlock item={item} interactive={contentInteractive} theme={resolvedTheme} onData={d=>patchData(item.id,d)}/>:null}
                  {item.kind==="image"?<ImageBlock item={item}/>:null}
                  {item.kind==="video"?<VideoBlock item={item} interactive={contentInteractive}/>:null}
                  {item.kind==="pdf"?<PdfBlock item={item} interactive={contentInteractive} onData={d=>patchData(item.id,d)}/>:null}
                </div>
              </div>
              {selectedId===item.id&&mode==="edit"?<span data-testid="resize-se" className={styles.resizeSE} onPointerDown={e=>startResize(e,item)}/>:null}
            </div>;
          })}
          {gesture&&gesture.type!=="pan"?<><div className={styles.snapGuideV}/><div className={styles.snapGuideH}/></>:null}
        </div>

        {toolbar&&selected&&mode==="edit"?<div className={styles.selectionToolbar} data-testid="selection-toolbar" style={{left:toolbar.left,top:toolbar.top}}>
          <span>{selected.kind}</span>
          <button onClick={()=>{const id=uid(selected.kind);const copy={...selected,id,x:selected.x+35,y:selected.y+35,parentId:selected.kind==="frame"?undefined:selected.parentId,z:selected.z+1,data:{...selected.data}};mutateItems(v=>[...v,copy]);setSelectedId(id)}}>Duplicate</button>
          {selected.kind!=="frame"?<button data-testid="toggle-hidden" onClick={()=>patchItem(selected.id,{hidden:!selected.hidden})}>{selected.hidden?"Show":"Hide"}</button>:null}
          <button onClick={()=>patchItem(selected.id,{locked:!selected.locked})}>{selected.locked?"Unlock":"Lock"}</button>
          <button onClick={()=>{mutateItems(v=>v.filter(i=>i.id!==selected.id&&i.parentId!==selected.id));setSelectedId(null)}}>Delete</button>
        </div>:null}

        {context&&mode==="edit"?<div className={styles.domContext} data-testid="canvas-context-menu" style={{left:context.sx,top:context.sy}}>
          <div>Insert here</div>
          {allLibraryItems.map(x=><button key={x.kind+x.label} onClick={()=>x.kind==="frame"?addFrame(context.wx,context.wy):addBlock(x.kind as BlockKind,context.wx,context.wy,x.preset||"article")}>{x.icon}<span>{x.label}</span></button>)}
        </div>:null}

        {mode==="edit"?<div className={styles.moveHint}><Move size={13}/> Grab rim to move · content clicks interact · Esc returns selection · {effectiveNav.toUpperCase()} navigation</div>:null}
        {mode==="present"?<div className={styles.presentBadge}><Presentation size={14}/> Present · {presentFrame==="article"?"Article / Briefing":"Lesson / Presentation"}</div>:null}
        <div className={styles.packageBadge} data-testid="package-badge"><FileJson size={13}/> board.snapshot · rev {revision}</div>
      </section>
    </div>
  </main>;
}

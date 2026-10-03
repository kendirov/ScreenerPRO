"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor as useTiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import * as echarts from "echarts";
import {
  BarChart3, FileText, Frame, Image as ImageIcon, Maximize2, Move,
  Presentation, RotateCcw, Type, Video
} from "lucide-react";
import styles from "./studio-spatial-prototype.module.css";

type Mode = "edit" | "preview" | "present";
type BlockKind = "richText" | "chart" | "image" | "video" | "pdf";
type ItemKind = BlockKind | "frame";
type BlockData = {
  title: string; body?: string; caption?: string;
  period?: "1Y"|"3Y"|"ALL"; series?: "SI"|"RTS"|"BOTH"; page?: number;
};

type StudioItem = {
  id: string; kind: ItemKind; x: number; y: number; w: number; h: number;
  parentId?: string; hidden?: boolean; locked?: boolean; data: BlockData;
};

const STORAGE_KEY = "tqs-studio-spatial-v2-dom";
const ARTICLE_FRAME = "frame-article";
const LESSON_FRAME = "frame-lesson";
const SNAP = 10;

const initialItems: StudioItem[] = [
  { id: ARTICLE_FRAME, kind:"frame", x:120, y:120, w:1060, h:760, data:{title:"Frame 01 · Article / Briefing"} },
  { id: LESSON_FRAME, kind:"frame", x:1280, y:180, w:980, h:720, data:{title:"Frame 02 · Lesson / Presentation"} },
  { id:"article-text", kind:"richText", parentId:ARTICLE_FRAME, x:170, y:190, w:430, h:270, data:{title:"Rich Text",body:"<h2>Свободный текст на доске</h2><p>Выделите блок и нажмите Enter или дважды кликните, чтобы форматировать текст.</p>"} },
  { id:"article-chart", kind:"chart", parentId:ARTICLE_FRAME, x:620, y:190, w:480, h:330, data:{title:"Si / RTS liquidity shift",period:"ALL",series:"BOTH"} },
  { id:"article-image", kind:"image", parentId:ARTICLE_FRAME, x:170, y:500, w:400, h:300, data:{title:"Terminal image",caption:"Image block · volume profile reference"} },
  { id:"lesson-video", kind:"video", parentId:LESSON_FRAME, x:1325, y:250, w:430, h:410, data:{title:"Разбор Si — видео + transcript"} },
  { id:"lesson-pdf", kind:"pdf", parentId:LESSON_FRAME, x:1795, y:250, w:390, h:430, data:{title:"Research PDF",page:1} },
];

const LIBRARY: {kind:BlockKind;label:string;icon:React.ReactNode}[] = [
  {kind:"richText",label:"Rich Text",icon:<Type size={16}/>},
  {kind:"chart",label:"Market Chart",icon:<BarChart3 size={16}/>},
  {kind:"image",label:"Image",icon:<ImageIcon size={16}/>},
  {kind:"video",label:"Video + transcript",icon:<Video size={16}/>},
  {kind:"pdf",label:"PDF",icon:<FileText size={16}/>},
];

const CHART_DATA = {
  "1Y":[["Jan",82,64],["Mar",91,61],["May",105,59],["Jul",118,54],["Sep",112,48],["Nov",126,45]],
  "3Y":[["2024 H1",82,69],["2024 H2",96,63],["2025 H1",111,57],["2025 H2",122,51],["2026 H1",137,46],["2026 H2",129,42]],
  ALL:[["2012",58,100],["2014",100,82],["2018",119,62],["2022",148,36],["2024",134,31],["2026",129,42]],
} as const;

function uid(kind:BlockKind){ return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`; }
function snap(v:number){ return Math.round(v / SNAP) * SNAP; }
function blockDefaults(kind:BlockKind): Pick<StudioItem,"w"|"h"|"data"> {
  const all = {
    richText:{w:430,h:270,data:{title:"Rich Text",body:"<h2>Новый текст</h2><p>Двойной клик — редактирование.</p>"}},
    chart:{w:480,h:330,data:{title:"Si / RTS liquidity shift",period:"ALL" as const,series:"BOTH" as const}},
    image:{w:400,h:300,data:{title:"Terminal image",caption:"Image block · volume profile reference"}},
    video:{w:430,h:410,data:{title:"Разбор Si — видео + transcript"}},
    pdf:{w:390,h:430,data:{title:"Research PDF",page:1}},
  };
  return all[kind];
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
  return <div className={styles.richText}>
    {interactive?<div className={styles.formatBar} data-testid="rich-text-toolbar" onPointerDown={e=>e.stopPropagation()}>
      <button data-testid="format-bold" onClick={()=>editor?.chain().focus().toggleBold().run()}>B</button>
      <button onClick={()=>editor?.chain().focus().toggleItalic().run()}><i>I</i></button>
      <button onClick={()=>editor?.chain().focus().toggleHeading({level:2}).run()}>H2</button>
      <button onClick={()=>editor?.chain().focus().toggleBulletList().run()}>• List</button>
    </div>:null}
    <EditorContent editor={editor} data-testid="rich-text-editor"/>
  </div>;
}

function ChartBlock({item,interactive,onData}:{item:StudioItem;interactive:boolean;onData:(d:Partial<BlockData>)=>void}) {
  const period=item.data.period||"ALL", series=item.data.series||"BOTH", ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    let chart:echarts.ECharts|null=null;
    const raf=requestAnimationFrame(()=>{
      if(!ref.current||!ref.current.clientWidth||!ref.current.clientHeight)return;
      chart=echarts.init(ref.current);
      const rows=CHART_DATA[period];
      chart.setOption({
        animation:false, grid:{left:38,right:16,top:22,bottom:28},
        tooltip:{trigger:"axis",axisPointer:{type:"cross"}},
        xAxis:{type:"category",data:rows.map(r=>r[0]),axisLine:{lineStyle:{color:"#aaa"}}},
        yAxis:{type:"value",splitLine:{lineStyle:{color:"#ececea"}}},
        series:[
          ...(series!=="RTS"?[{name:"Si",type:"line",smooth:true,showSymbol:false,data:rows.map(r=>r[1]),lineStyle:{width:2,color:"#111"},itemStyle:{color:"#111"}}]:[]),
          ...(series!=="SI"?[{name:"RTS",type:"line",smooth:true,showSymbol:false,data:rows.map(r=>r[2]),lineStyle:{width:1.5,color:"#888"},itemStyle:{color:"#888"}}]:[]),
        ],
      });
    });
    const ro=new ResizeObserver(()=>chart?.resize()); if(ref.current)ro.observe(ref.current);
    return()=>{cancelAnimationFrame(raf);ro.disconnect();chart?.dispose()};
  },[period,series]);
  return <div className={styles.chartBlock}>
    <div className={styles.blockHead}><strong>{item.data.title}</strong><span>tooltip + crosshair</span></div>
    <div className={styles.chartControls} onPointerDown={e=>e.stopPropagation()}>
      {(["1Y","3Y","ALL"] as const).map(p=><button key={p} data-testid={`chart-period-${p}`} className={period===p?styles.controlActive:""} disabled={!interactive} onClick={()=>onData({period:p})}>{p}</button>)}
      {(["SI","RTS","BOTH"] as const).map(s=><button key={s} data-testid={`chart-series-${s}`} className={series===s?styles.controlActive:""} disabled={!interactive} onClick={()=>onData({series:s})}>{s}</button>)}
    </div>
    <div ref={ref} className={styles.chartStage} data-testid="market-chart"/>
  </div>;
}

function ImageBlock({item}:{item:StudioItem}) {
  return <figure className={styles.imageBlock}><div className={styles.marketImage} role="img" aria-label="Si terminal volume profile">
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
  return <div className={styles.videoBlock}>
    <div className={styles.blockHead}><strong>{item.data.title}</strong><span>click transcript → seek</span></div>
    <video ref={ref} data-testid="studio-video" src={VIDEO_URL} controls={interactive} muted playsInline/>
    <div className={styles.transcript}>{TRANSCRIPT.map(line=><button key={line.t} data-testid={`transcript-${line.t}`} disabled={!interactive}
      onPointerDown={e=>e.stopPropagation()} onClick={()=>{if(ref.current&&interactive){ref.current.currentTime=line.t;void ref.current.play().catch(()=>{})}}}>
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
  return <div className={styles.pdfBlock}>
    <div className={styles.blockHead}><strong>{item.data.title}</strong><span>PDF.js · {pageNumber}/{pages}</span></div>
    <canvas ref={ref} data-testid="pdf-canvas"/>
    <div className={styles.pdfControls} onPointerDown={e=>e.stopPropagation()}>
      <button data-testid="pdf-prev" disabled={!interactive||pageNumber<=1} onClick={()=>onData({page:pageNumber-1})}>← Prev</button>
      <span>Page {pageNumber}</span>
      <button data-testid="pdf-next" disabled={!interactive||pageNumber>=pages} onClick={()=>onData({page:pageNumber+1})}>Next →</button>
    </div>
  </div>;
}

export default function StudioSpatialDomPrototype() {
  const canvasRef=useRef<HTMLElement>(null);
  const [items,setItems]=useState<StudioItem[]>(initialItems);
  const [hydrated,setHydrated]=useState(false);
  const [mode,setMode]=useState<Mode>("edit");
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [interactingId,setInteractingId]=useState<string|null>(null);
  const [camera,setCamera]=useState({x:40,y:35,zoom:.66});
  const [presentFrame,setPresentFrame]=useState<"article"|"lesson">("article");
  const [context,setContext]=useState<{sx:number;sy:number;wx:number;wy:number}|null>(null);
  const [gesture,setGesture]=useState<null|{type:"move"|"resize"|"pan";id?:string;startX:number;startY:number;originX:number;originY:number;originW?:number;originH?:number}>(null);

  useEffect(()=>{try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)setItems(JSON.parse(raw))}catch{}setHydrated(true)},[]);
  useEffect(()=>{if(hydrated)localStorage.setItem(STORAGE_KEY,JSON.stringify(items))},[items,hydrated]);

  const patchItem=useCallback((id:string,patch:Partial<StudioItem>)=>setItems(v=>v.map(i=>i.id===id?{...i,...patch}:i)),[]);
  const patchData=useCallback((id:string,patch:Partial<BlockData>)=>setItems(v=>v.map(i=>i.id===id?{...i,data:{...i.data,...patch}}:i)),[]);
  const addBlock=useCallback((kind:BlockKind,x:number,y:number)=>{
    const d=blockDefaults(kind), id=uid(kind);
    setItems(v=>[...v,{id,kind,x:snap(x),y:snap(y),w:d.w,h:d.h,data:d.data}]);
    setSelectedId(id);setInteractingId(null);setContext(null);
  },[]);
  const moveItem=(id:string,nx:number,ny:number)=>{
    setItems(prev=>{
      const item=prev.find(i=>i.id===id); if(!item)return prev;
      const dx=snap(nx)-item.x,dy=snap(ny)-item.y;
      if(item.kind==="frame") return prev.map(i=>i.id===id?{...i,x:item.x+dx,y:item.y+dy}:i.parentId===id?{...i,x:i.x+dx,y:i.y+dy}:i);
      return prev.map(i=>i.id===id?{...i,x:snap(nx),y:snap(ny)}:i);
    });
  };
  const reset=()=>{setItems(initialItems.map(i=>({...i,data:{...i.data}})));setSelectedId(null);setInteractingId(null);localStorage.setItem(STORAGE_KEY,JSON.stringify(initialItems))};

  const screenToWorld=(clientX:number,clientY:number)=>{
    const r=canvasRef.current!.getBoundingClientRect();
    return {x:(clientX-r.left-camera.x)/camera.zoom,y:(clientY-r.top-camera.y)/camera.zoom};
  };
  const startMove=(e:React.PointerEvent,item:StudioItem)=>{
    if(mode!=="edit"||interactingId===item.id||item.locked||e.button!==0)return;
    e.stopPropagation();(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);setSelectedId(item.id);
    setGesture({type:"move",id:item.id,startX:e.clientX,startY:e.clientY,originX:item.x,originY:item.y});
  };
  const startResize=(e:React.PointerEvent,item:StudioItem)=>{
    if(mode!=="edit"||item.locked)return;e.stopPropagation();(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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

  const fitFrame=useCallback((id:string)=>{
    const el=canvasRef.current,item=items.find(i=>i.id===id);if(!el||!item)return;
    const r=el.getBoundingClientRect(),z=Math.min((r.width-70)/item.w,(r.height-70)/item.h,1.25);
    setCamera({zoom:z,x:(r.width-item.w*z)/2-item.x*z,y:(r.height-item.h*z)/2-item.y*z});
  },[items]);
  useEffect(()=>{if(mode==="present")fitFrame(presentFrame==="article"?ARTICLE_FRAME:LESSON_FRAME)},[mode,presentFrame,fitFrame]);

  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){setInteractingId(null);setContext(null)}
      if(e.key==="Enter"&&selectedId&&mode==="edit"){const i=items.find(x=>x.id===selectedId);if(i&&i.kind!=="frame")setInteractingId(selectedId)}
    };window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);
  },[selectedId,items,mode]);

  const selected=items.find(i=>i.id===selectedId)||null;
  const toolbar=useMemo(()=>selected?{left:camera.x+(selected.x+selected.w/2)*camera.zoom,top:camera.y+selected.y*camera.zoom}:null,[selected,camera]);

  return <main className={styles.page} data-mode={mode}>
    <header className={styles.topbar}>
      <div><div className={styles.kicker}>TQS Studio · Spatial Prototype V2</div><strong>Si — interactive canvas</strong></div>
      <div className={styles.modeSwitch} data-testid="mode-switch">
        {(["edit","preview","present"] as Mode[]).map(m=><button key={m} data-testid={`mode-${m}`} className={mode===m?styles.activeMode:""} onClick={()=>{setMode(m);setInteractingId(null);if(m==="preview"){setCamera({x:30,y:25,zoom:.66})}}}>{m[0].toUpperCase()+m.slice(1)}</button>)}
      </div>
      <div className={styles.topActions}>
        {mode==="present"?<div className={styles.frameNav}>
          <button data-testid="present-frame-article" className={presentFrame==="article"?styles.activeMode:""} onClick={()=>setPresentFrame("article")}>01 Article</button>
          <button data-testid="present-frame-lesson" className={presentFrame==="lesson"?styles.activeMode:""} onClick={()=>setPresentFrame("lesson")}>02 Lesson</button>
        </div>:null}
        <button className={styles.reset} data-testid="reset-demo" onClick={reset}><RotateCcw size={14}/> Reset</button>
      </div>
    </header>

    <div className={styles.workspace}>
      {mode==="edit"?<aside className={styles.library} data-testid="library">
        <div className={styles.libraryTitle}>Library</div><p>Drag to canvas or click to add in viewport center.</p>
        {LIBRARY.map(x=><button key={x.kind} draggable data-testid={`library-${x.kind}`}
          onDragStart={e=>e.dataTransfer.setData("text/tqs-block",x.kind)}
          onClick={()=>{const r=canvasRef.current!.getBoundingClientRect(),p=screenToWorld(r.left+r.width/2,r.top+r.height/2);addBlock(x.kind,p.x,p.y)}}>{x.icon}<span>{x.label}</span></button>)}
        <div className={styles.libraryDivider}/>
        <div className={styles.libraryHint}><Frame size={15}/><span>Frame moves children; child remains independently movable.</span></div>
        <div className={styles.libraryHint}><Maximize2 size={15}/><span>Wheel zoom · middle drag pan · 10px snap · corner resize.</span></div>
      </aside>:null}

      <section ref={canvasRef} className={`${styles.canvasWrap} ${styles.domCanvas}`} data-testid="spatial-canvas"
        onWheel={e=>{e.preventDefault();const r=e.currentTarget.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top,wx=(sx-camera.x)/camera.zoom,wy=(sy-camera.y)/camera.zoom,nz=Math.max(.25,Math.min(2.5,camera.zoom*(e.deltaY<0?1.12:.89)));setCamera({zoom:nz,x:sx-wx*nz,y:sy-wy*nz})}}
        onPointerDown={e=>{if(e.button===1){e.preventDefault();setGesture({type:"pan",startX:e.clientX,startY:e.clientY,originX:camera.x,originY:camera.y})}else if(e.button===0&&e.target===e.currentTarget){setSelectedId(null);setInteractingId(null)}}}
        onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onContextMenu={e=>{if(mode!=="edit"||(e.target as HTMLElement).closest("[data-studio-item]"))return;e.preventDefault();const r=e.currentTarget.getBoundingClientRect(),p=screenToWorld(e.clientX,e.clientY);setContext({sx:e.clientX-r.left,sy:e.clientY-r.top,wx:p.x,wy:p.y})}}
        onDragOver={e=>{if(mode==="edit")e.preventDefault()}}
        onDrop={e=>{if(mode!=="edit")return;e.preventDefault();const k=e.dataTransfer.getData("text/tqs-block") as BlockKind;if(k){const p=screenToWorld(e.clientX,e.clientY);addBlock(k,p.x,p.y)}}}>

        <div data-testid="editor-bridge-ready" data-shape-count={items.length} data-snap-mode="on" data-engine="dom-spatial" style={{display:"none"}}/>
        <div className={styles.domWorld} style={{transform:`translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})`}}>
          {items.filter(i=>i.kind==="frame").map(item=><div key={item.id} data-studio-item data-testid={item.id===ARTICLE_FRAME?"studio-frame-article":"studio-frame-lesson"}
            className={`${styles.domFrame} ${selectedId===item.id?styles.domSelected:""}`}
            style={{left:item.x,top:item.y,width:item.w,height:item.h}}
            onPointerDown={e=>startMove(e,item)} onDoubleClick={()=>setSelectedId(item.id)}>
              <div className={styles.domFrameTitle}><Frame size={13}/>{item.data.title}</div>
              {selectedId===item.id&&mode==="edit"?<span data-testid="resize-se" className={styles.resizeSE} onPointerDown={e=>startResize(e,item)}/>:null}
          </div>)}

          {items.filter(i=>i.kind!=="frame" && !(i.hidden&&mode!=="edit")).map(item=>{
            const interactive=interactingId===item.id||mode!=="edit";
            return <div key={item.id} data-studio-item data-testid={`studio-item-${item.kind}`} data-item-id={item.id}
              className={`${styles.domItem} ${selectedId===item.id?styles.domSelected:""} ${item.hidden?styles.domHidden:""}`}
              style={{left:item.x,top:item.y,width:item.w,height:item.h}}
              onPointerDown={e=>startMove(e,item)} onDoubleClick={e=>{if(mode==="edit"){e.stopPropagation();setSelectedId(item.id);setInteractingId(item.id)}}}>
              <div className={`${styles.shape} ${interactive?styles.shapeEditing:""}`}>
                <div className={styles.shapeLabel}><Move size={12}/><span>{item.kind}</span>{interactive&&mode==="edit"?<b>INTERACT</b>:null}</div>
                <div className={styles.shapeContent} data-testid={`studio-shape-${item.kind}`} style={{pointerEvents:interactive?"auto":"none"}}>
                  {item.kind==="richText"?<RichTextBlock item={item} interactive={interactive} onData={d=>patchData(item.id,d)}/>:null}
                  {item.kind==="chart"?<ChartBlock item={item} interactive={interactive} onData={d=>patchData(item.id,d)}/>:null}
                  {item.kind==="image"?<ImageBlock item={item}/>:null}
                  {item.kind==="video"?<VideoBlock item={item} interactive={interactive}/>:null}
                  {item.kind==="pdf"?<PdfBlock item={item} interactive={interactive} onData={d=>patchData(item.id,d)}/>:null}
                </div>
              </div>
              {selectedId===item.id&&mode==="edit"&&interactingId!==item.id?<span data-testid="resize-se" className={styles.resizeSE} onPointerDown={e=>startResize(e,item)}/>:null}
            </div>;
          })}
          {gesture&&gesture.type!=="pan"?<><div className={styles.snapGuideV}/><div className={styles.snapGuideH}/></>:null}
        </div>

        {toolbar&&selected&&mode==="edit"&&interactingId!==selected.id?<div className={styles.selectionToolbar} data-testid="selection-toolbar" style={{left:toolbar.left,top:toolbar.top}}>
          <span>{selected.kind}</span>
          <button onClick={()=>{const id=uid(selected.kind==="frame"?"richText":selected.kind as BlockKind);const copy={...selected,id,x:selected.x+35,y:selected.y+35,parentId:selected.kind==="frame"?undefined:selected.parentId};setItems(v=>[...v,copy]);setSelectedId(id)}}>Duplicate</button>
          {selected.kind!=="frame"?<button data-testid="toggle-hidden" onClick={()=>patchItem(selected.id,{hidden:!selected.hidden})}>{selected.hidden?"Show":"Hide"}</button>:null}
          <button onClick={()=>patchItem(selected.id,{locked:!selected.locked})}>{selected.locked?"Unlock":"Lock"}</button>
          <button onClick={()=>{setItems(v=>v.filter(i=>i.id!==selected.id&&i.parentId!==selected.id));setSelectedId(null)}}>Delete</button>
        </div>:null}

        {context&&mode==="edit"?<div className={styles.domContext} data-testid="canvas-context-menu" style={{left:context.sx,top:context.sy}}>
          <div>Insert here</div>
          {LIBRARY.map(x=><button key={x.kind} onClick={()=>addBlock(x.kind,context.wx,context.wy)}>{x.icon}<span>{x.label}</span></button>)}
        </div>:null}

        {mode==="edit"?<div className={styles.moveHint}><Move size={13}/> Move mode · double-click / Enter to interact · Esc to exit</div>:null}
        {mode==="present"?<div className={styles.presentBadge}><Presentation size={14}/> Present · {presentFrame==="article"?"Article / Briefing":"Lesson / Presentation"}</div>:null}
      </section>
    </div>
  </main>;
}

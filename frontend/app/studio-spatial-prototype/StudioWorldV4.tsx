"use client";

import React, {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {EditorContent,useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import * as echarts from "echarts";
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, CircleDot,
  FileDown, FileJson, FileText, Frame, Heart, Image as ImageIcon, Inbox, Layers3,
  Link as LinkIcon, ListTodo, Maximize2, Mic, Moon, MoreHorizontal, MousePointer2,
  PanelLeftClose, PanelLeftOpen, PenLine, Play, Plus, RotateCcw, Search, Settings,
  Sparkles, SquarePen, Star, Sun, Type, Upload, Video, Volume2, X
} from "lucide-react";
import styles from "./studio-world-v4.module.css";

type ThemeMode="light"|"dark";
type Surface="world"|"documents";
type Kind="frame"|"text"|"task"|"image"|"chart"|"video"|"pdf"|"voice"|"documentRef"|"link"|"annotation";
type AnnotationKind="pencil"|"marker"|"arrow"|"label";
type Relation={type:"contains"|"spatial_context"|"annotates"|"targets"|"references"|"depends_on"|"derived_from"|"document_of";targetId:string};
type Item={
  id:string;kind:Kind;semanticPath:string;parentId?:string;x:number;y:number;w:number;h:number;z:number;
  title:string;body?:string;status?:string;done?:boolean;assetUrl?:string;audioUrl?:string;duration?:number;
  createdAt:string;updatedAt:string;relations:Relation[];annotationKind?:AnnotationKind;points?:{x:number;y:number}[];
  page?:number;period?:"1Y"|"3Y"|"ALL";series?:"SI"|"RTS"|"BOTH";hidden?:boolean;
};
type DocBlock={id:string;type:"heading"|"text"|"callout"|"image"|"chart"|"video"|"source"|"divider";content:string;ref?:string};
type StudioDocument={id:string;kind:"article"|"lesson"|"handout"|"instruction";title:string;semanticPath:string;frameId?:string;blocks:DocBlock[];revision:number;status:string};
type Activity={id:string;entityId:string;semanticPath:string;type:"create"|"voice"|"annotate"|"task"|"text_update"|"image_paste"|"document_link"|"semantic_reparent";timestamp:string;summary:string;status:"NEW"|"IN_REVIEW"|"DONE"};
type Snapshot={schemaVersion:"tqs-studio-world/v4";revision:number;theme:ThemeMode;grid:boolean;items:Item[];documents:StudioDocument[];activity:Activity[];updatedAt:string};

declare global{interface Window{__TQS_STUDIO_V4__?:{
  exportSnapshot:()=>Snapshot;importSnapshot:(v:Snapshot)=>boolean;reset:()=>void;
  queryActivity:(q:{semanticPath?:string;since?:string;status?:Activity["status"]})=>Activity[];
  getState:()=>{items:Item[];documents:StudioDocument[];activity:Activity[];revision:number;surface:Surface};
}}}

const STORAGE="tqs-studio-world-v4";
const now=()=>new Date().toISOString();
const uid=(p:string)=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
const SNAP=10;
const snap=(n:number)=>Math.round(n/SNAP)*SNAP;
const readDataUrl=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=()=>reject(r.error);r.readAsDataURL(blob)});
const WORLD_W=7200,WORLD_H=4200;

const FRAME_AGENT="frame-agent";
const FRAME_TQS="frame-tqs";
const FRAME_LEARNING="frame-learning";
const FRAME_ARTICLES="frame-articles";
const FRAME_INBOX="frame-inbox";
const COURSE_FREE="course-free";
const COURSE_SCALP="course-scalp";
const LESSON_WORKSPACE="lesson-free-1";
const ARTICLE_SI="article-si-frame";
const DOC_SI="doc-si";
const DOC_LESSON="doc-lesson-workspace";

const seedItems=():Item[]=>{
 const t=now();
 return [
  {id:FRAME_AGENT,kind:"frame",semanticPath:"ARTEM OS/Agent",x:260,y:300,w:1180,h:850,z:1,title:"ARTEM OS / Agent",createdAt:t,updatedAt:t,relations:[]},
  {id:FRAME_TQS,kind:"frame",semanticPath:"TQS/Trading/Intelligence",x:2050,y:240,w:1500,h:930,z:1,title:"TQS / Trading / Intelligence",createdAt:t,updatedAt:t,relations:[]},
  {id:FRAME_LEARNING,kind:"frame",semanticPath:"Обучение",x:3900,y:260,w:2300,h:1700,z:1,title:"Обучение",createdAt:t,updatedAt:t,relations:[]},
  {id:FRAME_ARTICLES,kind:"frame",semanticPath:"Статьи",x:600,y:1800,w:1650,h:1000,z:1,title:"Статьи",createdAt:t,updatedAt:t,relations:[]},
  {id:FRAME_INBOX,kind:"frame",semanticPath:"Inbox",x:2700,y:1780,w:1200,h:900,z:1,title:"Inbox",createdAt:t,updatedAt:t,relations:[]},
  {id:COURSE_FREE,kind:"frame",semanticPath:"Обучение/Бесплатный курс",parentId:FRAME_LEARNING,x:4100,y:520,w:920,h:1180,z:2,title:"Бесплатный курс",createdAt:t,updatedAt:t,relations:[{type:"contains",targetId:FRAME_LEARNING}]},
  {id:COURSE_SCALP,kind:"frame",semanticPath:"Обучение/Скальпинг по стакану",parentId:FRAME_LEARNING,x:5160,y:520,w:850,h:1180,z:2,title:"Скальпинг по стакану",createdAt:t,updatedAt:t,relations:[{type:"contains",targetId:FRAME_LEARNING}]},
  ...["Рабочее пространство","Стакан и лента","Базовая подготовка"].map((title,i)=>({id:`lesson-free-${i+1}`,kind:"frame" as Kind,semanticPath:`Обучение/Бесплатный курс/Занятие ${i+1}`,parentId:COURSE_FREE,x:4210,y:720+i*300,w:700,h:240,z:3,title:`Занятие ${i+1} — ${title}`,createdAt:t,updatedAt:t,relations:[{type:"contains" as const,targetId:COURSE_FREE}]})),
  ...["Чтение стакана","Плотности и реакции","Работа с импульсом"].map((title,i)=>({id:`lesson-scalp-${i+1}`,kind:"frame" as Kind,semanticPath:`Обучение/Скальпинг по стакану/Занятие ${i+1}`,parentId:COURSE_SCALP,x:5260,y:720+i*300,w:640,h:240,z:3,title:`Занятие ${i+1} — ${title}`,createdAt:t,updatedAt:t,relations:[{type:"contains" as const,targetId:COURSE_SCALP}]})),
  {id:"agent-summary",kind:"text",semanticPath:"ARTEM OS/Agent/Summary",parentId:FRAME_AGENT,x:380,y:520,w:470,h:220,z:5,title:"Сводка Agent",body:"Последнее состояние, свежие изменения и следующий проверяемый шаг.",createdAt:t,updatedAt:t,relations:[]},
  {id:"agent-next",kind:"task",semanticPath:"ARTEM OS/Agent/Next",parentId:FRAME_AGENT,x:900,y:520,w:390,h:210,z:5,title:"Следующая задача",body:"Проверить свежий Agent state",status:"NEW",createdAt:t,updatedAt:t,relations:[]},
  {id:"tqs-chart",kind:"chart",semanticPath:"TQS/Trading/Intelligence/Liquidity",parentId:FRAME_TQS,x:2230,y:520,w:650,h:420,z:5,title:"Si / RTS — сдвиг ликвидности",period:"ALL",series:"BOTH",createdAt:t,updatedAt:t,relations:[]},
  {id:"tqs-video",kind:"video",semanticPath:"TQS/Trading/Intelligence/Video",parentId:FRAME_TQS,x:2970,y:520,w:430,h:420,z:5,title:"Разбор Si",createdAt:t,updatedAt:t,relations:[]},
  {id:ARTICLE_SI,kind:"documentRef",semanticPath:"Статьи/Si — история ликвидности",parentId:FRAME_ARTICLES,x:820,y:2070,w:650,h:280,z:5,title:"Статья — Si: история ликвидности",body:"Связанный линейный документ. Содержимое не копируется на World.",createdAt:t,updatedAt:t,relations:[{type:"document_of",targetId:DOC_SI}]},
  {id:"lesson-doc-ref",kind:"documentRef",semanticPath:"Обучение/Бесплатный курс/Занятие 1",parentId:LESSON_WORKSPACE,x:4290,y:780,w:520,h:120,z:6,title:"Открыть документ занятия",createdAt:t,updatedAt:t,relations:[{type:"document_of",targetId:DOC_LESSON}]},
 ];
};

const seedDocs=():StudioDocument[]=>[
 {id:DOC_SI,kind:"article",title:"Статья — Si: история ликвидности",semanticPath:"Статьи/Si — история ликвидности",frameId:ARTICLE_SI,revision:1,status:"Черновик",blocks:[
  {id:"si-h1",type:"heading",content:"Si: история ликвидности и объёмов"},
  {id:"si-t1",type:"text",content:"Линейная редакционная поверхность связана с World, но не хранит x/y координаты."},
  {id:"si-c1",type:"callout",content:"Ключевой принцип: один смысловой объект — несколько связанных представлений без копирования содержимого."},
  {id:"si-chart",type:"chart",content:"Интерактивный график ликвидности",ref:"tqs-chart"},
  {id:"si-src",type:"source",content:"Источник: существующий Si package на Google Drive",ref:"1UJVJUBPt5pEHmjmb79Pllm-hyIij0DkD"},
  {id:"si-div",type:"divider",content:""},
  {id:"si-t2",type:"text",content:"Здесь продолжается статья: 2014 → 2022 → переход к новым инструментам и структуре рынка."},
 ]},
 {id:DOC_LESSON,kind:"lesson",title:"Занятие 1 — Рабочее пространство",semanticPath:"Обучение/Бесплатный курс/Занятие 1",frameId:LESSON_WORKSPACE,revision:1,status:"Черновик",blocks:[
  {id:"l-h1",type:"heading",content:"Занятие 1 — Рабочее пространство"},
  {id:"l-t1",type:"text",content:"Настраиваем рабочее пространство так, чтобы график, стакан, лента и заметки помогали принимать решения, а не отвлекали."},
  {id:"l-call",type:"callout",content:"Практика: оставляем на экране только то, что влияет на торговое решение."},
  {id:"l-img",type:"image",content:"Скриншот рабочего пространства",ref:"demo:workspace"},
  {id:"l-video",type:"video",content:"Видео-разбор рабочего пространства",ref:"tqs-video"},
  {id:"l-src",type:"source",content:"Связано с Frame на общей доске",ref:LESSON_WORKSPACE},
 ]}
];

const CHART={
 "1Y":[["Янв",82,64],["Мар",91,61],["Май",105,59],["Июл",118,54],["Сен",112,48],["Ноя",126,45]],
 "3Y":[["2024 H1",82,69],["2024 H2",96,63],["2025 H1",111,57],["2025 H2",122,51],["2026 H1",137,46],["2026 H2",129,42]],
 ALL:[["2012",58,100],["2014",100,82],["2018",119,62],["2022",148,36],["2024",134,31],["2026",129,42]],
} as const;

function ChartCard({item,dark,onChange}:{item:Item;dark:boolean;onChange:(p:Partial<Item>)=>void}){
 const ref=useRef<HTMLDivElement>(null),period=item.period||"ALL",series=item.series||"BOTH";
 useEffect(()=>{if(!ref.current)return;const c=echarts.init(ref.current);const rows=CHART[period];
 c.setOption({animation:false,backgroundColor:"transparent",grid:{left:34,right:12,top:20,bottom:25},tooltip:{trigger:"axis"},xAxis:{type:"category",data:rows.map(r=>r[0]),axisLabel:{color:dark?"#9d978d":"#706b63"}},yAxis:{type:"value",axisLabel:{color:dark?"#9d978d":"#706b63"},splitLine:{lineStyle:{color:dark?"#25231f":"#e9e4db"}}},series:[
  ...(series!=="RTS"?[{name:"Si",type:"line",smooth:true,showSymbol:false,data:rows.map(r=>r[1]),lineStyle:{width:2,color:"#d2a64b"}}]:[]),
  ...(series!=="SI"?[{name:"RTS",type:"line",smooth:true,showSymbol:false,data:rows.map(r=>r[2]),lineStyle:{width:1.5,color:dark?"#918b80":"#77736c"}}]:[])
 ]});const ro=new ResizeObserver(()=>c.resize());ro.observe(ref.current);return()=>{ro.disconnect();c.dispose()}},[period,series,dark]);
 return <div className={styles.chartCard} onPointerDown={e=>e.stopPropagation()}>
  <div className={styles.inlineControls}>{(["1Y","3Y","ALL"] as const).map(p=><button key={p} data-testid={"chart-period-"+p} className={period===p?styles.activeChip:""} onClick={()=>onChange({period:p})}>{p}</button>)}{(["SI","RTS","BOTH"] as const).map(s=><button key={s} className={series===s?styles.activeChip:""} onClick={()=>onChange({series:s})}>{s}</button>)}</div>
  <div ref={ref} className={styles.chartStage} data-testid="market-chart"/>
 </div>
}

function TextCard({item,onChange}:{item:Item;onChange:(p:Partial<Item>)=>void}){
 const editor=useEditor({extensions:[StarterKit],content:item.body||"<p>Текст</p>",immediatelyRender:false,onUpdate:({editor:e})=>onChange({body:e.getHTML()})});
 const [bubble,setBubble]=useState(false);
 useEffect(()=>{const onSel=()=>{if(!editor?.isFocused){setBubble(false);return}const s=window.getSelection();setBubble(!!s&&!s.isCollapsed)};document.addEventListener("selectionchange",onSel);return()=>document.removeEventListener("selectionchange",onSel)},[editor]);
 return <div className={styles.textCard} onPointerDown={e=>e.stopPropagation()}>
   {bubble?<div className={styles.bubble} data-testid="text-bubble-menu">
    <button onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().toggleHeading({level:2}).run()}>H2</button>
    <button onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().toggleBold().run()}><b>B</b></button>
    <button onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().toggleItalic().run()}><i>I</i></button>
    <button onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().toggleBulletList().run()}>•</button>
    <button onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().toggleBlockquote().run()}>“”</button>
   </div>:null}
   <EditorContent editor={editor} data-testid="rich-text-editor"/>
 </div>
}

function VoiceCard({item,onChange}:{item:Item;onChange:(p:Partial<Item>)=>void}){
 const recorder=useRef<MediaRecorder|null>(null),chunks=useRef<Blob[]>([]),started=useRef(0);
 const [recording,setRecording]=useState(false);
 const begin=async()=>{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const r=new MediaRecorder(stream);chunks.current=[];r.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};r.onstop=()=>{const b=new Blob(chunks.current,{type:r.mimeType||"audio/webm"});void readDataUrl(b).then(audioUrl=>onChange({audioUrl,duration:Math.max(1,Math.round((Date.now()-started.current)/1000)),status:"Ожидает расшифровки"}));stream.getTracks().forEach(t=>t.stop())};started.current=Date.now();r.start();recorder.current=r;setRecording(true)};
 const stop=()=>{recorder.current?.stop();setRecording(false)};
 return <div className={styles.voiceCard} onPointerDown={e=>e.stopPropagation()}>
  <button data-testid="voice-record" className={recording?styles.recording:""} onClick={recording?stop:begin}>{recording?<SquarePen size={16}/>:<Mic size={16}/>} {recording?"Остановить":"Записать"}</button>
  {item.audioUrl?<audio controls src={item.audioUrl} data-testid="voice-playback"/>:<span>Аудио ещё не записано</span>}
  <div><small>{item.duration?item.duration+" сек · ":""}{item.status||"Готово к записи"} · {new Date(item.createdAt).toLocaleString("ru-RU")}</small></div>
  <div className={styles.semanticPath}>{item.semanticPath}</div>
 </div>
}

function VideoCard(){
 const ref=useRef<HTMLVideoElement>(null);
 return <div className={styles.videoCard} onPointerDown={e=>e.stopPropagation()}>
  <video ref={ref} controls muted playsInline src="https://www.w3schools.com/html/mov_bbb.mp4" data-testid="studio-video"/>
  <div className={styles.transcript}>{[[0,"00:00"],[4,"00:04"],[8,"00:08"]].map(([t,l])=><button key={t} data-testid={"transcript-"+t} onClick={()=>{if(ref.current){ref.current.currentTime=Number(t);void ref.current.play().catch(()=>{})}}}>{l} → перейти</button>)}</div>
 </div>
}
function PdfCard({item,onChange}:{item:Item;onChange:(p:Partial<Item>)=>void}){
 const p=item.page||1;
 return <div className={styles.pdfCard} onPointerDown={e=>e.stopPropagation()}>
  <div className={styles.pdfSheet}><b>Research PDF</b><span>Страница {p} / 2</span><p>{p===1?"Si: futures liquidity notes":"Timeline: 2014 / 2022 / 2024"}</p></div>
  <div><button data-testid="pdf-prev" disabled={p<=1} onClick={()=>onChange({page:p-1})}><ArrowLeft size={14}/></button><button data-testid="pdf-next" disabled={p>=2} onClick={()=>onChange({page:p+1})}><ArrowRight size={14}/></button></div>
 </div>
}

const DOC_BLOCK_LABEL:Record<DocBlock["type"],string>={heading:"Заголовок",text:"Текст",callout:"Выделение",image:"Изображение",chart:"График",video:"Видео",source:"Источник",divider:"Разделитель"};
function DocEditor({doc,onDoc,goWorld,onPin}:{doc:StudioDocument;onDoc:(d:StudioDocument)=>void;goWorld:()=>void;onPin:()=>void}){
 const update=(id:string,content:string)=>onDoc({...doc,revision:doc.revision+1,blocks:doc.blocks.map(b=>b.id===id?{...b,content}:b)});
 const add=(type:DocBlock["type"])=>onDoc({...doc,revision:doc.revision+1,blocks:[...doc.blocks,{id:uid("db"),type,content:type==="divider"?"":"Новый блок"}]});
 return <article className={styles.documentEditor} data-testid="document-editor">
  <header><div><span>{doc.kind==="lesson"?"Занятие":"Статья"}</span><h1>{doc.title}</h1><p>{doc.semanticPath} · ревизия {doc.revision}</p></div><div className={styles.docHeaderActions}><button data-testid="pin-on-world" onClick={onPin}><LinkIcon size={15}/> Закрепить на Мире</button><button data-testid="show-on-board" onClick={goWorld}><CircleDot size={15}/> Показать на доске</button></div></header>
  <div className={styles.docFlow}>
   {doc.blocks.map(b=>b.type==="divider"?<hr key={b.id}/>:<section key={b.id} className={styles["doc_"+b.type]}>
    <span>{b.type==="heading"?"Заголовок":b.type==="callout"?"Выделение":b.type==="image"?"Изображение":b.type==="chart"?"График":b.type==="video"?"Видео":b.type==="source"?"Источник":"Текст"}</span>
    {(b.type==="chart"||b.type==="video"||b.type==="image")?<div className={styles.docRef}><Layers3 size={18}/><b>{b.content}</b><small>{b.ref||"reference"}</small></div>:<div contentEditable suppressContentEditableWarning onBlur={e=>update(b.id,e.currentTarget.innerText)}>{b.content}</div>}
   </section>)}
  </div>
  <footer className={styles.docAdd}><span>Добавить блок:</span>{(["text","callout","image","chart","video","source","divider"] as DocBlock["type"][]).map(t=><button key={t} onClick={()=>add(t)}>{DOC_BLOCK_LABEL[t]}</button>)}</footer>
 </article>
}

export default function StudioWorldV4(){
 const [items,setItems]=useState<Item[]>(seedItems),[documents,setDocuments]=useState<StudioDocument[]>(seedDocs),[activity,setActivity]=useState<Activity[]>([]);
 const [theme,setTheme]=useState<ThemeMode>("dark"),[grid,setGrid]=useState(false),[surface,setSurface]=useState<Surface>("world"),[revision,setRevision]=useState(1);
 const [camera,setCamera]=useState({x:30,y:20,zoom:.55}),[selected,setSelected]=useState<string|null>(null),[context,setContext]=useState<{sx:number;sy:number;wx:number;wy:number}|null>(null);
 const [navOpen,setNavOpen]=useState(true),[navSection,setNavSection]=useState("Проекты"),[docId,setDocId]=useState(DOC_SI),[settings,setSettings]=useState(false);
 const [frameView,setFrameView]=useState<"none"|"preview"|"present">("none");
 const [gesture,setGesture]=useState<any>(null),[space,setSpace]=useState(false),[drawing,setDrawing]=useState<AnnotationKind|null>(null),[draftPoints,setDraftPoints]=useState<{x:number;y:number}[]>([]);
 const canvas=useRef<HTMLElement|null>(null),importRef=useRef<HTMLInputElement>(null);
 const selectedItem=items.find(i=>i.id===selected)||null;

 const log=useCallback((entityId:string,semanticPath:string,type:Activity["type"],summary:string)=>{
  setActivity(v=>[{id:uid("evt"),entityId,semanticPath,type,timestamp:now(),summary,status:"NEW" as const},...v].slice(0,250));
 },[]);
 const mutate=(fn:(v:Item[])=>Item[],event?:()=>void)=>{setItems(v=>fn(v));setRevision(r=>r+1);event?.()};
 const patch=(id:string,p:Partial<Item>,eventType?:Activity["type"])=>mutate(v=>v.map(i=>i.id===id?{...i,...p,updatedAt:now()}:i),()=>{const i=items.find(x=>x.id===id);if(i&&eventType)log(id,i.semanticPath,eventType,`${eventType}: ${i.title}`)});
 const queryActivity=useCallback((q:{semanticPath?:string;since?:string;status?:Activity["status"]})=>activity.filter(a=>(!q.semanticPath||a.semanticPath.startsWith(q.semanticPath))&&(!q.since||a.timestamp>=q.since)&&(!q.status||a.status===q.status)),[activity]);

 const snapshot=useCallback(():Snapshot=>({schemaVersion:"tqs-studio-world/v4",revision,theme,grid,items,documents,activity,updatedAt:now()}),[revision,theme,grid,items,documents,activity]);
 const importSnapshot=useCallback((s:Snapshot)=>{if(!s||s.schemaVersion!=="tqs-studio-world/v4"||!Array.isArray(s.items)||!Array.isArray(s.documents))return false;setItems(s.items);setDocuments(s.documents);setActivity(s.activity||[]);setTheme(s.theme||"dark");setGrid(!!s.grid);setRevision(s.revision||1);localStorage.setItem(STORAGE,JSON.stringify(s));return true},[]);
 const reset=useCallback(()=>{setItems(seedItems());setDocuments(seedDocs());setActivity([]);setTheme("dark");setGrid(false);setFrameView("none");setCamera({x:30,y:20,zoom:.55});setRevision(r=>r+1);localStorage.removeItem(STORAGE)},[]);
 useEffect(()=>{try{const raw=localStorage.getItem(STORAGE);if(raw)importSnapshot(JSON.parse(raw))}catch{}},[importSnapshot]);
 useEffect(()=>{const t=setTimeout(()=>localStorage.setItem(STORAGE,JSON.stringify(snapshot())),180);return()=>clearTimeout(t)},[snapshot]);
 useEffect(()=>{window.__TQS_STUDIO_V4__={exportSnapshot:snapshot,importSnapshot,reset,queryActivity,getState:()=>({items,documents,activity,revision,surface})};return()=>{delete window.__TQS_STUDIO_V4__}},[snapshot,importSnapshot,reset,queryActivity,items,documents,activity,revision,surface]);

 const screenToWorld=(cx:number,cy:number)=>{const r=canvas.current!.getBoundingClientRect();return{x:(cx-r.left-camera.x)/camera.zoom,y:(cy-r.top-camera.y)/camera.zoom}};
 const deepestFrame=(x:number,y:number)=>items.filter(i=>i.kind==="frame"&&x>=i.x&&x<=i.x+i.w&&y>=i.y&&y<=i.y+i.h).sort((a,b)=>(a.w*a.h)-(b.w*b.h))[0];
 const kindTitles:Record<Kind,string>={frame:"Фрейм / раздел",text:"Текст",task:"Задача",image:"Картинка / скриншот",chart:"График / данные",video:"Видео",pdf:"PDF / документ",voice:"Голосовая заметка",documentRef:"Документ",link:"Ссылка",annotation:"Аннотация"};
 const addAt=(kind:Kind,x:number,y:number,title?:string)=>{
  const parent=deepestFrame(x,y),imageTarget=kind==="text"?items.filter(i=>i.kind==="image"&&x>=i.x&&x<=i.x+i.w&&y>=i.y&&y<=i.y+i.h).sort((a,b)=>b.z-a.z)[0]:undefined,id=uid(kind),semantic=parent?`${parent.semanticPath}/${title||kind}`:title||kind,t=now();
  const relations:Relation[]=[...(parent?[{type:"contains" as const,targetId:parent.id}]:[]),...(imageTarget?[{type:"annotates" as const,targetId:imageTarget.id}]:[])];
  const base:Item={id,kind,semanticPath:semantic,parentId:parent?.id,x:snap(x),y:snap(y),w:kind==="frame"?700:kind==="image"?500:kind==="chart"?560:kind==="voice"?430:kind==="task"?380:440,h:kind==="frame"?500:kind==="image"?340:kind==="chart"?360:kind==="voice"?210:kind==="task"?190:250,z:kind==="frame"?2:8,title:title||kindTitles[kind],body:kind==="text"?"<p>Новая заметка</p>":kind==="task"?"Новая задача":kind==="link"?"https://":undefined,status:kind==="voice"?"Ожидает записи":kind==="task"?"NEW":undefined,createdAt:t,updatedAt:t,relations};
  mutate(v=>[...v,base],()=>log(id,semantic,imageTarget?"annotate":kind==="voice"?"voice":kind==="task"?"task":kind==="image"?"image_paste":"create",imageTarget?`Текстовая аннотация на ${imageTarget.title}`:`Создано: ${base.title}`));setSelected(id);setContext(null);return id;
 };
 const descendantIds=(rootId:string,source:Item[])=>{const out=new Set<string>();let frontier=[rootId];while(frontier.length){const next:string[]=[];for(const p of frontier){for(const i of source){if(i.parentId===p&&!out.has(i.id)){out.add(i.id);next.push(i.id)}}}frontier=next}return out};
 const move=(id:string,nx:number,ny:number)=>{
  const item=items.find(i=>i.id===id);if(!item)return;const tx=snap(nx),ty=snap(ny),dx=tx-item.x,dy=ty-item.y,desc=descendantIds(id,items);
  mutate(v=>v.map(i=>i.id===id?{...i,x:tx,y:ty,updatedAt:now()}:desc.has(i.id)||i.relations.some(r=>r.type==="annotates"&&r.targetId===id)?{...i,x:i.x+dx,y:i.y+dy,updatedAt:now()}:i));
 };
 const reparentAfterMove=(id:string)=>{
  const item=items.find(i=>i.id===id);if(!item)return;
  const cx=item.x+item.w/2,cy=item.y+item.h/2;
  const parent=items.filter(i=>i.kind==="frame"&&i.id!==id&&cx>=i.x&&cx<=i.x+i.w&&cy>=i.y&&cy<=i.y+i.h).sort((a,b)=>(a.w*a.h)-(b.w*b.h))[0];
  if(parent?.id!==item.parentId){
   const oldPath=item.semanticPath,newPath=parent?`${parent.semanticPath}/${item.title}`:item.title;
   mutate(v=>v.map(i=>i.id===id?{...i,parentId:parent?.id,semanticPath:newPath,relations:[...i.relations.filter(r=>r.type!=="contains"),...(parent?[{type:"contains" as const,targetId:parent.id}]:[])],updatedAt:now()}:i),()=>log(id,newPath,"semantic_reparent",`${oldPath} → ${newPath}`));
  }
 };
 const focus=(id:string)=>{const i=items.find(x=>x.id===id);if(!i||!canvas.current)return;const r=canvas.current.getBoundingClientRect(),z=Math.max(.22,Math.min(1.3,Math.min((r.width-140)/i.w,(r.height-140)/i.h)));setCamera({zoom:z,x:(r.width-i.w*z)/2-i.x*z,y:(r.height-i.h*z)/2-i.y*z});setSelected(id);setSurface("world")};
 const fitWorld=()=>{if(!canvas.current)return;const r=canvas.current.getBoundingClientRect(),z=Math.min((r.width-80)/WORLD_W,(r.height-80)/WORLD_H);setCamera({zoom:z,x:30,y:30})};
 const enterFrameView=(mode:"preview"|"present")=>{if(!selectedItem||selectedItem.kind!=="frame")return;setFrameView(mode);setContext(null);setDrawing(null);focus(selectedItem.id)};
 const exitFrameView=()=>setFrameView("none");

 useEffect(()=>{const el=canvas.current;if(!el)return;const wheel=(e:WheelEvent)=>{e.preventDefault();const r=el.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top;if(e.ctrlKey||Math.abs(e.deltaY)>Math.abs(e.deltaX)*1.5){setCamera(c=>{const f=Math.exp(-e.deltaY*.0025),nz=Math.max(.16,Math.min(2.4,c.zoom*f)),wx=(sx-c.x)/c.zoom,wy=(sy-c.y)/c.zoom;return{zoom:nz,x:sx-wx*nz,y:sy-wy*nz}})}else setCamera(c=>({...c,x:c.x-e.deltaX,y:c.y-e.deltaY}))};el.addEventListener("wheel",wheel,{passive:false});return()=>el.removeEventListener("wheel",wheel)},[]);

 useEffect(()=>{const down=(e:KeyboardEvent)=>{if(e.key===" "){setSpace(true);if(!(e.target as HTMLElement)?.isContentEditable)e.preventDefault()}if(e.key==="Escape"){setDrawing(null);setContext(null);setSelected(null)}};const up=(e:KeyboardEvent)=>{if(e.key===" ")setSpace(false)};window.addEventListener("keydown",down);window.addEventListener("keyup",up);return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up)}},[]);

 const startMove=(e:React.PointerEvent,item:Item)=>{if(frameView!=="none"||e.button!==0||drawing)return;e.preventDefault();e.stopPropagation();setSelected(item.id);setGesture({type:"move",id:item.id,sx:e.clientX,sy:e.clientY,ox:item.x,oy:item.y})};
 const pointerMove=(e:React.PointerEvent)=>{if(gesture?.type==="pan"){setCamera(c=>({...c,x:gesture.ox+e.clientX-gesture.sx,y:gesture.oy+e.clientY-gesture.sy}));return}if(gesture?.type==="move"){move(gesture.id,gesture.ox+(e.clientX-gesture.sx)/camera.zoom,gesture.oy+(e.clientY-gesture.sy)/camera.zoom);return}if(gesture?.type==="resize"){patch(gesture.id,{w:Math.max(220,snap(gesture.ow+(e.clientX-gesture.sx)/camera.zoom)),h:Math.max(140,snap(gesture.oh+(e.clientY-gesture.sy)/camera.zoom))});return}if(drawing&&draftPoints.length){const p=screenToWorld(e.clientX,e.clientY);setDraftPoints(v=>[...v,p])}};
 const pointerUp=()=>{const movedId=gesture?.type==="move"?gesture.id:null;if(drawing&&draftPoints.length>1){const pts=draftPoints,minX=Math.min(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxX=Math.max(...pts.map(p=>p.x)),maxY=Math.max(...pts.map(p=>p.y));const center=pts[Math.floor(pts.length/2)],image=items.filter(i=>i.kind==="image"&&center.x>=i.x&&center.x<=i.x+i.w&&center.y>=i.y&&center.y<=i.y+i.h).sort((a,b)=>b.z-a.z)[0],parent=deepestFrame(center.x,center.y),id=uid("annotation"),semantic=parent?`${parent.semanticPath}/Аннотация`:"Аннотация",t=now();const rel:Relation[]=[];if(image)rel.push({type:"annotates",targetId:image.id});if(parent)rel.push({type:"contains",targetId:parent.id});const ann:Item={id,kind:"annotation",annotationKind:drawing,semanticPath:semantic,parentId:parent?.id,x:minX,y:minY,w:Math.max(20,maxX-minX),h:Math.max(20,maxY-minY),z:20,title:drawing==="marker"?"Маркер":drawing==="arrow"?"Стрелка":"Карандаш",createdAt:t,updatedAt:t,relations:rel,points:pts.map(p=>({x:p.x-minX,y:p.y-minY}))};mutate(v=>[...v,ann],()=>log(id,semantic,"annotate",`Аннотация ${ann.title}${image?" на "+image.title:""}`));}setDraftPoints([]);setGesture(null);if(movedId)reparentAfterMove(movedId)};

 const onFiles=(files:File[],cx:number,cy:number)=>{const file=files[0];if(!file||!file.type.startsWith("image/"))return;const p=screenToWorld(cx,cy),id=addAt("image",p.x,p.y,file.name);void readDataUrl(file).then(assetUrl=>patch(id,{assetUrl},"image_paste"))};
 const openDoc=(id:string)=>{setDocId(id);setSurface("documents")};
 const currentDoc=documents.find(d=>d.id===docId)||documents[0]!;
 const setDoc=(d:StudioDocument)=>{setDocuments(v=>v.map(x=>x.id===d.id?d:x));setRevision(r=>r+1);log(d.id,d.semanticPath,"text_update",`Обновлён документ: ${d.title}`)};
 const pinDocument=(d:StudioDocument)=>{
  const existing=items.find(i=>i.kind==="documentRef"&&i.relations.some(r=>r.type==="document_of"&&r.targetId===d.id));
  if(existing){focus(existing.id);return}
  const anchor=(d.frameId&&items.find(i=>i.id===d.frameId))||items.find(i=>i.id===FRAME_INBOX);
  const id=uid("documentRef"),t=now(),x=(anchor?.x||300)+60,y=(anchor?.y||300)+90,parent=anchor?.kind==="frame"?anchor:undefined;
  const ref:Item={id,kind:"documentRef",semanticPath:d.semanticPath,parentId:parent?.id,x:snap(x),y:snap(y),w:430,h:180,z:9,title:d.title,body:"Связанный документ без копирования содержимого.",createdAt:t,updatedAt:t,relations:[...(parent?[{type:"contains" as const,targetId:parent.id}]:[]),{type:"document_of",targetId:d.id}]};
  mutate(v=>[...v,ref],()=>log(id,d.semanticPath,"document_link",`Документ закреплён на Мире: ${d.title}`));setSurface("world");setSelected(id);
 };
 const createDocFromSelected=()=>{if(!selectedItem)return;const id=uid("doc"),d:StudioDocument={id,kind:"instruction",title:`Документ — ${selectedItem.title}`,semanticPath:selectedItem.semanticPath,frameId:selectedItem.kind==="frame"?selectedItem.id:selectedItem.parentId,revision:1,status:"Черновик",blocks:[{id:uid("db"),type:"heading",content:selectedItem.title},{id:uid("db"),type:"text",content:selectedItem.body?.replace(/<[^>]+>/g,"")||"Создано из выбранного объекта World."}]};setDocuments(v=>[...v,d]);log(id,d.semanticPath,"document_link",`Создан документ из: ${selectedItem.title}`);openDoc(id)};

 const navTree=useMemo(()=>[
  {label:"ARTEM OS / Agent",id:FRAME_AGENT},
  {label:"TQS / Trading / Intelligence",id:FRAME_TQS},
  {label:"Обучение",id:FRAME_LEARNING,children:[
   {label:"Бесплатный курс",id:COURSE_FREE,children:[1,2,3].map(n=>({label:`Занятие ${n}`,id:`lesson-free-${n}`,doc:n===1?DOC_LESSON:undefined}))},
   {label:"Скальпинг по стакану",id:COURSE_SCALP,children:[1,2,3].map(n=>({label:`Занятие ${n}`,id:`lesson-scalp-${n}`}))}
  ]},
  {label:"Статьи",id:FRAME_ARTICLES,children:[{label:"Si: история ликвидности",id:ARTICLE_SI,doc:DOC_SI}]},
  {label:"Inbox",id:FRAME_INBOX}
 ],[]);

 const Tree=({nodes,depth=0}:{nodes:any[];depth?:number}):React.ReactNode=><>{nodes.map(n=><div key={n.id}><div className={styles.treeRow} style={{paddingLeft:10+depth*14}}><button className={styles.treeMain} onClick={()=>n.doc?openDoc(n.doc):focus(n.id)}>{n.children?<ChevronRight size={12}/>:<span className={styles.dot}/>}<span>{n.label}</span></button><button title="На доске" data-testid={"board-target-"+n.id} onClick={()=>focus(n.id)}><CircleDot size={12}/></button></div>{n.children?<Tree nodes={n.children} depth={depth+1}/>:null}</div>)}</>;

 const visibleItems=items.filter(i=>!i.hidden&&i.kind!=="annotation");
 const lod=camera.zoom<.32?"far":camera.zoom<.6?"mid":"near";
 const download=()=>{const b=new Blob([JSON.stringify(snapshot(),null,2)],{type:"application/json"}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download="tqs-studio-world-v4.snapshot.json";a.click();setTimeout(()=>URL.revokeObjectURL(u),0)};

 return <main className={styles.shell} data-theme={theme} data-surface={surface} data-frame-view={frameView}>
  <header className={styles.topbar}>
   <div className={styles.brand}><span>TQS Studio</span><strong>{surface==="world"?"Мир":"Документы"}</strong></div>
   <div className={styles.surfaceSwitch}><button data-testid="surface-world" className={surface==="world"?styles.active:""} onClick={()=>setSurface("world")}>Мир</button><button data-testid="surface-documents" className={surface==="documents"?styles.active:""} onClick={()=>setSurface("documents")}>Документы</button></div>
   <div className={styles.topActions}>
    {frameView!=="none"?<button data-testid="exit-frame-view" onClick={exitFrameView}>← {frameView==="present"?"Презентация":"Просмотр"}</button>:null}
    {surface==="world"&&frameView==="none"&&selectedItem?<button onClick={createDocFromSelected}><FileText size={14}/> Создать документ из выбранного</button>:null}
    <button title="Вписать мир" onClick={fitWorld}><Maximize2 size={14}/></button>
    <button title="Тема" data-testid="theme-toggle" onClick={()=>setTheme(t=>t==="dark"?"light":"dark")}>{theme==="dark"?<Moon size={14}/>:<Sun size={14}/>}</button>
    <button title="Настройки" onClick={()=>setSettings(v=>!v)}><Settings size={14}/></button>
    <button title="Сбросить демо" data-testid="reset-demo" onClick={reset}><RotateCcw size={14}/></button>
   </div>
  </header>

  {settings?<div className={styles.settings}><b>Настройки</b><label><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/> Сетка</label><div>Навигация: <strong>Авто</strong></div><small>Мышь и тачпад определяются автоматически. Ручной выбор скрыт из основного интерфейса.</small></div>:null}

  <div className={styles.body}>
   {frameView==="none"?<aside className={navOpen?styles.navigator:styles.navRail} data-testid="navigator">
    <div className={styles.navHead}>{navOpen?<><div><b>Навигатор</b><small>База</small></div><button onClick={()=>setNavOpen(false)}><PanelLeftClose size={15}/></button></>:<button onClick={()=>setNavOpen(true)}><PanelLeftOpen size={15}/></button>}</div>
    {navOpen?<><label className={styles.search}><Search size={13}/><input placeholder="Поиск по базе"/></label>
    <nav>{["Недавние","Входящие","Проекты","Курсы","Занятия","Статьи","База знаний","Избранное"].map(s=><button key={s} className={navSection===s?styles.navActive:""} onClick={()=>setNavSection(s)}>{s==="Недавние"?<Sparkles size={14}/>:s==="Входящие"?<Inbox size={14}/>:s==="Избранное"?<Star size={14}/>:<Layers3 size={14}/>}<span>{s}</span>{s==="Недавние"&&activity.filter(a=>a.status==="NEW").length?<em>{activity.filter(a=>a.status==="NEW").length}</em>:null}</button>)}</nav>
    <div className={styles.navContent}>
     {navSection==="Недавние"?<div>{queryActivity({}).slice(0,20).map(a=><button className={styles.eventRow} key={a.id} onClick={()=>focus(a.entityId)}><span>{a.summary}</span><small>{a.semanticPath}</small></button>)}</div>:null}
     {navSection==="Входящие"?<div>{activity.filter(a=>a.status==="NEW").slice(0,20).map(a=><div className={styles.eventStatic} key={a.id}><span>{a.summary}</span><small>{a.semanticPath}</small></div>)}</div>:null}
     {navSection==="Избранное"?<div className={styles.empty}>Избранные объекты появятся здесь.</div>:null}
     {!["Недавние","Входящие","Избранное"].includes(navSection)?<Tree nodes={navTree}/>:null}
     {navSection==="Проекты"?<div className={styles.agentRecent}><b>Agent Recent</b><small data-testid="agent-recent-count">{queryActivity({semanticPath:"ARTEM OS/Agent"}).length} событий</small>{queryActivity({semanticPath:"ARTEM OS/Agent"}).slice(0,6).map(a=><span key={a.id}>{a.summary}</span>)}</div>:null}
    </div></>:null}
   </aside>:null}

   {surface==="documents"?<section className={styles.documentsSurface}>
    <aside className={styles.docList}><b>Документы</b>{documents.map(d=><button key={d.id} className={d.id===currentDoc.id?styles.docActive:""} onClick={()=>setDocId(d.id)}><span>{d.kind==="lesson"?"Занятие":"Статья"}</span><strong>{d.title}</strong><small>{d.semanticPath}</small></button>)}</aside>
    <DocEditor doc={currentDoc} onDoc={setDoc} onPin={()=>pinDocument(currentDoc)} goWorld={()=>currentDoc.frameId?focus(currentDoc.frameId):setSurface("world")}/>
   </section>:<section ref={canvas as any} className={`${styles.canvas} ${grid?styles.grid:""}`} data-testid="world-canvas" data-lod={lod} tabIndex={0}
    onPointerDown={e=>{if(drawing){const p=screenToWorld(e.clientX,e.clientY);setDraftPoints([p]);return}if(e.button===1||(space&&e.button===0)){e.preventDefault();setGesture({type:"pan",sx:e.clientX,sy:e.clientY,ox:camera.x,oy:camera.y});return}if(e.button===0&&e.target===e.currentTarget){setSelected(null);setContext(null)}}}
    onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}
    onContextMenu={e=>{if(frameView!=="none")return;if((e.target as HTMLElement).closest("[data-world-item]"))return;e.preventDefault();const r=e.currentTarget.getBoundingClientRect(),p=screenToWorld(e.clientX,e.clientY);setContext({sx:e.clientX-r.left,sy:e.clientY-r.top,wx:p.x,wy:p.y})}}
    onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();onFiles(Array.from(e.dataTransfer.files),e.clientX,e.clientY)}}
    onPaste={e=>{const files=Array.from(e.clipboardData.files);if(!files.length||!canvas.current)return;const r=canvas.current.getBoundingClientRect();onFiles(files,r.left+r.width/2,r.top+r.height/2)}}>
     <div className={styles.world} style={{transform:`translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})`,width:WORLD_W,height:WORLD_H}}>
      {visibleItems.sort((a,b)=>a.z-b.z).map(item=>{
       if(lod==="far"&&item.kind!=="frame")return null;
       if(lod==="far"&&item.parentId&&items.find(x=>x.id===item.parentId)?.parentId)return null;
       if(lod==="mid"&&!["frame","documentRef","chart"].includes(item.kind))return null;
       return <div key={item.id} data-world-item data-testid={`world-item-${item.kind}`} data-id={item.id} data-semantic-path={item.semanticPath}
        className={`${styles.item} ${styles["kind_"+item.kind]} ${selected===item.id?styles.selected:""} ${gesture?.id===item.id?styles.dragging:""}`}
        style={{left:item.x,top:item.y,width:item.w,height:item.h,zIndex:item.z,borderRadius:item.kind==="frame"?22:14}}
        onPointerDownCapture={e=>{if(frameView==="none"&&e.button===0&&!drawing)setSelected(item.id)}}>
        {item.kind==="frame"?<><div className={styles.frameTitle} onPointerDown={e=>startMove(e,item)}><span>{item.title}</span><small>{item.semanticPath}</small></div>{lod==="far"?null:<div className={styles.frameMeta}>{item.semanticPath.split("/").length===1?"Проект":item.semanticPath.includes("Занятие")?"Занятие":"Раздел"}</div>}</>:
        <><div className={styles.itemHandle} onPointerDown={e=>startMove(e,item)}><span>{item.title}</span><MoreHorizontal size={13}/></div><div className={styles.itemContent}>
         {item.kind==="text"?<TextCard item={item} onChange={p=>patch(item.id,p,"text_update")}/>:null}
         {item.kind==="task"?<div className={styles.taskCard} onPointerDown={e=>e.stopPropagation()}><button onClick={()=>patch(item.id,{done:!item.done,status:!item.done?"DONE":"NEW"},"task")}>{item.done?<Check size={16}/>:<CircleDot size={16}/>}</button><div><b>{item.body}</b><small>{item.semanticPath}</small></div></div>:null}
         {item.kind==="voice"?<VoiceCard item={item} onChange={p=>patch(item.id,p,"voice")}/>:null}
         {item.kind==="chart"?<ChartCard item={item} dark={theme==="dark"} onChange={p=>patch(item.id,p)}/>:null}
         {item.kind==="video"?<VideoCard/>:null}
         {item.kind==="pdf"?<PdfCard item={item} onChange={p=>patch(item.id,p)}/>:null}
         {item.kind==="image"?<div className={styles.imageCard}>{item.assetUrl?<img src={item.assetUrl} alt={item.title}/>:<><ImageIcon size={32}/><span>Перетащите или вставьте изображение</span></>}</div>:null}
         {item.kind==="link"?<div className={styles.linkCard} onPointerDown={e=>e.stopPropagation()}><LinkIcon size={18}/><input aria-label="URL" value={item.body||""} onChange={e=>patch(item.id,{body:e.target.value},"text_update")} placeholder="https://"/></div>:null}
         {item.kind==="documentRef"?<button className={styles.documentRef} onClick={()=>{const d=item.relations.find(r=>r.type==="document_of");if(d)openDoc(d.targetId)}}><BookOpen size={22}/><b>{item.title}</b><span>Открыть документ</span></button>:null}
        </div></>}
        {frameView==="none"&&selected===item.id?<span className={styles.resize} onPointerDown={e=>{e.stopPropagation();setGesture({type:"resize",id:item.id,sx:e.clientX,sy:e.clientY,ow:item.w,oh:item.h})}}/>:null}
       </div>
      })}
      {items.filter(i=>i.kind==="annotation").map(a=><svg key={a.id} className={styles.annotation} style={{left:a.x,top:a.y,width:a.w,height:a.h,zIndex:a.z}} viewBox={`0 0 ${Math.max(1,a.w)} ${Math.max(1,a.h)}`}><defs><marker id={`arrow-${a.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#d7a84b"/></marker></defs><polyline points={(a.points||[]).map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke={a.annotationKind==="marker"?"rgba(218,167,68,.42)":"#d7a84b"} strokeWidth={a.annotationKind==="marker"?18:3} strokeLinecap="round" strokeLinejoin="round" markerEnd={a.annotationKind==="arrow"?`url(#arrow-${a.id})`:undefined}/></svg>)}
      {gesture?.type==="move"?<><div className={styles.snapGuideV}/><div className={styles.snapGuideH}/></>:null}
      {draftPoints.length>1?<svg className={styles.annotationDraft} style={{left:0,top:0,width:WORLD_W,height:WORLD_H}}><polyline points={draftPoints.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke="#d7a84b" strokeWidth={drawing==="marker"?18:3} strokeLinecap="round"/></svg>:null}
     </div>

     {frameView==="none"?<div className={styles.canvasTools}>
      <button className={drawing==="pencil"?styles.toolActive:""} onClick={()=>setDrawing(drawing==="pencil"?null:"pencil")} title="Карандаш / маркер"><PenLine size={15}/></button>
      <button className={drawing==="marker"?styles.toolActive:""} onClick={()=>setDrawing(drawing==="marker"?null:"marker")} title="Маркер"><SquarePen size={15}/></button>
      <button className={drawing==="arrow"?styles.toolActive:""} onClick={()=>setDrawing(drawing==="arrow"?null:"arrow")} title="Стрелка / связь">↗</button>
      <span>{Math.round(camera.zoom*100)}%</span>
     </div>:null}

     {frameView==="none"&&selectedItem?<div className={styles.selectionBar}>
      <span>{selectedItem.title}</span>
      {selectedItem.kind==="documentRef"?<button onClick={()=>{const d=selectedItem.relations.find(r=>r.type==="document_of");if(d)openDoc(d.targetId)}}>Открыть документ</button>:null}
      {selectedItem.kind==="frame"?<><button data-testid="frame-preview" onClick={()=>enterFrameView("preview")}>Просмотр</button><button data-testid="frame-present" onClick={()=>enterFrameView("present")}>Презентация</button></>:null}
      <button onClick={()=>patch(selectedItem.id,{hidden:true})}>Скрыть</button>
      <button onClick={()=>{mutate(v=>v.filter(i=>i.id!==selectedItem.id&&i.parentId!==selectedItem.id));setSelected(null)}}>Удалить</button>
     </div>:null}

     {frameView==="none"&&context?<div className={styles.context} style={{left:context.sx,top:context.sy}} data-testid="add-here-menu"><b>Добавить сюда</b>
      {[
       ["voice","Голосовая заметка",<Mic key="i" size={14}/>],["text","Текст",<Type key="i" size={14}/>],["task","Задача",<ListTodo key="i" size={14}/>],
       ["image","Картинка / скриншот",<ImageIcon key="i" size={14}/>],["link","Ссылка",<LinkIcon key="i" size={14}/>],["chart","График / данные",<Layers3 key="i" size={14}/>],
       ["pdf","PDF / документ",<FileText key="i" size={14}/>],["video","Видео",<Video key="i" size={14}/>],["frame","Фрейм / раздел",<Frame key="i" size={14}/>]
      ].map(([k,l,ic]:any)=><button key={k} onClick={()=>addAt(k,context.wx,context.wy,l)}>{ic}<span>{l}</span></button>)}
      <button onClick={()=>{setDrawing("pencil");setContext(null)}}><PenLine size={14}/><span>Карандаш / маркер</span></button>
      <button onClick={()=>{setDrawing("arrow");setContext(null)}}><span>↗</span><span>Стрелка / связь</span></button>
     </div>:null}

     {frameView==="none"?<div className={styles.bottomBar}>
      <button data-testid="export-world" onClick={download}><FileJson size={14}/> Экспорт</button>
      <button onClick={()=>importRef.current?.click()}><Upload size={14}/> Импорт</button>
      <input ref={importRef} hidden type="file" accept="application/json" onChange={async e=>{const f=e.currentTarget.files?.[0];if(!f)return;try{importSnapshot(JSON.parse(await f.text()))}catch{}finally{e.currentTarget.value=""}}}/>
      <span data-testid="grid-state">Сетка: {grid?"вкл":"выкл"}</span><span data-testid="lod-state">Детализация: {lod==="far"?"далеко":lod==="mid"?"средне":"близко"}</span><span>рев. {revision}</span>
     </div>:null}
   </section>}
  </div>
 </main>
}

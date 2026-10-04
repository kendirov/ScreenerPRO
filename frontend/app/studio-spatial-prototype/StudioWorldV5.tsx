"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {BookOpen,ChevronLeft,ChevronRight,CircleDot,Download,FileJson,FileText,FolderSync,Image as ImageIcon,Link as LinkIcon,ListTodo,Maximize2,Menu,Mic,Moon,MoreHorizontal,PanelLeftClose,PanelLeftOpen,PenLine,Plus,Search,Settings,SquarePen,Sun,Type,Upload,Volume2,X} from "lucide-react";
import {DocumentEditorV5} from "@/components/studio-v5/DocumentEditorV5";
import {StudioMarketChart} from "@/components/studio-v5/MarketChart";
import {driveOAuthStart,studioAction} from "@/lib/studio-v5/api";
import {resetLocalStudio,saveLocalObjectDraft} from "@/lib/studio-v5/local-store";
import type {DataSpec,DocumentBundle,StudioActivity,StudioDocument,StudioObject,WorldOverview} from "@/lib/studio-v5/types";
import styles from "./studio-v5.module.css";

type Surface="world"|"documents";
type DrawMode="pencil"|"marker"|"arrow"|null;
type Camera={x:number;y:number;zoom:number};
const CACHE="tqs-studio-v5-recovery";
const GRID=10;
const snap=(n:number)=>Math.round(n/GRID)*GRID;
const WORLD_W=7200,WORLD_H=4200;

function asHtml(body:any){return typeof body?.html==="string"?body.html:""}
function titleForKind(kind:string){return kind==="text"?"Текст":kind==="task"?"Задача":kind==="voice"?"Голосовая заметка":kind==="image"?"Картинка":kind==="video"?"Видео":kind==="file"?"Файл":kind==="link"?"Ссылка":kind==="frame"?"Фрейм / раздел":kind==="chart"?"График / данные":kind}
function fileToDataUrl(file:File){return new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=()=>reject(r.error);r.readAsDataURL(file)})}

export default function StudioWorldV5(){
 const [overview,setOverview]=useState<WorldOverview|null>(null),[documents,setDocuments]=useState<StudioDocument[]>([]),[bundle,setBundle]=useState<DocumentBundle|null>(null);
 const [surface,setSurface]=useState<Surface>("world"),[selected,setSelected]=useState<string|null>(null),[editing,setEditing]=useState<string|null>(null);
 const [camera,setCamera]=useState<Camera>({x:34,y:24,zoom:.55}),[worldNav,setWorldNav]=useState(true),[docNav,setDocNav]=useState(true),[search,setSearch]=useState("");
 const [grid,setGrid]=useState(false),[diagnostics,setDiagnostics]=useState(false),[theme,setTheme]=useState<"dark"|"light">("dark"),[drive,setDrive]=useState<any>(null),[driveFiles,setDriveFiles]=useState<any[]>([]),[notice,setNotice]=useState("");
 const [gesture,setGesture]=useState<any>(null),[space,setSpace]=useState(false),[drawMode,setDrawMode]=useState<DrawMode>(null),[drawPoints,setDrawPoints]=useState<Array<{x:number;y:number}>>([]);
 const [context,setContext]=useState<{sx:number;sy:number;wx:number;wy:number}|null>(null);
 const canvas=useRef<HTMLElement|null>(null),searchRef=useRef<HTMLInputElement>(null),importRef=useRef<HTMLInputElement>(null),lastPointer=useRef<{x:number;y:number;at:number}|null>(null),didInitialFit=useRef(false),drawTargetImage=useRef<string|null>(null);
 const objects=overview?.objects||[]; const activity=overview?.activity||[]; const selectedObject=objects.find(o=>o.id===selected)||null;
 const lod=camera.zoom<.32?"far":camera.zoom<.62?"mid":"near";

 const load=useCallback(async()=>{
  await studioAction("ensureSeed").catch(()=>null);
  const [w,docs]=await Promise.all([studioAction<WorldOverview>("getWorldOverview"),studioAction<StudioDocument[]>("listDocuments")]);
  setOverview(w);setDocuments(docs);localStorage.setItem(CACHE,JSON.stringify({savedAt:new Date().toISOString(),overview:w,documents:docs}));
 },[]);

 useEffect(()=>{void load().catch(e=>{setNotice("Сервер временно недоступен: "+e.message);const raw=localStorage.getItem(CACHE);if(raw)try{const x=JSON.parse(raw);setOverview(x.overview);setDocuments(x.documents||[])}catch{}})},[load]);
 useEffect(()=>{if(!overview)return;try{localStorage.setItem(CACHE,JSON.stringify({savedAt:new Date().toISOString(),overview,documents,selectedDocument:bundle}))}catch{}},[overview,documents,bundle]);
 useEffect(()=>{if(didInitialFit.current||!overview||!canvas.current)return;const roots=overview.objects.filter(o=>o.kind==="frame"&&!o.parent_id);if(!roots.length)return;const minX=Math.min(...roots.map(o=>o.x)),minY=Math.min(...roots.map(o=>o.y)),maxX=Math.max(...roots.map(o=>o.x+o.w)),maxY=Math.max(...roots.map(o=>o.y+o.h)),r=canvas.current.getBoundingClientRect(),z=Math.max(.14,Math.min((r.width-80)/(maxX-minX),(r.height-80)/(maxY-minY),1));setCamera({zoom:z,x:40-minX*z,y:40-minY*z});didInitialFit.current=true},[overview]);

 useEffect(()=>{const down=(e:KeyboardEvent)=>{const mod=e.metaKey||e.ctrlKey;if(mod&&e.key==="1"){e.preventDefault();setSurface("world")}if(mod&&e.key==="2"){e.preventDefault();setSurface("documents")}if(mod&&e.key.toLowerCase()==="k"){e.preventDefault();if(surface==="world")searchRef.current?.focus()}if(e.code==="Space"&&!isEditableTarget(e.target)){setSpace(true);e.preventDefault()}if(e.key==="Escape"){setEditing(null);setContext(null);setDrawMode(null)}};const up=(e:KeyboardEvent)=>{if(e.code==="Space")setSpace(false)};window.addEventListener("keydown",down);window.addEventListener("keyup",up);return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up)}},[surface]);
 useEffect(()=>{const el=canvas.current;if(!el||surface!=="world")return;const wheel=(e:WheelEvent)=>{e.preventDefault();const r=el.getBoundingClientRect();if(e.ctrlKey){const sx=e.clientX-r.left,sy=e.clientY-r.top;setCamera(c=>{const factor=Math.exp(-e.deltaY*.005),zoom=Math.max(.14,Math.min(2.5,c.zoom*factor)),wx=(sx-c.x)/c.zoom,wy=(sy-c.y)/c.zoom;return{zoom,x:sx-wx*zoom,y:sy-wy*zoom}});return}setCamera(c=>e.shiftKey?{...c,x:c.x-(e.deltaY+e.deltaX)}:{...c,x:c.x-e.deltaX,y:c.y-e.deltaY})};el.addEventListener("wheel",wheel,{passive:false});return()=>el.removeEventListener("wheel",wheel)},[surface]);

 const setObjects=(fn:(x:StudioObject[])=>StudioObject[])=>setOverview(v=>v?{...v,objects:fn(v.objects)}:v);
 const screenToWorld=(cx:number,cy:number)=>{const r=canvas.current?.getBoundingClientRect();if(!r)return{x:0,y:0};return{x:(cx-r.left-camera.x)/camera.zoom,y:(cy-r.top-camera.y)/camera.zoom}};
 const deepestFrame=(x:number,y:number,exclude?:string)=>objects.filter(o=>o.kind==="frame"&&o.id!==exclude&&x>=o.x&&x<=o.x+o.w&&y>=o.y&&y<=o.y+o.h).sort((a,b)=>a.w*a.h-b.w*b.h)[0]||null;
 const insertionPoint=()=>{if(lastPointer.current&&Date.now()-lastPointer.current.at<30000)return{x:lastPointer.current.x,y:lastPointer.current.y};if(selectedObject?.kind==="frame")return{x:selectedObject.x+selectedObject.w/2,y:selectedObject.y+selectedObject.h/2};const r=canvas.current?.getBoundingClientRect();return r?screenToWorld(r.left+r.width/2,r.top+r.height/2):{x:800,y:600}};
 const createObject=async(kind:string,opts:any={})=>{
  const p=opts.point||insertionPoint(),parent=deepestFrame(p.x,p.y),id=kind+"-"+crypto.randomUUID(),title=opts.title||titleForKind(kind);
  const dims=kind==="text"?{w:270,h:104}:kind==="task"?{w:300,h:84}:kind==="voice"?{w:320,h:84}:kind==="link"?{w:320,h:80}:kind==="image"?{w:480,h:320}:kind==="video"?{w:480,h:280}:kind==="frame"?{w:700,h:480}:kind==="chart"?{w:620,h:390}:{w:340,h:110};
  const imageTarget=kind==="text"?objects.filter(o=>o.kind==="image"&&p.x>=o.x&&p.x<=o.x+o.w&&p.y>=o.y&&p.y<=o.y+o.h).sort((a,b)=>b.z-a.z)[0]:null;
  const row:any={id,kind,semantic_path:parent?parent.semantic_path+"/"+title:title,parent_id:parent?.id||null,x:snap(p.x),y:snap(p.y),...dims,z:kind==="frame"?2:10,title,body:opts.body||{},relations:parent?[{type:"contains",targetId:parent.id}]:[],status:kind==="task"?"NEW":kind==="voice"?"WAITING_RECORDING":null,hidden:false};
  const annotatesTarget=opts.annotates||imageTarget?.id;if(annotatesTarget)row.relations.push({type:"annotates",targetId:annotatesTarget});
  const res=await studioAction<any>("createWorldObject",{object:row});setOverview(v=>v?{...v,objects:[...v.objects,res.object],world:{...v.world,revision:res.worldRevision}}:v);setSelected(id);setContext(null);
  if(["text","task","link"].includes(kind))setEditing(id);return res.object as StudioObject;
 };
 const updateObject=async(id:string,patch:any,eventType?:string,summary?:string)=>{const old=objects.find(o=>o.id===id);if(!old)return;setObjects(v=>v.map(o=>o.id===id?{...o,...patch,revision:o.revision+1}:o));const r=await studioAction<any>("updateObject",{id,revision:old.revision,patch,eventType,summary});setOverview(v=>v?{...v,objects:v.objects.map(o=>o.id===id?r.object:o),world:{...v.world,revision:r.worldRevision}}:v)};
 const focusObject=(id:string)=>{const o=objects.find(x=>x.id===id);if(!o)return;setSurface("world");setSelected(id);const apply=()=>{const el=canvas.current;if(!el)return false;const r=el.getBoundingClientRect(),z=Math.max(.2,Math.min(1.25,Math.min((r.width-100)/o.w,(r.height-100)/o.h)));setCamera({zoom:z,x:(r.width-o.w*z)/2-o.x*z,y:(r.height-o.h*z)/2-o.y*z});return true};if(!apply())window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>apply()))};
 const fitWorld=()=>{if(!canvas.current)return;const roots=objects.filter(o=>o.kind==="frame"&&!o.parent_id);if(!roots.length)return;const minX=Math.min(...roots.map(o=>o.x)),minY=Math.min(...roots.map(o=>o.y)),maxX=Math.max(...roots.map(o=>o.x+o.w)),maxY=Math.max(...roots.map(o=>o.y+o.h)),r=canvas.current.getBoundingClientRect(),z=Math.min((r.width-80)/(maxX-minX),(r.height-80)/(maxY-minY),1);setCamera({zoom:z,x:40-minX*z,y:40-minY*z})};

 const descendants=(root:string,source=objects)=>{const set=new Set<string>();let f=[root];while(f.length){const n:string[]=[];for(const p of f)for(const o of source)if(o.parent_id===p&&!set.has(o.id)){set.add(o.id);n.push(o.id)}f=n}return set};
 const startMove=(e:React.PointerEvent,o:StudioObject)=>{if(e.button!==0||drawMode||isEditableTarget(e.target))return;e.stopPropagation();e.preventDefault();const ids=descendants(o.id),attached=new Set(objects.filter(x=>x.relations?.some((r:any)=>r.type==="annotates"&&r.targetId===o.id)).map(x=>x.id));for(const x of attached)ids.add(x);const start=new Map<string,{x:number;y:number}>();start.set(o.id,{x:o.x,y:o.y});for(const id of ids){const x=objects.find(z=>z.id===id);if(x)start.set(id,{x:x.x,y:x.y})}setSelected(o.id);setGesture({type:"move",id:o.id,sx:e.clientX,sy:e.clientY,start})};
 const startResize=(e:React.PointerEvent,o:StudioObject)=>{e.stopPropagation();e.preventDefault();setGesture({type:"resize",id:o.id,sx:e.clientX,sy:e.clientY,w:o.w,h:o.h})};
 const persistGesture=async(g:any)=>{
  if(g.type==="move"){const moved=overview?.objects||[];const root=moved.find(o=>o.id===g.id);if(!root)return;const cx=root.x+root.w/2,cy=root.y+root.h/2,parent=deepestFrame(cx,cy,root.id);const old=objects.find(o=>o.id===root.id);let rootPatch:any={x:root.x,y:root.y};if(old&&parent?.id!==old.parent_id){const oldPrefix=old.semantic_path,newPath=parent?parent.semantic_path+"/"+root.title:root.title;rootPatch={...rootPatch,parent_id:parent?.id||null,semantic_path:newPath,relations:[...(root.relations||[]).filter((r:any)=>r.type!=="contains"),...(parent?[{type:"contains",targetId:parent.id}]:[])]};if(root.kind==="frame"){const ds=descendants(root.id,moved);setObjects(v=>v.map(x=>ds.has(x.id)?{...x,semantic_path:x.semantic_path.startsWith(oldPrefix)?newPath+x.semantic_path.slice(oldPrefix.length):x.semantic_path}:x))}}
    const changed=[...g.start.keys()];for(const id of changed){const cur=(overview?.objects||[]).find(o=>o.id===id),prev=g.start.get(id);if(!cur||!prev)continue;const patch=id===root.id?rootPatch:{x:cur.x,y:cur.y};await studioAction("updateObject",{id,revision:cur.revision,patch,eventType:id===root.id?"semantic_reparent":undefined,summary:id===root.id?"Перемещён: "+root.title:undefined})}
    await load();
  }else if(g.type==="resize"){const cur=objects.find(o=>o.id===g.id);if(cur)await updateObject(cur.id,{w:cur.w,h:cur.h})}
 };
 const pointerMove=(e:React.PointerEvent)=>{if((e.target as HTMLElement).closest?.("[data-studio-ui]"))return;const p=screenToWorld(e.clientX,e.clientY);lastPointer.current={...p,at:Date.now()};if(gesture?.type==="pan"){setCamera(c=>({...c,x:gesture.x+e.clientX-gesture.sx,y:gesture.y+e.clientY-gesture.sy}));return}if(gesture?.type==="move"){const dx=(e.clientX-gesture.sx)/camera.zoom,dy=(e.clientY-gesture.sy)/camera.zoom;setObjects(v=>v.map(o=>{const s=gesture.start.get(o.id);return s?{...o,x:snap(s.x+dx),y:snap(s.y+dy)}:o}));return}if(gesture?.type==="resize"){setObjects(v=>v.map(o=>o.id===gesture.id?{...o,w:Math.max(180,snap(gesture.w+(e.clientX-gesture.sx)/camera.zoom)),h:Math.max(64,snap(gesture.h+(e.clientY-gesture.sy)/camera.zoom))}:o));return}if(drawMode&&drawPoints.length)setDrawPoints(v=>[...v,p])};
 const pointerUp=async()=>{const g=gesture;setGesture(null);if(drawMode&&drawPoints.length>1){const pts=drawPoints,minX=Math.min(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxX=Math.max(...pts.map(p=>p.x)),maxY=Math.max(...pts.map(p=>p.y)),mid=pts[Math.floor(pts.length/2)],image=(drawTargetImage.current?objects.find(o=>o.id===drawTargetImage.current&&o.kind==="image"):null)||objects.filter(o=>o.kind==="image"&&mid.x>=o.x&&mid.x<=o.x+o.w&&mid.y>=o.y&&mid.y<=o.y+o.h).sort((a,b)=>b.z-a.z)[0],parent=deepestFrame(mid.x,mid.y),id="annotation-"+crypto.randomUUID();const rel:any[]=[];if(parent)rel.push({type:"contains",targetId:parent.id});if(image)rel.push({type:"annotates",targetId:image.id});const row:any={id,kind:"annotation",semantic_path:(parent?parent.semantic_path+"/":"")+"Аннотация",parent_id:parent?.id||null,x:minX,y:minY,w:Math.max(10,maxX-minX),h:Math.max(10,maxY-minY),z:30,title:drawMode==="marker"?"Маркер":drawMode==="arrow"?"Стрелка":"Карандаш",body:{annotationKind:drawMode,points:pts.map(p=>({x:p.x-minX,y:p.y-minY}))},relations:rel,status:null,hidden:false};const res=await studioAction<any>("createWorldObject",{object:row});setOverview(v=>v?{...v,objects:[...v.objects,res.object],world:{...v.world,revision:res.worldRevision}}:v);setDrawPoints([]);drawTargetImage.current=null}
  if(g)await persistGesture(g).catch(e=>setNotice(e.message))
 };

 const handleFiles=async(files:File[],point?:{x:number;y:number})=>{for(const file of files.slice(0,4)){const p=point||insertionPoint(),dataUrl=await fileToDataUrl(file),asset=await studioAction<any>("attachAsset",{dataUrl,filename:file.name}),kind=file.type.startsWith("image/")?"image":file.type.startsWith("video/")?"video":"file";await createObject(kind,{point:p,title:file.name,body:{assetId:asset.asset.id,mimeType:asset.asset.mime_type,filename:file.name}})}};
 const classifyText=async(text:string,point?:{x:number;y:number})=>{const t=text.trim();if(!t)return;let url=false;try{const u=new URL(t);url=u.protocol==="http:"||u.protocol==="https:"}catch{}if(url)await createObject("link",{point,title:"Ссылка",body:{url:t}});else await createObject("text",{point,title:"Текст",body:{html:"<p>"+escapeHtml(t)+"</p>"}})};
 const onPaste=async(e:React.ClipboardEvent)=>{if(isEditableTarget(e.target))return;const files=Array.from(e.clipboardData.files);if(files.length){e.preventDefault();await handleFiles(files);return}const text=e.clipboardData.getData("text/plain");if(text){e.preventDefault();await classifyText(text)}};
 const onDrop=async(e:React.DragEvent)=>{e.preventDefault();const p=screenToWorld(e.clientX,e.clientY),files=Array.from(e.dataTransfer.files);if(files.length){await handleFiles(files,p);return}const text=e.dataTransfer.getData("text/uri-list")||e.dataTransfer.getData("text/plain");if(text)await classifyText(text,p)};

 const openDocument=async(id:string)=>{setSurface("documents");setBundle(await studioAction<DocumentBundle>("getDocument",{documentId:id}));};
 const createDocumentFromSelected=async()=>{if(!selectedObject)return;const d=await studioAction<DocumentBundle>("createDocument",{title:"Документ — "+selectedObject.title,semanticPath:selectedObject.semantic_path,frameId:selectedObject.kind==="frame"?selectedObject.id:selectedObject.parent_id,kind:selectedObject.semantic_path.startsWith("Статьи")?"article":"instruction"});setDocuments(await studioAction("listDocuments"));setBundle(d);setSurface("documents")};
 const share=async()=>{if(!bundle)return;const x=await studioAction<any>("createShare",{documentId:bundle.document.id,appOrigin:window.location.origin});await navigator.clipboard.writeText(x.url);setNotice("Ссылка скопирована: "+x.url)};
 const refreshDrive=async()=>{try{const d=await studioAction<any>("driveStatus");setDrive(d);if(d.connection?.status==="CONNECTED")setDriveFiles(await studioAction<any[]>("driveListRoot"))}catch(e){setNotice(e instanceof Error?e.message:String(e))}};
 const connectDrive=async()=>{try{const x=await driveOAuthStart(window.location.href);window.location.href=x.url}catch(e:any){setDrive(e.details||{error:e.message});setNotice(e.message)}};
 useEffect(()=>{if(diagnostics)setDrive((d:any)=>d||{connection:{status:"OPTIONAL_AUTH_LATER"},oauthConfigured:false,conflicts:[]})},[diagnostics]);

 const navRoots=objects.filter(o=>o.kind==="frame"&&!o.parent_id),filtered=search?objects.filter(o=>(o.title+" "+o.semantic_path).toLowerCase().includes(search.toLowerCase())):navRoots;
 const recentActivity=selectedObject?.kind==="frame"?activity.filter(a=>a.semantic_path.startsWith(selectedObject.semantic_path)):activity;
 const courses=objects.filter(o=>o.kind==="frame"&&o.parent_id==="frame-learning"&&o.id.startsWith("course-"));
 const lessons=objects.filter(o=>o.kind==="frame"&&o.semantic_path.startsWith("Обучение/")&&o.semantic_path.includes("/Занятие "));
 const articleRefs=objects.filter(o=>o.kind==="documentRef"&&o.semantic_path.startsWith("Статьи/"));
 const exportJson=()=>{if(!overview)return;const blob=new Blob([JSON.stringify({schemaVersion:"tqs-studio-world/v5",overview,documents,selectedDocument:bundle},null,2)],{type:"application/json"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download="tqs-studio-v5.json";a.click();setTimeout(()=>URL.revokeObjectURL(u),0)};
 const importJson=async(file:File)=>{const x=JSON.parse(await file.text());if(!x?.overview?.objects)throw new Error("Invalid V5 export");for(const o of x.overview.objects as StudioObject[]){const existing=objects.find(z=>z.id===o.id);if(existing)await studioAction("updateObject",{id:o.id,revision:existing.revision,patch:o});else await studioAction("createWorldObject",{object:o})}await load();setNotice("JSON импортирован в server state")};

 return <main className={styles.shell} data-theme={theme} onPaste={onPaste}>
  <header className={styles.topbar}>
   <div className={styles.brand}><strong>TQS Studio</strong><span>V5</span></div>
   <div className={styles.switch}><button className={surface==="world"?styles.active:""} onClick={()=>setSurface("world")}>Мир <kbd>⌘1</kbd></button><button className={surface==="documents"?styles.active:""} onClick={()=>setSurface("documents")}>Документы <kbd>⌘2</kbd></button></div>
   <div className={styles.topactions}>{surface==="world"&&selectedObject&&<button onClick={createDocumentFromSelected}><FileText size={14}/>Документ</button>}<button onClick={()=>setTheme(v=>v==="dark"?"light":"dark")} title="Светлая / тёмная тема">{theme==="dark"?<Sun size={15}/>:<Moon size={15}/>}</button><button onClick={()=>setDiagnostics(v=>!v)} title="Диагностика"><Settings size={15}/></button><span title="Открытый прототип" style={{fontSize:9,color:"#8d887e",padding:"0 6px"}}>OPEN</span></div>
  </header>
  {notice&&<div className={styles.notice} onClick={()=>setNotice("")}>{notice}<X size={12}/></div>}
  {surface==="world"?<div className={styles.body}>
    <aside data-testid="world-navigator" className={worldNav?styles.navigator:styles.rail}>
     <div className={styles.navhead}>{worldNav?<><div><strong>Навигатор</strong><small>семантика</small></div><button title="Свернуть навигатор" onClick={()=>setWorldNav(false)}><PanelLeftClose size={15}/></button></>:<button title="Развернуть навигатор" onClick={()=>setWorldNav(true)}><PanelLeftOpen size={15}/></button>}</div>
     {worldNav&&<><label className={styles.search}><Search size={13}/><input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск  ⌘K"/></label>{search?<div className={styles.tree}>{filtered.map(o=><button key={o.id} onClick={()=>o.kind==="documentRef"&&o.body?.documentId?void openDocument(o.body.documentId):focusObject(o.id)}><CircleDot size={10}/><span>{o.title}</span><small>{o.semantic_path}</small></button>)}</div>:<><section className={styles.recent}><strong>Проекты</strong>{navRoots.map(o=><button key={o.id} onClick={()=>focusObject(o.id)}><span>{o.title}</span><small>{o.semantic_path}</small></button>)}</section><section className={styles.recent}><strong>Курсы</strong>{courses.map(o=><button key={o.id} onClick={()=>focusObject(o.id)}><span>{o.title}</span><small>{o.semantic_path}</small></button>)}</section><section className={styles.recent}><strong>Занятия</strong>{lessons.map(o=>{const doc=documents.find(d=>d.frame_id===o.id);return <button key={o.id} onClick={()=>doc?void openDocument(doc.id):focusObject(o.id)}><span>{o.title}</span><small>{doc?"Открыть документ · ":"На доске · "}{o.semantic_path}</small></button>})}</section><section className={styles.recent}><strong>Статьи</strong>{articleRefs.map(o=><button key={o.id} onClick={()=>o.body?.documentId&&void openDocument(o.body.documentId)}><span>{o.title}</span><small>{o.semantic_path}</small></button>)}</section></>}<section className={styles.recent}><strong>{selectedObject?.kind==="frame"?"Недавние · "+selectedObject.title:"Недавние"}</strong>{recentActivity.slice(0,12).map(a=><button key={a.id} onClick={()=>a.entity_id&&focusObject(a.entity_id)}><span>{a.summary}</span><small>{a.semantic_path}</small></button>)}</section></>}
    </aside>
    <section ref={canvas as any} data-testid="world-canvas" className={[styles.canvas,grid?styles.grid:""].join(" ")} tabIndex={0}
      onPointerDown={e=>{if((e.target as HTMLElement).closest?.("[data-studio-ui]"))return;const p=screenToWorld(e.clientX,e.clientY);lastPointer.current={...p,at:Date.now()};if(drawMode){const hit=(e.target as HTMLElement).closest?.("[data-studio-object]") as HTMLElement|null;drawTargetImage.current=hit?.dataset.studioKind==="image"?(hit.dataset.studioId||null):(objects.filter(o=>o.kind==="image"&&p.x>=o.x&&p.x<=o.x+o.w&&p.y>=o.y&&p.y<=o.y+o.h).sort((a,b)=>b.z-a.z)[0]?.id||null);setDrawPoints([p]);return}if(e.button===1||(space&&e.button===0)){e.preventDefault();setGesture({type:"pan",sx:e.clientX,sy:e.clientY,x:camera.x,y:camera.y});return}if(e.button===0&&e.target===e.currentTarget){setSelected(null);setEditing(null);setContext(null)}}}
      onPointerMove={pointerMove} onPointerUp={()=>void pointerUp()} onPointerCancel={()=>void pointerUp()} onDragOver={e=>e.preventDefault()} onDrop={e=>void onDrop(e)}
      onContextMenu={e=>{if((e.target as HTMLElement).closest("[data-studio-object]"))return;e.preventDefault();const r=e.currentTarget.getBoundingClientRect(),p=screenToWorld(e.clientX,e.clientY);setContext({sx:e.clientX-r.left,sy:e.clientY-r.top,wx:p.x,wy:p.y})}}>
      <div className={styles.world} style={{transform:"translate("+camera.x+"px,"+camera.y+"px) scale("+camera.zoom+")",width:WORLD_W,height:WORLD_H}}>
       {objects.filter(o=>!o.hidden&&o.kind!=="annotation").sort((a,b)=>a.z-b.z).map(o=><WorldObject key={o.id} object={o} compact={lod!=="near"&&o.kind!=="frame"&&selected!==o.id&&editing!==o.id} selected={selected===o.id} editing={editing===o.id}
         onSelect={()=>setSelected(o.id)} onMoveStart={e=>startMove(e,o)} onResizeStart={e=>startResize(e,o)} onEdit={()=>setEditing(o.id)} onStopEdit={()=>setEditing(null)}
         onPatch={(p,eventType,summary)=>void updateObject(o.id,p,eventType,summary)} onOpenDocument={openDocument}/>)}
       {objects.filter(o=>!o.hidden&&o.kind==="annotation").map(o=><Annotation key={o.id} object={o}/>)}
       {drawPoints.length>1&&<svg className={styles.drawdraft} width={WORLD_W} height={WORLD_H}><polyline points={drawPoints.map(p=>p.x+","+p.y).join(" ")} fill="none" stroke="#d6a94c" strokeWidth={drawMode==="marker"?18:3} strokeLinecap="round"/></svg>}
       {gesture?.type==="move"&&<><div className={styles.guideV}/><div className={styles.guideH}/></>}
      </div>
      <div className={styles.worldtools} data-studio-ui><button title="Добавить" onClick={()=>{const p=insertionPoint(),w=canvas.current?.clientWidth||500;setContext({sx:Math.max(12,w-240),sy:54,wx:p.x,wy:p.y})}}><Plus size={14}/></button><button title="Карандаш" className={drawMode==="pencil"?styles.toolactive:""} onClick={()=>setDrawMode(drawMode==="pencil"?null:"pencil")}><PenLine size={14}/></button><button title="Маркер" className={drawMode==="marker"?styles.toolactive:""} onClick={()=>setDrawMode(drawMode==="marker"?null:"marker")}><SquarePen size={14}/></button><button title="Стрелка" className={drawMode==="arrow"?styles.toolactive:""} onClick={()=>setDrawMode(drawMode==="arrow"?null:"arrow")}>↗</button><button title="Вписать мир" onClick={fitWorld}><Maximize2 size={14}/></button></div>
      {context&&<ContextMenu at={context} onAdd={(kind,extra)=>void createObject(kind,{point:{x:context.wx,y:context.wy},...extra})} onDraw={m=>{setDrawMode(m);setContext(null)}}/>}
    </section>
   </div>:<DocumentsMode docs={documents} bundle={bundle} open={openDocument} navOpen={docNav} setNavOpen={setDocNav} setBundle={setBundle} onWorld={()=>bundle?.document.frame_id&&focusObject(bundle.document.frame_id)} onShare={()=>void share()}/>}
  {diagnostics&&<Diagnostics overview={overview} lod={lod} grid={grid} setGrid={setGrid} onClose={()=>setDiagnostics(false)} onExport={exportJson} onImport={file=>void importJson(file).catch(e=>setNotice(e.message))} importRef={importRef} drive={drive} driveFiles={driveFiles} refreshDrive={()=>void refreshDrive()} connectDrive={()=>void connectDrive()} syncDrive={()=>void studioAction("driveSyncCheckpoint",{}).then(x=>{setNotice("Drive checkpoint: "+JSON.stringify(x));return refreshDrive()}).catch(e=>setNotice(e.message))} conflictProbe={()=>void studioAction("driveConflictProbe",{expectedDriveVersion:"__STALE__"}).then(x=>setNotice("Conflict probe: "+JSON.stringify(x))).catch(e=>setNotice(e.message))} onReset={()=>{resetLocalStudio();didInitialFit.current=false;void load();setNotice("Демо восстановлено")}}/>}
 </main>
}

function isEditableTarget(target:EventTarget|null){const e=target as HTMLElement|null;return Boolean(e?.isContentEditable||["INPUT","TEXTAREA","SELECT","BUTTON","A","VIDEO","AUDIO"].includes(e?.tagName||""))}
function escapeHtml(s:string){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]||m))}
function pdfAscii(v:unknown){return String(v??"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().normalize("NFKD").replace(/[^\x20-\x7E]/g,"?")}
function pdfEsc(v:string){return v.replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)")}
function studioPdfHref(bundle:DocumentBundle){
 const lines:string[]=["TQS Studio PDF","Document: "+pdfAscii(bundle.document.title),"Path: "+pdfAscii(bundle.document.semantic_path),"Revision: "+String(bundle.document.revision),""];
 for(const block of [...bundle.blocks].sort((a,b)=>a.ordinal-b.ordinal)){
  const c:any=block.content||{},label=pdfAscii(c.title||c.text||c.html||c.caption||"");
  if(label)lines.push("["+pdfAscii(block.block_type)+"] "+label,"");
 }
 while(lines.join("\n").length<1500)lines.push("TQS Studio document export");
 const perPage=48,pages:string[][]=[];for(let i=0;i<lines.length;i+=perPage)pages.push(lines.slice(i,i+perPage));
 const fontObj=3+pages.length*2,objs:Record<number,string>={1:"<< /Type /Catalog /Pages 2 0 R >>"};
 objs[2]=`<< /Type /Pages /Kids [${pages.map((_,i)=>`${3+i*2} 0 R`).join(" ")}] /Count ${pages.length} >>`;
 pages.forEach((page,i)=>{const p=3+i*2,c=p+1,cmd=page.map((line,j)=>`BT /F1 9 Tf 42 ${800-j*15} Td (${pdfEsc(pdfAscii(line))}) Tj ET`).join("\n");objs[p]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObj} 0 R >> >> /Contents ${c} 0 R >>`;objs[c]=`<< /Length ${cmd.length} >>\nstream\n${cmd}\nendstream`});
 objs[fontObj]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
 let pdf="%PDF-1.4\n%TQS-STUDIO\n";const offsets:number[]=[0];
 for(let n=1;n<=fontObj;n++){offsets[n]=pdf.length;pdf+=`${n} 0 obj\n${objs[n]}\nendobj\n`}
 const xref=pdf.length;pdf+=`xref\n0 ${fontObj+1}\n0000000000 65535 f \n`;for(let n=1;n<=fontObj;n++)pdf+=String(offsets[n]).padStart(10,"0")+" 00000 n \n";pdf+=`trailer\n<< /Size ${fontObj+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return "data:application/pdf;charset=us-ascii,"+encodeURIComponent(pdf)
}

function WorldObject({object:o,compact,selected,editing,onSelect,onMoveStart,onResizeStart,onEdit,onStopEdit,onPatch,onOpenDocument}:{object:StudioObject;compact:boolean;selected:boolean;editing:boolean;onSelect:()=>void;onMoveStart:(e:React.PointerEvent)=>void;onResizeStart:(e:React.PointerEvent)=>void;onEdit:()=>void;onStopEdit:()=>void;onPatch:(p:any,eventType?:string,summary?:string)=>void;onOpenDocument:(id:string)=>void}){
 if(compact)return <button data-studio-object data-studio-id={o.id} data-studio-kind={o.kind} data-testid={"lod-chip-"+o.kind} className={styles.chip} style={{left:o.x,top:o.y,zIndex:o.z}} onPointerDown={e=>{onSelect();onMoveStart(e)}} onDoubleClick={onEdit}><span>{iconFor(o.kind)}</span><b>{o.title}</b></button>;
 return <div data-studio-object data-studio-id={o.id} data-studio-kind={o.kind} data-testid={"world-"+o.kind} className={[styles.object,styles["kind_"+o.kind]||"",selected?styles.selected:""].join(" ")} style={{left:o.x,top:o.y,width:o.w,height:o.h,zIndex:o.z}} onPointerDownCapture={onSelect}>
  {o.kind==="frame"?<div className={styles.framehead} onPointerDown={onMoveStart}><strong>{o.title}</strong><small>{o.semantic_path}</small></div>:<div className={styles.handle} onPointerDown={onMoveStart}><span>{o.title}</span><MoreHorizontal size={12}/></div>}
  {o.kind!=="frame"&&<div className={styles.content}>
   {o.kind==="text"&&<TextObject object={o} editing={editing} onEdit={onEdit} onStop={onStopEdit} onPatch={onPatch}/>}
   {o.kind==="task"&&<TaskObject object={o} editing={editing} onEdit={onEdit} onStop={onStopEdit} onPatch={onPatch}/>}
   {o.kind==="voice"&&<VoiceObject object={o} onPatch={onPatch}/>}
   {o.kind==="image"&&<AssetObject object={o} kind="image"/>}
   {o.kind==="video"&&<AssetObject object={o} kind="video"/>}
   {o.kind==="file"&&<AssetObject object={o} kind="file"/>}
   {o.kind==="link"&&<LinkObject object={o} editing={editing} onStop={onStopEdit} onPatch={onPatch}/>}
   {o.kind==="chart"&&<StudioMarketChart dataSpec={o.body?.dataSpec as DataSpec}/>}
   {o.kind==="documentRef"&&<button className={styles.docref} onClick={()=>onOpenDocument(o.body?.documentId||o.relations?.find((r:any)=>r.type==="document_of")?.targetId)}><BookOpen size={20}/><span>Открыть документ</span></button>}
  </div>}
  {selected&&<span className={styles.resize} onPointerDown={onResizeStart}/>}
 </div>
}
function iconFor(kind:string){return kind==="text"?"T":kind==="task"?"✓":kind==="voice"?"◉":kind==="image"?"▧":kind==="video"?"▶":kind==="link"?"↗":kind==="chart"?"⌁":kind==="documentRef"?"D":"•"}

function TextObject({object:o,editing,onEdit,onStop,onPatch}:{object:StudioObject;editing:boolean;onEdit:()=>void;onStop:()=>void;onPatch:(p:any,e?:string,s?:string)=>void}){
 const ref=useRef<HTMLDivElement>(null),[bubble,setBubble]=useState(false);
 useEffect(()=>{if(!ref.current)return;if(!editing)ref.current.innerHTML=asHtml(o.body)||"<p></p>"},[editing,o.body?.html]);
 useEffect(()=>{if(editing&&ref.current){if(!ref.current.innerHTML)ref.current.innerHTML=asHtml(o.body)||"<p></p>";ref.current.focus();const sel=window.getSelection(),range=document.createRange();range.selectNodeContents(ref.current);range.collapse(false);sel?.removeAllRanges();sel?.addRange(range)}},[editing]);
 useEffect(()=>{const f=()=>{const s=window.getSelection();setBubble(Boolean(editing&&s&&!s.isCollapsed&&ref.current?.contains(s.anchorNode)))};document.addEventListener("selectionchange",f);return()=>document.removeEventListener("selectionchange",f)},[editing]);
 useEffect(()=>{if(!editing||!ref.current)return;const el=ref.current,observer=new MutationObserver(()=>saveLocalObjectDraft(o.id,{body:{...o.body,html:el.innerHTML}}));observer.observe(el,{subtree:true,childList:true,characterData:true});return()=>observer.disconnect()},[editing,o.id]);
 return <div className={styles.textobj} onDoubleClick={onEdit}>{bubble&&<div className={styles.bubble}>{[["bold","B"],["italic","I"],["formatBlock","H2"],["insertUnorderedList","•"],["formatBlock","❝"]].map(([cmd,label],i)=><button key={i} onMouseDown={e=>e.preventDefault()} onClick={()=>document.execCommand(cmd,false,label==="H2"?"h2":label==="❝"?"blockquote":undefined)}>{label}</button>)}</div>}<div ref={ref} contentEditable={editing} suppressContentEditableWarning className={styles.editable} onInput={e=>{if(editing)saveLocalObjectDraft(o.id,{body:{...o.body,html:e.currentTarget.innerHTML}})}} onBlur={e=>{const html=e.currentTarget.innerHTML;saveLocalObjectDraft(o.id,{body:{...o.body,html}});onPatch({body:{...o.body,html}},"text_update","Текст обновлён");onStop()}}/></div>
}
function TaskObject({object:o,editing,onEdit,onStop,onPatch}:{object:StudioObject;editing:boolean;onEdit:()=>void;onStop:()=>void;onPatch:(p:any,e?:string,s?:string)=>void}){
 const [value,setValue]=useState(o.body?.title||o.title);const save=()=>{onPatch({title:value,body:{...o.body,title:value}},"task","Задача обновлена");onStop()};
 return <div className={styles.task}><button onClick={()=>onPatch({status:o.status==="DONE"?"NEW":"DONE",body:{...o.body,done:o.status!=="DONE"}},"task","Статус задачи изменён")}>{o.status==="DONE"?"✓":"○"}</button>{editing?<input autoFocus value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")save();if(e.key==="Escape")onStop()}} onBlur={save}/>:<span onDoubleClick={onEdit}>{o.body?.title||o.title}</span>}</div>
}
function LinkObject({object:o,editing,onStop,onPatch}:{object:StudioObject;editing:boolean;onStop:()=>void;onPatch:(p:any,e?:string,s?:string)=>void}){
 const [v,setV]=useState(o.body?.url||"");return <div className={styles.link}>{editing?<input autoFocus value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){onPatch({body:{...o.body,url:v}},"text_update","Ссылка обновлена");onStop()}if(e.key==="Escape")onStop()}} onBlur={()=>{onPatch({body:{...o.body,url:v}},"text_update");onStop()}}/>:<a href={v} target="_blank" rel="noreferrer"><LinkIcon size={15}/>{v||"Добавить ссылку"}</a>}</div>
}
function VoiceObject({object:o,onPatch}:{object:StudioObject;onPatch:(p:any,e?:string,s?:string)=>void}){
 const rec=useRef<MediaRecorder|null>(null),chunks=useRef<Blob[]>([]),started=useRef(0);const [recording,setRecording]=useState(false),[seconds,setSeconds]=useState(0),[url,setUrl]=useState<string|null>(o.body?.previewUrl||null);
 useEffect(()=>{if(!o.body?.assetId||url)return;void studioAction<any>("getAssetUrl",{assetId:o.body.assetId}).then(x=>setUrl(x.signedUrl)).catch(()=>{})},[o.body?.assetId,url]);
 useEffect(()=>{if(!recording)return;const id=window.setInterval(()=>setSeconds(Math.floor((Date.now()-started.current)/1000)),250);return()=>window.clearInterval(id)},[recording]);
 const start=async()=>{const stream=await navigator.mediaDevices.getUserMedia({audio:true}),r=new MediaRecorder(stream);chunks.current=[];r.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};r.onstop=()=>{const duration=Math.max(1,Math.round((Date.now()-started.current)/1000)),blob=new Blob(chunks.current,{type:r.mimeType||"audio/webm"});stream.getTracks().forEach(t=>t.stop());void blobToDataUrl(blob).then(dataUrl=>studioAction<any>("attachAsset",{dataUrl,filename:"voice-"+Date.now()+".webm"})).then(a=>{setUrl(a.signedUrl);onPatch({body:{...o.body,assetId:a.asset.id,duration,status:"Ожидает расшифровки"},status:"WAITING_TRANSCRIPTION"},"voice","Голосовая заметка сохранена")}).catch(()=>{})};started.current=Date.now();setSeconds(0);r.start();rec.current=r;setRecording(true)};
 const stop=()=>{rec.current?.stop();setRecording(false)};
 return <div className={styles.voice}>{recording?<button className={styles.stop} onClick={stop}>Stop · {formatSec(seconds)}</button>:<button onClick={start}><Mic size={14}/>Записать</button>}{url&&<audio controls src={url}/>}<small>{o.body?.duration?formatSec(o.body.duration)+" · ":""}{o.body?.status||"Готово к записи"}</small></div>
}
function blobToDataUrl(blob:Blob){return new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error);r.readAsDataURL(blob)})}
function formatSec(n:number){return Math.floor(n/60)+":"+String(n%60).padStart(2,"0")}
function AssetObject({object:o,kind}:{object:StudioObject;kind:string}){
 const [url,setUrl]=useState<string|null>(o.body?.previewUrl||null);useEffect(()=>{if(!o.body?.assetId||url)return;void studioAction<any>("getAssetUrl",{assetId:o.body.assetId}).then(x=>setUrl(x.signedUrl)).catch(()=>{})},[o.body?.assetId,url]);
 return kind==="image"?<div className={styles.image}>{url?<img src={url} alt={o.title}/>:<ImageIcon size={28}/>}</div>:kind==="video"?<div className={styles.image}>{url?<video controls src={url} style={{width:"100%",height:"100%",objectFit:"contain"}}/>:<span>Видео</span>}</div>:<div className={styles.file}><FileText size={20}/><span>{o.body?.filename||o.title}</span></div>
}
function Annotation({object:o}:{object:StudioObject}){const p=o.body?.points||[],kind=o.body?.annotationKind;return <svg data-testid="world-annotation" className={styles.annotation} style={{left:o.x,top:o.y,width:o.w,height:o.h,zIndex:o.z}} viewBox={"0 0 "+Math.max(1,o.w)+" "+Math.max(1,o.h)}><defs><marker id={"arrow-"+o.id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#d6a94c"/></marker></defs><polyline points={p.map((x:any)=>x.x+","+x.y).join(" ")} fill="none" stroke={kind==="marker"?"rgba(214,169,76,.42)":"#d6a94c"} strokeWidth={kind==="marker"?18:3} strokeLinecap="round" strokeLinejoin="round" markerEnd={kind==="arrow"?"url(#arrow-"+o.id+")":undefined}/></svg>}

function ContextMenu({at,onAdd,onDraw}:{at:any;onAdd:(kind:string,extra?:any)=>void;onDraw:(m:DrawMode)=>void}){const rows=[["voice","Голосовая заметка"],["text","Текст"],["task","Задача"],["image","Картинка / скриншот"],["link","Ссылка"],["chart","График / данные"],["file","PDF / документ"],["video","Видео"],["frame","Фрейм / раздел"]];return <div className={styles.context} data-studio-ui data-testid="add-menu" style={{left:at.sx,top:at.sy}}><strong>Добавить сюда</strong>{rows.map(([k,l])=><button key={k} onClick={()=>onAdd(k,k==="chart"?{body:{dataSpec:{provider:"MOEX_ISS",instrument:{family:"SI",resolver:"front_active_contract"},metric:"ohlcv_session",relativeRange:{tradingSessions:2},transforms:["group_by_session","cumulative_volume"],display:{renderer:"studio_market_chart"},updatePolicy:"LIVE",asOf:null}}}:undefined)}>{l}</button>)}<button onClick={()=>onDraw("pencil")}>Карандаш / маркер</button><button onClick={()=>onDraw("arrow")}>Стрелка / связь</button></div>}

function DocumentsMode({docs,bundle,open,navOpen,setNavOpen,setBundle,onWorld,onShare}:{docs:StudioDocument[];bundle:DocumentBundle|null;open:(id:string)=>Promise<void>;navOpen:boolean;setNavOpen:(v:boolean)=>void;setBundle:(x:DocumentBundle)=>void;onWorld:()=>void;onShare:()=>void}){
 return <div className={styles.documents}>
  <aside data-testid="document-navigator" className={navOpen?styles.docnav:styles.docrail}><div className={styles.navhead}>{navOpen?<><div><strong>Документы</strong><small>линейная база</small></div><button title="Свернуть документы" onClick={()=>setNavOpen(false)}><PanelLeftClose size={15}/></button></>:<button title="Развернуть документы" onClick={()=>setNavOpen(true)}><PanelLeftOpen size={15}/></button>}</div>{navOpen&&<div className={styles.doclist}>{docs.map(d=><button key={d.id} className={bundle?.document.id===d.id?styles.activeDoc:""} onClick={()=>void open(d.id)}><small>{d.kind}</small><strong>{d.title}</strong><span>r{d.revision}</span></button>)}</div>}</aside>
  <section data-testid="document-surface" className={styles.docsurface}>{bundle?<><header className={styles.doctoolbar}><div><small>{bundle.document.kind}</small><h1>{bundle.document.title}</h1><span>{bundle.document.semantic_path} · revision {bundle.document.revision}</span></div><div><button onClick={onWorld}>На доске</button><button onClick={onShare}>Поделиться</button><a role="button" href={studioPdfHref(bundle)} download={bundle.document.title+".pdf"}><Download size={14}/>PDF</a></div></header><DocumentEditorV5 bundle={bundle} onBundle={setBundle}/></>:<div className={styles.empty}>Выберите документ</div>}</section>
 </div>
}
function Diagnostics({overview,lod,grid,setGrid,onClose,onExport,onImport,importRef,onReset}:{overview:WorldOverview|null;lod:string;grid:boolean;setGrid:(v:boolean)=>void;onClose:()=>void;onExport:()=>void;onImport:(f:File)=>void;importRef:React.RefObject<HTMLInputElement|null>;drive?:any;driveFiles?:any[];refreshDrive?:()=>void;connectDrive?:()=>void;syncDrive?:()=>void;conflictProbe?:()=>void;onReset:()=>void}){
 return <div className={styles.diag}><header><strong>Диагностика</strong><button onClick={onClose}><X size={14}/></button></header><section><b>World</b><span>Revision: {overview?.world.revision||"—"}</span><span>LOD: {lod}</span><label><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/> Grid</label><div><button onClick={onExport}><FileJson size={13}/>JSON Export</button><button onClick={()=>importRef.current?.click()}><Upload size={13}/>Import</button><button onClick={onReset}>Сбросить демо</button><input ref={importRef} hidden type="file" accept="application/json" onChange={e=>{const f=e.target.files?.[0];if(f)onImport(f);e.target.value=""}}/></div></section><section><b>Google Drive</b><span>Интеграция отложена до owner review. Мир и документы сейчас работают без авторизации.</span></section></div>
}

"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {BookOpen,ChevronDown,ChevronRight,Clock3,FileText,Folder,PanelLeftClose,PanelLeftOpen,Search,SquareStack} from "lucide-react";
import type {StudioActivity,StudioDocument,StudioObject} from "@/lib/studio-v5/types";

type Props={objects:StudioObject[];documents:StudioDocument[];activity:StudioActivity[];selectedId:string|null;onFocus:(id:string)=>void;onOpenDocument:(id:string)=>void;onOpenDrive:()=>void};
type Node={id:string;title:string;path:string;kind:string;object?:StudioObject;document?:StudioDocument;children:Node[]};
const EXP_KEY="tqs-studio-v6-nav-expanded";
function isDocRef(o:StudioObject){return o.kind==="documentRef"&&Boolean(o.body?.documentId)}
function buildTree(objects:StudioObject[],documents:StudioDocument[]):Node[]{
 const nodes=new Map<string,Node>();
 for(const o of objects.filter(x=>x.kind==="frame"||isDocRef(x)))nodes.set(o.id,{id:o.id,title:o.title,path:o.semantic_path,kind:o.kind,object:o,children:[]});
 const roots:Node[]=[];
 for(const n of nodes.values()){
  const parent=n.object?.parent_id?nodes.get(n.object.parent_id):null;
  if(parent)parent.children.push(n);else roots.push(n);
 }
 for(const d of documents){
  const already=[...nodes.values()].some(n=>n.object?.body?.documentId===d.id);if(already)continue;
  const node:Node={id:"doc:"+d.id,title:d.title,path:d.semantic_path,kind:"document",document:d,children:[]};
  const frame=d.frame_id?nodes.get(d.frame_id):null;if(frame)frame.children.push(node);else roots.push(node);
 }
 const sort=(a:Node,b:Node)=>a.path.localeCompare(b.path,"ru");const walk=(a:Node[])=>{a.sort(sort);for(const n of a)walk(n.children)};walk(roots);return roots;
}
export function NavigatorV6({objects,documents,activity,selectedId,onFocus,onOpenDocument,onOpenDrive}:Props){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[expanded,setExpanded]=useState<Set<string>>(new Set());const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{try{const x=JSON.parse(localStorage.getItem(EXP_KEY)||"[]");if(Array.isArray(x))setExpanded(new Set(x))}catch{}},[]);
 useEffect(()=>{try{localStorage.setItem(EXP_KEY,JSON.stringify([...expanded]))}catch{}},[expanded]);
 useEffect(()=>{const f=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setOpen(true);requestAnimationFrame(()=>input.current?.focus())}};window.addEventListener("keydown",f);return()=>window.removeEventListener("keydown",f)},[]);
 const tree=useMemo(()=>buildTree(objects,documents),[objects,documents]);
 const flat=useMemo(()=>{const out:Node[]=[];const walk=(n:Node[])=>{for(const x of n){out.push(x);walk(x.children)}};walk(tree);return out},[tree]);
 const searchable=useMemo(()=>{const seenObjects=new Set(flat.map(n=>n.object?.id).filter(Boolean)),seenDocs=new Set(flat.map(n=>n.document?.id||n.object?.body?.documentId).filter(Boolean));const extraObjects=objects.filter(o=>!seenObjects.has(o.id)&&o.kind!=="annotation").map(o=>({id:o.id,title:o.title,path:o.semantic_path,kind:o.kind,object:o,children:[]} as Node));const extraDocs=documents.filter(d=>!seenDocs.has(d.id)).map(d=>({id:"doc:"+d.id,title:d.title,path:d.semantic_path,kind:"document",document:d,children:[]} as Node));return[...flat,...extraObjects,...extraDocs]},[flat,objects,documents]);
 const matches=query.trim()?searchable.filter(n=>(n.title+" "+n.path).toLowerCase().includes(query.trim().toLowerCase())).slice(0,40):[];
 const toggle=(id:string)=>setExpanded(v=>{const n=new Set(v);n.has(id)?n.delete(id):n.add(id);return n});
 const closeNav=()=>{setOpen(false);setQuery("")};
 const activate=(n:Node)=>{const docId=n.document?.id||n.object?.body?.documentId;closeNav();if(docId)onOpenDocument(docId);else if(n.object)onFocus(n.object.id);queueMicrotask(()=>setOpen(false))};
 const row=(n:Node,depth:number)=><div className="v6-nav-node" key={n.id} data-depth={depth}>
  <button className={["v6-nav-row",selectedId===n.object?.id?"is-active":""].join(" ")} style={{paddingLeft:8+depth*14}} onClick={()=>activate(n)}>
   {n.children.length?<span className="v6-nav-expander" role="button" aria-label={expanded.has(n.id)?"Свернуть":"Развернуть"} onClick={e=>{e.stopPropagation();toggle(n.id)}}>{expanded.has(n.id)?<ChevronDown size={12}/>:<ChevronRight size={12}/>}</span>:<span className="v6-nav-expander"/>}
   {n.kind==="frame"?<Folder size={13}/>:n.kind==="document"||isDocRef(n.object as StudioObject)?<FileText size={13}/>:<SquareStack size={13}/>}<span className="v6-nav-title">{n.title}</span>
  </button>{n.children.length&&expanded.has(n.id)&&<div>{n.children.map(c=>row(c,depth+1))}</div>}
 </div>;
 return <aside className={["v6-navigator",open?"is-open":"is-closed"].join(" ")} data-testid="v6-navigator" data-studio-ui>
  <div className="v6-nav-rail">
   <button title={open?"Свернуть навигатор":"Развернуть навигатор"} onClick={()=>setOpen(v=>!v)}>{open?<PanelLeftClose size={18}/>:<PanelLeftOpen size={18}/>}</button>
   <button title="Поиск" onClick={()=>{setOpen(true);requestAnimationFrame(()=>input.current?.focus())}}><Search size={17}/></button>
   <span className="v6-nav-divider"/>
   <button title="Мир" onClick={()=>{closeNav();onFocus(objects.some(o=>o.id==="lesson-miro-scene")?"lesson-miro-scene":objects.find(o=>o.kind==="frame"&&!o.parent_id)?.id||"")}}><SquareStack size={17}/></button><button title="Документы"><BookOpen size={17}/></button><button title="Диск" onClick={()=>{setOpen(false);onOpenDrive()}}><FileText size={17}/></button><button title="Недавние"><Clock3 size={17}/></button>
  </div>
  {open&&<div className="v6-nav-overlay">
   <header><div><strong>Навигатор</strong><small>Мир · Документы · Активность</small></div></header>
   <label className="v6-nav-search"><Search size={13}/><input ref={input} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){const q=e.currentTarget.value.trim().toLowerCase(),target=searchable.find(n=>(n.title+" "+n.path).toLowerCase().includes(q));if(target){e.preventDefault();activate(target)}}}} placeholder="Найти объект, материал или документ"/><kbd>Ctrl K</kbd></label>
   <div className="v6-nav-scroll">
    {query?<section><h3>Результаты</h3>{matches.length?matches.map(n=><button className="v6-nav-result" key={n.id} onClick={()=>activate(n)}><span>{n.title}</span><small>{n.path}</small></button>):<p className="v6-nav-empty">Ничего не найдено</p>}</section>:<>
     <section><h3>Структура мира</h3>{tree.map(n=>row(n,0))}</section>
     <section><h3>Документы</h3>{documents.slice().sort((a,b)=>a.title.localeCompare(b.title,"ru")).map(d=><button className="v6-nav-result" key={d.id} onClick={()=>{setOpen(false);onOpenDocument(d.id)}}><span>{d.title}</span><small>{d.semantic_path}</small></button>)}</section>
     <section><h3>Недавние изменения</h3>{activity.slice(0,14).map(a=><button className="v6-nav-result" key={a.id} onClick={()=>{setOpen(false);a.entity_id&&onFocus(a.entity_id)}}><span>{a.summary}</span><small>{a.semantic_path}</small></button>)}</section>
    </>}
   </div>
  </div>}
 </aside>
}

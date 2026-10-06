"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {Clock3,FileText,FolderTree,Globe,Search,Settings,Sparkles} from "lucide-react";
import type {StudioActivity,StudioDocument,StudioObject} from "@/lib/studio-v5/types";
import {creationMatches} from "@/lib/studio-v6/workstation";

type Surface="world"|"documents";
type Props={objects:StudioObject[];documents:StudioDocument[];activity:StudioActivity[];selectedId:string|null;surface:Surface;onWorld:()=>void;onFocus:(id:string)=>void;onOpenDocument:(id:string)=>void;onSettings:()=>void;onCreate:(kind:string)=>void};
type Node={id:string;title:string;path:string;kind:string;object?:StudioObject;document?:StudioDocument;children:Node[]};
type NavMode="map"|"search"|"documents"|"recent";
const EXP_KEY="tqs-studio-v6-nav-expanded";

function themeLabel(o:StudioObject){const html=String(o.body?.html||""),m=html.match(/<b>\s*(L1\.\d+|Тема\s*\d*)/i);return m?.[1]?.trim()||o.title}
function isTheme(o:StudioObject){return o.kind==="text"&&(/^(Тема|L1\.)/.test(o.title)||/<b>\s*(Тема|L1\.)/i.test(String(o.body?.html||"")))}
function buildTree(objects:StudioObject[]):Node[]{
 const nodes=new Map<string,Node>();
 for(const o of objects.filter(x=>!x.hidden&&(x.kind==="frame"||isTheme(x))))nodes.set(o.id,{id:o.id,title:o.id==="lesson-miro-scene"?"ЗАНЯТИЕ 1 · РАБОЧЕЕ ПРОСТРАНСТВО":o.id==="frame-learning"?"Обучение":isTheme(o)?themeLabel(o):o.title,path:o.semantic_path,kind:o.kind,object:o,children:[]});
 const roots:Node[]=[];
 for(const n of nodes.values()){
  const parent=n.object?.parent_id?nodes.get(n.object.parent_id):null;
  if(parent)parent.children.push(n);else roots.push(n);
 }
 const sort=(a:Node,b:Node)=>a.path.localeCompare(b.path,"ru");const walk=(a:Node[])=>{a.sort(sort);for(const n of a)walk(n.children)};walk(roots);return roots;
}

export function NavigatorV6({objects,documents,activity,selectedId,surface,onWorld,onFocus,onOpenDocument,onSettings,onCreate}:Props){
 const [open,setOpen]=useState(false),[mode,setMode]=useState<NavMode>("map"),[query,setQuery]=useState(""),[expanded,setExpanded]=useState<Set<string>>(new Set(["frame-learning","course-free","lesson-miro-scene"])),[moreId,setMoreId]=useState<string|null>(null);const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{try{const raw=localStorage.getItem(EXP_KEY);if(raw){const x=JSON.parse(raw);if(Array.isArray(x))setExpanded(new Set(x))}}catch{}},[]);
 useEffect(()=>{try{localStorage.setItem(EXP_KEY,JSON.stringify([...expanded]))}catch{}},[expanded]);
 useEffect(()=>{const f=(e:KeyboardEvent)=>{const target=e.target as HTMLElement|null;if(target?.isContentEditable||["INPUT","TEXTAREA"].includes(target?.tagName||""))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setMode("search");setOpen(true);requestAnimationFrame(()=>input.current?.focus())}};window.addEventListener("keydown",f);return()=>window.removeEventListener("keydown",f)},[]);
 const tree=useMemo(()=>buildTree(objects),[objects]);
 const flat=useMemo(()=>{const out:Node[]=[];const walk=(n:Node[])=>{for(const x of n){out.push(x);walk(x.children)}};walk(tree);return out},[tree]);
 const searchable=useMemo(()=>{const seen=new Set(flat.map(n=>n.object?.id).filter(Boolean));const extra=objects.filter(o=>!o.hidden&&!seen.has(o.id)&&o.kind!=="annotation").map(o=>({id:o.id,title:o.title,path:o.semantic_path,kind:o.kind,object:o,children:[]} as Node));const docs=documents.map(d=>({id:"doc:"+d.id,title:d.title,path:d.semantic_path,kind:"document",document:d,children:[]} as Node));return[...flat,...extra,...docs]},[flat,objects,documents]);
 const matches=query.trim()?searchable.filter(n=>(n.title+" "+n.path).toLowerCase().includes(query.trim().toLowerCase())).slice(0,24):[];
 const creates=creationMatches(query);
 const docFor=(n:Node)=>n.document||documents.find(d=>d.frame_id===n.object?.id)||null;
 const toggle=(id:string)=>setExpanded(v=>{const n=new Set(v);n.has(id)?n.delete(id):n.add(id);return n});
 const closeNav=()=>{setOpen(false);setQuery("");setMoreId(null)};
 const openMode=(next:NavMode)=>{if(open&&mode===next){closeNav();return}setMode(next);setOpen(true);if(next==="search")requestAnimationFrame(()=>input.current?.focus())};
 const focusNode=(n:Node)=>{if(!n.object)return;closeNav();onFocus(n.object.id)};
 const activate=(n:Node)=>{if(n.document){closeNav();onOpenDocument(n.document.id);return}focusNode(n)};
 const row=(n:Node,depth:number)=>{
  const doc=docFor(n);
  return <div className="v6-nav-node" key={n.id} data-depth={depth}>
   <div className={["v6-nav-line",selectedId===n.object?.id?"is-active":""].join(" ")}>
    <button className="v6-nav-row" style={{paddingLeft:8+depth*14}} onClick={()=>n.object?focusNode(n):activate(n)}>
     {n.children.length?<span className="v6-nav-expander" role="button" aria-label={expanded.has(n.id)?"Свернуть":"Развернуть"} onClick={e=>{e.stopPropagation();toggle(n.id)}}>{expanded.has(n.id)?"▾":"▸"}</span>:<span className="v6-nav-expander"/>}
     <span className="v6-nav-title">{n.title}</span>
    </button>
    <span className="v6-nav-hover">
     {n.object&&<button type="button" aria-label="На доске" title="На доске" onClick={()=>focusNode(n)}>◎</button>}
     {doc&&<button type="button" aria-label="Открыть документ" title="Открыть документ" onClick={()=>{closeNav();onOpenDocument(doc.id)}}><FileText size={13}/></button>}
     <button type="button" aria-label="Ещё" title="Ещё" onClick={()=>setMoreId(v=>v===n.id?null:n.id)}>…</button>
    </span>
   </div>
   {moreId===n.id&&<div className="v6-nav-more">
    {n.object&&<button onClick={()=>focusNode(n)}>На доске</button>}
    {doc&&<button onClick={()=>{closeNav();onOpenDocument(doc.id)}}>Открыть документ</button>}
    <button onClick={()=>{void navigator.clipboard?.writeText(n.path);setMoreId(null)}}>Копировать путь</button>
   </div>}
   {n.children.length>0&&expanded.has(n.id)?<div>{n.children.map(c=>row(c,depth+1))}</div>:null}
  </div>
 };
 return <aside className={["v6-navigator",open?"is-open":"is-closed"].join(" ")} data-testid="v6-navigator" data-studio-ui>
  <div className="v6-nav-rail" aria-label="Навигация студии">
   <button className={surface==="world"&&!open?"active":""} aria-label="Мир" title="Мир" onClick={()=>{onWorld();closeNav();window.dispatchEvent(new CustomEvent("tqs-studio-fit"))}}><Globe size={16}/></button>
   <button className={open&&mode==="search"?"active":""} aria-label="Поиск" title="Поиск" onClick={()=>{onWorld();openMode("search")}}><Search size={16}/></button>
   <button className={open&&mode==="map"?"active":""} aria-label="Навигатор" title="Навигатор" onClick={()=>{onWorld();openMode("map")}}><FolderTree size={16}/></button>
   <button className={open&&mode==="documents"?"active":""} aria-label="Документы" title="Документы" onClick={()=>openMode("documents")}><FileText size={16}/></button>
   <button className={open&&mode==="recent"?"active":""} aria-label="Недавние" title="Недавние" onClick={()=>openMode("recent")}><Clock3 size={16}/></button>
   <span className="v6-nav-spacer"/>
   <button aria-label="Настройки" title="Настройки" onClick={()=>{closeNav();onSettings()}}><Settings size={16}/></button>
  </div>
  {open&&<div className="v6-nav-overlay" data-testid={mode==="search"?"command-palette":"nav-overlay"}>
   <header><div><strong>{mode==="map"?"Навигатор":mode==="search"?"Поиск":mode==="documents"?"Документы":"Недавние"}</strong><small>{mode==="map"?"Проект → курс → занятие":mode==="search"?"Найти или добавить":mode==="documents"?"Открыть материал":"Что менялось"}</small></div></header>
   {mode==="search"&&<label className="v6-nav-search"><Search size={13}/><input ref={input} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){const q=e.currentTarget.value.trim().toLowerCase();const target=searchable.find(n=>(n.title+" "+n.path).toLowerCase().includes(q));if(target){e.preventDefault();activate(target);return}const made=creationMatches(q)[0];if(made){e.preventDefault();closeNav();onCreate(made.kind)}}}} placeholder="Занятие, тема или что добавить…"/><kbd>⌘K</kbd></label>}
   <div className="v6-nav-scroll">
    {mode==="map"&&<section className="v6-nav-map">{tree.map(n=>row(n,0))}</section>}
    {mode==="search"&&<section>
     {(query?creates:creates.slice(0,6)).length>0&&<div className="v6-nav-create"><p>Что добавить?</p>{(query?creates:creates.slice(0,6)).map(item=><button key={item.kind} onClick={()=>{closeNav();onCreate(item.kind)}}><Sparkles size={13}/>{item.title}</button>)}</div>}
     {query?matches.length?matches.map(n=><button className="v6-nav-result" key={n.id} onClick={()=>activate(n)}><span>{n.title}</span><small>{n.path}</small></button>):!creates.length&&<p className="v6-nav-empty">Ничего не найдено</p>:<p className="v6-nav-empty">Найдите комнату или начните с команды: график, youtube, занятие.</p>}
    </section>}
    {mode==="documents"&&<section>{documents.slice().sort((a,b)=>a.title.localeCompare(b.title,"ru")).map(d=><button className="v6-nav-result" key={d.id} onClick={()=>{closeNav();onOpenDocument(d.id)}}><span>{d.title}</span><small>{d.semantic_path}</small></button>)}</section>}
    {mode==="recent"&&<section>{activity.length?activity.slice(0,18).map(a=><button className="v6-nav-result" key={a.id} onClick={()=>{closeNav();a.entity_id&&onFocus(a.entity_id)}}><span>{a.summary}</span><small>{a.semantic_path}</small></button>):<p className="v6-nav-empty">Изменения появятся здесь после работы с доской.</p>}</section>}
   </div>
  </div>}
 </aside>
}

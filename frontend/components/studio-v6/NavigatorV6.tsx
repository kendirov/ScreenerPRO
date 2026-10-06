"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {FileText,FolderTree,LayoutDashboard,PenLine,Plug,Plus,Search,Settings} from "lucide-react";
import type {StudioActivity,StudioDocument,StudioObject} from "@/lib/studio-v5/types";
import {roomRole} from "@/lib/studio-v6/workstation";
import {roomPortal} from "@/lib/studio-v6/room-preview";
import {RoomPreview} from "./RoomPreview";

type Surface="world"|"documents";
type Props={
  objects:StudioObject[];
  documents:StudioDocument[];
  activity:StudioActivity[];
  selectedId:string|null;
  surface:Surface;
  onWorld:()=>void;
  onDocuments:()=>void;
  onFocus:(id:string)=>void;
  onOpenDocument:(id:string)=>void;
  onSettings:()=>void;
  onCreate:(kind:string)=>void;
  onTool:(tool:string)=>void;
};
type Node={id:string;title:string;path:string;kind:string;depth:number;object?:StudioObject;document?:StudioDocument;children:Node[]};
type NavMode="map"|"search"|"create"|"integrations";

function themeLabel(object:StudioObject){
  const html=String(object.body?.html||"");
  const match=html.match(/<b>\s*(L1\.\d+|Тема\s*\d*)/i);
  return match?.[1]?.trim()||object.title;
}
function isTheme(object:StudioObject){return object.kind==="text"&&(/^(Тема|L1\.)/.test(object.title)||/<b>\s*(Тема|L1\.)/i.test(String(object.body?.html||"")))}
function depthOf(object:StudioObject,byId:Map<string,StudioObject>){let depth=0,parent=object.parent_id,guard=0;while(parent&&guard++<12){depth+=1;parent=byId.get(parent)?.parent_id||null}return depth}
function buildTree(objects:StudioObject[]):Node[]{
  const byId=new Map(objects.map(object=>[object.id,object]));
  const nodes=new Map<string,Node>();
  for(const object of objects.filter(item=>!item.hidden&&(item.kind==="frame"||isTheme(item)))){
    const depth=depthOf(object,byId);
    nodes.set(object.id,{id:object.id,title:object.id==="lesson-miro-scene"?"Занятие 1":object.id==="frame-learning"?"Обучение":isTheme(object)?themeLabel(object):object.title,path:object.semantic_path,kind:object.kind,depth,object,children:[]});
  }
  const roots:Node[]=[];
  for(const node of nodes.values()){
    const parent=node.object?.parent_id?nodes.get(node.object.parent_id):null;
    if(parent)parent.children.push(node);else roots.push(node);
  }
  const sort=(a:Node,b:Node)=>a.path.localeCompare(b.path,"ru");
  const walk=(list:Node[])=>{list.sort(sort);for(const node of list)walk(node.children)};
  walk(roots);
  return roots;
}
function findNode(nodes:Node[],id:string):Node|null{
  for(const node of nodes){
    if(node.id===id)return node;
    const child=findNode(node.children,id);
    if(child)return child;
  }
  return null;
}
function kindLabel(node:Node){
  if(node.kind==="document")return "Документ";
  if(node.kind==="frame"){
    const role=roomRole(node.depth);
    if(role==="project")return "Проект";
    if(role==="course")return "Курс";
    if(role==="lesson")return "Занятие";
    return "Комната";
  }
  if(node.kind==="voice")return "Голос";
  if(node.kind==="image")return "Изображение";
  if(node.kind==="task")return "Задача";
  if(node.kind==="chart")return "График";
  if(isTheme(node.object!))return "Тема";
  return "Объект";
}
function recentLine(summary:string){
  const text=String(summary||"").replace(/\s+/g," ").trim();
  if(!text||/\.(png|jpe?g|webp|gif)|блок lesson|lesson-chart|lesson-table/i.test(text))return "";
  if(/:\s*\S{0,2}$/.test(text))return "";
  return text.length>78?text.slice(0,78)+"…":text;
}
function plural(count:number,one:string,few:string,many:string){
  const mod10=count%10,mod100=count%100;
  if(mod100>=11&&mod100<=14)return many;
  if(mod10===1)return one;
  if(mod10>=2&&mod10<=4)return few;
  return many;
}
function countLabel(node:Node){
  const rooms=node.children.filter(child=>child.kind==="frame");
  if(!rooms.length)return node.kind==="frame"?kindLabel(node):node.path;
  const next=roomRole(node.depth+1);
  const word=next==="course"?plural(rooms.length,"курс","курса","курсов"):next==="lesson"?plural(rooms.length,"занятие","занятия","занятий"):plural(rooms.length,"комната","комнаты","комнат");
  return `${rooms.length} ${word}`;
}
function RoomThumb({frame,objects}:{frame:StudioObject;objects:StudioObject[]}){
  const byId=new Map(objects.map(object=>[object.id,object]));
  let depth=0,parent=frame.parent_id,guard=0;
  while(parent&&guard++<12){depth+=1;parent=byId.get(parent)?.parent_id||null}
  const portal=roomPortal(frame,depth,objects);
  return <RoomPreview marks={portal.marks} title={portal.name}/>;
}

export function NavigatorV6({objects,documents,activity,selectedId,surface,onWorld,onDocuments,onFocus,onOpenDocument,onSettings,onCreate,onTool}:Props){
  const [open,setOpen]=useState(false),[mode,setMode]=useState<NavMode>("map"),[query,setQuery]=useState(""),[stack,setStack]=useState<string[]>([]),[listMode,setListMode]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{const target=event.target as HTMLElement|null;if(target?.isContentEditable||["INPUT","TEXTAREA"].includes(target?.tagName||""))return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setMode("search");setOpen(true);requestAnimationFrame(()=>input.current?.focus())}};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[]);
  const tree=useMemo(()=>buildTree(objects),[objects]);
  const flat=useMemo(()=>{const out:Node[]=[];const walk=(nodes:Node[])=>{for(const node of nodes){out.push(node);walk(node.children)}};walk(tree);return out},[tree]);
  const searchable=useMemo(()=>{
    const seen=new Set(flat.map(node=>node.object?.id).filter(Boolean));
    const extra=objects.filter(object=>!object.hidden&&!seen.has(object.id)&&object.kind!=="annotation").map(object=>({id:object.id,title:object.title,path:object.semantic_path,kind:object.kind,depth:0,object,children:[]} as Node));
    const docs=documents.map(document=>({id:"doc:"+document.id,title:document.title,path:document.semantic_path,kind:"document",depth:0,document,children:[]} as Node));
    return [...flat,...extra,...docs];
  },[flat,objects,documents]);
  const matches=query.trim()?searchable.filter(node=>(node.title+" "+node.path+" "+kindLabel(node)).toLowerCase().includes(query.trim().toLowerCase())).slice(0,24):[];
  const current=stack.length?findNode(tree,stack[stack.length-1]):null;
  const level=current?current.children:tree;
  const docFor=(node:Node)=>node.document||documents.find(document=>document.frame_id===node.object?.id)||null;
  const closeNav=()=>{setOpen(false);setQuery("")};
  const openMode=(next:NavMode)=>{if(open&&mode===next){closeNav();return}setMode(next);setOpen(true);if(next==="search")requestAnimationFrame(()=>input.current?.focus())};
  const focusNode=(node:Node)=>{if(!node.object)return;closeNav();onFocus(node.object.id)};
  const openDoc=(node:Node)=>{const document=docFor(node);if(!document)return;closeNav();onOpenDocument(document.id)};
  const activate=(node:Node)=>{if(node.document){closeNav();onOpenDocument(node.document.id);return}focusNode(node)};
  const drill=(node:Node)=>{if(node.children.length)setStack(value=>[...value,node.id]);else focusNode(node)};
  return <aside className={["v6-navigator",open?"is-open":"is-closed"].join(" ")} data-testid="v6-navigator" data-studio-ui>
    <div className="v6-nav-rail" aria-label="Навигация студии">
      <button className={surface==="world"&&!open?"active":""} aria-label="Доска" title="Доска" data-label="Доска" onClick={()=>{onWorld();closeNav()}}><LayoutDashboard size={16}/></button>
      <button className={surface==="documents"?"active":""} aria-label="Документы" title="Документы" data-label="Документы" onClick={()=>{closeNav();onDocuments()}}><FileText size={16}/></button>
      <span className="v6-nav-divider"/>
      <button className={open&&mode==="search"?"active":""} aria-label="Поиск" title="Поиск" data-label="Поиск" onClick={()=>openMode("search")}><Search size={16}/></button>
      <button className={open&&mode==="map"?"active":""} aria-label="Навигатор" title="Навигатор" data-label="Навигатор" onClick={()=>openMode("map")}><FolderTree size={16}/></button>
      <span className="v6-nav-divider"/>
      <button className={open&&mode==="create"?"active":""} aria-label="Добавить" title="Добавить" data-label="Добавить" onClick={()=>openMode("create")}><Plus size={16}/></button>
      <button aria-label="Рисование" title="Рисование" data-label="Рисование" onClick={()=>{closeNav();onWorld();onTool("pen")}}><PenLine size={16}/></button>
      <button className={open&&mode==="integrations"?"active":""} aria-label="Интеграции" title="Интеграции" data-label="Интеграции" onClick={()=>openMode("integrations")}><Plug size={16}/></button>
      <span className="v6-nav-spacer"/>
      <button aria-label="Настройки" title="Настройки" data-label="Настройки" onClick={()=>{closeNav();onSettings()}}><Settings size={16}/></button>
    </div>
    {open&&<div className="v6-nav-overlay" data-testid={mode==="search"?"command-palette":"nav-overlay"}>
      <header><div><strong>{mode==="map"?"Навигатор":mode==="search"?"Поиск":mode==="create"?"Добавить":"Интеграции"}</strong><small>{mode==="map"?(current?.path||"Проекты"):mode==="search"?"Проект, занятие, документ, объект":mode==="create"?"На доску":"Данные и вставки"}</small></div></header>
      {mode==="search"&&<label className="v6-nav-search"><Search size={13}/><input ref={input} value={query} aria-label="Найти" onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&matches[0]){event.preventDefault();activate(matches[0])}}} placeholder="Найти…"/><kbd>⌘K</kbd></label>}
      <div className="v6-nav-scroll">
        {mode==="map"&&<section className="v6-nav-map">
          <div className="v6-nav-browse-bar">
            {stack.length>0&&<button type="button" onClick={()=>setStack(value=>value.slice(0,-1))}>Назад</button>}
            <button type="button" onClick={()=>setListMode(value=>!value)}>{listMode?"Карточки":"Списком"}</button>
          </div>
          {!stack.length&&<div className="v6-nav-recent"><p>Недавние</p>{activity.filter(item=>recentLine(item.summary)).slice(0,4).map(item=><button key={item.id} type="button" onClick={()=>{if(item.entity_id){closeNav();onFocus(item.entity_id)}}}><span>{recentLine(item.summary)}</span><small>{item.semantic_path.split("/").filter(Boolean).slice(-2).join(" / ")}</small></button>)}{!activity.filter(item=>recentLine(item.summary)).length&&<small>Здесь появятся последние действия.</small>}</div>}
          {level.map(node=>{
            const document=docFor(node);
            return <article className={selectedId===node.object?.id?"v6-nav-card is-active":"v6-nav-card"} key={node.id}>
              <button type="button" className="v6-nav-card-main" onClick={()=>drill(node)}>
                {node.object?.kind==="frame"&&!listMode?<span className="v6-nav-thumb"><RoomThumb frame={node.object} objects={objects}/></span>:<span className="v6-nav-glyph">{kindLabel(node).slice(0,1)}</span>}
                <span><strong>{node.title}</strong><small>{kindLabel(node)} · {countLabel(node)}</small></span>
              </button>
              <div className="v6-nav-card-actions">
                {node.object&&<button type="button" onClick={()=>focusNode(node)}>На доске</button>}
                {document&&<button type="button" onClick={()=>openDoc(node)}>Документ</button>}
              </div>
            </article>;
          })}
        </section>}
        {mode==="search"&&<section>
          {query?matches.length?matches.map(node=><button className="v6-nav-result" key={node.id} onClick={()=>activate(node)}><span>{node.title}</span><small>{kindLabel(node)} · {node.path}</small></button>):<p className="v6-nav-empty">Ничего не найдено</p>:<p className="v6-nav-empty">Введите название проекта, курса, занятия, документа или объекта.</p>}
        </section>}
        {mode==="create"&&<section className="v6-nav-create">
          {[["text","Текст"],["note","Заметка"],["task","Задача"],["voice","Голос"],["image","Изображение"],["frame","Комната"]].map(([kind,label])=><button key={kind} type="button" onClick={()=>{closeNav();onWorld();onCreate(kind)}}>{label}</button>)}
        </section>}
        {mode==="integrations"&&<section className="v6-nav-create">
          <button type="button" onClick={()=>{closeNav();onWorld();onCreate("chart")}}>График</button>
          <button type="button" onClick={()=>{closeNav();onWorld();onCreate("chart")}}>Живые данные</button>
          <button type="button" onClick={()=>{closeNav();onWorld();onCreate("link")}}>Ссылка / вставка</button>
          <button type="button" onClick={()=>{closeNav();onWorld();onCreate("video")}}>Видео</button>
          <button type="button" onClick={()=>{closeNav();onWorld();onCreate("file")}}>Файл</button>
        </section>}
      </div>
    </div>}
  </aside>;
}

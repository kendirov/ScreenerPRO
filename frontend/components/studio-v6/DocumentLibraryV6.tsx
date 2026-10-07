"use client";
import {useEffect,useMemo,useState} from "react";
import {Clock3,Search,Star,Layers} from "lucide-react";
import type {StudioDocument} from "@/lib/studio-v5/types";
import {filterDocuments,libraryTree,uniqueDocuments,type LibraryNode} from "@/lib/studio-v6/document-model";

type View="all"|"recent"|"favorites"|"hierarchy";
type Status="DRAFT"|"PUBLISHED"|"STALE";
const FAV_KEY="tqs-studio-v6-doc-favorites";
const RECENT_KEY="tqs-studio-v6-doc-recent";

function readIds(key:string){try{const value=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(value)?value.map(String):[]}catch{return []}}

export function rememberDocument(id:string){
 try{
  const ids=[id,...readIds(RECENT_KEY).filter(item=>item!==id)].slice(0,24);
  localStorage.setItem(RECENT_KEY,JSON.stringify(ids));
 }catch{}
}

export function DocumentLibraryV6({documents,activeId,statusFor,open,onOpenChange,onOpen}:{documents:StudioDocument[];activeId:string|null;statusFor:(id:string)=>Status;open:boolean;onOpenChange:(open:boolean)=>void;onOpen:(id:string)=>void}){
 const [view,setView]=useState<View>("all"),[query,setQuery]=useState(""),[favorites,setFavorites]=useState<string[]>([]),[recent,setRecent]=useState<string[]>([]);
 useEffect(()=>{setFavorites(readIds(FAV_KEY));setRecent(readIds(RECENT_KEY))},[open,activeId]);
 useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"&&document.querySelector("[data-surface=documents]")){event.preventDefault();setView("all");onOpenChange(true);setQuery("")}};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[onOpenChange]);
 const canonical=useMemo(()=>uniqueDocuments(documents),[documents]);
 const recentDocs=useMemo(()=>uniqueDocuments(canonical,recent),[canonical,recent]);
 const favoriteDocs=useMemo(()=>canonical.filter(doc=>favorites.includes(doc.id)),[canonical,favorites]);
 const base=view==="recent"?recentDocs:view==="favorites"?favoriteDocs:canonical;
 const shown=filterDocuments(base,query);
 const tree=useMemo(()=>libraryTree(shown),[shown]);
 const toggle=(next:View)=>{if(open&&view===next){onOpenChange(false);return}setView(next);onOpenChange(true)};
 const star=(id:string)=>{
  const next=favorites.includes(id)?favorites.filter(item=>item!==id):[id,...favorites];
  setFavorites(next);
  try{localStorage.setItem(FAV_KEY,JSON.stringify(next))}catch{}
 };
 const choose=(id:string)=>{onOpen(id);onOpenChange(false);setQuery("")};
 return <aside className={open?"v6-doc-library is-open":"v6-doc-library"} data-testid="document-library" data-studio-ui>
  <div className="v6-doc-library-rail" aria-label="Библиотека документов">
   <button aria-label="Все документы" aria-pressed={open&&view==="all"} onClick={()=>toggle("all")}><Layers size={16}/></button>
   <button aria-label="Поиск документов" aria-pressed={open&&query.length>0} onClick={()=>toggle("all")}><Search size={16}/></button>
   <button aria-label="Недавние документы" aria-pressed={open&&view==="recent"} onClick={()=>toggle("recent")}><Clock3 size={16}/></button>
   <button aria-label="Избранные документы" aria-pressed={open&&view==="favorites"} onClick={()=>toggle("favorites")}><Star size={16}/></button>
  </div>
  {open&&<div className="v6-doc-library-drawer" role="dialog" aria-label="Документы">
   <header><strong>{view==="recent"?"Недавние":view==="favorites"?"Избранные":view==="hierarchy"?"Структура":"Документы"}</strong><button onClick={()=>setView(view==="hierarchy"?"all":"hierarchy")}>{view==="hierarchy"?"Списком":"Структура"}</button></header>
   <label className="v6-doc-library-search"><Search size={14}/><input autoFocus={view!=="hierarchy"} value={query} placeholder="Найти документ" aria-label="Найти документ" onChange={event=>setQuery(event.target.value)}/></label>
   <div className="v6-doc-library-list">
    {view==="hierarchy"&&!query?tree.map(node=><TreeNode key={node.id} node={node} documents={canonical} activeId={activeId} statusFor={statusFor} favorites={favorites} onStar={star} onOpen={choose}/>):shown.length?shown.map(doc=><DocRow key={doc.id} doc={doc} active={doc.id===activeId} status={statusFor(doc.id)} favorite={favorites.includes(doc.id)} onStar={()=>star(doc.id)} onOpen={()=>choose(doc.id)}/>):<p>Ничего не найдено</p>}
   </div>
  </div>}
 </aside>
}

function TreeNode({node,documents,activeId,statusFor,favorites,onStar,onOpen,depth=0}:{node:LibraryNode;documents:StudioDocument[];activeId:string|null;statusFor:(id:string)=>Status;favorites:string[];onStar:(id:string)=>void;onOpen:(id:string)=>void;depth?:number}){
 const doc=node.documentId?documents.find(item=>item.id===node.documentId):undefined;
 if(doc)return <DocRow doc={doc} active={doc.id===activeId} status={statusFor(doc.id)} favorite={favorites.includes(doc.id)} onStar={()=>onStar(doc.id)} onOpen={()=>onOpen(doc.id)} depth={depth}/>;
 return <div className="v6-doc-library-group">
  <p style={{paddingLeft:12+depth*12}}>{node.label}</p>
  {node.children.map(child=><TreeNode key={child.id} node={child} documents={documents} activeId={activeId} statusFor={statusFor} favorites={favorites} onStar={onStar} onOpen={onOpen} depth={depth+1}/>)}
 </div>
}

function DocRow({doc,active,status,favorite,onStar,onOpen,depth=0}:{doc:StudioDocument;active:boolean;status:Status;favorite:boolean;onStar:()=>void;onOpen:()=>void;depth?:number}){
 return <div className={active?"v6-doc-row is-active":"v6-doc-row"} style={{paddingLeft:8+depth*12}}>
  <button onClick={onOpen}><strong>{doc.title}</strong><span>{status==="PUBLISHED"?"Опубликован":status==="STALE"?"Есть правки":"Черновик"}</span></button>
  <button aria-label={favorite?"Убрать из избранного":"В избранное"} className={favorite?"is-on":""} onClick={onStar}><Star size={13}/></button>
 </div>
}

"use client";
import {useState} from "react";
import {GripVertical,Plus} from "lucide-react";
import type {DocumentBundle,StudioDocumentBlock} from "@/lib/studio-v5/types";
import {studioAction} from "@/lib/studio-v5/api";
import {DocumentBlocksView} from "./DocumentView";

const TYPES=[
 ["heading","Heading"],["rich_text","Rich Text"],["callout","Callout"],["interactive_chart","Interactive Chart"],["live_data","Live Data"],["image","Image"],["video","Video"],["market_replay","Market Replay"],["table","Table"],["pdf_excerpt","PDF / Document excerpt"],["sources","Sources"],["divider","Divider"]
] as const;
const defaultContent=(type:string)=>type==="heading"?{text:"Новый заголовок"}:type==="rich_text"?{html:"<p>Новый текст</p>"}:type==="callout"?{text:"Новый callout"}:type==="table"?{columns:["Колонка 1","Колонка 2"],rows:[["",""]]}:type==="sources"?{items:[]}:type==="divider"?{}:{title:TYPES.find(x=>x[0]===type)?.[1]||type};
const defaultData=(type:string)=>["interactive_chart","live_data","market_replay"].includes(type)?{provider:"MOEX_ISS",instrument:{family:"SI",resolver:"front_active_contract"},metric:type==="market_replay"?"ohlcv":"ohlcv_session",relativeRange:{tradingSessions:type==="market_replay"?1:2},fixedRange:null,transforms:type==="market_replay"?["chronological"]:["group_by_session","cumulative_volume"],display:{renderer:type==="market_replay"?"studio_market_replay":"studio_market_chart",crosshair:true},updatePolicy:"LIVE",asOf:null}:null;

export function DocumentEditorV5({bundle,onBundle}:{bundle:DocumentBundle;onBundle:(x:DocumentBundle)=>void}){
 const [insertAfter,setInsertAfter]=useState<string|null|undefined>(undefined),[dragId,setDragId]=useState<string|null>(null),[menuAt,setMenuAt]=useState<{blockId:string|null;x:number;y:number}|null>(null);
 const sorted=[...bundle.blocks].sort((a,b)=>a.ordinal-b.ordinal);
 const refresh=async()=>onBundle(await studioAction<DocumentBundle>("getDocument",{documentId:bundle.document.id}));
 const insert=async(type:string,afterBlockId:string|null)=>{const id="block-"+crypto.randomUUID();await studioAction("upsertDocumentBlock",{documentId:bundle.document.id,blockId:id,blockType:type,content:defaultContent(type),dataSpec:defaultData(type),afterBlockId,semanticPath:bundle.document.semantic_path});setInsertAfter(undefined);setMenuAt(null);await refresh()};
 const save=async(b:StudioDocumentBlock,content:any)=>{await studioAction("upsertDocumentBlock",{documentId:bundle.document.id,blockId:b.block_id,blockType:b.block_type,content,dataSpec:b.data_spec,semanticPath:bundle.document.semantic_path});await refresh()};
 const drop=async(targetOrdinal:number)=>{if(!dragId)return;await studioAction("reorderDocumentBlock",{documentId:bundle.document.id,blockId:dragId,targetOrdinal});setDragId(null);await refresh()};
 return <div className="studio-block-editor" data-testid="ordered-block-editor">
   <InsertLine open={insertAfter==="__FIRST__"} setOpen={()=>setInsertAfter(insertAfter==="__FIRST__"?undefined:"__FIRST__")} onInsert={t=>insert(t,"__FIRST__")}/>
   {sorted.map((b,i)=><div key={b.block_id} className="studio-edit-block" draggable onDragStart={()=>setDragId(b.block_id)} onDragOver={e=>e.preventDefault()} onDrop={()=>drop(b.ordinal)}
      onContextMenu={e=>{e.preventDefault();setMenuAt({blockId:b.block_id,x:e.clientX,y:e.clientY})}}>
     <div className="studio-block-rail"><GripVertical size={15}/><span>{b.ordinal}</span></div>
     <EditableBlock block={b} onSave={c=>save(b,c)} onSlash={()=>setMenuAt({blockId:b.block_id,x:180,y:Math.min(window.innerHeight-360,120+i*50)})}/>
     <InsertLine open={insertAfter===b.block_id} setOpen={()=>setInsertAfter(insertAfter===b.block_id?undefined:b.block_id)} onInsert={t=>insert(t,b.block_id)}/>
   </div>)}
   {menuAt&&<div className="studio-slash-menu" style={{left:menuAt.x,top:menuAt.y}}><strong>Добавить блок</strong>{TYPES.map(([t,l])=><button key={t} onClick={()=>insert(t,menuAt.blockId)}>{l}</button>)}<button onClick={()=>setMenuAt(null)}>Закрыть</button></div>}
 </div>
}
function InsertLine({open,setOpen,onInsert}:{open:boolean;setOpen:()=>void;onInsert:(t:string)=>void}){
 return <div className="studio-insert-line"><button aria-label="Вставить блок" onClick={setOpen}><Plus size={13}/></button>{open&&<div className="studio-insert-types">{TYPES.map(([t,l])=><button key={t} onClick={()=>onInsert(t)}>{l}</button>)}</div>}</div>
}
function EditableBlock({block,onSave,onSlash}:{block:StudioDocumentBlock;onSave:(c:any)=>void;onSlash:()=>void}){
 const c=block.content||{};
 if(["live_data","interactive_chart","market_replay","image","video","table","pdf_excerpt","sources","divider"].includes(block.block_type))return <div className="studio-block-static"><DocumentBlocksView blocks={[block]}/></div>;
 const isHtml=block.block_type==="rich_text"; const value=isHtml?(c.html||""):(c.text||"");
 return <div className={"studio-inline-edit block-"+block.block_type} contentEditable suppressContentEditableWarning
   dangerouslySetInnerHTML={isHtml?{__html:value}:undefined}
   onKeyDown={e=>{if(e.key==="/" && !e.ctrlKey&&!e.metaKey){e.preventDefault();onSlash()}}}
   onBlur={e=>onSave(isHtml?{...c,html:e.currentTarget.innerHTML}:{...c,text:e.currentTarget.innerText})}>{isHtml?undefined:value}</div>
}
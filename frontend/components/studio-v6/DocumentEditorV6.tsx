"use client";
import {useEffect,useRef,useState} from "react";
import {Copy,Eye,GripVertical,MoreHorizontal,Plus,Trash2} from "lucide-react";
import type {DocumentBundle,StudioDocumentBlock} from "@/lib/studio-v5/types";
import {DocumentBlocksView} from "@/components/studio-v5/DocumentView";
import {studioAction} from "@/lib/studio-v6/api";
import {RichEditor} from "./RichEditor";

export type DocumentMode="edit"|"read"|"preview";
const TYPES:[string,string][]=[["heading","Заголовок"],["rich_text","Текст"],["callout","Выноска"],["interactive_chart","Интерактивный график"],["live_data","Живые данные"],["image","Изображение"],["video","Видео"],["market_replay","Market Replay"],["table","Таблица"],["pdf_excerpt","Фрагмент PDF / документа"],["sources","Источники"],["divider","Разделитель"]];
const defaultContent=(type:string)=>type==="heading"?{text:"Новый заголовок"}:type==="rich_text"?{html:"<p>Новый текст</p>"}:type==="callout"?{text:"Новая выноска"}:type==="table"?{columns:["Колонка 1","Колонка 2"],rows:[["",""]]}:type==="sources"?{items:[]}:type==="divider"?{}:{title:TYPES.find(x=>x[0]===type)?.[1]||type};
const defaultData=(type:string)=>["interactive_chart","live_data","market_replay"].includes(type)?{provider:"MOEX_ISS",instrument:{family:"SI",resolver:"front_active_contract"},metric:type==="market_replay"?"ohlcv":"ohlcv_session",relativeRange:{tradingSessions:type==="market_replay"?1:2},fixedRange:null,transforms:type==="market_replay"?["chronological"]:["group_by_session","cumulative_volume"],display:{renderer:type==="market_replay"?"studio_market_replay":"studio_market_chart",crosshair:true},updatePolicy:"LIVE",asOf:null}:null;

export function DocumentEditorV6({bundle,onBundle,mode}:{bundle:DocumentBundle;onBundle:(x:DocumentBundle)=>void;mode:DocumentMode}){
 const [insertAfter,setInsertAfter]=useState<string|null|undefined>(undefined),[menu,setMenu]=useState<{id:string;x:number;y:number}|null>(null),[drag,setDrag]=useState<{id:string;target:number;startY:number}|null>(null);const root=useRef<HTMLDivElement>(null);
 const sorted=[...bundle.blocks].sort((a,b)=>a.ordinal-b.ordinal);const visible=sorted.filter(b=>!b.content?.hidden);
 const refresh=async()=>onBundle(await studioAction<DocumentBundle>("getDocument",{documentId:bundle.document.id}));
 const insert=async(type:string,after:string|null)=>{await studioAction("upsertDocumentBlock",{documentId:bundle.document.id,blockId:"block-"+crypto.randomUUID(),blockType:type,content:defaultContent(type),dataSpec:defaultData(type),afterBlockId:after==="__FIRST__"?null:after,semanticPath:bundle.document.semantic_path});setInsertAfter(undefined);await refresh()};
 const save=async(b:StudioDocumentBlock,content:any,blockType=b.block_type)=>{await studioAction("upsertDocumentBlock",{documentId:bundle.document.id,blockId:b.block_id,blockType,content,dataSpec:b.data_spec,semanticPath:bundle.document.semantic_path});await refresh()};
 const duplicate=async(b:StudioDocumentBlock)=>{await studioAction("upsertDocumentBlock",{documentId:bundle.document.id,blockId:"block-"+crypto.randomUUID(),blockType:b.block_type,content:{...b.content,hidden:false},dataSpec:b.data_spec,afterBlockId:b.block_id,semanticPath:bundle.document.semantic_path});setMenu(null);await refresh()};
 const hide=async(b:StudioDocumentBlock)=>{await save(b,{...b.content,hidden:!b.content?.hidden});setMenu(null)};
 const convert=async(b:StudioDocumentBlock,type:string)=>{let content=b.content;if(type==="rich_text"&&!content.html)content={html:`<p>${content.text||content.title||""}</p>`};if(type==="callout"&&!content.text)content={text:String(content.title||"")};await save(b,content,type);setMenu(null)};
 const startDrag=(e:React.PointerEvent,b:StudioDocumentBlock)=>{if(e.button!==0)return;e.preventDefault();(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);setDrag({id:b.block_id,target:b.ordinal,startY:e.clientY})};
 useEffect(()=>{if(!drag)return;const move=(e:PointerEvent)=>{const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest?.("[data-doc-block]") as HTMLElement|null;if(!hit)return;const o=Number(hit.dataset.ordinal);if(Number.isFinite(o))setDrag(v=>v?{...v,target:o}:v)};const up=()=>{const d=drag;setDrag(null);if(d&&sorted.find(b=>b.block_id===d.id)?.ordinal!==d.target)void studioAction("reorderDocumentBlock",{documentId:bundle.document.id,blockId:d.id,targetOrdinal:d.target}).then(refresh)};window.addEventListener("pointermove",move);window.addEventListener("pointerup",up,{once:true});return()=>window.removeEventListener("pointermove",move)},[drag,bundle.document.id,sorted]);
 if(mode!=="edit")return <div className={mode==="preview"?"v6-doc-preview":"v6-doc-read"} data-testid={`document-${mode}`}><DocumentBlocksView blocks={visible} clean={mode==="preview"}/></div>;
 return <div ref={root} className="v6-doc-editor" data-testid="ordered-block-editor-v6">
  <InsertLine open={insertAfter==="__FIRST__"} onToggle={()=>setInsertAfter(insertAfter==="__FIRST__"?undefined:"__FIRST__")} onInsert={t=>insert(t,"__FIRST__")}/>
  {visible.map((b,i)=><div key={b.block_id} data-doc-block data-block-id={b.block_id} data-ordinal={b.ordinal} className={["v6-doc-block",drag?.id===b.block_id?"is-dragging":"",drag&&drag.target===b.ordinal?"is-drop-target":""].join(" ")}
    onContextMenu={e=>{e.preventDefault();setMenu({id:b.block_id,x:e.clientX,y:e.clientY})}}>
    <div className="v6-doc-block-handle" data-studio-ui onPointerDown={e=>startDrag(e,b)} title="Перетащить блок"><GripVertical size={15}/></div>
    <button className="v6-doc-block-more" data-studio-ui aria-label="Меню блока" onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setMenu({id:b.block_id,x:r.right,y:r.bottom})}}><MoreHorizontal size={15}/></button>
    <EditableBlock block={b} onSave={(c,t)=>save(b,c,t)}/>
    <InsertLine open={insertAfter===b.block_id} onToggle={()=>setInsertAfter(insertAfter===b.block_id?undefined:b.block_id)} onInsert={t=>insert(t,b.block_id)}/>
   </div>)}
  {menu&&(()=>{const b=sorted.find(x=>x.block_id===menu.id);if(!b)return null;return <div className="v6-doc-menu" style={{left:menu.x,top:menu.y}} data-studio-ui>
    <button onClick={()=>duplicate(b)}><Copy size={13}/>Дублировать</button>
    <button onClick={()=>hide(b)}><Eye size={13}/>Скрыть из документа</button>
    <div className="v6-doc-menu-label">Преобразовать</div><button onClick={()=>convert(b,"rich_text")}>В текст</button><button onClick={()=>convert(b,"callout")}>В выноску</button><button onClick={()=>convert(b,"heading")}>В заголовок</button>
    <button className="danger" onClick={()=>hide(b)}><Trash2 size={13}/>Удалить из документа</button><button onClick={()=>setMenu(null)}>Закрыть</button>
   </div>})()}
 </div>
}
function InsertLine({open,onToggle,onInsert}:{open:boolean;onToggle:()=>void;onInsert:(t:string)=>void}){return <div className="v6-insert-line" data-studio-ui><button aria-label="Вставить блок" onClick={onToggle}><Plus size={13}/></button>{open&&<div className="v6-insert-types">{TYPES.map(([t,l])=><button key={t} onClick={()=>onInsert(t)}>{l}</button>)}</div>}</div>}
function EditableBlock({block,onSave}:{block:StudioDocumentBlock;onSave:(c:any,t?:string)=>void}){
 const c=block.content||{};
 if(block.block_type==="rich_text")return <RichEditor html={c.html||"<p></p>"} onBlur={html=>{if(html!==c.html)void onSave({...c,html})}}/>;
 if(block.block_type==="heading")return <RichEditor html={`<h2>${escapeHtml(c.text||"")}</h2>`} onBlur={html=>void onSave({...c,text:stripHtml(html)})}/>;
 if(block.block_type==="callout")return <div className="v6-callout-edit"><RichEditor html={`<p>${escapeHtml(c.text||"")}</p>`} onBlur={html=>void onSave({...c,text:stripHtml(html)})}/></div>;
 return <div className="v6-doc-static"><DocumentBlocksView blocks={[block]}/></div>
}
function stripHtml(s:string){return s.replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()}
function escapeHtml(s:string){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]||m))}

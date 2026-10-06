"use client";
import {useEffect,useRef,useState} from "react";
import {Copy,Eye,GripVertical,MoreHorizontal,Plus,Trash2} from "lucide-react";
import type {DataSpec,DocumentBundle,StudioDocumentBlock} from "@/lib/studio-v5/types";
import {DocumentBlocksView} from "@/components/studio-v5/DocumentView";
import {studioAction} from "@/lib/studio-v6/api";
import {chartSpec,defaultBlockContent,defaultBlockData,INSERT_TYPES,INTERACTIVE_VIEWS,NOTE_ACCENTS,type InteractiveView} from "@/lib/studio-v6/document-model";
import {RichEditor} from "./RichEditor";

export type DocumentMode="edit"|"preview";
export type AuthoringFocus={blockId:string;ordinal:number;blockType:string};

export function DocumentEditorV6({bundle,onBundle,mode,onFocus}:{bundle:DocumentBundle;onBundle:(value:DocumentBundle)=>void;mode:DocumentMode;onFocus?:(focus:AuthoringFocus|null)=>void}){
 const [insertAfter,setInsertAfter]=useState<string|null|undefined>(undefined),[menu,setMenu]=useState<{id:string;x:number;y:number}|null>(null),[draggingId,setDraggingId]=useState<string|null>(null),[focus,setFocus]=useState<AuthoringFocus|null>(null);const root=useRef<HTMLDivElement>(null);
 const sorted=[...bundle.blocks].sort((a,b)=>a.ordinal-b.ordinal);const visible=sorted.filter(block=>!block.content?.hidden);
 const refresh=async()=>onBundle(await studioAction<DocumentBundle>("getDocument",{documentId:bundle.document.id}));
 const sortedRef=useRef(sorted),bundleRef=useRef(bundle),onBundleRef=useRef(onBundle),dragRef=useRef<{id:string;target:number;y:number}|null>(null);
 sortedRef.current=sorted;bundleRef.current=bundle;onBundleRef.current=onBundle;
 const insert=async(type:string,after:string|null)=>{
  const content=defaultBlockContent(type);
  await studioAction("upsertDocumentBlock",{documentId:bundle.document.id,blockId:"block-"+crypto.randomUUID(),blockType:type,content,dataSpec:defaultBlockData(type,content),afterBlockId:after,semanticPath:bundle.document.semantic_path});
  setInsertAfter(undefined);await refresh();
 };
 const save=async(block:StudioDocumentBlock,content:any,blockType=block.block_type,dataSpec=block.data_spec)=>{await studioAction("upsertDocumentBlock",{documentId:bundle.document.id,blockId:block.block_id,blockType,content,dataSpec,semanticPath:bundle.document.semantic_path});await refresh()};
 const duplicate=async(block:StudioDocumentBlock)=>{await studioAction("upsertDocumentBlock",{documentId:bundle.document.id,blockId:"block-"+crypto.randomUUID(),blockType:block.block_type,content:{...block.content,hidden:false},dataSpec:block.data_spec,afterBlockId:block.block_id,semanticPath:bundle.document.semantic_path});setMenu(null);await refresh()};
 const hide=async(block:StudioDocumentBlock)=>{await save(block,{...block.content,hidden:!block.content?.hidden});setMenu(null)};
 const convert=async(block:StudioDocumentBlock,type:string)=>{let content=block.content||{};if(type==="rich_text"&&!content.html)content={html:`<p>${content.text||content.title||""}</p>`};if(type==="callout")content={text:String(content.text||content.title||stripHtml(content.html||"")),accent:content.accent||"blue"};if(type==="heading")content={text:String(content.text||stripHtml(content.html||""))};await save(block,content,type);setMenu(null)};
 const focusBlock=(block:StudioDocumentBlock)=>{const next={blockId:block.block_id,ordinal:block.ordinal,blockType:block.block_type};setFocus(next);onFocus?.(next)};
 const startDrag=(event:React.PointerEvent,block:StudioDocumentBlock)=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);dragRef.current={id:block.block_id,target:block.ordinal,y:event.clientY};setDraggingId(block.block_id)};
 useEffect(()=>{
  const host=()=>root.current;
  const clearMarks=()=>{host()?.querySelectorAll("[data-doc-block].is-drop-target").forEach(el=>el.classList.remove("is-drop-target"))};
  const move=(event:PointerEvent)=>{
   const current=dragRef.current;if(!current)return;
   const node=host()?.querySelector(`[data-block-id="${CSS.escape(current.id)}"]`) as HTMLElement|null;
   if(node)node.style.transform=`translateY(${event.clientY-current.y}px)`;
   let target=current.target,hitId="";
   for(const hit of document.elementsFromPoint(event.clientX,event.clientY)){
    const block=hit.closest?.("[data-doc-block]") as HTMLElement|null;
    if(!block||block.dataset.blockId===current.id)continue;
    const ordinal=Number(block.dataset.ordinal);
    if(!Number.isFinite(ordinal))continue;
    target=ordinal;hitId=block.dataset.blockId||"";break;
   }
   if(target===current.target)return;
   current.target=target;clearMarks();
   if(hitId)host()?.querySelector(`[data-block-id="${CSS.escape(hitId)}"]`)?.classList.add("is-drop-target");
  };
  const up=()=>{
   const current=dragRef.current;if(!current)return;
   dragRef.current=null;
   const node=host()?.querySelector(`[data-block-id="${CSS.escape(current.id)}"]`) as HTMLElement|null;
   if(node)node.style.transform="";
   clearMarks();setDraggingId(null);
   const from=sortedRef.current.find(block=>block.block_id===current.id);
   if(!from||from.ordinal===current.target)return;
   const next=reorderCopy(bundleRef.current.blocks,current.id,current.target);
   onBundleRef.current({...bundleRef.current,blocks:next});
   void studioAction("reorderDocumentBlock",{documentId:bundleRef.current.document.id,blockId:current.id,targetOrdinal:current.target}).then(()=>studioAction<DocumentBundle>("getDocument",{documentId:bundleRef.current.document.id})).then(onBundleRef.current);
  };
  window.addEventListener("pointermove",move);
  window.addEventListener("pointerup",up);
  return()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up)};
 },[]);
 if(mode!=="edit")return <div className="studio-publication v6-doc-preview" data-testid="document-preview"><DocumentBlocksView blocks={visible} clean/></div>;
 return <div ref={root} className="v6-doc-editor" data-testid="ordered-block-editor-v6" data-authoring-document={bundle.document.id} data-authoring-block={focus?.blockId||""} data-authoring-ordinal={focus?.ordinal||""} data-authoring-type={focus?.blockType||""}>
  <InsertLine open={insertAfter==="__FIRST__"} onToggle={()=>setInsertAfter(insertAfter==="__FIRST__"?undefined:"__FIRST__")} onInsert={type=>insert(type,"__FIRST__")}/>
  {visible.map((block,index)=><div key={block.block_id} data-doc-block data-block-id={block.block_id} data-ordinal={block.ordinal} data-block-type={block.block_type} className={["v6-doc-block",draggingId===block.block_id?"is-dragging":"",focus?.blockId===block.block_id?"is-focused":""].join(" ")} onContextMenu={event=>{event.preventDefault();focusBlock(block);setMenu({id:block.block_id,x:event.clientX,y:event.clientY})}} onPointerDown={()=>focusBlock(block)}>
    <div className="v6-doc-block-handle" data-studio-ui onPointerDown={event=>startDrag(event,block)} title="Перетащить блок"><span className="v6-doc-ordinal">{index+1}</span><GripVertical size={15}/></div>
    <button className="v6-doc-block-more" data-studio-ui aria-label="Меню блока" onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();setMenu({id:block.block_id,x:rect.right,y:rect.bottom})}}><MoreHorizontal size={15}/></button>
    <EditableBlock block={block} onSave={(content,blockType,dataSpec)=>save(block,content,blockType,dataSpec)}/>
    <InsertLine open={insertAfter===block.block_id} onToggle={()=>setInsertAfter(insertAfter===block.block_id?undefined:block.block_id)} onInsert={type=>insert(type,block.block_id)}/>
   </div>)}
  {menu&&(()=>{const block=sorted.find(item=>item.block_id===menu.id);if(!block)return null;return <div className="v6-doc-menu" style={{left:menu.x,top:menu.y}} data-studio-ui>
    <button onClick={()=>duplicate(block)}><Copy size={13}/>Дублировать</button>
    <button onClick={()=>hide(block)}><Eye size={13}/>Скрыть из документа</button>
    <div className="v6-doc-menu-label">Преобразовать</div>
    <button onClick={()=>convert(block,"rich_text")}>В текст</button>
    <button onClick={()=>convert(block,"callout")}>В заметку</button>
    <button onClick={()=>convert(block,"heading")}>В заголовок</button>
    <button className="danger" onClick={()=>hide(block)}><Trash2 size={13}/>Удалить из документа</button>
    <button onClick={()=>setMenu(null)}>Закрыть</button>
   </div>})()}
 </div>
}

function reorderCopy(blocks:StudioDocumentBlock[],blockId:string,targetOrdinal:number){
 const arr=[...blocks].sort((a,b)=>a.ordinal-b.ordinal),index=arr.findIndex(block=>block.block_id===blockId);
 if(index<0)return blocks;
 const [moved]=arr.splice(index,1);
 arr.splice(Math.max(0,Math.min(arr.length,targetOrdinal-1)),0,moved);
 return arr.map((block,ordinal)=>({...block,ordinal:ordinal+1}));
}

function InsertLine({open,onToggle,onInsert}:{open:boolean;onToggle:()=>void;onInsert:(type:string)=>void}){
 return <div className="v6-insert-line" data-studio-ui><button aria-label="Вставить блок" onClick={onToggle}><Plus size={13}/></button>{open&&<div className="v6-insert-types">{INSERT_TYPES.map(([type,label])=><button key={type} onClick={()=>onInsert(type)}>{label}</button>)}</div>}</div>
}

function EditableBlock({block,onSave}:{block:StudioDocumentBlock;onSave:(content:any,blockType?:string,dataSpec?:DataSpec|null)=>void}){
 const content=block.content||{};
 if(block.block_type==="rich_text")return <RichEditor html={content.html||"<p></p>"} onBlur={html=>{if(html!==content.html)void onSave({...content,html})}}/>;
 if(block.block_type==="heading")return <RichEditor html={`<h2>${escapeHtml(content.text||"")}</h2>`} onBlur={html=>void onSave({...content,text:stripHtml(html)})}/>;
 if(block.block_type==="callout")return <div className="v6-note-edit" data-accent={content.accent||"blue"}><div className="v6-note-accents">{NOTE_ACCENTS.map(accent=><button key={accent} aria-label={"Акцент "+accent} className={content.accent===accent||(!content.accent&&accent==="blue")?"is-on accent-"+accent:"accent-"+accent} onClick={()=>void onSave({...content,accent})}/>)}</div><RichEditor html={`<p>${escapeHtml(content.text||"")}</p>`} onBlur={html=>void onSave({...content,text:stripHtml(html),accent:content.accent||"blue"})}/></div>;
 if(block.block_type==="image")return <MediaFields block={block} kind="image" onSave={onSave}/>;
 if(block.block_type==="video")return <MediaFields block={block} kind="video" onSave={onSave}/>;
 if(block.block_type==="interactive"||block.block_type==="interactive_chart"||block.block_type==="live_data"||block.block_type==="market_replay"||block.block_type==="table")return <InteractiveFields block={block} onSave={onSave}/>;
 return <div className="v6-doc-static"><DocumentBlocksView blocks={[block]}/></div>
}

function MediaFields({block,kind,onSave}:{block:StudioDocumentBlock;kind:"image"|"video";onSave:(content:any)=>void}){
 const content=block.content||{};
 const file=useRef<HTMLInputElement>(null);
 const applyUrl=(url:string)=>{if(url!==(content.url||""))void onSave({...content,url,title:content.title||(kind==="image"?"Изображение":"Видео")})};
 const upload=async(list:FileList|null)=>{
  const item=list?.[0];if(!item)return;
  const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(item)});
  const asset=await studioAction<any>("attachAsset",{dataUrl,filename:item.name});
  void onSave({...content,url:asset.signedUrl,title:content.title||item.name,assetId:asset.asset?.id});
 };
 return <div className="v6-media-edit"><div className="media-tools"><input aria-label={kind==="image"?"Ссылка на изображение":"Ссылка на видео"} defaultValue={content.url||""} placeholder={kind==="image"?"Адрес изображения":"YouTube, RuTube, Vimeo или VK"} onBlur={event=>applyUrl(event.target.value.trim())}/>{kind==="image"&&<button onClick={()=>file.current?.click()}>Файл</button>}{kind==="image"&&<input ref={file} hidden type="file" accept="image/*" onChange={event=>{void upload(event.target.files);event.target.value=""}}/>}</div><DocumentBlocksView blocks={[block]}/></div>
}

function InteractiveFields({block,onSave}:{block:StudioDocumentBlock;onSave:(content:any,blockType?:string,dataSpec?:DataSpec|null)=>void}){
 const content=block.content||{};
 const view:InteractiveView=block.block_type==="table"?"table":block.block_type==="market_replay"?"timeline":block.block_type==="interactive"?((content.view||"chart") as InteractiveView):"chart";
 const choose=(next:InteractiveView)=>{
  if(next==="chart")void onSave({...content,view:next,title:content.title||"График"},"interactive",block.data_spec||chartSpec(content.instrument||"SI"));
  else if(next==="table")void onSave({...content,view:next,columns:content.columns||["Колонка 1","Колонка 2"],rows:content.rows||[["",""]]},"interactive",block.data_spec);
  else if(next==="timeline")void onSave({...content,view:next,items:content.items||[{label:"Сейчас",text:""},{label:"Дальше",text:""}]},"interactive",block.data_spec);
  else if(next==="visual")void onSave({...content,view:next,title:content.title||"Визуал"},"interactive",block.data_spec);
  else void onSave({...content,view:next,title:content.title||"Вставка",url:content.url||""},"interactive",block.data_spec);
 };
 return <div className="v6-interactive-edit" data-interactive-view={view}>
  <div className="v6-view-switch" data-studio-ui>{INTERACTIVE_VIEWS.map(item=><button key={item.id} className={view===item.id?"is-on":""} onClick={()=>choose(item.id)}>{item.label}</button>)}</div>
  {view==="chart"&&<label className="media-tools">Инструмент<input aria-label="Инструмент графика" defaultValue={block.data_spec?.instrument?.family||"SI"} onBlur={event=>{const family=event.target.value.trim().toUpperCase()||"SI";void onSave({...content,view:"chart",instrument:family},"interactive",{...(block.data_spec||chartSpec(family)),instrument:{...(block.data_spec?.instrument||{}),family,resolver:block.data_spec?.instrument?.resolver||"front_active_contract"}})}}/></label>}
  {view==="table"&&<TableEditor content={content} onSave={onSave}/>}
  {view==="visual"&&<input aria-label="Адрес визуала" defaultValue={content.url||""} placeholder="Адрес изображения или визуала" onBlur={event=>void onSave({...content,view:"visual",url:event.target.value.trim()},"interactive",block.data_spec)}/>}
  {view==="embed"&&<input aria-label="Адрес вставки" defaultValue={content.url||""} placeholder="Разрешённый адрес вставки" onBlur={event=>void onSave({...content,view:"embed",url:event.target.value.trim()},"interactive",block.data_spec)}/>}
  {view!=="table"&&<DocumentBlocksView blocks={[{...block,block_type:"interactive",content:{...content,view}}]}/>}
 </div>
}

function TableEditor({content,onSave}:{content:any;onSave:(content:any,blockType?:string,dataSpec?:DataSpec|null)=>void}){
 const columns:string[]=content.columns||["Колонка 1","Колонка 2"];
 const rows:string[][]=content.rows||[["",""]];
 const write=(nextColumns:string[],nextRows:string[][])=>void onSave({...content,view:"table",columns:nextColumns,rows:nextRows},"interactive");
 return <div className="v6-table-edit">{columns.map((column,index)=><input key={index} aria-label={"Колонка "+(index+1)} defaultValue={column} onBlur={event=>{const next=[...columns];next[index]=event.target.value;write(next,rows)}}/>)}{rows.map((row,rowIndex)=><div key={rowIndex}>{row.map((cell,cellIndex)=><input key={cellIndex} aria-label={"Ячейка "+(rowIndex+1)+"."+(cellIndex+1)} defaultValue={cell} onBlur={event=>{const next=rows.map(item=>[...item]);next[rowIndex][cellIndex]=event.target.value;write(columns,next)}}/>)}</div>)}</div>
}

function stripHtml(value:string){return value.replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]||char))}

import type {DataSpec,StudioDocument,StudioDocumentBlock} from "@/lib/studio-v5/types";

export type InteractiveView="chart"|"table"|"timeline"|"visual"|"embed";
export type NoteAccent="blue"|"slate"|"green"|"amber"|"rose";
export type InsertPosition="before"|"after"|"replace"|"end";

export type AuthoringAnchor={
  blockId?:string|null;
  ordinal?:number|null;
  afterBlockId?:string|null;
  insert?:InsertPosition;
  selection?:{blockId?:string|null;text?:string}|null;
};

export type DocumentBlockMutation=
  |{operation:"insert";blockType:string;blockId?:string;content?:any;dataSpec?:DataSpec|null;target?:AuthoringAnchor}
  |{operation:"update";blockId:string;blockType?:string;content?:any;dataSpec?:DataSpec|null}
  |{operation:"reorder";blockId:string;targetOrdinal:number}
  |{operation:"hide";blockId:string};

export const NOTE_ACCENTS:NoteAccent[]=["blue","slate","green","amber","rose"];
export const INTERACTIVE_VIEWS:{id:InteractiveView;label:string}[]=[
  {id:"chart",label:"График"},
  {id:"table",label:"Таблица"},
  {id:"timeline",label:"Таймлайн"},
  {id:"visual",label:"Визуал"},
  {id:"embed",label:"Вставка"},
];
export const INSERT_TYPES:[string,string][]=[
  ["heading","Заголовок"],
  ["rich_text","Текст"],
  ["callout","Заметка"],
  ["image","Изображение"],
  ["video","Видео"],
  ["interactive","Интерактив"],
];

export function chartSpec(family="SI"):DataSpec{
  return {provider:"MOEX_ISS",instrument:{family,resolver:"front_active_contract"},metric:"ohlcv_session",relativeRange:{tradingSessions:2},fixedRange:null,transforms:["group_by_session","cumulative_volume"],display:{renderer:"studio_market_chart",crosshair:true,kind:"chart"},updatePolicy:"LIVE",asOf:null};
}

export function plainText(value:unknown){
  return String(value??"").replace(/<br\s*\/?>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/\s+/g," ").trim();
}

export function resolveVideoEmbed(raw:string){
  try{
    const u=new URL(String(raw||"").trim());
    const host=u.hostname.replace(/^www\./,"");
    if(host==="youtu.be"&&u.pathname.length>1)return "https://www.youtube.com/embed/"+u.pathname.slice(1).split("/")[0];
    if(host.endsWith("youtube.com")||host.endsWith("youtube-nocookie.com")){
      const id=u.searchParams.get("v")||(u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)||[])[1];
      if(id)return "https://www.youtube.com/embed/"+id;
    }
    if(host.endsWith("rutube.ru")){
      const id=(u.pathname.match(/\/(?:video|play\/embed|shorts)\/([^/?]+)/)||[])[1];
      if(id)return "https://rutube.ru/play/embed/"+id;
    }
    if(host.endsWith("vimeo.com")){
      const id=(u.pathname.match(/\/(?:video\/)?([0-9]+)/)||[])[1];
      if(id)return "https://player.vimeo.com/video/"+id;
    }
    if(host==="vk.com"||host.endsWith("vkvideo.ru")){
      const pair=(u.pathname.match(/video(-?\d+)_(\d+)/)||u.search.match(/video(-?\d+)_(\d+)/)||[]) as string[];
      if(pair[1]&&pair[2])return `https://vk.com/video_ext.php?oid=${pair[1]}&id=${pair[2]}&hd=2`;
    }
  }catch{}
  return "";
}

export function embedSrc(raw:string){
  const video=resolveVideoEmbed(raw);
  if(video)return video;
  try{
    const u=new URL(String(raw||"").trim());
    const host=u.hostname.replace(/^www\./,"");
    if(host==="tqs-studio.vercel.app"||host.endsWith(".vercel.app")&&host.startsWith("tqs-"))return u.toString();
  }catch{}
  return "";
}

export function interactiveView(block:StudioDocumentBlock):InteractiveView|null{
  if(block.block_type==="interactive"){
    const view=String(block.content?.view||block.data_spec?.display?.kind||"chart");
    return (["chart","table","timeline","visual","embed"] as string[]).includes(view)?view as InteractiveView:"chart";
  }
  if(block.block_type==="interactive_chart"||block.block_type==="live_data")return "chart";
  if(block.block_type==="market_replay")return "timeline";
  if(block.block_type==="table")return "table";
  return null;
}

export function blockHasPublicationBody(block:StudioDocumentBlock){
  const c=block.content||{};
  if(c.hidden)return false;
  if(block.block_type==="heading"||block.block_type==="callout")return Boolean(plainText(c.text));
  if(block.block_type==="rich_text")return Boolean(plainText(c.html));
  if(block.block_type==="image")return Boolean(c.url||c.previewUrl||c.svg);
  if(block.block_type==="video")return Boolean(String(c.url||"").trim());
  if(block.block_type==="divider")return true;
  if(block.block_type==="sources")return Array.isArray(c.items)&&c.items.length>0;
  if(block.block_type==="pdf_excerpt")return Boolean(plainText(c.text)||plainText(c.title));
  const view=interactiveView(block);
  if(view==="chart")return Boolean(block.data_spec);
  if(view==="table")return tableHasText(c);
  if(view==="timeline")return Boolean(block.data_spec)||(Array.isArray(c.items)&&c.items.some((item:any)=>plainText(item?.text)||plainText(item?.label)));
  if(view==="visual")return Boolean(c.url||c.previewUrl||c.svg);
  if(view==="embed")return Boolean(embedSrc(c.url||""));
  return Boolean(plainText(c.text)||plainText(c.title)||plainText(c.html));
}

function tableHasText(c:any){
  const cells=[...(c.columns||[]),...(c.rows||[]).flat()];
  return cells.some((cell)=>plainText(cell));
}

export function publicationBlocks(blocks:StudioDocumentBlock[]){
  return [...blocks].filter(blockHasPublicationBody).sort((a,b)=>a.ordinal-b.ordinal);
}

export function defaultBlockContent(type:string){
  if(type==="heading")return {text:"Новый заголовок"};
  if(type==="rich_text")return {html:"<p>Новый текст</p>"};
  if(type==="callout")return {text:"Новая заметка",accent:"blue" as NoteAccent};
  if(type==="image")return {title:"Изображение",url:""};
  if(type==="video")return {title:"Видео",url:""};
  if(type==="interactive")return {title:"Интерактив",view:"chart" as InteractiveView};
  return {title:type};
}

export function defaultBlockData(type:string,content?:any):DataSpec|null{
  if(type==="interactive"&&(content?.view||"chart")==="chart")return chartSpec(content?.instrument||"SI");
  if(type==="interactive_chart"||type==="live_data")return chartSpec();
  return null;
}

export function documentKindLabel(kind:string){
  if(kind==="lesson")return "Занятие";
  if(kind==="article")return "Статья";
  if(kind==="course")return "Курс";
  if(kind==="project")return "Проект";
  return "Материал";
}

export type LibraryNode={id:string;label:string;documentId?:string;children:LibraryNode[]};

export function libraryTree(documents:StudioDocument[]):LibraryNode[]{
  const root:LibraryNode[]=[];
  const sorted=[...documents].sort((a,b)=>a.semantic_path.localeCompare(b.semantic_path,"ru")||a.title.localeCompare(b.title,"ru"));
  for(const doc of sorted){
    const parts=doc.semantic_path.split("/").map(part=>part.trim()).filter(Boolean);
    let level=root;
    let acc="";
    parts.forEach((part,index)=>{
      acc+= (acc?"/":"")+part;
      const last=index===parts.length-1;
      const id=last?"doc:"+doc.id:"path:"+acc;
      let node=level.find(item=>item.id===id);
      if(!node){
        node={id,label:last?doc.title:part,documentId:last?doc.id:undefined,children:[]};
        level.push(node);
      }else if(last){
        node.documentId=doc.id;
        node.label=doc.title;
      }
      level=node.children;
    });
    if(!parts.length)root.push({id:"doc:"+doc.id,label:doc.title,documentId:doc.id,children:[]});
  }
  return root;
}

export function uniqueDocuments(documents:StudioDocument[],ids?:string[]){
  const seen=new Set<string>();
  const source=ids?ids.map(id=>documents.find(doc=>doc.id===id)).filter(Boolean) as StudioDocument[]:documents;
  return source.filter(doc=>{if(seen.has(doc.id))return false;seen.add(doc.id);return true});
}

export function filterDocuments(documents:StudioDocument[],query:string){
  const q=query.trim().toLowerCase();
  if(!q)return uniqueDocuments(documents);
  return uniqueDocuments(documents).filter(doc=>(doc.title+" "+doc.semantic_path+" "+doc.kind).toLowerCase().includes(q));
}

function sortedBlocks(blocks:StudioDocumentBlock[]){
  return [...blocks].sort((a,b)=>a.ordinal-b.ordinal||a.block_id.localeCompare(b.block_id));
}

export function resolveInsertAnchor(blocks:StudioDocumentBlock[],target:AuthoringAnchor={}){
  const list=sortedBlocks(blocks);
  if(target.insert==="end"||(!target.blockId&&target.ordinal==null&&!target.afterBlockId)){
    const last=list[list.length-1];
    return {afterBlockId:last?.block_id??null,ordinal:(last?.ordinal??0)+1,blockId:null as string|null};
  }
  if(target.afterBlockId==="__FIRST__")return {afterBlockId:"__FIRST__",ordinal:1,blockId:null};
  if(target.afterBlockId){
    const after=list.find(block=>block.block_id===target.afterBlockId);
    return {afterBlockId:target.afterBlockId,ordinal:(after?.ordinal??list.length)+1,blockId:null};
  }
  const selected=target.blockId?list.find(block=>block.block_id===target.blockId):list.find(block=>block.ordinal===target.ordinal);
  if(!selected){
    const last=list[list.length-1];
    return {afterBlockId:last?.block_id??null,ordinal:(last?.ordinal??0)+1,blockId:null};
  }
  if(target.insert==="replace")return {afterBlockId:selected.block_id,ordinal:selected.ordinal,blockId:selected.block_id};
  if(target.insert==="before"){
    const prev=list.filter(block=>block.ordinal<selected.ordinal).at(-1);
    return {afterBlockId:prev?prev.block_id:"__FIRST__",ordinal:selected.ordinal,blockId:null};
  }
  return {afterBlockId:selected.block_id,ordinal:selected.ordinal+1,blockId:null};
}

export function documentAuthoringContext(document:StudioDocument,blocks:StudioDocumentBlock[],target:AuthoringAnchor={}){
  const list=sortedBlocks(blocks);
  const selected=target.blockId?list.find(block=>block.block_id===target.blockId):target.ordinal!=null?list.find(block=>block.ordinal===target.ordinal):target.selection?.blockId?list.find(block=>block.block_id===target.selection?.blockId):null;
  const anchor=resolveInsertAnchor(list,{...target,blockId:target.blockId??selected?.block_id??null,ordinal:target.ordinal??selected?.ordinal??null});
  return {
    context_version:"tqs-studio-document-authoring/v1",
    document_id:document.id,
    revision:document.revision,
    blocks:list.map(block=>({block_id:block.block_id,ordinal:block.ordinal,block_type:block.block_type,hidden:Boolean(block.content?.hidden)})),
    target:{
      document_id:document.id,
      block_id:selected?.block_id??null,
      ordinal:selected?.ordinal??null,
      block_type:selected?.block_type??null,
      after_block_id:anchor.afterBlockId,
      insert:target.insert??"after",
      selection:target.selection??null,
    },
  };
}

function reindex(blocks:StudioDocumentBlock[]){
  blocks.forEach((block,index)=>{block.ordinal=index+1});
  return blocks;
}

function insertAt(blocks:StudioDocumentBlock[],block:StudioDocumentBlock,ordinal:number){
  const next=blocks.filter(item=>item.block_id!==block.block_id);
  const list=sortedBlocks(next);
  const index=Math.max(0,Math.min(list.length,ordinal-1));
  list.splice(index,0,block);
  return reindex(list);
}

export function applyDocumentMutations(blocks:StudioDocumentBlock[],documentId:string,mutations:DocumentBlockMutation[],newId:()=>string){
  let next=sortedBlocks(blocks).map(block=>({...block,content:block.content?{...block.content}:{},data_spec:block.data_spec??null}));
  const applied:{operation:string;blockId:string;ordinal:number}[]=[];
  for(const mutation of mutations){
    if(mutation.operation==="reorder"){
      const current=next.find(block=>block.block_id===mutation.blockId);
      if(!current)throw new Error("BLOCK_NOT_FOUND");
      next=next.filter(block=>block.block_id!==current.block_id);
      const list=sortedBlocks(next);
      const index=Math.max(0,Math.min(list.length,Number(mutation.targetOrdinal)-1));
      list.splice(index,0,current);
      next=reindex(list);
      applied.push({operation:"reorder",blockId:current.block_id,ordinal:current.ordinal});
      continue;
    }
    if(mutation.operation==="hide"){
      const current=next.find(block=>block.block_id===mutation.blockId);
      if(!current)throw new Error("BLOCK_NOT_FOUND");
      current.content={...current.content,hidden:!current.content?.hidden};
      current.revision+=1;
      applied.push({operation:"hide",blockId:current.block_id,ordinal:current.ordinal});
      continue;
    }
    if(mutation.operation==="update"){
      const current=next.find(block=>block.block_id===mutation.blockId);
      if(!current)throw new Error("BLOCK_NOT_FOUND");
      if(mutation.blockType)current.block_type=mutation.blockType;
      if(mutation.content!==undefined)current.content=mutation.content||{};
      if(mutation.dataSpec!==undefined)current.data_spec=mutation.dataSpec;
      current.revision+=1;
      applied.push({operation:"update",blockId:current.block_id,ordinal:current.ordinal});
      continue;
    }
    const anchor=resolveInsertAnchor(next,mutation.target||{});
    if(mutation.target?.insert==="replace"&&anchor.blockId){
      const current=next.find(block=>block.block_id===anchor.blockId);
      if(!current)throw new Error("BLOCK_NOT_FOUND");
      current.block_type=mutation.blockType;
      current.content={...(mutation.content||{}),provenance:mutation.content?.provenance};
      if(mutation.dataSpec!==undefined)current.data_spec=mutation.dataSpec;
      current.revision+=1;
      applied.push({operation:"update",blockId:current.block_id,ordinal:current.ordinal});
      continue;
    }
    const blockId=mutation.blockId||newId();
    const created:StudioDocumentBlock={block_id:blockId,document_id:documentId,ordinal:anchor.ordinal,block_type:mutation.blockType,content:mutation.content||{},data_spec:mutation.dataSpec??null,asset_id:null,revision:1};
    next=insertAt(next,created,anchor.ordinal);
    const placed=next.find(block=>block.block_id===blockId)!;
    applied.push({operation:"insert",blockId,ordinal:placed.ordinal});
  }
  return {blocks:sortedBlocks(next),applied};
}

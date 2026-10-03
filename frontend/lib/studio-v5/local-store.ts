"use client";
import type {DocumentBundle,StudioActivity,StudioDocument,StudioDocumentBlock,StudioObject,WorldOverview} from "./types";

const KEY="tqs-studio-v5-local-state-v2";
const now=()=>new Date().toISOString();
const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));

type LocalState={overview:WorldOverview;documents:StudioDocument[];blocks:StudioDocumentBlock[];assets:Record<string,{id:string;dataUrl:string;filename?:string;mime_type:string;storage_path:string}>};

const liveSpec:any={provider:"MOEX_ISS",instrument:{family:"SI",resolver:"front_active_contract"},metric:"ohlcv_session",relativeRange:{tradingSessions:2},fixedRange:null,transforms:["group_by_session","cumulative_volume"],display:{renderer:"studio_market_chart",crosshair:true,periodControl:true},updatePolicy:"LIVE",asOf:null};
const replaySpec:any={provider:"MOEX_ISS",instrument:{family:"SI",resolver:"front_active_contract"},metric:"ohlcv",relativeRange:{tradingSessions:1},fixedRange:null,transforms:["chronological"],display:{renderer:"studio_market_replay",targetDurationSeconds:30},updatePolicy:"LIVE",asOf:null};

function obj(o:Partial<StudioObject>&Pick<StudioObject,"id"|"kind"|"semantic_path"|"x"|"y"|"w"|"h"|"z"|"title">):StudioObject{
 return {world_key:"tqs-studio-world",parent_id:null,body:{},relations:[],status:null,hidden:false,revision:1,created_at:now(),updated_at:now(),...o};
}
function block(b:Partial<StudioDocumentBlock>&Pick<StudioDocumentBlock,"block_id"|"document_id"|"ordinal"|"block_type">):StudioDocumentBlock{
 return {content:{},data_spec:null,asset_id:null,revision:1,...b};
}
function initialState():LocalState{
 const objects:StudioObject[]=[
  obj({id:"frame-agent",kind:"frame",semantic_path:"ARTEM OS/Agent",x:260,y:300,w:1180,h:850,z:1,title:"ARTEM OS / Agent"}),
  obj({id:"frame-tqs",kind:"frame",semantic_path:"TQS/Trading/Intelligence",x:2050,y:240,w:1500,h:930,z:1,title:"TQS / Trading / Intelligence"}),
  obj({id:"frame-learning",kind:"frame",semantic_path:"Обучение",x:3900,y:260,w:2300,h:1700,z:1,title:"Обучение"}),
  obj({id:"frame-articles",kind:"frame",semantic_path:"Статьи",x:600,y:1800,w:1650,h:1000,z:1,title:"Статьи"}),
  obj({id:"frame-inbox",kind:"frame",semantic_path:"Inbox",x:2700,y:1780,w:1200,h:900,z:1,title:"Inbox"}),
  obj({id:"course-free",kind:"frame",semantic_path:"Обучение/Бесплатный курс",parent_id:"frame-learning",x:4100,y:520,w:920,h:1180,z:2,title:"Бесплатный курс",relations:[{type:"contains",targetId:"frame-learning"}]}),
  obj({id:"course-scalp",kind:"frame",semantic_path:"Обучение/Скальпинг по стакану",parent_id:"frame-learning",x:5160,y:520,w:850,h:1180,z:2,title:"Скальпинг по стакану",relations:[{type:"contains",targetId:"frame-learning"}]}),
  obj({id:"lesson-free-1",kind:"frame",semantic_path:"Обучение/Бесплатный курс/Занятие 1",parent_id:"course-free",x:4210,y:720,w:700,h:360,z:3,title:"Занятие 1 — Рабочее пространство",body:{demo:true},relations:[{type:"contains",targetId:"course-free"}]}),
  obj({id:"lesson-free-2",kind:"frame",semantic_path:"Обучение/Бесплатный курс/Занятие 2",parent_id:"course-free",x:4210,y:1130,w:700,h:240,z:3,title:"Занятие 2 — Стакан и лента",relations:[{type:"contains",targetId:"course-free"}]}),
  obj({id:"lesson-free-3",kind:"frame",semantic_path:"Обучение/Бесплатный курс/Занятие 3",parent_id:"course-free",x:4210,y:1420,w:700,h:240,z:3,title:"Занятие 3 — Базовая подготовка",relations:[{type:"contains",targetId:"course-free"}]}),
  obj({id:"lesson-scalp-1",kind:"frame",semantic_path:"Обучение/Скальпинг по стакану/Занятие 1",parent_id:"course-scalp",x:5260,y:720,w:640,h:240,z:3,title:"Занятие 1 — Чтение стакана",relations:[{type:"contains",targetId:"course-scalp"}]}),
  obj({id:"lesson-scalp-2",kind:"frame",semantic_path:"Обучение/Скальпинг по стакану/Занятие 2",parent_id:"course-scalp",x:5260,y:1020,w:640,h:240,z:3,title:"Занятие 2 — Плотности и реакции",relations:[{type:"contains",targetId:"course-scalp"}]}),
  obj({id:"lesson-scalp-3",kind:"frame",semantic_path:"Обучение/Скальпинг по стакану/Занятие 3",parent_id:"course-scalp",x:5260,y:1320,w:640,h:240,z:3,title:"Занятие 3 — Работа с импульсом",relations:[{type:"contains",targetId:"course-scalp"}]}),
  obj({id:"lesson-demo-text",kind:"text",semantic_path:"Обучение/Бесплатный курс/Занятие 1/План занятия",parent_id:"lesson-free-1",x:4280,y:820,w:270,h:110,z:10,title:"План занятия",body:{html:"<p>Настроить график, стакан, ленту и рабочие заметки. Этот текст можно редактировать и перемещать.</p>"},relations:[{type:"contains",targetId:"lesson-free-1"}]}),
  obj({id:"lesson-demo-task",kind:"task",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Практика",parent_id:"lesson-free-1",x:4590,y:820,w:280,h:90,z:10,title:"Практика урока",body:{title:"Добавить свой скрин рабочего пространства",done:false},relations:[{type:"contains",targetId:"lesson-free-1"}],status:"NEW"}),
  obj({id:"lesson-demo-voice",kind:"voice",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Голосовая заметка",parent_id:"lesson-free-1",x:4280,y:950,w:320,h:84,z:10,title:"Голосовая заметка",body:{status:"Ожидает записи"},relations:[{type:"contains",targetId:"lesson-free-1"}],status:"WAITING_RECORDING"}),
  obj({id:"lesson-doc-ref",kind:"documentRef",semantic_path:"Обучение/Бесплатный курс/Занятие 1",parent_id:"lesson-free-1",x:4630,y:945,w:240,h:84,z:10,title:"Открыть документ занятия",body:{documentId:"doc-lesson-workspace"},relations:[{type:"document_of",targetId:"doc-lesson-workspace"},{type:"contains",targetId:"lesson-free-1"}]}),
  obj({id:"article-si-frame",kind:"documentRef",semantic_path:"Статьи/Si — история ликвидности",parent_id:"frame-articles",x:820,y:2070,w:650,h:240,z:5,title:"Статья — Si: история ликвидности",body:{documentId:"doc-si"},relations:[{type:"document_of",targetId:"doc-si"},{type:"contains",targetId:"frame-articles"}]})
 ];
 const documents:StudioDocument[]=[
  {id:"doc-lesson-workspace",world_key:"tqs-studio-world",slug:"zanyatie-1-rabochee-prostranstvo",kind:"lesson",title:"Занятие 1 — Рабочее пространство",semantic_path:"Обучение/Бесплатный курс/Занятие 1",frame_id:"lesson-free-1",revision:1,status:"DRAFT",share_mode:"private",metadata:{demo:true}},
  {id:"doc-si",world_key:"tqs-studio-world",slug:"si-istoriya-likvidnosti",kind:"article",title:"Статья — Si: история ликвидности",semantic_path:"Статьи/Si — история ликвидности",frame_id:"article-si-frame",revision:1,status:"DRAFT",share_mode:"private",metadata:{drive_package_id:"1UJVJUBPt5pEHmjmb79Pllm-hyIij0DkD"}}
 ];
 const blocks:StudioDocumentBlock[]=[
  block({block_id:"lesson-h1",document_id:"doc-lesson-workspace",ordinal:1,block_type:"heading",content:{text:"Занятие 1 — Рабочее пространство"}}),
  block({block_id:"lesson-t1",document_id:"doc-lesson-workspace",ordinal:2,block_type:"rich_text",content:{html:"<p>Настраиваем рабочее пространство так, чтобы график, стакан, лента и заметки помогали принимать решения. Этот документ — тестовая поверхность Studio V5.</p>"}}),
  block({block_id:"lesson-call",document_id:"doc-lesson-workspace",ordinal:3,block_type:"callout",content:{text:"Практика: оставляем на экране только то, что влияет на торговое решение."}}),
  block({block_id:"lesson-table",document_id:"doc-lesson-workspace",ordinal:4,block_type:"table",content:{columns:["Элемент","Зачем"],rows:[["График","Контекст цены"],["Стакан","Текущая ликвидность"],["Лента","Агрессор и темп"]]}}),
  block({block_id:"lesson-sources",document_id:"doc-lesson-workspace",ordinal:5,block_type:"sources",content:{items:[{label:"Связанный World Frame",entityId:"lesson-free-1"},{label:"MOEX ISS",type:"market_data"}]}}),
  block({block_id:"lesson-chart",document_id:"doc-lesson-workspace",ordinal:6,block_type:"interactive_chart",content:{title:"Si — интерактивный график"},data_spec:liveSpec}),
  block({block_id:"lesson-live",document_id:"doc-lesson-workspace",ordinal:7,block_type:"live_data",content:{title:"Si — реальный объём текущей и прошлой сессии"},data_spec:liveSpec}),
  block({block_id:"lesson-replay",document_id:"doc-lesson-workspace",ordinal:8,block_type:"market_replay",content:{title:"Market Replay — Si, день за 30 секунд"},data_spec:replaySpec}),
  block({block_id:"lesson-image",document_id:"doc-lesson-workspace",ordinal:9,block_type:"image",content:{caption:"Сюда можно вставить скрин рабочего пространства и рисовать поверх него."}}),
  block({block_id:"lesson-video",document_id:"doc-lesson-workspace",ordinal:10,block_type:"video",content:{title:"Видео / запись экрана — тестовый reference"}}),
  block({block_id:"lesson-pdf",document_id:"doc-lesson-workspace",ordinal:11,block_type:"pdf_excerpt",content:{title:"PDF / конспект",text:"Тестовый excerpt: блок можно адресовать по номеру и stable block_id.",page:1}}),
  block({block_id:"lesson-div",document_id:"doc-lesson-workspace",ordinal:12,block_type:"divider"}),
  block({block_id:"lesson-end",document_id:"doc-lesson-workspace",ordinal:13,block_type:"rich_text",content:{html:"<p>Проверь: вставку между блоками, drag reorder, переход «На доске», share и PDF.</p>"}}),
  block({block_id:"si-h1",document_id:"doc-si",ordinal:1,block_type:"heading",content:{text:"Si: история ликвидности и объёмов"}}),
  block({block_id:"si-t1",document_id:"doc-si",ordinal:2,block_type:"rich_text",content:{html:"<p>Линейный документ связан с World и использует стабильные блоки без x/y.</p>"}}),
  block({block_id:"si-live-volume",document_id:"doc-si",ordinal:3,block_type:"live_data",content:{title:"Si — объём текущей и прошлой торговой сессии"},data_spec:liveSpec}),
  block({block_id:"si-replay",document_id:"doc-si",ordinal:4,block_type:"market_replay",content:{title:"Si — день за 30 секунд"},data_spec:replaySpec})
 ];
 return {overview:{world:{world_key:"tqs-studio-world",revision:1,title:"TQS Studio World",metadata:{schema_version:"tqs-studio-world/v5-local-recovery"}},objects,activity:[]},documents,blocks,assets:{}};
}
function load():LocalState{
 if(typeof window==="undefined")return initialState();
 try{
  const raw=localStorage.getItem(KEY);
  if(raw){const x=JSON.parse(raw) as LocalState;if(x?.overview?.objects?.some(o=>o.id==="lesson-free-1")&&x?.blocks?.some(b=>b.block_id==="lesson-replay"))return x}
 }catch{}
 const s=initialState();save(s);return s;
}
function save(s:LocalState){if(typeof window!=="undefined")localStorage.setItem(KEY,JSON.stringify(s))}
function activity(s:LocalState,entity_id:string|null,semantic_path:string,event_type:string,summary:string,payload:any={}){
 s.overview.activity.unshift({id:crypto.randomUUID(),entity_id,semantic_path,event_type,status:"NEW",summary,payload,occurred_at:now()});s.overview.activity=s.overview.activity.slice(0,200);
}
function documentBundle(s:LocalState,id:string):DocumentBundle{
 const d=s.documents.find(x=>x.id===id);if(!d)throw new Error("DOCUMENT_NOT_FOUND");
 return {document:clone(d),blocks:clone(s.blocks.filter(x=>x.document_id===id).sort((a,b)=>a.ordinal-b.ordinal))};
}
function bumpWorld(s:LocalState){s.overview.world.revision+=1}
export function resetLocalStudio(){const s=initialState();save(s);return clone(s)}
export function getLocalSeed(){return clone(initialState())}

export async function localStudioAction<T=any>(name:string,p:any={}):Promise<T>{
 const s=load();
 if(name==="ensureSeed")return {seed:"local-v2",objects:s.overview.objects.length,documents:s.documents.length,lessonBlocks:s.blocks.filter(b=>b.document_id==="doc-lesson-workspace").length} as T;
 if(name==="getWorldOverview")return clone(s.overview) as T;
 if(name==="listDocuments")return clone([...s.documents].sort((a,b)=>b.revision-a.revision)) as T;
 if(name==="getDocument")return documentBundle(s,p.documentId) as T;
 if(name==="getEntityContext"){
  const entity=s.overview.objects.find(o=>o.id===p.id);if(!entity)throw new Error("ENTITY_NOT_FOUND");
  return {entity:clone(entity),children:clone(s.overview.objects.filter(o=>o.parent_id===p.id)),activity:clone(s.overview.activity.filter(a=>a.semantic_path.startsWith(entity.semantic_path)).slice(0,50)),documents:clone(s.documents.filter(d=>d.frame_id===p.id))} as T;
 }
 if(name==="getRecentActivity"){
  let a=s.overview.activity;if(p.semanticPath)a=a.filter(x=>x.semantic_path.startsWith(p.semanticPath));if(p.status)a=a.filter(x=>x.status===p.status);if(p.since)a=a.filter(x=>x.occurred_at>=p.since);return clone(a.slice(0,Math.min(Number(p.limit||50),200))) as T;
 }
 if(name==="createWorldObject"){
  const o:StudioObject={world_key:"tqs-studio-world",revision:1,created_at:now(),updated_at:now(),...p.object};
  s.overview.objects=s.overview.objects.filter(x=>x.id!==o.id);s.overview.objects.push(o);bumpWorld(s);activity(s,o.id,o.semantic_path,"create","Создано: "+(o.title||o.kind));save(s);return {object:clone(o),worldRevision:s.overview.world.revision} as T;
 }
 if(name==="updateObject"){
  const i=s.overview.objects.findIndex(o=>o.id===p.id);if(i<0)throw new Error("OBJECT_NOT_FOUND");const old=s.overview.objects[i];const o={...old,...p.patch,revision:old.revision+1,updated_at:now()};s.overview.objects[i]=o;bumpWorld(s);if(p.eventType)activity(s,o.id,o.semantic_path,p.eventType,p.summary||("Обновлён: "+o.title));save(s);return {object:clone(o),worldRevision:s.overview.world.revision} as T;
 }
 if(name==="createDocument"){
  const id=p.id||("doc-"+crypto.randomUUID()),slug=p.slug||String(p.title||"document").toLowerCase().replace(/[^a-z0-9а-яё]+/gi,"-").replace(/^-|-$/g,"")+"-"+id.slice(-6);
  const d:StudioDocument={id,world_key:"tqs-studio-world",slug,kind:p.kind||"instruction",title:p.title||"Новый документ",semantic_path:p.semanticPath||"Документы",frame_id:p.frameId||null,revision:1,status:"DRAFT",share_mode:"private",metadata:{}};
  s.documents.push(d);s.blocks.push(block({block_id:"h-"+crypto.randomUUID(),document_id:id,ordinal:1,block_type:"heading",content:{text:d.title}}),block({block_id:"t-"+crypto.randomUUID(),document_id:id,ordinal:2,block_type:"rich_text",content:{html:"<p>Новый документ</p>"}}));activity(s,id,d.semantic_path,"document_link","Создан документ: "+d.title);save(s);return documentBundle(s,id) as T;
 }
 if(name==="upsertDocumentBlock"){
  const d=s.documents.find(x=>x.id===p.documentId);if(!d)throw new Error("DOCUMENT_NOT_FOUND");let b=s.blocks.find(x=>x.block_id===p.blockId&&x.document_id===p.documentId);
  if(b){b.block_type=p.blockType;b.content=p.content||{};b.data_spec=p.dataSpec||null;b.revision+=1}else{
   let pos:number;if(p.afterBlockId==="__FIRST__")pos=1;else if(p.afterBlockId){const after=s.blocks.find(x=>x.document_id===p.documentId&&x.block_id===p.afterBlockId);pos=(after?.ordinal||s.blocks.filter(x=>x.document_id===p.documentId).length)+1}else pos=Math.max(0,...s.blocks.filter(x=>x.document_id===p.documentId).map(x=>x.ordinal))+1;
   for(const x of s.blocks.filter(x=>x.document_id===p.documentId&&x.ordinal>=pos))x.ordinal+=1;b=block({block_id:p.blockId,document_id:p.documentId,ordinal:pos,block_type:p.blockType,content:p.content||{},data_spec:p.dataSpec||null});s.blocks.push(b);
  }d.revision+=1;activity(s,p.documentId,p.semanticPath||d.semantic_path,"text_update","Обновлён блок "+p.blockId,{blockType:p.blockType});save(s);return {block:clone(b),documentRevision:d.revision} as T;
 }
 if(name==="reorderDocumentBlock"){
  const arr=s.blocks.filter(x=>x.document_id===p.documentId).sort((a,b)=>a.ordinal-b.ordinal),idx=arr.findIndex(x=>x.block_id===p.blockId);if(idx<0)throw new Error("BLOCK_NOT_FOUND");const [m]=arr.splice(idx,1),target=Math.max(0,Math.min(arr.length,Number(p.targetOrdinal)-1));arr.splice(target,0,m);arr.forEach((x,i)=>x.ordinal=i+1);const d=s.documents.find(x=>x.id===p.documentId);if(d)d.revision+=1;save(s);return {blocks:clone(arr),documentRevision:d?.revision||1} as T;
 }
 if(name==="attachAsset"){
  const id=crypto.randomUUID(),m=String(p.dataUrl||"").match(/^data:([^;,]+)/),mime=m?.[1]||"application/octet-stream",asset={id,dataUrl:p.dataUrl,filename:p.filename,mime_type:mime,storage_path:"local/"+id};
  s.assets[id]=asset;save(s);return {asset:{id,storage_path:asset.storage_path,mime_type:mime,metadata:{filename:p.filename}},signedUrl:p.dataUrl} as T;
 }
 if(name==="getAssetUrl"){const a=s.assets[p.assetId];if(!a)throw new Error("ASSET_NOT_FOUND");return {asset:{id:a.id,storage_path:a.storage_path,mime_type:a.mime_type},signedUrl:a.dataUrl} as T}
 if(name==="markActivityDone"){const a=s.overview.activity.find(x=>x.id===p.id);if(a)a.status="DONE";save(s);return clone(a) as T}
 if(name==="driveStatus")return {connection:{status:"OPTIONAL_AUTH_LATER",root_name:"TQS STUDIO — WORLD",last_sync_at:null},conflicts:[],oauthConfigured:false} as T;
 throw new Error("LOCAL_ACTION_UNSUPPORTED:"+name);
}

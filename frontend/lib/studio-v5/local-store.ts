"use client";
import type {DocumentBundle,StudioActivity,StudioDocument,StudioDocumentBlock,StudioObject,WorldOverview} from "./types";
import {applyDocumentMutations,documentAuthoringContext,type DocumentBlockMutation} from "../studio-v6/document-model";
import {activityForMutation,applyWorldMutations,buildStudioContext} from "../studio-v6/studio-context";
import {causeMapObjects} from "../studio-v6/diagram";
import {upgradeLessonShowcase} from "../studio-v6/lesson-showcase";

const KEY="tqs-studio-v5-local-state-v4";
const now=()=>new Date().toISOString();
const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));

type DocRun={runId:string;documentId:string;at:string;actor:string;summary:string;before:StudioDocumentBlock[]};
type AiRun={runId:string;at:string;actor:string;summary:string;before:StudioObject[];mutations:any[];applied?:boolean};
type LocalState={overview:WorldOverview;documents:StudioDocument[];blocks:StudioDocumentBlock[];assets:Record<string,{id:string;dataUrl:string;filename?:string;mime_type:string;storage_path:string}>;documentRuns?:DocRun[];aiRuns?:AiRun[];source?:"canonical"|"local"};

const liveSpec:any={provider:"MOEX_ISS",instrument:{family:"SI",resolver:"front_active_contract"},metric:"ohlcv_session",relativeRange:{tradingSessions:2},fixedRange:null,transforms:["group_by_session","cumulative_volume"],display:{renderer:"studio_market_chart",crosshair:true,periodControl:true},updatePolicy:"LIVE",asOf:null};
const replaySpec:any={provider:"MOEX_ISS",instrument:{family:"SI",resolver:"front_active_contract"},metric:"ohlcv",relativeRange:{tradingSessions:1},fixedRange:null,transforms:["chronological"],display:{renderer:"studio_market_replay",targetDurationSeconds:30},updatePolicy:"LIVE",asOf:null};

function obj(o:Partial<StudioObject>&Pick<StudioObject,"id"|"kind"|"semantic_path"|"x"|"y"|"w"|"h"|"z"|"title">):StudioObject{
 return {world_key:"tqs-studio-world",parent_id:null,body:{},relations:[],status:null,hidden:false,revision:1,created_at:now(),updated_at:now(),...o};
}
function block(b:Partial<StudioDocumentBlock>&Pick<StudioDocumentBlock,"block_id"|"document_id"|"ordinal"|"block_type">):StudioDocumentBlock{
 return {content:{},data_spec:null,asset_id:null,revision:1,...b};
}

const WORKSPACE_LAYOUT_VERSION=8;
const WORKSPACE_LAYOUT:Record<string,Partial<StudioObject>>={
 "frame-dev":{x:180,y:220,w:1100,h:820,title:"Разработка"},
 "frame-agent":{x:1460,y:220,w:1180,h:820,title:"Агент"},
 "frame-tqs":{x:2820,y:220,w:1280,h:820,title:"TQS Intelligence"},
 "frame-trading":{x:4280,y:220,w:1180,h:820,title:"Трейдинг"},
 "frame-learning":{x:5640,y:180,w:4200,h:3200,title:"Обучение"},
 "frame-kb":{x:5820,y:2760,w:1680,h:480,title:"База знаний"},
 "course-crypto":{x:7640,y:420,w:860,h:520,title:"Крипта"},
 "course-stocks":{x:7640,y:1020,w:860,h:520,title:"Акции"},
 "course-free":{x:5820,y:400,w:1680,h:2240,title:"Бесплатный курс · российский рынок"},
 "course-scalp":{x:8640,y:420,w:760,h:1680,title:"Скальпинг по стакану"},
 "lesson-miro-scene":{x:5920,y:560,w:1480,h:1120,title:"ЗАНЯТИЕ 1 · РАБОЧЕЕ ПРОСТРАНСТВО",body:{ownerReference:true,sceneVersion:8,workspaceCard:true,layoutVersion:WORKSPACE_LAYOUT_VERSION}},
 "lesson-free-2":{x:5920,y:2200,w:700,h:200,title:"Занятие 2 — Стакан и лента"},
 "lesson-free-3":{x:6680,y:2200,w:700,h:200,title:"Занятие 3 — Базовая подготовка"},
 "lesson-scalp-1":{x:8720,y:560,w:600,h:220},
 "lesson-scalp-2":{x:8720,y:840,w:600,h:220},
 "lesson-scalp-3":{x:8720,y:1120,w:600,h:220},
 "lesson-miro-l100":{x:6040,y:680,w:440,h:44,title:"L1.01 Рабочее место",body:{html:"<p><b>L1.01 Рабочее место</b></p>"}},
 "lesson-miro-l101":{x:6040,y:732,w:440,h:64,title:"Один экран",body:{html:"<p>Один экран — одно решение. График в центре. Остальное есть, только если влияет на сделку.</p>"}},
 "lesson-miro-shot":{x:6040,y:808,w:440,h:210},
 "lesson-miro-correction":{x:6460,y:860,w:250,h:120,title:"Пометка",body:{html:"<p><b>Пометка</b><br/>Стакан ближе к графику. Лишнюю панель убрать до занятия.</p>",accent:"purple"}},
 "lesson-miro-task":{x:6040,y:1032,w:400,h:44,title:"Задача",body:{title:"Сделать скрин рабочего места",done:false}},
 "lesson-miro-l102":{x:6760,y:680,w:500,h:64,title:"L1.02 График",body:{html:"<p><b>L1.02 График</b><br/>Цена и объём стоят рядом с решением, а не на отдельной панели.</p>"}},
 "lesson-miro-chart":{x:6760,y:760,w:520,h:250},
 "lesson-miro-caption":{x:6760,y:1028,w:500,h:64,title:"L1.03 Стакан",body:{html:"<p><b>L1.03 Стакан</b><br/>Стакан и лента стоят у цены.</p>"}},
 "lesson-miro-voice":{x:6760,y:1104,w:320,h:56,title:"К стакану",body:{title:"К стакану",duration:"0:18",transcript:"Стакан не уезжает в отдельное окно."}},
 "lesson-miro-doc":{x:7080,y:1104,w:220,h:72},
 "lesson-miro-person":{hidden:true},
 "lesson-miro-arrow-1":{hidden:false,body:{annotationKind:"arrow",fromId:"lesson-miro-l100",toId:"lesson-miro-l102"}},
 "lesson-miro-arrow-2":{hidden:false,body:{annotationKind:"arrow",fromId:"lesson-miro-l102",toId:"lesson-miro-caption"}},
 "lesson-miro-arrow-correction":{hidden:false,body:{annotationKind:"arrow",fromId:"lesson-miro-correction",toId:"lesson-miro-shot"}},
 "lesson-miro-marker":{x:6400,y:1480,w:280,h:24}
};
const LEGACY_LESSON_IDS=new Set(["lesson-free-1","lesson-demo-text","lesson-demo-task","lesson-demo-voice","lesson-doc-ref"]);
function migrateWorkspaceCardLayout(s:LocalState){
 const current=Number(s.overview.world.metadata?.layoutVersion||0);
 if(current>=WORKSPACE_LAYOUT_VERSION)return false;
 let changed=false;
 for(const o of s.overview.objects){
  const patch=WORKSPACE_LAYOUT[o.id];
  if(patch){
   const next={...o,...patch,body:patch.body?{...(o.body||{}),...(patch.body as any)}:o.body};
   if(JSON.stringify(next)!==JSON.stringify(o)){Object.assign(o,next);changed=true}
  }
  if(LEGACY_LESSON_IDS.has(o.id)&&!o.hidden){o.hidden=true;changed=true}
 }
 if(changed)s.overview.world.revision=Number(s.overview.world.revision||0)+1;
 s.overview.world.metadata={...(s.overview.world.metadata||{}),layoutVersion:WORKSPACE_LAYOUT_VERSION};
 save(s);
 return changed;
}

function ownerSceneObjects():StudioObject[]{return[
  obj({id:"lesson-miro-scene",kind:"frame",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство",parent_id:"course-free",x:5920,y:560,w:1480,h:1560,z:3,title:"Занятие 1 — Настройка рабочего пространства",body:{ownerReference:true,sceneVersion:5,workspaceCard:true,layoutVersion:5},relations:[{type:"contains",targetId:"course-free"}]}),
 obj({id:"lesson-miro-l100",kind:"text",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Вступление",parent_id:"lesson-miro-scene",x:6320,y:640,w:520,h:120,z:10,title:"Вступление",body:{html:"<p><b>Занятие 1</b><br/>Настраиваем экран так, чтобы он помогал решению, а не отвлекал.</p>"},relations:[{type:"contains",targetId:"lesson-miro-scene"}]}),
 obj({id:"lesson-miro-l101",kind:"text",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Шаг 1",parent_id:"lesson-miro-scene",x:6320,y:790,w:520,h:140,z:10,title:"Шаг 1",body:{html:"<p><b>1. Один экран — одно решение</b><br/>График занимает центр. Всё остальное появляется только если влияет на сделку.</p>"},relations:[{type:"contains",targetId:"lesson-miro-scene"}]}),
 obj({id:"lesson-miro-l102",kind:"text",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Шаг 2",parent_id:"lesson-miro-scene",x:6320,y:960,w:520,h:140,z:10,title:"Шаг 2",body:{html:"<p><b>2. Рядом со ценой</b><br/>Стакан и лента стоят у графика. Заметки не закрывают цену.</p>"},relations:[{type:"contains",targetId:"lesson-miro-scene"}]}),
 obj({id:"lesson-miro-shot",kind:"image",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Скрин рабочего места",parent_id:"lesson-miro-scene",x:4360,y:2040,w:560,h:300,z:10,title:"Скрин рабочего пространства",body:{previewUrl:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 440'%3E%3Crect width='800' height='440' fill='%231b1d20'/%3E%3Crect x='32' y='34' width='470' height='235' rx='10' fill='%23272b30' stroke='%236f7780'/%3E%3Cpolyline points='55,220 110,188 180,202 245,135 315,160 382,92 470,118' fill='none' stroke='%23d5ad5b' stroke-width='6'/%3E%3Crect x='525' y='34' width='242' height='360' rx='10' fill='%2323272b' stroke='%236f7780'/%3E%3Cpath d='M548 80h190M548 118h190M548 156h190M548 194h190M548 232h190M548 270h190' stroke='%23545b63' stroke-width='7'/%3E%3Crect x='32' y='292' width='470' height='102' rx='10' fill='%2323272b'/%3E%3Cpath d='M55 322h410M55 350h330' stroke='%23656d75' stroke-width='8'/%3E%3C/svg%3E",mimeType:"image/svg+xml",filename:"workspace-reference.svg"},relations:[{type:"contains",targetId:"lesson-miro-scene"}]}),
 obj({id:"lesson-miro-correction",kind:"text",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Правка",parent_id:"lesson-miro-scene",x:6900,y:790,w:440,h:150,z:12,title:"Правка справа",body:{html:"<p><b>Справа, пока готовлю урок</b><br/>Стакан ближе к графику. Лишнюю панель убрать до занятия.</p>",accent:"purple"},relations:[{type:"contains",targetId:"lesson-miro-scene"},{type:"annotates",targetId:"lesson-miro-shot"}]}),
 obj({id:"lesson-miro-person",kind:"image",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Пример преподавателя",parent_id:"lesson-miro-scene",x:5720,y:1180,w:360,h:430,z:10,title:"Пример фото преподавателя",body:{previewUrl:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 360 430'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%23242a31'/%3E%3Cstop offset='1' stop-color='%2311161b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='360' height='430' rx='18' fill='url(%23g)'/%3E%3Ccircle cx='180' cy='138' r='68' fill='%23c8a889'/%3E%3Cpath d='M104 133c7-76 145-86 155 0-18-20-39-34-77-34-34 0-59 12-78 34z' fill='%23302b29'/%3E%3Cpath d='M72 430c8-117 51-168 108-168s100 51 108 168z' fill='%23445263'/%3E%3Crect x='24' y='24' width='122' height='28' rx='14' fill='%23ffffff16'/%3E%3Ctext x='85' y='43' fill='%23e9e4da' font-family='Arial' font-size='12' text-anchor='middle'%3EФОТО / ВИДЕО%3C/text%3E%3C/svg%3E",mimeType:"image/svg+xml",filename:"teacher-reference.svg"},relations:[{type:"contains",targetId:"lesson-miro-scene"}]}),
 obj({id:"lesson-miro-caption",kind:"text",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Шаг 3",parent_id:"lesson-miro-scene",x:6320,y:1130,w:520,h:140,z:11,title:"Шаг 3",body:{html:"<p><b>3. Убрать лишнее</b><br/>Если панель не отвечает на вопрос «что делать», её нет на экране.</p>"},relations:[{type:"contains",targetId:"lesson-miro-scene"}]}),
 obj({id:"lesson-miro-arrow-1",kind:"annotation",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Связь 1",parent_id:"lesson-miro-scene",x:4385,y:1908,w:78,h:24,z:20,title:"Связь",body:{annotationKind:"arrow",points:[{x:0,y:12},{x:78,y:12}]},relations:[{type:"contains",targetId:"lesson-miro-scene"}]}),
 obj({id:"lesson-miro-arrow-2",kind:"annotation",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Связь 2",parent_id:"lesson-miro-scene",x:4695,y:1908,w:78,h:24,z:20,title:"Связь",body:{annotationKind:"arrow",points:[{x:0,y:12},{x:78,y:12}]},relations:[{type:"contains",targetId:"lesson-miro-scene"}]}),
 obj({id:"lesson-miro-arrow-correction",kind:"annotation",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Правка скрина",parent_id:"lesson-miro-scene",x:4915,y:2110,w:105,h:54,z:21,title:"Стрелка правки",body:{annotationKind:"arrow",points:[{x:0,y:45},{x:105,y:8}]},relations:[{type:"contains",targetId:"lesson-miro-scene"},{type:"annotates",targetId:"lesson-miro-shot"}]}),
 obj({id:"lesson-miro-chart",kind:"chart",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Si",parent_id:"lesson-miro-scene",x:5350,y:1880,w:380,h:280,z:10,title:"Si · объём",body:{dataSpec:liveSpec},relations:[{type:"contains",targetId:"lesson-miro-scene"}]}),
 obj({id:"lesson-miro-marker",kind:"annotation",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Маркер",parent_id:"lesson-miro-scene",x:4450,y:2270,w:330,h:24,z:22,title:"Маркер на скрине",body:{annotationKind:"marker",points:[{x:0,y:12},{x:95,y:8},{x:185,y:14},{x:330,y:9}]},relations:[{type:"contains",targetId:"lesson-miro-scene"},{type:"annotates",targetId:"lesson-miro-shot"}]}),
 obj({id:"lesson-miro-task",kind:"task",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Задача",parent_id:"lesson-miro-scene",x:5980,y:790,w:300,h:110,z:11,title:"Заметка слева",body:{title:"Слева: что сказать вслух на этом шаге",done:false},relations:[{type:"contains",targetId:"lesson-miro-scene"}],status:"NEW"}),
 obj({id:"lesson-miro-voice",kind:"voice",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Голосовая заметка",parent_id:"lesson-miro-scene",x:5980,y:930,w:300,h:110,z:11,title:"Голосовая слева",body:{status:"Ожидает записи"},relations:[{type:"contains",targetId:"lesson-miro-scene"}],status:"WAITING_RECORDING"}),
 obj({id:"lesson-miro-doc",kind:"documentRef",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Документ",parent_id:"lesson-miro-scene",x:6900,y:1280,w:440,h:90,z:11,title:"Конспект занятия",body:{documentId:"doc-lesson-workspace"},relations:[{type:"document_of",targetId:"doc-lesson-workspace"},{type:"contains",targetId:"lesson-miro-scene"}]})
]}

function initialState():LocalState{
 const objects:StudioObject[]=[
  obj({id:"frame-dev",kind:"frame",semantic_path:"Разработка",x:180,y:220,w:1100,h:820,z:1,title:"Разработка"}),
  obj({id:"frame-agent",kind:"frame",semantic_path:"Агент",x:1460,y:220,w:1180,h:820,z:1,title:"Агент"}),
  obj({id:"frame-tqs",kind:"frame",semantic_path:"TQS Intelligence",x:2820,y:220,w:1280,h:820,z:1,title:"TQS Intelligence"}),
  obj({id:"frame-trading",kind:"frame",semantic_path:"Трейдинг",x:4280,y:220,w:1180,h:820,z:1,title:"Трейдинг"}),
  obj({id:"frame-learning",kind:"frame",semantic_path:"Обучение",x:5640,y:180,w:3900,h:2920,z:1,title:"Обучение"}),
  obj({id:"frame-articles",kind:"frame",semantic_path:"Статьи",x:600,y:1800,w:1650,h:1000,z:1,title:"Статьи"}),
  obj({id:"frame-inbox",kind:"frame",semantic_path:"Inbox",x:2700,y:1780,w:1200,h:900,z:1,title:"Inbox"}),
  obj({id:"frame-kb",kind:"frame",semantic_path:"Обучение/База знаний",parent_id:"frame-learning",x:5820,y:2360,w:1680,h:560,z:2,title:"База знаний",relations:[{type:"contains",targetId:"frame-learning"}]}),
  obj({id:"course-crypto",kind:"frame",semantic_path:"Обучение/Крипта",parent_id:"frame-learning",x:7640,y:420,w:860,h:520,z:2,title:"Крипта",relations:[{type:"contains",targetId:"frame-learning"}]}),
  obj({id:"course-stocks",kind:"frame",semantic_path:"Обучение/Акции",parent_id:"frame-learning",x:7640,y:1020,w:860,h:520,z:2,title:"Акции",relations:[{type:"contains",targetId:"frame-learning"}]}),
  obj({id:"course-free",kind:"frame",semantic_path:"Обучение/Бесплатный курс",parent_id:"frame-learning",x:5820,y:400,w:1680,h:1860,z:2,title:"Бесплатный курс · российский рынок",relations:[{type:"contains",targetId:"frame-learning"}]}),
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
  obj({id:"article-si-frame",kind:"documentRef",semantic_path:"Статьи/Si — история ликвидности",parent_id:"frame-articles",x:820,y:2070,w:650,h:240,z:5,title:"Статья — Si: история ликвидности",body:{documentId:"doc-si"},relations:[{type:"document_of",targetId:"doc-si"},{type:"contains",targetId:"frame-articles"}]}),
  ...ownerSceneObjects()
 ];
 const documents:StudioDocument[]=[
  {id:"doc-lesson-workspace",world_key:"tqs-studio-world",slug:"zanyatie-1-rabochee-prostranstvo",kind:"lesson",title:"Занятие 1 — Настройка рабочего пространства",semantic_path:"Обучение/Бесплатный курс/Занятие 1",frame_id:"lesson-miro-scene",revision:1,status:"DRAFT",share_mode:"private",metadata:{demo:true,ownerScene:true}},
  {id:"doc-si",world_key:"tqs-studio-world",slug:"si-istoriya-likvidnosti",kind:"article",title:"Статья — Si: история ликвидности",semantic_path:"Статьи/Si — история ликвидности",frame_id:"article-si-frame",revision:1,status:"DRAFT",share_mode:"private",metadata:{drive_package_id:"1UJVJUBPt5pEHmjmb79Pllm-hyIij0DkD"}}
 ];
 const blocks:StudioDocumentBlock[]=[
  block({block_id:"lesson-h1",document_id:"doc-lesson-workspace",ordinal:1,block_type:"heading",content:{text:"Занятие 1 — Настройка рабочего пространства"}}),
  block({block_id:"lesson-t1",document_id:"doc-lesson-workspace",ordinal:2,block_type:"rich_text",content:{html:"<p>Конспект к занятию. Экран собирается так, чтобы график, стакан и лента отвечали на один вопрос: что делать с ценой. Этот текст можно править и переставлять.</p>"}}),
  block({block_id:"lesson-call",document_id:"doc-lesson-workspace",ordinal:3,block_type:"callout",content:{text:"Практика: оставьте на экране только то, что влияет на торговое решение."}}),
  block({block_id:"lesson-table",document_id:"doc-lesson-workspace",ordinal:4,block_type:"table",content:{columns:["Элемент","Зачем"],rows:[["График","Контекст цены"],["Стакан","Текущая ликвидность"],["Лента","Агрессор и темп"]]}}),
  block({block_id:"lesson-end",document_id:"doc-lesson-workspace",ordinal:5,block_type:"rich_text",content:{html:"<p>Дальше идёт место для картинки. Если сказать «блок 6, покажи, как должно выглядеть рабочее пространство», изображение ставится именно сюда.</p>"}}),
  block({block_id:"lesson-image",document_id:"doc-lesson-workspace",ordinal:6,block_type:"image",content:{title:"Рабочее пространство",caption:"Блок 6. Изображение рабочего пространства: график в центре, стакан и лента рядом."}}),
  block({block_id:"lesson-chart",document_id:"doc-lesson-workspace",ordinal:7,block_type:"interactive_chart",content:{title:"Si — живой график"},data_spec:liveSpec}),
  block({block_id:"lesson-video",document_id:"doc-lesson-workspace",ordinal:8,block_type:"video",content:{title:"Видео к занятию",url:""}}),
  block({block_id:"lesson-live",document_id:"doc-lesson-workspace",ordinal:9,block_type:"live_data",content:{title:"Si — объём текущей и прошлой сессии"},data_spec:liveSpec}),
  block({block_id:"lesson-replay",document_id:"doc-lesson-workspace",ordinal:10,block_type:"market_replay",content:{title:"Si — проигрывание сессии"},data_spec:replaySpec}),
  block({block_id:"lesson-sources",document_id:"doc-lesson-workspace",ordinal:11,block_type:"sources",content:{items:[{label:"Кадр занятия на доске",entityId:"lesson-miro-scene"},{label:"MOEX ISS",type:"market_data"}]}}),
  block({block_id:"lesson-pdf",document_id:"doc-lesson-workspace",ordinal:12,block_type:"rich_text",content:{html:"<p>Эту страницу можно отдать ссылкой или сохранить как PDF. Новые блоки добавляются плюсом между абзацами: текст, видео с YouTube, график.</p>"}}),
  block({block_id:"lesson-div",document_id:"doc-lesson-workspace",ordinal:13,block_type:"divider"}),
  block({block_id:"si-h1",document_id:"doc-si",ordinal:1,block_type:"heading",content:{text:"Si: история ликвидности и объёмов"}}),
  block({block_id:"si-t1",document_id:"doc-si",ordinal:2,block_type:"rich_text",content:{html:"<p>Линейный документ связан с World и использует стабильные блоки без x/y.</p>"}}),
  block({block_id:"si-live-volume",document_id:"doc-si",ordinal:3,block_type:"live_data",content:{title:"Si — объём текущей и прошлой торговой сессии"},data_spec:liveSpec}),
  block({block_id:"si-replay",document_id:"doc-si",ordinal:4,block_type:"market_replay",content:{title:"Si — день за 30 секунд"},data_spec:replaySpec})
 ];
 return {overview:{world:{world_key:"tqs-studio-world",revision:1,title:"TQS Studio World",metadata:{schema_version:"tqs-studio-world/v5-local-recovery"}},objects,activity:[]},documents,blocks,assets:{},documentRuns:[]};
}
function applyPortalStudio(s:LocalState){
 const created=causeMapObjects(s.overview.objects);
 const lesson=upgradeLessonShowcase(s.documents,s.blocks);
 if(!created.length&&!lesson.changed)return false;
 if(created.length){s.overview.objects.push(...created);s.overview.world.revision=Number(s.overview.world.revision||0)+1}
 if(lesson.changed){s.documents=lesson.documents;s.blocks=lesson.blocks}
 save(s);
 return true;
}
function load():LocalState{
 if(typeof window==="undefined")return initialState();
 try{
  const raw=localStorage.getItem(KEY);
  if(raw){const x=JSON.parse(raw) as LocalState;if(!Array.isArray(x.documentRuns))x.documentRuns=[];if(!Array.isArray(x.aiRuns))x.aiRuns=[];if(x.source==="canonical")return x;if(x?.overview?.objects?.some(o=>o.id==="lesson-free-1")&&x?.blocks?.some(b=>b.block_id==="lesson-replay")){let changed=false;const known=new Set(x.overview.objects.map(o=>o.id)),missing=ownerSceneObjects().filter(o=>!known.has(o.id));if(missing.length){x.overview.objects.push(...missing);x.overview.world.revision=Number(x.overview.world.revision||0)+1;changed=true}const lesson=x.documents?.find(d=>d.id==="doc-lesson-workspace");if(lesson&&lesson.frame_id!=="lesson-miro-scene"){lesson.frame_id="lesson-miro-scene";lesson.metadata={...(lesson.metadata||{}),ownerScene:true};changed=true}const sources=x.blocks?.find(b=>b.block_id==="lesson-sources");if(sources?.content?.items?.[0]?.entityId==="lesson-free-1"){sources.content.items[0].entityId="lesson-miro-scene";changed=true}if(changed)save(x);migrateWorkspaceCardLayout(x);applyPortalStudio(x);return x}}
 }catch{}
 const s=initialState();migrateWorkspaceCardLayout(s);applyPortalStudio(s);save(s);return s;
}
function save(s:LocalState){if(typeof window!=="undefined")localStorage.setItem(KEY,JSON.stringify(s))}
function activity(s:LocalState,entity_id:string|null,semantic_path:string,event_type:string,summary:string,payload:any={}){
 s.overview.activity.unshift({id:crypto.randomUUID(),entity_id,semantic_path,event_type,status:"NEW",summary,payload,occurred_at:now()});s.overview.activity=s.overview.activity.slice(0,200);
}
function provenanceContent(mutation:DocumentBlockMutation,actor:string,runId:string){
 if(mutation.operation!=="insert"&&mutation.operation!=="update")return mutation;
 const content={...(mutation.content||{}),provenance:{actor,runId,operation:mutation.operation,at:now()}};
 return {...mutation,content};
}
function documentBundle(s:LocalState,id:string):DocumentBundle{
 const d=s.documents.find(x=>x.id===id);if(!d)throw new Error("DOCUMENT_NOT_FOUND");
 return {document:clone(d),blocks:clone(s.blocks.filter(x=>x.document_id===id).sort((a,b)=>a.ordinal-b.ordinal))};
}
function bumpWorld(s:LocalState){s.overview.world.revision+=1}
export function readLocalStudio(){return clone(load())}
export function adoptSharedStudio(shared:{overview:WorldOverview;documents:StudioDocument[];blocks:StudioDocumentBlock[]}){
 const current=load();
 const next:LocalState={overview:clone(shared.overview),documents:clone(shared.documents),blocks:clone(shared.blocks),assets:current.assets,documentRuns:current.documentRuns||[],aiRuns:current.aiRuns||[],source:"canonical"};
 save(next);
 return clone(next);
}
export function resetLocalStudio(){const s=initialState();save(s);return clone(s)}
export function getLocalSeed(){return clone(initialState())}
export function getLocalAssetPayload(id:string){
 const s=load(),a=s.assets[id];if(!a)return null;
 return {assetId:a.id,dataUrl:a.dataUrl,filename:a.filename||("asset-"+a.id),mimeType:a.mime_type};
}
export function saveLocalObjectDraft(id:string,patch:Partial<StudioObject>){
 const s=load(),i=s.overview.objects.findIndex(o=>o.id===id);if(i<0)return false;
 s.overview.objects[i]={...s.overview.objects[i],...patch,updated_at:now()};save(s);return true;
}

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
 if(name==="updateObjects"){
  const patches=Array.isArray(p.patches)?p.patches:[] as Array<{id:string;patch:any;eventType?:string;summary?:string}>;
  const changed:StudioObject[]=[];
  for(const item of patches){
   const i=s.overview.objects.findIndex(o=>o.id===item.id);if(i<0)continue;
   const old=s.overview.objects[i];const o={...old,...(item.patch||{}),revision:old.revision+1,updated_at:now()};
   s.overview.objects[i]=o;changed.push(o);
   if(item.eventType)activity(s,o.id,o.semantic_path,item.eventType,item.summary||("Обновлён: "+o.title));
  }
  if(changed.length)bumpWorld(s);
  save(s);return {objects:clone(changed),worldRevision:s.overview.world.revision} as T;
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
 if(name==="restoreDocumentBlocks"){
  const d=s.documents.find(x=>x.id===p.documentId);if(!d)throw new Error("DOCUMENT_NOT_FOUND");
  const incoming=Array.isArray(p.blocks)?p.blocks:[];
  s.blocks=s.blocks.filter(x=>x.document_id!==p.documentId).concat(incoming.map((item:any)=>({...item,document_id:p.documentId})));
  d.revision+=1;save(s);return documentBundle(s,p.documentId) as T;
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
 if(name==="recordOperator"){activity(s,p.entityId||null,p.semanticPath||"",p.eventType||"ai_request",p.summary||"Запрос на доске",p.payload||{});save(s);return {ok:true} as T}
 if(name==="driveStatus")return {connection:{status:"OPTIONAL_AUTH_LATER",root_name:"TQS STUDIO — WORLD",last_sync_at:null},conflicts:[],oauthConfigured:false} as T;
 if(name==="getDocumentAuthoringContext"){
  const bundle=documentBundle(s,p.documentId);
  return documentAuthoringContext(bundle.document,bundle.blocks,{blockId:p.blockId,ordinal:p.ordinal,afterBlockId:p.afterBlockId,insert:p.insert,selection:p.selection}) as T;
 }
 if(name==="applyDocumentAuthoring"){
  const bundle=documentBundle(s,p.documentId);
  const runId=String(p.generationRunId||crypto.randomUUID());
  const before=clone(bundle.blocks);
  const mutations=(Array.isArray(p.mutations)?p.mutations:[]) as DocumentBlockMutation[];
  if(!mutations.length)throw new Error("AI_MUTATIONS_REQUIRED");
  const actor=String(p.actor||"chatgpt");
  const result=applyDocumentMutations(bundle.blocks,p.documentId,mutations.map(mutation=>provenanceContent(mutation,actor,runId)),()=>"block-"+crypto.randomUUID());
  s.blocks=s.blocks.filter(block=>block.document_id!==p.documentId).concat(result.blocks);
  const doc=s.documents.find(item=>item.id===p.documentId);if(doc)doc.revision+=1;
  s.documentRuns=[{runId,documentId:p.documentId,at:now(),actor,summary:String(p.summary||"Правка документа"),before},...(s.documentRuns||[])].slice(0,40);
  activity(s,p.documentId,doc?.semantic_path||"", "ai_document_authoring", String(p.summary||"AI изменил документ"),{actor,generation_run_id:runId,operation:"document_authoring",document_id:p.documentId,target:p.target||null,applied:result.applied,before_blocks:before});
  save(s);const fresh=documentBundle(s,p.documentId);return {generation_run_id:runId,document:fresh.document,blocks:fresh.blocks,applied:result.applied,canonical_readback:true} as T;
 }
 if(name==="getStudioContext")return buildStudioContext({overview:s.overview,documents:s.documents,blocks:s.blocks},p) as T;
 if(name==="aiApplyMutation"){
  const mutations=Array.isArray(p.mutations)?p.mutations:[];if(!mutations.length)throw new Error("AI_MUTATIONS_REQUIRED");
  const runId=String(p.generationRunId||crypto.randomUUID()),actor=String(p.actor||"cursor");
  const before=clone(s.overview.objects);
  const applied=applyWorldMutations(s.overview.objects,mutations,actor,runId);
  s.overview.objects=applied.objects;bumpWorld(s);
  const events=applied.changed.map(o=>activityForMutation(o.id,o.semantic_path,mutations.find((m:any)=>m.object?.id===o.id||m.id===o.id)?.summary||`AI: ${o.title}`,{actor,generation_run_id:runId,operation:mutations.find((m:any)=>m.object?.id===o.id)?"create":"update",source_object_ids:p.context?.objectIds||[],source_refs:p.sourceRefs||[]}));
  for(const evt of events)s.overview.activity.unshift(evt);
  s.overview.activity=s.overview.activity.slice(0,200);
  s.aiRuns=[{runId,at:now(),actor,summary:String(p.summary||"AI изменил доску"),before,mutations,applied:true},...(s.aiRuns||[])].slice(0,40);
  save(s);
  const readback=buildStudioContext({overview:s.overview,documents:s.documents,blocks:s.blocks},{...p.context,objectIds:applied.changed.map(o=>o.id),frameId:p.context?.frameId||applied.changed[0]?.parent_id||null});
  return {generation_run_id:runId,changed:applied.changed.map(o=>readback.entities.find(x=>x.object_id===o.id)||o),activity_ids:events.map(x=>x.id),world_revision:s.overview.world.revision,focus_target_id:applied.changed[0]?.id||null,canonical_readback:true,context:readback} as T;
 }
 if(name==="undoAiRun"||name==="redoAiRun"){
  const runId=String(p.generationRunId||"");const run=(s.aiRuns||[]).find(item=>item.runId===runId);if(!run)throw new Error("GENERATION_RUN_NOT_FOUND");
  const applied=run.applied!==false;if(name==="undoAiRun"&&!applied)throw new Error("ALREADY_UNDONE");if(name==="redoAiRun"&&applied)throw new Error("NOTHING_TO_REDO");
  const current=clone(s.overview.objects);s.overview.objects=clone(run.before);run.before=current;run.applied=name==="redoAiRun";
  bumpWorld(s);activity(s,null,"TQS Studio",name==="undoAiRun"?"ai_undo":"ai_redo",name==="undoAiRun"?"Отмена AI":"Повтор AI",{actor:String(p.actor||run.actor),generation_run_id:runId,operation:name==="undoAiRun"?"undo":"redo"});save(s);
  return {generation_run_id:runId,world_revision:s.overview.world.revision,canonical_readback:true,context:buildStudioContext({overview:s.overview,documents:s.documents,blocks:s.blocks},{objectIds:(p.context?.objectIds)||[]})} as T;
 }
 if(name==="getChangeHistory"){
  let rows=s.overview.activity;if(p.entityId)rows=rows.filter(x=>x.entity_id===p.entityId);if(p.generationRunId)rows=rows.filter(x=>x.payload?.generation_run_id===p.generationRunId);return clone(rows.slice(0,Math.min(Number(p.limit||50),200))) as T;
 }
 if(name==="undoDocumentAuthoring"){
  const runId=String(p.generationRunId||"");const run=(s.documentRuns||[]).find(item=>item.runId===runId);if(!run)throw new Error("GENERATION_RUN_NOT_FOUND");
  s.blocks=s.blocks.filter(block=>block.document_id!==run.documentId).concat(clone(run.before));
  const doc=s.documents.find(item=>item.id===run.documentId);if(doc)doc.revision+=1;
  activity(s,run.documentId,doc?.semantic_path||"","ai_undo","Отмена правки документа",{actor:String(p.actor||"chatgpt"),generation_run_id:runId,operation:"undo",document_id:run.documentId});
  save(s);return {generation_run_id:runId,...documentBundle(s,run.documentId),canonical_readback:true} as T;
 }
 throw new Error("LOCAL_ACTION_UNSUPPORTED:"+name);
}

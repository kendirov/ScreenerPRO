import assert from "node:assert/strict";
import {causeMapObjects,diagramComponent,layoutDiagram} from "../lib/studio-v6/diagram";
import {upgradeLessonShowcase} from "../lib/studio-v6/lesson-showcase";
import {pinnedHeaderTop,roomPortal} from "../lib/studio-v6/room-preview";
import {buildStudioContext} from "../lib/studio-v6/studio-context";
import type {StudioDocument,StudioDocumentBlock,StudioObject} from "../lib/studio-v5/types";

const top = pinnedHeaderTop({viewportY:-261,zoom:.66,absoluteY:400,roomHeight:2240,naturalTop:14});
assert.ok(top>14, "родительский заголовок должен опуститься ниже шапки");
const screen = -261+(400+top)*.66;
assert.ok(screen>=70&&screen<90, "заголовок курса остаётся под верхней панелью");

const course = {id:"course-free",kind:"frame",title:"Бесплатный курс · российский рынок",semantic_path:"Обучение/Бесплатный курс",parent_id:"frame-learning",x:5867,y:480,w:1680,h:2240,z:2,body:{},relations:[],status:null,hidden:false,revision:1,world_key:"tqs-studio-world"} satisfies StudioObject;
const lesson = {...course,id:"lesson-miro-scene",parent_id:"course-free",title:"ЗАНЯТИЕ 1 · РАБОЧЕЕ ПРОСТРАНСТВО",x:5967,y:640,w:1480,h:1120};
const task = {...course,id:"task",kind:"task",parent_id:"lesson-miro-scene",title:"Задача",x:6000,y:700,w:200,h:40,status:"NEW"};
const portal = roomPortal(course,1,[course,lesson,task,{...lesson,id:"lesson-free-2",y:2280,h:200,title:"Занятие 2"},{...lesson,id:"lesson-free-3",x:6700,y:2280,h:200,title:"Занятие 3"}]);
assert.equal(portal.kicker,"КУРС");
assert.equal(portal.name,"Бесплатный курс");
assert.equal(portal.descriptor,"Российский рынок");
assert.equal(portal.countLabel,"3 занятия");
assert.equal(portal.fresh,true);
assert.ok(portal.marks.length>=3);

const objects = causeMapObjects([course,lesson]);
assert.equal(objects.filter(object=>object.kind==="diagram").length,5);
assert.equal(objects.filter(object=>object.body?.label).length,5);
assert.deepEqual(causeMapObjects([...objects,course]),[]);
const moved = layoutDiagram(diagramComponent("cause-extra-screen",objects),"row");
assert.equal(moved.length,5);
const outsider = {...course,id:"other",kind:"diagram",x:10,y:10,w:40,h:40,title:"чужой"};
assert.equal(layoutDiagram([objects[0],outsider],"row").some(item=>item.id==="other"),true);
assert.equal(layoutDiagram(diagramComponent("cause-extra-screen",objects),"column").every(item=>item.x===moved[0].x||true),true);

const document = {id:"doc-lesson-workspace",world_key:"tqs-studio-world",slug:"lesson",kind:"lesson",title:"Занятие 1 — Рабочее пространство",semantic_path:"Обучение/Бесплатный курс/Занятие 1",frame_id:"lesson-miro-scene",revision:4,status:"DRAFT",share_mode:"private",metadata:{}} satisfies StudioDocument;
const blocks:StudioDocumentBlock[] = [
  {block_id:"lesson-h1",document_id:document.id,ordinal:1,block_type:"heading",content:{text:"Занятие 1 — Настройка рабочего пространства"},data_spec:null,asset_id:null,revision:1},
  {block_id:"lesson-t1",document_id:document.id,ordinal:2,block_type:"rich_text",content:{html:"<p>Конспект к занятию.</p>"},data_spec:null,asset_id:null,revision:1},
  {block_id:"lesson-call",document_id:document.id,ordinal:3,block_type:"callout",content:{text:"Практика: оставьте на экране только то, что влияет на торговое решение."},data_spec:null,asset_id:null,revision:1},
  {block_id:"lesson-table",document_id:document.id,ordinal:4,block_type:"interactive",content:{view:"timeline",columns:["Элемент","Зачем"],rows:[["График","Контекст цены"]],items:[{label:"Сейчас",text:""}]},data_spec:null,asset_id:null,revision:1},
  {block_id:"lesson-image",document_id:document.id,ordinal:5,block_type:"image",content:{title:"Рабочее пространство",caption:"Блок 6"},data_spec:null,asset_id:null,revision:1},
  {block_id:"lesson-chart",document_id:document.id,ordinal:6,block_type:"interactive",content:{title:"Si — живой график",view:"chart"},data_spec:null,asset_id:null,revision:1},
];
const upgraded = upgradeLessonShowcase([document],blocks);
assert.equal(upgraded.changed,true);
const text = upgraded.blocks.find(block=>block.block_id==="lesson-t1");
assert.equal(String(text?.content.html).includes("Конспект к занятию"),true);
assert.equal(upgraded.blocks.find(block=>block.block_id==="lesson-table")?.content.view,"table");
assert.ok(upgraded.blocks.some(block=>block.block_id==="lesson-steps"));
assert.equal(upgraded.blocks.find(block=>block.block_id==="lesson-reveal")?.content.view,"reveal");
assert.equal(upgradeLessonShowcase(upgraded.documents,upgraded.blocks).changed,false);

const context = buildStudioContext({
  overview:{world:{world_key:"tqs-studio-world",revision:1,title:"TQS Studio World",metadata:{}},objects:[course,...objects],activity:[]},
  documents:upgraded.documents,
  blocks:upgraded.blocks,
},{frameId:"course-free",documentId:"doc-lesson-workspace"});
assert.equal(context.portals[0]?.kicker,"КУРС");
assert.equal(context.diagram.nodes.length,5);
assert.equal(context.diagram.connectors.length,5);
assert.ok(context.document_sections.some(section=>section.block_id==="lesson-reveal"&&section.interactive));
assert.ok(context.interactive_blocks.includes("lesson-steps"));

console.log("portal studio ok");

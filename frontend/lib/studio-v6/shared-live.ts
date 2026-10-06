import type {StudioDocument,StudioDocumentBlock,StudioObject,WorldOverview} from "@/lib/studio-v5/types";
import {applyDocumentMutations,plainText,type DocumentBlockMutation} from "@/lib/studio-v6/document-model";
import {activityForMutation,applyWorldMutations,buildStudioContext} from "@/lib/studio-v6/studio-context";

export type SharedOperator={
  intent?:string;
  object_ids?:string[];
  frame_id?:string|null;
  frame_title?:string|null;
  semantic_path?:string;
  document_id?:string|null;
  at?:string;
};

export type SharedStudio={
  version:2;
  updatedAt:string;
  theme:"light"|"dark";
  activeDocumentId:string|null;
  overview:WorldOverview;
  documents:StudioDocument[];
  blocks:StudioDocumentBlock[];
  operator?:SharedOperator|null;
};

export function shouldAdoptRemote(input:{stamp:string;localRevision:number;remoteRevision:number;remoteUpdatedAt:string;pendingLocal?:boolean}){
  if(!input.remoteUpdatedAt)return false;
  if(input.pendingLocal)return false;
  // A browser that has not yet recorded the site copy must take it.
  // A newer server timestamp wins even when this browser's local revision is higher.
  if(!input.stamp)return true;
  return input.remoteUpdatedAt>input.stamp;
}

export function isSharedStudio(value:unknown):value is SharedStudio{
  if(!value||typeof value!=="object")return false;
  const row=value as SharedStudio;
  return row.version===2&&typeof row.updatedAt==="string"&&(row.theme==="light"||row.theme==="dark")&&!!row.overview&&Array.isArray(row.documents)&&Array.isArray(row.blocks);
}

function slim(value:unknown,depth=0):unknown{
  if(typeof value==="string"&&value.startsWith("data:audio")&&value.length<1500000)return value;
  if(typeof value==="string")return value.startsWith("data:")&&value.length>8000?"":value.length>12000?value.slice(0,12000):value;
  if(typeof value!=="object"||!value||depth>8)return value;
  if(Array.isArray(value))return value.slice(0,500).map(item=>slim(item,depth+1));
  const out:Record<string,unknown>={};
  for(const [key,item] of Object.entries(value))out[key]=slim(item,depth+1);
  return out;
}

export function makeSharedStudio(input:{theme:"light"|"dark";activeDocumentId:string|null;overview:WorldOverview;documents:StudioDocument[];blocks:StudioDocumentBlock[];operator?:SharedOperator|null},updatedAt=new Date().toISOString()):SharedStudio{
  return slim({
    version:2,
    updatedAt,
    theme:input.theme,
    activeDocumentId:input.activeDocumentId,
    overview:input.overview,
    documents:input.documents,
    blocks:input.blocks,
    operator:input.operator||null,
  }) as SharedStudio;
}

export function keepLocalFiles<T>(local:T,remote:T):T{
  return restoreFiles(local,remote) as T;
}

function restoreFiles(local:unknown,remote:unknown):unknown{
  if(typeof local==="string"&&local.startsWith("data:")&&(remote===""||remote==null))return local;
  if(typeof local!=="object"||!local||typeof remote!=="object"||!remote||Array.isArray(local)||Array.isArray(remote))return remote;
  const out:Record<string,unknown>={...(remote as Record<string,unknown>)};
  for(const [key,value] of Object.entries(local as Record<string,unknown>)){
    if(key in out)out[key]=restoreFiles(value,out[key]);
    else if(typeof value==="string"&&value.startsWith("data:"))out[key]=value;
  }
  return out;
}

function blockLine(block:StudioDocumentBlock){
  const content=block.content||{};
  const text=plainText(content.text||content.html||content.caption||content.title||content.url||"");
  const hidden=content.hidden?" скрыт":"";
  return `${block.ordinal}. ${block.block_type} \`${block.block_id}\`${hidden}${text?` — ${text}`:""}`;
}

function objectExcerpt(object:StudioObject){
  const body=object.body||{};
  const transcript=body.transcript?` · голос: ${plainText(String(body.transcript)).slice(0,240)}`:"";
  const scene=body.scene?.thesis?` · ${plainText(String(body.scene.thesis)).slice(0,180)}`:"";
  const text=plainText(String(body.html||body.title||body.caption||body.url||""));
  const diagram=object.kind==="diagram"?` · ${body.role||"step"}`:"";
  const link=body.label&&body.fromId?` · ${body.fromId} → ${body.toId} (${body.label})`:"";
  return `${text?` — ${text.slice(0,180)}`:""}${diagram}${link}${transcript}${scene}`;
}

function knowledgeLines(objects:StudioObject[]){
  const lines:string[]=[];
  for(const object of objects.filter(item=>!item.hidden&&(item.kind==="voice"||item.kind==="artifact"||item.kind==="deck"))){
    const body=object.body||{};
    if(object.kind==="voice"){
      lines.push(`- голос \`${object.id}\` · ${object.semantic_path} · ${body.duration||"—"} · ${plainText(String(body.transcript||body.title||object.title)).slice(0,400)}`);
    }else{
      const nodes=Array.isArray(body.scene?.nodes)?body.scene.nodes.map((node:any)=>node.title).filter(Boolean).slice(0,8).join(" → "):"";
      const slides=Array.isArray(body.slides)?`${body.slides.length} слайдов`:"";
      lines.push(`- ${object.kind} \`${object.id}\` · ${object.title} · ${object.semantic_path}${nodes?` · ${nodes}`:""}${slides?` · ${slides}`:""}`);
    }
  }
  return lines;
}

function boardLines(objects:StudioObject[]){
  const visible=objects.filter(object=>!object.hidden);
  const children=new Map<string,StudioObject[]>();
  for(const object of visible){
    const key=object.parent_id||"";
    const list=children.get(key)||[];
    list.push(object);
    children.set(key,list);
  }
  const lines:string[]=[];
  const walk=(parent:string,depth:number)=>{
    const list=(children.get(parent)||[]).slice().sort((a,b)=>a.y-b.y||a.x-b.x);
    for(const object of list){
      lines.push(`${"  ".repeat(depth)}- ${object.title} \`${object.id}\` ${object.kind}${objectExcerpt(object)}`);
      if(lines.length>=160)return;
      walk(object.id,depth+1);
      if(lines.length>=160)return;
    }
  };
  walk("",0);
  return lines;
}

export function sharedToMarkdown(state:SharedStudio){
  const documents=state.documents.map(document=>{
    const blocks=state.blocks.filter(block=>block.document_id===document.id).sort((a,b)=>a.ordinal-b.ordinal);
    return `### ${document.title}\n\nid: \`${document.id}\`\nпуть: ${document.semantic_path}\nстатус: ${document.status}\n\n${blocks.map(blockLine).join("\n")}`;
  });
  const operator=state.operator;
  return [
    "# TQS Studio — живое состояние",
    "",
    `Обновлено: ${state.updatedAt}`,
    `Тема: ${state.theme==="dark"?"тёмная":"светлая"}`,
    state.activeDocumentId?`Открыт документ: \`${state.activeDocumentId}\``:"",
    operator?.frame_title?`Выделение: ${operator.frame_title}${operator.semantic_path?` · ${operator.semantic_path}`:""}`:"",
    "",
    "## Доска",
    "",
    boardLines(state.overview.objects||[]).join("\n")||"—",
    "",
    "## Знание в этой доске",
    "",
    knowledgeLines(state.overview.objects||[]).join("\n")||"—",
    "",
    "## Документы",
    "",
    documents.join("\n\n")||"—",
    "",
    "## Как создать или изменить",
    "",
    "Читать: GET https://tqs-studio.vercel.app/api/studio/live?format=md",
    "Писать: POST https://tqs-studio.vercel.app/api/studio/live",
    "Документ: {\"action\":\"applyDocumentAuthoring\",\"documentId\":\"...\",\"actor\":\"chatgpt\",\"mutations\":[{\"operation\":\"insert\",\"blockType\":\"rich_text\",\"content\":{\"html\":\"<p>Текст</p>\"},\"target\":{\"ordinal\":4,\"insert\":\"after\"}}]}",
    "Новый документ: {\"action\":\"createDocument\",\"title\":\"Название\",\"semanticPath\":\"Обучение\"}",
    "Объект на доске: {\"action\":\"createWorldObject\",\"object\":{\"id\":\"...\",\"kind\":\"text\",\"title\":\"...\",\"semantic_path\":\"...\",\"parent_id\":null,\"x\":0,\"y\":0,\"w\":300,\"h\":120,\"z\":10,\"body\":{\"html\":\"<p>Текст</p>\"},\"relations\":[],\"hidden\":false}}",
    "Передвинуть или поправить: {\"action\":\"updateObject\",\"id\":\"...\",\"patch\":{\"x\":0,\"y\":0,\"title\":\"...\"}}",
  ].filter(line=>line!==undefined).join("\n");
}

function withProvenance(mutation:DocumentBlockMutation,actor:string,runId:string):DocumentBlockMutation{
  if(mutation.operation!=="insert"&&mutation.operation!=="update")return mutation;
  return {...mutation,content:{...(mutation.content||{}),provenance:{actor,runId,operation:mutation.operation,at:new Date().toISOString()}}};
}

export function applySharedAction(state:SharedStudio,body:any){
  const action=String(body?.action||"");
  const next=makeSharedStudio(state,new Date().toISOString());
  if(action==="applyDocumentAuthoring"){
    const documentId=String(body.documentId||"");
    const document=next.documents.find(item=>item.id===documentId);
    if(!document)throw new Error("DOCUMENT_NOT_FOUND");
    const mutations=(Array.isArray(body.mutations)?body.mutations:[]) as DocumentBlockMutation[];
    if(!mutations.length)throw new Error("AI_MUTATIONS_REQUIRED");
    const runId=String(body.generationRunId||crypto.randomUUID());
    const actor=String(body.actor||"chatgpt");
    const current=next.blocks.filter(block=>block.document_id===documentId);
    const result=applyDocumentMutations(current,documentId,mutations.map(mutation=>withProvenance(mutation,actor,runId)),()=>"block-"+crypto.randomUUID());
    next.blocks=next.blocks.filter(block=>block.document_id!==documentId).concat(result.blocks);
    document.revision+=1;
    return {state:next,runId,applied:result.applied};
  }
  if(action==="createDocument"){
    const id=String(body.id||("doc-"+crypto.randomUUID()));
    const title=String(body.title||"Новый документ");
    const document:StudioDocument={id,world_key:"tqs-studio-world",slug:title.toLowerCase().replace(/[^a-z0-9а-яё]+/gi,"-").replace(/^-|-$/g,""),kind:body.kind||"instruction",title,semantic_path:body.semanticPath||"Документы",frame_id:body.frameId||null,revision:1,status:"DRAFT",share_mode:"private",metadata:{created_by:String(body.actor||"chatgpt")}};
    next.documents.push(document);
    next.blocks.push(
      {block_id:"h-"+crypto.randomUUID(),document_id:id,ordinal:1,block_type:"heading",content:{text:title},data_spec:null,asset_id:null,revision:1},
      {block_id:"t-"+crypto.randomUUID(),document_id:id,ordinal:2,block_type:"rich_text",content:{html:"<p>Новый документ</p>"},data_spec:null,asset_id:null,revision:1},
    );
    next.activeDocumentId=id;
    return {state:next,documentId:id};
  }
  if(action==="createWorldObject"){
    const object=body.object as StudioObject;
    if(!object?.id||!object.kind)throw new Error("OBJECT_REQUIRED");
    next.overview.objects=next.overview.objects.filter(item=>item.id!==object.id);
    next.overview.objects.push(object);
    next.overview.world.revision=Number(next.overview.world.revision||0)+1;
    if(object.kind==="voice"||object.kind==="artifact"||object.kind==="deck"){
      next.overview.activity=next.overview.activity||[];
      next.overview.activity.unshift(activityForMutation(object.id,object.semantic_path,String(body.summary||object.title),{actor:String(body.actor||"owner"),operation:"create",kind:object.kind}));
      next.overview.activity=next.overview.activity.slice(0,200);
    }
    return {state:next,objectId:object.id};
  }
  if(action==="updateObject"){
    const index=next.overview.objects.findIndex(item=>item.id===body.id);
    if(index<0)throw new Error("OBJECT_NOT_FOUND");
    const previous=next.overview.objects[index];
    const updated={...previous,...(body.patch||{}),updated_at:new Date().toISOString(),revision:Number(previous.revision||0)+1};
    if(body.patch?.body)updated.body={...previous.body,...body.patch.body};
    next.overview.objects[index]=updated;
    next.overview.world.revision=Number(next.overview.world.revision||0)+1;
    if(body.summary){
      next.overview.activity=next.overview.activity||[];
      next.overview.activity.unshift(activityForMutation(updated.id,updated.semantic_path,String(body.summary),{actor:String(body.actor||"owner"),operation:"update",node_id:body.nodeId||null}));
      next.overview.activity=next.overview.activity.slice(0,200);
    }
    return {state:next,objectId:body.id,object:updated};
  }
  if(action==="updateArtifactNode"){
    const index=next.overview.objects.findIndex(item=>item.id===body.id);
    if(index<0)throw new Error("OBJECT_NOT_FOUND");
    const previous=next.overview.objects[index];
    const scene=previous.body?.scene;
    const nodes=Array.isArray(scene?.nodes)?scene.nodes.map((node:any)=>({...node})):[];
    const nodeIndex=nodes.findIndex((node:any)=>node.id===body.nodeId);
    if(nodeIndex<0)throw new Error("NODE_NOT_FOUND");
    const before={...nodes[nodeIndex]};
    nodes[nodeIndex]={...nodes[nodeIndex],...(body.patch||{})};
    const updated={...previous,body:{...previous.body,scene:{...scene,nodes},selectedNodeId:body.nodeId},updated_at:new Date().toISOString(),revision:Number(previous.revision||0)+1};
    next.overview.objects[index]=updated;
    next.overview.world.revision=Number(next.overview.world.revision||0)+1;
    next.overview.activity=next.overview.activity||[];
    next.overview.activity.unshift(activityForMutation(updated.id,updated.semantic_path,String(body.summary||`Этап «${nodes[nodeIndex].title}» изменён`),{actor:String(body.actor||"chatgpt"),operation:"update",node_id:body.nodeId,before,after:nodes[nodeIndex]}));
    next.overview.activity=next.overview.activity.slice(0,200);
    return {state:next,objectId:body.id,nodeId:body.nodeId,node:nodes[nodeIndex],unchanged:nodes.filter((node:any)=>node.id!==body.nodeId).map((node:any)=>({id:node.id,title:node.title,text:node.text}))};
  }
  if(action==="getStudioContext"){
    return {state,context:buildStudioContext({overview:next.overview,documents:next.documents,blocks:next.blocks},body)};
  }
  if(action==="aiApplyMutation"){
    const mutations=Array.isArray(body.mutations)?body.mutations:[];
    if(!mutations.length)throw new Error("AI_MUTATIONS_REQUIRED");
    const runId=String(body.generationRunId||crypto.randomUUID()),actor=String(body.actor||"chatgpt");
    const applied=applyWorldMutations(next.overview.objects,mutations,actor,runId);
    next.overview.objects=applied.objects;
    next.overview.world.revision=Number(next.overview.world.revision||0)+1;
    next.overview.activity=next.overview.activity||[];
    for(const object of applied.changed){
      next.overview.activity.unshift(activityForMutation(object.id,object.semantic_path,String(body.summary||`AI: ${object.title}`),{actor,generation_run_id:runId,operation:mutations.some((item:any)=>item.object?.id===object.id)?"create":"update",source_object_ids:body.context?.objectIds||[],source_refs:body.sourceRefs||[]}));
    }
    next.overview.activity=next.overview.activity.slice(0,200);
    const context=buildStudioContext({overview:next.overview,documents:next.documents,blocks:next.blocks},{...(body.context||{}),objectIds:applied.changed.map((object:StudioObject)=>object.id)});
    return {state:next,runId,focus_target_id:applied.changed[0]?.id||null,canonical_readback:true,context};
  }
  throw new Error("SHARED_ACTION_UNSUPPORTED");
}

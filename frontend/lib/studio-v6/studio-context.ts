import type {StudioActivity,StudioDocument,StudioDocumentBlock,StudioObject,WorldOverview} from "@/lib/studio-v5/types";
import {roomPortal} from "@/lib/studio-v6/room-preview";
import {diagramRole} from "@/lib/studio-v6/diagram";

export type StudioContextInput={
  objectIds?:string[];
  blockIds?:string[];
  frameId?:string|null;
  documentId?:string|null;
  selectionBounds?:{x:number;y:number;w?:number;h?:number;right?:number;bottom?:number}|null;
  pointer?:{x:number;y:number}|null;
  viewport?:{x:number;y:number;zoom:number;width?:number;height?:number}|null;
};

type WorldState={
  overview:WorldOverview;
  documents:StudioDocument[];
  blocks?:StudioDocumentBlock[];
};

function boundsOf(items:StudioObject[]){
  if(!items.length)return null;
  const x=Math.min(...items.map(o=>o.x)),y=Math.min(...items.map(o=>o.y));
  const right=Math.max(...items.map(o=>o.x+o.w)),bottom=Math.max(...items.map(o=>o.y+o.h));
  return {x,y,w:right-x,h:bottom-y,right,bottom};
}

export function canonicalObject(o:StudioObject,all:StudioObject[],documents:StudioDocument[]){
  const children=all.filter(x=>x.parent_id===o.id&&!x.hidden).map(x=>x.id);
  const linked=documents.find(d=>d.frame_id===o.id)?.id||o.body?.documentId||o.relations?.find((r:any)=>r.type==="document_of")?.targetId||null;
  return {
    stable_id:o.id,
    object_id:o.id,
    kind:o.kind,
    title:o.title,
    semantic_path:o.semantic_path,
    parent_id:o.parent_id,
    parent_room:o.parent_id,
    x:o.x,y:o.y,w:o.w,h:o.h,
    bounds:{x:o.x,y:o.y,w:o.w,h:o.h},
    children_ids:children,
    linked_document_id:linked,
    status:o.status,
    content:o.body||{},
    source_refs:o.relations||[],
    relations:o.relations||[],
    annotations:all.filter(x=>!x.hidden&&x.kind==="annotation"&&(x.body?.annotates===o.id||x.relations?.some((r:any)=>r.type==="annotates"&&r.targetId===o.id))).map(x=>x.id),
    annotation_marks:all.filter(x=>!x.hidden&&x.kind==="annotation"&&(x.body?.annotates===o.id||x.relations?.some((r:any)=>r.type==="annotates"&&r.targetId===o.id))).map(x=>({id:x.id,kind:x.body?.annotationKind||"pen",points:x.body?.points||[],style:x.body?.style||null,bounds:{x:x.x,y:x.y,w:x.w,h:x.h},semantic_path:x.semantic_path,target_id:x.body?.annotates||o.id})),
    created_at:o.created_at||null,
    updated_at:o.updated_at||null,
    created_by:o.body?.provenance?.created_by||o.body?.created_by||null,
    updated_by:o.body?.provenance?.updated_by||o.body?.updated_by||null,
    generation_run_id:o.body?.provenance?.generation_run_id||null,
    hidden:o.hidden,
    revision:o.revision,
    portal:o.kind==="frame"?roomPortal(o,(()=>{let depth=0,parent=o.parent_id,guard=0;while(parent&&guard++<20){depth+=1;parent=all.find(item=>item.id===parent)?.parent_id||null}return depth})(),all):null,
    diagram_role:o.kind==="diagram"?diagramRole(o.body?.role):null,
    connector:o.kind==="annotation"&&o.body?.fromId?{from_id:o.body.fromId,to_id:o.body.toId||null,label:o.body.label||null,relation:(o.relations||[]).some((relation:any)=>relation.type==="leads_to")?"leads_to":null}:null,
  };
}

export function buildStudioContext(state:WorldState,input:StudioContextInput={}){
  const objects=state.overview.objects||[];
  const documents=state.documents||[];
  const objectIds=(input.objectIds||[]).filter(Boolean);
  const selected=objects.filter(o=>objectIds.includes(o.id));
  let frameId=input.frameId||null;
  if(!frameId&&selected.length===1&&selected[0].kind==="frame")frameId=selected[0].id;
  if(!frameId&&selected.length){
    const parents=[...new Set(selected.map(o=>o.parent_id).filter(Boolean))];
    if(parents.length===1)frameId=String(parents[0]);
  }
  if(!frameId&&input.pointer){
    const hit=objects.filter(o=>o.kind==="frame"&&!o.hidden&&input.pointer!.x>=o.x&&input.pointer!.x<=o.x+o.w&&input.pointer!.y>=o.y&&input.pointer!.y<=o.y+o.h).sort((a,b)=>a.w*a.h-b.w*b.h)[0];
    frameId=hit?.id||null;
  }
  const frame=frameId?objects.find(o=>o.id===frameId)||null:null;
  const anchor=input.pointer||(selected[0]?{x:selected[0].x+selected[0].w/2,y:selected[0].y+selected[0].h/2}:frame?{x:frame.x+frame.w/2,y:frame.y+frame.h/2}:null);
  const nearby=anchor?objects.filter(o=>!o.hidden&&Math.hypot((o.x+o.w/2)-anchor.x,(o.y+o.h/2)-anchor.y)<900).slice(0,24).map(o=>canonicalObject(o,objects,documents)):[];
  const prefix=frame?.semantic_path||selected[0]?.semantic_path||"";
  const activity=(state.overview.activity||[]).filter(a=>!prefix||String(a.semantic_path||"").startsWith(prefix)).slice(0,40);
  const unresolved=objects.filter(o=>!o.hidden&&(o.kind==="task"||o.kind==="voice"||o.kind==="text")&&(o.status==="NEW"||o.status==="WAITING_RECORDING")&&(!prefix||o.semantic_path.startsWith(prefix))).map(o=>o.id);
  const linked=input.documentId?documents.filter(d=>d.id===input.documentId):frameId?documents.filter(d=>d.frame_id===frameId):[];
  const blocks=state.blocks||[];
  const linkedIds=new Set(input.documentId?[input.documentId]:linked.map(document=>document.id));
  const documentBlocks=blocks.filter(block=>linkedIds.has(block.document_id)&&!block.content?.hidden).sort((a,b)=>a.ordinal-b.ordinal);
  const diagramNodes=objects.filter(object=>!object.hidden&&object.kind==="diagram").map(object=>canonicalObject(object,objects,documents));
  const connectors=objects.filter(object=>!object.hidden&&object.kind==="annotation"&&object.body?.fromId&&object.body?.toId).map(object=>({id:object.id,from_id:object.body.fromId,to_id:object.body.toId,label:object.body.label||null,relation:(object.relations||[]).some((relation:any)=>relation.type==="leads_to")?"leads_to":"connects"}));
  return {
    context_version:"tqs-studio-context/v1",
    world_id:state.overview.world?.world_key||"tqs-studio-world",
    world:state.overview.world,
    selection:{object_ids:objectIds,block_ids:input.blockIds||[],bounds:input.selectionBounds||boundsOf(selected)},
    pointer:input.pointer||null,
    viewport:input.viewport||null,
    current_semantic_entity:frame?canonicalObject(frame,objects,documents):null,
    entities:selected.map(o=>canonicalObject(o,objects,documents)),
    frame:frame?canonicalObject(frame,objects,documents):null,
    nearby,
    linked_documents:linked,
    recent_activity:activity,
    unresolved_ids:unresolved,
    selected_nodes:selected.filter(o=>o.body?.selectedNodeId).map(o=>({object_id:o.id,node_id:String(o.body.selectedNodeId),title:o.body?.scene?.nodes?.find((node:any)=>node.id===o.body.selectedNodeId)?.title||null})),
    voice_notes:objects.filter(o=>!o.hidden&&o.kind==="voice"&&(!prefix||o.semantic_path.startsWith(prefix))).map(o=>({id:o.id,semantic_path:o.semantic_path,title:o.title,duration:o.body?.duration||null,transcript:o.body?.transcript||"",updated_at:o.updated_at||null})),
    portals:(frame?[frame]:objects.filter(object=>object.kind==="frame"&&!object.hidden)).slice(0,12).map(object=>canonicalObject(object,objects,documents).portal),
    diagram:{nodes:diagramNodes,connectors},
    document_sections:documentBlocks.map(block=>({document_id:block.document_id,block_id:block.block_id,ordinal:block.ordinal,block_type:block.block_type,layout:block.content?.layout||"reading",section_id:block.content?.sectionId||null,view:block.content?.view||null,interactive:Boolean(block.content?.view==="reveal"||block.block_type==="steps"||block.block_type==="interactive"||block.content?.hotspots)})),
    interactive_blocks:documentBlocks.filter(block=>block.block_type==="interactive"||block.block_type==="steps"||block.content?.view==="reveal"||block.content?.hotspots).map(block=>block.block_id),
  };
}

function stamp(body:any,actor:string,runId:string,operation:string){
  return {...(body||{}),provenance:{...(body?.provenance||{}),[operation==="create"?"created_by":"updated_by"]:actor,generation_run_id:runId,operation,at:new Date().toISOString()}};
}

export function applyWorldMutations(objects:StudioObject[],mutations:any[],actor:string,runId:string){
  const next=objects.map(o=>({...o}));
  const changed:StudioObject[]=[];
  for(const mutation of mutations){
    if(mutation?.operation==="create"&&mutation.object?.id&&mutation.object?.kind){
      const raw=mutation.object as StudioObject;
      const row:StudioObject={
        ...raw,
        world_key:raw.world_key||"tqs-studio-world",
        parent_id:raw.parent_id??null,
        relations:raw.relations||[],
        status:raw.status??(raw.kind==="task"?"NEW":null),
        hidden:false,
        revision:1,
        created_at:raw.created_at||new Date().toISOString(),
        updated_at:new Date().toISOString(),
        body:stamp(raw.body,actor,runId,"create"),
      };
      const index=next.findIndex(o=>o.id===row.id);
      if(index>=0)next[index]=row;else next.push(row);
      changed.push(row);
      continue;
    }
    if(mutation?.operation==="update"&&mutation.id){
      const index=next.findIndex(o=>o.id===mutation.id);
      if(index<0)throw new Error("OBJECT_NOT_FOUND");
      const old=next[index];
      const row:StudioObject={...old,...(mutation.patch||{}),body:stamp({...old.body,...(mutation.patch?.body||{})},actor,runId,"update"),revision:(old.revision||0)+1,updated_at:new Date().toISOString()};
      next[index]=row;
      changed.push(row);
    }
  }
  return {objects:next,changed};
}

export function activityForMutation(entityId:string|null,semanticPath:string,summary:string,payload:any):StudioActivity{
  return {id:crypto.randomUUID(),entity_id:entityId,semantic_path:semanticPath,event_type:payload.operation==="create"?"ai_create":"ai_update",status:"NEW",summary,payload,occurred_at:new Date().toISOString()};
}

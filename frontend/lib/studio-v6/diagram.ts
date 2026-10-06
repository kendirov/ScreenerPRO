import type {StudioObject} from "@/lib/studio-v5/types";

export const DIAGRAM_ROLES=["step","decision","evidence","risk","outcome","note"] as const;
export type DiagramRole=typeof DIAGRAM_ROLES[number];
export type DiagramLayout="row"|"column"|"align"|"distribute"|"tidy";

const ROLE_LABEL:Record<DiagramRole,string>={step:"Шаг",decision:"Решение",evidence:"Факт",risk:"Риск",outcome:"Итог",note:"Заметка"};

export function diagramRole(value:unknown):DiagramRole{
  return DIAGRAM_ROLES.includes(value as DiagramRole)?value as DiagramRole:"step";
}

export function nextDiagramRole(value:unknown):DiagramRole{
  const role=diagramRole(value);
  return DIAGRAM_ROLES[(DIAGRAM_ROLES.indexOf(role)+1)%DIAGRAM_ROLES.length];
}

export function diagramRoleLabel(value:unknown){return ROLE_LABEL[diagramRole(value)]}

export function diagramComponent(id:string,objects:StudioObject[]){
  const nodes=new Map(objects.filter(object=>!object.hidden&&object.kind==="diagram").map(object=>[object.id,object]));
  const links=objects.filter(object=>!object.hidden&&object.kind==="annotation"&&object.body?.fromId&&object.body?.toId);
  const seen=new Set<string>();
  const stack=[id];
  while(stack.length){
    const current=stack.pop()!;
    if(seen.has(current)||!nodes.has(current))continue;
    seen.add(current);
    for(const link of links){
      if(link.body.fromId===current)stack.push(String(link.body.toId));
      if(link.body.toId===current)stack.push(String(link.body.fromId));
    }
  }
  return [...seen].map(item=>nodes.get(item)!).filter(Boolean);
}

export function layoutDiagram(nodes:StudioObject[],mode:DiagramLayout){
  if(nodes.length<2)return [] as Array<{id:string;x:number;y:number}>;
  const ordered=[...nodes].sort((a,b)=>a.x-b.x||a.y-b.y);
  const gap=36;
  const minX=Math.min(...ordered.map(node=>node.x));
  const minY=Math.min(...ordered.map(node=>node.y));
  if(mode==="align")return ordered.map(node=>({id:node.id,x:minX,y:node.y}));
  if(mode==="distribute"){
    const span=Math.max(...ordered.map(node=>node.x))-minX;
    const step=ordered.length>1?span/(ordered.length-1):0;
    return ordered.map((node,index)=>({id:node.id,x:Math.round(minX+step*index),y:node.y}));
  }
  const vertical=mode==="column"||(mode==="tidy"&&bbox(ordered).h>bbox(ordered).w);
  if(vertical){
    let y=minY;
    return [...ordered].sort((a,b)=>a.y-b.y||a.x-b.x).map(node=>{const next={id:node.id,x:minX,y};y+=node.h+gap;return next});
  }
  let x=minX;
  return ordered.map(node=>{const next={id:node.id,x,y:minY};x+=node.w+gap;return next});
}

function bbox(nodes:StudioObject[]){
  const x=Math.min(...nodes.map(node=>node.x)),y=Math.min(...nodes.map(node=>node.y));
  const right=Math.max(...nodes.map(node=>node.x+node.w)),bottom=Math.max(...nodes.map(node=>node.y+node.h));
  return{w:right-x,h:bottom-y};
}

function node(id:string,role:DiagramRole,title:string,x:number,y:number,parent:StudioObject):StudioObject{
  return{
    id,world_key:"tqs-studio-world",kind:"diagram",semantic_path:parent.semantic_path+"/"+title,parent_id:parent.id,
    x,y,w:210,h:78,z:16,title,body:{role},relations:[{type:"contains",targetId:parent.id}],status:null,hidden:false,revision:1,
  };
}

function link(id:string,from:string,to:string,label:string,parent:StudioObject):StudioObject{
  return{
    id,world_key:"tqs-studio-world",kind:"annotation",semantic_path:parent.semantic_path+"/"+label,parent_id:parent.id,
    x:parent.x,y:parent.y,w:24,h:24,z:17,title:label,
    body:{annotationKind:"arrow",fromId:from,toId:to,label},
    relations:[{type:"contains",targetId:parent.id},{type:"leads_to",targetId:to,fromId:from,label},{type:"connects_from",targetId:from},{type:"connects_to",targetId:to}],
    status:null,hidden:false,revision:1,
  };
}

export function causeMapObjects(objects:StudioObject[]){
  if(objects.some(object=>object.id==="cause-extra-screen"))return [];
  const course=objects.find(object=>object.id==="course-free"&&!object.hidden);
  if(!course)return [];
  const lesson=objects.find(object=>object.id==="lesson-miro-scene");
  const y=Math.round((lesson?lesson.y+lesson.h:course.y+course.h*.62)+64);
  const width=210*5+28*4;
  let x=Math.round(course.x+Math.max(48,(course.w-width)/2));
  const ids=["cause-extra-screen","cause-decision","cause-book","cause-risk","cause-outcome"] as const;
  const roles:DiagramRole[]=["step","decision","evidence","risk","outcome"];
  const titles=["Лишний экран","Влияет на сделку?","Стакан у цены","Решение распадается","Один экран"];
  const nodes=ids.map((id,index)=>node(id,roles[index],titles[index],x+index*(210+28),y,course));
  return [
    ...nodes,
    link("cause-link-1","cause-extra-screen","cause-decision","если мешает",course),
    link("cause-link-2","cause-decision","cause-book","да",course),
    link("cause-link-3","cause-decision","cause-risk","нет",course),
    link("cause-link-4","cause-book","cause-outcome","оставить",course),
    link("cause-link-5","cause-risk","cause-outcome","убрать",course),
  ];
}

import type {StudioObject} from "@/lib/studio-v5/types";
import {roomRole} from "@/lib/studio-v6/workstation";

export type RoomRole="project"|"course"|"lesson"|"topic";
export type PreviewMark={id:string;kind:string;x:number;y:number;w:number;h:number};

const KICKER:Record<RoomRole,string>={project:"ПРОЕКТ",course:"КУРС",lesson:"ЗАНЯТИЕ",topic:"ТЕМА"};

export function pinnedHeaderTop(input:{viewportY:number;zoom:number;absoluteY:number;roomHeight:number;naturalTop?:number}){
  const zoom=Math.max(input.zoom,.05);
  const natural=input.naturalTop??14;
  const needed=(72-input.viewportY)/zoom-input.absoluteY;
  return Math.min(Math.max(natural,needed),Math.max(natural,input.roomHeight-44));
}

export function pinnedHeaderLeft(input:{viewportX:number;zoom:number;absoluteX:number;roomWidth:number;naturalLeft?:number;screenInset?:number}){
  const zoom=Math.max(input.zoom,.05);
  const natural=input.naturalLeft??14;
  const needed=((input.screenInset??78)-input.viewportX)/zoom-input.absoluteX;
  return Math.min(Math.max(natural,needed),Math.max(natural,input.roomWidth-220));
}

function splitTitle(title:string){
  const clean=title.replace(/\s+/g," ").trim();
  const parts=clean.split("·").map(part=>part.trim()).filter(Boolean);
  if(/^занятие\s*1/i.test(parts[0]||"")&&parts[1])return{name:"Занятие 1",descriptor:sentence(parts.slice(1).join(" · "))};
  if(parts.length>1)return{name:parts[0],descriptor:sentence(parts.slice(1).join(" · "))};
  return{name:clean,descriptor:""};
}

function sentence(value:string){
  if(!value)return"";
  return value.charAt(0).toUpperCase()+value.slice(1);
}

function plural(count:number,one:string,few:string,many:string){
  const mod10=count%10,mod100=count%100;
  if(mod100>=11&&mod100<=14)return many;
  if(mod10===1)return one;
  if(mod10>=2&&mod10<=4)return few;
  return many;
}

function descendants(id:string,objects:StudioObject[]){
  const out:StudioObject[]=[];
  const walk=(parent:string)=>{
    for(const object of objects){
      if(object.hidden||object.parent_id!==parent)continue;
      out.push(object);
      walk(object.id);
    }
  };
  walk(id);
  return out;
}

function previewKind(object:StudioObject){
  if(object.kind==="chart"||object.kind==="live_data")return"chart";
  if(object.kind==="image"||object.kind==="video")return"image";
  if(object.kind==="diagram")return"diagram";
  if(object.kind==="task")return"task";
  if(object.kind==="voice")return"voice";
  if(object.kind==="frame")return"frame";
  return"text";
}

export function roomPreviewMarks(frame:StudioObject,objects:StudioObject[],limit=8):PreviewMark[]{
  const spanX=Math.max(1,frame.w),spanY=Math.max(1,frame.h);
  const place=(object:StudioObject):PreviewMark=>({
    id:object.id,
    kind:previewKind(object),
    x:(object.x-frame.x)/spanX,
    y:(object.y-frame.y)/spanY,
    w:Math.max(.035,Math.min(1,object.w/spanX)),
    h:Math.max(.04,Math.min(1,object.h/spanY)),
  });
  const rooms=objects.filter(object=>!object.hidden&&object.parent_id===frame.id&&object.kind==="frame").slice(0,6).map(place);
  const content=descendants(frame.id,objects).filter(object=>object.kind!=="frame"&&object.kind!=="annotation").slice(0,limit).map(place);
  return rooms.length||content.length?[...rooms,...content]:[place(frame)];
}

export function roomPortal(frame:StudioObject,depth:number,objects:StudioObject[]){
  const role=roomRole(depth) as RoomRole;
  const {name,descriptor}=splitTitle(frame.id==="frame-learning"?"Обучение":frame.title);
  const children=objects.filter(object=>!object.hidden&&object.parent_id===frame.id);
  const rooms=children.filter(object=>object.kind==="frame");
  const next=roomRole(depth+1);
  const count=rooms.length;
  const countLabel=!count?"":next==="course"?`${count} ${plural(count,"курс","курса","курсов")}`:next==="lesson"?`${count} ${plural(count,"занятие","занятия","занятий")}`:`${count} ${plural(count,"тема","темы","тем")}`;
  const fresh=descendants(frame.id,objects).some(object=>object.status==="NEW"||object.status==="WAITING_RECORDING");
  const contentTop=rooms.length?Math.min(...rooms.map(object=>object.y-frame.y)):frame.h;
  return{
    role,
    kicker:KICKER[role],
    name,
    descriptor,
    countLabel,
    fresh,
    contentTop,
    marks:roomPreviewMarks(frame,objects),
  };
}

"use client";

import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from "react";
import {
 Background,BackgroundVariant,ConnectionLineType,Handle,MiniMap,NodeResizer,Position,ReactFlow,ReactFlowProvider,ViewportPortal,
 applyNodeChanges,type Connection,type Edge,type Node,type NodeChange,type NodeProps,type ReactFlowInstance
} from "@xyflow/react";
import {BookOpen,Image as ImageIcon,Mic,Video as VideoIcon} from "lucide-react";
import type {DataSpec,StudioObject} from "@/lib/studio-v5/types";
import {StudioMarketChart} from "@/components/studio-v5/MarketChart";
import {studioAction} from "@/lib/studio-v6/api";
import {localStudioAction,saveLocalObjectDraft} from "@/lib/studio-v5/local-store";
import {lodFromZoom,roomRole,type CreateKind} from "@/lib/studio-v6/workstation";
import {roomPortal} from "@/lib/studio-v6/room-preview";
import {diagramComponent,diagramRole,diagramRoleLabel,layoutDiagram,nextDiagramRole,type DiagramLayout} from "@/lib/studio-v6/diagram";
import {RichEditor} from "./RichEditor";
import {VisualScene} from "./VisualScene";
import {classifyUrl,deepestFrame,descendants,escapeHtml} from "./world-model";
import {annotationStyle,annotationTitle,relativePoints,strokeBounds} from "@/lib/studio-v6/annotations";
import {AnnotationLayer,BoardPalette,VoiceCapture,type BoardTool} from "./BoardChrome";

type Lod="far"|"mid"|"near";
type InputProfile="mouse"|"trackpad";
type FlowData={object:StudioObject;lod:Lod;depth:number;signatures:Array<{kind:string;title:string}>;childCount:number;zoom:number;portal:ReturnType<typeof roomPortal>|null};
type StudioNode=Node<FlowData,"workspace"|"content">;
type ObjectPatch={id:string;patch:any;eventType?:string;summary?:string};
type Props={objects:StudioObject[];selected:Set<string>;setSelected:(ids:Set<string>)=>void;focusId?:string|null;focusNonce?:number;onObjectsLocal:(fn:(x:StudioObject[])=>StudioObject[])=>void;onPatch:(id:string,patch:any,eventType?:string,summary?:string)=>Promise<void>;onCommit?:(patches:ObjectPatch[])=>Promise<void>;onCreate:(kind:string,opts?:any)=>Promise<StudioObject>;onOpenDocument:(id:string)=>void;onAssemble?:(id:string)=>void;onRestore:(snapshot:StudioObject[])=>Promise<void>;notice:(s:string)=>void};
type MenuState={x:number;y:number;point:{x:number;y:number};id?:string;more?:boolean};

type CanvasActions={
 patch:(id:string,patch:any,eventType?:string,summary?:string)=>Promise<void>;
 remember:()=>void;
 resize:(id:string,p:{x:number;y:number;width:number;height:number})=>void;
 quickAdd:(frameId:string,kind:string)=>void;
 openDocument:(id:string)=>void;
 focus:(id:string)=>void;
 assemble:(id:string)=>void;
 ask:(intent:string,id:string)=>void;
 spawnDiagram:(id:string)=>void;
 layoutMap:(id:string,mode:DiagramLayout)=>void;
 linking:boolean;
 dragging:boolean;
};
const CanvasContext=createContext<CanvasActions|null>(null);
const nodeTypes:any={workspace:WorkspaceNode,content:ContentNode};
const VIEW_KEY="tqs-studio-v6-graphite-viewport",PROFILE_KEY="tqs-studio-v6-rf-input-profile",CLIP_KEY="tqs-studio-clipboard",FOCUS_APPLIED="tqs-studio-v6-focus-nonce";

function depthOf(o:StudioObject,byId:Map<string,StudioObject>){let d=0,p=o.parent_id,guard=0;while(p&&guard++<20){d++;p=byId.get(p)?.parent_id||null}return d}
function flowPosition(o:StudioObject,byId:Map<string,StudioObject>){const p=o.parent_id?byId.get(o.parent_id):null;return p?{x:o.x-p.x,y:o.y-p.y}:{x:o.x,y:o.y}}
function titleText(o:StudioObject){if(o.id==="lesson-miro-scene")return"Занятие 1";if(o.id==="frame-learning")return"Обучение";if(o.id==="frame-agent")return"Агент";if(o.id==="frame-tqs")return"Торговля";return o.title}
function iconFor(kind:string){return kind==="frame"?"▣":kind==="text"?"T":kind==="task"?"✓":kind==="voice"?"◉":kind==="image"?"▧":kind==="video"?"▶":kind==="chart"?"⌁":kind==="documentRef"?"D":kind==="link"?"↗":kind==="file"?"F":"•"}
function inputProfile(){try{const x=localStorage.getItem(PROFILE_KEY);if(x==="mouse"||x==="trackpad")return x}catch{}return (typeof navigator!=="undefined"&&/Mac|iPhone|iPad/.test(navigator.platform||""))?"trackpad":"mouse" as InputProfile}
function initialViewport(){try{const x=JSON.parse(localStorage.getItem(VIEW_KEY)||"null");if(x&&Number.isFinite(x.x)&&Number.isFinite(x.y)&&Number.isFinite(x.zoom))return x}catch{}return null}
function absoluteFor(id:string,nodes:StudioNode[]){const m=new Map(nodes.map(n=>[n.id,n]));let n=m.get(id),x=0,y=0,guard=0;if(!n)return{x:0,y:0};x+=n.position.x;y+=n.position.y;let p=n.parentId;while(p&&guard++<30){const q=m.get(p);if(!q)break;x+=q.position.x;y+=q.position.y;p=q.parentId}return{x,y}}
function fileToDataUrl(file:File){return new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=()=>reject(r.error);r.readAsDataURL(file)})}
function editableTarget(target:EventTarget|null){const el=target as HTMLElement|null,tag=el?.tagName||"";return Boolean(el?.isContentEditable||["INPUT","TEXTAREA","SELECT"].includes(tag))}
function studioPayload(text:string){try{const x=JSON.parse(text);if(x?.type==="tqs-studio-objects"&&Array.isArray(x.objects))return x.objects as StudioObject[]}catch{}return null}

export function ReactFlowWorldV6(props:Props){
 return <ReactFlowProvider><ReactFlowWorldInner {...props}/></ReactFlowProvider>
}

function ReactFlowWorldInner({objects,selected,setSelected,focusId,focusNonce=0,onPatch,onCommit,onCreate,onOpenDocument,onAssemble,onRestore,notice}:Props){
 const [nodes,setNodes]=useState<StudioNode[]>([]),[zoom,setZoom]=useState(.65),[lod,setLod]=useState<Lod>("mid"),[profile,setProfileState]=useState<InputProfile>(()=>typeof window==="undefined"?"trackpad":inputProfile()),[arm,setArm]=useState<null|"text">(null),[menu,setMenu]=useState<MenuState|null>(null),[dragging,setDragging]=useState(false),[mapOpen,setMapOpen]=useState(false),[linking,setLinking]=useState(false),[tool,setTool]=useState<BoardTool>("select"),[moreTools,setMoreTools]=useState(false),[voiceAt,setVoiceAt]=useState<{x:number;y:number}|null>(null),[draft,setDraft]=useState<{kind:string;points:{x:number;y:number}[]}|null>(null);
 const rf=useRef<ReactFlowInstance<StudioNode,Edge>|null>(null),nodesRef=useRef<StudioNode[]>([]),pointer=useRef({x:900,y:500}),fileInput=useRef<HTMLInputElement|null>(null),fileTarget=useRef<{frameId?:string;kind:"image"|"video"|"file";point?:{x:number;y:number}}|null>(null),focusIdRef=useRef<string|null>(focusId||null),focusNonceRef=useRef(focusNonce),byIdRef=useRef<Map<string,StudioObject>>(new Map()),lastNativePaste=useRef(0),rightDrag=useRef<{x:number;y:number;vx:number;vy:number;z:number;moved:boolean;nodeId:string|null}|null>(null),draggingRef=useRef(false),zoomRef=useRef(zoom),objectsRef=useRef(objects),undoStack=useRef<StudioObject[][]>([]),redoStack=useRef<StudioObject[][]>([]),selectedRef=useRef(selected),toolRef=useRef(tool);
 const visibleObjects=useMemo(()=>objects.filter(o=>!o.hidden&&o.kind!=="annotation"),[objects]),byId=useMemo(()=>new Map(objects.map(o=>[o.id,o])),[objects]);
 focusIdRef.current=focusId||null;focusNonceRef.current=focusNonce;byIdRef.current=byId;objectsRef.current=objects;selectedRef.current=selected;toolRef.current=tool;
 const focusCanonical=useCallback((instance:ReactFlowInstance<StudioNode,Edge>,id:string)=>{const o=byIdRef.current.get(id);if(!o)return false;const el=document.querySelector(".rf-studio-canvas") as HTMLElement|null,r=el?.getBoundingClientRect();if(!r)return false;const fit=Math.min((r.width-140)/Math.max(1,o.w),(r.height-150)/Math.max(1,o.h));const z=Math.min(.92,Math.max(.64,fit));void instance.setViewport({x:r.width/2-(o.x+o.w/2)*z,y:(r.height/2)-(o.y+o.h/2)*z,zoom:z},{duration:420});return true},[]);
 const directChildren=useMemo(()=>{const m=new Map<string,StudioObject[]>();for(const o of visibleObjects){if(!o.parent_id)continue;const a=m.get(o.parent_id)||[];a.push(o);m.set(o.parent_id,a)}return m},[visibleObjects]);
 const remember=useCallback(()=>{undoStack.current.push(structuredClone(objectsRef.current));if(undoStack.current.length>40)undoStack.current.shift();redoStack.current=[]},[]);
 const restoreSnap=useCallback(async(stack:StudioObject[][],other:StudioObject[][])=>{const snap=stack.pop();if(!snap)return;other.push(structuredClone(objectsRef.current));await onRestore(snap);setMenu(null)},[onRestore]);

 const buildNodes=useCallback(()=>visibleObjects
  .slice()
  .sort((a,b)=>depthOf(a,byId)-depthOf(b,byId)||a.z-b.z)
  .map(o=>{
   const depth=depthOf(o,byId),isWorkspace=o.kind==="frame",children=directChildren.get(o.id)||[],signatures=[...children].filter(x=>x.kind==="frame"||x.kind==="text").sort((a,b)=>(a.kind==="frame"?0:1)-(b.kind==="frame"?0:1)).slice(0,4).map(x=>({kind:x.kind,title:titleText(x)}));
   const n:StudioNode={id:o.id,type:isWorkspace?"workspace":"content",position:flowPosition(o,byId),width:o.w,height:o.h,parentId:o.parent_id||undefined,zIndex:o.z,draggable:o.body?.locked?false:undefined,data:{object:o,lod,depth,signatures,childCount:children.length,zoom:zoomRef.current,portal:isWorkspace?roomPortal(o,depth,visibleObjects):null}};
   if(isWorkspace)n.dragHandle=".tqs-drag-handle";
   return n
  }),[visibleObjects,byId,directChildren,lod]);

 useEffect(()=>{if(draggingRef.current)return;const next=buildNodes();setNodes(current=>{const selectedIds=new Set(current.filter(node=>node.selected).map(node=>node.id));const merged=next.map(node=>({...node,selected:selectedIds.has(node.id)}));nodesRef.current=merged;return merged});},[buildNodes,dragging]);
 useEffect(()=>{nodesRef.current=nodes},[nodes]);
 const edges=useMemo<Edge[]>(()=>{
  const list:Edge[]=[];
  const seen=new Set<string>();
  const add=(id:string,source?:string|null,target?:string|null)=>{
   if(!source||!target||source===target||!byId.has(source)||!byId.has(target)||byId.get(source)?.hidden||byId.get(target)?.hidden||seen.has(source+"→"+target))return;
   seen.add(source+"→"+target);
   list.push({id,source,target,type:"smoothstep",animated:false,selectable:false,style:{stroke:"#3B82F6",strokeWidth:1.25}});
  };
  for(const o of objects){
   if(o.hidden)continue;
   if(o.kind==="annotation"&&o.body?.annotationKind==="arrow"){
    add(o.id,o.body?.fromId||o.relations?.find((r:any)=>r.type==="connects_from")?.targetId,o.body?.toId||o.relations?.find((r:any)=>r.type==="connects_to")?.targetId);
   }
   for(const rel of o.relations||[]){
    const type=String(rel?.type||"");
    if(type==="connects_to"||type==="annotates"||type==="relates"||type==="next")add(`rel-${o.id}-${rel.targetId}`,o.id,rel.targetId);
   }
  }
  return list;
 },[objects,byId]);

 useEffect(()=>{const f=(e:Event)=>{const p=(e as CustomEvent).detail;if(p==="mouse"||p==="trackpad")setProfileState(p)};window.addEventListener("tqs-studio-input-profile",f);return()=>window.removeEventListener("tqs-studio-input-profile",f)},[]);
 const applyExplicitFocus=useCallback((instance:ReactFlowInstance<StudioNode,Edge>,nonce:number)=>{
  const applied=Number(sessionStorage.getItem(FOCUS_APPLIED)||"0");
  const id=focusIdRef.current;
  if(!id||nonce<=applied)return false;
  if(!focusCanonical(instance,id))return false;
  sessionStorage.setItem(FOCUS_APPLIED,String(nonce));
  return true;
 },[focusCanonical]);
 const persistResize=useCallback((id:string,p:{x:number;y:number;width:number;height:number})=>{const n=nodesRef.current.find(x=>x.id===id);if(!n)return;let base={x:0,y:0};if(n.parentId)base=absoluteFor(n.parentId,nodesRef.current);remember();void onPatch(id,{x:base.x+p.x,y:base.y+p.y,w:p.width,h:p.height},"resize","Размер изменён")},[onPatch,remember]);
 const quickAdd=useCallback((frameId:string,kind:string)=>{
  const frame=byId.get(frameId);if(!frame)return;
  if(kind==="image"||kind==="video"){fileTarget.current={frameId,kind:kind as"image"|"video"};const el=fileInput.current;if(el){el.accept=kind==="image"?"image/*":"video/*";el.value="";el.click()}return}
  const kids=directChildren.get(frameId)||[],p={x:frame.x+110+(kids.length%3)*48,y:frame.y+150+(kids.length%4)*38};
  const extra=kind==="chart"?{body:{dataSpec:{provider:"MOEX_ISS",instrument:{family:"SI",resolver:"front_active_contract"},metric:"ohlcv_session",relativeRange:{tradingSessions:2},fixedRange:null,transforms:["group_by_session","cumulative_volume"],display:{renderer:"studio_market_chart"},updatePolicy:"LIVE",asOf:null}}}:kind==="text"?{body:{html:"<p></p>",autoEdit:true}}:kind==="note"?{title:"Заметка",body:{html:"<p></p>",accent:"slate",autoEdit:true}}:{};
  remember();void onCreate(kind==="note"?"text":kind,{point:p,...extra})
 },[byId,directChildren,onCreate,remember]);
 const focusObject=useCallback((id:string)=>{if(rf.current)focusCanonical(rf.current,id);setSelected(new Set([id]))},[focusCanonical]);
 const spawnDiagram=useCallback(async(fromId:string)=>{
  const from=byIdRef.current.get(fromId);if(!from)return;
  remember();
  const role=nextDiagramRole(from.body?.role);
  const peers=diagramComponent(fromId,objectsRef.current).filter(object=>object.kind==="diagram");
  const right=peers.reduce((max,object)=>Math.max(max,object.x+object.w),from.x+from.w);
  const created=await onCreate("diagram",{point:{x:right+36,y:from.y},w:210,h:78,title:diagramRoleLabel(role),parent_id:from.parent_id,body:{role}});
  await onCreate("annotation",{point:{x:from.x+from.w,y:from.y+20},w:36,h:24,title:"затем",parent_id:from.parent_id,body:{annotationKind:"arrow",fromId,toId:created.id,label:"затем"},relations:[{type:"leads_to",targetId:created.id,fromId,label:"затем"},{type:"connects_from",targetId:fromId},{type:"connects_to",targetId:created.id},...(from.parent_id?[{type:"contains",targetId:from.parent_id}]:[])]});
 },[onCreate,remember]);
 const layoutMap=useCallback(async(id:string,mode:DiagramLayout)=>{
  const placed=layoutDiagram(diagramComponent(id,objectsRef.current),mode);
  if(!placed.length)return;
  remember();
  const patches=placed.map(item=>({id:item.id,patch:{x:item.x,y:item.y},eventType:"diagram_layout",summary:mode==="column"?"Схема собрана в столбец":mode==="row"?"Схема собрана в ряд":"Схема разложена"}));
  if(onCommit)await onCommit(patches);else for(const item of patches)await onPatch(item.id,item.patch,item.eventType,item.summary);
 },[onCommit,onPatch,remember]);
 const actions=useMemo<CanvasActions>(()=>({patch:onPatch,remember,resize:persistResize,quickAdd,openDocument:onOpenDocument,focus:focusObject,assemble:id=>{onAssemble?.(id)},ask:(intent,id)=>publishOperator(intent,null,id),spawnDiagram,layoutMap,linking,dragging}),[onPatch,remember,persistResize,quickAdd,onOpenDocument,focusObject,onAssemble,spawnDiagram,layoutMap,linking,dragging]);

 const onNodesChange=(changes:NodeChange<StudioNode>[])=>setNodes(ns=>{const next=applyNodeChanges(changes,ns) as StudioNode[];nodesRef.current=next;return next});
 const persistDrag=useCallback(async(node:StudioNode)=>{
  const now=nodesRef.current,abs=absoluteFor(node.id,now),o=byId.get(node.id);if(!o||o.body?.locked)return;
  let parentId=node.parentId||null;
  if(o.kind!=="frame"){
   const box={x:abs.x+(node.width||o.w)/2,y:abs.y+(node.height||o.h)/2};
   const candidates=now.filter(n=>n.type==="workspace"&&n.id!==node.id&&!n.hidden).map(n=>({n,p:absoluteFor(n.id,now),area:(n.width||1)*(n.height||1)})).filter(x=>box.x>=x.p.x&&box.x<=x.p.x+(x.n.width||0)&&box.y>=x.p.y&&box.y<=x.p.y+(x.n.height||0)).sort((a,b)=>a.area-b.area);
   parentId=candidates[0]?.n.id||null
  }
  const parentObj=parentId?byId.get(parentId):null,newPath=parentObj?parentObj.semantic_path+"/"+o.title:o.title;
  const patches:ObjectPatch[]=[{id:o.id,patch:{x:abs.x,y:abs.y,parent_id:parentId,semantic_path:newPath,relations:[...(o.relations||[]).filter((r:any)=>r.type!=="contains"),...(parentId?[{type:"contains",targetId:parentId}]:[])]},eventType:"semantic_move",summary:"Объект перемещён"}];
  const dx=abs.x-o.x,dy=abs.y-o.y;
  if(dx||dy){for(const mark of objectsRef.current){if(mark.hidden||mark.kind!=="annotation")continue;const target=mark.body?.annotates||mark.relations?.find((relation:any)=>relation.type==="annotates")?.targetId;if(target===o.id)patches.push({id:mark.id,patch:{x:mark.x+dx,y:mark.y+dy},eventType:"semantic_move",summary:"Пометка переехала вместе с объектом"})}}
  if(o.kind==="frame"){
   for(const id of descendants(o.id,objects)){const child=byId.get(id);if(!child)continue;const p=absoluteFor(id,now);patches.push({id,patch:{x:p.x,y:p.y},eventType:"semantic_move",summary:"Перемещено вместе с комнатой"})}
  }
  if(onCommit)await onCommit(patches);
  else for(const item of patches)await onPatch(item.id,item.patch,item.eventType,item.summary);
 },[byId,onCommit,onPatch,objects,remember]);

 const addAt=useCallback(async(kind:string,point?:{x:number;y:number})=>{
  const p=point||rf.current?.screenToFlowPosition(pointer.current)||{x:900,y:600};
  if(kind==="note"){remember();await onCreate("text",{point:p,title:"Заметка",body:{html:"<p></p>",accent:"slate",autoEdit:true}});setMenu(null);return}
  if(kind==="arrow"){setLinking(true);setMenu(null);return}
  if(kind==="voice"){setVoiceAt(p);setMenu(null);return}
  if(kind==="image"||kind==="video"||kind==="file"){fileTarget.current={kind:kind==="video"?"video":kind==="file"?"file":"image",point:p};const el=fileInput.current;if(el){el.accept=kind==="image"?"image/*":kind==="video"?"video/*":"*/*";el.value="";el.click()}setMenu(null);return}
  const extra=kind==="frame"?{title:"Новая комната",w:1320,h:820,body:{workspaceCard:true}}:kind==="text"?{body:{html:"<p></p>",autoEdit:true}}:kind==="diagram"?{title:"Шаг",w:210,h:78,body:{role:"step"}}:kind==="chart"?{title:"Si",body:{dataSpec:{provider:"MOEX_ISS",instrument:{family:"SI",resolver:"front_active_contract"},metric:"ohlcv_session",relativeRange:{tradingSessions:2},fixedRange:null,transforms:["group_by_session","cumulative_volume"],display:{renderer:"studio_market_chart"},updatePolicy:"LIVE",asOf:null}}}:kind==="task"?{w:320,h:44,title:"Новая задача",body:{title:"Новая задача",done:false}}:{};
  remember();await onCreate(kind,{point:p,...extra});setMenu(null)
 },[onCreate,remember]);

 const classify=useCallback(async(text:string,point?:{x:number;y:number})=>{
  const copied=studioPayload(text);
  const p=point||rf.current?.screenToFlowPosition(pointer.current)||{x:900,y:600};
  if(copied?.length){
   remember();
   for(const [i,source] of copied.entries()){
    await onCreate(source.kind,{point:{x:p.x+i*28,y:p.y+i*28},w:source.w,h:source.h,title:source.title,body:structuredClone(source.body),status:source.status,parent_id:undefined});
   }
   return;
  }
  const t=text.trim();if(!t)return;const u=classifyUrl(t);
  if(u?.kind==="video"){remember();await onCreate("video",{point:p,title:u.provider==="youtube"?"YouTube":u.provider==="rutube"?"RuTube":"Vimeo",body:{url:u.url,embedUrl:u.embed,provider:u.provider}});return}
  if(u?.kind==="image"){remember();await onCreate("image",{point:p,title:"Изображение",body:{url:u.url,provider:"url"}});return}
  if(u?.kind==="file"){remember();await onCreate("file",{point:p,title:u.filename,body:{url:u.url,filename:u.filename,mimeType:"application/pdf"}});return}
  if(u?.provider==="google-drive"){remember();await onCreate("link",{point:p,title:u.title||"Google Drive",body:{url:u.url,host:u.host,provider:"google-drive"}});return}
  if(u){remember();await onCreate("link",{point:p,title:u.host||"Ссылка",body:{url:u.url,host:u.host}});return}
  remember();await onCreate("text",{point:p,title:"Текст",body:{html:`<p>${escapeHtml(t)}</p>`,autoEdit:true}})
 },[onCreate,remember]);

 const handleClipboardFiles=useCallback(async(files:File[])=>{const p=rf.current?.screenToFlowPosition(pointer.current);remember();for(const [i,file] of files.entries()){const dataUrl=await fileToDataUrl(file),a=await studioAction<any>("attachAsset",{dataUrl,filename:file.name}),kind=file.type.startsWith("image/")?"image":file.type.startsWith("video/")?"video":file.type==="application/pdf"||file.name.toLowerCase().endsWith(".pdf")?"file":"file";await onCreate(kind,{point:{x:(p?.x||900)+i*26,y:(p?.y||600)+i*26},title:file.name,body:{assetId:a.asset.id,previewUrl:a.signedUrl||dataUrl,mimeType:file.type,filename:file.name}})}},[onCreate,remember]);
 const copySelection=useCallback(()=>{
  const ids=selectedRef.current,picked=objectsRef.current.filter(o=>ids.has(o.id)&&!o.hidden);
  if(!picked.length)return;
  const payload=JSON.stringify({type:"tqs-studio-objects",objects:picked});
  try{localStorage.setItem(CLIP_KEY,payload)}catch{}
  void navigator.clipboard?.writeText(payload).catch(()=>{});
 },[]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();void restoreSnap(e.shiftKey?redoStack.current:undoStack.current,e.shiftKey?undoStack.current:redoStack.current);return}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="c"&&!editableTarget(e.target)){copySelection();return}
  if(editableTarget(e.target)||e.ctrlKey||e.metaKey||e.altKey)return;
  const k=e.key.toLowerCase();
  if(k==="t"){e.preventDefault();setArm("text");setMenu(null);return}
  if((e.key==="Enter"||e.key==="F2")&&selected.size===1){const id=[...selected][0],o=byId.get(id);if(o?.kind==="text"){e.preventDefault();void onPatch(id,{body:{...o.body,autoEdit:true}},"text_edit","Редактирование текста")}}
  if(e.key==="Escape"){setMenu(null);setArm(null);setLinking(false)}
 };const history=(e:Event)=>{const dir=(e as CustomEvent).detail;void restoreSnap(dir==="redo"?redoStack.current:undoStack.current,dir==="redo"?undoStack.current:redoStack.current)};
 const fit=()=>fitWorld();
 const create=(e:Event)=>{const kind=String((e as CustomEvent).detail||"text") as CreateKind;void addAt(kind)};
 const toolEvent=(e:Event)=>{const name=String((e as CustomEvent).detail||"");if(name==="select"||name==="hand"||name==="text"||name==="pen"||name==="marker"||name==="arrow"||name==="shape"||name==="erase"){setTool(name as BoardTool);setArm(name==="text"?"text":null)}if(name==="voice")setVoiceAt(rf.current?.screenToFlowPosition(pointer.current)||{x:900,y:600})};
 const board={canUndo:()=>undoStack.current.length>0,canRedo:()=>redoStack.current.length>0,undo:()=>void restoreSnap(undoStack.current,redoStack.current),redo:()=>void restoreSnap(redoStack.current,undoStack.current)};
 (window as any).__tqsBoardHistory=board;
 window.addEventListener("keydown",key,true);window.addEventListener("tqs-studio-history",history);window.addEventListener("tqs-studio-fit",fit);window.addEventListener("tqs-studio-create",create);window.addEventListener("tqs-studio-tool",toolEvent);
 return()=>{delete (window as any).__tqsBoardHistory;window.removeEventListener("keydown",key,true);window.removeEventListener("tqs-studio-history",history);window.removeEventListener("tqs-studio-fit",fit);window.removeEventListener("tqs-studio-create",create);window.removeEventListener("tqs-studio-tool",toolEvent)}
 },[selected,byId,onPatch,copySelection,restoreSnap,addAt]);
 const consumeClipboard=useCallback((data:DataTransfer|null)=>{if(!data)return false;const files=Array.from(data.files);if(files.length){lastNativePaste.current=performance.now();void handleClipboardFiles(files);return true}const text=data.getData("text/plain")||"";if(text){lastNativePaste.current=performance.now();void classify(text);return true}try{const stored=localStorage.getItem(CLIP_KEY);if(stored){lastNativePaste.current=performance.now();void classify(stored);return true}}catch{}return false},[classify,handleClipboardFiles]);
 useEffect(()=>{const handler=(e:ClipboardEvent)=>{if(editableTarget(e.target))return;if(consumeClipboard(e.clipboardData)){e.preventDefault();e.stopPropagation()}};const keydown=(e:KeyboardEvent)=>{if(editableTarget(e.target)||!(e.ctrlKey||e.metaKey)||e.key.toLowerCase()!=="v")return;setTimeout(()=>{if(performance.now()-lastNativePaste.current<180)return;void navigator.clipboard?.readText().then(text=>{if(text)void classify(text)}).catch(()=>{try{const stored=localStorage.getItem(CLIP_KEY);if(stored)void classify(stored)}catch{}})},0)};window.addEventListener("paste",handler,true);window.addEventListener("keydown",keydown,true);return()=>{window.removeEventListener("paste",handler,true);window.removeEventListener("keydown",keydown,true)}},[classify,consumeClipboard]);
 useEffect(()=>{const down=(e:KeyboardEvent)=>{if(e.key==="Alt")setLinking(true)};const up=(e:KeyboardEvent)=>{if(e.key==="Alt")setLinking(false)};window.addEventListener("keydown",down);window.addEventListener("keyup",up);return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up)}},[]);

 useEffect(()=>{if(!rf.current)return;applyExplicitFocus(rf.current,focusNonce)},[focusNonce,focusId,nodes,applyExplicitFocus]);

 const publishOperator=(intent:string,point:{x:number;y:number}|null,objectId?:string)=>{
  const o=objectId?byId.get(objectId):undefined,frame=o?.kind==="frame"?o:o?.parent_id?byId.get(o.parent_id):undefined,doc=objects.find(x=>x.kind==="documentRef"&&(x.id===objectId||x.parent_id===frame?.id)),vp=rf.current?.getViewport();
  const payload={intent,object_ids:objectId?[objectId]:[...selected],frame_id:frame?.id||null,frame_title:frame?titleText(frame):null,selection:o?{x:o.x,y:o.y,w:o.w,h:o.h}:null,pointer:point,viewport:vp?{x:vp.x,y:vp.y,zoom:vp.zoom}:null,document_id:doc?.body?.documentId||null,semantic_path:o?.semantic_path||frame?.semantic_path||"",at:new Date().toISOString()};
  try{localStorage.setItem("tqs-studio-v6-operator",JSON.stringify(payload))}catch{}
  void localStudioAction("recordOperator",{entityId:objectId||frame?.id||null,semanticPath:payload.semantic_path,eventType:"ai_request",summary:intent==="redesign"?"Переделать выделенное":intent==="create_here"?"Создать здесь":intent==="assemble_document"?"Собрать документ":"Продолжить работу",payload});
 };
 const duplicate=async(id:string)=>{const o=byId.get(id);if(!o)return;remember();await onCreate(o.kind,{point:{x:o.x+48,y:o.y+48},w:o.w,h:o.h,title:o.title,body:structuredClone(o.body),status:o.status,relations:structuredClone(o.relations||[])});setMenu(null)};
 const pasteAt=async(point:{x:number;y:number},objectsOnly=false)=>{
  setMenu(null);
  let text="";
  try{text=await navigator.clipboard.readText()}catch{}
  if(!text){try{text=localStorage.getItem(CLIP_KEY)||""}catch{}}
  const copied=studioPayload(text);
  if(objectsOnly&&!copied){notice("В буфере нет объекта доски");return}
  if(text)await classify(text,point);else notice("Буфер пуст");
 };
 const remove=async(id:string)=>{const o=byId.get(id);if(!o)return;remember();const ids=o.kind==="frame"?[id,...descendants(id,objects)]:[id];for(const x of ids)await onPatch(x,{hidden:true},"hide","Скрыто");setMenu(null)};
 const connect=async(c:Connection)=>{if(!c.source||!c.target)return;const a=byId.get(c.source),b=byId.get(c.target);if(!a||!b)return;remember();const ax=a.x+a.w/2,ay=a.y+a.h/2,bx=b.x+b.w/2,by=b.y+b.h/2;await onCreate("annotation",{point:{x:Math.min(ax,bx),y:Math.min(ay,by)},w:Math.max(20,Math.abs(bx-ax)),h:Math.max(20,Math.abs(by-ay)),title:"Связь",body:{annotationKind:"arrow",fromId:a.id,toId:b.id,points:[{x:0,y:0},{x:Math.abs(bx-ax),y:Math.abs(by-ay)}]},relations:[{type:"connects_from",targetId:a.id},{type:"connects_to",targetId:b.id}]});setLinking(false)};
 const align=(axis:"x"|"y")=>{
  const ids=[...selected].map(id=>byId.get(id)).filter((o):o is StudioObject=>!!o&&o.kind!=="frame");
  if(ids.length<2)return;
  remember();
  const edge=Math.min(...ids.map(o=>axis==="x"?o.x:o.y));
  for(const o of ids)void onPatch(o.id,axis==="x"?{x:edge}:{y:edge},"align","Выровнено");
  setMenu(null);
 };
 const makeRoom=async()=>{
  const ids=[...selected].map(id=>byId.get(id)).filter((o):o is StudioObject=>Boolean(o));
  if(ids.length<2)return;
  const x=Math.min(...ids.map(o=>o.x))-48,y=Math.min(...ids.map(o=>o.y))-72,right=Math.max(...ids.map(o=>o.x+o.w))+48,bottom=Math.max(...ids.map(o=>o.y+o.h))+48;
  remember();
  const room=await onCreate("frame",{point:{x,y},w:right-x,h:bottom-y,title:"Комната",body:{workspaceCard:true}});
  for(const o of ids)await onPatch(o.id,{parent_id:room.id,semantic_path:room.semantic_path+"/"+o.title},"reparent","Собрано в комнату");
  setMenu(null);
 };
 const fitWorld=()=>{
  const roots=objectsRef.current.filter(o=>o.kind==="frame"&&!o.parent_id&&!o.hidden);
  void rf.current?.fitView({nodes:roots.map(o=>({id:o.id})),padding:.16,duration:420,maxZoom:.24}).then(()=>{
   const vp=rf.current?.getViewport();
   if(!vp)return;
   void rf.current?.setViewport({x:vp.x+42,y:vp.y+8,zoom:vp.zoom},{duration:160});
  });
 };

 const drawing=tool==="pen"||tool==="marker"||tool==="arrow"||tool==="shape";
 const commitStroke=async(kind:string,points:{x:number;y:number}[])=>{
  if(points.length<2)return;
  const box=strokeBounds(points),rel=relativePoints(points,box),cx=box.x+box.w/2,cy=box.y+box.h/2;
  const parent=deepestFrame(cx,cy,objectsRef.current.filter(object=>!object.hidden));
  const target=objectsRef.current.filter(object=>!object.hidden&&object.kind==="image"&&cx>=object.x&&cx<=object.x+object.w&&cy>=object.y&&cy<=object.y+object.h).sort((a,b)=>a.w*a.h-b.w*b.h)[0];
  const style=annotationStyle(kind);
  remember();
  await onCreate("annotation",{point:{x:box.x,y:box.y},w:Math.max(box.w,12),h:Math.max(box.h,12),title:annotationTitle(kind),parent_id:parent?.id??null,semantic_path:(parent?.semantic_path||"Мир")+"/"+annotationTitle(kind),body:{annotationKind:kind==="shape"?"shape":kind,shape:kind==="shape"?"rect":undefined,points:kind==="shape"?[{x:0,y:0},{x:box.w,y:box.h}]:rel,style,annotates:target?.id||null,provenance:{created_by:"owner",operation:"annotate",at:new Date().toISOString()}},relations:[...(parent?[{type:"contains",targetId:parent.id}]:[]),...(target?[{type:"annotates",targetId:target.id}]:[])],status:null});
 };
 const draftRef=useRef<{kind:string;points:{x:number;y:number}[]}|null>(null);
 const drawPoint=(event:React.PointerEvent)=>rf.current?.screenToFlowPosition({x:event.clientX,y:event.clientY})||{x:event.clientX,y:event.clientY};
 const startDraw=(event:React.PointerEvent<HTMLDivElement>)=>{if(!drawing)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);const next={kind:tool,points:[drawPoint(event)]};draftRef.current=next;setDraft(next)};
 const moveDraw=(event:React.PointerEvent<HTMLDivElement>)=>{const current=draftRef.current;if(!current)return;const next={...current,points:[...current.points,drawPoint(event)]};draftRef.current=next;setDraft(next)};
 const endDraw=()=>{const stroke=draftRef.current;draftRef.current=null;setDraft(null);if(stroke)void commitStroke(stroke.kind,stroke.points)};
 const saveVoice=async(payload:{dataUrl:string;filename:string;mimeType:string;durationSec:number;durationLabel:string;transcript:string;waveform:number[]})=>{
  const asset=await studioAction<any>("attachAsset",{dataUrl:payload.dataUrl,filename:payload.filename});
  remember();
  await onCreate("voice",{point:voiceAt||{x:900,y:600},w:340,h:payload.transcript?128:72,title:"Голосовая заметка",body:{title:"Голосовая заметка",duration:payload.durationLabel,durationSec:payload.durationSec,transcript:payload.transcript,transcriptStatus:payload.transcript?"ready":"unavailable",waveform:payload.waveform,assetId:asset.asset.id,previewUrl:asset.signedUrl||payload.dataUrl,mimeType:payload.mimeType,provenance:{created_by:"owner",operation:"voice_record",at:new Date().toISOString()}},status:payload.transcript?"NEW":"TRANSCRIPT_UNAVAILABLE"});
  setVoiceAt(null);
 };
 const selectedObject=menu?.id?byId.get(menu.id):undefined;
 const multi=menu?.id?selected.size>1&&selected.has(menu.id):false;

 return <CanvasContext.Provider value={actions}>
  <section className={["rf-studio-canvas",arm==="text"?"is-text-arm":"",linking?"is-linking":"",tool==="hand"?"is-hand":"",drawing?"is-draw":""].filter(Boolean).join(" ")} data-testid="world-canvas-v6" data-lod={lod} data-tool={tool} tabIndex={0} onDoubleClick={e=>{const target=e.target as HTMLElement;if(target.classList.contains("react-flow__pane")){setArm(null);void addAt("text",rf.current?.screenToFlowPosition({x:e.clientX,y:e.clientY}))}}} onPointerDown={e=>{if(e.currentTarget===e.target)e.currentTarget.focus()}} onPointerDownCapture={e=>{if(e.button!==2)return;const vp=rf.current?.getViewport();if(!vp)return;rightDrag.current={x:e.clientX,y:e.clientY,vx:vp.x,vy:vp.y,z:vp.zoom,moved:false,nodeId:(e.target as HTMLElement).closest?.(".react-flow__node")?.getAttribute("data-id")||null}}} onPointerUpCapture={e=>{if(e.button!==2)return;const g=rightDrag.current;rightDrag.current=null;if(!g||g.moved)return;const host=(e.currentTarget as HTMLElement).getBoundingClientRect(),x=e.clientX-host.left,y=e.clientY-host.top;if(g.nodeId){if(!selected.has(g.nodeId))setSelected(new Set([g.nodeId]));setMenu({x,y,point:absoluteFor(g.nodeId,nodesRef.current),id:g.nodeId});return}setMenu({x,y,point:rf.current?.screenToFlowPosition({x:e.clientX,y:e.clientY})||{x:0,y:0}})}} onPointerMove={e=>{pointer.current={x:e.clientX,y:e.clientY}}} onPointerMoveCapture={e=>{const g=rightDrag.current;if(!g)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(!g.moved&&Math.hypot(dx,dy)<=5)return;g.moved=true;void rf.current?.setViewport({x:g.vx+dx,y:g.vy+dy,zoom:g.z})}} onPasteCapture={e=>{if(consumeClipboard(e.clipboardData)){e.preventDefault();e.stopPropagation()}}} onDragOver={e=>{if(Array.from(e.dataTransfer?.types||[]).includes("Files"))e.preventDefault()}} onDrop={e=>{if(e.dataTransfer?.files?.length){e.preventDefault();pointer.current={x:e.clientX,y:e.clientY};void handleClipboardFiles(Array.from(e.dataTransfer.files))}}}>
   <input ref={fileInput} className="v6-file-picker" type="file" tabIndex={-1} onChange={e=>{const file=e.currentTarget.files?.[0],target=fileTarget.current;fileTarget.current=null;if(!file||!target)return;void (async()=>{const dataUrl=await fileToDataUrl(file),a=await studioAction<any>("attachAsset",{dataUrl,filename:file.name}),frame=target.frameId?byId.get(target.frameId):null,p=target.point||(frame?{x:frame.x+140,y:frame.y+180}:rf.current?.screenToFlowPosition(pointer.current)||{x:900,y:600});remember();await onCreate(target.kind,{point:p,title:file.name,body:{assetId:a.asset.id,previewUrl:a.signedUrl||dataUrl,mimeType:file.type,filename:file.name}})})()}}/>
   <ReactFlow<StudioNode,Edge>
    nodes={nodes} edges={edges} nodeTypes={nodeTypes}
    onNodesChange={onNodesChange}
    onNodeDragStart={()=>{draggingRef.current=true;setDragging(true);remember()}}
    onNodeDragStop={(_,node)=>{void persistDrag(node).finally(()=>{draggingRef.current=false;setDragging(false)})}}
    onNodeClick={(_,node)=>{setArm(null);const active=document.activeElement as HTMLElement|null;if(active&&active.closest?.(".react-flow__node")?.getAttribute("data-id")!==node.id)active.blur();setSelected(new Set([node.id]))}}
    onConnect={c=>void connect(c)}
    onNodesDelete={ns=>{for(const n of ns)void remove(n.id)}}
    onInit={instance=>{rf.current=instance;const saved=initialViewport();if(!applyExplicitFocus(instance,focusNonceRef.current)&&saved)instance.setViewport(saved)}}
    onMove={(_,v)=>{zoomRef.current=v.zoom;const next=lodFromZoom(v.zoom);setLod(prev=>prev===next?prev:next);const pct=Math.round(v.zoom*100);setZoom(z=>Math.round(z*100)===pct?z:v.zoom)}}
    onMoveEnd={(_,v)=>{zoomRef.current=v.zoom;setZoom(v.zoom);setLod(lodFromZoom(v.zoom));try{localStorage.setItem(VIEW_KEY,JSON.stringify(v))}catch{}}}
    onPaneContextMenu={e=>{e.preventDefault()}}
    onNodeContextMenu={e=>{e.preventDefault()}}
    onPaneClick={e=>{setMenu(null);const active=document.activeElement as HTMLElement|null;if(active&&active!==e.target&&typeof active.blur==="function")active.blur();if(arm!=="text")return;const p=rf.current?.screenToFlowPosition({x:e.clientX,y:e.clientY})||{x:900,y:600};setArm(null);publishOperator("create_here",p);void addAt("text",p)}}
    minZoom={.08} maxZoom={2.4}
    zoomOnScroll={profile==="mouse"} zoomOnPinch zoomOnDoubleClick={false} panOnScroll={profile==="trackpad"} panOnScrollSpeed={.75}
    panOnDrag={tool==="hand"?[0,1]:drawing?false:[1]} panActivationKeyCode="Space" selectionOnDrag={tool==="select"&&!drawing} nodesDraggable={tool==="select"||tool==="hand"} selectionMode={"partial" as any}
    multiSelectionKeyCode={["Control","Meta"]} deleteKeyCode={["Delete","Backspace"]}
    connectionLineType={ConnectionLineType.SmoothStep}
    fitViewOptions={{padding:.12,maxZoom:.24}}
   >
    <Background variant={BackgroundVariant.Dots} gap={28} size={1.1} color="rgba(92,101,112,.38)"/>
    <ViewportPortal><AnnotationLayer objects={objects} selectedId={[...selected][0]||null} draft={draft} erasing={tool==="erase"} onSelect={id=>setSelected(new Set([id]))} onErase={id=>{if(toolRef.current==="erase")void remove(id)}}/></ViewportPortal>
    {mapOpen&&<MiniMap pannable zoomable position="bottom-left" maskColor="rgba(17,19,21,.45)" nodeColor={n=>n.type==="workspace"?"#3B82F6":"#8B939C"}/>}
   </ReactFlow>
   {drawing&&<div className="rf-draw-capture" onPointerDown={startDraw} onPointerMove={moveDraw} onPointerUp={endDraw}/>}
   <BoardPalette tool={tool} more={moreTools} onTool={next=>{setTool(next);setArm(next==="text"?"text":null);setMoreTools(false)}} onMore={setMoreTools} onCreate={kind=>void addAt(kind)} onVoice={()=>setVoiceAt(rf.current?.screenToFlowPosition(pointer.current)||{x:900,y:600})}/>
   {voiceAt&&<VoiceCapture onCancel={()=>setVoiceAt(null)} onSave={saveVoice}/>}
   <div className="rf-zoombar" data-studio-ui data-testid="studio-zoom">
    <button aria-label="Отдалить" onClick={()=>void rf.current?.zoomOut({duration:160})}>−</button>
    <span>{Math.round(zoom*100)}%</span>
    <button aria-label="Приблизить" onClick={()=>void rf.current?.zoomIn({duration:160})}>+</button>
    <button aria-label="Вписать мир" onClick={fitWorld}>Вписать</button>
    <button aria-label="Карта" className={mapOpen?"is-on":""} onClick={()=>setMapOpen(v=>!v)}>Карта</button>
    <code className="rf-selected-probe" data-testid="studio-selected-id">{[...selected][0]||""}</code>
   </div>

   {menu&&<div className="rf-context" style={{left:menu.x,top:menu.y}} data-studio-ui data-testid="board-menu">
    {multi?<>
     <strong>{selected.size} объектов</strong>
     <button onClick={()=>void makeRoom()}>Собрать комнату</button>
     <button onClick={()=>align("x")}>Выровнять</button>
     <button onClick={()=>align("y")}>Распределить по верху</button>
     <button onClick={()=>{remember();for(const id of selected){const o=byId.get(id);if(o)void onPatch(id,{body:{...o.body,locked:!o.body?.locked}},"lock","Блокировка")}setMenu(null)}}>Закрепить</button>
     <button onClick={()=>void duplicate([...selected][0])}>Дублировать</button>
    </>:menu.id?<>
     {selectedObject?.kind==="text"&&<button onClick={()=>{void onPatch(menu.id!,{body:{...selectedObject.body,autoEdit:true}},"text_edit","Редактирование текста");setMenu(null)}}>Править</button>}
     {selectedObject?.kind==="image"&&<button onClick={()=>{fileTarget.current={kind:"image",point:menu.point};const el=fileInput.current;if(el){el.accept="image/*";el.value="";el.click()}setMenu(null)}}>Заменить</button>}
     {selectedObject?.kind==="frame"&&<button onClick={()=>{focusObject(menu.id!);setMenu(null)}}>Сфокусировать</button>}
     {selectedObject?.kind==="frame"&&<button onClick={()=>{publishOperator("assemble_document",menu.point,menu.id);onAssemble?.(menu.id!);setMenu(null)}}>Создать документ</button>}
     <button onClick={()=>{publishOperator("redesign",menu.point,menu.id);notice("Выделение передано");setMenu(null)}}>AI</button>
     <button onClick={()=>{copySelection();setMenu(null)}}>Копировать</button>
     <button onClick={()=>void pasteAt(menu.point)}>Вставить</button>
     <button onClick={()=>void pasteAt(menu.point,true)}>Вставить объект</button>
     <button onClick={()=>void duplicate(menu.id!)}>Дублировать</button>
     <button onClick={()=>{const o=byId.get(menu.id!);if(o)void onPatch(menu.id!,{body:{...o.body,locked:!o.body?.locked}},"lock",o.body?.locked?"Снята блокировка":"Закреплено");setMenu(null)}}>{selectedObject?.body?.locked?"Снять закрепление":"Закрепить"}</button>
     <button onClick={()=>{void navigator.clipboard?.writeText(`${location.origin}/studio#${menu.id}`);notice("Ссылка скопирована");setMenu(null)}}>Копировать ссылку</button>
     {!menu.more?<button onClick={()=>setMenu({...menu,more:true})}>Ещё</button>:<button onClick={()=>setLinking(true)}>Связь</button>}
     <button className="danger" onClick={()=>void remove(menu.id!)}>Удалить</button>
    </>:<>
     <button onClick={()=>void pasteAt(menu.point)}>Вставить</button>
     <button onClick={()=>void pasteAt(menu.point,true)}>Вставить объект</button>
     <button onClick={()=>void addAt("text",menu.point)}>Текст</button>
     <button onClick={()=>void addAt("note",menu.point)}>Заметка</button>
     <button onClick={()=>void addAt("task",menu.point)}>Задача</button>
     <button onClick={()=>{fileTarget.current={kind:"image",point:menu.point};const el=fileInput.current;if(el){el.accept="image/*";el.value="";el.click()}setMenu(null)}}>Изображение</button>
     <button onClick={()=>void addAt("video",menu.point)}>Видео</button>
     <button onClick={()=>void addAt("chart",menu.point)}>График</button>
     {!menu.more?<button onClick={()=>setMenu({...menu,more:true})}>Ещё</button>:<>
      <button onClick={()=>void addAt("voice",menu.point)}>Голос</button>
      <button onClick={()=>void addAt("file",menu.point)}>Файл</button>
      <button onClick={()=>void addAt("link",menu.point)}>Ссылка</button>
      <button onClick={()=>void addAt("frame",menu.point)}>Комната</button>
      <button onClick={()=>{setTool("pen");setMenu(null)}}>Рисование</button>
     </>}
    </>}
   </div>}
  </section>
 </CanvasContext.Provider>
}

function ObjectToolbar({kind,on}:{kind:string;on:(action:string)=>void}){
 const items=kind==="image"?["Заменить"]:kind==="frame"?["Фокус","Документ"]:kind==="text"?["Править"]:[];
 if(!items.length)return null;
 return <div className="rf-object-toolbar nodrag nopan" data-studio-ui onPointerDown={e=>e.stopPropagation()}>{items.map(item=><button key={item} onClick={()=>on(item)}>{item}</button>)}</div>
}

function WorkspaceNode({id,data,selected}:NodeProps<StudioNode>){
 const ctx=useContext(CanvasContext)!,o=data.object,role=roomRole(data.depth);
 const [renaming,setRenaming]=useState(false),[title,setTitle]=useState(titleText(o));
 const summary=String(o.body?.summary||"");
 return <div className={`rf-workspace-card is-region lod-${data.lod} level-${data.depth} room-${role}${data.lod==="near"?" is-near":""}${selected?" is-selected":""}`} data-studio-id={id} data-testid="world-frame" data-region-role={role} data-room-lod={data.lod} style={{["--board-zoom" as any]:Math.max(data.zoom,.08)}}>
  <NodeResizer isVisible={selected&&data.lod==="near"} minWidth={280} minHeight={160} onResizeEnd={(_,p)=>ctx.resize(id,p)}/>
  <Handle type="target" position={Position.Left} className="rf-handle"/><Handle type="source" position={Position.Right} className="rf-handle"/>
  {selected&&data.lod!=="far"&&<ObjectToolbar kind="frame" on={action=>{
   if(action==="Фокус")ctx.focus(id);
   if(action==="Документ")ctx.assemble(id);
  }}/>}
  <header className="rf-region-label tqs-drag-handle">
   {renaming?<input className="nodrag nopan rf-rename" value={title} autoFocus onChange={e=>setTitle(e.target.value)} onBlur={()=>{setRenaming(false);if(title.trim()&&title!==o.title)void ctx.patch(id,{title:title.trim()},"rename","Область переименована")}} onKeyDown={e=>{if(e.key==="Enter")(e.target as HTMLInputElement).blur()}}/>:<strong onDoubleClick={()=>setRenaming(true)}>{titleText(o)}</strong>}
  </header>
  {data.lod!=="near"&&summary&&<p className="rf-region-summary">{summary}</p>}
  {data.lod!=="near"&&data.signatures.length>0&&<ul className="rf-region-signs">{data.signatures.slice(0,4).map(item=><li key={item.title}>{item.title}</li>)}</ul>}
 </div>
}

function ContentNode({id,data,selected}:NodeProps<StudioNode>){
 const ctx=useContext(CanvasContext)!,o=data.object,isText=o.kind==="text",noteAccent=isText&&o.body?.accent?String(o.body.accent).replace(/[^a-z0-9_-]/gi,""):"";
 const [editing,setEditing]=useState(()=>Boolean(isText&&o.body?.autoEdit)),saveTimer=useRef<number|null>(null),autoEditSeen=useRef(Boolean(isText&&o.body?.autoEdit));
 useEffect(()=>()=>{if(saveTimer.current!==null)window.clearTimeout(saveTimer.current)},[]);
 useEffect(()=>{const auto=Boolean(isText&&o.body?.autoEdit);if(auto&&!autoEditSeen.current)setEditing(true);autoEditSeen.current=auto},[isText,o.body?.autoEdit]);
  if(data.lod==="far")return <div className={`rf-mark kind-${o.kind}${selected?" is-selected":""}`} data-studio-id={id} data-testid={`world-${o.kind}`}><span>{iconFor(o.kind)}</span><strong>{o.title}</strong></div>;
  if(ctx.dragging&&(o.kind==="chart"||o.kind==="image"||o.kind==="video"||o.kind==="file"))return <div className="rf-drag-lite">{o.title}</div>;
 const persistText=(html:string,immediate=false)=>{
  const body={...o.body,html,autoEdit:false};
  saveLocalObjectDraft(o.id,{body});
  if(saveTimer.current!==null)window.clearTimeout(saveTimer.current);
  const commit=()=>{saveTimer.current=null;void ctx.patch(o.id,{body},"text_update","Текст обновлён")};
  if(immediate)commit();else saveTimer.current=window.setTimeout(commit,450);
 };
 const act=(action:string)=>{
  if(action==="Править"||action==="Пометка")setEditing(true);
  if(action==="AI")ctx.ask("redesign",id);
  if(action==="Заменить")ctx.quickAdd(o.parent_id||id,"image");
 };
 return <div className={`rf-content-node kind-${o.kind} lod-${data.lod} ${selected?"is-selected":""} ${editing?"is-editing":""}${noteAccent?` has-accent accent-${noteAccent}`:""}`} data-studio-id={id} data-testid={`world-${o.kind}`}>
  <NodeResizer isVisible={selected&&!editing&&data.lod==="near"} minWidth={80} minHeight={36} onResizeEnd={(_,p)=>ctx.resize(id,p)}/>
  <Handle type="target" position={Position.Left} className="rf-handle"/><Handle type="source" position={Position.Right} className="rf-handle"/>
  {selected&&!editing&&<ObjectToolbar kind={o.kind} on={act}/>}
  <div className="rf-node-body">
   {data.lod==="mid"&&o.kind!=="diagram"&&o.kind!=="task"&&o.kind!=="text"?<MidPreview object={o}/>:<>
    {isText&&(editing?<div className="rf-text-edit nodrag nopan" onPointerDown={e=>e.stopPropagation()}><RichEditor html={o.body?.html||"<p></p>"} autofocus onChange={html=>persistText(html)} onBlur={html=>{persistText(html,true);setEditing(false)}}/></div>:<div className="rf-rich-text rf-rich-text-view" onClick={e=>{if(e.detail===2){e.stopPropagation();setEditing(true)}}} onDoubleClick={e=>{e.stopPropagation();setEditing(true)}} dangerouslySetInnerHTML={{__html:o.body?.html||"<p></p>"}}/>)}
    {o.kind==="image"&&<Asset object={o}/>}
    {o.kind==="video"&&<Asset object={o}/>}
    {o.kind==="file"&&<Asset object={o}/>}
    {o.kind==="chart"&&<ChartBlock object={o}/>}
    {o.kind==="task"&&<Task object={o}/>}
    {o.kind==="voice"&&<Voice object={o}/>}
    {(o.kind==="artifact"||o.kind==="deck")&&<div className="nodrag nopan nowheel"><VisualScene object={o} onChange={(body,summary)=>{if(summary!=="Выбран этап")ctx.remember();void ctx.patch(o.id,{body},o.kind,summary)}}/></div>}
    {o.kind==="diagram"&&<DiagramCard object={o} selected={selected}/>}
    {o.kind==="documentRef"&&<button className="rf-document nodrag nopan" onClick={()=>ctx.openDocument(o.body?.documentId||o.relations?.find((r:any)=>r.type==="document_of")?.targetId)}><span className="rf-doc-sheet"><i/><i/><i/></span><div><strong>{o.title}</strong><span>Конспект · открыть</span></div></button>}
    {o.kind==="link"&&<a className={"rf-link nodrag nopan"+(o.body?.provider==="google-drive"?" is-drive":"")} href={o.body?.url||"#"} target="_blank" rel="noreferrer"><span>{o.body?.provider==="google-drive"?"Drive":"↗"}</span><div><strong>{o.title}</strong><small>{o.body?.host||o.body?.url}</small></div></a>}
   </>}
  </div>
 </div>
}

function DiagramCard({object:o,selected}:{object:StudioObject;selected:boolean}){
 const ctx=useContext(CanvasContext)!;
 const role=diagramRole(o.body?.role);
 return <article className={`rf-diagram role-${role}`} data-diagram-role={role} data-testid="diagram-node">
  <small>{diagramRoleLabel(role)}</small>
  <strong>{o.title}</strong>
  {(selected)&&<button type="button" className="rf-diagram-plus nodrag nopan" aria-label="Следующий узел" onClick={()=>ctx.spawnDiagram(o.id)}>+</button>}
  {(selected)&&<div className="rf-diagram-actions nodrag nopan">
    <button type="button" onClick={()=>ctx.layoutMap(o.id,"row")}>В ряд</button>
    <button type="button" onClick={()=>ctx.layoutMap(o.id,"column")}>В столбец</button>
    <button type="button" onClick={()=>ctx.layoutMap(o.id,"tidy")}>Разложить</button>
  </div>}
 </article>;
}

function MidPreview({object:o}:{object:StudioObject}){
 if(o.kind==="image"||o.kind==="video")return <Asset object={o} compact/>;
 if(o.kind==="chart")return <div className="rf-mid-chart"><span>⌁</span><b>{o.title}</b></div>;
 if(o.kind==="text")return <div className="rf-mid-copy rf-mid-text" dangerouslySetInnerHTML={{__html:o.body?.html||`<p>${o.title}</p>`}}/>;
 if(o.kind==="task")return <Task object={o}/>;
 if(o.kind==="voice")return <div className="rf-mid-media"><Mic size={14}/><span>{o.body?.title||o.title}</span></div>;
 if(o.kind==="artifact"||o.kind==="deck")return <div className="rf-mid-copy"><span>{o.kind==="deck"?"▣":"→"}</span><strong>{o.title}</strong></div>;
 return <div className="rf-mid-copy"><span>{iconFor(o.kind)}</span><strong>{o.title}</strong></div>
}

function Asset({object:o,compact=false}:{object:StudioObject;compact?:boolean}){
 const [url,setUrl]=useState(o.body?.previewUrl||o.body?.url||"");
 useEffect(()=>{if(!url&&o.body?.assetId)void studioAction<any>("getAssetUrl",{assetId:o.body.assetId}).then(x=>setUrl(x.signedUrl||"")).catch(()=>{})},[url,o.body?.assetId]);
 if(o.kind==="image")return <div className="rf-asset">{url?<img src={url} alt={o.title} draggable={false}/>:<div className="rf-asset-empty"><ImageIcon size={compact?16:24}/></div>}</div>;
 if(o.kind==="video")return <div className="rf-asset rf-video nodrag nopan nowheel">{o.body?.embedUrl?<iframe src={o.body.embedUrl} title={o.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/>:url?<video controls src={url}/>:<div className="rf-asset-empty"><VideoIcon size={24}/><span>{o.title}</span></div>}{o.body?.embedUrl&&<em className="rf-video-meta">{o.body?.provider||"видео"}</em>}</div>;
 return <a className="rf-file nodrag nopan" href={url||o.body?.url||"#"} target="_blank" rel="noreferrer"><BookOpen size={16}/><div><strong>{o.body?.filename||o.title}</strong><small>{o.body?.mimeType||"файл"}</small></div></a>
}

function ChartBlock({object:o}:{object:StudioObject}){
 const family=o.body?.dataSpec?.instrument?.family||"SI";
 return <div className="rf-chart nodrag nopan nowheel">
  <header className="rf-chart-head"><b>{family}</b><span>MOEX</span><em>LIVE</em></header>
  <StudioMarketChart dataSpec={o.body?.dataSpec as DataSpec}/>
 </div>
}

function Task({object:o}:{object:StudioObject}){
 const ctx=useContext(CanvasContext)!, [v,setV]=useState(o.body?.title||o.title);
 return <div className="rf-task"><button className={"nodrag nopan"+(o.status==="DONE"?" is-done":"")} aria-pressed={o.status==="DONE"} onClick={()=>void ctx.patch(o.id,{status:o.status==="DONE"?"NEW":"DONE",body:{...o.body,done:o.status!=="DONE"}},"task","Статус задачи изменён")}>{o.status==="DONE"?"✓":""}</button><input className="nodrag nopan" value={v} aria-label="Задача" onChange={e=>setV(e.target.value)} onBlur={()=>{if(v!==(o.body?.title||o.title))void ctx.patch(o.id,{title:v,body:{...o.body,title:v}},"task","Задача обновлена")}}/></div>
}

function Voice({object:o}:{object:StudioObject}){
 const audio=useRef<HTMLAudioElement|null>(null);
 const [url,setUrl]=useState(o.body?.previewUrl||"");
 const [playing,setPlaying]=useState(false);
 useEffect(()=>{if(!url&&o.body?.assetId)void studioAction<any>("getAssetUrl",{assetId:o.body.assetId}).then(result=>setUrl(result.signedUrl||"")).catch(()=>{})},[url,o.body?.assetId]);
 const bars=Array.isArray(o.body?.waveform)&&o.body.waveform.length?o.body.waveform.slice(0,24):Array.from({length:18},(_,index)=>8+((o.title.charCodeAt(index%o.title.length)||12)%18));
 const transcript=String(o.body?.transcript||"");
 const toggle=()=>{const node=audio.current;if(!node)return;if(node.paused)void node.play().then(()=>setPlaying(true)).catch(()=>setPlaying(false));else{node.pause();setPlaying(false)}};
 return <div className="rf-voice" data-voice-id={o.id}>
  {url&&<audio ref={audio} src={url} preload="metadata" onEnded={()=>setPlaying(false)}/>}
  <button className="nodrag nopan" aria-label={playing?"Пауза":"Слушать"} onClick={toggle} disabled={!url}>{playing?"❚❚":"▶"}</button>
  <span className="rf-wave" aria-hidden>{bars.map((height:number,index:number)=><i key={index} style={{height}}/>)}</span>
  <b>{o.body?.duration||"—"}</b>
  <strong>{o.body?.title||o.title}</strong>
  <p>{transcript||(o.body?.transcriptStatus==="unavailable"?"Расшифровка недоступна в этом браузере.":"Расшифровка появится после записи.")}</p>
 </div>
}

export default ReactFlowWorldV6;

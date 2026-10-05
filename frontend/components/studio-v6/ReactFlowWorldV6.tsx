"use client";

import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from "react";
import {
 Background,BackgroundVariant,ConnectionLineType,Controls,Handle,NodeResizer,Position,ReactFlow,ReactFlowProvider,
 applyNodeChanges,type Connection,type Edge,type Node,type NodeChange,type NodeProps,type ReactFlowInstance
} from "@xyflow/react";
import {BookOpen,FileText,Image as ImageIcon,Maximize2,Mic,MousePointer2,Plus,Type,Video as VideoIcon,X} from "lucide-react";
import type {DataSpec,StudioObject} from "@/lib/studio-v5/types";
import {StudioMarketChart} from "@/components/studio-v5/MarketChart";
import {studioAction} from "@/lib/studio-v6/api";
import {RichEditor} from "./RichEditor";
import {classifyUrl,descendants,escapeHtml} from "./world-model";

type Lod="far"|"mid"|"near";
type InputProfile="mouse"|"trackpad";
type FlowData={object:StudioObject;lod:Lod;depth:number;signatures:Array<{kind:string;title:string}>;zoom:number};
type StudioNode=Node<FlowData,"workspace"|"content">;
type Props={objects:StudioObject[];selected:Set<string>;setSelected:(ids:Set<string>)=>void;focusId?:string|null;onObjectsLocal:(fn:(x:StudioObject[])=>StudioObject[])=>void;onPatch:(id:string,patch:any,eventType?:string,summary?:string)=>Promise<void>;onCreate:(kind:string,opts?:any)=>Promise<StudioObject>;onOpenDocument:(id:string)=>void;onRestore:(snapshot:StudioObject[])=>Promise<void>;notice:(s:string)=>void};

type CanvasActions={
 patch:(id:string,patch:any,eventType?:string,summary?:string)=>Promise<void>;
 resize:(id:string,p:{x:number;y:number;width:number;height:number})=>void;
 quickAdd:(frameId:string,kind:string)=>void;
 openDocument:(id:string)=>void;
};
const CanvasContext=createContext<CanvasActions|null>(null);
const nodeTypes:any={workspace:WorkspaceNode,content:ContentNode};
const VIEW_KEY="tqs-studio-v6-reactflow-viewport",PROFILE_KEY="tqs-studio-v6-rf-input-profile";

function depthOf(o:StudioObject,byId:Map<string,StudioObject>){let d=0,p=o.parent_id,guard=0;while(p&&guard++<20){d++;p=byId.get(p)?.parent_id||null}return d}
function flowPosition(o:StudioObject,byId:Map<string,StudioObject>){const p=o.parent_id?byId.get(o.parent_id):null;return p?{x:o.x-p.x,y:o.y-p.y}:{x:o.x,y:o.y}}
function semanticLabel(o:StudioObject,depth:number){if(o.id==="lesson-miro-scene")return"ЗАНЯТИЕ";if(depth===0)return"ПРОЕКТ";if(depth===1)return"КУРС";if(depth===2)return"ЗАНЯТИЕ";return"РАЗДЕЛ"}
function titleText(o:StudioObject){if(o.id==="frame-learning")return"ACADEMY · ОБУЧЕНИЕ";return o.title}
function iconFor(kind:string){return kind==="text"?"T":kind==="task"?"✓":kind==="voice"?"◉":kind==="image"?"▧":kind==="video"?"▶":kind==="chart"?"⌁":kind==="documentRef"?"D":kind==="link"?"↗":kind==="file"?"F":"•"}
function inputProfile(){try{const x=localStorage.getItem(PROFILE_KEY);if(x==="trackpad")return"trackpad"}catch{}return"mouse" as InputProfile}
function initialViewport(){try{const x=JSON.parse(localStorage.getItem(VIEW_KEY)||"null");if(x&&Number.isFinite(x.x)&&Number.isFinite(x.y)&&Number.isFinite(x.zoom))return x}catch{}return{x:-3400,y:-1160,zoom:.65}}
function absoluteFor(id:string,nodes:StudioNode[]){const m=new Map(nodes.map(n=>[n.id,n]));let n=m.get(id),x=0,y=0,guard=0;if(!n)return{x:0,y:0};x+=n.position.x;y+=n.position.y;let p=n.parentId;while(p&&guard++<30){const q=m.get(p);if(!q)break;x+=q.position.x;y+=q.position.y;p=q.parentId}return{x,y}}
function fileToDataUrl(file:File){return new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=()=>reject(r.error);r.readAsDataURL(file)})}

export function ReactFlowWorldV6(props:Props){
 return <ReactFlowProvider><ReactFlowWorldInner {...props}/></ReactFlowProvider>
}

function ReactFlowWorldInner({objects,selected,setSelected,focusId,onPatch,onCreate,onOpenDocument,notice}:Props){
 const [nodes,setNodes]=useState<StudioNode[]>([]),[zoom,setZoom]=useState(.65),[profile,setProfileState]=useState<InputProfile>(()=>typeof window==="undefined"?"mouse":inputProfile()),[menu,setMenu]=useState<{x:number;y:number;point:{x:number;y:number};id?:string}|null>(null);
 const rf=useRef<ReactFlowInstance<StudioNode,Edge>|null>(null),nodesRef=useRef<StudioNode[]>([]),pointer=useRef({x:900,y:500}),fileInput=useRef<HTMLInputElement|null>(null),fileTarget=useRef<{frameId?:string;kind:"image"|"video"}|null>(null),focusSeen=useRef<string|null>(null),focusIdRef=useRef<string|null>(focusId||null),byIdRef=useRef<Map<string,StudioObject>>(new Map()),lastNativePaste=useRef(0);
 const visibleObjects=useMemo(()=>objects.filter(o=>!o.hidden&&o.kind!=="annotation"),[objects]),byId=useMemo(()=>new Map(objects.map(o=>[o.id,o])),[objects]),lod:Lod=zoom<.28?"far":zoom<.6?"mid":"near";
 focusIdRef.current=focusId||null;byIdRef.current=byId;
 const focusCanonical=useCallback((instance:ReactFlowInstance<StudioNode,Edge>,id:string)=>{const o=byIdRef.current.get(id);if(!o)return false;const el=document.querySelector(".rf-studio-canvas") as HTMLElement|null,r=el?.getBoundingClientRect();if(!r)return false;const z=Math.min(.92,Math.max(.18,Math.min((r.width-120)/Math.max(1,o.w),(r.height-120)/Math.max(1,o.h))));focusSeen.current=id;void instance.setViewport({x:r.width/2-(o.x+o.w/2)*z,y:r.height/2-(o.y+o.h/2)*z,zoom:z},{duration:420});return true},[]);
 const directChildren=useMemo(()=>{const m=new Map<string,StudioObject[]>();for(const o of visibleObjects){if(!o.parent_id)continue;const a=m.get(o.parent_id)||[];a.push(o);m.set(o.parent_id,a)}return m},[visibleObjects]);

 const buildNodes=useCallback(()=>visibleObjects
  .slice()
  .sort((a,b)=>depthOf(a,byId)-depthOf(b,byId)||a.z-b.z)
  .map(o=>{
   const depth=depthOf(o,byId),isWorkspace=o.kind==="frame",signatures=(directChildren.get(o.id)||[]).filter(x=>x.kind!=="frame").slice(0,3).map(x=>({kind:x.kind,title:x.title}));
   const n:StudioNode={id:o.id,type:isWorkspace?"workspace":"content",position:flowPosition(o,byId),width:o.w,height:o.h,parentId:o.parent_id||undefined,zIndex:o.z,dragHandle:".tqs-drag-handle",data:{object:o,lod,depth,signatures,zoom}};
   if(!isWorkspace&&lod==="far")n.hidden=true;
   return n
  }),[visibleObjects,byId,directChildren,lod,zoom]);

 useEffect(()=>{const next=buildNodes();setNodes(next);nodesRef.current=next},[buildNodes]);
 useEffect(()=>{nodesRef.current=nodes},[nodes]);

 const edges=useMemo<Edge[]>(()=>objects.filter(o=>!o.hidden&&o.kind==="annotation"&&o.body?.annotationKind==="arrow").flatMap(o=>{
  const from=o.body?.fromId||o.relations?.find((r:any)=>r.type==="connects_from")?.targetId,to=o.body?.toId||o.relations?.find((r:any)=>r.type==="connects_to")?.targetId;
  if(!from||!to||!byId.has(from)||!byId.has(to))return[];
  return[{id:o.id,source:from,target:to,type:"smoothstep",animated:false,selectable:true,style:{strokeWidth:2}}]
 }),[objects,byId]);

 const setProfile=(p:InputProfile)=>{setProfileState(p);try{localStorage.setItem(PROFILE_KEY,p)}catch{}};
 const persistResize=useCallback((id:string,p:{x:number;y:number;width:number;height:number})=>{const n=nodesRef.current.find(x=>x.id===id);if(!n)return;let base={x:0,y:0};if(n.parentId)base=absoluteFor(n.parentId,nodesRef.current);void onPatch(id,{x:base.x+p.x,y:base.y+p.y,w:p.width,h:p.height},"resize","Размер изменён")},[onPatch]);
 const quickAdd=useCallback((frameId:string,kind:string)=>{
  const frame=byId.get(frameId);if(!frame)return;
  if(kind==="image"||kind==="video"){fileTarget.current={frameId,kind:kind as"image"|"video"};const el=fileInput.current;if(el){el.accept=kind==="image"?"image/*":"video/*";el.value="";el.click()}return}
  const kids=directChildren.get(frameId)||[],p={x:frame.x+110+(kids.length%3)*48,y:frame.y+150+(kids.length%4)*38};
  const extra=kind==="chart"?{body:{dataSpec:{provider:"MOEX_ISS",instrument:{family:"SI",resolver:"front_active_contract"},metric:"ohlcv_session",relativeRange:{tradingSessions:2},fixedRange:null,transforms:["group_by_session","cumulative_volume"],display:{renderer:"studio_market_chart"},updatePolicy:"LIVE",asOf:null}}}:kind==="text"?{body:{html:"<p>Новый текст</p>"}}:{};
  void onCreate(kind,{point:p,...extra})
 },[byId,directChildren,onCreate]);
 const actions=useMemo<CanvasActions>(()=>({patch:onPatch,resize:persistResize,quickAdd,openDocument:onOpenDocument}),[onPatch,persistResize,quickAdd,onOpenDocument]);

 const onNodesChange=(changes:NodeChange<StudioNode>[])=>setNodes(ns=>{const next=applyNodeChanges(changes,ns) as StudioNode[];nodesRef.current=next;return next});
 const persistDrag=useCallback(async(node:StudioNode)=>{
  const now=nodesRef.current,abs=absoluteFor(node.id,now),o=byId.get(node.id);if(!o)return;
  let parentId=node.parentId||null;
  if(o.kind!=="frame"){
   const box={x:abs.x+(node.width||o.w)/2,y:abs.y+(node.height||o.h)/2};
   const candidates=now.filter(n=>n.type==="workspace"&&n.id!==node.id).map(n=>({n,p:absoluteFor(n.id,now),area:(n.width||1)*(n.height||1)})).filter(x=>box.x>=x.p.x&&box.x<=x.p.x+(x.n.width||0)&&box.y>=x.p.y&&box.y<=x.p.y+(x.n.height||0)).sort((a,b)=>a.area-b.area);
   parentId=candidates[0]?.n.id||null
  }
  const parentObj=parentId?byId.get(parentId):null,newPath=parentObj?parentObj.semantic_path+"/"+o.title:o.title;
  await onPatch(o.id,{x:abs.x,y:abs.y,parent_id:parentId,semantic_path:newPath,relations:[...(o.relations||[]).filter((r:any)=>r.type!=="contains"),...(parentId?[{type:"contains",targetId:parentId}]:[])]},"semantic_move","Объект перемещён");
  if(o.kind==="frame"){
   for(const id of descendants(o.id,objects)){const child=byId.get(id);if(!child)continue;const p=absoluteFor(id,now);await onPatch(id,{x:p.x,y:p.y},"semantic_move","Перемещено вместе с рабочим пространством")}
  }
 },[byId,onPatch,objects]);

 const addAt=useCallback(async(kind:string,point?:{x:number;y:number})=>{
  const p=point||rf.current?.screenToFlowPosition(pointer.current)||{x:900,y:600};
  const extra=kind==="frame"?{title:"Новое рабочее пространство",w:1320,h:820,body:{workspaceCard:true}}:kind==="text"?{body:{html:"<p>Новый текст</p>"}}:kind==="chart"?{body:{dataSpec:{provider:"MOEX_ISS",instrument:{family:"SI",resolver:"front_active_contract"},metric:"ohlcv_session",relativeRange:{tradingSessions:2},fixedRange:null,transforms:["group_by_session","cumulative_volume"],display:{renderer:"studio_market_chart"},updatePolicy:"LIVE",asOf:null}}}:{};
  await onCreate(kind,{point:p,...extra});setMenu(null)
 },[onCreate]);

 const classify=useCallback(async(text:string,point?:{x:number;y:number})=>{
  const t=text.trim();if(!t)return;const p=point||rf.current?.screenToFlowPosition(pointer.current)||{x:900,y:600},u=classifyUrl(t);
  if(u?.kind==="video"){await onCreate("video",{point:p,title:u.provider==="youtube"?"YouTube":u.provider==="rutube"?"RuTube":"Vimeo",body:{url:u.url,embedUrl:u.embed,provider:u.provider}});return}
  if(u?.kind==="image"){await onCreate("image",{point:p,title:"Изображение",body:{url:u.url,provider:"url"}});return}
  if(u?.kind==="file"){await onCreate("file",{point:p,title:u.filename,body:{url:u.url,filename:u.filename,mimeType:"application/pdf"}});return}
  if(u){await onCreate("link",{point:p,title:u.host||"Ссылка",body:{url:u.url,host:u.host}});return}
  await onCreate("text",{point:p,title:"Текст",body:{html:`<p>${escapeHtml(t)}</p>`}})
 },[onCreate]);

 const handleClipboardFiles=useCallback(async(files:File[])=>{const p=rf.current?.screenToFlowPosition(pointer.current);for(const [i,file] of files.entries()){const dataUrl=await fileToDataUrl(file),a=await studioAction<any>("attachAsset",{dataUrl,filename:file.name}),kind=file.type.startsWith("image/")?"image":file.type.startsWith("video/")?"video":"file";await onCreate(kind,{point:{x:(p?.x||900)+i*26,y:(p?.y||600)+i*26},title:file.name,body:{assetId:a.asset.id,previewUrl:a.signedUrl||dataUrl,mimeType:file.type,filename:file.name}})}},[onCreate]);
 const consumeClipboard=useCallback((data:DataTransfer|null)=>{if(!data)return false;const files=Array.from(data.files);if(files.length){lastNativePaste.current=performance.now();void handleClipboardFiles(files);return true}const text=data.getData("text/plain");if(text){lastNativePaste.current=performance.now();void classify(text);return true}return false},[classify,handleClipboardFiles]);
 useEffect(()=>{const editable=(target:EventTarget|null)=>{const el=target as HTMLElement|null,tag=el?.tagName||"";return Boolean(el?.isContentEditable||["INPUT","TEXTAREA","SELECT"].includes(tag))};const handler=(e:ClipboardEvent)=>{if(editable(e.target))return;if(consumeClipboard(e.clipboardData)){e.preventDefault();e.stopPropagation()}};const keydown=(e:KeyboardEvent)=>{if(editable(e.target)||!(e.ctrlKey||e.metaKey)||e.key.toLowerCase()!=="v")return;setTimeout(()=>{if(performance.now()-lastNativePaste.current<180)return;void navigator.clipboard?.readText().then(text=>{if(text)void classify(text)}).catch(()=>{})},0)};window.addEventListener("paste",handler,true);window.addEventListener("keydown",keydown,true);return()=>{window.removeEventListener("paste",handler,true);window.removeEventListener("keydown",keydown,true)}},[classify,consumeClipboard]);

 useEffect(()=>{if(!focusId||!rf.current||focusSeen.current===focusId)return;focusCanonical(rf.current,focusId)},[focusId,nodes,focusCanonical]);
 useEffect(()=>{if(!focusId)focusSeen.current=null},[focusId]);

 const duplicate=async(id:string)=>{const o=byId.get(id);if(!o)return;await onCreate(o.kind,{point:{x:o.x+48,y:o.y+48},w:o.w,h:o.h,title:o.title,body:structuredClone(o.body),status:o.status,relations:structuredClone(o.relations||[]) });setMenu(null)};
 const remove=async(id:string)=>{const o=byId.get(id);if(!o)return;const ids=o.kind==="frame"?[id,...descendants(id,objects)]:[id];for(const x of ids)await onPatch(x,{hidden:true},"hide","Скрыто");setMenu(null)};
 const connect=async(c:Connection)=>{if(!c.source||!c.target)return;const a=byId.get(c.source),b=byId.get(c.target);if(!a||!b)return;const ax=a.x+a.w/2,ay=a.y+a.h/2,bx=b.x+b.w/2,by=b.y+b.h/2;await onCreate("annotation",{point:{x:Math.min(ax,bx),y:Math.min(ay,by)},w:Math.max(20,Math.abs(bx-ax)),h:Math.max(20,Math.abs(by-ay)),title:"Связь",body:{annotationKind:"arrow",fromId:a.id,toId:b.id,points:[{x:0,y:0},{x:Math.abs(bx-ax),y:Math.abs(by-ay)}]},relations:[{type:"connects_from",targetId:a.id},{type:"connects_to",targetId:b.id}]})};

 return <CanvasContext.Provider value={actions}>
  <section className="rf-studio-canvas" data-testid="world-canvas-v6" tabIndex={0} onPointerDown={e=>{if(e.currentTarget===e.target)e.currentTarget.focus()}} onPointerMove={e=>{pointer.current={x:e.clientX,y:e.clientY}}} onPasteCapture={e=>{if(consumeClipboard(e.clipboardData)){e.preventDefault();e.stopPropagation()}}}>
   <input ref={fileInput} className="v6-file-picker" type="file" tabIndex={-1} onChange={e=>{const file=e.currentTarget.files?.[0],target=fileTarget.current;fileTarget.current=null;if(!file||!target)return;void (async()=>{const dataUrl=await fileToDataUrl(file),a=await studioAction<any>("attachAsset",{dataUrl,filename:file.name}),frame=target.frameId?byId.get(target.frameId):null,p=frame?{x:frame.x+140,y:frame.y+180}:rf.current?.screenToFlowPosition(pointer.current)||{x:900,y:600};await onCreate(target.kind,{point:p,title:file.name,body:{assetId:a.asset.id,previewUrl:a.signedUrl||dataUrl,mimeType:file.type,filename:file.name}})})()}}/>
   <ReactFlow<StudioNode,Edge>
    nodes={nodes} edges={edges} nodeTypes={nodeTypes}
    onNodesChange={onNodesChange}
    onNodeDragStop={(_,node)=>void persistDrag(node)}
    onNodeClick={(_,node)=>setSelected(new Set([node.id]))}
    onConnect={c=>void connect(c)}
    onNodesDelete={ns=>{for(const n of ns)void remove(n.id)}}
    onInit={instance=>{rf.current=instance;const id=focusIdRef.current;if(id)requestAnimationFrame(()=>{if(!focusCanonical(instance,id))instance.setViewport(initialViewport())});else instance.setViewport(initialViewport())}}
    onMove={(_,v)=>setZoom(v.zoom)}
    onMoveEnd={(_,v)=>{setZoom(v.zoom);try{localStorage.setItem(VIEW_KEY,JSON.stringify(v))}catch{}}}
    onPaneContextMenu={e=>{e.preventDefault();const rect=(e.currentTarget as HTMLElement).getBoundingClientRect(),p=rf.current?.screenToFlowPosition({x:e.clientX,y:e.clientY})||{x:0,y:0};setMenu({x:e.clientX-rect.left,y:e.clientY-rect.top,point:p})}}
    onNodeContextMenu={(e,node)=>{e.preventDefault();const rect=(e.currentTarget as HTMLElement).getBoundingClientRect();setSelected(new Set([node.id]));setMenu({x:e.clientX-rect.left,y:e.clientY-rect.top,point:absoluteFor(node.id,nodesRef.current),id:node.id})}}
    onPaneClick={()=>setMenu(null)}
    minZoom={.08} maxZoom={2.4}
    zoomOnScroll={profile==="mouse"} zoomOnPinch panOnScroll={profile==="trackpad"} panOnScrollSpeed={.75}
    panOnDrag={[1,2]} panActivationKeyCode="Space" selectionOnDrag selectionMode={"partial" as any}
    multiSelectionKeyCode={["Control","Meta"]} deleteKeyCode={["Delete","Backspace"]}
    connectionLineType={ConnectionLineType.SmoothStep}
    fitViewOptions={{padding:.12,maxZoom:.9}}
   >
    <Background variant={BackgroundVariant.Dots} gap={24} size={1}/>
    <Controls position="bottom-right" showInteractive={false} fitViewOptions={{padding:.12,maxZoom:.9}}/>
   </ReactFlow>

   <div className="rf-studio-toolbar" data-studio-ui>
    <button title="Выбор"><MousePointer2 size={15}/></button>
    <button onClick={()=>void addAt("text")}><Type size={15}/><span>Текст</span></button>
    <button onClick={()=>{fileTarget.current={kind:"image"};const el=fileInput.current;if(el){el.accept="image/*";el.value="";el.click()}}}><ImageIcon size={15}/><span>Фото</span></button>
    <button onClick={()=>{fileTarget.current={kind:"video"};const el=fileInput.current;if(el){el.accept="video/*";el.value="";el.click()}}}><VideoIcon size={15}/><span>Видео</span></button>
    <button onClick={()=>void addAt("chart")}><span className="rf-glyph">⌁</span><span>Интерактив</span></button>
    <button className="rf-add-workspace" onClick={()=>void addAt("frame")}><Plus size={15}/><span>Пространство</span></button>
   </div>
   <div className="rf-profile" data-studio-ui><span>{Math.round(zoom*100)}%</span><button className={profile==="mouse"?"active":""} onClick={()=>setProfile("mouse")}>Мышь</button><button className={profile==="trackpad"?"active":""} onClick={()=>setProfile("trackpad")}>Трекпад</button></div>

   {menu&&<div className="rf-context" style={{left:menu.x,top:menu.y}} data-studio-ui>
    <header><strong>{menu.id?byId.get(menu.id)?.title||"Объект":"Добавить сюда"}</strong><button onClick={()=>setMenu(null)}><X size={13}/></button></header>
    {menu.id?<><button onClick={()=>void duplicate(menu.id!)}>Дублировать</button><button className="danger" onClick={()=>void remove(menu.id!)}>Удалить</button></>:<>
     <button onClick={()=>void addAt("text",menu.point)}>Текст</button><button onClick={()=>void addAt("task",menu.point)}>Задача</button><button onClick={()=>void addAt("voice",menu.point)}>Голосовая заметка</button><button onClick={()=>void addAt("chart",menu.point)}>Интерактив / график</button><button onClick={()=>void addAt("frame",menu.point)}>Рабочее пространство</button>
    </>}
   </div>}
  </section>
 </CanvasContext.Provider>
}

function WorkspaceNode({id,data,selected}:NodeProps<StudioNode>){
 const ctx=useContext(CanvasContext)!,o=data.object,scale=data.lod==="far"?Math.min(3.4,Math.max(1,0.62/data.zoom)):data.lod==="mid"?Math.min(1.8,Math.max(1,0.7/data.zoom)):1;
 return <div className={`rf-workspace-card lod-${data.lod} level-${data.depth}`} data-studio-id={id} data-testid="world-frame">
  <NodeResizer isVisible={selected} minWidth={520} minHeight={320} onResizeEnd={(_,p)=>ctx.resize(id,p)}/>
  <Handle type="target" position={Position.Left} className="rf-handle"/><Handle type="source" position={Position.Right} className="rf-handle"/>
  <header className="rf-workspace-head tqs-drag-handle" style={{["--semantic-scale" as any]:scale}}>
   <span className="rf-workspace-kicker">{semanticLabel(o,data.depth)}</span>
   <strong>{titleText(o)}</strong>
   <small>{data.signatures.length?data.signatures.length+" ключевых материала":o.semantic_path}</small>
   <div className="rf-workspace-actions nodrag nopan" onPointerDown={e=>e.stopPropagation()}>
    <button onClick={()=>ctx.quickAdd(id,"text")}>+ Текст</button><button onClick={()=>ctx.quickAdd(id,"image")}>+ Фото</button><button onClick={()=>ctx.quickAdd(id,"video")}>+ Видео</button><button onClick={()=>ctx.quickAdd(id,"chart")}>+ Интерактив</button>
   </div>
  </header>
  {data.lod!=="near"&&<div className="rf-workspace-signatures" style={{["--semantic-scale" as any]:scale}}>{data.signatures.map((s,i)=><span key={i}><b>{iconFor(s.kind)}</b>{s.title}</span>)}</div>}
  {data.lod==="near"&&<div className="rf-workspace-hint">Тяните за заголовок — двигается всё пространство. Внутренние блоки двигаются независимо.</div>}
 </div>
}

function ContentNode({id,data,selected}:NodeProps<StudioNode>){
 const ctx=useContext(CanvasContext)!,o=data.object;
 const [editing,setEditing]=useState(false);
 if(data.lod==="far")return null;
 return <div className={`rf-content-node kind-${o.kind} lod-${data.lod} ${selected?"is-selected":""}`} data-studio-id={id} data-testid={`world-${o.kind}`}>
  <NodeResizer isVisible={selected} minWidth={120} minHeight={54} onResizeEnd={(_,p)=>ctx.resize(id,p)}/>
  <Handle type="target" position={Position.Left} className="rf-handle"/><Handle type="source" position={Position.Right} className="rf-handle"/>
  <div className="rf-node-grip tqs-drag-handle"><span>{iconFor(o.kind)}</span><strong>{o.title}</strong></div>
  <div className="rf-node-body">
   {data.lod==="mid"?<MidPreview object={o}/>:<>
    {o.kind==="text"&&(editing?<RichEditor html={o.body?.html||"<p></p>"} autofocus onBlur={html=>{void ctx.patch(o.id,{body:{...o.body,html}},"text_update","Текст обновлён");setEditing(false)}}/>:<div className="rf-rich-text nodrag nopan" onDoubleClick={()=>setEditing(true)} dangerouslySetInnerHTML={{__html:o.body?.html||"<p></p>"}}/>)}
    {o.kind==="image"&&<Asset object={o}/>}
    {o.kind==="video"&&<Asset object={o}/>}
    {o.kind==="file"&&<Asset object={o}/>}
    {o.kind==="chart"&&<div className="rf-chart nodrag nopan nowheel"><StudioMarketChart dataSpec={o.body?.dataSpec as DataSpec}/></div>}
    {o.kind==="task"&&<Task object={o}/>}
    {o.kind==="voice"&&<Voice object={o}/>}
    {o.kind==="documentRef"&&<button className="rf-document nodrag nopan" onClick={()=>ctx.openDocument(o.body?.documentId||o.relations?.find((r:any)=>r.type==="document_of")?.targetId)}><BookOpen size={18}/><div><strong>{o.title}</strong><span>Открыть материал / статью</span></div></button>}
    {o.kind==="link"&&<a className="rf-link nodrag nopan" href={o.body?.url||"#"} target="_blank" rel="noreferrer"><span>↗</span><div><strong>{o.title}</strong><small>{o.body?.host||o.body?.url}</small></div></a>}
   </>}
  </div>
 </div>
}

function MidPreview({object:o}:{object:StudioObject}){
 if(o.kind==="image")return <Asset object={o} compact/>;
 if(o.kind==="video")return <div className="rf-mid-media"><VideoIcon size={20}/><span>{o.title}</span></div>;
 if(o.kind==="chart")return <div className="rf-mid-chart"><span>⌁</span><b>{o.title}</b><small>интерактивные данные</small></div>;
 return <div className="rf-mid-copy"><span>{iconFor(o.kind)}</span><strong>{o.title}</strong></div>
}

function Asset({object:o,compact=false}:{object:StudioObject;compact?:boolean}){
 const [url,setUrl]=useState(o.body?.previewUrl||o.body?.url||"");
 useEffect(()=>{if(!url&&o.body?.assetId)void studioAction<any>("getAssetUrl",{assetId:o.body.assetId}).then(x=>setUrl(x.signedUrl||"")).catch(()=>{})},[url,o.body?.assetId]);
 if(o.kind==="image")return <div className="rf-asset nodrag nopan">{url?<img src={url} alt={o.title}/>:<div className="rf-asset-empty"><ImageIcon size={24}/><span>Фото / скриншот</span></div>}</div>;
 if(o.kind==="video")return <div className="rf-asset nodrag nopan nowheel">{o.body?.embedUrl?<iframe src={o.body.embedUrl} title={o.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/>:url?<video controls src={url}/>:<div className="rf-asset-empty"><VideoIcon size={24}/><span>Видео</span></div>}</div>;
 return <a className="rf-file nodrag nopan" href={url||o.body?.url||"#"} target="_blank" rel="noreferrer"><FileText size={20}/><div><strong>{o.body?.filename||o.title}</strong><small>{o.body?.mimeType||"файл"}</small></div></a>
}

function Task({object:o}:{object:StudioObject}){
 const ctx=useContext(CanvasContext)!, [v,setV]=useState(o.body?.title||o.title);
 return <div className="rf-task nodrag nopan"><button onClick={()=>void ctx.patch(o.id,{status:o.status==="DONE"?"NEW":"DONE",body:{...o.body,done:o.status!=="DONE"}},"task","Статус задачи изменён")}>{o.status==="DONE"?"✓":"○"}</button><input value={v} onChange={e=>setV(e.target.value)} onBlur={()=>{if(v!==(o.body?.title||o.title))void ctx.patch(o.id,{title:v,body:{...o.body,title:v}},"task","Задача обновлена")}}/></div>
}
function Voice({object:o}:{object:StudioObject}){return <div className="rf-voice nodrag nopan"><Mic size={18}/><div><strong>{o.title}</strong><span>{o.body?.status||"Голосовая заметка"}</span></div></div>}

export default ReactFlowWorldV6;

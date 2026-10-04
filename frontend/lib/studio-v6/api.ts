"use client";
import {createClient,type SupabaseClient} from "@supabase/supabase-js";
import {getLocalAssetPayload,localStudioAction} from "@/lib/studio-v5/local-store";

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||"https://hppbuzbrjoyrwpdinlxk.supabase.co";
const SUPABASE_PUBLIC_KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"sb_publishable_FPnSkBjbvgAW0VBE_u4_Kw_QAfJ_DFh";
const FN=`${SUPABASE_URL}/functions/v1/studio-api`;
const OUTBOX_KEY="tqs-studio-v6-sync-outbox-v1";
let client:SupabaseClient|null=null;
export function studioSupabase(){if(!client)client=createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});return client}
export async function studioSession(){const {data,error}=await studioSupabase().auth.getSession();if(error)throw error;return data.session}

type SyncJob={key:string;action:string;payload:any;createdAt:number;attempts:number};
let flushing=false,syncTimer:number|null=null;
const SERVER_ONLY=new Set(["createShare","configureDriveOAuth","driveListRoot","driveSyncCheckpoint","driveConflictProbe","getStudioContext","getChangeHistory","aiApplyMutation","undoAiRun","aiCreateDocumentFromFrame","redoAiRun"]);
const LOCAL_CAPABLE=new Set(["ensureSeed","getWorldOverview","getEntityContext","getRecentActivity","getDocument","listDocuments","driveStatus","createDocument","upsertDocumentBlock","reorderDocumentBlock","createWorldObject","updateObject","markActivityDone"]);
function productionServer(){return typeof window!=="undefined"&&!["localhost","127.0.0.1"].includes(window.location.hostname)}
function readOutbox():SyncJob[]{try{const x=JSON.parse(localStorage.getItem(OUTBOX_KEY)||"[]");return Array.isArray(x)?x:[]}catch{return[]}}
function writeOutbox(j:SyncJob[]){try{localStorage.setItem(OUTBOX_KEY,JSON.stringify(j.slice(-250)))}catch{}}
function syncKey(action:string,p:any){return action+":"+String(p?.object?.id||p?.id||p?.documentId||"")+":"+String(p?.blockId||"")}
function enqueue(action:string,payload:any){if(!productionServer())return;const key=syncKey(action,payload),jobs=readOutbox(),i=jobs.findIndex(j=>j.key===key),next={key,action,payload,createdAt:Date.now(),attempts:0};if(i>=0)jobs[i]={...jobs[i],payload,createdAt:Date.now()};else jobs.push(next);writeOutbox(jobs)}
async function serverAction<T=any>(action:string,payload:any={}):Promise<T>{const ctrl=new AbortController(),timeout=action==="createShare"?35000:10000,timer=window.setTimeout(()=>ctrl.abort(),timeout);try{const r=await fetch("/api/studio/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,payload}),cache:"no-store",signal:ctrl.signal});const x=await r.json();if(!r.ok||!x.ok)throw Object.assign(new Error(x.error||`Studio API ${r.status}`),{details:x,status:r.status});return x.data as T}finally{window.clearTimeout(timer)}}
async function materialize(job:SyncJob){if(job.action!=="attachAsset")return job.payload;const a=getLocalAssetPayload(String(job.payload?.assetId||""));if(!a)throw new Error("LOCAL_ASSET_MISSING");return{dataUrl:a.dataUrl,filename:job.payload?.filename||a.filename,assetId:a.assetId}}
export function studioSyncStatus(){const jobs=typeof window==="undefined"?[]:readOutbox();return{pending:jobs.length,oldestAt:jobs[0]?.createdAt||null,flushing}}
export async function flushStudioSync(){if(flushing||!productionServer())return studioSyncStatus();flushing=true;try{let jobs=readOutbox(),processed=0;while(jobs.length&&processed<25){const job=jobs[0];try{await serverAction(job.action,await materialize(job));jobs.shift();writeOutbox(jobs);processed++}catch{job.attempts++;jobs[0]=job;writeOutbox(jobs);break}}return{pending:jobs.length,processed}}finally{flushing=false}}
function schedule(delay=250){if(typeof window==="undefined"||!productionServer()||syncTimer!==null)return;syncTimer=window.setTimeout(()=>{syncTimer=null;void flushStudioSync()},delay)}

export async function studioAction<T=any>(action:string,payload:any={}):Promise<T>{
 schedule();
 if(action==="createDocument"&&!payload.id)payload={...payload,id:"doc-"+crypto.randomUUID()};
 if(action==="attachAsset"){
  const local:any=await localStudioAction<any>(action,payload);
  if(!productionServer())return local as T;
  try{const server=await serverAction<T>(action,{...payload,assetId:local?.asset?.id});return server}catch{enqueue(action,{assetId:local?.asset?.id,filename:payload?.filename});schedule(80);return local as T}
 }
 if(SERVER_ONLY.has(action))return serverAction<T>(action,payload);
 if(!LOCAL_CAPABLE.has(action))return serverAction<T>(action,payload);
 if(productionServer()){
  try{
   const server=await serverAction<T>(action,payload);
   // Mirror server truth locally only for resilient reloads; the returned value is always canonical server state.
   if(["ensureSeed","createDocument","upsertDocumentBlock","reorderDocumentBlock","createWorldObject","updateObject","markActivityDone"].includes(action))void localStudioAction(action,payload).catch(()=>{});
   return server;
  }catch(error){
   // Offline fallback is explicit: local state remains usable and the mutation is queued for canonical sync.
   if(["createDocument","upsertDocumentBlock","reorderDocumentBlock","createWorldObject","updateObject","markActivityDone"].includes(action)){const local=await localStudioAction<T>(action,payload);enqueue(action,payload);schedule(100);return local}
   return localStudioAction<T>(action,payload);
  }
 }
 return localStudioAction<T>(action,payload);
}

export async function secureStudioAction<T=any>(action:string,payload:any={}):Promise<T>{
 const session=await studioSession();if(!session)throw Object.assign(new Error("AUTH_REQUIRED"),{status:401});
 const ctrl=new AbortController(),timer=window.setTimeout(()=>ctrl.abort(),20000);
 try{
  const r=await fetch(`${FN}/action`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action,payload}),cache:"no-store",signal:ctrl.signal});
  const x=await r.json();if(!r.ok||!x.ok)throw Object.assign(new Error(x.error||`Studio API ${r.status}`),{details:x,status:r.status});return x.data as T;
 }finally{window.clearTimeout(timer)}
}
export async function driveOAuthStart(returnTo:string){const session=await studioSession();if(!session)throw new Error("AUTH_REQUIRED");const r=await fetch(`${FN}/oauth/start?return_to=${encodeURIComponent(returnTo)}`,{headers:{Authorization:`Bearer ${session.access_token}`}});const x=await r.json();if(!r.ok)throw Object.assign(new Error(x.code||x.error||"OAUTH_START_FAILED"),{details:x,status:r.status});return x as{url:string;redirectUri:string;scopes:string[]}}
export async function ownerMagicLink(email:string){return studioSupabase().auth.signInWithOtp({email,options:{emailRedirectTo:window.location.href}})}
export async function studioSignOut(){return studioSupabase().auth.signOut()}


export type StudioContextRequest={objectIds?:string[];blockIds?:string[];frameId?:string|null;documentId?:string|null;selectionBounds?:any;pointer?:{x:number;y:number}|null;viewport?:{x:number;y:number;zoom:number;width?:number;height?:number}|null};
export async function studioStructuredContext(context:StudioContextRequest){return studioAction("getStudioContext",context)}
export async function studioAiMutate(args:{context:StudioContextRequest;scope?:"selection"|"world";generationRunId?:string;actor?:string;sourceRefs?:any[];mutations:Array<{operation:"create";object:any;summary?:string}|{operation:"update";id:string;patch:any;summary?:string}>}){return studioAction("aiApplyMutation",args)}
export async function studioAiUndo(generationRunId:string){return studioAction("undoAiRun",{generationRunId,actor:"chatgpt"})}
export async function studioChangeHistory(args:{entityId?:string;generationRunId?:string;limit?:number}={}){return studioAction("getChangeHistory",args)}

export async function studioAiRedo(generationRunId:string){return studioAction("redoAiRun",{generationRunId,actor:"chatgpt"})}

export async function studioAiDocumentFromFrame(args:{frameId:string;title?:string;kind?:string;generationRunId?:string;actor?:string;sourceRefs?:any[]}){return studioAction("aiCreateDocumentFromFrame",{actor:"chatgpt",...args})}

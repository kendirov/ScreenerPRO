"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getLocalAssetPayload, localStudioAction } from "./local-store";
import type {DocumentBundle} from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hppbuzbrjoyrwpdinlxk.supabase.co";
const SUPABASE_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_FPnSkBjbvgAW0VBE_u4_Kw_QAfJ_DFh";
const FN = `${SUPABASE_URL}/functions/v1/studio-api`;
const OUTBOX_KEY="tqs-studio-v5-sync-outbox-v1";

let client: SupabaseClient|null=null;
export function studioSupabase(){ if(!client) client=createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}); return client; }

export async function studioSession(){
  const {data,error}=await studioSupabase().auth.getSession(); if(error) throw error; return data.session;
}

const LOCAL_READS=new Set(["ensureSeed","getWorldOverview","getEntityContext","getRecentActivity","getDocument","listDocuments","driveStatus"]);
const LOCAL_WRITES=new Set(["createDocument","upsertDocumentBlock","reorderDocumentBlock","createWorldObject","updateObject","markActivityDone"]);
const SERVER_ONLY=new Set(["createShare","configureDriveOAuth","driveListRoot","driveSyncCheckpoint","driveConflictProbe"]);

type SyncJob={key:string;action:string;payload:any;createdAt:number;attempts:number};
let flushing=false,syncTimer:number|null=null;
function serverSyncEnabled(){
  if(typeof window==="undefined")return false;
  return !["localhost","127.0.0.1"].includes(window.location.hostname);
}

function readOutbox():SyncJob[]{
  if(typeof window==="undefined")return [];
  try{const x=JSON.parse(localStorage.getItem(OUTBOX_KEY)||"[]");return Array.isArray(x)?x:[]}catch{return []}
}
function writeOutbox(jobs:SyncJob[]){
  if(typeof window==="undefined")return;
  try{localStorage.setItem(OUTBOX_KEY,JSON.stringify(jobs.slice(-200)))}catch{}
}
function syncKey(action:string,p:any){
  if(action==="createWorldObject"||action==="updateObject")return action+":"+String(p?.object?.id||p?.id||"");
  if(action==="createDocument")return action+":"+String(p?.id||"");
  if(action==="upsertDocumentBlock"||action==="reorderDocumentBlock")return action+":"+String(p?.documentId||"")+":"+String(p?.blockId||"");
  if(action==="markActivityDone")return action+":"+String(p?.id||"");
  if(action==="attachAsset")return action+":"+String(p?.assetId||"");
  return action+":"+crypto.randomUUID();
}
function enqueueSync(action:string,payload:any){
  if(!serverSyncEnabled())return;
  const key=syncKey(action,payload),jobs=readOutbox(),next:{key:string;action:string;payload:any;createdAt:number;attempts:number}={key,action,payload,createdAt:Date.now(),attempts:0};
  const i=jobs.findIndex(j=>j.key===key);if(i>=0)jobs[i]={...jobs[i],payload,createdAt:Date.now()};else jobs.push(next);
  writeOutbox(jobs);
}
function isIdempotentDuplicate(error:any){
  const raw=JSON.stringify(error?.details||error?.message||error||"");return raw.includes("23505")||raw.toLowerCase().includes("duplicate key");
}

async function serverAction<T=any>(action:string,payload:any={}):Promise<T>{
  const ctrl=new AbortController();const timer=window.setTimeout(()=>ctrl.abort(),7800);
  try{
    const r=await fetch("/api/studio/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,payload}),cache:"no-store",signal:ctrl.signal});
    const x=await r.json();
    if(x?.deferred)throw Object.assign(new Error(x.error||"STUDIO_SYNC_DEFERRED"),{details:x,status:r.status,deferred:true});
    if(!r.ok||!x.ok)throw Object.assign(new Error(x.error||`Studio API ${r.status}`),{details:x.details,status:r.status});
    return x.data as T;
  }finally{window.clearTimeout(timer)}
}

async function materialize(job:SyncJob){
  if(job.action!=="attachAsset")return job.payload;
  const asset=getLocalAssetPayload(String(job.payload?.assetId||""));if(!asset)throw new Error("LOCAL_ASSET_MISSING");
  return {dataUrl:asset.dataUrl,filename:job.payload?.filename||asset.filename,assetId:asset.assetId};
}

export function studioSyncStatus(){
  const jobs=readOutbox();return {pending:jobs.length,oldestAt:jobs[0]?.createdAt||null,flushing};
}

export async function flushStudioSync(){
  if(flushing||typeof window==="undefined"||!serverSyncEnabled())return studioSyncStatus();
  flushing=true;let retryDelay=0;
  try{
    let jobs=readOutbox(),processed=0;
    while(jobs.length&&processed<20){
      const job=jobs[0];
      try{
        await serverAction(job.action,await materialize(job));
        jobs.shift();writeOutbox(jobs);processed++;
      }catch(error){
        if(isIdempotentDuplicate(error)){jobs.shift();writeOutbox(jobs);processed++;continue}
        job.attempts=(job.attempts||0)+1;jobs[0]=job;writeOutbox(jobs);
        retryDelay=Math.min(30000,1500*Math.pow(2,Math.min(job.attempts,4)));break;
      }
    }
    return {pending:jobs.length,processed};
  }finally{
    flushing=false;
    if(retryDelay>0&&readOutbox().length)scheduleSync(retryDelay);
  }
}
function scheduleSync(delay=350){
  if(typeof window==="undefined"||!serverSyncEnabled()||syncTimer!==null)return;
  syncTimer=window.setTimeout(()=>{syncTimer=null;void flushStudioSync()},delay);
}

export async function studioAction<T=any>(action:string,payload:any={}):Promise<T>{
  scheduleSync();
  if(action==="createShare"){
    const bundle=await localStudioAction<DocumentBundle>("getDocument",{documentId:payload.documentId});
    const r=await fetch("/api/studio/share",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({documentId:payload.documentId,appOrigin:payload.appOrigin,bundle}),cache:"no-store"});
    const x=await r.json();if(!r.ok||!x.ok)throw Object.assign(new Error(x.error||`Share ${r.status}`),{details:x.details,status:r.status});
    return x.data as T;
  }
  if(action==="createDocument"&&!payload.id)payload={...payload,id:"doc-"+crypto.randomUUID()};
  if(action==="attachAsset"){
    const local:any=await localStudioAction<any>(action,payload);
    enqueueSync(action,{assetId:local?.asset?.id,filename:payload?.filename||null});scheduleSync(50);
    return local as T;
  }
  if(LOCAL_READS.has(action)) return localStudioAction<T>(action,payload);
  if(LOCAL_WRITES.has(action)){
    const local=await localStudioAction<T>(action,payload);
    enqueueSync(action,payload);scheduleSync(50);return local;
  }
  if(SERVER_ONLY.has(action))return serverAction<T>(action,payload);
  try{return await serverAction<T>(action,payload)}catch{return localStudioAction<T>(action,payload)}
}

export async function driveOAuthStart(returnTo:string){
  const session=await studioSession(); if(!session) throw new Error("AUTH_REQUIRED");
  const r=await fetch(`${FN}/oauth/start?return_to=${encodeURIComponent(returnTo)}`,{headers:{Authorization:`Bearer ${session.access_token}`}});
  const x=await r.json(); if(!r.ok) throw Object.assign(new Error(x.code||x.error||"OAUTH_START_FAILED"),{details:x,status:r.status}); return x as {url:string;redirectUri:string;scopes:string[]};
}
export async function downloadPdf(bundle:DocumentBundle,liveUrl:string){
  const r=await fetch("/api/studio/pdf",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bundle,liveUrl}),cache:"no-store"});
  if(!r.ok){let x:any={};try{x=await r.json()}catch{}throw Object.assign(new Error(x.error||`PDF ${r.status}`),{details:x,status:r.status})}
  const blob=await r.blob();const cd=r.headers.get("Content-Disposition")||"";
  return {blob,contentDisposition:cd,shareUrl:r.headers.get("X-TQS-Share-Url")||liveUrl,drive:null};
}
export async function ownerMagicLink(email:string){
  return studioSupabase().auth.signInWithOtp({email,options:{emailRedirectTo:window.location.href}});
}
export async function studioSignOut(){ return studioSupabase().auth.signOut(); }

"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { localStudioAction } from "./local-store";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hppbuzbrjoyrwpdinlxk.supabase.co";
const SUPABASE_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_FPnSkBjbvgAW0VBE_u4_Kw_QAfJ_DFh";
const FN = `${SUPABASE_URL}/functions/v1/studio-api`;

let client: SupabaseClient|null=null;
export function studioSupabase(){ if(!client) client=createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}); return client; }

export async function studioSession(){
  const {data,error}=await studioSupabase().auth.getSession(); if(error) throw error; return data.session;
}
const LOCAL_FIRST=new Set(["ensureSeed","getWorldOverview","getEntityContext","getRecentActivity","getDocument","listDocuments","createDocument","upsertDocumentBlock","reorderDocumentBlock","createWorldObject","updateObject","markActivityDone","driveStatus"]);
const SERVER_ONLY=new Set(["createShare","configureDriveOAuth","driveListRoot","driveSyncCheckpoint","driveConflictProbe"]);
async function serverAction<T=any>(action:string,payload:any={}):Promise<T>{
  const ctrl=new AbortController();const timer=window.setTimeout(()=>ctrl.abort(),8000);
  try{
    const r=await fetch("/api/studio/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,payload}),cache:"no-store",signal:ctrl.signal});
    const x=await r.json();if(!r.ok||!x.ok)throw Object.assign(new Error(x.error||`Studio API ${r.status}`),{details:x.details,status:r.status});return x.data as T;
  }finally{window.clearTimeout(timer)}
}
export async function studioAction<T=any>(action:string,payload:any={}):Promise<T>{
  if(action==="createDocument"&&!payload.id)payload={...payload,id:"doc-"+crypto.randomUUID()};
  if(action==="attachAsset"){
    try{return await serverAction<T>(action,payload)}catch{return localStudioAction<T>(action,payload)}
  }
  if(LOCAL_FIRST.has(action)){
    const local=await localStudioAction<T>(action,payload);
    void serverAction(action,payload).catch(()=>{});
    return local;
  }
  if(SERVER_ONLY.has(action))return serverAction<T>(action,payload);
  try{return await serverAction<T>(action,payload)}catch{return localStudioAction<T>(action,payload)}
}
export async function driveOAuthStart(returnTo:string){
  const session=await studioSession(); if(!session) throw new Error("AUTH_REQUIRED");
  const r=await fetch(`${FN}/oauth/start?return_to=${encodeURIComponent(returnTo)}`,{headers:{Authorization:`Bearer ${session.access_token}`}});
  const x=await r.json(); if(!r.ok) throw Object.assign(new Error(x.code||x.error||"OAUTH_START_FAILED"),{details:x,status:r.status}); return x as {url:string;redirectUri:string;scopes:string[]};
}
export async function downloadPdf(documentId:string,saveDrive:boolean){
  const appOrigin=window.location.origin;
  const r=await fetch(`/api/studio/pdf?documentId=${encodeURIComponent(documentId)}&appOrigin=${encodeURIComponent(appOrigin)}&saveDrive=${saveDrive?1:0}`,{cache:"no-store"});
  if(!r.ok){let x:any={};try{x=await r.json()}catch{}throw Object.assign(new Error(x.error||`PDF ${r.status}`),{details:x,status:r.status})}
  const blob=await r.blob(); const cd=r.headers.get("Content-Disposition")||""; return {blob,contentDisposition:cd,shareUrl:r.headers.get("X-TQS-Share-Url"),drive:r.headers.get("X-TQS-Drive-Export")};
}
export async function ownerMagicLink(email:string){
  return studioSupabase().auth.signInWithOtp({email,options:{emailRedirectTo:window.location.href}});
}
export async function studioSignOut(){ return studioSupabase().auth.signOut(); }

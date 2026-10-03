"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hppbuzbrjoyrwpdinlxk.supabase.co";
const SUPABASE_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_FPnSkBjbvgAW0VBE_u4_Kw_QAfJ_DFh";
const FN = `${SUPABASE_URL}/functions/v1/studio-api`;

let client: SupabaseClient|null=null;
export function studioSupabase(){ if(!client) client=createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}); return client; }

export async function studioSession(){
  const {data,error}=await studioSupabase().auth.getSession(); if(error) throw error; return data.session;
}
export async function studioAction<T=any>(action:string,payload:any={}):Promise<T>{
  const session=await studioSession().catch(()=>null);
  const headers:Record<string,string>={"Content-Type":"application/json"};
  if(session) headers.Authorization=`Bearer ${session.access_token}`;
  const endpoint=session?"action":"public/action";
  const r=await fetch(`${FN}/${endpoint}`,{method:"POST",headers,body:JSON.stringify({action,payload})});
  const x=await r.json(); if(!r.ok||!x.ok) throw Object.assign(new Error(x.error||`Studio API ${r.status}`),{details:x.details,status:r.status}); return x.data as T;
}
export async function driveOAuthStart(returnTo:string){
  const session=await studioSession(); if(!session) throw new Error("AUTH_REQUIRED");
  const r=await fetch(`${FN}/oauth/start?return_to=${encodeURIComponent(returnTo)}`,{headers:{Authorization:`Bearer ${session.access_token}`}});
  const x=await r.json(); if(!r.ok) throw Object.assign(new Error(x.code||x.error||"OAUTH_START_FAILED"),{details:x,status:r.status}); return x as {url:string;redirectUri:string;scopes:string[]};
}
export async function downloadPdf(documentId:string,saveDrive:boolean){
  const session=await studioSession().catch(()=>null);
  const appOrigin=window.location.origin;
  const headers:Record<string,string>={}; if(session) headers.Authorization=`Bearer ${session.access_token}`;
  const endpoint=session?"pdf":"public/pdf";
  const r=await fetch(`${FN}/${endpoint}?documentId=${encodeURIComponent(documentId)}&appOrigin=${encodeURIComponent(appOrigin)}&saveDrive=${saveDrive?1:0}`,{headers});
  if(!r.ok){let x:any={};try{x=await r.json()}catch{}throw Object.assign(new Error(x.error||`PDF ${r.status}`),{details:x,status:r.status})}
  const blob=await r.blob(); const cd=r.headers.get("Content-Disposition")||""; return {blob,contentDisposition:cd,shareUrl:r.headers.get("X-TQS-Share-Url"),drive:r.headers.get("X-TQS-Drive-Export")};
}
export async function ownerMagicLink(email:string){
  return studioSupabase().auth.signInWithOtp({email,options:{emailRedirectTo:window.location.href}});
}
export async function studioSignOut(){ return studioSupabase().auth.signOut(); }

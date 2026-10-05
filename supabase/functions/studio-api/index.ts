import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.99.3";
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const secretMap = (()=>{try{return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")}catch{return {}}})();
const SERVICE_KEY = secretMap.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession:false, autoRefreshToken:false } });
const OWNER_WORLD = "tqs-studio-world";
const DRIVE_ROOT = "1NSPF-zrrM1RAqniRR4FHL56VvGDcBXWl";
const DRIVE_EXPORTS = "1Qf7C_3xP5OtxUfWhjkuMZ0NNLpn1gqW8";
const DRIVE_SCOPES = ["openid","email","https://www.googleapis.com/auth/drive"];
const enc = new TextEncoder();

function json(data: unknown, status=200, origin?: string) {
  const h = new Headers({"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
  applyCors(h, origin);
  return new Response(JSON.stringify(data), {status, headers:h});
}
function applyCors(h:Headers, origin?:string|null){
  if(origin && (origin.endsWith(".vercel.app") || origin.startsWith("http://localhost:"))) h.set("Access-Control-Allow-Origin",origin);
  h.set("Vary","Origin");
  h.set("Access-Control-Allow-Headers","authorization, content-type, x-client-info, apikey");
  h.set("Access-Control-Allow-Methods","GET,POST,PATCH,DELETE,OPTIONS");
}
async function sha256Hex(value:string){
  const b=await crypto.subtle.digest("SHA-256",enc.encode(value));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function randomToken(bytes=32){
  const a=crypto.getRandomValues(new Uint8Array(bytes));
  return [...a].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function functionPath(url:URL){
  const marker="/studio-api"; const i=url.pathname.indexOf(marker);
  return i>=0 ? (url.pathname.slice(i+marker.length)||"/") : url.pathname;
}
function safeReturnTo(raw:string|null){
  if(!raw) return null;
  try{
    const u=new URL(raw);
    if(u.protocol==="https:" && u.hostname.endsWith(".vercel.app")) return u.toString();
    if(u.protocol==="http:" && (u.hostname==="localhost"||u.hostname==="127.0.0.1")) return u.toString();
  }catch{}
  return null;
}
async function ownerBootstrap(url:URL){
  const token=url.searchParams.get("token")||"";
  if(!token) return json({error:"BOOTSTRAP_TOKEN_REQUIRED"},400);
  const hash=await sha256Hex(token);
  const {data:row,error}=await admin.from("studio_owner_bootstrap_tokens")
    .select("*").eq("token_hash",hash).is("used_at",null).gt("expires_at",new Date().toISOString()).maybeSingle();
  if(error) throw error;
  if(!row) return json({error:"BOOTSTRAP_TOKEN_INVALID_OR_EXPIRED"},401);

  const {data:owner,error:oe}=await admin.from("studio_owner_access").select("email").eq("owner_id",row.owner_id).single();
  if(oe||!owner?.email) throw oe||new Error("OWNER_EMAIL_MISSING");

  const {data:link,error:le}=await admin.auth.admin.generateLink({
    type:"magiclink",
    email:owner.email
  });
  if(le) throw le;

  const properties=(link as any)?.properties||{};
  const emailOtp=properties.email_otp||properties.emailOtp||"";
  let verified:any=null;
  let ve:any=null;
  const verifier=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});

  if(emailOtp){
    const vr=await verifier.auth.verifyOtp({email:owner.email,token:emailOtp,type:"email"});
    verified=vr.data; ve=vr.error;
  }else{
    const tokenHash=properties.hashed_token||properties.hashedToken||"";
    const verificationType=(properties.verification_type||properties.verificationType||"magiclink") as any;
    if(!tokenHash) throw Object.assign(new Error("BOOTSTRAP_TOKEN_MATERIAL_MISSING"),{status:500});
    const vr=await verifier.auth.verifyOtp({token_hash:tokenHash,type:verificationType});
    verified=vr.data; ve=vr.error;
  }

  if(ve||!verified?.session) throw ve||Object.assign(new Error("BOOTSTRAP_SESSION_MISSING"),{status:500});

  const usedAt=new Date().toISOString();
  const {data:marked,error:markError}=await admin.from("studio_owner_bootstrap_tokens")
    .update({used_at:usedAt}).eq("id",row.id).is("used_at",null).select("id,used_at").maybeSingle();
  if(markError||!marked?.used_at) throw markError||Object.assign(new Error("BOOTSTRAP_MARK_USED_FAILED"),{status:500});

  const target=new URL(row.return_to);
  const s=verified.session;
  target.hash=new URLSearchParams({
    access_token:s.access_token,
    refresh_token:s.refresh_token,
    expires_in:String(s.expires_in||3600),
    token_type:s.token_type||"bearer",
    type:"magiclink"
  }).toString();
  return Response.redirect(target.toString(),302);
}
async function ownerFromRequest(req:Request){
  const auth=req.headers.get("Authorization")||"";
  const token=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!token) throw Object.assign(new Error("AUTH_REQUIRED"),{status:401});
  const {data:{user},error}=await admin.auth.getUser(token);
  if(error||!user) throw Object.assign(new Error("AUTH_INVALID"),{status:401});
  const {data:owner}=await admin.from("studio_owner_access").select("owner_id,email").eq("owner_id",user.id).maybeSingle();
  if(!owner) throw Object.assign(new Error("OWNER_ONLY"),{status:403});
  return {id:user.id,email:owner.email as string};
}
async function vaultGet(name:string){
  const {data,error}=await admin.rpc("studio_vault_get",{p_name:name});
  if(error) throw error;
  return (data as string|null)||null;
}
async function vaultPut(name:string,value:string,description:string){
  const {data,error}=await admin.rpc("studio_vault_put",{p_name:name,p_value:value,p_description:description});
  if(error) throw error;
  return data;
}
async function googleConfig(){
  const [clientId,clientSecret]=await Promise.all([vaultGet("studio_google_client_id"),vaultGet("studio_google_client_secret")]);
  return {clientId,clientSecret,redirectUri:`${SUPABASE_URL}/functions/v1/studio-api/oauth/callback`};
}
async function googleAccess(ownerId:string){
  const cfg=await googleConfig();
  if(!cfg.clientId||!cfg.clientSecret) throw Object.assign(new Error("OAUTH_CLIENT_CONFIG_REQUIRED"),{status:409,details:{redirectUri:cfg.redirectUri,scopes:DRIVE_SCOPES}});
  const refreshName=`studio_google_refresh_${ownerId}`;
  const refresh=await vaultGet(refreshName);
  if(!refresh) throw Object.assign(new Error("DRIVE_NOT_CONNECTED"),{status:409});
  const body=new URLSearchParams({client_id:cfg.clientId,client_secret:cfg.clientSecret,refresh_token:refresh,grant_type:"refresh_token"});
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
  const x=await r.json();
  if(!r.ok||!x.access_token) throw Object.assign(new Error("GOOGLE_TOKEN_REFRESH_FAILED"),{status:502,details:x});
  return x.access_token as string;
}
async function driveFetch(ownerId:string,url:string,init:RequestInit={}){
  const access=await googleAccess(ownerId);
  const h=new Headers(init.headers||{});
  h.set("Authorization",`Bearer ${access}`);
  return fetch(url,{...init,headers:h});
}
async function driveMeta(ownerId:string,fileId:string){
  const fields=encodeURIComponent("id,name,mimeType,modifiedTime,version,md5Checksum,webViewLink,size,parents");
  const r=await driveFetch(ownerId,`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${fields}&supportsAllDrives=true`);
  const x=await r.json(); if(!r.ok) throw Object.assign(new Error("DRIVE_META_FAILED"),{status:r.status,details:x}); return x;
}
async function upsertDriveContent(ownerId:string,args:{entityType:string;entityId:string;studioRevision:number;name:string;mimeType:string;content:Uint8Array;parentId?:string;expectedDriveVersion?:string|null;testConflict?:boolean}){
  const {data:ref}=await admin.from("studio_drive_refs").select("*").eq("owner_id",ownerId).eq("entity_type",args.entityType).eq("entity_id",args.entityId).maybeSingle();
  if(ref){
    const current=await driveMeta(ownerId,ref.drive_file_id);
    const expected=args.expectedDriveVersion ?? ref.drive_version;
    const conflict=Boolean(expected && String(current.version)!==String(expected));
    if(conflict){
      if(!args.testConflict) await admin.from("studio_sync_conflicts").insert({owner_id:ownerId,drive_ref_id:ref.id,entity_type:args.entityType,entity_id:args.entityId,studio_revision:args.studioRevision,drive_revision_id:String(current.version??""),drive_modified_time:current.modifiedTime,details:{expected,current:String(current.version??"")}});
      return {conflict:true,current,expected};
    }
    if(args.testConflict) return {conflict:false,current,expected};
    const ur=await driveFetch(ownerId,`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(ref.drive_file_id)}?uploadType=media&supportsAllDrives=true`,{method:"PATCH",headers:{"Content-Type":args.mimeType},body:args.content});
    if(!ur.ok) throw Object.assign(new Error("DRIVE_UPDATE_FAILED"),{status:ur.status,details:await ur.text()});
    const meta=await driveMeta(ownerId,ref.drive_file_id);
    await admin.from("studio_drive_refs").update({drive_revision_id:String(meta.version??""),drive_version:String(meta.version??""),drive_modified_time:meta.modifiedTime,studio_revision:args.studioRevision,sync_state:"SYNCED",last_sync_at:new Date().toISOString(),metadata:{name:meta.name,mimeType:meta.mimeType}}).eq("id",ref.id);
    return {conflict:false,file:meta};
  }
  if(args.testConflict) return {conflict:false,current:null,expected:args.expectedDriveVersion??null};
  const parent=args.parentId||DRIVE_ROOT;
  const cr=await driveFetch(ownerId,"https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,modifiedTime,version,webViewLink&supportsAllDrives=true",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:args.name,mimeType:args.mimeType,parents:[parent]})});
  const created=await cr.json(); if(!cr.ok) throw Object.assign(new Error("DRIVE_CREATE_FAILED"),{status:cr.status,details:created});
  const ur=await driveFetch(ownerId,`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(created.id)}?uploadType=media&supportsAllDrives=true`,{method:"PATCH",headers:{"Content-Type":args.mimeType},body:args.content});
  if(!ur.ok) throw Object.assign(new Error("DRIVE_UPLOAD_FAILED"),{status:ur.status,details:await ur.text()});
  const meta=await driveMeta(ownerId,created.id);
  await admin.from("studio_drive_refs").upsert({owner_id:ownerId,entity_type:args.entityType,entity_id:args.entityId,drive_file_id:meta.id,root_id:parent,drive_revision_id:String(meta.version??""),drive_version:String(meta.version??""),drive_modified_time:meta.modifiedTime,studio_revision:args.studioRevision,sync_state:"SYNCED",last_sync_at:new Date().toISOString(),metadata:{name:meta.name,mimeType:meta.mimeType}},{onConflict:"owner_id,entity_type,entity_id"});
  await admin.from("studio_drive_connections").update({last_sync_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq("owner_id",ownerId);
  return {conflict:false,file:meta};
}
async function loadDocument(ownerId:string,documentId:string){
  const {data:document,error}=await admin.from("studio_documents").select("*").eq("owner_id",ownerId).eq("id",documentId).single(); if(error) throw error;
  const {data:blocks,error:be}=await admin.from("studio_document_blocks").select("*").eq("owner_id",ownerId).eq("document_id",documentId).order("ordinal"); if(be) throw be;
  return {document,blocks:blocks||[]};
}
async function loadShare(token:string){
  const hash=await sha256Hex(token);
  const {data:link}=await admin.from("studio_share_links").select("*").eq("token_hash",hash).is("revoked_at",null).maybeSingle();
  if(!link || (link.expires_at && new Date(link.expires_at)<new Date())) return null;
  const bundle=await loadDocument(link.owner_id,link.document_id);
  return {...bundle,share:{mode:link.mode,documentRevision:link.document_revision,slug:link.slug}};
}
async function ensureShare(ownerId:string,documentId:string,appOrigin:string){
  const {data:doc}=await admin.from("studio_documents").select("*").eq("id",documentId).eq("owner_id",ownerId).single();
  const {data:existing}=await admin.from("studio_share_links").select("*").eq("document_id",documentId).eq("owner_id",ownerId).eq("mode","unlisted").is("revoked_at",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(existing){
    return {token:null,url:null,existing:true,slug:doc.slug};
  }
  const token=randomToken(32),hash=await sha256Hex(token);
  await admin.from("studio_share_links").insert({owner_id:ownerId,document_id:documentId,slug:doc.slug,token_hash:hash,mode:"unlisted",document_revision:doc.revision});
  await admin.from("studio_documents").update({share_mode:"unlisted",updated_at:new Date().toISOString()}).eq("id",documentId);
  return {token,url:`${appOrigin.replace(/\/$/,"")}/d/${encodeURIComponent(doc.slug)}?t=${token}`,existing:false,slug:doc.slug};
}
function publicDocumentBundle(input:any,documentId:string){
  const d=input?.document,b=Array.isArray(input?.blocks)?input.blocks:[];
  if(!d||String(d.id)!==documentId)throw Object.assign(new Error("PUBLICATION_SNAPSHOT_MISMATCH"),{status:400});
  const document={id:String(d.id),world_key:String(d.world_key||OWNER_WORLD),slug:String(d.slug||"document"),kind:String(d.kind||"document"),title:String(d.title||"TQS Studio"),semantic_path:String(d.semantic_path||""),frame_id:d.frame_id?String(d.frame_id):null,revision:Number(d.revision||1),status:String(d.status||"DRAFT"),share_mode:"unlisted",metadata:d.metadata||{}};
  const blocks=b.filter((x:any)=>String(x?.document_id||"")===documentId).map((x:any)=>({block_id:String(x.block_id),document_id:documentId,ordinal:Number(x.ordinal||0),block_type:String(x.block_type||"rich_text"),content:x.content||{},data_spec:x.data_spec||null,asset_id:x.asset_id||null,revision:Number(x.revision||1)}));
  return {document,blocks};
}
async function createFreshShare(ownerId:string,documentId:string,appOrigin:string,bundleInput?:any){
  const bundle=bundleInput?publicDocumentBundle(bundleInput,documentId):await loadDocument(ownerId,documentId);
  if(!bundle?.document)throw new Error("DOCUMENT_NOT_FOUND");
  const token=randomToken(32),hash=await sha256Hex(token);
  const snapshot={...bundle,share:{mode:"unlisted",documentRevision:Number(bundle.document.revision),slug:bundle.document.slug,publishedAt:new Date().toISOString()}};
  const bytes=enc.encode(JSON.stringify(snapshot));
  const {error}=await admin.storage.from("studio-assets").upload(`public-shares/${hash}.json`,bytes,{contentType:"application/json; charset=utf-8",upsert:false});
  if(error)throw error;
  return {token,url:`${appOrigin.replace(/\/$/,"")}/d/${encodeURIComponent(bundle.document.slug)}?t=${token}`,slug:bundle.document.slug,documentRevision:Number(bundle.document.revision),transport:"storage_snapshot"};
}
async function loadStorageShare(token:string){
  const hash=await sha256Hex(token),path=`public-shares/${hash}.json`;
  const {data,error}=await admin.storage.from("studio-assets").download(path);
  if(error||!data)return null;
  try{return JSON.parse(await data.text())}catch{return null}
}
async function disableStorageShare(shareUrl:string){
  try{
    const u=new URL(shareUrl),token=u.searchParams.get("t");if(!token)return false;
    const hash=await sha256Hex(token);
    const {error}=await admin.storage.from("studio-assets").remove([`public-shares/${hash}.json`]);if(error)throw error;
    return true;
  }catch{return false}
}
function decodeDataUrl(dataUrl:string){
  const m=dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s); if(!m) throw new Error("INVALID_DATA_URL");
  const mime=m[1]||"application/octet-stream"; const raw=m[3]||"";
  if(m[2]){const bin=atob(raw);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return {mime,bytes:out};}
  return {mime,bytes:enc.encode(decodeURIComponent(raw))};
}
function sanitizeObjectPatch(p:any){
  const allowed=["kind","semantic_path","parent_id","x","y","w","h","z","title","body","relations","status","hidden"];
  return Object.fromEntries(Object.entries(p||{}).filter(([k])=>allowed.includes(k)));
}
async function bumpWorld(ownerId:string){
  const {data:w}=await admin.from("studio_worlds").select("revision").eq("world_key",OWNER_WORLD).eq("owner_id",ownerId).single();
  const revision=Number(w?.revision||0)+1; await admin.from("studio_worlds").update({revision,updated_at:new Date().toISOString()}).eq("world_key",OWNER_WORLD); return revision;
}
async function logActivity(ownerId:string,entityId:string|null,semanticPath:string,eventType:string,summary:string,payload:any={}){
  const {data,error}=await admin.from("studio_activity").insert({owner_id:ownerId,world_key:OWNER_WORLD,entity_id:entityId,semantic_path:semanticPath,event_type:eventType,summary,payload,status:"NEW"}).select().single();
  if(error)throw error;return data;
}
function canonicalObjectSnapshot(o:any){
  if(!o)return null;
  const keys=["id","world_key","kind","semantic_path","parent_id","x","y","w","h","z","title","body","relations","status","hidden","revision","created_at","updated_at"];
  return Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
}
function finiteNumber(v:any){const n=Number(v);return Number.isFinite(n)?n:null}
function safeStudioContextInput(p:any){
  const ids=Array.isArray(p?.objectIds)?[...new Set(p.objectIds.map(String).filter(Boolean))].slice(0,100):[];
  const blockIds=Array.isArray(p?.blockIds)?[...new Set(p.blockIds.map(String).filter(Boolean))].slice(0,100):[];
  const point=p?.pointer&&finiteNumber(p.pointer.x)!==null&&finiteNumber(p.pointer.y)!==null?{x:finiteNumber(p.pointer.x),y:finiteNumber(p.pointer.y)}:null;
  const viewport=p?.viewport&&finiteNumber(p.viewport.x)!==null&&finiteNumber(p.viewport.y)!==null&&finiteNumber(p.viewport.zoom)!==null?{x:finiteNumber(p.viewport.x),y:finiteNumber(p.viewport.y),zoom:finiteNumber(p.viewport.zoom),width:finiteNumber(p.viewport.width),height:finiteNumber(p.viewport.height)}:null;
  return{objectIds:ids,blockIds,pointer:point,viewport,frameId:p?.frameId?String(p.frameId):null,documentId:p?.documentId?String(p.documentId):null,selectionBounds:p?.selectionBounds||null};
}
let cachedFont:Uint8Array|null=null;
async function notoFont(){
  if(cachedFont) return cachedFont;
  const r=await fetch("https://raw.githubusercontent.com/notofonts/notofonts.github.io/main/fonts/NotoSans/hinted/ttf/NotoSans-Regular.ttf");
  if(!r.ok) throw new Error("PDF_FONT_FETCH_FAILED");
  cachedFont=new Uint8Array(await r.arrayBuffer()); return cachedFont;
}
function plainBlockText(block:any){
  const c=block.content||{};
  if(typeof c==="string") return c;
  return c.text||c.title||(c.html?String(c.html).replace(/<[^>]+>/g," "):"")||
    (block.block_type==="table"?"Таблица":block.block_type==="divider"?"":"");
}
async function generatePdf(bundle:any,liveUrl:string){
  const pdf=await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const font=await pdf.embedFont(await notoFont(),{subset:true});
  const size=[595.28,841.89] as const; let page=pdf.addPage(size); let y=790;
  const draw=(text:string,fontSize=11,indent=0)=>{
    const max=88-Math.floor(indent/6); const words=String(text||"").replace(/\s+/g," ").trim().split(" "); let line="";
    for(const w of words){const test=line?line+" "+w:w;if(test.length>max){page.drawText(line,{x:48+indent,y,size:fontSize,font,color:rgb(.12,.12,.12)});y-=fontSize*1.45;line=w;if(y<70){page=pdf.addPage(size);y=790}}else line=test}
    if(line){page.drawText(line,{x:48+indent,y,size:fontSize,font,color:rgb(.12,.12,.12)});y-=fontSize*1.45}
  };
  draw(bundle.document.title,22); y-=8;
  draw(`Ревизия ${bundle.document.revision} · ${new Date().toISOString().slice(0,10)}`,8); y-=14;
  for(const b of bundle.blocks){
    if(y<100){page=pdf.addPage(size);y=790}
    const t=b.block_type;
    if(t==="divider"){page.drawLine({start:{x:48,y},end:{x:547,y},thickness:.5,color:rgb(.75,.75,.75)});y-=18;continue}
    if(t==="heading"){draw(plainBlockText(b),18);y-=5;continue}
    if(["live_data","interactive_chart","market_replay"].includes(t)){
      page.drawRectangle({x:48,y:y-82,width:499,height:82,borderWidth:.7,borderColor:rgb(.55,.45,.25),color:rgb(.97,.96,.93)});
      page.drawText(t==="market_replay"?"Market Replay":"Live Data / Chart",{x:60,y:y-22,size:12,font,color:rgb(.32,.25,.12)});
      draw(plainBlockText(b)||"Интерактивный блок",10,18);
      const ds=b.data_spec||{};draw(`${ds.provider||""} · ${ds.metric||""} · ${ds.updatePolicy||""} · as of ${ds.asOf||"LIVE"}`,8,18);
      y-=38; continue;
    }
    if(t==="table"){
      draw("Таблица",12); const rows=b.content?.rows||[]; for(const row of rows.slice(0,12)) draw(row.join("  |  "),9,10);y-=6;continue;
    }
    if(t==="sources"){draw("Источники",12);for(const it of (b.content?.items||[]))draw(it.label||it.url||it.driveId||"",9,10);y-=6;continue}
    draw(plainBlockText(b),t==="callout"?11:10,t==="callout"?10:0); y-=6;
  }
  y=Math.max(y-12,45); page.drawLine({start:{x:48,y:y+12},end:{x:547,y:y+12},thickness:.4,color:rgb(.75,.75,.75)});
  draw("Актуальная версия:",8); draw(liveUrl,8);
  return new Uint8Array(await pdf.save());
}
async function ensureStudioSeed(owner:{id:string;email:string}){
  await admin.from("studio_worlds").upsert({
    world_key:OWNER_WORLD,owner_id:owner.id,title:"TQS Studio World",revision:1,
    metadata:{schema_version:"tqs-studio-world/v5",seed:"canonical-v5"}
  },{onConflict:"world_key",ignoreDuplicates:true});

  const objects=[
    {id:"frame-agent",kind:"frame",semantic_path:"ARTEM OS/Agent",parent_id:null,x:260,y:300,w:1180,h:850,z:1,title:"ARTEM OS / Agent",body:{},relations:[],status:null,hidden:false},
    {id:"frame-tqs",kind:"frame",semantic_path:"TQS/Trading/Intelligence",parent_id:null,x:2050,y:240,w:1500,h:930,z:1,title:"TQS / Trading / Intelligence",body:{},relations:[],status:null,hidden:false},
    {id:"frame-learning",kind:"frame",semantic_path:"Обучение",parent_id:null,x:3800,y:260,w:6500,h:3300,z:1,title:"Обучение",body:{workspaceCard:true},relations:[],status:null,hidden:false},
    {id:"frame-articles",kind:"frame",semantic_path:"Статьи",parent_id:null,x:600,y:1800,w:1650,h:1000,z:1,title:"Статьи",body:{},relations:[],status:null,hidden:false},
    {id:"frame-inbox",kind:"frame",semantic_path:"Inbox",parent_id:null,x:2700,y:1780,w:1200,h:900,z:1,title:"Inbox",body:{},relations:[],status:null,hidden:false},
    {id:"course-free",kind:"frame",semantic_path:"Обучение/Бесплатный курс",parent_id:"frame-learning",x:4050,y:520,w:3300,h:2720,z:2,title:"Бесплатный курс",body:{workspaceCard:true},relations:[{type:"contains",targetId:"frame-learning"}],status:null,hidden:false},
    {id:"course-scalp",kind:"frame",semantic_path:"Обучение/Скальпинг по стакану",parent_id:"frame-learning",x:7600,y:520,w:2300,h:2450,z:2,title:"Скальпинг по стакану",body:{workspaceCard:true},relations:[{type:"contains",targetId:"frame-learning"}],status:null,hidden:false},
    {id:"lesson-free-1",kind:"frame",semantic_path:"Обучение/Бесплатный курс/Занятие 1",parent_id:"course-free",x:4210,y:720,w:700,h:360,z:3,title:"Занятие 1 — Рабочее пространство",body:{demo:true},relations:[{type:"contains",targetId:"course-free"}],status:null,hidden:false},
    {id:"lesson-free-2",kind:"frame",semantic_path:"Обучение/Бесплатный курс/Занятие 2",parent_id:"course-free",x:4210,y:1130,w:700,h:240,z:3,title:"Занятие 2 — Стакан и лента",body:{},relations:[{type:"contains",targetId:"course-free"}],status:null,hidden:false},
    {id:"lesson-free-3",kind:"frame",semantic_path:"Обучение/Бесплатный курс/Занятие 3",parent_id:"course-free",x:4210,y:1420,w:700,h:240,z:3,title:"Занятие 3 — Базовая подготовка",body:{},relations:[{type:"contains",targetId:"course-free"}],status:null,hidden:false},
    {id:"lesson-scalp-1",kind:"frame",semantic_path:"Обучение/Скальпинг по стакану/Занятие 1",parent_id:"course-scalp",x:5260,y:720,w:640,h:240,z:3,title:"Занятие 1 — Чтение стакана",body:{},relations:[{type:"contains",targetId:"course-scalp"}],status:null,hidden:false},
    {id:"lesson-scalp-2",kind:"frame",semantic_path:"Обучение/Скальпинг по стакану/Занятие 2",parent_id:"course-scalp",x:5260,y:1020,w:640,h:240,z:3,title:"Занятие 2 — Плотности и реакции",body:{},relations:[{type:"contains",targetId:"course-scalp"}],status:null,hidden:false},
    {id:"lesson-scalp-3",kind:"frame",semantic_path:"Обучение/Скальпинг по стакану/Занятие 3",parent_id:"course-scalp",x:5260,y:1320,w:640,h:240,z:3,title:"Занятие 3 — Работа с импульсом",body:{},relations:[{type:"contains",targetId:"course-scalp"}],status:null,hidden:false},
    {id:"lesson-demo-text",kind:"text",semantic_path:"Обучение/Бесплатный курс/Занятие 1/План занятия",parent_id:"lesson-free-1",x:4280,y:820,w:270,h:110,z:10,title:"План занятия",body:{html:"<p>Настроить график, стакан, ленту и рабочие заметки. Это тестовый объект: его можно редактировать и перемещать.</p>"},relations:[{type:"contains",targetId:"lesson-free-1"}],status:null,hidden:false},
    {id:"lesson-demo-task",kind:"task",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Практика",parent_id:"lesson-free-1",x:4590,y:820,w:280,h:90,z:10,title:"Практика урока",body:{title:"Добавить свой скрин рабочего пространства",done:false},relations:[{type:"contains",targetId:"lesson-free-1"}],status:"NEW",hidden:false},
    {id:"lesson-demo-voice",kind:"voice",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Голосовая заметка",parent_id:"lesson-free-1",x:4280,y:950,w:320,h:84,z:10,title:"Голосовая заметка",body:{status:"Ожидает записи"},relations:[{type:"contains",targetId:"lesson-free-1"}],status:"WAITING_RECORDING",hidden:false},
    {id:"lesson-doc-ref",kind:"documentRef",semantic_path:"Обучение/Бесплатный курс/Занятие 1",parent_id:"lesson-free-1",x:4630,y:945,w:240,h:84,z:10,title:"Открыть документ занятия",body:{documentId:"doc-lesson-workspace"},relations:[{type:"document_of",targetId:"doc-lesson-workspace"},{type:"contains",targetId:"lesson-free-1"}],status:null,hidden:false},
    {id:"article-si-frame",kind:"documentRef",semantic_path:"Статьи/Si — история ликвидности",parent_id:"frame-articles",x:820,y:2070,w:650,h:240,z:5,title:"Статья — Si: история ликвидности",body:{documentId:"doc-si"},relations:[{type:"document_of",targetId:"doc-si"},{type:"contains",targetId:"frame-articles"}],status:null,hidden:false},
    {id:"lesson-miro-scene",kind:"frame",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство",parent_id:"course-free",x:4200,y:800,w:2900,h:1560,z:3,title:"ЗАНЯТИЕ 1 · РАБОЧЕЕ ПРОСТРАНСТВО",body:{ownerReference:true,sceneVersion:4,workspaceCard:true,layoutVersion:4},relations:[{type:"contains",targetId:"course-free"}],status:null,hidden:false},
    {id:"lesson-miro-l100",kind:"text",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/L1.00",parent_id:"lesson-miro-scene",x:4400,y:1020,w:300,h:96,z:10,title:"L1.00 · Подготовка",body:{html:"<p><b>L1.00</b><br/>Подготовить рабочее пространство</p>"},relations:[{type:"contains",targetId:"lesson-miro-scene"}],status:null,hidden:false},
    {id:"lesson-miro-l101",kind:"text",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/L1.01",parent_id:"lesson-miro-scene",x:4780,y:1020,w:300,h:96,z:10,title:"L1.01 · График",body:{html:"<p><b>L1.01</b><br/>Настроить график Si</p>"},relations:[{type:"contains",targetId:"lesson-miro-scene"}],status:null,hidden:false},
    {id:"lesson-miro-l102",kind:"text",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/L1.02",parent_id:"lesson-miro-scene",x:5160,y:1020,w:300,h:96,z:10,title:"L1.02 · Стакан",body:{html:"<p><b>L1.02</b><br/>Стакан и лента рядом</p>"},relations:[{type:"contains",targetId:"lesson-miro-scene"}],status:null,hidden:false},
    {id:"lesson-miro-shot",kind:"image",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Скрин рабочего места",parent_id:"lesson-miro-scene",x:4400,y:1220,w:820,h:470,z:10,title:"Скрин рабочего пространства",body:{previewUrl:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 440'%3E%3Crect width='800' height='440' fill='%231b1d20'/%3E%3Crect x='32' y='34' width='470' height='235' rx='10' fill='%23272b30' stroke='%236f7780'/%3E%3Cpolyline points='55,220 110,188 180,202 245,135 315,160 382,92 470,118' fill='none' stroke='%23d5ad5b' stroke-width='6'/%3E%3Crect x='525' y='34' width='242' height='360' rx='10' fill='%2323272b' stroke='%236f7780'/%3E%3Cpath d='M548 80h190M548 118h190M548 156h190M548 194h190M548 232h190M548 270h190' stroke='%23545b63' stroke-width='7'/%3E%3Crect x='32' y='292' width='470' height='102' rx='10' fill='%2323272b'/%3E%3Cpath d='M55 322h410M55 350h330' stroke='%23656d75' stroke-width='8'/%3E%3C/svg%3E",mimeType:"image/svg+xml",filename:"workspace-reference.svg"},relations:[{type:"contains",targetId:"lesson-miro-scene"}],status:null,hidden:false},
    {id:"lesson-miro-correction",kind:"text",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Правка",parent_id:"lesson-miro-scene",x:5280,y:1300,w:360,h:150,z:12,title:"Правка рабочего места",body:{html:"<p><b>Это переделать</b><br/>Стакан ближе к графику, убрать лишнюю панель.</p>",accent:"purple"},relations:[{type:"contains",targetId:"lesson-miro-scene"},{type:"annotates",targetId:"lesson-miro-shot"}],status:null,hidden:false},
    {id:"lesson-miro-person",kind:"image",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Пример преподавателя",parent_id:"lesson-miro-scene",x:5720,y:1180,w:360,h:430,z:10,title:"Пример фото преподавателя",body:{previewUrl:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 360 430'%3E%3Crect width='360' height='430' rx='18' fill='%23171b20'/%3E%3Ccircle cx='180' cy='138' r='68' fill='%23c8a889'/%3E%3Cpath d='M104 133c7-76 145-86 155 0-18-20-39-34-77-34-34 0-59 12-78 34z' fill='%23302b29'/%3E%3Cpath d='M72 430c8-117 51-168 108-168s100 51 108 168z' fill='%23445263'/%3E%3C/svg%3E",mimeType:"image/svg+xml",filename:"teacher-reference.svg"},relations:[{type:"contains",targetId:"lesson-miro-scene"}],status:null,hidden:false},
    {id:"lesson-miro-caption",kind:"text",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Комментарий к примеру",parent_id:"lesson-miro-scene",x:6120,y:1210,w:500,h:190,z:11,title:"Комментарий",body:{html:"<h2>Рабочее место должно помогать решению</h2><p>Слева — контекст и график. Рядом — стакан и лента. Всё, что не помогает принять решение, убираем.</p>"},relations:[{type:"contains",targetId:"lesson-miro-scene"}],status:null,hidden:false},
    {id:"lesson-miro-arrow-1",kind:"annotation",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Связь 1",parent_id:"lesson-miro-scene",x:4385,y:1908,w:78,h:24,z:20,title:"Связь",body:{annotationKind:"arrow",points:[{x:0,y:12},{x:78,y:12}]},relations:[{type:"contains",targetId:"lesson-miro-scene"}],status:null,hidden:false},
    {id:"lesson-miro-arrow-2",kind:"annotation",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Связь 2",parent_id:"lesson-miro-scene",x:4695,y:1908,w:78,h:24,z:20,title:"Связь",body:{annotationKind:"arrow",points:[{x:0,y:12},{x:78,y:12}]},relations:[{type:"contains",targetId:"lesson-miro-scene"}],status:null,hidden:false},
    {id:"lesson-miro-arrow-correction",kind:"annotation",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Правка скрина",parent_id:"lesson-miro-scene",x:4915,y:2110,w:105,h:54,z:21,title:"Стрелка правки",body:{annotationKind:"arrow",points:[{x:0,y:45},{x:105,y:8}]},relations:[{type:"contains",targetId:"lesson-miro-scene"},{type:"annotates",targetId:"lesson-miro-shot"}],status:null,hidden:false},
    {id:"lesson-miro-chart",kind:"chart",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Si",parent_id:"lesson-miro-scene",x:6120,y:1510,w:720,h:420,z:10,title:"Si · объём",body:{dataSpec:{provider:"MOEX_ISS",instrument:{family:"SI",resolver:"front_active_contract"},metric:"ohlcv_session",relativeRange:{tradingSessions:2},fixedRange:null,transforms:["group_by_session","cumulative_volume"],display:{renderer:"studio_market_chart"},updatePolicy:"LIVE",asOf:null}},relations:[{type:"contains",targetId:"lesson-miro-scene"}],status:null,hidden:false},
    {id:"lesson-miro-marker",kind:"annotation",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Маркер",parent_id:"lesson-miro-scene",x:4450,y:2270,w:330,h:24,z:22,title:"Маркер на скрине",body:{annotationKind:"marker",points:[{x:0,y:12},{x:95,y:8},{x:185,y:14},{x:330,y:9}]},relations:[{type:"contains",targetId:"lesson-miro-scene"},{type:"annotates",targetId:"lesson-miro-shot"}],status:null,hidden:false},
    {id:"lesson-miro-task",kind:"task",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Задача",parent_id:"lesson-miro-scene",x:4400,y:1840,w:360,h:94,z:11,title:"Задача по уроку",body:{title:"Переставить стакан ближе к графику",done:false},relations:[{type:"contains",targetId:"lesson-miro-scene"},{type:"derived_from",targetId:"lesson-miro-correction"}],status:"NEW",hidden:false},
    {id:"lesson-miro-voice",kind:"voice",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Голосовая заметка",parent_id:"lesson-miro-scene",x:4810,y:1840,w:360,h:94,z:11,title:"Голосовая заметка",body:{status:"Ожидает записи"},relations:[{type:"contains",targetId:"lesson-miro-scene"}],status:"WAITING_RECORDING",hidden:false},
    {id:"lesson-miro-doc",kind:"documentRef",semantic_path:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Документ",parent_id:"lesson-miro-scene",x:5220,y:1840,w:340,h:94,z:11,title:"Конспект занятия",body:{documentId:"doc-lesson-workspace"},relations:[{type:"document_of",targetId:"doc-lesson-workspace"},{type:"contains",targetId:"lesson-miro-scene"}],status:null,hidden:false}
  ].map(o=>({...o,world_key:OWNER_WORLD,owner_id:owner.id,revision:1}));
  const {error:oe}=await admin.from("studio_world_objects").upsert(objects,{onConflict:"id",ignoreDuplicates:true}); if(oe)throw oe;
  const {data:sceneLayout}=await admin.from("studio_world_objects").select("body").eq("owner_id",owner.id).eq("id","lesson-miro-scene").maybeSingle();
  if(Number(sceneLayout?.body?.layoutVersion||0)<4){
    const layoutIds=new Set(["frame-learning","course-free","course-scalp","lesson-miro-scene","lesson-miro-l100","lesson-miro-l101","lesson-miro-l102","lesson-miro-shot","lesson-miro-correction","lesson-miro-person","lesson-miro-caption","lesson-miro-chart","lesson-miro-task","lesson-miro-voice","lesson-miro-doc"]);
    const layoutObjects=objects.filter(o=>layoutIds.has(o.id));
    const {error:layoutError}=await admin.from("studio_world_objects").upsert(layoutObjects,{onConflict:"id"});if(layoutError)throw layoutError;
    const {error:legacyError}=await admin.from("studio_world_objects").update({hidden:true}).eq("owner_id",owner.id).in("id",["lesson-free-1","lesson-demo-text","lesson-demo-task","lesson-demo-voice","lesson-doc-ref"]);if(legacyError)throw legacyError;
  }

  const docs=[
    {id:"doc-lesson-workspace",owner_id:owner.id,world_key:OWNER_WORLD,slug:"zanyatie-1-rabochee-prostranstvo",kind:"lesson",title:"Занятие 1 — Рабочее пространство",semantic_path:"Обучение/Бесплатный курс/Занятие 1",frame_id:"lesson-miro-scene",revision:1,status:"DRAFT",share_mode:"private",metadata:{demo:true,ownerScene:true}},
    {id:"doc-si",owner_id:owner.id,world_key:OWNER_WORLD,slug:"si-istoriya-likvidnosti",kind:"article",title:"Статья — Si: история ликвидности",semantic_path:"Статьи/Si — история ликвидности",frame_id:"article-si-frame",revision:1,status:"DRAFT",share_mode:"private",metadata:{drive_package_id:"1UJVJUBPt5pEHmjmb79Pllm-hyIij0DkD"}}
  ];
  const {error:de}=await admin.from("studio_documents").upsert(docs,{onConflict:"id",ignoreDuplicates:true}); if(de)throw de;
  const {error:ownerDocError}=await admin.from("studio_documents").update({frame_id:"lesson-miro-scene",metadata:{demo:true,ownerScene:true}}).eq("owner_id",owner.id).eq("id","doc-lesson-workspace"); if(ownerDocError)throw ownerDocError;

  const liveSpec={provider:"MOEX_ISS",instrument:{family:"SI",resolver:"front_active_contract"},metric:"ohlcv_session",relativeRange:{tradingSessions:2},fixedRange:null,transforms:["group_by_session","cumulative_volume"],display:{renderer:"studio_market_chart",crosshair:true,periodControl:true},updatePolicy:"LIVE",asOf:null};
  const replaySpec={provider:"MOEX_ISS",instrument:{family:"SI",resolver:"front_active_contract"},metric:"ohlcv",relativeRange:{tradingSessions:1},fixedRange:null,transforms:["chronological"],display:{renderer:"studio_market_replay",targetDurationSeconds:30},updatePolicy:"LIVE",asOf:null};
  const lessonBlocks=[
    {block_id:"lesson-chart",ordinal:6,block_type:"interactive_chart",content:{title:"Si — интерактивный график"},data_spec:liveSpec},
    {block_id:"lesson-live",ordinal:7,block_type:"live_data",content:{title:"Si — реальный объём текущей и прошлой сессии"},data_spec:liveSpec},
    {block_id:"lesson-replay",ordinal:8,block_type:"market_replay",content:{title:"Market Replay — Si, день за 30 секунд"},data_spec:replaySpec},
    {block_id:"lesson-image",ordinal:9,block_type:"image",content:{caption:"Сюда можно вставить скрин рабочего пространства и рисовать поверх него."},data_spec:null},
    {block_id:"lesson-video",ordinal:10,block_type:"video",content:{title:"Видео / запись экрана — тестовый reference"},data_spec:null},
    {block_id:"lesson-pdf",ordinal:11,block_type:"pdf_excerpt",content:{title:"PDF / конспект",text:"Тестовый excerpt: блок документа можно адресовать по номеру и stable block_id.",page:1},data_spec:null},
    {block_id:"lesson-div",ordinal:12,block_type:"divider",content:{},data_spec:null},
    {block_id:"lesson-end",ordinal:13,block_type:"rich_text",content:{html:"<p>Проверь: вставку между блоками, drag reorder, переход «На доске», share и PDF.</p>"},data_spec:null}
  ].map(b=>({...b,document_id:"doc-lesson-workspace",owner_id:owner.id,revision:1}));
  const {error:be}=await admin.from("studio_document_blocks").upsert(lessonBlocks,{onConflict:"block_id",ignoreDuplicates:true}); if(be)throw be;

  return {seed:"canonical-v5",objects:objects.length,documents:docs.length,lessonBlocks:lessonBlocks.length};
}

async function action(owner:{id:string;email:string},name:string,p:any,origin:string){
  if(name==="ensureSeed") return ensureStudioSeed(owner);
  if(name==="getWorldOverview"){
    const [{data:world},{data:objects},{data:activity}]=await Promise.all([
      admin.from("studio_worlds").select("*").eq("owner_id",owner.id).eq("world_key",OWNER_WORLD).single(),
      admin.from("studio_world_objects").select("*").eq("owner_id",owner.id).eq("world_key",OWNER_WORLD).order("z"),
      admin.from("studio_activity").select("*").eq("owner_id",owner.id).eq("world_key",OWNER_WORLD).order("occurred_at",{ascending:false}).limit(100)
    ]); return {world,objects:objects||[],activity:activity||[]};
  }
  if(name==="getEntityContext"){
    const {data:entity}=await admin.from("studio_world_objects").select("*").eq("owner_id",owner.id).eq("id",p.id).single();
    const [{data:children},{data:activity},{data:documents}]=await Promise.all([
      admin.from("studio_world_objects").select("*").eq("owner_id",owner.id).eq("parent_id",p.id),
      admin.from("studio_activity").select("*").eq("owner_id",owner.id).like("semantic_path",`${entity.semantic_path}%`).order("occurred_at",{ascending:false}).limit(50),
      admin.from("studio_documents").select("*").eq("owner_id",owner.id).eq("frame_id",p.id)
    ]); return {entity,children:children||[],activity:activity||[],documents:documents||[]};
  }
  if(name==="getRecentActivity"){
    let q=admin.from("studio_activity").select("*").eq("owner_id",owner.id).order("occurred_at",{ascending:false}).limit(Math.min(Number(p.limit||50),200));
    if(p.semanticPath) q=q.like("semantic_path",`${p.semanticPath}%`); if(p.status) q=q.eq("status",p.status); if(p.since) q=q.gte("occurred_at",p.since);
    const {data,error}=await q;if(error)throw error;return data||[];
  }
  if(name==="getStudioContext"){
    const input=safeStudioContextInput(p), objectIds=input.objectIds;
    let entities:any[]=[];if(objectIds.length){const {data,error}=await admin.from("studio_world_objects").select("*").eq("owner_id",owner.id).in("id",objectIds);if(error)throw error;entities=data||[]}
    let frameId=input.frameId;
    if(!frameId&&entities.length===1&&entities[0]?.kind==="frame")frameId=entities[0].id;
    if(!frameId&&entities.length){const parents=[...new Set(entities.map(x=>x.parent_id).filter(Boolean))];if(parents.length===1)frameId=String(parents[0])}
    let frame:any=null;if(frameId){const {data,error}=await admin.from("studio_world_objects").select("*").eq("owner_id",owner.id).eq("id",frameId).maybeSingle();if(error)throw error;frame=data}
    let blocks:any[]=[];if(input.blockIds.length){const {data,error}=await admin.from("studio_document_blocks").select("*").eq("owner_id",owner.id).in("block_id",input.blockIds);if(error)throw error;blocks=data||[]}
    let linkedDocuments:any[]=[];if(input.documentId){const {data,error}=await admin.from("studio_documents").select("*").eq("owner_id",owner.id).eq("id",input.documentId);if(error)throw error;linkedDocuments=data||[]}else if(frameId){const {data,error}=await admin.from("studio_documents").select("*").eq("owner_id",owner.id).eq("frame_id",frameId);if(error)throw error;linkedDocuments=data||[]}
    const bounds=input.selectionBounds||(entities.length?{x:Math.min(...entities.map(x=>Number(x.x))),y:Math.min(...entities.map(x=>Number(x.y))),right:Math.max(...entities.map(x=>Number(x.x)+Number(x.w))),bottom:Math.max(...entities.map(x=>Number(x.y)+Number(x.h)))}:null);
    const semanticPrefix=frame?.semantic_path||entities[0]?.semantic_path||null;
    let aq=admin.from("studio_activity").select("*").eq("owner_id",owner.id).order("occurred_at",{ascending:false}).limit(50);if(semanticPrefix)aq=aq.like("semantic_path",`${semanticPrefix}%`);
    const [{data:world,error:we},{data:activity,error:ae}]=await Promise.all([admin.from("studio_worlds").select("*").eq("owner_id",owner.id).eq("world_key",OWNER_WORLD).single(),aq]);if(we)throw we;if(ae)throw ae;
    return{context_version:"tqs-studio-context/v1",world_id:OWNER_WORLD,world,selection:{object_ids:input.objectIds,block_ids:input.blockIds,bounds},pointer:input.pointer,viewport:input.viewport,entities,frame,linked_documents:linkedDocuments,selected_blocks:blocks,recent_activity:activity||[],source_data_refs:[...entities.flatMap(x=>Array.isArray(x.relations)?x.relations:[]),...blocks.map(x=>x.data_spec).filter(Boolean)]};
  }
  if(name==="getChangeHistory"){
    let q=admin.from("studio_activity").select("*").eq("owner_id",owner.id).order("occurred_at",{ascending:false}).limit(Math.min(Number(p.limit||100),200));
    if(p.entityId)q=q.eq("entity_id",String(p.entityId));
    if(p.generationRunId)q=q.contains("payload",{generation_run_id:String(p.generationRunId)});
    const {data,error}=await q;if(error)throw error;return data||[];
  }
  if(name==="aiApplyMutation"){
    const input=safeStudioContextInput(p.context||{}),scope=String(p.scope||"selection"),allowed=new Set(input.objectIds),runId=String(p.generationRunId||crypto.randomUUID()),actor=String(p.actor||"chatgpt"),sourceRefs=Array.isArray(p.sourceRefs)?p.sourceRefs.slice(0,100):[],mutations=Array.isArray(p.mutations)?p.mutations.slice(0,50):[];
    if(!mutations.length)throw Object.assign(new Error("AI_MUTATIONS_REQUIRED"),{status:400});
    const changed:any[]=[];const activity:any[]=[];
    for(const m of mutations){
      const op=String(m?.operation||"update");
      if(op==="create"){
        const raw=m.object||{},id=String(raw.id||(`${raw.kind||"object"}-${crypto.randomUUID()}`));
        let parent:any=null;
        if(raw.parent_id||input.frameId){const {data}=await admin.from("studio_world_objects").select("*").eq("owner_id",owner.id).eq("id",String(raw.parent_id||input.frameId)).maybeSingle();parent=data}
        if(!parent&&input.pointer){const {data}=await admin.from("studio_world_objects").select("*").eq("owner_id",owner.id).eq("kind","frame").lte("x",input.pointer.x).lte("y",input.pointer.y);parent=(data||[]).filter((x:any)=>input.pointer!.x<=Number(x.x)+Number(x.w)&&input.pointer!.y<=Number(x.y)+Number(x.h)).sort((a:any,b:any)=>Number(a.w)*Number(a.h)-Number(b.w)*Number(b.h))[0]||null}
        const title=String(raw.title||raw.kind||"Объект"),semanticPath=String(raw.semantic_path||(parent?parent.semantic_path+"/"+title:title));
        const relations=Array.isArray(raw.relations)?raw.relations:[...(parent?[{type:"contains",targetId:parent.id}]:[])];
        const px=input.pointer?.x??(parent?Number(parent.x)+80:900),py=input.pointer?.y??(parent?Number(parent.y)+80:600);
        const defaults=raw.kind==="chart"?{w:640,h:320}:raw.kind==="image"||raw.kind==="video"?{w:480,h:280}:raw.kind==="frame"?{w:900,h:620}:{w:300,h:140};
        const row={...sanitizeObjectPatch({...raw,x:raw.x??px,y:raw.y??py,w:raw.w??defaults.w,h:raw.h??defaults.h,z:raw.z??(raw.kind==="frame"?2:10),hidden:raw.hidden??false,parent_id:raw.parent_id??parent?.id??null,semantic_path:semanticPath,relations,title}),id,world_key:OWNER_WORLD,owner_id:owner.id,revision:1};
        if(!row.kind)throw Object.assign(new Error("AI_CREATE_REQUIRES_KIND"),{status:400});
        const {data,error}=await admin.from("studio_world_objects").insert(row).select().single();if(error)throw error;
        const evt=await logActivity(owner.id,data.id,data.semantic_path,"ai_create",m.summary||`AI создал: ${data.title||data.kind}`,{actor,generation_run_id:runId,source_object_ids:input.objectIds,source_refs:sourceRefs,operation:"create",before:null,after:canonicalObjectSnapshot(data),context:input});changed.push(data);activity.push(evt);continue;
      }
      const id=String(m?.id||"");if(!id)throw Object.assign(new Error("AI_UPDATE_ID_REQUIRED"),{status:400});
      if(scope==="selection"&&!allowed.has(id))throw Object.assign(new Error("AI_MUTATION_OUT_OF_SELECTION_SCOPE"),{status:409,details:{id,allowed:[...allowed]}});
      const {data:before,error:be}=await admin.from("studio_world_objects").select("*").eq("owner_id",owner.id).eq("id",id).single();if(be)throw be;
      const patch=sanitizeObjectPatch(m.patch||{});patch.revision=Number(before.revision||1)+1;patch.updated_at=new Date().toISOString();
      const {data,error}=await admin.from("studio_world_objects").update(patch).eq("owner_id",owner.id).eq("id",id).select().single();if(error)throw error;
      const evt=await logActivity(owner.id,data.id,data.semantic_path,"ai_update",m.summary||`AI обновил: ${data.title||data.kind}`,{actor,generation_run_id:runId,source_object_ids:input.objectIds,source_refs:sourceRefs,operation:"update",before:canonicalObjectSnapshot(before),after:canonicalObjectSnapshot(data),context:input});changed.push(data);activity.push(evt);
    }
    const worldRevision=await bumpWorld(owner.id);
    const ids=changed.map(x=>x.id),{data:readback,error:re}=await admin.from("studio_world_objects").select("*").eq("owner_id",owner.id).in("id",ids);if(re)throw re;
    return{generation_run_id:runId,changed:readback||[],activity_ids:activity.map(x=>x.id),world_revision:worldRevision,focus_target_id:ids[0]||null,canonical_readback:true};
  }
  if(name==="undoAiRun"){
    const runId=String(p.generationRunId||"");if(!runId)throw Object.assign(new Error("GENERATION_RUN_ID_REQUIRED"),{status:400});
    const {data:events,error}=await admin.from("studio_activity").select("*").eq("owner_id",owner.id).contains("payload",{generation_run_id:runId}).order("occurred_at",{ascending:false});if(error)throw error;
    const restored:any[]=[];
    for(const evt of events||[]){const h=evt.payload||{};if(h.operation==="update"&&h.before?.id){const before=canonicalObjectSnapshot(h.before),patch=sanitizeObjectPatch(before);const {data:cur}=await admin.from("studio_world_objects").select("revision").eq("owner_id",owner.id).eq("id",before.id).single();patch.revision=Number(cur?.revision||1)+1;patch.updated_at=new Date().toISOString();const {data,error:ue}=await admin.from("studio_world_objects").update(patch).eq("owner_id",owner.id).eq("id",before.id).select().single();if(ue)throw ue;restored.push(data)}else if(h.operation==="create"&&h.after?.id){const {data,error:he}=await admin.from("studio_world_objects").update({hidden:true,updated_at:new Date().toISOString()}).eq("owner_id",owner.id).eq("id",h.after.id).select().single();if(he)throw he;restored.push(data)}else if(h.operation==="document_create"&&h.after?.document_id){const {data,error:he}=await admin.from("studio_documents").update({status:"ARCHIVED",updated_at:new Date().toISOString()}).eq("owner_id",owner.id).eq("id",h.after.document_id).select().single();if(he)throw he;restored.push(data)}}
    const worldRevision=restored.length?await bumpWorld(owner.id):null;await logActivity(owner.id,null,"TQS Studio","ai_undo",`Undo AI run ${runId}`,{actor:String(p.actor||"chatgpt"),generation_run_id:runId,operation:"undo",restored_ids:restored.map(x=>x.id)});
    return{generation_run_id:runId,restored,world_revision:worldRevision,canonical_readback:true};
  }
  if(name==="redoAiRun"){
    const runId=String(p.generationRunId||"");if(!runId)throw Object.assign(new Error("GENERATION_RUN_ID_REQUIRED"),{status:400});
    const {data:events,error}=await admin.from("studio_activity").select("*").eq("owner_id",owner.id).contains("payload",{generation_run_id:runId}).order("occurred_at",{ascending:true});if(error)throw error;
    const replayed:any[]=[];
    for(const evt of events||[]){const h=evt.payload||{};if(h.operation==="document_create"&&h.after?.document_id){const {data,error:de}=await admin.from("studio_documents").update({status:"DRAFT",updated_at:new Date().toISOString()}).eq("owner_id",owner.id).eq("id",h.after.document_id).select().single();if(de)throw de;replayed.push(data);continue}if(!["create","update"].includes(String(h.operation||""))||!h.after?.id)continue;const after=canonicalObjectSnapshot(h.after),patch=sanitizeObjectPatch(after);const {data:cur}=await admin.from("studio_world_objects").select("revision").eq("owner_id",owner.id).eq("id",after.id).maybeSingle();if(!cur){const row={...patch,id:after.id,world_key:OWNER_WORLD,owner_id:owner.id,revision:1};const {data,error:ce}=await admin.from("studio_world_objects").insert(row).select().single();if(ce)throw ce;replayed.push(data);continue}patch.hidden=Boolean(after.hidden);patch.revision=Number(cur.revision||1)+1;patch.updated_at=new Date().toISOString();const {data,error:ue}=await admin.from("studio_world_objects").update(patch).eq("owner_id",owner.id).eq("id",after.id).select().single();if(ue)throw ue;replayed.push(data)}
    const worldRevision=replayed.length?await bumpWorld(owner.id):null;await logActivity(owner.id,null,"TQS Studio","ai_redo",`Redo AI run ${runId}`,{actor:String(p.actor||"chatgpt"),generation_run_id:runId,operation:"redo",replayed_ids:replayed.map(x=>x.id)});
    return{generation_run_id:runId,replayed,world_revision:worldRevision,canonical_readback:true};
  }
  if(name==="aiCreateDocumentFromFrame"){
    const frameId=String(p.frameId||p.context?.frameId||"");if(!frameId)throw Object.assign(new Error("FRAME_ID_REQUIRED"),{status:400});
    const {data:frame,error:fe}=await admin.from("studio_world_objects").select("*").eq("owner_id",owner.id).eq("id",frameId).eq("kind","frame").single();if(fe)throw fe;
    const {data:children,error:ce}=await admin.from("studio_world_objects").select("*").eq("owner_id",owner.id).like("semantic_path",`${frame.semantic_path}/%`).order("z");if(ce)throw ce;
    const sourceObjects=(children||[]).filter((x:any)=>!x.hidden),sourceIds=sourceObjects.map((x:any)=>x.id),runId=String(p.generationRunId||crypto.randomUUID()),title=String(p.title||("Материал — "+frame.title));
    const id=String(p.id||("doc-"+crypto.randomUUID())),slug=String(p.slug||title.toLowerCase().replace(/[^a-z0-9а-яё]+/gi,"-").replace(/^-|-$/g,"")+"-"+id.slice(-6));
    const metadata={created_by:String(p.actor||"chatgpt"),generation_run_id:runId,source_frame_id:frame.id,source_object_ids:sourceIds,source_refs:Array.isArray(p.sourceRefs)?p.sourceRefs:[],provenance_version:"tqs-studio-provenance/v1"};
    const row={id,owner_id:owner.id,world_key:OWNER_WORLD,slug,kind:String(p.kind||"article"),title,semantic_path:frame.semantic_path,frame_id:frame.id,revision:1,status:"DRAFT",share_mode:"private",metadata};
    const {data:doc,error:de}=await admin.from("studio_documents").insert(row).select().single();if(de)throw de;
    const blocks:any[]=[
      {block_id:"h-"+crypto.randomUUID(),document_id:id,owner_id:owner.id,ordinal:1,block_type:"heading",content:{text:title},revision:1},
      {block_id:"t-"+crypto.randomUUID(),document_id:id,owner_id:owner.id,ordinal:2,block_type:"rich_text",content:{html:`<p>Материал собран из пространства «${frame.title}». Исходные объекты остаются canonical в World.</p>`},revision:1},
      {block_id:"s-"+crypto.randomUUID(),document_id:id,owner_id:owner.id,ordinal:3,block_type:"sources",content:{items:sourceObjects.map((x:any)=>({label:x.title,objectId:x.id,kind:x.kind,semanticPath:x.semantic_path}))},revision:1}
    ];
    const {error:be}=await admin.from("studio_document_blocks").insert(blocks);if(be)throw be;
    await admin.from("studio_document_revisions").insert({document_id:id,owner_id:owner.id,revision:1,snapshot:{document:doc,blocks,metadata},reason:"ai frame to document"});
    const evt=await logActivity(owner.id,id,frame.semantic_path,"ai_document",`AI собрал документ: ${title}`,{actor:String(p.actor||"chatgpt"),generation_run_id:runId,source_object_ids:sourceIds,source_refs:metadata.source_refs,frame_id:frame.id,document_id:id,operation:"document_create",before:null,after:{document_id:id,status:"DRAFT",metadata}});
    return{generation_run_id:runId,document:doc,blocks,source_object_ids:sourceIds,activity_id:evt.id,focus_target_id:id,canonical_readback:true};
  }
  if(name==="getDocument") return loadDocument(owner.id,p.documentId);
  if(name==="listDocuments"){
    const {data,error}=await admin.from("studio_documents").select("*").eq("owner_id",owner.id).eq("world_key",OWNER_WORLD).order("updated_at",{ascending:false});if(error)throw error;return data||[];
  }
  if(name==="createDocument"){
    const id=p.id||("doc-"+crypto.randomUUID()),slug=p.slug||String(p.title||"document").toLowerCase().replace(/[^a-z0-9а-яё]+/gi,"-").replace(/^-|-$/g,"")+"-"+id.slice(-6);
    const row={id,owner_id:owner.id,world_key:OWNER_WORLD,slug,kind:p.kind||"instruction",title:p.title||"Новый документ",semantic_path:p.semanticPath||"Документы",frame_id:p.frameId||null,revision:1,status:"DRAFT",share_mode:"private",metadata:{}};
    const {data:doc,error}=await admin.from("studio_documents").insert(row).select().single();if(error)throw error;
    await admin.from("studio_document_blocks").insert([{block_id:"h-"+crypto.randomUUID(),document_id:id,owner_id:owner.id,ordinal:1,block_type:"heading",content:{text:doc.title}},{block_id:"t-"+crypto.randomUUID(),document_id:id,owner_id:owner.id,ordinal:2,block_type:"rich_text",content:{html:"<p>Новый документ</p>"}}]);
    await admin.from("studio_document_revisions").insert({document_id:id,owner_id:owner.id,revision:1,snapshot:{document:doc},reason:"create document"});
    await logActivity(owner.id,id,doc.semantic_path,"document_link","Создан документ: "+doc.title);
    return loadDocument(owner.id,id);
  }
  if(name==="upsertDocumentBlock"){
    const {data,error}=await admin.rpc("studio_upsert_document_block",{p_owner_id:owner.id,p_document_id:p.documentId,p_block_id:p.blockId,p_block_type:p.blockType,p_content:p.content||{},p_data_spec:p.dataSpec||null,p_after_block_id:p.afterBlockId||null});if(error)throw error;
    await logActivity(owner.id,p.documentId,p.semanticPath||"Документы","text_update",`Обновлён блок ${p.blockId}`,{blockType:p.blockType}); return data;
  }
  if(name==="reorderDocumentBlock"){
    const {data,error}=await admin.rpc("studio_reorder_document_block",{p_owner_id:owner.id,p_document_id:p.documentId,p_block_id:p.blockId,p_target_ordinal:Number(p.targetOrdinal)});if(error)throw error;return data;
  }
  if(name==="createWorldObject"){
    const row={...sanitizeObjectPatch(p.object),id:p.object.id||crypto.randomUUID(),world_key:OWNER_WORLD,owner_id:owner.id,revision:1};
    const {data,error}=await admin.from("studio_world_objects").upsert(row,{onConflict:"id"}).select().single();if(error)throw error;const worldRevision=await bumpWorld(owner.id);
    await logActivity(owner.id,data.id,data.semantic_path,"create",`Создано/синхронизировано: ${data.title||data.kind}`);return {object:data,worldRevision};
  }
  if(name==="updateObject"){
    const patch=sanitizeObjectPatch(p.patch);patch.revision=Number(p.revision||1)+1;patch.updated_at=new Date().toISOString();
    const {data,error}=await admin.from("studio_world_objects").update(patch).eq("owner_id",owner.id).eq("id",p.id).select().single();if(error)throw error;const worldRevision=await bumpWorld(owner.id);
    if(p.eventType)await logActivity(owner.id,data.id,data.semantic_path,p.eventType,p.summary||`Обновлён: ${data.title}`);return {object:data,worldRevision};
  }
  if(name==="getAssetUrl"){
    const {data:asset,error}=await admin.from("studio_assets").select("*").eq("owner_id",owner.id).eq("id",p.assetId).single();if(error)throw error;
    const {data:signed,error:se}=await admin.storage.from("studio-assets").createSignedUrl(asset.storage_path,3600);if(se)throw se;return {asset,signedUrl:signed?.signedUrl||null};
  }
  if(name==="attachAsset"){
    const {mime,bytes}=decodeDataUrl(p.dataUrl);const assetId=String(p.assetId||crypto.randomUUID());const ext=(p.filename||"asset").split(".").pop()||"bin";const path=`${owner.id}/${assetId}.${ext.replace(/[^a-zA-Z0-9]/g,"")}`;
    const {error:ue}=await admin.storage.from("studio-assets").upload(path,bytes,{contentType:mime,upsert:true});if(ue)throw ue;
    const digest=await sha256Hex(String.fromCharCode(...bytes.slice(0,Math.min(bytes.length,500000))));
    const {data:asset,error}=await admin.from("studio_assets").upsert({id:assetId,owner_id:owner.id,storage_path:path,mime_type:mime,byte_size:bytes.length,sha256:digest,metadata:{filename:p.filename||null}},{onConflict:"id"}).select().single();if(error)throw error;
    const {data:signed}=await admin.storage.from("studio-assets").createSignedUrl(path,3600);
    return {asset,signedUrl:signed?.signedUrl||null};
  }
  if(name==="markActivityDone"){const {data,error}=await admin.from("studio_activity").update({status:"DONE"}).eq("owner_id",owner.id).eq("id",p.id).select().single();if(error)throw error;return data}
  if(name==="createShare"){
    const appOrigin=safeReturnTo(p.appOrigin)||origin; if(!appOrigin)throw new Error("APP_ORIGIN_REQUIRED");
    return createFreshShare(owner.id,p.documentId,appOrigin,p.bundle||null);
  }
  if(name==="disableShare"){
    if(p.shareUrl&&await disableStorageShare(String(p.shareUrl)))return {disabled:true,documentId:p.documentId,transport:"storage_snapshot"};
    const now=new Date().toISOString();
    const {error}=await admin.from("studio_share_links").update({revoked_at:now}).eq("owner_id",owner.id).eq("document_id",p.documentId).is("revoked_at",null);if(error)throw error;
    return {disabled:true,documentId:p.documentId,transport:"legacy_db"};
  }
  if(name==="configureDriveOAuth"){
    const clientId=String(p.clientId||"").trim(),clientSecret=String(p.clientSecret||"").trim();
    if(!clientId||clientId.length<20||!clientSecret||clientSecret.length<10) throw Object.assign(new Error("INVALID_OAUTH_CLIENT_CONFIG"),{status:400});
    await vaultPut("studio_google_client_id",clientId,"TQS Studio Google OAuth web client id");
    await vaultPut("studio_google_client_secret",clientSecret,"TQS Studio Google OAuth web client secret");
    const cfg=await googleConfig();
    await admin.from("studio_drive_connections").update({status:"CONFIGURED",last_error:null,metadata:{oauth_client_configured_at:new Date().toISOString(),redirect_uri:cfg.redirectUri},updated_at:new Date().toISOString()}).eq("owner_id",owner.id);
    return {configured:true,redirectUri:cfg.redirectUri,scopes:DRIVE_SCOPES};
  }
  if(name==="driveStatus"){
    const {data:connection}=await admin.from("studio_drive_connections").select("*").eq("owner_id",owner.id).single();
    const {data:conflicts}=await admin.from("studio_sync_conflicts").select("*").eq("owner_id",owner.id).eq("state","OPEN").order("created_at",{ascending:false}).limit(20);
    const cfg=await googleConfig();return {connection,conflicts:conflicts||[],oauthConfigured:Boolean(cfg.clientId&&cfg.clientSecret),redirectUri:cfg.redirectUri,scopes:DRIVE_SCOPES};
  }
  if(name==="driveListRoot"){
    const q=encodeURIComponent(`'${DRIVE_ROOT}' in parents and trashed = false`);const fields=encodeURIComponent("files(id,name,mimeType,modifiedTime,version,md5Checksum,webViewLink,size)");
    const r=await driveFetch(owner.id,`https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=100&orderBy=folder,name&supportsAllDrives=true&includeItemsFromAllDrives=true`);const x=await r.json();if(!r.ok)throw Object.assign(new Error("DRIVE_LIST_FAILED"),{status:r.status,details:x});return x.files||[];
  }
  if(name==="driveSyncCheckpoint"){
    const overview=await action(owner,"getWorldOverview",{},origin);const content=enc.encode(JSON.stringify({schemaVersion:"tqs-studio-world/v5",exportedAt:new Date().toISOString(),...overview},null,2));
    return upsertDriveContent(owner.id,{entityType:"world_snapshot",entityId:OWNER_WORLD,studioRevision:Number(overview.world.revision),name:"tqs-studio-world-v5.snapshot.json",mimeType:"application/json",content,parentId:DRIVE_ROOT,expectedDriveVersion:p.expectedDriveVersion||null});
  }
  if(name==="driveConflictProbe"){
    const content=enc.encode("{}");return upsertDriveContent(owner.id,{entityType:p.entityType||"world_snapshot",entityId:p.entityId||OWNER_WORLD,studioRevision:Number(p.studioRevision||1),name:"probe.json",mimeType:"application/json",content,parentId:DRIVE_ROOT,expectedDriveVersion:String(p.expectedDriveVersion||"__STALE__"),testConflict:true});
  }
  throw Object.assign(new Error("UNKNOWN_ACTION"),{status:400,details:{name}});
}
async function oauthStart(req:Request,owner:{id:string;email:string},url:URL,origin:string){
  const cfg=await googleConfig();
  if(!cfg.clientId||!cfg.clientSecret) return json({ok:false,code:"OAUTH_CLIENT_CONFIG_REQUIRED",redirectUri:cfg.redirectUri,scopes:DRIVE_SCOPES,secretNames:["studio_google_client_id","studio_google_client_secret"]},409,origin);
  const returnTo=safeReturnTo(url.searchParams.get("return_to"));if(!returnTo)return json({error:"INVALID_RETURN_TO"},400,origin);
  const state=randomToken(32),hash=await sha256Hex(state);
  await admin.from("studio_oauth_states").insert({owner_id:owner.id,state_hash:hash,return_to:returnTo,expires_at:new Date(Date.now()+10*60_000).toISOString()});
  const a=new URL("https://accounts.google.com/o/oauth2/v2/auth");
  a.search=new URLSearchParams({client_id:cfg.clientId,redirect_uri:cfg.redirectUri,response_type:"code",access_type:"offline",prompt:"consent",include_granted_scopes:"true",scope:DRIVE_SCOPES.join(" "),state}).toString();
  return json({url:a.toString(),redirectUri:cfg.redirectUri,scopes:DRIVE_SCOPES},200,origin);
}
async function oauthCallback(url:URL){
  const state=url.searchParams.get("state")||"",code=url.searchParams.get("code")||"";if(!state||!code)return json({error:"OAUTH_CALLBACK_MISSING_PARAMS"},400);
  const hash=await sha256Hex(state);
  const {data:st}=await admin.from("studio_oauth_states").select("*").eq("state_hash",hash).is("used_at",null).gt("expires_at",new Date().toISOString()).maybeSingle();
  if(!st)return json({error:"OAUTH_STATE_INVALID_OR_EXPIRED"},400);
  const cfg=await googleConfig();if(!cfg.clientId||!cfg.clientSecret)return json({error:"OAUTH_CLIENT_CONFIG_REQUIRED"},409);
  const tr=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:cfg.clientId,client_secret:cfg.clientSecret,code,grant_type:"authorization_code",redirect_uri:cfg.redirectUri})});
  const tok=await tr.json();if(!tr.ok||!tok.access_token)return json({error:"TOKEN_EXCHANGE_FAILED",details:tok},502);
  const ur=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:`Bearer ${tok.access_token}`}});const user=await ur.json();
  const {data:owner}=await admin.from("studio_owner_access").select("*").eq("owner_id",st.owner_id).single();
  if(!ur.ok||String(user.email||"").toLowerCase()!==String(owner.email).toLowerCase())return json({error:"OWNER_GOOGLE_ACCOUNT_MISMATCH",expected:owner.email,actual:user.email||null},403);
  const refreshName=`studio_google_refresh_${st.owner_id}`;
  if(tok.refresh_token) await vaultPut(refreshName,tok.refresh_token,"TQS Studio Google Drive refresh token");
  else if(!(await vaultGet(refreshName))) return json({error:"GOOGLE_REFRESH_TOKEN_MISSING_RECONSENT_REQUIRED"},409);
  await admin.from("studio_drive_connections").update({status:"CONNECTED",connected_email:user.email,oauth_secret_name:refreshName,scopes:String(tok.scope||DRIVE_SCOPES.join(" ")).split(" "),last_error:null,updated_at:new Date().toISOString()}).eq("owner_id",st.owner_id);
  await admin.from("studio_oauth_states").update({used_at:new Date().toISOString()}).eq("id",st.id);
  const r=new URL(st.return_to);r.searchParams.set("drive","connected");return Response.redirect(r.toString(),302);
}
async function runV5SelfTest(owner:{id:string;email:string},origin:string){
  const nonce=crypto.randomUUID(),objectId="qa-object-"+nonce,documentId="qa-doc-"+nonce;
  const assetIds:string[]=[]; const storagePaths:string[]=[]; const checks:Record<string,unknown>={};
  try{
    checks.seed=await ensureStudioSeed(owner);
    const overview=await action(owner,"getWorldOverview",{},origin);
    if(!overview?.objects?.some((o:any)=>o.id==="lesson-free-1")) throw new Error("QA_LESSON_FRAME_MISSING");
    checks.world={objects:overview.objects.length,activity:overview.activity.length,revision:overview.world?.revision};

    const lesson=await action(owner,"getDocument",{documentId:"doc-lesson-workspace"},origin);
    if((lesson?.blocks?.length||0)<13) throw new Error("QA_LESSON_BLOCKS_INCOMPLETE");
    checks.lesson={title:lesson.document.title,blocks:lesson.blocks.length};

    const created=await action(owner,"createWorldObject",{object:{
      id:objectId,kind:"text",semantic_path:"QA/V5/Temporary",parent_id:null,x:100,y:100,w:240,h:90,z:99,
      title:"QA temporary",body:{html:"<p>qa</p>"},relations:[],status:null,hidden:true
    }},origin);
    if(created?.object?.id!==objectId) throw new Error("QA_CREATE_OBJECT_FAILED");
    checks.createWorldObject=true;

    const updated=await action(owner,"updateObject",{id:objectId,revision:created.object.revision,patch:{title:"QA updated",body:{html:"<p>updated</p>"}},eventType:"text_update",summary:"QA updated"},origin);
    if(updated?.object?.title!=="QA updated") throw new Error("QA_UPDATE_OBJECT_FAILED");
    checks.updateObject=true;

    const doc=await action(owner,"createDocument",{id:documentId,title:"QA V5 temporary document",semanticPath:"QA/V5",kind:"instruction"},origin);
    const firstId=doc?.blocks?.[0]?.block_id;
    if(!firstId) throw new Error("QA_CREATE_DOCUMENT_FAILED");
    checks.createDocument=true;

    const inserted=await action(owner,"upsertDocumentBlock",{documentId,blockId:"qa-block-"+nonce,blockType:"callout",content:{text:"QA inserted"},afterBlockId:firstId,semanticPath:"QA/V5"},origin);
    if(!inserted?.block) throw new Error("QA_INSERT_BLOCK_FAILED");
    checks.upsertDocumentBlock=true;

    const reordered=await action(owner,"reorderDocumentBlock",{documentId,blockId:"qa-block-"+nonce,targetOrdinal:1},origin);
    if(!reordered?.blocks?.some((b:any)=>b.block_id==="qa-block-"+nonce&&b.ordinal===1)) throw new Error("QA_REORDER_FAILED");
    checks.reorderDocumentBlock=true;

    const dataUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=";
    const asset=await action(owner,"attachAsset",{dataUrl,filename:"qa.png"},origin);
    if(!asset?.asset?.id) throw new Error("QA_ATTACH_ASSET_FAILED");
    assetIds.push(asset.asset.id);storagePaths.push(asset.asset.storage_path);checks.attachAsset=true;
    const assetUrl=await action(owner,"getAssetUrl",{assetId:asset.asset.id},origin);
    if(!assetUrl?.signedUrl) throw new Error("QA_ASSET_URL_FAILED");
    checks.getAssetUrl=true;

    const recent=await action(owner,"getRecentActivity",{semanticPath:"QA/V5",limit:20},origin);
    checks.getRecentActivity=Array.isArray(recent);
    const event=recent?.find((x:any)=>x.entity_id===documentId)||recent?.[0];
    if(event?.id){await action(owner,"markActivityDone",{id:event.id},origin);checks.markActivityDone=true}else checks.markActivityDone="no-event";

    const entity=await action(owner,"getEntityContext",{id:"lesson-free-1"},origin);
    if(!entity?.entity) throw new Error("QA_ENTITY_CONTEXT_FAILED");
    checks.getEntityContext={children:entity.children?.length||0,documents:entity.documents?.length||0};

    const share=await action(owner,"createShare",{documentId,appOrigin:"https://screenerpro-git-chatgpt-tqs-stu-c70e5f-artem-kendirovs-projects.vercel.app"},origin);
    if(!share?.token||!share?.url) throw new Error("QA_SHARE_FAILED");
    const shared=await loadShare(share.token);
    if(!shared?.document?.id) throw new Error("QA_SHARE_READBACK_FAILED");
    checks.share=true;

    const pdf=await generatePdf(await loadDocument(owner.id,documentId),share.url);
    const header=new TextDecoder().decode(pdf.slice(0,4));
    if(header!=="%PDF") throw new Error("QA_PDF_FAILED");
    checks.pdf={bytes:pdf.byteLength,header};

    const drive=await action(owner,"driveStatus",{},origin);
    checks.driveStatus={status:drive?.connection?.status||null,oauthConfigured:Boolean(drive?.oauthConfigured)};

    return {ok:true,checks};
  }finally{
    for(const path of storagePaths){try{await admin.storage.from("studio-assets").remove([path])}catch{}}
    if(assetIds.length)try{await admin.from("studio_assets").delete().in("id",assetIds)}catch{}
    try{await admin.from("studio_activity").delete().like("semantic_path","QA/V5%")}catch{}
    try{await admin.from("studio_world_objects").delete().eq("id",objectId)}catch{}
    try{await admin.from("studio_documents").delete().eq("id",documentId)}catch{}
  }
}


async function runV6AiSelfTest(owner:{id:string;email:string},origin:string){
  const nonce=crypto.randomUUID(),objectId="qa-ai-object-"+nonce,documentId="qa-ai-doc-"+nonce;
  const generateRun="qa-generate-"+nonce,redesignRun="qa-redesign-"+nonce,documentRun="qa-document-"+nonce;
  const runIds=[generateRun,redesignRun,documentRun],checks:Record<string,unknown>={},started=Date.now(),timings:Record<string,number>={};
  const mark=(name:string)=>{timings[name]=Date.now()-started;console.log("QA_P_STAGE",name,timings[name])};
  const objectState=async(id:string)=>{const {data,error}=await admin.from("studio_world_objects").select("id,title,revision,hidden").eq("owner_id",owner.id).eq("id",id).single();if(error)throw error;return data};
  const documentStatus=async(id:string)=>{const {data,error}=await admin.from("studio_documents").select("id,status").eq("owner_id",owner.id).eq("id",id).single();if(error)throw error;return data};
  try{
    const {data:seedProbe,error:seedError}=await admin.from("studio_world_objects").select("id").eq("owner_id",owner.id).in("id",["lesson-miro-scene","lesson-miro-l101","lesson-miro-l102"]);
    if(seedError)throw seedError;if((seedProbe||[]).length<3)await ensureStudioSeed(owner);mark("seed");

    const context=await action(owner,"getStudioContext",{frameId:"lesson-miro-scene",documentId:"doc-lesson-workspace",objectIds:["lesson-miro-l101"],blockIds:["lesson-chart"],pointer:{x:5250,y:2280},viewport:{x:-1200,y:-700,zoom:.82,width:1440,height:900}},origin);
    if(context?.frame?.id!=="lesson-miro-scene"||context?.selection?.object_ids?.[0]!=="lesson-miro-l101"||context?.selection?.block_ids?.[0]!=="lesson-chart"||context?.pointer?.x!==5250||context?.viewport?.zoom!==.82||context?.linked_documents?.[0]?.id!=="doc-lesson-workspace"||context?.selected_blocks?.[0]?.block_id!=="lesson-chart")throw new Error("QA_AI_CONTEXT_FAILED");
    checks.context={frame:context.frame.id,objects:context.selection.object_ids,blocks:context.selection.block_ids,pointer:context.pointer,viewport:context.viewport,document:context.linked_documents[0].id};mark("context");

    const neighborBefore=await objectState("lesson-miro-l102");
    const generated=await action(owner,"aiApplyMutation",{actor:"chatgpt",generationRunId:generateRun,scope:"world",context:{frameId:"lesson-miro-scene",documentId:"doc-lesson-workspace",objectIds:["lesson-miro-l101"],blockIds:["lesson-chart"],pointer:{x:5250,y:2280},viewport:{x:-1200,y:-700,zoom:.82,width:1440,height:900}},sourceRefs:[{kind:"owner_miro",ref:"ЗАНЯТИЕ 1 · РАБОЧЕЕ ПРОСТРАНСТВО"}],mutations:[{operation:"create",object:{id:objectId,kind:"text",title:"QA Generate Here",body:{html:"<p>generated here</p>"}},summary:"QA Generate here"}]},origin);
    const created=generated?.changed?.find((x:any)=>x.id===objectId);
    if(!created||created.parent_id!=="lesson-miro-scene"||created.x!==5250||created.y!==2280||generated.focus_target_id!==objectId||generated.canonical_readback!==true)throw new Error("QA_AI_GENERATE_HERE_FAILED");
    checks.generateHere={id:created.id,parent_id:created.parent_id,x:created.x,y:created.y,focus:generated.focus_target_id};mark("generate");

    const [generateHistory,freshActivity]=await Promise.all([
      action(owner,"getChangeHistory",{generationRunId:generateRun,limit:20},origin),
      action(owner,"getRecentActivity",{semanticPath:"Обучение/Бесплатный курс/Занятие 1/Рабочее пространство",limit:100},origin)
    ]);
    const createEvent=generateHistory.find((x:any)=>x.entity_id===objectId&&x.payload?.operation==="create");
    if(!createEvent||createEvent.payload?.actor!=="chatgpt"||createEvent.payload?.generation_run_id!==generateRun||createEvent.payload?.after?.id!==objectId)throw new Error("QA_AI_PROVENANCE_FAILED");
    if(!freshActivity.some((x:any)=>x.entity_id===objectId&&x.payload?.generation_run_id===generateRun))throw new Error("QA_AI_FRESH_SESSION_RECOVERY_FAILED");
    checks.provenance={history:createEvent.id,freshActivity:true,generation_run_id:generateRun};mark("provenance");

    const redesigned=await action(owner,"aiApplyMutation",{actor:"chatgpt",generationRunId:redesignRun,scope:"selection",context:{frameId:"lesson-miro-scene",objectIds:[objectId],pointer:{x:5250,y:2280},viewport:{x:-1200,y:-700,zoom:.82,width:1440,height:900}},sourceRefs:[{kind:"selection",ref:objectId}],mutations:[{operation:"update",id:objectId,patch:{title:"QA Redesigned",body:{html:"<p>redesigned</p>"}},summary:"QA Redesign this"}]},origin);
    if(redesigned?.changed?.[0]?.title!=="QA Redesigned"||redesigned.focus_target_id!==objectId)throw new Error("QA_AI_REDESIGN_FAILED");
    const [neighborAfter,redesignHistory]=await Promise.all([objectState("lesson-miro-l102"),action(owner,"getChangeHistory",{generationRunId:redesignRun,limit:20},origin)]);
    if(neighborAfter?.title!==neighborBefore?.title||neighborAfter?.revision!==neighborBefore?.revision)throw new Error("QA_AI_SCOPE_LEAK");
    if(!redesignHistory.some((x:any)=>x.entity_id===objectId&&x.payload?.before?.title==="QA Generate Here"&&x.payload?.after?.title==="QA Redesigned"))throw new Error("QA_AI_REDESIGN_HISTORY_FAILED");mark("redesign");

    await action(owner,"undoAiRun",{generationRunId:redesignRun,actor:"chatgpt"},origin);
    const undoRead=await objectState(objectId);if(undoRead?.title!=="QA Generate Here")throw new Error("QA_AI_UNDO_FAILED");
    await action(owner,"redoAiRun",{generationRunId:redesignRun,actor:"chatgpt"},origin);
    const redoRead=await objectState(objectId);if(redoRead?.title!=="QA Redesigned")throw new Error("QA_AI_REDO_FAILED");
    checks.redesign={id:objectId,neighborUnchanged:true,undo:"QA Generate Here",redo:"QA Redesigned"};mark("undo_redo");

    const built=await action(owner,"aiCreateDocumentFromFrame",{id:documentId,frameId:"lesson-miro-scene",title:"QA AI owner scene",kind:"lesson",generationRunId:documentRun,actor:"chatgpt",sourceRefs:[{kind:"owner_miro",ref:"lesson-1-workspace"}]},origin);
    if(built?.document?.id!==documentId||built?.document?.metadata?.generation_run_id!==documentRun||built?.document?.metadata?.source_frame_id!=="lesson-miro-scene"||!built?.source_object_ids?.includes("lesson-miro-l101")||!built?.source_object_ids?.includes(objectId))throw new Error("QA_AI_FRAME_DOCUMENT_FAILED");
    const {data:sourceBlock,error:sourceError}=await admin.from("studio_document_blocks").select("content").eq("owner_id",owner.id).eq("document_id",documentId).eq("block_type","sources").single();if(sourceError)throw sourceError;
    const sources=sourceBlock?.content?.items||[];
    if(!sources.some((x:any)=>x.objectId==="lesson-miro-l101")||!sources.some((x:any)=>x.objectId===objectId))throw new Error("QA_AI_FRAME_DOCUMENT_SOURCE_REFS_FAILED");
    await action(owner,"undoAiRun",{generationRunId:documentRun,actor:"chatgpt"},origin);
    const archived=await documentStatus(documentId);if(archived?.status!=="ARCHIVED")throw new Error("QA_AI_DOCUMENT_UNDO_FAILED");
    await action(owner,"redoAiRun",{generationRunId:documentRun,actor:"chatgpt"},origin);
    const restored=await documentStatus(documentId);if(restored?.status!=="DRAFT")throw new Error("QA_AI_DOCUMENT_REDO_FAILED");
    checks.frameToDocument={id:documentId,sources:sources.length,undo:"ARCHIVED",redo:"DRAFT"};mark("frame_document");
    checks.timings_ms=timings;
    return {ok:true,gate:"P",checks};
  }finally{
    await Promise.allSettled([
      ...runIds.map(runId=>admin.from("studio_activity").delete().contains("payload",{generation_run_id:runId})),
      admin.from("studio_document_blocks").delete().eq("document_id",documentId),
      admin.from("studio_document_revisions").delete().eq("document_id",documentId),
      admin.from("studio_documents").delete().eq("id",documentId),
      admin.from("studio_world_objects").delete().eq("id",objectId)
    ]);
  }
}

const PUBLIC_OWNER_ID=Deno.env.get("STUDIO_PUBLIC_OWNER_ID")||"8b89b5b2-5458-4a84-b6e4-29ee8c8c8490";
const PUBLIC_OWNER_EMAIL=Deno.env.get("STUDIO_PUBLIC_OWNER_EMAIL")||"kendirov@gmail.com";
async function publicOwner(){
  return {id:PUBLIC_OWNER_ID,email:PUBLIC_OWNER_EMAIL};
}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("Origin")||undefined;
  if(req.method==="OPTIONS"){const h=new Headers();applyCors(h,origin);return new Response(null,{status:204,headers:h})}
  const url=new URL(req.url),path=functionPath(url);
  try{
    if(path==="/health") return json({ok:true,service:"studio-api",schema:"v5"},200,origin);
    if(path==="/owner/bootstrap"&&req.method==="GET") return ownerBootstrap(url);
    if(path==="/oauth/callback") return oauthCallback(url);
    if(path==="/share"){
      const token=url.searchParams.get("token")||"";const bundle=token?(await loadStorageShare(token)||await loadShare(token)):null;
      if(!bundle)return json({error:"SHARE_NOT_FOUND"},404,origin);return json(bundle,200,origin);
    }
    if(path==="/public/qa"&&req.method==="GET"){
      const o=await publicOwner();
      return json(await runV5SelfTest({id:o.id,email:o.email},origin||""),200,origin);
    }
    if(path==="/public/qa-ai"&&req.method==="GET"){
      const o=await publicOwner();
      return json(await runV6AiSelfTest({id:o.id,email:o.email},origin||""),200,origin);
    }
    if(path==="/public/smoke"&&req.method==="GET"){
      const o=await publicOwner();
      const world=await action({id:o.id,email:o.email},"getWorldOverview",{},origin||"");
      const docs=await action({id:o.id,email:o.email},"listDocuments",{},origin||"");
      return json({ok:true,mode:"open-prototype",world:world?.world?.title||null,objects:world?.objects?.length||0,documents:docs?.length||0},200,origin);
    }
    if(path==="/public/action"&&req.method==="POST"){
      const body=await req.json();
      const allowed=new Set(["ensureSeed","getWorldOverview","getEntityContext","getRecentActivity","getStudioContext","getChangeHistory","aiApplyMutation","undoAiRun","redoAiRun","aiCreateDocumentFromFrame","getDocument","listDocuments","createDocument","upsertDocumentBlock","reorderDocumentBlock","createWorldObject","updateObject","getAssetUrl","attachAsset","markActivityDone","createShare","disableShare","driveStatus"]);
      if(!allowed.has(body.action)) return json({ok:false,error:"PUBLIC_ACTION_FORBIDDEN"},403,origin);
      const o=await publicOwner();
      return json({ok:true,data:await action({id:o.id,email:o.email},body.action,body.payload||{},origin||"")},200,origin);
    }
    if(path==="/public/pdf"&&req.method==="GET"){
      const o=await publicOwner();
      const documentId=url.searchParams.get("documentId")||"";const appOrigin=safeReturnTo(url.searchParams.get("appOrigin"))||origin||"";
      if(!documentId||!appOrigin)return json({error:"documentId/appOrigin required"},400,origin);
      const share=await createFreshShare(o.id,documentId,appOrigin);const liveUrl=share.url;
      const bundle=await loadDocument(o.id,documentId);const pdf=await generatePdf(bundle,liveUrl);
      const h=new Headers({"Content-Type":"application/pdf","Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(bundle.document.title+".pdf")}`,"X-TQS-Share-Url":liveUrl});applyCors(h,origin);return new Response(pdf,{headers:h});
    }
    const owner=await ownerFromRequest(req);
    if(path==="/oauth/start"&&req.method==="GET") return oauthStart(req,owner,url,origin||"");
    if(path==="/pdf"&&req.method==="GET"){
      const documentId=url.searchParams.get("documentId")||"";const appOrigin=safeReturnTo(url.searchParams.get("appOrigin"))||origin||"";
      if(!documentId||!appOrigin)return json({error:"documentId/appOrigin required"},400,origin);
      const share=await createFreshShare(owner.id,documentId,appOrigin);
      const liveUrl=share.url;
      const bundle=await loadDocument(owner.id,documentId);const pdf=await generatePdf(bundle,liveUrl);
      let drive:any=null;
      if(url.searchParams.get("saveDrive")==="1"){
        try{drive=await upsertDriveContent(owner.id,{entityType:"pdf_export",entityId:`${documentId}:r${bundle.document.revision}`,studioRevision:Number(bundle.document.revision),name:`${bundle.document.title}.pdf`,mimeType:"application/pdf",content:pdf,parentId:DRIVE_EXPORTS})}catch(e){drive={error:(e as Error).message}}
      }
      const h=new Headers({"Content-Type":"application/pdf","Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(bundle.document.title+".pdf")}`,"X-TQS-Share-Url":liveUrl});if(drive)h.set("X-TQS-Drive-Export",encodeURIComponent(JSON.stringify(drive)));applyCors(h,origin);return new Response(pdf,{headers:h});
    }
    if(path==="/action"&&req.method==="POST"){
      const body=await req.json();return json({ok:true,data:await action(owner,body.action,body.payload||{},origin||"")},200,origin);
    }
    return json({error:"NOT_FOUND",path},404,origin);
  }catch(e){
    const x=e as any;console.error("[studio-api]",x);
    return json({ok:false,error:x.message||String(x),details:x.details||null},Number(x.status||500),origin);
  }
});
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.99.3";
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import postgres from "npm:postgres@3.4.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const secretMap = (()=>{try{return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")}catch{return {}}})();
const SERVICE_KEY = secretMap.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession:false, autoRefreshToken:false } });
const directDb = postgres(Deno.env.get("SUPABASE_DB_URL") ?? "", {prepare:false,max:1,connect_timeout:5,idle_timeout:20});
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
async function createFreshShare(ownerId:string,documentId:string,appOrigin:string){
  const {data:doc}=await admin.from("studio_documents").select("*").eq("id",documentId).eq("owner_id",ownerId).single();
  await admin.from("studio_share_links").update({revoked_at:new Date().toISOString()}).eq("owner_id",ownerId).eq("document_id",documentId).is("revoked_at",null);
  const token=randomToken(32),hash=await sha256Hex(token);
  await admin.from("studio_share_links").insert({owner_id:ownerId,document_id:documentId,slug:doc.slug,token_hash:hash,mode:"unlisted",document_revision:doc.revision});
  await admin.from("studio_documents").update({share_mode:"unlisted",updated_at:new Date().toISOString()}).eq("id",documentId);
  return {token,url:`${appOrigin.replace(/\/$/,"")}/d/${encodeURIComponent(doc.slug)}?t=${token}`,slug:doc.slug,documentRevision:doc.revision};
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
  await admin.from("studio_activity").insert({owner_id:ownerId,world_key:OWNER_WORLD,entity_id:entityId,semantic_path:semanticPath,event_type:eventType,summary,payload,status:"NEW"});
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
    {id:"frame-learning",kind:"frame",semantic_path:"Обучение",parent_id:null,x:3900,y:260,w:2300,h:1700,z:1,title:"Обучение",body:{},relations:[],status:null,hidden:false},
    {id:"frame-articles",kind:"frame",semantic_path:"Статьи",parent_id:null,x:600,y:1800,w:1650,h:1000,z:1,title:"Статьи",body:{},relations:[],status:null,hidden:false},
    {id:"frame-inbox",kind:"frame",semantic_path:"Inbox",parent_id:null,x:2700,y:1780,w:1200,h:900,z:1,title:"Inbox",body:{},relations:[],status:null,hidden:false},
    {id:"course-free",kind:"frame",semantic_path:"Обучение/Бесплатный курс",parent_id:"frame-learning",x:4100,y:520,w:920,h:1180,z:2,title:"Бесплатный курс",body:{},relations:[{type:"contains",targetId:"frame-learning"}],status:null,hidden:false},
    {id:"course-scalp",kind:"frame",semantic_path:"Обучение/Скальпинг по стакану",parent_id:"frame-learning",x:5160,y:520,w:850,h:1180,z:2,title:"Скальпинг по стакану",body:{},relations:[{type:"contains",targetId:"frame-learning"}],status:null,hidden:false},
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
    {id:"article-si-frame",kind:"documentRef",semantic_path:"Статьи/Si — история ликвидности",parent_id:"frame-articles",x:820,y:2070,w:650,h:240,z:5,title:"Статья — Si: история ликвидности",body:{documentId:"doc-si"},relations:[{type:"document_of",targetId:"doc-si"},{type:"contains",targetId:"frame-articles"}],status:null,hidden:false}
  ].map(o=>({...o,world_key:OWNER_WORLD,owner_id:owner.id,revision:1}));
  const {error:oe}=await admin.from("studio_world_objects").upsert(objects,{onConflict:"id",ignoreDuplicates:true}); if(oe)throw oe;

  const docs=[
    {id:"doc-lesson-workspace",owner_id:owner.id,world_key:OWNER_WORLD,slug:"zanyatie-1-rabochee-prostranstvo",kind:"lesson",title:"Занятие 1 — Рабочее пространство",semantic_path:"Обучение/Бесплатный курс/Занятие 1",frame_id:"lesson-free-1",revision:1,status:"DRAFT",share_mode:"private",metadata:{demo:true}},
    {id:"doc-si",owner_id:owner.id,world_key:OWNER_WORLD,slug:"si-istoriya-likvidnosti",kind:"article",title:"Статья — Si: история ликвидности",semantic_path:"Статьи/Si — история ликвидности",frame_id:"article-si-frame",revision:1,status:"DRAFT",share_mode:"private",metadata:{drive_package_id:"1UJVJUBPt5pEHmjmb79Pllm-hyIij0DkD"}}
  ];
  const {error:de}=await admin.from("studio_documents").upsert(docs,{onConflict:"id",ignoreDuplicates:true}); if(de)throw de;

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
    const {data,error}=await admin.from("studio_world_objects").insert(row).select().single();if(error)throw error;const worldRevision=await bumpWorld(owner.id);
    await logActivity(owner.id,data.id,data.semantic_path,"create",`Создано: ${data.title||data.kind}`);return {object:data,worldRevision};
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
    return createFreshShare(owner.id,p.documentId,appOrigin);
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

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("Origin")||undefined;
  if(req.method==="OPTIONS"){const h=new Headers();applyCors(h,origin);return new Response(null,{status:204,headers:h})}
  const url=new URL(req.url),path=functionPath(url);
  try{
    if(path==="/health") return json({ok:true,service:"studio-api",schema:"v5"},200,origin);
    if(path==="/public/db-smoke"&&req.method==="GET"){
      const raw=Deno.env.get("SUPABASE_DB_URL")||"";
      let parsed:any=null;try{const u=new URL(raw);parsed={protocol:u.protocol,hostname:u.hostname,port:u.port,hasUser:Boolean(u.username),hasPassword:Boolean(u.password),pathname:u.pathname}}catch{}
      try{
        const [row]=await directDb`select now() as now, (select count(*)::int from public.studio_world_objects where world_key=${OWNER_WORLD}) as objects`;
        return json({ok:true,transport:"direct-postgres",envPresent:Boolean(raw),envLength:raw.length,parsed,now:row?.now||null,objects:row?.objects||0},200,origin);
      }catch(error){
        return json({ok:false,transport:"direct-postgres",envPresent:Boolean(raw),envLength:raw.length,parsed,error:error instanceof Error?error.message:String(error)},500,origin);
      }
    }
    if(path==="/owner/bootstrap"&&req.method==="GET") return ownerBootstrap(url);
    if(path==="/oauth/callback") return oauthCallback(url);
    if(path==="/share"){
      const token=url.searchParams.get("token")||"";const bundle=token?await loadShare(token):null;
      if(!bundle)return json({error:"SHARE_NOT_FOUND"},404,origin);return json(bundle,200,origin);
    }
    if(path==="/public/qa"&&req.method==="GET"){
      const {data:o,error:e}=await admin.from("studio_owner_access").select("owner_id,email").eq("email","kendirov@gmail.com").single();
      if(e||!o) throw e||new Error("PUBLIC_OWNER_NOT_FOUND");
      return json(await runV5SelfTest({id:o.owner_id,email:o.email},origin||""),200,origin);
    }
    if(path==="/public/smoke"&&req.method==="GET"){
      const {data:o,error:e}=await admin.from("studio_owner_access").select("owner_id,email").eq("email","kendirov@gmail.com").single();
      if(e||!o) throw e||new Error("PUBLIC_OWNER_NOT_FOUND");
      const world=await action({id:o.owner_id,email:o.email},"getWorldOverview",{},origin||"");
      const docs=await action({id:o.owner_id,email:o.email},"listDocuments",{},origin||"");
      return json({ok:true,mode:"open-prototype",world:world?.world?.title||null,objects:world?.objects?.length||0,documents:docs?.length||0},200,origin);
    }
    if(path==="/public/action"&&req.method==="POST"){
      const body=await req.json();
      const allowed=new Set(["ensureSeed","getWorldOverview","getEntityContext","getRecentActivity","getDocument","listDocuments","createDocument","upsertDocumentBlock","reorderDocumentBlock","createWorldObject","updateObject","getAssetUrl","attachAsset","markActivityDone","createShare","driveStatus"]);
      if(!allowed.has(body.action)) return json({ok:false,error:"PUBLIC_ACTION_FORBIDDEN"},403,origin);
      const {data:o,error:e}=await admin.from("studio_owner_access").select("owner_id,email").eq("email","kendirov@gmail.com").single();
      if(e||!o) throw e||new Error("PUBLIC_OWNER_NOT_FOUND");
      return json({ok:true,data:await action({id:o.owner_id,email:o.email},body.action,body.payload||{},origin||"")},200,origin);
    }
    if(path==="/public/pdf"&&req.method==="GET"){
      const {data:o,error:e}=await admin.from("studio_owner_access").select("owner_id,email").eq("email","kendirov@gmail.com").single();
      if(e||!o) throw e||new Error("PUBLIC_OWNER_NOT_FOUND");
      const documentId=url.searchParams.get("documentId")||"";const appOrigin=safeReturnTo(url.searchParams.get("appOrigin"))||origin||"";
      if(!documentId||!appOrigin)return json({error:"documentId/appOrigin required"},400,origin);
      const share=await createFreshShare(o.owner_id,documentId,appOrigin);const liveUrl=share.url;
      const bundle=await loadDocument(o.owner_id,documentId);const pdf=await generatePdf(bundle,liveUrl);
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
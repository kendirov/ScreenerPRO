import "server-only";
import {createHmac,timingSafeEqual} from "node:crypto";
import {deflateRawSync,inflateRawSync} from "node:zlib";
import type {DocumentBundle} from "@/lib/studio-v5/types";

const MAX_TOKEN_BYTES=64_000;
function secret(){
  const v=process.env.TQS_SHARE_SIGNING_SECRET||"";
  if(v)return v;
  if(process.env.NODE_ENV!=="production")return "tqs-studio-local-qa-signing-key";
  throw new Error("TQS_SHARE_SIGNING_SECRET_REQUIRED");
}
function sign(data:string){return createHmac("sha256",secret()).update(data).digest("base64url")}
function safeEqual(a:string,b:string){
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length&&timingSafeEqual(x,y);
}
export function createStatelessShare(bundle:DocumentBundle,appOrigin:string){
  const payload={v:1,publishedAt:new Date().toISOString(),bundle};
  const data=deflateRawSync(Buffer.from(JSON.stringify(payload),"utf8"),{level:9}).toString("base64url");
  if(data.length>MAX_TOKEN_BYTES)throw new Error("STATELESS_SHARE_TOO_LARGE");
  const token="v1."+data+"."+sign(data);
  const origin=new URL(appOrigin).origin,slug=encodeURIComponent(bundle.document.slug||bundle.document.id);
  return{token,url:`${origin}/d/${slug}?s=${encodeURIComponent(token)}`,documentId:bundle.document.id,revision:bundle.document.revision,transport:"stateless_signed_snapshot",publishedAt:payload.publishedAt};
}
export function readStatelessShare(token:string):DocumentBundle|null{
  try{
    if(!token||token.length>MAX_TOKEN_BYTES+128)return null;
    const [v,data,sig]=token.split(".");
    if(v!=="v1"||!data||!sig||!safeEqual(sign(data),sig))return null;
    const raw=inflateRawSync(Buffer.from(data,"base64url"),{maxOutputLength:1_000_000}).toString("utf8");
    const parsed=JSON.parse(raw);
    if(parsed?.v!==1||!parsed?.bundle?.document?.id||!Array.isArray(parsed?.bundle?.blocks))return null;
    return parsed.bundle as DocumentBundle;
  }catch{return null}
}

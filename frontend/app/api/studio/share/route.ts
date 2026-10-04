const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||"https://hppbuzbrjoyrwpdinlxk.supabase.co";
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"sb_publishable_FPnSkBjbvgAW0VBE_u4_Kw_QAfJ_DFh";

async function rpc(name:string,payload:any,keyOverride?:string|null){
  const key=SUPABASE_KEY||keyOverride||"";
  if(!key)throw Object.assign(new Error("SUPABASE_PUBLIC_KEY_MISSING"),{status:500});
  let last:Response|null=null;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "apikey":key,
          "Authorization":`Bearer ${key}`
        },
        body:JSON.stringify(payload),
        cache:"no-store",
        signal:AbortSignal.timeout(8000)
      });
      if(r.ok){const text=await r.text();try{return text?JSON.parse(text):null}catch{return text}}
      last=r;if(r.status<500)break;
    }catch(error){if(attempt===1)throw error}
    await new Promise(r=>setTimeout(r,250));
  }
  if(!last)throw Object.assign(new Error("SUPABASE_RPC_UNAVAILABLE"),{status:502});
  const text=await last.text();
  let data:any=null;try{data=text?JSON.parse(text):null}catch{data=text}
  throw Object.assign(new Error(data?.message||data?.error||`RPC ${last.status}`),{status:last.status,details:data});
}

export async function POST(req:Request){
  try{
    const {documentId,appOrigin}=await req.json();
    if(!documentId||!appOrigin)return Response.json({ok:false,error:"documentId/appOrigin required"},{status:400});
    const data=await rpc("studio_public_share_create",{p_document_id:String(documentId),p_app_origin:String(appOrigin)},req.headers.get("x-studio-public-key"));
    return Response.json({ok:true,data},{headers:{"Cache-Control":"no-store"}});
  }catch(error:any){
    return Response.json({ok:false,error:error?.message||String(error),details:error?.details||null},{status:Number(error?.status||502),headers:{"Cache-Control":"no-store"}});
  }
}

export async function GET(req:Request){
  try{
    const token=new URL(req.url).searchParams.get("token")||"";
    if(!token)return Response.json({ok:false,error:"token required"},{status:400});
    const data=await rpc("studio_public_share_load",{p_token:token},req.headers.get("x-studio-public-key"));
    if(!data)return Response.json({ok:false,error:"SHARE_NOT_FOUND"},{status:404});
    return Response.json({ok:true,data},{headers:{"Cache-Control":"no-store"}});
  }catch(error:any){
    return Response.json({ok:false,error:error?.message||String(error),details:error?.details||null},{status:Number(error?.status||502),headers:{"Cache-Control":"no-store"}});
  }
}

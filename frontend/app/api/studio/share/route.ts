const EDGE_ACTION="https://hppbuzbrjoyrwpdinlxk.supabase.co/functions/v1/studio-api/public/action";
const EDGE_SHARE="https://hppbuzbrjoyrwpdinlxk.supabase.co/functions/v1/studio-api/share";

async function edgeFetch(url:string,init:RequestInit){
  let lastStatus=502,lastText="";
  for(let attempt=0;attempt<2;attempt++){
    try{
      const r=await fetch(url,{...init,cache:"no-store",signal:AbortSignal.timeout(6500)});
      const text=await r.text();
      if(r.ok)return {status:r.status,text};
      lastStatus=r.status;lastText=text;
      if(r.status<500)break;
    }catch(error){
      lastStatus=502;lastText=JSON.stringify({error:error instanceof Error?error.message:String(error)});
    }
    if(attempt===0)await new Promise(r=>setTimeout(r,250));
  }
  return {status:lastStatus,text:lastText};
}
function parsed(text:string){try{return text?JSON.parse(text):null}catch{return text}}

export async function POST(req:Request){
  try{
    const {documentId,appOrigin}=await req.json();
    if(!documentId||!appOrigin)return Response.json({ok:false,error:"documentId/appOrigin required"},{status:400});
    const upstream=await edgeFetch(EDGE_ACTION,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"createShare",payload:{documentId:String(documentId),appOrigin:String(appOrigin)}})
    });
    const data=parsed(upstream.text);
    if(upstream.status>=400||!data?.ok)return Response.json({ok:false,error:data?.error||`Share upstream ${upstream.status}`,details:data?.details||data},{status:upstream.status,headers:{"Cache-Control":"no-store"}});
    return Response.json({ok:true,data:data.data},{headers:{"Cache-Control":"no-store"}});
  }catch(error:any){
    return Response.json({ok:false,error:error?.message||String(error)},{status:502,headers:{"Cache-Control":"no-store"}});
  }
}

export async function GET(req:Request){
  try{
    const token=new URL(req.url).searchParams.get("token")||"";
    if(!token)return Response.json({ok:false,error:"token required"},{status:400});
    const upstream=await edgeFetch(`${EDGE_SHARE}?token=${encodeURIComponent(token)}`,{method:"GET"});
    const data=parsed(upstream.text);
    if(upstream.status>=400||!data)return Response.json({ok:false,error:data?.error||`Share upstream ${upstream.status}`,details:data},{status:upstream.status,headers:{"Cache-Control":"no-store"}});
    return Response.json({ok:true,data},{headers:{"Cache-Control":"no-store"}});
  }catch(error:any){
    return Response.json({ok:false,error:error?.message||String(error)},{status:502,headers:{"Cache-Control":"no-store"}});
  }
}

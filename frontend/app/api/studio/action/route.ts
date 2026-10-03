const EDGE="https://hppbuzbrjoyrwpdinlxk.supabase.co/functions/v1/studio-api/public/action";

async function forward(body:string){
  let last={status:503,contentType:"application/json",body:JSON.stringify({ok:false,error:"STUDIO_UPSTREAM_UNAVAILABLE"})};
  for(let attempt=0;attempt<2;attempt++){
    try{
      const r=await fetch(EDGE,{method:"POST",headers:{"Content-Type":"application/json"},body,cache:"no-store",signal:AbortSignal.timeout(7000)});
      const text=await r.text();
      last={status:r.status,contentType:r.headers.get("content-type")||"application/json",body:text};
      if(r.status<500)return last;
    }catch(error){
      last={status:503,contentType:"application/json",body:JSON.stringify({ok:false,error:error instanceof Error?error.message:String(error)})};
    }
    if(attempt===0)await new Promise(r=>setTimeout(r,250));
  }
  return last;
}
export async function POST(req:Request){
  const result=await forward(await req.text());
  return new Response(result.body,{status:result.status,headers:{"Content-Type":result.contentType,"Cache-Control":"no-store"}});
}

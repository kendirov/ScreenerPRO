const EDGE="https://hppbuzbrjoyrwpdinlxk.supabase.co/functions/v1/studio-api/public/action";

async function forward(body:string){
  let last:Response|null=null;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const r=await fetch(EDGE,{method:"POST",headers:{"Content-Type":"application/json"},body,cache:"no-store",signal:AbortSignal.timeout(12000)});
      if(r.status<500)return r;
      last=r;
    }catch{}
    if(attempt===0)await new Promise(r=>setTimeout(r,350));
  }
  return last??new Response(JSON.stringify({ok:false,error:"STUDIO_UPSTREAM_UNAVAILABLE"}),{status:503,headers:{"Content-Type":"application/json"}});
}
export async function POST(req:Request){
  const body=await req.text();
  const r=await forward(body);
  const text=await r.text();
  return new Response(text,{status:r.status,headers:{"Content-Type":r.headers.get("content-type")||"application/json","Cache-Control":"no-store"}});
}

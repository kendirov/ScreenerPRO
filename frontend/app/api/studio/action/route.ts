const EDGE="https://hppbuzbrjoyrwpdinlxk.supabase.co/functions/v1/studio-api/public/action";

async function forward(body:string){
  let action="";try{action=String(JSON.parse(body)?.action||"")}catch{}
  const mustComplete=new Set(["createShare","configureDriveOAuth","driveListRoot","driveSyncCheckpoint","driveConflictProbe"]).has(action),attempts=mustComplete?1:2,timeoutMs=action==="createShare"?30000:mustComplete?20000:3400;
  let last={status:503,contentType:"application/json",body:JSON.stringify({ok:false,error:"STUDIO_UPSTREAM_UNAVAILABLE"})};
  for(let attempt=0;attempt<attempts;attempt++){
    try{
      const r=await fetch(EDGE,{method:"POST",headers:{"Content-Type":"application/json"},body,cache:"no-store",signal:AbortSignal.timeout(timeoutMs)});
      const text=await r.text();
      last={status:r.status,contentType:r.headers.get("content-type")||"application/json",body:text};
      if(r.status<500)return last;
    }catch(error){
      last={status:503,contentType:"application/json",body:JSON.stringify({ok:false,error:error instanceof Error?error.message:String(error)})};
    }
    if(attempt+1<attempts)await new Promise(r=>setTimeout(r,250));
  }
  if(last.status>=500&&!mustComplete){
    let detail:any=null;try{detail=JSON.parse(last.body)}catch{}
    return {status:202,contentType:"application/json",body:JSON.stringify({ok:false,deferred:true,error:detail?.error||"STUDIO_SYNC_DEFERRED",upstreamStatus:last.status})};
  }
  return last;
}
export async function POST(req:Request){
  const result=await forward(await req.text());
  return new Response(result.body,{status:result.status,headers:{"Content-Type":result.contentType,"Cache-Control":"no-store","X-TQS-Sync":result.status===202?"deferred":"upstream"}});
}

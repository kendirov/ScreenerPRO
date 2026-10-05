import {createStatelessShare} from "@/lib/studio-v6/share-snapshot";
const EDGE="https://hppbuzbrjoyrwpdinlxk.supabase.co/functions/v1/studio-api/public/action";

async function forward(body:string){
  let parsed:any=null,action="";try{parsed=JSON.parse(body);action=String(parsed?.action||"")}catch{}
  const mustComplete=new Set(["createShare","configureDriveOAuth","driveListRoot","driveSyncCheckpoint","driveConflictProbe","getStudioContext","getChangeHistory","aiApplyMutation","undoAiRun","redoAiRun","aiCreateDocumentFromFrame"]).has(action),attempts=mustComplete?1:2,timeoutMs=action==="createShare"?30000:mustComplete?20000:3400;
  let last:{status:number;contentType:string;body:string;transport?:string}={status:503,contentType:"application/json",body:JSON.stringify({ok:false,error:"STUDIO_UPSTREAM_UNAVAILABLE"}),transport:"upstream"};
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
  if((last.status===408||last.status===425||last.status===429||last.status>=500)&&action==="createShare"&&parsed?.payload?.bundle&&parsed?.payload?.appOrigin){
    try{
      const snapshot=createStatelessShare(parsed.payload.bundle,parsed.payload.appOrigin);
      return {status:200,contentType:"application/json",body:JSON.stringify({ok:true,data:snapshot}),transport:"stateless-share"};
    }catch(error){
      return {status:503,contentType:"application/json",body:JSON.stringify({ok:false,error:error instanceof Error?error.message:String(error)}),transport:"stateless-share-error"};
    }
  }
  if(last.status>=500&&!mustComplete){
    let detail:any=null;try{detail=JSON.parse(last.body)}catch{}
    return {status:202,contentType:"application/json",body:JSON.stringify({ok:false,deferred:true,error:detail?.error||"STUDIO_SYNC_DEFERRED",upstreamStatus:last.status}),transport:"deferred"};
  }
  return {...last,transport:"upstream"};
}
export async function POST(req:Request){
  const result=await forward(await req.text());
  return new Response(result.body,{status:result.status,headers:{"Content-Type":result.contentType,"Cache-Control":"no-store","X-TQS-Sync":result.status===202?"deferred":"upstream","X-TQS-Transport":result.transport||"upstream"}});
}

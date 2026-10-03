const EDGE="https://hppbuzbrjoyrwpdinlxk.supabase.co/functions/v1/studio-api/public/qa";
export async function GET(){
  try{
    const r=await fetch(EDGE,{cache:"no-store",signal:AbortSignal.timeout(60000)});
    const body=await r.text();
    return new Response(body,{status:r.status,headers:{"Content-Type":r.headers.get("content-type")||"application/json","Cache-Control":"no-store"}});
  }catch(error){
    return Response.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:502});
  }
}

const EDGE="https://hppbuzbrjoyrwpdinlxk.supabase.co/functions/v1/studio-api/public/smoke";
export async function GET(){
 try{
  const r=await fetch(EDGE,{cache:"no-store",signal:AbortSignal.timeout(8000)});
  return new Response(await r.text(),{status:r.status,headers:{"Content-Type":r.headers.get("content-type")||"application/json","Cache-Control":"no-store"}});
 }catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:502})}
}

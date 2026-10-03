const EDGE="https://hppbuzbrjoyrwpdinlxk.supabase.co/functions/v1/studio-api/public/pdf-bundle";

export async function POST(req:Request){
  try{
    const body=await req.json();
    const r=await fetch(EDGE,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body),
      cache:"no-store",
      signal:AbortSignal.timeout(20000)
    });
    const buf=await r.arrayBuffer();
    const h=new Headers();
    for(const k of ["content-type","content-disposition","x-tqs-share-url"]){
      const v=r.headers.get(k);if(v)h.set(k,v);
    }
    h.set("Cache-Control","no-store");
    return new Response(buf,{status:r.status,headers:h});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:String(error)},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}

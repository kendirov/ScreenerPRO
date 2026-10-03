const EDGE="https://hppbuzbrjoyrwpdinlxk.supabase.co/functions/v1/studio-api/public/pdf";
export async function GET(req:Request){
  const u=new URL(req.url);
  const target=new URL(EDGE);
  for(const [k,v] of u.searchParams)target.searchParams.set(k,v);
  let r:Response|null=null;
  for(let attempt=0;attempt<2;attempt++){
    try{r=await fetch(target,{cache:"no-store",signal:AbortSignal.timeout(20000)});if(r.status<500)break}catch{}
    if(attempt===0)await new Promise(res=>setTimeout(res,350));
  }
  if(!r)return Response.json({error:"STUDIO_PDF_UPSTREAM_UNAVAILABLE"},{status:503});
  const buf=await r.arrayBuffer();
  const h=new Headers();
  for(const k of ["content-type","content-disposition","x-tqs-share-url","x-tqs-drive-export"]) {const v=r.headers.get(k);if(v)h.set(k,v)}
  h.set("Cache-Control","no-store");
  return new Response(buf,{status:r.status,headers:h});
}

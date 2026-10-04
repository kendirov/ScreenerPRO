function safeOrigin(value:string){
  try{
    const u=new URL(value);
    if(!["http:","https:"].includes(u.protocol))return null;
    return u.origin;
  }catch{return null}
}
function encodeSnapshot(value:unknown){
  return Buffer.from(JSON.stringify(value),"utf8").toString("base64url");
}
function decodeSnapshot(token:string){
  if(!token.startsWith("snap."))return null;
  try{return JSON.parse(Buffer.from(token.slice(5),"base64url").toString("utf8"))}catch{return null}
}

export async function POST(req:Request){
  try{
    const {documentId,appOrigin,bundle}=await req.json();
    const origin=safeOrigin(String(appOrigin||""));
    if(!origin||!documentId||!bundle?.document||!Array.isArray(bundle?.blocks)){
      return Response.json({ok:false,error:"documentId/appOrigin/bundle required"},{status:400});
    }
    if(String(bundle.document.id)!==String(documentId)){
      return Response.json({ok:false,error:"documentId mismatch"},{status:400});
    }
    const slug=String(bundle.document.slug||bundle.document.id);
    const snapshot={v:1,document:bundle.document,blocks:bundle.blocks};
    const token="snap."+encodeSnapshot(snapshot);
    return Response.json({ok:true,data:{
      token,
      url:`${origin}/d/${encodeURIComponent(slug)}?t=${encodeURIComponent(token)}`,
      slug,
      documentRevision:Number(bundle.document.revision||0),
      snapshot:true
    }},{headers:{"Cache-Control":"no-store"}});
  }catch(error:any){
    return Response.json({ok:false,error:error?.message||String(error)},{status:500,headers:{"Cache-Control":"no-store"}});
  }
}

export async function GET(req:Request){
  const token=new URL(req.url).searchParams.get("token")||"";
  const data=decodeSnapshot(token);
  if(!data)return Response.json({ok:false,error:"SHARE_NOT_FOUND"},{status:404,headers:{"Cache-Control":"no-store"}});
  return Response.json({ok:true,data},{headers:{"Cache-Control":"no-store"}});
}

const EDGE="https://hppbuzbrjoyrwpdinlxk.supabase.co/functions/v1/studio-api/public/pdf-bundle";

const CYR:Record<string,string>={
"А":"A","Б":"B","В":"V","Г":"G","Д":"D","Е":"E","Ё":"Yo","Ж":"Zh","З":"Z","И":"I","Й":"Y","К":"K","Л":"L","М":"M","Н":"N","О":"O","П":"P","Р":"R","С":"S","Т":"T","У":"U","Ф":"F","Х":"Kh","Ц":"Ts","Ч":"Ch","Ш":"Sh","Щ":"Sch","Ъ":"","Ы":"Y","Ь":"","Э":"E","Ю":"Yu","Я":"Ya",
"а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"zh","з":"z","и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"kh","ц":"ts","ч":"ch","ш":"sh","щ":"sch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya"
};
function ascii(value:unknown){
  const s=String(value??"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
  return [...s].map(ch=>CYR[ch]??ch).join("").normalize("NFKD").replace(/[^\x20-\x7E]/g,"?");
}
function wrap(value:string,width=88){
  const words=value.split(/\s+/).filter(Boolean),out:string[]=[];let line="";
  for(const word of words){
    if(!line){line=word;continue}
    if((line+" "+word).length<=width){line+=" "+word;continue}
    out.push(line);line=word;
  }
  if(line)out.push(line);
  return out.length?out:[""];
}
function escPdf(s:string){return s.replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)")}
function fallbackPdf(body:any){
  const bundle=body?.bundle||{};
  const doc=bundle.document||{};
  const blocks=Array.isArray(bundle.blocks)?[...bundle.blocks].sort((a:any,b:any)=>Number(a.ordinal||0)-Number(b.ordinal||0)):[];
  const lines:string[]=[
    "TQS Studio — PDF fallback export",
    "Document: "+ascii(doc.title||"Untitled"),
    "Revision: "+ascii(doc.revision??"")+" | Path: "+ascii(doc.semantic_path||""),
    "Live version: "+ascii(body?.liveUrl||""),
    ""
  ];
  for(const b of blocks){
    const c=b?.content||{};
    const label=ascii(c.title||c.text||c.html||c.caption||"");
    const meta=[b?.block_type,b?.data_spec?.updatePolicy].filter(Boolean).join(" / ");
    if(meta||label){
      lines.push(...wrap((meta?"["+ascii(meta)+"] ":"")+label));
      lines.push("");
    }
  }
  lines.push("Generated locally because the rich PDF renderer was unavailable.");
  while(lines.join("\n").length<1400)lines.push("TQS Studio document export · "+ascii(doc.title||"document"));

  const perPage=48;
  const pages:string[][]=[];
  for(let i=0;i<lines.length;i+=perPage)pages.push(lines.slice(i,i+perPage));
  const fontObj=3+pages.length*2;
  const objs:Record<number,string>={};
  objs[1]="<< /Type /Catalog /Pages 2 0 R >>";
  const kids=pages.map((_,i)=>`${3+i*2} 0 R`).join(" ");
  objs[2]=`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  pages.forEach((pageLines,i)=>{
    const pageObj=3+i*2,contentObj=pageObj+1;
    const commands=pageLines.map((line,j)=>`BT /F1 9 Tf 42 ${800-j*15} Td (${escPdf(ascii(line))}) Tj ET`).join("\n");
    objs[pageObj]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObj} 0 R >> >> /Contents ${contentObj} 0 R >>`;
    objs[contentObj]=`<< /Length ${Buffer.byteLength(commands,"ascii")} >>\nstream\n${commands}\nendstream`;
  });
  objs[fontObj]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  let pdf="%PDF-1.4\n%TQS-STUDIO\n";
  const offsets:number[]=[0];
  for(let n=1;n<=fontObj;n++){
    offsets[n]=Buffer.byteLength(pdf,"ascii");
    pdf+=`${n} 0 obj\n${objs[n]}\nendobj\n`;
  }
  const xref=Buffer.byteLength(pdf,"ascii");
  pdf+=`xref\n0 ${fontObj+1}\n0000000000 65535 f \n`;
  for(let n=1;n<=fontObj;n++)pdf+=String(offsets[n]).padStart(10,"0")+" 00000 n \n";
  pdf+=`trailer\n<< /Size ${fontObj+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf,"ascii");
}

export async function POST(req:Request){
  const contentType=req.headers.get("content-type")||"";
  let body:any;
  if(contentType.includes("application/x-www-form-urlencoded")||contentType.includes("multipart/form-data")){
    const form=await req.formData();
    body=JSON.parse(String(form.get("payload")||"{}"));
  }else{
    body=await req.json();
  }
  try{
    const r=await fetch(EDGE,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body),
      cache:"no-store",
      signal:AbortSignal.timeout(5500)
    });
    if(r.ok){
      const buf=await r.arrayBuffer();
      if(buf.byteLength>1000&&Buffer.from(buf).subarray(0,4).toString()==="%PDF"){
        const h=new Headers();
        for(const k of ["content-type","content-disposition","x-tqs-share-url"]){const v=r.headers.get(k);if(v)h.set(k,v)}
        h.set("Cache-Control","no-store");
        return new Response(buf,{status:200,headers:h});
      }
    }
  }catch{}
  const pdf=fallbackPdf(body);
  const title=encodeURIComponent(String(body?.bundle?.document?.title||"TQS Studio")+".pdf");
  return new Response(pdf,{status:200,headers:{
    "Content-Type":"application/pdf",
    "Content-Disposition":`attachment; filename*=UTF-8''${title}`,
    "X-TQS-Share-Url":String(body?.liveUrl||""),
    "X-TQS-PDF-Mode":"local-fallback",
    "Cache-Control":"no-store"
  }});
}

import {NextRequest} from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

function filename(v:string){return (v||"TQS Studio").replace(/[\\/:*?"<>|]+/g," ").trim().slice(0,120)||"TQS Studio"}

export async function GET(req:NextRequest){
  const id=req.nextUrl.searchParams.get("documentId");
  if(!id)return Response.json({ok:false,error:"DOCUMENT_ID_REQUIRED"},{status:400});
  const share=req.nextUrl.searchParams.get("share")||"";
  const printUrl=new URL("/studio/print/"+encodeURIComponent(id),req.nextUrl.origin);
  if(share)printUrl.searchParams.set("share",share);
  let browser:any=null;
  try{
    browser=await puppeteer.launch({
      args:chromium.args,
      executablePath:await chromium.executablePath(),
      headless:true,
      defaultViewport:{width:1440,height:1100,deviceScaleFactor:1}
    });
    const page=await browser.newPage();
    await page.emulateMediaType("print");
    const response=await page.goto(printUrl.toString(),{waitUntil:"networkidle0",timeout:45000});
    if(!response?.ok())throw new Error("PRINT_ROUTE_"+String(response?.status()||0));
    await page.waitForSelector('[data-testid="v6-print-document"]',{timeout:20000});
    await page.evaluate(async()=>{await (document as any).fonts?.ready});
    const title=await page.$eval("[data-testid=v6-print-document] h1",(e:any)=>e.textContent||"TQS Studio");
    const pdf=await page.pdf({
      format:"A4",
      printBackground:true,
      preferCSSPageSize:true,
      displayHeaderFooter:true,
      margin:{top:"14mm",right:"14mm",bottom:"18mm",left:"14mm"},
      headerTemplate:"<span></span>",
      footerTemplate:'<div style="width:100%;font-size:8px;color:#777;padding:0 14mm;display:flex;justify-content:space-between"><span>TQS Studio</span><span class="pageNumber"></span></div>'
    });
    const safe=filename(title);
    const cd="attachment; filename=\"tqs-studio.pdf\"; filename*=UTF-8''"+encodeURIComponent(safe+".pdf");
    return new Response(pdf as BodyInit,{status:200,headers:{
      "Content-Type":"application/pdf",
      "Content-Disposition":cd,
      "Cache-Control":"no-store",
      "X-TQS-PDF-Renderer":"chromium-publication"
    }});
  }catch(e){
    return Response.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});
  }finally{
    await browser?.close().catch(()=>{});
  }
}

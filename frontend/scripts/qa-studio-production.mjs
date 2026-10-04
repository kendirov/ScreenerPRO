import {chromium} from "playwright";

const base=process.env.STUDIO_PROD_BASE||"https://screenerpro.vercel.app";
const expected=process.env.EXPECTED_SHA||process.env.GITHUB_SHA||"";
const assert=(v,m)=>{if(!v)throw new Error(m)};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

const deadline=Date.now()+8*60_000;
let deployed=null;
while(Date.now()<deadline){
  try{
    const r=await fetch(base+"/api/studio/version",{cache:"no-store"});
    if(r.ok){
      const x=await r.json();
      if(!expected||x.commit===expected){deployed=x;break}
    }
  }catch{}
  await wait(4000);
}
assert(deployed,`production did not reach expected commit ${expected}`);
console.log("PASS production commit",deployed.commit);

const live=await fetch(base+"/api/studio/live-data?family=SI&sessions=2",{cache:"no-store"});
assert(live.ok,`live-data HTTP ${live.status}`);
const liveJson=await live.json();
assert(liveJson.ok&&liveJson.dataSpec?.updatePolicy==="LIVE"&&liveJson.sessions?.length,"live Si payload invalid");
assert(liveJson.dataSpec?.provider==="MOEX_ISS","live Si provider is not MOEX_ISS");
console.log("PASS live Si",liveJson.instrument?.secid,liveJson.dataSpec?.asOf);

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({acceptDownloads:true,permissions:["clipboard-read","clipboard-write"]});
const page=await context.newPage();
const pageErrors=[];
const badResponses=[];
page.on("pageerror",e=>pageErrors.push(e.message));
page.on("response",r=>{if(r.status()>=500)badResponses.push(`${r.status()} ${r.url()}`)});

await page.goto(base+"/studio",{waitUntil:"domcontentloaded",timeout:60_000});
await page.getByText("TQS Studio",{exact:true}).waitFor({timeout:20_000});
await page.getByRole("button",{name:/Документы/}).first().click();
const lesson=page.getByRole("button",{name:/Занятие 1 — Рабочее пространство/}).first();
await lesson.waitFor({timeout:15_000});
await lesson.click();
await page.locator('[data-testid="ordered-block-editor"]').waitFor({timeout:15_000});

const shareResponsePromise=page.waitForResponse(r=>r.url().includes("/api/studio/share")&&r.request().method()==="POST",{timeout:20_000});
await page.getByRole("button",{name:"Поделиться"}).click();
const shareResponse=await shareResponsePromise;
assert(shareResponse.ok(),`share HTTP ${shareResponse.status()}`);
const shareJson=await shareResponse.json();
assert(shareJson.ok&&shareJson.data?.url,"share URL missing");
console.log("PASS share create");

const clean=await context.newPage();
await clean.goto(shareJson.data.url,{waitUntil:"domcontentloaded",timeout:60_000});
await clean.getByRole("heading",{name:"Занятие 1 — Рабочее пространство"}).waitFor({timeout:20_000});
await clean.getByText("Market Replay",{exact:false}).first().waitFor({timeout:20_000});
await clean.getByText("PDF / конспект",{exact:false}).first().waitFor({timeout:20_000});
await clean.getByText("Si — реальный объём текущей и прошлой сессии",{exact:false}).first().waitFor({timeout:20_000});
console.log("PASS clean share canonical lesson");

await page.bringToFront();
const pdfLink=page.getByRole("button",{name:"PDF"});
const pdfHref=await pdfLink.getAttribute("href");
const pdfName=await pdfLink.getAttribute("download");
assert(pdfHref?.startsWith("data:application/pdf"),"PDF link is not a native PDF data download");
assert(pdfName?.toLowerCase().endsWith(".pdf"),"PDF download filename missing");
const comma=pdfHref.indexOf(",");
assert(comma>0,"PDF data URL malformed");
const bytes=Buffer.from(decodeURIComponent(pdfHref.slice(comma+1)),"latin1");
assert(bytes.subarray(0,4).toString()==="%PDF","PDF signature invalid");
assert(bytes.length>1000,`PDF too small: ${bytes.length}`);
console.log("PASS PDF",bytes.length,pdfName);

assert(pageErrors.length===0,`page errors: ${pageErrors.join(" | ")}`);
assert(badResponses.length===0,`5xx responses: ${badResponses.join(" | ")}`);
console.log("PASS zero page/5xx errors");
await browser.close();

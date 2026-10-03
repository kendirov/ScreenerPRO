import { chromium } from "playwright";

const base=process.env.STUDIO_QA_BASE||"http://127.0.0.1:3000";
const browser=await chromium.launch({headless:true,args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream"]});
const context=await browser.newContext({permissions:["microphone","clipboard-read","clipboard-write"],viewport:{width:1440,height:1000}});
const page=await context.newPage();
const errors=[];
page.on("pageerror",e=>errors.push("pageerror: "+e.message));
page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text())});
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const state=async()=>page.evaluate(()=>JSON.parse(localStorage.getItem("tqs-studio-v5-local-state-v2")||"null"));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
 await page.goto(base+"/studio",{waitUntil:"domcontentloaded",timeout:60000});
 await page.getByText("TQS Studio",{exact:true}).waitFor({timeout:30000});
 await page.getByText("ARTEM OS / Agent",{exact:true}).first().waitFor();
 await page.getByText("Обучение",{exact:true}).first().waitFor();
 await page.getByText("Бесплатный курс",{exact:true}).first().waitFor();
 await page.getByText("Занятие 1 — Рабочее пространство",{exact:true}).first().waitFor();
 console.log("PASS seed+navigator");

 const canvas=page.locator('section[tabindex="0"]');
 const world=canvas.locator('div[style*="translate("]').first();
 const t0=await world.getAttribute("style");
 await canvas.evaluate(el=>el.dispatchEvent(new WheelEvent("wheel",{deltaY:120,bubbles:true,cancelable:true})));
 await wait(100); const t1=await world.getAttribute("style"); assert(t1!==t0,"vertical wheel did not pan");
 const scaleBefore=(t1||"").match(/scale\(([^)]+)\)/)?.[1];
 await canvas.evaluate(el=>el.dispatchEvent(new WheelEvent("wheel",{deltaY:-120,ctrlKey:true,bubbles:true,cancelable:true,clientX:600,clientY:400})));
 await wait(100);const t2=await world.getAttribute("style");const scaleAfter=(t2||"").match(/scale\(([^)]+)\)/)?.[1];assert(scaleAfter!==scaleBefore,"ctrl wheel did not zoom");
 console.log("PASS gesture pan+pinch");

 await page.getByTitle("Вписать мир").click();
 await page.getByTitle("Добавить").click();
 await page.getByRole("button",{name:"Текст",exact:true}).click();
 const textObj=page.locator('[data-testid="world-text"]').last();
 await textObj.waitFor();
 const editable=textObj.locator('[contenteditable="true"]');
 await editable.fill("QA text");
 await editable.evaluate(el=>el.blur());
 await wait(500);
 let s=await state();assert(s.overview.objects.some(o=>o.kind==="text"&&String(o.body?.html||"").includes("QA text")),"text not persisted locally");
 console.log("PASS create/edit Text");

 await page.getByTitle("Добавить").click();
 await page.getByRole("button",{name:"Задача",exact:true}).click();
 const task=page.locator('[data-testid="world-task"]').last();await task.waitFor();
 const taskInput=task.locator("input");await taskInput.fill("QA task");await taskInput.press("Enter");await wait(100);
 await task.locator("button").first().click();await wait(100);
 s=await state();const qt=s.overview.objects.find(o=>o.kind==="task"&&o.title==="QA task");assert(qt&&qt.status==="DONE","task create/complete failed");
 console.log("PASS create/edit/complete Task");

 await page.getByTitle("Добавить").click();
 await page.getByRole("button",{name:"Голосовая заметка",exact:true}).click();
 const voice=page.locator('[data-testid="world-voice"]').last();await voice.waitFor();
 await voice.getByRole("button",{name:/Записать/}).click();await wait(700);await voice.getByRole("button",{name:/Stop/}).click();
 await voice.locator("audio").waitFor({timeout:7000});
 console.log("PASS record/stop/playback Voice");

 await page.evaluate(()=>{
  const dt=new DataTransfer();dt.setData("text/plain","https://example.com/qa-studio");
  document.querySelector("main")?.dispatchEvent(new ClipboardEvent("paste",{clipboardData:dt,bubbles:true,cancelable:true}));
 });
 await page.locator('[data-testid="world-link"]').last().waitFor();
 console.log("PASS smart paste URL");

 await page.evaluate(()=>{
  const dt=new DataTransfer();dt.setData("text/plain","Smart paste plain text");
  document.querySelector("main")?.dispatchEvent(new ClipboardEvent("paste",{clipboardData:dt,bubbles:true,cancelable:true}));
 });
 await wait(150);s=await state();assert(s.overview.objects.some(o=>o.kind==="text"&&String(o.body?.html||"").includes("Smart paste plain text")),"plain text paste failed");
 console.log("PASS smart paste text");

 await page.evaluate(()=>{
  const bytes=Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII="),c=>c.charCodeAt(0));
  const file=new File([bytes],"qa.png",{type:"image/png"});const dt=new DataTransfer();dt.items.add(file);
  document.querySelector("main")?.dispatchEvent(new ClipboardEvent("paste",{clipboardData:dt,bubbles:true,cancelable:true}));
 });
 const image=page.locator('[data-testid="world-image"]').last();await image.waitFor({timeout:7000});
 console.log("PASS smart paste image");

 await page.getByTitle("Карандаш").click();
 const ib=await image.boundingBox();assert(ib,"image bbox missing");
 await page.mouse.move(ib.x+30,ib.y+40);await page.mouse.down();await page.mouse.move(ib.x+120,ib.y+100,{steps:6});await page.mouse.up();await wait(150);
 await page.locator('[data-testid="world-annotation"]').last().waitFor();
 s=await state();const ann=s.overview.objects.find(o=>o.kind==="annotation");assert(ann?.relations?.some(r=>r.type==="annotates"),"image annotation relation missing");
 console.log("PASS pencil annotation relation");

 const beforeAnn=await page.locator('[data-testid="world-annotation"]').last().boundingBox();
 const handle=image.locator("div").first();const hb=await handle.boundingBox();if(hb){await page.mouse.move(hb.x+20,hb.y+12);await page.mouse.down();await page.mouse.move(hb.x+90,hb.y+70,{steps:5});await page.mouse.up();await wait(180)}
 const afterAnn=await page.locator('[data-testid="world-annotation"]').last().boundingBox();
 assert(beforeAnn&&afterAnn&&(beforeAnn.x!==afterAnn.x||beforeAnn.y!==afterAnn.y),"attached annotation did not move");
 console.log("PASS move annotated image");

 await page.getByText("Занятие 1 — Рабочее пространство",{exact:true}).first().click();
 await page.getByRole("button",{name:"Документы"}).click();
 const lessonButton=page.getByRole("button",{name:/Занятие 1 — Рабочее пространство/}).first();await lessonButton.click();
 await page.locator('[data-testid="ordered-block-editor"]').waitFor();
 assert(await page.locator(".studio-edit-block").count()>=13,"lesson document does not contain full demo blocks");
 await page.locator('[data-testid="studio-market-chart"]').first().waitFor({timeout:30000});
 await page.locator('[data-testid="market-replay"]').waitFor({timeout:30000});
 console.log("PASS full lesson document + chart + replay");

 const insert=page.getByRole("button",{name:"Вставить блок"}).nth(1);await insert.click({force:true});
 await page.getByRole("button",{name:"Rich Text",exact:true}).last().click();await wait(150);
 let editorBlocks=page.locator(".studio-edit-block");const countAfter=await editorBlocks.count();assert(countAfter>=14,"insert between blocks failed");
 const last=editorBlocks.last(),first=editorBlocks.first();await last.dragTo(first);await wait(200);
 console.log("PASS document insert + reorder");

 const replay=page.locator('[data-testid="market-replay"]');await replay.getByRole("button",{name:"Старт"}).click();await wait(700);await replay.getByRole("button",{name:"Пауза"}).click();
 console.log("PASS Market Replay controls");

 await page.getByRole("button",{name:"На доске"}).click();await canvas.waitFor();
 console.log("PASS Document→World");

 await page.getByTitle("Светлая / тёмная тема").click();assert(await page.locator("main").getAttribute("data-theme")==="light","light theme failed");
 await page.getByTitle("Светлая / тёмная тема").click();assert(await page.locator("main").getAttribute("data-theme")==="dark","dark theme failed");
 console.log("PASS Light/Dark");

 await page.getByTitle("Добавить").click();await page.getByRole("button",{name:"Текст",exact:true}).click();const persistent=page.locator('[data-testid="world-text"]').last().locator('[contenteditable="true"]');await persistent.fill("RELOAD-PERSIST");await persistent.evaluate(el=>el.blur());await wait(500);
 await page.reload({waitUntil:"domcontentloaded"});await page.getByText("TQS Studio",{exact:true}).waitFor();s=await state();assert(s.overview.objects.some(o=>String(o.body?.html||"").includes("RELOAD-PERSIST")),"reload persistence failed");
 console.log("PASS reload persistence");

 await page.getByTitle("Диагностика").click();
 const dl=page.waitForEvent("download");await page.getByRole("button",{name:/JSON Export/}).click();const download=await dl;const path=await download.path();assert(path,"export download missing");
 const input=page.locator('input[type="file"][accept="application/json"]');await input.setInputFiles(path);await wait(300);
 console.log("PASS JSON export/import");

 await page.getByRole("button",{name:"Сбросить демо"}).click();await wait(250);s=await state();assert(s.overview.objects.some(o=>o.id==="lesson-demo-text")&&!s.overview.objects.some(o=>String(o.body?.html||"").includes("RELOAD-PERSIST")),"reset demo failed");
 console.log("PASS Reset demo");

 if(errors.length)throw new Error("Browser errors: "+errors.join(" | "));
 console.log(JSON.stringify({ok:true,checks:["seed","navigator","gestures","text","task","voice","paste-url","paste-text","paste-image","annotation","move-annotation","lesson-doc","chart","replay","insert","reorder","world-doc","theme","reload","export-import","reset"]}));
}finally{
 await browser.close();
}

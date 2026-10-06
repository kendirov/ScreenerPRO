import{chromium}from"playwright";
import{mkdir}from"node:fs/promises";
const base=process.env.STUDIO_QA_BASE||"http://127.0.0.1:3000";
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1440,height:1000},permissions:["clipboard-read","clipboard-write","microphone"]});
const p=await ctx.newPage(),errors=[];
p.on("pageerror",e=>errors.push(String(e)));
const ok=(x,m)=>{if(!x)throw Error(m)},wait=n=>new Promise(r=>setTimeout(r,n));
const viewport=()=>p.locator(".react-flow__viewport").getAttribute("style");
const scale=s=>Number((String(s).match(/scale\(([^)]+)\)/)||[])[1]||1);
const trans=s=>{const m=String(s).match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);return m?[+m[1],+m[2]]:[0,0]};
const wheel=async(delta)=>{const pane=p.locator(".react-flow__pane");const b=await pane.boundingBox();await p.mouse.move(b.x+b.width*.72,b.y+b.height*.62);await p.mouse.wheel(0,delta);await wait(180)};
await mkdir("frontend/.qa-artifacts",{recursive:true});
try{
 await p.goto(base+"/studio",{waitUntil:"domcontentloaded",timeout:60000});
 await p.getByTestId("tqs-studio-v6").waitFor({timeout:30000});
 await p.getByTestId("world-canvas-v6").waitFor();
 await p.locator(".react-flow__viewport").waitFor();
 await wait(550);
 ok(errors.length===0,"runtime errors: "+errors.join(" | "));
 ok(await p.getByText("TQS Studio",{exact:true}).count()===1,"Studio identity");
 ok(await p.locator(".rf-studio-toolbar").count()===0,"constructor toolbar still covers the board");
 ok(await p.locator(".rf-node-grip").count()===0,"special grips still sit on objects");
 ok(await p.locator(".rf-workspace-actions").count()===0,"frame still has an action bar");
 const scene=p.locator('[data-studio-id="lesson-miro-scene"]');
 await scene.waitFor();
 const nearBox=await scene.boundingBox();
 ok(nearBox&&nearBox.width>850&&nearBox.height>430&&nearBox.x<260&&nearBox.y<260&&nearBox.x+nearBox.width>1180&&nearBox.y+nearBox.height>720,"Lesson workspace is not the primary visible surface");
 ok(await scene.getByText("ЗАНЯТИЕ 1 · РАБОЧЕЕ ПРОСТРАНСТВО",{exact:true}).count()===1,"lesson title");
 const theme=p.locator('[data-studio-id="lesson-miro-l100"]');
 const themeBox=await theme.boundingBox();
 ok(themeBox&&nearBox&&themeBox.x>=nearBox.x&&themeBox.y>=nearBox.y&&themeBox.x+themeBox.width<=nearBox.x+nearBox.width+1&&themeBox.y+themeBox.height<=nearBox.y+nearBox.height+1&&(await theme.innerText()).includes("L1.01"),"theme one is on the lesson");
 await p.screenshot({path:"frontend/.qa-artifacts/world-reactflow-near.png"});
 const ids=await p.locator("[data-studio-id]").evaluateAll(es=>es.map(e=>e.getAttribute("data-studio-id")));console.log("VISIBLE_IDS",ids.join(","));
 ok(await p.locator('[data-studio-id="lesson-miro-shot"]').count()===1,"screenshot material");
 ok(await p.locator('[data-studio-id="lesson-miro-chart"]').count()===1,"interactive chart");
 ok(await p.locator('[data-studio-id="lesson-miro-task"]').count()===1,"task material");
 ok(await p.locator('[data-studio-id="lesson-miro-doc"]').count()===1,"document material");
 console.log("PASS RF-A owner scene");

 await p.evaluate(()=>{localStorage.setItem("tqs-studio-v6-rf-input-profile","mouse");window.dispatchEvent(new CustomEvent("tqs-studio-input-profile",{detail:"mouse"}))});
 await wait(80);
 let a=await viewport();await wheel(-260);let b=await viewport();ok(scale(b)>scale(a),"mouse wheel zoom");a=b;
 const pane=p.locator(".react-flow__pane"),pb=await pane.boundingBox(),x=pb.x+pb.width*.82,y=pb.y+pb.height*.78;
 await p.mouse.move(x,y);await p.mouse.down({button:"right"});await p.mouse.move(x-85,y-45,{steps:6});await p.mouse.up({button:"right"});await wait(160);b=await viewport();ok(trans(a)[0]!==trans(b)[0]||trans(a)[1]!==trans(b)[1],"right drag pan");
 console.log("PASS RF-B navigation");

 // Re-focus the canonical lesson before semantic interaction tests.
 await p.evaluate(()=>window.dispatchEvent(new KeyboardEvent("keydown",{key:"k",ctrlKey:true,bubbles:true,cancelable:true})));
 const search=p.locator(".v6-nav-search input");await search.waitFor();await search.fill("ЗАНЯТИЕ 1 · РАБОЧЕЕ ПРОСТРАНСТВО");await search.press("Enter");await wait(520);
 const topic=p.locator('[data-studio-id="lesson-miro-l101"]');
 let sb=await scene.boundingBox(),tb=await topic.boundingBox();ok(sb&&tb,"independent child geometry");
 await p.mouse.move(tb.x+tb.width*.45,tb.y+tb.height*.45);await p.mouse.down();await p.mouse.move(tb.x+tb.width*.45+70,tb.y+tb.height*.45+40,{steps:7});await p.mouse.up();await wait(260);
 let sb2=await scene.boundingBox(),tb2=await topic.boundingBox();ok(Math.hypot(tb2.x-tb.x,tb2.y-tb.y)>25,"inner material did not move");ok(Math.hypot(sb2.x-sb.x,sb2.y-sb.y)<4,"inner material moved parent workspace");
 const sceneHead=scene.locator(".rf-workspace-head");let sh=await sceneHead.boundingBox(),shot=p.locator('[data-studio-id="lesson-miro-shot"]'),beforeTopic=await topic.boundingBox(),beforeShot=await shot.boundingBox();ok(sh&&beforeTopic&&beforeShot,"workspace move geometry");
 await p.mouse.move(sh.x+260,sh.y+34);await p.mouse.down();await p.mouse.move(sh.x+340,sh.y+84,{steps:7});await p.mouse.up();await wait(280);
 const movedScene=await scene.boundingBox(),afterTopic=await topic.boundingBox(),afterShot=await shot.boundingBox(),dx=movedScene.x-sb2.x,dy=movedScene.y-sb2.y;
 ok(Math.abs((afterTopic.x-beforeTopic.x)-dx)<5&&Math.abs((afterTopic.y-beforeTopic.y)-dy)<5,"workspace did not carry topic");
 ok(Math.abs((afterShot.x-beforeShot.x)-dx)<5&&Math.abs((afterShot.y-beforeShot.y)-dy)<5,"workspace did not carry media");
 console.log("PASS RF-C nested movement");

 // Paste real content through the board and prove local-first persistence survives reload.
 const marker="QA-"+Date.now();
 await pane.click({position:{x:pb.width*.65,y:pb.height*.35}});
 const canvas=p.getByTestId("world-canvas-v6");
 await canvas.focus();
 await canvas.evaluate((el,marker)=>{const d=new DataTransfer();d.setData("text/plain",String(marker));const ev=new Event("paste",{bubbles:true,cancelable:true});Object.defineProperty(ev,"clipboardData",{value:d});el.dispatchEvent(ev)},marker);
 await p.waitForFunction(marker=>(localStorage.getItem("tqs-studio-v5-local-state-v4")||"").includes(String(marker)),marker);
 const pastedId=await p.evaluate(marker=>{const s=JSON.parse(localStorage.getItem("tqs-studio-v5-local-state-v4")||"{}");return s?.overview?.objects?.find(o=>JSON.stringify(o.body||{}).includes(String(marker)))?.id||null},marker);
 ok(Boolean(pastedId),"pasted object not persisted");
 await p.reload({waitUntil:"domcontentloaded"});await p.getByTestId("world-canvas-v6").waitFor();
 ok((await p.locator(`[data-studio-id="${pastedId}"]`).count())===1,"pasted node not restored");
 let pasteGuard=0;while(scale(await viewport())<.66&&pasteGuard++<6)await wheel(-220);
 await p.getByText(marker,{exact:true}).waitFor({timeout:8000});
 ok(await p.locator(".v6-sync").count()===0,"idle save status appeared in the top bar");
 console.log("PASS RF-D persistence");

 // Direct text: T creates an immediately editable transparent text object, autosaves, moves by body drag, survives reload.
 await p.evaluate(()=>window.dispatchEvent(new KeyboardEvent("keydown",{key:"t",bubbles:true,cancelable:true})));
 await pane.click({position:{x:pb.width*.02,y:pb.height*.5}});
 const editNode=p.locator(".rf-content-node.kind-text.is-editing").last();await editNode.waitFor({timeout:5000});
 const editor=editNode.locator(".tiptap");await editor.waitFor();const textMarker="TEXT-"+Date.now();await editor.fill(textMarker);
 const textId=await editNode.evaluate(el=>el.closest(".react-flow__node")?.getAttribute("data-id"));
 await pane.click({position:{x:pb.width*.82,y:pb.height*.24}});await wait(650);
 ok(Boolean(textId),"new text id missing");
 ok((localStorage=>localStorage.includes(textMarker))(await p.evaluate(()=>localStorage.getItem("tqs-studio-v5-local-state-v4")||"")),"new text not locally saved");
 const textNode=p.locator(`[data-id="${textId}"]`),beforeText=await textNode.boundingBox();ok(beforeText,"text geometry missing");
 await p.mouse.move(beforeText.x+beforeText.width*.45,beforeText.y+beforeText.height*.5);await p.mouse.down();await p.mouse.move(beforeText.x+beforeText.width*.45+95,beforeText.y+beforeText.height*.5+42,{steps:7});await p.mouse.up();await wait(260);
 const afterText=await textNode.boundingBox();ok(Math.hypot(afterText.x-beforeText.x,afterText.y-beforeText.y)>35,"text did not move by direct drag");
 await p.reload({waitUntil:"domcontentloaded"});await p.getByTestId("world-canvas-v6").waitFor();await p.getByText(textMarker,{exact:true}).waitFor({timeout:8000});
 console.log("PASS RF-D2 direct text");

 // Image drop: a real File dropped on blank canvas becomes a first-class movable image and survives local reload.
 const dropMarker="DROP-"+Date.now();
 await p.getByTestId("world-canvas-v6").evaluate((el,dropMarker)=>{const dt=new DataTransfer();dt.items.add(new File([`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#222"/><text x="20" y="90" fill="white">${dropMarker}</text></svg>`],dropMarker+".svg",{type:"image/svg+xml"}));const ev=new DragEvent("drop",{bubbles:true,cancelable:true,dataTransfer:dt,clientX:900,clientY:420});el.dispatchEvent(ev)},dropMarker);
 await p.waitForFunction(dropMarker=>(localStorage.getItem("tqs-studio-v5-local-state-v4")||"").includes(dropMarker+".svg"),dropMarker,{timeout:8000});
 const imageId=await p.evaluate(dropMarker=>{const s=JSON.parse(localStorage.getItem("tqs-studio-v5-local-state-v4")||"{}");return s?.overview?.objects?.find(o=>o.kind==="image"&&o.title===dropMarker+".svg")?.id||null},dropMarker);ok(Boolean(imageId),"dropped image object missing");
 const imageNode=p.locator(`[data-id="${imageId}"]`);await imageNode.waitFor();const beforeImage=await imageNode.boundingBox();ok(beforeImage,"image geometry missing");await p.mouse.move(beforeImage.x+beforeImage.width*.5,beforeImage.y+beforeImage.height*.5);await p.mouse.down();await p.mouse.move(beforeImage.x+beforeImage.width*.5+90,beforeImage.y+beforeImage.height*.5+45,{steps:7});await p.mouse.up();await wait(260);const afterImage=await imageNode.boundingBox();ok(Math.hypot(afterImage.x-beforeImage.x,afterImage.y-beforeImage.y)>35,"image did not move directly");
 console.log("PASS RF-D3 image drop and move");

 // Semantic zoom: MID keeps material summaries, FAR keeps large semantic workspaces instead of microscopic DOM.
 await p.evaluate(()=>window.dispatchEvent(new KeyboardEvent("keydown",{key:"k",ctrlKey:true,bubbles:true,cancelable:true})));
 const search2=p.locator(".v6-nav-search input");await search2.waitFor();await search2.fill("ЗАНЯТИЕ 1 · РАБОЧЕЕ ПРОСТРАНСТВО");await search2.press("Enter");await wait(480);
 let guard=0;while(scale(await viewport())>.5&&guard++<10)await wheel(260);
 ok(scale(await viewport())<.6&&scale(await viewport())>.28,"MID zoom threshold");
 ok(await p.locator(".rf-mid-copy,.rf-mid-media,.rf-mid-chart").count()>0,"MID summaries missing");
 await p.screenshot({path:"frontend/.qa-artifacts/world-reactflow-mid.png"});
 guard=0;while(scale(await viewport())>.24&&guard++<12)await wheel(320);
 ok(scale(await viewport())<=.28,"FAR zoom threshold");
 ok(await p.locator(".rf-workspace-signatures").count()>0,"FAR semantic signatures missing");
 ok(await p.locator(".react-flow__node-content:visible").count()===0,"FAR still renders microscopic content");
 await p.screenshot({path:"frontend/.qa-artifacts/world-reactflow-far.png"});
 console.log("PASS RF-E semantic zoom");

 // Documents stay on the same product surface: library, edit/preview, publication.
 await p.locator(".v6-nav-rail").getByRole("button",{name:"Документы"}).click();
 await p.locator(".v6-nav-overlay").getByRole("button",{name:/Занятие 1/}).click();
 await p.getByTestId("ordered-block-editor-v6").waitFor();
 ok(await p.locator(".v6-doc-library:visible").count()===0,"document library is not a second rail");
 const docMarker="DOC-"+Date.now();
 const textBlock=p.locator('[data-block-id="lesson-t1"] .tiptap');
 await textBlock.click();await textBlock.fill(docMarker);await p.locator(".v6-doc-title").click();await wait(400);
 await p.locator(".v6-nav-rail").getByRole("button",{name:"Документы"}).click();
 await p.locator(".v6-doc-library").getByRole("button",{name:/Статья — Si/}).click();
 await p.getByRole("heading",{name:/Si: история ликвидности/}).first().waitFor();
 await p.locator(".v6-doc-library").getByRole("button",{name:/Занятие 1 — Настройка/}).click();
 await p.getByText(docMarker,{exact:true}).waitFor();
 ok(await p.locator('[data-empty-media="image"]').count()>=1,"empty image is visible while editing");
 ok(await p.locator('[data-empty-media="video"]').count()>=1,"empty video is visible while editing");
 const beforeCount=await p.locator("[data-doc-block]").count();
 await p.getByRole("button",{name:"Вставить блок"}).nth(4).click();
 await p.getByRole("button",{name:"Заголовок",exact:true}).click();
 await p.waitForFunction(count=>document.querySelectorAll("[data-doc-block]").length>count,beforeCount);
 const chartsBefore=await p.locator('[data-interactive-view="chart"]').count();
 await p.getByRole("button",{name:"Вставить блок"}).nth(5).click();
 await p.getByRole("button",{name:"Интерактив",exact:true}).click();
 await p.waitForFunction(count=>document.querySelectorAll('[data-interactive-view="chart"]').length>count,chartsBefore);
 const orderBefore=await p.locator("[data-block-id]").evaluateAll(nodes=>nodes.map(node=>node.getAttribute("data-block-id")));
 const handle=p.locator(".v6-doc-block-handle").nth(1),hb=await handle.boundingBox();
 await p.mouse.move(hb.x+8,hb.y+8);await p.mouse.down();await p.mouse.move(hb.x+8,hb.y+220,{steps:8});await p.mouse.up();await wait(500);
 const orderAfter=await p.locator("[data-block-id]").evaluateAll(nodes=>nodes.map(node=>node.getAttribute("data-block-id")));
 ok(orderBefore.join()!=orderAfter.join(),"blocks did not reorder");
 await p.getByRole("tab",{name:"Раздатка"}).click();
 await p.getByTestId("document-preview").waitFor();
 ok(await p.locator(".v6-insert-line").count()===0,"preview still shows insertion");
 ok(await p.locator(".v6-doc-block-handle").count()===0,"preview still shows drag handles");
 ok(await p.locator(".studio-doc-placeholder").count()===0,"preview still shows empty placeholders");
 ok(await p.getByText(docMarker,{exact:true}).count()===1,"preview lost the written text");
 await p.getByRole("button",{name:"Публикация"}).click();
 const share=p.getByTestId("v6-share-popover");
 await share.getByRole("button",{name:"Открыть"}).waitFor();
 await share.getByRole("button",{name:"Копировать ссылку"}).waitFor();
 await share.getByRole("button",{name:"Сохранить PDF"}).waitFor();
 await share.getByRole("button",{name:"Опубликовать"}).waitFor();
 ok((await share.locator("strong").innerText()).includes("не опубликованы")||(await share.locator("strong").innerText()).includes("Черновик"),"publication state missing");
 await p.getByRole("button",{name:"Ещё"}).click();
 await p.getByRole("button",{name:"Тёмная тема"}).click();
 await p.waitForFunction(()=>document.querySelector('[data-testid="tqs-studio-v6"]')?.getAttribute("data-theme")==="dark");
 await p.reload({waitUntil:"domcontentloaded"});
 await p.waitForFunction(()=>document.querySelector('[data-testid="tqs-studio-v6"]')?.getAttribute("data-theme")==="dark");
 await p.locator(".v6-nav-rail").getByRole("button",{name:"Доска"}).click();
 await p.getByTestId("world-canvas-v6").waitFor();
 console.log("PASS RF-F documents");

 ok(errors.length===0,"late runtime errors: "+errors.join(" | "));
 console.log(JSON.stringify({ok:true,engine:"@xyflow/react",gates:["owner-scene","navigation","nested-movement","local-persistence","semantic-zoom","documents"]}));
}finally{await browser.close()}

import { chromium } from "playwright";

const base = process.env.STUDIO_QA_BASE || "http://127.0.0.1:3210";
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] })).newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
const fail = (message) => { throw new Error(message); };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  await page.goto(base + "/studio", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByTestId("world-canvas-v6").waitFor({ timeout: 30000 });
  await page.locator('[data-studio-id="lesson-miro-l100"]').waitFor({ timeout: 20000 });
  await wait(700);
  if (errors.length) fail(errors.join(" | "));

  const rail = await page.locator(".v6-nav-rail").boundingBox();
  if (!rail || rail.width < 48 || rail.width > 54) fail("rail width " + rail?.width);
  const before = await page.getByTestId("world-canvas-v6").boundingBox();
  if (await page.getByRole("button", { name: "Zoom In" }).count()) fail("english zoom control");
  if (!(await page.getByRole("button", { name: "Вписать мир" }).count())) fail("fit label missing");

  const near = await page.evaluate(() => ({
    lod: document.querySelector("[data-lod]")?.getAttribute("data-lod"),
    zoom: document.querySelector(".rf-zoombar")?.innerText || "",
    chart: document.querySelector(".rf-chart-head")?.innerText || "",
    task: document.querySelector(".rf-task")?.innerText || "",
    voice: document.querySelector(".rf-wave") ? "wave" : "",
    doc: document.querySelector(".rf-doc-sheet") ? "sheet" : "",
    topic: document.querySelector('[data-studio-id="lesson-miro-l100"]')?.textContent || "",
  }));
  if (near.lod !== "near") fail("lesson focus is " + near.lod + " " + near.zoom);
  if (!near.chart.includes("SI") || !near.chart.includes("LIVE")) fail("chart chrome " + near.chart);
  if (!near.task.includes("Сделать скрин")) fail("task row " + near.task);
  if (near.voice !== "wave") fail("voice is not a waveform");
  if (near.doc !== "sheet") fail("document is not a page preview");
  if (!near.topic.includes("L1.01")) fail("topic flow " + near.topic);
  console.log("PASS near lesson");

  await page.getByRole("button", { name: "Навигатор" }).click();
  await page.locator(".v6-nav-overlay").waitFor();
  const after = await page.getByTestId("world-canvas-v6").boundingBox();
  if (!before || !after || Math.abs(before.width - after.width) > 1 || Math.abs(before.x - after.x) > 1) fail("navigator moved the canvas");
  await page.locator(".v6-nav-card", { hasText: "Обучение" }).first().getByRole("button").first().click();
  await page.locator(".v6-nav-card", { hasText: "Бесплатный курс" }).first().getByRole("button").first().click();
  const row = page.locator(".v6-nav-card", { hasText: "Занятие 1" }).first();
  if (!(await row.getByRole("button", { name: "На доске" }).count())) fail("focus action missing");
  if (!(await row.getByRole("button", { name: "Документ" }).count())) fail("document action missing");
  await row.getByRole("button", { name: "На доске" }).click();
  await page.waitForFunction(() => !document.querySelector(".v6-nav-overlay"));
  console.log("PASS navigator");

  const pane = page.locator(".react-flow__pane");
  const box = await pane.boundingBox();
  await page.mouse.click(box.x + 40, box.y + box.height - 40, { button: "right" });
  const menu = await page.getByTestId("board-menu").innerText();
  for (const label of ["Текст", "Заметка", "Задача", "Голос", "Изображение", "Ещё"]) if (!menu.includes(label)) fail("menu missing " + label);
  await page.keyboard.press("Escape");
  console.log("PASS create menu");

  await page.getByTestId("world-canvas-v6").focus();
  const marker = "PASTE-" + Date.now();
  await page.evaluate((value) => {
    const target = document.querySelector("[data-testid=world-canvas-v6]");
    const data = new DataTransfer();
    data.setData("text/plain", value);
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: data });
    target.dispatchEvent(event);
  }, marker);
  await page.waitForFunction((value) => (localStorage.getItem("tqs-studio-v5-local-state-v4") || "").includes(value), marker);
  await page.evaluate(() => {
    const target = document.querySelector("[data-testid=world-canvas-v6]");
    const data = new DataTransfer();
    data.setData("text/plain", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: data });
    target.dispatchEvent(event);
  });
  await page.waitForFunction(() => (localStorage.getItem("tqs-studio-v5-local-state-v4") || "").includes("youtube.com/embed/"));
  await page.evaluate(async () => {
    const state = JSON.parse(localStorage.getItem("tqs-studio-v5-local-state-v4") || "{}");
    const junk = (state.overview?.objects || []).filter((object) => JSON.stringify(object.body || "").includes("PASTE-") || String(object.body?.embedUrl || "").includes("youtube.com/embed/dQw4w9WgXcQ"));
    for (const object of junk) await window.tqsStudio.action("updateObject", { id: object.id, patch: { hidden: true }, eventType: "hide", summary: "Убран проверочный объект" });
  });

  await page.getByRole("button", { name: "Вписать мир" }).click();
  await wait(700);
  const far = await page.evaluate(() => ({
    lod: document.querySelector("[data-lod]")?.getAttribute("data-lod"),
    signatures: document.querySelectorAll(".rf-workspace-signatures").length,
    content: document.querySelectorAll(".react-flow__node-content:not(.hidden)").length,
    titles: [...document.querySelectorAll(".rf-workspace-head strong")].map((node) => node.textContent).filter(Boolean),
  }));
  if (far.lod !== "far") fail("fit world lod " + far.lod);
  if (!far.signatures) fail("far has no region signatures");
  if (!far.titles.some((title) => title.includes("Обучение"))) fail("far map missing learning");
  console.log("PASS far", far.titles.slice(0, 8).join(" | "));

  const run = await page.evaluate(async () => {
    const api = window.tqsStudio;
    const created = await api.mutate({
      actor: "cursor",
      summary: "Проверка рабочей станции",
      context: { frameId: "lesson-miro-scene", pointer: { x: 6400, y: 1280 } },
      mutations: [{
        operation: "create",
        summary: "Временная задача проверки",
        object: {
          id: "qa-workstation-probe",
          kind: "task",
          title: "Временная проверка",
          semantic_path: "Обучение/Бесплатный курс/Занятие 1/Рабочее пространство/Временная проверка",
          parent_id: "lesson-miro-scene",
          x: 6200, y: 1240, w: 280, h: 44, z: 30,
          body: { title: "Временная проверка" },
          relations: [{ type: "contains", targetId: "lesson-miro-scene" }],
          status: "NEW",
          hidden: false,
        },
      }],
    });
    const read = await api.context({ frameId: "lesson-miro-scene", objectIds: ["qa-workstation-probe"] });
    return { runId: created.generation_run_id, found: read.entities?.some((item) => item.object_id === "qa-workstation-probe"), activity: created.activity_ids?.length || 0 };
  });
  if (!run.found || !run.runId || !run.activity) fail("ai readback " + JSON.stringify(run));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("world-canvas-v6").waitFor();
  await page.locator('[data-studio-id="qa-workstation-probe"]').waitFor({ timeout: 15000 });
  const undone = await page.evaluate(async (runId) => {
    await window.tqsStudio.undo(runId);
    const read = await window.tqsStudio.context({ objectIds: ["qa-workstation-probe"] });
    return read.entities?.length || 0;
  }, run.runId);
  if (undone !== 0) fail("undo left the probe");
  await page.evaluate(async (runId) => { await window.tqsStudio.redo(runId); await window.tqsStudio.undo(runId); }, run.runId);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("world-canvas-v6").waitFor();
  await wait(500);
  if (await page.locator('[data-studio-id="qa-workstation-probe"]').count()) fail("probe remained on the board");
  console.log("PASS ai mutation");
  if (errors.length) fail(errors.join(" | "));
  console.log("WORKSTATION_OK");
} finally {
  await browser.close();
}

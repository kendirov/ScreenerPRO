import { chromium } from "@playwright/test";
import fs from "node:fs";

const url = process.env.STUDIO_URL || "http://127.0.0.1:3027/studio-spatial-prototype";
const evidenceDir = process.env.STUDIO_EVIDENCE || "C:/ArtemOS/evidence/tqs-studio-spatial-v2";
fs.mkdirSync(evidenceDir, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const failures = [];
const check = (condition, label) => {
  if (!condition) failures.push(label);
  console.log((condition ? "PASS " : "FAIL ") + label);
};

async function shapeFor(testId, index = 0) {
  const locator = page.getByTestId(testId).nth(index);
  await locator.waitFor({ state: "visible" });
  return locator;
}

async function drag(locator, dx, dy) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("missing bbox");
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(45, box.height / 3));
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + Math.min(45, box.height / 3) + dy, { steps: 12 });
  await page.mouse.up();
}

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByTestId("studio-spatial-v2").waitFor();
  check((await page.getByTestId("block-text").count()) >= 1, "initial Rich Text exists");
  check((await page.getByTestId("block-chart").count()) >= 1, "initial Chart exists");
  check((await page.getByTestId("block-video").count()) >= 1, "initial Video exists");
  check((await page.getByTestId("block-pdf").count()) >= 1, "initial PDF exists");

  const calloutsBefore = await page.getByTestId("block-callout").count();
  await page.mouse.click(1180, 760, { button: "right" });
  await page.getByTestId("insert-callout").click();
  await page.waitForTimeout(120);
  check((await page.getByTestId("block-callout").count()) === calloutsBefore + 1, "right-click creates at canvas");

  const newCallout = page.getByTestId("block-callout").last();
  const beforeDrag = await newCallout.boundingBox();
  await drag(newCallout, -260, -180);
  const afterDrag = await newCallout.boundingBox();
  check(!!beforeDrag && !!afterDrag && Math.abs(afterDrag.x - beforeDrag.x) > 150, "whole-block drag moves far");

  await page.getByTestId("block-text").first().click();
  await page.keyboard.press("Enter");
  await page.locator(".ProseMirror").first().click();
  await page.keyboard.press("Control+A");
  await page.getByTestId("format-bold").click();
  check((await page.locator(".ProseMirror strong").count()) > 0, "Tiptap bold formatting works");
  await page.keyboard.press("Escape");

  const chart = page.getByTestId("block-chart").first();
  await chart.click();
  await page.keyboard.press("Enter");
  await page.getByTestId("chart-period-short").click();
  await page.getByTestId("chart-series-rts").click();
  const chartSurface = page.getByTestId("chart-surface");
  const chartBox = await chartSurface.boundingBox();
  if (chartBox) await page.mouse.move(chartBox.x + chartBox.width * 0.65, chartBox.y + chartBox.height * 0.45);
  check((await chartSurface.locator("canvas").count()) > 0, "ECharts rendered interactive canvas");
  await page.keyboard.press("Escape");
  const chartBefore = await chart.boundingBox();
  await drag(chart, 170, 90);
  const chartAfter = await chart.boundingBox();
  check(!!chartBefore && !!chartAfter && Math.abs(chartAfter.x - chartBefore.x) > 80, "chart block remains movable");

  const video = page.getByTestId("block-video").first();
  await video.click();
  await page.keyboard.press("Enter");
  await page.getByTestId("transcript-2").click();
  await page.waitForTimeout(150);
  const currentTime = await page.getByTestId("video-player").evaluate((el) => el.currentTime);
  check(currentTime >= 1.5, "video transcript seeks player");
  await page.keyboard.press("Escape");

  const pdf = page.getByTestId("block-pdf").first();
  await pdf.click();
  await page.keyboard.press("Enter");
  await page.getByTestId("pdf-next").click();
  await page.waitForTimeout(250);
  check((await pdf.textContent()).includes("page 2 / 2"), "PDF.js next-page navigation works");
  await page.keyboard.press("Escape");

  const frame = page.locator('[data-shape-id="shape:frame-article"]').first();
  const child = page.getByTestId("block-text").first();
  const frameBefore = await frame.boundingBox();
  const childBefore = await child.boundingBox();
  if (frameBefore) {
    await page.mouse.move(frameBefore.x + 160, frameBefore.y + 20);
    await page.mouse.down();
    await page.mouse.move(frameBefore.x + 280, frameBefore.y + 95, { steps: 10 });
    await page.mouse.up();
  }
  const frameAfter = await frame.boundingBox();
  const childAfterParent = await child.boundingBox();
  check(!!frameBefore && !!frameAfter && Math.abs(frameAfter.x - frameBefore.x) > 60, "Frame parent moves");
  check(!!childBefore && !!childAfterParent && Math.abs(childAfterParent.x - childBefore.x) > 60, "moving Frame moves children");

  const frameStableBefore = await frame.boundingBox();
  await drag(child, 90, 55);
  const frameStableAfter = await frame.boundingBox();
  const childIndependent = await child.boundingBox();
  check(!!frameStableBefore && !!frameStableAfter && Math.abs(frameStableAfter.x - frameStableBefore.x) < 5, "child moves independently without moving Frame");
  check(!!childAfterParent && !!childIndependent && Math.abs(childIndependent.x - childAfterParent.x) > 40, "inner child independent drag works");

  await page.getByTestId("mode-preview").click();
  await page.getByTestId("preview-mode").waitFor();
  check((await page.getByTestId("preview-mode").count()) === 1, "Preview mode works");
  await page.getByTestId("mode-present").click();
  await page.getByTestId("present-mode").waitFor();
  check((await page.getByTestId("present-mode").count()) === 1, "Present mode works");
  await page.getByTestId("mode-edit").click();

  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("studio-spatial-v2").waitFor();
  check((await page.getByTestId("block-callout").count()) === calloutsBefore + 1, "reload persistence keeps created object");
  check((await page.locator(".ProseMirror strong").count()) > 0, "reload persistence keeps rich-text formatting");

  await page.screenshot({ path: evidenceDir + "/desktop-edit.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 1, "narrow viewport has no document horizontal overflow");
  await page.screenshot({ path: evidenceDir + "/narrow.png", fullPage: true });

  await page.getByTestId("reset-demo").click();
  await page.waitForTimeout(250);
  check((await page.getByTestId("block-text").count()) === 1, "Reset restores canonical board");
} catch (error) {
  console.error(error);
  failures.push("unhandled: " + String(error));
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("QA FAILURES:", failures);
  process.exit(1);
}
console.log("STUDIO_SPATIAL_V2_QA_PASS");

import { sidebarMainNavGroups, sidebarDraftsNav, mobilePrimaryNav } from "../lib/constants/navigation";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const items = [...sidebarMainNavGroups.flatMap((g) => g.items), ...sidebarDraftsNav.items];
const topLevelItems = sidebarMainNavGroups.flatMap((group) => group.items);
const expectedSections = ["today", "market", "laboratory", "news", "studio", "knowledge", "management"];
const ids = items.map((item) => item.id ?? item.href);
const hrefs = items.map((item) => item.href);
if (new Set(ids).size !== ids.length) throw new Error("Duplicate navigation IDs");
if (new Set(hrefs).size !== hrefs.length) throw new Error("Duplicate navigation hrefs");
if (topLevelItems.length !== expectedSections.length) throw new Error("Trading OS must expose exactly seven top-level sections");
if (topLevelItems.some((item, index) => item.section !== expectedSections[index])) throw new Error("Trading OS top-level section order changed");
if (mobilePrimaryNav.length > 4) throw new Error("Mobile primary navigation exceeds four items");
if (!existsSync(resolve(process.cwd(), "app/(app)/studio/page.tsx"))) throw new Error("Studio bridge route is missing");
if (!readFileSync(resolve(process.cwd(), ".env.example"), "utf8").includes("NEXT_PUBLIC_PRESENTATION_OS_URL=")) throw new Error("Presentation OS URL contract is missing");
for (const required of ["--color-canvas", "--color-surface-0", "--color-text-primary", "--accent-cyan", "--accent-green", "--accent-red", "--accent-amber", "--accent-violet"]) {
  if (!readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8").includes(required)) throw new Error(`Missing design token ${required}`);
}
console.log(`Navigation/design integrity passed: ${topLevelItems.length} top-level sections, ${items.length} total items, ${mobilePrimaryNav.length} mobile primary items.`);

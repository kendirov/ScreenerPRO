import { sidebarMainNavGroups, sidebarDraftsNav, mobilePrimaryNav } from "../lib/constants/navigation";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const items = [...sidebarMainNavGroups.flatMap((g) => g.items), ...sidebarDraftsNav.items];
const ids = items.map((i) => i.id ?? i.href); const hrefs = items.map((i) => i.href);
if (new Set(ids).size !== ids.length) throw new Error("Duplicate navigation IDs");
if (new Set(hrefs).size !== hrefs.length) throw new Error("Duplicate navigation hrefs");
if (mobilePrimaryNav.length > 5) throw new Error("Mobile primary navigation exceeds five items");
for (const required of ["--color-canvas", "--color-surface-0", "--color-text-primary", "--accent-cyan", "--accent-green", "--accent-red", "--accent-amber", "--accent-violet"]) {
  if (!readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8").includes(required)) throw new Error(`Missing design token ${required}`);
}
console.log(`Navigation/design integrity passed: ${items.length} items, ${mobilePrimaryNav.length} mobile primary items.`);

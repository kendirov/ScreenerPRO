import {
  itemsBySection,
  MATERIALS_SHOWCASE_SECTIONS,
  type MaterialsShowcaseSectionId,
} from "@/lib/materials/showcase-catalog";
import { MaterialsShowcaseCard } from "@/components/materials/materials-showcase-card";
import { cn } from "@/lib/utils/cn";

const SECTION_VARIANT: Record<MaterialsShowcaseSectionId, "default" | "draft" | "idea"> = {
  ready: "default",
  inDevelopment: "draft",
  ideas: "idea",
};

const SECTION_SHELL: Record<MaterialsShowcaseSectionId, string> = {
  ready: "",
  inDevelopment:
    "rounded-xl border border-lab-border-violet/25 bg-lab-surface-hot/15 p-3 sm:p-4 backdrop-blur-sm",
  ideas: "rounded-xl border border-dashed border-lab-border/80 bg-lab-surface-glass/30 p-3 sm:p-4",
};

export function MaterialsShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="lab-glass-panel relative overflow-hidden px-5 py-5 sm:px-6 sm:py-6">
        <div className="lab-accent-line absolute inset-x-0 top-0 opacity-60" aria-hidden />
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-lab-violet/10 blur-3xl"
          aria-hidden
        />
        <h1 className="lab-type-display text-2xl sm:text-3xl">Материалы</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-lab-muted sm:text-base">
          Учебные страницы, справочники и интерактивные материалы для курса.
        </p>
      </header>

      {MATERIALS_SHOWCASE_SECTIONS.map((section) => {
        const items = itemsBySection(section.id);
        const variant = SECTION_VARIANT[section.id];

        return (
          <section key={section.id} className={cn(SECTION_SHELL[section.id])}>
            <div className="mb-4 px-0.5">
              <h2 className="lab-type-section text-sm text-lab-text">{section.title}</h2>
              <p className="lab-type-caption mt-1 max-w-3xl text-xs sm:text-sm">{section.subtitle}</p>
            </div>
            <div
              className={cn(
                "grid gap-3",
                section.id === "ready"
                  ? "sm:grid-cols-2 xl:grid-cols-2"
                  : section.id === "inDevelopment"
                    ? "sm:grid-cols-2 xl:grid-cols-3"
                    : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
              )}
            >
              {items.map((item) => (
                <MaterialsShowcaseCard key={item.slug} item={item} variant={variant} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

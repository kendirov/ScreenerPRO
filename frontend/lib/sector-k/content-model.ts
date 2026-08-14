import { z } from "zod";

export const sectorKContentStatusSchema = z.enum([
  "idea",
  "draft",
  "review",
  "approved",
  "published",
  "archived",
]);

export const sectorKVisibilitySchema = z.enum(["public", "unlisted", "private"]);

export const sectorKSceneSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["principle", "live-snapshot", "calculator", "decision", "checklist"]),
  title: z.string().min(1),
  purpose: z.string().min(1),
});

export const sectorKRevisionSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().positive(),
  schemaVersion: z.literal(1),
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1),
  changelog: z.string().min(1),
  scenes: z.array(sectorKSceneSchema).min(1),
});

export const sectorKContentItemSchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  type: z.enum(["material", "strategy", "research", "calculator", "experiment"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  status: sectorKContentStatusSchema,
  visibility: sectorKVisibilitySchema,
  tags: z.array(z.string()),
  currentDraftRevisionId: z.string().nullable(),
  publishedRevisionId: z.string().nullable(),
  revisions: z.array(sectorKRevisionSchema).min(1),
  updatedAt: z.string().datetime(),
});

export type SectorKContentStatus = z.infer<typeof sectorKContentStatusSchema>;
export type SectorKVisibility = z.infer<typeof sectorKVisibilitySchema>;
export type SectorKContentItem = z.infer<typeof sectorKContentItemSchema>;
export type SectorKRevision = z.infer<typeof sectorKRevisionSchema>;

export const sectorKContentStatusLabels: Record<SectorKContentStatus, string> = {
  idea: "Запланировано",
  draft: "Черновик",
  review: "На проверке",
  approved: "Одобрено",
  published: "Опубликовано",
  archived: "Архив",
};

export const sectorKVisibilityLabels: Record<SectorKVisibility, string> = {
  public: "Публично",
  unlisted: "По ссылке",
  private: "Приватно",
};

const intradaySelectionItem = {
  id: "material-intraday-selection",
  slug: "intraday-selection",
  type: "material",
  title: "Отбор инструментов для внутридневной торговли",
  summary:
    "Акции в игре, активные инструменты MOEX и расчёт расходов на вход и выход.",
  status: "review",
  visibility: "unlisted",
  tags: ["MOEX", "отбор", "ликвидность", "калькулятор"],
  currentDraftRevisionId: "selection-r2",
  publishedRevisionId: null,
  updatedAt: "2026-08-14T14:30:00.000Z",
  revisions: [
    {
      id: "selection-r1",
      number: 1,
      schemaVersion: 1,
      createdAt: "2026-08-14T13:30:00.000Z",
      createdBy: "Редактор",
      changelog: "2 блока: активность и расходы.",
      scenes: [
        {
          id: "selection-principle",
          type: "principle",
          title: "Активные акции",
          purpose: "Поля: isInPlay, score, turnover percentile.",
        },
        {
          id: "selection-calculator",
          type: "calculator",
          title: "Расходы на сделку",
          purpose: "Комиссия, спред и проскальзывание.",
        },
      ],
    },
    {
      id: "selection-r2",
      number: 2,
      schemaVersion: 1,
      createdAt: "2026-08-14T14:30:00.000Z",
      createdBy: "Редактор",
      changelog: "5 блоков: статусы, MOEX, расходы, добавить, исключить.",
      scenes: [
        {
          id: "selection-principle",
          type: "principle",
          title: "Акции в игре и активные акции",
          purpose: "isInPlay, активные акции, надёжный baseline.",
        },
        {
          id: "selection-live",
          type: "live-snapshot",
          title: "Активные инструменты MOEX",
          purpose: "Цена, оборот, сделки, лот.",
        },
        {
          id: "selection-calculator",
          type: "calculator",
          title: "Расходы на вход и выход",
          purpose: "Комиссия, спред, проскальзывание, покрытие движением.",
        },
        {
          id: "selection-decision",
          type: "decision",
          title: "Добавить в список",
          purpose: "Baseline, расходы, лот, цена входа и стоп.",
        },
        {
          id: "selection-checklist",
          type: "checklist",
          title: "Не добавлять",
          purpose: "Нет baseline, высокий спред, расходы выше лимита.",
        },
      ],
    },
  ],
} satisfies SectorKContentItem;

export const sectorKContentItems: SectorKContentItem[] = sectorKContentItemSchema.array().parse([
  intradaySelectionItem,
]);

export function getSectorKContentItem(slug: string): SectorKContentItem | null {
  return sectorKContentItems.find((item) => item.slug === slug) ?? null;
}

export function getSectorKCurrentRevision(item: SectorKContentItem): SectorKRevision | null {
  const targetId = item.currentDraftRevisionId ?? item.publishedRevisionId;
  if (!targetId) return null;
  return item.revisions.find((revision) => revision.id === targetId) ?? null;
}

export function sectorKPublishReadiness(item: SectorKContentItem): { ready: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (item.status !== "approved") blockers.push("Материал ещё не одобрен");
  if (!item.currentDraftRevisionId) blockers.push("Нет активной draft revision");
  const revision = getSectorKCurrentRevision(item);
  if (!revision) blockers.push("Активная revision не найдена");
  if (revision && revision.scenes.length < 3) blockers.push("Блоков меньше 3");
  return { ready: blockers.length === 0, blockers };
}

/** Показывать полный блок «Черновики» в sidebar — только по явному флагу (draft-деплой). */
export function isDraftNavVisible(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_DRAFT_NAV === "true";
}

/** Каталог R&D — доступен владельцу и в production, но полный список требует флага. */
export function isDevLabLinkVisible(): boolean { return !isDraftNavVisible(); }

/** AI Data не показывается, пока маршрут не введён в базовую ветку. */
export function isAiDataNavVisible(): boolean { return process.env.NEXT_PUBLIC_AI_DATA_AVAILABLE === "true"; }

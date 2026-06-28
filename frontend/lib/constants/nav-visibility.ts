/** Показывать полный блок «Черновики» в sidebar — только по явному флагу (draft-деплой). */
export function isDraftNavVisible(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_DRAFT_NAV === "true";
}

/** Компактная dev-ссылка на каталог /lab — только локально. */
export function isDevLabLinkVisible(): boolean {
  return process.env.NODE_ENV === "development" && !isDraftNavVisible();
}

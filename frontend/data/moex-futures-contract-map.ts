/**
 * TODO: временный ручной mapping SECID фьючерсов по дате заседания ЦБ.
 * Использовать только когда MOEX ISS не даёт надёжный выбор контракта.
 * Удалить после стабилизации ISS-резолва в moex-instrument-resolver.ts.
 */

export type MoexFuturesAssetCode = "Si" | "CNY" | "MX";

export type MoexFuturesContractMapEntry = {
  assetCode: MoexFuturesAssetCode;
  /** YYYY-MM-DD включительно */
  fromDate: string;
  /** YYYY-MM-DD включительно */
  tillDate: string;
  secid: string;
  note?: string;
};

/** Пустой по умолчанию — не хардкодим SiM6 / SiU6. */
export const MOEX_FUTURES_CONTRACT_MAP: MoexFuturesContractMapEntry[] = [];

export function lookupManualFuturesContract(
  assetCode: MoexFuturesAssetCode,
  eventDate: string,
): MoexFuturesContractMapEntry | null {
  const day = eventDate.slice(0, 10);
  return (
    MOEX_FUTURES_CONTRACT_MAP.find(
      (entry) =>
        entry.assetCode === assetCode && day >= entry.fromDate && day <= entry.tillDate,
    ) ?? null
  );
}

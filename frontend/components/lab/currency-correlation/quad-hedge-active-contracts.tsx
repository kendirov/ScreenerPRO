"use client";

import type { ResolvedFuturesContract } from "@/lib/domain/futures-contract-resolver";
import { contractStatusLabel } from "@/lib/domain/futures-contract-resolver";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { cn } from "@/lib/utils/cn";

const STATUS_TONE: Record<ReturnType<typeof contractStatusLabel>, string> = {
  OK: "text-emerald-300/90",
  "NO DATA": "text-amber-300/85",
  "NO CONTRACT": "text-rose-300/85",
};

function ContractRow({ contract }: { contract: ResolvedFuturesContract }) {
  const status = contractStatusLabel(contract);
  const secid = contract.secid && contract.secid !== "—" ? contract.secid : "—";

  return (
    <div className="flex min-w-0 items-center gap-2 font-mono text-[10px]">
      <span className="w-5 shrink-0 text-cyan-400/75">{contract.base}</span>
      <span className="text-slate-600">→</span>
      <span className="truncate text-slate-200" title={contract.shortName}>
        {secid}
      </span>
      <span className={cn("shrink-0 text-[9px] uppercase tracking-wide", STATUS_TONE[status])}>
        · {status === "OK" ? "OK" : status === "NO DATA" ? "NO DATA" : "NO CONTRACT"}
      </span>
    </div>
  );
}

export function QuadHedgeActiveContracts({
  contracts,
  days,
  interval,
  isLoading,
  className,
}: {
  contracts?: ResolvedFuturesContract[];
  days?: number;
  interval?: number;
  isLoading?: boolean;
  className?: string;
}) {
  const primary = contracts?.filter((c) => c.base === "SI" || c.base === "EU" || c.base === "CN") ?? [];

  return (
    <LabGlassPanel
      depth={20}
      className={cn(
        "border-white/[0.05] bg-slate-950/45 px-2.5 py-1.5 backdrop-blur-md",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">Активные контракты</p>
        <p className="font-mono text-[9px] text-slate-600">
          {isLoading
            ? "MOEX ISS…"
            : `окно ${days ?? "—"}д · ${interval ?? "—"}м · MOEX ISS`}
        </p>
      </div>
      <div className="mt-1 grid gap-0.5 sm:grid-cols-3">
        {isLoading
          ? ["SI", "EU", "CN"].map((base) => (
              <div key={base} className="font-mono text-[10px] text-slate-600">
                {base} → …
              </div>
            ))
          : primary.length
            ? primary.map((c) => <ContractRow key={c.base} contract={c} />)
            : (
                <p className="col-span-full text-[10px] text-slate-500">
                  Контракты не резолвятся — проверьте MOEX ISS.
                </p>
              )}
      </div>
    </LabGlassPanel>
  );
}

export function quadHedgeContractDiagnosticsMessage(
  contracts: ResolvedFuturesContract[] | undefined,
): string | null {
  if (!contracts?.length) return null;

  const withCandles = contracts.filter((c) => c.hasCandles);
  const primary = contracts.filter((c) => c.base === "SI" || c.base === "EU" || c.base === "CN");

  if (withCandles.length < 2) {
    return "Нужны минимум два реальных фьючерса с данными. Проверь resolved contracts и выбранную дату.";
  }

  const missing = primary.find((c) => !c.secid || c.secid === "—");
  if (missing) {
    return `${missing.base}: активный контракт не найден через MOEX ISS. Нужна проверка mapping.`;
  }

  const noCandles = primary.find((c) => c.secid !== "—" && !c.hasCandles);
  if (noCandles) {
    return `${noCandles.base}: контракт найден, но свечей за выбранный период нет.`;
  }

  return null;
}

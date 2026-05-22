"use client";

import { cn } from "@/lib/utils/cn";

type ClusterWhatToWatchProps = {
  className?: string;
};

export function ClusterWhatToWatch({ className }: ClusterWhatToWatchProps) {
  return (
    <details className={cn("rounded border border-violet-500/15 bg-violet-950/20", className)}>
      <summary className="cursor-pointer px-2 py-1.5 font-mono text-[10px] text-violet-200/90">
        Что смотреть в кластерах
      </summary>
      <ul className="list-inside list-disc space-y-1 px-2 pb-2 font-mono text-[10px] leading-relaxed text-violet-100/80">
        <li>Объём на уровне — где прошла основная ликвидность.</li>
        <li>Дельта — перевес покупок или продаж в ячейке.</li>
        <li>Имбаланс — сильный перекос buy/sell (порог 3× по умолчанию).</li>
        <li>Цена прошла уровень или удержалась — сравните с графиком.</li>
        <li>Совпадение со стаканом: плотность, удары, восстановление объёма.</li>
        <li>Метка «абсорбция» — прошёл объём, но цена не ушла дальше; уровень удержали (учебная модель).</li>
      </ul>
    </details>
  );
}

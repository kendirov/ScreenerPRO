"use client";

import { TC_FORMULAS, TC_UI } from "@/lib/domain/technical-characteristics-labels";

export function TechnicalCharacteristicsDataFooter({
  statusMessage,
  showFormulas,
}: {
  statusMessage: string | null;
  showFormulas: boolean;
}) {
  return (
    <footer className="space-y-2">
      {showFormulas ? (
        <section className="rounded-lg border border-slate-800/90 bg-slate-900/40 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{TC_UI.formulasTitle}</p>
          <ul className="mt-2 columns-1 gap-x-6 text-xs text-slate-300 sm:columns-2">
            {TC_FORMULAS.map((item) => (
              <li key={item.title} className="mb-1.5 break-inside-avoid">
                <span className="font-medium text-slate-200">{item.title}</span>
                <span className="text-slate-500"> = </span>
                {item.expression}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-800/90 bg-slate-900/40 p-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{TC_UI.sourceTitle}</p>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-300">
          <li>
            <span className="font-medium text-slate-200">MOEX ISS</span> — публичный API Московской биржи.
          </li>
          <li>Котировки и оборот могут быть с задержкой, если нет подписки real-time.</li>
          <li>Поля без данных в источнике отображаются как «—».</li>
          <li>Расчётные поля (спред, комиссия, оценки) — прикладная оценка для сравнения инструментов, не оферта брокера.</li>
          {statusMessage ? <li className="text-slate-400">{statusMessage}</li> : null}
        </ul>
      </section>
    </footer>
  );
}

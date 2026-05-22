"use client";

import type { ScenarioJournalEntry } from "@/lib/domain/orderflow-simulator-engine";
import { cn } from "@/lib/utils/cn";

type ScenarioJournalPanelProps = {
  entries: ScenarioJournalEntry[];
  learningGoal: string | null;
  isComplete: boolean;
  className?: string;
};

export function ScenarioJournalPanel({ entries, learningGoal, isComplete, className }: ScenarioJournalPanelProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-white/[0.06] bg-slate-950/50 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Ход сценария</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">Учебный журнал · не гарантирует движение на MOEX</p>
        </div>
        {isComplete ? (
          <span className="rounded border border-emerald-500/20 bg-emerald-950/30 px-2 py-0.5 text-[10px] text-emerald-300">
            завершён
          </span>
        ) : null}
      </div>

      {learningGoal ? (
        <div className="mt-2 rounded-md border border-violet-500/15 bg-violet-950/20 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-violet-400/80">Цель урока</p>
          <p className="mt-0.5 text-sm text-violet-100/90">{learningGoal}</p>
        </div>
      ) : null}

      <div className="mt-2 max-h-[220px] space-y-2 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="py-3 text-center text-xs text-slate-600">
            Выберите сценарий и нажмите «Запустить» или «Пошагово»
          </p>
        ) : (
          entries.map((entry) => (
            <article
              key={`${entry.tick}-${entry.stepIndex}`}
              className="rounded-md border border-white/[0.05] bg-[#060a14]/80 px-2.5 py-2"
            >
              <p className="font-mono text-[10px] text-slate-500">
                Шаг {entry.stepIndex} · такт {entry.tick}
              </p>
              <p className="mt-1 text-sm text-slate-200">{entry.explanation}</p>
              {entry.appeared ? (
                <p className="mt-1 text-[11px] text-slate-400">
                  <span className="text-slate-600">Появилось: </span>
                  {entry.appeared}
                </p>
              ) : null}
              {entry.aggressor ? (
                <p className="mt-0.5 text-[11px] text-rose-200/80">
                  <span className="text-slate-600">Удар: </span>
                  {entry.aggressor}
                </p>
              ) : null}
              {entry.levelOutcome ? (
                <p className="mt-0.5 text-[11px] text-emerald-200/80">
                  <span className="text-slate-600">Уровень: </span>
                  {entry.levelOutcome}
                </p>
              ) : null}
              <p className="mt-1 text-[11px] text-sky-300/80">
                <span className="text-sky-500/70">Смотреть: </span>
                {entry.watchBook ?? entry.watchHint}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                <span className="text-slate-600">Зачем: </span>
                {entry.whyImportant}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

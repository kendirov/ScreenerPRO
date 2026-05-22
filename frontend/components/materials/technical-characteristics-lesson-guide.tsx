"use client";

import { LESSON_READ_CARDS } from "@/lib/domain/technical-characteristics-lesson";

export function TechnicalCharacteristicsLessonGuide() {
  return (
    <section className="rounded-lg border border-violet-500/15 bg-violet-500/[0.04] p-3 sm:p-4">
      <h2 className="text-sm font-semibold text-slate-100">Как читать технические характеристики</h2>
      <p className="mt-1 text-[11px] text-slate-500">
        Четыре вопроса, на которые отвечает таблица. Выберите инструмент — справа появятся примеры с его цифрами.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {LESSON_READ_CARDS.map((card) => (
          <div key={card.id} className="rounded-md border border-slate-800/90 bg-slate-950/50 px-3 py-2.5">
            <p className="text-xs font-medium text-violet-200/90">{card.title}</p>
            <ul className="mt-2 space-y-0.5 text-[11px] text-slate-400">
              {card.fields.map((field) => (
                <li key={field}>· {field}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

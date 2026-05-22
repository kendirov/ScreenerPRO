"use client";

const ITEMS = [
  "Яркая линия — текущая неделя.",
  "Тонкие линии — прошлые недели.",
  "Если текущая линия выходит за привычный коридор, связка ведёт себя необычно.",
  "Сравнение недель не является торговой рекомендацией.",
] as const;

export function CurrencyCorrelationWeeksHowToRead() {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-slate-900/35 px-3 py-2.5">
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-600">
        Как читать недели
      </p>
      <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-snug text-slate-500">
        {ITEMS.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ol>
    </div>
  );
}

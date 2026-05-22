"use client";

const ITEMS = [
  {
    term: "Спред",
    text: "разница движений двух ног связки от выбранной точки отсчёта, а не цена одного контракта.",
  },
  {
    term: "Открытие недели",
    text: "якорь расчёта по умолчанию: спред и z-score от понедельника (Europe/Moscow); если якорь недоступен — используется старт периода.",
  },
  {
    term: "SI−CNY",
    text: "в процентах — контракты разного масштаба.",
  },
  {
    term: "SI−ED",
    text: "в пунктах — абсолютное расхождение движения ног.",
  },
  {
    term: "Z-score",
    text: "насколько текущее расхождение далеко от недавней истории (~30 свечей); не торговый сигнал.",
  },
  {
    term: "Растяжение / экстрим",
    text: "статистически сильное расхождение; описание состояния, не рекомендация действовать.",
  },
  {
    term: "Возврат",
    text: "спред смещается к средней зоне или в недельный коридор прошлых недель.",
  },
  {
    term: "Зона риска невозврата",
    text: "статистическая зона повышенного риска удержания расхождения; не прогноз и не сигнал входа.",
  },
  {
    term: "Недели",
    text: "сравнение текущей календарной недели с прошлыми (реальные свечи MOEX ISS).",
  },
  {
    term: "CNY−ED",
    text: "экспериментальная пара — только наблюдение.",
  },
] as const;

export function CurrencyCorrelationHowToRead({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-lg border border-white/[0.05] bg-slate-900/30 px-3 py-2 ${className ?? ""}`}
    >
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-600">Как читать</p>
      <ul className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
        {ITEMS.map((item) => (
          <li key={item.term} className="text-[10px] leading-snug text-slate-500">
            <span className="font-medium text-slate-400">{item.term}</span> — {item.text}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 border-t border-white/[0.04] pt-1.5 text-[10px] leading-relaxed text-slate-600">
        Лаборатория описывает расхождения между контрактами MOEX ISS. Это аналитика, не торговая
        рекомендация: нет сигналов «покупай» или «продавай».
      </p>
    </div>
  );
}

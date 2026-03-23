"use client";

import { motion } from "motion/react";
import { AcademyEditorialLayout, EditorialBadgeRow } from "@/components/academy/editorial-layout";
import { AcademyHero, AcademySection, AcademyTakeaway, StickyVisualSection } from "@/components/academy/editorial-primitives";
import { RangeStoryVisual, TurnoverContrastVisual } from "@/components/academy/range-turnover-visuals";

const demo = {
  high: 313.0,
  low: 307.5,
  current: 311.8,
  denominator: 308.42,
  sameVolumeLots: 120_000,
  cheapPrice: 84,
  expensivePrice: 7120,
};

export function RangeTurnoverEditorial() {
  return (
    <AcademyEditorialLayout>
      <article className="space-y-14 py-2">
        <AcademyHero
          kicker="Академия / Практика скринера"
          title="Диапазон и оборот"
          subtitle="Быстрый интерактивный разбор двух ключевых метрик скринера: где действительно есть движение и где действительно есть деньги."
          meta="Время чтения: 6 минут • Формат: интерактивный редакционный модуль"
        />
        <EditorialBadgeRow items={["Внутридневной фокус", "Сигналы без шума", "MOEX-практика"]} />

        <AcademySection
          title="Диапазон %: сколько рынок реально прошёл внутри дня"
          text="Диапазон % показывает расстояние от минимума до максимума дня относительно устойчивого ориентира. Это позволяет сравнивать инструменты в одной шкале и сразу видеть, где движение действительно значимое."
        >
          <StickyVisualSection
            title="Интерактивная логика диапазона"
            text="Смотрите на коридор дня и на текущую цену внутри этого коридора. Чем шире коридор при подтверждении оборотом, тем выше вероятность, что инструмент находится в рабочем intraday-режиме."
            notes={[
              "Диапазон растет, а оборот не растет - движение может быть хрупким.",
              "Диапазон растет вместе с оборотом - чаще формируется рабочий «in play».",
            ]}
            visual={<RangeStoryVisual low={demo.low} high={demo.high} current={demo.current} denominator={demo.denominator} />}
          />
        </AcademySection>

        <AcademySection
          title="Оборот: денежный поток, а не просто количество лотов"
          text="Оборот в рублях показывает, сколько денег реально прошло через инструмент. Для сканирования активности это надёжнее raw-объёма: одинаковое число лотов может означать совершенно разный масштаб участия."
        >
          <StickyVisualSection
            title="Почему raw-объём часто вводит в заблуждение"
            text="Сравнение «объём к объёму» между дешёвыми и дорогими бумагами искажает картину. Для trader-first фильтрации сначала смотрите оборот, затем сделки и диапазон."
            notes={[
              "Высокий оборот = выше вероятность нормального исполнения.",
              "Высокий raw-объём без денег = часто шум, а не рабочий поток.",
            ]}
            visual={<TurnoverContrastVisual sameVolumeLots={demo.sameVolumeLots} cheapPrice={demo.cheapPrice} expensivePrice={demo.expensivePrice} />}
          />
        </AcademySection>

        <AcademySection
          title="Практическая интерпретация для intraday"
          text="Читать метрики нужно в связке. Ниже три рабочих паттерна для быстрого решения в скринере."
        >
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { title: "Высокий диапазон + высокий оборот", text: "Чаще всего рабочий инструмент «в игре». Приоритет для наблюдения и сценарного входа." },
              { title: "Высокий оборот + низкий диапазон", text: "День с плотной ликвидностью, но без расширения. Часто подходит для более аккуратной тактики." },
              { title: "Высокий диапазон + низкий оборот", text: "Движение может быть тонким и нестабильным. Риск проскальзывания и ложных импульсов выше." },
            ].map((item) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
              >
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">Сигнал</p>
                <p className="mt-1 font-medium text-slate-100">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </AcademySection>

        <AcademyTakeaway
          title="Быстрые якоря"
          items={[
            { term: "Диапазон %", value: "Показывает ширину внутридневного движения в единой сопоставимой шкале." },
            { term: "Оборот", value: "Показывает реальный масштаб денег в инструменте. Для сканирования важнее raw-объёма." },
            { term: "In Play", value: "Чаще возникает там, где одновременно расширяются диапазон и денежная активность." },
            { term: "Дисциплина", value: "Сначала фильтр по метрикам, затем сценарий сделки. Не наоборот." },
          ]}
        />
      </article>
    </AcademyEditorialLayout>
  );
}

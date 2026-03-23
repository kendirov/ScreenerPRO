"use client";

import * as React from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { tradingFormat } from "@/lib/formatters/trading";

export function RangeStoryVisual({
  low,
  high,
  current,
  denominator,
}: {
  low: number;
  high: number;
  current: number;
  denominator: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const progress = useSpring(useTransform(scrollYProgress, [0, 1], [0.2, 0.92]), { stiffness: 120, damping: 24 });

  const rangePct = ((high - low) / denominator) * 100;

  return (
    <div ref={ref} className="space-y-4 p-5">
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Интуитивная формула</p>
        <p className="mt-2 font-mono text-sm text-slate-300">(Максимум дня - Минимум дня) / Стабильный ориентир * 100</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
          <span>Минимум {tradingFormat.formatDynamicPrice(low)}</span>
          <span>Максимум {tradingFormat.formatDynamicPrice(high)}</span>
        </div>
        <div className="relative h-3 rounded-full bg-slate-800">
          <motion.div className="absolute top-0 h-full rounded-full bg-gradient-to-r from-cyan-500/80 to-emerald-400/70" style={{ width: useTransform(progress, (v) => `${v * 100}%`) }} />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Текущая: {tradingFormat.formatDynamicPrice(current)}</span>
          <span>Диапазон: {tradingFormat.formatSignedPercent(rangePct)}</span>
        </div>
      </div>
    </div>
  );
}

export function TurnoverContrastVisual({
  sameVolumeLots,
  cheapPrice,
  expensivePrice,
}: {
  sameVolumeLots: number;
  cheapPrice: number;
  expensivePrice: number;
}) {
  const cheapTurnover = sameVolumeLots * cheapPrice;
  const expensiveTurnover = sameVolumeLots * expensivePrice;
  const ratio = expensiveTurnover / cheapTurnover;

  return (
    <div className="space-y-4 p-5">
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Одинаковый raw-объём</p>
        <p className="mt-1 text-sm text-slate-300">{tradingFormat.formatInteger(sameVolumeLots)} лотов в обеих бумагах</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Card title="Дешевая бумага" price={cheapPrice} turnover={cheapTurnover} width="38%" />
        <Card title="Дорогая бумага" price={expensivePrice} turnover={expensiveTurnover} width="92%" />
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
        При одинаковом объёме денежная активность отличается в {tradingFormat.formatDynamicPrice(ratio)} раза.
      </div>
    </div>
  );
}

function Card({ title, price, turnover, width }: { title: string; price: number; turnover: number; width: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-1 text-sm text-slate-300">Цена: {tradingFormat.formatDynamicPrice(price)} ₽</p>
      <p className="mt-1 text-sm text-slate-300">Оборот: {tradingFormat.formatTurnoverRub(turnover)}</p>
      <div className="mt-2 h-2 rounded-full bg-slate-800">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="h-full rounded-full bg-cyan-400/75"
        />
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import * as React from "react";
import type { ScreenerRow } from "@screenerpro/shared";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { tradingFormat } from "@/lib/formatters/trading";

function Card({
  title,
  eyebrow,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-white/6 bg-[linear-gradient(180deg,rgba(2,6,23,0.82),rgba(2,6,23,0.68))] p-3 shadow-[0_18px_40px_rgba(2,6,23,0.32)] backdrop-blur-xl ${className}`}
    >
      <div className="mb-3">
        {eyebrow ? <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p> : null}
        <h3 className="mt-1 text-sm font-semibold tracking-wide text-slate-100">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function StatChip({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "emerald" | "cyan" | "amber" }) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-300/15 bg-emerald-400/8 text-emerald-100"
      : tone === "cyan"
        ? "border-cyan-300/15 bg-cyan-400/8 text-cyan-100"
        : tone === "amber"
          ? "border-amber-300/15 bg-amber-400/8 text-amber-100"
          : "border-white/8 bg-white/[0.03] text-slate-100";

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-sm tabular-nums">{value}</div>
    </div>
  );
}

function FocusRow({
  row,
  subtitle,
  href,
  metricLabel,
  metricValue,
}: {
  row: ScreenerRow;
  subtitle: string;
  href: string;
  metricLabel: string;
  metricValue: string;
}) {
  const change = row.percentChange ?? 0;
  const changeClass = change > 0 ? "text-emerald-300" : change < 0 ? "text-rose-300" : "text-slate-300";

  return (
    <Link
      href={href}
      className="group flex items-start justify-between gap-3 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5 transition hover:border-cyan-300/20 hover:bg-cyan-400/[0.06]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-[0.04em] text-slate-100">{row.ticker}</span>
          {(row.metrics.inPlayTags ?? []).includes("IN_PLAY") ? (
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-emerald-100">
              IN PLAY
            </span>
          ) : null}
        </div>
        <p className="truncate text-[11px] text-slate-400">{subtitle}</p>
      </div>
      <div className="shrink-0 text-right">
        <div className={`font-mono text-sm tabular-nums ${changeClass}`}>{tradingFormat.formatSignedPercent(row.percentChange)}</div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
          {metricLabel}: <span className="text-slate-300">{metricValue}</span>
        </div>
      </div>
    </Link>
  );
}

function emptyOrNumber(value: number | null | undefined, formatter: (input: number | null) => string) {
  return formatter(value ?? null);
}

function getSessionMode(stocks: ScreenerRow[], futures: ScreenerRow[]) {
  const inPlayCount = stocks.filter((row) => (row.metrics.inPlayTags ?? []).includes("IN_PLAY")).length;
  const strongStocks = stocks.filter((row) => (row.metrics.inPlayScore ?? 0) >= 80).length;
  const futureRangeLeader = Math.max(...futures.map((row) => row.metrics.dayRangePct ?? 0), 0);

  if (strongStocks >= 5 || futureRangeLeader >= 4) {
    return {
      title: "Рынок горячий",
      text: "Есть выраженные лидеры и достаточная амплитуда для активного поиска входов.",
      tone: "emerald" as const,
    };
  }
  if (inPlayCount >= 2) {
    return {
      title: "Выборочный фокус",
      text: "Идеи есть, но рынок лучше читать точечно через лидеров оборота и in-play бумаги.",
      tone: "cyan" as const,
    };
  }
  return {
    title: "Спокойный режим",
    text: "Шума больше, чем направленного движения. Лучше опираться на ликвидность и подтверждение импульса.",
    tone: "amber" as const,
  };
}

export function ScreenerHomePage() {
  const stocksQuery = useScreenerQuery("stock");
  const futuresQuery = useScreenerQuery("future");
  const stocks = React.useMemo(() => stocksQuery.data?.rows ?? [], [stocksQuery.data?.rows]);
  const futures = React.useMemo(() => futuresQuery.data?.rows ?? [], [futuresQuery.data?.rows]);

  const marketMode = React.useMemo(() => getSessionMode(stocks, futures), [stocks, futures]);

  const topInPlayStocks = React.useMemo(
    () =>
      [...stocks]
        .filter((row) => (row.metrics.inPlayTags ?? []).includes("IN_PLAY"))
        .sort((a, b) => (b.metrics.inPlayScore ?? 0) - (a.metrics.inPlayScore ?? 0))
        .slice(0, 6),
    [stocks],
  );

  const turnoverLeaders = React.useMemo(() => [...stocks].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0)).slice(0, 6), [stocks]);

  const trendLeaders = React.useMemo(
    () =>
      [...stocks]
        .filter((row) => Math.abs(row.percentChange ?? 0) >= 1)
        .sort((a, b) => Math.abs(b.percentChange ?? 0) - Math.abs(a.percentChange ?? 0))
        .slice(0, 6),
    [stocks],
  );

  const activeFutures = React.useMemo(
    () =>
      [...futures]
        .sort((a, b) => {
          const turnoverDiff = (b.turnover ?? 0) - (a.turnover ?? 0);
          if (turnoverDiff !== 0) return turnoverDiff;
          return Math.abs(b.percentChange ?? 0) - Math.abs(a.percentChange ?? 0);
        })
        .slice(0, 5),
    [futures],
  );

  const stockTurnoverSum = React.useMemo(() => stocks.reduce((sum, row) => sum + (row.turnover ?? 0), 0), [stocks]);
  const futuresTurnoverSum = React.useMemo(() => futures.reduce((sum, row) => sum + (row.turnover ?? 0), 0), [futures]);
  const avgRangeStocks = React.useMemo(() => {
    const withRange = stocks.map((row) => row.metrics.dayRangePct).filter((value): value is number => value !== null && value !== undefined);
    if (!withRange.length) return null;
    return withRange.reduce((sum, value) => sum + value, 0) / withRange.length;
  }, [stocks]);
  const updateTime = stocksQuery.data?.status.fetchTimestamp ?? futuresQuery.data?.status.fetchTimestamp ?? null;

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-3xl border border-white/7 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_24%),linear-gradient(135deg,rgba(2,6,23,0.95),rgba(15,23,42,0.88)_45%,rgba(2,6,23,0.94))] p-4 shadow-[0_24px_64px_rgba(2,6,23,0.44)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-200/65">Screener Overview</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Главный экран для отбора идей в торговый день</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Обзор больше не про “цифры ради цифр”. Он должен за несколько секунд показать режим рынка, лидеров внимания и куда идти
              дальше: в акции, фьючерсы, материалы или детальный разбор конкретной бумаги.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <StatChip label="Режим" value={marketMode.title} tone={marketMode.tone} />
            <StatChip label="Акции в игре" value={String(topInPlayStocks.length)} tone="emerald" />
            <StatChip label="Оборот акций" value={tradingFormat.formatTurnoverRub(stockTurnoverSum)} tone="cyan" />
            <StatChip label="Обновлено" value={updateTime ? new Date(updateTime).toLocaleTimeString("ru-RU") : "—"} />
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-sm text-slate-300">
          <span className="font-semibold text-slate-100">{marketMode.title}.</span> {marketMode.text}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
        <Card title="Фокус-лист трейдера" eyebrow="Watch First">
          <div className="space-y-2">
            {topInPlayStocks.length ? (
              topInPlayStocks.map((row) => (
                <FocusRow
                  key={`inplay-${row.ticker}`}
                  row={row}
                  subtitle={row.metrics.reasonLabel || row.shortName}
                  href={`/stocks/${row.ticker}`}
                  metricLabel="score"
                  metricValue={emptyOrNumber(row.metrics.inPlayScore, (value) =>
                    value === null ? "—" : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value),
                  )}
                />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-sm text-slate-500">
                Пока нет выраженных бумаг “в игре”. На спокойной сессии главный приоритет лучше отдавать ликвидным лидерам и относительной силе.
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/screener/stocks" className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-50 hover:bg-cyan-400/15">
              Открыть скринер акций
            </Link>
            <Link href="/materials/screener" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.07]">
              Как читать сигналы
            </Link>
          </div>
        </Card>

        <Card title="Панель дня" eyebrow="Market State">
          <div className="grid gap-2 sm:grid-cols-2">
            <StatChip label="Всего акций" value={String(stocks.length)} />
            <StatChip label="Всего фьючерсов" value={String(futures.length)} />
            <StatChip label="Средний range" value={emptyOrNumber(avgRangeStocks, tradingFormat.formatSignedPercent)} />
            <StatChip label="Оборот фьючерсов" value={tradingFormat.formatTurnoverRub(futuresTurnoverSum)} />
          </div>
          <div className="mt-3 space-y-2">
            <div className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Что смотреть первым</div>
              <div className="mt-1 text-sm text-slate-200">
                1) in-play бумаги, 2) лидеры оборота, 3) бумаги с сильнейшим отклонением от нормы.
              </div>
            </div>
            <div className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Что отсеивать</div>
              <div className="mt-1 text-sm text-slate-200">
                Бумаги без оборота, без подтверждения по активности и без понятной причины движения.
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card title="Лидеры по обороту" eyebrow="Money Flow">
          <div className="space-y-2">
            {turnoverLeaders.map((row) => (
              <FocusRow
                key={`turnover-${row.ticker}`}
                row={row}
                subtitle={row.shortName}
                href={`/stocks/${row.ticker}`}
                metricLabel="оборот"
                metricValue={tradingFormat.formatTurnoverRub(row.turnover)}
              />
            ))}
          </div>
        </Card>

        <Card title="Сильнейшее движение" eyebrow="Momentum">
          <div className="space-y-2">
            {trendLeaders.map((row) => (
              <FocusRow
                key={`trend-${row.ticker}`}
                row={row}
                subtitle={row.shortName}
                href={`/stocks/${row.ticker}`}
                metricLabel="range"
                metricValue={emptyOrNumber(row.metrics.dayRangePct, tradingFormat.formatSignedPercent)}
              />
            ))}
          </div>
        </Card>

        <Card title="Активные фьючерсы" eyebrow="Futures Tape">
          <div className="space-y-2">
            {activeFutures.map((row) => (
              <FocusRow
                key={`future-${row.ticker}`}
                row={row}
                subtitle={row.shortName}
                href={`/futures/${row.ticker}`}
                metricLabel="амплитуда"
                metricValue={emptyOrNumber(row.metrics.dayRangePct, tradingFormat.formatSignedPercent)}
              />
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card title="Почему бумага в игре" eyebrow="Playbook">
          <div className="space-y-2 text-sm text-slate-300">
            <p>Система поднимает бумагу наверх, когда движение подтверждено не одной ценой, а сразу несколькими факторами.</p>
            <ul className="space-y-1.5 text-[13px] text-slate-400">
              <li>Оборот заметно выше обычного.</li>
              <li>Диапазон дня шире нормы.</li>
              <li>Есть повторяемая активность, а не разовый всплеск.</li>
              <li>Есть понятная причина или рабочий контекст для трейдера.</li>
            </ul>
          </div>
        </Card>

        <Card title="Интерактивное обучение" eyebrow="Materials">
          <div className="space-y-2 text-sm text-slate-300">
            <p>Этот блок дальше можно развить в объяснение каждой метрики прямо в интерфейсе: что значит сигнал, как его читать и когда он бесполезен.</p>
            <Link href="/materials" className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 hover:bg-white/[0.07]">
              Открыть материалы
            </Link>
          </div>
        </Card>

        <Card title="Куда развивать дальше" eyebrow="Next Step">
          <div className="space-y-2 text-sm text-slate-300">
            <p>Следующий сильный шаг для главной: добавить реальные пресеты трейдера, объяснение причины попадания и фильтр по режимам сессии.</p>
            <div className="text-[13px] text-slate-400">
              Основа уже заложена: здесь можно собирать opening drive, in play, relative strength и news catalyst в один рабочий центр.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

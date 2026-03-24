import { MaterialsPageShell } from "@/components/materials/materials-page-shell";
import { STOCK_ACTIVITY_THRESHOLDS } from "@/lib/server/domain/stock-activity";

function formatRub(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function ScreenerMaterialsPage() {
  const updatedAt = new Date().toLocaleTimeString("ru-RU");
  const activeTradesFloor = STOCK_ACTIVITY_THRESHOLDS.minTradesFloor;
  const partialTradesFloor = Math.max(1, Math.floor(STOCK_ACTIVITY_THRESHOLDS.minTradesFloor * 0.2));

  return (
    <MaterialsPageShell
      title="Скринер"
      description="Карта логики рабочего фильтра активности: как скринер отделяет текущий поток торгового интереса от статичной «ликвидности»."
      freshness={`Обновлено ${updatedAt}`}
      sourceLabel="Логика Screener Core"
      sourceTone="ok"
    >
      <section className="overflow-hidden rounded-xl border border-slate-800/90 bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.12),transparent_45%),radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.12),transparent_45%),rgba(15,23,42,0.62)] p-5">
        <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-300/90">Философия</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">Скринер оценивает текущую активность, а не постоянный ярлык «ликвидности».</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
          Для интрадей-решений важнее, что происходит сейчас относительно вчерашней полной сессии. Поэтому модель показывает, где поток уже активен, где только появляется, и где в ленте пока пусто.
        </p>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-800/90 bg-slate-900/45 p-4 transition hover:border-cyan-500/40">
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Текущий оборот</p>
          <p className="mt-2 text-sm text-slate-200">Накопленный оборот в текущей сессии по инструменту.</p>
        </article>
        <article className="rounded-lg border border-slate-800/90 bg-slate-900/45 p-4 transition hover:border-cyan-500/40">
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Вчерашний оборот</p>
          <p className="mt-2 text-sm text-slate-200">Полный оборот за предыдущий завершенный торговый день.</p>
        </article>
        <article className="rounded-lg border border-slate-800/90 bg-slate-900/45 p-4 transition hover:border-cyan-500/40">
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Коэффициент активности</p>
          <p className="mt-2 text-sm text-slate-200">Сигнал темпа: насколько быстро сегодня набирается оборот относительно вчера.</p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-800/90 bg-slate-900/50 p-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300/90">Формула</p>
        <div className="mt-3 rounded-lg border border-slate-700/80 bg-slate-950/70 px-4 py-3 font-mono text-sm text-slate-100">
          activity_ratio = current_turnover_rub / previous_day_turnover_rub
        </div>
        <div className="mt-2 rounded-lg border border-slate-800/80 bg-slate-950/55 px-3 py-2 text-xs text-slate-300">
          expected_ratio_now = {STOCK_ACTIVITY_THRESHOLDS.activeRatioThreshold.toFixed(2)} x progress_сессии (минимум {Math.round(STOCK_ACTIVITY_THRESHOLDS.minProgressFactor * 100)}%)
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Если база вчерашнего дня отсутствует или равна 0, коэффициент не форсируется и остается неопределенным. Это защищает от ложных «активных» на пустых бумагах.
        </p>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-300">Активные</p>
          <p className="mt-2 text-sm text-slate-200">
            Уже достигнут рабочий темп: ratio не ниже ожидаемого порога на текущем этапе сессии и выполнен абсолютный минимум.
          </p>
          <p className="mt-2 text-xs text-slate-300">
            Порог: оборот от <span className="font-mono">{formatRub(STOCK_ACTIVITY_THRESHOLDS.minTurnoverFloorRub)}</span> руб или сделки от{" "}
            <span className="font-mono">{formatRub(activeTradesFloor)}</span>.
          </p>
        </article>
        <article className="rounded-lg border border-cyan-500/35 bg-cyan-500/10 p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-cyan-300">Есть активность</p>
          <p className="mt-2 text-sm text-slate-200">Инструмент еще не в полном режиме, но поток уже не пустой и наблюдение оправдано.</p>
          <p className="mt-2 text-xs text-slate-300">
            Нижний фильтр: оборот от <span className="font-mono">{formatRub(STOCK_ACTIVITY_THRESHOLDS.partialActivityFloorRub)}</span> руб или сделки от{" "}
            <span className="font-mono">{formatRub(partialTradesFloor)}</span>.
          </p>
        </article>
        <article className="rounded-lg border border-slate-700/80 bg-slate-900/45 p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Все</p>
          <p className="mt-2 text-sm text-slate-200">Полный доступ к доступной вселенной бумаг, включая слабую и раннюю активность.</p>
          <p className="mt-2 text-xs text-slate-400">Режим полезен для широкого обзора и поиска новых кандидатов.</p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-800/90 bg-slate-900/45 p-4">
        <h3 className="text-sm font-semibold tracking-wide text-slate-100">Почему отсекаются пустые инструменты</h3>
        <p className="mt-2 text-sm text-slate-300">
          Бумаги с почти нулевым оборотом и редкими сделками создают шум: большой спред, плохая исполнимость, ложные движения. Минимальные пороги по обороту и сделкам удерживают
          скринер в рабочей зоне, где сигнал реально исполняем.
        </p>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-800/90 bg-slate-900/45 p-4">
          <h3 className="text-sm font-semibold text-slate-100">Практика в течение дня</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-300">
            <li>Утро: начать с «Есть активность», чтобы поймать ранний разогрев.</li>
            <li>После открытия потока: переключиться на «Активные» для фокусного исполнения.</li>
            <li>Периодический обзор: «Все» для поиска новых имен и смены лидеров.</li>
          </ul>
        </article>
        <article className="rounded-lg border border-cyan-500/30 bg-slate-950/70 p-4">
          <h3 className="text-sm font-semibold text-cyan-200">Итог</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">
            Скринер теперь строится вокруг торговой активности в текущей сессии, а не статичной «ликвидности». Это дает более точный список инструментов для интрадей-действий.
          </p>
        </article>
      </section>
    </MaterialsPageShell>
  );
}

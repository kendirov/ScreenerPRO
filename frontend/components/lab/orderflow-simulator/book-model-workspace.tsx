"use client";

import * as React from "react";
import { BookModelClusters } from "@/components/lab/orderflow-simulator/book-model-clusters";
import { BookModelScenarioBar } from "@/components/lab/orderflow-simulator/book-model-scenario-bar";
import {
  BOOK_MODEL_TOTAL_HEIGHT_PX,
  type BookModelDepthScale,
  type BookModelSnapshot,
  SimpleOrderBookModel,
} from "@/components/lab/orderflow-simulator/simple-order-book-model";
import {
  nextTapeTradeId,
  SimpleTapeFlow,
  type TapeFlowTrade,
} from "@/components/lab/orderflow-simulator/simple-tape-flow";
import {
  addClusterVolume,
  BOOK_MODEL_SCENARIO_MAP,
  BOOK_MODEL_SCENARIOS,
  buildBookSnapshotForScenario,
  hitIcebergLevel,
  icebergBidPrice,
  initClustersForSnapshot,
  reduceBestAsk,
  reduceBestBid,
  restoreIcebergVisible,
  type BookModelClusterCell,
  type BookModelScenarioId,
} from "@/lib/domain/book-model-scenarios";
import { cn } from "@/lib/utils/cn";

const TOTAL_BOOK_HEIGHT = BOOK_MODEL_TOTAL_HEIGHT_PX;
const ROW_HEIGHT_PX = 18;
const SPREAD_ROW_PX = 22;
const FLASH_MS = 700;

type BookFlash = "ask" | "bid" | null;

const DEPTH_SCALES: BookModelDepthScale[] = [10_000, 20_000, 50_000];

const WHAT_SHOWN_ITEMS = [
  "Стакан — заявки, которые ещё ждут исполнения.",
  "Лента — сделки, которые уже прошли.",
  "Кластера — где накопился проторгованный объём.",
  "Ask сверху, bid снизу, между ними spread.",
];

function priceToRowTop(price: number, snapshot: BookModelSnapshot): number {
  const { asks, bids, tickSize } = snapshot;
  const askIndex = asks.findIndex((l) => Math.abs(l.price - price) < tickSize / 2);
  if (askIndex >= 0) return askIndex * ROW_HEIGHT_PX + ROW_HEIGHT_PX / 2;
  const bidIndex = bids.findIndex((l) => Math.abs(l.price - price) < tickSize / 2);
  if (bidIndex >= 0) {
    return asks.length * ROW_HEIGHT_PX + SPREAD_ROW_PX + bidIndex * ROW_HEIGHT_PX + ROW_HEIGHT_PX / 2;
  }
  return TOTAL_BOOK_HEIGHT / 2;
}

function BookModelLegend({
  snapshot,
  presentation,
}: {
  snapshot: BookModelSnapshot;
  presentation: boolean;
}) {
  const items = [
    {
      key: "ask",
      label: "Ask — продажа",
      top: priceToRowTop(snapshot.bestAsk, snapshot),
      color: "text-rose-300",
    },
    {
      key: "spread",
      label: "Spread",
      top: snapshot.asks.length * ROW_HEIGHT_PX + SPREAD_ROW_PX / 2,
      color: "text-sky-300",
    },
    {
      key: "bid",
      label: "Bid — покупка",
      top: priceToRowTop(snapshot.bestBid, snapshot),
      color: "text-emerald-300",
    },
  ];

  return (
    <aside
      className={cn(
        "book-model-legend relative shrink-0 pl-2",
        presentation ? "w-[min(200px,22vw)]" : "hidden w-[min(200px,22vw)] xl:block",
      )}
    >
      <div className="relative" style={{ height: TOTAL_BOOK_HEIGHT }}>
        {items.map((item) => (
          <div
            key={item.key}
            className="absolute left-0 flex items-center gap-2"
            style={{ top: item.top, transform: "translateY(-50%)" }}
          >
            <span className={cn("font-mono font-medium", presentation ? "text-[12px]" : "text-[10px]", item.color)}>
              ← {item.label}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function BookModelWhatShown({ presentation }: { presentation: boolean }) {
  return (
    <details
      className={cn(
        "book-model-what-shown rounded-lg border border-white/[0.06] bg-[#030508]",
        presentation && "book-model-what-shown--presentation",
      )}
    >
      <summary
        className={cn(
          "cursor-pointer px-3 py-2 font-mono text-slate-400",
          presentation ? "text-[12px]" : "text-[10px]",
        )}
      >
        Что здесь показано
      </summary>
      <ul
        className={cn(
          "list-inside list-disc space-y-1.5 border-t border-white/[0.05] px-4 py-2.5 text-slate-400",
          presentation ? "text-[13px] leading-relaxed" : "text-[11px] leading-relaxed",
        )}
      >
        {WHAT_SHOWN_ITEMS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  );
}

type ToolbarBtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "default" | "buy" | "sell" | "accent" | "ghost";
  large?: boolean;
};

function ToolbarBtn({ tone = "default", large, className, ...props }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      className={cn(
        "rounded border font-mono transition disabled:opacity-50",
        large ? "px-3 py-1 text-[12px]" : "px-2 py-0.5 text-[10px]",
        tone === "buy" && "border-emerald-500/40 bg-emerald-950/60 text-emerald-100 hover:bg-emerald-900/70",
        tone === "sell" && "border-rose-500/40 bg-rose-950/60 text-rose-100 hover:bg-rose-900/70",
        tone === "accent" && "border-violet-500/45 bg-violet-950/60 text-violet-100",
        tone === "ghost" && "border-white/[0.08] text-slate-500 hover:text-slate-200",
        tone === "default" && "border-white/[0.08] bg-[#0a0c10] text-slate-300 hover:bg-[#12151c]",
        className,
      )}
      {...props}
    />
  );
}

export function BookModelWorkspace() {
  const [scenarioId, setScenarioId] = React.useState<BookModelScenarioId>("normal");
  const [snapshot, setSnapshot] = React.useState<BookModelSnapshot>(() =>
    buildBookSnapshotForScenario("tutorial", "normal"),
  );
  const [clusters, setClusters] = React.useState<BookModelClusterCell[]>(() =>
    initClustersForSnapshot(buildBookSnapshotForScenario("tutorial", "normal")),
  );
  const [trades, setTrades] = React.useState<TapeFlowTrade[]>([]);
  const [manualCaption, setManualCaption] = React.useState<string | null>(null);
  const [bookFlash, setBookFlash] = React.useState<BookFlash>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [presentation, setPresentation] = React.useState(false);
  const [depthScale, setDepthScale] = React.useState<BookModelDepthScale>(20_000);

  const flashTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const sceneStepRef = React.useRef(0);
  const baseSnapshotRef = React.useRef(snapshot);

  const scenario = BOOK_MODEL_SCENARIO_MAP[scenarioId];
  const highlightSpread = scenarioId === "spread";

  const stopScene = React.useCallback(() => {
    if (sceneIntervalRef.current) {
      clearInterval(sceneIntervalRef.current);
      sceneIntervalRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const resetSceneState = React.useCallback((nextScenario: BookModelScenarioId) => {
    const nextSnapshot = buildBookSnapshotForScenario("tutorial", nextScenario);
    baseSnapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
    setClusters(initClustersForSnapshot(nextSnapshot));
    setTrades([]);
    setManualCaption(null);
    setBookFlash(null);
    sceneStepRef.current = 0;
    stopScene();
  }, [stopScene]);

  React.useEffect(() => {
    resetSceneState(scenarioId);
  }, [scenarioId, resetSceneState]);

  React.useEffect(
    () => () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      if (sceneIntervalRef.current) clearInterval(sceneIntervalRef.current);
    },
    [],
  );

  const flashBook = React.useCallback((side: BookFlash) => {
    setBookFlash(side);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => setBookFlash(null), FLASH_MS);
  }, []);

  const pushMarketBuy = React.useCallback(() => {
    const trade: TapeFlowTrade = {
      id: nextTapeTradeId(),
      side: "buy",
      size: 50,
      hitZone: "best-ask",
      createdAt: Date.now(),
    };
    setTrades((prev) => [...prev, trade].slice(-24));
    setManualCaption("Рыночная покупка забрала ask-заявку.");
    setSnapshot((s) => {
      setClusters((c) => addClusterVolume(c, s.bestAsk, "buy", 50, s.tickSize));
      return reduceBestAsk(s, 50);
    });
    flashBook("ask");
  }, [flashBook]);

  const pushMarketSell = React.useCallback(() => {
    const trade: TapeFlowTrade = {
      id: nextTapeTradeId(),
      side: "sell",
      size: 50,
      hitZone: "best-bid",
      createdAt: Date.now(),
    };
    setTrades((prev) => [...prev, trade].slice(-24));
    setManualCaption("Рыночная продажа ударила в bid.");
    setSnapshot((s) => {
      setClusters((c) => addClusterVolume(c, s.bestBid, "sell", 50, s.tickSize));
      return reduceBestBid(s, 50);
    });
    flashBook("bid");
  }, [flashBook]);

  const clearTape = React.useCallback(() => {
    setTrades([]);
    setManualCaption(null);
    setBookFlash(null);
    stopScene();
  }, [stopScene]);

  const removeExpiredTrade = React.useCallback((id: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const runMarketBuyStep = React.useCallback(
    (base: BookModelSnapshot, tradeSize = 50) => {
      const trade: TapeFlowTrade = {
        id: nextTapeTradeId(),
        side: "buy",
        size: tradeSize,
        hitZone: "best-ask",
        createdAt: Date.now(),
      };
      setTrades((prev) => [...prev, trade]);
      setSnapshot((s) => reduceBestAsk(s, tradeSize));
      setClusters((c) => addClusterVolume(c, base.bestAsk, "buy", tradeSize, base.tickSize));
      flashBook("ask");
    },
    [flashBook],
  );

  const runMarketSellStep = React.useCallback(
    (base: BookModelSnapshot, tradeSize = 50) => {
      const trade: TapeFlowTrade = {
        id: nextTapeTradeId(),
        side: "sell",
        size: tradeSize,
        hitZone: "best-bid",
        createdAt: Date.now(),
      };
      setTrades((prev) => [...prev, trade]);
      setSnapshot((s) => reduceBestBid(s, tradeSize));
      setClusters((c) => addClusterVolume(c, base.bestBid, "sell", tradeSize, base.tickSize));
      flashBook("bid");
    },
    [flashBook],
  );

  const runIcebergStep = React.useCallback(
    (base: BookModelSnapshot) => {
      const icePrice = icebergBidPrice(base);
      const hitSize = 2_000;
      const trade: TapeFlowTrade = {
        id: nextTapeTradeId(),
        side: "sell",
        size: hitSize,
        hitZone: "bid-area",
        createdAt: Date.now(),
      };
      setTrades((prev) => [...prev, trade]);
      setSnapshot((s) => restoreIcebergVisible(hitIcebergLevel(s, hitSize)));
      setClusters((c) => addClusterVolume(c, icePrice, "sell", hitSize, base.tickSize));
      flashBook("bid");
    },
    [flashBook],
  );

  const runSceneStep = React.useCallback(() => {
    const base = baseSnapshotRef.current;

    if (scenarioId === "market-buy") {
      runMarketBuyStep(base);
      sceneStepRef.current += 1;
      if (sceneStepRef.current >= 4) sceneStepRef.current = 0;
      return;
    }
    if (scenarioId === "market-sell") {
      runMarketSellStep(base);
      sceneStepRef.current += 1;
      return;
    }
    if (scenarioId === "iceberg") {
      runIcebergStep(base);
      sceneStepRef.current += 1;
      if (sceneStepRef.current >= 5) {
        setSnapshot((s) => restoreIcebergVisible(s));
        sceneStepRef.current = 0;
      }
    }
  }, [runIcebergStep, runMarketBuyStep, runMarketSellStep, scenarioId]);

  const playScene = React.useCallback(() => {
    if (!scenario.animated || isPlaying) return;
    if (sceneIntervalRef.current) clearInterval(sceneIntervalRef.current);

    const base = buildBookSnapshotForScenario("tutorial", scenarioId);
    baseSnapshotRef.current = base;
    setSnapshot(base);
    setClusters(initClustersForSnapshot(base));
    setTrades([]);
    setManualCaption(null);
    sceneStepRef.current = 0;
    setIsPlaying(true);

    const intervalMs = scenarioId === "iceberg" ? 850 : 750;
    const maxSteps = scenarioId === "iceberg" ? 5 : 4;

    sceneIntervalRef.current = setInterval(() => {
      if (sceneStepRef.current >= maxSteps) {
        if (scenarioId === "iceberg") {
          setSnapshot((s) => restoreIcebergVisible(s));
        }
        stopScene();
        return;
      }
      runSceneStep();
    }, intervalMs);
  }, [isPlaying, runSceneStep, scenario.animated, scenarioId, stopScene]);

  const togglePlayPause = React.useCallback(() => {
    if (isPlaying) stopScene();
    else if (scenario.animated) playScene();
  }, [isPlaying, playScene, scenario.animated, stopScene]);

  return (
    <div
      className={cn(
        "book-model-workspace rounded-xl border border-white/[0.05] bg-[#010204] p-3 sm:p-4",
        presentation && "book-model-workspace--presentation",
      )}
    >
      <header className="mb-3 space-y-2">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300/90">
          Учебная симуляция · не реальные котировки MOEX
        </p>
        <h2
          className={cn(
            "text-center font-semibold tracking-tight text-slate-100",
            presentation ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl",
          )}
        >
          Биржевой стакан
        </h2>

        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.06] bg-[#030508] p-2",
            presentation && "gap-2.5 p-3",
          )}
        >
          <label className="flex min-w-[140px] flex-1 items-center gap-2 font-mono text-[10px] text-slate-500">
            Сценарий
            <select
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value as BookModelScenarioId)}
              className={cn(
                "min-w-0 flex-1 rounded border border-white/[0.08] bg-[#0a0c10] px-2 py-1 text-slate-200",
                presentation ? "text-[12px]" : "text-[10px]",
              )}
            >
              {BOOK_MODEL_SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-center gap-1.5">
            <ToolbarBtn
              large={presentation}
              tone="accent"
              disabled={!scenario.animated}
              onClick={togglePlayPause}
            >
              {isPlaying ? "Пауза" : "Пуск"}
            </ToolbarBtn>
            <ToolbarBtn
              large={presentation}
              disabled={!scenario.animated}
              onClick={runSceneStep}
              title="Один шаг сцены"
            >
              Шаг
            </ToolbarBtn>
            <ToolbarBtn large={presentation} tone="buy" onClick={pushMarketBuy}>
              Рыночная покупка
            </ToolbarBtn>
            <ToolbarBtn large={presentation} tone="sell" onClick={pushMarketSell}>
              Рыночная продажа
            </ToolbarBtn>
            <ToolbarBtn large={presentation} tone="ghost" onClick={clearTape}>
              Очистить
            </ToolbarBtn>
          </div>

          <div className="flex flex-wrap items-center gap-1 border-l border-white/[0.06] pl-2">
            <span className="font-mono text-[9px] text-slate-600">Заливка</span>
            {DEPTH_SCALES.map((scale) => (
              <ToolbarBtn
                key={scale}
                large={presentation}
                tone={depthScale === scale ? "accent" : "default"}
                onClick={() => setDepthScale(scale)}
              >
                {scale / 1000}K
              </ToolbarBtn>
            ))}
          </div>

          <ToolbarBtn
            large={presentation}
            tone={presentation ? "accent" : "ghost"}
            className="ml-auto"
            onClick={() => setPresentation((p) => !p)}
          >
            {presentation ? "Обычный вид" : "Презентационный вид"}
          </ToolbarBtn>
        </div>
      </header>

      <BookModelWhatShown presentation={presentation} />

      <BookModelScenarioBar
        scenarioId={scenarioId}
        caption={manualCaption}
        presentation={presentation}
      />

      <div className="book-model-diagram mt-4 flex min-h-0 justify-center gap-2 overflow-x-auto rounded-lg border border-white/[0.06] bg-[#020408] px-2 py-3">
        <BookModelClusters
          cells={clusters}
          snapshot={snapshot}
          height={TOTAL_BOOK_HEIGHT}
          presentation={presentation}
        />
        <SimpleTapeFlow
          trades={trades}
          isPlaying={isPlaying}
          speed={1}
          selectedScenario={scenarioId}
          height={TOTAL_BOOK_HEIGHT}
          presentation={presentation}
          onTradeExpired={removeExpiredTrade}
        />
        <div className="book-model-book shrink-0">
          <SimpleOrderBookModel
            snapshot={snapshot}
            highlightBestAsk={bookFlash === "ask"}
            highlightBestBid={bookFlash === "bid"}
            highlightSpread={highlightSpread}
            depthScale={depthScale}
            presentation={presentation}
          />
        </div>
        <BookModelLegend snapshot={snapshot} presentation={presentation} />
      </div>

      {presentation ? (
        <p className="mt-3 text-center font-mono text-[11px] text-slate-500">
          Зелёный круг — покупка · Красный — продажа · Время: справа → налево
        </p>
      ) : null}
    </div>
  );
}

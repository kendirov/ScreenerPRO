"use client";

import { useEffect, useRef } from "react";
import { AreaSeries, ColorType, createChart } from "lightweight-charts";

export function PriceChartPlaceholder() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#020617" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      rightPriceScale: { borderColor: "#334155" },
      timeScale: { borderColor: "#334155" },
      height: 320,
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: "#22d3ee",
      topColor: "rgba(34, 211, 238, 0.35)",
      bottomColor: "rgba(34, 211, 238, 0.03)",
    });

    areaSeries.setData([
      { time: "2026-03-17", value: 305 },
      { time: "2026-03-18", value: 307.2 },
      { time: "2026-03-19", value: 303.7 },
      { time: "2026-03-20", value: 309.4 },
      { time: "2026-03-21", value: 311.3 },
      { time: "2026-03-22", value: 310.1 },
      { time: "2026-03-23", value: 312.8 },
    ]);

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    resizeObserver.observe(containerRef.current);

    chart.timeScale().fitContent();
    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  return <div ref={containerRef} className="w-full rounded-xl border border-slate-800" />;
}

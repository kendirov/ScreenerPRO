"use client";

import * as React from "react";

export function TradingViewChart({ symbol }: { symbol: string }) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = "";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget h-full w-full";
    host.appendChild(widget);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "15",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "ru",
      backgroundColor: "rgba(5, 10, 24, 1)",
      gridColor: "rgba(148, 163, 184, 0.06)",
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: true,
      calendar: false,
      details: false,
      hotlist: false,
      withdateranges: true,
      hide_volume: false,
    });
    host.appendChild(script);

    return () => {
      host.innerHTML = "";
    };
  }, [symbol]);

  return (
    <div className="h-[520px] min-h-[420px] overflow-hidden rounded-md border border-white/[0.08] bg-[#050a18]">
      <div ref={hostRef} className="tradingview-widget-container h-full w-full" />
    </div>
  );
}

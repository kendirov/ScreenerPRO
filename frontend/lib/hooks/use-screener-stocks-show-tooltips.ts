"use client";

import * as React from "react";

export const SCREENER_STOCKS_SHOW_TOOLTIPS_KEY = "screenerStocksShowTooltips";

function readShowTooltips(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(SCREENER_STOCKS_SHOW_TOOLTIPS_KEY);
  if (raw === null) return true;
  return raw === "true" || raw === "1";
}

export function useScreenerStocksShowTooltips() {
  const [showTooltips, setShowTooltipsState] = React.useState(true);

  React.useEffect(() => {
    setShowTooltipsState(readShowTooltips());
  }, []);

  const setShowTooltips = React.useCallback((value: boolean) => {
    setShowTooltipsState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SCREENER_STOCKS_SHOW_TOOLTIPS_KEY, value ? "true" : "false");
    }
  }, []);

  return { showTooltips, setShowTooltips };
}

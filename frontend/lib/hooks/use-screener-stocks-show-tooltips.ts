"use client";

import * as React from "react";

export const SCREENER_STOCKS_SHOW_TOOLTIPS_KEY = "screenerStocksShowTooltips";

const tooltipListeners = new Set<() => void>();

function readShowTooltips(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(SCREENER_STOCKS_SHOW_TOOLTIPS_KEY);
  if (raw === null) return true;
  return raw === "true" || raw === "1";
}

function subscribeToShowTooltips(onStoreChange: () => void) {
  tooltipListeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SCREENER_STOCKS_SHOW_TOOLTIPS_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    tooltipListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function persistShowTooltips(value: boolean) {
  try {
    window.localStorage.setItem(SCREENER_STOCKS_SHOW_TOOLTIPS_KEY, value ? "true" : "false");
  } catch {
    /* ignore */
  }
  tooltipListeners.forEach((listener) => listener());
}

export function useScreenerStocksShowTooltips() {
  const showTooltips = React.useSyncExternalStore(
    subscribeToShowTooltips,
    readShowTooltips,
    () => true,
  );

  const setShowTooltips = React.useCallback((value: boolean) => {
    persistShowTooltips(value);
  }, []);

  return { showTooltips, setShowTooltips };
}

"use client";

import * as React from "react";
import type { UiViewMode } from "@/lib/design/design-tokens";

const STORAGE_KEY = "screenerpro.ui.viewMode";

type UiViewModeContextValue = {
  mode: UiViewMode;
  setMode: (next: UiViewMode) => void;
};

const UiViewModeContext = React.createContext<UiViewModeContextValue | null>(null);

const listeners = new Set<() => void>();

function readStoredMode(): UiViewMode {
  if (typeof window === "undefined") return "normal";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "focus" || raw === "presentation" || raw === "normal") return raw;
  } catch {
    /* ignore */
  }
  return "normal";
}

function subscribeToViewMode(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getViewModeSnapshot(): UiViewMode {
  return readStoredMode();
}

function getViewModeServerSnapshot(): UiViewMode {
  return "normal";
}

function persistViewMode(next: UiViewMode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  document.documentElement.dataset.uiMode = next;
  listeners.forEach((listener) => listener());
}

export function UiViewModeProvider({ children }: { children: React.ReactNode }) {
  const mode = React.useSyncExternalStore(
    subscribeToViewMode,
    getViewModeSnapshot,
    getViewModeServerSnapshot,
  );

  React.useEffect(() => {
    document.documentElement.dataset.uiMode = mode;
  }, [mode]);

  const setMode = React.useCallback((next: UiViewMode) => {
    persistViewMode(next);
  }, []);

  const value = React.useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return <UiViewModeContext.Provider value={value}>{children}</UiViewModeContext.Provider>;
}

export function useUiViewMode() {
  const ctx = React.useContext(UiViewModeContext);
  if (!ctx) {
    throw new Error("useUiViewMode must be used within UiViewModeProvider");
  }
  return ctx;
}

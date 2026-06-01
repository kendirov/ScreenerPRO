"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  getPreviousTradingDayKey,
  isLiveTradingDate,
  isValidDateKey,
  moscowTodayKey,
  normalizeRequestedDateKey,
} from "@/lib/domain/trading-calendar";

export type TradingDateMode = "today" | "yesterday" | "pick";

export type SelectedTradingDateState = {
  /** Активная дата (YYYY-MM-DD). Для live «Сегодня» — ключ сегодняшнего дня. */
  selectedDateKey: string;
  isLive: boolean;
  mode: TradingDateMode;
  /** Для API: null = live snapshot (без date param), иначе исторический запрос. */
  apiDateParam: string | null;
  setToday: () => void;
  setYesterday: () => void;
  setPickedDate: (dateKey: string) => void;
};

function resolveMode(selectedDateKey: string, todayKey: string): TradingDateMode {
  if (selectedDateKey === todayKey) return "today";
  if (selectedDateKey === getPreviousTradingDayKey(todayKey)) return "yesterday";
  return "pick";
}

export function useSelectedTradingDate(): SelectedTradingDateState {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const todayKey = React.useMemo(() => moscowTodayKey(), []);

  const selectedDateKey = React.useMemo(() => {
    const fromUrl = normalizeRequestedDateKey(searchParams.get("date"));
    return fromUrl ?? todayKey;
  }, [searchParams, todayKey]);

  const isLive = isLiveTradingDate(selectedDateKey);
  const mode = resolveMode(selectedDateKey, todayKey);
  const apiDateParam = isLive ? null : selectedDateKey;

  const replaceDate = React.useCallback(
    (nextDateKey: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (!nextDateKey || nextDateKey === todayKey) {
        next.delete("date");
      } else {
        next.set("date", nextDateKey);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, todayKey],
  );

  const setToday = React.useCallback(() => replaceDate(null), [replaceDate]);

  const setYesterday = React.useCallback(() => {
    replaceDate(getPreviousTradingDayKey(todayKey));
  }, [replaceDate, todayKey]);

  const setPickedDate = React.useCallback(
    (dateKey: string) => {
      if (!isValidDateKey(dateKey)) return;
      if (dateKey > todayKey) return;
      if (dateKey === todayKey) {
        replaceDate(null);
        return;
      }
      replaceDate(dateKey);
    },
    [replaceDate, todayKey],
  );

  return {
    selectedDateKey,
    isLive,
    mode,
    apiDateParam,
    setToday,
    setYesterday,
    setPickedDate,
  };
}

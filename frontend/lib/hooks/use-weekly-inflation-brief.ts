"use client";

import * as React from "react";
import {
  getLatestInflationBrief,
  WEEKLY_INFLATION_STORAGE_KEY,
  WEEKLY_INFLATION_UPDATED_EVENT,
  type WeeklyInflationBrief,
} from "@/lib/domain/weekly-inflation-storage";

export function useWeeklyInflationBrief(): WeeklyInflationBrief {
  const [brief, setBrief] = React.useState<WeeklyInflationBrief>(() => getLatestInflationBrief());

  React.useEffect(() => {
    const refresh = () => setBrief(getLatestInflationBrief());

    const onStorage = (event: StorageEvent) => {
      if (event.key === WEEKLY_INFLATION_STORAGE_KEY || event.key === null) {
        refresh();
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(WEEKLY_INFLATION_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(WEEKLY_INFLATION_UPDATED_EVENT, refresh);
    };
  }, []);

  return brief;
}

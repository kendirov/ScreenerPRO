"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScreenerPanel } from "@/components/screener/screener-page-chrome";

export type StrategyLabBottomTabId = "summary" | "levels" | "touches" | "export";

export function StrategyLabBottomTabs({
  summary,
  levels,
  touches,
  exportPanel,
}: {
  summary: React.ReactNode;
  levels: React.ReactNode;
  touches: React.ReactNode;
  exportPanel: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="summary" className="w-full space-y-2">
      <TabsList className="h-9 border border-white/[0.06] bg-black/35 p-1">
        <TabsTrigger value="summary" className="font-mono text-[10px]">
          Сводка
        </TabsTrigger>
        <TabsTrigger value="levels" className="font-mono text-[10px]">
          Уровни
        </TabsTrigger>
        <TabsTrigger value="touches" className="font-mono text-[10px]">
          Касания
        </TabsTrigger>
        <TabsTrigger value="export" className="font-mono text-[10px]">
          Экспорт
        </TabsTrigger>
      </TabsList>

      <TabsContent value="summary">{summary}</TabsContent>
      <TabsContent value="levels">{levels}</TabsContent>
      <TabsContent value="touches">{touches}</TabsContent>
      <TabsContent value="export">
        <ScreenerPanel className="border-white/[0.08] bg-black/45">{exportPanel}</ScreenerPanel>
      </TabsContent>
    </Tabs>
  );
}

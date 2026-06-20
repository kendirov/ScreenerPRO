"use client";

import * as React from "react";
import { CbrCompactReactionMatrix } from "@/components/lab/cbr-rate-reaction/cbr-compact-reaction-matrix";
import {
  CbrDataIntegrityDetails,
  useCbrDataIntegrityView,
} from "@/components/lab/cbr-rate-reaction/cbr-data-integrity-strip";
import { CbrRateEventPlayersCompact } from "@/components/lab/cbr-rate-reaction/cbr-rate-event-players-compact";
import { CbrRateEventSelector } from "@/components/lab/cbr-rate-reaction/cbr-rate-event-selector";
import { CbrRateReactionSummary } from "@/components/lab/cbr-rate-reaction/cbr-rate-reaction-summary";
import { CbrRateUpcomingPlaceholder } from "@/components/lab/cbr-rate-reaction/cbr-rate-upcoming-placeholder";
import { CbrReplayAccordion } from "@/components/lab/cbr-rate-reaction/cbr-replay-accordion";
import { CbrRateReplayHeader } from "@/components/lab/cbr-rate-reaction/cbr-rate-replay-header";
import { CbrStatementTranslationPanel } from "@/components/lab/cbr-rate-reaction/cbr-statement-translation-panel";
import { CbrSynchronizedChartGrid } from "@/components/lab/cbr-rate-reaction/cbr-synchronized-chart-grid";
import { getCbrRateEvents, isUpcomingEvent, toDomainCbrRateEvent } from "@/lib/cbr";
import type { CbrReplayMarketMode } from "@/lib/cbr/cbr-replay-market-mode";
import {
  chartModelToReplaySeries,
  validateReplayConsistency,
} from "@/lib/cbr/cbr-replay-consistency";
import { resolveReplayMarketIntegrity } from "@/lib/cbr/cbr-replay-market-integrity";
import { getReplayDataQualityFromSlots } from "@/lib/cbr/cbr-replay-data-quality";
import type { CbrReactionChartGridModel } from "@/lib/domain/cbr-rate-chart-model";
import {
  buildCbrRateReactionSummary,
  buildReactionMatrixFromChartSlots,
} from "@/lib/domain/cbr-rate-reaction";

export function CbrRateReactionPage() {
  const allEvents = React.useMemo(() => getCbrRateEvents(), []);
  const [selectedId, setSelectedId] = React.useState(
    () => allEvents.find((e) => !isUpcomingEvent(e))?.id ?? allEvents[0]?.id ?? "",
  );
  const [chartModel, setChartModel] = React.useState<CbrReactionChartGridModel | null>(null);
  const [chartsLoading, setChartsLoading] = React.useState(true);
  const [replayMode, setReplayMode] = React.useState<CbrReplayMarketMode>("equities");

  const event = React.useMemo(
    () => allEvents.find((e) => e.id === selectedId) ?? allEvents[0],
    [allEvents, selectedId],
  );

  const domainEvent = React.useMemo(
    () => (event ? toDomainCbrRateEvent(event) : undefined),
    [event],
  );

  const isUpcoming = event ? isUpcomingEvent(event) : false;

  const marketIntegrity = React.useMemo(() => {
    if (isUpcoming || !chartModel || chartModel.eventId !== event?.id) return null;
    return resolveReplayMarketIntegrity(chartModel.slots, chartModel.replayMode);
  }, [chartModel, event?.id, isUpcoming]);

  const matrixRows = React.useMemo(() => {
    if (isUpcoming || !event || !chartModel || chartModel.eventId !== event.id) return [];
    return buildReactionMatrixFromChartSlots(chartModel.slots, event.date);
  }, [chartModel, event, isUpcoming]);

  const replayConsistency = React.useMemo(() => {
    if (isUpcoming || !event || !chartModel || chartModel.eventId !== event.id) return null;
    const series = chartModelToReplaySeries(chartModel, event.date);
    return validateReplayConsistency(event, series, matrixRows);
  }, [chartModel, event, isUpcoming, matrixRows]);

  const dataQuality = React.useMemo(() => {
    if (isUpcoming || !domainEvent || !chartModel || chartModel.eventId !== event?.id) return null;
    return getReplayDataQualityFromSlots(domainEvent, chartModel.slots, chartModel.replayMode);
  }, [chartModel, domainEvent, event?.id, isUpcoming]);

  const summary = React.useMemo(
    () =>
      domainEvent
        ? buildCbrRateReactionSummary(
            domainEvent,
            matrixRows,
            marketIntegrity,
            replayConsistency,
            dataQuality,
          )
        : null,
    [domainEvent, matrixRows, marketIntegrity, replayConsistency, dataQuality],
  );

  const integrityView = useCbrDataIntegrityView(
    event ?? allEvents[0],
    isUpcoming ? null : chartModel,
    isUpcoming ? false : chartsLoading,
  );

  const handleSelectEvent = React.useCallback((id: string) => {
    setSelectedId(id);
    setChartModel(null);
    const next = allEvents.find((e) => e.id === id);
    setChartsLoading(next ? !isUpcomingEvent(next) : false);
  }, [allEvents]);

  const handleReplayModeChange = React.useCallback((mode: CbrReplayMarketMode) => {
    setReplayMode(mode);
    setChartModel(null);
    setChartsLoading(!isUpcoming);
  }, [isUpcoming]);

  if (!event || !domainEvent || !summary) return null;

  return (
    <div className="cbr-rate-replay mx-auto max-w-[1400px] space-y-2 px-1 pb-8 pt-1 font-mono sm:px-2">
      <CbrRateReplayHeader
        event={domainEvent}
        canonicalEvent={event}
        chartModel={isUpcoming ? null : chartModel}
        loading={isUpcoming ? false : chartsLoading}
        dataQuality={dataQuality}
      />

      <CbrRateEventSelector events={allEvents} selectedId={selectedId} onSelect={handleSelectEvent} />

      {isUpcoming ? (
        <CbrRateUpcomingPlaceholder event={event} />
      ) : (
        <CbrSynchronizedChartGrid
          key={`${event.id}-${replayMode}`}
          event={domainEvent}
          replayMode={replayMode}
          dataQuality={dataQuality}
          onReplayModeChange={handleReplayModeChange}
          onModelChange={setChartModel}
          onLoadingChange={setChartsLoading}
        />
      )}

      {!isUpcoming ? (
        <section className="space-y-2">
          <CbrCompactReactionMatrix event={domainEvent} chartModel={chartModel} />
          <CbrRateReactionSummary summary={summary} />
        </section>
      ) : (
        <CbrRateReactionSummary summary={summary} />
      )}

      <div className="space-y-1.5 pt-1">
        <CbrReplayAccordion title="Текст ЦБ → трейдерский перевод">
          <CbrStatementTranslationPanel event={domainEvent} />
        </CbrReplayAccordion>

        <CbrReplayAccordion title="Инструменты в игре">
          <CbrRateEventPlayersCompact event={domainEvent} />
        </CbrReplayAccordion>

        <CbrReplayAccordion title="Методика и источники">
          <p className="text-[10px] leading-snug text-lab-dim">{integrityView.caption}</p>
          <CbrDataIntegrityDetails view={integrityView} />
        </CbrReplayAccordion>
      </div>
    </div>
  );
}

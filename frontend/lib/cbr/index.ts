export {
  buildEquitiesReplayInstruments,
  buildDerivativesReplayInstruments,
  buildDefaultCbrInstruments,
  buildReplayInstrumentsForMode,
} from "@/lib/cbr/cbr-instruments";

export {
  CBR_CURRENCY_INSTRUMENTS,
  CBR_CNY_RUB_CURRENCY,
  CBR_USD_RUB_CURRENCY,
  formatCurrencyInstrumentLabel,
  getCurrencyInstrumentConfig,
  nearestCurrencyLabel,
  perpetualCurrencyLabel,
  preferredCurrencyPlaceholderLabel,
  type CurrencyFallbackResolver,
  type CurrencyInstrumentConfig,
  type CurrencyInstrumentKey,
  type CurrencyInstrumentResolveMeta,
  type CurrencyMoexSecurity,
  type CurrencyPreferredType,
  type CurrencyResolvedType,
} from "@/lib/domain/cbr-currency-instrument";

export {
  CBR_EQUITY_DIVERGENCE_READ_ALL_REAL,
  CBR_EQUITY_DIVERGENCE_READ_DEMO,
  CBR_REPLAY_CONSISTENCY_STATUS_LINES,
  chartModelToReplaySeries,
  validateReplayConsistency,
  type CbrReplayChartSeries,
  type CbrReplayConsistencyChecks,
  type CbrReplayConsistencyConstraints,
  type CbrReplayConsistencyResult,
  type CbrReplayConsistencyStatus,
} from "@/lib/cbr/cbr-replay-consistency";

export {
  CBR_REPLAY_MODE_HINTS,
  CBR_REPLAY_MODE_LABELS,
  CBR_REPLAY_MARKET_MODES,
  CBR_KEY_DERIVATIVES_SLOT_IDS,
  CBR_KEY_EQUITIES_SLOT_IDS,
  keyReplaySlotIdsForMode,
  type CbrReplayMarketMode,
} from "@/lib/cbr/cbr-replay-market-mode";

export {
  CBR_DERIVATIVES_INSTRUMENT_SPECS,
  CBR_EQUITIES_INSTRUMENT_SPECS,
  resolveCbrReplayInstrumentSpecs,
} from "@/lib/domain/cbr-rate-instrument-config";

export {
  calculateChangeBps,
  calculateSurpriseBps,
  CBR_DECISION_LABELS,
  CBR_EXPECTATION_TYPE_LABELS,
  CBR_SURPRISE_NEUTRAL_BPS,
  CBR_TONE_LABELS,
  decisionLabel,
  enrichCbrRateEvent,
  formatBpsLabel,
  formatRateLabel,
  getCbrRateEventById,
  getCbrRateEvents,
  getCbrRateEventsByYear,
  getCbrRateYears,
  getUpcomingCbrRateEvent,
  isUpcomingEvent,
  resolveDecisionType,
  resolveExpectationType,
  type CbrDecisionType,
  type CbrEventDataStatus,
  type CbrExpectationType,
  type CbrInstrumentDataStatus,
  type CbrInstrumentRole,
  type CbrRateEvent,
  type CbrRateInstrumentConfig,
  type CbrSourceStatus,
  type CbrTone,
  needsSourceVerification,
} from "@/lib/cbr/cbr-rate-events";

export { CBR_RATE_EVENTS_RAW } from "@/lib/cbr/cbr-rate-events-catalog";

export {
  CBR_RATE_EVENTS_DB_TODOS,
  flattenCbrRateEventsDb,
  loadCbrRateEventsDb,
  loadCbrRateEventsRaw,
  mapSourceStatusToDataStatus,
  type CbrRateEventDbRecord,
  type CbrRateEventsByYear,
} from "@/lib/cbr/cbr-rate-events-db";

export {
  CBR_SELECTOR_YEARS,
  countSelectorYearEvents,
  formatChangeBpsRu,
  formatExpectationLine,
  formatRateArrow,
  formatRateCompact,
  formatSelectorMeetingDate,
  groupCbrEventsBySelectorYear,
  resolveDecisionBadgeLabel,
  resolveEventCardVisualState,
  resolveEventDataBadge,
  resolveVerificationBadgeLabel,
  type CbrEventCardVisualState,
  type CbrEventDataBadge,
  type CbrSelectorYear,
} from "@/lib/cbr/cbr-rate-event-selector";

export {
  buildDataIntegrityView,
  CBR_DATA_INTEGRITY_CAPTIONS,
  CBR_EVENT_INTEGRITY_LABELS,
  CBR_INSTRUMENT_INTEGRITY_LABELS,
  chartSlotToInstrumentIntegrity,
  getDataIntegrityCaption,
  getDataIntegrityStatus,
  instrumentsDataFromChartSlots,
  resolveChartsIntegrityBundle,
  resolveDataLayers,
  resolveEventIntegrityBadge,
  type CbrChartsIntegrityBundle,
  type CbrDataIntegrityStatus,
  type CbrDataIntegrityView,
  type CbrDataLayers,
  type CbrEventIntegrityBadge,
  type CbrInstrumentChartIntegrity,
  type CbrManualDataLayer,
  type CbrMoexDataLayer,
  type CbrOfficialDataLayer,
} from "@/lib/cbr/cbr-data-integrity";

export {
  CBR_DEMO_MIXED_WARNING,
  CBR_DEMO_PARTIAL_WARNING,
  CBR_FORBIDDEN_NON_LIVE_PHRASES,
  CBR_REPLAY_INSUFFICIENT_MESSAGE,
  CBR_REPLAY_MARKET_INTEGRITY_LABELS,
  buildReplayAvailabilityFromSlots,
  buildReplayAvailabilityMessage,
  filterAnalyzableReactionMetrics,
  isDemoDataStatus,
  isForbiddenMarketPhrase,
  isMoexAnalyzableDataStatus,
  metricIsMoexAnalyzable,
  patternAllowedForLiveData,
  resolveReplayMarketIntegrity,
  slotIsMoexAnalyzable,
  type CbrReplayAvailabilityMode,
  type CbrReplayMarketIntegrity,
  type CbrReplayMarketIntegrityStatus,
} from "@/lib/cbr/cbr-replay-market-integrity";

export {
  CBR_REPLAY_NO_DATA_MESSAGE,
  buildReplayQualityMessage,
  getReplayDataQuality,
  getReplayDataQualityFromSlots,
  isRealMoexReplayInstrument,
  replayQualityInstrumentsFromSlots,
  replayQualityToAvailabilityMode,
  replayQualityToChartsDisplay,
  type CbrReplayDataQuality,
  type CbrReplayDataQualityResult,
  type CbrReplayQualityInstrument,
} from "@/lib/cbr/cbr-replay-data-quality";

export {
  analyzeReplayLiveCoverage,
  buildConstrainedConfirmation,
  buildConstrainedMarketReaction,
  matrixPatternLabel,
  sanitizePatternLabel,
  type CbrReplayLiveCoverage,
  type CbrReplayLiveScope,
} from "@/lib/cbr/cbr-replay-market-output";

export {
  instrumentConfigsToMoexSpecs,
  mapInstrumentDataStatusToDomain,
  resolveInstrumentSpecsFromEvent,
  toDomainCbrRateEvent,
  type DomainCbrRateEvent,
} from "@/lib/cbr/cbr-domain-adapter";

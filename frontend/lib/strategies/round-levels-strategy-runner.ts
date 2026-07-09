import { analyzeRoundLevelReactions } from "@/lib/strategies/round-level-reaction-engine";
import { computeStrategyLevelsFromCandles } from "@/lib/strategies/strategy-levels-display";
import type {
  StrategyAdapter,
  StrategyRunBadge,
  StrategyRunInput,
  StrategyRunResult,
} from "@/lib/strategies/strategy-runner-types";

function scoreBadge(score: number): StrategyRunBadge {
  if (score >= 80) return "excellent";
  if (score >= 65) return "good";
  if (score >= 45) return "medium";
  return "noisy";
}

function weakPointFromSummary(summary: ReturnType<typeof analyzeRoundLevelReactions>["summary"]): string | undefined {
  if (summary.falseBreakRate >= 0.25) {
    return `ложные пробои ${Math.round(summary.falseBreakRate * 100)}%`;
  }
  if (summary.chopRate >= 0.35) {
    return `пила ${Math.round(summary.chopRate * 100)}%`;
  }
  if (summary.scoreComponents.sample <= 40) {
    return "мало касаний для уверенной статистики";
  }
  if (summary.scoreComponents.speed <= 45) {
    return "медленные реакции";
  }
  return undefined;
}

function timeframeToMinutes(timeframe: StrategyRunInput["timeframe"]): 5 | 10 | 30 {
  const parsed = Number(timeframe.replace("m", ""));
  return parsed === 10 || parsed === 30 ? parsed : 5;
}

function sanitizeScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export const RoundLevelsStrategyRunner: StrategyAdapter = {
  id: "round-levels",
  version: "v0",
  run(input: StrategyRunInput): StrategyRunResult {
    const levels = computeStrategyLevelsFromCandles(input.candles, {
      includeHalfLevels: false,
    });

    const reactionResult = analyzeRoundLevelReactions(input.candles, levels, {
      intervalMinutes: timeframeToMinutes(input.timeframe),
    });
    const summary = reactionResult.summary;
    const score = sanitizeScore(summary.instrumentTechnicalityScore);

    return {
      strategyId: this.id,
      secid: input.secid,
      board: input.board,
      timeframe: input.timeframe,
      period: input.period,
      score,
      badge: scoreBadge(score),
      metrics: {
        touches: summary.totalTouches,
        bounceRate: Number(summary.bounceRate.toFixed(4)),
        breakoutRate: Number(summary.breakoutRate.toFixed(4)),
        falseBreakRate: Number(summary.falseBreakRate.toFixed(4)),
        chopRate: Number(summary.chopRate.toFixed(4)),
        avgBounce: Number(summary.avgBounce.toFixed(4)),
        avgDive: Number(summary.avgDive.toFixed(4)),
        levelsScore: summary.scoreComponents.levels,
        sampleScore: summary.scoreComponents.sample,
        clarityScore: summary.scoreComponents.clarity,
        lowChopScore: summary.scoreComponents.lowChop,
        speedScore: summary.scoreComponents.speed,
      },
      bestLevels: summary.bestLevels.map((item) => item.level),
      weakPoint: weakPointFromSummary(summary),
      sampleWarning: summary.sampleWarning,
      updatedAt: new Date().toISOString(),
    };
  },
};

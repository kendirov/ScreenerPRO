"use client";

import {
  BOOK_MODEL_SCENARIOS,
  type BookModelScenarioId,
  type BookModelStepExplain,
} from "@/lib/domain/book-model-scenarios";
import { cn } from "@/lib/utils/cn";

type BookModelScenarioBarProps = {
  scenarioId: BookModelScenarioId;
  caption?: string | null;
  presentation?: boolean;
};

export function BookModelScenarioBar({
  scenarioId,
  caption,
  presentation = false,
}: BookModelScenarioBarProps) {
  const scenario = BOOK_MODEL_SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) return null;

  const text = caption ?? scenario.caption;

  return (
    <div
      className={cn(
        "book-model-scenario-bar space-y-2",
        presentation && "book-model-scenario-bar--presentation",
      )}
    >
      <p
        className={cn(
          "rounded border border-amber-500/20 bg-amber-950/25 font-mono text-amber-100/90",
          presentation ? "px-4 py-3 text-center text-[13px] leading-relaxed" : "px-2.5 py-1.5 text-[10px]",
        )}
      >
        {text}
      </p>
      {!presentation && scenario ? <BookModelStepExplainPanel explain={scenario.explain} /> : null}
    </div>
  );
}

function BookModelStepExplainPanel({ explain }: { explain: BookModelStepExplain }) {
  const rows: { title: string; text: string }[] = [
    { title: "Что видим", text: explain.see },
    { title: "Что это значит", text: explain.means },
    { title: "Куда смотреть", text: explain.look },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {rows.map((row) => (
        <div
          key={row.title}
          className="rounded border border-white/[0.06] bg-[#030508] px-2.5 py-2"
        >
          <p className="font-mono text-[9px] uppercase tracking-wide text-slate-500">{row.title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{row.text}</p>
        </div>
      ))}
    </div>
  );
}

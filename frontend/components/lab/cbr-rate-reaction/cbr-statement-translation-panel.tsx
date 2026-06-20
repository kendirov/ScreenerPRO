"use client";

import { ArrowRight, ExternalLink, FileText } from "lucide-react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { DataStatusBadge } from "@/components/ui/metrics-minimalism";
import type { CbrRateEvent } from "@/lib/domain/cbr-rate-events";
import {
  buildStatementBriefView,
  collectWatchlistImpactsForPhrase,
  type CbrStatementPhraseBrief,
  type CbrStatementSource,
} from "@/lib/domain/cbr-rate-statement-translation";
import { cn } from "@/lib/utils/cn";

export function CbrStatementTranslationPanel({ event }: { event: CbrRateEvent }) {
  const view = buildStatementBriefView(event);

  return (
    <LabGlassPanel depth={20} className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-lab-border/45 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-lab-amber/80" />
          <h3 className="text-[11px] font-semibold text-lab-text">
            Текст решения ЦБ → трейдерский перевод
          </h3>
          <StatementSourceBadge source={view.source} label={view.sourceLabel} />
        </div>
        {view.statementUrl ? (
          <a
            href={view.statementUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-lab-cyan/90 hover:text-lab-cyan"
          >
            официальный текст
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : event.officialUrl ? (
          <a
            href={event.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-lab-dim hover:text-lab-muted"
          >
            cbr.ru · ключевая ставка
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      {!view.hasPhrases ? (
        <div className="px-3 py-4">
          <p className="text-[11px] text-lab-muted">
            {view.isUpcoming
              ? "Фразы из пресс-релиза появятся после 13:30 — пока можно задать черновик вручную в config."
              : "Брифинг по тексту решения не заполнен."}
          </p>
        </div>
      ) : (
        <div className="grid gap-px bg-lab-border/30 md:grid-cols-2">
          {view.phrases.map((phrase, index) => (
            <PhraseBriefCard key={`${phrase.officialPhrase}-${index}`} phrase={phrase} index={index} />
          ))}
        </div>
      )}

      <p className="border-t border-lab-border/40 px-3 py-2 text-[9px] text-lab-dim">
        Наблюдение по формулировкам, не прогноз и не рекомендация. Реакцию сверяй по графикам и матрице.
      </p>
    </LabGlassPanel>
  );
}

function StatementSourceBadge({ source, label }: { source: CbrStatementSource; label: string }) {
  return (
    <DataStatusBadge
      kind={source === "official" ? "live" : "fallback"}
      label={label}
      className="text-[8px]"
    />
  );
}

function PhraseBriefCard({ phrase, index }: { phrase: CbrStatementPhraseBrief; index: number }) {
  const impacts = collectWatchlistImpactsForPhrase(phrase);

  return (
    <article className="flex flex-col bg-lab-bg-deep/25 p-3">
      <div className="mb-2 flex items-start gap-2">
        <span className="mt-0.5 shrink-0 font-mono text-[9px] text-lab-dim">{index + 1}</span>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-[8px] uppercase tracking-[0.1em] text-lab-dim">Official statement</p>
            <p className="mt-0.5 text-[11px] font-medium leading-snug text-lab-text/95">
              «{phrase.officialPhrase}»
            </p>
          </div>

          <div className="flex items-start gap-1.5 rounded-md border border-lab-border/40 bg-lab-bg-deep/40 px-2 py-1.5">
            <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-lab-cyan/70" aria-hidden />
            <div>
              <p className="text-[8px] uppercase tracking-[0.1em] text-lab-cyan/70">Market translation</p>
              <p className="mt-0.5 text-[11px] leading-snug text-lab-muted">{phrase.marketTranslation}</p>
            </div>
          </div>
        </div>
      </div>

      {impacts.length > 0 ? (
        <div className="mt-auto border-t border-lab-border/30 pt-2">
          <p className="mb-1.5 text-[8px] uppercase tracking-[0.1em] text-lab-dim">Watchlist impact</p>
          <ul className="space-y-1">
            {impacts.map((item) => (
              <li
                key={item.slot}
                className={cn(
                  "grid grid-cols-[minmax(88px,auto)_1fr] gap-x-2 gap-y-0.5 text-[10px] leading-snug",
                )}
              >
                <span className="font-mono text-lab-dim">
                  {item.ticker}
                  <span className="ml-1 font-sans text-[9px] text-lab-dim/80">· {item.label}</span>
                </span>
                <span className="text-lab-muted">{item.read}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
